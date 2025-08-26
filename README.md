# Külot! 🩲

Tool for running certain ai cli tool in docker so you can use it as a rest api for building automations.  
Main point is if you already have a subscription, to use same subscription as if it was api without needing to pay for api usage separately for personal use.

Includes headles browser and website content simplification tools for building scraping based automations.  

## Local Development

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Docker Setup

### Environment Configuration

Create a `.env` file in the project root with required environment variables:

```bash
# Required API key for authentication
API_KEY=your_secure_api_key_here

# Optional - defaults to production
NODE_ENV=production
```

### Volume Configuration

The service uses the following volumes:

- **`claude-session`**: Named Docker volume that persists Claude CLI authentication data at `/home/kulot/.claude`
- Ensures authentication survives container restarts and rebuilds

### Initial Authentication (One-time)

After deploying the container you will need to ssh into the container and log in to claude. It will hold session in the mounted volume.  

1. Build and run interactive container:
   ```bash
   docker-compose build
   docker-compose run --rm kulot bash
   ```

2. Inside container, authenticate with Claude subscription:
   ```bash
   claude auth login
   ```

3. Exit container - authentication persists in the `claude-session` volume

### Start Service

```bash
docker-compose up -d
```

### Verify Authentication

```bash
docker-compose exec kulot claude auth status
```

### Health Check

The service includes a health check that:
- Tests HTTP connectivity on `http://localhost:3000/`
- Runs every 30 seconds with 10s timeout
- Allows 40s startup time with 3 retries

## API Usage

### Example summarization api

```bash
http POST localhost:3000/api/url-summary Authorization:"Bearer your_api_key_here" url="https://example.com"
```

will return  

```markdown
[example.com](https://example.com) Short descrption of example.com
```

