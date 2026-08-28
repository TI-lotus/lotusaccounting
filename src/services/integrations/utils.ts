import type { Json } from "@/integrations/supabase/types";
import type { PublicCredentialMetadata } from "./types";

export const readCredentialMetadata = (
  credentials: Json | null | undefined,
): PublicCredentialMetadata[] =>
  Array.isArray(credentials)
    ? (credentials as unknown as PublicCredentialMetadata[])
    : [];

export const maskCredentialKey = (value: string) =>
  value.length > 4 ? `key_••••${value.slice(-4)}` : "key_••••";

export const buildPublicCredentialMetadata = (
  name: string,
): PublicCredentialMetadata => {
  const keySuffix = crypto.randomUUID().slice(-4);
  return {
    id: `cred-${crypto.randomUUID()}`,
    name,
    keyHint: `key_••••${keySuffix}`,
    createdAt: new Date().toLocaleDateString("pt-BR"),
    lastUsed: "Nunca",
    active: true,
    storedBy: "edge-function",
  };
};

export const getConnectionHealthLabel = (status: string | null | undefined) => {
  switch (status) {
    case "connected":
      return "Conectado";
    case "connecting":
      return "Conectando";
    case "pending":
      return "Pendente";
    case "error":
      return "Erro";
    case "expired":
      return "Expirado";
    case "disabled":
      return "Desativado";
    default:
      return "Desconectado";
  }
};
