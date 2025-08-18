const { logger } = require("../utils/logger"); // Import custom logger utility
const config = require("../config"); // Import configuration settings
const { createClient } = require("redis"); // Import Redis client constructor

class RateLimitService {
  constructor() {
    // Create Redis client with configuration
    this.client = createClient({
      host: config.redis.host || "127.0.0.1",
      port: config.redis.port || 6379,
      password: config.redis.password,
      db: config.redis.db || 0,
    });

    // Log successful Redis connection
    this.client.on("connect", () => logger.info("Redis connected"));
    // Log Redis errors
    this.client.on("error", (err) => logger.error(`Redis error: ${err}`));

    // Connect to Redis server asynchronously
    this.client
      .connect()
      .catch((err) => logger.error(`Redis connection error: ${err}`));
  }

  // Disconnect from Redis server
  async disconnect() {
    await this.client.disconnect();
  }

  // Parse human-readable size string (e.g., "100MB", "1GB") into bytes
  parseSize(sizeStr) {
    const unit = sizeStr.slice(-2); // Get last two characters as unit
    const value = parseInt(sizeStr.slice(0, -2)); // Get numeric value

    switch (unit) {
      case "MB":
        return value * 1024 * 1024; // Convert MB to bytes
      case "GB":
        return value * 1024 * 1024 * 1024; // Convert GB to bytes
      default:
        return parseInt(sizeStr) || 0; // Fallback: parse as integer bytes
    }
  }

  // Check if the daily upload limit for an IP has been exceeded
  async checkUploadLimit(ip, fileSize) {
    const uploadLimit = this.parseSize(config.dailyUploadLimit); // Get upload limit in bytes
    const key = `upload:${ip}:${new Date().toISOString().slice(0, 10)}`; // Redis key for daily upload tracking

    try {
      const current = parseInt(await this.client.get(key)) || 0; // Get current usage
      if (current + fileSize > uploadLimit) {
        // If limit exceeded, return not allowed with details
        return {
          allowed: false,
          error: {
            message: "Daily upload limit exceeded",
            statusCode: 429,
            currentUsage: current,
            limit: uploadLimit,
            remaining: Math.max(0, uploadLimit - current),
          },
        };
      }

      await this.client.incrBy(key, fileSize); // Increment usage by file size
      if (current === 0) {
        await this.client.expire(key, 86400); // Set TTL to 24 hours if first upload
      }

      // Return allowed with updated usage details
      return {
        allowed: true,
        currentUsage: current + fileSize,
        limit: uploadLimit,
        remaining: uploadLimit - (current + fileSize),
      };
    } catch (err) {
      // Log error and return service unavailable
      logger.error(`Upload limit check error: ${err}`);
      return {
        allowed: false,
        error: { message: "Rate limit service unavailable", statusCode: 503 },
      };
    }
  }

  // Check if the daily download limit for an IP has been exceeded
  async checkDownloadLimit(ip) {
    const downloadLimit = this.parseSize(config.dailyDownloadLimit); // Get download limit in bytes
    const key = `download:${ip}:${new Date().toISOString().slice(0, 10)}`; // Redis key for daily download tracking

    try {
      const current = parseInt(await this.client.get(key)) || 0; // Get current usage
      if (current >= downloadLimit) {
        // If limit exceeded, throw error
        const error = new Error("Daily download limit exceeded");
        error.statusCode = 429;
        error.details = "Please try again later";
        error.currentUsage = current;
        error.limit = downloadLimit;
        error.remaining = Math.max(0, downloadLimit - current);
        throw error;
      }
    } catch (err) {
      // Log error and propagate with proper status code
      logger.error(`Download limit check error: ${err}`);
      if (!err.statusCode) {
        err.statusCode = 503;
        err.details = "Service temporarily unavailable";
      }
      throw err;
    }
  }

  // Track the download usage for an IP by incrementing the daily counter
  async trackDownload(ip, size) {
    const key = `download:${ip}:${new Date().toISOString().slice(0, 10)}`; // Redis key for daily download tracking

    try {
      await this.client.incrBy(key, size); // Increment usage by file size
      const current = parseInt(await this.client.get(key)) || 0; // Get updated usage
      if (current === size) {
        await this.client.expire(key, 86400); // Set TTL to 24 hours if first download
      }
    } catch (err) {
      // Log error and propagate with proper status code
      logger.error(`Download tracking error: ${err}`);
      if (!err.statusCode) {
        err.statusCode = 503;
        err.details = "Service temporarily unavailable";
      }
      throw err;
    }
  }
}

// Export a singleton instance of RateLimitService
module.exports = new RateLimitService();
