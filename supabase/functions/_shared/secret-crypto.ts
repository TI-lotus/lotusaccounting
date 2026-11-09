const encoder = new TextEncoder();
const decoder = new TextDecoder();

const toBase64 = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes));

const fromBase64 = (value: string) =>
  Uint8Array.from(atob(value), (character) => character.charCodeAt(0));

const credentialKey = async () => {
  const encodedKey = Deno.env.get("LOTUS_CREDENTIAL_ENCRYPTION_KEY");
  if (!encodedKey) throw new Error("credential_encryption_not_configured");
  const key = fromBase64(encodedKey);
  if (key.byteLength !== 32) throw new Error("credential_encryption_key_invalid");
  return crypto.subtle.importKey("raw", key, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
};

type EncryptedPayload = {
  version: 1;
  algorithm: "AES-GCM";
  iv: string;
  ciphertext: string;
};

const isEncryptedPayload = (value: unknown): value is EncryptedPayload =>
  Boolean(value && typeof value === "object" && (value as Record<string, unknown>).version === 1 &&
    (value as Record<string, unknown>).algorithm === "AES-GCM" &&
    typeof (value as Record<string, unknown>).iv === "string" &&
    typeof (value as Record<string, unknown>).ciphertext === "string");

export const encryptSecretPayload = async (payload: Record<string, unknown>): Promise<EncryptedPayload> => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await credentialKey(),
    encoder.encode(JSON.stringify(payload)),
  );
  return { version: 1, algorithm: "AES-GCM", iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(encrypted)) };
};

export const decryptSecretPayload = async (payload: unknown): Promise<Record<string, unknown>> => {
  if (!isEncryptedPayload(payload)) throw new Error("credential_payload_requires_rotation");
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(payload.iv) },
    await credentialKey(),
    fromBase64(payload.ciphertext),
  );
  const parsed = JSON.parse(decoder.decode(decrypted));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("credential_payload_invalid");
  return parsed as Record<string, unknown>;
};
