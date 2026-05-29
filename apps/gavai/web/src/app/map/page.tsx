'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { MapProvider, defaultCenter } from '@/providers/MapProvider';
import { MapContainer, Marker } from '@/components/MapContainer';
import { ViewToggle, type MapViewMode } from '@/components/ViewToggle';
import { HeatmapLayer } from '@/components/HeatmapLayer';
import { FilterBar, type HeatmapFilters } from '@/components/FilterBar';
import { QuickEstimatePopup } from '@/components/QuickEstimatePopup';
import { ValuationPanel } from '@/components/ValuationPanel';
import { useHeatmap } from '@/hooks/useHeatmap';
import { useQuickEstimate } from '@/hooks/useQuickEstimate';
import { useValuation } from '@/hooks/useValuation';
import { useAreaIntel } from '@/hooks/useAreaIntel';
import { useGenerateReport } from '@/hooks/useReport';
import { useRiskScores } from '@/hooks/useRiskScores';
import { useListings } from '@/hooks/useListings';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LogOut, Settings, Satellite } from 'lucide-react';
import { Button } from '@/components/ui/button';

function MapContent(): React.ReactNode {
  const { user, logout, isLoading } = useAuth();
  const router = useRouter();

  const [viewMode, setViewMode] = useState<MapViewMode>('heatmap');
  const [filters, setFilters] = useState<HeatmapFilters>({
    propertyType: 'all',
    priceMin: 0,
    priceMax: 200000,
  });
  const [selectedLat, setSelectedLat] = useState<number | null>(null);
  const [selectedLng, setSelectedLng] = useState<number | null>(null);
  const [showValuationPanel, setShowValuationPanel] = useState(false);
  const [mapTypeId, setMapTypeId] = useState<string>('roadmap');

  function SatelliteToggle(): React.ReactNode {
    return (
      <button
        onClick={() =>
          setMapTypeId((m) => (m === 'roadmap' ? 'satellite' : 'roadmap'))
        }
        className="rounded-md bg-background/90 px-3 py-1.5 text-sm font-medium shadow backdrop-blur border"
      >
        <Satellite className="inline h-4 w-4 mr-1" />
        {mapTypeId === 'roadmap' ? 'Satellite' : 'Road'}
      </button>
    );
  }

  const bboxQuery = '120.9,14.3,121.2,14.75';
  const heatmapParams = {
    bbox: bboxQuery,
    propertyType:
      filters.propertyType === 'all' ? undefined : filters.propertyType,
  };

  const { data: heatmapData, isNoData: isHeatmapNoData } =
    useHeatmap(heatmapParams);
  const { data: quickEstimate, isLoading: isQuickEstimateLoading } =
    useQuickEstimate(selectedLat, selectedLng);
  const valuation = useValuation();
  const { data: areaIntel, isStale: isAreaIntelStale } = useAreaIntel(
    selectedLat,
    selectedLng,
  );
  const report = useGenerateReport();

  const { data: riskScores, isLoading: isRiskScoresLoading } = useRiskScores(
    selectedLat,
    selectedLng,
    showValuationPanel && !!valuation.data,
  );

  const listingsBounds = {
    minLat: 14.3,
    minLng: 120.9,
    maxLat: 14.75,
    maxLng: 121.2,
  };
  const { data: listings } = useListings(
    listingsBounds.minLat,
    listingsBounds.minLng,
    listingsBounds.maxLat,
    listingsBounds.maxLng,
    filters.propertyType === 'all' ? undefined : filters.propertyType,
  );

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/auth/login');
    }
  }, [user, isLoading, router]);

  const handleMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setSelectedLat(lat);
      setSelectedLng(lng);

      if (viewMode === 'valuation') {
        setShowValuationPanel(true);
        valuation.mutate({
          lat,
          lng,
          propertyType:
            filters.propertyType === 'all'
              ? 'house_and_lot'
              : filters.propertyType,
        });
      }
    },
    [viewMode, filters.propertyType, valuation],
  );

  const handleGenerateReport = useCallback(() => {
    if (valuation.data?.id) {
      report.mutate(valuation.data.id);
    }
  }, [valuation.data, report]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="relative h-screen w-full">
      <div className="absolute left-4 top-4 z-10 flex items-center gap-2">
        <span className="rounded-md bg-background/90 px-3 py-1.5 text-sm font-medium shadow backdrop-blur border-l-2 border-l-secondary">
          GAVAI
        </span>
        <SatelliteToggle />
      </div>

      <ViewToggle value={viewMode} onChange={setViewMode} />

      {viewMode === 'heatmap' && (
        <div className="absolute bottom-4 left-4 right-4 z-10 rounded-lg border bg-background/90 p-3 shadow backdrop-blur border-t-2 border-t-secondary">
          {isHeatmapNoData && (
            <div className="mb-3 rounded-md bg-muted px-3 py-2 text-center text-xs text-muted-foreground">
              No property data yet.{' '}
              <button
                className="underline hover:text-primary"
                onClick={() => router.push('/admin/discover')}
              >
                Go to Admin &rarr; Discover
              </button>{' '}
              to start finding properties.
            </div>
          )}
          <FilterBar onFiltersChange={setFilters} />
        </div>
      )}

      <div className="absolute right-4 top-4 z-10 flex gap-2">
        {user.role === 'admin' && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/admin/discover')}
            className="shadow"
          >
            <Settings className="mr-1 h-4 w-4" />
            Admin
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => logout().then(() => router.push('/'))}
          className="shadow"
        >
          <LogOut className="mr-1 h-4 w-4" />
          Logout
        </Button>
      </div>

      <MapContainer
        onClick={handleMapClick}
        defaultZoom={12}
        center={defaultCenter}
        mapTypeId={mapTypeId}
        tilt={mapTypeId === 'satellite' ? 45 : 0}
      >
        {viewMode === 'heatmap' && heatmapData?.features && (
          <HeatmapLayer features={heatmapData.features} />
        )}

        {viewMode === 'listings' &&
          listings &&
          listings.slice(0, 100).map((p) => (
            <Marker
              key={p.id}
              position={{ lat: p.lat, lng: p.lng }}
              icon={{
                url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="%233b82f6" stroke-width="2"%3E%3Cpath d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"%3E%3C/path%3E%3Ccircle cx="12" cy="10" r="3"%3E%3C/circle%3E%3C/svg%3E',
              }}
              title={`PHP ${(p.pricePerSqmPhp ?? 0).toLocaleString()}/sqm — ${p.barangay ?? ''}, ${p.city ?? ''}`}
            />
          ))}

        {selectedLat != null && selectedLng != null && (
          <Marker
            position={{ lat: selectedLat, lng: selectedLng }}
            icon={{
              url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%2310b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"%3E%3Cpath d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"%3E%3C/path%3E%3Ccircle cx="12" cy="10" r="3"%3E%3C/circle%3E%3C/svg%3E',
            }}
          />
        )}
      </MapContainer>

      {viewMode === 'heatmap' && selectedLat != null && selectedLng != null && (
        <div className="absolute left-4 top-20 z-10">
          <QuickEstimatePopup
            estimate={quickEstimate}
            isLoading={isQuickEstimateLoading}
          />
        </div>
      )}

      {viewMode === 'valuation' && showValuationPanel && (
        <ValuationPanel
          valuation={valuation.data}
          areaIntel={areaIntel}
          isAreaIntelStale={isAreaIntelStale}
          isValuationPending={valuation.isPending}
          onGenerateReport={handleGenerateReport}
          isReportPending={report.isPending}
          onClose={() => setShowValuationPanel(false)}
          selectedLat={selectedLat}
          selectedLng={selectedLng}
          riskScores={riskScores}
          isRiskScoresLoading={isRiskScoresLoading}
        />
      )}
    </div>
  );
}

export default function MapPage(): React.ReactNode {
  return (
    <MapProvider>
      <MapContent />
    </MapProvider>
  );
}
