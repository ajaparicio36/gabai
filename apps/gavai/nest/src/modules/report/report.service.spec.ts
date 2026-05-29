import { ReportService } from './report.service';

describe('ReportService', () => {
  it('includes insufficient normalized data warning when comparables are sparse', async () => {
    const reportRepository = {
      findByValuationId: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        id: 'report_1',
        valuationId: 'val_1',
        pdfUrl: null,
        verificationHash: 'hash',
        createdAt: new Date('2026-05-28T00:00:00.000Z'),
      }),
      findNormalizedComparablesForValuation: jest.fn().mockResolvedValue([]),
    };
    const valuationRepository = {
      findValuationById: jest.fn().mockResolvedValue({
        id: 'val_1',
        inputLat: 10.72,
        inputLng: 122.56,
        propertyType: 'residential_lot',
      }),
    };

    const service = new ReportService(
      reportRepository as never,
      valuationRepository as never,
    );
    const result = await service.generateReport('val_1');

    expect(result.normalizedListings).toEqual([]);
    expect(result.warnings).toContain(
      'Not enough normalized comparable listings in this area',
    );
  });
});
