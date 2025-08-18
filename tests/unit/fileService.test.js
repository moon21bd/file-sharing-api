/**
 * Unit tests for FileService class
 * Tests file upload, download, delete and cleanup operations
 */

const FileService = require("../../services/file.service");
const { logger } = require("../../utils/logger");

jest.mock("../../utils/logger");

describe("FileService", () => {
  let fileService;
  let mockStorageInstance;

  beforeEach(() => {
    mockStorageInstance = {
      uploadFile: jest.fn(),
      downloadFile: jest.fn(),
      deleteFile: jest.fn(),
      cleanupInactiveFiles: jest.fn()
    };
    fileService = new FileService(mockStorageInstance);
    jest.clearAllMocks();
  });

  describe("uploadFile()", () => {
    it("should upload file successfully", async () => {
      const mockFile = {
        buffer: Buffer.from("test"),
        originalname: "test.txt",
        mimetype: "text/plain",
        size: 123
      };
      
      mockStorageInstance.uploadFile.mockResolvedValue({
        publicKey: "test-public",
        privateKey: "test-private"
      });

      const result = await fileService.uploadFile(mockFile);

      expect(result).toHaveProperty("publicKey");
      expect(result).toHaveProperty("privateKey");
      expect(mockStorageInstance.uploadFile).toHaveBeenCalledWith(mockFile);
    });

    it("should handle upload errors", async () => {
      mockStorageInstance.uploadFile.mockRejectedValue(new Error("Upload failed"));
      
      await expect(fileService.uploadFile({})).rejects.toThrow("Upload failed");
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("downloadFile()", () => {
    it("should download file successfully", async () => {
      const publicKey = "test-public";
      const mockFileData = {
        stream: {},
        originalName: "test.txt",
        mimeType: "text/plain",
        size: 123
      };
      
      mockStorageInstance.downloadFile.mockResolvedValue(mockFileData);

      const result = await fileService.downloadFile(publicKey);

      expect(result).toEqual(mockFileData);
      expect(mockStorageInstance.downloadFile).toHaveBeenCalledWith(publicKey);
    });

    it("should handle download errors", async () => {
      const error = new Error("Download failed");
      error.statusCode = 500;
      mockStorageInstance.downloadFile.mockRejectedValue(error);
      
      await expect(fileService.downloadFile("invalid-key")).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("deleteFile()", () => {
    it("should delete file successfully", async () => {
      const privateKey = "test-private";
      mockStorageInstance.deleteFile.mockResolvedValue({ success: true });

      const result = await fileService.deleteFile(privateKey);

      expect(result.success).toBe(true);
      expect(mockStorageInstance.deleteFile).toHaveBeenCalledWith(privateKey);
    });

    it("should handle delete errors", async () => {
      const error = new Error("Delete failed");
      error.statusCode = 500;
      mockStorageInstance.deleteFile.mockRejectedValue(error);
      
      await expect(fileService.deleteFile("invalid-key")).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalled();
    });

    it("should handle cleanup errors", async () => {
      const error = new Error("Cleanup failed");
      error.statusCode = 500;
      mockStorageInstance.cleanupInactiveFiles.mockRejectedValue(error);
      
      await expect(fileService.cleanupInactiveFiles()).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
