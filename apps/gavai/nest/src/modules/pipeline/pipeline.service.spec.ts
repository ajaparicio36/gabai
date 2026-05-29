import { PipelineService } from './pipeline.service';

describe('PipelineService normalization queue flow', () => {
  it('queues normalization before enrichment', async () => {
    const repository = {
      computeUrlHash: jest.fn((url: string) => `hash:${url}`),
      findTargetByUrlHash: jest.fn().mockResolvedValue(null),
      createScrapingTargets: jest.fn().mockResolvedValue({ count: 1 }),
      approveTargets: jest.fn(),
      findQueuedTargets: jest.fn().mockResolvedValue([]),
      approveRecords: jest.fn(),
      findRecordById: jest.fn(),
      rejectRecords: jest.fn(),
      findPendingReviewTargets: jest.fn(),
      findPendingReviewRecords: jest.fn(),
      findScrapingJobs: jest.fn(),
    };
    const brightdata = {
      discover: jest
        .fn()
        .mockResolvedValue({ urls: ['https://example.com/iloilo'] }),
    };
    const scrapingQueue = {
      add: jest.fn(),
      getActiveCount: jest.fn(),
      getWaitingCount: jest.fn(),
    };
    const normalizationQueue = {
      add: jest.fn(),
      getActiveCount: jest.fn(),
      getWaitingCount: jest.fn(),
    };
    const enrichmentQueue = {
      add: jest.fn(),
      getActiveCount: jest.fn(),
      getWaitingCount: jest.fn(),
    };

    const service = new PipelineService(
      repository as never,
      brightdata as never,
      scrapingQueue as never,
      normalizationQueue as never,
      enrichmentQueue as never,
    );

    await service.queueNormalizationForRecords(['rec_1']);

    expect(normalizationQueue.add).toHaveBeenCalledWith('normalize-record', {
      recordId: 'rec_1',
    });
    expect(enrichmentQueue.add).not.toHaveBeenCalled();
  });
});
