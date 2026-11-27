import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';

import { InvalidProductCursorError } from '../../application/errors/invalid-product-cursor.error';
import { SignedProductCursorCodecAdapter } from './signed-product-cursor-codec.adapter';

describe('SignedProductCursorCodecAdapter', () => {
  let adapter: SignedProductCursorCodecAdapter;
  const secret = 'test-cursor-secret-with-at-least-32-characters';

  beforeEach(() => {
    const configService = {
      getOrThrow: vi.fn<ConfigService['getOrThrow']>().mockReturnValue(secret),
    } as unknown as ConfigService;
    adapter = new SignedProductCursorCodecAdapter(configService);
  });

  it('round trips payloads using a signed opaque cursor', () => {
    const payload = { id: 'product-123', pageSize: 20 };
    const cursor = adapter.encode(payload);

    expect(cursor.split('.')).toHaveLength(2);
    expect(adapter.decode<typeof payload>(cursor)).toEqual(payload);
  });

  it.each([
    'malformed',
    'eyJpZCI6InByb2R1Y3QtMTIzIn0.invalid-signature',
    'bm90LXZhbGlkLWpzb24.signature',
  ])('rejects malformed or tampered cursor %s', (cursor) => {
    expect(() => adapter.decode(cursor)).toThrow(InvalidProductCursorError);
  });

  it('rejects content changes even when the original signature is retained', () => {
    const cursor = adapter.encode({ id: 'product-123', pageSize: 20 });
    const [, signature] = cursor.split('.');
    const changedData = Buffer.from(
      JSON.stringify({ id: 'product-123', pageSize: 100 }),
    ).toString('base64url');

    expect(() => adapter.decode(`${changedData}.${signature}`)).toThrow(
      InvalidProductCursorError,
    );
  });
});
