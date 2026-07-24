const localOrigins = new Set([
  "http://127.0.0.1:4173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://localhost:5173",
]);

const defaultOrigins = [
  "https://twillyeauginger.github.io",
  "https://hankkirok-nutrition.dingdeee.chatgpt.site",
];

function normalizeOrigin(value: string) {
  try {
    return new URL(value.trim()).origin;
  } catch {
    return "";
  }
}

function allowedOrigins() {
  const configured = [
    Deno.env.get("APP_ORIGIN") ?? "",
    ...(Deno.env.get("APP_ORIGINS") ?? "").split(","),
  ];
  return new Set(
    [...localOrigins, ...defaultOrigins, ...configured]
      .map(normalizeOrigin)
      .filter(Boolean),
  );
}

export function requestOriginAllowed(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return allowedOrigins().has(normalizeOrigin(origin));
}

export function corsHeaders(request: Request) {
  const origin = request.headers.get("origin");
  const origins = allowedOrigins();
  const allowedOrigin =
    origin && origins.has(normalizeOrigin(origin))
      ? normalizeOrigin(origin)
      : defaultOrigins[0];
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
