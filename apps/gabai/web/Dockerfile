FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/gabai/web/package.json apps/gabai/web/
RUN pnpm install --frozen-lockfile --prod

FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm nx build @gabai/web

FROM node:22-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/gabai/web/.next/standalone ./
COPY --from=build /app/apps/gabai/web/.next/static ./apps/gabai/web/.next/static
COPY --from=build /app/apps/gabai/web/public ./apps/gabai/web/public
EXPOSE 4200
CMD ["node", "apps/gabai/web/server.js"]
