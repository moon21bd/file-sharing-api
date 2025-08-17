const crypto = require("crypto"); // Import Node.js crypto module for secure random bytes

/**
 * Generates unique public and private keys for file access and storage.
 * The public key is used for file access, while the private key is used for storage.
 * @returns {Object} An object containing the publicKey and privateKey.
 */
module.exports.generateKeys = () => {
  return {
    publicKey: crypto.randomBytes(16).toString("hex"), // Generate 16-byte hex public key
    privateKey: crypto.randomBytes(32).toString("hex"), // Generate 32-byte hex private key
  };
};