'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { MapProvider, defaultCenter } from '@/providers/MapProvider';
import { MapContainer, Marker, InfoWindow } from '@/components/MapContainer';
import { HeatmapLayer } from '@/components/HeatmapLayer';
import { FilterBar, type HeatmapFilters } from '@/components/FilterBar';
import { QuickEstimatePopup } from '@/components/QuickEstimatePopup';
import { ValuationPanel } from '@/components/ValuationPanel';
import { ComparablesPanel } from '@/components/ComparablesPanel';
import { OnboardingProvider } from '@/components/onboarding/OnboardingProvider';
import { OnboardingTour } from '@/components/onboarding/OnboardingTour';
import { useHeatmap } from '@/hooks/useHeatmap';
import { useQuickEstimate } from '@/hooks/useQuickEstimate';
import { useValuation } from '@/hooks/useValuation';
import { useAreaIntel } from '@/hooks/useAreaIntel';
import { useGenerateReport } from '@/hooks/useReport';
import { useRiskScores } from '@/hooks/useRiskScores';
import { useListings } from '@/hooks/useListings';
import { useComparables } from '@/hooks/useComparables';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LogOut, Settings, Satellite, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { NearbyProperty } from '@/types/api';

const LISTING_PIN_ICON = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="#2563eb" stroke="#ffffff" stroke-width="2"/><circle cx="12" cy="10" r="3" fill="#ffffff"/></svg>',
)}`;

const SELECTED_PIN_ICON = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="#10b981" stroke="#ffffff" stroke-width="2"/><circle cx="12" cy="10" r="3" fill="#ffffff"/></svg>',
)}`;

