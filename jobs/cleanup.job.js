const { logger } = require("../utils/logger"); // Import custom logger utility
const fileService = require("../services/file.service"); // Import file service for file operations
const config = require("../config"); // Import configuration settings

// Set cleanup interval (1 minute for testing, can be set to config value for production)
const timeToCleanUpProcessInMs = config.timeToCleanUpProcess; // 24 hours
// const timeToCleanUpProcessInMs = 1 * 60 * 1000; // 1 Minute for testing purposes

/**
 * CleanupJob class handles periodic cleanup of inactive files.
 * It schedules and runs cleanup tasks at a defined interval.
 */
class CleanupJob {
  constructor() {
    this.interval = null; // Holds the interval timer reference
    this.isRunning = false; // Flag to prevent overlapping cleanup jobs
  }

  /**
   * Start the cleanup job.
   * Runs an initial cleanup and schedules periodic cleanups.
   */
  async start() {
    // Clear any existing interval to avoid duplicate jobs
    if (this.interval) clearInterval(this.interval);

    // Run initial cleanup immediately
    await this.runCleanup();

    // Schedule periodic cleanup runs
    this.interval = setInterval(async () => {
      // Only run if previous cleanup is not still running
      if (!this.isRunning) {
        await this.runCleanup();
      } else {
        logger.warn(
          "Previous cleanup job still running - skipping this interval"
        );
      }
    }, timeToCleanUpProcessInMs);
  }

  /**
   * Run the cleanup process.
   * Deletes inactive files and logs results.
   */
  async runCleanup() {
    // Prevent concurrent cleanups
    if (this.isRunning) {
      logger.warn("Cleanup already in progress");
      return;
    }

    this.isRunning = true; // Set running flag
    const startTime = Date.now(); // Record start time

    try {
      logger.info("Starting cleanup job...");
      // Call fileService to clean up inactive files
      const result = await fileService.cleanupInactiveFiles(
        config.inactivityPeriod
      );

      // Log completion and statistics
      logger.info(
        `Cleanup job completed in ${(Date.now() - startTime) / 1000}s`,
        {
          deletedCount: result.deletedCount,
          errorCount: result.errorCount || 0,
          duration: (Date.now() - startTime) / 1000,
        }
      );

      // Log any errors encountered during cleanup
      if (result.errors) {
        logger.debug("Cleanup errors:", result.errors);
      }
    } catch (err) {
      // Log failure and error details
      logger.error(`Cleanup job failed: ${err.message}`, {
        error: err.stack,
        duration: (Date.now() - startTime) / 1000,
      });
    } finally {
      this.isRunning = false; // Reset running flag
    }
  }

  /**
   * Stop the cleanup job.
   * Clears the interval timer and stops scheduled cleanups.
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}

// Export an instance of CleanupJob for use in other modules
module.exports = new CleanupJob();
