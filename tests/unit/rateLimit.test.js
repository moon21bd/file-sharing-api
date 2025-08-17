/**
 * Unit tests for rate limiting logic
 * Tests upload and download limits
 */

const { logger } = require("../../utils/logger");

// Mock Redis client
const mockRedisClient = {
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  get: jest.fn(),
  incrBy: jest.fn().mockResolvedValue(undefined),
  expire: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
};

// Mock dependencies
jest.mock("../../utils/logger");
jest.mock("../../config", () => ({
  dailyUploadLimit: "100MB",
  dailyDownloadLimit: "1GB",
  redis: {
    host: "localhost",
    port: 6379,
    password: null,
    db: 0,
  },
}));

jest.mock("redis", () => ({
  createClient: jest.fn().mockReturnValue(mockRedisClient),
}));

// Import after mocks
const rateLimitService = require("../../services/rateLimit.service");

describe("RateLimitService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("checkUploadLimit", () => {
    it("should allow upload under limit", async () => {
      mockRedisClient.get.mockResolvedValueOnce("0");
      
      const result = await rateLimitService.checkUploadLimit("127.0.0.1", 1000);
      
      expect(result.allowed).toBe(true);
      expect(result.currentUsage).toBe(1000);
      expect(result.limit).toBeDefined();
      expect(result.remaining).toBeDefined();
      expect(mockRedisClient.incrBy).toHaveBeenCalled();
      expect(mockRedisClient.expire).toHaveBeenCalled();
    });

    it("should reject when over limit", async () => {
      mockRedisClient.get.mockResolvedValueOnce((100 * 1024 * 1024).toString());
      
      const result = await rateLimitService.checkUploadLimit("127.0.0.1", 1024);
      
      expect(result.allowed).toBe(false);
      expect(result.error.message).toBe("Daily upload limit exceeded");
      expect(result.error.currentUsage).toBeDefined();
      expect(result.error.limit).toBeDefined();
      expect(result.error.remaining).toBeDefined();
    });

    it("should handle service errors gracefully", async () => {
      mockRedisClient.get.mockRejectedValueOnce(new Error("Redis connection error"));
      
      const result = await rateLimitService.checkUploadLimit("127.0.0.1", 1024);
      
      expect(result.allowed).toBe(false);
      expect(result.error.message).toBe("Rate limit service unavailable");
    });
  });

  describe("checkDownloadLimit", () => {
    it("should allow download under limit", async () => {
      mockRedisClient.get.mockResolvedValueOnce("0");
      
      await expect(rateLimitService.checkDownloadLimit("127.0.0.1")).resolves.not.toThrow();
    });

    it("should reject when over limit", async () => {
      mockRedisClient.get.mockResolvedValueOnce((1000 * 1024 * 1024 * 1024).toString());
      
      await expect(rateLimitService.checkDownloadLimit("127.0.0.1")).rejects.toThrow("Daily download limit exceeded");
    });

    it("should handle service errors", async () => {
      mockRedisClient.get.mockRejectedValueOnce(new Error("Redis connection error"));
      
      await expect(rateLimitService.checkDownloadLimit("127.0.0.1")).rejects.toThrow();
    });
  });

  describe("trackDownload", () => {
    it("should track download correctly", async () => {
      mockRedisClient.get.mockResolvedValueOnce("100");
      
      await rateLimitService.trackDownload("127.0.0.1", 50);
      
      expect(mockRedisClient.incrBy).toHaveBeenCalledWith(expect.any(String), 50);
    });

    it("should set expiry for first download of the day", async () => {
      mockRedisClient.get.mockResolvedValueOnce(null);
      mockRedisClient.incrBy.mockResolvedValueOnce(50);
      
      await rateLimitService.trackDownload("127.0.0.1", 50);
      
      expect(mockRedisClient.expire).toHaveBeenCalledWith(expect.any(String), 86400);
    });

    it("should handle service errors", async () => {
      mockRedisClient.incrBy.mockRejectedValueOnce(new Error("Redis connection error"));
      
      await expect(rateLimitService.trackDownload("127.0.0.1", 50)).rejects.toThrow();
    });
  });
});
