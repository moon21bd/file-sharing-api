/**
 * Unit tests for LocalStorage class
 * Tests local file upload, download, and delete logic
 */

const fs = require("fs");
const fsp = require("fs").promises;
const path = require("path");
const stream = require("stream");
const { Readable } = stream;
const LocalStorage = require("../../models/storage/localStorage");
const { logger } = require("../../utils/logger");
const { generateKeys } = require("../../utils/generateKeys");

jest.mock("../../utils/logger");
jest.mock("../../utils/generateKeys", () => ({
  generateKeys: jest.fn().mockReturnValue({
    publicKey: "test-public-key",
    privateKey: "test-private-key"
  })
}));

jest.mock("fs", () => ({
  constants: { R_OK: 4 },
  createWriteStream: jest.fn().mockReturnValue({
    write: jest.fn((buffer, callback) => callback && callback()),
    end: jest.fn((callback) => callback && callback())
  }),
  createReadStream: jest.fn().mockReturnValue({
    pipe: jest.fn()
  }),
  existsSync: jest.fn().mockReturnValue(true)
}));

jest.mock("fs/promises", () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn(),
  readdir: jest.fn(),
  unlink: jest.fn().mockResolvedValue(undefined),
  access: jest.fn().mockResolvedValue(undefined),
  stat: jest.fn()
}));

jest.mock("stream", () => ({
  ...jest.requireActual("stream"),
  pipeline: jest.fn().mockImplementation((stream, writeStream, callback) => {
    callback();
  }),
  Readable: {
    from: jest.fn().mockReturnValue({
      pipe: jest.fn()
    })
  }
}));

describe("LocalStorage", () => {
  const testFolder = "./test-uploads";
  let storage;

  beforeEach(() => {
    jest.clearAllMocks();
    storage = new LocalStorage(testFolder);
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("uploadFile()", () => {
    it("should upload file with buffer", async () => {
      const mockFile = {
        buffer: Buffer.from("test"),
        originalname: "test.txt",
        mimetype: "text/plain",
        size: 123,
      };

      // Mock the write stream
      const mockWriteStream = {
        write: jest.fn((buffer, callback) => callback()),
        end: jest.fn((callback) => callback())
      };
      fs.createWriteStream.mockReturnValue(mockWriteStream);

      const result = await storage.uploadFile(mockFile);

      expect(result).toHaveProperty("publicKey", "test-public-key");
      expect(result).toHaveProperty("privateKey", "test-private-key");
      expect(fs.createWriteStream).toHaveBeenCalledWith(
        path.join(testFolder, "test-public-key")
      );
      expect(fsp.writeFile).toHaveBeenCalled(); // For metadata
    });

    it("should upload file with stream", async () => {
      const mockFile = {
        stream: { pipe: jest.fn() },
        originalname: "test.txt",
        mimetype: "text/plain",
        size: 123,
      };

      const mockWriteStream = { write: jest.fn(), end: jest.fn() };
      fs.createWriteStream.mockReturnValue(mockWriteStream);

      const result = await storage.uploadFile(mockFile);

      expect(result).toHaveProperty("publicKey");
      expect(result).toHaveProperty("privateKey");
      expect(stream.pipeline).toHaveBeenCalled();
    });

    it("should handle upload errors", async () => {
      const mockFile = {
        buffer: Buffer.from("test"),
        originalname: "test.txt",
        mimetype: "text/plain",
        size: 123,
      };

      // Mock a write error
      const mockWriteStream = {
        write: jest.fn((buffer, callback) => callback(new Error("Write failed"))),
        end: jest.fn()
      };
      fs.createWriteStream.mockReturnValue(mockWriteStream);

      await expect(storage.uploadFile(mockFile)).rejects.toThrow();
      expect(fsp.unlink).toHaveBeenCalled(); // Should attempt cleanup
    });
  });

  describe("downloadFile()", () => {
    it("should download file with valid public key", async () => {
      const publicKey = "test-public-key";
      const mockMetadata = {
        privateKey: "test-private-key",
        originalName: "test.txt",
        mimeType: "text/plain",
        size: 123,
        uploadedAt: new Date().toISOString(),
        lastAccessed: new Date().toISOString()
      };

      fsp.readFile.mockResolvedValue(JSON.stringify(mockMetadata));
      fsp.stat.mockResolvedValue({ size: 123 });
      fs.createReadStream.mockReturnValue({ pipe: jest.fn() });

      const result = await storage.downloadFile(publicKey);

      expect(result).toHaveProperty("stream");
      expect(result).toHaveProperty("mimeType", "text/plain");
      expect(result).toHaveProperty("originalName", "test.txt");
      expect(result).toHaveProperty("size", 123);
      expect(fsp.writeFile).toHaveBeenCalled(); // Should update lastAccessed
    });

    it("should throw 404 for non-existent file", async () => {
      const publicKey = "nonexistent-key";
      
      // Mock file not found
      const error = new Error("ENOENT");
      error.code = "ENOENT";
      fsp.access.mockRejectedValue(error);

      try {
        await storage.downloadFile(publicKey);
        fail("Should have thrown an error");
      } catch (err) {
        expect(err.statusCode).toBe(404);
        expect(err.message).toContain("File not found");
      }
    });
  });

  describe("deleteFile()", () => {
    it("should delete file with valid private key", async () => {
      // Setup mock implementations
      fsp.readdir.mockResolvedValue(["testfile.meta"]);
      fsp.readFile.mockResolvedValue(
        JSON.stringify({
          privateKey: "valid-key",
          originalName: "test.txt",
        })
      );

      const result = await storage.deleteFile("valid-key");
      
      expect(result.success).toBe(true);
      expect(fsp.unlink).toHaveBeenCalledTimes(2); // File and metadata
    });

    it("should throw for invalid private key", async () => {
      fsp.readdir.mockResolvedValue(["abc123.meta"]);
      fsp.readFile.mockResolvedValue(
        JSON.stringify({ privateKey: "different-key" })
      );

      const error = await storage.deleteFile("invalid-key");
      expect(error.statusCode).toBe(500);
      expect(error.message).toContain("Invalid private key");
    });
  });
});
