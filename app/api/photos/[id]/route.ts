import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { ensureSchema, getDb } from "../../../../db";
import { photos } from "../../../../db/schema";

type AppEnv = {
  PHOTOS?: R2Bucket;
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  await ensureSchema();
  const bucket = (env as unknown as AppEnv).PHOTOS;
  if (!bucket) return new Response("Not found", { status: 404 });
  const { id } = await context.params;
  const [photo] = await getDb()
    .select()
    .from(photos)
    .where(eq(photos.id, id))
    .limit(1);
  if (!photo) return new Response("Not found", { status: 404 });
  const object = await bucket.get(photo.objectKey);
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, {
    headers: {
      "content-type": photo.contentType,
      "cache-control": "private, max-age=3600",
      "x-content-type-options": "nosniff",
    },
  });
}
