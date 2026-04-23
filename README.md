# Reverse Proxy Server

A lightweight, configurable reverse proxy server built with **Node.js** and **Express**. It routes incoming HTTP requests to multiple local backend services, exposes them via **Ngrok** tunnels, and provides beautiful request/response logging with full body capture.

---

## Features

- **Dynamic Routing** — Route traffic to multiple backend services using path prefixes (e.g., `/ledger`, `/kms`, `/app`).
- **Ngrok Integration** — Automatically creates a secure public tunnel for local development.
- **Request/Response Logging** — Colorful, detailed logs with captured request and response bodies (skips in production).
- **Raw Body Support** — Handles any content type, including large payloads up to 50 MB.
- **Error Handling** — Graceful handling of unreachable backends (502 Bad Gateway) and timeouts (504 Gateway Timeout).
- **Health Check** — Root endpoint (`/`) returns proxy status and available routes.

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

### Backend Routes

Backends are defined inside `server.js` in the `ROUTES` object:

```js
const ROUTES = {
  kms: 3600,
  ledger: 3500,
  app: 8000,
  ledger2: 3501,
  kms2: 3601,
};
```

Any request to `/{appName}/*` will be proxied to `http://127.0.0.1:{port}/*`.

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

| Request | Proxied To |
|---------|-----------|
| `GET /ledger/accounts` | `http://127.0.0.1:3500/accounts` |
| `POST /kms/encrypt` | `http://127.0.0.1:3600/encrypt` |
| `GET /app/users?id=1` | `http://127.0.0.1:8000/users?id=1` |

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
├── index.js             # Legacy CommonJS proxy (http-proxy-middleware)
├── requestLogger.js     # Express middleware for request/response logging
├── server.js            # Main ESM proxy server with Ngrok support
├── package.json         # Project metadata and dependencies
└── README.md            # This file
```

- **`server.js`** — Main entry point. Uses native `http`/`https` modules for proxying and integrates Ngrok.
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
