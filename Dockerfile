# ==========================================
# STAGE 1: Dependency Builder
# ==========================================
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy dependency configuration files
COPY package*.json ./

# Install all dependencies (production + dev for optional build/migration scripts)
RUN npm ci --quiet

# ==========================================
# STAGE 2: Lightweight Runner
# ==========================================
FROM node:20-alpine AS runner

# Set production environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Set working directory
WORKDIR /app

# Copy production package.json and built node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Copy application source directories and files
COPY src/ ./src
COPY .env.example ./

# Expose microservice REST port
EXPOSE 3000

# Start Node.js microservice API entrypoint
CMD ["node", "src/index.js"]
