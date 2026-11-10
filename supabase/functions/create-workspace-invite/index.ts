import { handleCors } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/responses.ts";
import { requireAuthContext } from "../_shared/auth.ts";
import { createServiceClient } from "../_shared/supabase.ts";

type Body = {
  email?: string;
  fullName?: string;
  accountType?: "collaborator" | "client";
  companyId?: string | null;
};

const escapeHtml = (value: string) =>
  value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);

const resolveAppOrigin = (request: Request) => {
  const configuredOrigin = Deno.env.get("APP_ORIGIN")?.trim();
  const requestOrigin = request.headers.get("origin")?.trim();
  const candidate = configuredOrigin || requestOrigin;
  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.hostname === "localhost"
      ? url.origin
      : null;
  } catch {
    return null;
  }
};

const sendInviteEmail = async (params: {
  email: string;
  fullName: string | null;
  accountType: "collaborator" | "client";
  inviteUrl: string;
}) => {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM_EMAIL");
  if (!apiKey || !from) return { status: "not_configured" as const, error: null };

  const recipientName = escapeHtml(params.fullName?.trim() || params.email);
  const role = params.accountType === "client" ? "cliente" : "colaborador";
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [params.email],
        subject: "Seu convite para a Lotus Accounting",
        html: `<p>Olá, ${recipientName}.</p><p>Você recebeu um convite como <strong>${role}</strong> para acessar a Lotus Accounting.</p><p><a href="${params.inviteUrl}">Criar meu acesso</a></p><p>Este convite expira em 14 dias.</p>`,
      }),
    });
    if (response.ok) return { status: "sent" as const, error: null };
    return { status: "failed" as const, error: (await response.text()).slice(0, 1000) };
  } catch (error) {
    return {
      status: "failed" as const,
      error: (error instanceof Error ? error.message : "resend_request_failed").slice(0, 1000),
    };
  }
};

Deno.serve(async (request) => {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;
  if (request.method !== "POST") return errorResponse("method_not_allowed", 405);

  try {
    const context = await requireAuthContext(request);
    if (context.role !== "admin") return errorResponse("forbidden", 403);
    const body = (await request.json()) as Body;
    const email = body.email?.trim().toLowerCase();
    const accountType = body.accountType;
    if (!email || !accountType) return errorResponse("email_and_account_type_required", 400);
    if (accountType === "client" && !body.companyId) return errorResponse("client_company_required", 400);

    const supabase = createServiceClient();
    if (body.companyId) {
      const { data: company, error } = await supabase
        .from("companies")
        .select("id")
        .eq("id", body.companyId)
        .eq("tenant_id", context.tenantId)
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      if (!company) return errorResponse("active_company_not_found", 404);
    }

    const { data: invite, error: inviteError } = await supabase
      .from("invites")
      .insert({
        tenant_id: context.tenantId,
        email,
        full_name: body.fullName?.trim() || null,
        account_type: accountType,
        company_id: accountType === "client" ? body.companyId : null,
        invited_by: context.userId,
        delivery_status: "not_requested",
      })
      .select("id, email, full_name, account_type, company_id, token, status, expires_at, created_at")
      .maybeSingle();
    if (inviteError) throw inviteError;
    if (!invite) return errorResponse("invite_not_created", 500);

    const appOrigin = resolveAppOrigin(request);
    const inviteUrl = appOrigin ? `${appOrigin.replace(/\/$/, "")}/auth?invite=${invite.token}` : null;
    const delivery = inviteUrl
      ? await sendInviteEmail({ email: invite.email, fullName: invite.full_name, accountType, inviteUrl })
      : { status: "not_configured" as const, error: "APP_ORIGIN is not configured" };

    await supabase.from("invites").update({
      delivery_status: delivery.status,
      delivery_error: delivery.error,
      sent_at: delivery.status === "sent" ? new Date().toISOString() : null,
    }).eq("id", invite.id).eq("tenant_id", context.tenantId);

    await supabase.from("activity_logs").insert({
      tenant_id: context.tenantId,
      company_id: invite.company_id,
      user_id: context.userId,
      entity: "invite",
      entity_id: invite.id,
      action: "created",
      metadata: { accountType, deliveryStatus: delivery.status },
    });

    return jsonResponse({ invite, deliveryStatus: delivery.status, deliveryError: delivery.error });
  } catch (error) {
    const message = error instanceof Error ? error.message : "internal_error";
    const status = message.includes("duplicate") ? 409 : message === "forbidden" ? 403 : 400;
    return errorResponse(message, status);
  }
});
