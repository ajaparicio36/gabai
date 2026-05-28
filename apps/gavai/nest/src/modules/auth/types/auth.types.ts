export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  tier: string;
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}
