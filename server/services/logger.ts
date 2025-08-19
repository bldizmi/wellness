/**
 * FAANG-Level Structured Logging Service
 * Replaces console.log with production-grade logging for observability
 * 
 * Features:
 * - JSON structured logging for log aggregation
 * - Log levels (error, warn, info, debug, verbose)
 * - Daily log rotation with retention
 * - Performance metrics tracking
 * - Development vs production configurations
 * - Request correlation IDs
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

// Log levels for different environments
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  verbose: 4,
};

// Create logger instance
const logger = winston.createLogger({
  levels: LOG_LEVELS,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'minddouble-api',
    environment: process.env.NODE_ENV || 'development',
  },
  transports: [],
});

// Console transport for development
if (process.env.NODE_ENV === 'development') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
      winston.format.printf(({ level, message, timestamp, ...meta }) => {
        const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
        return `${timestamp} [${level}]: ${message} ${metaStr}`;
      })
    ),
    level: 'debug',
  }));
} else {
  // Production: Console with JSON format
  logger.add(new winston.transports.Console({
    format: winston.format.json(),
    level: 'info',
  }));
}

// File transport for all environments
logger.add(new DailyRotateFile({
  filename: 'logs/application-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
  format: winston.format.json(),
  level: 'info',
}));

// Error log file
logger.add(new DailyRotateFile({
  filename: 'logs/error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d',
  format: winston.format.json(),
  level: 'error',
}));

// Performance metrics logger
const performanceLogger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new DailyRotateFile({
      filename: 'logs/performance-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '7d',
      format: winston.format.json(),
    }),
  ],
});

// Audit logger for security events
const auditLogger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new DailyRotateFile({
      filename: 'logs/audit-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '90d',
      format: winston.format.json(),
    }),
  ],
});

// Database query logger for performance monitoring
const queryLogger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new DailyRotateFile({
      filename: 'logs/queries-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '7d',
      format: winston.format.json(),
    }),
  ],
});

/**
 * Structured logging interface replacing console.log
 */
export class Logger {
  private correlationId?: string;
  private userId?: string;
  private requestPath?: string;

  constructor(context?: { correlationId?: string; userId?: string; requestPath?: string }) {
    this.correlationId = context?.correlationId;
    this.userId = context?.userId;
    this.requestPath = context?.requestPath;
  }

  private getMeta(additionalMeta?: Record<string, any>) {
    return {
      ...additionalMeta,
      correlationId: this.correlationId,
      userId: this.userId,
      requestPath: this.requestPath,
    };
  }

  // Standard log levels
  error(message: string, meta?: Record<string, any>) {
    logger.error(message, this.getMeta(meta));
  }

  warn(message: string, meta?: Record<string, any>) {
    logger.warn(message, this.getMeta(meta));
  }

  info(message: string, meta?: Record<string, any>) {
    logger.info(message, this.getMeta(meta));
  }

  debug(message: string, meta?: Record<string, any>) {
    logger.debug(message, this.getMeta(meta));
  }

  verbose(message: string, meta?: Record<string, any>) {
    logger.verbose(message, this.getMeta(meta));
  }

  // Specialized logging methods
  
  /**
   * Log API request/response performance
   */
  performance(operation: string, durationMs: number, meta?: Record<string, any>) {
    const logData = {
      operation,
      duration_ms: durationMs,
      timestamp: new Date().toISOString(),
      ...this.getMeta(meta),
    };
    
    performanceLogger.info('performance_metric', logData);
    
    // Also log to main logger if over threshold
    if (durationMs > 1000) {
      this.warn(`Slow operation: ${operation} took ${durationMs}ms`, meta);
    }
  }

  /**
   * Log database queries with performance metrics
   */
  query(query: string, durationMs: number, meta?: Record<string, any>) {
    const logData = {
      query_type: 'database',
      query: query.replace(/\s+/g, ' ').trim(),
      duration_ms: durationMs,
      timestamp: new Date().toISOString(),
      ...this.getMeta(meta),
    };
    
    queryLogger.info('database_query', logData);
    
    // Log slow queries to main logger
    if (durationMs > 100) {
      this.warn(`Slow query: ${durationMs}ms`, { query: query.substring(0, 100) + '...' });
    }
  }

  /**
   * Log security and audit events
   */
  audit(event: string, meta?: Record<string, any>) {
    const logData = {
      event,
      timestamp: new Date().toISOString(),
      ...this.getMeta(meta),
    };
    
    auditLogger.info('audit_event', logData);
    this.info(`Audit: ${event}`, meta);
  }

  /**
   * Log user authentication events
   */
  auth(event: string, meta?: Record<string, any>) {
    this.audit(`auth_${event}`, meta);
  }

  /**
   * Log cache operations
   */
  cache(operation: string, key: string, hit: boolean, meta?: Record<string, any>) {
    this.debug(`Cache ${operation}: ${key} (${hit ? 'HIT' : 'MISS'})`, meta);
  }

  /**
   * Log recurring item operations
   */
  recurring(operation: string, itemId: string, meta?: Record<string, any>) {
    this.debug(`Recurring ${operation}: ${itemId}`, meta);
  }

  /**
   * Log API endpoint calls
   */
  api(method: string, path: string, statusCode: number, durationMs: number, meta?: Record<string, any>) {
    const logData = {
      http_method: method,
      path,
      status_code: statusCode,
      duration_ms: durationMs,
      ...meta,
    };
    
    this.performance(`${method} ${path}`, durationMs, logData);
    
    if (statusCode >= 400) {
      this.warn(`API Error: ${method} ${path} returned ${statusCode}`, logData);
    }
  }
}

// Default logger instance
export const log = new Logger();

// Create logger with context
export const createLogger = (context?: { correlationId?: string; userId?: string; requestPath?: string }) => {
  return new Logger(context);
};

// Performance timing utility
export const measurePerformance = <T>(operation: string, fn: () => T, logger?: Logger): T => {
  const start = Date.now();
  const result = fn();
  const duration = Date.now() - start;
  
  (logger || log).performance(operation, duration);
  
  return result;
};

// Async performance timing utility
export const measurePerformanceAsync = async <T>(
  operation: string, 
  fn: () => Promise<T>, 
  logger?: Logger
): Promise<T> => {
  const start = Date.now();
  const result = await fn();
  const duration = Date.now() - start;
  
  (logger || log).performance(operation, duration);
  
  return result;
};

export default logger;