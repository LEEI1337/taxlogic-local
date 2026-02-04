/**
 * TaxLogic.local - LangGraph Tax Filing Workflow
 *
 * Stateful workflow orchestrating the tax filing process:
 * 1. Interview - Collect tax information
 * 2. Document Processing - OCR and classify documents
 * 3. Analysis - Calculate deductions and estimate refund
 * 4. Form Generation - Generate L1/L1ab/L1k forms
 * 5. Guide Generation - Create personalized guide
 * 6. Final Review - Validate and package output
 */

import { StateGraph, END, START } from '@langchain/langgraph';
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { llmService } from '../services/llmService';
import { dbService, UserProfile, Interview, Document, Expense, Calculation, TaxForm } from '../services/dbService';
import { ocrService, OCRResult, ExtractedData } from '../services/ocrService';
import { documentOrganizer, ExpenseCategory, ClassificationResult } from '../services/documentOrganizer';
import { formGenerator, L1FormData, L1abFormData, L1kFormData, GeneratedForm } from '../services/formGenerator';
import { guideGenerator, PersonalizedGuide, GuideGenerationInput } from '../services/guideGenerator';

// ========================================
// State Definition
// ========================================

export interface TaxFilingState {
  // Identity
  user_id: string;
  tax_year: number;
  interview_id?: string;

  // User Information
  user_profile: UserProfile;

  // Interview Data
  interview_responses: Record<string, unknown>;
  interview_complete: boolean;
  current_question_index: number;

  // Documents
  documents: ProcessedDocument[];
  pending_documents: string[]; // File paths to process

  // Expenses (extracted from documents + interview)
  expenses: ExpenseRecord[];

  // Calculations
  calculation: CalculationResult | null;

  // Generated Output
  generated_forms: GeneratedForm[];
  guide: PersonalizedGuide | null;

  // Conversation
  messages: BaseMessage[];

  // Workflow State
  current_step: WorkflowStep;
  errors: string[];
  completed_steps: WorkflowStep[];
}

export type WorkflowStep =
  | 'interview'
  | 'document_processing'
  | 'analysis'
  | 'form_generation'
  | 'guide_generation'
  | 'final_review'
  | 'complete';

export interface ProcessedDocument {
  id: string;
  filename: string;
  path: string;
  category: ExpenseCategory;
  ocrResult: OCRResult;
  extractedData: ExtractedData;
  classification: ClassificationResult;
}

export interface ExpenseRecord {
  id: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  description: string;
  documentIds: string[];
  source: 'document' | 'interview';
}

export interface CalculationResult {
  total_income: number;
  total_deductions: number;
  estimated_refund: number;
  breakdown: DeductionBreakdown;
  details: Record<string, unknown>;
}

export interface DeductionBreakdown {
  pendlerpauschale: number;
  homeOffice: number;
  fortbildung: number;
  arbeitsmittel: number;
  sonderausgaben: number;
  aussergewoehnlicheBelastungen: number;
  other: number;
}

// ========================================
// Interview Questions (Austrian Tax)
// ========================================

