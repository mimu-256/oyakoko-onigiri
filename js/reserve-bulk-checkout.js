(function () {
  var STORAGE = "oyakoko_reserve_bulk_cart_v1";
  var MIN_ONIGIRI_QTY = 20;
  var MIN_SIDE_DISH_QTY = 5;
  var SIDE_DISH_ITEM_ID = "m018";
  var ORDER_OTHER_ITEM_IDS = { m017: true, m018: true };

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE);
      var metaRaw = localStorage.getItem(STORAGE + "_meta");
      if (!raw || !metaRaw) return null;
      var cart = JSON.parse(raw);
      var meta = JSON.parse(metaRaw);
      if (!cart || !meta) return null;
      return { cart: cart, meta: meta };
    } catch (e) {
      return null;
    }
  }

  function onigiriQtyFromState(state) {
    var items = state.cart && state.cart.items ? state.cart.items : {};
    var n = 0;
    Object.keys(items).forEach(function (id) {
      var q = items[id];
      if (q > 0 && !ORDER_OTHER_ITEM_IDS[id]) n += q;
    });
    return n;
  }

  function sideDishQtyFromState(state) {
    var items = state.cart && state.cart.items ? state.cart.items : {};
    var q = items[SIDE_DISH_ITEM_ID];
    return q > 0 ? q : 0;
  }

  function canSubmitBulk() {
    var state = loadState();
    if (!state) return false;
    return (
      onigiriQtyFromState(state) >= MIN_ONIGIRI_QTY ||
      sideDishQtyFromState(state) >= MIN_SIDE_DISH_QTY
    );
  }

  function redirectIfInvalid() {
    if (!canSubmitBulk()) {
      window.location.href = window.BulkLocal
        ? BulkLocal.appPath("reserve-bulk")
        : "/reserve-bulk.html";
    }
  }

  redirectIfInvalid();

  (function fixBackLink() {
    var back = document.querySelector(".reserve-checkout-back a");
    if (back && window.BulkLocal) back.href = BulkLocal.appPath("reserve-bulk");
  })();

  var state = loadState();
  if (!state) return;

  var summaryEl = document.getElementById("checkout-summary");
  var subtotalEl = document.getElementById("cart-subtotal");
  var subtotalCountEl = document.getElementById("cart-subtotal-count");
  var orderLinesInput = document.getElementById("order_lines");

  function formatTotalCount(count) {
    return count > 0 ? "（" + count + "点）" : "";
  }

  function renderSummary(meta) {
    if (!summaryEl) return;
    summaryEl.innerHTML = "";
    var lines = meta.summaryLines;
    if (!lines || !lines.length) {
      var fallback = document.createElement("li");
      fallback.className = "reserve-checkout-line reserve-checkout-line--fallback";
      fallback.textContent = meta.orderText || "（品目なし）";
      summaryEl.appendChild(fallback);
      return;
    }
    lines.forEach(function (line) {
      var li = document.createElement("li");
      li.className = "reserve-checkout-line";
      var head = document.createElement("p");
      head.className = "reserve-checkout-line__name";
      head.textContent = line.name + " ×" + line.qty;
      li.appendChild(head);
      if (line.detail) {
        var detail = document.createElement("p");
        detail.className = "reserve-checkout-line__detail";
        detail.textContent = line.detail;
        li.appendChild(detail);
      }
      var price = document.createElement("p");
      price.className = "reserve-checkout-line__price";
      price.textContent = line.unit + " × " + line.qty;
      li.appendChild(price);
      summaryEl.appendChild(li);
    });
  }

  renderSummary(state.meta);
  if (subtotalEl) subtotalEl.textContent = state.meta.total;
  if (subtotalCountEl) subtotalCountEl.textContent = formatTotalCount(state.meta.count || 0);
  if (orderLinesInput) orderLinesInput.value = state.meta.orderText;

  function toDateInputString(d) {
    var y = d.getFullYear();
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return y + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day;
  }

  var dateIn = document.getElementById("r-date");
  var hourIn = document.getElementById("r-hour");
  var minIn = document.getElementById("r-min");
  var deliveryDatetimeWrap = document.getElementById("delivery-datetime-wrap");
  var deliverySlotSelected = document.getElementById("delivery-slot-selected");
  var addressWrap = document.getElementById("delivery-address-wrap");
  var deliverySlot = null;

  function clearDeliverySlot() {
    deliverySlot = null;
    if (deliverySlotSelected) {
      deliverySlotSelected.textContent = "";
      deliverySlotSelected.hidden = true;
    }
  }

  function applyDeliverySlot(slot) {
    deliverySlot = slot;
    if (dateIn) dateIn.value = slot.date;
    if (hourIn) hourIn.value = slot.hour;
    if (minIn) minIn.value = slot.min;
    if (deliverySlotSelected) {
      deliverySlotSelected.textContent = "選択中：" + slot.label;
      deliverySlotSelected.hidden = false;
    }
    updateSubmitState();
  }

  function setAddressFieldRequired(required) {
    if (!addressWrap) return;
    addressWrap.querySelectorAll("input, textarea").forEach(function (el) {
      if (el.id === "r-city") {
        el.required = false;
        return;
      }
      if (el.id === "r-building" || el.id === "r-delivery-note") {
        el.required = false;
        return;
      }
      el.required = required;
    });
  }

  if (addressWrap) addressWrap.hidden = false;
  if (deliveryDatetimeWrap) deliveryDatetimeWrap.hidden = false;
  setAddressFieldRequired(true);

  function initDeliveryPicker() {
    if (!window.DeliverySchedule || !window.DeliverySlotPicker) return;
    DeliverySlotPicker.initInline({
      gridId: "checkout-delivery-grid",
      monthId: "checkout-delivery-month",
      prevId: "checkout-delivery-prev",
      nextId: "checkout-delivery-next",
      current: deliverySlot,
      onSelect: applyDeliverySlot,
    });
  }

  function finishDeliveryPickerLoad() {
    if (window.DeliverySlotPicker && DeliverySlotPicker.activateSlots) {
      return DeliverySlotPicker.activateSlots();
    }
  }

  initDeliveryPicker();

  if (window.DeliverySchedule) {
    DeliverySchedule.load()
      .then(finishDeliveryPickerLoad)
      .catch(finishDeliveryPickerLoad);
  }

  function validateDeliverySlot() {
    if (deliverySlot && deliverySlot.date) return true;
    alert("配達日時を選んでください。");
    return false;
  }

  /** 必須項目（お名前・電話・郵便番号・番地・配達日時）が揃うまで確認ボタンを押せなくする */
  var checkoutForm = document.getElementById("reserve-submit")
    ? document.getElementById("reserve-submit").form
    : null;

  function updateSubmitState() {
    var btn = document.getElementById("reserve-submit");
    if (!btn) return;
    var missing = [];
    [["r-name", "お名前"], ["r-tel", "お電話番号"], ["r-zip", "郵便番号"], ["r-street", "番地"]].forEach(function (f) {
      var el = document.getElementById(f[0]);
      if (el && !el.checkValidity()) missing.push(f[1]);
    });
    if (!(deliverySlot && deliverySlot.date)) missing.push("配達日時");
    var ok = missing.length === 0 && (!checkoutForm || checkoutForm.checkValidity());
    btn.disabled = !ok;
    var note = document.getElementById("reserve-missing");
    if (note) {
      note.textContent = missing.length ? "未入力：" + missing.join("、") : "";
      note.hidden = missing.length === 0;
    }
  }

  if (checkoutForm) {
    checkoutForm.addEventListener("input", updateSubmitState);
    checkoutForm.addEventListener("change", updateSubmitState);
  }
  window.refreshBulkSubmitState = updateSubmitState;
  updateSubmitState();

  window.canSubmitBulkOrder = canSubmitBulk;
  window.validateBulkCheckout = validateDeliverySlot;
  window.getBulkDeliverySlot = function () {
    return deliverySlot;
  };
})();
