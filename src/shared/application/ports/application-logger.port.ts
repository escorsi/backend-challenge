export const APPLICATION_LOGGER_FACTORY = Symbol('APPLICATION_LOGGER_FACTORY');

export interface ApplicationLogger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export interface ApplicationLoggerFactory {
  create(context: string): ApplicationLogger;
}
