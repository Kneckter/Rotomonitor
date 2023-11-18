### Build layer: Node.js 18 ###
FROM node:18-alpine AS build-layer
WORKDIR /app

# Install Vercel's pkg build tool
RUN npm install -g pkg

# Install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Build the self-contained application
COPY RDMMonitor.js ./
RUN pkg -t node18-alpine RDMMonitor.js

### Container ###
FROM alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build-layer /app/RDMMonitor /app/RDMMonitor
ENTRYPOINT ["/app/RDMMonitor"]