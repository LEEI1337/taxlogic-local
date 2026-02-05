# TaxLogic.local - API Dokumentation

## Übersicht

Diese Dokumentation beschreibt alle IPC-APIs, die zwischen dem Frontend (Renderer) und Backend (Main Process) verwendet werden.

---

## Frontend API (window.electronAPI)

Alle APIs sind über das globale `window.electronAPI` Objekt verfügbar.

### LLM Service

#### `llm.checkConnection()`

Prüft die Verbindung zu allen konfigurierten LLM-Providern.

```typescript
interface ConnectionStatus {
  connected: boolean;
  provider: string;
  model: string;
  error?: string;
}

interface AllConnectionStatus {
  ollama: ConnectionStatus;
  lmStudio: ConnectionStatus;
  claude: ConnectionStatus;
}

const status: AllConnectionStatus = await window.electronAPI.llm.checkConnection();
```

#### `llm.chat(messages, systemPrompt?)`

Sendet Nachrichten an das LLM und erhält eine Antwort.

```typescript
interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface LLMResponse {
  content: string;
  provider: string;
  model: string;
  tokensUsed?: number;
}

const response: LLMResponse = await window.electronAPI.llm.chat(
  [{ role: 'user', content: 'Hallo!' }],
  'Du bist ein hilfreicher Steuerberater.'
);
```

#### `llm.setProvider(provider)`

Wechselt den aktiven LLM-Provider.

```typescript
type LLMProvider = 'ollama' | 'lmStudio' | 'claude';

await window.electronAPI.llm.setProvider('ollama');
```

#### `llm.setModel(model)`

Wechselt das aktive Modell.

```typescript
await window.electronAPI.llm.setModel('mistral:latest');
```

#### `llm.getAvailableModels()`

Listet verfügbare Modelle des aktuellen Providers.

```typescript
const models: string[] = await window.electronAPI.llm.getAvailableModels();
// ['mistral:latest', 'llama2:latest', ...]
```

---

### Database Service

#### `db.saveProfile(profile)`

Speichert oder aktualisiert das Benutzerprofil.

```typescript
interface UserProfile {
  id?: string;
  email?: string;
  firstName: string;
  lastName: string;
  taxId?: string;
  address?: string;
  // ... weitere Felder
}

const savedProfile = await window.electronAPI.db.saveProfile({
  firstName: 'Max',
  lastName: 'Mustermann',
  taxId: '123/456/789'
});
```

#### `db.getProfile()`

Lädt das aktuelle Benutzerprofil.

```typescript
const profile: UserProfile | null = await window.electronAPI.db.getProfile();
```

#### `db.saveInterview(interviewData)`

Speichert Interview-Daten.

```typescript
interface InterviewData {
  taxYear: number;
  status: 'in_progress' | 'completed';
  data: Record<string, any>;
}

const interview = await window.electronAPI.db.saveInterview({
  taxYear: 2024,
  status: 'in_progress',
  data: { income: 45000, hasHomeOffice: true }
});
```

#### `db.getInterview(taxYear)`

Lädt Interview für ein bestimmtes Steuerjahr.

```typescript
const interview = await window.electronAPI.db.getInterview(2024);
```

---

### OCR Service

#### `ocr.processImage(imagePath)`

Führt OCR auf einem Bild durch.

```typescript
interface OCRResult {
  text: string;
  confidence: number;
  lines: OCRLine[];
  words: OCRWord[];
}

const result: OCRResult = await window.electronAPI.ocr.processImage('/path/to/receipt.jpg');
```

#### `ocr.extractExpenseData(ocrResult)`

Extrahiert strukturierte Daten aus OCR-Ergebnis.

```typescript
interface ExtractedData {
  amount?: number;
  date?: string;
  merchant?: string;
  category?: string;
  items?: string[];
}

const data: ExtractedData = await window.electronAPI.ocr.extractExpenseData(ocrResult);
```

---

### Document Service

#### `document.upload(filePaths)`

Lädt Dokumente hoch und verarbeitet sie.

```typescript
interface ProcessedDocument {
  id: string;
  fileName: string;
  category: string;
  ocrText: string;
  extractedData: ExtractedData;
  confidence: number;
}

const docs: ProcessedDocument[] = await window.electronAPI.document.upload([
  '/path/to/receipt1.jpg',
  '/path/to/receipt2.pdf'
]);
```

#### `document.getAll()`

Listet alle hochgeladenen Dokumente.

```typescript
const documents: ProcessedDocument[] = await window.electronAPI.document.getAll();
```

#### `document.delete(documentId)`

Löscht ein Dokument.

```typescript
await window.electronAPI.document.delete('doc-123');
```

#### `document.updateCategory(documentId, category)`

Ändert die Kategorie eines Dokuments.

```typescript
type ExpenseCategory = 
  | 'werbungskosten'
  | 'sonderausgaben'
  | 'aussergewoehnliche_belastungen'
  | 'homeoffice'
  | 'pendlerpauschale'
  | 'sonstige';

await window.electronAPI.document.updateCategory('doc-123', 'homeoffice');
```

---

### Interview Agent

#### `interview.start(taxYear)`

Startet ein neues Interview.

```typescript
interface InterviewQuestion {
  id: string;
  question: string;
  type: 'text' | 'number' | 'boolean' | 'select';
  options?: string[];
  category: string;
}

const firstQuestion: InterviewQuestion = await window.electronAPI.interview.start(2024);
```

#### `interview.respond(questionId, answer)`

Beantwortet eine Interview-Frage.

