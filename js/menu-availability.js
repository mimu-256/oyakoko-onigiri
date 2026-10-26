(function (global) {
  var COLLECTION = "menu_availability";
  var DOC_ID = "default";
  var db = null;
  var unsubscribe = null;

  function defaultMessage() {
    return global.MenuCatalog
      ? global.MenuCatalog.soldOutMessageDefault
      : "申し訳ございません。\n本日売り切れです。";
  }

  function isConfigured() {
    return !!(global.FIREBASE_CONFIG && global.FIREBASE_CONFIG.apiKey);
  }

  function getDb() {
    if (db) return db;
    if (!isConfigured() || typeof firebase === "undefined") return null;
    if (!firebase.apps.length) {
      firebase.initializeApp(global.FIREBASE_CONFIG);
    }
    db = firebase.firestore();
    return db;
  }

  function applyItemsToMap(itemMap, items) {
    if (!itemMap) return;
    Object.keys(itemMap).forEach(function (id) {
      var it = itemMap[id];
      if (!it) return;
      delete it.soldOut;
      delete it.soldOutMessage;
    });
    if (!items || typeof items !== "object") return;
    Object.keys(items).forEach(function (id) {
      if (!itemMap[id]) return;
      var row = items[id];
      if (row && row.soldOut) {
        itemMap[id].soldOut = true;
        itemMap[id].soldOutMessage =
          (row.soldOutMessage && String(row.soldOutMessage)) || defaultMessage();
      }
    });
  }

  function loadAndApply(itemMap) {
    var database = getDb();
    if (!database) return Promise.resolve(false);
    return database
      .collection(COLLECTION)
      .doc(DOC_ID)
      .get()
      .then(function (snap) {
        applyItemsToMap(itemMap, snap.exists ? snap.data().items : null);
        return true;
      })
      .catch(function () {
        return false;
      });
  }

  function watch(itemMap, onChange) {
    var database = getDb();
    if (!database || typeof onChange !== "function") return;
    if (unsubscribe) unsubscribe();
    unsubscribe = database
      .collection(COLLECTION)
      .doc(DOC_ID)
      .onSnapshot(
        function (snap) {
          applyItemsToMap(itemMap, snap.exists ? snap.data().items : null);
          onChange();
        },
        function () {}
      );
  }

  global.MenuAvailability = {
    isConfigured: isConfigured,
    loadAndApply: loadAndApply,
    watch: watch,
    applyItemsToMap: applyItemsToMap,
    collection: COLLECTION,
    docId: DOC_ID,
    defaultMessage: defaultMessage,
  };
})(window);
