(function () {
  function isLocalDev() {
    var h = location.hostname;
    if (/^(localhost|127\.0\.0\.1)$/.test(h)) return true;
    return /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h);
  }

  if (!isLocalDev()) {
    location.replace("/line-entry/reserve");
    return;
  }

  document.documentElement.classList.add("bulk-local-active");
})();
