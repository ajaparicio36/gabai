FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/gabai/nest/package.json apps/gabai/nest/
COPY libs/platform/package.json libs/platform/
RUN pnpm install --frozen-lockfile --prod

FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm nx build @gabai/nest

FROM node:22-alpine AS prod
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/apps/gabai/nest/dist ./apps/gabai/nest/dist
EXPOSE 3000
CMD ["node", "apps/gabai/nest/dist/main.js"]
