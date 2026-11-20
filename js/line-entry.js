(function () {
  var statusEl = document.getElementById("entry-status");

  function setStatus(msg, opts) {
    if (window.LiffStatusUI) {
      LiffStatusUI.render(
        statusEl,
        Object.assign({ message: msg, minimal: true }, opts || {})
      );
      return;
    }
    if (statusEl) statusEl.textContent = msg;
  }

  if (window.LiffEnv && LiffEnv.shouldSkipInit()) {
    setStatus("LINEアプリから開いてください", { state: "error" });
    return;
  }

  if (!window.LiffCore || typeof liff === "undefined") {
    setStatus("うまく接続できませんでした", { state: "error" });
    return;
  }

  LiffCore.init()
    .then(function () {
      if (!liff.isInClient()) {
        setStatus("LINEアプリから開いてください", { state: "error" });
        return;
      }

      setStatus("ログインを確認しています…", { state: "loading" });

      if (!liff.isLoggedIn()) {
        LiffCore.login();
        return;
      }

      setStatus("ページへ移動します…", { state: "loading" });
      var dest = LiffCore.resolvePostLoginPath();
      try {
        var hashIdx = dest.indexOf("#");
        if (hashIdx !== -1) {
          var anchor = decodeURIComponent(dest.slice(hashIdx + 1));
          if (anchor) {
            sessionStorage.setItem("oyakoko_reserve_scroll_target_v1", anchor);
          }
        }
        var itemMatch = dest.match(/[?&]item=(m\d{3}|reserve-other)/);
        if (itemMatch) {
          sessionStorage.setItem("oyakoko_reserve_scroll_target_v1", itemMatch[1]);
        }
      } catch (e) {}
      location.replace(dest);
    })
    .catch(function (err) {
      console.error(err);
      setStatus(LiffCore.formatError(err), { state: "error" });
    });
})();
