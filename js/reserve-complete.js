(function () {
  var isBulk = /[?&]bulk=1(?:&|$)/.test(location.search);
  var titleEl = document.getElementById("complete-title");
  var closeBtn = document.getElementById("complete-close");

  if (isBulk && titleEl) {
    titleEl.textContent = "ご注文ありがとうございます！";
    document.title = "ご注文完了 - 親孝行おにぎり";
  }

  function closePage() {
    if (window.LiffEnv && LiffEnv.shouldSkipInit()) {
      location.href = isBulk
        ? window.LiffCore
          ? LiffCore.appPath("reserve-bulk")
          : "/reserve-bulk"
        : window.LiffCore
          ? LiffCore.appPath("reserve")
          : "/reserve";
      return;
    }
    if (typeof liff !== "undefined" && liff.closeWindow) {
      liff.closeWindow();
    }
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", closePage);
  }

  if (window.LiffEnv && LiffEnv.shouldSkipInit()) {
    return;
  }

  if (window.LiffCore) {
    LiffCore.init().catch(function (err) {
      console.error(err);
    });
  }
})();