function MapContent(): React.ReactNode {
  const { user, logout, isLoading } = useAuth();
  const router = useRouter();

  const [showHeatmap, setShowHeatmap] = useState(true);
  const [filters, setFilters] = useState<HeatmapFilters>({
    propertyType: 'all',
    priceMin: 0,
    priceMax: 500000,
  });
  const [selectedLat, setSelectedLat] = useState<number | null>(null);
  const [selectedLng, setSelectedLng] = useState<number | null>(null);
  const [selectedListing, setSelectedListing] = useState<NearbyProperty | null>(
    null,
  );
  const [showValuationPanel, setShowValuationPanel] = useState(false);
  const [showComparablesPanel, setShowComparablesPanel] = useState(false);
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

  const bboxQuery = '120.6,14.0,121.4,15.0';
  const heatmapParams = {
    bbox: bboxQuery,
    propertyType:
      filters.propertyType === 'all' ? undefined : filters.propertyType,
    priceMin: filters.priceMin,
    priceMax: filters.priceMax,
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

  const { data: comparables, isLoading: isComparablesLoading } = useComparables(
    selectedLat,
    selectedLng,
    filters.propertyType === 'all' ? undefined : filters.propertyType,
  );

  const listingsBounds = {
    minLat: 14.0,
    minLng: 120.6,
    maxLat: 15.0,
    maxLng: 121.4,
  };
  const { data: listings } = useListings(
    listingsBounds.minLat,
    listingsBounds.minLng,
    listingsBounds.maxLat,
    listingsBounds.maxLng,
    filters.propertyType === 'all' ? undefined : filters.propertyType,
    filters.priceMin,
    filters.priceMax,
  );

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/auth/login');
    }
  }, [user, isLoading, router]);

  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    setSelectedLat(lat);
    setSelectedLng(lng);
    setSelectedListing(null);
  }, []);

  const handleTileClick = useCallback((lat: number, lng: number) => {
    setSelectedLat(lat);
    setSelectedLng(lng);
    setSelectedListing(null);
  }, []);

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
    <OnboardingProvider>
      <div className="relative h-screen w-full">
        <div className="absolute left-4 top-4 z-10 flex items-center gap-2">
          <span className="rounded-md bg-background/90 px-3 py-1.5 text-sm font-medium shadow backdrop-blur border-l-2 border-l-secondary">
            GAVAI
          </span>
          <button
            onClick={() => setShowHeatmap((v) => !v)}
            className="rounded-md bg-background/90 px-3 py-1.5 text-sm font-medium shadow backdrop-blur border"
          >
            {showHeatmap ? (
              <Eye className="inline h-4 w-4 mr-1" />
            ) : (
              <EyeOff className="inline h-4 w-4 mr-1" />
            )}
            Heatmap
          </button>
          <SatelliteToggle />
        </div>

        {showHeatmap && (
          <div className="absolute left-4 top-[4.5rem] z-10 rounded-md bg-background/90 px-3 py-2 text-xs shadow backdrop-blur border">
            <p className="font-medium mb-1.5">Price per sqm</p>
            <div className="flex items-center gap-0.5">
              <span
                className="h-3 flex-1 rounded-l-sm"
                style={{ backgroundColor: '#22c55e' }}
              />
              <span
                className="h-3 flex-1"
                style={{ backgroundColor: '#f97316' }}
              />
              <span
                className="h-3 flex-1 rounded-r-sm"
                style={{ backgroundColor: '#ef4444' }}
              />
            </div>
            <div className="flex justify-between mt-0.5 text-[10px] text-muted-foreground">
              <span>Lower</span>
              <span>Mid-range</span>
              <span>Higher</span>
            </div>
          </div>
        )}

        <div
          data-ob="filter-bar"
          className="absolute bottom-4 left-4 right-4 z-10 rounded-lg border bg-background/90 p-3 shadow backdrop-blur border-t-2 border-t-secondary"
        >
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
          defaultZoom={10}
          center={defaultCenter}
          mapTypeId={mapTypeId}
          tilt={mapTypeId === 'satellite' ? 45 : 0}
          restriction={{
            latLngBounds: {
              north: 15.0,
              south: 14.0,
              east: 121.4,
              west: 120.6,
            },
            strictBounds: true,
          }}
        >
          {showHeatmap && heatmapData?.features && (
            <HeatmapLayer
              features={heatmapData.features}
              onTileClick={handleTileClick}
            />
          )}

          {listings &&
            listings.slice(0, 100).map((p) => (
              <Marker
                key={p.id}
                position={{ lat: p.lat, lng: p.lng }}
                icon={{
                  url: LISTING_PIN_ICON,
                }}
                title={`PHP ${(p.pricePerSqmPhp ?? 0).toLocaleString()}/sqm — ${p.barangay ?? ''}, ${p.city ?? ''}`}
                onClick={() => setSelectedListing(p)}
              />
            ))}

          {selectedListing && (
            <InfoWindow
              position={{ lat: selectedListing.lat, lng: selectedListing.lng }}
              onCloseClick={() => setSelectedListing(null)}
            >
              <div className="min-w-[200px] space-y-1 p-1">
                {selectedListing.photoUrls &&
                  selectedListing.photoUrls.length > 0 && (
                    <img
                      src={selectedListing.photoUrls[0]}
                      alt={selectedListing.propertyType}
                      className="w-full max-w-[200px] h-24 object-cover rounded-md"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                <p className="text-sm font-semibold capitalize">
                  {selectedListing.propertyType.replace(/_/g, ' ')}
                </p>
                <p className="text-sm font-medium">
                  PHP {selectedListing.askingPricePhp.toLocaleString()}
                </p>
                {selectedListing.pricePerSqmPhp && (
                  <p className="text-xs text-muted-foreground">
                    PHP {selectedListing.pricePerSqmPhp.toLocaleString()}/sqm
                  </p>
                )}
                {(selectedListing.lotAreaSqm ||
                  selectedListing.floorAreaSqm) && (
                  <p className="text-xs text-muted-foreground">
                    {selectedListing.lotAreaSqm
                      ? `${selectedListing.lotAreaSqm} sqm lot`
                      : ''}
                    {selectedListing.lotAreaSqm && selectedListing.floorAreaSqm
                      ? ' · '
                      : ''}
                    {selectedListing.floorAreaSqm
                      ? `${selectedListing.floorAreaSqm} sqm floor`
                      : ''}
                  </p>
                )}
                {(selectedListing.barangay || selectedListing.city) && (
                  <p className="text-xs text-muted-foreground">
                    {[selectedListing.barangay, selectedListing.city]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                )}
                {(selectedListing.bedrooms != null ||
                  selectedListing.bathrooms != null) && (
                  <p className="text-xs text-muted-foreground">
                    {selectedListing.bedrooms != null
                      ? `${selectedListing.bedrooms} bed`
                      : ''}
                    {selectedListing.bedrooms != null &&
                    selectedListing.bathrooms != null
                      ? ' · '
                      : ''}
                    {selectedListing.bathrooms != null
                      ? `${selectedListing.bathrooms} bath`
                      : ''}
                  </p>
                )}
              </div>
            </InfoWindow>
          )}

          {selectedLat != null && selectedLng != null && (
            <Marker
              position={{ lat: selectedLat, lng: selectedLng }}
              icon={{
                url: SELECTED_PIN_ICON,
              }}
            />
          )}
        </MapContainer>

        {selectedLat != null && selectedLng != null && (
          <div className="absolute left-4 top-20 z-10" data-ob="quick-estimate">
            <QuickEstimatePopup
              estimate={quickEstimate}
              isLoading={isQuickEstimateLoading}
              onViewComparables={() => setShowComparablesPanel(true)}
            />
          </div>
        )}

        {showValuationPanel && (
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

        {showComparablesPanel && (
          <ComparablesPanel
            open={showComparablesPanel}
            onClose={() => setShowComparablesPanel(false)}
            comparables={comparables}
            isLoading={isComparablesLoading}
            medianPrice={quickEstimate?.medianPhp ?? null}
            count={quickEstimate?.comparablesCount}
            radiusM={3000}
          />
        )}

        {selectedLat != null && selectedLng != null && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-10">
            <Button
              size="lg"
              className="shadow-lg rounded-full px-6 py-3 text-base"
              onClick={() => {
                setShowValuationPanel(true);
                valuation.mutate({
                  lat: selectedLat,
                  lng: selectedLng,
                  propertyType:
                    filters.propertyType === 'all'
                      ? 'house_and_lot'
                      : filters.propertyType,
                });
              }}
            >
              Valuate This Location
            </Button>
          </div>
        )}

        <OnboardingTour />
      </div>
    </OnboardingProvider>
  );
}

export default function MapPage(): React.ReactNode {
  return (
    <MapProvider>
      <MapContent />
    </MapProvider>
  );
}
