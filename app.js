const express = require("express"); // Import Express framework
const multer = require("multer"); // Import Multer for file uploads
const cors = require("cors"); // Import CORS middleware
const { logger } = require("./utils/logger"); // Import custom logger utility
const fileRoutes = require("./routes/file.routes"); // Import file routes
const { errorHandler } = require("./middleware/error.middleware"); // Import error handler middleware
const cleanupJob = require("./jobs/cleanup.job"); // Import cleanup job for periodic file cleanup

class App {
  constructor() {
    this.app = express(); // Create Express app instance
    this.upload = multer(); // Create Multer instance for file uploads
    this.setupMiddleware(); // Setup middleware for the app
    this.setupRoutes(); // Setup routes for the app
    this.setupJobs(); // Setup background jobs for the app
  }

  setupMiddleware() {
    this.app.use(cors()); // Enable CORS for all routes
    this.app.use(express.json()); // Parse JSON request bodies
    this.app.use(express.urlencoded({ extended: true })); // Parse URL-encoded request bodies
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.url}`); // Log each incoming request
      next(); // Proceed to next middleware
    });
  }

  setupRoutes() {
    // File routes with rate limiting
    this.app.use("/files", fileRoutes(this.upload)); // Register file routes under /files
    this.app.use(errorHandler); // Register error handler middleware
  }

  setupJobs() {
    cleanupJob.start(); // Start periodic cleanup job for inactive files
  }
}

// Export Express app instance for use in server.js
module.exports = new App().app;
