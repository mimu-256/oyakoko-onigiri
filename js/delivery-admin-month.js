(function () {
  var schedule = window.DeliverySchedule;
  var gridEl = document.getElementById("delivery-month-grid");
  var labelEl = document.getElementById("delivery-month-label");
  var prevBtn = document.getElementById("delivery-month-prev");
  var nextBtn = document.getElementById("delivery-month-next");
  if (!schedule || !gridEl) return;

  var MONTHS_AHEAD = 12;
  var viewMonth = null; // その月の1日

  function monthStart(d) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  function addMonths(d, n) {
    return new Date(d.getFullYear(), d.getMonth() + n, 1);
  }

  function render() {
    var api = window.DeliveryAdminApi;
    if (!viewMonth || !api) return;
    // 管理画面は先の分まで確認・設定できるよう、受付期間に関係なく「今日以降〜12か月先」を対象にする
    var min = new Date();
    min = new Date(min.getFullYear(), min.getMonth(), min.getDate());
    var max = addMonths(monthStart(min), MONTHS_AHEAD + 1);
    max.setDate(0);
    labelEl.textContent = viewMonth.getFullYear() + "年" + (viewMonth.getMonth() + 1) + "月";
    prevBtn.disabled = viewMonth <= monthStart(min);
    nextBtn.disabled = addMonths(viewMonth, 1) > max;

    var table = document.createElement("table");
    table.className = "delivery-month-grid";
    var head = document.createElement("tr");
    schedule.weekdays.forEach(function (w, i) {
      var th = document.createElement("th");
      th.scope = "col";
      th.textContent = w;
      if (i === 0) th.className = "is-sun";
      if (i === 6) th.className = "is-sat";
      head.appendChild(th);
    });
    var thead = document.createElement("thead");
    thead.appendChild(head);
    table.appendChild(thead);

    var tbody = document.createElement("tbody");
    var first = viewMonth;
    var daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    var tr = null;
    for (var i = 0; i < first.getDay(); i++) {
      tr = tr || document.createElement("tr");
      tr.appendChild(document.createElement("td"));
    }
    for (var day = 1; day <= daysInMonth; day++) {
      var d = new Date(first.getFullYear(), first.getMonth(), day);
      if (!tr || d.getDay() === 0) {
        if (tr) tbody.appendChild(tr);
        tr = document.createElement("tr");
      }
      tr.appendChild(buildCell(d, min, max, api));
    }
    if (tr) {
      while (tr.children.length < 7) tr.appendChild(document.createElement("td"));
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    gridEl.innerHTML = "";
    gridEl.appendChild(table);
  }

  function buildCell(d, min, max, api) {
    var ds = schedule.toDateString(d);
    var td = document.createElement("td");
    var inRange = d >= min && d <= max;
    td.className = "delivery-month-grid__cell" + (inRange ? "" : " is-out");
    var label = document.createElement("label");
    var num = document.createElement("span");
    num.className = "delivery-month-grid__num";
    num.textContent = d.getDate();
    label.appendChild(num);
    if (inRange) {
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = api.isDayOpen(ds);
      cb.setAttribute("aria-label", d.getMonth() + 1 + "月" + d.getDate() + "日の配達");
      cb.addEventListener("change", function () {
        api.setDayOpen(ds, cb.checked);
      });
      label.appendChild(cb);
      var mark = document.createElement("span");
      mark.className = "delivery-month-grid__mark";
      mark.textContent = cb.checked ? "配達" : "休み";
      cb.addEventListener("change", function () {
        mark.textContent = cb.checked ? "配達" : "休み";
        td.classList.toggle("is-off", !cb.checked);
      });
      td.classList.toggle("is-off", !cb.checked);
      label.appendChild(mark);
    } else {
      var dash = document.createElement("span");
      dash.className = "delivery-month-grid__mark";
      dash.textContent = "—";
      label.appendChild(dash);
    }
    td.appendChild(label);
    return td;
  }

  prevBtn.addEventListener("click", function () {
    viewMonth = addMonths(viewMonth, -1);
    render();
  });
  nextBtn.addEventListener("click", function () {
    viewMonth = addMonths(viewMonth, 1);
    render();
  });
  window.addEventListener("delivery-config-updated", render);

  schedule
    .load()
    .then(function () {
      viewMonth = monthStart(new Date());
      render();
    })
    .catch(function () {});
})();
