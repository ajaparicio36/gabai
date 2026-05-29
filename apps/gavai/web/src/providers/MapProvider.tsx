'use client';

import { Libraries, useLoadScript } from '@react-google-maps/api';
import { createContext, useContext, type ReactNode } from 'react';

const libraries: Libraries = ['places'];

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const defaultCenter = {
  lat: 14.5995,
  lng: 120.9842,
};

interface MapContextValue {
  isLoaded: boolean;
}

const MapContext = createContext<MapContextValue>({ isLoaded: false });

export function useMapContext(): MapContextValue {
  return useContext(MapContext);
}

export function MapProvider({ children }: { children: ReactNode }): ReactNode {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? '',
    libraries,
  });

  return (
    <MapContext.Provider value={{ isLoaded }}>{children}</MapContext.Provider>
  );
}

export { mapContainerStyle, defaultCenter };
