import { corsHeaders } from "./cors.ts";

export const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

export const errorResponse = (
  message: string,
  status = 400,
  code = "bad_request",
) => jsonResponse({ error: { code, message } }, status);
