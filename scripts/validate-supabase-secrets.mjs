#!/usr/bin/env node

import fs from "node:fs";

const parseSecretPayload = (input) => {
  const jsonStart = input.indexOf('{"secrets"');
  if (jsonStart < 0) throw new Error("Não foi possível localizar a resposta JSON do Supabase.");

  const jsonCandidate = input.slice(jsonStart);
  try {
    return JSON.parse(jsonCandidate);
  } catch {
    const jsonEnd = jsonCandidate.lastIndexOf("}");
    if (jsonEnd < 0) throw new Error("A resposta de secrets do Supabase não é um JSON válido.");
    return JSON.parse(jsonCandidate.slice(0, jsonEnd + 1));
  }
};

export const getSupabaseSecretNames = (input) => {
  const payload = parseSecretPayload(input);
  return new Set(
    Array.isArray(payload?.secrets)
      ? payload.secrets.map((secret) => secret?.name).filter(Boolean)
      : [],
  );
};

export const getMissingSupabaseSecrets = (input, requiredNames) => {
  const availableNames = getSupabaseSecretNames(input);
  return requiredNames.filter((name) => !availableNames.has(name));
};

const main = () => {
  const requiredNames = process.argv.slice(2).filter(Boolean);
  const input = fs.readFileSync(0, "utf8").trim();

  if (!requiredNames.length) {
    console.error("Informe pelo menos um secret obrigatório.");
    process.exit(2);
  }
  if (!input) {
    console.error("A listagem de secrets do Supabase veio vazia.");
    process.exit(2);
  }

  let missingNames;
  try {
    missingNames = getMissingSupabaseSecrets(input, requiredNames);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Não foi possível validar os secrets do Supabase.");
    process.exit(2);
  }

  if (missingNames.length) {
    console.error(`Secrets obrigatórios ausentes: ${missingNames.join(", ")}`);
    process.exit(1);
  }

  console.log(`Secrets obrigatórios presentes: ${requiredNames.join(", ")}`);
};

const isDirectExecution = process.argv[1]
  ?.replaceAll("\\", "/")
  .endsWith("/scripts/validate-supabase-secrets.mjs");
if (isDirectExecution) main();
