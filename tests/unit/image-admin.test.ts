import assert from "node:assert/strict";
import { test } from "node:test";
import { USABLE_SOURCE_ITEM_IMAGE_EXISTS_SQL } from "../../packages/database/src/image-admin.ts";

test("USABLE_SOURCE_ITEM_IMAGE_EXISTS_SQL references resource_source_links", () => {
  assert.match(USABLE_SOURCE_ITEM_IMAGE_EXISTS_SQL, /resource_source_links/);
  assert.match(USABLE_SOURCE_ITEM_IMAGE_EXISTS_SQL, /data:%/);
});
