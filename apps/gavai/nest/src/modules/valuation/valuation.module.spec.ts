import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bull';
import { PlatformModule } from '@gavai/platform';
import { ValuationModule } from './valuation.module.js';

describe('ValuationModule queue wiring', () => {
  it('provides the training queue token', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              REDIS_URL: 'redis://localhost:6379',
              ML_SIDECAR_URL: 'http://localhost:8000',
            }),
          ],
        }),
        PlatformModule,
        ValuationModule,
      ],
    }).compile();

    expect(
      moduleRef.get(getQueueToken('training'), { strict: false }),
    ).toBeDefined();
  });
});
