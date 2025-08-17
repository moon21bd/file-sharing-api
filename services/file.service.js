const { logger } = require("../utils/logger"); // Import custom logger utility
const config = require("../config"); // Import configuration settings
const LocalStorage = require("../models/storage/localStorage"); // Import LocalStorage provider
const GoogleCloudStorage = require("../models/storage/googleCloudStorage"); // Import GoogleCloudStorage provider

class FileService {
  constructor() {
    // Initialize storage provider based on config
    this.storage = this.initializeStorage();
    // Throw error if storage provider failed to initialize
    if (!this.storage) {
      throw new Error("Storage provider initialization failed");
    }
  }

  // Select and initialize the appropriate storage provider
  initializeStorage() {
    try {
      switch (config.provider) {
        case "google":
          // Log initialization of Google Cloud Storage
          logger.info("Initializing Google Cloud Storage");
          // Ensure configPath is provided for Google Cloud Storage
          if (!config.configPath) {
            throw new Error("Google Cloud Storage requires CONFIG path");
          }
          // Return new GoogleCloudStorage instance
          return new GoogleCloudStorage(config.configPath);
        case "local":
        default:
          // Log initialization of Local Storage
          logger.info("Initializing Local Storage");
          // Return new LocalStorage instance
          return new LocalStorage(config.folder);
      }
    } catch (err) {
      // Log error if storage initialization fails
      logger.error(`Storage initialization error: ${err}`);
      throw err;
    }
  }

  // Upload a file using the selected storage provider
  async uploadFile(file) {
    try {
      // Call uploadFile on the storage provider
      const result = await this.storage.uploadFile(file);
      // Log successful upload with public key
      logger.info(`File uploaded successfully: ${result.publicKey}`);
      return result;
    } catch (err) {
      // Log error if upload fails
      logger.error(`Error in uploadFile service: ${err}|${err.stack}`);
      throw err;
    }
  }

  // Download a file using the selected storage provider
  async downloadFile(publicKey) {
    try {
      // Call downloadFile on the storage provider
      const result = await this.storage.downloadFile(publicKey);
      // Log successful download with public key
      logger.info(`File downloaded successfully: ${publicKey}`);
      return result;
    } catch (err) {
      // Log error if download fails
      logger.error(`Error in downloadFile service: ${err}|${err.stack}`);
      throw err;
    }
  }

  // Delete a file using the selected storage provider
  async deleteFile(privateKey) {
    try {
      // Call deleteFile on the storage provider
      const result = await this.storage.deleteFile(privateKey);
      // Log successful deletion with private key
      logger.info(`File deleted successfully: ${privateKey}`);
      return result;
    } catch (err) {
      // Log error if deletion fails
      logger.error(`Error in deleteFile service: ${err}|${err.stack}`);
      throw err;
    }
  }

  // Cleanup inactive files using the selected storage provider
  async cleanupInactiveFiles() {
    try {
      // Call cleanupInactiveFiles on the storage provider
      const result = await this.storage.cleanupInactiveFiles(
        config.inactivityPeriod
      );
      // Log completion of cleanup job with deleted count
      logger.info(
        `Cleanup job completed. Files deleted: ${result.deletedCount}`
      );
      return result;
    } catch (err) {
      // Log error if cleanup fails
      logger.error(`Error in cleanupInactiveFiles: ${err}|${err.stack}`);
      throw err;
    }
  }
}

// Export a singleton instance of FileService
module.exports = new FileService();
