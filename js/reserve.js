
(function () {
  var DUMMY = "images/logo.jpg";
  var BENTO_IMAGE = "images/menu/お弁当.jpg";

  var GROUPS = [
    {
      label: "限定",
      items: [
        {
          id: "m001",
          name: "イカ明太おにぎり\n(11月限定)",
          price: 330,
          image: "11_イカ明太おにぎり.png",
        },
        {
          id: "m019",
          name: "高菜明太\n(モバイルオーダー限定)",
          price: 300,
          image: "8_高菜明太.jpg",
        },
      ],
    },
    {
      label: "420円",
      items: [{ id: "m002", name: "うなぎ", price: 420 }],
    },
    {
      label: "360円",
      items: [
        { id: "m003", name: "肉そぼろ卵黄", price: 360 },
        { id: "m004", name: "卵黄", price: 360 },
        { id: "m005", name: "鮭", price: 360 },
      ],
    },
    {
      label: "330円",
      items: [
        { id: "m006", name: "明太クリームチーズ", price: 330 },
        { id: "m007", name: "豚の生姜焼き", price: 330 },
        { id: "m008", name: "豚キムチ", price: 330 },
        { id: "m009", name: "肉そぼろ", price: 330 },
      ],
    },
    {
      label: "300円",
      items: [
        // { id: "m010", name: "イカの塩辛", price: 300 },
        { id: "m011", name: "明太子", price: 300 },
      ],
    },
    {
      label: "280円",
      items: [
        { id: "m012", name: "ツナマヨ", price: 280 },
        { id: "m013", name: "梅かつお", price: 280 },
        { id: "m014", name: "おかか", price: 280 },
        { id: "m015", name: "高菜", price: 280 },
        { id: "m016", name: "こんぶ", price: 280 },
      ],
    },
    {
      label: "その他",
      anchorId: "reserve-other",
      notes: [{ newsHref: "/line-entry/news/side-dish", lineOnly: true }],
      items: [
        { id: "m018", name: "お惣菜セット", price: 550, image: "お惣菜.JPG" },
        { id: "m020", name: "唐揚げ", price: 550, image: "karaage.jpg" },
        { id: "m017", name: "だし巻き玉子", price: 290, image: "だしまき" },
      ],
    },
  ];

  /** ご注文テキストではおにぎりの後に並べる（その他・準備中品も含む） */
  var ORDER_OTHER_ITEM_IDS = { m017: true, m018: true, m020: true };
  var MIN_QTY_SIDE_DISH = 5;
  var SIDE_DISH_MIN_ITEM_IDS = { m018: true, m020: true };

  function requiresMinFive(id) {
    return !!SIDE_DISH_MIN_ITEM_IDS[id];
  }

  var BENTO_FIXED_ID = "m005";
  var BENTO_LABEL = "お弁当";
  var BENTO_BASE_PRICE = 980;
  var BENTO_SURCHARGE = {
    m012: 0,
    m013: 0,
    m014: 0,
    m015: 0,
    m011: 0,
    m016: 0,
    m002: 100,
    m006: 30,
    m008: 30,
    m007: 30,
    m009: 30,
    m003: 50,
    m005: 50,
    m004: 50,
    m001: 30,
  };

  var cart = {};
  var bentoCart = {};
  var ITEM_MAP = {};
  GROUPS.forEach(function (g) {
    g.items.forEach(function (it) {
      ITEM_MAP[it.id] = it;
    });
  });

  function itemImage(id) {
    var it = ITEM_MAP[id];
    if (!it) return DUMMY;
    var base = it.image || it.name;
    if (/\.(jpe?g|png|webp|gif)$/i.test(base)) {
      return "images/menu/" + base;
    }
    return "images/menu/" + base + ".jpg";
  }

  function setItemImage(img, id) {
    img.src = itemImage(id);
    img.onerror = function () {
      img.onerror = null;
      img.src = DUMMY;
    };
  }

  var root = document.getElementById("reserve-menu-root");
  var bentoRoot = document.getElementById("reserve-bento-root");
  var fab = document.getElementById("reserve-fab");
  var fabCount = document.getElementById("fab-count");
  var fabTotal = document.getElementById("fab-total");
  var sheet = document.getElementById("reserve-sheet");
  var backdrop = document.getElementById("sheet-backdrop");
  var cartLines = document.getElementById("cart-lines");
  var cartHeading = document.getElementById("cart-heading");
  var cartEmpty = document.getElementById("cart-empty");
  var cartClearBtn = document.getElementById("cart-clear");
  var subtotalWrap = document.getElementById("cart-subtotal-wrap");
  var subtotalEl = document.getElementById("cart-subtotal");
  var subtotalCountEl = document.getElementById("cart-subtotal-count");
  var form = document.getElementById("reserve-form");
  var submitBtn = document.getElementById("reserve-submit");
  var orderLinesInput = document.getElementById("order_lines");
  var fabOpen = document.getElementById("reserve-fab-open");
  var sheetClose = document.getElementById("sheet-close");
  var bentoModal = document.getElementById("bento-modal");
  var bentoModalBackdrop = document.getElementById("bento-modal-backdrop");
  var bentoModalClose = document.getElementById("bento-modal-close");
  var bentoChoices = document.getElementById("bento-choices");
  var bentoModalConfirm = document.getElementById("bento-modal-confirm");
  var bentoModalTotal = document.getElementById("bento-modal-total");
  var bentoModalQtyEl = document.getElementById("bento-modal-qty");
  var bentoModalQtyMinus = document.getElementById("bento-modal-qty-minus");
  var bentoModalQtyPlus = document.getElementById("bento-modal-qty-plus");
  var bentoSelectedChoiceId = null;
  var bentoModalQty = 1;
  var sheetScrollY = 0;
  var bentoModalScrollY = 0;
  var STORAGE = "oyakoko_reserve_cart_v2";
  var STORAGE_LEGACY = "oyakoko_reserve_cart_v1";

  function bentoSurcharge(choiceId) {
    return Object.prototype.hasOwnProperty.call(BENTO_SURCHARGE, choiceId)
      ? BENTO_SURCHARGE[choiceId]
      : 0;
  }

  function bentoSurchargeLabel(amount) {
    return "+" + amount.toLocaleString("ja-JP") + "円";
  }

  function bentoPrice(choiceId) {
    if (!ITEM_MAP[choiceId]) return 0;
    return BENTO_BASE_PRICE + bentoSurcharge(choiceId);
  }

  function bentoDetailText(choiceId) {
    var fixed = ITEM_MAP[BENTO_FIXED_ID];
    var choice = ITEM_MAP[choiceId];
    if (!fixed || !choice) return "";
    return fixed.name + " / " + choice.name;
  }

  function getBentoQty(choiceId) {
    return bentoCart[choiceId] > 0 ? bentoCart[choiceId] : 0;
  }

  function setBentoQty(choiceId, q) {
    if (q <= 0) delete bentoCart[choiceId];
    else bentoCart[choiceId] = q;
    saveCart();
    if (window.ReserveOrderIdempotency) ReserveOrderIdempotency.markCartChanged();
    sync();
  }

  function addBento(choiceId, qty) {
    if (!ITEM_MAP[choiceId]) return;
    var add = qty > 0 ? qty : 1;
    setBentoQty(choiceId, getBentoQty(choiceId) + add);
  }

  function migrateBentos(raw) {
    bentoCart = {};
    if (!raw) return;
    if (Array.isArray(raw)) {
      raw.forEach(function (b) {
        if (b && b.choiceId) {
          bentoCart[b.choiceId] = (bentoCart[b.choiceId] || 0) + 1;
        }
      });
      return;
    }
    if (typeof raw === "object") {
      Object.keys(raw).forEach(function (id) {
        var q = raw[id];
        if (q > 0 && ITEM_MAP[id]) bentoCart[id] = q;
      });
    }
  }

  function getBentoChoiceIds() {
    var inCart = Object.keys(bentoCart).filter(function (id) {
      return bentoCart[id] > 0 && ITEM_MAP[id];
    });
    var ordered = [];
    getBentoChoiceItems().forEach(function (it) {
      if (inCart.indexOf(it.id) !== -1) ordered.push(it.id);
    });
    inCart.forEach(function (id) {
      if (ordered.indexOf(id) === -1) ordered.push(id);
    });
    return ordered;
  }

  function getAllMenuItems() {
    var items = [];
    GROUPS.forEach(function (g) {
      g.items.forEach(function (it) {
        items.push(it);
      });
    });
    return items;
  }

  function getBentoChoiceItems() {
    return getAllMenuItems()
      .filter(function (it) {
        return it.id !== "m017" && it.id !== "m018" && it.id !== "m020";
      })
      .slice()
      .sort(function (a, b) {
        var diff = bentoSurcharge(a.id) - bentoSurcharge(b.id);
        if (diff !== 0) return diff;
        return a.name.localeCompare(b.name, "ja");
      });
  }

  function money(n) {
    return "¥" + n.toLocaleString("ja-JP");
  }

  function cartTotals() {
    var count = 0;
    var sum = 0;
    Object.keys(cart).forEach(function (id) {
      var q = cart[id];
      if (q > 0) {
        count += q;
        sum += ITEM_MAP[id].price * q;
      }
    });
    Object.keys(bentoCart).forEach(function (choiceId) {
      var q = bentoCart[choiceId];
      if (q > 0) {
        count += q;
        sum += bentoPrice(choiceId) * q;
      }
    });
    return { count: count, sum: sum };
  }

  function saveCart() {
    try {
      localStorage.setItem(
        STORAGE,
        JSON.stringify({
          items: cart,
          bentos: bentoCart,
        })
      );
    } catch (e) {}
  }

  function loadCart() {
    try {
      var raw = localStorage.getItem(STORAGE);
      if (raw) {
        var o = JSON.parse(raw);
        if (o && typeof o === "object") {
          if (o.items && typeof o.items === "object") {
            cart = o.items;
            migrateBentos(o.bentos);
            return;
          }
        }
      }
      raw = localStorage.getItem(STORAGE_LEGACY);
      if (raw) {
        var legacy = JSON.parse(raw);
        if (legacy && typeof legacy === "object" && !legacy.items) {
          cart = legacy;
          bentoCart = {};
          saveCart();
        }
      }
    } catch (e) {}
  }

  function getQty(id) {
    return cart[id] > 0 ? cart[id] : 0;
  }

  function itemSoldOutMessage(id) {
    var it = ITEM_MAP[id];
    if (!it || !it.soldOut) return "";
    return it.soldOutMessage || "申し訳ございません。\n本日売り切れです。";
  }

  /** 売り切れが受取日に効くのは「本日受取」のみ（明日以降は予約可） */
  function soldOutAppliesToPickupDate(dateStr) {
    if (!dateStr) return false;
    return dateStr === toDateInputString(new Date());
  }

  function cartSoldOutConflictsForDate(dateStr) {
    if (!soldOutAppliesToPickupDate(dateStr)) return [];
    var ids = [];
    Object.keys(cart).forEach(function (id) {
      if (cart[id] > 0 && itemSoldOutMessage(id)) ids.push(id);
    });
    return ids;
  }

  function soldOutConflictMessage(dateStr) {
    var ids = cartSoldOutConflictsForDate(dateStr);
    if (!ids.length) return "";
    var names = ids.map(function (id) {
      return ITEM_MAP[id] ? ITEM_MAP[id].name : id;
    });
    return (
      "本日お受け取りの場合、" +
      names.join("、") +
      "は売り切れのためご注文いただけません。受取日を変えるか、カートから外してください。"
    );
  }

  function dashimakiBlockedForPickupDate(dateStr) {
    if (!dateStr || getQty(DASHIMAKI_ITEM_ID) <= 0) return false;
    return !!DASHIMAKI_UNAVAILABLE_PICKUP_DATES[dateStr];
  }

  var DASHIMAKI_CONFLICT_MESSAGE =
    "大変申し訳ございません。\n" +
    "10/17, 18のお受け取りでは、だし巻き玉子のご予約をお休みしています。\n" +
    "受取日を変更するか、カートから外してください。";

  function dashimakiConflictMessage(dateStr) {
    if (!dashimakiBlockedForPickupDate(dateStr)) return "";
    return DASHIMAKI_CONFLICT_MESSAGE;
  }

  function cartPickupConflictMessage(dateStr) {
    var sold = soldOutConflictMessage(dateStr);
    if (sold) return sold;
    return dashimakiConflictMessage(dateStr);
  }

  function hasCartPickupConflict(dateStr) {
    if (!dateStr) return false;
    return (
      cartSoldOutConflictsForDate(dateStr).length > 0 ||
      dashimakiBlockedForPickupDate(dateStr)
    );
  }

  var soldOutConflictEl = null;

  function updateSoldOutConflictUi() {
    if (!soldOutConflictEl || !dateIn) return;
    var msg = cartPickupConflictMessage(dateIn.value);
    if (!msg) {
      soldOutConflictEl.hidden = true;
      soldOutConflictEl.textContent = "";
      return;
    }
    soldOutConflictEl.hidden = false;
    soldOutConflictEl.textContent = msg;
    if (sheet && sheet.classList.contains("is-open")) {
      soldOutConflictEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  function setQty(id, q) {
    q = Math.floor(Number(q));
    if (!Number.isFinite(q) || q <= 0) delete cart[id];
    else if (requiresMinFive(id) && q < MIN_QTY_SIDE_DISH) return;
    else cart[id] = Math.min(99, q);
    saveCart();
    if (window.ReserveOrderIdempotency) ReserveOrderIdempotency.markCartChanged();
    sync();
  }

  function bumpQty(id, delta) {
    var cur = getQty(id);
    if (delta > 0) {
      if (requiresMinFive(id) && cur === 0) setQty(id, MIN_QTY_SIDE_DISH);
      else setQty(id, cur + delta);
      return;
    }
    if (delta < 0) {
      if (requiresMinFive(id) && cur <= MIN_QTY_SIDE_DISH) setQty(id, 0);
      else setQty(id, cur + delta);
    }
  }

  function applySetQtyFromModal(id, q) {
    var cur = getQty(id);
    if (q === cur + 1) bumpQty(id, 1);
    else if (q === cur - 1) bumpQty(id, -1);
    else setQty(id, q);
  }

  function sanitizeSideDishCartQty() {
    Object.keys(SIDE_DISH_MIN_ITEM_IDS).forEach(function (id) {
      var q = cart[id];
      if (q > 0 && q < MIN_QTY_SIDE_DISH) delete cart[id];
    });
  }

  function clearCart() {
    if (!cartTotals().count) return;
    if (!confirm("カート内の商品をすべて削除しますか？")) return;
    cart = {};
    bentoCart = {};
    saveCart();
    if (window.ReserveOrderIdempotency) ReserveOrderIdempotency.markCartChanged();
    sync();
  }

  function totalBentoQty() {
    var n = 0;
    Object.keys(bentoCart).forEach(function (id) {
      var q = bentoCart[id];
      if (q > 0) n += q;
    });
    return n;
  }

  function hasBentoInCart() {
    return totalBentoQty() > 0;
  }

  function hasSideDishInCart() {
    return Object.keys(SIDE_DISH_MIN_ITEM_IDS).some(function (id) {
      return getQty(id) > 0;
    });
  }

  function cloneDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function parseDateString(str) {
    var parts = str.split("-");
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }

  function isWednesday(d) {
    return d.getDay() === 3;
  }

  function getEarliestPickupDate() {
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var start = cloneDay(today);
    if (hasBentoInCart() || hasSideDishInCart()) start.setDate(start.getDate() + 2);
    return start;
  }

  function getLatestPickupDate() {
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var end = cloneDay(today);
    end.setMonth(end.getMonth() + 1);
    return end;
  }

  function isValidPickupDate(dateStr) {
    if (!dateStr) return false;
    var d = parseDateString(dateStr);
    var earliest = getEarliestPickupDate();
    var latest = getLatestPickupDate();
    if (d < earliest || d > latest) return false;
    if (isWednesday(d)) return false;
    return true;
  }

  function nextValidPickupDate(from) {
    var d = cloneDay(from);
    var latest = getLatestPickupDate();
    while (d <= latest) {
      if (isValidPickupDate(toDateInputString(d))) return d;
      d.setDate(d.getDate() + 1);
    }
    return null;
  }

  var pickupWeekdays = ["日", "月", "火", "水", "木", "金", "土"];

  function formatPickupDateLabel(d) {
    return d.getMonth() + 1 + "月" + d.getDate() + "日（" + pickupWeekdays[d.getDay()] + "）";
  }

  function getSelectablePickupDates() {
    var list = [];
    var d = cloneDay(getEarliestPickupDate());
    var latest = getLatestPickupDate();
    while (d <= latest) {
      if (!isWednesday(d)) list.push(cloneDay(d));
      d.setDate(d.getDate() + 1);
    }
    return list;
  }

  function rebuildDateOptions(preferred) {
    if (!dateIn || dateIn.tagName !== "SELECT") return;
    var dates = getSelectablePickupDates();
    var keep = preferred || dateIn.value;
    dateIn.innerHTML = "";
    dates.forEach(function (d) {
      var opt = document.createElement("option");
      opt.value = toDateInputString(d);
      opt.textContent = formatPickupDateLabel(d);
      dateIn.appendChild(opt);
    });
    if (keep && isValidPickupDate(keep)) {
      dateIn.value = keep;
    } else {
      var def = defaultPickupDateStr();
      dateIn.value =
        def && isValidPickupDate(def)
          ? def
          : dates.length
            ? toDateInputString(dates[0])
            : "";
    }
  }

  var PICKUP_LAST_HOUR = 17;
  var PICKUP_SCHEDULE_HINT = "平日 10:00〜 土日祝 7:00〜 水曜：定休日";
  var PICKUP_TODAY_HOURS_NOTICE = "本日20時まで営業！";
  var PICKUP_TIME_HINT_ONIGIRI =
    "原則お受け取りの30分前までのご予約お願いします！";
  var PICKUP_TIME_HINT_WITH_DASHIMAKI =
    "だし巻き玉子もご注文の場合、\n" +
    "原則お受け取りの2時間前までのご予約お願いします！\n" +
    "(おにぎりのみの場合は30分前)";

  /** 土日祝は 7:00〜（YYYY-MM-DD で追加） */
  var PICKUP_EARLY_OPEN_DATES = {};

  /** 受取ヒントの臨時文案（10/12祝日は予約10:00〜の案内用） */
  var PICKUP_SCHEDULE_HINT_ALT = "平日 10:00〜 土日 7:00〜 水曜：定休日";
  var PICKUP_SCHEDULE_HINT_ALT_FROM = "2026-10-11";
  var PICKUP_SCHEDULE_HINT_ALT_UNTIL = "2026-10-12";

  /** 祝日だが 10:00 開始（7:00 対象外・YYYY-MM-DD） */
  var PICKUP_TEN_OPEN_DATES = {
    "2026-10-12": true,
  };

  /** 閉店時刻を延長する日（YYYY-MM-DD → 最終時） */
  var PICKUP_EXTENDED_CLOSE_DATES = {
    "2026-10-10": 19,
  };

  /** だし巻き玉子（m017）を受取できない日（YYYY-MM-DD） */
  var DASHIMAKI_UNAVAILABLE_PICKUP_DATES = {
    "2026-10-17": true,
    "2026-10-18": true,
  };
  var DASHIMAKI_ITEM_ID = "m017";

  function pickupLastHourForDate(dateStr) {
    if (dateStr && PICKUP_EXTENDED_CLOSE_DATES[dateStr] != null) {
      return PICKUP_EXTENDED_CLOSE_DATES[dateStr];
    }
    return PICKUP_LAST_HOUR;
  }

  function isTodayExtendedCloseDay() {
    return PICKUP_EXTENDED_CLOSE_DATES[toDateInputString(new Date())] != null;
  }

  function isWeekendDate(d) {
    var day = d.getDay();
    return day === 0 || day === 6;
  }

  function isHolidayPickupDate(d) {
    return !!PICKUP_EARLY_OPEN_DATES[toDateInputString(d)];
  }

  function usesEarlyPickupHours(dateStr) {
    if (!dateStr) return false;
    var d = parseDateString(dateStr);
    return isWeekendDate(d) || isHolidayPickupDate(d);
  }

  function pickupHourMinForDate(dateStr) {
    if (!dateStr) return 10;
    if (PICKUP_TEN_OPEN_DATES[dateStr]) return 10;
    var min = usesEarlyPickupHours(dateStr) ? 7 : 10;
    if (hasSideDishInCart()) min = Math.max(min, 10);
    return min;
  }

  function pickupTimeSelectHint(dateStr) {
    var lastH = pickupLastHourForDate(dateStr);
    var minH = pickupHourMinForDate(dateStr);
    var minLabel = (minH < 10 ? "0" : "") + minH + ":00";
    if (usesEarlyPickupHours(dateStr)) {
      return "土日祝は" + minLabel + "〜" + lastH + ":55でお選びください。";
    }
    return "平日は" + minLabel + "〜" + lastH + ":55でお選びください。";
  }

  function isScheduleHintAltPeriod() {
    var todayStr = toDateInputString(new Date());
    return todayStr >= PICKUP_SCHEDULE_HINT_ALT_FROM && todayStr <= PICKUP_SCHEDULE_HINT_ALT_UNTIL;
  }

  function activePickupScheduleHint() {
    if (isScheduleHintAltPeriod()) {
      return PICKUP_SCHEDULE_HINT_ALT;
    }
    return PICKUP_SCHEDULE_HINT;
  }

  function pickupScheduleHintForCart() {
    var hint = activePickupScheduleHint();
    if (!hasSideDishInCart()) return hint;
    return hint
      .replace("土日祝 7:00〜", "土日祝 10:00〜")
      .replace("土日 7:00〜", "土日 10:00〜");
  }

  function pickupDateTime(dateStr, hour, min) {
    var d = parseDateString(dateStr);
    d.setHours(parseInt(hour, 10), parseInt(min, 10), 0, 0);
    return d;
  }

  function ceilNowToFiveMinutes() {
    var c = new Date();
    c.setSeconds(0, 0);
    c.setMilliseconds(0);
    var min = Math.ceil(c.getMinutes() / 5) * 5;
    if (min >= 60) {
      min = 0;
      c.setHours(c.getHours() + 1);
    }
    c.setMinutes(min);
    return c;
  }

  /** その日に選べる最早の受取日時（当日は現在時刻以降・5分切上げ） */
  function earliestPickupMomentForDate(dateStr) {
    var open = pickupOpeningDateTime(dateStr);
    var now = new Date();
    if (!sameCalendarDay(parseDateString(dateStr), now)) {
      return open;
    }
    var earliest = ceilNowToFiveMinutes();
    return earliest > open ? earliest : open;
  }

  function effectiveMinHourForDate(dateStr) {
    var minHour = pickupHourMinForDate(dateStr);
    var earliest = earliestPickupMomentForDate(dateStr);
    var eh = earliest.getHours();
    return eh > minHour ? eh : minHour;
  }

  function rebuildMinOptions(preferred) {
    if (!minIn || !dateIn || !hourIn || !dateIn.value || hourIn.value === "") return;
    var h = parseInt(hourIn.value, 10);
    if (isNaN(h)) return;
    var keep = preferred != null ? preferred : minIn.value;
    var minMinute = 0;
    var earliest = earliestPickupMomentForDate(dateIn.value);
    if (sameCalendarDay(parseDateString(dateIn.value), new Date()) && h === earliest.getHours()) {
      minMinute = earliest.getMinutes();
    }
    minIn.innerHTML = "";
    var empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "選択";
    minIn.appendChild(empty);
    for (var m = 0; m <= 55; m += 5) {
      if (m < minMinute) continue;
      var opt = document.createElement("option");
      var label = m < 10 ? "0" + m : String(m);
      opt.value = label;
      opt.textContent = label;
      minIn.appendChild(opt);
    }
    if (keep && Number(keep) >= minMinute) {
      minIn.value = keep;
    } else {
      minIn.value = "";
    }
  }

  function rebuildHourOptions(preferred) {
    if (!hourIn || !dateIn || !dateIn.value) {
      if (hourIn) hourIn.value = "";
      if (minIn) minIn.value = "";
      return;
    }
    var minHour = effectiveMinHourForDate(dateIn.value);
    var keep = preferred || hourIn.value;
    hourIn.innerHTML = "";
    var empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "選択";
    hourIn.appendChild(empty);
    var lastHour = pickupLastHourForDate(dateIn.value);
    if (minHour <= lastHour) {
      for (var h = minHour; h <= lastHour; h++) {
        var opt = document.createElement("option");
        opt.value = String(h);
        opt.textContent = String(h);
        hourIn.appendChild(opt);
      }
    }
    if (keep && Number(keep) >= minHour && Number(keep) <= lastHour) {
      hourIn.value = keep;
    } else {
      hourIn.value = "";
    }
    rebuildMinOptions(minIn ? minIn.value : "");
  }

  function sameCalendarDay(a, b) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  function pickupOpeningDateTime(dateStr) {
    var d = parseDateString(dateStr);
    d.setHours(pickupHourMinForDate(dateStr), 0, 0, 0);
    return d;
  }

  function pickupLastDateTime(dateStr) {
    var d = parseDateString(dateStr);
    d.setHours(pickupLastHourForDate(dateStr), 55, 0, 0);
    return d;
  }

  function candidatePickupFromNow() {
    var c = new Date();
    c.setMinutes(c.getMinutes() + 60);
    c.setSeconds(0, 0);
    c.setMilliseconds(0);
    var min = Math.ceil(c.getMinutes() / 5) * 5;
    if (min >= 60) {
      min = 0;
      c.setHours(c.getHours() + 1);
    }
    c.setMinutes(min);
    return c;
  }

  /** 希望日の初期値: 当日（お弁当は2日後〜）。営業時間後は次の営業日 */
  function defaultPickupDateStr() {
    var now = new Date();
    var dateStr = toDateInputString(getEarliestPickupDate());

    while (dateStr) {
      if (!isValidPickupDate(dateStr)) {
        var fix = nextValidPickupDate(parseDateString(dateStr));
        if (!fix) break;
        dateStr = toDateInputString(fix);
        continue;
      }

      var pickDay = parseDateString(dateStr);
      if (!sameCalendarDay(pickDay, now)) {
        return dateStr;
      }

      var last = pickupLastDateTime(dateStr);
      var cand = candidatePickupFromNow();

      if (now > last || cand > last) {
        var after = cloneDay(pickDay);
        after.setDate(after.getDate() + 1);
        var next = nextValidPickupDate(after);
        if (!next) break;
        dateStr = toDateInputString(next);
        continue;
      }

      return dateStr;
    }

    var dates = getSelectablePickupDates();
    return dates.length ? toDateInputString(dates[0]) : "";
  }

  function isValidPickupTime(dateStr, hour, min) {
    if (!dateStr || hour === "" || min === "") return false;
    var h = parseInt(hour, 10);
    var m = parseInt(min, 10);
    if (isNaN(h) || isNaN(m)) return false;
    if (h < effectiveMinHourForDate(dateStr) || h > pickupLastHourForDate(dateStr)) {
      return false;
    }
    var pick = pickupDateTime(dateStr, hour, min);
    var earliest = earliestPickupMomentForDate(dateStr);
    var last = pickupLastDateTime(dateStr);
    return pick >= earliest && pick <= last;
  }

  function formatTotalCount(count) {
    return count > 0 ? "（" + count + "点）" : "";
  }

  function updateSubtotalDisplay(t) {
    if (subtotalEl) subtotalEl.textContent = money(t.sum);
    if (subtotalCountEl) subtotalCountEl.textContent = formatTotalCount(t.count);
  }

  function updateSubmitButton() {
    if (!submitBtn) return;
    var empty = cartTotals().count <= 0;
    var conflict =
      dateIn && dateIn.value && hasCartPickupConflict(dateIn.value);
    submitBtn.disabled = empty || conflict;
  }

  function cartHasDashimaki() {
    return getQty(DASHIMAKI_ITEM_ID) > 0;
  }

  function showDashimakiPickupTimeHint() {
    if (!cartHasDashimaki()) return false;
    if (dateIn && dateIn.value && dashimakiBlockedForPickupDate(dateIn.value)) {
      return false;
    }
    return true;
  }

  function updatePickupTimeHint() {
    var timeHint = document.querySelector(".reserve-time-hint");
    if (!timeHint) return;
    var text = showDashimakiPickupTimeHint()
      ? PICKUP_TIME_HINT_WITH_DASHIMAKI
      : PICKUP_TIME_HINT_ONIGIRI;
    if (isTodayExtendedCloseDay()) {
      text += " " + PICKUP_TODAY_HOURS_NOTICE;
    }
    timeHint.textContent = text;
  }

  function sync() {
    document.querySelectorAll(".reserve-card").forEach(function (card) {
      var id = card.getAttribute("data-id");
      var el = card.querySelector(".reserve-card__qty");
      if (el) el.textContent = String(getQty(id));
    });
    var t = cartTotals();
    if (fabCount) fabCount.textContent = String(t.count);
    if (fabTotal) fabTotal.textContent = money(t.sum);
    renderCart();
    updateSubmitButton();
    if (orderLinesInput) {
      orderLinesInput.value = buildOrderText();
    }
    updateDateConstraints();
    updateSoldOutConflictUi();
    updatePickupTimeHint();
    updateSubmitButton();
  }

  window.updateReserveSubmitState = updateSubmitButton;

  function isOtherOrderItem(id) {
    return !!ORDER_OTHER_ITEM_IDS[id];
  }

  function sortCartIdsByPriceAsc(ids) {
    return ids.slice().sort(function (a, b) {
      var itA = ITEM_MAP[a];
      var itB = ITEM_MAP[b];
      if (!itA || !itB) return 0;
      if (itA.price !== itB.price) return itA.price - itB.price;
      return itA.name.localeCompare(itB.name, "ja");
    });
  }

  function getOnigiriCartItemIds() {
    var inCart = Object.keys(cart).filter(function (id) {
      return cart[id] > 0 && ITEM_MAP[id] && !isOtherOrderItem(id);
    });
    return sortCartIdsByPriceAsc(inCart);
  }

  function getOtherCartItemIds() {
    var inCart = Object.keys(cart).filter(function (id) {
      return cart[id] > 0 && ITEM_MAP[id] && isOtherOrderItem(id);
    });
    return sortCartIdsByPriceAsc(inCart);
  }

  /** カート表示用（追加した順） */
  function getCartItemIds() {
    return Object.keys(cart).filter(function (id) {
      return cart[id] > 0 && ITEM_MAP[id];
    });
  }

  /** LINE送信のご注文行（おにぎりは単価昇順 → その他） */
  function getLineOrderItemIds() {
    return getOnigiriCartItemIds().concat(getOtherCartItemIds());
  }

  /** LINE注文用（画面表示の改行・(…) 注記は出さない） */
  function orderLineItemName(name) {
    if (!name) return "";
    var line = String(name).split("\n")[0].trim();
    return line.replace(/\s*\([^)]*\)\s*$/, "").trim() || line;
  }

  function buildReserveLineSummary() {
    var rows = [];
    getBentoChoiceIds().forEach(function (choiceId) {
      var q = bentoCart[choiceId];
      if (q <= 0) return;
      rows.push({
        name: BENTO_LABEL + "（" + bentoDetailText(choiceId) + "）",
        quantity: q,
      });
    });
    getLineOrderItemIds().forEach(function (id) {
      var q = cart[id];
      if (q <= 0) return;
      var it = ITEM_MAP[id];
      if (!it) return;
      rows.push({
        name: orderLineItemName(it.name),
        quantity: q,
      });
    });
    return rows;
  }

  function buildReserveOrderSnapshot(form) {
    var items = [];
    getBentoChoiceIds().forEach(function (choiceId) {
      var q = bentoCart[choiceId];
      if (q <= 0) return;
      items.push({
        lineId: "bento-" + choiceId,
        productId: "bento",
        bentoChoiceId: choiceId,
        quantity: q,
      });
    });
    getLineOrderItemIds().forEach(function (id) {
      var q = cart[id];
      if (q <= 0) return;
      items.push({
        lineId: "pid-" + id,
        productId: id,
        quantity: q,
      });
    });
    return {
      customerName: form.name,
      pickupDate: form.date,
      pickupHour: form.hour,
      pickupMin: form.min,
      note: form.note,
      items: items,
      lineSummary: buildReserveLineSummary(),
      totalQuantity: cartTotals().count,
    };
  }

  window.ReserveOrder = {
    buildReserveOrderSnapshot: buildReserveOrderSnapshot,
    buildReserveLineSummary: buildReserveLineSummary,
  };

  function buildOrderText() {
    var lines = [];
    getBentoChoiceIds().forEach(function (choiceId) {
      var q = bentoCart[choiceId];
      lines.push(
        BENTO_LABEL +
          " ×" +
          q +
          "\n  " +
          bentoDetailText(choiceId)
      );
    });
    getLineOrderItemIds().forEach(function (id) {
      var q = cart[id];
      if (q <= 0) return;
      var it = ITEM_MAP[id];
      if (!it) return;
      lines.push(orderLineItemName(it.name) + " ×" + q);
    });
    if (!lines.length) return "（品目なし）";
    return lines.join("\n");
  }

  function renderBentoSection() {
    if (!bentoRoot) return;
    var fixed = ITEM_MAP[BENTO_FIXED_ID];
    if (!fixed) return;

    bentoRoot.innerHTML = "";
    var sec = document.createElement("section");
    sec.className = "reserve-bento";
    sec.setAttribute("aria-label", "お弁当");

    var h2 = document.createElement("h2");
    h2.className = "reserve-bento__title";
    h2.textContent = "お弁当";

    var card = document.createElement("article");
    card.className = "reserve-bento__card";

    var imgBtn = document.createElement("button");
    imgBtn.type = "button";
    imgBtn.className = "reserve-bento__img-btn";
    imgBtn.setAttribute("aria-label", "お弁当を選ぶ");
    imgBtn.addEventListener("click", openBentoModal);

    var img = document.createElement("img");
    img.className = "reserve-bento__img";
    img.src = BENTO_IMAGE;
    img.alt = "";
    img.loading = "lazy";
    imgBtn.appendChild(img);

    var body = document.createElement("div");
    body.className = "reserve-bento__body";

    var name = document.createElement("h3");
    name.className = "reserve-bento__name";
    name.textContent = "鮭 ＋ お好きなおにぎり1個";

    var desc = document.createElement("p");
    desc.className = "reserve-bento__desc";
    desc.textContent = "おかずはから揚げ、ポテサラ、だし巻き玉子です";

    var price = document.createElement("p");
    price.className = "reserve-bento__price";
    price.textContent = money(BENTO_BASE_PRICE) + "〜";

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "reserve-bento__btn";
    btn.textContent = "お弁当を選ぶ";
    btn.addEventListener("click", openBentoModal);

    body.appendChild(name);
    body.appendChild(desc);
    body.appendChild(price);
    body.appendChild(btn);
    card.appendChild(imgBtn);
    card.appendChild(body);
    sec.appendChild(h2);
    var bentoNote = document.createElement("p");
    bentoNote.className = "reserve-bento__note";
    bentoNote.textContent = "お弁当は2日前からのご予約になります";
    sec.appendChild(bentoNote);
    sec.appendChild(card);
    bentoRoot.appendChild(sec);
  }

  function renderBentoChoices() {
    if (!bentoChoices) return;
    bentoChoices.innerHTML = "";
    getBentoChoiceItems().forEach(function (it) {
      var surcharge = bentoSurcharge(it.id);
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "bento-choice";
      btn.setAttribute("role", "radio");
      btn.setAttribute("aria-checked", "false");
      btn.setAttribute("data-id", it.id);

      var nm = document.createElement("span");
      nm.className = "bento-choice__name";
      nm.textContent = it.name;

      var pr = document.createElement("span");
      pr.className = "bento-choice__price";
      pr.textContent = bentoSurchargeLabel(surcharge);

      btn.appendChild(nm);
      btn.appendChild(pr);
      btn.addEventListener("click", function () {
        selectBentoChoice(it.id);
      });
      bentoChoices.appendChild(btn);
    });
  }

  function bentoTotalLabel(choiceId, qty) {
    var count = qty > 0 ? qty : 1;
    var unit = choiceId ? bentoPrice(choiceId) : BENTO_BASE_PRICE;
    return "合計 " + money(unit * count);
  }

  function setBentoModalQty(qty) {
    bentoModalQty = qty < 1 ? 1 : qty;
    if (bentoModalQtyEl) bentoModalQtyEl.textContent = String(bentoModalQty);
    if (bentoModalQtyMinus) bentoModalQtyMinus.disabled = bentoModalQty <= 1;
    updateBentoModalTotal();
  }

  function updateBentoModalTotal() {
    if (!bentoModalTotal || !bentoModalConfirm) return;
    bentoModalTotal.removeAttribute("hidden");
    bentoModalTotal.textContent = bentoTotalLabel(bentoSelectedChoiceId, bentoModalQty);
    bentoModalConfirm.disabled = !bentoSelectedChoiceId;
  }

  function selectBentoChoice(choiceId) {
    bentoSelectedChoiceId = choiceId;
    if (!bentoChoices) return;
    bentoChoices.querySelectorAll(".bento-choice").forEach(function (el) {
      var selected = el.getAttribute("data-id") === choiceId;
      el.classList.toggle("is-selected", selected);
      el.setAttribute("aria-checked", selected ? "true" : "false");
    });
    updateBentoModalTotal();
  }

  function lockBentoScroll() {
    bentoModalScrollY = window.scrollY || window.pageYOffset;
    document.documentElement.classList.add("bento-modal-open");
    document.body.classList.add("bento-modal-open");
    document.body.style.top = "-" + bentoModalScrollY + "px";
  }

  function unlockBentoScroll() {
    document.documentElement.classList.remove("bento-modal-open");
    document.body.classList.remove("bento-modal-open");
    document.body.style.top = "";
    window.scrollTo(0, bentoModalScrollY);
  }

  function openBentoModal() {
    if (!bentoModal || !bentoModalBackdrop) return;
    bentoSelectedChoiceId = null;
    setBentoModalQty(1);
    if (bentoChoices) {
      bentoChoices.querySelectorAll(".bento-choice").forEach(function (el) {
        el.classList.remove("is-selected");
        el.setAttribute("aria-checked", "false");
      });
    }
    updateBentoModalTotal();
    bentoModal.classList.add("is-open");
    bentoModalBackdrop.classList.add("is-open");
    bentoModal.setAttribute("aria-hidden", "false");
    bentoModalBackdrop.setAttribute("aria-hidden", "false");
    lockBentoScroll();
  }

  function closeBentoModal() {
    if (!bentoModal || !bentoModalBackdrop) return;
    bentoModal.classList.remove("is-open");
    bentoModalBackdrop.classList.remove("is-open");
    bentoModal.setAttribute("aria-hidden", "true");
    bentoModalBackdrop.setAttribute("aria-hidden", "true");
    unlockBentoScroll();
  }

  function initBentoModal() {
    if (!ITEM_MAP[BENTO_FIXED_ID]) return;
    renderBentoChoices();
    setBentoModalQty(1);
    if (bentoModalClose) {
      bentoModalClose.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        closeBentoModal();
      });
    }
    if (bentoModalBackdrop) {
      bentoModalBackdrop.addEventListener("click", closeBentoModal);
    }
    if (bentoModal) {
      bentoModal.addEventListener("click", function (e) {
        if (e.target === bentoModal) closeBentoModal();
      });
    }
    if (bentoModalQtyMinus) {
      bentoModalQtyMinus.addEventListener("click", function () {
        setBentoModalQty(bentoModalQty - 1);
      });
    }
    if (bentoModalQtyPlus) {
      bentoModalQtyPlus.addEventListener("click", function () {
        setBentoModalQty(bentoModalQty + 1);
      });
    }
    if (bentoModalConfirm) {
      bentoModalConfirm.addEventListener("click", function () {
        if (!bentoSelectedChoiceId) return;
        addBento(bentoSelectedChoiceId, bentoModalQty);
        closeBentoModal();
        openSheet();
      });
    }
  }

  function appendOtherPreparingSection(parent) {
    var sec = document.createElement("section");
    sec.className = "reserve-group reserve-group--preparing";
    sec.setAttribute("aria-label", "その他");
    var h2 = document.createElement("h2");
    h2.className = "reserve-group__title";
    h2.textContent = "その他";
    sec.appendChild(h2);
    var p = document.createElement("p");
    p.className = "reserve-group__preparing";
    p.textContent = "準備中";
    sec.appendChild(p);
    parent.appendChild(sec);
  }

  function showMenuLoading() {
    if (!root) return;
    root.classList.add("reserve-menu-root--loading");
    root.innerHTML =
      '<div class="reserve-menu-loading" role="status" aria-live="polite">' +
      '<div class="reserve-menu-loading__spinner" aria-hidden="true"></div>' +
      "<p class=\"reserve-menu-loading__text\">メニューを取得しています…</p>" +
      "</div>";
  }

  function renderMenu() {
    if (!root) return;
    root.classList.remove("reserve-menu-root--loading");
    root.innerHTML = "";
    GROUPS.forEach(function (g) {
      var sec = document.createElement("section");
      sec.className = "reserve-group";
      if (g.anchorId) sec.id = g.anchorId;
      sec.setAttribute("aria-label", g.label);
      var h2 = document.createElement("h2");
      h2.className = "reserve-group__title";
      h2.textContent = g.label;
      sec.appendChild(h2);
      (g.notes || (g.note ? [g.note] : [])).forEach(function (entry) {
        var text = typeof entry === "string" ? entry : entry.text || "";
        var groupNote = document.createElement("p");
        groupNote.className = "reserve-group__note";
        if (text) groupNote.appendChild(document.createTextNode(text));
        if (entry && typeof entry === "object" && entry.newsHref) {
          if (text) groupNote.appendChild(document.createTextNode(" "));
          var newsLink = document.createElement("a");
          newsLink.className = "reserve-group__note-link";
          newsLink.href = entry.newsHref;
          newsLink.textContent = "お惣菜のご案内";
          groupNote.appendChild(newsLink);
          if (entry.lineOnly) {
            groupNote.hidden = true;
            groupNote.setAttribute("data-line-client-only", "");
          }
        }
        sec.appendChild(groupNote);
      });
      var grid = document.createElement("div");
      grid.className = "reserve-grid";
      g.items.forEach(function (it) {
        grid.appendChild(buildCard(it));
      });
      sec.appendChild(grid);
      root.appendChild(sec);
    });
  }

  function menuModalNote(id) {
    if (id === "m017") {
      return (
        "だし巻き玉子は3個入りです\n" +
        "原則お受け取りの2時間前までにご予約ください。"
      );
    }
    if (id === "m018") return "お惣菜セットは2日前までのご予約が必要です（5個から）。";
    if (id === "m020") return "唐揚げは2日前までのご予約が必要です（5個から）。";
    return "おにぎりは1つの価格です";
  }

  function menuCardNote(id) {
    if (id === "m017") return "2時間前までにご予約ください。";
    if (id === "m018" || id === "m020") {
      return "2日前までにご予約ください。\n5個からの注文となります。";
    }
    return "";
  }

  function buildMenuModalItems() {
    var list = [];
    GROUPS.forEach(function (g) {
      g.items.forEach(function (item) {
        var soldMsg = itemSoldOutMessage(item.id);
        list.push({
          id: item.id,
          src: itemImage(item.id),
          title: item.name,
          price: money(item.price),
          note: soldMsg || menuModalNote(item.id),
          soldOut: false,
          getQty: (function (id) {
            return function () {
              return getQty(id);
            };
          })(item.id),
          setQty: (function (id) {
            return function (q) {
              applySetQtyFromModal(id, q);
            };
          })(item.id),
        });
      });
    });
    return list;
  }

  function menuModalIndexFor(id, items) {
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === id) return i;
    }
    return 0;
  }

  function buildCard(it) {
    var soldMsg = itemSoldOutMessage(it.id);
    var card = document.createElement("article");
    card.className = "reserve-card" + (soldMsg ? " reserve-card--sold-out" : "");
    card.setAttribute("data-id", it.id);
    var mediaBtn = document.createElement("button");
    mediaBtn.type = "button";
    mediaBtn.className = "reserve-card__media-btn";
    mediaBtn.setAttribute("aria-label", it.name + "の画像を拡大");
    var img = document.createElement("img");
    img.className = "reserve-card__img";
    setItemImage(img, it.id);
    img.alt = "";
    img.loading = "lazy";
    mediaBtn.appendChild(img);
    mediaBtn.addEventListener("click", function () {
      if (!window.MenuImageModal) return;
      var items = buildMenuModalItems();
      MenuImageModal.open({
        items: items,
        index: menuModalIndexFor(it.id, items),
      });
    });
    var body = document.createElement("div");
    body.className = "reserve-card__body";
    var name = document.createElement("h3");
    name.className = "reserve-card__name";
    name.textContent = it.name;
    var price = document.createElement("p");
    price.className = "reserve-card__price";
    price.textContent = money(it.price);
    var step = document.createElement("div");
    step.className = "reserve-stepper";
    step.setAttribute("role", "group");
    step.setAttribute("aria-label", it.name + "の数量");
    var btnM = document.createElement("button");
    btnM.type = "button";
    btnM.className = "reserve-stepper__btn";
    btnM.setAttribute("aria-label", "1つ減らす");
    btnM.textContent = "−";
    var qty = document.createElement("span");
    qty.className = "reserve-card__qty";
    qty.textContent = String(getQty(it.id));
    var btnP = document.createElement("button");
    btnP.type = "button";
    btnP.className = "reserve-stepper__btn";
    btnP.setAttribute("aria-label", "1つ足す");
    btnP.textContent = "+";
    var id = it.id;
    btnM.addEventListener("click", function () {
      bumpQty(id, -1);
    });
    btnP.addEventListener("click", function () {
      bumpQty(id, 1);
    });
    step.appendChild(btnM);
    step.appendChild(qty);
    step.appendChild(btnP);
    body.appendChild(name);
    var cardNote = menuCardNote(it.id);
    if (cardNote) {
      var hint = document.createElement("p");
      hint.className = "reserve-card__note";
      hint.textContent = cardNote;
      body.appendChild(hint);
    }
    body.appendChild(price);
    if (soldMsg) {
      var soldNote = document.createElement("p");
      soldNote.className = "reserve-card__sold-out";
      soldNote.textContent = soldMsg;
      body.appendChild(soldNote);
    }
    body.appendChild(step);
    card.appendChild(mediaBtn);
    card.appendChild(body);
    return card;
  }

  function renderCart() {
    if (!cartLines) return;
    var t = cartTotals();
    var has = t.count > 0;
    if (cartEmpty) cartEmpty.hidden = has;
    if (cartHeading) cartHeading.hidden = !has;
    if (cartClearBtn) cartClearBtn.hidden = !has;
    if (subtotalWrap) subtotalWrap.hidden = !has;
    updateSubtotalDisplay(t);
    cartLines.innerHTML = "";
    getBentoChoiceIds().forEach(function (choiceId) {
      var q = bentoCart[choiceId];
      var price = bentoPrice(choiceId);
      var li = document.createElement("li");
      li.className = "reserve-line reserve-line--bento";
      var thumb = document.createElement("img");
      thumb.className = "reserve-line__thumb";
      thumb.src = BENTO_IMAGE;
      thumb.width = 96;
      thumb.height = 72;
      thumb.alt = "";
      thumb.decoding = "async";
      var info = document.createElement("div");
      info.className = "reserve-line__info";
      var nm = document.createElement("span");
      nm.className = "reserve-line__name";
      nm.textContent = BENTO_LABEL;
      var detail = document.createElement("p");
      detail.className = "reserve-line__detail";
      detail.textContent = bentoDetailText(choiceId);
      var row = document.createElement("div");
      row.className = "reserve-line__row";
      var unit = document.createElement("span");
      unit.className = "reserve-line__unit";
      unit.textContent = "単価 " + money(price) + "（税込）";
      var step = document.createElement("div");
      step.className = "reserve-stepper";
      step.setAttribute("role", "group");
      step.setAttribute("aria-label", BENTO_LABEL + "（" + bentoDetailText(choiceId) + "）の数量");
      var b1 = document.createElement("button");
      b1.type = "button";
      b1.className = "reserve-stepper__btn reserve-stepper__btn--sm";
      b1.setAttribute("aria-label", "1つ減らす");
      b1.textContent = "−";
      var qty = document.createElement("span");
      qty.className = "reserve-line__qty";
      qty.textContent = String(q);
      var b2 = document.createElement("button");
      b2.type = "button";
      b2.className = "reserve-stepper__btn reserve-stepper__btn--sm";
      b2.setAttribute("aria-label", "1つ足す");
      b2.textContent = "+";
      (function (cid) {
        b1.addEventListener("click", function () {
          setBentoQty(cid, getBentoQty(cid) - 1);
        });
        b2.addEventListener("click", function () {
          setBentoQty(cid, getBentoQty(cid) + 1);
        });
      })(choiceId);
      step.appendChild(b1);
      step.appendChild(qty);
      step.appendChild(b2);
      row.appendChild(unit);
      row.appendChild(step);
      var subP = document.createElement("p");
      subP.className = "reserve-line__sub";
      subP.textContent = "小計 " + money(price * q);
      info.appendChild(nm);
      info.appendChild(detail);
      info.appendChild(row);
      info.appendChild(subP);
      li.appendChild(thumb);
      li.appendChild(info);
      cartLines.appendChild(li);
    });
    getCartItemIds().forEach(function (id) {
      var q = cart[id];
      if (q <= 0) return;
      var it = ITEM_MAP[id];
      var li = document.createElement("li");
      li.className = "reserve-line";
      var thumb = document.createElement("img");
      thumb.className = "reserve-line__thumb";
      setItemImage(thumb, id);
      thumb.width = 96;
      thumb.height = 72;
      thumb.alt = "";
      thumb.decoding = "async";
      var info = document.createElement("div");
      info.className = "reserve-line__info";
      var nm = document.createElement("span");
      nm.className = "reserve-line__name";
      nm.textContent = it.name;
      var row = document.createElement("div");
      row.className = "reserve-line__row";
      var unit = document.createElement("span");
      unit.className = "reserve-line__unit";
      unit.textContent = "単価 " + money(it.price) + "（税込）";
      var step = document.createElement("div");
      step.className = "reserve-stepper";
      step.setAttribute("role", "group");
      step.setAttribute("aria-label", it.name + "の数量");
      var b1 = document.createElement("button");
      b1.type = "button";
      b1.className = "reserve-stepper__btn reserve-stepper__btn--sm";
      b1.setAttribute("aria-label", "1つ減らす");
      b1.textContent = "−";
      var qty = document.createElement("span");
      qty.className = "reserve-line__qty";
      qty.textContent = String(q);
      var b2 = document.createElement("button");
      b2.type = "button";
      b2.className = "reserve-stepper__btn reserve-stepper__btn--sm";
      b2.setAttribute("aria-label", "1つ足す");
      b2.textContent = "+";
      (function (pid) {
        b1.addEventListener("click", function () {
          bumpQty(pid, -1);
        });
        b2.addEventListener("click", function () {
          bumpQty(pid, 1);
        });
      })(id);
      step.appendChild(b1);
      step.appendChild(qty);
      step.appendChild(b2);
      row.appendChild(unit);
      row.appendChild(step);
      var subP = document.createElement("p");
      subP.className = "reserve-line__sub";
      subP.textContent = "小計 " + money(it.price * q) + "（" + q + "個）";
      info.appendChild(nm);
      info.appendChild(row);
      info.appendChild(subP);
      li.appendChild(thumb);
      li.appendChild(info);
      cartLines.appendChild(li);
    });
  }

  function lockSheetScroll() {
    sheetScrollY = window.scrollY || window.pageYOffset;
    document.documentElement.classList.add("reserve-sheet-open");
    document.body.classList.add("reserve-sheet-open");
    document.body.style.top = "-" + sheetScrollY + "px";
  }

  function unlockSheetScroll() {
    document.documentElement.classList.remove("reserve-sheet-open");
    document.body.classList.remove("reserve-sheet-open");
    document.body.style.top = "";
    window.scrollTo(0, sheetScrollY);
  }

  function openSheet() {
    if (!sheet || !backdrop) return;
    sheet.classList.add("is-open");
    backdrop.classList.add("is-open");
    lockSheetScroll();
    if (fabOpen) fabOpen.setAttribute("aria-expanded", "true");
    sheet.setAttribute("aria-hidden", "false");
    backdrop.setAttribute("aria-hidden", "false");
  }

  function closeSheet() {
    if (!sheet || !backdrop) return;
    sheet.classList.remove("is-open");
    backdrop.classList.remove("is-open");
    unlockSheetScroll();
    if (fabOpen) fabOpen.setAttribute("aria-expanded", "false");
    sheet.setAttribute("aria-hidden", "true");
    backdrop.setAttribute("aria-hidden", "true");
  }

  function scrollToMenuAnchorIfNeeded() {
    var raw = location.hash;
    if (!raw || raw.length < 2) return;
    var id = decodeURIComponent(raw.slice(1));
    var el = document.getElementById(id);
    if (!el || !root || !root.contains(el)) return;
    requestAnimationFrame(function () {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function bootMenuAndCart() {
    sanitizeSideDishCartQty();
    renderMenu();
    scrollToMenuAnchorIfNeeded();
    if (window.LiffCore && LiffCore.syncLineOnlyUi) LiffCore.syncLineOnlyUi();
    sync();
  }

  loadCart();
  sanitizeSideDishCartQty();
  // お弁当一時中止
  if (Object.keys(bentoCart).length) {
    bentoCart = {};
    saveCart();
  }
  // renderBentoSection();
  // initBentoModal();

  if (fabOpen) {
    fabOpen.addEventListener("click", function () {
      openSheet();
    });
  }
  if (sheetClose) {
    sheetClose.addEventListener("click", function () {
      closeSheet();
    });
  }
  if (cartClearBtn) {
    cartClearBtn.addEventListener("click", clearCart);
  }
  if (backdrop) {
    backdrop.addEventListener("click", function () {
      closeSheet();
    });
  }

  window.closeSheet = closeSheet;

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (bentoModal && bentoModal.classList.contains("is-open")) {
      closeBentoModal();
      return;
    }
    if (sheet && sheet.classList.contains("is-open")) closeSheet();
  });

  function toDateInputString(d) {
    var y = d.getFullYear();
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return y + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day;
  }

  var dateIn = document.getElementById("r-date");
  var hourIn = document.getElementById("r-hour");
  var minIn = document.getElementById("r-min");
  var dateHintEl = document.getElementById("r-date-hint");
  soldOutConflictEl = document.getElementById("r-soldout-conflict-submit");

  function updateDateConstraints() {
    if (!dateIn) return;
    var preferred = dateIn.value;
    if (dateIn.tagName === "SELECT") {
      rebuildDateOptions(preferred);
    } else {
      var earliest = getEarliestPickupDate();
      var latest = getLatestPickupDate();
      dateIn.min = toDateInputString(earliest);
      dateIn.max = toDateInputString(latest);
      if (preferred && !isValidPickupDate(preferred)) {
        var next = nextValidPickupDate(earliest);
        if (next) dateIn.value = toDateInputString(next);
      }
    }
    if (dateHintEl) {
      var scheduleHint = pickupScheduleHintForCart();
      var schedule = scheduleHint;
      if (hasBentoInCart()) {
        schedule = "お弁当を含むご注文は2日後以降。" + scheduleHint;
      } else if (hasSideDishInCart()) {
        schedule = "お惣菜・唐揚げを含むご注文は2日後以降。\n" + scheduleHint;
      }
      if (isTodayExtendedCloseDay()) {
        dateHintEl.textContent = PICKUP_TODAY_HOURS_NOTICE + "\n" + schedule;
      } else {
        dateHintEl.textContent = schedule;
      }
    }
    rebuildHourOptions(hourIn ? hourIn.value : "");
    updateSoldOutConflictUi();
    updatePickupTimeHint();
    updateSubmitButton();
  }

  window.validateReservePickupDate = function () {
    if (!dateIn || !dateIn.value) {
      alert("受取希望日を選んでください。");
      return false;
    }
    if (!isValidPickupDate(dateIn.value)) {
      alert(
        hasSideDishInCart()
          ? "お惣菜・唐揚げを含むご注文は2日後以降の受取日をお選びください。"
          : "受取希望日を選び直してください。"
      );
      updateDateConstraints();
      return false;
    }
    var pickupConflict = cartPickupConflictMessage(dateIn.value);
    if (pickupConflict) {
      alert(pickupConflict);
      updateSoldOutConflictUi();
      updateSubmitButton();
      return false;
    }
    if (!hourIn || !minIn) return true;
    if (!isValidPickupTime(dateIn.value, hourIn.value, minIn.value)) {
      var pick = pickupDateTime(dateIn.value, hourIn.value, minIn.value);
      var earliest = earliestPickupMomentForDate(dateIn.value);
      if (pick < earliest) {
        alert("受取希望時間は現在時刻以降をお選びください。");
      } else {
        alert(pickupTimeSelectHint(dateIn.value));
      }
      rebuildHourOptions(hourIn.value);
      return false;
    }
    return true;
  };

  if (dateIn && hourIn && minIn) {
    dateIn.addEventListener("change", function () {
      updateDateConstraints();
    });
    hourIn.addEventListener("change", function () {
      rebuildMinOptions();
    });

    dateIn.value = "";
    hourIn.value = "";
    minIn.value = "";
    updateDateConstraints();
    updateSoldOutConflictUi();
    updateSubmitButton();
  }

  if (window.MenuAvailability && MenuAvailability.isConfigured()) {
    showMenuLoading();
    MenuAvailability.loadAndApply(ITEM_MAP)
      .then(function () {
        bootMenuAndCart();
        MenuAvailability.watch(ITEM_MAP, function () {
          purgeUnavailableFromCart();
          renderMenu();
          sync();
        });
      })
      .catch(function () {
        bootMenuAndCart();
      });
  } else {
    bootMenuAndCart();
  }

  (function applyTodayHoursNotice() {
    if (!isTodayExtendedCloseDay()) return;
    var underTitle = document.getElementById("reserve-today-hours");
    if (underTitle) {
      underTitle.textContent = PICKUP_TODAY_HOURS_NOTICE;
      underTitle.hidden = false;
    }
    updatePickupTimeHint();
  })();

  (function showBulkLocalLink() {
    var el = document.getElementById("reserve-bulk-local-link");
    if (!el || !window.LiffEnv || !LiffEnv.isLocalDev()) return;
    el.hidden = false;
  })();

})();
