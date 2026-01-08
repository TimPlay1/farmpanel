# Farmer Panel - Production Dockerfile for Coolify
FROM node:20-alpine

# Install vips for sharp (prebuilt binary support)
RUN apk add --no-cache vips

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with sharp prebuilt for linux-x64
RUN npm ci --omit=dev

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
