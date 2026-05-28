# 03 — Auth System

## Overview

Three auth mechanisms, layered by access tier:

| Mechanism                  | Scope                                             | Tier Required     |
| -------------------------- | ------------------------------------------------- | ----------------- |
| JWT access + refresh token | User session (login, profile, area intel)         | Free (registered) |
| Admin JWT role guard       | Admin dashboard (discover, scrape, train, deploy) | Admin role        |
| API key (Bearer token)     | Paid endpoints: `/valuation`, `/report/*`         | Paid              |

---

## User Model

```prisma
model User {
  id             String         @id @default(cuid())
  email          String         @unique
  passwordHash   String
  role           String         @default("user")   // "user" | "admin"
  tier           String         @default("free")   // "free" | "paid"
  emailVerified  Boolean        @default(false)
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt
  refreshTokens  RefreshToken[]
  apiKeys        ApiKey[]
}
```

**Roles:**

- `user` — registered user, can access area intelligence
- `admin` — full admin dashboard access

**Tiers:**

- `free` — heatmap, listings, area intelligence (rate limited)
- `paid` — valuation, reports (API key required, Xendit-billed)

---

## JWT Access + Refresh Token Flow

### Token Specs

| Token   | Format                                                   | Expiry     | Storage                        |
| ------- | -------------------------------------------------------- | ---------- | ------------------------------ |
| Access  | JWT (HS256), signed with `JWT_SECRET`                    | 15 minutes | Client memory only             |
| Refresh | Opaque token (crypto.randomBytes), SHA-256 hashed for DB | 7 days     | DB (`RefreshToken`), revocable |

### Endpoints

```
POST /auth/signup          — { email, password } → { accessToken, refreshToken }
POST /auth/login           — { email, password } → { accessToken, refreshToken }
POST /auth/refresh         — { refreshToken }    → { accessToken, refreshToken } (rotated)
POST /auth/logout          — { refreshToken }    → revokes token
GET  /auth/me              — [JWT]               → { id, email, role, tier }
```

### Refresh Token Rotation

Every `/auth/refresh` call:

1. Receives the current refresh token
2. Validates it (hash matches, not expired, not revoked)
3. Revokes the old token (`revokedAt = now()`)
4. Issues a new refresh token (new opaque value, new hash, new expiry)
5. Returns new access + new refresh token

This prevents refresh token reuse — if a revoked token is presented, **all tokens for that user are revoked** (detects token theft).

```typescript
// apps/gavai/nest/src/modules/auth/auth.service.ts
async refresh(oldTokenRaw: string) {
  const oldHash = createHash('sha256').update(oldTokenRaw).digest('hex');
  const stored = await this.authRepository.findRefreshToken(oldHash);

  if (!stored) throw new UnauthorizedException('Invalid token');
  if (stored.revokedAt) {
    // Token theft detected — revoke all user tokens
    await this.authRepository.revokeAllUserTokens(stored.userId);
    throw new UnauthorizedException('Token reused — all sessions revoked');
  }
  if (new Date() > stored.expiresAt) throw new UnauthorizedException('Token expired');

  // Rotate: revoke old, issue new
  await this.authRepository.revokeRefreshToken(stored.id);
  return this.issueTokens(stored.userId);
}

async issueTokens(userId: string) {
  const user = await this.authRepository.findUserById(userId);
  const accessToken = this.jwtService.sign({ sub: user.id, email: user.email, role: user.role, tier: user.tier });

  const rawRefresh = crypto.randomBytes(48).toString('hex');
  const refreshHash = createHash('sha256').update(rawRefresh).digest('hex');
  await this.authRepository.createRefreshToken({
    userId,
    tokenHash: refreshHash,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  return { accessToken, refreshToken: rawRefresh };
}
```

### JWT Payload

```typescript
interface JwtPayload {
  sub: string; // user ID
  email: string;
  role: 'user' | 'admin';
  tier: 'free' | 'paid';
}
```

---

## Guards

### JwtAuthGuard

Standard passport JWT guard. Validates the `Authorization: Bearer <accessToken>` header. Attaches `req.user` with the JWT payload.

```typescript
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

// Usage
@UseGuards(JwtAuthGuard)
@Get('me')
async getMe(@Req() req: Request) { ... }
```

### AdminGuard

Checks `req.user.role === 'admin'`. Applied on top of `JwtAuthGuard`.

```typescript
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    return request.user?.role === 'admin';
  }
}

// Usage
@UseGuards(JwtAuthGuard, AdminGuard)
@Post('admin/discover')
async runDiscover() { ... }
```

### ApiKeyGuard

Validates an API key from the `Authorization: Bearer gavai_sk_...` header. Checks:

1. Key hash exists in DB
2. Not revoked
3. Not expired
4. User tier is `paid`
5. Within rate limit (checked separately by ThrottlerModule)

```typescript
@Injectable()
export class ApiKeyGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const key = request.headers.authorization?.replace('Bearer ', '');
    if (!key) return false;

    const keyHash = createHash('sha256').update(key).digest('hex');
    const apiKey = await this.authRepository.findApiKey(keyHash);

    if (!apiKey || apiKey.revokedAt) return false;
    if (apiKey.expiresAt && new Date() > apiKey.expiresAt) return false;
    if (apiKey.user.tier !== 'paid') return false;

    request.apiKey = apiKey;
    request.user = apiKey.user;
    return true;
  }
}
```

