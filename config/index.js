// Load environment variables from .env file into process.env
require("dotenv").config();

module.exports = {
  // Port number for the server to listen on (default: 3000)
  port: process.env.PORT || 3000,

  // Directory path for storing uploaded files (default: ./uploads)
  folder: process.env.FOLDER || "./uploads",

  // Storage provider type (e.g., local, google) (default: local)
  provider: process.env.PROVIDER || "local",

  // Path to provider-specific configuration file basically used for Google Cloud Storage
  configPath: process.env.CONFIG,

  // Time interval (in ms) for periodic cleanup processes (default: 60000 ms = 1 minute)
  timeToCleanUpProcess: process.env.TIME_TO_CLEAN_UP_PROCESS_IN_MS || 60000,

  // Period of inactivity after which files may be cleaned up (default: 30 days)
  inactivityPeriod: process.env.INACTIVITY_PERIOD || "30d",

  // Maximum upload limit per day (default: 100MB)
  dailyUploadLimit: process.env.DAILY_UPLOAD_LIMIT || "100MB",

  // Maximum download limit per day (default: 1GB)
  dailyDownloadLimit: process.env.DAILY_DOWNLOAD_LIMIT || "1GB",

  // Redis configuration for caching and rate limiting
  redis: {
    // Redis server hostname (default: localhost)
    host: process.env.REDIS_HOST || "localhost",

    // Redis server port (default: 6379)
    port: process.env.REDIS_PORT || 6379,

    // Redis password (if required)
    password: process.env.REDIS_PASSWORD,

    // Redis database index (default: 0)
    db: process.env.REDIS_DB || 0,
  },
};
