import test from "node:test";
import assert from "node:assert/strict";
import { deliveryEvent } from "./receipt_sender.ts";

test("a pending media job emits typing, while a ready job emits a read receipt", () => {
  const common = { assetId: "asset_204", threadId: "thread_18", creatorId: "creator_7", viewerId: "buyer_3" };
  assert.equal(deliveryEvent({ ...common, processing: "pending" }).event, "typing");
  assert.deepEqual(deliveryEvent({ ...common, processing: "ready" }), {
    event: "read_receipt",
    data: { thread_id: "thread_18", asset_id: "asset_204", viewer_id: "buyer_3", delivery: "creator" }
  });
});
