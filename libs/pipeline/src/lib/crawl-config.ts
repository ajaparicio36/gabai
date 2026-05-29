export type PaginationPattern = 'query' | 'path';

export interface SiteDefaults {
  paginationPattern: PaginationPattern;
  paramName?: string;
  pathPrefix?: string;
  startPage: number;
  requestDelayMs: number;
}

export const SITE_DEFAULTS: Record<string, SiteDefaults> = {
  lamudi: {
    paginationPattern: 'query',
    paramName: 'page',
    startPage: 1,
    requestDelayMs: 3000,
  },
  onepropertee: {
    paginationPattern: 'query',
    paramName: 'page',
    startPage: 1,
    requestDelayMs: 3000,
  },
  hoppler: {
    paginationPattern: 'path',
    pathPrefix: 'page',
    startPage: 1,
    requestDelayMs: 3000,
  },
  dotproperty: {
    paginationPattern: 'query',
    paramName: 'page',
    startPage: 1,
    requestDelayMs: 3000,
  },
  realph: {
    paginationPattern: 'query',
    paramName: 'page',
    startPage: 1,
    requestDelayMs: 3000,
  },
  presello: {
    paginationPattern: 'query',
    paramName: 'page',
    startPage: 1,
    requestDelayMs: 3000,
  },
  filipinohomes: {
    paginationPattern: 'query',
    paramName: 'page',
    startPage: 1,
    requestDelayMs: 3000,
  },
};

export function buildPageUrl(
  baseUrl: string,
  page: number,
  defaults: SiteDefaults,
): string {
  const url = new URL(baseUrl);
  if (defaults.paginationPattern === 'query' && defaults.paramName) {
    url.searchParams.set(defaults.paramName, String(page));
  } else if (defaults.paginationPattern === 'path' && defaults.pathPrefix) {
    url.pathname = `${url.pathname.replace(/\/$/, '')}/${defaults.pathPrefix}/${page}`;
  }
  return url.toString();
}

export interface CrawlListingPreview {
  url: string;
  title: string | null;
  hasPrice: boolean;
  pricePreview: string | null;
  hasArea: boolean;
  areaPreview: string | null;
}

export interface CrawlPageResult {
  listings: CrawlListingPreview[];
  hasNextPage: boolean;
  nextPageUrl: string | null;
  confidence: 'high' | 'medium' | 'low';
}

export interface CrawlProgress {
  seedId: string;
  page: number;
  totalPages: number;
  urlsFound: number;
  urlsSkipped: number;
  status: 'running' | 'completed' | 'failed';
}
