-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Spatial index on Property coordinates for ST_DWithin queries
CREATE INDEX IF NOT EXISTS property_location_idx ON "Property"
  USING GIST (ST_SetSRID(ST_MakePoint(lng, lat), 4326));

-- Spatial index on ScrapingTarget for geospatial searches (future use)
CREATE INDEX IF NOT EXISTS scraping_target_location_idx ON "ScrapingTarget"
  USING GIST (ST_SetSRID(ST_MakePoint(0, 0), 4326));
