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

# Compile TypeScript
RUN npm run build

# Prune dev dependencies for production
RUN npm prune --production

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

EXPOSE 3000

# Automatically push schema to Postgres and start the NestJS app
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/main"]
