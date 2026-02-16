/**
 * TaxLogic.local - Logger Utility
 *
 * Structured logger with automatic redaction for sensitive payloads.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: unknown;
}

const REDACTED = '[REDACTED]';
const SENSITIVE_KEY_PATTERN = /(key|token|secret|password|input|path)/i;

class Logger {
  private isDevelopment: boolean;
  private logLevel: LogLevel;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.logLevel = this.isDevelopment ? 'debug' : 'info';
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.logLevel);
  }

  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private formatMessage(level: LogLevel, message: string, data?: unknown): LogEntry {
    return {
      timestamp: this.formatTimestamp(),
      level,
      message,
      data
    };
  }

  private colorize(level: LogLevel, text: string): string {
    const colors: Record<LogLevel, string> = {
      debug: '\x1b[36m',
      info: '\x1b[32m',
      warn: '\x1b[33m',
      error: '\x1b[31m'
    };
    const reset = '\x1b[0m';
    return `${colors[level]}${text}${reset}`;
  }

  private redactString(value: string): string {
    if (value.length > 256) {
      return `${value.slice(0, 16)}...[TRUNCATED]`;
    }

    // Common API key prefixes and token-like values
    if (
      /^sk-[a-z0-9_-]+/i.test(value) ||
      /^sk-ant-/i.test(value) ||
      /^AIza[a-z0-9_-]+/i.test(value)
    ) {
      return REDACTED;
    }

    // Basic absolute path redaction
    if (/^[a-zA-Z]:\\/.test(value) || value.startsWith('/')) {
      return '[PATH_REDACTED]';
    }

    return value;
  }

  private redactValue(value: unknown, keyHint?: string, depth: number = 0): unknown {
    if (depth > 6) {
      return '[MAX_DEPTH]';
    }

    if (typeof keyHint === 'string' && SENSITIVE_KEY_PATTERN.test(keyHint)) {
      return REDACTED;
    }

    if (typeof value === 'string') {
      return this.redactString(value);
    }

    if (typeof value !== 'object' || value === null) {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.redactValue(item, keyHint, depth + 1));
    }

    const redacted: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      redacted[key] = this.redactValue(nestedValue, key, depth + 1);
    }

    return redacted;
  }

  private sanitizeArgs(args: unknown[]): unknown[] {
    return args.map((arg) => this.redactValue(arg));
  }

  private log(level: LogLevel, message: string, ...args: unknown[]): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const safeArgs = this.sanitizeArgs(args);
    const entry = this.formatMessage(level, message, safeArgs.length > 0 ? safeArgs : undefined);
    const prefix = this.colorize(level, `[${entry.timestamp}] [${level.toUpperCase()}]`);

    try {
      switch (level) {
        case 'debug':
          console.debug(prefix, message, ...safeArgs);
          break;
        case 'info':
          console.info(prefix, message, ...safeArgs);
          break;
        case 'warn':
          console.warn(prefix, message, ...safeArgs);
          break;
        case 'error':
          console.error(prefix, message, ...safeArgs);
          break;
      }
    } catch {
      // Swallow stream write errors to avoid crash loops
    }
  }

  debug(message: string, ...args: unknown[]): void {
    this.log('debug', message, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    this.log('info', message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.log('warn', message, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    this.log('error', message, ...args);
  }

  /**
   * Log a function call with timing
   */
  async time<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = (performance.now() - start).toFixed(2);
      this.debug(`${label} completed in ${duration}ms`);
      return result;
    } catch (error) {
      const duration = (performance.now() - start).toFixed(2);
      this.error(`${label} failed after ${duration}ms`, error);
      throw error;
    }
  }

  /**
   * Set the minimum log level
   */
  setLevel(level: LogLevel): void {
    this.logLevel = level;
  }
}

export const logger = new Logger();
