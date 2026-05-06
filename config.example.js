/**
 * Application Routing Configuration (Example)
 *
 * 1. Copy this file to `config.js`:
 *    cp config.example.js config.js
 *
 * 2. Edit `config.js` to match your local services.
 *
 * This file is committed to Git. `config.js` is ignored.
 */

export const ROUTES = {
  // app_name: local_port
  backend: 8000,
  frontend: 3000,
  api: 4000,
  worker: 5000,
};

export const DEFAULT_PORT = 8000;

/**
 * Per-app log verbosity levels:
 *   'none'    → no logging
 *   'minimal' → method, URL, status, duration
 *   'body'    → minimal + request & response bodies
 *   'full'    → body + request & response headers
 *
 * Apps not listed here fall back to DEFAULT_VERBOSITY.
 */
export const LOG_VERBOSITY = {
  kms: 'full',
  ledger: 'minimal',
  btcapi: 'body',
};

export const DEFAULT_VERBOSITY = 'minimal';