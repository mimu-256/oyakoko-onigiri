(function () {
  var path = location.pathname;
  if (path !== "/" && path !== "/index.html") return;
  if (window.LiffEnv && LiffEnv.shouldSkipInit()) return;
  if (!window.LiffCore || typeof liff === "undefined") return;

  LiffCore.init()
    .then(function () {
      if (!liff.isInClient()) return;
      location.replace(LiffCore.entryUrl() + location.search + location.hash);
    })
    .catch(function (err) {
      console.error(err);
    });
})();
