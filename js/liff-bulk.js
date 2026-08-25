var LIFF_ID = "2010802590-KMkAidDs";

(function () {
  var submitBtn = document.getElementById("reserve-submit");

  function notifyError(msg) {
    if (msg) alert(msg);
  }

  function val(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : "";
  }

  function deliveryWanted() {
    var yes = document.getElementById("r-delivery-yes");
    return yes && yes.checked;
  }

  function buildAddressText() {
    if (!deliveryWanted()) return "（店舗受取）";
    var lines = [];
    if (val("r-zip")) lines.push("〒" + val("r-zip"));
    lines.push(val("r-city") + val("r-street"));
    if (val("r-building")) lines.push(val("r-building"));
    if (val("r-delivery-note")) lines.push("配達メモ：" + val("r-delivery-note"));
    return lines.join("\n");
  }

  function buildMessage(info) {
    var lines = [
      "【大口注文】",
      "お名前：" + info.name,
    ];
    if (info.tel) {
      lines.push("電話：" + info.tel);
    }
    lines.push("配達：" + (info.delivery ? "希望する" : "希望しない（店舗受取）"));
    if (info.delivery) {
      lines.push("配達先：\n" + info.address);
    }
    lines.push(
      "希望日時：" +
        (window.LiffMessage
          ? LiffMessage.formatDateTime(info.date, info.hour, info.min)
          : info.date + " " + info.hour + ":" + info.min),
      "",
      "ご注文：\n" + info.order,
      window.LiffMessage
        ? LiffMessage.formatSubtotal(info.count, info.total, { taxIncluded: true })
        : "小計：" + (info.count ? info.count + "点 " : "") + info.total + "（税込）"
    );
    if (info.note) lines.push("備考：" + info.note);
    lines.push("お支払い：配達時");
    return lines.join("\n");
  }

  function initLiff() {
    liff
      .init({ liffId: LIFF_ID })
      .then(function () {
        if (!liff.isInClient()) {
          alert("LINEアプリから開いてください");
          return;
        }

        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }

        if (submitBtn) {
          submitBtn.disabled = false;
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
        notifyError("うまく接続できませんでした");
      });
  }

  if (window.LiffEnv && LiffEnv.shouldSkipInit()) {
    if (submitBtn) submitBtn.disabled = false;
  } else {
    initLiff();
  }

  if (submitBtn) {
    submitBtn.addEventListener("click", function (event) {
      event.preventDefault();
      if (window.LiffEnv && LiffEnv.shouldSkipInit()) {
        notifyError("ローカルでは送信できません。LINEアプリから開いてください。");
        return;
      }
      var form = document.getElementById("reserve-form");
      if (form && !form.checkValidity()) {
        form.reportValidity();
        return;
      }
      if (window.canSubmitBulkOrder && !window.canSubmitBulkOrder()) {
        alert("お弁当は10箱以上ご注文ください。");
        return;
      }
      if (window.validateBulkCheckout && !window.validateBulkCheckout()) {
        return;
      }

      submitBtn.disabled = true;

      var info = {
        name: val("r-name"),
        tel: val("r-tel"),
        delivery: deliveryWanted(),
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
          location.href = "/reserve-complete?bulk=1";
        })
        .catch(function (err) {
          if (err && err.message === "slot unavailable") {
            submitBtn.disabled = false;
            return;
          }
          console.error(err);
          notifyError("送信に失敗しました");
          submitBtn.disabled = false;
        });
    });
  }
})();
