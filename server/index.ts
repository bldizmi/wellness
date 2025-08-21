import dotenv from "dotenv";
dotenv.config();

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { PhotoRetentionService } from "./services/photoRetentionService";
import { createLogger } from "./services/logger";
import path from "path";
import { fileURLToPath } from "url";
import { promises as fs } from "fs";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
// app.use("/uploads", express.static(path.join(__dirname, "uploads")));
const uploadsPath = path.join(__dirname, "..", "uploads");
console.log("Static files path:", uploadsPath);
app.use("/uploads", express.static(uploadsPath));

// Add this temporarily after your static middleware
app.get("/debug/uploads/:filename", (req, res) => {
  const filePath = path.join(__dirname, "uploads", req.params.filename);
  console.log("Checking file:", filePath);
  console.log("File exists:", require("fs").existsSync(filePath));
  res.json({
    requestedFile: req.params.filename,
    fullPath: filePath,
    exists: require("fs").existsSync(filePath),
    dirContents: require("fs")
      .readdirSync(path.join(__dirname, "uploads"))
      .slice(0, 5),
  });
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  // Create logger with request context
  const logger = createLogger({
    correlationId:
      (req.headers["x-correlation-id"] as string) || `req-${Date.now()}`,
    requestPath: path,
  });

  // Debug TODAY endpoints with structured logging
  if (path.includes("/api/today")) {
    logger.debug("Today endpoint intercepted", {
      method: req.method,
      path,
      query: req.query,
      originalUrl: req.originalUrl,
    });
  }

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      // Use structured logging for API requests
      logger.api(req.method, path, res.statusCode, duration, {
        responseSize: capturedJsonResponse
          ? JSON.stringify(capturedJsonResponse).length
          : 0,
        userAgent: req.headers["user-agent"],
      });

      // Keep existing log format for backward compatibility
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Create logger for error context
    const logger = createLogger({
      correlationId:
        (req.headers["x-correlation-id"] as string) || `error-${Date.now()}`,
      requestPath: req.path,
    });

    // Log error with structured logging
    logger.error("Request error", {
      status,
      message,
      stack: err.stack,
      method: req.method,
      path: req.path,
      query: req.query,
      body: req.body,
      userAgent: req.headers["user-agent"],
    });

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen(port, () => {
      const logger = createLogger();
      logger.info("Server started successfully", {
        port,
        host: "localhost",
        environment: process.env.NODE_ENV || "development",
        nodeVersion: process.version,
        uptime: process.uptime(),
      });

      log(`serving on port ${port}`);

      // Start the photo retention service for automatic cleanup
      PhotoRetentionService.startAutomaticCleanup();
      logger.info("Photo retention service started", {
        cleanupInterval: "6 hours",
        retentionPeriod: "14 days",
      });
    },
  );
})();
