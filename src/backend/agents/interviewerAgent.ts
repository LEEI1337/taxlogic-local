/**
 * TaxLogic.local - Interviewer Agent
 *
 * AI agent that conducts intelligent tax interviews:
 * - Asks follow-up questions based on responses
 * - Validates input data
 * - Provides helpful explanations
 * - Handles Austrian tax-specific terminology
 */

import { llmService, Message } from '../services/llmService';

// ========================================
// Type Definitions
// ========================================

export interface InterviewQuestion {
  id: string;
  question: string;
  type: 'text' | 'number' | 'choice' | 'date' | 'boolean';
  options?: string[];
  validation?: ValidationRule;
  helpText?: string;
  followUp?: FollowUpRule[];
  required: boolean;
}

export interface ValidationRule {
  type: 'range' | 'regex' | 'custom';
  min?: number;
  max?: number;
  pattern?: string;
  errorMessage: string;
}

export interface FollowUpRule {
  condition: { field: string; operator: 'eq' | 'gt' | 'lt' | 'contains'; value: unknown };
  questions: string[]; // IDs of follow-up questions
}

export interface InterviewContext {
  userId: string;
  taxYear: number;
  currentQuestionId: string;
  responses: Record<string, unknown>;
  conversationHistory: Message[];
  validationErrors: string[];
}

export interface InterviewResponse {
  message: string;
  nextQuestion: InterviewQuestion | null;
  validationError?: string;
  suggestion?: string;
  isComplete: boolean;
}

// ========================================
// Austrian Tax Interview Questions
// ========================================

