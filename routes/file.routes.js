const express = require("express");
const multer = require("multer");
const FileController = require("../controllers/file.controller");
const {
  uploadRateLimit,
  downloadRateLimit,
} = require("../middleware/rateLimit.middleware");

// Memory storage with proper limits
const upload = multer({
  storage: multer.memoryStorage(), // Store files in memory
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
    files: 1, // Only one file per request
    parts: 2 // file + fields if any
  },
  fileFilter: (req, file, cb) => {
    // Allow only specific file types
    if (!file.originalname.match(/\.(jpg|jpeg|png|pdf|txt)$/)) {
      const err = new Error("Only certain file types are allowed");
      err.code = "LIMIT_FILE_TYPES";
      return cb(err);
    }
    cb(null, true);
  }
});

// exporting the router to be used in the main app
// This file handles file upload, download, and deletion routes
// It uses multer for file handling and applies rate limiting middleware
// to prevent abuse of upload and download endpoints
module.exports = () => {
  const router = express.Router();

  // Route for uploading a file
  router.post(
    "/",
    uploadRateLimit, // Check upload rate limit before processing
    upload.single("file"), // This file must come after rate limiting
    FileController.uploadFile // Controller handles upload logic
  );

  // Route for downloading a file by public key
  router.get("/:publicKey", downloadRateLimit, FileController.downloadFile);

  // Route for deleting a file by private key
  router.delete("/:privateKey", FileController.deleteFile);

  return router;
};
