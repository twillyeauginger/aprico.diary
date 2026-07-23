import { env } from "cloudflare:workers";
import { ensureSchema, getDb } from "../../../db";
import { photos } from "../../../db/schema";

type AppEnv = {
  PHOTOS?: R2Bucket;
};

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxSize = 8 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const bucket = (env as unknown as AppEnv).PHOTOS;
    if (!bucket) {
      return Response.json(
        { error: "사진 저장소가 아직 연결되지 않았습니다." },
        { status: 503 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "사진을 선택해주세요." }, { status: 400 });
    }
    if (!allowedTypes.has(file.type)) {
      return Response.json(
        { error: "JPG, PNG, WebP 사진만 올릴 수 있어요." },
        { status: 415 },
      );
    }
    if (file.size > maxSize) {
      return Response.json(
        { error: "사진은 8MB 이하로 올려주세요." },
        { status: 413 },
      );
    }

    const photoId = crypto.randomUUID();
    const extension =
      file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : "jpg";
    const objectKey = `meal-photos/${photoId}.${extension}`;
    await bucket.put(objectKey, file.stream(), {
      httpMetadata: { contentType: file.type },
      customMetadata: { photoId },
    });
    await getDb().insert(photos).values({
      id: photoId,
      objectKey,
      contentType: file.type,
      size: file.size,
      status: "uploaded",
    });

    return Response.json({ photoId }, { status: 201 });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "사진을 저장하지 못했습니다.",
      },
      { status: 500 },
    );
  }
}
