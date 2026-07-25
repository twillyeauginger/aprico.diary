import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { ensureSchema, getDb } from "../../../db";
import { analysisRuns, photos } from "../../../db/schema";

type AppEnv = {
  PHOTOS?: R2Bucket;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
};

const analysisSchema = {
  type: "object",
  properties: {
    imageType: {
      type: "string",
      enum: ["meal", "nutrition_label", "package", "unknown"],
    },
    summary: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          portionGrams: { type: ["number", "null"] },
          portionText: { type: "string" },
          confidence: { type: "number" },
          nutrition: {
            type: "object",
            properties: {
              calories: { type: "number" },
              carbs: { type: "number" },
              protein: { type: "number" },
              fat: { type: "number" },
              sugar: { type: "number" },
              sodium: { type: "number" },
              fiber: { type: "number" },
            },
            required: [
              "calories",
              "carbs",
              "protein",
              "fat",
              "sugar",
              "sodium",
              "fiber",
            ],
            additionalProperties: false,
          },
          sourceType: { type: "string", enum: ["label", "ai_estimate"] },
        },
        required: [
          "name",
          "portionGrams",
          "portionText",
          "confidence",
          "nutrition",
          "sourceType",
        ],
        additionalProperties: false,
      },
    },
    needsUserConfirmation: { type: "boolean" },
    warnings: { type: "array", items: { type: "string" } },
  },
  required: [
    "imageType",
    "summary",
    "items",
    "needsUserConfirmation",
    "warnings",
  ],
  additionalProperties: false,
};

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function outputText(response: Record<string, unknown>) {
  const output = Array.isArray(response.output) ? response.output : [];
  for (const item of output) {
    const content = Array.isArray((item as Record<string, unknown>).content)
      ? ((item as Record<string, unknown>).content as unknown[])
      : [];
    for (const part of content) {
      const record = part as Record<string, unknown>;
      if (record.type === "output_text" && typeof record.text === "string") {
        return record.text;
      }
    }
  }
  throw new Error("AI 분석 결과를 읽지 못했습니다.");
}

function openAiErrorMessage(
  status: number,
  raw: Record<string, unknown>,
) {
  const apiError = raw.error as Record<string, unknown> | undefined;
  const code = typeof apiError?.code === "string" ? apiError.code : "";
  if (status === 429 && code === "insufficient_quota") {
    return "OpenAI API 사용 한도를 확인해주세요.";
  }
  if (status === 429) {
    return "사진 분석 요청이 잠시 몰렸습니다. 잠시 후 다시 시도해주세요.";
  }
  if (status >= 500) {
    return "OpenAI 서버가 일시적으로 응답하지 않았습니다. 잠시 후 다시 시도해주세요.";
  }
  if (status === 401 || status === 403) {
    return "OpenAI API 연결 정보를 확인해주세요.";
  }
  return typeof apiError?.message === "string"
    ? apiError.message
    : "OpenAI 사진 분석 요청에 실패했습니다.";
}

