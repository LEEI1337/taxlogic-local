/**
 * TaxLogic.local - IPC Handlers
 *
 * Registers all IPC handlers for communication between main and renderer processes.
 * Connects all backend services to the frontend.
 */

import * as path from 'path';
import * as fs from 'fs';

import { ipcMain, app, dialog, shell, BrowserWindow, safeStorage } from 'electron';

// Import services
import { llmService } from '../backend/services/llmService';
import { dbService, UserProfile } from '../backend/services/dbService';
import { ocrService } from '../backend/services/ocrService';
import { documentOrganizer } from '../backend/services/documentOrganizer';
import { formGenerator, L1FormData, L1abFormData, L1kFormData } from '../backend/services/formGenerator';
import { guideGenerator } from '../backend/services/guideGenerator';
// Import agents
import { interviewerAgent } from '../backend/agents/interviewerAgent';
import { documentInspectorAgent } from '../backend/agents/documentInspectorAgent';
import { analyzerAgent, TaxProfile } from '../backend/agents/analyzerAgent';
// Import RAG
import { knowledgeBase, KnowledgeCategory } from '../backend/rag/knowledgeBase';
import { retriever } from '../backend/rag/retriever';


import { logger } from './utils/logger';

// State
let currentUserId: string | null = null;
let currentInterviewId: string | null = null;

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
    knowledgeBase.initialize().then(() => {
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
      await initializeServices();
      servicesInitialized = true;
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
    logger.info('Setting model to:', modelName);
    llmService.setModel(modelName);
  });

  ipcMain.handle('llm:setConfig', async (_event, config: Record<string, unknown>) => {
    logger.info('Updating LLM config:', Object.keys(config));
    llmService.setConfig(config);
  });

  ipcMain.handle('llm:query', async (_event, prompt: string, conversationHistory?: Array<{ role: string; content: string }>) => {
    logger.debug('LLM query received');
    try {
      const history = conversationHistory?.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      })) || [];

      const response = await llmService.query(prompt, history);
      return response.content;
    } catch (error) {
      logger.error('LLM query error:', error);
      throw error;
    }
  });

  // ========================================
  // Interview Operations
  // ========================================

  ipcMain.handle('interview:start', async (_event, userProfile: UserProfile) => {
    logger.info('Starting interview...');
    await ensureServicesInitialized();

    try {
      // Create or get user
      if (!currentUserId) {
        const user = dbService.createUser(userProfile);
        currentUserId = user.id;
      } else {
        dbService.updateUser(currentUserId, userProfile);
      }

      // Create interview record
      const taxYear = new Date().getFullYear() - 1;
      const interview = dbService.createInterview(currentUserId, taxYear);
      currentInterviewId = interview.id;

      // Start interview agent
      const response = interviewerAgent.startInterview(currentUserId, taxYear);

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
    logger.debug('Continuing interview with input:', userInput);

    try {
      const response = await interviewerAgent.processResponse(userInput);

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
    if (currentInterviewId) {
      dbService.updateInterviewResponses(currentInterviewId, data);
    }
  });

  ipcMain.handle('interview:load', async (_event, id: string) => {
    logger.info('Loading interview:', id);
    const interview = dbService.getInterview(id);
    if (interview) {
      // Restore agent context so subsequent processResponse calls work
      currentInterviewId = interview.id;
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
    logger.info('Uploading documents:', filePaths.length, 'files');
    await ensureServicesInitialized();

    const results = [];
    for (const filePath of filePaths) {
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
        logger.error('Error processing document:', filePath, error);
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
    logger.info('Processing document:', documentId);
    // Document is already processed during upload
    return { id: documentId, status: 'processed' };
  });

  ipcMain.handle('documents:organize', async () => {
    logger.info('Organizing documents...');

    if (!currentUserId) {
      return { organized: false, error: 'No user logged in' };
    }

    const taxYear = new Date().getFullYear() - 1;
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
      const taxYear = new Date().getFullYear() - 1;

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
          hasSelfEmployment: interviewResponses.employment_type === 'Selbstständig (Einzelunternehmer)' ||
                            interviewResponses.employment_type === 'Gemischt (angestellt + selbstständig)'
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
      logger.error('Analysis error:', error);
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
    logger.info('Generating form:', formType);
    await ensureServicesInitialized();

    try {
      const interviewResponses = interviewerAgent.getResponses();
      const taxYear = new Date().getFullYear() - 1;

      let generatedForm;

      // Load user profile from DB for form data
      const userProfile = currentUserId ? dbService.getUser(currentUserId) : null;
      const profileData = userProfile?.profile_data || {};
      const greeting = interviewResponses.greeting as string || '';
      const nameParts = greeting.split(' ');

      if (formType === 'L1' || formType === 'all') {
        const l1Data: L1FormData = {
          sozialversicherungsnummer: (profileData as Record<string, unknown>).svnr as string || '',
          familienname: (profileData as Record<string, unknown>).last_name as string || nameParts.slice(1).join(' ') || 'BITTE AUSFÜLLEN',
          vorname: (profileData as Record<string, unknown>).first_name as string || nameParts[0] || 'BITTE AUSFÜLLEN',
          geburtsdatum: (profileData as Record<string, unknown>).birth_date as string || 'BITTE AUSFÜLLEN',
          strasse: (profileData as Record<string, unknown>).street as string || 'BITTE AUSFÜLLEN',
          hausnummer: (profileData as Record<string, unknown>).house_number as string || '',
          plz: (profileData as Record<string, unknown>).postal_code as string || '',
          ort: (profileData as Record<string, unknown>).city as string || '',
          veranlagungsjahr: taxYear,
          bruttoeinkunfte: interviewResponses.gross_income as number,
          homeOfficeTage: interviewResponses.home_office_days as number,
          homeOfficePauschale: Math.min((interviewResponses.home_office_days as number || 0) * 3, 300),
          pendlerkilometer: interviewResponses.commute_distance as number,
          kirchenbeitrag: interviewResponses.church_tax_amount as number,
          spendenBeguenstigte: interviewResponses.donations_amount as number,
          krankheitskosten: interviewResponses.medical_amount as number,
          kinderbetreuungskosten: interviewResponses.childcare_amount as number
        };

        generatedForm = await formGenerator.generateL1(l1Data);
      } else if (formType === 'L1ab') {
        const l1abData: L1abFormData = {
          veranlagungsjahr: taxYear
        };
        generatedForm = await formGenerator.generateL1ab(l1abData);
      } else if (formType === 'L1k') {
        const l1kData: L1kFormData = {
          veranlagungsjahr: taxYear,
          kinder: [],
          familienbonusPlus: true
        };
        generatedForm = await formGenerator.generateL1k(l1kData);
      }

      // Save to database
      if (currentUserId && currentInterviewId && generatedForm) {
        dbService.createForm(
          currentUserId,
          currentInterviewId,
          formType as 'L1' | 'L1ab' | 'L1k',
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
    logger.debug('Previewing form:', formType);

    if (currentInterviewId) {
      const forms = dbService.getFormsByInterview(currentInterviewId);
      const form = forms.find(f => f.form_type === formType);
      return form?.pdf_path || '';
    }

    return '';
  });

  ipcMain.handle('forms:export', async (_event, formType: string, outputPath: string) => {
    logger.info('Exporting form:', formType, 'to', outputPath);

    if (currentInterviewId) {
      const forms = dbService.getFormsByInterview(currentInterviewId);
      const form = forms.find(f => f.form_type === formType);

      if (form?.pdf_path && fs.existsSync(form.pdf_path)) {
        fs.copyFileSync(form.pdf_path, outputPath);
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
      const taxYear = new Date().getFullYear() - 1;

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
          homeOfficePauschale: Math.min((interviewResponses.home_office_days as number || 0) * 3, 300)
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
    logger.info('Exporting guide to:', outputPath);

    try {
      const taxYear = new Date().getFullYear() - 1;

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
      if (outputPath && pdfPath) {
        fs.copyFileSync(pdfPath, outputPath);
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

  ipcMain.handle('rag:query', async (_event, question: string, category?: string) => {
    logger.info('RAG query:', question);
    await ensureServicesInitialized();

    try {
      const response = await retriever.query({
        question,
        category: category as KnowledgeCategory | undefined,
        includeSourceCitations: true
      });

      return response;
    } catch (error) {
      logger.error('RAG query error:', error);
      throw error;
    }
  });

  ipcMain.handle('rag:search', async (_event, query: string, topK: number = 5) => {
    logger.debug('Knowledge base search:', query);

    try {
      const results = await knowledgeBase.search(query, topK);
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
      title: 'Ordner auswählen'
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle('fs:selectFiles', async (_event, filters?: Array<{ name: string; extensions: string[] }>) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      title: 'Dateien auswählen',
      filters: filters || [
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
    await shell.openPath(filePath);
  });

  ipcMain.handle('fs:saveFile', async (_event, defaultName: string, filters?: Array<{ name: string; extensions: string[] }>) => {
    const result = await dialog.showSaveDialog({
      title: 'Datei speichern',
      defaultPath: defaultName,
      filters: filters || [
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
  const ALLOWED_KEY_NAMES = ['anthropicApiKey', 'openaiApiKey', 'geminiApiKey', 'openaiCompatibleApiKey'];

  const loadEncryptedKeys = (): Record<string, string> => {
    try {
      if (fs.existsSync(apiKeysPath) && safeStorage.isEncryptionAvailable()) {
        const encrypted = fs.readFileSync(apiKeysPath);
        const decrypted = safeStorage.decryptString(encrypted);
        return JSON.parse(decrypted);
      }
    } catch (error) {
      logger.error('Error loading encrypted API keys:', error);
    }
    return {};
  };

  const saveEncryptedKeys = (keys: Record<string, string>): void => {
    try {
      if (safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(JSON.stringify(keys));
        fs.writeFileSync(apiKeysPath, encrypted);
      } else {
        logger.warn('safeStorage encryption not available, falling back to settings file');
        const settings = loadSettings();
        Object.assign(settings, keys);
        saveSettings(settings);
      }
    } catch (error) {
      logger.error('Error saving encrypted API keys:', error);
    }
  };

  ipcMain.handle('apiKeys:get', async (_event, keyName: string) => {
    if (!ALLOWED_KEY_NAMES.includes(keyName)) {
      throw new Error(`Invalid API key name: ${keyName}`);
    }
    const keys = loadEncryptedKeys();
    return keys[keyName] || '';
  });

  ipcMain.handle('apiKeys:set', async (_event, keyName: string, value: string) => {
    if (!ALLOWED_KEY_NAMES.includes(keyName)) {
      throw new Error(`Invalid API key name: ${keyName}`);
    }
    const keys = loadEncryptedKeys();
    if (value) {
      keys[keyName] = value;
    } else {
      delete keys[keyName];
    }
    saveEncryptedKeys(keys);
  });

  ipcMain.handle('apiKeys:getAll', async () => {
    const keys = loadEncryptedKeys();
    // Return masked versions for display
    const masked: Record<string, string> = {};
    for (const [key, value] of Object.entries(keys)) {
      masked[key] = value ? `${value.substring(0, 8)}...${value.substring(value.length - 4)}` : '';
    }
    return masked;
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
    logger.debug('Getting setting:', key);
    const settings = loadSettings();
    return settings[key] ?? null;
  });

  ipcMain.handle('settings:set', async (_event, key: string, value: unknown) => {
    logger.info('Setting:', key, '=', value);
    const settings = loadSettings();
    settings[key] = value;
    saveSettings(settings);
  });

  ipcMain.handle('settings:getAll', async () => {
    return loadSettings();
  });

  ipcMain.handle('settings:reset', async () => {
    logger.info('Resetting all settings...');
    saveSettings({});
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
