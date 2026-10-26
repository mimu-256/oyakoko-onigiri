window.ReserveOrderClient = (function () {
  var submitInFlight = false;

  function apiBase() {
    return window.ORDERS_API && ORDERS_API.baseUrl
      ? String(ORDERS_API.baseUrl).replace(/\/$/, "")
      : "";
  }

  function apiConfigured() {
    return !!apiBase();
  }

  function postJson(path, body) {
    var base = apiBase();
    if (!base) {
      return Promise.reject(new Error("orders_api_not_configured"));
    }
    return fetch(base + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) {
          var err = new Error(data.error || "request_failed");
          err.status = res.status;
          err.data = data;
          throw err;
        }
        return data;
      });
    });
  }

  function saveOrder(payload) {
    if (submitInFlight) {
      return Promise.reject(new Error("submit_in_flight"));
    }
    var cached = ReserveOrderIdempotency.getCachedSuccess(
      payload.idempotencyKey,
      payload.contentHash
    );
    if (cached) {
      return Promise.resolve({
        orderId: cached.orderId,
        reservationNumber: cached.reservationNumber,
        reused: true,
      });
    }
    submitInFlight = true;
    return postJson("/v1/orders", payload)
      .then(function (data) {
        ReserveOrderIdempotency.rememberSuccess(
          payload.idempotencyKey,
          payload.contentHash,
          data
        );
        return data;
      })
      .finally(function () {
        submitInFlight = false;
      });
  }

  function recordLineHandoff(orderId, idempotencyKey, status) {
    if (!apiConfigured()) return Promise.resolve();
    return postJson("/v1/orders/line-handoff", {
      orderId: orderId,
      idempotencyKey: idempotencyKey,
      status: status,
    }).catch(function () {
      return null;
    });
  }

  function errorMessage(err) {
    if (!err) return "予約の保存に失敗しました。";
    if (err.message === "orders_api_not_configured") {
      return "予約保存APIが未設定です。しばらくしてからお試しください。";
    }
    if (err.message === "submit_in_flight") {
      return "処理中です。少々お待ちください。";
    }
    if (err.message === "idempotency_conflict") {
      return "内容が変わったため、もう一度お試しください。";
    }
    if (err.message === "dashimaki_blocked_date") {
      return "10/17,18のお受け取りでは、だし巻き玉子のご予約をお休みしています。\n受取日を変更するか、カートから外してください。";
    }
    return "予約の保存に失敗しました。通信状況をご確認のうえ、もう一度お試しください。";
  }

  return {
    apiConfigured: apiConfigured,
    saveOrder: saveOrder,
    recordLineHandoff: recordLineHandoff,
    errorMessage: errorMessage,
  };
})();

window.ReserveSubmitFlow = (function () {
  var PENDING_KEY = "oyakoko_reserve_pending_submit_v1";

  function savePending(data) {
    try {
      sessionStorage.setItem(PENDING_KEY, JSON.stringify(data));
    } catch (e) {
      throw new Error("pending_storage_failed");
    }
  }

  function loadPending() {
    try {
      var raw = sessionStorage.getItem(PENDING_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function clearPending() {
    try {
      sessionStorage.removeItem(PENDING_KEY);
    } catch (e) {}
  }

  function buildReserveInfo(pending) {
    var fs = pending.formSnapshot;
    return {
      name: fs.name,
      tel: pending.tel || "",
      date: fs.date,
      hour: fs.hour,
      min: fs.min,
      order: pending.orderLines,
      count: pending.count,
      total: pending.total,
      note: fs.note,
    };
  }

  function submitErrorMessage(err) {
    if (window.ReserveOrderClient && ReserveOrderClient.errorMessage) {
      var msg = ReserveOrderClient.errorMessage(err);
      if (msg) return msg;
    }
    if (err && err.message === "pending_invalid") {
      return "送信データが見つかりません。予約画面からやり直してください。";
    }
    if (err && err.message === "line_client_required") {
      return "LINEアプリから開いてください。";
    }
    if (err && err.message === "line_login_required") {
      return "LINEにログインしてください。";
    }
    if (err && err.message === "pending_storage_failed") {
      return "ブラウザの保存領域に書き込めませんでした。もう一度お試しください。";
    }
    return "送信に失敗しました。通信状況をご確認のうえ、もう一度お試しください。";
  }

  function execute(pending) {
    if (!pending || !pending.orderSnapshot) {
      return Promise.reject(new Error("pending_invalid"));
    }
    if (!window.ReserveOrderClient || !ReserveOrderClient.apiConfigured()) {
      return Promise.reject(new Error("orders_api_not_configured"));
    }
    if (!window.ReserveOrderPayload) {
      return Promise.reject(new Error("payload_unavailable"));
    }
    if (typeof liff === "undefined" || !liff.isInClient()) {
      return Promise.reject(new Error("line_client_required"));
    }
    if (!liff.isLoggedIn()) {
      return Promise.reject(new Error("line_login_required"));
    }

    return ReserveOrderPayload.buildFromReserveOrder(pending.orderSnapshot)
      .then(function (payload) {
        return ReserveOrderClient.saveOrder(payload).then(function (saved) {
          return { payload: payload, saved: saved, pending: pending };
        });
      })
      .then(function (ctx) {
        var reserveInfo = buildReserveInfo(ctx.pending);
        var messageText = window.LiffMessage
          ? LiffMessage.buildReserveMessage(reserveInfo)
          : reserveInfo.order;

        return liff
          .sendMessages([{ type: "text", text: messageText }])
          .then(function () {
            return ReserveOrderClient.recordLineHandoff(
              ctx.saved.orderId,
              ctx.payload.idempotencyKey,
              "sent"
            ).then(function () {
              return ctx;
            });
          })
          .catch(function (lineErr) {
            return ReserveOrderClient.recordLineHandoff(
              ctx.saved.orderId,
              ctx.payload.idempotencyKey,
              "open_attempted"
            ).then(function () {
              throw lineErr;
            });
          });
      })
      .then(function () {
        try {
          localStorage.removeItem("oyakoko_reserve_cart_v2");
          localStorage.removeItem("oyakoko_reserve_cart_v1");
        } catch (e) {}
        if (window.ReserveOrderIdempotency) {
          ReserveOrderIdempotency.clearStoredSuccess();
        }
        clearPending();
      });
  }

  return {
    PENDING_KEY: PENDING_KEY,
    savePending: savePending,
    loadPending: loadPending,
    clearPending: clearPending,
    execute: execute,
    errorMessage: submitErrorMessage,
  };
})();
