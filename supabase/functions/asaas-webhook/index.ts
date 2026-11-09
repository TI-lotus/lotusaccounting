import { handleCors } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/responses.ts";
import { createServiceClient } from "../_shared/supabase.ts";

const subscriptionStatusFromEvent = (event: string) => {
  if (["CHECKOUT_PAID", "PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"].includes(event)) return "active";
  if (["PAYMENT_OVERDUE", "SUBSCRIPTION_PAYMENT_OVERDUE"].includes(event)) return "past_due";
  if (["CHECKOUT_CANCELED", "CHECKOUT_EXPIRED", "SUBSCRIPTION_INACTIVATED", "SUBSCRIPTION_DELETED"].includes(event)) return "canceled";
  return null;
};

const payloadReference = (payload: Record<string, unknown>) => {
  const ref = String(
    payload.externalReference ??
      (payload.checkout as Record<string, unknown> | undefined)?.externalReference ??
      (payload.payment as Record<string, unknown> | undefined)?.externalReference ??
      (payload.subscription as Record<string, unknown> | undefined)?.externalReference ??
      "",
  );
  return ref.trim() || null;
};

const tenantFromReference = (reference: string | null) => {
  const match = reference?.match(/tenant:([0-9a-f-]+)/i);
  return match?.[1] ?? null;
};

const planFromReference = (reference: string | null) => {
  const match = reference?.match(/plan:([a-z0-9_-]+)/i);
  return match?.[1] ?? null;
};

const dateFromAsaas = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
};

const resolveTenant = async (
  supabase: ReturnType<typeof createServiceClient>,
  payload: Record<string, unknown>,
) => {
  const reference = payloadReference(payload);
  const referenceTenant = tenantFromReference(reference);
  if (referenceTenant) return { tenantId: referenceTenant, reference };

  const checkout = payload.checkout as Record<string, unknown> | undefined;
  const payment = payload.payment as Record<string, unknown> | undefined;
  const subscription = payload.subscription as Record<string, unknown> | undefined;
  const checkoutId = checkout?.id ? String(checkout.id) : null;
  const subscriptionId = subscription?.id ? String(subscription.id) :
    payment?.subscription ? String(payment.subscription) : null;

  if (checkoutId) {
    const { data } = await supabase
      .from("tenant_subscriptions")
      .select("tenant_id, plan_id")
      .eq("external_checkout_id", checkoutId)
      .maybeSingle();
    if (data?.tenant_id) return { tenantId: data.tenant_id as string, reference };
  }

  if (subscriptionId) {
    const { data } = await supabase
      .from("tenant_subscriptions")
      .select("tenant_id, plan_id")
      .eq("external_subscription_id", subscriptionId)
      .maybeSingle();
    if (data?.tenant_id) return { tenantId: data.tenant_id as string, reference };
  }

  return { tenantId: null, reference };
};

const planFromPayload = (payload: Record<string, unknown>, reference: string | null) => {
  const ref = reference ?? payloadReference(payload) ?? "";
  const match = ref.match(/plan:([a-z0-9_-]+)/i);
  return match?.[1] ?? null;
};

Deno.serve(async (request) => {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;
  if (request.method !== "POST") return errorResponse("method_not_allowed", 405);

  const expectedToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
  if (expectedToken && request.headers.get("asaas-access-token") !== expectedToken) {
    return errorResponse("invalid_webhook_token", 401);
  }

  try {
    const payload = await request.json();
    const eventType = String(payload.event ?? "unknown");
    const externalEventId = String(payload.id ?? "").trim();
    if (!externalEventId) return errorResponse("missing_event_id", 400);
    const status = subscriptionStatusFromEvent(eventType);
    const supabase = createServiceClient();
    const { tenantId, reference } = await resolveTenant(supabase, payload);
    const planId = planFromPayload(payload, reference);
    const checkout = payload.checkout as Record<string, unknown> | undefined;
    const payment = payload.payment as Record<string, unknown> | undefined;
    const subscription = payload.subscription as Record<string, unknown> | undefined;
    const externalCheckoutId = checkout?.id ? String(checkout.id) : undefined;
    const externalSubscriptionId = subscription?.id ? String(subscription.id) :
      payment?.subscription ? String(payment.subscription) : undefined;
    const externalCustomerId = payment?.customer ? String(payment.customer) :
      subscription?.customer ? String(subscription.customer) :
        checkout?.customer ? String(checkout.customer) : undefined;
    const currentPeriodEnd = dateFromAsaas(subscription?.nextDueDate);

    const { error: eventError } = await supabase.from("billing_events").upsert(
      {
        tenant_id: tenantId,
        provider: "asaas",
        external_event_id: externalEventId,
        event_type: eventType,
        payload,
        processed_at: new Date().toISOString(),
      },
      { onConflict: "provider,external_event_id" },
    );
    if (eventError) throw eventError;

    if (tenantId && (status || externalCheckoutId || externalSubscriptionId)) {
      const { error } = await supabase
        .from("tenant_subscriptions")
        .upsert(
          {
            tenant_id: tenantId,
            ...(planId ? { plan_id: planId } : {}),
            ...(status ? { status } : {}),
            external_provider: "asaas",
            ...(externalCheckoutId ? { external_checkout_id: externalCheckoutId } : {}),
            ...(externalSubscriptionId ? { external_subscription_id: externalSubscriptionId } : {}),
            ...(externalCustomerId ? { external_customer_id: externalCustomerId } : {}),
            ...(currentPeriodEnd ? { current_period_end: currentPeriodEnd } : {}),
            metadata: { lastEvent: payload, externalReference: reference },
          },
          { onConflict: "tenant_id" },
        );
      if (error) throw error;
    }

    return jsonResponse({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return errorResponse(message, 400);
  }
});
