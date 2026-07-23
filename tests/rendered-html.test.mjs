import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("ships the nutrition journal instead of the starter preview", async () => {
  const [dashboard, layout, page] = await Promise.all([
    readFile(
      new URL("../app/nutrition-dashboard.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(dashboard, /한끼록/);
  assert.match(dashboard, /먹은 것을 가볍게/);
  assert.match(dashboard, /음식 추가하기/);
  assert.match(dashboard, /검증 DB/);
  assert.match(layout, /한끼록 — 나의 영양 기록/);
  assert.match(layout, /\/og\.png/);
  assert.match(page, /NutritionDashboard/);
  await assert.rejects(
    access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)),
  );
});
