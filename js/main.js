(function () {
  var nav = document.getElementById("site-nav");
  var toggle = document.getElementById("nav-toggle");
  var backdrop = document.getElementById("nav-backdrop");
  if (!nav || !toggle) return;

  function isMobileNav() {
    return window.innerWidth < 980;
  }

  function syncNavAria() {
    if (!isMobileNav()) {
      nav.removeAttribute("aria-hidden");
      return;
    }
    nav.setAttribute("aria-hidden", nav.classList.contains("nav--open") ? "false" : "true");
  }

  function setNavOpen(open) {
    if (open) {
      nav.classList.add("nav--open");
      toggle.setAttribute("aria-expanded", "true");
      toggle.setAttribute("aria-label", "ナビゲーションを閉じる");
      document.body.classList.add("is-nav-open");
      if (backdrop) {
        backdrop.classList.add("nav-drawer-backdrop--visible");
        backdrop.setAttribute("aria-hidden", "false");
      }
    } else {
      nav.classList.remove("nav--open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "ナビゲーションを開く");
      document.body.classList.remove("is-nav-open");
      if (backdrop) {
        backdrop.classList.remove("nav-drawer-backdrop--visible");
        backdrop.setAttribute("aria-hidden", "true");
      }
    }
    syncNavAria();
  }

  toggle.addEventListener("click", function () {
    setNavOpen(!nav.classList.contains("nav--open"));
  });

  nav.querySelectorAll("a[href]").forEach(function (link) {
    link.addEventListener("click", function () {
      if (!isMobileNav()) return;
      setNavOpen(false);
    });
  });

  if (backdrop) {
    backdrop.addEventListener("click", function () {
      setNavOpen(false);
    });
  }

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape" || !nav.classList.contains("nav--open")) return;
    setNavOpen(false);
  });

  window.addEventListener(
    "resize",
    function () {
      if (!isMobileNav()) {
        setNavOpen(false);
      } else {
        syncNavAria();
      }
    },
    { passive: true }
  );

  syncNavAria();
})();
