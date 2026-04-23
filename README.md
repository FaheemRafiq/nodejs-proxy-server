# Reverse Proxy Server

A lightweight, configurable reverse proxy server built with **Node.js** and **Express**. It routes incoming HTTP requests to multiple local backend services, exposes them via **Ngrok** tunnels, and provides beautiful request/response logging with full body capture.

---

## Features

- **Dynamic Routing** — Route traffic to multiple backend services using path prefixes (e.g., `/ledger`, `/kms`, `/app`).
- **Ngrok Integration** — Automatically creates a secure public tunnel for local development.
- **Request/Response Logging** — Colorful, detailed logs with captured request and response bodies (skips in production).
- **Raw Body Support** — Handles any content type, including large payloads up to 50 MB.
- **Error Handling** — Graceful handling of unreachable backends (502 Bad Gateway) and timeouts (504 Gateway Timeout).
- **Default Fallback Port** — Requests to unknown app names are automatically proxied to a configurable default port instead of returning 404.
- **Health Check** — Root endpoint (`/`) returns proxy status, available routes, and the configured default port.

---

## Installation

```bash
# Clone the repository
git clone <repo-url>
cd reverse-proxy-server

# Install dependencies
pnpm install
```

---

## Configuration

### 1. Environment Variables

Create a `.env` file in the project root (see `.env.example`):

```env
# Server port (default: 8888)
PORT=8888

# Ngrok authentication token (required for public tunnels)
NGROK_AUTHTOKEN=your_ngrok_authtoken_here

# Custom Ngrok domain (optional)
NGROK_DOMAIN=your-domain.ngrok-free.app

# Node environment (set to 'production' to disable verbose logging)
NODE_ENV=development
```

### 2. Application Routes

Backend routes are defined in **`config.js`** (not committed to Git).

1. Copy the example file:
   ```bash
   cp config.example.js config.js
   ```

2. Edit `config.js` to match your local services:
   ```js
   export const ROUTES = {
     kms: 3600,
     ledger: 3500,
     app: 8000,
     ledger2: 3501,
     kms2: 3601,
   };

   export const DEFAULT_PORT = 8000;
   ```

Any request to `/{appName}/*` will be proxied to `http://127.0.0.1:{port}/*`.

If `appName` is not found in `ROUTES`, the request is forwarded to the **`DEFAULT_PORT`** instead of returning a 404 error.

---

## Usage

### Start the Proxy Server

```bash
pnpm start
```

This will:
1. Start the Express server on the configured `PORT` (default `8888`).
2. Attempt to establish an Ngrok tunnel using your `NGROK_AUTHTOKEN` and optional `NGROK_DOMAIN`.
3. Print available routes and example URLs to the console.

### Example Requests

Assuming the proxy is running on `http://localhost:8888`:

| Request | Proxied To | Note |
|---------|-----------|------|
| `GET /ledger/accounts` | `http://127.0.0.1:3500/accounts` | Known app (`ledger`) |
| `POST /kms/encrypt` | `http://127.0.0.1:3600/encrypt` | Known app (`kms`) |
| `GET /app/users?id=1` | `http://127.0.0.1:8000/users?id=1` | Known app (`app`) |
| `POST /unknown/webhook` | `http://127.0.0.1:8000/webhook` | Unknown app → **default port** |

### Health Check

```bash
curl http://localhost:8888/
```

Response:
```json
{
  "message": "Webhook Proxy Active",
  "uptime": 123.45,
  "applications": { "kms": 3600, "ledger": 3500, "app": 8000, "ledger2": 3501, "kms2": 3601 },
  "defaultPort": 8000,
  "timestamp": "2026-04-23T12:00:00.000Z"
}
```

---

## Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `start` | `nodemon server.js` | Run the proxy server with auto-reload |
| `test` | `echo "Error: no test specified" && exit 1` | Placeholder for tests |

---

## Project Structure

```
reverse-proxy-server/
├── .env                 # Environment variables (not committed)
├── .env.example         # Example environment file
├── .gitignore           # Git ignore rules
├── config.js            # Local app routing configuration (not committed)
├── config.example.js    # Example routing configuration
├── index.js             # Legacy CommonJS proxy (http-proxy-middleware)
├── requestLogger.js     # Express middleware for request/response logging
├── server.js            # Main ESM proxy server with Ngrok support
├── package.json         # Project metadata and dependencies
└── README.md            # This file
```

- **`server.js`** — Main entry point. Uses native `http`/`https` modules for proxying and integrates Ngrok.
- **`config.js`** — Local routing map. Defines which app names map to which local ports. Ignored by Git.
- **`config.example.js`** — Committed example of the routing configuration.
- **`index.js`** — Older implementation using `http-proxy-middleware` (CommonJS). Kept for reference.
- **`requestLogger.js`** — Middleware that captures and pretty-prints request/response bodies with `chalk` coloring.

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `express` | Web framework |
| `http-proxy` / `http-proxy-middleware` | Proxying utilities |
| `@ngrok/ngrok` | Ngrok tunnel integration |
| `chalk` | Terminal string styling |
| `morgan` | HTTP request logger (available, used via custom middleware) |
| `dotenv` | Environment variable loading |
| `nodemon` | Development auto-reload |
| `on-finished` | Executes callback when response is finished |
| `raw-body` | Raw body parsing helper |

---

## License

ISC
