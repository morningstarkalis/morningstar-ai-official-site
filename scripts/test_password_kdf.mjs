import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { hashPassword, verifyPassword } from "../src/password.mjs";

const saltA = "00112233445566778899aabbccddeeff";
const saltB = "ffeeddccbbaa99887766554433221100";
const password = "MorningStar-Test-Password-2026!";

const hashA = await hashPassword(password, saltA);
const hashB = await hashPassword(password, saltB);
assert.match(hashA, /^scrypt\$v1\$N=16384,r=8,p=5\$[0-9a-f]{64}$/);
assert.notEqual(hashA, hashB, "different salts must produce different hashes");

const correct = await verifyPassword(password, saltA, hashA, 0);
assert.deepEqual(correct, { valid: true, needsRehash: false, unsupported: false });

const incorrect = await verifyPassword("Wrong-Password-2026!", saltA, hashA, 0);
assert.equal(incorrect.valid, false, "wrong password must not authenticate");

const malformed = await verifyPassword(password, saltA, "scrypt$v9$attacker-controlled-parameters$00", 0);
assert.equal(malformed.valid, false);
assert.equal(malformed.unsupported, true, "unknown schemes must fail closed");

const legacySalt = new Uint8Array(16);
legacySalt.fill(0x5a);
const legacyKey = await webcrypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(password),
  "PBKDF2",
  false,
  ["deriveBits"]
);
const legacyBits = await webcrypto.subtle.deriveBits(
  { name: "PBKDF2", salt: legacySalt, iterations: 31_000, hash: "SHA-256" },
  legacyKey,
  256
);
const legacyHex = Array.from(new Uint8Array(legacyBits), (b) => b.toString(16).padStart(2, "0")).join("");
const legacySaltHex = Array.from(legacySalt, (b) => b.toString(16).padStart(2, "0")).join("");

const legacyValid = await verifyPassword(password, legacySaltHex, legacyHex, 31_000);
assert.deepEqual(legacyValid, { valid: true, needsRehash: true, unsupported: false });

const legacyWrong = await verifyPassword("Wrong-Password-2026!", legacySaltHex, legacyHex, 31_000);
assert.equal(legacyWrong.valid, false, "legacy wrong password must not authenticate");

const overLimitLegacy = await verifyPassword(password, legacySaltHex, legacyHex, 600_000);
assert.equal(overLimitLegacy.valid, false, "legacy values above Workers' WebCrypto ceiling must fail closed");
assert.equal(overLimitLegacy.unsupported, true);

console.log("PASS: scrypt hash creation, salt uniqueness, correct/wrong password, version guard, legacy PBKDF2 verification and rehash eligibility.");