---

## API Key Model

```prisma
model ApiKey {
  id          String    @id @default(cuid())
  keyHash     String    @unique
  keyPrefix   String    // "gavai_sk_" — prefix for display
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tier        String    @default("free")
  rateLimit   Int       @default(100)
  expiresAt   DateTime?
  revokedAt   DateTime?
  lastUsedAt  DateTime?
  createdAt   DateTime  @default(now())
}
```

### Endpoints

```
POST   /auth/api-keys           — [JWT] generate new API key, returns full key once
GET    /auth/api-keys           — [JWT] list user's keys (prefix only, no full key)
POST   /auth/api-keys/:id/rotate — [JWT] revoke old, create new, return full key once
DELETE /auth/api-keys/:id        — [JWT] revoke key
```

API key format: `gavai_sk_<32 random hex chars>`. The full key is returned **only once** at creation/rotation. The DB stores only the SHA-256 hash. The `keyPrefix` (first 12 chars) is stored for display in the UI.

### Rate Limiting Integration

`ThrottlerModule` is configured with per-guard limits:

```typescript
// apps/gavai/nest/src/app/app.module.ts
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      // Default: free/unauthenticated endpoints
      { name: 'default', ttl: 60000, limit: 30 },
      // Authenticated users (registered, free tier)
      { name: 'user', ttl: 60000, limit: 100 },
      // Paid tier (API key)
      { name: 'paid', ttl: 60000, limit: 1000 },
    ]),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
```

Per-endpoint overrides using `@Throttle()`:

```typescript
@Post('valuation')
@UseGuards(ApiKeyGuard)
@Throttle({ paid: { limit: 100, ttl: 60000 } })
async getValuation(@Body() dto: ValuationDto) { ... }
```

---

## Xendit Payment Integration

### Flow

```
1. User registers (free tier)
2. User navigates to "Upgrade to Pro" → clicks "Pay with Xendit"
3. NestJS creates a Xendit invoice via API:
   POST /auth/payment/create-invoice → Xendit
4. Xendit returns invoice URL → user pays
5. Xendit sends webhook to POST /payment/webhook
6. NestJS verifies webhook signature, upgrades user tier to "paid",
   generates first API key
7. User sees API key in dashboard
```

### Endpoints

```
POST /auth/payment/create-invoice  — [JWT] creates Xendit invoice, returns payment URL
POST /payment/webhook              — [Xendit IP whitelist] handles payment success/failure
GET  /auth/payment/status          — [JWT] returns current tier + invoice status
```

### Sandbox Mode

Xendit sandbox uses test cards:

- Success: `5555 5555 5555 4444`
- Failure: any other card

Webhook URL must be publicly accessible for sandbox testing. Use ngrok or similar tunnel for local dev.

```typescript
// apps/gavai/nest/src/modules/payment/payment.service.ts
@Injectable()
export class PaymentService {
  constructor(private readonly config: ConfigService) {}

  async createInvoice(userId: string): Promise<{ invoiceUrl: string }> {
    const xendit = new Xendit({
      secretKey: this.config.get('XENDIT_SECRET_KEY'),
    });
    const invoice = await xendit.Invoice.createInvoice({
      externalId: `gavai_upgrade_${userId}_${Date.now()}`,
      amount: 5000, // PHP 50.00 in centavos
      payerEmail: user.email,
      description: 'GAVAI Pro — 30 days of valuations and reports',
      successRedirectUrl: `${this.config.get('WEB_URL')}/dashboard?payment=success`,
    });
    return { invoiceUrl: invoice.invoiceUrl };
  }

  async handleWebhook(payload: WebhookPayload) {
    // Verify webhook signature using Xendit's verification callback token
    if (payload.status === 'PAID') {
      const userId = payload.externalId.split('_')[2];
      await this.authRepository.upgradeUserTier(userId, 'paid');
      // Generate first API key
      await this.apiKeyService.createApiKey(userId);
    }
  }
}
```

---

## Admin Account Seeding

`libs/platform/prisma/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@gavai.dev';
  const adminPassword =
    process.env.ADMIN_PASSWORD || crypto.randomBytes(16).toString('hex');

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash,
      role: 'admin',
      tier: 'paid',
      emailVerified: true,
    },
  });

  console.log(`\nAdmin account seeded:`);
  console.log(`  Email:    ${adminEmail}`);
  console.log(`  Password: ${adminPassword}\n`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

Run via:

```bash
pnpm nx run @gavai/platform:prisma-seed
```

Or set `ADMIN_EMAIL` and `ADMIN_PASSWORD` env vars for deterministic seeding.

---

## Environment Variables (Auth)

```bash
JWT_SECRET=                  # HS256 signing key (minimum 256 bits)
JWT_ACCESS_EXPIRY=15m        # Access token lifetime
JWT_REFRESH_EXPIRY=7d        # Refresh token lifetime
BCRYPT_ROUNDS=12             # Password hashing cost factor
XENDIT_SECRET_KEY=           # Xendit API secret key (sandbox)
XENDIT_WEBHOOK_TOKEN=        # Xendit webhook verification token
WEB_URL=http://localhost:4200 # Frontend URL (for success redirect)
```
