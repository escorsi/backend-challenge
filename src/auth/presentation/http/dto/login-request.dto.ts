import { ApiProperty } from '@nestjs/swagger';

export class LoginRequestDto {
  @ApiProperty({
    description: 'User email address',
    example: 'admin@example.com',
    format: 'email',
  })
  email: string;

  @ApiProperty({
    description: 'User password',
    example: '12345678',
    minLength: 1,
    format: 'password',
  })
  password: string;
}
