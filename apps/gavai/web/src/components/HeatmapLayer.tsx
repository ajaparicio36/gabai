'use client';

import { Polygon } from '@react-google-maps/api';
import type { HeatmapFeature } from '@/types/api';

interface HeatmapLayerProps {
  features: HeatmapFeature[];
  onTileClick?: (lat: number, lng: number) => void;
}

const HEATMAP_COLORS = ['#22c55e', '#f97316', '#ef4444'];

function getColor(intensity: number): string {
  if (intensity <= 0.33) return HEATMAP_COLORS[0];
  if (intensity <= 0.66) return HEATMAP_COLORS[1];
  return HEATMAP_COLORS[2];
}

export function HeatmapLayer({
  features,
  onTileClick,
}: HeatmapLayerProps): React.ReactNode {
  if (!features.length) {
    return null;
  }

  return (
    <>
      {features.map((feature, i) => {
        const coords = feature.geometry.coordinates[0].map(
          ([lng, lat]) => ({ lat, lng }) as google.maps.LatLngLiteral,
        );

        return (
          <Polygon
            key={`tile-${i}`}
            paths={coords}
            options={{
              fillColor: getColor(feature.properties.colorIntensity),
              fillOpacity: 0.4,
              strokeColor: getColor(feature.properties.colorIntensity),
              strokeOpacity: 0.6,
              strokeWeight: 1,
            }}
            onClick={(e) => {
              if (e.latLng && onTileClick) {
                onTileClick(e.latLng.lat(), e.latLng.lng());
              }
            }}
          />
        );
      })}
    </>
  );
}
