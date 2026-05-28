import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PlatformModule } from '@gabai/platform';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from '../modules/auth/auth.module';
import { PipelineModule } from '../modules/pipeline/pipeline.module';
import { ValuationModule } from '../modules/valuation/valuation.module';
import { AdminModule } from '../modules/admin/admin.module';
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
    PipelineModule,
    ValuationModule,
    AdminModule,
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
