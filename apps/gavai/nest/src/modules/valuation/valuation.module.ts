import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { AuthModule } from '../auth/auth.module';
import { QueueModule } from '../queue/queue.module.js';
import { ValuationController } from './valuation.controller.js';
import { ValuationService } from './valuation.service.js';
import { ValuationRepository } from './valuation.repository.js';
import { BirComplianceService } from './bir-compliance.service.js';
import { TrainingProcessor } from './training.processor.js';

@Module({
  imports: [
    AuthModule,
    QueueModule,
    BullModule.registerQueue({ name: 'training' }),
  ],
  controllers: [ValuationController],
  providers: [
    ValuationService,
    ValuationRepository,
    BirComplianceService,
    TrainingProcessor,
  ],
  exports: [ValuationService, ValuationRepository],
})
export class ValuationModule {}
