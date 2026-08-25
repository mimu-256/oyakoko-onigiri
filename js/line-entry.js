var LIFF_ID = "2010802590-KMkAidDs";

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

  liff
    .init({ liffId: LIFF_ID })
    .then(function () {
      if (!liff.isInClient()) {
        setStatus("LINEアプリから開いてください", { state: "error" });
        return;
      }

      setStatus("ログインを確認しています…", { state: "loading" });

      if (!liff.isLoggedIn()) {
        liff.login();
        return;
      }

      setStatus("ご予約ページへ移動します…", { state: "loading" });
      location.href = "/reserve";
    })
    .catch(function (err) {
      console.error(err);
      setStatus("うまく接続できませんでした", { state: "error" });
    });
})();
