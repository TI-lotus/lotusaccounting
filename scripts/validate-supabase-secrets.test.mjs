import { describe, expect, it } from "vitest";
import { getMissingSupabaseSecrets, getSupabaseSecretNames } from "./validate-supabase-secrets.mjs";

const required = ["APP_ORIGIN", "ASAAS_API_KEY", "RESEND_API_KEY"];

describe("validate-supabase-secrets", () => {
  it("reads secret names without exposing their values", () => {
    const input = JSON.stringify({
      secrets: [
        { name: "APP_ORIGIN", value: "hidden-origin" },
        { name: "ASAAS_API_KEY", value: "hidden-asaas" },
      ],
    });

    expect([...getSupabaseSecretNames(input)]).toEqual(["APP_ORIGIN", "ASAAS_API_KEY"]);
    expect(getMissingSupabaseSecrets(input, required)).toEqual(["RESEND_API_KEY"]);
  });

  it("tolerates CLI notices after the JSON response", () => {
    const input = `${JSON.stringify({ secrets: [{ name: "APP_ORIGIN" }] })}\nA new version is available`;

    expect(getMissingSupabaseSecrets(input, ["APP_ORIGIN"])).toEqual([]);
  });
});
