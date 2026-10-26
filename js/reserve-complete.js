(function () {
  var isBulk = /[?&]bulk=1(?:&|$)/.test(location.search);
  var isSubmittingRoute = /[?&]submitting=1(?:&|$)/.test(location.search);
  var isLocalPreview =
    window.LiffEnv && LiffEnv.isLocalDev() && /[?&]preview=/.test(location.search);
  var isPreviewSending =
    isLocalPreview && /[?&]preview=sending(?:&|$)/.test(location.search);
  var isPreviewSuccess =
    isLocalPreview && /[?&]preview=success(?:&|$)/.test(location.search);

  var titleEl = document.getElementById("complete-title");
  var leadEl = document.getElementById("complete-lead");
  var leadA = document.getElementById("complete-lead-a");
  var leadB = document.getElementById("complete-lead-b");
  var spinnerEl = document.getElementById("complete-spinner");
  var errorEl = document.getElementById("complete-error");
  var closeBtn = document.getElementById("complete-close");
  var retryBtn = document.getElementById("complete-retry");
  var backBtn = document.getElementById("complete-back");
  var footerEl = document.getElementById("complete-footer");

  var submitRunning = false;

  if (isBulk && titleEl) {
    titleEl.textContent = "ご注文ありがとうございます！";
    document.title = "ご注文完了 - 親孝行おにぎり";
  }

  function reservePath() {
    return window.LiffCore ? LiffCore.appPath("reserve") : "/line-entry/reserve";
  }

  function completePath() {
    return window.LiffCore ? LiffCore.appPath("reserve-complete") : "/line-entry/reserve-complete";
  }

  function closePage() {
    if (window.LiffEnv && LiffEnv.shouldSkipInit()) {
      location.href = reservePath();
      return;
    }
    if (typeof liff !== "undefined" && liff.closeWindow) {
      liff.closeWindow();
    }
  }

  function setLead(lines) {
    if (!leadA || !leadB) return;
    leadA.textContent = lines[0] || "";
    leadB.textContent = lines[1] || "";
    if (leadB) {
      leadB.hidden = !lines[1];
    }
    if (leadEl) leadEl.hidden = !lines[0] && !lines[1];
  }

  function showSendingUi() {
    if (spinnerEl) {
      spinnerEl.hidden = false;
      spinnerEl.setAttribute("aria-hidden", "false");
    }
    if (titleEl) titleEl.textContent = "送信中です";
    document.title = "送信中 - 親孝行おにぎり";
    setLead(["予約内容を保存し、", "LINEトークへお送りしています。"]);
    if (errorEl) {
      errorEl.hidden = true;
      errorEl.textContent = "";
    }
    if (retryBtn) retryBtn.hidden = true;
    if (backBtn) backBtn.hidden = true;
    if (closeBtn) {
      closeBtn.hidden = false;
      closeBtn.disabled = true;
      closeBtn.textContent = "送信中…";
    }
    if (footerEl) footerEl.classList.remove("line-entry__footer--error");
  }

  function showSuccessUi() {
    if (spinnerEl) {
      spinnerEl.hidden = true;
      spinnerEl.setAttribute("aria-hidden", "true");
    }
    if (titleEl) {
      titleEl.textContent = isBulk ? "ご注文ありがとうございます！" : "ご予約ありがとうございます！";
    }
    document.title = isBulk ? "ご注文完了 - 親孝行おにぎり" : "ご予約完了 - 親孝行おにぎり";
    setLead(["LINEトークに内容をお送りしました。", "トークをご確認ください。"]);
    if (errorEl) {
      errorEl.hidden = true;
      errorEl.textContent = "";
    }
    if (retryBtn) retryBtn.hidden = true;
    if (backBtn) backBtn.hidden = true;
    if (closeBtn) {
      closeBtn.hidden = false;
      closeBtn.disabled = false;
      closeBtn.textContent = "閉じる";
    }
    if (footerEl) footerEl.classList.remove("line-entry__footer--error");
    try {
      history.replaceState(null, "", completePath() + (isBulk ? "?bulk=1" : ""));
    } catch (e) {}
  }

  function showErrorUi(message) {
    if (spinnerEl) {
      spinnerEl.hidden = true;
      spinnerEl.setAttribute("aria-hidden", "true");
    }
    if (titleEl) titleEl.textContent = "送信できませんでした";
    document.title = "送信エラー - 親孝行おにぎり";
    setLead(["通信状況をご確認ください。", ""]);
    if (errorEl) {
      errorEl.hidden = false;
      errorEl.textContent = message || "送信に失敗しました。";
    }
    if (retryBtn) retryBtn.hidden = false;
    if (backBtn) backBtn.hidden = false;
    if (closeBtn) closeBtn.hidden = true;
    if (footerEl) footerEl.classList.add("line-entry__footer--error");
  }

  function runSubmitFromPending() {
    if (submitRunning) return;
    if (!window.ReserveSubmitFlow) {
      showErrorUi("送信の準備ができていません。");
      return;
    }
    var pending = ReserveSubmitFlow.loadPending();
    if (!pending) {
      showErrorUi(ReserveSubmitFlow.errorMessage({ message: "pending_invalid" }));
      return;
    }

    submitRunning = true;
    showSendingUi();
    if (retryBtn) retryBtn.disabled = true;

    function initThenSubmit() {
      return LiffCore.init()
        .then(function () {
          if (!liff.isInClient()) {
            throw new Error("line_client_required");
          }
          if (!liff.isLoggedIn()) {
            LiffCore.login();
            throw new Error("line_login_pending");
          }
          return ReserveSubmitFlow.execute(pending);
        })
        .then(function () {
          showSuccessUi();
        })
        .catch(function (err) {
          if (err && err.message === "line_login_pending") return;
          console.error(err);
          showErrorUi(ReserveSubmitFlow.errorMessage(err));
        })
        .finally(function () {
          submitRunning = false;
          if (retryBtn) retryBtn.disabled = false;
        });
    }

    if (window.LiffEnv && LiffEnv.shouldSkipInit()) {
      showErrorUi("ローカルでは送信完了フローを実行できません。LINEアプリからお試しください。");
      submitRunning = false;
      return;
    }

    if (!window.LiffCore) {
      showErrorUi("LINEの初期化に失敗しました。");
      submitRunning = false;
      return;
    }

    initThenSubmit();
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", function () {
      if (closeBtn.disabled) return;
      closePage();
    });
  }

  if (retryBtn) {
    retryBtn.addEventListener("click", function () {
      runSubmitFromPending();
    });
  }

  if (backBtn) {
    backBtn.addEventListener("click", function () {
      location.href = reservePath();
    });
  }

  if (isPreviewSuccess && !isBulk) {
    showSuccessUi();
    return;
  }

  if (isPreviewSending && !isBulk) {
    showSendingUi();
    return;
  }

  if (isSubmittingRoute && !isBulk) {
    runSubmitFromPending();
    return;
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
