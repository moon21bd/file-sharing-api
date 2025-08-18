// Mock dependencies before requiring the service
jest.mock("../../utils/logger");

// Mock config
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

// Create a mock implementation of the Redis client
const mockRedisClient = {
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  get: jest.fn(),
  incrBy: jest.fn().mockResolvedValue(undefined),
  expire: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
};

// Mock redis module
jest.mock("redis", () => ({
  createClient: jest.fn(() => mockRedisClient),
}));

/**
 * Unit tests for RateLimitService class
 * Covers all rate limit methods and edge cases
 */

const RateLimitService = require("../../services/rateLimit.service");

describe("RateLimitService Spec", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await RateLimitService.disconnect();
  });

  it("should parse size strings", () => {
    expect(RateLimitService.parseSize("100MB")).toBe(104857600);
    expect(RateLimitService.parseSize("1GB")).toBe(1073741824);
    expect(RateLimitService.parseSize("500KB")).toBe(512000);
  });

  it("should check upload limit", async () => {
    mockRedisClient.get.mockResolvedValueOnce("0");
    
    const result = await RateLimitService.checkUploadLimit("127.0.0.1", 1000);
    
    expect(result.allowed).toBe(true);
    expect(result.currentUsage).toBe(1000);
    expect(result.limit).toBeDefined();
    expect(result.remaining).toBeDefined();
    expect(mockRedisClient.incrBy).toHaveBeenCalled();
    expect(mockRedisClient.expire).toHaveBeenCalled();
  });

  it("should reject when over upload limit", async () => {
    mockRedisClient.get.mockResolvedValueOnce((100 * 1024 * 1024).toString());
    
    const result = await RateLimitService.checkUploadLimit("127.0.0.1", 1024);
    
    expect(result.allowed).toBe(false);
    expect(result.error.message).toBe("Daily upload limit exceeded");
    expect(result.error.statusCode).toBe(429);
    expect(result.error.currentUsage).toBeDefined();
    expect(result.error.limit).toBeDefined();
    expect(result.error.remaining).toBeDefined();
  });

  it("should handle upload limit service errors gracefully", async () => {
    mockRedisClient.get.mockRejectedValueOnce(new Error("Redis connection error"));
    
    const result = await RateLimitService.checkUploadLimit("127.0.0.1", 1024);
    
    expect(result.allowed).toBe(false);
    expect(result.error.message).toBe("Rate limit service unavailable");
    expect(result.error.statusCode).toBe(503);
  });

  it("should check download limit", async () => {
    mockRedisClient.get.mockResolvedValueOnce("0");
    
    await expect(RateLimitService.checkDownloadLimit("127.0.0.1")).resolves.not.toThrow();
  });

  it("should reject when over download limit", async () => {
    mockRedisClient.get.mockResolvedValueOnce((1000 * 1024 * 1024 * 1024).toString());
    
    const error = await expect(RateLimitService.checkDownloadLimit("127.0.0.1")).rejects.toThrow("Daily download limit exceeded");
    expect(error.statusCode).toBe(429);
  });

  it("should handle download limit service errors", async () => {
    mockRedisClient.get.mockRejectedValueOnce(new Error("Redis connection error"));
    
    await expect(RateLimitService.checkDownloadLimit("127.0.0.1")).rejects.toThrow();
  });

  it("should track download usage", async () => {
    mockRedisClient.get.mockResolvedValueOnce("100");
    
    await RateLimitService.trackDownload("127.0.0.1", 50);
    
    expect(mockRedisClient.incrBy).toHaveBeenCalledWith(expect.any(String), 50);
  });

  it("should set expiry for first download of the day", async () => {
    mockRedisClient.get.mockResolvedValueOnce(null);
    
    await RateLimitService.trackDownload("127.0.0.1", 50);
    
    expect(mockRedisClient.expire).toHaveBeenCalledWith(expect.any(String), 86400);
  });

  it("should handle tracking download service errors", async () => {
    mockRedisClient.incrBy.mockRejectedValueOnce(new Error("Redis connection error"));
    
    await expect(RateLimitService.trackDownload("127.0.0.1", 50)).rejects.toThrow();
  });
});