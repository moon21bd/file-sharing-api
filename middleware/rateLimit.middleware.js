const rateLimitService = require("../services/rateLimit.service"); // Import rate limit service
const { logger } = require("../utils/logger"); // Import custom logger utility

/**
 * Middleware to enforce upload rate limits
 * Checks if the upload limit for the IP has been exceeded before allowing file upload.
 */
const uploadRateLimit = async (req, res, next) => {
  try {
    // If a file is present in the request, check the upload limit
    if (req.file) {
      const result = await rateLimitService.checkUploadLimit(req.ip, req.file.size);
      // If not allowed, log and respond with 429 status
      if (!result.allowed) {
        logger.error(`Upload rate limit exceeded for IP ${req.ip}: ${result.error.message}`);
        return res.status(429).json({ 
          message: result.error.message,
          details: {
            currentUsage: result.error.currentUsage,
            limit: result.error.limit,
            remaining: result.error.remaining
          }
        });
      }
    }
    // Proceed to next middleware if allowed
    next();
  } catch (err) {
    // Log and respond with 500 status if rate limit service fails
    logger.error(`Upload rate limit error for IP ${req.ip}: ${err}`);
    res.status(503).json({ 
      message: "Rate limit service unavailable",
      details: process.env.NODE_ENV === "development" ? err.message : undefined
    });
  }
};

/**
 * Middleware to enforce download rate limits
 * Checks if the download limit for the IP has been exceeded before allowing file download.
 */
const downloadRateLimit = async (req, res, next) => {
  try {
    // Check download limit for the IP
    await rateLimitService.checkDownloadLimit(req.ip);
    // Proceed to next middleware if allowed
    next();
  } catch (err) {
    // Log and respond with 429 status if limit exceeded
    logger.error(`Download rate limit exceeded for IP ${req.ip}: ${err}`);
    res.status(429).json({ 
      message: "Daily download limit exceeded",
      details: "Please try again later"
    });
  }
};

// Export the upload and download rate limit middlewares
module.exports = {
  uploadRateLimit,
  downloadRateLimit,
};
