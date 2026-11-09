import { handleCors } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/responses.ts";
import { createServiceClient } from "../_shared/supabase.ts";

type Body = {
  email?: string;
  password?: string;
  fullName?: string;
  cnpj?: string;
};

type CompanyMatch = {
  id: string;
  tenant_id: string;
  name: string;
  email: string | null;
  cnpj: string | null;
  status: string | null;
};

const normalizeEmail = (value: string | null | undefined) => value?.trim().toLowerCase() ?? "";
const onlyDigits = (value: string | null | undefined) => value?.replace(/\D/g, "") ?? "";

const findAuthUserByEmail = async (
  supabase: ReturnType<typeof createServiceClient>,
  email: string,
) => {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const found = data.users.find((user) => normalizeEmail(user.email) === email);
    if (found) return found;
    if (data.users.length < 1000) return null;
  }
  return null;
};

Deno.serve(async (request) => {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;
  if (request.method !== "POST") return errorResponse("method_not_allowed", 405);

  try {
    const body = (await request.json()) as Body;
    const email = normalizeEmail(body.email);
    const password = body.password ?? "";
    const fullName = body.fullName?.trim() || email.split("@")[0];
    const providedCnpj = onlyDigits(body.cnpj);

    if (!email || !password || !fullName) {
      return errorResponse("Informe nome, e-mail e senha.", 400, "required_fields");
    }
    if (password.length < 8) {
      return errorResponse("A senha deve ter pelo menos 8 caracteres.", 400, "weak_password");
    }

    const supabase = createServiceClient();
    const { data: companies, error: companyError } = await supabase
      .from("companies")
      .select("id, tenant_id, name, email, cnpj, status")
      .eq("status", "active")
      .not("email", "is", null);
    if (companyError) throw companyError;

    let matches = ((companies ?? []) as CompanyMatch[])
      .filter((company) => normalizeEmail(company.email) === email);

    if (providedCnpj) {
      matches = matches.filter((company) => onlyDigits(company.cnpj) === providedCnpj);
    }

    if (matches.length === 0) {
      return errorResponse(
        providedCnpj
          ? "Não encontramos uma empresa ativa com este e-mail e CNPJ."
          : "Não encontramos uma empresa ativa com este e-mail. Peça ao escritório para conferir o cadastro ou enviar um convite.",
        404,
        "client_company_not_found",
      );
    }

    const uniqueCompanyKeys = new Set(matches.map((company) => `${company.tenant_id}:${company.id}`));
    if (uniqueCompanyKeys.size > 1) {
      return errorResponse(
        "Este e-mail aparece em mais de uma empresa. Informe o CNPJ ou peça um convite ao escritório.",
        409,
        "client_email_ambiguous",
      );
    }

    const company = matches[0];
    const existingUser = await findAuthUserByEmail(supabase, email);
    let userId = existingUser?.id;

    if (userId) {
      const { data: existingProfile, error: profileError } = await supabase
        .from("profiles")
        .select("tenant_id, company_id, account_type")
        .eq("user_id", userId)
        .maybeSingle();
      if (profileError) throw profileError;
      if (
        existingProfile?.tenant_id &&
        (
          existingProfile.tenant_id !== company.tenant_id ||
          existingProfile.company_id !== company.id ||
          existingProfile.account_type !== "client"
        )
      ) {
        return errorResponse(
          "Este e-mail já possui outro tipo de acesso vinculado. Entre com a senha existente ou fale com o escritório.",
          409,
          "auth_user_already_linked",
        );
      }

      if (existingProfile?.account_type === "client" && existingProfile.company_id === company.id) {
        return errorResponse(
          "Este e-mail já possui acesso de cliente. Entre com a senha existente ou use a recuperação de senha.",
          409,
          "client_access_already_exists",
        );
      }

      const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
        user_metadata: {
          ...existingUser.user_metadata,
          full_name: fullName,
          account_type: "client",
          client_claim: true,
        },
      });
      if (updateError) throw updateError;
    } else {
      const { data: created, error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          account_type: "client",
          client_claim: true,
        },
      });
      if (createError || !created.user) throw createError ?? new Error("auth_user_not_created");
      userId = created.user.id;
    }

    const { error: userError } = await supabase
      .from("users")
      .upsert({
        id: userId,
        tenant_id: company.tenant_id,
        name: fullName,
        role: "client",
      }, { onConflict: "id" });
    if (userError) throw userError;

    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({
        user_id: userId,
        tenant_id: company.tenant_id,
        company_id: company.id,
        full_name: fullName,
        account_type: "client",
        status: "active",
      }, { onConflict: "user_id" });
    if (profileError) throw profileError;

    await supabase.from("activity_logs").insert({
      tenant_id: company.tenant_id,
      company_id: company.id,
      user_id: userId,
      entity: "profile",
      entity_id: userId,
      action: "client_self_signup",
      metadata: { email, matchedBy: providedCnpj ? "email_and_cnpj" : "email" },
    });

    return jsonResponse({
      status: "created",
      companyName: company.name,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "internal_error", 400, "client_self_signup_failed");
  }
});
