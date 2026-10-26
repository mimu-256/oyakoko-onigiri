import catalog from "../../../shared/products.json" with { type: "json" };

export function getCatalog() {
  return catalog;
}

export function displayName(rawName) {
  if (!rawName) return "";
  var line = String(rawName).split("\n")[0].trim();
  return line.replace(/\s*\([^)]*\)\s*$/, "").trim() || line;
}

/** 弁当1食あたりのおにぎり内訳（同一 productId は quantity を合算） */
export function buildBentoComposition(fixedOnigiriId, choiceOnigiriId) {
  var products = catalog.products;
  var counts = {};
  [fixedOnigiriId, choiceOnigiriId].forEach(function (id) {
    if (!id || !products[id]) return;
    counts[id] = (counts[id] || 0) + 1;
  });
  return Object.keys(counts)
    .sort()
    .map(function (id) {
      return {
        productId: id,
        productName: displayName(products[id].name),
        quantity: counts[id],
      };
    });
}

export function resolveLineItem(line) {
  var products = catalog.products;
  var bento = catalog.bento;
  var productId = line.productId;
  var qty = Number(line.quantity);
  if (!productId || !Number.isInteger(qty) || qty < 1 || qty > 99) {
    return { error: "invalid_item" };
  }
  if (productId === bento.productId) {
    var choiceId = line.bentoChoiceId;
    if (!choiceId || !products[choiceId]) return { error: "invalid_bento_choice" };
    if (!Object.prototype.hasOwnProperty.call(bento.surcharges, choiceId)) {
      return { error: "invalid_bento_choice" };
    }
    var fixed = products[bento.fixedOnigiriId];
    var choice = products[choiceId];
    if (!fixed) return { error: "invalid_bento_choice" };
    var unitPrice = bento.basePrice + bento.surcharges[choiceId];
    var composition = buildBentoComposition(bento.fixedOnigiriId, choiceId);
    if (!composition.length) return { error: "invalid_bento_choice" };
    return {
      lineId: line.lineId,
      productId: bento.productId,
      bentoChoiceId: choiceId,
      productName: bento.label + "（" + fixed.name + " / " + choice.name + "）",
      quantity: qty,
      unitPrice: unitPrice,
      bentoComposition: composition,
    };
  }
  var p = products[productId];
  if (!p) return { error: "unknown_product" };
  return {
    lineId: line.lineId,
    productId: productId,
    productName: displayName(p.name),
    quantity: qty,
    unitPrice: p.price,
  };
}

export function isDashimakiBlockedDate(dateStr) {
  return (catalog.dashimakiBlockedPickupDates || []).indexOf(dateStr) >= 0;
}
