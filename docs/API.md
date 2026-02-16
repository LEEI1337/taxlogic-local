# TaxLogic.local API Reference

Date: 2026-02-16  
Source of truth: `src/main/preload.ts`

---

## Overview

The renderer interacts with backend functionality through `window.electronAPI`.

Design principles:

1. Context isolation is enabled.
2. Only allowlisted IPC channels are exposed.
3. Renderer does not receive raw `ipcRenderer`.

---

## Global API

```ts
window.electronAPI
```

Top-level methods:

- `minimize(): Promise<void>`
- `maximize(): Promise<void>`
- `close(): Promise<void>`
- `isMaximized(): Promise<boolean>`
- `getVersion(): Promise<string>`
- `getUserDataPath(): Promise<string>`
- `getPlatform(): Promise<NodeJS.Platform>`
- `invoke(channel, ...args): Promise<unknown>` (allowlisted channels only)
- `on(channel, callback): () => void` (allowlisted channels only)
- `once(channel, callback): void`
- `removeAllListeners(channel): void`

---

## Domain APIs

## `llm`

- `checkStatus(): Promise<{ ollama: boolean; lmStudio: boolean; claude: boolean; openai: boolean; gemini: boolean; openaiCompatible: boolean }>`
- `getAvailableModels(): Promise<string[]>`
- `setModel(modelName: string): Promise<void>`
- `query(prompt: string, conversationHistory?: Array<{ role: string; content: string }>): Promise<string>`

## `interview`

- `start(userProfile: Record<string, unknown>, taxYear?: number): Promise<{ message: string; question: Record<string, unknown> | null; interviewId: string }>`
- `continue(userInput: string): Promise<{ message: string; question: Record<string, unknown> | null; isComplete: boolean; validationError?: string }>`
- `getProfile(): Promise<Record<string, unknown>>`
- `save(data: Record<string, unknown>): Promise<void>`
- `load(id: string): Promise<Record<string, unknown>>`

Important change:

- `interview.start` now accepts `taxYear?` as second argument.

## `taxRules`

- `getStatus(taxYear?: number): Promise<{ year: number; state: 'ok' | 'missing' | 'stale' | 'invalid' | 'unsupportedYear'; message: string; supportedYears: number[]; verifiedAt?: string; daysSinceVerification?: number }>`
- `getSupportedYears(): Promise<number[]>`
- `getDiagnostics(): Promise<Array<{ year: number; state: 'ok' | 'missing' | 'stale' | 'invalid' | 'unsupportedYear'; message: string; supportedYears: number[]; verifiedAt?: string; daysSinceVerification?: number }>>`

## `documents`

- `upload(filePaths: string[]): Promise<Array<{ id: string; path: string; status: string }>>`
- `process(documentId: string): Promise<Record<string, unknown>>`
- `organize(): Promise<Record<string, unknown>>`
- `getManifest(): Promise<Record<string, unknown>>`

## `forms`

- `generate(formType: string): Promise<string>`
- `preview(formType: string): Promise<string>`
- `export(formType: string, outputPath: string): Promise<void>`

## `guide`

- `generate(): Promise<string>`
- `export(outputPath: string): Promise<string>`

## `fs`

- `selectDirectory(): Promise<string | null>`
- `selectFiles(filters?: Array<{ name: string; extensions: string[] }>): Promise<string[] | null>`
- `openPath(path: string): Promise<void>`
- `saveFile(defaultName: string, filters?: Array<{ name: string; extensions: string[] }>): Promise<string | null>`

---

## Generic `invoke` Channels

These channels are currently allowlisted for generic `invoke(...)` usage:

- Window: `window:minimize`, `window:maximize`, `window:close`, `window:isMaximized`
- App: `app:getVersion`, `app:getUserDataPath`, `app:getPlatform`
- LLM: `llm:checkStatus`, `llm:getAvailableModels`, `llm:setModel`, `llm:setConfig`, `llm:query`, `llm:queryStream`
- Interview: `interview:start`, `interview:continue`, `interview:getProfile`, `interview:save`, `interview:load`
- Documents: `documents:upload`, `documents:process`, `documents:organize`, `documents:getManifest`, `documents:delete`
- Analysis: `analysis:calculate`, `analysis:getResults`, `analysis:optimize`
- Forms: `forms:generate`, `forms:preview`, `forms:export`, `forms:getAvailable`
- Guide: `guide:generate`, `guide:export`
- DB: `db:getUserProfile`, `db:saveUserProfile`, `db:getInterviews`, `db:getDocuments`, `db:getExpenses`
- FS: `fs:selectDirectory`, `fs:selectFiles`, `fs:openPath`, `fs:saveFile`
- Settings: `settings:get`, `settings:set`, `settings:getAll`, `settings:reset`
- Tax rules: `taxRules:getStatus`, `taxRules:getSupportedYears`, `taxRules:getDiagnostics`
- API keys: `apiKeys:get`, `apiKeys:set`, `apiKeys:getAll`

---

## Event Channels (`on` / `once`)

- Window: `window:stateChanged`
- LLM stream: `llm:streamChunk`, `llm:streamEnd`, `llm:streamError`
- Progress: `progress:update`, `progress:complete`, `progress:error`
- Notification: `notification:show`
- Interview: `interview:questionReceived`, `interview:completed`
- Menu: `menu:newFiling`, `menu:openFiling`, `menu:save`, `menu:saveAs`, `menu:importDocuments`, `menu:exportForms`, `menu:openSettings`, `menu:startInterview`, `menu:manageDocuments`, `menu:runAnalysis`, `menu:generateForms`, `menu:showGuide`, `menu:checkLLMStatus`, `menu:showAbout`

---

## Validation and Errors

Main process validates payloads with Zod schemas in `src/main/ipcValidation.ts`.

When validation fails:

1. request is rejected in main process
2. renderer receives a thrown error from `invoke(...)`

Tax-rule aware operations may throw when the active tax year is:

- missing
- stale
- invalid
- unsupported

---

## Compatibility Note

If older renderer code still calls outdated methods (for example `interview.respond(...)`), migrate to the methods defined in this document and `src/main/preload.ts`.
