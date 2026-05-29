import { TrainingProcessor } from './training.processor';

describe('TrainingProcessor', () => {
  it('does not call sidecar when no normalized records are available', async () => {
    const repository = {
      getTrainingRecords: jest.fn().mockResolvedValue([]),
      createModelVersion: jest.fn(),
      updateModelVersion: jest.fn(),
    };
    const config = {
      getOrThrow: jest.fn().mockReturnValue('http://localhost:8000'),
    };

    const processor = new TrainingProcessor(
      repository as never,
      config as never,
    );

    await expect(
      processor.handleTrain({ id: 'job_1', data: {} } as never),
    ).resolves.toEqual({ status: 'skipped', reason: 'insufficient_records' });
  });

  it('marks model version failed with errorLog when sidecar retrain fails', async () => {
    const repository = {
      getTrainingRecords: jest
        .fn()
        .mockResolvedValue(
          Array.from({ length: 20 }, (_, i) => ({ id: `p_${i}` })),
        ),
      createModelVersion: jest.fn().mockResolvedValue({ id: 'model_1' }),
      updateModelVersion: jest.fn(),
    };
    const config = {
      getOrThrow: jest.fn().mockReturnValue('http://localhost:8000'),
    };
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      text: jest.fn().mockResolvedValue('sidecar down'),
    }) as never;

    const processor = new TrainingProcessor(
      repository as never,
      config as never,
    );

    await expect(
      processor.handleTrain({ id: 'job_1', data: {} } as never),
    ).rejects.toThrow('Sidecar retrain failed with 502');
    expect(repository.updateModelVersion).toHaveBeenCalledWith('model_1', {
      status: 'failed',
      errorLog: 'Sidecar retrain failed with 502: sidecar down',
    });

    global.fetch = originalFetch;
  });
});
