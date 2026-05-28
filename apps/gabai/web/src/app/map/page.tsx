'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { MapProvider } from '@/providers/MapProvider';
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
import { useListings } from '@/hooks/useListings';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LogOut, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

function MapContent(): React.ReactNode {
  const { user, logout, isLoading } = useAuth();
  const router = useRouter();

  const [viewMode, setViewMode] = useState<MapViewMode>('heatmap');
  const [filters, setFilters] = useState<HeatmapFilters>({
    propertyType: '',
    priceMin: 0,
    priceMax: 200000,
  });
  const [selectedLat, setSelectedLat] = useState<number | null>(null);
  const [selectedLng, setSelectedLng] = useState<number | null>(null);
  const [showValuationPanel, setShowValuationPanel] = useState(false);

  const bboxQuery = '123.7,10.1,124.0,10.5';
  const heatmapParams = {
    bbox: bboxQuery,
    propertyType: filters.propertyType || undefined,
  };

  const { data: heatmapData } = useHeatmap(heatmapParams);
  const { data: quickEstimate, isLoading: isQuickEstimateLoading } =
    useQuickEstimate(selectedLat, selectedLng);
  const valuation = useValuation();
  const { data: areaIntel, isStale: isAreaIntelStale } = useAreaIntel(
    selectedLat,
    selectedLng,
  );
  const report = useGenerateReport();

  const listingsBounds = {
    minLat: 10.1,
    minLng: 123.7,
    maxLat: 10.5,
    maxLng: 124.0,
  };
  const { data: listings } = useListings(
    listingsBounds.minLat,
    listingsBounds.minLng,
    listingsBounds.maxLat,
    listingsBounds.maxLng,
    filters.propertyType || undefined,
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
          propertyType: filters.propertyType || 'house_and_lot',
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
        <span className="rounded-md bg-background/90 px-3 py-1.5 text-sm font-medium shadow backdrop-blur">
          GABAI
        </span>
      </div>

      <ViewToggle value={viewMode} onChange={setViewMode} />

      {viewMode === 'heatmap' && (
        <div className="absolute bottom-4 left-4 right-4 z-10 rounded-lg border bg-background/90 p-3 shadow backdrop-blur">
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
        defaultZoom={13}
        center={{ lat: 10.3157, lng: 123.8854 }}
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
