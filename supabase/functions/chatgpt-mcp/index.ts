import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2";

type JsonRpcId = string | number | null;
type JsonRpcRequest = {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: Record<string, unknown>;
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const publishableKey =
  Deno.env.get("SUPABASE_ANON_KEY") ??
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
  "";
const resourceUrl = `${supabaseUrl}/functions/v1/chatgpt-mcp`;
const metadataUrl = `${resourceUrl}/.well-known/oauth-protected-resource`;
const authorizationServer = `${supabaseUrl}/auth/v1`;
const oauthSchemes = [{ type: "oauth2", scopes: ["email"] }];
const supportedUnits = new Set([
  "g",
  "kg",
  "ml",
  "l",
  "%",
  "개",
  "인분",
  "공기",
  "컵",
  "큰술",
  "작은술",
]);
const mealTypes: Record<string, string> = {
  breakfast: "아침",
  lunch: "점심",
  dinner: "저녁",
  snack: "간식",
};

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
  "access-control-allow-headers":
    "authorization, content-type, mcp-protocol-version, mcp-session-id",
  "access-control-expose-headers": "mcp-session-id",
};

function json(body: unknown, status = 200, extraHeaders?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "content-type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

function rpcResult(id: JsonRpcId | undefined, result: unknown) {
  return json({ jsonrpc: "2.0", id: id ?? null, result });
}

function rpcError(
  id: JsonRpcId | undefined,
  code: number,
  message: string,
) {
  return json({
    jsonrpc: "2.0",
    id: id ?? null,
    error: { code, message },
  });
}

function toolResult(body: unknown, message: string) {
  return {
    content: [{ type: "text", text: message }],
    structuredContent: body,
  };
}

function toolError(message: string) {
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}

function authToolError(message: string) {
  const challenge =
    `Bearer resource_metadata="${metadataUrl}", ` +
    `error="invalid_token", error_description="${message}"`;
  return {
    ...toolError(message),
    _meta: { "mcp/www_authenticate": [challenge] },
  };
}

function numeric(
  body: Record<string, unknown>,
  key: string,
  options: { nullable?: boolean; positive?: boolean } = {},
) {
  if (
    options.nullable &&
    (body[key] === null || body[key] === undefined || body[key] === "")
  ) {
    return null;
  }
  const value = Number(body[key]);
  const invalid =
    !Number.isFinite(value) ||
    value < 0 ||
    (options.positive === true && value <= 0);
  if (invalid) {
    throw new Error(
      `${key}는 ${options.positive ? "0보다 큰" : "0 이상의"} 숫자여야 합니다.`,
    );
  }
  return value;
}

function stringValue(
  body: Record<string, unknown>,
  key: string,
  nullable = false,
) {
  if (
    nullable &&
    (body[key] === null || body[key] === undefined || body[key] === "")
  ) {
    return null;
  }
  const value = String(body[key] ?? "").trim();
  if (!value) throw new Error(`${key}가 필요합니다.`);
  return value.slice(0, 500);
}

function validatedUnit(value: string) {
  const normalized = value.toLocaleLowerCase();
  if (!supportedUnits.has(normalized)) {
    throw new Error(
      `지원하지 않는 단위입니다. 사용 가능: ${[...supportedUnits].join(", ")}`,
    );
  }
  return value;
}

function seoulDateTime(value: string) {
  const eatenAt = new Date(value);
  if (Number.isNaN(eatenAt.getTime())) {
    throw new Error("eatenAt은 시간대가 포함된 ISO 8601 형식이어야 합니다.");
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(eatenAt);
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return {
    mealDate: `${part("year")}-${part("month")}-${part("day")}`,
    mealTime: `${part("hour")}:${part("minute")}`,
  };
}

async function authenticatedClient(request: Request) {
  const token = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  if (!token || !supabaseUrl || !publishableKey) return null;
  const client = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const {
    data: { user },
    error,
  } = await client.auth.getUser(token);
  return error || !user ? null : { client, userId: user.id };
}

async function createFood(
  client: SupabaseClient,
  userId: string,
  args: Record<string, unknown>,
) {
  const servingUnit = validatedUnit(stringValue(args, "servingUnit")!);
  const source = stringValue(args, "source", true);
  const values = {
    user_id: userId,
    name: stringValue(args, "name"),
    source_type: "manual",
    source_label: source ? `ChatGPT 앱 · ${source}` : "ChatGPT 앱",
    serving_amount: numeric(args, "servingAmount", { positive: true }),
    serving_unit: servingUnit,
    weight_grams: numeric(args, "weightGrams", { nullable: true }),
    calories: numeric(args, "caloriesKcal"),
    carbs: numeric(args, "carbohydratesGrams"),
    protein: numeric(args, "proteinGrams"),
    fat: numeric(args, "fatGrams"),
    sodium: numeric(args, "sodiumMilligrams", { nullable: true }) ?? 0,
    sugar: numeric(args, "sugarsGrams", { nullable: true }) ?? 0,
    fiber: 0,
    source,
    notes: stringValue(args, "notes", true),
  };
  const { data, error } = await client
    .from("saved_foods")
    .insert(values)
    .select("*")
    .single();
  if (error) throw error;
  return toolResult(
    { success: true, food: data },
    `${values.name}을(를) 내 음식 DB에 등록했습니다.`,
  );
}

async function searchFoods(
  client: SupabaseClient,
  args: Record<string, unknown>,
) {
  const query = stringValue(args, "query")!;
  const { data, error } = await client
    .from("saved_foods")
    .select("*")
    .ilike("name", `%${query}%`)
    .order("name")
    .limit(20);
  if (error) throw error;
  return toolResult(
    { query, foods: data ?? [] },
    `${query} 검색 결과 ${(data ?? []).length}개를 찾았습니다.`,
  );
}

async function createMealEntry(
  client: SupabaseClient,
  userId: string,
  args: Record<string, unknown>,
) {
  const type = String(args.mealType ?? "");
  if (!mealTypes[type]) {
    throw new Error(
      "mealType은 breakfast, lunch, dinner, snack 중 하나여야 합니다.",
    );
  }
  const { mealDate, mealTime } = seoulDateTime(
    stringValue(args, "eatenAt")!,
  );
  const foodName = stringValue(args, "foodName")!;
  const amount = numeric(args, "amount", { positive: true });
  const unit = validatedUnit(stringValue(args, "unit")!);
  const { data: duplicate, error: duplicateError } = await client
    .from("meals")
    .select("id")
    .eq("meal_date", mealDate)
    .eq("meal_time", mealTime)
    .eq("food_name", foodName)
    .eq("serving_amount", amount)
    .eq("serving_unit", unit)
    .maybeSingle();
  if (duplicateError) throw duplicateError;
  if (duplicate) {
    return toolResult(
      {
        success: true,
        duplicate: true,
        mealEntryId: duplicate.id,
        timezone: "Asia/Seoul",
      },
      "같은 식사 기록이 이미 있어 중복으로 추가하지 않았습니다.",
    );
  }
  const { data, error } = await client
    .from("meals")
    .insert({
      user_id: userId,
      meal_date: mealDate,
      meal_time: mealTime,
      meal_type: mealTypes[type],
      food_name: foodName,
      serving_amount: amount,
      serving_unit: unit,
      weight_grams: numeric(args, "weightGrams", { nullable: true }),
      calories: numeric(args, "caloriesKcal"),
      carbs: numeric(args, "carbohydratesGrams"),
      protein: numeric(args, "proteinGrams"),
      fat: numeric(args, "fatGrams"),
      source_type: "manual",
      source_label: "ChatGPT 앱",
      notes: stringValue(args, "notes", true),
      sugar: 0,
      sodium: 0,
      fiber: 0,
    })
    .select("*")
    .single();
  if (error) throw error;
  return toolResult(
    {
      success: true,
      duplicate: false,
      timezone: "Asia/Seoul",
      mealEntry: data,
    },
    `${mealDate} ${mealTime}의 ${foodName} 식사 기록을 추가했습니다.`,
  );
}

async function listMealEntries(
  client: SupabaseClient,
  args: Record<string, unknown>,
) {
  const date = stringValue(args, "date")!;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("date는 YYYY-MM-DD 형식이어야 합니다.");
  }
  const { data, error } = await client
    .from("meals")
    .select("*")
    .eq("meal_date", date)
    .order("meal_time");
  if (error) throw error;
  return toolResult(
    { date, timezone: "Asia/Seoul", mealEntries: data ?? [] },
    `${date} 식사 기록 ${(data ?? []).length}개를 불러왔습니다.`,
  );
}

async function deleteMealEntry(
  client: SupabaseClient,
  args: Record<string, unknown>,
) {
  const id = stringValue(args, "id")!;
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) {
    throw new Error("id는 올바른 식사 기록 UUID여야 합니다.");
  }
  const { data, error } = await client
    .from("meals")
    .delete()
    .eq("id", id)
    .select("id, food_name")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("삭제할 식사 기록을 찾지 못했습니다.");
  return toolResult(
    { success: true, deletedMealEntryId: data.id },
    `${data.food_name} 식사 기록을 삭제했습니다.`,
  );
}

