/**
 * 大口注文（配達）の最初のページ用。
 * LINEアプリ内で開いた時点でログインを済ませ、お名前を控えておく
 * （お届け情報の入力画面で、お名前がすぐ入るようにするため）。
 */
(function () {
  var NAME_KEY = "oyakoko_bulk_line_name_v1";

  if (window.LiffEnv && LiffEnv.shouldSkipInit()) return;
  if (!window.LiffCore || typeof liff === "undefined") return;

  LiffCore.init()
    .then(function () {
      if (!liff.isInClient()) return;
      if (!liff.isLoggedIn()) {
        LiffCore.login();
        return;
      }
      return liff.getProfile().then(function (profile) {
        if (!profile || !profile.displayName) return;
        try {
          sessionStorage.setItem(NAME_KEY, profile.displayName);
        } catch (e) {}
      });
    })
    .catch(function (err) {
      console.error(err);
    });
})();
