(function () {
  var STORAGE = "oyakoko_reserve_bulk_cart_v1";
  var MIN_ONIGIRI_QTY = 20;

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
      if (q > 0) n += q;
    });
    return n;
  }

  function canSubmitBulk() {
    var state = loadState();
    if (!state) return false;
    return onigiriQtyFromState(state) >= MIN_ONIGIRI_QTY;
  }

  function redirectIfInvalid() {
    if (!canSubmitBulk()) {
      window.location.href = window.LiffCore
        ? LiffCore.appPath("reserve-bulk")
        : "/reserve-bulk";
    }
  }

  redirectIfInvalid();

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
  var pickupDatetimeWrap = document.getElementById("pickup-datetime-wrap");
  var deliveryDatetimeWrap = document.getElementById("delivery-datetime-wrap");
  var deliverySlotOpenBtn = document.getElementById("delivery-slot-open");
  var deliverySlotSelected = document.getElementById("delivery-slot-selected");
  var addressWrap = document.getElementById("delivery-address-wrap");
  var deliverySlot = null;

  if (dateIn && hourIn && minIn) {
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var start = new Date(today);
    start.setDate(start.getDate() + 2);
    var end = new Date(today);
    end.setMonth(end.getMonth() + 1);
    dateIn.min = toDateInputString(start);
    dateIn.max = toDateInputString(end);
    dateIn.value = toDateInputString(start);
    hourIn.value = "10";
    minIn.value = "00";
  }

  function setPickupDatetimeRequired(required) {
    if (dateIn) dateIn.required = required;
    if (hourIn) hourIn.required = required;
    if (minIn) minIn.required = required;
  }

  function clearDeliverySlot() {
    deliverySlot = null;
    if (deliverySlotSelected) {
      deliverySlotSelected.textContent = "";
      deliverySlotSelected.hidden = true;
    }
    if (deliverySlotOpenBtn) {
      deliverySlotOpenBtn.textContent = "配達日時を選ぶ";
    }
  }

  function applyDeliverySlot(slot) {
    deliverySlot = slot;
    if (dateIn) dateIn.value = slot.date;
    if (hourIn) hourIn.value = slot.hour;
    if (minIn) minIn.value = slot.min;
    if (deliverySlotSelected) {
      deliverySlotSelected.textContent = slot.label;
      deliverySlotSelected.hidden = false;
    }
    if (deliverySlotOpenBtn) {
      deliverySlotOpenBtn.textContent = "配達日時を変更する";
    }
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

  function updateDeliveryFields() {
    var yesEl = document.getElementById("r-delivery-yes");
    var delivery = yesEl && yesEl.checked;
    if (addressWrap) addressWrap.hidden = !delivery;
    if (pickupDatetimeWrap) pickupDatetimeWrap.hidden = delivery;
    if (deliveryDatetimeWrap) deliveryDatetimeWrap.hidden = !delivery;
    setAddressFieldRequired(!!delivery);
    setPickupDatetimeRequired(!delivery);
    if (!delivery) {
      clearDeliverySlot();
      if (dateIn && !dateIn.value) {
        var start = window.DeliverySchedule
          ? DeliverySchedule.getMinDate()
          : null;
        if (start) dateIn.value = toDateInputString(start);
      }
      if (hourIn && !hourIn.value) hourIn.value = "10";
      if (minIn && !minIn.value) minIn.value = "00";
    } else {
      clearDeliverySlot();
      if (dateIn) dateIn.value = "";
      if (hourIn) hourIn.value = "";
      if (minIn) minIn.value = "";
    }
  }

  document.querySelectorAll('input[name="delivery_wanted"]').forEach(function (radio) {
    radio.addEventListener("change", updateDeliveryFields);
  });
  updateDeliveryFields();

  function initDeliveryPicker() {
    if (!window.DeliverySchedule || !window.DeliverySlotPicker) return;
    DeliverySlotPicker.init();
    if (deliverySlotOpenBtn) {
      deliverySlotOpenBtn.addEventListener("click", function () {
        DeliverySlotPicker.open(function (slot) {
          applyDeliverySlot(slot);
        }, deliverySlot);
      });
    }
  }

  if (window.DeliverySchedule) {
    DeliverySchedule.load()
      .then(initDeliveryPicker)
      .catch(function () {
        initDeliveryPicker();
      });
  }

  function deliveryWanted() {
    var yesEl = document.getElementById("r-delivery-yes");
    return yesEl && yesEl.checked;
  }

  function validateDeliverySlot() {
    if (!deliveryWanted()) return true;
    if (deliverySlot && deliverySlot.date) return true;
    alert("配達日時を選んでください。");
    return false;
  }

  window.canSubmitBulkOrder = canSubmitBulk;
  window.validateBulkCheckout = validateDeliverySlot;
  window.getBulkDeliverySlot = function () {
    return deliverySlot;
  };
})();
