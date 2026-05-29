FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/gavai/web/package.json apps/gavai/web/
RUN HUSKY=0 pnpm install --frozen-lockfile --prod

FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
COPY . .
RUN HUSKY=0 pnpm install --frozen-lockfile
RUN pnpm nx build @gavai/web

FROM node:22-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/gavai/web/.next/standalone ./
COPY --from=build /app/apps/gavai/web/.next/static ./apps/gavai/web/.next/static
COPY --from=build /app/apps/gavai/web/public ./apps/gavai/web/public
EXPOSE 4200
CMD ["node", "apps/gavai/web/server.js"]
