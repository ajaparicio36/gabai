FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
COPY . .
RUN HUSKY=0 pnpm install --frozen-lockfile
RUN npx prisma generate --schema=libs/platform/prisma/schema.prisma
RUN pnpm nx build @gavai/nest

FROM node:22-alpine AS prod
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/gavai/nest/dist ./apps/gavai/nest/dist
EXPOSE 3000
CMD ["node", "apps/gavai/nest/dist/main.js"]
