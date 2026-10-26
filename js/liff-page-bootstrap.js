/**
 * ニュースなど「予約の手前」の LIFF ページ用。
 * LINEアプリ内のみ本文表示。LIFF 起動時のみ未ログインならログインへ。
 */
(function () {
  var gateEl = document.getElementById("news-liff-gate");
  var gateMsgEl = document.getElementById("news-liff-gate-msg");
  var contentEl = document.getElementById("news-liff-content");

  function setGate(msg, visible) {
    if (gateMsgEl && msg) gateMsgEl.textContent = msg;
    if (gateEl) gateEl.hidden = visible === false;
  }

  function showContent() {
    setGate("", false);
    if (contentEl) {
      contentEl.hidden = false;
      contentEl.removeAttribute("aria-hidden");
    }
  }

  function blockContent(msg) {
    if (contentEl) {
      contentEl.hidden = true;
      contentEl.setAttribute("aria-hidden", "true");
    }
    setGate(msg, true);
  }

  function openedFromLine() {
    if (typeof liff !== "undefined" && liff.isInClient && liff.isInClient()) return true;
    return window.LiffEnv && LiffEnv.isLineAppBrowser && LiffEnv.isLineAppBrowser();
  }

  if (window.LiffEnv && LiffEnv.shouldSkipInit()) {
    showContent();
    return;
  }

  var lineBrowserEarly =
    window.LiffEnv && LiffEnv.isLineAppBrowser && LiffEnv.isLineAppBrowser();

  if (lineBrowserEarly) {
    showContent();
  } else {
    blockContent("読み込んでいます…");
  }

  if (!window.LiffCore || typeof liff === "undefined") {
    if (!lineBrowserEarly) {
      blockContent("うまく接続できませんでした。LINEアプリから開き直してください。");
    }
    return;
  }

  LiffCore.init()
    .then(function () {
      if (!openedFromLine()) {
        blockContent(
          "このページはLINEアプリからのみご覧いただけます。トーク内のリンクからお開きください。"
        );
        return;
      }
      showContent();
      if (liff.isInClient() && !liff.isLoggedIn()) {
        var returnPath = location.pathname + location.search + location.hash;
        LiffCore.login({
          redirectUri: LiffCore.entryUrl() + "?next=" + encodeURIComponent(returnPath),
        });
      }
    })
    .catch(function (err) {
      console.error(err);
      if (!lineBrowserEarly) {
        blockContent(LiffCore.formatError(err));
      }
    });
})();
