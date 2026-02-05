# Coding Standards / Kodierungsrichtlinien

```
 ██████╗ ██████╗ ██████╗ ██╗███╗   ██╗ ██████╗ 
██╔════╝██╔═══██╗██╔══██╗██║████╗  ██║██╔════╝ 
██║     ██║   ██║██║  ██║██║██╔██╗ ██║██║  ███╗
██║     ██║   ██║██║  ██║██║██║╚██╗██║██║   ██║
╚██████╗╚██████╔╝██████╔╝██║██║ ╚████║╚██████╔╝
 ╚═════╝ ╚═════╝ ╚═════╝ ╚═╝╚═╝  ╚═══╝ ╚═════╝ 
███████╗████████╗ █████╗ ███╗   ██╗██████╗  █████╗ ██████╗ ██████╗ ███████╗
██╔════╝╚══██╔══╝██╔══██╗████╗  ██║██╔══██╗██╔══██╗██╔══██╗██╔══██╗██╔════╝
███████╗   ██║   ███████║██╔██╗ ██║██║  ██║███████║██████╔╝██║  ██║███████╗
╚════██║   ██║   ██╔══██║██║╚██╗██║██║  ██║██╔══██║██╔══██╗██║  ██║╚════██║
███████║   ██║   ██║  ██║██║ ╚████║██████╔╝██║  ██║██║  ██║██████╔╝███████║
╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═══╝╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚══════╝
```

Dieses Dokument definiert die Codierungsstandards für das TaxLogic.local Projekt.

This document defines the coding standards for the TaxLogic.local project.

---

## Inhaltsverzeichnis / Table of Contents

1. [TypeScript Guidelines](#typescript-guidelines)
2. [React Guidelines](#react-guidelines)
3. [Backend Guidelines](#backend-guidelines)
4. [Styling Guidelines](#styling-guidelines)
5. [Testing Guidelines](#testing-guidelines)
6. [Git Guidelines](#git-guidelines)
7. [Documentation Guidelines](#documentation-guidelines)

---

## TypeScript Guidelines

### Strikte Typisierung / Strict Typing

```typescript
// tsconfig.json - Empfohlene Einstellungen
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### Typendefinitionen / Type Definitions

```typescript
// ✅ KORREKT: Explizite Typen für Interfaces
interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;           // Optional mit ?
  taxId: string | null;     // Explizit nullable
  createdAt: Date;
  updatedAt: Date;
}

// ✅ KORREKT: Funktionstypen
type AsyncHandler<T> = () => Promise<T>;
type EventCallback = (event: Event) => void;

// ❌ FALSCH: any verwenden
interface BadProfile {
  data: any;  // Niemals any!
}

// ✅ KORREKT: unknown statt any
interface BetterProfile {
  data: unknown;  // unknown ist sicherer
}
```

### Enums vs. Union Types

```typescript
// ✅ BEVORZUGT: Union Types für einfache Werte
type LLMProvider = 'ollama' | 'lmStudio' | 'claude';
type InterviewStatus = 'pending' | 'in_progress' | 'completed';

// ✅ OK: Enums für komplexe Fälle mit Werten
enum ErrorCode {
  CONNECTION_FAILED = 'E001',
  VALIDATION_ERROR = 'E002',
  NOT_FOUND = 'E003'
}
```

### Nullsicherheit / Null Safety

```typescript
// ✅ KORREKT: Optional Chaining
const userName = user?.profile?.name ?? 'Anonymous';

// ✅ KORREKT: Nullish Coalescing
const port = process.env.PORT ?? '11434';

// ❌ FALSCH: Unsichere Zugriffe
const userName = user.profile.name;  // Kann crashen!
```

### Generics

```typescript
// ✅ KORREKT: Typsichere generische Funktionen
async function fetchData<T>(url: string): Promise<T> {
  const response = await fetch(url);
  return response.json() as T;
}

// ✅ KORREKT: Generische Constraints
interface HasId {
  id: string;
}

function findById<T extends HasId>(items: T[], id: string): T | undefined {
  return items.find(item => item.id === id);
}
```

---

## React Guidelines

### Komponenten-Struktur / Component Structure

```typescript
// ✅ KORREKT: Funktionale Komponente mit TypeScript
import { useState, useEffect, type FC } from 'react';

interface InterviewPageProps {
  taxYear: number;
  onComplete?: () => void;
}

const InterviewPage: FC<InterviewPageProps> = ({ taxYear, onComplete }) => {
  // 1. Hooks zuerst
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 2. Effects
  useEffect(() => {
    loadQuestions();
  }, [taxYear]);

  // 3. Handler
  const handleAnswer = (answer: string) => {
    // ...
  };

  // 4. Render-Helfer (wenn nötig)
  const renderQuestion = (question: Question) => (
    <div key={question.id}>{question.text}</div>
  );

  // 5. Return
  return (
    <div className="interview-page">
      {isLoading ? (
        <LoadingSpinner />
      ) : (
        questions.map(renderQuestion)
      )}
    </div>
  );
};

export default InterviewPage;
```

### Hooks Best Practices

```typescript
// ✅ KORREKT: Custom Hook mit klarem Zweck
function useLLMConnection() {
  const [status, setStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      setStatus('checking');
      const result = await window.electronAPI.llm.checkConnection();
      setStatus(result.connected ? 'connected' : 'disconnected');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus('disconnected');
    }
  };

  return { status, error, retry: checkConnection };
}
```

### State Management mit Zustand

```typescript
// ✅ KORREKT: Zustand Store Definition
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  // State
  currentPage: string;
  userProfile: UserProfile | null;
  llmStatus: 'connected' | 'disconnected' | 'checking';
  
  // Actions
  setCurrentPage: (page: string) => void;
  setUserProfile: (profile: UserProfile) => void;
  setLlmStatus: (status: 'connected' | 'disconnected' | 'checking') => void;
  reset: () => void;
}

const initialState = {
  currentPage: 'onboarding',
  userProfile: null,
  llmStatus: 'checking' as const,
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      ...initialState,
      
      setCurrentPage: (page) => set({ currentPage: page }),
      setUserProfile: (profile) => set({ userProfile: profile }),
      setLlmStatus: (status) => set({ llmStatus: status }),
      reset: () => set(initialState),
    }),
    {
      name: 'taxlogic-storage',
    }
  )
);
```

### Conditional Rendering

```typescript
// ✅ KORREKT: Klare Bedingungen
function StatusIndicator({ status }: { status: ConnectionStatus }) {
  if (status === 'loading') {
    return <Spinner />;
  }

  if (status === 'error') {
    return <ErrorMessage />;
  }

  return <SuccessIndicator />;
}

// ✅ KORREKT: Ternary für einfache Fälle
return (
  <div>
    {isLoading ? <Spinner /> : <Content />}
  </div>
);

// ❌ FALSCH: Verschachtelte Ternaries
return (
  <div>
    {isLoading ? <Spinner /> : hasError ? <Error /> : hasData ? <Content /> : null}
  </div>
);
```

---

## Backend Guidelines

### Service-Struktur / Service Structure

```typescript
// ✅ KORREKT: Service-Klasse mit klarer API
import { z } from 'zod';

// Schema für Validierung
const ProfileSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional(),
});

