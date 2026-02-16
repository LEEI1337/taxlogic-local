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
    dialog: {
      showOpenDialog: vi.fn().mockResolvedValue({ canceled: true, filePaths: [] }),
      showSaveDialog: vi.fn().mockResolvedValue({ canceled: true, filePath: null })
    },
    shell: {
      openPath: vi.fn().mockResolvedValue('')
    },
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
    documentInspectorAgent: {
      processDocument: vi.fn(),
      terminate: vi.fn()
    }
  }));
  vi.doMock('../../src/backend/agents/analyzerAgent', () => ({ analyzerAgent: analyzerAgentMock }));
  vi.doMock('../../src/backend/rag/knowledgeBase', () => ({ knowledgeBase: knowledgeBaseMock }));
  vi.doMock('../../src/backend/rag/retriever', () => ({
    retriever: { query: vi.fn().mockResolvedValue({}) }
  }));
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
      guideGeneratorMock
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

    await expect(harness.invoke('settings:set', '   ', 'value')).rejects.toThrow(
      /Invalid settings:set key/
    );
    await expect(harness.invoke('settings:set', 'currentTaxYear', '2025')).rejects.toThrow(
      /Invalid currentTaxYear setting/
    );
  });

  it('rejects invalid apiKeys payloads', async () => {
    const harness = await setupIpcHarness('ok');

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
