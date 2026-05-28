import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HeatmapController } from './heatmap.controller';
import { HeatmapService } from './heatmap.service';
import { HeatmapRepository } from './heatmap.repository';

@Module({
  imports: [AuthModule],
  controllers: [HeatmapController],
  providers: [HeatmapService, HeatmapRepository],
  exports: [HeatmapService],
})
export class HeatmapModule {}
