import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PipelineModule } from '../pipeline/pipeline.module';
import { AreaController } from './area.controller';
import { AreaService } from './area.service';
import { AreaRepository } from './area.repository';
import { GeminiService } from './gemini.service';

@Module({
  imports: [AuthModule, PipelineModule],
  controllers: [AreaController],
  providers: [AreaService, AreaRepository, GeminiService],
  exports: [AreaService],
})
export class AreaModule {}
