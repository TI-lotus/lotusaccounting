import { handleCors } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/responses.ts";
import { createServiceClient, createUserClient } from "../_shared/supabase.ts";

type CompanyMatch = {
  id: string;
  tenant_id: string;
  name: string;
  email: string | null;
  status: string | null;
};

const normalizeEmail = (value: string | null | undefined) => value?.trim().toLowerCase() ?? "";

Deno.serve(async (request) => {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;
  if (request.method !== "POST") return errorResponse("method_not_allowed", 405);

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) return errorResponse("missing_authorization", 401, "missing_authorization");

    const userClient = createUserClient(authorization);
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return errorResponse("invalid_authorization", 401, "invalid_authorization");

    const user = userData.user;
    const email = normalizeEmail(user.email);
    if (!email) return errorResponse("authenticated_email_required", 400, "authenticated_email_required");

    const confirmedAt = user.email_confirmed_at ?? user.confirmed_at;
    if (!confirmedAt) {
      return errorResponse("Confirme seu e-mail antes de liberar o acesso de cliente.", 403, "email_not_confirmed");
    }

    const service = createServiceClient();
    const { data: existingProfile, error: profileError } = await service
      .from("profiles")
      .select("tenant_id, company_id, account_type, status")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (existingProfile?.tenant_id) {
      return jsonResponse({
        status: "already_linked",
        tenantId: existingProfile.tenant_id,
        companyId: existingProfile.company_id,
        accountType: existingProfile.account_type,
        profileStatus: existingProfile.status,
      });
    }

    const { data: matches, error: matchError } = await service
      .from("companies")
      .select("id, tenant_id, name, email, status")
      .eq("status", "active")
      .not("email", "is", null);
    if (matchError) throw matchError;

    const exactMatches = ((matches ?? []) as CompanyMatch[])
      .filter((company) => normalizeEmail(company.email) === email);

    if (exactMatches.length === 0) {
      return errorResponse(
        "Não encontramos uma empresa ativa com este e-mail. Peça ao escritório para conferir o cadastro ou enviar um convite.",
        404,
        "client_company_not_found",
      );
    }

    const uniqueCompanyKeys = new Set(exactMatches.map((company) => `${company.tenant_id}:${company.id}`));
    if (uniqueCompanyKeys.size > 1) {
      return errorResponse(
        "Este e-mail aparece em mais de uma empresa. Por segurança, acesse por convite do escritório.",
        409,
        "client_email_ambiguous",
      );
    }

    const company = exactMatches[0];
    const fullName = normalizeEmail(user.user_metadata?.full_name)
      ? String(user.user_metadata.full_name).trim()
      : email.split("@")[0];

    const { error: userInsertError } = await service
      .from("users")
      .upsert({
        id: user.id,
        tenant_id: company.tenant_id,
        name: fullName,
        role: "client",
      }, { onConflict: "id" });
    if (userInsertError) throw userInsertError;

    const { error: profileInsertError } = await service
      .from("profiles")
      .upsert({
        user_id: user.id,
        tenant_id: company.tenant_id,
        company_id: company.id,
        full_name: fullName,
        account_type: "client",
        status: "active",
      }, { onConflict: "user_id" });
    if (profileInsertError) throw profileInsertError;

    await service.from("activity_logs").insert({
      tenant_id: company.tenant_id,
      company_id: company.id,
      user_id: user.id,
      entity: "profile",
      entity_id: user.id,
      action: "client_claimed_access",
      metadata: { email },
    });

    return jsonResponse({
      status: "linked",
      tenantId: company.tenant_id,
      companyId: company.id,
      companyName: company.name,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "internal_error", 400, "claim_client_access_failed");
  }
});
