(function () {
  function isLocalDev() {
    var h = location.hostname;
    if (/^(localhost|127\.0\.0\.1)$/.test(h)) return true;
    return /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h);
  }

  /** LIFF 本番パス or ローカル簡易サーバー向け .html 付きパス */
  function appPath(name) {
    if (window.LiffCore && typeof LiffCore.appPath === "function") {
      return LiffCore.appPath(name);
    }
    var path = "/" + String(name).replace(/^\//, "");
    if (isLocalDev() && !/\.html$/i.test(path)) path += ".html";
    return path;
  }

  window.BulkLocal = {
    isLocalDev: isLocalDev,
    appPath: appPath,
  };

  if (!isLocalDev()) {
    location.replace("/line-entry/reserve");
    return;
  }

  document.documentElement.classList.add("bulk-local-active");
})();
