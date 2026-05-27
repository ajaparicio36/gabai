export interface EnvConfig {
  DATABASE_URL: string;
  REDIS_URL: string;
  ML_SIDECAR_URL: string;
  JWT_SECRET: string;
  GOOGLE_MAPS_KEY: string;
  BRIGHTDATA_API_KEY: string;
  GEMINI_API_KEY: string;
  XENDIT_SECRET_KEY: string;
  NEXT_PUBLIC_GOOGLE_MAPS_KEY: string;
  ADMIN_EMAIL: string;
  ADMIN_PASSWORD: string;
  PORT: number;
  NODE_ENV: string;
}

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const defaults: Record<string, string | number> = {
    PORT: 3000,
    NODE_ENV: 'development',
    ML_SIDECAR_URL: 'http://localhost:8000',
  };

  const merged = { ...defaults, ...config };

  const requiredKeys = ['DATABASE_URL'];

  for (const key of requiredKeys) {
    if (!merged[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  return merged as unknown as EnvConfig;
}
