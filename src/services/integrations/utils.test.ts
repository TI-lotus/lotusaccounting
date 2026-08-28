import { describe, expect, it, vi } from "vitest";
import {
  buildPublicCredentialMetadata,
  getConnectionHealthLabel,
  maskCredentialKey,
  readCredentialMetadata,
} from "./utils";

describe("integration utils", () => {
  it("maps connection health labels", () => {
    expect(getConnectionHealthLabel("connected")).toBe("Conectado");
    expect(getConnectionHealthLabel("expired")).toBe("Expirado");
    expect(getConnectionHealthLabel(undefined)).toBe("Desconectado");
  });

  it("masks credential keys", () => {
    expect(maskCredentialKey("abcd1234")).toBe("key_••••1234");
    expect(maskCredentialKey("abc")).toBe("key_••••");
  });

  it("reads only array credential metadata", () => {
    const metadata = [{ id: "1", name: "Prod" }];
    expect(readCredentialMetadata(metadata)).toEqual(metadata);
    expect(readCredentialMetadata({ secret: "nope" })).toEqual([]);
  });

  it("builds public metadata without secret fields", () => {
    vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("00000000-0000-4000-8000-00000000abcd")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000001234");

    const metadata = buildPublicCredentialMetadata("Produção");

    expect(metadata).toMatchObject({
      id: "cred-00000000-0000-4000-8000-000000001234",
      name: "Produção",
      keyHint: "key_••••abcd",
      active: true,
      storedBy: "edge-function",
    });
    expect(JSON.stringify(metadata)).not.toContain("secret");
  });
});
