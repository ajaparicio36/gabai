export interface OnboardingStep {
  id: string;
  targetSelector: string | null;
  title: string;
  description: string;
  placement: 'top' | 'bottom' | 'left' | 'right' | 'center';
  sideOffset?: number;
  route?: string;
}

export const MAP_ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'view-modes',
    targetSelector: '[data-ob="view-toggle"]',
    title: 'View Modes',
    description:
      'Switch between three map views: Heatmap shows price density as colored zones, Listings shows individual property markers, and Valuation lets you click anywhere to get a full property appraisal.',
    placement: 'bottom',
    sideOffset: 16,
  },
  {
    id: 'the-map',
    targetSelector: null,
    title: 'The Map',
    description:
      'Pan and zoom to explore Metro Manila. Click the Satellite button (top-left) to toggle between roadmap and satellite imagery. Click anywhere on the map to interact with the current view mode.',
    placement: 'center',
  },
  {
    id: 'heatmap-mode',
    targetSelector: '[data-ob="view-toggle"] [data-ob="heatmap"]',
    title: 'Heatmap Mode',
    description:
      'Colored polygons show price-per-sqm density. Green zones are more affordable, red zones are premium. Click any colored area to see a quick price estimate.',
    placement: 'bottom',
    sideOffset: 16,
  },
  {
    id: 'filter-bar',
    targetSelector: '[data-ob="filter-bar"]',
    title: 'Filtering',
    description:
      'Narrow results by Property Type (Residential Lot, House & Lot, Condo, Commercial) and Price Range up to PHP 500K/sqm. Filters apply to both the heatmap and listings.',
    placement: 'top',
    sideOffset: 16,
  },
  {
    id: 'quick-estimate',
    targetSelector: '[data-ob="quick-estimate"]',
    title: 'Quick Estimate',
    description:
      'After clicking a heatmap area, this card shows the median price per sqm, the low-high range, and how many comparable properties were used in the calculation.',
    placement: 'right',
    sideOffset: 16,
  },
  {
    id: 'valuation-mode',
    targetSelector: '[data-ob="view-toggle"] [data-ob="valuation"]',
    title: 'Valuation Mode',
    description:
      'Switch to Valuation, then click any location on the map. A detailed valuation panel will slide in from the right with your full property appraisal.',
    placement: 'bottom',
    sideOffset: 16,
  },
  {
    id: 'valuation-panel',
    targetSelector: '[data-ob="valuation-panel"]',
    title: 'Valuation Panel',
    description:
      'This slide-in panel shows your estimated property value, confidence score, BIR compliance check, risk radar chart (flood, traffic, yield, market, fault-line), and area intelligence.',
    placement: 'left',
    sideOffset: -8,
  },
  {
    id: 'confidence-bir',
    targetSelector: '[data-ob="confidence-badges"]',
    title: 'Confidence & BIR Badges',
    description:
      'The confidence badge shows how reliable the estimate is based on nearby comparables. The BIR badge compares the valuation against government zonal values — green means fair pricing, yellow means slightly above, red means well above.',
    placement: 'bottom',
    sideOffset: 16,
  },
  {
    id: 'ready',
    targetSelector: null,
    title: "You're Ready!",
    description:
      'Explore property prices across Metro Manila. Toggle between modes, click the map, filter results, and generate valuation reports. This tour is always available from the Admin menu if you need a refresher.',
    placement: 'center',
  },
];

export const ADMIN_ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'admin-sidebar',
    targetSelector: '[data-ob="admin-sidebar"]',
    title: 'Admin Pipeline',
    description:
      'The admin panel has 4 stages that form a pipeline: Discover finds property listings, Scrape extracts their data, Normalize cleans and validates it, and Model trains the AI valuation engine.',
    placement: 'right',
    sideOffset: 16,
    route: '/admin/discover',
  },
  {
    id: 'discover-form',
    targetSelector: '[data-ob="discover-form"]',
    title: 'Discover Properties',
    description:
      'Start here. Enter a location like "Lahug, Cebu City" and choose a property type. Click Discover to search listing platforms for matching URLs.',
    placement: 'bottom',
    sideOffset: 16,
    route: '/admin/discover',
  },
  {
    id: 'discover-urls',
    targetSelector: '[data-ob="discover-urls-table"]',
    title: 'Review & Approve URLs',
    description:
      'Found URLs appear in this table. Check the ones you want to send forward, then click Approve to queue them for scraping.',
    placement: 'top',
    sideOffset: 16,
    route: '/admin/discover',
  },
  {
    id: 'scrape-run',
    targetSelector: '[data-ob="scrape-run"]',
    title: 'Run Scraping',
    description:
      'Approved URLs need data extraction. Click Run Scrape to start background jobs. The queue badge shows real-time scraper and enrichment progress with a pulsing dot when busy.',
    placement: 'bottom',
    sideOffset: 16,
    route: '/admin/scrape',
  },
  {
    id: 'scrape-records',
    targetSelector: '[data-ob="scrape-records-table"]',
    title: 'Approve or Reject Records',
    description:
      'Review extracted records. Check for flagged items (data quality issues). Approve good records to move them to normalization, or reject bad data.',
    placement: 'top',
    sideOffset: 16,
    route: '/admin/scrape',
  },
  {
    id: 'normalize-review',
    targetSelector: '[data-ob="normalize-table"]',
    title: 'Normalize & Validate',
    description:
      'The system auto-normalizes fields and assigns a confidence score. Review records by status: ready, low confidence, and failed. Only approve training-eligible items (sufficient data, not flagged). Use "Reject All Failed" to quickly clear bad records.',
    placement: 'top',
    sideOffset: 16,
    route: '/admin/normalize',
  },
  {
    id: 'model-pool',
    targetSelector: '[data-ob="model-pool"]',
    title: 'Training Pool',
    description:
      'Shows how many approved records are ready by property type. A minimum of 20 records is required. The Retrain Model button activates once the pool is sufficient.',
    placement: 'bottom',
    sideOffset: 16,
    route: '/admin/model',
  },
  {
    id: 'model-deploy',
    targetSelector: '[data-ob="model-version-cards"]',
    title: 'Train & Deploy',
    description:
      'Click Retrain Model to start training. Monitor MAPE (Mean Absolute Percentage Error) — lower is better. When a new version looks good, click Promote to Deployed to make it the active model in production.',
    placement: 'top',
    sideOffset: 16,
    route: '/admin/model',
  },
];
