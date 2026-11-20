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

  /** 予約ページへ（商品 m*** は ?item=、セクションは #） */
  reserveScrollHref: function (anchor) {
    var a = String(anchor || "").replace(/^#/, "").trim();
    if (!a) return this.appPath("reserve");
    if (a === "reserve-other") return this.appPath("reserve") + "#" + a;
    if (/^m\d{3}$/.test(a)) {
      return this.appPath("reserve") + "?item=" + encodeURIComponent(a);
    }
    return this.appPath("reserve") + "#" + a;
  },

  /**
   * 公式LINEトーク用 LIFF URL（line-entry 経由で next に hash を載せる）
   * お惣菜お知らせの「さっそく注文する」と同じスクロール挙動
   */
  reserveLiffUrl: function (anchor) {
    var dest = this.reserveScrollHref(anchor);
    return this.liffPageUrl(
      "line-entry?next=" + encodeURIComponent(dest)
    );
  },

  /** 公式LINE用：豚汁（m021）までスクロール */
  tonjiruReserveLiffUrl: function () {
    return this.liffPageUrl(this.reserveScrollHref("m021"));
  },

  currentReturnPath: function () {
    return location.pathname + location.search + location.hash;
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
    var uri;
    if (options && options.redirectUri) {
      uri = String(options.redirectUri);
    } else {
      var next = this.currentReturnPath();
      if (next.indexOf("/line-entry/") === 0) {
        uri =
          location.origin +
          this.ENTRY_PATH +
          "?next=" +
          encodeURIComponent(next);
      } else {
        uri = this.entryUrl();
      }
    }
    liff.login({ redirectUri: uri });
  },

  /** line-entry ログイン後の遷移先（/line-entry/ 以下のみ） */
  resolvePostLoginPath: function () {
    var params = new URLSearchParams(location.search);
    var next = params.get("next");
    if (next && next.charAt(0) === "/" && next.indexOf("/line-entry/") === 0 && next.indexOf("..") === -1) {
      if (next.indexOf("#") === -1) next += location.hash || "";
      return next;
    }
    var state = params.get("liff.state");
    if (state) {
      try {
        var dest = decodeURIComponent(state);
        if (dest.charAt(0) !== "/") dest = "/" + dest;
        if (dest.indexOf("/line-entry/") === 0 && dest.indexOf("..") === -1) {
          return dest + (location.hash || "");
        }
      } catch (e) {}
    }
    var item = params.get("item");
    if (item && /^m\d{3}$/.test(item)) {
      return this.appPath("reserve") + "?item=" + encodeURIComponent(item);
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
