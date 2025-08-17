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

#### Google Cloud Storage Setup

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
- For Google Cloud Storage, ensure your service account config is correct
