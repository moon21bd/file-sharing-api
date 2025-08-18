const fs = require("fs"); // Node.js file system module
const fsp = fs.promises; // Promises API for file system
const path = require("path"); // Node.js path module
const { promisify } = require("util"); // Utility to convert callback functions to promises
const stream = require("stream"); // Node.js stream module
const pipeline = promisify(stream.pipeline); // Promisified pipeline for stream operations
const StorageInterface = require("./storageInterface"); // Base storage interface
const { logger } = require("../../utils/logger"); // Custom logger utility
const { generateKeys } = require("../../utils/generateKeys"); // Utility for generating file keys

class LocalStorage extends StorageInterface {
  constructor(folderPath) {
    super();
    this.folderPath = folderPath; // Path to the folder for storing files
    this.ensureFolderExists(); // Ensure the folder exists on initialization
  }

  // Ensure the storage folder exists, create if not
  async ensureFolderExists() {
    try {
      await fsp.mkdir(this.folderPath, { recursive: true });
    } catch (err) {
      logger.error(`Error creating folder: ${err}`);
      throw err;
    }
  }

  // Upload a file to local storage
  async uploadFile(file) {
    const { publicKey, privateKey } = generateKeys(); // Generate unique keys for file
    const filePath = path.join(this.folderPath, publicKey); // Path for the file
    const writeStream = fs.createWriteStream(filePath); // Create write stream

    try {
      // Handle both buffer and stream inputs
      if (file.buffer) {
        await new Promise((resolve, reject) => {
          writeStream.write(file.buffer, (err) => {
            if (err) reject(err);
            writeStream.end(resolve);
          });
        });
      } else if (file.stream) {
        await pipeline(file.stream, writeStream);
      } else {
        throw new Error("No valid file data found");
      }

      // Save metadata for the uploaded file
      await this._saveMetadata(publicKey, file, privateKey);
      return { publicKey, privateKey };
    } catch (err) {
      // Cleanup files if upload fails
      await this._cleanupFailedUpload(filePath);
      logger.error(`Upload failed: ${err}`);
      throw err;
    }
  }

  // Save metadata for a file
  async _saveMetadata(publicKey, file, privateKey) {
    if (!file.originalname || typeof file.originalname !== "string") {
      throw new Error("Invalid original filename");
    }

    const metadata = {
      privateKey,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      lastAccessed: new Date().toISOString(),
    };

    const metaPath = path.join(this.folderPath, `${publicKey}.meta`);

    try {
      await fsp.writeFile(metaPath, JSON.stringify(metadata));
    } catch (err) {
      logger.error(`Failed to save metadata: ${err}`);
      throw new Error("Metadata save failed");
    }
  }

  // Cleanup files if upload fails
  async _cleanupFailedUpload(filePath) {
    try {
      await fsp.unlink(filePath);
      await fsp.unlink(`${filePath}.meta`).catch(() => {});
    } catch (err) {
      logger.error(`Cleanup failed: ${err}`);
    }
  }

  // Download a file from local storage
  async downloadFile(publicKey) {
    const filePath = path.join(this.folderPath, publicKey);
    const metaPath = path.join(this.folderPath, `${publicKey}.meta`);

    try {
      // Check if files exist first
      await fsp.access(metaPath, fs.constants.R_OK);
      await fsp.access(filePath, fs.constants.R_OK);

      // Read metadata and update last accessed time
      const metaData = JSON.parse(await fsp.readFile(metaPath, "utf8"));
      metaData.lastAccessed = new Date().toISOString();
      await fsp.writeFile(metaPath, JSON.stringify(metaData));

      const stats = await fsp.stat(filePath); // Get file size

      return {
        stream: fs.createReadStream(filePath),
        mimeType: metaData.mimeType,
        originalName: metaData.originalName,
        size: stats.size, // Ensure size is always available
      };
    } catch (err) {
      if (err.code === "ENOENT") {
        err.message = `File not found: ${publicKey}`;
        err.statusCode = 404;
      }
      throw err;
    }
  }

  // Delete a file from local storage using private key
  async deleteFile(privateKey) {
    try {
      // Find all metadata files
      const files = await fsp.readdir(this.folderPath);
      const metaFiles = files.filter((f) => f.endsWith(".meta"));

      // Find the file matching the privateKey
      let publicKey = null;
      for (const metaFile of metaFiles) {
        const metaPath = path.join(this.folderPath, metaFile);
        const metaData = JSON.parse(await fsp.readFile(metaPath, "utf8"));

        if (metaData.privateKey === privateKey) {
          publicKey = metaFile.replace(".meta", "");
          break;
        }
      }

      if (!publicKey) {
        const error = new Error("Invalid private key");
        error.statusCode = 500;
        throw error;
      }

      const filePath = path.join(this.folderPath, publicKey);
      const metaPath = path.join(this.folderPath, `${publicKey}.meta`);

      await Promise.all([fsp.unlink(filePath), fsp.unlink(metaPath)]);

      return { success: true };
    } catch (err) {
      logger.error(`Delete failed: ${err}`);
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      throw err;
    }
  }

  // Cleanup inactive files from local storage
  async cleanupInactiveFiles(inactivityPeriod) {
    const files = await fsp.readdir(this.folderPath);
    const metaFiles = files.filter((f) => f.endsWith(".meta"));
    const cutoff = new Date(
      Date.now() - this.parseInactivityPeriod(inactivityPeriod)
    );

    let deletedCount = 0;
    const errors = [];

    for (const metaFile of metaFiles) {
      try {
        const metaPath = path.join(this.folderPath, metaFile);
        const metaData = JSON.parse(await fsp.readFile(metaPath, "utf8"));
        const lastAccessed = new Date(metaData.lastAccessed);

        // If file is inactive, delete both file and metadata
        if (lastAccessed < cutoff) {
          const publicKey = metaFile.replace(".meta", "");
          await this._deleteByPublicKey(publicKey);
          deletedCount++;
          logger.debug(`Deleted inactive file: ${publicKey}`);
        }
      } catch (err) {
        errors.push({ file: metaFile, error: err.message });
        logger.error(`Error processing ${metaFile}:`, err);
      }
    }

    // Log warning if any errors occurred during cleanup
    if (errors.length > 0) {
      logger.warn(`Cleanup completed with ${errors.length} errors`);
    }

    return {
      deletedCount,
      errorCount: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  // internal deletion method
  async _deleteByPublicKey(publicKey) {
    const filePath = path.join(this.folderPath, publicKey);
    const metaPath = path.join(this.folderPath, `${publicKey}.meta`);

    await Promise.all([
      fsp.unlink(filePath).catch(() => {}),
      fsp.unlink(metaPath).catch(() => {}),
    ]);
  }

  // Helper method to parse inactivity period string into milliseconds
  parseInactivityPeriod(period) {
    const unit = period.slice(-1);
    const value = parseInt(period.slice(0, -1));

    switch (unit) {
      case "d":
        return value * 24 * 60 * 60 * 1000; // days
      case "h":
        return value * 60 * 60 * 1000; // hours
      case "m":
        return value * 60 * 1000; // minutes
      default:
        return 30 * 24 * 60 * 60 * 1000; // default 30 days
    }
  }
}

// Export LocalStorage class for use in the app
module.exports = LocalStorage;
