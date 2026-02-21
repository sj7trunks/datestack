# Build stage for frontend
FROM node:20-slim AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# Build stage for server
FROM node:20-slim AS server-builder

WORKDIR /app/server

COPY server/package*.json ./
RUN npm ci

COPY server/ ./
RUN npm run build

# Production stage
FROM node:20-slim

WORKDIR /app

# Install production dependencies only
COPY server/package*.json ./
RUN npm ci --only=production

# Copy built server
COPY --from=server-builder /app/server/dist ./dist

# Copy built frontend to serve statically
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Create data directory for SQLite
RUN mkdir -p /app/data

# Environment variables
ENV NODE_ENV=production
ENV PORT=8080
ENV DATABASE_URL=/app/data/datestack.db

# Run as non-root user for security
RUN addgroup --system --gid 1001 datestack && \
    adduser --system --uid 1001 --ingroup datestack datestack && \
    chown -R datestack:datestack /app
USER datestack

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Run the server
CMD ["node", "dist/index.js"]
