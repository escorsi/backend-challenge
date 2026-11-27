import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateProductService } from './create-product.service';
import type { ProductsWriterPort } from '@/products/application/ports/products-writer.port';
import { ProductStatus } from '@/products/domain/enums/product-status.enum';
import type { Clock } from '@/shared/application/ports/clock.port';
import type { IdGenerator } from '@/shared/application/ports/id-generator.port';
import type {
  ApplicationLogger,
  ApplicationLoggerFactory,
} from '@/shared/application/ports/application-logger.port';

describe('CreateProductService', () => {
  let service: CreateProductService;
  let writer: ProductsWriterPort;
  let idGenerator: IdGenerator;
  let clock: Clock;
  let logger: ApplicationLogger;
  let loggerFactory: ApplicationLoggerFactory;

  beforeEach(() => {
    writer = {
      create: vi.fn(),
    };
    idGenerator = { generate: vi.fn().mockReturnValue('product-id') };
    clock = {
      now: vi.fn().mockReturnValue(new Date('2026-11-26T12:00:00.000Z')),
    };
    logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    loggerFactory = { create: vi.fn().mockReturnValue(logger) };
    service = new CreateProductService(
      writer,
      idGenerator,
      clock,
      loggerFactory,
    );
  });

  it('creates active products with a generated id and creation timestamp', async () => {
    const params = {
      name: 'Headphones',
      description: 'Wireless',
      priceInCents: 5990,
    };
    vi.mocked(writer.create).mockImplementation(async (product) => product);

    const result = await service.execute(params);
    expect(writer.create).toHaveBeenCalledWith({
      ...params,
      id: 'product-id',
      status: ProductStatus.ACTIVE,
      createdAt: '2026-11-26T12:00:00.000Z',
    });
    expect(result).toEqual({
      id: 'product-id',
      ...params,
      status: ProductStatus.ACTIVE,
      createdAt: '2026-11-26T12:00:00.000Z',
    });
    expect(loggerFactory.create).toHaveBeenCalledWith('CreateProductService');
    expect(logger.info).toHaveBeenCalledWith('Product created successfully');
    expect(JSON.stringify(vi.mocked(logger.info).mock.calls)).not.toContain(
      'Headphones',
    );
  });
});
