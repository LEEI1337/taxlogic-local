/**
 * TaxLogic.local - IPC Handlers
 *
 * Registers all IPC handlers for communication between main and renderer processes.
 * Connects all backend services to the frontend.
 */

import * as path from 'path';
import * as fs from 'fs';

import { ipcMain, app, dialog, shell, BrowserWindow, safeStorage } from 'electron';
import { z } from 'zod';

// Import services
import { llmService } from '../backend/services/llmService';
import { dbService, UserProfile } from '../backend/services/dbService';
import { ocrService } from '../backend/services/ocrService';
import { documentOrganizer } from '../backend/services/documentOrganizer';
import { formGenerator, L1FormData, L1abFormData, L1kFormData } from '../backend/services/formGenerator';
import { guideGenerator } from '../backend/services/guideGenerator';
import { sanitizeUserInput } from '../backend/utils/validation';
// Import agents
import { interviewerAgent } from '../backend/agents/interviewerAgent';
import { documentInspectorAgent } from '../backend/agents/documentInspectorAgent';
import { analyzerAgent, TaxProfile } from '../backend/agents/analyzerAgent';
// Import RAG
import { knowledgeBase, KnowledgeCategory } from '../backend/rag/knowledgeBase';
import { retriever } from '../backend/rag/retriever';
import {
  getAllTaxRuleStatuses,
  getTaxRuleStatus,
  getTaxRulesForYear,
  listSupportedTaxRuleYears
} from '../backend/taxRules';

import {
  apiKeyNameSchema,
  apiKeyValueSchema,
  documentUploadSchema,
  filePathSchema,
  formTypeSchema,
  idSchema,
  interviewSaveSchema,
  interviewStartSchema,
  llmConfigSchema,
  llmModelSchema,
  llmQuerySchema,
  outputPathSchema,
  ragQuerySchema,
  saveFileRequestSchema,
  selectFilesFiltersSchema,
  settingKeySchema,
  taxYearSchema,
  textInputSchema
} from './ipcValidation';
import { logger } from './utils/logger';

// State
let currentUserId: string | null = null;
let currentInterviewId: string | null = null;
let currentTaxYear: number | null = null;

/**
 * Initialize all services
 */
async function initializeServices(): Promise<void> {
  logger.info('Initializing backend services...');

  try {
    // Initialize database
    await dbService.initialize();
    logger.info('Database initialized');

    // Initialize knowledge base (non-blocking - don't prevent app from working if embeddings fail)
    const targetTaxYear = currentTaxYear ?? (new Date().getFullYear() - 1);
    knowledgeBase.initialize(targetTaxYear).then(() => {
      logger.info('Knowledge base initialized');
    }).catch((kbError) => {
      logger.warn('Knowledge base initialization failed (RAG features will be unavailable):', kbError);
    });

    // Check for existing user or create new one
    const users = dbService.getAllUsers();
    if (users.length > 0) {
      currentUserId = users[0].id;
      logger.info(`Loaded existing user: ${currentUserId}`);
    }

    logger.info('All services initialized successfully');
  } catch (error) {
    logger.error('Error initializing services:', error);
    throw error;
  }
}

/**
 * Register all IPC handlers
 */
