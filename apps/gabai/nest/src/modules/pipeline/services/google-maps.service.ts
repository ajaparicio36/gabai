import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AMENITY_QUERIES } from '@gabai/pipeline';

interface GeocodingResult {
  lat: number;
  lng: number;
  googlePlaceId: string;
  addressComponents: Record<string, string>;
}

interface PlacesNearbyResult {
  categories: Record<
    string,
    { name: string; distanceM: number; placeId: string }
  >;
}

interface DistanceMatrixResult {
  travelTimes: Record<string, number>;
}

@Injectable()
export class GoogleMapsService {
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.getOrThrow<string>('GOOGLE_MAPS_KEY');
  }

  async geocode(address: string): Promise<GeocodingResult | null> {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', address);
    url.searchParams.set('key', this.apiKey);

    const response = await fetch(url.toString());
    const data = (await response.json()) as {
      status: string;
      results: {
        place_id: string;
        geometry: { location: { lat: number; lng: number } };
        address_components?: { types: string[]; long_name: string }[];
      }[];
    };

    if (data.status !== 'OK' || !data.results[0]) {
      return null;
    }

    const result = data.results[0];
    const components: Record<string, string> = {};
    for (const comp of result.address_components ?? []) {
      const type = comp.types?.[0];
      if (type) components[type] = comp.long_name;
    }

    return {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      googlePlaceId: result.place_id,
      addressComponents: components,
    };
  }

  async reverseGeocode(
    lat: number,
    lng: number,
  ): Promise<GeocodingResult | null> {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('latlng', `${lat},${lng}`);
    url.searchParams.set('key', this.apiKey);

    const response = await fetch(url.toString());
    const data = (await response.json()) as {
      status: string;
      results: {
        place_id: string;
        geometry: { location: { lat: number; lng: number } };
        address_components?: { types: string[]; long_name: string }[];
      }[];
    };

    if (data.status !== 'OK' || !data.results[0]) {
      return null;
    }

    const result = data.results[0];
    const components: Record<string, string> = {};
    for (const comp of result.address_components ?? []) {
      const type = comp.types?.[0];
      if (type) components[type] = comp.long_name;
    }

    return {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      googlePlaceId: result.place_id,
      addressComponents: components,
    };
  }

  async nearbySearch(lat: number, lng: number): Promise<PlacesNearbyResult> {
    const categories: Record<
      string,
      { name: string; distanceM: number; placeId: string }
    > = {};

    for (const amenity of AMENITY_QUERIES) {
      const url = new URL(
        'https://maps.googleapis.com/maps/api/place/nearbysearch/json',
      );
      url.searchParams.set('location', `${lat},${lng}`);
      url.searchParams.set('radius', amenity.maxDistance.toString());
      url.searchParams.set('type', amenity.type);
      url.searchParams.set('key', this.apiKey);

      const response = await fetch(url.toString());
      const data = (await response.json()) as {
        status: string;
        results?: {
          name: string;
          place_id: string;
          geometry: { location: { lat: number; lng: number } };
        }[];
      };

      if (data.status === 'OK' && data.results?.[0]) {
        const place = data.results[0];
        const destLat = place.geometry.location.lat;
        const destLng = place.geometry.location.lng;

        categories[amenity.label] = {
          name: place.name,
          distanceM: this.haversineDistance(lat, lng, destLat, destLng),
          placeId: place.place_id,
        };
      } else {
        categories[amenity.label] = {
          name: 'None found',
          distanceM: amenity.maxDistance * 2,
          placeId: '',
        };
      }
    }

    return { categories };
  }

  async distanceMatrix(
    originLat: number,
    originLng: number,
    destinations: { lat: number; lng: number; label: string }[],
  ): Promise<DistanceMatrixResult> {
    const travelTimes: Record<string, number> = {};

    if (destinations.length === 0) {
      return { travelTimes };
    }

    const destStr = destinations.map((d) => `${d.lat},${d.lng}`).join('|');

    const url = new URL(
      'https://maps.googleapis.com/maps/api/distancematrix/json',
    );
    url.searchParams.set('origins', `${originLat},${originLng}`);
    url.searchParams.set('destinations', destStr);
    url.searchParams.set('mode', 'driving');
    url.searchParams.set('key', this.apiKey);

    const response = await fetch(url.toString());
    const data = (await response.json()) as {
      status: string;
      rows?: {
        elements?: { status: string; duration?: { value: number } }[];
      }[];
    };

    if (data.status !== 'OK') {
      for (const dest of destinations) {
        travelTimes[dest.label] = 1800;
      }
      return { travelTimes };
    }

    const elements = data.rows?.[0]?.elements ?? [];
    for (let i = 0; i < destinations.length; i++) {
      const element = elements[i];
      const label = destinations[i].label;
      if (element?.status === 'OK' && element.duration) {
        travelTimes[label] = element.duration.value;
      } else {
        travelTimes[label] = 1800;
      }
    }

    return { travelTimes };
  }

  private haversineDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
