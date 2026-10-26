window.DeliverySlotPicker = (function () {
  var schedule = window.DeliverySchedule;
  var modal = null;
  var backdrop = null;
  var gridWrap = null;
  var monthEl = null;
  var prevBtn = null;
  var nextBtn = null;
  var confirmBtn = null;
  var onSelect = null;
  var weekStart = null;
  var pending = null;
  var selected = null;

  function pad2(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function addDays(d, n) {
    var next = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    next.setDate(next.getDate() + n);
    return next;
  }

  function openPicker(callback, current) {
    if (!schedule || !modal) return;
    onSelect = callback;
    selected = current || null;
    pending = current ? { date: current.date, hour: current.hour, min: current.min } : null;
    weekStart = schedule.startOfWeekContaining(
      current && current.date ? parseDate(current.date) : schedule.getMinDate()
    );
    document.body.classList.add("delivery-slot-open");
    backdrop.classList.add("is-open");
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    schedule.refreshBookings().then(renderGrid);
  }

  function closePicker() {
    if (!modal) return;
    document.body.classList.remove("delivery-slot-open");
    backdrop.classList.remove("is-open");
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    pending = null;
  }

  function parseDate(str) {
    var p = str.split("-");
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  function dayClass(d) {
    var w = d.getDay();
    if (w === 0) return "delivery-slot-grid__day--sun";
    if (w === 6) return "delivery-slot-grid__day--sat";
    return "";
  }

  function renderGrid() {
    if (!gridWrap || !schedule) return;
    var grid = schedule.buildWeekGrid(weekStart);
    if (monthEl) monthEl.textContent = schedule.formatMonthLabel(grid.dates);
    if (prevBtn) prevBtn.disabled = !schedule.canGoPrevWeek(weekStart);
    if (nextBtn) nextBtn.disabled = !schedule.canGoNextWeek(weekStart);
    if (confirmBtn) confirmBtn.disabled = !pending;

    gridWrap.innerHTML = "";
    var table = document.createElement("table");
    table.className = "delivery-slot-grid";
    table.setAttribute("role", "grid");
    table.setAttribute("aria-label", "配達日時");

    var thead = document.createElement("thead");
    var headRow = document.createElement("tr");
    var corner = document.createElement("th");
    corner.scope = "col";
    corner.className = "delivery-slot-grid__corner";
    headRow.appendChild(corner);

    grid.dates.forEach(function (d) {
      var th = document.createElement("th");
      th.scope = "col";
      th.className = "delivery-slot-grid__day " + dayClass(d);
      th.innerHTML =
        '<span class="delivery-slot-grid__day-num">' +
        d.getDate() +
        '</span><span class="delivery-slot-grid__day-w">' +
        schedule.weekdays[d.getDay()] +
        "</span>";
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
        if (cell.status === "open") {
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "delivery-slot-grid__slot delivery-slot-grid__slot--open";
          btn.setAttribute("aria-label", schedule.formatSlotLabel(cell.date, cell.hour, cell.min));
          btn.textContent = "○";
          var isSelected =
            pending &&
            pending.date === cell.date &&
            Number(pending.hour) === Number(cell.hour) &&
            Number(pending.min) === Number(cell.min);
          if (isSelected) btn.classList.add("is-selected");
          btn.addEventListener("click", function () {
            pending = { date: cell.date, hour: cell.hour, min: cell.min };
            renderGrid();
          });
          td.appendChild(btn);
        } else if (cell.status === "blocked") {
          var blocked = document.createElement("span");
          blocked.className = "delivery-slot-grid__slot delivery-slot-grid__slot--blocked";
          blocked.textContent = "×";
          blocked.setAttribute("aria-hidden", "true");
          td.appendChild(blocked);
        } else {
          var closed = document.createElement("span");
          closed.className = "delivery-slot-grid__slot delivery-slot-grid__slot--closed";
          closed.textContent = "×";
          closed.setAttribute("aria-hidden", "true");
          td.appendChild(closed);
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    gridWrap.appendChild(table);
  }

  function init() {
    modal = document.getElementById("delivery-slot-modal");
    backdrop = document.getElementById("delivery-slot-backdrop");
    gridWrap = document.getElementById("delivery-slot-grid");
    monthEl = document.getElementById("delivery-slot-month");
    prevBtn = document.getElementById("delivery-slot-prev");
    nextBtn = document.getElementById("delivery-slot-next");
    confirmBtn = document.getElementById("delivery-slot-confirm");
    if (!modal || !schedule) return;

    if (backdrop) {
      backdrop.addEventListener("click", closePicker);
    }
    var closeBtn = document.getElementById("delivery-slot-close");
    if (closeBtn) closeBtn.addEventListener("click", closePicker);

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
    if (confirmBtn) {
      confirmBtn.addEventListener("click", function () {
        if (!pending || !onSelect) return;
        if (!schedule.isSlotAvailable(pending.date, pending.hour, pending.min)) {
          alert("この時間帯はすでに予約できません。別の時間をお選びください。");
          schedule.refreshBookings().then(renderGrid);
          return;
        }
        onSelect({
          date: pending.date,
          hour: String(pending.hour),
          min: pad2(Number(pending.min)),
          label: schedule.formatSlotLabel(pending.date, pending.hour, pending.min),
        });
        closePicker();
      });
    }

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && modal.classList.contains("is-open")) closePicker();
    });

    window.addEventListener("delivery-config-updated", function () {
      if (modal && modal.classList.contains("is-open")) {
        schedule.refreshBookings().then(renderGrid);
      }
    });
  }

  return {
    init: init,
    open: openPicker,
    close: closePicker,
  };
})();
