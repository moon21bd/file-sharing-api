/**
 * Abstract Storage Interface
 * All storage providers must implement these methods
 */
class StorageInterface {
  /**
   * Upload a file to storage
   * @param {Object} file - File object to upload
   * @throws {Error} If not implemented by subclass
   */
  async uploadFile(file) {
    throw new Error("Method not implemented");
  }

  /**
   * Download a file from storage
   * @param {string} publicKey - Public key for the file
   * @throws {Error} If not implemented by subclass
   */
  async downloadFile(publicKey) {
    throw new Error("Method not implemented");
  }

  /**
   * Delete a file from storage
   * @param {string} privateKey - Private key for the file
   * @throws {Error} If not implemented by subclass
   */
  async deleteFile(privateKey) {
    throw new Error("Method not implemented");
  }

  /**
   * Cleanup inactive files from storage
   * @param {string} inactivityPeriod - Period of inactivity
   * @throws {Error} If not implemented by subclass
   */
  async cleanupInactiveFiles(inactivityPeriod) {
    throw new Error("Method not implemented");
  }
}

module.exports = StorageInterface;