const foodInputProperties = {
  name: { type: "string", minLength: 1 },
  servingAmount: { type: "number", exclusiveMinimum: 0 },
  servingUnit: {
    type: "string",
    enum: [...supportedUnits],
  },
  weightGrams: { type: ["number", "null"], minimum: 0 },
  caloriesKcal: { type: "number", minimum: 0 },
  carbohydratesGrams: { type: "number", minimum: 0 },
  proteinGrams: { type: "number", minimum: 0 },
  fatGrams: { type: "number", minimum: 0 },
  sodiumMilligrams: { type: ["number", "null"], minimum: 0 },
  sugarsGrams: { type: ["number", "null"], minimum: 0 },
  source: { type: ["string", "null"] },
  notes: { type: ["string", "null"] },
};

const tools = [
  {
    name: "search_foods",
    title: "내 음식 DB 검색",
    description:
      "Aprico Diary의 내 음식 DB에서 이름으로 식품과 기준 영양정보를 찾습니다. 식사를 기록하기 전에 기존 식품이 있는지 먼저 검색하세요.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", minLength: 1 } },
      required: ["query"],
      additionalProperties: false,
    },
    securitySchemes: oauthSchemes,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  {
    name: "create_food",
    title: "내 음식 DB에 식품 등록",
    description:
      "재사용할 식품의 1회 기준 영양정보를 등록합니다. 호출 직전에 음식명, 기준량, 칼로리와 탄단지를 사용자에게 보여주고 명시적 확인을 받으세요.",
    inputSchema: {
      type: "object",
      properties: foodInputProperties,
      required: [
        "name",
        "servingAmount",
        "servingUnit",
        "caloriesKcal",
        "carbohydratesGrams",
        "proteinGrams",
        "fatGrams",
      ],
      additionalProperties: false,
    },
    securitySchemes: oauthSchemes,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "list_meal_entries",
    title: "날짜별 식사 기록 조회",
    description:
      "Asia/Seoul 현지 날짜를 기준으로 Aprico Diary의 식사 기록을 조회합니다.",
    inputSchema: {
      type: "object",
      properties: {
        date: {
          type: "string",
          pattern: "^\\d{4}-\\d{2}-\\d{2}$",
          description: "Asia/Seoul 기준 YYYY-MM-DD 날짜",
        },
      },
      required: ["date"],
      additionalProperties: false,
    },
    securitySchemes: oauthSchemes,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  {
    name: "create_meal_entry",
    title: "식사 기록 추가",
    description:
      "대화에서 사용자가 먹었다고 말한 음식을 Aprico Diary에 기록합니다. 호출 직전에 식사 시각, 구분, 음식명, 양, 칼로리와 탄단지를 요약하고 명시적 확인을 받으세요. 기존 내 음식 DB 값을 사용했다면 실제 먹은 양에 맞춰 영양정보를 비례 계산하세요.",
    inputSchema: {
      type: "object",
      properties: {
        eatenAt: {
          type: "string",
          format: "date-time",
          description: "시간대가 포함된 ISO 8601 식사 시각",
        },
        mealType: {
          type: "string",
          enum: ["breakfast", "lunch", "dinner", "snack"],
        },
        foodName: { type: "string", minLength: 1 },
        amount: { type: "number", exclusiveMinimum: 0 },
        unit: { type: "string", enum: [...supportedUnits] },
        weightGrams: { type: ["number", "null"], minimum: 0 },
        caloriesKcal: { type: "number", minimum: 0 },
        carbohydratesGrams: { type: "number", minimum: 0 },
        proteinGrams: { type: "number", minimum: 0 },
        fatGrams: { type: "number", minimum: 0 },
        notes: { type: ["string", "null"] },
      },
      required: [
        "eatenAt",
        "mealType",
        "foodName",
        "amount",
        "unit",
        "caloriesKcal",
        "carbohydratesGrams",
        "proteinGrams",
        "fatGrams",
      ],
      additionalProperties: false,
    },
    securitySchemes: oauthSchemes,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "delete_meal_entry",
    title: "식사 기록 삭제",
    description:
      "잘못 등록된 Aprico Diary 식사 기록을 삭제합니다. 먼저 날짜별 기록을 조회해 대상을 특정하고, 삭제할 음식과 시각을 보여준 뒤 사용자에게 명시적인 최종 확인을 받으세요.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", format: "uuid" },
      },
      required: ["id"],
      additionalProperties: false,
    },
    securitySchemes: oauthSchemes,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: true,
    },
  },
];

