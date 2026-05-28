import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ValuationController } from './valuation.controller';
import { ValuationService } from './valuation.service';
import { ValuationRepository } from './valuation.repository';

@Module({
  imports: [AuthModule],
  controllers: [ValuationController],
  providers: [ValuationService, ValuationRepository],
  exports: [ValuationService, ValuationRepository],
})
export class ValuationModule {}
