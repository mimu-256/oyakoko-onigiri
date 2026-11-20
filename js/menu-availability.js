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

  var DEFAULT_STORE_CLOSED_MESSAGE =
    "大変申し訳ございません。\n本日の営業は終了いたしました。\n明日以降はご予約できます。";
  var STORE_CLOSED_AUTO_RELEASE_HOUR = 18;

  function getJstHourMinute(date) {
    var d = date || new Date();
    var parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Tokyo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(d);
    var hour = 0;
    var minute = 0;
    parts.forEach(function (p) {
      if (p.type === "hour") hour = parseInt(p.value, 10);
      if (p.type === "minute") minute = parseInt(p.value, 10);
    });
    return { hour: hour, minute: minute };
  }

  function getJstDateString(date) {
    var parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date || new Date());
    var y = "", m = "", d = "";
    parts.forEach(function (p) {
      if (p.type === "year") y = p.value;
      if (p.type === "month") m = p.value;
      if (p.type === "day") d = p.value;
    });
    return y + "-" + m + "-" + d;
  }

  function isPastStoreClosedAutoRelease(date) {
    return getJstHourMinute(date).hour >= STORE_CLOSED_AUTO_RELEASE_HOUR;
  }

  /** storeClosed が ON でも、18:00（日本時間）以降、または設定した日と今日（日本時間）が違えば OFF 扱い */
  function isStoreClosedEffective(storeClosedFlag, closedDate) {
    if (!storeClosedFlag) return false;
    if (closedDate !== getJstDateString()) return false;
    return !isPastStoreClosedAutoRelease();
  }

  function applyStoreStatus(docData) {
    if (!global.RESERVE_STORE_STATUS) {
      global.RESERVE_STORE_STATUS = {
        closed: false,
        message: DEFAULT_STORE_CLOSED_MESSAGE,
      };
    }
    var rawClosed = !!(docData && docData.storeClosed);
    var closed = isStoreClosedEffective(
      rawClosed,
      docData && docData.storeClosedDate
    );
    global.RESERVE_STORE_STATUS.storeClosedRaw = rawClosed;
    global.RESERVE_STORE_STATUS.closed = closed;
    if (closed && docData.storeClosedMessage) {
      global.RESERVE_STORE_STATUS.message = String(docData.storeClosedMessage);
    } else if (!closed && !global.RESERVE_STORE_STATUS.message) {
      global.RESERVE_STORE_STATUS.message = DEFAULT_STORE_CLOSED_MESSAGE;
    }
  }

  function applyDocToMenu(itemMap, docData) {
    applyStoreStatus(docData || null);
    applyItemsToMap(itemMap, docData ? docData.items : null);
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
        applyDocToMenu(itemMap, snap.exists ? snap.data() : null);
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
          applyDocToMenu(itemMap, snap.exists ? snap.data() : null);
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
    applyStoreStatus: applyStoreStatus,
    defaultStoreClosedMessage: DEFAULT_STORE_CLOSED_MESSAGE,
    isStoreClosedEffective: isStoreClosedEffective,
    getJstDateString: getJstDateString,
    isPastStoreClosedAutoRelease: isPastStoreClosedAutoRelease,
    storeClosedAutoReleaseHour: STORE_CLOSED_AUTO_RELEASE_HOUR,
    collection: COLLECTION,
    docId: DOC_ID,
    defaultMessage: defaultMessage,
  };
})(window);
