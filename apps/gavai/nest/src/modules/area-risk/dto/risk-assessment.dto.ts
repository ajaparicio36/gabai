import { IsNumber, IsOptional } from 'class-validator';

export class RiskAssessmentQueryDto {
  @IsNumber()
  lat!: number;

  @IsNumber()
  lng!: number;

  @IsOptional()
  @IsNumber()
  radiusM?: number;
}
