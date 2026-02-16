import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { afterEach, describe, expect, it, vi } from 'vitest';

type TaxRuleState = 'ok' | 'missing' | 'stale' | 'invalid' | 'unsupportedYear';
type IpcHandler = (event: unknown, ...args: unknown[]) => unknown;

const tempDirs: string[] = [];

const createTempDir = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'taxlogic-ipc-'));
  tempDirs.push(dir);
  return dir;
};

const cleanupTempDirs = (): void => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

const setupIpcHarness = async (initialState: TaxRuleState = 'ok') => {
  vi.resetModules();

  const handlers = new Map<string, IpcHandler>();
  const userDataDir = createTempDir();
  let currentState: TaxRuleState = initialState;

  const dialogMock = {
    showOpenDialog: vi.fn().mockResolvedValue({ canceled: true, filePaths: [] as string[] }),
    showSaveDialog: vi.fn().mockResolvedValue({ canceled: true, filePath: null as string | null })
  };

  const shellMock = {
    openPath: vi.fn().mockResolvedValue('')
  };

  const llmServiceMock = {
    checkStatus: vi.fn().mockResolvedValue({}),
    getAvailableModels: vi.fn().mockResolvedValue([]),
    setModel: vi.fn(),
    setConfig: vi.fn(),
    query: vi.fn().mockResolvedValue({ content: 'ok' })
  };

  const dbServiceMock = {
    initialize: vi.fn().mockResolvedValue(undefined),
    close: vi.fn(),
    getAllUsers: vi.fn().mockReturnValue([]),
    createUser: vi.fn().mockReturnValue({ id: 'user-1' }),
    updateUser: vi.fn(),
    getUser: vi.fn().mockReturnValue(null),
    createInterview: vi.fn().mockReturnValue({ id: 'iv-1', user_id: 'user-1', tax_year: 2025, responses: {} }),
    getInterview: vi.fn().mockReturnValue(null),
    updateInterviewResponses: vi.fn(),
    updateInterviewStatus: vi.fn(),
    getDocumentsByUser: vi.fn().mockReturnValue([]),
    getFormsByInterview: vi.fn().mockReturnValue([]),
    createForm: vi.fn(),
    getLatestCalculation: vi.fn().mockReturnValue(null),
    createCalculation: vi.fn(),
    getInterviewsByUser: vi.fn().mockReturnValue([]),
    getExpensesByUser: vi.fn().mockReturnValue([])
  };

  const interviewerAgentMock = {
    startInterview: vi.fn().mockReturnValue({ message: 'start', nextQuestion: 'q1' }),
    processResponse: vi.fn().mockResolvedValue({
      message: 'next',
      nextQuestion: 'q2',
      isComplete: false,
      validationError: null
    }),
    getResponses: vi.fn().mockReturnValue({}),
    restoreContext: vi.fn()
  };

  const analyzerAgentMock = {
    calculateTax: vi.fn().mockResolvedValue({
      grossIncome: 0,
      effectiveDeductions: 0,
      estimatedRefund: 0
    })
  };

  const formGeneratorMock = {
    generateL1: vi.fn().mockResolvedValue({ pdfPath: '', jsonData: {} }),
    generateL1ab: vi.fn().mockResolvedValue({ pdfPath: '', jsonData: {} }),
    generateL1k: vi.fn().mockResolvedValue({ pdfPath: '', jsonData: {} })
  };

  const guideGeneratorMock = {
    generateGuide: vi.fn().mockResolvedValue({}),
    exportAsMarkdown: vi.fn().mockReturnValue(''),
    exportAsPDF: vi.fn().mockResolvedValue('')
  };

  const documentInspectorAgentMock = {
    processDocument: vi.fn(),
    terminate: vi.fn()
  };

  const retrieverMock = {
    query: vi.fn().mockResolvedValue({})
  };

  const knowledgeBaseMock = {
    initialize: vi.fn().mockResolvedValue(undefined),
    search: vi.fn().mockResolvedValue([])
  };

  const getTaxRuleStatusMock = vi.fn((year: number) => ({
    year,
    state: currentState,
    message: `state=${currentState}`
  }));

  vi.doMock('electron', () => ({
    ipcMain: {
      handle: vi.fn((channel: string, handler: IpcHandler) => {
        handlers.set(channel, handler);
      })
    },
    app: {
      getVersion: vi.fn().mockReturnValue('1.0.0-alpha'),
      getPath: vi.fn().mockImplementation(() => userDataDir)
    },
    dialog: dialogMock,
    shell: shellMock,
    BrowserWindow: {
      getFocusedWindow: vi.fn().mockReturnValue(null)
    },
    safeStorage: {
      isEncryptionAvailable: vi.fn().mockReturnValue(true),
      encryptString: vi.fn().mockImplementation((value: string) => Buffer.from(value, 'utf8')),
      decryptString: vi.fn().mockImplementation((value: Buffer) => value.toString('utf8'))
    }
  }));

  vi.doMock('../../src/main/utils/logger', () => ({
    logger: {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }
  }));

  vi.doMock('../../src/backend/services/llmService', () => ({ llmService: llmServiceMock }));
  vi.doMock('../../src/backend/services/dbService', () => ({ dbService: dbServiceMock }));
  vi.doMock('../../src/backend/services/ocrService', () => ({
    ocrService: { terminate: vi.fn() }
  }));
  vi.doMock('../../src/backend/services/documentOrganizer', () => ({
    documentOrganizer: { buildManifest: vi.fn().mockResolvedValue({}) }
  }));
  vi.doMock('../../src/backend/services/formGenerator', () => ({ formGenerator: formGeneratorMock }));
  vi.doMock('../../src/backend/services/guideGenerator', () => ({ guideGenerator: guideGeneratorMock }));
  vi.doMock('../../src/backend/agents/interviewerAgent', () => ({ interviewerAgent: interviewerAgentMock }));
  vi.doMock('../../src/backend/agents/documentInspectorAgent', () => ({
    documentInspectorAgent: documentInspectorAgentMock
  }));
  vi.doMock('../../src/backend/agents/analyzerAgent', () => ({ analyzerAgent: analyzerAgentMock }));
  vi.doMock('../../src/backend/rag/knowledgeBase', () => ({ knowledgeBase: knowledgeBaseMock }));
  vi.doMock('../../src/backend/rag/retriever', () => ({ retriever: retrieverMock }));
  vi.doMock('../../src/backend/utils/validation', () => ({
    sanitizeUserInput: (value: string) => value
  }));
  vi.doMock('../../src/backend/taxRules', () => ({
    getTaxRulesForYear: vi.fn().mockReturnValue({
      year: 2025,
      homeOffice: { perDay: 3, maxAmount: 300 }
    }),
    listSupportedTaxRuleYears: vi.fn().mockReturnValue([2024, 2025, 2026]),
    getAllTaxRuleStatuses: vi.fn().mockReturnValue([]),
    getTaxRuleStatus: getTaxRuleStatusMock
  }));

  const { registerIpcHandlers } = await import('../../src/main/ipcHandlers');
  registerIpcHandlers();

  const invoke = async (channel: string, ...args: unknown[]) => {
    const handler = handlers.get(channel);
    if (!handler) {
      throw new Error(`Missing IPC handler for channel ${channel}`);
    }
    return handler({}, ...args);
  };

  return {
    invoke,
    setTaxRuleState: (nextState: TaxRuleState) => {
      currentState = nextState;
    },
    mocks: {
      getTaxRuleStatusMock,
      analyzerAgentMock,
      formGeneratorMock,
      guideGeneratorMock,
      documentInspectorAgentMock,
      retrieverMock,
      knowledgeBaseMock,
      dialogMock,
      shellMock
    }
  };
};

