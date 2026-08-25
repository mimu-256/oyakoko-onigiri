window.LiffStatusUI = (function () {
  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }

  function render(el, opts) {
    if (!el) return;
    opts = opts || {};
    var state = opts.state || "default";
    el.className = "liff-status liff-status--" + state;
    el.hidden = false;

    if (opts.minimal) {
      if (
        state === "loading" ||
        state === "sending" ||
        state === "success" ||
        state === "error"
      ) {
        el.innerHTML =
          '<span class="liff-status__msg">' +
          escapeHtml(
            opts.message ||
              (state === "loading" || state === "sending" ? "確認中…" : "")
          ) +
          "</span>";
        return;
      }
    }

    if (state === "logged-in" && opts.profile) {
      var pic = opts.profile.pictureUrl
        ? '<img src="' +
          escapeHtml(opts.profile.pictureUrl) +
          '" alt="" width="48" height="48" decoding="async">'
        : '<span class="liff-status__emoji" aria-hidden="true">🍙</span>';
      el.innerHTML =
        '<span class="liff-status__avatar">' +
        pic +
        "</span>" +
        '<span class="liff-status__text">' +
        '<span class="liff-status__hello">こんにちは</span>' +
        '<span class="liff-status__name">' +
        escapeHtml(opts.profile.displayName) +
        '<span class="liff-status__suffix">さん</span></span>' +
        '<span class="liff-status__sub">LINEでログイン中</span></span>';
      return;
    }

    if (state === "loading") {
      el.innerHTML =
        '<span class="liff-status__emoji liff-status__emoji--bounce" aria-hidden="true">🍙</span>' +
        '<span class="liff-status__text">' +
        '<span class="liff-status__msg">' +
        escapeHtml(opts.message || "確認中…") +
        "</span>" +
        '<span class="liff-status__dots" aria-hidden="true"><span></span><span></span><span></span></span></span>';
      return;
    }

    if (state === "success") {
      el.innerHTML =
        '<span class="liff-status__emoji" aria-hidden="true">✨</span>' +
        '<span class="liff-status__text"><span class="liff-status__msg">' +
        escapeHtml(opts.message) +
        "</span></span>";
      return;
    }

    if (state === "error") {
      el.innerHTML =
        '<span class="liff-status__emoji" aria-hidden="true">😢</span>' +
        '<span class="liff-status__text"><span class="liff-status__msg">' +
        escapeHtml(opts.message) +
        "</span></span>";
      return;
    }

    if (state === "sending") {
      el.innerHTML =
        '<span class="liff-status__emoji liff-status__emoji--bounce" aria-hidden="true">🍙</span>' +
        '<span class="liff-status__text"><span class="liff-status__msg">' +
        escapeHtml(opts.message || "送信中…") +
        "</span></span>";
      return;
    }

    el.textContent = opts.message || "";
  }

  return { render: render };
})();
