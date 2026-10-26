(function () {
  var ReserveBtn = document.getElementById("reserve-submit");

  function notifyError(msg) {
    if (msg) alert(msg);
  }

  function initLiff() {
    LiffCore.init()
      .then(function () {
        LiffCore.syncLineOnlyUi();
        if (!liff.isInClient()) {
          alert("LINEアプリから開いてください");
          return;
        }

        if (!liff.isLoggedIn()) {
          LiffCore.login();
          return;
        }

        return liff.getProfile();
      })
      .then(function (profile) {
        if (!profile) return;
        var nameInput = document.getElementById("r-name");
        if (nameInput && !nameInput.value) {
          nameInput.value = profile.displayName;
        }
      })
      .catch(function (err) {
        console.error(err);
        notifyError(LiffCore.formatError(err));
      });
  }

  if (window.LiffEnv && LiffEnv.shouldSkipInit()) {
    if (window.LiffCore) LiffCore.syncLineOnlyUi();
  } else if (window.LiffCore) {
    initLiff();
  }

  if (ReserveBtn) {
    ReserveBtn.addEventListener("click", function (event) {
      event.preventDefault();
      if (window.LiffEnv && LiffEnv.shouldSkipInit()) {
        notifyError("ローカルでは送信できません。LINEアプリから開いてください。");
        return;
      }
      var fabCount = document.getElementById("fab-count");
      if (fabCount && (parseInt(fabCount.textContent, 10) || 0) <= 0) {
        notifyError("カートが空です。商品を追加してください。");
        return;
      }
      var form = document.getElementById("reserve-form");
      if (form && !form.checkValidity()) {
        form.reportValidity();
        return;
      }
      if (window.validateReservePickupDate && !window.validateReservePickupDate()) {
        return;
      }
      if (!window.ReserveOrderClient) {
        notifyError("予約ページの読み込みが完了していません。一度閉じて開き直してください。");
        return;
      }
      if (!ReserveOrderClient.apiConfigured()) {
        notifyError(ReserveOrderClient.errorMessage({ message: "orders_api_not_configured" }));
        return;
      }
      if (!window.ReserveOrder || !window.ReserveOrderPayload) {
        notifyError("予約ページの読み込みが完了していません。一度閉じて開き直してください。");
        return;
      }
      if (!window.ReserveSubmitFlow) {
        notifyError("予約ページの読み込みが完了していません。一度閉じて開き直してください。");
        return;
      }

      ReserveBtn.disabled = true;

      var noteEl = document.getElementById("r-note");
      var formSnapshot = {
        name: document.getElementById("r-name").value,
        date: document.getElementById("r-date").value,
        hour: document.getElementById("r-hour").value,
        min: document.getElementById("r-min").value,
        note: noteEl ? noteEl.value.trim() : "",
      };

      var orderSnapshot = ReserveOrder.buildReserveOrderSnapshot(formSnapshot);
      var countText = (function () {
        var el = document.getElementById("cart-subtotal-count");
        if (el && el.textContent) {
          return el.textContent.replace(/[（）]/g, "").trim();
        }
        var fab = document.getElementById("fab-count");
        return fab ? fab.textContent.trim() : "";
      })();

      try {
        ReserveSubmitFlow.savePending({
          formSnapshot: formSnapshot,
          orderSnapshot: orderSnapshot,
          tel: document.getElementById("r-tel").value.trim(),
          orderLines: document.getElementById("order_lines").value,
          count: countText,
          total: document.getElementById("cart-subtotal").textContent,
        });
      } catch (err) {
        console.error(err);
        notifyError(ReserveSubmitFlow.errorMessage(err));
        if (window.updateReserveSubmitState) {
          window.updateReserveSubmitState();
        } else {
          ReserveBtn.disabled = false;
        }
        return;
      }

      location.href = LiffCore.appPath("reserve-complete") + "?submitting=1";
    });
  }
})();
