# Build stage
FROM node:20.13-bookworm AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first (for better caching)
COPY package*.json tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src/ ./src/

# Build the application
RUN npm run build

# Runtime stage
ARG TARGETPLATFORM=linux/amd64
FROM --platform=$TARGETPLATFORM node:20.13-bookworm AS runtime

# Install runtime dependencies and setup system
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    gnupg \
    ca-certificates \
    git \
    python3 \
    libnss3-dev \
    libatk-bridge2.0-dev \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libxss1 \
    libasound2 \
    sudo \
    tzdata \
    && rm -rf /var/lib/apt/lists/*

# Set timezone
ENV TZ=Europe/Helsinki
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Create user and setup permissions
RUN groupadd -r kulot && \
    useradd -r -g kulot -m kulot && \
    usermod -aG sudo kulot && \
    echo 'kulot ALL=(ALL) NOPASSWD: ALL' >> /etc/sudoers && \
    mkdir -p /home/kulot/.npm /home/kulot/.npm-global /home/kulot/.claude && \
    chown -R kulot:kulot /home/kulot

WORKDIR /app

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Install global tools as root
RUN npm install -g @anthropic-ai/claude-code @playwright/mcp@latest

# Setup user environment
USER kulot
RUN npx playwright install chromium && \
    npm config set prefix '/home/kulot/.npm-global' && \
    echo '{}' > /home/kulot/.claude/claude.json && \
    ln -sf /home/kulot/.claude/claude.json /home/kulot/.claude.json

# Set environment variables
ENV PATH="/home/kulot/.npm-global/bin:/usr/local/bin:$PATH"
ENV npm_config_prefix="/home/kulot/.npm-global"

# Change ownership of app directory
USER root
RUN chown -R kulot:kulot /app
USER kulot

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3000/ || exit 1

CMD ["npm", "run", "start"]