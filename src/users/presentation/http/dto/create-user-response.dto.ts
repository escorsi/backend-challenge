import { ApiProperty } from '@nestjs/swagger';

export class CreateUserResponseDto {
  @ApiProperty({ example: 'Registration request processed.' })
  message: string;
}
