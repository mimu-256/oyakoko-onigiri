(function () {
  var submitBtn = document.getElementById("reserve-submit");
  var confirmModal = document.getElementById("bulk-confirm-modal");
  var confirmBackdrop = document.getElementById("bulk-confirm-backdrop");
  var confirmBody = document.getElementById("bulk-confirm-body");
  var confirmCancel = document.getElementById("bulk-confirm-cancel");
  var confirmSend = document.getElementById("bulk-confirm-send");
  var pendingInfo = null;

  function notifyError(msg) {
    if (msg) alert(msg);
  }

  function val(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : "";
  }

  function buildAddressText() {
    var lines = [];
    if (val("r-zip")) lines.push("〒" + val("r-zip"));
    lines.push(val("r-city") + val("r-street"));
    if (val("r-building")) lines.push(val("r-building"));
    if (val("r-delivery-note")) lines.push("配達メモ：" + val("r-delivery-note"));
    return lines.join("\n");
  }

  function collectOrderInfo() {
    return {
      name: val("r-name"),
      tel: val("r-tel"),
      delivery: true,
      address: buildAddressText(),
      date: val("r-date"),
      hour: val("r-hour"),
      min: val("r-min"),
      order: document.getElementById("order_lines")
        ? document.getElementById("order_lines").value
        : "",
      total: document.getElementById("cart-subtotal")
        ? document.getElementById("cart-subtotal").textContent
        : "",
      count: (function () {
        var el = document.getElementById("cart-subtotal-count");
        if (!el || !el.textContent) return "";
        return el.textContent.replace(/[（）]/g, "").trim();
      })(),
      note: val("r-note"),
    };
  }

  function buildMessage(info) {
    var lines = [
      "【配達予約】",
      "お名前：" + info.name,
    ];
    if (info.tel) {
      lines.push("電話：" + info.tel);
    }
    lines.push("配達先：\n" + info.address);
    lines.push(
      "希望日時：" +
        (window.LiffMessage
          ? LiffMessage.formatDateTime(info.date, info.hour, info.min)
          : info.date + " " + info.hour + ":" + info.min)
    );
    lines.push("");
    lines.push("ご注文：");
    if (info.order) {
      lines.push(info.order);
    }
    lines.push("");
    lines.push(
      window.LiffMessage
        ? LiffMessage.formatSubtotal(info.count, info.total, { taxIncluded: true })
        : "小計：" + (info.count ? info.count + "点 " : "") + info.total + "（税込）"
    );
    if (info.note) lines.push("備考：" + info.note);
    return lines.join("\n");
  }

  function validateBeforeSubmit() {
    var form = document.getElementById("reserve-form");
    if (form && !form.checkValidity()) {
      form.reportValidity();
      return false;
    }
    if (window.canSubmitBulkOrder && !window.canSubmitBulkOrder()) {
      alert("お惣菜5個以上、またはおにぎり20個以上でご注文ください。");
      return false;
    }
    if (window.validateBulkCheckout && !window.validateBulkCheckout()) {
      return false;
    }
    return true;
  }

  function openConfirmModal(info) {
    if (!confirmModal || !confirmBackdrop || !confirmBody) return;
    pendingInfo = info;
    confirmBody.textContent = buildMessage(info);
    confirmBackdrop.classList.add("is-open");
    confirmModal.classList.add("is-open");
    confirmBackdrop.setAttribute("aria-hidden", "false");
    confirmModal.setAttribute("aria-hidden", "false");
    document.documentElement.classList.add("bulk-confirm-open");
    document.body.classList.add("bulk-confirm-open");
    if (confirmSend) confirmSend.disabled = false;
    if (confirmSend) confirmSend.focus();
  }

  function closeConfirmModal() {
    if (!confirmModal || !confirmBackdrop) return;
    confirmBackdrop.classList.remove("is-open");
    confirmModal.classList.remove("is-open");
    confirmBackdrop.setAttribute("aria-hidden", "true");
    confirmModal.setAttribute("aria-hidden", "true");
    document.documentElement.classList.remove("bulk-confirm-open");
    document.body.classList.remove("bulk-confirm-open");
    pendingInfo = null;
  }

  function performSubmit(info) {
    if (confirmSend) confirmSend.disabled = true;
    if (submitBtn) submitBtn.disabled = true;

    var sendPromise = Promise.resolve();
    if (info.delivery && window.DeliverySchedule) {
      sendPromise = DeliverySchedule.refreshBookings().then(function () {
        if (!DeliverySchedule.isSlotAvailable(info.date, info.hour, info.min)) {
          alert("選んだ配達日時はすでに埋まりました。別の時間をお選びください。");
          throw new Error("slot unavailable");
        }
      });
    }

    sendPromise
      .then(function () {
        return liff.sendMessages([
          {
            type: "text",
            text: buildMessage(info),
          },
        ]);
      })
      .then(function () {
        if (info.delivery && window.DeliverySchedule) {
          return DeliverySchedule.bookSlot(info.date, info.hour, info.min, {
            tel: info.tel,
          }).catch(function (bookErr) {
            console.warn("配達枠の保存に失敗:", bookErr);
          });
        }
      })
      .then(function () {
        try {
          localStorage.removeItem("oyakoko_reserve_bulk_cart_v1");
        } catch (e) {}
        location.href = LiffCore.appPath("reserve-complete?bulk=1");
      })
      .catch(function (err) {
        if (err && err.message === "slot unavailable") {
          if (confirmSend) confirmSend.disabled = false;
          if (submitBtn) submitBtn.disabled = false;
          if (window.refreshBulkSubmitState) window.refreshBulkSubmitState();
          return;
        }
        console.error(err);
        notifyError("送信に失敗しました");
        if (confirmSend) confirmSend.disabled = false;
        if (submitBtn) submitBtn.disabled = false;
          if (window.refreshBulkSubmitState) window.refreshBulkSubmitState();
      });
  }

  /** 最初のページ（liff-bulk-entry.js）で控えたLINEのお名前を、先に入れておく */
  (function prefillCachedName() {
    try {
      var cached = sessionStorage.getItem("oyakoko_bulk_line_name_v1");
      var nameInput = document.getElementById("r-name");
      if (cached && nameInput && !nameInput.value) {
        nameInput.value = cached;
        nameInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
    } catch (e) {}
  })();

  function initLiff() {
    LiffCore.init()
      .then(function () {
        if (!liff.isInClient()) {
          alert("LINEアプリから開いてください");
          return;
        }

        if (!liff.isLoggedIn()) {
          LiffCore.login();
          return;
        }

        if (submitBtn) {
          submitBtn.disabled = false;
          if (window.refreshBulkSubmitState) window.refreshBulkSubmitState();
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
    if (submitBtn) submitBtn.disabled = false;
          if (window.refreshBulkSubmitState) window.refreshBulkSubmitState();
  } else if (window.LiffCore) {
    initLiff();
  }

  if (confirmCancel) {
    confirmCancel.addEventListener("click", closeConfirmModal);
  }
  if (confirmBackdrop) {
    confirmBackdrop.addEventListener("click", closeConfirmModal);
  }
  if (confirmModal) {
    confirmModal.addEventListener("click", function (e) {
      if (e.target === confirmModal) closeConfirmModal();
    });
    var confirmPanel = confirmModal.querySelector(".bulk-confirm-modal__panel");
    if (confirmPanel) {
      confirmPanel.addEventListener("click", function (e) {
        e.stopPropagation();
      });
    }
  }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && confirmModal && confirmModal.classList.contains("is-open")) {
      closeConfirmModal();
    }
  });

  if (confirmSend) {
    confirmSend.addEventListener("click", function () {
      if (!pendingInfo) return;
      if (window.LiffEnv && LiffEnv.shouldSkipInit()) {
        notifyError("ローカルでは送信できません。LINEアプリから開いてください。");
        return;
      }
      performSubmit(pendingInfo);
    });
  }

  if (submitBtn) {
    submitBtn.addEventListener("click", function () {
      if (!validateBeforeSubmit()) return;
      openConfirmModal(collectOrderInfo());
    });
  }
})();
