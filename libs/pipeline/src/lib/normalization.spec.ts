import { normalizeExtractedListing } from './normalization.js';

describe('normalizeExtractedListing', () => {
  it('marks records with explicit Iloilo location as normalized', () => {
    const result = normalizeExtractedListing({
      sourceUrl: 'https://example.com/iloilo-lot',
      sourceName: 'example',
      title: 'Residential lot for sale in Iloilo City',
      description: 'Property located in Iloilo City.',
      rawTextReference: 'Residential lot for sale in Iloilo City. PHP 2500000.',
      extracted: {
        title: 'Residential lot for sale in Iloilo City',
        description: 'Property located in Iloilo City.',
        location: {
          raw: 'Iloilo City',
          city: 'Iloilo City',
          province: 'Iloilo',
          confidence: 'high',
          evidence: 'located in Iloilo City',
        },
        propertyType: { value: 'residential_lot', confidence: 'high' },
        price: { value: 2500000, currency: 'PHP', confidence: 'high' },
        lotArea: { value: 120, unit: 'sqm', confidence: 'high' },
        floorArea: { value: null, unit: 'sqm', confidence: 'missing' },
        issues: [],
      },
    });

    expect(result.normalizationStatus).toBe('normalized');
    expect(result.city).toBe('Iloilo City');
    expect(result.province).toBe('Iloilo');
    expect(result.askingPricePhp).toBe(2500000);
    expect(result.confidenceScore).toBeGreaterThanOrEqual(0.8);
  });

  it('does not train records without reliable location', () => {
    const result = normalizeExtractedListing({
      sourceUrl: 'https://example.com/no-location',
      sourceName: 'example',
      title: 'Residential lot for sale, near commercial area',
      description: 'Clean title.',
      rawTextReference: 'Residential lot for sale, near commercial area.',
      extracted: {
        title: 'Residential lot for sale, near commercial area',
        description: 'Clean title.',
        location: {
          raw: null,
          city: null,
          province: null,
          confidence: 'missing',
          evidence: null,
        },
        propertyType: { value: 'residential_lot', confidence: 'medium' },
        price: { value: null, currency: 'PHP', confidence: 'missing' },
        lotArea: { value: null, unit: 'sqm', confidence: 'missing' },
        floorArea: { value: null, unit: 'sqm', confidence: 'missing' },
        issues: [],
      },
    });

    expect(result.normalizationStatus).toBe('failed');
    expect(result.city).toBeNull();
    expect(result.trainingEligible).toBe(false);
    expect(result.normalizationIssues).toContain(
      'No reliable source location found',
    );
    expect(result.normalizationIssues).toContain('Missing price');
  });
});
