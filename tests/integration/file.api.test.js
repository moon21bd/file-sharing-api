const request = require("supertest");
const fs = require("fs");
const path = require("path");

// Mock Redis before requiring app or rateLimitService
const mockRedisClient = {
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  get: jest.fn().mockResolvedValue("0"),
  incrBy: jest.fn().mockResolvedValue(undefined),
  expire: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
  quit: jest.fn().mockResolvedValue(undefined),
};

jest.mock("redis", () => ({
  createClient: jest.fn(() => mockRedisClient),
}));

// Mock LocalStorage
const mockLocalStorage = {
  uploadFile: jest.fn().mockResolvedValue({
    publicKey: 'mock-public',
    privateKey: 'mock-private'
  }),
  downloadFile: jest.fn().mockImplementation((publicKey) => {
    if (publicKey === 'nonexistent-key') {
      const error = new Error('File not found');
      error.statusCode = 404;
      throw error;
    }
    return { 
      stream: fs.createReadStream(path.join(__dirname, '../../package.json')),
      mimeType: 'text/plain',
      originalName: 'test.txt',
      size: 100
    };
  }),
  deleteFile: jest.fn().mockImplementation((privateKey) => {
    if (privateKey === 'invalid-key') {
      const error = new Error('Invalid private key');
      error.statusCode = 500;
      throw error;
    }
    return { success: true };
  })
};

jest.mock('../../models/storage/localStorage', () => {
  return jest.fn().mockImplementation(() => mockLocalStorage);
});

// Now require the app after mocks are set up
const app = require("../../app");

// Mock rate limit service first, then define the mock object
const mockRateLimitService = {
  checkUploadLimit: jest.fn().mockResolvedValue({
    allowed: true,
    currentUsage: 0,
    limit: 1000000,
    remaining: 1000000
  }),
  checkDownloadLimit: jest.fn().mockResolvedValue(undefined),
  trackDownload: jest.fn().mockResolvedValue(undefined)
};

// Use the factory pattern for the mock to avoid reference errors
jest.mock('../../services/rateLimit.service', () => {
  return jest.fn(() => mockRateLimitService);
});

describe("File API", () => {
  const testBuffer = Buffer.from("Test content");

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /files", () => {
    it("should upload file and return keys", async () => {
      const res = await request(app)
        .post("/files")
        .attach("file", testBuffer, "test.txt")
        .expect(201);

      expect(res.body).toHaveProperty("publicKey");
      expect(res.body).toHaveProperty("privateKey");
      expect(res.body).toHaveProperty("rateLimit");
      expect(mockLocalStorage.uploadFile).toHaveBeenCalled();
    });

    it("should return 400 when no file is provided", async () => {
      const res = await request(app)
        .post("/files")
        .expect(400);

      expect(res.body).toHaveProperty("error", "No file provided");
    });

    it("should enforce upload limits", async () => {
      // Mock rate limit service to reject
      mockRateLimitService.checkUploadLimit.mockResolvedValueOnce({
        allowed: false,
        error: {
          message: "Daily upload limit exceeded",
          currentUsage: 1000000,
          limit: 1000000,
          remaining: 0
        }
      });

      const res = await request(app)
        .post("/files")
        .attach("file", testBuffer, "test.txt")
        .expect(429);

      expect(res.body).toHaveProperty("error", "Daily upload limit exceeded");
    });
  });

  describe("GET /files/:publicKey", () => {
    it("should download existing file", async () => {
      const res = await request(app)
        .get("/files/mock-public")
        .expect(200);

      expect(res.headers["content-type"]).toBe("text/plain");
      expect(res.headers["content-disposition"]).toContain("attachment");
      expect(mockLocalStorage.downloadFile).toHaveBeenCalledWith("mock-public");
    });

    it("should return 404 for missing file", async () => {
      const res = await request(app)
        .get("/files/nonexistent-key")
        .expect(404);

      expect(res.body).toHaveProperty("error", "Invalid private key");
    });

    it("should enforce download limits", async () => {
      mockRateLimitService.checkDownloadLimit.mockRejectedValueOnce(
        new Error("Daily download limit exceeded")
      );

      const res = await request(app)
        .get("/files/mock-public")
        .expect(429);

      expect(res.body).toHaveProperty("error", "Daily download limit exceeded");
    });
  });

  describe("DELETE /files/:privateKey", () => {
    it("should delete file with valid private key", async () => {
      const res = await request(app)
        .delete("/files/mock-private")
        .expect(200);

      expect(res.body).toEqual({ success: true });
      expect(mockLocalStorage.deleteFile).toHaveBeenCalledWith("mock-private");
    });

    it("should handle invalid private key", async () => {
      const res = await request(app)
        .delete("/files/invalid-key")
        .expect(200);

      expect(res.body).toHaveProperty("error", "Invalid private key");
    });
  });
});
