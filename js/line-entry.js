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
      location.replace(LiffCore.resolvePostLoginPath());
    })
    .catch(function (err) {
      console.error(err);
      setStatus(LiffCore.formatError(err), { state: "error" });
    });
})();
