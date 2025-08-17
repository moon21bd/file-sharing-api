const { Storage } = require("@google-cloud/storage"); // Import Google Cloud Storage SDK
const path = require("path"); // Node.js path module
const StorageInterface = require("./storageInterface"); // Base storage interface
const { logger } = require("../../utils/logger"); // Custom logger utility
const { generateKeys } = require("../../utils/generateKeys"); // Utility for generating file keys

class GoogleCloudStorage extends StorageInterface {
  constructor(configPath) {
    super();

    // Resolve the full path to the config file
    const resolvedPath = path.resolve(process.cwd(), configPath);
    console.log(`Loading GCS config from: ${resolvedPath}`);

    let config;
    try {
      // Load GCS configuration from file
      config = require(resolvedPath);
    } catch (err) {
      // Log and throw error if config loading fails
      console.error("Failed to load GCS config:", err);
      throw new Error(`Failed to load GCS config: ${err.message}`);
    }

    // Validate required config fields
    if (!config.project_id || !config.bucket_name) {
      throw new Error(
        "Invalid GCS configuration - missing project_id or bucket_name"
      );
    }

    // Initialize Google Cloud Storage client and bucket
    this.storage = new Storage({
      projectId: config.project_id,
      credentials: config,
    });
    this.bucket = this.storage.bucket(config.bucket_name);
    this.bucketName = config.bucket_name;
  }

  // Upload a file to Google Cloud Storage
  async uploadFile(file) {
    const { publicKey, privateKey } = generateKeys(); // Generate unique keys for file
    const gcsFile = this.bucket.file(publicKey); // Reference to the file in GCS

    // Create metadata for the file
    const metadata = {
      privateKey,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      lastAccessed: new Date().toISOString(),
    };

    const metadataFile = this.bucket.file(`${publicKey}.meta`); // Reference to metadata file

    try {
      // Upload metadata first
      await metadataFile.save(JSON.stringify(metadata), {
        metadata: {
          contentType: "application/json",
        },
      });

      // Then upload main file using stream
      await new Promise((resolve, reject) => {
        file.stream
          .pipe(
            gcsFile.createWriteStream({
              metadata: {
                contentType: file.mimetype,
              },
            })
          )
          .on("error", reject)
          .on("finish", resolve);
      });

      // Return keys for further operations
      return { publicKey, privateKey };
    } catch (err) {
      // Cleanup both files if upload fails
      await Promise.all([
        gcsFile.delete().catch(() => {}),
        metadataFile.delete().catch(() => {}),
      ]);
      throw err;
    }
  }

  // Download a file from Google Cloud Storage
  async downloadFile(publicKey) {
    const gcsFile = this.bucket.file(publicKey); // Reference to the file
    const metadataFile = this.bucket.file(`${publicKey}.meta`); // Reference to metadata file

    try {
      // Get metadata from GCS
      const [metadata] = await metadataFile.download();
      const fileInfo = JSON.parse(metadata.toString());

      // Update last accessed timestamp
      fileInfo.lastAccessed = new Date().toISOString();
      await metadataFile.save(JSON.stringify(fileInfo), {
        metadata: {
          contentType: "application/json",
        },
      });

      // Get file stream and metadata
      const fileStream = gcsFile.createReadStream();
      const [fileMetadata] = await gcsFile.getMetadata();

      // Return file stream and info for response
      return {
        stream: fileStream,
        mimeType: fileMetadata.contentType,
        originalName: fileInfo.originalName,
        size: Number(fileInfo.size),
      };
    } catch (err) {
      throw err;
    }
  }

  // Delete a file from Google Cloud Storage using private key
  async deleteFile(privateKey) {
    try {
      // Find file by matching privateKey in metadata files
      const [files] = await this.bucket.getFiles();
      let publicKey = null;

      for (const file of files) {
        if (file.name.endsWith(".meta")) {
          const [metadata] = await file.download();
          const fileInfo = JSON.parse(metadata.toString());

          if (fileInfo.privateKey === privateKey) {
            publicKey = file.name.replace(".meta", "");
            break;
          }
        }
      }

      // If no matching file found, throw error
      if (!publicKey) throw new Error("File not found");

      // Delete both file and metadata
      await Promise.all([
        this.bucket.file(publicKey).delete(),
        this.bucket.file(`${publicKey}.meta`).delete(),
      ]);

      return { success: true };
    } catch (err) {
      throw err;
    }
  }

  // Cleanup inactive files from Google Cloud Storage
  async cleanupInactiveFiles(inactivityPeriod) {
    const [files] = await this.bucket.getFiles(); // Get all files in bucket
    const metaFiles = files.filter((f) => f.name.endsWith(".meta")); // Filter metadata files
    const cutoff = new Date(
      Date.now() - this.parseInactivityPeriod(inactivityPeriod)
    ); // Calculate cutoff date

    let deletedCount = 0;
    const errors = [];

    for (const metaFile of metaFiles) {
      try {
        // Download metadata and parse last accessed time
        const [metadata] = await metaFile.download();
        const fileInfo = JSON.parse(metadata.toString());
        const lastAccessed = new Date(fileInfo.lastAccessed);

        // If file is inactive, delete both file and metadata
        if (lastAccessed < cutoff) {
          const publicKey = metaFile.name.replace(".meta", "");
          await Promise.all([
            this.bucket.file(publicKey).delete(),
            metaFile.delete(),
          ]);
          deletedCount++;
          logger.debug(`Deleted inactive GCS file: ${publicKey}`);
        }
      } catch (err) {
        // Track errors for reporting
        errors.push({ file: metaFile.name, error: err.message });
        logger.error(`Error processing GCS file ${metaFile.name}:`, err);
      }
    }

    // Log warning if any errors occurred during cleanup
    if (errors.length > 0) {
      logger.warn(`GCS cleanup completed with ${errors.length} errors`);
    }

    // Return cleanup statistics
    return {
      deletedCount,
      errorCount: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  // Helper method to parse inactivity period
  // This method is used to convert the period string (e.g., "10m", "30d") into milliseconds
  // It is used in the cleanupInactiveFiles method to determine which files to delete based on their last accessed time
  // It supports days (d), hours (h), and minutes (m) as units
  // If no valid unit is provided,
  // it defaults to 30 days (30d) for backward compatibility
  // This method is essential for the cleanup process to determine file inactivity
  // and ensure that only files that have not been accessed within the specified period are deleted
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

// Export GoogleCloudStorage class for use in the app
module.exports = GoogleCloudStorage;
