import type {
  CreateProductInput,
  CreateProductParams,
  Product,
} from '../../../domain/models/product.interface';
import type { ProductsWriterPort } from '../../ports/products-writer.port';
import type { Clock } from '../../../../shared/application/ports/clock.port';
import type { IdGenerator } from '../../../../shared/application/ports/id-generator.port';
import { ProductStatus } from '../../../domain/enums/product-status.enum';

export class CreateProductService {
  constructor(
    private readonly productsWriter: ProductsWriterPort,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(params: CreateProductInput): Promise<Product> {
    const product: CreateProductParams = {
      id: this.idGenerator.generate(),
      name: params.name,
      description: params.description,
      priceInCents: params.priceInCents,
      status: ProductStatus.ACTIVE,
      createdAt: this.clock.now().toISOString(),
    };

    return this.productsWriter.create(product);
  }
}
