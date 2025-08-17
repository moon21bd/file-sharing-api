const { vol } = require("memfs");

// Mock Redis client to prevent open handles
jest.mock("redis", () => {
  const mockRedisClient = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    quit: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    get: jest.fn().mockResolvedValue("0"),
    incrBy: jest.fn().mockResolvedValue(undefined),
    expire: jest.fn().mockResolvedValue(undefined)
  };
  return {
    createClient: jest.fn().mockReturnValue(mockRedisClient)
  };
});

// Mock file service to prevent cleanup job errors
jest.mock("../services/file.service", () => ({
  cleanupInactiveFiles: jest.fn().mockResolvedValue({ deletedCount: 0 }),
  uploadFile: jest.fn(),
  downloadFile: jest.fn(),
  deleteFile: jest.fn()
}));

// Mock rateLimit service
jest.mock("../services/rateLimit.service", () => ({
  checkUploadLimit: jest.fn().mockResolvedValue({ allowed: true }),
  checkDownloadLimit: jest.fn().mockResolvedValue(undefined),
  trackDownload: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined)
}));

// Set up mock filesystem
vol.mkdirSync("/test-uploads", { recursive: true });

// Cleanup after tests
afterAll(async () => {
  try {
    const cleanupJob = require("../jobs/cleanup.job");
    cleanupJob.stop();
  } catch (error) {
    console.error("Error during test cleanup:", error);
  }
});
