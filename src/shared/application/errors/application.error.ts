import type { ApplicationErrorCode } from './application-error-code.enum';

export abstract class ApplicationError extends Error {
  protected constructor(
    readonly code: ApplicationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}
