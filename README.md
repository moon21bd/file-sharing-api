# File Sharing API Server

A secure, scalable, and well-tested file-sharing API built with Node.js and Express.  
Supports file upload, download, and deletion with configurable storage providers (local filesystem or Google Cloud Storage).  
Includes daily upload/download limits, automatic cleanup of inactive files, robust logging, and comprehensive error handling.

---

## Executive Overview (For Recruiters & Hiring Managers)

This project is a robust file-sharing API designed to provide a secure and user-friendly way to upload, download, and manage files. It was built to demonstrate expertise in backend development, scalable architecture, and cloud integrations, making it suitable for real-world applications that require reliable file management with strict usage controls.

---

## Technical Overview (For Engineers)

- **Main Technologies:** Node.js, Express, Redis, Jest, Supertest, Google Cloud Storage, Winston, Multer  
- **Architecture Highlights:**  
  - Clear separation of concerns with controllers and services  
  - Pluggable storage providers supporting local filesystem and Google Cloud Storage  
  - Background cleanup job for removing inactive files  
  - Comprehensive error handling and centralized logging with Winston  
  - Environment-driven configuration for flexible deployment and management  

---

## Architecture Diagram

![File Sharing API Architecture](docs/diagram.png)

*The diagram above illustrates the main components: REST API endpoints, daily usage limiter, inactive storage cleanup job, and pluggable storage providers (local or Google Cloud Storage).*

---

## Table of Contents

