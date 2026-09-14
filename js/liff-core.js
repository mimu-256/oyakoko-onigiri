window.LiffCore = {
  LIFF_ID: "2010802590-KMkAidDs",
  ENTRY_PATH: "/line-entry",

  entryUrl: function () {
    return location.origin + this.ENTRY_PATH;
  },

  appPath: function (subpath) {
    var p = String(subpath || "").replace(/^\//, "");
    return this.ENTRY_PATH + "/" + p;
  },

  init: function () {
    return liff.init({ liffId: this.LIFF_ID });
  },

  login: function () {
    liff.login({ redirectUri: this.entryUrl() });
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