class DatabaseService {
  private db: Database | null = null;

  async initialize(): Promise<void> {
    // Initialisierung
  }

  async saveProfile(data: unknown): Promise<UserProfile> {
    // 1. Input validieren
    const validatedData = ProfileSchema.parse(data);
    
    // 2. Verarbeitung
    const profile = await this.insertOrUpdate(validatedData);
    
    // 3. Ergebnis zurückgeben
    return profile;
  }

  async getProfile(): Promise<UserProfile | null> {
    // ...
  }

  // Private Methoden
  private async insertOrUpdate(data: z.infer<typeof ProfileSchema>): Promise<UserProfile> {
    // ...
  }
}

export const dbService = new DatabaseService();
```

### Error Handling

```typescript
// ✅ KORREKT: Benutzerdefinierte Error-Klassen
class TaxLogicError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'TaxLogicError';
  }
}

class ConnectionError extends TaxLogicError {
  constructor(provider: string) {
    super(`Failed to connect to ${provider}`, 'E_CONNECTION', { provider });
    this.name = 'ConnectionError';
  }
}

// ✅ KORREKT: Try-Catch mit spezifischen Fehlern
async function connectToLLM(provider: string): Promise<void> {
  try {
    await llmService.connect(provider);
  } catch (error) {
    if (error instanceof ConnectionError) {
      console.error(`Connection failed: ${error.details?.provider}`);
      throw error;
    }
    // Unbekannte Fehler weitergeben
    throw new TaxLogicError('Unknown error during connection', 'E_UNKNOWN', { error });
  }
}
```

### IPC Handler

```typescript
// ✅ KORREKT: Typisierte IPC Handler
import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { z } from 'zod';

// Schema für Input-Validierung
const SaveProfileInput = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email().optional(),
});

