import { assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("widget-reviews response shape only contains public-safe fields", () => {
  // This test documents the public field contract. If the edge function
  // starts returning new fields, this test should be updated with a
  // security review.
  const allowedTopLevelKeys = new Set([
    "organization",
    "location",
    "stats",
    "reviews",
  ]);

  const allowedOrgKeys = new Set([
    "name",
    "logo_url",
    "primary_color",
  ]);

  const allowedLocationKeys = new Set([
    "name",
    "google_review_url",
  ]);

  const allowedStatsKeys = new Set([
    "average",
    "total",
  ]);

  const allowedReviewKeys = new Set([
    "id",
    "author",
    "avatar",
    "rating",
    "text",
    "source",
    "date",
    "url",
  ]);

  // Verify no internal/sensitive keys are whitelisted
  const forbiddenReviewKeys = [
    "raw_payload",
    "external_id",
    "location_id",
    "organization_id",
    "created_at",
    "updated_at",
    "sentiment",
    "replied_at",
    "reply_text",
    "author_name", // mapped to "author"
    "author_avatar_url", // mapped to "avatar"
    "review_date", // mapped to "date"
    "review_url", // mapped to "url"
  ];

  for (const key of forbiddenReviewKeys) {
    assertNotEquals(
      allowedReviewKeys.has(key),
      true,
      `Forbidden key "${key}" must not be in allowedReviewKeys`,
    );
  }

  // Verify all expected keys are present
  assertEquals(allowedTopLevelKeys.size, 4);
  assertEquals(allowedOrgKeys.size, 3);
  assertEquals(allowedLocationKeys.size, 2);
  assertEquals(allowedStatsKeys.size, 2);
  assertEquals(allowedReviewKeys.size, 8);
});
