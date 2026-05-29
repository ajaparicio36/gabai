import { Processor, Process, OnQueueFailed } from '@nestjs/bull';
import type { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ValuationRepository } from './valuation.repository.js';

@Processor('training')
@Injectable()
export class TrainingProcessor {
  private readonly logger = new Logger(TrainingProcessor.name);
  private readonly sidecarUrl: string;

  constructor(
    private readonly valuationRepository: ValuationRepository,
    configService: ConfigService,
  ) {
    this.sidecarUrl = configService.getOrThrow<string>('ML_SIDECAR_URL');
  }

  @Process('train-avm')
  async handleTrain(
    job: Job,
  ): Promise<
    | { status: 'skipped'; reason: 'insufficient_records' }
    | { status: 'ready'; version: string; trainingRecords: number }
  > {
    const records = await this.valuationRepository.getTrainingRecords();
    if (records.length < 20) {
      this.logger.warn(
        `Skipping AVM training: only ${records.length} normalized records`,
      );
      return { status: 'skipped', reason: 'insufficient_records' };
    }

    const modelVersion = await this.valuationRepository.createModelVersion({
      version: `training-${job.id}`,
      modelPath: '',
      status: 'training',
      trainingRecords: records.length,
      jobId: String(job.id),
    });

    const response = await fetch(`${this.sidecarUrl}/api/v1/admin/retrain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records }),
      signal: AbortSignal.timeout(300000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      const errorLog = `Sidecar retrain failed with ${response.status}: ${body.slice(0, 1000)}`;
      await this.valuationRepository.updateModelVersion(modelVersion.id, {
        status: 'failed',
        errorLog,
      });
      throw new Error(`Sidecar retrain failed with ${response.status}`);
    }

    const result = (await response.json()) as {
      version: string;
      mape: number;
      trainingRecords: number;
    };

    await this.valuationRepository.updateModelVersion(modelVersion.id, {
      version: result.version,
      modelPath: `models/avm-${result.version}.pkl`,
      status: 'ready',
      mape: result.mape,
      trainingRecords: result.trainingRecords,
    });

    return {
      status: 'ready',
      version: result.version,
      trainingRecords: result.trainingRecords,
    };
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error): void {
    this.logger.error(`Training job ${job.id} failed: ${error.message}`);
  }
}
