import { ApplicationErrorCode } from '../../../shared/application/errors/application-error-code.enum';
import { ApplicationError } from '../../../shared/application/errors/application.error';

export class InvalidCredentialsError extends ApplicationError {
  constructor() {
    super(ApplicationErrorCode.INVALID_CREDENTIALS, 'Invalid credentials');
  }
}
