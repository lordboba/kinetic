/**
 * Frontend logger utility
 *
 * Provides structured logging with consistent formatting.
 * Can be easily replaced with a proper logging library later.
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private prefix: string;
  private isDevelopment: boolean;

  constructor(prefix: string = '') {
    this.prefix = prefix;
    this.isDevelopment = process.env.NODE_ENV !== 'production';
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): void {
    const timestamp = new Date().toISOString();
    const prefix = this.prefix ? `[${this.prefix}]` : '';

    if (context && Object.keys(context).length > 0) {
      // eslint-disable-next-line no-console
      console[level === 'debug' ? 'log' : level](
        `${timestamp} ${prefix} ${message}`,
        context
      );
    } else {
      // eslint-disable-next-line no-console
      console[level === 'debug' ? 'log' : level](
        `${timestamp} ${prefix} ${message}`
      );
    }
  }

  info(message: string, context?: LogContext): void {
    this.formatMessage('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.formatMessage('warn', message, context);
  }

  error(message: string, context?: LogContext): void {
    this.formatMessage('error', message, context);
  }

  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      this.formatMessage('debug', message, context);
    }
  }
}

/**
 * Create a logger instance with a specific prefix
 */
export function createLogger(prefix: string): Logger {
  return new Logger(prefix);
}

/**
 * Default logger instance
 */
export const logger = new Logger();
