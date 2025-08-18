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

// Mock rate limit service as a singleton
const mockRateLimitService = {
  checkUploadLimit: jest.fn().mockResolvedValue({
    allowed: true,
    currentUsage: 0,
    limit: 1000000,
    remaining: 1000000
  }),
  checkDownloadLimit: jest.fn().mockResolvedValue(undefined),
  trackDownload: jest.fn().mockResolvedValue(undefined),
  client: {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined)
  }
};

// Mock the service as a singleton
jest.mock('../../services/rateLimit.service', () => mockRateLimitService);

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

      expect(res.body).toHaveProperty("message", "No file provided");
    });

    it("should return 400 for unsupported file types", async () => {
      const res = await request(app)
        .post("/files")
        .attach("file", testBuffer, "test.exe")
        .expect(400);

      expect(res.body).toHaveProperty("message", "Only certain file types are allowed");
    });

    it("should return 413 for files exceeding size limit", async () => {
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB
      const res = await request(app)
        .post("/files")
        .attach("file", largeBuffer, "large.txt")
        .expect(413);

      expect(res.body).toHaveProperty("message", "File too large");
    });

    it("should enforce upload limits", async () => {
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

      expect(res.body).toHaveProperty("message", "Daily upload limit exceeded");
      expect(res.body).toHaveProperty("details", "Please try again later");
    });

    it("should handle rate limit service unavailability", async () => {
      mockRateLimitService.checkUploadLimit.mockRejectedValueOnce(
        new Error("Rate limit service unavailable")
      );

      const res = await request(app)
        .post("/files")
        .attach("file", testBuffer, "test.txt")
        .expect(503);

      expect(res.body).toHaveProperty("message", "Service temporarily unavailable");
      expect(res.body).toHaveProperty("details", "Please try again later");
    });

    it("should handle concurrent file uploads", async () => {
      const uploads = Array(3).fill().map(() =>
        request(app)
          .post("/files")
          .attach("file", testBuffer, "test.txt")
      );

      const results = await Promise.all(uploads);
      results.forEach(res => {
        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty("publicKey");
        expect(res.body).toHaveProperty("privateKey");
      });
    });

    it("should return 404 for missing file", async () => {
      const res = await request(app)
        .get("/files/nonexistent-key")
        .expect(404);

      expect(res.body).toHaveProperty("message", "File not found");
      expect(res.body).toHaveProperty("details", "The requested file does not exist");
    });

    it("should enforce download limits", async () => {
      mockRateLimitService.checkDownloadLimit.mockRejectedValueOnce(
        new Error("Daily download limit exceeded")
      );

      const res = await request(app)
        .get("/files/mock-public")
        .expect(429);

      expect(res.body).toHaveProperty("message", "Daily download limit exceeded");
      expect(res.body).toHaveProperty("details", "Please try again later");
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

      expect(res.body).toHaveProperty("message", "File not found");
      expect(res.body).toHaveProperty("details", "The requested file does not exist");
    });

    it("should return 400 for malformed public key", async () => {
      const res = await request(app)
        .get("/files/invalid!@#$")
        .expect(400);

      expect(res.body).toHaveProperty("message", "Public key must be a 32-character hexadecimal string");
    });

    it("should enforce download limits", async () => {
      mockRateLimitService.checkDownloadLimit.mockRejectedValueOnce(
        new Error("Daily download limit exceeded")
      );

      const res = await request(app)
        .get("/files/mock-public")
        .expect(429);

      expect(res.body).toHaveProperty("message", "Daily download limit exceeded");
      expect(res.body).toHaveProperty("details", "Please try again later");
    });

    it("should handle rate limit service errors", async () => {
      mockRateLimitService.checkDownloadLimit.mockRejectedValueOnce(
        new Error("Rate limit service unavailable")
      );

      const res = await request(app)
        .get("/files/mock-public")
        .expect(503);

      expect(res.body).toHaveProperty("message", "Service temporarily unavailable");
      expect(res.body).toHaveProperty("details", "Please try again later");
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
        .expect(500);

      expect(res.body).toHaveProperty("message", "Invalid private key");
      expect(res.body).toHaveProperty("details", "No file matches the provided key");
    });

    it("should return 400 for malformed private key", async () => {
      const res = await request(app)
        .delete("/files/invalid!@#$")
        .expect(400);

      expect(res.body).toHaveProperty("message", "Private key must be a 32-character hexadecimal string");
    });

    it("should handle concurrent file deletions", async () => {
      const deletions = Array(3).fill().map(() =>
        request(app)
          .delete("/files/mock-private")
      );

      const results = await Promise.all(deletions);
      results.forEach(res => {
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ success: true });
      });
      expect(mockLocalStorage.deleteFile).toHaveBeenCalledTimes(3);
    });
  });
});
