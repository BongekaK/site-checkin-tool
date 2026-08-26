# Stage 1: Build & Compile Native Addons
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Install build dependencies for better-sqlite3 native compilation
RUN apk add --no-cache python3 make g++

# Copy package files and install ALL dependencies
COPY package*.json ./
RUN npm ci

# Copy source and configurations
COPY tsconfig.json ./
COPY copy-public.js ./
COPY src/ ./src/

# Compile TypeScript and copy static files to dist/
RUN npm run build

# Prune devDependencies to keep node_modules production-only and pre-compiled
RUN npm prune --production

# Stage 2: Production Runner
FROM node:20-alpine AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV PORT=8080
ENV DB_PATH=/usr/src/app/data/visits.db

# Copy built application and production-only compiled dependencies
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package.json ./package.json

# Ensure data folder exists for SQLite database storage
RUN mkdir -p /usr/src/app/data

EXPOSE 8080

CMD ["node", "dist/index.js"]
