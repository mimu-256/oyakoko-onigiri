window.ReserveOrderIdempotency = (function () {
  var KEY_STORAGE = "oyakoko_order_idempotency_key_v1";
  var HASH_STORAGE = "oyakoko_order_idempotency_hash_v1";
  var SUCCESS_STORAGE = "oyakoko_order_last_success_v1";

  function randomUuid() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function getStoredSuccess() {
    try {
      var raw = sessionStorage.getItem(SUCCESS_STORAGE);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function setStoredSuccess(data) {
    try {
      sessionStorage.setItem(SUCCESS_STORAGE, JSON.stringify(data));
    } catch (e) {}
  }

  function clearStoredSuccess() {
    try {
      sessionStorage.removeItem(SUCCESS_STORAGE);
    } catch (e) {}
  }

  function ensureKeyForContentHash(contentHash) {
    var hash = String(contentHash || "");
    var storedHash = "";
    var storedKey = "";
    try {
      storedHash = sessionStorage.getItem(HASH_STORAGE) || "";
      storedKey = sessionStorage.getItem(KEY_STORAGE) || "";
    } catch (e) {}
    if (storedKey && storedHash === hash) {
      return storedKey;
    }
    var key = randomUuid();
    try {
      sessionStorage.setItem(KEY_STORAGE, key);
      sessionStorage.setItem(HASH_STORAGE, hash);
    } catch (e) {}
    clearStoredSuccess();
    return key;
  }

  function markCartChanged() {
    try {
      sessionStorage.removeItem(HASH_STORAGE);
    } catch (e) {}
    clearStoredSuccess();
  }

  function rememberSuccess(idempotencyKey, contentHash, result) {
    setStoredSuccess({
      idempotencyKey: idempotencyKey,
      contentHash: contentHash,
      orderId: result.orderId,
      reservationNumber: result.reservationNumber,
    });
  }

  function getCachedSuccess(idempotencyKey, contentHash) {
    var s = getStoredSuccess();
    if (!s) return null;
    if (s.idempotencyKey !== idempotencyKey || s.contentHash !== contentHash) {
      return null;
    }
    return s;
  }

  return {
    ensureKeyForContentHash: ensureKeyForContentHash,
    markCartChanged: markCartChanged,
    rememberSuccess: rememberSuccess,
    getCachedSuccess: getCachedSuccess,
    clearStoredSuccess: clearStoredSuccess,
  };
})();
