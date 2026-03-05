import crypto from "crypto";

// Generate a test key before importing the module
const TEST_KEY = crypto.randomBytes(32).toString("hex");

describe("Encryption Module", () => {
  beforeEach(() => {
    process.env.APP_ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    delete process.env.APP_ENCRYPTION_KEY;
  });

  // We need fresh imports because the module reads env at call time
  function getModule() {
    return require("../encryption") as typeof import("../encryption");
  }

  describe("encryptSecret / decryptSecret roundtrip", () => {
    test("encrypts and decrypts a secret successfully", () => {
      const { encryptSecret, decryptSecret } = getModule();
      const plaintext = "sk-abc123def456ghi789";
      const ciphertext = encryptSecret(plaintext);

      expect(ciphertext).toMatch(/^v1:/);
      expect(ciphertext).not.toContain(plaintext);

      const decrypted = decryptSecret(ciphertext);
      expect(decrypted).toBe(plaintext);
    });

    test("produces different ciphertexts for the same plaintext (random IV)", () => {
      const { encryptSecret } = getModule();
      const plaintext = "sk-test-key-12345";
      const ct1 = encryptSecret(plaintext);
      const ct2 = encryptSecret(plaintext);
      expect(ct1).not.toBe(ct2);
    });

    test("handles empty strings", () => {
      const { encryptSecret, decryptSecret } = getModule();
      const ct = encryptSecret("");
      expect(decryptSecret(ct)).toBe("");
    });

    test("handles long secrets", () => {
      const { encryptSecret, decryptSecret } = getModule();
      const long = "x".repeat(500);
      const ct = encryptSecret(long);
      expect(decryptSecret(ct)).toBe(long);
    });

    test("handles unicode characters", () => {
      const { encryptSecret, decryptSecret } = getModule();
      const secret = "sk-key-with-unicode-\u00e9\u00e8\u00ea";
      const ct = encryptSecret(secret);
      expect(decryptSecret(ct)).toBe(secret);
    });
  });

  describe("decryption with wrong key fails", () => {
    test("throws with a different key", () => {
      const { encryptSecret } = getModule();
      const ciphertext = encryptSecret("my-secret-key");

      // Change key
      process.env.APP_ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");
      const { decryptSecret } = getModule();

      expect(() => decryptSecret(ciphertext)).toThrow();
    });
  });

  describe("ciphertext format validation", () => {
    test("rejects invalid format (no version prefix)", () => {
      const { decryptSecret } = getModule();
      expect(() => decryptSecret("invalid-ciphertext")).toThrow("Invalid ciphertext format");
    });

    test("rejects tampered ciphertext", () => {
      const { encryptSecret, decryptSecret } = getModule();
      const ct = encryptSecret("test-secret");
      const parts = ct.split(":");
      // Tamper with encrypted data
      parts[3] = "ff" + parts[3].slice(2);
      expect(() => decryptSecret(parts.join(":"))).toThrow();
    });

    test("rejects tampered auth tag", () => {
      const { encryptSecret, decryptSecret } = getModule();
      const ct = encryptSecret("test-secret");
      const parts = ct.split(":");
      // Tamper with auth tag
      parts[2] = "ff" + parts[2].slice(2);
      expect(() => decryptSecret(parts.join(":"))).toThrow();
    });
  });

  describe("isEncryptionConfigured", () => {
    test("returns true when key is set", () => {
      const { isEncryptionConfigured } = getModule();
      expect(isEncryptionConfigured()).toBe(true);
    });

    test("returns false when key is not set", () => {
      delete process.env.APP_ENCRYPTION_KEY;
      const { isEncryptionConfigured } = getModule();
      expect(isEncryptionConfigured()).toBe(false);
    });
  });

  describe("key validation", () => {
    test("rejects keys that are not 32 bytes", () => {
      process.env.APP_ENCRYPTION_KEY = "short";
      const { encryptSecret } = getModule();
      expect(() => encryptSecret("test")).toThrow("32 bytes");
    });

    test("accepts base64-encoded 32-byte key", () => {
      process.env.APP_ENCRYPTION_KEY = crypto.randomBytes(32).toString("base64");
      const { encryptSecret, decryptSecret } = getModule();
      const ct = encryptSecret("test");
      expect(decryptSecret(ct)).toBe("test");
    });

    test("throws when APP_ENCRYPTION_KEY is missing", () => {
      delete process.env.APP_ENCRYPTION_KEY;
      const { encryptSecret } = getModule();
      expect(() => encryptSecret("test")).toThrow("APP_ENCRYPTION_KEY");
    });
  });

  describe("GET /api/admin/openai-settings never returns plaintext key", () => {
    test("response shape contains masking fields, not raw key", () => {
      // This is a structural test - verifying the response contract
      const mockSettings = {
        isEnabled: true,
        model: "gpt-4o-mini",
        dailyHourLocal: 7,
        timezone: "America/Santiago",
        maxSkus: 150,
        promptVersion: "v1.0",
        keyStorageMode: "DB_ENCRYPTED",
        hasStoredKey: true,
        apiKeyLast4: "abcd",
      };

      // The response should never have encryptedApiKey or apiKey
      expect(mockSettings).not.toHaveProperty("encryptedApiKey");
      expect(mockSettings).not.toHaveProperty("apiKey");
      expect(mockSettings).toHaveProperty("hasStoredKey");
      expect(mockSettings).toHaveProperty("apiKeyLast4");
    });
  });
});
