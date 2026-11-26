import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FindProductsService } from './find-products.service';
import type { ProductsReaderPort } from '../../ports/products-reader.port';
import { ProductStatus } from '../../../domain/enums/product-status.enum';

describe('FindProductsService', () => {
  let service: FindProductsService;
  let reader: ProductsReaderPort;

  beforeEach(() => {
    reader = {
      findAll: vi.fn(),
    };
    service = new FindProductsService(reader);
  });

  it('forwards query parameters and preserves repository results', async () => {
    const params = {
      pageSize: 20,
      sortBy: 'createdAt' as const,
      sortOrder: 'desc' as const,
    };
    const pagination = { pageSize: 20, nextCursor: null, hasNextPage: false };
    vi.mocked(reader.findAll).mockResolvedValue({
      items: [
        {
          id: 'p1',
          name: 'Notebook',
          description: 'A notebook',
          priceInCents: 1200,
          status: ProductStatus.ACTIVE,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      pagination,
    });

    await expect(service.execute(params)).resolves.toEqual({
      items: [
        {
          id: 'p1',
          name: 'Notebook',
          description: 'A notebook',
          priceInCents: 1200,
          status: ProductStatus.ACTIVE,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      pagination,
    });
    expect(reader.findAll).toHaveBeenCalledWith(params);
  });
});
