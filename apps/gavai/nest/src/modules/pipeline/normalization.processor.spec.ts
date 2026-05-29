import { NormalizationProcessor } from './normalization.processor';

describe('NormalizationProcessor', () => {
  it('normalizes Iloilo record and does not keep AI Manila', async () => {
    const repository = {
      findRecordById: jest.fn().mockResolvedValue({
        id: 'rec_1',
        sourceUrl: 'https://example.com/iloilo',
        sourceName: 'example',
        title: 'Residential lot for sale in Iloilo City',
        description: 'Property located in Iloilo City.',
        rawTextReference:
          'Residential lot for sale in Iloilo City. Broker office Manila.',
      }),
      updateRecordNormalization: jest.fn().mockResolvedValue({ id: 'rec_1' }),
    };
    const ai = {
      extractListing: jest.fn().mockResolvedValue({
        title: 'Residential lot for sale in Iloilo City',
        description: 'Property located in Iloilo City.',
        location: {
          raw: 'Manila',
          city: 'Manila',
          province: 'Metro Manila',
          confidence: 'medium',
          evidence: 'Broker office Manila',
        },
        propertyType: { value: 'residential_lot', confidence: 'high' },
        price: { value: 2500000, currency: 'PHP', confidence: 'high' },
        lotArea: { value: 120, unit: 'sqm', confidence: 'high' },
        floorArea: { value: null, unit: 'sqm', confidence: 'missing' },
        issues: [],
      }),
    };

    const processor = new NormalizationProcessor(
      repository as never,
      ai as never,
    );
    await processor.handleNormalize({ data: { recordId: 'rec_1' } } as never);

    expect(repository.updateRecordNormalization).toHaveBeenCalledWith(
      'rec_1',
      expect.objectContaining({
        city: 'Iloilo City',
        province: 'Iloilo',
        normalizationStatus: expect.stringMatching(/normalized|low_confidence/),
      }),
    );
  });
});
