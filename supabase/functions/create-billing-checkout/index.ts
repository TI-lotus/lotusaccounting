import { handleCors } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/responses.ts";
import { requireAuthContext } from "../_shared/auth.ts";
import { createServiceClient } from "../_shared/supabase.ts";

const asaasBaseUrl = () =>
  Deno.env.get("ASAAS_BASE_URL") ?? "https://api-sandbox.asaas.com/v3";

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const asaasDateTime = (date: Date) => date.toISOString().replace("T", " ").slice(0, 19);

const requireAdmin = (role: string) => {
  if (role !== "admin") throw new Error("forbidden");
};

Deno.serve(async (request) => {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;
  if (request.method !== "POST") return errorResponse("method_not_allowed", 405);

  try {
    const context = await requireAuthContext(request);
    requireAdmin(context.role);
    const body = await request.json();
    const planId = typeof body.planId === "string" ? body.planId : "starter";
    if (!["starter", "business"].includes(planId)) return errorResponse("plan_not_checkoutable", 400);

    const apiKey = Deno.env.get("ASAAS_API_KEY");
    const appOrigin = Deno.env.get("APP_ORIGIN") ?? new URL(request.url).origin;
    if (!apiKey) throw new Error("asaas_api_key_missing");

    const supabase = createServiceClient();
    const [{ data: tenant, error: tenantError }, { data: plan, error: planError }, { data: authUser, error: authUserError }] = await Promise.all([
      supabase
      .from("tenants")
      .select("name")
      .eq("id", context.tenantId)
      .maybeSingle(),
      supabase
        .from("billing_plans")
        .select("id, name, description, price_monthly_cents, active")
        .eq("id", planId)
        .eq("active", true)
        .maybeSingle(),
      supabase.auth.admin.getUserById(context.userId),
    ]);
    if (tenantError) throw tenantError;
    if (planError) throw planError;
    if (authUserError) throw authUserError;
    if (!plan) throw new Error("billing_plan_not_found");

    const payerEmail = authUser.user?.email?.trim().toLowerCase();
    if (!payerEmail) throw new Error("billing_email_required");

    const metadata = authUser.user?.user_metadata as Record<string, unknown> | undefined;
    const payerName = typeof metadata?.full_name === "string" && metadata.full_name.trim()
      ? metadata.full_name.trim()
      : tenant?.name ?? "Lotus Accounting";
    const price = Number(plan.price_monthly_cents) / 100;
    if (!Number.isFinite(price) || price <= 0) throw new Error("billing_plan_price_invalid");

    const externalReference = `tenant:${context.tenantId}:plan:${planId}`;
    const response = await fetch(`${asaasBaseUrl()}/checkouts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: apiKey,
        "User-Agent": "LotusAccounting/1.0.0",
      },
      body: JSON.stringify({
        billingTypes: ["CREDIT_CARD"],
        chargeTypes: ["RECURRENT"],
        minutesToExpire: 60,
        externalReference,
        items: [
          {
            name: `Lotus ${plan.name}`,
            description: plan.description ?? `Assinatura mensal Lotus Accounting para ${tenant?.name ?? "workspace"}`,
            quantity: 1,
            value: price,
          },
        ],
        subscription: {
          cycle: "MONTHLY",
          nextDueDate: asaasDateTime(addDays(new Date(), 1)),
        },
        customerData: {
          name: payerName,
          email: payerEmail,
        },
        callback: {
          successUrl: `${appOrigin}/upgrade?billing=success`,
          cancelUrl: `${appOrigin}/upgrade?billing=canceled`,
          expiredUrl: `${appOrigin}/upgrade?billing=expired`,
        },
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.errors?.[0]?.description ?? payload?.message ?? "asaas_checkout_failed");
    }

    const checkoutId = payload.id ? String(payload.id) : null;
    if (!checkoutId) throw new Error("asaas_checkout_id_missing");
    const checkoutUrl = `https://asaas.com/checkoutSession/show?id=${encodeURIComponent(checkoutId)}`;
    const { error: subscriptionError } = await supabase
      .from("tenant_subscriptions")
      .upsert(
        {
          tenant_id: context.tenantId,
          plan_id: planId,
          status: "incomplete",
          external_provider: "asaas",
          external_checkout_id: checkoutId,
          checkout_url: checkoutUrl,
          metadata: { externalReference, asaasCheckout: payload, payerEmail },
          updated_by: context.userId,
        },
        { onConflict: "tenant_id" },
      );
    if (subscriptionError) throw subscriptionError;

    return jsonResponse({ checkoutUrl, checkoutId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return errorResponse(message, message === "forbidden" ? 403 : 400);
  }
});
