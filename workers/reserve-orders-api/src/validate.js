import { getCatalog, resolveLineItem, isDashimakiBlockedDate } from "./catalog.js";

var MAX_NAME = 80;
var MAX_NOTE = 500;
var MAX_ITEMS = 40;
var MAX_BODY = 32000;

export function validateCreateBody(body) {
  if (!body || typeof body !== "object") return { error: "invalid_body" };
  var idempotencyKey = String(body.idempotencyKey || "").trim();
  var contentHash = String(body.contentHash || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
    return { error: "invalid_idempotency_key" };
  }
  if (!/^[a-f0-9]{64}$/i.test(contentHash)) {
    return { error: "invalid_content_hash" };
  }
  var customer = body.customer;
  if (!customer || typeof customer !== "object") return { error: "invalid_customer" };
  var name = String(customer.name || "").trim();
  if (!name || name.length > MAX_NAME) return { error: "invalid_name" };

  var pickup = body.pickup;
  if (!pickup || typeof pickup !== "object") return { error: "invalid_pickup" };
  var date = String(pickup.date || "").trim();
  var time = String(pickup.time || "").trim();
  var dateCheck=new Date(date+'T00:00:00Z');if(!Number.isFinite(dateCheck.getTime())||dateCheck.toISOString().slice(0,10)!==date)return {error:'invalid_pickup_date'};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "invalid_pickup_date" };
  if (!/^\d{1,2}:\d{2}$/.test(time)) return { error: "invalid_pickup_time" };
  var parts = time.split(":");
  var hour = parseInt(parts[0], 10);
  var min = parseInt(parts[1], 10);
  if (hour < 0 || hour > 23 || min < 0 || min > 59) return { error: "invalid_pickup_time" };
  var timeNorm =
    String(hour).padStart(2, "0") + ":" + String(min).padStart(2, "0");

  var note = body.note != null ? String(body.note).trim() : "";
  if (note.length > MAX_NOTE) return { error: "invalid_note" };

  var rawItems = body.items;
  if (!Array.isArray(rawItems) || rawItems.length < 1 || rawItems.length > MAX_ITEMS) {
    return { error: "invalid_items" };
  }

  var items = [];
  var totalQuantity = 0;
  var hasDashimaki = false;
  var lineIds = {};
  for (var i = 0; i < rawItems.length; i++) {
    var raw = rawItems[i];
    if(!raw||typeof raw!=='object')return {error:'invalid_item'};
    var lineId = String(raw.lineId || "").trim();
    if (!lineId || lineIds[lineId] || !/^[a-zA-Z0-9_-]{2,64}$/.test(lineId)) {
      return { error: "invalid_line_id" };
    }
    if (raw.bentoComposition !== undefined) {
      return { error: "invalid_item" };
    }
    lineIds[lineId] = true;
    var resolved = resolveLineItem(raw);
    if (resolved.error) return { error: resolved.error };
    if (resolved.productId === "m017") hasDashimaki = true;
    items.push(resolved);
    totalQuantity += resolved.quantity;
  }
  if (totalQuantity < 1 || totalQuantity > 200) return { error: "invalid_total_quantity" };

  if (hasDashimaki && isDashimakiBlockedDate(date)) {
    return { error: "dashimaki_blocked_date" };
  }

  return {
    idempotencyKey: idempotencyKey,
    contentHash: contentHash,
    customer: { name: name },
    pickup: {
      date: date,
      time: timeNorm,
      timeZone: "Asia/Tokyo",
    },
    items: items,
    totalQuantity: totalQuantity,
    note: note,
  };
}

export function validateBodySize(rawText) {
  return rawText && rawText.length <= MAX_BODY;
}

export { MAX_BODY };
