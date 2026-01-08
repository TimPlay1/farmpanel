# Farmer Panel - Production Dockerfile for Coolify
FROM node:20-alpine

# Install dependencies for sharp (image processing)
RUN apk add --no-cache python3 make g++ vips-dev pkgconfig

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install node-addon-api first (required for sharp build)
RUN npm install node-addon-api

# Install all dependencies
RUN npm ci --omit=dev --ignore-scripts && \
    npm rebuild sharp

# Copy application code
COPY . .

# Create data directory
RUN mkdir -p /app/data

# Expose port
EXPOSE 3001

# Health check - uses panel-data endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/panel-data || exit 1

# Start the server
CMD ["node", "server.js"]