const INTERVIEW_QUESTIONS = [
  {
    id: 'profession',
    question: 'Was ist Ihr Beruf bzw. Ihre Tätigkeit?',
    type: 'text',
    required: true
  },
  {
    id: 'employment_status',
    question: 'Wie ist Ihr Beschäftigungsverhältnis?',
    type: 'choice',
    options: ['Angestellt', 'Selbstständig', 'Gemischt', 'Pension'],
    required: true
  },
  {
    id: 'annual_income',
    question: 'Wie hoch war Ihr Bruttojahreseinkommen (laut Lohnzettel)?',
    type: 'number',
    required: true
  },
  {
    id: 'commute_distance',
    question: 'Wie weit ist Ihr Arbeitsweg (einfache Strecke in km)? Falls Home Office, geben Sie 0 ein.',
    type: 'number',
    required: true
  },
  {
    id: 'commute_type',
    question: 'Wie gelangen Sie zur Arbeit?',
    type: 'choice',
    options: ['Öffentliche Verkehrsmittel', 'PKW', 'Fahrrad', 'Zu Fuß', 'Home Office'],
    required: true
  },
  {
    id: 'public_transport_feasible',
    question: 'Ist die Benützung öffentlicher Verkehrsmittel zumutbar?',
    type: 'choice',
    options: ['Ja', 'Nein', 'Teilweise'],
    required: true
  },
  {
    id: 'home_office_days',
    question: 'Wie viele Tage haben Sie im Home Office gearbeitet?',
    type: 'number',
    required: true
  },
  {
    id: 'work_equipment_expenses',
    question: 'Haben Sie beruflich genutzte Arbeitsmittel selbst bezahlt? (z.B. Computer, Software)',
    type: 'choice',
    options: ['Ja', 'Nein'],
    required: true
  },
  {
    id: 'work_equipment_amount',
    question: 'Wie hoch waren die Ausgaben für Arbeitsmittel insgesamt?',
    type: 'number',
    required: false,
    condition: { field: 'work_equipment_expenses', value: 'Ja' }
  },
  {
    id: 'education_expenses',
    question: 'Haben Sie berufliche Fortbildungskosten gehabt? (Kurse, Seminare, Fachliteratur)',
    type: 'choice',
    options: ['Ja', 'Nein'],
    required: true
  },
  {
    id: 'education_amount',
    question: 'Wie hoch waren die Fortbildungskosten insgesamt?',
    type: 'number',
    required: false,
    condition: { field: 'education_expenses', value: 'Ja' }
  },
  {
    id: 'church_tax',
    question: 'Haben Sie Kirchenbeitrag gezahlt?',
    type: 'choice',
    options: ['Ja', 'Nein'],
    required: true
  },
  {
    id: 'church_tax_amount',
    question: 'Wie hoch war der Kirchenbeitrag?',
    type: 'number',
    required: false,
    condition: { field: 'church_tax', value: 'Ja' }
  },
  {
    id: 'donations',
    question: 'Haben Sie steuerbegünstigte Spenden geleistet?',
    type: 'choice',
    options: ['Ja', 'Nein'],
    required: true
  },
  {
    id: 'donations_amount',
    question: 'Wie hoch waren die Spenden insgesamt?',
    type: 'number',
    required: false,
    condition: { field: 'donations', value: 'Ja' }
  },
  {
    id: 'medical_expenses',
    question: 'Hatten Sie außergewöhnliche medizinische Ausgaben?',
    type: 'choice',
    options: ['Ja', 'Nein'],
    required: true
  },
  {
    id: 'medical_amount',
    question: 'Wie hoch waren die medizinischen Ausgaben?',
    type: 'number',
    required: false,
    condition: { field: 'medical_expenses', value: 'Ja' }
  },
  {
    id: 'has_children',
    question: 'Haben Sie Kinder, für die Sie Familienbeihilfe beziehen?',
    type: 'choice',
    options: ['Ja', 'Nein'],
    required: true
  },
  {
    id: 'childcare_expenses',
    question: 'Hatten Sie Kinderbetreuungskosten?',
    type: 'number',
    required: false,
    condition: { field: 'has_children', value: 'Ja' }
  },
  {
    id: 'documents_available',
    question: 'Haben Sie Belege/Rechnungen, die Sie hochladen möchten?',
    type: 'choice',
    options: ['Ja, ich möchte Belege hochladen', 'Nein, nur manuelle Eingaben'],
    required: true
  }
];

// ========================================
// Workflow Nodes
// ========================================

/**
 * Interview Node - Conducts the tax interview
 */
