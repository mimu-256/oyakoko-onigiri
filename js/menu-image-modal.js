window.MenuImageModal = (function () {
  var backdrop = null;
  var modal = null;
  var frame = null;
  var viewport = null;
  var imgEl = null;
  var titleEl = null;
  var priceEl = null;
  var closeBtn = null;
  var btnPrev = null;
  var btnNext = null;
  var stepperWrap = null;
  var btnMinus = null;
  var btnPlus = null;
  var qtyEl = null;
  var scrollY = 0;
  var bound = false;
  var currentOpts = null;
  var currentItems = [];
  var currentIndex = 0;
  var animating = false;
  var touchStartX = 0;
  var touchStartY = 0;

  function ensureDom() {
    if (backdrop) return;

    backdrop = document.createElement("div");
    backdrop.className = "menu-image-modal-backdrop";
    backdrop.id = "menu-image-modal-backdrop";
    backdrop.setAttribute("aria-hidden", "true");

    modal = document.createElement("div");
    modal.className = "menu-image-modal";
    modal.id = "menu-image-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-hidden", "true");
    modal.setAttribute("aria-labelledby", "menu-image-modal-title");

    frame = document.createElement("div");
    frame.className = "menu-image-modal__frame";

    btnPrev = document.createElement("button");
    btnPrev.type = "button";
    btnPrev.className = "menu-image-modal__nav menu-image-modal__nav--prev";
    btnPrev.setAttribute("aria-label", "前のおにぎり");
    btnPrev.innerHTML = "&#8249;";

    btnNext = document.createElement("button");
    btnNext.type = "button";
    btnNext.className = "menu-image-modal__nav menu-image-modal__nav--next";
    btnNext.setAttribute("aria-label", "次のおにぎり");
    btnNext.innerHTML = "&#8250;";

    var panel = document.createElement("div");
    panel.className = "menu-image-modal__panel";

    closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "menu-image-modal__close";
    closeBtn.setAttribute("aria-label", "閉じる");
    closeBtn.textContent = "×";

    viewport = document.createElement("div");
    viewport.className = "menu-image-modal__viewport";

    imgEl = document.createElement("img");
    imgEl.className = "menu-image-modal__img";
    imgEl.alt = "";
    viewport.appendChild(imgEl);

    var meta = document.createElement("div");
    meta.className = "menu-image-modal__meta";

    titleEl = document.createElement("p");
    titleEl.className = "menu-image-modal__title";
    titleEl.id = "menu-image-modal-title";

    priceEl = document.createElement("p");
    priceEl.className = "menu-image-modal__price";

    stepperWrap = document.createElement("div");
    stepperWrap.className = "menu-image-modal__stepper reserve-stepper";
    stepperWrap.setAttribute("role", "group");
    stepperWrap.setAttribute("aria-label", "数量");

    btnMinus = document.createElement("button");
    btnMinus.type = "button";
    btnMinus.className = "reserve-stepper__btn menu-image-modal__stepper-btn";
    btnMinus.setAttribute("aria-label", "1つ減らす");
    btnMinus.textContent = "−";

    qtyEl = document.createElement("span");
    qtyEl.className = "reserve-card__qty menu-image-modal__qty";
    qtyEl.textContent = "0";

    btnPlus = document.createElement("button");
    btnPlus.type = "button";
    btnPlus.className = "reserve-stepper__btn menu-image-modal__stepper-btn";
    btnPlus.setAttribute("aria-label", "1つ足す");
    btnPlus.textContent = "+";

    stepperWrap.appendChild(btnMinus);
    stepperWrap.appendChild(qtyEl);
    stepperWrap.appendChild(btnPlus);

    meta.appendChild(titleEl);
    meta.appendChild(priceEl);
    meta.appendChild(stepperWrap);
    panel.appendChild(closeBtn);
    panel.appendChild(viewport);
    panel.appendChild(meta);
    frame.appendChild(btnPrev);
    frame.appendChild(panel);
    frame.appendChild(btnNext);
    modal.appendChild(frame);
    document.body.appendChild(backdrop);
    document.body.appendChild(modal);
  }

  function applyItem(item) {
    currentOpts = item;
    imgEl.src = item.src || "";
    imgEl.alt = item.title || "";
    titleEl.textContent = item.title || "";
    if (item.price) {
      priceEl.textContent = item.price;
      priceEl.hidden = false;
    } else {
      priceEl.textContent = "";
      priceEl.hidden = true;
    }
    if (item.getQty && item.setQty) {
      stepperWrap.hidden = false;
      stepperWrap.setAttribute("aria-label", (item.title || "商品") + "の数量");
      refreshQty();
    } else {
      stepperWrap.hidden = true;
    }
  }

  function refreshQty() {
    if (!stepperWrap || !currentOpts || !currentOpts.getQty) return;
    var q = currentOpts.getQty();
    qtyEl.textContent = String(q);
    btnMinus.disabled = q <= 0;
  }

  function updateNav() {
    var multi = currentItems.length > 1;
    btnPrev.hidden = !multi;
    btnNext.hidden = !multi;
    if (!multi) return;
    btnPrev.disabled = currentIndex <= 0;
    btnNext.disabled = currentIndex >= currentItems.length - 1;
  }

  function goTo(index, direction) {
    if (animating || index === currentIndex) return;
    if (index < 0 || index >= currentItems.length) return;

    if (!direction) {
      applyItem(currentItems[index]);
      currentIndex = index;
      updateNav();
      return;
    }

    animating = true;
    var outClass =
      direction > 0
        ? "menu-image-modal__img--out-left"
        : "menu-image-modal__img--out-right";
    var inClass =
      direction > 0
        ? "menu-image-modal__img--in-right"
        : "menu-image-modal__img--in-left";

    imgEl.classList.add(outClass);

    function onEnd(e) {
      if (e.propertyName !== "transform") return;
      imgEl.removeEventListener("transitionend", onEnd);
      applyItem(currentItems[index]);
      currentIndex = index;
      updateNav();
      imgEl.classList.remove(outClass);
      imgEl.classList.add(inClass);
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          imgEl.classList.remove(inClass);
          animating = false;
        });
      });
    }

    imgEl.addEventListener("transitionend", onEnd);
  }

  function goPrev() {
    goTo(currentIndex - 1, -1);
  }

  function goNext() {
    goTo(currentIndex + 1, 1);
  }

  function lockScroll() {
    scrollY = window.scrollY || window.pageYOffset;
    document.documentElement.classList.add("menu-image-modal-open");
    document.body.classList.add("menu-image-modal-open");
    document.body.style.top = "-" + scrollY + "px";
  }

  function unlockScroll() {
    document.documentElement.classList.remove("menu-image-modal-open");
    document.body.classList.remove("menu-image-modal-open");
    document.body.style.top = "";
    window.scrollTo(0, scrollY);
  }

  function close() {
    if (!backdrop || !modal) return;
    backdrop.classList.remove("is-open");
    modal.classList.remove("is-open");
    backdrop.setAttribute("aria-hidden", "true");
    modal.setAttribute("aria-hidden", "true");
    currentOpts = null;
    currentItems = [];
    currentIndex = 0;
    animating = false;
    imgEl.className = "menu-image-modal__img";
    unlockScroll();
  }

  function bindEvents() {
    if (bound) return;
    bound = true;
    backdrop.addEventListener("click", close);
    closeBtn.addEventListener("click", close);
    modal.addEventListener("click", function (e) {
      if (e.target === modal) close();
    });
    document.addEventListener("keydown", function (e) {
      if (!modal.classList.contains("is-open")) return;
      if (e.key === "Escape") {
        close();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    });
    btnPrev.addEventListener("click", function (e) {
      e.stopPropagation();
      goPrev();
    });
    btnNext.addEventListener("click", function (e) {
      e.stopPropagation();
      goNext();
    });
    btnMinus.addEventListener("click", function (e) {
      e.stopPropagation();
      if (!currentOpts || !currentOpts.setQty || !currentOpts.getQty) return;
      currentOpts.setQty(currentOpts.getQty() - 1);
      refreshQty();
    });
    btnPlus.addEventListener("click", function (e) {
      e.stopPropagation();
      if (!currentOpts || !currentOpts.setQty || !currentOpts.getQty) return;
      currentOpts.setQty(currentOpts.getQty() + 1);
      refreshQty();
    });
    viewport.addEventListener(
      "touchstart",
      function (e) {
        touchStartX = e.changedTouches[0].clientX;
        touchStartY = e.changedTouches[0].clientY;
      },
      { passive: true }
    );
    viewport.addEventListener(
      "touchend",
      function (e) {
        if (animating || currentItems.length <= 1) return;
        var dx = e.changedTouches[0].clientX - touchStartX;
        var dy = e.changedTouches[0].clientY - touchStartY;
        if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
        if (dx > 0) goPrev();
        else goNext();
      },
      { passive: true }
    );
  }

  function open(opts) {
    ensureDom();
    bindEvents();
    opts = opts || {};

    if (opts.items && opts.items.length) {
      currentItems = opts.items;
      currentIndex =
        typeof opts.index === "number" && opts.index >= 0
          ? Math.min(opts.index, opts.items.length - 1)
          : 0;
      applyItem(currentItems[currentIndex]);
      updateNav();
    } else {
      currentItems = opts.src ? [opts] : [];
      currentIndex = 0;
      applyItem(opts);
      updateNav();
    }

    lockScroll();
    backdrop.classList.add("is-open");
    modal.classList.add("is-open");
    backdrop.setAttribute("aria-hidden", "false");
    modal.setAttribute("aria-hidden", "false");
    closeBtn.focus();
  }

  return { open: open, close: close };
})();
