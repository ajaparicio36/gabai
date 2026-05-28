import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminController } from './admin.controller';
import { ValuationModule } from '../valuation/valuation.module';

@Module({
  imports: [AuthModule, ValuationModule],
  controllers: [AdminController],
})
export class AdminModule {}
