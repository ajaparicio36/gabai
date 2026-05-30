'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useGoogleMap } from '@react-google-maps/api';
import api from '@/lib/api';

// Hazard layer colors based on Var value (1=low, 2=medium, 3=high)
const LAYER_STYLES: Record<string, { color: string; border: string }[]> = {
  flood: [
    { color: 'rgba(255, 200, 0, 0.25)', border: 'rgba(255, 200, 0, 0.5)' },
    { color: 'rgba(255, 100, 0, 0.35)', border: 'rgba(255, 100, 0, 0.6)' },
    { color: 'rgba(255, 0, 0, 0.45)', border: 'rgba(255, 0, 0, 0.7)' },
  ],
  flood_100yr: [
    { color: 'rgba(255, 255, 0, 0.2)', border: 'rgba(255, 255, 0, 0.4)' },
    { color: 'rgba(255, 150, 0, 0.3)', border: 'rgba(255, 150, 0, 0.5)' },
    { color: 'rgba(200, 0, 0, 0.4)', border: 'rgba(200, 0, 0, 0.6)' },
  ],
  landslide: [
    { color: 'rgba(128, 0, 128, 0.25)', border: 'rgba(128, 0, 128, 0.5)' },
    { color: 'rgba(128, 0, 128, 0.35)', border: 'rgba(128, 0, 128, 0.6)' },
    { color: 'rgba(128, 0, 128, 0.45)', border: 'rgba(128, 0, 128, 0.7)' },
  ],
  storm_surge_ssa1: [
    { color: 'rgba(0, 0, 255, 0.2)', border: 'rgba(0, 0, 255, 0.4)' },
    { color: 'rgba(0, 0, 255, 0.3)', border: 'rgba(0, 0, 255, 0.5)' },
    { color: 'rgba(0, 0, 255, 0.4)', border: 'rgba(0, 0, 255, 0.6)' },
  ],
  storm_surge_ssa2: [
    { color: 'rgba(0, 0, 255, 0.2)', border: 'rgba(0, 0, 255, 0.4)' },
    { color: 'rgba(0, 0, 255, 0.3)', border: 'rgba(0, 0, 255, 0.5)' },
    { color: 'rgba(0, 0, 255, 0.4)', border: 'rgba(0, 0, 255, 0.6)' },
  ],
  storm_surge_ssa3: [
    { color: 'rgba(0, 0, 255, 0.2)', border: 'rgba(0, 0, 255, 0.4)' },
    { color: 'rgba(0, 0, 255, 0.3)', border: 'rgba(0, 0, 255, 0.5)' },
    { color: 'rgba(0, 0, 255, 0.4)', border: 'rgba(0, 0, 255, 0.6)' },
  ],
  storm_surge_ssa4: [
    { color: 'rgba(0, 0, 255, 0.2)', border: 'rgba(0, 0, 255, 0.4)' },
    { color: 'rgba(0, 0, 255, 0.3)', border: 'rgba(0, 0, 255, 0.5)' },
    { color: 'rgba(0, 0, 255, 0.4)', border: 'rgba(0, 0, 255, 0.6)' },
  ],
};

// Lazy load MVT parser modules to avoid SSR issues with ESM packages
let mvtParserCache: {
  VectorTile: typeof import('@mapbox/vector-tile').VectorTile;
  PbfReader: typeof import('pbf').PbfReader;
} | null = null;

async function loadMvtParser(): Promise<{
  VectorTile: typeof import('@mapbox/vector-tile').VectorTile;
  PbfReader: typeof import('pbf').PbfReader;
}> {
  if (mvtParserCache) return mvtParserCache;
  const [{ VectorTile }, { PbfReader }] = await Promise.all([
    import('@mapbox/vector-tile'),
    import('pbf'),
  ]);
  mvtParserCache = { VectorTile, PbfReader };
  return mvtParserCache;
}

function drawMvtTile(
  ctx: CanvasRenderingContext2D,
  buffer: ArrayBuffer,
  VectorTile: typeof import('@mapbox/vector-tile').VectorTile,
  PbfReader: typeof import('pbf').PbfReader,
): void {
  try {
    const tile = new VectorTile(new PbfReader(new Uint8Array(buffer)));

    for (const layerName of Object.keys(tile.layers)) {
      const layer = tile.layers[layerName];
      if (!layer) continue;

      const styles = LAYER_STYLES[layerName];
      if (!styles) continue;

      for (let i = 0; i < layer.length; i++) {
        const feature = layer.feature(i);
        const props = feature.properties as Record<string, unknown>;
        const varValue =
          typeof props.Var === 'number'
            ? props.Var
            : typeof props.Var === 'string'
              ? parseFloat(props.Var)
              : 0;

        if (varValue < 1 || varValue > 3) continue;

        const style = styles[varValue - 1];
        if (!style) continue;

        const extent = feature.extent || 4096;
        const geom = feature.loadGeometry() as Array<
          Array<{ x: number; y: number }>
        >;

        if (!geom || geom.length === 0) continue;

        ctx.beginPath();
        for (const ring of geom) {
          if (ring.length === 0) continue;
          ctx.moveTo((ring[0].x / extent) * 256, (ring[0].y / extent) * 256);
          for (let j = 1; j < ring.length; j++) {
            ctx.lineTo((ring[j].x / extent) * 256, (ring[j].y / extent) * 256);
          }
          ctx.closePath();
        }

        ctx.fillStyle = style.color;
        ctx.fill('evenodd');
        ctx.strokeStyle = style.border;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }
  } catch {
    // Silently ignore parse errors — tile might be malformed
  }
}

export function FloodOverlay(): React.ReactNode {
  const map = useGoogleMap();
  const overlayRef = useRef<google.maps.MapType | null>(null);

  const getTile = useCallback(
    (coord: google.maps.Point, zoom: number, ownerDocument: Document) => {
      const canvas = ownerDocument.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      canvas.style.width = '256px';
      canvas.style.height = '256px';

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return canvas;
      }

      // Kick off parser preload and tile fetch in parallel
      void Promise.all([
        loadMvtParser(),
        api.get<ArrayBuffer>(`/area/flood-tile/${zoom}/${coord.x}/${coord.y}`, {
          responseType: 'arraybuffer',
        }),
      ])
        .then(([{ VectorTile, PbfReader }, response]) => {
          const data = response.data;
          if (!data || data.byteLength === 0) {
            return;
          }
          drawMvtTile(ctx, data, VectorTile, PbfReader);
        })
        .catch(() => {
          // Silently ignore missing or failed tiles
        });

      return canvas;
    },
    [],
  );

  useEffect(() => {
    if (!map) return;

    const floodMapType: google.maps.MapType = {
      tileSize: new google.maps.Size(256, 256),
      maxZoom: 20,
      minZoom: 0,
      name: 'Flood Hazard',
      alt: 'Flood hazard overlay',
      projection: null,
      radius: 6378137,
      getTile,
      releaseTile: () => {
        // No external resources to clean up
      },
    };

    overlayRef.current = floodMapType;
    map.overlayMapTypes.insertAt(0, floodMapType);

    return () => {
      if (overlayRef.current) {
        const idx = map.overlayMapTypes.getArray().indexOf(overlayRef.current);
        if (idx !== -1) {
          map.overlayMapTypes.removeAt(idx);
        }
        overlayRef.current = null;
      }
    };
  }, [map, getTile]);

  return null;
}
