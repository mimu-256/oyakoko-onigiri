window.LiffEnv = {
  isLocalDev: function () {
    var h = location.hostname;
    if (/^(localhost|127\.0\.0\.1)$/.test(h)) return true;
    /* 同一Wi-Fi の LAN プレビュー（firebase serve -o 0.0.0.0） */
    return /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h);
  },

  shouldSkipInit: function () {
    if (!this.isLocalDev()) return false;
    return !/[?&]liff=1(?:&|$)/.test(location.search);
  },
};
