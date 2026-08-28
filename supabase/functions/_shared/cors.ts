export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-provider, x-signature",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

export const handleCors = (request: Request) =>
  request.method === "OPTIONS" ? new Response("ok", { headers: corsHeaders }) : null;
