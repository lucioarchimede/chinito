const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';

// Derive a stable 32-byte key from ENCRYPTION_KEY env var.
// Cached after first call so scrypt doesn't run on every encrypt/decrypt.
let _key = null;
function getKey() {
  if (!_key) {
    const secret = process.env.ENCRYPTION_KEY || 'dev-only-insecure-key-change-in-prod';
    _key = crypto.scryptSync(secret, 'ecomdash-salt-v1', 32);
  }
  return _key;
}

/**
 * Encrypt a string. Returns "ivHex:encryptedHex".
 * Safe to store in DB; IV is random per call.
 */
function encrypt(text) {
  const key = getKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt a string produced by encrypt().
 */
function decrypt(text) {
  const [ivHex, encryptedHex] = text.split(':');
  const key = getKey();
  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

module.exports = { encrypt, decrypt };
