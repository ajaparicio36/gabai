import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PlatformModule } from '@gavai/platform';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from '../modules/auth/auth.module';
import { QueueModule } from '../modules/queue/queue.module';
import { PipelineModule } from '../modules/pipeline/pipeline.module';
import { ValuationModule } from '../modules/valuation/valuation.module';
import { AdminModule } from '../modules/admin/admin.module';
import { HeatmapModule } from '../modules/heatmap/heatmap.module';
import { AreaModule } from '../modules/area/area.module';
import { AreaRiskModule } from '../modules/area-risk/area-risk.module';
import { ReportModule } from '../modules/report/report.module';
import { validateEnv } from '../config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60000, limit: 30 },
      { name: 'user', ttl: 60000, limit: 100 },
      { name: 'paid', ttl: 60000, limit: 1000 },
      { name: 'admin', ttl: 60000, limit: 300 },
    ]),
    PlatformModule,
    AuthModule,
    QueueModule,
    PipelineModule,
    ValuationModule,
    AdminModule,
    HeatmapModule,
    AreaModule,
    AreaRiskModule,
    ReportModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
