var LIFF_ID = "2010802590-KMkAidDs";

(function () {
  var ReserveBtn = document.getElementById("reserve-submit");

  function notifyError(msg) {
    if (msg) alert(msg);
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

        if (ReserveBtn) {
          ReserveBtn.disabled = false;
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
    if (ReserveBtn) ReserveBtn.disabled = false;
  } else {
    initLiff();
  }

  if (ReserveBtn) {
    ReserveBtn.addEventListener("click", function (event) {
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
      if (window.validateReservePickupDate && !window.validateReservePickupDate()) {
        return;
      }
      ReserveBtn.disabled = true;

      var reserveInfo = {
        name: document.getElementById("r-name").value,
        tel: document.getElementById("r-tel").value.trim(),
        date: document.getElementById("r-date").value,
        hour: document.getElementById("r-hour").value,
        min: document.getElementById("r-min").value,
        order: document.getElementById("order_lines").value,
        total: document.getElementById("cart-subtotal").textContent,
        count: (function () {
          var el = document.getElementById("cart-subtotal-count");
          if (el && el.textContent) {
            return el.textContent.replace(/[（）]/g, "").trim();
          }
          var fab = document.getElementById("fab-count");
          return fab ? fab.textContent.trim() : "";
        })(),
      };

      var messageText = window.LiffMessage
        ? LiffMessage.buildReserveMessage(reserveInfo)
        : [
            "【ご予約】",
            "お名前：" + reserveInfo.name,
            "日時：" + reserveInfo.date + " " + reserveInfo.hour + ":" + reserveInfo.min,
            "",
            "ご注文：\n" + reserveInfo.order,
            "小計：" + (reserveInfo.count ? reserveInfo.count + "点 " : "") + reserveInfo.total,
          ].join("\n");

      liff
        .sendMessages([
          {
            type: "text",
            text: messageText,
          },
        ])
        .then(function () {
          try {
            localStorage.removeItem("oyakoko_reserve_cart_v2");
            localStorage.removeItem("oyakoko_reserve_cart_v1");
          } catch (e) {}
          location.href = "/reserve-complete";
        })
        .catch(function (err) {
          console.error(err);
          notifyError("送信に失敗しました");
          ReserveBtn.disabled = false;
        });
    });
  }
})();