async function callTool(
  client: SupabaseClient,
  userId: string,
  name: string,
  args: Record<string, unknown>,
) {
  if (name === "create_food") return await createFood(client, userId, args);
  if (name === "search_foods") return await searchFoods(client, args);
  if (name === "create_meal_entry") {
    return await createMealEntry(client, userId, args);
  }
  if (name === "list_meal_entries") {
    return await listMealEntries(client, args);
  }
  if (name === "delete_meal_entry") {
    return await deleteMealEntry(client, args);
  }
  throw new Error(`알 수 없는 도구입니다: ${name}`);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);
  if (
    request.method === "GET" &&
    url.pathname.endsWith("/.well-known/oauth-protected-resource")
  ) {
    return json({
      resource: resourceUrl,
      authorization_servers: [authorizationServer],
      scopes_supported: ["email"],
      bearer_methods_supported: ["header"],
      resource_documentation:
        "https://twillyeauginger.github.io/aprico.diary/",
    });
  }
  if (request.method === "GET") {
    return json({
      name: "Aprico Diary MCP",
      version: "1.0.0",
      mcpEndpoint: resourceUrl,
      authentication: "OAuth 2.1 via Supabase Auth",
    });
  }
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let rpc: JsonRpcRequest;
  try {
    rpc = (await request.json()) as JsonRpcRequest;
  } catch {
    return rpcError(null, -32700, "Parse error");
  }
  if (rpc.jsonrpc !== "2.0" || !rpc.method) {
    return rpcError(rpc.id, -32600, "Invalid Request");
  }

  if (rpc.method === "initialize") {
    const requestedVersion = String(
      (rpc.params as { protocolVersion?: unknown } | undefined)
        ?.protocolVersion ?? "2025-06-18",
    );
    return rpcResult(rpc.id, {
      protocolVersion: requestedVersion,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "aprico-diary", version: "1.0.0" },
      instructions:
        "Search the user's saved foods before estimating nutrition. Read tools may run directly. Always obtain explicit user confirmation immediately before create or delete tools.",
    });
  }
  if (rpc.method === "notifications/initialized") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (rpc.method === "ping") return rpcResult(rpc.id, {});
  if (rpc.method === "tools/list") {
    return rpcResult(rpc.id, { tools });
  }
  if (rpc.method !== "tools/call") {
    return rpcError(rpc.id, -32601, "Method not found");
  }

  const auth = await authenticatedClient(request);
  if (!auth) {
    return rpcResult(
      rpc.id,
      authToolError("Aprico Diary 계정을 연결해야 합니다."),
    );
  }
  const params = rpc.params as
    | { name?: unknown; arguments?: Record<string, unknown> }
    | undefined;
  const name = String(params?.name ?? "");
  try {
    const result = await callTool(
      auth.client,
      auth.userId,
      name,
      params?.arguments ?? {},
    );
    return rpcResult(rpc.id, result);
  } catch (error) {
    return rpcResult(
      rpc.id,
      toolError(
        error instanceof Error ? error.message : "요청을 처리하지 못했습니다.",
      ),
    );
  }
});
