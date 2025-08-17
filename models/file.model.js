const { logger } = require("../utils/logger");

/**
 * File model for database operations
 * (Currently using storage providers directly, but kept for future expansion)
 */
class FileModel {
  constructor() {
    // Log initialization of the file model
    logger.info("File model initialized");
  }

  // Can be expanded with database operations if needed
}

// Export a singleton instance of FileModel
module.exports = new FileModel();
