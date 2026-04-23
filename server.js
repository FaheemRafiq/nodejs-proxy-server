import "dotenv/config";
import express from "express";
import http from "http";
import https from "https";
import { URL } from "url";
import ngrok from "@ngrok/ngrok";
import chalk from "chalk";
import { requestLoggerMiddleware } from "./requestLogger.js";
import { ROUTES, DEFAULT_PORT } from "./config.js";

const app = express();

app.set("trust proxy", true);
app.disable("x-powered-by");

let reqCounter = 0;
app.use((req, res, next) => {
  req.id = `#${++reqCounter}`;
  next();
});

app.use(requestLoggerMiddleware);

app.use(express.raw({ type: "*/*", limit: "50mb" }));

app.get("/status", (req, res) => {
  res.json({
    message: "Webhook Proxy Active",
    uptime: process.uptime(),
    applications: ROUTES,
    defaultPort: DEFAULT_PORT,
    timestamp: new Date().toISOString(),
  });
});

app.all("/", (req, res) => {
  const queryString = req.url.includes("?") ? req.url.substring(req.url.indexOf("?")) : "";
  const targetUrl = `http://127.0.0.1:${DEFAULT_PORT}/${queryString}`;
  proxyRequest(req, res, targetUrl);
});

function proxyRequest(req, res, targetUrl) {
  const parsedTarget = new URL(targetUrl);
  const isHttps = parsedTarget.protocol === "https:";
  const httpModule = isHttps ? https : http;

  const headers = { ...req.headers };
  headers["host"] = parsedTarget.host;
  headers["x-forwarded-for"] = req.ip;
  headers["x-forwarded-proto"] = req.protocol;
  headers["x-forwarded-host"] = req.hostname;
  headers["x-real-ip"] = req.ip;

  const options = {
    hostname: parsedTarget.hostname,
    port: parsedTarget.port || (isHttps ? 443 : 80),
    path: parsedTarget.pathname + parsedTarget.search,
    method: req.method,
    headers,
    timeout: 30000,
  };

  const tag = chalk.magenta(req.id);
  const method = chalk.bold(req.method);
  const url = chalk.cyan(req.originalUrl);
  const target = chalk.yellow(targetUrl);

  console.log(`${tag} ${method} ${url} ${chalk.gray("→")} ${target}`);

  const proxyReq = httpModule.request(options, (proxyRes) => {
    const status = proxyRes.statusCode >= 400
      ? chalk.red(proxyRes.statusCode)
      : chalk.green(proxyRes.statusCode);

    console.log(`${tag} ${chalk.gray("←")} ${status} ${chalk.gray("from")} ${chalk.dim(parsedTarget.hostname)}`);

    Object.keys(proxyRes.headers).forEach((key) => {
      res.setHeader(key, proxyRes.headers[key]);
    });

    res.statusCode = proxyRes.statusCode;
    proxyRes.pipe(res);
  });

  proxyReq.on("error", (err) => {
    console.error(`${tag} ${chalk.red("✗")} ${chalk.red("Proxy error:")} ${chalk.dim(err.message)}`);

    if (!res.headersSent) {
      res.status(502).json({
        error: "Bad Gateway",
        message: "Target service unreachable",
        details: err.message,
        hint: `Make sure your backend is running on port ${parsedTarget.port}`,
      });
    }
  });

  proxyReq.on("timeout", () => {
    proxyReq.destroy();
    if (!res.headersSent) {
      res.status(504).json({
        error: "Gateway Timeout",
        message: "Target service took too long to respond",
      });
    }
  });

  if (req.body && Buffer.isBuffer(req.body)) {
    proxyReq.write(req.body);
  } else if (req.body) {
    proxyReq.write(JSON.stringify(req.body));
  }

  proxyReq.end();
}

app.all("/:app/*splat", (req, res) => {
  const appName = req.params.app?.toLowerCase();
  const splats = req.params.splat;
  const remainingPath = splats?.join("/");
  const isKnownApp = appName && ROUTES[appName];
  const targetPort = isKnownApp ? ROUTES[appName] : DEFAULT_PORT;

  let targetPath;
  if (isKnownApp) {
    targetPath = String(remainingPath).startsWith("/") ? remainingPath : `/${remainingPath}`;
  } else {
    targetPath = `/${appName}/${remainingPath}`;
  }

  const queryString = req.url.includes("?") ? req.url.substring(req.url.indexOf("?")) : "";
  const targetUrl = `http://127.0.0.1:${targetPort}${targetPath}${queryString}`;

  proxyRequest(req, res, targetUrl);
});

