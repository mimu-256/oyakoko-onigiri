window.LiffEnv = {
  isLocalDev: function () {
    return /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  },

  shouldSkipInit: function () {
    if (!this.isLocalDev()) return false;
    return !/[?&]liff=1(?:&|$)/.test(location.search);
  },
};