export const TAX_INTERVIEW_QUESTIONS: InterviewQuestion[] = [
  // Personal Information
  {
    id: 'greeting',
    question: 'Willkommen bei TaxLogic.local! Ich werde Ihnen einige Fragen stellen, um Ihre Arbeitnehmerveranlagung vorzubereiten. Lassen Sie uns beginnen - wie heißen Sie?',
    type: 'text',
    required: true,
    helpText: 'Bitte geben Sie Ihren vollständigen Namen ein.'
  },
  {
    id: 'tax_year_confirm',
    question: 'Für welches Jahr möchten Sie die Arbeitnehmerveranlagung machen?',
    type: 'number',
    required: true,
    validation: {
      type: 'range',
      min: 2019,
      max: new Date().getFullYear(),
      errorMessage: 'Bitte geben Sie ein gültiges Jahr ein (2019 bis heute).'
    }
  },

  // Employment
  {
    id: 'employment_type',
    question: 'Wie waren Sie im letzten Jahr beschäftigt?',
    type: 'choice',
    options: [
      'Vollzeit angestellt',
      'Teilzeit angestellt',
      'Geringfügig beschäftigt',
      'Selbstständig (Einzelunternehmer)',
      'Gemischt (angestellt + selbstständig)',
      'Arbeitslos / Karenz',
      'In Pension'
    ],
    required: true,
    helpText: 'Bei mehreren Tätigkeiten wählen Sie die Haupttätigkeit.'
  },
  {
    id: 'employer_count',
    question: 'Bei wie vielen Arbeitgebern waren Sie beschäftigt?',
    type: 'number',
    required: true,
    validation: {
      type: 'range',
      min: 0,
      max: 10,
      errorMessage: 'Bitte geben Sie eine Zahl zwischen 0 und 10 ein.'
    }
  },
  {
    id: 'gross_income',
    question: 'Wie hoch war Ihr Bruttojahreseinkommen laut Lohnzettel (L16)?',
    type: 'number',
    required: true,
    helpText: 'Den Betrag finden Sie auf Ihrem Lohnzettel unter "Bruttobezüge". Bei mehreren Arbeitgebern addieren Sie die Beträge.',
    validation: {
      type: 'range',
      min: 0,
      max: 10000000,
      errorMessage: 'Bitte geben Sie einen gültigen Betrag ein.'
    }
  },

  // Commute (Pendlerpauschale)
  {
    id: 'commute_exists',
    question: 'Mussten Sie regelmäßig zu einem Arbeitsplatz pendeln?',
    type: 'boolean',
    required: true,
    helpText: 'Bei reinem Home Office wählen Sie "Nein".'
  },
  {
    id: 'commute_distance',
    question: 'Wie weit ist die einfache Strecke von Ihrer Wohnung zum Arbeitsplatz in Kilometern?',
    type: 'number',
    required: false,
    helpText: 'Messen Sie die kürzeste Straßenverbindung, nicht die tatsächlich gefahrene Route.',
    validation: {
      type: 'range',
      min: 0,
      max: 500,
      errorMessage: 'Bitte geben Sie eine Entfernung zwischen 0 und 500 km ein.'
    },
    followUp: [
      {
        condition: { field: 'commute_exists', operator: 'eq', value: true },
        questions: ['commute_distance', 'commute_transport', 'commute_public_feasible']
      }
    ]
  },
  {
    id: 'commute_transport',
    question: 'Wie gelangen Sie hauptsächlich zur Arbeit?',
    type: 'choice',
    options: [
      'Öffentliche Verkehrsmittel (Bus, Bahn, U-Bahn)',
      'PKW',
      'Motorrad/Moped',
      'Fahrrad',
      'Zu Fuß',
      'Gemischt (Öffentlich + PKW)'
    ],
    required: false
  },
  {
    id: 'commute_public_feasible',
    question: 'Ist die Benützung öffentlicher Verkehrsmittel zumutbar?',
    type: 'choice',
    options: [
      'Ja, öffentliche Verkehrsmittel sind gut verfügbar',
      'Nein, öffentliche Verkehrsmittel sind nicht verfügbar oder unzumutbar',
      'Teilweise - für einen Teil der Strecke'
    ],
    required: false,
    helpText: 'Unzumutbar ist z.B. wenn die Fahrtzeit mit Öffis mehr als 2,5 Stunden täglich beträgt oder keine Verbindung existiert.'
  },

  // Home Office
  {
    id: 'home_office_days',
    question: 'An wie vielen Tagen haben Sie im Home Office gearbeitet?',
    type: 'number',
    required: true,
    helpText: 'Die Home Office Pauschale beträgt €3 pro Tag, maximal €300 (100 Tage).',
    validation: {
      type: 'range',
      min: 0,
      max: 365,
      errorMessage: 'Bitte geben Sie eine Anzahl zwischen 0 und 365 ein.'
    }
  },

  // Work Equipment
  {
    id: 'work_equipment',
    question: 'Haben Sie beruflich genutzte Arbeitsmittel selbst bezahlt?',
    type: 'boolean',
    required: true,
    helpText: 'Z.B. Computer, Laptop, Software, Fachliteratur, Werkzeuge, Berufskleidung'
  },
  {
    id: 'work_equipment_details',
    question: 'Welche Arbeitsmittel haben Sie angeschafft und wie viel haben Sie dafür bezahlt? Beschreiben Sie kurz:',
    type: 'text',
    required: false,
    helpText: 'Z.B. "Laptop für Homeoffice €800, Microsoft Office €100"'
  },

  // Education
  {
    id: 'education_expenses',
    question: 'Hatten Sie Kosten für berufliche Aus- oder Fortbildung?',
    type: 'boolean',
    required: true,
    helpText: 'Z.B. Kurse, Seminare, Konferenzen, Fachliteratur, die mit Ihrem Beruf zusammenhängen.'
  },
  {
    id: 'education_details',
    question: 'Beschreiben Sie kurz Ihre Fortbildungskosten (Art und Betrag):',
    type: 'text',
    required: false
  },

  // Sonderausgaben
  {
    id: 'church_tax',
    question: 'Haben Sie Kirchenbeitrag bezahlt?',
    type: 'boolean',
    required: true,
    helpText: 'Der Kirchenbeitrag wird oft automatisch vom Arbeitgeber abgezogen.'
  },
  {
    id: 'church_tax_amount',
    question: 'Wie hoch war Ihr Kirchenbeitrag?',
    type: 'number',
    required: false,
    helpText: 'Maximal €600 sind absetzbar.',
    validation: {
      type: 'range',
      min: 0,
      max: 10000,
      errorMessage: 'Bitte geben Sie einen gültigen Betrag ein.'
    }
  },
  {
    id: 'donations',
    question: 'Haben Sie steuerbegünstigte Spenden geleistet?',
    type: 'boolean',
    required: true,
    helpText: 'Z.B. an Rotes Kreuz, Caritas, Ärzte ohne Grenzen etc. Diese werden oft automatisch gemeldet.'
  },
  {
    id: 'donations_amount',
    question: 'Wie hoch waren Ihre Spenden insgesamt?',
    type: 'number',
    required: false,
    validation: {
      type: 'range',
      min: 0,
      max: 1000000,
      errorMessage: 'Bitte geben Sie einen gültigen Betrag ein.'
    }
  },

  // Außergewöhnliche Belastungen
  {
    id: 'medical_expenses',
    question: 'Hatten Sie hohe medizinische Ausgaben, die nicht von der Krankenkasse übernommen wurden?',
    type: 'boolean',
    required: true,
    helpText: 'Z.B. Zahnbehandlungen, Brillen, Medikamente, Therapien'
  },
  {
    id: 'medical_amount',
    question: 'Wie hoch waren Ihre nicht erstatteten medizinischen Ausgaben?',
    type: 'number',
    required: false
  },
  {
    id: 'disability',
    question: 'Haben Sie oder ein Familienmitglied einen anerkannten Behinderungsgrad?',
    type: 'boolean',
    required: true
  },
  {
    id: 'disability_degree',
    question: 'Wie hoch ist der Behinderungsgrad in Prozent?',
    type: 'number',
    required: false,
    validation: {
      type: 'range',
      min: 25,
      max: 100,
      errorMessage: 'Der Behinderungsgrad muss zwischen 25% und 100% liegen.'
    }
  },

  // Family
  {
    id: 'has_children',
    question: 'Haben Sie Kinder, für die Sie Familienbeihilfe beziehen?',
    type: 'boolean',
    required: true
  },
  {
    id: 'children_count',
    question: 'Für wie viele Kinder beziehen Sie Familienbeihilfe?',
    type: 'number',
    required: false,
    validation: {
      type: 'range',
      min: 1,
      max: 20,
      errorMessage: 'Bitte geben Sie eine gültige Anzahl ein.'
    }
  },
  {
    id: 'childcare_costs',
    question: 'Hatten Sie Kinderbetreuungskosten?',
    type: 'boolean',
    required: false
  },
  {
    id: 'childcare_amount',
    question: 'Wie hoch waren die Kinderbetreuungskosten insgesamt?',
    type: 'number',
    required: false
  },
  {
    id: 'single_earner',
    question: 'Sind Sie Alleinverdiener (Partner hat kein/wenig Einkommen) oder Alleinerzieher?',
    type: 'choice',
    options: ['Nein', 'Alleinverdiener', 'Alleinerzieher'],
    required: true
  },

  // Documents
  {
    id: 'has_receipts',
    question: 'Haben Sie Belege (Rechnungen, Quittungen), die Sie hochladen möchten?',
    type: 'boolean',
    required: true,
    helpText: 'Sie können Belege später jederzeit hinzufügen.'
  },

  // Final
  {
    id: 'bank_iban',
    question: 'Wie lautet Ihre IBAN für eine eventuelle Gutschrift?',
    type: 'text',
    required: false,
    helpText: 'Format: AT12 3456 7890 1234 5678',
    validation: {
      type: 'regex',
      pattern: '^AT[0-9]{2}\\s?[0-9]{4}\\s?[0-9]{4}\\s?[0-9]{4}\\s?[0-9]{4}$',
      errorMessage: 'Bitte geben Sie eine gültige österreichische IBAN ein.'
    }
  },
  {
    id: 'additional_info',
    question: 'Gibt es noch etwas, das Sie hinzufügen möchten?',
    type: 'text',
    required: false,
    helpText: 'Z.B. besondere Umstände, Fragen, oder Anmerkungen'
  }
];

