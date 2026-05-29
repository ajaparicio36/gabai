export interface EnvConfig {
  DATABASE_URL: string;
  REDIS_URL: string;
  REDIS_PASSWORD?: string;
  ML_SIDECAR_URL: string;
  JWT_SECRET: string;
  JWT_ACCESS_EXPIRY?: string;
  JWT_REFRESH_EXPIRY?: string;
  JWT_REFRESH_SECRET?: string;
  GOOGLE_MAPS_KEY: string;
  BRIGHTDATA_API_KEY: string;
  GEMINI_API_KEY: string;
  AIML_API_KEY?: string;
  XENDIT_SECRET_KEY: string;
  XENDIT_WEBHOOK_TOKEN?: string;
  NEXT_PUBLIC_GOOGLE_MAPS_KEY: string;
  WEB_URL?: string;
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
    JWT_ACCESS_EXPIRY: '15m',
    JWT_REFRESH_EXPIRY: '7d',
    WEB_URL: 'http://localhost:4200',
  };

  const merged = { ...defaults, ...config };

  const requiredKeys = ['DATABASE_URL', 'REDIS_URL', 'JWT_SECRET'];

  for (const key of requiredKeys) {
    if (!merged[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  return merged as unknown as EnvConfig;
}