async function interviewNode(state: TaxFilingState): Promise<Partial<TaxFilingState>> {
  console.log('[Workflow] Interview Node');

  const currentIndex = state.current_question_index;
  const responses = { ...state.interview_responses };

  // Check if we should skip the current question based on conditions
  let nextIndex = currentIndex;
  while (nextIndex < INTERVIEW_QUESTIONS.length) {
    const question = INTERVIEW_QUESTIONS[nextIndex];
    if (question.condition) {
      const conditionValue = responses[question.condition.field];
      if (conditionValue !== question.condition.value) {
        nextIndex++;
        continue;
      }
    }
    break;
  }

  // Check if interview is complete
  if (nextIndex >= INTERVIEW_QUESTIONS.length) {
    return {
      interview_complete: true,
      current_question_index: nextIndex,
      completed_steps: [...state.completed_steps, 'interview']
    };
  }

  const question = INTERVIEW_QUESTIONS[nextIndex];

  // Generate AI response with the question
  const aiMessage = new AIMessage({
    content: question.question
  });

  return {
    current_question_index: nextIndex,
    messages: [...state.messages, aiMessage]
  };
}

/**
 * Document Processing Node - OCR and classify uploaded documents
 */
async function documentProcessingNode(state: TaxFilingState): Promise<Partial<TaxFilingState>> {
  console.log('[Workflow] Document Processing Node');

  const processedDocs: ProcessedDocument[] = [...state.documents];
  const newExpenses: ExpenseRecord[] = [...state.expenses];
  const errors: string[] = [...state.errors];

  // Initialize OCR service
  await ocrService.initialize();

  for (const filePath of state.pending_documents) {
    try {
      console.log(`[Workflow] Processing document: ${filePath}`);

      // OCR the document
      const ocrResult = await ocrService.processImage(filePath);

      // Extract structured data
      const extractedData = ocrService.extractStructuredData(ocrResult);

      // Classify the document
      const classification = await documentOrganizer.classifyDocument(ocrResult.text, extractedData);

      // Organize the file
      const organized = await documentOrganizer.organizeFile(
        filePath,
        classification.category,
        state.user_id,
        state.tax_year
      );

      const docId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      processedDocs.push({
        id: docId,
        filename: organized.filename,
        path: organized.newPath,
        category: classification.category,
        ocrResult,
        extractedData,
        classification
      });

      // Create expense record if amount detected
      if (extractedData.totalAmount) {
        newExpenses.push({
          id: `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          category: classification.category,
          amount: extractedData.totalAmount,
          date: extractedData.dates[0]?.date.toISOString() || new Date().toISOString(),
          description: classification.suggestedDescription,
          documentIds: [docId],
          source: 'document'
        });
      }
    } catch (error) {
      console.error(`[Workflow] Error processing ${filePath}:`, error);
      errors.push(`Fehler bei der Verarbeitung von ${filePath}: ${(error as Error).message}`);
    }
  }

  return {
    documents: processedDocs,
    expenses: newExpenses,
    pending_documents: [],
    errors,
    completed_steps: [...state.completed_steps, 'document_processing']
  };
}

/**
 * Analysis Node - Calculate deductions and estimate refund
 */
async function analysisNode(state: TaxFilingState): Promise<Partial<TaxFilingState>> {
  console.log('[Workflow] Analysis Node');

  const responses = state.interview_responses;
  const expenses = state.expenses;

  // Calculate deductions based on interview and expenses
  const breakdown: DeductionBreakdown = {
    pendlerpauschale: 0,
    homeOffice: 0,
    fortbildung: 0,
    arbeitsmittel: 0,
    sonderausgaben: 0,
    aussergewoehnlicheBelastungen: 0,
    other: 0
  };

  // Pendlerpauschale calculation (simplified Austrian rules)
  const commuteDistance = Number(responses.commute_distance) || 0;
  const publicTransportFeasible = responses.public_transport_feasible;

  if (commuteDistance >= 20 && publicTransportFeasible === 'Ja') {
    // Kleine Pendlerpauschale
    if (commuteDistance >= 60) breakdown.pendlerpauschale = 2016;
    else if (commuteDistance >= 40) breakdown.pendlerpauschale = 1356;
    else breakdown.pendlerpauschale = 696;
  } else if (commuteDistance >= 2 && publicTransportFeasible !== 'Ja') {
    // Große Pendlerpauschale
    if (commuteDistance >= 60) breakdown.pendlerpauschale = 3672;
    else if (commuteDistance >= 40) breakdown.pendlerpauschale = 2568;
    else if (commuteDistance >= 20) breakdown.pendlerpauschale = 1476;
    else breakdown.pendlerpauschale = 372;
  }

  // Home Office Pauschale (€3/day, max €300)
  const homeOfficeDays = Math.min(Number(responses.home_office_days) || 0, 100);
  breakdown.homeOffice = homeOfficeDays * 3;

  // Work equipment from interview
  if (responses.work_equipment_expenses === 'Ja') {
    breakdown.arbeitsmittel = Number(responses.work_equipment_amount) || 0;
  }

  // Education expenses from interview
  if (responses.education_expenses === 'Ja') {
    breakdown.fortbildung = Number(responses.education_amount) || 0;
  }

  // Sonderausgaben
  let sonderausgaben = 0;
  if (responses.church_tax === 'Ja') {
    sonderausgaben += Math.min(Number(responses.church_tax_amount) || 0, 600); // Max €600
  }
  if (responses.donations === 'Ja') {
    sonderausgaben += Number(responses.donations_amount) || 0;
  }
  breakdown.sonderausgaben = sonderausgaben;

  // Außergewöhnliche Belastungen
  if (responses.medical_expenses === 'Ja') {
    breakdown.aussergewoehnlicheBelastungen = Number(responses.medical_amount) || 0;
  }

  // Add expenses from documents
  for (const expense of expenses) {
    switch (expense.category) {
      case 'pendler':
        // Already calculated from interview
        break;
      case 'homeoffice':
        breakdown.homeOffice += expense.amount;
        break;
      case 'fortbildung':
        breakdown.fortbildung += expense.amount;
        break;
      case 'arbeitsmittel':
        breakdown.arbeitsmittel += expense.amount;
        break;
      case 'spenden':
        breakdown.sonderausgaben += expense.amount;
        break;
      case 'medizin':
        breakdown.aussergewoehnlicheBelastungen += expense.amount;
        break;
      default:
        breakdown.other += expense.amount;
    }
  }

  // Cap Home Office at €300
  breakdown.homeOffice = Math.min(breakdown.homeOffice, 300);

  // Calculate totals
  const totalDeductions =
    breakdown.pendlerpauschale +
    breakdown.homeOffice +
    breakdown.fortbildung +
    breakdown.arbeitsmittel +
    breakdown.sonderausgaben +
    breakdown.aussergewoehnlicheBelastungen +
    breakdown.other;

  const totalIncome = Number(responses.annual_income) || 0;

  // Estimate refund (simplified calculation)
  // Werbungskostenpauschale is €132, only count if deductions exceed this
  const effectiveDeductions = Math.max(totalDeductions - 132, 0);

  // Assume average tax rate of 30% for simplicity
  const estimatedRefund = effectiveDeductions * 0.3;

  const calculation: CalculationResult = {
    total_income: totalIncome,
    total_deductions: totalDeductions,
    estimated_refund: Math.round(estimatedRefund * 100) / 100,
    breakdown,
    details: {
      werbungskostenpauschale: 132,
      effective_deductions: effectiveDeductions,
      assumed_tax_rate: 0.3
    }
  };

  return {
    calculation,
    completed_steps: [...state.completed_steps, 'analysis']
  };
}

/**
 * Form Generation Node - Generate L1/L1ab/L1k forms
 */
async function formGenerationNode(state: TaxFilingState): Promise<Partial<TaxFilingState>> {
  console.log('[Workflow] Form Generation Node');

  const generatedForms: GeneratedForm[] = [];
  const responses = state.interview_responses;
  const calculation = state.calculation!;

  // Build L1 form data
  const l1Data: L1FormData = {
    sozialversicherungsnummer: (state.user_profile.profession || '') + '_SVNR', // Placeholder
    familienname: 'Mustermann', // Would come from profile
    vorname: 'Max',
    geburtsdatum: '01.01.1990',
    strasse: 'Musterstraße',
    hausnummer: '1',
    plz: '1010',
    ort: 'Wien',
    veranlagungsjahr: state.tax_year,
    bruttoeinkunfte: calculation.total_income,
    pendlerpauschale: calculation.breakdown.pendlerpauschale || undefined,
    pendlerkilometer: Number(responses.commute_distance) || undefined,
    homeOfficePauschale: calculation.breakdown.homeOffice || undefined,
    homeOfficeTage: Number(responses.home_office_days) || undefined,
    arbeitsmittel: calculation.breakdown.arbeitsmittel || undefined,
    fortbildungskosten: calculation.breakdown.fortbildung || undefined,
    kirchenbeitrag: responses.church_tax === 'Ja' ? Number(responses.church_tax_amount) : undefined,
    spendenBeguenstigte: responses.donations === 'Ja' ? Number(responses.donations_amount) : undefined,
    krankheitskosten: calculation.breakdown.aussergewoehnlicheBelastungen || undefined
  };

  // Generate L1 form
  const l1Form = await formGenerator.generateL1(l1Data);
  generatedForms.push(l1Form);

  // Check if L1ab is needed (additional income)
  const hasAdditionalIncome = responses.employment_status === 'Gemischt' || responses.employment_status === 'Selbstständig';
  if (hasAdditionalIncome) {
    const l1abData: L1abFormData = {
      veranlagungsjahr: state.tax_year
    };
    const l1abForm = await formGenerator.generateL1ab(l1abData);
    generatedForms.push(l1abForm);
  }

  // Check if L1k is needed (children)
  if (responses.has_children === 'Ja') {
    const l1kData: L1kFormData = {
      veranlagungsjahr: state.tax_year,
      kinder: [], // Would be populated from more detailed interview
      kinderbetreuungskostenGesamt: Number(responses.childcare_expenses) || undefined,
      familienbonusPlus: true
    };
    const l1kForm = await formGenerator.generateL1k(l1kData);
    generatedForms.push(l1kForm);
  }

  return {
    generated_forms: generatedForms,
    completed_steps: [...state.completed_steps, 'form_generation']
  };
}

/**
 * Guide Generation Node - Create personalized filing guide
 */
async function guideGenerationNode(state: TaxFilingState): Promise<Partial<TaxFilingState>> {
  console.log('[Workflow] Guide Generation Node');

  const responses = state.interview_responses;
  const calculation = state.calculation!;

  // Build guide input
  const guideInput: GuideGenerationInput = {
    userId: state.user_id,
    taxYear: state.tax_year,
    formData: {
      sozialversicherungsnummer: 'XXXX XXXXXX',
      familienname: 'Mustermann',
      vorname: 'Max',
      geburtsdatum: '01.01.1990',
      strasse: 'Musterstraße',
      hausnummer: '1',
      plz: '1010',
      ort: 'Wien',
      veranlagungsjahr: state.tax_year,
      bruttoeinkunfte: calculation.total_income,
      pendlerpauschale: calculation.breakdown.pendlerpauschale || undefined,
      pendlerkilometer: Number(responses.commute_distance) || undefined,
      homeOfficePauschale: calculation.breakdown.homeOffice || undefined,
      homeOfficeTage: Number(responses.home_office_days) || undefined,
      arbeitsmittel: calculation.breakdown.arbeitsmittel || undefined,
      fortbildungskosten: calculation.breakdown.fortbildung || undefined
    },
    hasL1ab: state.generated_forms.some((f) => f.formType === 'L1ab'),
    hasL1k: state.generated_forms.some((f) => f.formType === 'L1k'),
    totalDeductions: calculation.total_deductions,
    estimatedRefund: calculation.estimated_refund,
    documentCount: state.documents.length
  };

  const guide = await guideGenerator.generateGuide(guideInput);

  // Also export as PDF
  await guideGenerator.exportAsPDF(guide);

  return {
    guide,
    completed_steps: [...state.completed_steps, 'guide_generation']
  };
}

/**
 * Final Review Node - Validate output and prepare summary
 */
async function finalReviewNode(state: TaxFilingState): Promise<Partial<TaxFilingState>> {
  console.log('[Workflow] Final Review Node');

  // Generate summary message
  const calculation = state.calculation!;
  const formsGenerated = state.generated_forms.map((f) => f.formType).join(', ');

  const summaryMessage = new AIMessage({
    content: `
## 🎉 Ihre Arbeitnehmerveranlagung ist fertig!

### Zusammenfassung für ${state.tax_year}

**Berechnung:**
- Bruttoeinkommen: €${calculation.total_income.toLocaleString('de-AT')}
- Gesamte Absetzbeträge: €${calculation.total_deductions.toLocaleString('de-AT')}
- **Geschätzte Rückerstattung: €${calculation.estimated_refund.toLocaleString('de-AT')}**

**Generierte Formulare:** ${formsGenerated}

**Verarbeitete Dokumente:** ${state.documents.length}

Ihre persönliche Anleitung mit Schritt-für-Schritt Anweisungen für FinanzOnline wurde erstellt.

${state.errors.length > 0 ? `\n**Hinweise:**\n${state.errors.join('\n')}` : ''}
    `.trim()
  });

  return {
    messages: [...state.messages, summaryMessage],
    current_step: 'complete',
    completed_steps: [...state.completed_steps, 'final_review']
  };
}

// ========================================
// Conditional Edge Functions
// ========================================

function shouldProcessDocuments(state: TaxFilingState): 'document_processing' | 'analysis' {
  const hasDocuments = state.pending_documents.length > 0;
  const wantsDocuments = state.interview_responses.documents_available === 'Ja, ich möchte Belege hochladen';

  if (hasDocuments || wantsDocuments) {
    return 'document_processing';
  }
  return 'analysis';
}

function isInterviewComplete(state: TaxFilingState): 'continue_interview' | 'route_after_interview' {
  if (state.interview_complete) {
    return 'route_after_interview';
  }
  return 'continue_interview';
}

// ========================================
// Build Workflow
// ========================================

export function createTaxFilingWorkflow() {
  const workflow = new StateGraph<TaxFilingState>({
    channels: {
      user_id: { value: (a: string, b: string) => b ?? a },
      tax_year: { value: (a: number, b: number) => b ?? a },
      interview_id: { value: (a: string | undefined, b: string | undefined) => b ?? a },
      user_profile: { value: (a: UserProfile, b: UserProfile) => ({ ...a, ...b }) },
      interview_responses: { value: (a: Record<string, unknown>, b: Record<string, unknown>) => ({ ...a, ...b }) },
      interview_complete: { value: (a: boolean, b: boolean) => b ?? a },
      current_question_index: { value: (a: number, b: number) => b ?? a },
      documents: { value: (a: ProcessedDocument[], b: ProcessedDocument[]) => b ?? a },
      pending_documents: { value: (a: string[], b: string[]) => b ?? a },
      expenses: { value: (a: ExpenseRecord[], b: ExpenseRecord[]) => b ?? a },
      calculation: { value: (a: CalculationResult | null, b: CalculationResult | null) => b ?? a },
      generated_forms: { value: (a: GeneratedForm[], b: GeneratedForm[]) => b ?? a },
      guide: { value: (a: PersonalizedGuide | null, b: PersonalizedGuide | null) => b ?? a },
      messages: { value: (a: BaseMessage[], b: BaseMessage[]) => [...a, ...(b || [])] },
      current_step: { value: (a: WorkflowStep, b: WorkflowStep) => b ?? a },
      errors: { value: (a: string[], b: string[]) => [...a, ...(b || [])] },
      completed_steps: { value: (a: WorkflowStep[], b: WorkflowStep[]) => b ?? a }
    }
  });

  // Add nodes
  workflow.addNode('interview', interviewNode);
  workflow.addNode('document_processing', documentProcessingNode);
  workflow.addNode('analysis', analysisNode);
  workflow.addNode('form_generation', formGenerationNode);
  workflow.addNode('guide_generation', guideGenerationNode);
  workflow.addNode('final_review', finalReviewNode);

  // Add edges
  workflow.addEdge(START, 'interview');

  workflow.addConditionalEdges('interview', isInterviewComplete, {
    continue_interview: 'interview',
    route_after_interview: 'document_processing'
  });

  workflow.addConditionalEdges('document_processing', shouldProcessDocuments, {
    document_processing: 'document_processing',
    analysis: 'analysis'
  });

  workflow.addEdge('analysis', 'form_generation');
  workflow.addEdge('form_generation', 'guide_generation');
  workflow.addEdge('guide_generation', 'final_review');
  workflow.addEdge('final_review', END);

  return workflow.compile();
}

// ========================================
// Workflow Runner
// ========================================

export class TaxFilingWorkflowRunner {
  private workflow: ReturnType<typeof createTaxFilingWorkflow>;
  private state: TaxFilingState | null = null;

  constructor() {
    this.workflow = createTaxFilingWorkflow();
  }

  /**
   * Initialize a new workflow for a user
   */
  async initialize(userId: string, taxYear: number, userProfile: UserProfile = {}): Promise<TaxFilingState> {
    this.state = {
      user_id: userId,
      tax_year: taxYear,
      user_profile: userProfile,
      interview_responses: {},
      interview_complete: false,
      current_question_index: 0,
      documents: [],
      pending_documents: [],
      expenses: [],
      calculation: null,
      generated_forms: [],
      guide: null,
      messages: [],
      current_step: 'interview',
      errors: [],
      completed_steps: []
    };

    return this.state;
  }

  /**
   * Process a user response to the current interview question
   */
  async processResponse(response: string): Promise<TaxFilingState> {
    if (!this.state) {
      throw new Error('Workflow not initialized');
    }

    const currentQuestion = INTERVIEW_QUESTIONS[this.state.current_question_index];
    if (currentQuestion) {
      // Store the response
      this.state.interview_responses[currentQuestion.id] = response;

      // Add user message
      this.state.messages.push(new HumanMessage({ content: response }));

      // Move to next question
      this.state.current_question_index++;
    }

    // Run the workflow
    const result = await this.workflow.invoke(this.state);
    this.state = result as TaxFilingState;

    return this.state;
  }

  /**
   * Add documents to process
   */
  addDocuments(filePaths: string[]): void {
    if (!this.state) {
      throw new Error('Workflow not initialized');
    }
    this.state.pending_documents.push(...filePaths);
  }

  /**
   * Get current state
   */
  getState(): TaxFilingState | null {
    return this.state;
  }

  /**
   * Get current question
   */
  getCurrentQuestion(): typeof INTERVIEW_QUESTIONS[0] | null {
    if (!this.state) return null;
    return INTERVIEW_QUESTIONS[this.state.current_question_index] || null;
  }

  /**
   * Skip to a specific workflow step
   */
  async skipTo(step: WorkflowStep): Promise<TaxFilingState> {
    if (!this.state) {
      throw new Error('Workflow not initialized');
    }

    this.state.current_step = step;
    this.state.interview_complete = true;

    const result = await this.workflow.invoke(this.state);
    this.state = result as TaxFilingState;

    return this.state;
  }
}

// Export singleton runner
export const taxFilingRunner = new TaxFilingWorkflowRunner();
export default TaxFilingWorkflowRunner;
