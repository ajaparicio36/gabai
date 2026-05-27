import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiErrorDto {
  @ApiProperty({
    description: 'Machine-readable error code (e.g. AUTH.INVALID_CREDENTIALS)',
  })
  code!: string;

  @ApiProperty({ description: 'Human-readable error message' })
  message!: string;

  @ApiPropertyOptional({ description: 'Optional structured error details' })
  details?: Record<string, unknown>;
}

export class ApiSuccessDto<T> {
  @ApiProperty({ description: 'Response payload' })
  data!: T;
}

export class ApiResponseDto<T> {
  @ApiProperty({ description: 'Success payload (null on error)' })
  data!: T | null;

  @ApiProperty({ description: 'Error payload (null on success)' })
  error!: ApiErrorDto | null;
}
