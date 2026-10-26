/**
 * 架空データで API バリデーションのみ検証（Firestore には書き込まない）
 * node scripts/test-reserve-order-validate.mjs
 */
import { validateCreateBody } from "../workers/reserve-orders-api/src/validate.js";
import { pickupAtTimestamp } from "../workers/reserve-orders-api/src/firestore.js";
import {
  buildBentoComposition,
  resolveLineItem,
} from "../workers/reserve-orders-api/src/catalog.js";

var idempotencyKey = "11111111-1111-4111-8111-111111111111";
var contentHash =
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

var body = {
  idempotencyKey: idempotencyKey,
  contentHash: contentHash,
  customer: { name: "テスト太郎" },
  pickup: { date: "2026-10-19", time: "10:45" },
  note: "架空の予約です",
  items: [
    { lineId: "pid-m003", productId: "m003", quantity: 2 },
    { lineId: "pid-m005", productId: "m005", quantity: 1 },
    { lineId: "pid-m017", productId: "m017", quantity: 1 },
  ],
};

var v = validateCreateBody(body);
if (v.error) {
  console.error("FAIL validate:", v.error);
  process.exit(1);
}
if (v.totalQuantity !== 4) {
  console.error("FAIL totalQuantity", v.totalQuantity);
  process.exit(1);
}
var at = pickupAtTimestamp("2026-10-19", "10:45");
var d = new Date(at.iso);
var jstHour = (d.getUTCHours() + 9) % 24;
if (jstHour !== 10) {
  console.error("FAIL pickup JST hour", jstHour, at.iso);
  process.exit(1);
}

var dashi = validateCreateBody({
  idempotencyKey: "22222222-2222-4222-8222-222222222222",
  contentHash:
    "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  customer: { name: "テスト" },
  pickup: { date: "2026-10-17", time: "11:00" },
  items: [{ lineId: "pid-m017", productId: "m017", quantity: 1 }],
});
if (dashi.error !== "dashimaki_blocked_date") {
  console.error("FAIL dashimaki block", dashi.error);
  process.exit(1);
}

var compSplit = buildBentoComposition("m005", "m012");
if (
  compSplit.length !== 2 ||
  compSplit[0].productId !== "m005" ||
  compSplit[0].quantity !== 1 ||
  compSplit[1].productId !== "m012" ||
  compSplit[1].quantity !== 1
) {
  console.error("FAIL bento composition split", compSplit);
  process.exit(1);
}

var compSalmon = buildBentoComposition("m005", "m005");
if (
  compSalmon.length !== 1 ||
  compSalmon[0].productId !== "m005" ||
  compSalmon[0].quantity !== 2
) {
  console.error("FAIL bento composition salmon x2", compSalmon);
  process.exit(1);
}

var bentoLine = resolveLineItem({
  lineId: "bento-m012",
  productId: "bento",
  bentoChoiceId: "m012",
  quantity: 2,
});
if (
  !bentoLine.bentoComposition ||
  bentoLine.bentoComposition.length !== 2
) {
  console.error("FAIL bento line missing composition", bentoLine);
  process.exit(1);
}

var rejectClientComp = validateCreateBody({
  idempotencyKey: "33333333-3333-4333-8333-333333333333",
  contentHash: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
  customer: { name: "テスト" },
  pickup: { date: "2026-10-19", time: "11:00" },
  items: [
    {
      lineId: "bento-m012",
      productId: "bento",
      bentoChoiceId: "m012",
      quantity: 1,
      bentoComposition: [{ productId: "m999", productName: "偽", quantity: 99 }],
    },
  ],
});
if (rejectClientComp.error !== "invalid_item") {
  console.error("FAIL client bentoComposition should reject", rejectClientComp.error);
  process.exit(1);
}

console.log("OK validate + pickup.at JST + dashimaki block + bentoComposition");
