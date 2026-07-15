// =============================================================
//  End-to-End Encryption (E2EE) — Web Crypto API
//
//  Scheme:
//   - Each user owns a long-term ECDH key pair (P-256).
//   - The PRIVATE key never leaves the device (stored in IndexedDB,
//     non-extractable where possible).
//   - The PUBLIC key (JWK) is published to the server so others can
//     derive a shared secret to encrypt messages TO this user.
//   - Per message we derive an AES-GCM key via ECDH (sender private +
//     recipient public), encrypt, and store only ciphertext + iv.
//
//  The server only ever sees ciphertext. It cannot read messages.
// =============================================================

const KEY_ALGO: EcKeyGenParams = { name: "ECDH", namedCurve: "P-256" };
const DB_NAME = "secure-messenger";
const STORE = "keys";
const PRIVATE_KEY_ID = "self-private-key";

// ---------- IndexedDB helpers (persist the private key) ----------

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

// ---------- base64 helpers ----------

function bufToB64(buf: ArrayBufferLike): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function b64ToBuf(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

// ---------- key management ----------

export interface KeyPairExport {
  publicKeyJwk: JsonWebKey;
}

/**
 * Ensures the current device has a key pair. Generates one on first use,
 * persists the private key in IndexedDB, and returns the public JWK so the
 * caller can publish it to the server.
 */
export async function ensureKeyPair(): Promise<KeyPairExport> {
  const existingPrivate = await idbGet<CryptoKey>(PRIVATE_KEY_ID);
  const existingPublic = await idbGet<JsonWebKey>("self-public-jwk");

  if (existingPrivate && existingPublic) {
    return { publicKeyJwk: existingPublic };
  }

  const pair = await crypto.subtle.generateKey(KEY_ALGO, false, [
    "deriveKey",
  ]);
  // Private key is stored as a non-extractable CryptoKey — never leaves device.
  await idbSet(PRIVATE_KEY_ID, pair.privateKey);

  const publicKeyJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  await idbSet("self-public-jwk", publicKeyJwk);

  return { publicKeyJwk };
}

/** True if this device already holds a private key. */
export async function hasLocalKey(): Promise<boolean> {
  return Boolean(await idbGet<CryptoKey>(PRIVATE_KEY_ID));
}

async function getPrivateKey(): Promise<CryptoKey> {
  const key = await idbGet<CryptoKey>(PRIVATE_KEY_ID);
  if (!key) throw new Error("No local private key. Call ensureKeyPair() first.");
  return key;
}

async function importPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", jwk, KEY_ALGO, false, []);
}

/** Cache ECDH-derived AES keys per peer so history decrypt is O(n) crypto, not O(n) key agreement. */
const sharedKeyCache = new Map<string, CryptoKey>();
const sharedKeyInflight = new Map<string, Promise<CryptoKey>>();

function peerKeyCacheId(jwk: JsonWebKey): string {
  return `${jwk.crv ?? ""}:${jwk.x ?? ""}:${jwk.y ?? ""}`;
}

/**
 * Derives a shared AES-GCM key between our private key and the peer's
 * public key. ECDH is symmetric: both sides derive the same secret.
 * Results are memoized for the lifetime of the page.
 */
async function deriveSharedKey(peerPublicJwk: JsonWebKey): Promise<CryptoKey> {
  const cacheId = peerKeyCacheId(peerPublicJwk);
  const cached = sharedKeyCache.get(cacheId);
  if (cached) return cached;

  const inflight = sharedKeyInflight.get(cacheId);
  if (inflight) return inflight;

  const promise = (async () => {
    const privateKey = await getPrivateKey();
    const peerPublic = await importPublicKey(peerPublicJwk);
    const key = await crypto.subtle.deriveKey(
      { name: "ECDH", public: peerPublic },
      privateKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
    sharedKeyCache.set(cacheId, key);
    sharedKeyInflight.delete(cacheId);
    return key;
  })();

  sharedKeyInflight.set(cacheId, promise);
  return promise;
}

// ---------- message encryption ----------

export interface EncryptedPayload {
  ciphertext: string; // base64
  iv: string; // base64
}

/**
 * Encrypts plaintext for a recipient identified by their public JWK.
 * Uses a fresh random IV per message.
 */
export async function encryptMessage(
  plaintext: string,
  recipientPublicJwk: JsonWebKey
): Promise<EncryptedPayload> {
  const sharedKey = await deriveSharedKey(recipientPublicJwk);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    sharedKey,
    encoded as BufferSource
  );

  return {
    ciphertext: bufToB64(cipher as ArrayBuffer),
    iv: bufToB64(iv.buffer),
  };
}

/**
 * Decrypts a payload from a peer identified by their public JWK.
 * Because ECDH is symmetric, the same derive step works for both the
 * message we sent and the message we received.
 */
export async function decryptMessage(
  payload: EncryptedPayload,
  peerPublicJwk: JsonWebKey
): Promise<string> {
  const sharedKey = await deriveSharedKey(peerPublicJwk);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(b64ToBuf(payload.iv)) as BufferSource },
    sharedKey,
    b64ToBuf(payload.ciphertext) as BufferSource
  );
  return new TextDecoder().decode(plain);
}

// ---------- file encryption (for images in chat) ----------

export interface FileEncryptionResult {
  ciphertext: ArrayBuffer;
  iv: Uint8Array;
}

/**
 * Encrypts a file's ArrayBuffer contents using the ECDH shared secret.
 * The IV is random and returned alongside the ciphertext.
 */
export async function encryptFile(
  data: ArrayBuffer,
  recipientPublicJwk: JsonWebKey
): Promise<FileEncryptionResult> {
  const sharedKey = await deriveSharedKey(recipientPublicJwk);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    sharedKey,
    data as BufferSource
  );
  return { ciphertext: cipher, iv };
}

/**
 * Decrypts a file's encrypted contents using the ECDH shared secret.
 */
export async function decryptFile(
  payload: { ciphertext: ArrayBuffer; iv: Uint8Array },
  peerPublicJwk: JsonWebKey
): Promise<ArrayBuffer> {
  const sharedKey = await deriveSharedKey(peerPublicJwk);
  return crypto.subtle.decrypt(
    { name: "AES-GCM", iv: payload.iv as BufferSource },
    sharedKey,
    payload.ciphertext as BufferSource
  );
}
