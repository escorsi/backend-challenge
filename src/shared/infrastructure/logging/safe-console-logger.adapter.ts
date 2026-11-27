import { Inject, Injectable } from '@nestjs/common';

import type {
  ApplicationLogger,
  ApplicationLoggerFactory,
} from '../../application/ports/application-logger.port';
import {
  REQUEST_CONTEXT,
  type RequestContext,
} from '../request-context/request-context.port';

const SENSITIVE_ASSIGNMENT_PATTERN =
  /\b(password|passphrase|secret|token|authorization|cookie|api[_-]?key)\b(\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const BEARER_TOKEN_PATTERN = /\bBearer\s+[A-Z0-9._~+/-]+=*/gi;
const LONG_TOKEN_PATTERN = /\b[A-Z0-9_-]{32,}\b/gi;

@Injectable()
export class SafeConsoleLoggerAdapter implements ApplicationLoggerFactory {
  constructor(
    @Inject(REQUEST_CONTEXT)
    private readonly requestContext: RequestContext,
  ) {}

  create(context: string): ApplicationLogger {
    return new ContextLogger(
      this.sanitizeContext(context),
      this.requestContext,
    );
  }

  private sanitizeContext(context: string): string {
    return (
      context.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 64) || 'Application'
    );
  }
}

class ContextLogger implements ApplicationLogger {
  constructor(
    private readonly context: string,
    private readonly requestContext: RequestContext,
  ) {}

  info(message: string): void {
    this.write('info', message);
  }

  warn(message: string): void {
    this.write('warn', message);
  }

  error(message: string): void {
    this.write('error', message);
  }

  private write(level: 'info' | 'warn' | 'error', message: string): void {
    const requestId = this.requestContext.getRequestId();

    const record = {
      timestamp: new Date().toISOString(),
      level,
      context: this.context,
      message: this.sanitizeMessage(message),
      ...(this.isSafeRequestId(requestId) ? { requestId } : {}),
    };

    try {
      process.stdout.write(`${JSON.stringify(record)}\n`);
    } catch {
      return;
    }
  }

  private sanitizeMessage(message: string): string {
    let withoutControlCharacters = '';

    for (const character of message) {
      const codePoint = character.codePointAt(0) ?? 0;
      const isControlCharacter =
        codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f);

      withoutControlCharacters += isControlCharacter ? ' ' : character;
    }

    return withoutControlCharacters
      .replace(SENSITIVE_ASSIGNMENT_PATTERN, '$1$2[REDACTED]')
      .replace(BEARER_TOKEN_PATTERN, 'Bearer [REDACTED]')
      .replace(EMAIL_PATTERN, '[REDACTED_EMAIL]')
      .replace(LONG_TOKEN_PATTERN, '[REDACTED]')
      .slice(0, 240);
  }

  private isSafeRequestId(requestId: string | undefined): requestId is string {
    return (
      typeof requestId === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(requestId)
    );
  }
}
