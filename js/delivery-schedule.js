window.DeliverySchedule = (function () {
  var SLOT_MINUTES = 30;
  var BLOCK_ADJACENT = 1;
  var BOOKING_STORAGE = "oyakoko_delivery_bookings_dev";
  var CONFIG_URL = "/data/delivery-schedule.json";

  var config = null;
  var bookings = [];
  var db = null;
  var minDate = null;
  var maxDate = null;
  var weekdays = ["日", "月", "火", "水", "木", "金", "土"];

  function pad2(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function cloneDate(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function toDateString(d) {
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function parseDateString(str) {
    var parts = str.split("-");
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }

  function slotKey(dateStr, hour, min) {
    return dateStr + "T" + pad2(hour) + ":" + pad2(min);
  }

  function minutesOf(hour, min) {
    return hour * 60 + (min || 0);
  }

  function initDateBounds() {
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var lead = config && config.orderLeadDays != null ? Number(config.orderLeadDays) : 2;
    var maxDays = config && config.orderMaxDays != null ? Number(config.orderMaxDays) : 31;
    if (!Number.isFinite(lead) || lead < 0) lead = 2;
    if (!Number.isFinite(maxDays) || maxDays < 1) maxDays = 31;
    minDate = cloneDate(today);
    minDate.setDate(minDate.getDate() + lead);
    maxDate = cloneDate(today);
    maxDate.setDate(maxDate.getDate() + maxDays);
  }

  function isWithinOrderRange(dateStr) {
    if (!minDate || !maxDate) initDateBounds();
    var d = parseDateString(dateStr);
    return d >= minDate && d <= maxDate;
  }

  function getMinDate() {
    if (!minDate) initDateBounds();
    return cloneDate(minDate);
  }

  function getMaxDate() {
    if (!maxDate) initDateBounds();
    return cloneDate(maxDate);
  }

  function getShiftForDate(dateStr) {
    if (!config) return null;
    if (config.closedDates && config.closedDates.indexOf(dateStr) !== -1) return null;
    var override = config.dateOverrides && config.dateOverrides[dateStr];
    if (override && override.closed) return null;
    var base = config.defaultShift;
    if (!base && !override) return null;
    return {
      startHour: override && override.startHour != null ? override.startHour : base.startHour,
      startMin: override && override.startMin != null ? override.startMin : base.startMin || 0,
      endHour: override && override.endHour != null ? override.endHour : base.endHour,
      endMin: override && override.endMin != null ? override.endMin : base.endMin || 0,
    };
  }

  function getDaySlots(dateStr) {
    var shift = getShiftForDate(dateStr);
    if (!shift) return [];
    var start = minutesOf(shift.startHour, shift.startMin);
    var end = minutesOf(shift.endHour, shift.endMin);
    var slots = [];
    for (var m = start; m < end; m += SLOT_MINUTES) {
      slots.push({
        date: dateStr,
        hour: Math.floor(m / 60),
        min: m % 60,
        key: slotKey(dateStr, Math.floor(m / 60), m % 60),
      });
    }
    return slots;
  }

  function getBlockedKeysForBooking(booking) {
    var daySlots = getDaySlots(booking.date);
    if (!daySlots.length) return [];
    var centerIdx = -1;
    var targetKey = slotKey(booking.date, Number(booking.hour), Number(booking.min));
    for (var i = 0; i < daySlots.length; i++) {
      if (daySlots[i].key === targetKey) {
        centerIdx = i;
        break;
      }
    }
    if (centerIdx === -1) return [targetKey];
    var blocked = [];
    for (var j = centerIdx - BLOCK_ADJACENT; j <= centerIdx + BLOCK_ADJACENT; j++) {
      if (j >= 0 && j < daySlots.length) blocked.push(daySlots[j].key);
    }
    return blocked;
  }

  function getAllBlockedKeys() {
    var set = {};
    bookings.forEach(function (b) {
      getBlockedKeysForBooking(b).forEach(function (key) {
        set[key] = true;
      });
    });
    return set;
  }

  function isSlotManuallyClosed(key) {
    return !!(config && config.closedSlotKeys && config.closedSlotKeys.indexOf(key) !== -1);
  }

  function isSlotAvailable(dateStr, hour, min) {
    if (!isWithinOrderRange(dateStr)) return false;
    var daySlots = getDaySlots(dateStr);
    if (!daySlots.length) return false;
    var key = slotKey(dateStr, Number(hour), Number(min));
    var exists = daySlots.some(function (s) {
      return s.key === key;
    });
    if (!exists) return false;
    if (isSlotManuallyClosed(key)) return false;
    var blocked = getAllBlockedKeys();
    return !blocked[key];
  }

  function normalizeBooking(raw) {
    if (!raw || !raw.date) return null;
    return {
      date: raw.date,
      hour: Number(raw.hour),
      min: Number(raw.min),
      slotKey: raw.slotKey || slotKey(raw.date, Number(raw.hour), Number(raw.min)),
    };
  }

  function loadDevBookings() {
    try {
      var raw = localStorage.getItem(BOOKING_STORAGE);
      if (!raw) return [];
      return JSON.parse(raw)
        .map(normalizeBooking)
        .filter(Boolean);
    } catch (e) {
      return [];
    }
  }

  function saveDevBookings(list) {
    localStorage.setItem(BOOKING_STORAGE, JSON.stringify(list));
  }

  function initFirestore() {
    if (typeof firebase === "undefined" || !window.FIREBASE_CONFIG || !FIREBASE_CONFIG.apiKey) {
      return null;
    }
    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    return firebase.firestore();
  }

  var configWatchStarted = false;

  function applyConfigData(data, silent) {
    if (!data) return;
    config = {
      slotMinutes: data.slotMinutes || SLOT_MINUTES,
      blockAdjacent: data.blockAdjacent != null ? data.blockAdjacent : BLOCK_ADJACENT,
      defaultShift: data.defaultShift,
      closedDates: data.closedDates || [],
      dateOverrides: data.dateOverrides || {},
      closedSlotKeys: data.closedSlotKeys || [],
      orderLeadDays: data.orderLeadDays != null ? data.orderLeadDays : 2,
      orderMaxDays: data.orderMaxDays != null ? data.orderMaxDays : 31,
    };
    BLOCK_ADJACENT = config.blockAdjacent;
    SLOT_MINUTES = config.slotMinutes || SLOT_MINUTES;
    initDateBounds();
    if (!silent) {
      try {
        window.dispatchEvent(new CustomEvent("delivery-config-updated"));
      } catch (e) {}
    }
  }

  function startConfigWatch() {
    if (!db || configWatchStarted) return;
    configWatchStarted = true;
    db
      .collection("delivery_config")
      .doc("default")
      .onSnapshot(
        function (doc) {
          if (doc.exists) applyConfigData(doc.data());
        },
        function () {}
      );
  }

  function loadConfigFromJson() {
    return fetch(CONFIG_URL, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("config fetch failed");
        return res.json();
      })
      .then(function (data) {
        applyConfigData(data, true);
        if (!db && data.bookings) {
          bookings = data.bookings.map(normalizeBooking).filter(Boolean);
        }
      });
  }

  function loadBookingsFromFirestore() {
    if (!db) return Promise.resolve();
    return db
      .collection("delivery_bookings")
      .where("status", "==", "confirmed")
      .get()
      .then(function (snap) {
        bookings = snap.docs
          .map(function (doc) {
            return normalizeBooking(doc.data());
          })
          .filter(Boolean);
      })
      .catch(function () {
        bookings = loadDevBookings();
      });
  }

  function loadConfigFromFirestore() {
    if (!db) return Promise.resolve(false);
    return db
      .collection("delivery_config")
      .doc("default")
      .get()
      .then(function (doc) {
        if (!doc.exists) return false;
        applyConfigData(doc.data(), true);
        startConfigWatch();
        return true;
      })
      .catch(function () {
        return false;
      });
  }

  function load() {
    db = initFirestore();
    var chain = Promise.resolve();
    if (db) {
      chain = chain
        .then(function () {
          return loadConfigFromFirestore();
        })
        .then(function (fromFirestore) {
          if (!fromFirestore) return loadConfigFromJson();
        })
        .then(function () {
          return loadBookingsFromFirestore();
        })
        .then(function () {
          startConfigWatch();
        });
    } else {
      chain = chain
        .then(function () {
          return loadConfigFromJson();
        })
        .then(function () {
          bookings = loadDevBookings();
        });
    }
    return chain;
  }

  function addDays(d, n) {
    var next = cloneDate(d);
    next.setDate(next.getDate() + n);
    return next;
  }

  function startOfWeekContaining(date) {
    return cloneDate(date);
  }

  function getWeekDates(weekStart) {
    var dates = [];
    for (var i = 0; i < 7; i++) {
      dates.push(addDays(weekStart, i));
    }
    return dates;
  }

  function buildWeekGrid(weekStart) {
    var dates = getWeekDates(weekStart);
    var dateStrings = dates.map(toDateString);
    var timeSet = {};
    dateStrings.forEach(function (ds) {
      getDaySlots(ds).forEach(function (slot) {
        var label = pad2(slot.hour) + ":" + pad2(slot.min);
        timeSet[label] = { hour: slot.hour, min: slot.min };
      });
    });
    var timeLabels = Object.keys(timeSet).sort();
    var blocked = getAllBlockedKeys();
    var rows = timeLabels.map(function (label) {
      var t = timeSet[label];
      return {
        label: label,
        hour: t.hour,
        min: t.min,
        cells: dateStrings.map(function (ds) {
          var key = slotKey(ds, t.hour, t.min);
          var inShift = getDaySlots(ds).some(function (s) {
            return s.key === key;
          });
          if (!inShift || !isWithinOrderRange(ds)) {
            return { date: ds, hour: t.hour, min: t.min, status: "closed" };
          }
          if (isSlotManuallyClosed(key)) {
            return { date: ds, hour: t.hour, min: t.min, status: "manual-off", key: key };
          }
          if (blocked[key]) {
            return { date: ds, hour: t.hour, min: t.min, status: "blocked" };
          }
          return { date: ds, hour: t.hour, min: t.min, status: "open", key: key };
        }),
      };
    });
    return {
      weekStart: cloneDate(weekStart),
      dates: dates,
      dateStrings: dateStrings,
      rows: rows,
    };
  }

  function canGoPrevWeek(weekStart) {
    var prevEnd = addDays(weekStart, -1);
    return prevEnd >= getMinDate();
  }

  function canGoNextWeek(weekStart) {
    var nextStart = addDays(weekStart, 7);
    return nextStart <= getMaxDate();
  }

  function formatSlotLabel(dateStr, hour, min) {
    var d = parseDateString(dateStr);
    var w = weekdays[d.getDay()];
    return (
      d.getFullYear() +
      "年" +
      (d.getMonth() + 1) +
      "月" +
      d.getDate() +
      "日（" +
      w +
      "）" +
      pad2(Number(hour)) +
      ":" +
      pad2(Number(min))
    );
  }

  function formatMonthLabel(dates) {
    if (!dates.length) return "";
    var first = dates[0];
    return first.getFullYear() + "年" + (first.getMonth() + 1) + "月";
  }

  function bookSlot(dateStr, hour, min, meta) {
    if (!isSlotAvailable(dateStr, hour, min)) {
      return Promise.reject(new Error("この時間帯はすでに予約できません"));
    }
    var booking = {
      date: dateStr,
      hour: Number(hour),
      min: Number(min),
      slotKey: slotKey(dateStr, hour, min),
      customerTel: meta && meta.tel ? meta.tel : "",
      status: "confirmed",
      createdAt: new Date().toISOString(),
    };
    if (db) {
      return db
        .collection("delivery_bookings")
        .add({
          date: booking.date,
          hour: booking.hour,
          min: booking.min,
          slotKey: booking.slotKey,
          customerTel: booking.customerTel,
          status: "confirmed",
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        })
        .then(function () {
          bookings.push(booking);
        });
    }
    bookings.push(booking);
    saveDevBookings(bookings);
    return Promise.resolve();
  }

  function refreshBookings() {
    if (db) return loadBookingsFromFirestore();
    bookings = loadDevBookings();
    return Promise.resolve();
  }

  function usesFirestore() {
    return !!db;
  }

  function getConfigSnapshot() {
    if (!config) return null;
    return {
      slotMinutes: config.slotMinutes,
      blockAdjacent: config.blockAdjacent,
      defaultShift: config.defaultShift,
      closedDates: (config.closedDates || []).slice(),
      dateOverrides: JSON.parse(JSON.stringify(config.dateOverrides || {})),
      closedSlotKeys: (config.closedSlotKeys || []).slice(),
      orderLeadDays: config.orderLeadDays,
      orderMaxDays: config.orderMaxDays,
    };
  }

  return {
    load: load,
    applyRemoteConfig: function (data) {
      applyConfigData(data);
    },
    getConfigSnapshot: getConfigSnapshot,
    refreshBookings: refreshBookings,
    getMinDate: getMinDate,
    getMaxDate: getMaxDate,
    startOfWeekContaining: startOfWeekContaining,
    buildWeekGrid: buildWeekGrid,
    canGoPrevWeek: canGoPrevWeek,
    canGoNextWeek: canGoNextWeek,
    isSlotAvailable: isSlotAvailable,
    formatSlotLabel: formatSlotLabel,
    formatMonthLabel: formatMonthLabel,
    bookSlot: bookSlot,
    usesFirestore: usesFirestore,
    weekdays: weekdays,
    toDateString: toDateString,
  };
})();
