import { Injectable } from '@nestjs/common';
import { GoogleMapsService } from '../pipeline/services/google-maps.service';

const CBD_CENTROIDS = [
  { label: 'Makati CBD', lat: 14.5547, lng: 121.0244 },
  { label: 'Ortigas', lat: 14.5888, lng: 121.0686 },
  { label: 'BGC', lat: 14.5487, lng: 121.0528 },
  { label: 'Manila', lat: 14.5995, lng: 120.9842 },
];

interface TrafficResult {
  score: number;
  speedRatio: number;
  freeflowDuration: number;
  avgPeakDuration: number;
  nearestCbd: string;
  cachedAt: string;
}

@Injectable()
export class TrafficScoreService {
  private cache = new Map<
    string,
    { result: TrafficResult; expiresAt: number }
  >();
  private readonly TTL_MS = 6 * 60 * 60 * 1000;

  constructor(private readonly googleMapsService: GoogleMapsService) {}

  async getScore(lat: number, lng: number): Promise<TrafficResult> {
    const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.result;
    }

    let nearestCbd = CBD_CENTROIDS[0];
    let minDist = Infinity;

    for (const cbd of CBD_CENTROIDS) {
      const dist = this.haversineDistance(lat, lng, cbd.lat, cbd.lng);
      if (dist < minDist) {
        minDist = dist;
        nearestCbd = cbd;
      }
    }

    const destinations = [
      { lat: nearestCbd.lat, lng: nearestCbd.lng, label: nearestCbd.label },
    ];

    let freeflowDuration = 1800;
    let avgPeakDuration = 3600;

    try {
      const now = new Date();

      const offPeak = new Date(now);
      offPeak.setHours(2, 0, 0, 0);
      if (offPeak <= now) offPeak.setDate(offPeak.getDate() + 1);

      const amPeak = new Date(now);
      amPeak.setHours(8, 0, 0, 0);
      if (amPeak <= now) amPeak.setDate(amPeak.getDate() + 1);

      const pmPeak = new Date(now);
      pmPeak.setHours(18, 0, 0, 0);
      if (pmPeak <= now) pmPeak.setDate(pmPeak.getDate() + 1);

      const offResult = await this.googleMapsService.distanceMatrix(
        lat,
        lng,
        destinations,
        offPeak,
      );
      freeflowDuration = offResult.travelTimes[nearestCbd.label] ?? 1800;

      const amResult = await this.googleMapsService.distanceMatrix(
        lat,
        lng,
        destinations,
        amPeak,
      );
      const amTime = amResult.travelTimes[nearestCbd.label] ?? 1800;

      const pmResult = await this.googleMapsService.distanceMatrix(
        lat,
        lng,
        destinations,
        pmPeak,
      );
      const pmTime = pmResult.travelTimes[nearestCbd.label] ?? 1800;

      avgPeakDuration = (amTime + pmTime) / 2;
    } catch {
      void 0;
    }

    const speedRatio =
      freeflowDuration > 0
        ? Math.min(1, freeflowDuration / Math.max(avgPeakDuration, 1))
        : 0;

    const score = Math.max(0, Math.min(1, speedRatio));

    const result: TrafficResult = {
      score,
      speedRatio,
      freeflowDuration,
      avgPeakDuration,
      nearestCbd: nearestCbd.label,
      cachedAt: new Date().toISOString(),
    };

    this.cache.set(cacheKey, { result, expiresAt: Date.now() + this.TTL_MS });

    return result;
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
