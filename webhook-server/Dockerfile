FROM node:22-slim

# Install curl for healthcheck
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install --production

# Copy server
COPY server.js ./

# Expose port
EXPOSE 3001

# Run server
CMD ["node", "server.js"]
