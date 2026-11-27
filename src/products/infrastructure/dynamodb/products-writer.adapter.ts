import { Inject, Injectable } from '@nestjs/common';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { ConfigService } from '@nestjs/config';

import type { ProductsWriterPort } from '@/products/application/ports/products-writer.port';
import type {
  CreateProductParams,
  Product,
} from '@/products/domain/models/product.interface';
import { DYNAMODB_DOCUMENT_CLIENT } from '@/database/dynamodb/dynamodb.constants';
import { toProduct, toProductItem } from './mappers/product-item.mapper';

@Injectable()
export class ProductsWriterAdapter implements ProductsWriterPort {
  private readonly tableName: string;

  constructor(
    @Inject(DYNAMODB_DOCUMENT_CLIENT)
    private readonly documentClient: DynamoDBDocumentClient,
    configService: ConfigService,
  ) {
    this.tableName = configService.getOrThrow<string>(
      'DYNAMODB_PRODUCTS_TABLE',
    );
  }

  async create(params: CreateProductParams): Promise<Product> {
    const item = toProductItem(params);

    await this.documentClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item,
        ConditionExpression: 'attribute_not_exists(#id)',
        ExpressionAttributeNames: { '#id': 'id' },
      }),
    );

    return toProduct(item);
  }
}
