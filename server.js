// Import the Express application instance from app.js
const app = require("./app");

// Import configuration settings (such as port and provider)
const config = require("./config");

// Import the logger utility for logging server events
const { logger } = require("./utils/logger");

// Start the server and listen on the configured port
const server = app.listen(config.port, () => {
  // Log the port number the server is running on
  logger.info(`Server running on port ${config.port}`);
  // Log the storage provider being used (e.g., local, cloud)
  logger.info(`Using storage provider: ${config.provider}`);
});

// Listen for unhandled promise rejections to handle errors gracefully
process.on("unhandledRejection", (err) => {
  // Log the error details
  logger.error(`Unhandled Rejection: ${err}`);
  // Close the server and exit the process with an error code
  server.close(() => process.exit(1));
});

// Listen for SIGTERM signal to gracefully shut down the server
process.on("SIGTERM", () => {
  // Log that SIGTERM was received
  logger.info("SIGTERM received. Shutting down gracefully");
  // Close the server and log when the process is terminated
  server.close(() => {
    logger.info("Process terminated");
  });
});

// Export the server instance for use in other modules or for testing
module.exports = server;