// ========================================
// Interviewer Agent Class
// ========================================

export class InterviewerAgent {
  private context: InterviewContext | null = null;
  private questionsMap: Map<string, InterviewQuestion>;

  constructor() {
    this.questionsMap = new Map(TAX_INTERVIEW_QUESTIONS.map((q) => [q.id, q]));
  }

  /**
   * Initialize a new interview session
   */
  startInterview(userId: string, taxYear: number): InterviewResponse {
    this.context = {
      userId,
      taxYear,
      currentQuestionId: 'greeting',
      responses: {},
      conversationHistory: [],
      validationErrors: []
    };

    const firstQuestion = this.questionsMap.get('greeting')!;

    return {
      message: firstQuestion.question,
      nextQuestion: firstQuestion,
      isComplete: false
    };
  }

  /**
   * Process a user response and get the next question
   */
  async processResponse(response: string): Promise<InterviewResponse> {
    if (!this.context) {
      throw new Error('Interview not initialized');
    }

    const currentQuestion = this.questionsMap.get(this.context.currentQuestionId);
    if (!currentQuestion) {
      return {
        message: 'Die Befragung ist abgeschlossen.',
        nextQuestion: null,
        isComplete: true
      };
    }

    // Validate the response
    const validationError = this.validateResponse(response, currentQuestion);
    if (validationError) {
      return {
        message: validationError,
        nextQuestion: currentQuestion,
        validationError,
        isComplete: false
      };
    }

    // Parse and store the response
    const parsedResponse = this.parseResponse(response, currentQuestion);
    this.context.responses[currentQuestion.id] = parsedResponse;

    // Add to conversation history
    this.context.conversationHistory.push(
      { role: 'assistant', content: currentQuestion.question },
      { role: 'user', content: response }
    );

    // Determine next question
    const nextQuestion = this.getNextQuestion(currentQuestion.id);

    if (!nextQuestion) {
      // Interview complete - generate summary
      const summary = await this.generateSummary();
      return {
        message: summary,
        nextQuestion: null,
        isComplete: true
      };
    }

    // Generate AI-enhanced response with transition
    const aiResponse = await this.generateTransitionMessage(currentQuestion, nextQuestion, parsedResponse);

    this.context.currentQuestionId = nextQuestion.id;

    return {
      message: aiResponse,
      nextQuestion,
      isComplete: false
    };
  }

