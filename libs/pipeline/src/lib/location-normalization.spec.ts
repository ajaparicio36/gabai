import { normalizePhilippineLocation } from './location-normalization.js';

describe('normalizePhilippineLocation', () => {
  it('preserves Iloilo City and province from explicit property text', () => {
    const result = normalizePhilippineLocation({
      title: 'Residential lot for sale in Iloilo City',
      body: 'Property located in Iloilo City near schools.',
      aiCity: 'Manila',
      aiProvince: 'Metro Manila',
      rawLocation: 'Iloilo City',
    });

    expect(result.city).toBe('Iloilo City');
    expect(result.province).toBe('Iloilo');
    expect(result.status).toBe('medium'); // As plan note says: if contradiction exists, returns medium
    expect(result.issues).toContain(
      'AI city Manila contradicted explicit source city Iloilo City',
    );
  });

  it('does not default missing location to Manila', () => {
    const result = normalizePhilippineLocation({
      title: 'Residential lot for sale, near commercial area',
      body: 'Clean title. Near schools and shops.',
      aiCity: null,
      aiProvince: null,
      rawLocation: null,
    });

    expect(result.city).toBeNull();
    expect(result.province).toBeNull();
    expect(result.status).toBe('missing');
    expect(result.issues).toContain('No reliable source location found');
  });

  it('prefers property body location over unrelated Manila text', () => {
    const result = normalizePhilippineLocation({
      title: 'Residential lot for sale in Iloilo City',
      body: 'Property details: located in Iloilo City. Broker office: Manila.',
      aiCity: 'Manila',
      aiProvince: 'Metro Manila',
      rawLocation: 'Manila',
    });

    expect(result.city).toBe('Iloilo City');
    expect(result.province).toBe('Iloilo');
    expect(result.status).toBe('medium');
    expect(result.issues).toContain(
      'Found other location mention Manila outside selected property location',
    );
  });
});
