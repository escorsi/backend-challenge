import { ApplicationErrorCode } from '@/shared/application/errors/application-error-code.enum';
import { ApplicationError } from '@/shared/application/errors/application.error';

export class InvalidProductCursorError extends ApplicationError {
  constructor(message = 'Invalid cursor') {
    super(ApplicationErrorCode.INVALID_PRODUCT_CURSOR, message);
  }
}
