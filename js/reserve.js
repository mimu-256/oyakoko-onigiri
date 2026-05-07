(function () {
  var DUMMY = "images/dummy.png";

  var GROUPS = [
    {
      label: "期間・おすすめ",
      items: [
        { id: "m001", name: "春のしば漬け豚（4月限定）", price: 350 },
        { id: "m002", name: "うなぎ", price: 420 },
      ],
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
        { id: "m010", name: "イカの塩辛", price: 300 },
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
      ],
    },
  ];

  var cart = {};
  var ITEM_MAP = {};
  GROUPS.forEach(function (g) {
    g.items.forEach(function (it) {
      ITEM_MAP[it.id] = it;
    });
  });

  var root = document.getElementById("reserve-menu-root");
  var fab = document.getElementById("reserve-fab");
  var fabCount = document.getElementById("fab-count");
  var fabTotal = document.getElementById("fab-total");
  var sheet = document.getElementById("reserve-sheet");
  var backdrop = document.getElementById("sheet-backdrop");
  var cartLines = document.getElementById("cart-lines");
  var cartHeading = document.getElementById("cart-heading");
  var cartEmpty = document.getElementById("cart-empty");
  var subtotalWrap = document.getElementById("cart-subtotal-wrap");
  var subtotalEl = document.getElementById("cart-subtotal");
  var form = document.getElementById("reserve-form");
  var orderLinesInput = document.getElementById("order_lines");
  var fabOpen = document.getElementById("reserve-fab-open");
  var sheetClose = document.getElementById("sheet-close");
  var STORAGE = "oyakoko_reserve_cart_v1";

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
    return { count: count, sum: sum };
  }

  function saveCart() {
    try {
      localStorage.setItem(STORAGE, JSON.stringify(cart));
    } catch (e) {}
  }

  function loadCart() {
    try {
      var raw = localStorage.getItem(STORAGE);
      if (raw) {
        var o = JSON.parse(raw);
        if (o && typeof o === "object") cart = o;
      }
    } catch (e) {}
  }

  function getQty(id) {
    return cart[id] > 0 ? cart[id] : 0;
  }

  function setQty(id, q) {
    if (q <= 0) delete cart[id];
    else cart[id] = q;
    saveCart();
    sync();
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
    if (orderLinesInput) {
      orderLinesInput.value = buildOrderText();
    }
  }

  function buildOrderText() {
    var lines = [];
    Object.keys(cart).forEach(function (id) {
      var q = cart[id];
      if (q > 0) {
        var it = ITEM_MAP[id];
        lines.push(it.name + " ×" + q + "（" + money(it.price * q) + "）");
      }
    });
    if (!lines.length) return "（品目なし）";
    return lines.join("\n");
  }

  function getCartItemIds() {
    var inCart = Object.keys(cart).filter(function (id) {
      return cart[id] > 0 && ITEM_MAP[id];
    });
    var ordered = [];
    GROUPS.forEach(function (g) {
      g.items.forEach(function (it) {
        if (inCart.indexOf(it.id) !== -1) ordered.push(it.id);
      });
    });
    inCart.forEach(function (id) {
      if (ordered.indexOf(id) === -1) ordered.push(id);
    });
    return ordered;
  }

  function renderMenu() {
    if (!root) return;
    root.innerHTML = "";
    GROUPS.forEach(function (g) {
      var sec = document.createElement("section");
      sec.className = "reserve-group";
      sec.setAttribute("aria-label", g.label);
      var h2 = document.createElement("h2");
      h2.className = "reserve-group__title";
      h2.textContent = g.label;
      sec.appendChild(h2);
      var grid = document.createElement("div");
      grid.className = "reserve-grid";
      g.items.forEach(function (it) {
        grid.appendChild(buildCard(it));
      });
      sec.appendChild(grid);
      root.appendChild(sec);
    });
  }

  function buildCard(it) {
    var card = document.createElement("article");
    card.className = "reserve-card";
    card.setAttribute("data-id", it.id);
    var img = document.createElement("img");
    img.className = "reserve-card__img";
    img.src = DUMMY;
    img.width = 400;
    img.height = 300;
    img.alt = "";
    img.loading = "lazy";
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
      setQty(id, getQty(id) - 1);
    });
    btnP.addEventListener("click", function () {
      setQty(id, getQty(id) + 1);
    });
    step.appendChild(btnM);
    step.appendChild(qty);
    step.appendChild(btnP);
    body.appendChild(name);
    body.appendChild(price);
    body.appendChild(step);
    card.appendChild(img);
    card.appendChild(body);
    return card;
  }

  function renderCart() {
    if (!cartLines) return;
    var t = cartTotals();
    var has = t.count > 0;
    if (cartEmpty) cartEmpty.hidden = has;
    if (cartHeading) cartHeading.hidden = !has;
    if (subtotalWrap) subtotalWrap.hidden = !has;
    if (subtotalEl) subtotalEl.textContent = money(t.sum);
    cartLines.innerHTML = "";
    getCartItemIds().forEach(function (id) {
      var q = cart[id];
      if (q <= 0) return;
      var it = ITEM_MAP[id];
      var li = document.createElement("li");
      li.className = "reserve-line";
      var thumb = document.createElement("img");
      thumb.className = "reserve-line__thumb";
      thumb.src = DUMMY;
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
      unit.textContent = "単価 " + money(it.price) + " / 1個";
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
          setQty(pid, getQty(pid) - 1);
        });
        b2.addEventListener("click", function () {
          setQty(pid, getQty(pid) + 1);
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
    if (form) {
      var submit = form.querySelector('button[type="submit"]');
      if (submit) submit.disabled = !has;
    }
  }

  function openSheet() {
    if (!sheet || !backdrop) return;
    sheet.classList.add("is-open");
    backdrop.classList.add("is-open");
    document.body.classList.add("reserve-sheet-open");
    if (fabOpen) fabOpen.setAttribute("aria-expanded", "true");
    sheet.setAttribute("aria-hidden", "false");
    backdrop.setAttribute("aria-hidden", "false");
  }

  function closeSheet() {
    if (!sheet || !backdrop) return;
    sheet.classList.remove("is-open");
    backdrop.classList.remove("is-open");
    document.body.classList.remove("reserve-sheet-open");
    if (fabOpen) fabOpen.setAttribute("aria-expanded", "false");
    sheet.setAttribute("aria-hidden", "true");
    backdrop.setAttribute("aria-hidden", "true");
  }

  loadCart();
  renderMenu();
  sync();

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
  if (backdrop) {
    backdrop.addEventListener("click", function () {
      closeSheet();
    });
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && sheet && sheet.classList.contains("is-open")) closeSheet();
  });

  function toDateInputString(d) {
    var y = d.getFullYear();
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return y + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day;
  }

  var dateIn = document.getElementById("r-date");
  if (dateIn) {
    var start = new Date();
    start.setHours(0, 0, 0, 0);
    var end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    dateIn.min = toDateInputString(start);
    dateIn.max = toDateInputString(end);
  }
})();

