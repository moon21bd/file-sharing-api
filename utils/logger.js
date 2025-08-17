const winston = require("winston"); // Import winston logging library

// Create a logger instance with configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info", // Set log level from environment or default to 'info'
  format: winston.format.combine(
    winston.format.timestamp(), // Add timestamp to each log entry
    winston.format.json() // Format logs as JSON
  ),
  transports: [
    new winston.transports.Console(), // Output logs to console
    new winston.transports.File({ filename: "logs/error.log", level: "error" }), // Log errors to file
    new winston.transports.File({ filename: "logs/combined.log" }), // Log all levels to combined file
  ],
});

// Export the logger instance for use in other modules
module.exports = {
  logger,
};