describe('IPC handlers integration', () => {
  afterEach(() => {
    cleanupTempDirs();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('rejects invalid forms:generate payloads', async () => {
    const harness = await setupIpcHarness('ok');

    await expect(harness.invoke('forms:generate', 'INVALID')).rejects.toThrow(
      /Invalid forms:generate payload/
    );
  });

  it('rejects invalid interview:continue payloads', async () => {
    const harness = await setupIpcHarness('ok');

    await expect(harness.invoke('interview:continue', '   ')).rejects.toThrow(
      /Invalid interview:continue payload/
    );
  });

  it('rejects invalid taxRules:getStatus payloads', async () => {
    const harness = await setupIpcHarness('ok');

    await expect(harness.invoke('taxRules:getStatus', 1900)).rejects.toThrow(
      /Invalid taxRules:getStatus year/
    );
  });

  it('rejects invalid settings payloads', async () => {
    const harness = await setupIpcHarness('ok');

    await expect(harness.invoke('settings:get', '   ')).rejects.toThrow(
      /Invalid settings:get key/
    );
    await expect(harness.invoke('settings:set', '   ', 'value')).rejects.toThrow(
      /Invalid settings:set key/
    );
    await expect(harness.invoke('settings:set', 'currentTaxYear', '2025')).rejects.toThrow(
      /Invalid currentTaxYear setting/
    );
  });

  it('rejects invalid apiKeys payloads', async () => {
    const harness = await setupIpcHarness('ok');

    await expect(harness.invoke('apiKeys:get', 'invalidKey')).rejects.toThrow(
      /Invalid apiKeys:get keyName/
    );
    await expect(harness.invoke('apiKeys:set', 'invalidKey', 'secret')).rejects.toThrow(
      /Invalid apiKeys:set keyName/
    );
    await expect(harness.invoke('apiKeys:set', 'openaiApiKey', 'a'.repeat(5001))).rejects.toThrow(
      /Invalid apiKeys:set value/
    );
  });

  it('rejects invalid fs payloads', async () => {
    const harness = await setupIpcHarness('ok');

    await expect(harness.invoke('fs:openPath', '   ')).rejects.toThrow(
      /Invalid fs:openPath payload/
    );
    await expect(harness.invoke('fs:selectFiles', [{ name: '', extensions: ['pdf'] }])).rejects.toThrow(
      /Invalid fs:selectFiles filters/
    );
    await expect(harness.invoke('fs:saveFile', '   ')).rejects.toThrow(
      /Invalid fs:saveFile payload/
    );
  });

  it('rejects invalid documents payloads', async () => {
    const harness = await setupIpcHarness('ok');

    await expect(harness.invoke('documents:upload', [])).rejects.toThrow(
      /Invalid documents:upload payload/
    );
    await expect(harness.invoke('documents:process', '   ')).rejects.toThrow(
      /Invalid documents:process payload/
    );

    expect(harness.mocks.documentInspectorAgentMock.processDocument).not.toHaveBeenCalled();
  });

  it('rejects invalid rag payloads', async () => {
    const harness = await setupIpcHarness('ok');

    await expect(harness.invoke('rag:query', '   ')).rejects.toThrow(
      /Invalid rag:query payload/
    );
    await expect(harness.invoke('rag:query', 'question', undefined, 1900)).rejects.toThrow(
      /Invalid rag:query payload/
    );
    await expect(harness.invoke('rag:search', '   ')).rejects.toThrow(
      /Invalid rag:search query/
    );

    expect(harness.mocks.retrieverMock.query).not.toHaveBeenCalled();
    expect(harness.mocks.knowledgeBaseMock.search).not.toHaveBeenCalled();
  });

  it('resets current tax year to fallback after settings:reset', async () => {
    const harness = await setupIpcHarness('ok');
    await harness.invoke('settings:set', 'currentTaxYear', 2024);

    harness.mocks.getTaxRuleStatusMock.mockClear();
    await harness.invoke('settings:reset');
    await harness.invoke('taxRules:getStatus');

    expect(harness.mocks.getTaxRuleStatusMock).toHaveBeenCalledWith(new Date().getFullYear() - 1);
  });

  it('persists and reads settings with valid payloads', async () => {
    const harness = await setupIpcHarness('ok');

    await harness.invoke('settings:set', 'uiLanguage', 'de');
    await harness.invoke('settings:set', 'currentTaxYear', 2026);

    await expect(harness.invoke('settings:get', 'uiLanguage')).resolves.toBe('de');
    await expect(harness.invoke('settings:getAll')).resolves.toMatchObject({
      uiLanguage: 'de',
      currentTaxYear: 2026
    });

    expect(harness.mocks.knowledgeBaseMock.initialize).toHaveBeenCalledWith(2026);
  });

  it('stores api keys encrypted and exposes masked values', async () => {
    const harness = await setupIpcHarness('ok');
    const key = 'sk-1234567890abcdef';

    await harness.invoke('apiKeys:set', 'openaiApiKey', key);
    await expect(harness.invoke('apiKeys:get', 'openaiApiKey')).resolves.toBe(key);

    const all = await harness.invoke('apiKeys:getAll') as Record<string, string>;
    expect(all.openaiApiKey).toBe('sk-123...cdef');
    expect(all._storageMode).toBe('encrypted');
  });

  it('handles valid fs operations', async () => {
    const harness = await setupIpcHarness('ok');
    const expectedSavePath = 'C:\\tmp\\tax-guide.pdf';
    const expectedOpenPath = 'C:\\tmp\\open-me.pdf';

    harness.mocks.dialogMock.showSaveDialog.mockResolvedValueOnce({
      canceled: false,
      filePath: expectedSavePath
    });
    harness.mocks.dialogMock.showOpenDialog.mockResolvedValueOnce({
      canceled: false,
      filePaths: ['C:\\tmp\\a.pdf', 'C:\\tmp\\b.pdf']
    });

    await expect(harness.invoke('fs:saveFile', 'guide.pdf')).resolves.toBe(expectedSavePath);
    await expect(harness.invoke('fs:selectFiles')).resolves.toEqual(['C:\\tmp\\a.pdf', 'C:\\tmp\\b.pdf']);
    await harness.invoke('fs:openPath', expectedOpenPath);

    expect(harness.mocks.shellMock.openPath).toHaveBeenCalledWith(expectedOpenPath);
  });

  it('processes valid documents payloads', async () => {
    const harness = await setupIpcHarness('ok');
    const filePath = 'C:\\tmp\\receipt.pdf';

    harness.mocks.documentInspectorAgentMock.processDocument.mockResolvedValueOnce({
      id: 'doc-1',
      filePath,
      classification: {
        category: 'Werbungskosten',
        subcategory: 'Arbeitsmittel'
      },
      extractedData: {},
      ocrResult: {
        confidence: 0.98
      }
    });

    const uploaded = await harness.invoke('documents:upload', [filePath]) as Array<Record<string, unknown>>;
    const processed = await harness.invoke('documents:process', 'doc-1') as Record<string, unknown>;

    expect(uploaded).toHaveLength(1);
    expect(uploaded[0].status).toBe('processed');
    expect(processed).toMatchObject({ id: 'doc-1', status: 'processed' });
    expect(harness.mocks.documentInspectorAgentMock.processDocument).toHaveBeenCalledWith(filePath);
  });

  it('handles valid rag query and search payloads', async () => {
    const harness = await setupIpcHarness('ok');

    harness.mocks.retrieverMock.query.mockResolvedValueOnce({
      answer: 'ok',
      sources: []
    });
    harness.mocks.knowledgeBaseMock.search.mockResolvedValueOnce([
      {
        chunk: {
          metadata: { title: 'Pendlerpauschale' },
          content: 'Inhalt'
        },
        document: {
          source: 'BMF'
        },
        similarity: 0.91
      }
    ]);

    const ragResult = await harness.invoke('rag:query', 'Was gilt fuer Pendler?', 'allgemein', 2026);
    const searchResult = await harness.invoke('rag:search', 'Pendlerpauschale', 3);

    expect(ragResult).toMatchObject({ answer: 'ok' });
    expect(harness.mocks.retrieverMock.query).toHaveBeenCalledWith(
      expect.objectContaining({
        question: 'Was gilt fuer Pendler?',
        category: 'allgemein',
        taxYear: 2026,
        includeSourceCitations: true
      })
    );
    expect(searchResult).toEqual([
      {
        title: 'Pendlerpauschale',
        content: 'Inhalt',
        source: 'BMF',
        similarity: 0.91
      }
    ]);
  });

  it('returns valid taxRules diagnostics payloads', async () => {
    const harness = await setupIpcHarness('ok');

    await expect(harness.invoke('taxRules:getSupportedYears')).resolves.toEqual([2024, 2025, 2026]);
    await expect(harness.invoke('taxRules:getStatus', 2025)).resolves.toMatchObject({
      year: 2025,
      state: 'ok'
    });
    await expect(harness.invoke('taxRules:getDiagnostics')).resolves.toEqual([]);
  });

  it('runs tax-critical operations when rules are ok', async () => {
    const harness = await setupIpcHarness('ok');
    await harness.invoke('settings:set', 'currentTaxYear', 2025);

    await expect(harness.invoke('analysis:calculate')).resolves.toMatchObject({
      grossIncome: 0
    });
    await expect(harness.invoke('forms:generate', 'L1')).resolves.toBe('');
    await expect(harness.invoke('guide:generate')).resolves.toBe('');

    expect(harness.mocks.analyzerAgentMock.calculateTax).toHaveBeenCalled();
    expect(harness.mocks.formGeneratorMock.generateL1).toHaveBeenCalled();
    expect(harness.mocks.guideGeneratorMock.generateGuide).toHaveBeenCalled();
  });

  it('blocks tax-critical operations when rules are stale', async () => {
    const harness = await setupIpcHarness('stale');
    await harness.invoke('settings:set', 'currentTaxYear', 2025);

    await expect(harness.invoke('analysis:calculate')).rejects.toThrow(
      /nicht bereit \(stale\).*analysis:calculate/
    );
    await expect(harness.invoke('forms:generate', 'L1')).rejects.toThrow(
      /nicht bereit \(stale\).*forms:generate/
    );
    await expect(harness.invoke('guide:generate')).rejects.toThrow(
      /nicht bereit \(stale\).*guide:generate/
    );

    expect(harness.mocks.analyzerAgentMock.calculateTax).not.toHaveBeenCalled();
    expect(harness.mocks.formGeneratorMock.generateL1).not.toHaveBeenCalled();
    expect(harness.mocks.guideGeneratorMock.generateGuide).not.toHaveBeenCalled();
  });

  it('blocks forms generation when rules are missing', async () => {
    const harness = await setupIpcHarness('ok');
    harness.setTaxRuleState('missing');
    await harness.invoke('settings:set', 'currentTaxYear', 2025);

    await expect(harness.invoke('forms:generate', 'L1')).rejects.toThrow(
      /nicht bereit \(missing\).*forms:generate/
    );
    expect(harness.mocks.getTaxRuleStatusMock).toHaveBeenCalledWith(2025);
  });
});
