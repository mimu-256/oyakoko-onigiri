/**
 * アプリ内の確認ダイアログ。
 * ブラウザ標準の confirm() は上部にサイトのURLが出てしまうため、自前で表示する。
 * 使い方: AppDialog.confirm("メッセージ", function () { ...OK時の処理... });
 */
(function () {
  var root = null;

  function build() {
    root = document.createElement("div");
    root.className = "app-dialog";
    root.hidden = true;
    root.innerHTML =
      '<div class="app-dialog__backdrop"></div>' +
      '<div class="app-dialog__panel" role="alertdialog" aria-modal="true">' +
      '<p class="app-dialog__text"></p>' +
      '<div class="app-dialog__actions">' +
      '<button type="button" class="app-dialog__btn app-dialog__btn--cancel">キャンセル</button>' +
      '<button type="button" class="app-dialog__btn app-dialog__btn--ok">OK</button>' +
      "</div></div>";
    document.body.appendChild(root);
  }

  function confirmDialog(message, onOk) {
    if (!root) build();
    var text = root.querySelector(".app-dialog__text");
    var ok = root.querySelector(".app-dialog__btn--ok");
    var cancel = root.querySelector(".app-dialog__btn--cancel");
    var backdrop = root.querySelector(".app-dialog__backdrop");
    text.textContent = message;
    root.hidden = false;

    function close() {
      root.hidden = true;
      ok.removeEventListener("click", onOkClick);
      cancel.removeEventListener("click", close);
      backdrop.removeEventListener("click", close);
    }
    function onOkClick() {
      close();
      if (onOk) onOk();
    }
    ok.addEventListener("click", onOkClick);
    cancel.addEventListener("click", close);
    backdrop.addEventListener("click", close);
    cancel.focus();
  }

  window.AppDialog = { confirm: confirmDialog };
})();
