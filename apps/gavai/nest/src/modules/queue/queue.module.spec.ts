import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { QueueModule } from './queue.module';

describe('QueueModule', () => {
  it('compiles with REDIS_URL from config', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              REDIS_URL: 'redis://localhost:6379',
            }),
          ],
        }),
        QueueModule,
      ],
    }).compile();

    expect(moduleRef).toBeDefined();
  });
});