// Handler mit Validierung
ipcMain.handle('db:save-profile', async (
  _event: IpcMainInvokeEvent,
  input: unknown
): Promise<UserProfile> => {
  // 1. Input validieren
  const validatedInput = SaveProfileInput.parse(input);
  
  // 2. Service aufrufen
  const profile = await dbService.saveProfile(validatedInput);
  
  // 3. Ergebnis zurückgeben
  return profile;
});
```

### Logging

```typescript
// ✅ KORREKT: Strukturiertes Logging
import { logger } from './utils/logger';

async function processDocument(path: string): Promise<Document> {
  logger.info('Processing document', { path });
  
  try {
    const result = await ocrService.process(path);
    logger.debug('OCR completed', { 
      path, 
      confidence: result.confidence,
      textLength: result.text.length 
    });
    return result;
  } catch (error) {
    logger.error('Document processing failed', { 
      path, 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

// ❌ FALSCH: Unstrukturiertes Logging
console.log('Processing: ' + path);
console.log('Error: ' + error);
```

---

## Styling Guidelines

### TailwindCSS Konventionen

```tsx
// ✅ KORREKT: Konsistente Klassen-Reihenfolge
// Layout → Flexbox/Grid → Spacing → Sizing → Typography → Visual → Interactive
<div className="
  flex flex-col               // Layout
  items-center justify-between // Flex alignment
  p-4 mx-2                     // Spacing
  w-full max-w-md              // Sizing
  text-lg font-medium          // Typography
  bg-white rounded-lg shadow   // Visual
  hover:bg-gray-50             // Interactive
">

// ✅ KORREKT: Komponenten-spezifische Klassen extrahieren
// In globals.css:
@layer components {
  .btn-primary {
    @apply px-4 py-2 bg-blue-600 text-white rounded-lg 
           hover:bg-blue-700 focus:ring-2 focus:ring-blue-500
           transition-colors duration-200;
  }
  
  .card {
    @apply bg-white rounded-lg shadow-md p-6;
  }
}

// Verwendung:
<button className="btn-primary">Speichern</button>
<div className="card">Inhalt</div>
```

### Responsive Design

```tsx
// ✅ KORREKT: Mobile-First Ansatz
<div className="
  p-2 md:p-4 lg:p-6           // Spacing skaliert
  text-sm md:text-base        // Text skaliert
  grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3  // Grid skaliert
">
```

### Farben und Design Tokens

```css
/* ✅ KORREKT: Design Tokens in tailwind.config.js */
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
      },
    },
  },
};

/* Verwendung: bg-primary-500, text-success */
```

---

## Testing Guidelines

### Unit Tests mit Vitest

```typescript
// ✅ KORREKT: Aussagekräftige Test-Beschreibungen
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { analyzerAgent } from '../analyzerAgent';

describe('AnalyzerAgent', () => {
  describe('calculateTax', () => {
    it('should calculate correct tax for income below threshold', () => {
      const result = analyzerAgent.calculateTax({
        grossIncome: 11000,
        taxYear: 2024,
      });
      
      expect(result.taxAmount).toBe(0);
      expect(result.effectiveRate).toBe(0);
    });

    it('should apply progressive rates for higher income', () => {
      const result = analyzerAgent.calculateTax({
        grossIncome: 50000,
        taxYear: 2024,
      });
      
      expect(result.taxAmount).toBeGreaterThan(0);
      expect(result.effectiveRate).toBeLessThan(0.5);
    });

    it('should throw error for invalid tax year', () => {
      expect(() => {
        analyzerAgent.calculateTax({
          grossIncome: 50000,
          taxYear: 2020, // Zu alt
        });
      }).toThrow('Unsupported tax year');
    });
  });
});
```

### Mocking

```typescript
// ✅ KORREKT: Mocking externer Abhängigkeiten
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock des LLM Service
vi.mock('../services/llmService', () => ({
  llmService: {
    chat: vi.fn(),
    checkConnection: vi.fn(),
  },
}));

import { llmService } from '../services/llmService';
import { interviewerAgent } from '../agents/interviewerAgent';

