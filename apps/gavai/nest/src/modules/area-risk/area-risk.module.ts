import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AreaModule } from '../area/area.module';
import { AreaRiskController } from './area-risk.controller';
import { AreaRiskService } from './area-risk.service';
import { AreaRiskRepository } from './area-risk.repository';

@Module({
  imports: [AuthModule, AreaModule],
  controllers: [AreaRiskController],
  providers: [AreaRiskService, AreaRiskRepository],
  exports: [AreaRiskService],
})
export class AreaRiskModule {}
