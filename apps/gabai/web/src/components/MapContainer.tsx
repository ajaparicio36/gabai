'use client';

import { GoogleMap, Marker, Polygon } from '@react-google-maps/api';
import {
  useMapContext,
  mapContainerStyle,
  defaultCenter,
} from '@/providers/MapProvider';
import type { ReactNode } from 'react';

interface MapContainerProps {
  children?: ReactNode;
  onClick?: (e: google.maps.MapMouseEvent) => void;
  defaultZoom?: number;
  center?: google.maps.LatLngLiteral;
}

export function MapContainer({
  children,
  onClick,
  defaultZoom = 13,
  center = defaultCenter,
}: MapContainerProps): ReactNode {
  const { isLoaded } = useMapContext();

  if (!isLoaded) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted">
        <p className="text-muted-foreground">Loading map...</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={defaultZoom}
        onClick={onClick}
        options={{
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          styles: [
            {
              featureType: 'poi.business',
              stylers: [{ visibility: 'off' }],
            },
          ],
        }}
      >
        {children}
      </GoogleMap>
    </div>
  );
}

export { Marker, Polygon };