async function requestOpenAi(
  openAiKey: string,
  payload: Record<string, unknown>,
) {
  const retryableStatuses = new Set([408, 409, 429]);
  let lastError = "사진 분석 요청에 실패했습니다.";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          authorization: `Bearer ${openAiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const raw = (await response.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      if (response.ok) return raw;
      lastError = openAiErrorMessage(response.status, raw);
      const apiError = raw.error as Record<string, unknown> | undefined;
      const isQuotaExhausted =
        response.status === 429 && apiError?.code === "insufficient_quota";
      const shouldRetry =
        !isQuotaExhausted &&
        (retryableStatuses.has(response.status) || response.status >= 500);
      const requestId =
        response.headers.get("x-request-id") ??
        response.headers.get("openai-request-id") ??
        "unknown";
      console.warn("analyze-photo OpenAI attempt failed", {
        attempt,
        status: response.status,
        requestId,
        shouldRetry,
      });
      if (!shouldRetry || attempt === 3) throw new Error(lastError);
    } catch (error) {
      if (error instanceof Error && error.message === lastError) throw error;
      lastError =
        "사진 분석 서버 연결이 잠시 불안정합니다. 잠시 후 다시 시도해주세요.";
      console.warn("analyze-photo OpenAI network attempt failed", {
        attempt,
        message: error instanceof Error ? error.message : String(error),
      });
      if (attempt === 3) throw new Error(lastError);
    }
    await new Promise((resolve) => setTimeout(resolve, 450 * 2 ** (attempt - 1)));
  }
  throw new Error(lastError);
}

export async function POST(request: Request) {
  await ensureSchema();
  const appEnv = env as unknown as AppEnv;
  if (!appEnv.OPENAI_API_KEY) {
    return Response.json(
      {
        error:
          "사진 분석 연결이 아직 비어 있어요. OpenAI API 키를 연결하면 바로 사용할 수 있습니다.",
      },
      { status: 503 },
    );
  }
  if (!appEnv.PHOTOS) {
    return Response.json(
      { error: "사진 저장소가 아직 연결되지 않았습니다." },
      { status: 503 },
    );
  }

  try {
    const { photoId } = (await request.json()) as { photoId?: string };
    if (!photoId) {
      return Response.json({ error: "사진을 먼저 올려주세요." }, { status: 400 });
    }
    const [photo] = await getDb()
      .select()
      .from(photos)
      .where(eq(photos.id, photoId))
      .limit(1);
    if (!photo) {
      return Response.json({ error: "사진을 찾지 못했습니다." }, { status: 404 });
    }
    const object = await appEnv.PHOTOS.get(photo.objectKey);
    if (!object) {
      return Response.json({ error: "사진을 찾지 못했습니다." }, { status: 404 });
    }

    const bytes = new Uint8Array(await object.arrayBuffer());
    const imageUrl = `data:${photo.contentType};base64,${bytesToBase64(bytes)}`;
    const model = appEnv.OPENAI_MODEL || "gpt-5.6-sol";
    const runId = crypto.randomUUID();

    const raw = await requestOpenAi(appEnv.OPENAI_API_KEY, {
      model,
      reasoning: { effort: "medium" },
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `이 이미지를 개인 영양 기록용으로 분석하세요.

먼저 이미지가 일반 음식, 포장 전면, 영양정보 표, 또는 판별 불가인지 구분하세요.
- 영양정보 표라면 사진에서 직접 읽을 수 있는 수치만 사용하고 sourceType을 label로 지정하세요.
- 일반 음식 사진이라면 먼저 서로 구분되는 모든 음식과 음료를 빠짐없이 목록화한 뒤, 겹쳐 보이는 음식을 중복 계산하지 마세요.
- 접시·용기·먹지 않는 부분을 제외한 실제 가식부를 추정하세요. 접시 크기, 수저, 포장 규격처럼 화면에서 확인 가능한 기준물과 통상적인 1회 제공량을 함께 비교하세요.
- 각 음식의 조리법과 보이는 재료를 고려해 대략적인 중량과 열량 및 영양소를 추정하고 sourceType을 ai_estimate로 지정하세요.
- 열량 추정치는 탄수화물·단백질 1g당 약 4kcal, 지방 1g당 약 9kcal와 크게 모순되지 않는지 교차 확인하고, 차이가 크면 값을 다시 검토하세요.
- 소스, 조리유, 숨은 재료, 촬영 각도 때문에 확인할 수 없는 요소는 warnings에 적고 confidence를 낮추세요. 보이지 않는 재료를 확정적으로 단정하지 마세요.
- 한국어로 음식명과 요약을 작성하세요.
- 칼로리는 kcal, 탄수화물·단백질·지방·당류·식이섬유는 g, 나트륨은 mg 단위입니다.
- confidence는 0에서 1 사이입니다.
- 정확한 의료 판단을 하지 말고 항상 사용자 확인이 필요한지 표시하세요.`,
            },
            {
              type: "input_image",
              image_url: imageUrl,
              detail: "original",
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "nutrition_photo_analysis",
          strict: true,
          schema: analysisSchema,
        },
        verbosity: "low",
      },
    });
    const result = JSON.parse(outputText(raw)) as Record<string, unknown>;
    await getDb().insert(analysisRuns).values({
      id: runId,
      photoId,
      status: "completed",
      model,
      resultJson: JSON.stringify(result),
    });

    return Response.json({ ...result, photoId });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "사진을 분석하지 못했습니다.",
      },
      { status: 500 },
    );
  }
}
