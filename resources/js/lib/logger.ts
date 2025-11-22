/**
 * Logger utility for WebSocket connections and app events
 * Provides different log levels and clean terminal output
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'success';

const env = typeof import.meta !== 'undefined' ? ((import.meta as any)?.env ?? {}) : {};
// Default: enable console and info level unless explicitly disabled via env
const consoleEnabled = env?.VITE_WS_LOG_CONSOLE !== 'false';
const defaultLevel: LogLevel = (env?.VITE_WS_LOG_LEVEL as LogLevel) || 'info';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: any;
}

class Logger {
  private static instance: Logger;
  // Default to very quiet unless explicitly enabled via env to avoid spamming dev server terminal
  private logLevel: LogLevel = defaultLevel;
  private enableConsole: boolean = consoleEnabled;
  private logStorage: LogEntry[] = [];
  private maxLogStorage: number = 1000;

  private constructor() {}

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  public setEnableConsole(enable: boolean): void {
    this.enableConsole = enable;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = { debug: 0, info: 1, warn: 2, error: 3, success: 1 };
    return levels[level] >= levels[this.logLevel];
  }

  private getColorForLevel(level: LogLevel): string {
    switch (level) {
      case 'debug': return '\x1b[90m'; // Gray
      case 'info': return '\x1b[36m'; // Cyan
      case 'warn': return '\x1b[33m'; // Yellow
      case 'error': return '\x1b[31m'; // Red
      case 'success': return '\x1b[32m'; // Green
      default: return '\x1b[0m';
    }
  }

  private getIconForLevel(level: LogLevel): string {
    switch (level) {
      case 'debug': return '🔍';
      case 'info': return 'ℹ️';
      case 'warn': return '⚠️';
      case 'error': return '❌';
      case 'success': return '✅';
      default: return '📝';
    }
  }

  private formatMessage(entry: LogEntry): string {
    const color = this.getColorForLevel(entry.level);
    const icon = this.getIconForLevel(entry.level);
    const reset = '\x1b[0m';

    const timestamp = entry.timestamp.split('T')[1]?.split('.')[0] || entry.timestamp;
    const category = entry.category.padEnd(12);

    let message = `${color}${icon} [${timestamp}] ${category} ${entry.message}${reset}`;

    if (entry.data) {
      message += `\n  ${JSON.stringify(entry.data, null, 2)}`;
    }

    return message;
  }

  private log(level: LogLevel, category: string, message: string, data?: any): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data
    };

    // Store log entry
    this.logStorage.push(entry);
    if (this.logStorage.length > this.maxLogStorage) {
      this.logStorage.shift();
    }

    // Console output (clean format)
    if (this.enableConsole) {
      console.log(this.formatMessage(entry));
    }
  }

  // Public logging methods
  public debug(category: string, message: string, data?: any): void {
    this.log('debug', category, message, data);
  }

  public info(category: string, message: string, data?: any): void {
    this.log('info', category, message, data);
  }

  public warn(category: string, message: string, data?: any): void {
    this.log('warn', category, message, data);
  }

  public error(category: string, message: string, data?: any): void {
    this.log('error', category, message, data);
  }

  public success(category: string, message: string, data?: any): void {
    this.log('success', category, message, data);
  }

  // WebSocket specific logging
  public websocketConnection(connectionId: string, status: 'connecting' | 'connected' | 'disconnected' | 'error', details?: any): void {
    const message = `WebSocket ${status}: ${connectionId}`;
    const level = status === 'error' ? 'error' : status === 'connected' ? 'success' : 'info';
    this.log(level, 'WS-CONN', message, details);
  }

  public websocketMessage(connectionId: string, type: string, direction: 'sent' | 'received'): void {
    const icon = direction === 'sent' ? '↑' : '↓';
    this.info('WS-MSG', `${icon} ${connectionId}: ${type}`);
  }

  public websocketError(connectionId: string, error: string, details?: any): void {
    this.error('WS-ERROR', `Connection ${connectionId}: ${error}`, details);
  }

  public websocketReconnect(connectionId: string, attempt: number, maxAttempts: number): void {
    this.warn('WS-RECONN', `Reconnecting ${connectionId} (${attempt}/${maxAttempts})`);
  }

  public websocketRoomAction(roomId: string, action: 'joined' | 'left' | 'message', userId?: string): void {
    const message = `Room ${action}: ${roomId}${userId ? ` by ${userId}` : ''}`;
    this.info('WS-ROOM', message);
  }

  // Utility methods
  public getLogs(level?: LogLevel, category?: string): LogEntry[] {
    let logs = [...this.logStorage];

    if (level) {
      logs = logs.filter(log => log.level === level);
    }

    if (category) {
      logs = logs.filter(log => log.category === category);
    }

    return logs;
  }

  public clearLogs(): void {
    this.logStorage = [];
  }

  public exportLogs(): string {
    return JSON.stringify(this.logStorage, null, 2);
  }

  // Status summary for terminal display
  public getWebSocketStatusSummary(): { connections: number; errors: number; lastActivity?: string } {
    const connectionLogs = this.logStorage.filter(log => log.category === 'WS-CONN');
    const errorLogs = this.logStorage.filter(log => log.category === 'WS-ERROR');

    const connections = connectionLogs.filter(log => log.message.includes('connected')).length -
                      connectionLogs.filter(log => log.message.includes('disconnected')).length;

    return {
      connections: Math.max(0, connections),
      errors: errorLogs.length,
      lastActivity: this.logStorage[this.logStorage.length - 1]?.timestamp
    };
  }
}

export const logger = Logger.getInstance();

// Export convenience functions
export const log = {
  debug: (category: string, message: string, data?: any) => logger.debug(category, message, data),
  info: (category: string, message: string, data?: any) => logger.info(category, message, data),
  warn: (category: string, message: string, data?: any) => logger.warn(category, message, data),
  error: (category: string, message: string, data?: any) => logger.error(category, message, data),
  success: (category: string, message: string, data?: any) => logger.success(category, message, data),

  // WebSocket shortcuts
  ws: {
    connection: (connectionId: string, status: 'connecting' | 'connected' | 'disconnected' | 'error', details?: any) =>
      logger.websocketConnection(connectionId, status, details),
    message: (connectionId: string, type: string, direction: 'sent' | 'received') =>
      logger.websocketMessage(connectionId, type, direction),
    error: (connectionId: string, error: string, details?: any) =>
      logger.websocketError(connectionId, error, details),
    reconnect: (connectionId: string, attempt: number, maxAttempts: number) =>
      logger.websocketReconnect(connectionId, attempt, maxAttempts),
    room: (roomId: string, action: 'joined' | 'left' | 'message', userId?: string) =>
      logger.websocketRoomAction(roomId, action, userId),
  }
};

export default logger;
