import { scrypt as scryptCallback, webcrypto } from "node:crypto";

const encoder = new TextEncoder();

// OWASP scrypt profile: N=2^14, r=8, p=5 (16 MiB working set).
// workerd's default scrypt cost ceiling is N*r*p <= 2^20; this profile is 655,360.
const SCRYPT_N = 1 << 14;
const SCRYPT_R = 8;
const SCRYPT_P = 5;
const SCRYPT_KEY_BYTES = 32;
const SCRYPT_MAXMEM_BYTES = 64 * 1024 * 1024;
const SCRYPT_PREFIX = "scrypt$v1$N=16384,r=8,p=5$";
const LEGACY_PBKDF2_MAX_ITERATIONS = 100_000;
const DUMMY_SALT = new Uint8Array(16);
const HEX_16_BYTES = /^[0-9a-f]{32}$/i;
const HEX_32_BYTES = /^[0-9a-f]{64}$/i;

function toHex(bytes) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function fromHex(value) {
  if (typeof value !== "string" || !HEX_16_BYTES.test(value)) return null;
  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i++) out[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function equalHex(left, right) {
  if (typeof left !== "string" || typeof right !== "string" || left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

function deriveScrypt(password, salt) {
  return new Promise((resolve, reject) => {
    scryptCallback(
      encoder.encode(password),
      salt,
      SCRYPT_KEY_BYTES,
      { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: SCRYPT_MAXMEM_BYTES },
      (error, derivedKey) => {
        if (error) reject(error);
        else resolve(new Uint8Array(derivedKey));
      }
    );
  });
}

async function deriveLegacyPbkdf2(password, salt, iterations) {
  const key = await webcrypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await webcrypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    SCRYPT_KEY_BYTES * 8
  );
  return new Uint8Array(bits);
}

async function burnDummyScrypt(password) {
  await deriveScrypt(password, DUMMY_SALT);
}

export async function hashPassword(password, saltHex) {
  if (typeof password !== "string") throw new TypeError("Password must be a string");
  const salt = fromHex(saltHex);
  if (!salt) throw new TypeError("Password salt must be 16 bytes encoded as hexadecimal");
  const derived = await deriveScrypt(password, salt);
  return SCRYPT_PREFIX + toHex(derived);
}

// Existing database rows store an unprefixed PBKDF2-SHA-256 hex digest and its
// iteration count. Those rows are verified once and transparently upgraded to scrypt.
export async function verifyPassword(password, saltHex, storedHash, legacyIterations) {
  if (typeof password !== "string") return { valid: false, needsRehash: false, unsupported: true };
  const salt = fromHex(saltHex);
  if (!salt || typeof storedHash !== "string") {
    await burnDummyScrypt(password);
    return { valid: false, needsRehash: false, unsupported: true };
  }

  if (storedHash.startsWith(SCRYPT_PREFIX)) {
    const expected = storedHash.slice(SCRYPT_PREFIX.length).toLowerCase();
    if (!HEX_32_BYTES.test(expected)) {
      await burnDummyScrypt(password);
      return { valid: false, needsRehash: false, unsupported: true };
    }
    const actual = toHex(await deriveScrypt(password, salt));
    return { valid: equalHex(actual, expected), needsRehash: false, unsupported: false };
  }

  // Any unknown scrypt version/parameters fail closed. Never trust DB-stored
  // KDF parameters to control memory or CPU cost.
  if (storedHash.startsWith("scrypt$")) {
    await burnDummyScrypt(password);
    return { valid: false, needsRehash: false, unsupported: true };
  }

  const iterations = Number(legacyIterations);
  if (
    !HEX_32_BYTES.test(storedHash) ||
    !Number.isSafeInteger(iterations) ||
    iterations < 1 ||
    iterations > LEGACY_PBKDF2_MAX_ITERATIONS
  ) {
    await burnDummyScrypt(password);
    return { valid: false, needsRehash: false, unsupported: true };
  }

  const actual = toHex(await deriveLegacyPbkdf2(password, salt, iterations));
  const valid = equalHex(actual, storedHash.toLowerCase());
  if (!valid) await burnDummyScrypt(password);
  return { valid, needsRehash: valid, unsupported: false };
}