export function registerIpcHandlers(): void {
  logger.info('Registering IPC handlers...');

  // Initialize services on first call
  let servicesInitialized = false;
  const ensureServicesInitialized = async () => {
    if (!servicesInitialized) {
      currentTaxYear = resolveActiveTaxYear();
      await initializeServices();
      servicesInitialized = true;
    }
  };

  const SETTINGS_TAX_YEAR_KEY = 'currentTaxYear';

  const parseOrThrow = <T>(schema: z.ZodSchema<T>, value: unknown, context: string): T => {
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      const details = parsed.error.errors.map((issue) => issue.message).join('; ');
      throw new Error(`${context}: ${details}`);
    }
    return parsed.data;
  };

  const getFallbackTaxYear = (): number => new Date().getFullYear() - 1;

  const resolveActiveTaxYear = (requestedYear?: unknown): number => {
    if (typeof requestedYear !== 'undefined' && requestedYear !== null) {
      const parsedRequestedYear = parseOrThrow(taxYearSchema, requestedYear, 'Invalid tax year');
      return parsedRequestedYear;
    }

    if (currentTaxYear !== null) {
      return currentTaxYear;
    }

    const settings = loadSettings();
    const persistedYear = settings[SETTINGS_TAX_YEAR_KEY];
    if (typeof persistedYear === 'number' && Number.isInteger(persistedYear)) {
      return persistedYear;
    }
    if (typeof persistedYear === 'string') {
      const parsedYear = Number(persistedYear);
      if (Number.isInteger(parsedYear)) {
        return parsedYear;
      }
    }

    return getFallbackTaxYear();
  };

  const setActiveTaxYear = async (taxYear: number): Promise<void> => {
    currentTaxYear = taxYear;
    const settings = loadSettings();
    settings[SETTINGS_TAX_YEAR_KEY] = taxYear;
    saveSettings(settings);

    try {
      await knowledgeBase.initialize(taxYear);
    } catch (error) {
      logger.warn('Knowledge base year switch failed', { taxYear, error });
    }
  };

  const assertTaxRulesReady = (taxYear: number, operation: string): void => {
    const status = getTaxRuleStatus(taxYear);
    if (status.state !== 'ok') {
      throw new Error(
        `Steuerregeln fuer ${taxYear} sind nicht bereit (${status.state}) bei ${operation}. ${status.message}. Bitte Regelpaket aktualisieren und erneut pruefen.`
      );
    }
  };

  // ========================================
  // Window Management
  // ========================================

  ipcMain.handle('window:minimize', async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) win.minimize();
  });

  ipcMain.handle('window:maximize', async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
    }
  });

  ipcMain.handle('window:close', async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) win.close();
  });

  ipcMain.handle('window:isMaximized', async () => {
    const win = BrowserWindow.getFocusedWindow();
    return win ? win.isMaximized() : false;
  });

  // ========================================
  // App Information
  // ========================================

  ipcMain.handle('app:getVersion', async () => {
    return app.getVersion();
  });

  ipcMain.handle('app:getUserDataPath', async () => {
    return app.getPath('userData');
  });

  ipcMain.handle('app:getPlatform', async () => {
    return process.platform;
  });

  // ========================================
  // LLM Operations
  // ========================================

  ipcMain.handle('llm:checkStatus', async () => {
    logger.debug('Checking LLM status...');
    try {
      const status = await llmService.checkStatus();
      return status;
    } catch (error) {
      logger.error('Error checking LLM status:', error);
      return { ollama: false, lmStudio: false, claude: false, openai: false, gemini: false, openaiCompatible: false };
    }
  });

  ipcMain.handle('llm:getAvailableModels', async () => {
    logger.debug('Getting available models...');
    try {
      const models = await llmService.getAvailableModels();
      return models;
    } catch (error) {
      logger.error('Error getting models:', error);
      return [];
    }
  });

  ipcMain.handle('llm:setModel', async (_event, modelName: string) => {
    const validatedModel = parseOrThrow(llmModelSchema, modelName, 'Invalid llm:setModel payload');
    logger.info('Setting model');
    llmService.setModel(validatedModel);
  });

  ipcMain.handle('llm:setConfig', async (_event, config: Record<string, unknown>) => {
    const validatedConfig = parseOrThrow(llmConfigSchema, config, 'Invalid llm:setConfig payload');
    logger.info('Updating LLM config', { keys: Object.keys(validatedConfig) });
    llmService.setConfig(validatedConfig);
  });

  ipcMain.handle('llm:query', async (_event, prompt: string, conversationHistory?: Array<{ role: string; content: string }>) => {
    logger.debug('LLM query received');
    try {
      const validatedPayload = parseOrThrow(
        llmQuerySchema,
        { prompt, conversationHistory },
        'Invalid llm:query payload'
      );
      const history = validatedPayload.conversationHistory?.map(m => ({
        role: m.role,
        content: m.content
      })) || [];

      const response = await llmService.query(validatedPayload.prompt, history);
      return response.content;
    } catch (error) {
      logger.error('LLM query error:', error);
      throw error;
    }
  });

  // ========================================
  // Interview Operations
  // ========================================

  ipcMain.handle('interview:start', async (_event, userProfile: UserProfile, taxYear?: number) => {
    logger.info('Starting interview...');
    await ensureServicesInitialized();

    try {
      const validatedPayload = parseOrThrow(
        interviewStartSchema,
        { userProfile, taxYear },
        'Invalid interview:start payload'
      );
      const resolvedTaxYear = resolveActiveTaxYear(validatedPayload.taxYear);
      await setActiveTaxYear(resolvedTaxYear);

      // Create or get user
      if (!currentUserId) {
        const user = dbService.createUser(validatedPayload.userProfile as UserProfile);
        currentUserId = user.id;
      } else {
        dbService.updateUser(currentUserId, validatedPayload.userProfile as UserProfile);
      }

      // Create interview record
      const interview = dbService.createInterview(currentUserId, resolvedTaxYear);
      currentInterviewId = interview.id;

      // Start interview agent
      const response = interviewerAgent.startInterview(currentUserId, resolvedTaxYear);

      return {
        message: response.message,
        question: response.nextQuestion,
        interviewId: interview.id
      };
    } catch (error) {
      logger.error('Error starting interview:', error);
      throw error;
    }
  });

  ipcMain.handle('interview:continue', async (_event, userInput: string) => {
    const safeUserInput = parseOrThrow(
      textInputSchema,
      sanitizeUserInput(userInput),
      'Invalid interview:continue payload'
    );
    logger.debug('Continuing interview with input length', { length: safeUserInput.length });

    try {
      const response = await interviewerAgent.processResponse(safeUserInput);

      // Save responses to database
      if (currentInterviewId) {
        const responses = interviewerAgent.getResponses();
        dbService.updateInterviewResponses(currentInterviewId, responses);
      }

      // Update interview status to completed in DB
      if (response.isComplete && currentInterviewId) {
        try {
          dbService.updateInterviewStatus(currentInterviewId, 'completed');
          logger.info('Interview marked as completed:', currentInterviewId);
        } catch (statusError) {
          logger.warn('Could not update interview status:', statusError);
        }
      }

      return {
        message: response.message,
        question: response.nextQuestion,
        isComplete: response.isComplete,
        validationError: response.validationError
      };
    } catch (error) {
      logger.error('Error continuing interview:', error);
      throw error;
    }
  });

  ipcMain.handle('interview:getProfile', async () => {
    logger.debug('Getting interview profile...');
    return interviewerAgent.getResponses();
  });

  ipcMain.handle('interview:save', async (_event, data: Record<string, unknown>) => {
    logger.info('Saving interview data...');
    const validatedData = parseOrThrow(interviewSaveSchema, data, 'Invalid interview:save payload');
    if (currentInterviewId) {
      dbService.updateInterviewResponses(currentInterviewId, validatedData);
    }
  });

  ipcMain.handle('interview:load', async (_event, id: string) => {
    const interviewId = parseOrThrow(idSchema, id, 'Invalid interview:load payload');
    logger.info('Loading interview', { interviewId });
    const interview = dbService.getInterview(interviewId);
    if (interview) {
      // Restore agent context so subsequent processResponse calls work
      currentInterviewId = interview.id;
      await setActiveTaxYear(interview.tax_year);
      try {
        const responses = interview.responses || {};
        interviewerAgent.restoreContext({
          userId: interview.user_id,
          taxYear: interview.tax_year,
          currentQuestionId: (responses._currentQuestionId as string) || 'greeting',
          responses: responses,
          conversationHistory: [],
          validationErrors: []
        });
        logger.info('Interview context restored for:', id);
      } catch (ctxError) {
        logger.warn('Could not restore interview context:', ctxError);
      }
    }
    return interview || {};
  });

  // ========================================
  // Document Operations
  // ========================================

  ipcMain.handle('documents:upload', async (_event, filePaths: string[]) => {
    const validatedFilePaths = parseOrThrow(
      documentUploadSchema,
      filePaths,
      'Invalid documents:upload payload'
    );
    logger.info('Uploading documents', { count: validatedFilePaths.length });
    await ensureServicesInitialized();

    const results = [];
    for (const filePath of validatedFilePaths) {
      try {
        // Process document with OCR
        const analysis = await documentInspectorAgent.processDocument(filePath);

        // Save to database if we have a user
        if (currentUserId) {
          const doc = dbService.createDocument(currentUserId, {
            original_filename: path.basename(filePath),
            stored_path: analysis.filePath,
            category: analysis.classification.category,
            subcategory: analysis.classification.subcategory,
            extracted_data: analysis.extractedData as unknown as Record<string, unknown>,
            ocr_confidence: analysis.ocrResult.confidence,
            interview_id: currentInterviewId || undefined
          });

          results.push({
            id: doc.id,
            path: filePath,
            status: 'processed',
            analysis
          });
        } else {
          results.push({
            id: analysis.id,
            path: filePath,
            status: 'processed',
            analysis
          });
        }
      } catch (error) {
        logger.error('Error processing document', { fileName: path.basename(filePath), error });
        results.push({
          id: `error_${Date.now()}`,
          path: filePath,
          status: 'error',
          error: (error as Error).message
        });
      }
    }

    return results;
  });

  ipcMain.handle('documents:process', async (_event, documentId: string) => {
    const validatedDocumentId = parseOrThrow(idSchema, documentId, 'Invalid documents:process payload');
    logger.info('Processing document', { documentId: validatedDocumentId });
    // Document is already processed during upload
    return { id: validatedDocumentId, status: 'processed' };
  });

  ipcMain.handle('documents:organize', async () => {
    logger.info('Organizing documents...');

    if (!currentUserId) {
      return { organized: false, error: 'No user logged in' };
    }

    const taxYear = resolveActiveTaxYear();
    const manifest = await documentOrganizer.buildManifest(currentUserId, taxYear);

    return {
      organized: true,
      manifest
    };
  });

  ipcMain.handle('documents:getManifest', async () => {
    logger.debug('Getting document manifest...');

    if (!currentUserId) {
      return { documents: [], lastUpdated: new Date().toISOString() };
    }

    const documents = dbService.getDocumentsByUser(currentUserId);
    return {
      documents,
      lastUpdated: new Date().toISOString()
    };
  });

  // ========================================
  // Analysis Operations
  // ========================================

  ipcMain.handle('analysis:calculate', async () => {
    logger.info('Performing tax analysis...');
    await ensureServicesInitialized();

    try {
      const interviewResponses = interviewerAgent.getResponses();
      const taxYear = resolveActiveTaxYear();
      assertTaxRulesReady(taxYear, 'analysis:calculate');
      await setActiveTaxYear(taxYear);

      // Build tax profile from interview responses
      const profile: TaxProfile = {
        taxYear,
        personalInfo: {
          name: interviewResponses.greeting as string,
          hasDisability: interviewResponses.disability as boolean || false,
          disabilityDegree: interviewResponses.disability_degree as number
        },
        income: {
          grossIncome: interviewResponses.gross_income as number || 0,
          withheldTax: (interviewResponses.gross_income as number || 0) * 0.35, // Estimate
          employerCount: interviewResponses.employer_count as number || 1,
          hasSelfEmployment: interviewResponses.employment_type === 'SelbststÃ¤ndig (Einzelunternehmer)' ||
                            interviewResponses.employment_type === 'Gemischt (angestellt + selbststÃ¤ndig)'
        },
        deductions: {
          pendlerpauschale: {
            distance: interviewResponses.commute_distance as number || 0,
            daysPerYear: 220,
            publicTransportFeasible: (interviewResponses.commute_public_feasible as string)?.includes('Ja') || false
          },
          homeOffice: {
            days: interviewResponses.home_office_days as number || 0,
            equipmentCost: 0
          },
          workEquipment: interviewResponses.work_equipment === true
            ? (interviewResponses.work_equipment_details as string)?.match(/(\d+)/)?.[1]
              ? parseInt((interviewResponses.work_equipment_details as string).match(/(\d+)/)![1])
              : 0
            : 0,
          education: interviewResponses.education_expenses === true
            ? (interviewResponses.education_details as string)?.match(/(\d+)/)?.[1]
              ? parseInt((interviewResponses.education_details as string).match(/(\d+)/)![1])
              : 0
            : 0,
          otherWerbungskosten: 0,
          churchTax: interviewResponses.church_tax_amount as number || 0,
          donations: interviewResponses.donations_amount as number || 0,
          insurance: 0,
          medicalExpenses: interviewResponses.medical_amount as number || 0,
          disabilityExpenses: 0,
          childcareExpenses: interviewResponses.childcare_amount as number || 0
        },
        family: {
          maritalStatus: 'single',
          singleEarner: interviewResponses.single_earner === 'Alleinverdiener',
          singleParent: interviewResponses.single_earner === 'Alleinerzieher',
          children: interviewResponses.has_children === true
            ? Array(interviewResponses.children_count as number || 1).fill({
                birthDate: '2015-01-01',
                receivingFamilyAllowance: true,
                inHousehold: true
              })
            : []
        }
      };

      // Calculate tax
      const result = await analyzerAgent.calculateTax(profile);

      // Save calculation to database
      if (currentUserId && currentInterviewId) {
        dbService.createCalculation(currentUserId, currentInterviewId, {
          tax_year: taxYear,
          total_income: result.grossIncome,
          total_deductions: result.effectiveDeductions,
          estimated_refund: result.estimatedRefund,
          calculation_details: result as unknown as Record<string, unknown>
        });
      }

      return result;
    } catch (error) {
      logger.error('Analysis error', error);
      throw error;
    }
  });

  ipcMain.handle('analysis:getResults', async () => {
    logger.debug('Getting analysis results...');

    if (currentInterviewId) {
      const calculation = dbService.getLatestCalculation(currentInterviewId);
      return calculation?.calculation_details || {};
    }

    return {};
  });

  ipcMain.handle('analysis:optimize', async () => {
    logger.info('Optimizing deductions...');

    // Get latest calculation
    if (currentInterviewId) {
      const calculation = dbService.getLatestCalculation(currentInterviewId);
      if (calculation) {
        const details = calculation.calculation_details as { analysis?: { recommendations?: unknown[] } };
        return {
          suggestions: details?.analysis?.recommendations || []
        };
      }
    }

    return { suggestions: [] };
  });

  // ========================================
  // Form Operations
  // ========================================

  ipcMain.handle('forms:generate', async (_event, formType: string) => {
    const validatedFormType = parseOrThrow(formTypeSchema, formType, 'Invalid forms:generate payload');
    logger.info('Generating form', { formType: validatedFormType });
    await ensureServicesInitialized();

    try {
      const interviewResponses = interviewerAgent.getResponses();
      const taxYear = resolveActiveTaxYear();
      assertTaxRulesReady(taxYear, 'forms:generate');
      await setActiveTaxYear(taxYear);
      const rules = getTaxRulesForYear(taxYear);

      let generatedForm;

      // Load user profile from DB for form data
      const userProfile = currentUserId ? dbService.getUser(currentUserId) : null;
      const profileData = userProfile?.profile_data || {};
      const greeting = interviewResponses.greeting as string || '';
      const nameParts = greeting.split(' ');

      if (validatedFormType === 'L1' || validatedFormType === 'all') {
        const l1Data: L1FormData = {
          sozialversicherungsnummer: (profileData as Record<string, unknown>).svnr as string || '',
          familienname: (profileData as Record<string, unknown>).last_name as string || nameParts.slice(1).join(' ') || 'BITTE AUSFÃœLLEN',
          vorname: (profileData as Record<string, unknown>).first_name as string || nameParts[0] || 'BITTE AUSFÃœLLEN',
          geburtsdatum: (profileData as Record<string, unknown>).birth_date as string || 'BITTE AUSFÃœLLEN',
          strasse: (profileData as Record<string, unknown>).street as string || 'BITTE AUSFÃœLLEN',
          hausnummer: (profileData as Record<string, unknown>).house_number as string || '',
          plz: (profileData as Record<string, unknown>).postal_code as string || '',
          ort: (profileData as Record<string, unknown>).city as string || '',
          veranlagungsjahr: taxYear,
          bruttoeinkunfte: interviewResponses.gross_income as number,
          homeOfficeTage: interviewResponses.home_office_days as number,
          homeOfficePauschale: Math.min(
            (interviewResponses.home_office_days as number || 0) * rules.homeOffice.perDay,
            rules.homeOffice.maxAmount
          ),
          pendlerkilometer: interviewResponses.commute_distance as number,
          kirchenbeitrag: interviewResponses.church_tax_amount as number,
          spendenBeguenstigte: interviewResponses.donations_amount as number,
          krankheitskosten: interviewResponses.medical_amount as number,
          kinderbetreuungskosten: interviewResponses.childcare_amount as number
        };

        generatedForm = await formGenerator.generateL1(l1Data);
      } else if (validatedFormType === 'L1ab') {
        const l1abData: L1abFormData = {
          veranlagungsjahr: taxYear
        };
        generatedForm = await formGenerator.generateL1ab(l1abData);
      } else if (validatedFormType === 'L1k') {
        const l1kData: L1kFormData = {
          veranlagungsjahr: taxYear,
          kinder: [],
          familienbonusPlus: true
        };
        generatedForm = await formGenerator.generateL1k(l1kData);
      }

      // Save to database
      if (currentUserId && currentInterviewId && generatedForm) {
        const persistedFormType = validatedFormType === 'all' ? 'L1' : validatedFormType;
        dbService.createForm(
          currentUserId,
          currentInterviewId,
          persistedFormType as 'L1' | 'L1ab' | 'L1k',
          generatedForm.jsonData
        );
      }

      return generatedForm?.pdfPath || '';
    } catch (error) {
      logger.error('Form generation error:', error);
      throw error;
    }
  });

  ipcMain.handle('forms:preview', async (_event, formType: string) => {
    const validatedFormType = parseOrThrow(formTypeSchema, formType, 'Invalid forms:preview payload');
    logger.debug('Previewing form', { formType: validatedFormType });

    if (currentInterviewId) {
      const forms = dbService.getFormsByInterview(currentInterviewId);
      const targetType = validatedFormType === 'all' ? 'L1' : validatedFormType;
      const form = forms.find(f => f.form_type === targetType);
      return form?.pdf_path || '';
    }

    return '';
  });

  ipcMain.handle('forms:export', async (_event, formType: string, outputPath: string) => {
    const validatedFormType = parseOrThrow(formTypeSchema, formType, 'Invalid forms:export formType');
    const validatedOutputPath = parseOrThrow(outputPathSchema, outputPath, 'Invalid forms:export outputPath');
    logger.info('Exporting form', { formType: validatedFormType });
    const taxYear = resolveActiveTaxYear();
    assertTaxRulesReady(taxYear, 'forms:export');

    if (currentInterviewId) {
      const forms = dbService.getFormsByInterview(currentInterviewId);
      const targetType = validatedFormType === 'all' ? 'L1' : validatedFormType;
      const form = forms.find(f => f.form_type === targetType);

      if (form?.pdf_path && fs.existsSync(form.pdf_path)) {
        fs.copyFileSync(form.pdf_path, validatedOutputPath);
      }
    }
  });

  ipcMain.handle('forms:getAvailable', async () => {
    return ['L1', 'L1ab', 'L1k'];
  });

  // ========================================
  // Guide Operations
  // ========================================

  ipcMain.handle('guide:generate', async () => {
    logger.info('Generating step-by-step guide...');
    await ensureServicesInitialized();

    try {
      const interviewResponses = interviewerAgent.getResponses();
      const taxYear = resolveActiveTaxYear();
      assertTaxRulesReady(taxYear, 'guide:generate');
      await setActiveTaxYear(taxYear);
      const rules = getTaxRulesForYear(taxYear);

      // Get calculation
      let calculation;
      if (currentInterviewId) {
        calculation = dbService.getLatestCalculation(currentInterviewId);
      }

      // Load user profile from DB for guide data
      const guideUserProfile = currentUserId ? dbService.getUser(currentUserId) : null;
      const guideProfileData = guideUserProfile?.profile_data || {};
      const guideGreeting = interviewResponses.greeting as string || '';
      const guideNameParts = guideGreeting.split(' ');

      const guide = await guideGenerator.generateGuide({
        userId: currentUserId || 'anonymous',
        taxYear,
        formData: {
          sozialversicherungsnummer: (guideProfileData as Record<string, unknown>).svnr as string || 'XXXX XXXXXX',
          familienname: (guideProfileData as Record<string, unknown>).last_name as string || guideNameParts.slice(1).join(' ') || 'Name',
          vorname: (guideProfileData as Record<string, unknown>).first_name as string || guideNameParts[0] || 'Vorname',
          geburtsdatum: (guideProfileData as Record<string, unknown>).birth_date as string || '',
          strasse: (guideProfileData as Record<string, unknown>).street as string || '',
          hausnummer: (guideProfileData as Record<string, unknown>).house_number as string || '',
          plz: (guideProfileData as Record<string, unknown>).postal_code as string || '',
          ort: (guideProfileData as Record<string, unknown>).city as string || '',
          veranlagungsjahr: taxYear,
          bruttoeinkunfte: interviewResponses.gross_income as number,
          homeOfficeTage: interviewResponses.home_office_days as number,
          homeOfficePauschale: Math.min(
            (interviewResponses.home_office_days as number || 0) * rules.homeOffice.perDay,
            rules.homeOffice.maxAmount
          )
        },
        hasL1ab: false,
        hasL1k: interviewResponses.has_children as boolean || false,
        totalDeductions: calculation?.total_deductions || 0,
        estimatedRefund: calculation?.estimated_refund || 0,
        documentCount: currentUserId ? dbService.getDocumentsByUser(currentUserId).length : 0
      });

      // Export as markdown
      const markdown = guideGenerator.exportAsMarkdown(guide);

      return markdown;
    } catch (error) {
      logger.error('Guide generation error:', error);
      throw error;
    }
  });

  ipcMain.handle('guide:export', async (_event, outputPath: string) => {
    const validatedOutputPath = parseOrThrow(outputPathSchema, outputPath, 'Invalid guide:export outputPath');
    logger.info('Exporting guide');

    try {
      const taxYear = resolveActiveTaxYear();
      assertTaxRulesReady(taxYear, 'guide:export');
      await setActiveTaxYear(taxYear);

      // Load user profile from DB for export
      const exportUserProfile = currentUserId ? dbService.getUser(currentUserId) : null;
      const exportProfileData = exportUserProfile?.profile_data || {};

      const guide = await guideGenerator.generateGuide({
        userId: currentUserId || 'anonymous',
        taxYear,
        formData: {
          sozialversicherungsnummer: (exportProfileData as Record<string, unknown>).svnr as string || 'XXXX XXXXXX',
          familienname: (exportProfileData as Record<string, unknown>).last_name as string || 'Name',
          vorname: (exportProfileData as Record<string, unknown>).first_name as string || 'Vorname',
          geburtsdatum: (exportProfileData as Record<string, unknown>).birth_date as string || '',
          strasse: (exportProfileData as Record<string, unknown>).street as string || '',
          hausnummer: (exportProfileData as Record<string, unknown>).house_number as string || '',
          plz: (exportProfileData as Record<string, unknown>).postal_code as string || '',
          ort: (exportProfileData as Record<string, unknown>).city as string || '',
          veranlagungsjahr: taxYear
        },
        hasL1ab: false,
        hasL1k: false,
        totalDeductions: 0,
        estimatedRefund: 0,
        documentCount: 0
      });

      const pdfPath = await guideGenerator.exportAsPDF(guide);

      // Copy to desired output path
      if (validatedOutputPath && pdfPath) {
        fs.copyFileSync(pdfPath, validatedOutputPath);
      }

      return pdfPath;
    } catch (error) {
      logger.error('Guide export error:', error);
      throw error;
    }
  });

  // ========================================
  // RAG / Knowledge Base Operations
  // ========================================

  ipcMain.handle('rag:query', async (_event, question: string, category?: string, taxYear?: number) => {
    const validatedRequest = parseOrThrow(
      ragQuerySchema,
      { question, category, taxYear },
      'Invalid rag:query payload'
    );
    logger.info('RAG query received');
    await ensureServicesInitialized();

    try {
      const targetTaxYear = resolveActiveTaxYear(validatedRequest.taxYear);
      await setActiveTaxYear(targetTaxYear);
      const response = await retriever.query({
        question: validatedRequest.question,
        category: validatedRequest.category as KnowledgeCategory | undefined,
        includeSourceCitations: true,
        taxYear: targetTaxYear
      });

      return response;
    } catch (error) {
      logger.error('RAG query error:', error);
      throw error;
    }
  });

  ipcMain.handle('rag:search', async (_event, query: string, topK: number = 5) => {
    const validatedQuery = parseOrThrow(textInputSchema, query, 'Invalid rag:search query');
    const validatedTopK = Math.max(1, Math.min(20, Math.floor(topK || 5)));
    logger.debug('Knowledge base search', { topK: validatedTopK });

    try {
      const results = await knowledgeBase.search(validatedQuery, validatedTopK);
      return results.map(r => ({
        title: r.chunk.metadata.title,
        content: r.chunk.content,
        source: r.document.source,
        similarity: r.similarity
      }));
    } catch (error) {
      logger.error('Search error:', error);
      return [];
    }
  });

  // ========================================
  // Database Operations
  // ========================================

  ipcMain.handle('db:getUserProfile', async () => {
    logger.debug('Getting user profile from database...');
    await ensureServicesInitialized();

    if (currentUserId) {
      return dbService.getUser(currentUserId);
    }
    return null;
  });

  ipcMain.handle('db:saveUserProfile', async (_event, profile: UserProfile) => {
    logger.info('Saving user profile to database...');
    await ensureServicesInitialized();

    if (currentUserId) {
      dbService.updateUser(currentUserId, profile);
    } else {
      const user = dbService.createUser(profile);
      currentUserId = user.id;
    }
  });

  ipcMain.handle('db:getInterviews', async () => {
    logger.debug('Getting interviews from database...');
    await ensureServicesInitialized();

    if (currentUserId) {
      return dbService.getInterviewsByUser(currentUserId);
    }
    return [];
  });

  ipcMain.handle('db:getDocuments', async () => {
    logger.debug('Getting documents from database...');
    await ensureServicesInitialized();

    if (currentUserId) {
      return dbService.getDocumentsByUser(currentUserId);
    }
    return [];
  });

  ipcMain.handle('db:getExpenses', async () => {
    logger.debug('Getting expenses from database...');
    await ensureServicesInitialized();

    if (currentUserId) {
      return dbService.getExpensesByUser(currentUserId);
    }
    return [];
  });

  // ========================================
  // File System Operations
  // ========================================

  ipcMain.handle('fs:selectDirectory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Ordner auswÃ¤hlen'
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle('fs:selectFiles', async (_event, filters?: Array<{ name: string; extensions: string[] }>) => {
    const validatedFilters = filters
      ? parseOrThrow(selectFilesFiltersSchema, filters, 'Invalid fs:selectFiles filters')
      : undefined;
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      title: 'Dateien auswÃ¤hlen',
      filters: validatedFilters || [
        { name: 'Dokumente', extensions: ['pdf', 'png', 'jpg', 'jpeg'] },
        { name: 'Alle Dateien', extensions: ['*'] }
      ]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths;
  });

  ipcMain.handle('fs:openPath', async (_event, filePath: string) => {
    const validatedPath = parseOrThrow(filePathSchema, filePath, 'Invalid fs:openPath payload');
    await shell.openPath(validatedPath);
  });

  ipcMain.handle('fs:saveFile', async (_event, defaultName: string, filters?: Array<{ name: string; extensions: string[] }>) => {
    const request = parseOrThrow(
      saveFileRequestSchema,
      { defaultName, filters },
      'Invalid fs:saveFile payload'
    );
    const result = await dialog.showSaveDialog({
      title: 'Datei speichern',
      defaultPath: request.defaultName,
      filters: request.filters || [
        { name: 'PDF', extensions: ['pdf'] },
        { name: 'Alle Dateien', extensions: ['*'] }
      ]
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    return result.filePath;
  });

  // ========================================
  // Secure API Key Storage (using safeStorage)
  // ========================================

  const apiKeysPath = path.join(app.getPath('userData'), 'api-keys.enc');
  const getApiKeyStorageMode = (): 'encrypted' | 'unavailable' =>
    safeStorage.isEncryptionAvailable() ? 'encrypted' : 'unavailable';

  const assertEncryptedStorageAvailable = (): void => {
    if (getApiKeyStorageMode() !== 'encrypted') {
      throw new Error(
        'Encrypted API key storage is not available on this system. Please enable OS-level secure storage.'
      );
    }
  };

  const maskKey = (value: string): string =>
    value.length > 12 ? `${value.substring(0, 6)}...${value.substring(value.length - 4)}` : '***';

  const applyKeysToLlmRuntime = (keys: Record<string, string>): void => {
    llmService.setConfig({
      anthropicApiKey: keys.anthropicApiKey || undefined,
      openaiApiKey: keys.openaiApiKey || undefined,
      geminiApiKey: keys.geminiApiKey || undefined,
      openaiCompatibleApiKey: keys.openaiCompatibleApiKey || undefined
    });
  };

  const loadEncryptedKeys = (): Record<string, string> => {
    try {
      if (!fs.existsSync(apiKeysPath)) {
        return {};
      }

      assertEncryptedStorageAvailable();
      const encrypted = fs.readFileSync(apiKeysPath);
      const decrypted = safeStorage.decryptString(encrypted);
      const parsed = JSON.parse(decrypted) as Record<string, string>;
      return parsed;
    } catch (error) {
      logger.error('Error loading encrypted API keys', error);
      throw error;
    }
  };

  const saveEncryptedKeys = (keys: Record<string, string>): void => {
    assertEncryptedStorageAvailable();
    const encrypted = safeStorage.encryptString(JSON.stringify(keys));
    fs.writeFileSync(apiKeysPath, encrypted);
    applyKeysToLlmRuntime(keys);
  };

  ipcMain.handle('apiKeys:get', async (_event, keyName: string) => {
    const validatedKeyName = parseOrThrow(apiKeyNameSchema, keyName, 'Invalid apiKeys:get keyName');
    const keys = loadEncryptedKeys();
    return keys[validatedKeyName] || '';
  });

  ipcMain.handle('apiKeys:set', async (_event, keyName: string, value: string) => {
    const validatedKeyName = parseOrThrow(apiKeyNameSchema, keyName, 'Invalid apiKeys:set keyName');
    const validatedValue = parseOrThrow(apiKeyValueSchema, value, 'Invalid apiKeys:set value');

    const keys = loadEncryptedKeys();
    if (validatedValue) {
      keys[validatedKeyName] = validatedValue;
    } else {
      delete keys[validatedKeyName];
    }

    saveEncryptedKeys(keys);
  });

  ipcMain.handle('apiKeys:getAll', async () => {
    const storageMode = getApiKeyStorageMode();
    if (storageMode !== 'encrypted') {
      return {
        anthropicApiKey: '',
        openaiApiKey: '',
        geminiApiKey: '',
        openaiCompatibleApiKey: '',
        _storageMode: storageMode
      };
    }

    const keys = loadEncryptedKeys();
    return {
      anthropicApiKey: keys.anthropicApiKey ? maskKey(keys.anthropicApiKey) : '',
      openaiApiKey: keys.openaiApiKey ? maskKey(keys.openaiApiKey) : '',
      geminiApiKey: keys.geminiApiKey ? maskKey(keys.geminiApiKey) : '',
      openaiCompatibleApiKey: keys.openaiCompatibleApiKey ? maskKey(keys.openaiCompatibleApiKey) : '',
      _storageMode: storageMode
    };
  });

  try {
    if (getApiKeyStorageMode() === 'encrypted') {
      applyKeysToLlmRuntime(loadEncryptedKeys());
    } else {
      logger.warn('Secure API key storage unavailable; cloud providers remain disabled');
    }
  } catch (error) {
    logger.warn('Could not initialize API keys at startup', error);
  }

  // ========================================
  // Tax Rules Diagnostics
  // ========================================

  ipcMain.handle('taxRules:getSupportedYears', async () => {
    return listSupportedTaxRuleYears();
  });

  ipcMain.handle('taxRules:getStatus', async (_event, taxYear?: number) => {
    const year = typeof taxYear === 'undefined'
      ? resolveActiveTaxYear()
      : parseOrThrow(taxYearSchema, taxYear, 'Invalid taxRules:getStatus year');
    return getTaxRuleStatus(year);
  });

  ipcMain.handle('taxRules:getDiagnostics', async () => {
    return getAllTaxRuleStatuses();
  });

  // ========================================
  // Settings Operations
  // ========================================

  const settingsPath = path.join(app.getPath('userData'), 'settings.json');

  const loadSettings = (): Record<string, unknown> => {
    try {
      if (fs.existsSync(settingsPath)) {
        return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      }
    } catch (error) {
      logger.error('Error loading settings:', error);
    }
    return {};
  };

  const saveSettings = (settings: Record<string, unknown>): void => {
    try {
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    } catch (error) {
      logger.error('Error saving settings:', error);
    }
  };

  ipcMain.handle('settings:get', async (_event, key: string) => {
    const validatedKey = parseOrThrow(settingKeySchema, key, 'Invalid settings:get key');
    logger.debug('Getting setting', { key: validatedKey });
    const settings = loadSettings();
    return settings[validatedKey] ?? null;
  });

  ipcMain.handle('settings:set', async (_event, key: string, value: unknown) => {
    const validatedKey = parseOrThrow(settingKeySchema, key, 'Invalid settings:set key');
    logger.info('Updating setting', { key: validatedKey });
    const settings = loadSettings();
    settings[validatedKey] = value;
    saveSettings(settings);

    if (validatedKey === SETTINGS_TAX_YEAR_KEY) {
      const nextTaxYear = parseOrThrow(taxYearSchema, value, 'Invalid currentTaxYear setting');
      await setActiveTaxYear(nextTaxYear);
    }
  });

  ipcMain.handle('settings:getAll', async () => {
    return loadSettings();
  });

  ipcMain.handle('settings:reset', async () => {
    logger.info('Resetting all settings...');
    saveSettings({});
    currentTaxYear = null;
  });

  logger.info('IPC handlers registered successfully');
}

/**
 * Cleanup on app quit
 */
export function cleanupOnQuit(): void {
  logger.info('Cleaning up...');

  try {
    dbService.close();
    ocrService.terminate();
    documentInspectorAgent.terminate();
  } catch (error) {
    logger.error('Cleanup error:', error);
  }
}

