const { logger } = require("../utils/logger"); // Import custom logger utility

/**
 * Error handling middleware
 * Catches errors from routes and sends appropriate HTTP responses.
 * @param {Error} err - The error object thrown in the app
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const errorHandler = (err, req, res, next) => {
  // Log error details including method, URL, IP, message, and stack trace
  logger.error(`Error: ${req.method} ${req.url}|${req.ip}|${err.message}|${err.stack}`);

  // Handle specific filesystem errors (file not found)
  if (err.code === "ENOENT") {
    return res.status(404).json({
      error: "File not found",
      details: "The requested file does not exist",
    });
  }

  // Handle invalid private keys (file not found by key)
  if (err.message.includes("Invalid private key")) {
    return res.status(404).json({
      error: "File not found",
      details: "No file matches the provided key",
    });
  }

  // Determine status code (default to 500 if not set)
  const statusCode = err.statusCode || 500;
  // Set error message based on status code
  const message = statusCode === 500 ? "Internal Server Error" : err.message;

  // Send error response, including stack trace and error type in development mode
  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === "development" && {
      stack: err.stack,
      type: err.name,
    }),
  });
};

// Export the error handler middleware for use in the app
module.exports = { errorHandler };