/**
 * Controller for handling file operations such as upload, download, and delete.
 * Each function is exported for use in route handlers.
 */

const fs = require("fs"); // Node.js file system module
const path = require("path"); // Node.js path module
const { logger } = require("../utils/logger"); // Custom logger utility
const fileService = require("../services/file.service"); // Service for file operations
const rateLimitService = require("../services/rateLimit.service"); // Service for rate limiting

class FileController {
  /**
   * Upload a file
   * Handles file upload requests, checks rate limits, and delegates to fileService.
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async uploadFile(req, res, next) {
    try {
      // Check if a file was provided in the request
      if (!req.file) {
        return res.status(400).json({
          error: "No file provided",
          details: "Please include a file in your request",
        });
      }

      // Convert buffer to stream if needed for further processing
      if (req.file.buffer && !req.file.stream) {
        const { Readable } = require("stream");
        req.file.stream = Readable.from(req.file.buffer);
      }

      // Check if the upload limit for the IP has been exceeded
      const limitCheck = await rateLimitService.checkUploadLimit(
        req.ip,
        req.file.size
      );
      if (!limitCheck.allowed) {
        return res.status(429).json({
          error: limitCheck.error.message,
        });
      }

      // Upload the file using the fileService
      const result = await fileService.uploadFile(req.file);
      res.status(201).json({
        ...result,
      });
    } catch (err) {
      // Log and respond with error if upload fails
      logger.error(`Upload error: ${err}`);
      res.status(500).json({
        error: "File upload failed",
        details:
          process.env.NODE_ENV === "development" ? err.message : undefined,
      });
    }
  }

  /**
   * Download a file
   * Handles file download requests, checks rate limits, and streams the file to the client.
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async downloadFile(req, res, next) {
    try {
      // Extract publicKey from request parameters
      const { publicKey } = req.params;
      // Validate publicKey format (must be 32-character hex string)
      if (!publicKey || !/^[a-f0-9]{32}$/.test(publicKey)) {
        return res.status(400).json({
          error: "Invalid public key format",
          details: "Key must be 32-character hex string",
        });
      }
      const ip = req.ip;

      // Check if the download limit for the IP has been exceeded
      await rateLimitService.checkDownloadLimit(ip);
      // Retrieve the file using the fileService
      const file = await fileService.downloadFile(publicKey);

      // Sanitize filename for HTTP headers
      const safeFilename = encodeURIComponent(file.originalName)
        .replace(/['()]/g, escape)
        .replace(/\*/g, "%2A");

      // Set response headers for file download
      res.set({
        "Content-Type": file.mimeType,
        "Content-Disposition": `attachment; filename*=UTF-8''${safeFilename}`,
        "Content-Length": file.size,
      });

      // Pipe the file stream to the response
      file.stream.pipe(res);

      // Track the download after response finishes
      res.on("finish", async () => {
        try {
          await rateLimitService.trackDownload(ip, file.size);
        } catch (err) {
          logger.error(`Error tracking download: ${err}`);
        }
      });
    } catch (err) {
      // Pass errors to the next middleware
      next(err);
    }
  }

  /**
   * Delete a file
   * Handles file deletion requests and delegates to fileService.
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async deleteFile(req, res, next) {
    try {
      // Extract privateKey from request parameters
      const { privateKey } = req.params;
      // Delete the file using the fileService
      const result = await fileService.deleteFile(privateKey);
      // Respond with the result of deletion
      res.json(result);
    } catch (err) {
      // Log and pass errors to the next middleware
      logger.error(`Delete error: ${err}`);
      next(err);
    }
  }
}

// Export an instance of FileController for use in routes
module.exports = new FileController();
