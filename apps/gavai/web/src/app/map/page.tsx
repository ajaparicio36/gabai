'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import { useAuth } from '@/providers/AuthProvider';
import { MapProvider, defaultCenter } from '@/providers/MapProvider';
import { MapContainer, Marker, InfoWindow } from '@/components/MapContainer';
import { HeatmapLayer } from '@/components/HeatmapLayer';
import { FilterBar, type HeatmapFilters } from '@/components/FilterBar';
import { QuickEstimatePopup } from '@/components/QuickEstimatePopup';
import { ValuationPanel } from '@/components/ValuationPanel';
import { ComparablesPanel } from '@/components/ComparablesPanel';
import { DealBadge } from '@/components/DealBadge';
import { OnboardingProvider } from '@/components/onboarding/OnboardingProvider';
import { OnboardingTour } from '@/components/onboarding/OnboardingTour';
import { useHeatmap } from '@/hooks/useHeatmap';
import {
  useQuickEstimate,
  useQuickEstimateByType,
} from '@/hooks/useQuickEstimate';
import { useMultiValuation } from '@/hooks/useValuation';
import { useAreaIntel } from '@/hooks/useAreaIntel';
import { useRiskScores } from '@/hooks/useRiskScores';
import { useListings } from '@/hooks/useListings';
import { useComparables } from '@/hooks/useComparables';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LogOut, Settings, Satellite, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { NearbyProperty } from '@/types/api';

const LISTING_PIN_ICON = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="#2563eb" stroke="#ffffff" stroke-width="2"/><circle cx="12" cy="10" r="3" fill="#ffffff"/></svg>',
)}`;

const SELECTED_PIN_ICON = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="#10b981" stroke="#ffffff" stroke-width="2"/><circle cx="12" cy="10" r="3" fill="#ffffff"/></svg>',
)}`;

interface DealAwareInfoWindowProps {
  listing: NearbyProperty;
  areaMedianPhp: number | null;
}

function DealAwareInfoWindow({
  listing,
  areaMedianPhp,
}: DealAwareInfoWindowProps): React.ReactNode {
  return (
    <div className="min-w-[200px] space-y-1 p-1">
      {listing.photoUrls && listing.photoUrls.length > 0 && (
        <img
          src={listing.photoUrls[0]}
          alt={listing.propertyType}
          className="w-full max-w-[200px] h-24 object-cover rounded-md"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      )}
      <p className="text-sm font-semibold capitalize">
        {listing.propertyType.replace(/_/g, ' ')}
      </p>
      <p className="text-sm font-medium">
        PHP {listing.askingPricePhp.toLocaleString()}
      </p>
      {listing.pricePerSqmPhp && (
        <p className="text-xs text-muted-foreground">
          PHP {listing.pricePerSqmPhp.toLocaleString()}/sqm
        </p>
      )}
      <DealBadge
        listingPricePerSqm={listing.pricePerSqmPhp}
        areaMedianPerSqm={areaMedianPhp}
      />
      {(listing.lotAreaSqm || listing.floorAreaSqm) && (
        <p className="text-xs text-muted-foreground">
          {listing.lotAreaSqm ? `${listing.lotAreaSqm} sqm lot` : ''}
          {listing.lotAreaSqm && listing.floorAreaSqm ? ' · ' : ''}
          {listing.floorAreaSqm ? `${listing.floorAreaSqm} sqm floor` : ''}
        </p>
      )}
      {(listing.barangay || listing.city) && (
        <p className="text-xs text-muted-foreground">
          {[listing.barangay, listing.city].filter(Boolean).join(', ')}
        </p>
      )}
      {(listing.bedrooms != null || listing.bathrooms != null) && (
        <p className="text-xs text-muted-foreground">
          {listing.bedrooms != null ? `${listing.bedrooms} bed` : ''}
          {listing.bedrooms != null && listing.bathrooms != null ? ' · ' : ''}
          {listing.bathrooms != null ? `${listing.bathrooms} bath` : ''}
        </p>
      )}
    </div>
  );
}

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
  const { data: estimateByType } = useQuickEstimateByType(
    selectedLat,
    selectedLng,
  );
  const multiValuation = useMultiValuation();
  const { data: areaIntel, isStale: isAreaIntelStale } = useAreaIntel(
    selectedLat,
    selectedLng,
  );

  const { data: riskScores, isLoading: isRiskScoresLoading } = useRiskScores(
    selectedLat,
    selectedLng,
    showValuationPanel && !!multiValuation.data,
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
          <Image
            src="/gavai_horizontal.png"
            alt="GAVAI"
            width={100}
            height={24}
            className="h-6 w-auto"
          />
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
                  scaledSize: new google.maps.Size(56, 56),
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
              <DealAwareInfoWindow
                listing={selectedListing}
                areaMedianPhp={quickEstimate?.medianPhp ?? null}
              />
            </InfoWindow>
          )}

          {selectedLat != null && selectedLng != null && (
            <Marker
              position={{ lat: selectedLat, lng: selectedLng }}
              icon={{
                url: SELECTED_PIN_ICON,
                scaledSize: new google.maps.Size(64, 64),
              }}
            />
          )}
        </MapContainer>

        {selectedLat != null && selectedLng != null && (
          <div className="absolute left-4 top-32 z-10" data-ob="quick-estimate">
            <QuickEstimatePopup
              estimate={quickEstimate}
              estimateByType={estimateByType}
              isLoading={isQuickEstimateLoading}
              onViewComparables={() => setShowComparablesPanel(true)}
            />
          </div>
        )}

        {showValuationPanel && (
          <ValuationPanel
            valuations={multiValuation.data}
            areaIntel={areaIntel}
            isAreaIntelStale={isAreaIntelStale}
            isValuationPending={multiValuation.isPending}
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
                multiValuation.mutate({
                  lat: selectedLat,
                  lng: selectedLng,
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
