# Build Stage
FROM node:22-slim AS builder

WORKDIR /app

# Install openssl for Prisma
RUN apt-get update -y && apt-get install -y openssl

# Copy package configuration and prisma schema
COPY package.json package-lock.json* ./
COPY prisma ./prisma/

# Install dependencies
RUN npm install

# Generate Prisma Client
RUN npx prisma generate

# Copy source code and build configs
COPY tsconfig*.json nest-cli.json ./
COPY src ./src/
COPY media ./media/

# Compile TypeScript
RUN npm run build

# Prune dev dependencies for production
RUN npm prune --production
# Install the migration CLI separately so production pruning cannot omit its devDependency.
# Pin it to the resolved client version instead of downloading an arbitrary latest CLI at startup.
RUN npm install --prefix /opt/prisma-cli --no-package-lock --omit=dev prisma@$(node -p "require('./node_modules/@prisma/client/package.json').version")

# Production Stage
FROM node:22-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install openssl in runtime
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy built application and production dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./
COPY --from=builder /app/media ./media
COPY --from=builder /opt/prisma-cli /opt/prisma-cli

EXPOSE 3000

# Deploy SQL migrations, including partial uniqueness constraints Prisma db push cannot express.
CMD ["sh", "-c", "/opt/prisma-cli/node_modules/.bin/prisma migrate deploy --schema /app/prisma/schema.prisma && node dist/main"]
