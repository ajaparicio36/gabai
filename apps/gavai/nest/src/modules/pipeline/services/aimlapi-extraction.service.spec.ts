import { AimlapiExtractionService } from './aimlapi-extraction.service';

describe('AimlapiExtractionService JSON validation', () => {
  const service = new AimlapiExtractionService({
    get: jest.fn(),
  } as never);

  it('rejects malformed confidence values instead of silently accepting them', () => {
    const result = service.parseExtractedJsonForTest(
      JSON.stringify({
        title: 'Lot in Iloilo City',
        description: 'Residential lot in Iloilo City',
        location: {
          raw: 'Iloilo City',
          city: 'Iloilo City',
          province: 'Iloilo',
          confidence: 'certain',
          evidence: 'Iloilo City',
        },
        propertyType: { value: 'residential_lot', confidence: 'high' },
        price: { value: 2500000, currency: 'PHP', confidence: 'high' },
        lotArea: { value: 120, unit: 'sqm', confidence: 'high' },
        floorArea: { value: null, unit: 'sqm', confidence: 'missing' },
        issues: [],
      }),
    );

    expect(result).toBeNull();
  });

  it('rejects extra unrecognized top-level fields from AI output', () => {
    const result = service.parseExtractedJsonForTest(
      JSON.stringify({
        title: 'Lot in Iloilo City',
        description: 'Residential lot in Iloilo City',
        location: {
          raw: 'Iloilo City',
          city: 'Iloilo City',
          province: 'Iloilo',
          confidence: 'high',
          evidence: 'Iloilo City',
        },
        propertyType: { value: 'residential_lot', confidence: 'high' },
        price: { value: 2500000, currency: 'PHP', confidence: 'high' },
        lotArea: { value: 120, unit: 'sqm', confidence: 'high' },
        floorArea: { value: null, unit: 'sqm', confidence: 'missing' },
        issues: [],
        inventedNeighborhoodScore: 999,
      }),
    );

    expect(result).toBeNull();
  });

  it('accepts valid structured extraction JSON', () => {
    const result = service.parseExtractedJsonForTest(
      JSON.stringify({
        title: 'Lot in Iloilo City',
        description: 'Residential lot in Iloilo City',
        location: {
          raw: 'Iloilo City',
          city: 'Iloilo City',
          province: 'Iloilo',
          confidence: 'high',
          evidence: 'Iloilo City',
        },
        propertyType: { value: 'residential_lot', confidence: 'high' },
        price: { value: 2500000, currency: 'PHP', confidence: 'high' },
        lotArea: { value: 120, unit: 'sqm', confidence: 'high' },
        floorArea: { value: null, unit: 'sqm', confidence: 'missing' },
        issues: [],
      }),
    );

    expect(result?.location.city).toBe('Iloilo City');
  });
});