- [Features](#features)
- [Architecture Overview](#architecture-overview)
- [Installation & Setup](#installation--setup)
- [Environment Variables](#environment-variables)
- [Google Cloud Storage Setup](#google-cloud-storage-setup)
- [How to Run](#how-to-run)
- [REST API Endpoints](#rest-api-endpoints)
- [Sample Requests & Responses](#sample-requests--responses)
- [Postman Collection](#postman-collection)
- [Testing Guide](#testing-guide)
- [Coding Style & Productivity](#coding-style--productivity)
- [Implementation Notes](#implementation-notes)
- [Troubleshooting & Notes](#troubleshooting--notes)

---

## Features

- **File Upload, Download, Delete**: RESTful endpoints for file operations.
- **Configurable Storage Providers**: Local filesystem or Google Cloud Storage (easy to extend for AWS/Azure).
- **Rate Limiting**: Daily upload/download limits per IP, tracked via Redis.
- **Automatic Cleanup**: Background job removes inactive files after a configurable period.
- **Robust Logging & Error Handling**: Centralized logging and error responses.
- **Full Test Coverage**: Unit and integration tests for all major components.
- **Commented Code**: All code is thoroughly commented for maintainability.

---

## Architecture Overview

- **Express.js**: Main web framework.
- **Multer**: Handles file uploads.
- **Storage Providers**: Pluggable interface for local and cloud storage.
- **Redis**: Tracks daily upload/download limits per IP.
- **Winston**: Logging.
- **Background Job**: Periodic cleanup of inactive files.
- **Testing**: Jest and Supertest for unit/integration tests.

---

## Installation & Setup

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

---

## Environment Variables

Create a `.env` file with the following example configuration:

```
PORT=6000                     # Port number for the server to listen on
FOLDER=./uploads              # Directory path for storing uploaded files
PROVIDER=local                # Storage provider type (local or google)

INACTIVITY_PERIOD=10m         # Period of inactivity before cleanup (default: 30d)
DAILY_UPLOAD_LIMIT=5MB        # Maximum upload limit per day (default: 100MB)
DAILY_DOWNLOAD_LIMIT=3MB      # Maximum download limit per day (default: 1GB)
TIME_TO_CLEAN_UP_PROCESS_IN_MS=60000 # Cleanup interval in milliseconds (default: 1 minute)

# For Redis configuration:
REDIS_HOST=localhost          # Redis server hostname
REDIS_PORT=6379               # Redis server port
REDIS_PASSWORD=               # Redis password (leave empty if not required)
REDIS_DB=0                    # Redis database index

# For Google Cloud Storage:
# PROVIDER=google             # Uncomment to use Google Cloud Storage provider
CONFIG=./config/google-cloud.config.json # Path to Google Cloud config file
```

---

## Google Cloud Storage Setup

If you want to use Google Cloud Storage as your provider, follow these steps:

1. **Create a Google Cloud Project**  
   - Go to [Google Cloud Console](https://console.cloud.google.com/).
   - Create a new project or select an existing one.

2. **Enable Google Cloud Storage API**  
   - In your project, go to "APIs & Services" > "Library".
   - Search for "Cloud Storage" and enable it.

3. **Create a Service Account**  
   - Go to "IAM & Admin" > "Service Accounts".
   - Click "Create Service Account".
   - Assign a name and description.
   - Grant the service account "Storage Admin" role.
   - Click "Done".

4. **Generate Service Account Key**  
   - Click on your service account.
   - Go to "Keys" tab.
   - Click "Add Key" > "Create new key" > "JSON".
   - Download the JSON file.

5. **Create a Storage Bucket**  
   - Go to "Storage" > "Buckets".
   - Click "Create" and follow the instructions.

6. **Configure the API**  
   - Copy the downloaded JSON file to `config/google-cloud.config.json`.
   - Edit the file and add `"bucket_name": "your-bucket-name"` at the end.
   - Your config should look like:
     ```json
     {
       "type": "service_account",
       "project_id": "your-project-id",
       "private_key_id": "your_private_key_id",
       "private_key": "-----BEGIN PRIVATE KEY-----\nYOUR LONG PRIVATE KEY HERE\n-----END PRIVATE KEY-----\n",
       "client_email": "your-service-account-email",
       "client_id": "your_client_id",
       "auth_uri": "https://accounts.google.com/o/oauth2/auth",
       "token_uri": "https://oauth2.googleapis.com/token",
       "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
       "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/your-service-account-email",
       "universe_domain": "googleapis.com",
       "bucket_name": "your-bucket-name"
     }
     ```
   - **Tip:** You can copy the example config:
     ```bash
     cp config/google-cloud.config.example.json config/google-cloud.config.json
     ```
     Then update the values as described above.

7. **Set Environment Variables**
   - In your `.env` file, set:
     ```
     PROVIDER=google
     CONFIG=./config/google-cloud.config.json
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

After starting the server, you can interact with the API using tools like [Postman](https://www.postman.com/) or `curl`.

---

## REST API Endpoints

### 1. Upload a File

**POST** `/files`  
Upload a file (multipart/form-data, field name: `file`).

**Sample Request (curl):**
```bash
curl -X POST http://localhost:6000/files \
  -H "Content-Type: multipart/form-data" \
  -F "file=@/path/to/your/testfile.txt"
```

**Sample Response:**
```json
{
    "publicKey": "de46cf0d8a7ad373f07eb89ed5fcb59d",
    "privateKey": "cab1bbb107b80a56519545f6e50d260204fbe8dd232c57801c60be450abc0188"
}
```

---

### 2. Download a File

**GET** `/files/:publicKey`  
Download a file by its public key.

**Sample Request (curl):**
```bash
curl -O http://localhost:6000/files/de46cf0d8a7ad373f07eb89ed5fcb59d
```

**Sample Response:**  
Returns the file as an attachment.

---

### 3. Delete a File

**DELETE** `/files/:privateKey`  
Delete a file by its private key.

**Sample Request (curl):**
```bash
curl -X DELETE http://localhost:6000/files/cab1bbb107b80a56519545f6e50d260204fbe8dd232c57801c60be450abc0188
```

**Sample Response:**
```json
{
  "success": true
}
```

---

## Postman Collection

A ready-to-use Postman collection is provided for quick API testing and demonstration.

- **Location:** [`docs/File-Sharing-API-Server.postman_collection.json`](docs/File-Sharing-API-Server.postman_collection.json)
- **Import Instructions:**
  1. Open [Postman](https://www.postman.com/).
  2. Click "Import" and select the collection file.
  3. Use the pre-configured requests for upload, download, and delete operations.
  4. Set the `baseurl` variable to your running server (e.g., `http://localhost:6000`).

**Collection Overview:**
- **POST /files** — Upload a file (form-data, key: `file`)
- **GET /files/:publicKey** — Download a file
- **DELETE /files/:privateKey** — Delete a file

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

## Coding Style & Productivity

- **Consistent Formatting:** Use [Prettier](https://prettier.io/) or your IDE's formatter for clean code.
- **Modular Structure:** Keep controllers, services, models, and routes in separate folders.
- **Comment Your Code:** All major logic and configuration files are commented for clarity.
- **Environment Driven:** Use `.env` for all configuration—never hardcode secrets.
- **Testing:** Write unit and integration tests for every new feature.
- **Error Handling:** Always handle errors and log them using the provided logger.
- **Latest Node.js LTS:** Ensure you are running the latest Node.js LTS version.

---

## Implementation Notes

1. **Storage Providers:** Both local filesystem and Google Cloud Storage are supported with identical interfaces.
2. **Rate Limiting:** Redis tracks daily upload/download limits per IP.
3. **Cleanup Job:** Background job runs periodically to remove inactive files.
4. **Error Handling:** Centralized error middleware and logging.
5. **Testing:** Full coverage for unit and integration tests.
6. **Configuration:** All aspects are configurable via environment variables.

---

## Troubleshooting & Notes

- Daily upload/download limits and automatic cleanup are enforced per IP.
- Logs are stored in `/logs` and output to the console.
- For Google Cloud Storage, ensure your service account config is correct and the bucket exists.
- If you encounter permission errors with Google Cloud, double-check your service account roles and bucket permissions.
- For Redis issues, ensure your Redis server is running and accessible with the provided credentials.
- All code is written in JavaScript and thoroughly commented.
