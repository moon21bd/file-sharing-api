const { logger } = require("../utils/logger"); // Import custom logger utility
const config = require("../config"); // Import configuration settings
const redis = require("redis"); // Import Redis client library
const { promisify } = require("util"); // Import promisify utility for async Redis methods

class RateLimitController {
  constructor() {
    // Create Redis client using config values
    this.client = redis.createClient({
      host: config.redis.host || "127.0.0.1",
      port: config.redis.port || 6379,
      password: config.redis.password,
      db: config.redis.db || 0,
    });

    // Log when Redis connects successfully
    this.client.on("connect", () => logger.info("Redis connected"));
    // Log Redis errors
    this.client.on("error", (err) => logger.error(`Redis error: ${err}`));
    
    // Promisify Redis methods for async/await usage
    this.getAsync = promisify(this.client.get).bind(this.client);
    this.setexAsync = promisify(this.client.setex).bind(this.client);
    this.incrbyAsync = promisify(this.client.incrby).bind(this.client);
  }

  /**
   * Parse a human-readable size string (e.g., "100MB", "1GB") into bytes.
   * @param {string} sizeStr - Size string to parse
   * @returns {number} Size in bytes
   */
  parseSize(sizeStr) {
    if (typeof sizeStr !== "string") return 0;
    const trimmed = sizeStr.trim();
    // Match number and unit (MB/GB)
    const match = trimmed.match(/^(\d+)\s*(mb|MB|Mb|mB|gb|GB|Gb|gB)$/);
    if (match) {
      const value = parseInt(match[1]);
      const unit = match[2].toLowerCase();
      if (unit === "mb") return value * 1024 * 1024;
      if (unit === "gb") return value * 1024 * 1024 * 1024;
    }
    // Fallback: parse as integer bytes if no suffix
    const fallback = parseInt(trimmed);
    return isNaN(fallback) ? 0 : fallback;
  }

  /**
   * Generate a Redis key for daily upload/download tracking per IP.
   * @param {string} type - 'upload' or 'download'
   * @param {string} ip - IP address
   * @returns {string} Redis key
   */
  _getDailyKey(type, ip) {
    // Format: type:ip:YYYY-MM-DD
    const date = new Date().toISOString().slice(0, 10);
    return `${type}:${ip}:${date}`;
  }

  /**
   * Increment a Redis key by value and set TTL if first increment.
   * @param {string} key - Redis key
   * @param {number} value - Value to increment by
   * @param {number} ttl - Time to live in seconds
   * @returns {number} Previous value
   */
  async _incrementWithTTL(key, value, ttl) {
    // Get current value
    const current = parseInt(await this.getAsync(key)) || 0;
    // Increment by value
    await this.incrbyAsync(key, value);
    // Set TTL if first increment
    if (current === 0) {
      await this.setexAsync(key, ttl, value);
    }
    return current;
  }

  /**
   * Check if the daily upload limit for an IP has been exceeded.
   * @param {string} ip - IP address
   * @param {number} fileSize - Size of the file to upload
   * @throws {Error} If limit exceeded
   */
  async checkUploadLimit(ip, fileSize) {
    const uploadLimit = this.parseSize(config.dailyUploadLimit);
    const key = this._getDailyKey('upload', ip);
    try {
      // Get current usage
      const current = parseInt(await this.getAsync(key)) || 0;
      // If limit exceeded, throw error
      if (current + fileSize > uploadLimit) {
        throw new Error("Daily upload limit exceeded");
      }
      // Increment usage and set TTL
      await this._incrementWithTTL(key, fileSize, 86400);
    } catch (err) {
      logger.error(`Upload limit check error: ${err}`);
      throw err;
    }
  }

  /**
   * Check if the daily download limit for an IP has been exceeded.
   * @param {string} ip - IP address
   * @throws {Error} If limit exceeded
   */
  async checkDownloadLimit(ip) {
    const downloadLimit = this.parseSize(config.dailyDownloadLimit);
    const key = this._getDailyKey('download', ip);
    try {
      // Get current usage
      const current = parseInt(await this.getAsync(key)) || 0;
      // If limit exceeded, throw error
      if (current >= downloadLimit) {
        throw new Error("Daily download limit exceeded");
      }
    } catch (err) {
      logger.error(`Download limit check error: ${err}`);
      throw err;
    }
  }

  /**
   * Track the download usage for an IP by incrementing the daily counter.
   * @param {string} ip - IP address
   * @param {number} size - Size of the downloaded file
   */
  async trackDownload(ip, size) {
    // Validate size
    if (!size || isNaN(size)) {
      logger.warn(`Invalid download size for IP ${ip}`);
      size = 0;
    }
    const key = this._getDailyKey('download', ip);
    try {
      // Increment usage and set TTL
      await this._incrementWithTTL(key, size, 86400);
    } catch (err) {
      logger.error(`Download tracking error: ${err}`);
      throw err;
    }
  }
}

// Export an instance of RateLimitController for use in other modules
module.exports = new RateLimitService();
