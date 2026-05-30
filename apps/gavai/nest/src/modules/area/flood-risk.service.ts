import { Injectable } from '@nestjs/common';
import { PMTiles, Header, TileType, Compression } from 'pmtiles';
import { VectorTile, VectorTileFeature } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';
import { gunzipSync } from 'zlib';
import { booleanPointInPolygon } from '@turf/turf';
import type { Point, Polygon } from 'geojson';

const PMTILES_URL =
  'https://huggingface.co/datasets/bettergovph/project-noah-hazard-maps/resolve/main/PMTiles/noah_hazard_maps.pmtiles';

const ZOOM = 12;

type FloodLevel = 'none' | 'low' | 'medium' | 'high';

interface FloodResult {
  score: number;
  level: FloodLevel;
  returnPeriod: string;
  source: string;
}

@Injectable()
export class FloodRiskService {
  private pmtiles: PMTiles | null = null;
  private header: Header | null = null;

  private async getPMTiles(): Promise<PMTiles> {
    if (this.pmtiles) return this.pmtiles;

    this.pmtiles = new PMTiles(PMTILES_URL);
    this.header = await this.pmtiles.getHeader();
    return this.pmtiles;
  }

  async getScore(lat: number, lng: number): Promise<FloodResult> {
    const { x, y } = this.lngLatToTile(lng, lat, ZOOM);
    const pmtiles = await this.getPMTiles();

    const layers: { layer: string; varField: string; key: string }[] = [
      { layer: 'flood', varField: 'Var', key: 'flood' },
      { layer: 'flood_100yr', varField: 'Var', key: 'flood_100yr' },
      { layer: 'landslide', varField: 'Var', key: 'landslide' },
      { layer: 'storm_surge_ssa1', varField: 'Var', key: 'storm_surge_1' },
      { layer: 'storm_surge_ssa2', varField: 'Var', key: 'storm_surge_2' },
      { layer: 'storm_surge_ssa3', varField: 'Var', key: 'storm_surge_3' },
      { layer: 'storm_surge_ssa4', varField: 'Var', key: 'storm_surge_4' },
    ];

    let worstScore = 1.0;
    let worstLevel: FloodLevel = 'none';
    let matchedLayer = 'flood_100yr';

    try {
      const tile = await pmtiles.getZxy(ZOOM, x, y);
      if (!tile) {
        return {
          score: 1.0,
          level: 'none',
          returnPeriod: '100yr',
          source: 'Project NOAH',
        };
      }

      const tileData = this.decodeMVT(
        tile.data,
        this.header?.tileType ?? TileType.Mvt,
        this.header?.tileCompression ?? Compression.Unknown,
      );

      for (const { layer, varField, key } of layers) {
        const layerData = tileData.layers[layer];
        if (!layerData) continue;

        for (let i = 0; i < layerData.length; i++) {
          const feature = layerData.feature(i);
          const score = this.featureToScore(feature, varField);
          if (score !== null && score < worstScore) {
            worstScore = score;
            worstLevel = this.scoreToLevel(score);
            matchedLayer = key;
          }
        }
      }

      if (worstScore === 1.0) {
        const [localX, localY] = this.lngLatToTileLocal(lng, lat, ZOOM, x, y);
        const pt: Point = { type: 'Point', coordinates: [localX, localY] };
        for (const { layer, varField, key } of layers) {
          const layerData = tileData.layers[layer];
          if (!layerData) continue;

          for (let i = 0; i < layerData.length; i++) {
            const feature = layerData.feature(i);
            const geom = this.toGeoJSONGeometry(feature);
            if (geom && booleanPointInPolygon(pt, geom as Polygon)) {
              const score = this.featureToScore(feature, varField);
              if (score !== null && score < worstScore) {
                worstScore = score;
                worstLevel = this.scoreToLevel(score);
                matchedLayer = key;
              }
            }
          }
        }
      }
    } catch {
      void 0;
    }

    let returnPeriod: string;
    if (matchedLayer === 'flood') {
      returnPeriod = '1yr';
    } else if (matchedLayer === 'flood_100yr') {
      returnPeriod = '100yr';
    } else if (matchedLayer.startsWith('storm_surge')) {
      returnPeriod = 'various';
    } else if (matchedLayer === 'landslide') {
      returnPeriod = 'N/A';
    } else {
      returnPeriod = 'N/A';
    }

    return {
      score: worstScore,
      level: worstLevel,
      returnPeriod,
      source: 'Project NOAH',
    };
  }

  private lngLatToTile(
    lng: number,
    lat: number,
    zoom: number,
  ): { x: number; y: number } {
    const x = Math.floor(((lng + 180) / 360) * Math.pow(2, zoom));
    const y = Math.floor(
      ((1 -
        Math.log(
          Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180),
        ) /
          Math.PI) /
        2) *
        Math.pow(2, zoom),
    );
    return { x, y };
  }

  private lngLatToTileLocal(
    lng: number,
    lat: number,
    zoom: number,
    tileX: number,
    tileY: number,
  ): [number, number] {
    const x = ((lng + 180) / 360) * Math.pow(2, zoom);
    const y =
      ((1 -
        Math.log(
          Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180),
        ) /
          Math.PI) /
        2) *
      Math.pow(2, zoom);
    return [x - tileX, y - tileY];
  }

  private decodeMVT(
    data: ArrayBuffer,
    _tileType: TileType,
    compression: Compression,
  ): VectorTile {
    const buffer =
      compression === Compression.Gzip
        ? gunzipSync(new Uint8Array(data))
        : new Uint8Array(data);

    return new VectorTile(new PbfReader(buffer));
  }

  private featureToScore(
    feature: VectorTileFeature,
    varField: string,
  ): number | null {
    const props = feature.properties;
    const varValue = props[varField];

    if (typeof varValue === 'number') {
      return this.varToScore(varValue);
    }
    if (typeof varValue === 'string') {
      const num = parseFloat(varValue);
      if (!isNaN(num)) return this.varToScore(num);
    }
    return null;
  }

  private varToScore(varValue: number): number {
    if (varValue >= 3) return 0.0;
    if (varValue >= 2) return 0.35;
    if (varValue >= 1) return 0.7;
    return 1.0;
  }

  private scoreToLevel(score: number): FloodLevel {
    if (score >= 0.7) return 'low';
    if (score >= 0.35) return 'medium';
    return 'high';
  }

  private toGeoJSONGeometry(feature: VectorTileFeature): Polygon | null {
    try {
      const loaded = feature.loadGeometry();
      if (!loaded.length) return null;

      const extent = feature.extent;

      if (feature.type === 3) {
        return {
          type: 'Polygon',
          coordinates: loaded.map((ring) =>
            ring.map((p) => [p.x / extent, p.y / extent]),
          ),
        };
      }
      return null;
    } catch {
      return null;
    }
  }
}