app.all("/:app", (req, res) => {
  const appName = req.params.app?.toLowerCase();
  const isKnownApp = appName && ROUTES[appName];
  const targetPort = isKnownApp ? ROUTES[appName] : DEFAULT_PORT;

  const targetPath = isKnownApp ? "/" : `/${appName}`;
  const queryString = req.url.includes("?") ? req.url.substring(req.url.indexOf("?")) : "";
  const targetUrl = `http://127.0.0.1:${targetPort}${targetPath}${queryString}`;

  proxyRequest(req, res, targetUrl);
});

app.use((req, res) => {
  const targetPath = req.path.startsWith("/") ? req.path : `/${req.path}`;
  const queryString = req.url.includes("?") ? req.url.substring(req.url.indexOf("?")) : "";
  const targetUrl = `http://127.0.0.1:${DEFAULT_PORT}${targetPath}${queryString}`;
  proxyRequest(req, res, targetUrl);
});

app.use((err, req, res, next) => {
  const tag = chalk.magenta(req.id);
  console.error(`${tag} ${chalk.red("✗")} ${chalk.red("Unhandled error:")} ${chalk.dim(err.message)}`);
  if (!res.headersSent) {
    res.status(500).json({
      error: "Internal Server Error",
      message: process.env.NODE_ENV === "production" ? "Something went wrong" : err.message,
    });
  }
});

const PORT = process.env.PORT || 8888;
const NGROK_DOMAIN = process.env.NGROK_DOMAIN;
const NGROK_AUTHTOKEN = process.env.NGROK_AUTHTOKEN;

(async function startNgrok() {
  try {
    const listener = await ngrok.forward({
      addr: PORT,
      authtoken: NGROK_AUTHTOKEN,
      domain: NGROK_DOMAIN,
    });

    console.log(`\n${chalk.green("✓")} ${chalk.bold("Ngrok tunnel established:")} ${chalk.cyan(listener.url())}\n`);
  } catch (err) {
    console.error(`${chalk.red("✗")} ${chalk.red("Failed to start ngrok:")} ${err.message}`);
    console.log(chalk.dim("Server will still run on localhost, but without public URL"));
  }
})();

const server = app.listen(PORT, (error) => {
  if (error) {
    console.error(chalk.red("Failed to start server:"), error);
    process.exit(1);
  }

  console.log(`\n${chalk.bold(chalk.bgGreen(" WEBHOOK PROXY SERVER "))}`);
  console.log(`${chalk.green("→")} ${chalk.bold("Local:")} ${chalk.cyan(`http://localhost:${PORT}`)}`);

  if (NGROK_DOMAIN) {
    console.log(`${chalk.green("→")} ${chalk.bold("Public:")} ${chalk.cyan(`https://${NGROK_DOMAIN}`)}`);
  }

  console.log(`\n${chalk.bold("Available Routes:")}`);
  Object.entries(ROUTES).forEach(([name, port]) => {
    console.log(`  ${chalk.yellow(`/${name}/*`)}  ${chalk.gray("→")}  ${chalk.dim(`http://localhost:${port}`)}`);
  });

  console.log(`  ${chalk.yellow("/* (default)")}  ${chalk.gray("→")}  ${chalk.dim(`http://localhost:${DEFAULT_PORT}`)}`);

  const publicUrl = NGROK_DOMAIN ? `https://${NGROK_DOMAIN}` : `http://localhost:${PORT}`;
  console.log(`\n${chalk.dim(`Example: ${publicUrl}/${Object.keys(ROUTES)[0]}/webhook`)}\n`);
});

process.on("SIGTERM", () => {
  console.log(chalk.yellow("SIGTERM received: shutting down"));
  server.close(() => {
    console.log(chalk.dim("HTTP server closed"));
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log(`\n${chalk.yellow("SIGINT received: shutting down")}`);
  server.close(() => {
    console.log(chalk.dim("HTTP server closed"));
    process.exit(0);
  });
});
