# File Sharing API

A secure and scalable file-sharing API built with Node.js and Express.  
Supports file upload, download, and deletion with configurable storage providers (local or Google Cloud Storage).  
Includes daily upload/download limits, automatic cleanup of inactive files, and robust logging/error handling.

---

## Installation & Setup Guide

### 1. Clone the repository
```bash
git clone https://github.com/moon21bd/file-sharing-api.git
cd file-sharing-api
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables
- Copy `.env.example` to `.env`:
  ```bash
  cp .env.example .env
  ```
- Edit `.env` to set your preferred configuration (port, storage provider, limits, etc).

### 4. (Optional) Configure Google Cloud Storage
- If using Google Cloud Storage, set `PROVIDER=google` and provide the path to your service account config in `.env`.

### 5. Start the server
```bash
npm start
```
- For development with auto-reload:
  ```bash
  npm run dev
  ```

---

## How to Run

1. Install dependencies:
    ```bash
    npm install
    ```

2. Start the server:
    ```bash
    npm start
    ```

3. Run tests:
    ```bash
    npm test
    ```

---

## Environment Variables

Create a `.env` file:
```
PORT=3000
FOLDER=./uploads
PROVIDER=local
INACTIVITY_PERIOD=30d
DAILY_UPLOAD_LIMIT=100MB
DAILY_DOWNLOAD_LIMIT=1GB
```

For Google Cloud Storage:
```
PROVIDER=google
CONFIG=./config/google-cloud.config.json
```

---

## Implementation Notes

1. **Storage Providers**: Implemented both local filesystem and Google Cloud Storage with identical interfaces
2. **Rate Limiting**: Used Redis to track daily upload/download limits per IP
3. **Cleanup Job**: Implemented as a background job that runs daily
4. **Error Handling**: Comprehensive error handling and logging throughout
5. **Testing**: Full test coverage for both unit and integration tests
6. **Configuration**: All aspects are configurable via environment variables

---

## Testing Guide

### Run all tests
```bash
npm test
```

### Run unit tests only
```bash
npm run test:unit
```

### Run integration tests only
```bash
npm run test:integration
```

### View coverage reports
- After running tests, open the `/coverage` folder for detailed coverage info.

---

## API Endpoints

- `POST /files` — Upload a file
- `GET /files/:publicKey` — Download a file
- `DELETE /files/:privateKey` — Delete a file

---

## Notes

- Daily upload/download limits and automatic cleanup are enforced per IP.
- Logs are stored in `/logs` and output to the console.
- For Google Cloud Storage, ensure your service account config is correct and the bucket exists.
