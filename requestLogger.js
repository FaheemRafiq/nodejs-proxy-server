import onFinished from "on-finished";
import { Writable } from "stream";
import chalk from "chalk";

const MAX_BODY_LOG = 1024 * 1024;

function requestLoggerMiddleware(req, res, next) {
  const startTime = Date.now();

  const reqChunks = [];
  let reqBodyCaptured = null;
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

  const resChunks = [];
  let resBodyLength = 0;

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

  onFinished(res, () => {
    if (process.env.NODE_ENV === "production") return;
    if (shouldSkip(req)) return;

    const duration = Date.now() - startTime;
    const method = chalk.bold(req.method);
    const url = chalk.cyan(req.originalUrl || req.url);
    const status = colorStatus(res.statusCode);
    const time = chalk.gray(`${duration}ms`);

    console.log(`\n${method} ${url} → ${status} ${time}`);

    if (reqBodyCaptured !== null && reqBodyCaptured !== "") {
      console.group(chalk.yellow("  Request Body"));
      logPretty(reqBodyCaptured);
      console.groupEnd();
    }

    if (resChunks.length > 0) {
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
