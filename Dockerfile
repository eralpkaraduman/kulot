# Use Node.js 20.13 base image (x86_64 for reliable Chrome/Playwright support)
ARG TARGETPLATFORM=linux/amd64
FROM --platform=$TARGETPLATFORM node:20.13-bookworm

# Install system dependencies for Claude Code and Playwright
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    gnupg \
    ca-certificates \
    git \
    python3 \
    python3-pip \
    build-essential \
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

# Set timezone to Europe/Helsinki
ENV TZ=Europe/Helsinki
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Set working directory
WORKDIR /app

# Copy package files first (for better caching)
COPY package*.json tsconfig.json ./

# Install Node.js dependencies
RUN npm ci

# Copy application source
COPY src/ ./src/
COPY .env ./

# Build the application
RUN npm run build

# Create non-root user with home directory and sudo access
RUN groupadd -r kulot && useradd -r -g kulot -m kulot
RUN usermod -aG sudo kulot
RUN echo 'kulot ALL=(ALL) NOPASSWD: ALL' >> /etc/sudoers
RUN chown -R kulot:kulot /app

# Create npm directories with proper permissions
RUN mkdir -p /home/kulot/.npm /home/kulot/.npm-global && chown -R kulot:kulot /home/kulot

# Switch to non-root user
USER kulot

# Install Claude Code CLI globally (system-wide) as root before switching users
USER root
RUN npm install -g @anthropic-ai/claude-code
RUN npm install -g @playwright/mcp@latest

# Switch to kulot user before installing browsers
USER kulot

# Install Playwright browsers for kulot user
RUN npx playwright install chromium
RUN ls -la /home/kulot/.cache/ms-playwright/

# Configure npm to use local prefix for user installs
RUN npm config set prefix '/home/kulot/.npm-global'
ENV PATH="/home/kulot/.npm-global/bin:/usr/local/bin:$PATH"
ENV npm_config_prefix="/home/kulot/.npm-global"

# Create initial claude.json with MCP configuration in volume directory
RUN mkdir -p /home/kulot/.claude && chown kulot:kulot /home/kulot/.claude
RUN echo '{}' > /home/kulot/.claude/claude.json
RUN chown kulot:kulot /home/kulot/.claude/claude.json

# Create symlink from home directory to volume directory
RUN ln -sf /home/kulot/.claude/claude.json /home/kulot/.claude.json

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3000/ || exit 1

# Start the application
CMD ["npm", "run", "start"]