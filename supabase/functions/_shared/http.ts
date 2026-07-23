const localOrigins = new Set([
  "http://127.0.0.1:4173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://localhost:5173",
]);

export function requestOriginAllowed(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const appOrigin = Deno.env.get("APP_ORIGIN")?.replace(/\/+$/, "");
  return localOrigins.has(origin) || Boolean(appOrigin && origin === appOrigin);
}

export function corsHeaders(request: Request) {
  const origin = request.headers.get("origin");
  const appOrigin =
    Deno.env.get("APP_ORIGIN")?.replace(/\/+$/, "") ??
    "https://twillyeauginger.github.io";
  const allowedOrigin =
    origin && (localOrigins.has(origin) || origin === appOrigin)
      ? origin
      : appOrigin;
  return {
    "access-control-allow-origin": allowedOrigin,
    "access-control-allow-headers":
      "authorization, x-client-info, apikey, content-type",
    "access-control-allow-methods": "POST, OPTIONS",
    vary: "Origin",
  };
}

export function json(
  request: Request,
  body: unknown,
  status = 200,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      "content-type": "application/json; charset=utf-8",
    },
  });
}

export function handlePreflight(request: Request) {
  return new Response("ok", { headers: corsHeaders(request) });
}
