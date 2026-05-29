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
    // AI city (Manila/Metro Manila) contradicts explicit Iloilo City → medium
    expect(result.status).toBe('medium');
    expect(result.issues).toContain(
      'AI city "Manila" contradicted explicit source city "Iloilo City"',
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

  it('prefers first matched Metro Manila city even when Manila also appears', () => {
    // Iloilo appears in title → matched first; Manila appears in body but that's ok now
    const result = normalizePhilippineLocation({
      title: 'Residential lot for sale in Iloilo City',
      body: 'Property details: located in Iloilo City. Broker office: Manila.',
      aiCity: 'Manila',
      aiProvince: 'Metro Manila',
      rawLocation: 'Manila',
    });

    expect(result.city).toBe('Iloilo City');
    expect(result.province).toBe('Iloilo');
    // AI city (Manila/Metro Manila) contradicts Iloilo → medium
    expect(result.status).toBe('medium');
  });

  it('resolves Makati to Metro Manila', () => {
    const result = normalizePhilippineLocation({
      title: '2BR Condo for Sale in Makati',
      body: 'Spacious 2 bedroom unit in Makati City, Metro Manila.',
      aiCity: 'Makati',
      aiProvince: 'Metro Manila',
      rawLocation: 'Makati City',
    });

    expect(result.city).toBe('Makati');
    expect(result.province).toBe('Metro Manila');
    expect(result.region).toBe('National Capital Region');
    expect(result.status).toBe('high');
    expect(result.issues).toHaveLength(0);
  });

  it('resolves BGC / Bonifacio Global City to Taguig', () => {
    const result = normalizePhilippineLocation({
      title: 'Condo for Sale in BGC',
      body: 'High-rise unit in Bonifacio Global City, Taguig.',
      aiCity: 'Taguig',
      aiProvince: 'Metro Manila',
      rawLocation: 'BGC, Taguig',
    });

    expect(result.city).toBe('Taguig');
    expect(result.province).toBe('Metro Manila');
    expect(result.region).toBe('National Capital Region');
  });

  it('resolves Quezon City from QC abbreviation', () => {
    const result = normalizePhilippineLocation({
      title: 'House and Lot for Sale QC',
      body: 'Located in QC, Metro Manila.',
      aiCity: 'Quezon City',
      aiProvince: 'Metro Manila',
      rawLocation: 'QC',
    });

    expect(result.city).toBe('Quezon City');
    expect(result.province).toBe('Metro Manila');
  });

  it('resolves Parañaque with or without tilde', () => {
    const result = normalizePhilippineLocation({
      title: 'House for Sale in Paranaque',
      body: 'Modern home in Paranaque City.',
      aiCity: 'Parañaque',
      aiProvince: 'Metro Manila',
      rawLocation: 'Paranaque',
    });

    expect(result.city).toBe('Parañaque');
    expect(result.province).toBe('Metro Manila');
  });
});