  /**
   * Validate user response
   */
  private validateResponse(response: string, question: InterviewQuestion): string | null {
    if (question.required && (!response || response.trim() === '')) {
      return 'Diese Frage ist erforderlich. Bitte geben Sie eine Antwort ein.';
    }

    if (!response || response.trim() === '') {
      return null; // Optional field, empty is OK
    }

    if (question.validation) {
      switch (question.validation.type) {
        case 'range': {
          const num = parseFloat(response.replace(/[€,.\s]/g, ''));
          if (isNaN(num)) {
            return 'Bitte geben Sie eine Zahl ein.';
          }
          if (question.validation.min !== undefined && num < question.validation.min) {
            return question.validation.errorMessage;
          }
          if (question.validation.max !== undefined && num > question.validation.max) {
            return question.validation.errorMessage;
          }
          break;
        }
        case 'regex': {
          const regex = new RegExp(question.validation.pattern!, 'i');
          if (!regex.test(response)) {
            return question.validation.errorMessage;
          }
          break;
        }
      }
    }

    if (question.type === 'choice' && question.options) {
      const lowerResponse = response.toLowerCase();
      const validOption = question.options.some(
        (opt) => opt.toLowerCase() === lowerResponse || opt.toLowerCase().startsWith(lowerResponse)
      );
      if (!validOption) {
        return `Bitte wählen Sie eine der folgenden Optionen: ${question.options.join(', ')}`;
      }
    }

    return null;
  }

  /**
   * Parse response based on question type
   */
  private parseResponse(response: string, question: InterviewQuestion): unknown {
    switch (question.type) {
      case 'number':
        return parseFloat(response.replace(/[€,.\s]/g, '').replace(',', '.')) || 0;
      case 'boolean':
        const lower = response.toLowerCase();
        return lower === 'ja' || lower === 'yes' || lower === 'true' || lower === '1';
      case 'choice':
        // Find the matching option
        const lowerResponse = response.toLowerCase();
        return (
          question.options?.find(
            (opt) => opt.toLowerCase() === lowerResponse || opt.toLowerCase().startsWith(lowerResponse)
          ) || response
        );
      default:
        return response.trim();
    }
  }

  /**
   * Get the next question based on current state
   */
  private getNextQuestion(currentId: string): InterviewQuestion | null {
    const questions = TAX_INTERVIEW_QUESTIONS;
    const currentIndex = questions.findIndex((q) => q.id === currentId);

    if (currentIndex === -1 || currentIndex >= questions.length - 1) {
      return null;
    }

    // Find next applicable question (considering follow-up rules)
    for (let i = currentIndex + 1; i < questions.length; i++) {
      const candidate = questions[i];

      // Check if this question should be skipped based on previous answers
      if (this.shouldSkipQuestion(candidate)) {
        continue;
      }

      return candidate;
    }

    return null;
  }

  /**
   * Check if a question should be skipped
   */
  private shouldSkipQuestion(question: InterviewQuestion): boolean {
    if (!this.context) return false;

    const responses = this.context.responses;

    // Check follow-up conditions on previous questions
    const parentQuestion = TAX_INTERVIEW_QUESTIONS.find((q) =>
      q.followUp?.some((fu) => fu.questions.includes(question.id))
    );

    if (parentQuestion && parentQuestion.followUp) {
      for (const followUp of parentQuestion.followUp) {
        if (followUp.questions.includes(question.id)) {
          const fieldValue = responses[followUp.condition.field];
          const conditionMet = this.evaluateCondition(fieldValue, followUp.condition);
          if (!conditionMet) {
            return true;
          }
        }
      }
    }

    // Specific skip logic
    switch (question.id) {
      case 'commute_distance':
      case 'commute_transport':
      case 'commute_public_feasible':
        return responses.commute_exists === false;

      case 'work_equipment_details':
        return responses.work_equipment === false;

      case 'education_details':
        return responses.education_expenses === false;

      case 'church_tax_amount':
        return responses.church_tax === false;

      case 'donations_amount':
        return responses.donations === false;

      case 'medical_amount':
        return responses.medical_expenses === false;

      case 'disability_degree':
        return responses.disability === false;

      case 'children_count':
      case 'childcare_costs':
      case 'childcare_amount':
        return responses.has_children === false;

      default:
        return false;
    }
  }

