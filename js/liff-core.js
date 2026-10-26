window.LiffCore = {
  LIFF_ID: "2011941067-G1JIcyJa",
  ENTRY_PATH: "/line-entry",

  entryUrl: function () {
    return location.origin + this.ENTRY_PATH;
  },

  appPath: function (subpath) {
    var p = String(subpath || "").replace(/^\//, "");
    return this.ENTRY_PATH + "/" + p;
  },

  /** LINEトーク等で配る LIFF URL（Endpoint 直下のパス） */
  liffPageUrl: function (subpath) {
    var p = String(subpath || "").replace(/^\//, "");
    return "https://liff.line.me/" + this.LIFF_ID + "/" + p;
  },

  syncLineOnlyUi: function () {
    var show = false;
    if (window.LiffEnv && LiffEnv.shouldSkipInit()) {
      show = true;
    } else if (typeof liff !== "undefined" && liff.isInClient && liff.isInClient()) {
      show = true;
    }
    document.querySelectorAll("[data-line-client-only]").forEach(function (el) {
      el.hidden = !show;
    });
  },

  init: function () {
    return liff.init({ liffId: this.LIFF_ID });
  },

  login: function (options) {
    var uri =
      options && options.redirectUri ? String(options.redirectUri) : this.entryUrl();
    liff.login({ redirectUri: uri });
  },

  /** line-entry ログイン後の遷移先（/line-entry/ 以下のみ） */
  resolvePostLoginPath: function () {
    var params = new URLSearchParams(location.search);
    var next = params.get("next");
    if (next && next.charAt(0) === "/" && next.indexOf("/line-entry/") === 0 && next.indexOf("..") === -1) {
      return next;
    }
    var state = params.get("liff.state");
    if (state) {
      try {
        var dest = decodeURIComponent(state);
        if (dest.charAt(0) !== "/") dest = "/" + dest;
        if (dest.indexOf("/line-entry/") === 0 && dest.indexOf("..") === -1) return dest;
      } catch (e) {}
    }
    return this.appPath("reserve");
  },

  formatError: function (err) {
    if (!err) return "うまく接続できませんでした";
    var msg = err.message || String(err);
    if (/init|liff|endpoint|origin|permission/i.test(msg)) {
      return (
        "LIFFの接続に失敗しました。LINE Developers の Endpoint URL を「" +
        location.origin +
        "/」または「" +
        this.entryUrl() +
        "」に設定してください。"
      );
    }
    return "うまく接続できませんでした";
  },
};
