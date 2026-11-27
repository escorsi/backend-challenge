import type {
  CreateProductInput,
  CreateProductParams,
  Product,
} from '@/products/domain/models/product.interface';
import type { ProductsWriterPort } from '@/products/application/ports/products-writer.port';
import type { Clock } from '@/shared/application/ports/clock.port';
import type { IdGenerator } from '@/shared/application/ports/id-generator.port';
import { ProductStatus } from '@/products/domain/enums/product-status.enum';
import {
  type ApplicationLogger,
  type ApplicationLoggerFactory,
} from '@/shared/application/ports/application-logger.port';

export class CreateProductService {
  private readonly logger: ApplicationLogger;

  constructor(
    private readonly productsWriter: ProductsWriterPort,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
    loggerFactory: ApplicationLoggerFactory,
  ) {
    this.logger = loggerFactory.create(CreateProductService.name);
  }

  async execute(params: CreateProductInput): Promise<Product> {
    const product: CreateProductParams = {
      id: this.idGenerator.generate(),
      name: params.name,
      description: params.description,
      priceInCents: params.priceInCents,
      status: ProductStatus.ACTIVE,
      createdAt: this.clock.now().toISOString(),
    };

    const createdProduct = await this.productsWriter.create(product);

    this.logger.info('Product created successfully');

    return createdProduct;
  }
}
