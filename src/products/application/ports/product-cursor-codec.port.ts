export const PRODUCT_CURSOR_CODEC = Symbol('PRODUCT_CURSOR_CODEC');

export interface ProductCursorCodec {
  encode<T>(payload: T): string;
  decode<T>(cursor: string): T;
}
