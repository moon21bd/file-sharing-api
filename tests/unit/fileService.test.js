/**
 * Unit tests for FileService class
 * Tests upload, download, and delete logic with mocks
 */

const fileService = require("../../services/file.service");
const { logger } = require("../../utils/logger");

// Mock the logger
jest.mock("../../utils/logger");

// Mock the config
jest.mock("../../config", () => ({
  provider: "local",
  folder: "./uploads",
  configPath: "./config/google-cloud.config.json",
  inactivityPeriod: "30d"
}));

// Create mock storage instance that will be used by all tests
const mockStorageInstance = {
  uploadFile: jest.fn(),
  downloadFile: jest.fn(),
  deleteFile: jest.fn(),
  cleanupInactiveFiles: jest.fn()
};

// Mock the file service's storage directly
fileService.storage = mockStorageInstance;

describe("FileService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("uploadFile", () => {
    it("should call storage.uploadFile with the file", async () => {
      const mockFile = {
        originalname: "test.txt",
        mimetype: "text/plain",
        size: 123,
        stream: {},
      };
      const mockResult = { publicKey: "abc123", privateKey: "xyz789" };

      mockStorageInstance.uploadFile.mockResolvedValue(mockResult);

      const result = await fileService.uploadFile(mockFile);

      expect(mockStorageInstance.uploadFile).toHaveBeenCalledWith(mockFile);
      expect(result).toEqual(mockResult);
      expect(logger.info).toHaveBeenCalledWith(
        "File uploaded successfully: abc123"
      );
    });

    it("should handle errors during upload", async () => {
      const mockFile = {
        originalname: "test.txt",
        mimetype: "text/plain",
        size: 123,
        stream: {},
      };
      const mockError = new Error("Upload failed");
      
      mockStorageInstance.uploadFile.mockRejectedValue(mockError);

      await expect(fileService.uploadFile(mockFile)).rejects.toThrow(mockError);
      expect(logger.error).toHaveBeenCalledWith(
        `Error in uploadFile service: ${mockError}|${mockError.stack}`
      );
    });
  });

  describe("downloadFile", () => {
    it("should call storage.downloadFile with the publicKey", async () => {
      const publicKey = "abc123";
      const mockResult = {
        stream: {},
        mimeType: "text/plain",
        originalName: "test.txt",
        size: 123
      };

      mockStorageInstance.downloadFile.mockResolvedValue(mockResult);

      const result = await fileService.downloadFile(publicKey);

      expect(mockStorageInstance.downloadFile).toHaveBeenCalledWith(publicKey);
      expect(result).toEqual(mockResult);
      expect(logger.info).toHaveBeenCalledWith(
        `File downloaded successfully: ${publicKey}`
      );
    });

    it("should handle errors during download", async () => {
      const publicKey = "abc123";
      const mockError = new Error("Download failed");

      mockStorageInstance.downloadFile.mockRejectedValue(mockError);

      await expect(fileService.downloadFile(publicKey)).rejects.toThrow(mockError);
      expect(logger.error).toHaveBeenCalledWith(
        `Error in downloadFile service: ${mockError}|${mockError.stack}`
      );
    });
  });

  describe("deleteFile", () => {
    it("should call storage.deleteFile with the privateKey", async () => {
      const privateKey = "xyz789";
      const mockResult = { success: true };

      mockStorageInstance.deleteFile.mockResolvedValue(mockResult);

      const result = await fileService.deleteFile(privateKey);

      expect(mockStorageInstance.deleteFile).toHaveBeenCalledWith(privateKey);
      expect(result).toEqual(mockResult);
      expect(logger.info).toHaveBeenCalledWith(
        `File deleted successfully: ${privateKey}`
      );
    });

    it("should handle errors during deletion", async () => {
      const privateKey = "xyz789";
      const mockError = new Error("Deletion failed");

      mockStorageInstance.deleteFile.mockRejectedValue(mockError);

      await expect(fileService.deleteFile(privateKey)).rejects.toThrow(mockError);
      expect(logger.error).toHaveBeenCalledWith(
        `Error in deleteFile service: ${mockError}|${mockError.stack}`
      );
    });
  });

  describe("cleanupInactiveFiles", () => {
    it("should call storage.cleanupInactiveFiles with the inactivity period", async () => {
      const mockResult = { deletedCount: 5 };

      mockStorageInstance.cleanupInactiveFiles.mockResolvedValue(mockResult);

      const result = await fileService.cleanupInactiveFiles();

      expect(mockStorageInstance.cleanupInactiveFiles).toHaveBeenCalledWith(config.inactivityPeriod);
      expect(result).toEqual(mockResult);
      expect(logger.info).toHaveBeenCalledWith(
        `Cleanup job completed. Files deleted: ${mockResult.deletedCount}`
      );
    });

    it("should handle errors during cleanup", async () => {
      const mockError = new Error("Cleanup failed");

      mockStorageInstance.cleanupInactiveFiles.mockRejectedValue(mockError);

      await expect(fileService.cleanupInactiveFiles()).rejects.toThrow(mockError);
      expect(logger.error).toHaveBeenCalledWith(
        `Error in cleanupInactiveFiles: ${mockError}|${mockError.stack}`
      );
    });
  });
});