describe('InterviewerAgent', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should generate follow-up question based on answer', async () => {
    // Arrange
    vi.mocked(llmService.chat).mockResolvedValue({
      content: 'Wie hoch war Ihr Home-Office-Anteil?',
      provider: 'ollama',
      model: 'mistral',
    });

    // Act
    const result = await interviewerAgent.generateFollowUp({
      previousQuestion: 'Arbeiten Sie von zu Hause?',
      answer: 'Ja',
    });

    // Assert
    expect(result.question).toContain('Home-Office');
    expect(llmService.chat).toHaveBeenCalledOnce();
  });
});
```

### Integration Tests

```typescript
// ✅ KORREKT: Integration Test für vollständigen Flow
describe('Document Processing Flow', () => {
  it('should process document from upload to categorization', async () => {
    // 1. Dokument hochladen
    const uploadResult = await documentService.upload('/test/receipt.jpg');
    expect(uploadResult.id).toBeDefined();

    // 2. OCR durchführen
    const ocrResult = await ocrService.process(uploadResult.path);
    expect(ocrResult.text).toBeTruthy();

    // 3. Kategorisieren
    const category = await documentOrganizer.categorize(ocrResult);
    expect(category).toBeOneOf([
      'werbungskosten',
      'sonderausgaben',
      'aussergewoehnliche_belastungen',
    ]);
  });
});
```

---

## Git Guidelines

### Commit Messages (Conventional Commits)

```bash
# Format
<type>(<scope>): <description>

[optional body]

[optional footer(s)]

# Types
feat     # Neue Funktion
fix      # Bugfix
docs     # Nur Dokumentation
style    # Formatting, keine Code-Änderung
refactor # Weder fix noch feat
test     # Tests hinzufügen
chore    # Build, Dependencies, etc.

# Beispiele
feat(interview): add support for multiple tax years
fix(ocr): handle corrupted image files gracefully
docs(api): add examples for LLM service
refactor(db): extract common query logic
test(analyzer): add edge cases for tax calculation
chore(deps): update electron to 28.2.1
```

### Branch Naming

```bash
# Format
<type>/<short-description>

# Beispiele
feature/multi-language-support
fix/ocr-memory-leak
docs/api-examples
refactor/llm-service
test/analyzer-edge-cases
```

### Pull Request Guidelines

```markdown
## PR Titel
Verwende Conventional Commits Format

## PR Beschreibung Template
### Zusammenfassung
[Was wurde geändert?]

### Änderungstyp
- [ ] Feature
- [ ] Bugfix
- [ ] Documentation
- [ ] Refactoring
- [ ] Tests

### Tests
- [ ] Neue Tests hinzugefügt
- [ ] Bestehende Tests angepasst
- [ ] Alle Tests bestanden

### Checkliste
- [ ] Code folgt den Coding Standards
- [ ] Dokumentation aktualisiert
- [ ] Keine Breaking Changes (oder dokumentiert)
```

---

## Documentation Guidelines

### Code-Kommentare

```typescript
// ✅ KORREKT: JSDoc für öffentliche APIs
/**
 * Berechnet die Einkommensteuer nach österreichischem Recht.
 * 
 * @param grossIncome - Bruttoeinkommen in Euro
 * @param taxYear - Steuerjahr (2024-2026)
 * @param deductions - Absetzbare Beträge
 * @returns Berechnetes Steuerergebnis
 * 
 * @example
 * ```typescript
 * const result = calculateTax(45000, 2024, { werbungskosten: 1500 });
 * console.log(result.taxAmount); // 8040
 * ```
 */
function calculateTax(
  grossIncome: number,
  taxYear: number,
  deductions?: Deductions
): TaxResult {
  // ...
}

// ❌ FALSCH: Offensichtliches kommentieren
// Addiere 1 zu counter
counter = counter + 1;

// ✅ KORREKT: Warum, nicht was
// Freibetrag erhöht sich für 2025 gemäß EStG § 33
const freibetrag = taxYear >= 2025 ? 12816 : 12816;
```

### README für Module

```markdown
# Module Name

## Übersicht
Kurze Beschreibung des Moduls.

## Verwendung
```typescript
import { module } from './module';
module.doSomething();
```

## API

### `function(param): ReturnType`
Beschreibung.

## Abhängigkeiten
- Liste der Abhängigkeiten
```

---

## Zusammenfassung / Summary

| Bereich | Regel |
|---------|-------|
| **TypeScript** | Strenge Typisierung, keine `any`, Input-Validierung |
| **React** | Funktionale Komponenten, Custom Hooks, Zustand |
| **Backend** | Service-Klassen, Error Handling, Logging |
| **Styling** | TailwindCSS, Mobile-First, Design Tokens |
| **Testing** | Vitest, aussagekräftige Tests, Mocking |
| **Git** | Conventional Commits, aussagekräftige PRs |
| **Docs** | JSDoc, README pro Modul |

---

*Letzte Aktualisierung / Last updated: 2026-02-05*
