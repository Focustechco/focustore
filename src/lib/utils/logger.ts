type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogContext {
  requestId?: string;
  userId?: string;
  orderId?: string;
  action?: string;
  [key: string]: unknown;
}

const SENSITIVE_KEYS = ['password', 'passwordHash', 'token', 'cvv', 'cardNumber', 'secret', 'apiKey'];

function sanitize(data: unknown): unknown {
  if (typeof data !== 'object' || data === null) return data;
  if (Array.isArray(data)) return data.map(sanitize);

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitize(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export const logger = {
  log(level: LogLevel, message: string, context?: LogContext) {
    const entry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
      context: context ? sanitize(context) : undefined,
    };
    if (level === 'error') {
      console.error(JSON.stringify(entry));
    } else if (level === 'warn') {
      console.warn(JSON.stringify(entry));
    } else {
      console.log(JSON.stringify(entry));
    }
  },
  info(message: string, context?: LogContext) {
    this.log('info', message, context);
  },
  warn(message: string, context?: LogContext) {
    this.log('warn', message, context);
  },
  error(message: string, context?: LogContext) {
    this.log('error', message, context);
  },
};