```typescript
interface InterviewResponse {
  nextQuestion?: InterviewQuestion;
  isComplete: boolean;
  progress: number; // 0-100
}

const response: InterviewResponse = await window.electronAPI.interview.respond(
  'q-income',
  '45000'
);
```

#### `interview.getSummary()`

Holt eine Zusammenfassung der Interview-Antworten.

```typescript
interface InterviewSummary {
  totalQuestions: number;
  answeredQuestions: number;
  categories: {
    name: string;
    completed: boolean;
    answers: Record<string, any>;
  }[];
}

const summary: InterviewSummary = await window.electronAPI.interview.getSummary();
```

---

### Analyzer Agent

#### `analyzer.analyze()`

Analysiert alle gesammelten Daten.

```typescript
interface TaxAnalysis {
  grossIncome: number;
  deductions: {
    werbungskosten: number;
    sonderausgaben: number;
    aussergewoehnlicheBelastungen: number;
  };
  taxableIncome: number;
  estimatedTax: number;
  estimatedRefund?: number;
  optimizations: Optimization[];
}

interface Optimization {
  title: string;
  description: string;
  potentialSavings: number;
  priority: 'high' | 'medium' | 'low';
}

const analysis: TaxAnalysis = await window.electronAPI.analyzer.analyze();
```

---

### Form Generator

#### `forms.generateL1(data)`

Generiert das L1-Hauptformular.

```typescript
interface L1FormData {
  taxYear: number;
  personalInfo: PersonalInfo;
  income: IncomeData;
  deductions: DeductionsData;
}

interface GeneratedForm {
  id: string;
  formType: 'L1' | 'L1ab' | 'L1k';
  filePath: string;
  generatedAt: string;
}

const form: GeneratedForm = await window.electronAPI.forms.generateL1(l1Data);
```

#### `forms.generateL1ab(data)`

Generiert das L1ab-Beilagenformular.

```typescript
interface L1abFormData {
  taxYear: number;
  businessIncome?: BusinessIncome;
  additionalIncome?: AdditionalIncome;
}

const form: GeneratedForm = await window.electronAPI.forms.generateL1ab(l1abData);
```

#### `forms.generateL1k(data)`

Generiert das L1k-Formular für Sonderausgaben.

```typescript
interface L1kFormData {
  taxYear: number;
  specialExpenses: SpecialExpenses;
}

const form: GeneratedForm = await window.electronAPI.forms.generateL1k(l1kData);
```

#### `forms.getAll()`

Listet alle generierten Formulare.

```typescript
const forms: GeneratedForm[] = await window.electronAPI.forms.getAll();
```

#### `forms.download(formId)`

Öffnet einen Download-Dialog für ein Formular.

```typescript
await window.electronAPI.forms.download('form-123');
```

---

### Guide Generator

#### `guide.generate()`

Generiert eine personalisierte Schritt-für-Schritt Anleitung.

```typescript
interface FilingGuide {
  id: string;
  title: string;
  steps: GuideStep[];
  checklist: ChecklistItem[];
  filePath: string;
}

interface GuideStep {
  number: number;
  title: string;
  description: string;
  screenshots?: string[];
}

interface ChecklistItem {
  text: string;
  completed: boolean;
}

const guide: FilingGuide = await window.electronAPI.guide.generate();
```

---

### RAG Service

#### `rag.query(question, category?)`

Stellt eine Frage an die Wissensbasis.

```typescript
interface RAGResponse {
  answer: string;
  sources: Source[];
  confidence: number;
}

interface Source {
  title: string;
  excerpt: string;
  url?: string;
}

const response: RAGResponse = await window.electronAPI.rag.query(
  'Was kann ich als Pendlerpauschale absetzen?',
  'werbungskosten'
);
```

---

### Window Management

#### `window.minimize()`

```typescript
await window.electronAPI.window.minimize();
```

#### `window.maximize()`

```typescript
await window.electronAPI.window.maximize();
```

#### `window.close()`

```typescript
await window.electronAPI.window.close();
```

---

### File System

#### `fs.selectFiles(options)`

Öffnet einen Dateiauswahl-Dialog.

```typescript
interface FileSelectOptions {
  title?: string;
  filters?: { name: string; extensions: string[] }[];
  multiSelect?: boolean;
}

const files: string[] = await window.electronAPI.fs.selectFiles({
  title: 'Belege auswählen',
  filters: [
    { name: 'Bilder', extensions: ['jpg', 'png', 'pdf'] }
  ],
  multiSelect: true
});
```

#### `fs.selectFolder()`

Öffnet einen Ordnerauswahl-Dialog.

```typescript
const folder: string | null = await window.electronAPI.fs.selectFolder();
```

#### `fs.openExternal(url)`

Öffnet eine URL im Standard-Browser.

```typescript
await window.electronAPI.fs.openExternal('https://finanzonline.bmf.gv.at');
```

---

## Error Handling

Alle API-Aufrufe können Fehler werfen. Empfohlenes Pattern:

```typescript
try {
  const result = await window.electronAPI.llm.chat(messages);
  // Erfolg
} catch (error) {
  if (error instanceof Error) {
    console.error('API Error:', error.message);
    // Fehlerbehandlung
  }
}
```

---

## TypeScript Typen

Alle Typen sind in `src/types/` definiert und können importiert werden:

```typescript
import type { 
  UserProfile, 
  InterviewData, 
  OCRResult, 
  TaxAnalysis 
} from '../types';
```

---

*Letzte Aktualisierung: 2026-02-05*
