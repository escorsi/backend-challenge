import { ApiProperty } from '@nestjs/swagger';

export class CreateUserRequestDto {
  @ApiProperty({ example: 'PatricK', minLength: 1, maxLength: 120 })
  name: string;

  @ApiProperty({ example: 'patricK@example.com', maxLength: 254 })
  email: string;

  @ApiProperty({ example: '12345678', minLength: 8, maxLength: 128 })
  password: string;
}
