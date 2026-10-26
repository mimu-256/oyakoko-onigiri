(function () {
  var COLLECTION = "delivery_config";
  var DOC_ID = "default";

  var schedule = window.DeliverySchedule;
  var statusEl = document.getElementById("admin-status");
  var gridWrap = document.getElementById("delivery-admin-grid");
  var monthEl = document.getElementById("delivery-admin-month");
  var prevBtn = document.getElementById("delivery-admin-prev");
  var nextBtn = document.getElementById("delivery-admin-next");
  var weekStart = null;
  var saveTimer = null;
  var saving = false;

  function setStatus(msg, ok) {
    if (!statusEl) return;
    statusEl.hidden = !msg;
    statusEl.textContent = msg || "";
    statusEl.classList.toggle("delivery-admin__status--ok", !!ok);
  }

  function getDb() {
    if (typeof firebase === "undefined" || !window.FIREBASE_CONFIG || !FIREBASE_CONFIG.apiKey) return null;
    if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
    return firebase.firestore();
  }

  function addDays(d, n) {
    var next = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    next.setDate(next.getDate() + n);
    return next;
  }

  function dayClass(d) {
    var w = d.getDay();
    if (w === 0) return "delivery-slot-grid__day--sun";
    if (w === 6) return "delivery-slot-grid__day--sat";
    return "";
  }

  function buildPayload() {
    var cfg = schedule.getConfigSnapshot();
    if (!cfg) throw new Error("設定を読み込めていません");
    return cfg;
  }

  function pushLocalConfig() {
    var payload = buildPayload();
    schedule.applyRemoteConfig(payload);
  }

  function saveToFirestore() {
    var db = getDb();
    if (!db || !schedule) return Promise.resolve();
    var payload = buildPayload();
    payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    saving = true;
    setStatus("保存中…");
    return db
      .collection(COLLECTION)
      .doc(DOC_ID)
      .set(payload)
      .then(function () {
        setStatus("反映しました", true);
        window.setTimeout(function () {
          if (statusEl && statusEl.textContent === "反映しました") setStatus("");
        }, 2000);
      })
      .catch(function () {
        setStatus("保存に失敗しました（Firestore ルールを確認）");
      })
      .then(function () {
        saving = false;
      });
  }

  function queueSave() {
    pushLocalConfig();
    if (saveTimer) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(saveToFirestore, 450);
  }

  function setSlotOpen(key, open) {
    var cfg = schedule.getConfigSnapshot();
    if (!cfg) return;
    var list = cfg.closedSlotKeys.slice();
    var idx = list.indexOf(key);
    if (open && idx !== -1) list.splice(idx, 1);
    if (!open && idx === -1) list.push(key);
    cfg.closedSlotKeys = list;
    schedule.applyRemoteConfig(cfg);
    queueSave();
    renderGrid();
  }

  function setDayOpen(dateStr, open) {
    var cfg = schedule.getConfigSnapshot();
    if (!cfg) return;
    if (open) {
      cfg.closedDates = cfg.closedDates.filter(function (d) {
        return d !== dateStr;
      });
    } else if (cfg.closedDates.indexOf(dateStr) === -1) {
      cfg.closedDates.push(dateStr);
      cfg.closedDates.sort();
    }
    schedule.applyRemoteConfig(cfg);
    queueSave();
    renderGrid();
  }

  function isDayOpen(dateStr) {
    var cfg = schedule.getConfigSnapshot();
    if (!cfg) return true;
    return cfg.closedDates.indexOf(dateStr) === -1;
  }

  function renderGrid() {
    if (!gridWrap || !schedule || !weekStart) return;
    schedule.refreshBookings().then(function () {
      var grid = schedule.buildWeekGrid(weekStart);
      if (monthEl) monthEl.textContent = schedule.formatMonthLabel(grid.dates);
      if (prevBtn) prevBtn.disabled = !schedule.canGoPrevWeek(weekStart);
      if (nextBtn) nextBtn.disabled = !schedule.canGoNextWeek(weekStart);

      gridWrap.innerHTML = "";
      var table = document.createElement("table");
      table.className = "delivery-slot-grid";
      table.setAttribute("role", "grid");
      table.setAttribute("aria-label", "配達枠");

      var thead = document.createElement("thead");
      var headRow = document.createElement("tr");
      var corner = document.createElement("th");
      corner.scope = "col";
      corner.className = "delivery-slot-grid__corner";
      headRow.appendChild(corner);

      grid.dates.forEach(function (d) {
        var ds = schedule.toDateString(d);
        var th = document.createElement("th");
        th.scope = "col";
        th.className = "delivery-slot-grid__day " + dayClass(d);
        th.innerHTML =
          '<span class="delivery-slot-grid__day-num">' +
          d.getDate() +
          '</span><span class="delivery-slot-grid__day-w">' +
          schedule.weekdays[d.getDay()] +
          "</span>";
        var dayToggle = document.createElement("label");
        dayToggle.className = "delivery-admin__day-toggle";
        var dayCb = document.createElement("input");
        dayCb.type = "checkbox";
        dayCb.checked = isDayOpen(ds);
        dayCb.title = "この日の配達";
        dayCb.addEventListener("change", function () {
          setDayOpen(ds, dayCb.checked);
        });
        dayToggle.appendChild(dayCb);
        dayToggle.appendChild(document.createTextNode("配達"));
        th.appendChild(dayToggle);
        headRow.appendChild(th);
      });
      thead.appendChild(headRow);
      table.appendChild(thead);

      var tbody = document.createElement("tbody");
      grid.rows.forEach(function (row) {
        var tr = document.createElement("tr");
        var timeTh = document.createElement("th");
        timeTh.scope = "row";
        timeTh.className = "delivery-slot-grid__time";
        timeTh.textContent = row.label;
        tr.appendChild(timeTh);

        row.cells.forEach(function (cell) {
          var td = document.createElement("td");
          td.className = "delivery-slot-grid__cell";
          if (cell.status === "blocked") {
            var blocked = document.createElement("span");
            blocked.className = "delivery-slot-grid__slot delivery-slot-grid__slot--blocked";
            blocked.textContent = "×";
            blocked.title = "予約済み";
            td.appendChild(blocked);
          } else if (cell.status === "closed") {
            var closed = document.createElement("span");
            closed.className = "delivery-slot-grid__slot delivery-slot-grid__slot--closed";
            closed.textContent = "—";
            td.appendChild(closed);
          } else {
            var label = document.createElement("label");
            label.className = "delivery-admin__slot-check";
            var cb = document.createElement("input");
            cb.type = "checkbox";
            cb.checked = cell.status === "open";
            cb.setAttribute(
              "aria-label",
              schedule.formatSlotLabel(cell.date, cell.hour, cell.min)
            );
            cb.addEventListener("change", function () {
              setSlotOpen(cell.key, cb.checked);
            });
            label.appendChild(cb);
            var mark = document.createElement("span");
            mark.className = "delivery-admin__slot-mark";
            mark.textContent = cb.checked ? "○" : "×";
            mark.setAttribute("aria-hidden", "true");
            cb.addEventListener("change", function () {
              mark.textContent = cb.checked ? "○" : "×";
            });
            label.appendChild(mark);
            td.appendChild(label);
          }
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      gridWrap.appendChild(table);
    });
  }

  function bindNav() {
    if (prevBtn) {
      prevBtn.addEventListener("click", function () {
        weekStart = addDays(weekStart, -7);
        renderGrid();
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", function () {
        weekStart = addDays(weekStart, 7);
        renderGrid();
      });
    }
  }

  function init() {
    if (!schedule) {
      setStatus("配達モジュールを読み込めませんでした。");
      return;
    }
    bindNav();
    schedule
      .load()
      .then(function () {
        weekStart = schedule.startOfWeekContaining(schedule.getMinDate());
        renderGrid();
        setStatus("");
      })
      .catch(function () {
        setStatus("読み込みに失敗しました。");
      });

    window.addEventListener("delivery-config-updated", function () {
      if (saving) return;
      renderGrid();
    });
  }

  init();
})();