  /**
   * Evaluate a condition
   */
  private evaluateCondition(
    value: unknown,
    condition: { field: string; operator: string; value: unknown }
  ): boolean {
    switch (condition.operator) {
      case 'eq':
        return value === condition.value;
      case 'gt':
        return Number(value) > Number(condition.value);
      case 'lt':
        return Number(value) < Number(condition.value);
      case 'contains':
        return String(value).includes(String(condition.value));
      default:
        return false;
    }
  }

  /**
   * Generate AI-enhanced transition message
   */
  private async generateTransitionMessage(
    currentQuestion: InterviewQuestion,
    nextQuestion: InterviewQuestion,
    response: unknown
  ): Promise<string> {
    try {
      const systemPrompt = `Du bist ein freundlicher österreichischer Steuerberater-Assistent.
Deine Aufgabe ist es, einen natürlichen Übergang zwischen zwei Interviewfragen zu schaffen.
Sei kurz, freundlich und hilfsbereit. Bestätige die Eingabe des Benutzers und stelle die nächste Frage.
Antworte auf Deutsch.`;

      const userPrompt = `Der Benutzer hat gerade die Frage "${currentQuestion.question}" mit "${response}" beantwortet.
Die nächste Frage ist: "${nextQuestion.question}"
${nextQuestion.helpText ? `Hilfetext: ${nextQuestion.helpText}` : ''}

Erstelle einen natürlichen Übergang und stelle die nächste Frage. Sei kurz (max 2-3 Sätze vor der Frage).`;

      const llmResponse = await llmService.query(userPrompt, [], systemPrompt);
      return llmResponse.content;
    } catch (error) {
      // Fallback to simple transition
      return `Verstanden! ${nextQuestion.question}${nextQuestion.helpText ? `\n\n💡 ${nextQuestion.helpText}` : ''}`;
    }
  }

  /**
   * Generate interview summary
   */
  private async generateSummary(): Promise<string> {
    if (!this.context) return 'Keine Daten vorhanden.';

    const responses = this.context.responses;

    try {
      const systemPrompt = `Du bist ein österreichischer Steuerberater-Assistent.
Erstelle eine kurze, übersichtliche Zusammenfassung der gesammelten Steuerdaten.
Hebe wichtige Absetzbeträge hervor und gib eine grobe Einschätzung.
Antworte auf Deutsch.`;

      const userPrompt = `Hier sind die gesammelten Interviewdaten für die Arbeitnehmerveranlagung ${this.context.taxYear}:

${JSON.stringify(responses, null, 2)}

Erstelle eine übersichtliche Zusammenfassung mit:
1. Persönliche Daten
2. Einkommen
3. Absetzbare Kosten (Werbungskosten, Sonderausgaben, etc.)
4. Geschätzte Steuerersparnis (grobe Einschätzung)`;

      const llmResponse = await llmService.query(userPrompt, [], systemPrompt);
      return `## Zusammenfassung Ihrer Angaben\n\n${llmResponse.content}\n\n---\n✅ Das Interview ist abgeschlossen. Sie können nun Belege hochladen oder direkt zur Analyse fortfahren.`;
    } catch (error) {
      // Fallback summary
      return `## Zusammenfassung Ihrer Angaben

Das Interview für die Arbeitnehmerveranlagung ${this.context.taxYear} ist abgeschlossen.

Ihre Angaben wurden gespeichert:
- Einkommen: €${responses.gross_income || 'nicht angegeben'}
- Home Office Tage: ${responses.home_office_days || 0}
- Pendlerstrecke: ${responses.commute_distance || 0} km

✅ Sie können nun Belege hochladen oder direkt zur Analyse fortfahren.`;
    }
  }

  /**
   * Get current context
   */
  getContext(): InterviewContext | null {
    return this.context;
  }

  /**
   * Get all responses
   */
  getResponses(): Record<string, unknown> {
    return this.context?.responses || {};
  }

  /**
   * Set context from saved state
   */
  restoreContext(context: InterviewContext): void {
    this.context = context;
  }
}

// Singleton instance
export const interviewerAgent = new InterviewerAgent();
export default InterviewerAgent;
