'use client';

import { useEffect, useState } from 'react';

interface ElevationLabelProps {
  lat: number;
  lng: number;
}

export function ElevationLabel({
  lat,
  lng,
}: ElevationLabelProps): React.ReactNode {
  const [elevation, setElevation] = useState<number | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? '';
    const url = `https://maps.googleapis.com/maps/api/elevation/json?locations=${lat},${lng}&key=${key}`;

    fetch(url)
      .then((r) => r.json())
      .then((data: { results?: { elevation: number }[] }) => {
        if (!cancelled && data.results?.[0]?.elevation != null) {
          setElevation(Math.round(data.results[0].elevation));
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [lat, lng]);

  if (error || elevation === null) return null;

  return (
    <span className="text-xs text-muted-foreground ml-2">
      {elevation}m elevation
    </span>
  );
}
