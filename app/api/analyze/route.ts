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

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${appEnv.OPENAI_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        reasoning: { effort: "low" },
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `이 이미지를 개인 영양 기록용으로 분석하세요.

먼저 이미지가 일반 음식, 포장 전면, 영양정보 표, 또는 판별 불가인지 구분하세요.
- 영양정보 표라면 사진에서 직접 읽을 수 있는 수치만 사용하고 sourceType을 label로 지정하세요.
- 일반 음식 사진이라면 보이는 음식별로 나누고, 대략적인 중량과 열량 및 영양소를 추정하되 sourceType을 ai_estimate로 지정하세요.
- 소스, 조리유, 숨은 재료처럼 사진만으로 알 수 없는 요소는 warnings에 적으세요.
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
      }),
    });

    const raw = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      const apiError = raw.error as Record<string, unknown> | undefined;
      throw new Error(
        typeof apiError?.message === "string"
          ? apiError.message
          : "OpenAI 사진 분석 요청에 실패했습니다.",
      );
    }
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
