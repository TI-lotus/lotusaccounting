import { timingSafeEqual } from "https://deno.land/std@0.224.0/crypto/timing_safe_equal.ts";

const encoder = new TextEncoder();

export const requireScheduler = (request: Request) => {
  const configuredKey = Deno.env.get("LOTUS_SCHEDULER_KEY");
  const receivedKey = request.headers.get("x-lotus-scheduler-key");
  if (!configuredKey || !receivedKey) throw new Error("forbidden");

  const configured = encoder.encode(configuredKey);
  const received = encoder.encode(receivedKey);
  if (configured.length !== received.length || !timingSafeEqual(configured, received)) {
    throw new Error("forbidden");
  }
};
