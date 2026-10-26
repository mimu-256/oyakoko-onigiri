window.ReserveOrderPayload = (function () {
  function sha256Hex(text) {
    var enc = new TextEncoder();
    return crypto.subtle.digest("SHA-256", enc.encode(text)).then(function (buf) {
      var arr = Array.from(new Uint8Array(buf));
      return arr.map(function (b) {
        return b.toString(16).padStart(2, "0");
      }).join("");
    });
  }

  function randomLineId() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return "line-" + Math.random().toString(36).slice(2, 12);
  }

  function padTime(hour, min) {
    var h = String(hour || "0");
    var m = String(min || "0");
    if (h.length === 1) h = "0" + h;
    if (m.length === 1) m = "0" + m;
    return h + ":" + m;
  }

  function buildFromReserveOrder(snapshot) {
    if (!snapshot || !snapshot.items || !snapshot.items.length) {
      return Promise.reject(new Error("empty_cart"));
    }
    var canonical = {
      customer: { name: String(snapshot.customerName || "").trim() },
      pickup: {
        date: String(snapshot.pickupDate || ""),
        time: padTime(snapshot.pickupHour, snapshot.pickupMin),
      },
      items: snapshot.items.map(function (it) {
        var row = {
          lineId: it.lineId || randomLineId(),
          productId: it.productId,
          quantity: it.quantity,
        };
        if (it.bentoChoiceId) row.bentoChoiceId = it.bentoChoiceId;
        return row;
      }),
      note: String(snapshot.note || "").trim(),
    };
    return sha256Hex(JSON.stringify(canonical)).then(function (contentHash) {
      var idempotencyKey =
        ReserveOrderIdempotency.ensureKeyForContentHash(contentHash);
      return {
        idempotencyKey: idempotencyKey,
        contentHash: contentHash,
        customer: canonical.customer,
        pickup: canonical.pickup,
        items: canonical.items,
        note: canonical.note,
      };
    });
  }

  return {
    buildFromReserveOrder: buildFromReserveOrder,
  };
})();
