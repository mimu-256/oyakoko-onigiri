(function () {
  function isLocalDev() {
    var h = location.hostname;
    if (/^(localhost|127\.0\.0\.1)$/.test(h)) return true;
    return /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h);
  }

  var ENTRY = "/line-entry";

  /** LIFF 本番パス or ローカル簡易サーバー向け .html 付きパス */
  function appPath(name) {
    if (window.LiffCore && typeof LiffCore.appPath === "function") {
      return LiffCore.appPath(name);
    }
    var base = String(name).replace(/^\//, "");
    if (isLocalDev()) {
      return /\.html$/i.test(base) ? "/" + base : "/" + base + ".html";
    }
    return ENTRY + "/" + base;
  }

  window.BulkLocal = {
    isLocalDev: isLocalDev,
    appPath: appPath,
  };

  if (isLocalDev()) {
    document.documentElement.classList.add("bulk-local-active");
  }
})();
