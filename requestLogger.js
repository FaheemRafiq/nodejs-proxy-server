import onFinished from "on-finished";
import { Writable } from "stream";
import chalk from "chalk";
import { ROUTES, LOG_VERBOSITY, DEFAULT_VERBOSITY } from "./config.js";

const MAX_BODY_LOG = 1024 * 1024;

function getAppName(req) {
  const path = (req.originalUrl || req.url || "").split("?")[0];
  const segments = path.split("/").filter(Boolean);
  if (segments.length > 0) {
    const candidate = segments[0].toLowerCase();
    if (ROUTES[candidate]) {
      return candidate;
    }
  }
  return null;
}

function getVerbosity(appName) {
  if (appName && LOG_VERBOSITY[appName]) {
    return LOG_VERBOSITY[appName];
  }
  return DEFAULT_VERBOSITY;
}

function requestLoggerMiddleware(req, res, next) {
  const appName = getAppName(req);
  const verbosity = getVerbosity(appName);

  req.logVerbosity = verbosity;
  req._appName = appName;

  if (verbosity === "none") {
    return next();
  }

  const startTime = Date.now();

  let reqBodyCaptured = null;
  let resChunks = [];
  let resBodyLength = 0;

  if (verbosity === "body" || verbosity === "full") {
    let reqChunks = [];
    let reqBodyLength = 0;

    const captureReqStream = new Writable({
      write(chunk, encoding, callback) {
        if (reqBodyLength < MAX_BODY_LOG) {
          reqChunks.push(
            Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding)
          );
          reqBodyLength += chunk.length;
        }
        callback();
      },
    });

    req.on("data", (chunk) => {
      captureReqStream.write(chunk);
    });

    req.on("end", () => {
      if (reqChunks.length > 0) {
        const buffer = Buffer.concat(reqChunks);
        const contentType = (req.headers["content-type"] || "").toLowerCase();
        if (contentType.includes("application/json")) {
          try {
            reqBodyCaptured = JSON.parse(buffer.toString("utf8"));
          } catch {
            reqBodyCaptured = buffer.toString("utf8");
          }
        } else {
          reqBodyCaptured = buffer.toString("utf8");
        }
      }
    });

    const captureResStream = new Writable({
      write(chunk, encoding, callback) {
        if (resBodyLength < MAX_BODY_LOG) {
          resChunks.push(
            Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding)
          );
          resBodyLength += chunk.length;
        }
        callback();
      },
    });

    const oldWrite = res.write;
    const oldEnd = res.end;

    res.write = function (chunk, encoding, cb) {
      if (chunk) captureResStream.write(chunk, encoding);
      return oldWrite.apply(res, arguments);
    };

    res.end = function (chunk, encoding, cb) {
      if (chunk) captureResStream.write(chunk, encoding);
      return oldEnd.apply(res, arguments);
    };
  }

  onFinished(res, () => {
    if (process.env.NODE_ENV === "production") return;
    if (shouldSkip(req)) return;

    const duration = Date.now() - startTime;
    const method = chalk.bold(req.method);
    const url = chalk.cyan(req.originalUrl || req.url);
    const status = colorStatus(res.statusCode);
    const time = chalk.gray(`${duration}ms`);
    const appTag = appName ? chalk.magenta(`[${appName}]`) : chalk.dim("[default]");

    console.log(`\n${appTag} ${method} ${url} → ${status} ${time}`);

    if (verbosity === "full") {
      console.group(chalk.yellow("  Request Headers"));
      console.log(chalk.dim(JSON.stringify(req.headers, null, 2)));
      console.groupEnd();
    }

    if ((verbosity === "body" || verbosity === "full") && reqBodyCaptured !== null && reqBodyCaptured !== "") {
      console.group(chalk.yellow("  Request Body"));
      logPretty(reqBodyCaptured);
      console.groupEnd();
    }

    if (verbosity === "full") {
      console.group(chalk.green("  Response Headers"));
      console.log(chalk.dim(JSON.stringify(res.getHeaders(), null, 2)));
      console.groupEnd();
    }

    if ((verbosity === "body" || verbosity === "full") && resChunks.length > 0) {
      const buffer = Buffer.concat(resChunks);
      const contentType = (res.getHeader("content-type") || "").toLowerCase();
      const isJson = contentType.includes("application/json");

      console.group(chalk.green("  Response Body"));
      if (isJson) {
        try {
          logPretty(JSON.parse(buffer.toString("utf8")));
        } catch {
          console.log(chalk.dim(buffer.toString("utf8")));
        }
      } else {
        console.log(chalk.dim(buffer.toString("utf8")));
      }
      console.groupEnd();
    }
  });

  next();
}

function colorStatus(code) {
  if (code >= 500) return chalk.red(code);
  if (code >= 400) return chalk.yellow(code);
  if (code >= 300) return chalk.cyan(code);
  if (code >= 200) return chalk.green(code);
  return chalk.gray(code);
}

function logPretty(obj) {
  if (obj instanceof Buffer) return;
  if (obj && typeof obj === "object" && "fieldname" in obj) {
    console.log(chalk.dim("<File ...>"));
    return;
  }
  const json = JSON.stringify(obj, null, 2);
  console.log(chalk.dim(json));
}

function shouldSkip(req) {
  const skipEndpoints = ["/health", "/favicon.ico", "/public"];
  const path = (req.originalUrl || req.url || "").toLowerCase();
  if (path.includes("/api")) return false;
  return skipEndpoints.some((ep) => path.includes(ep.toLowerCase()));
}

export { requestLoggerMiddleware };
