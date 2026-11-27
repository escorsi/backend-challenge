import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';

import { InvalidProductCursorError } from '@/products/application/errors/invalid-product-cursor.error';
import type { ProductCursorCodec } from '@/products/application/ports/product-cursor-codec.port';

@Injectable()
export class SignedProductCursorCodecAdapter implements ProductCursorCodec {
  private readonly secret: string;

  constructor(configService: ConfigService) {
    this.secret = configService.getOrThrow<string>('CURSOR_SECRET');
  }

  encode<T>(payload: T): string {
    const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = this.sign(data);
    return `${data}.${signature}`;
  }

  decode<T>(cursor: string): T {
    const [data, signature, ...extra] = cursor.split('.');

    if (!data || !signature || extra.length > 0) {
      throw new InvalidProductCursorError();
    }

    const expectedSignature = this.sign(data);
    const receivedBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (
      receivedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(receivedBuffer, expectedBuffer)
    ) {
      throw new InvalidProductCursorError();
    }

    try {
      return JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as T;
    } catch {
      throw new InvalidProductCursorError();
    }
  }

  private sign(data: string): string {
    return createHmac('sha256', this.secret).update(data).digest('base64url');
  }
}
