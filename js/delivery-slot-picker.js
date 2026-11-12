window.DeliverySlotPicker = (function () {
  var schedule = window.DeliverySchedule;
  var ui = null;
  var mode = "modal";
  var onSelect = null;
  var weekStart = null;
  var pending = null;
  var selected = null;
  var slotsReady = false;

  function pad2(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function addDays(d, n) {
    var next = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    next.setDate(next.getDate() + n);
    return next;
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

  function closePicker() {
    if (!ui || !ui.modal) return;
    document.body.classList.remove("delivery-slot-open");
    if (ui.backdrop) ui.backdrop.classList.remove("is-open");
    ui.modal.classList.remove("is-open");
    ui.modal.setAttribute("aria-hidden", "true");
    pending = null;
  }

  function openPicker(callback, current) {
    if (!schedule || !ui || !ui.modal) return;
    mode = "modal";
    onSelect = callback;
    selected = current || null;
    pending = current ? { date: current.date, hour: current.hour, min: current.min } : null;
    weekStart = schedule.startOfWeekContaining(
      current && current.date ? parseDate(current.date) : schedule.getMinDate()
    );
    document.body.classList.add("delivery-slot-open");
    if (ui.backdrop) ui.backdrop.classList.add("is-open");
    ui.modal.classList.add("is-open");
    ui.modal.setAttribute("aria-hidden", "false");
    slotsReady = true;
    schedule.refreshBookings().then(renderGrid);
  }

  function commitSelection() {
    if (!pending || !onSelect) return;
    if (!schedule.isSlotAvailable(pending.date, pending.hour, pending.min)) {
      alert("この時間帯はすでに予約できません。別の時間をお選びください。");
      schedule.refreshBookings().then(renderGrid);
      return;
    }
    var slot = {
      date: pending.date,
      hour: String(pending.hour),
      min: pad2(Number(pending.min)),
      label: schedule.formatSlotLabel(pending.date, pending.hour, pending.min),
    };
    selected = slot;
    onSelect(slot);
    if (mode === "modal") closePicker();
    else renderGrid();
  }

  function renderGrid() {
    if (!ui || !ui.gridWrap || !schedule || !weekStart) return;
    var grid = slotsReady
      ? schedule.buildWeekGrid(weekStart)
      : schedule.buildWeekSkeleton(weekStart);
    if (ui.monthEl) {
      ui.monthEl.textContent = slotsReady
        ? schedule.formatMonthLabel(grid.dates)
        : schedule.formatMonthLabel(grid.dates) + "（読み込み中…）";
    }
    if (ui.prevBtn) ui.prevBtn.disabled = !schedule.canGoPrevWeek(weekStart);
    if (ui.nextBtn) ui.nextBtn.disabled = !schedule.canGoNextWeek(weekStart);
    if (ui.confirmBtn) ui.confirmBtn.disabled = !pending;

    ui.gridWrap.innerHTML = "";
    ui.gridWrap.setAttribute("aria-busy", slotsReady ? "false" : "true");
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
        if (cell.status === "loading") {
          var loading = document.createElement("span");
          loading.className = "delivery-slot-grid__slot delivery-slot-grid__slot--loading";
          loading.setAttribute("aria-hidden", "true");
          td.appendChild(loading);
        } else if (cell.status === "open") {
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "delivery-slot-grid__slot delivery-slot-grid__slot--open";
          btn.setAttribute("aria-label", schedule.formatSlotLabel(cell.date, cell.hour, cell.min));
          btn.textContent = "○";
          var active = pending || selected;
          var isSelected =
            active &&
            active.date === cell.date &&
            Number(active.hour) === Number(cell.hour) &&
            Number(active.min) === Number(cell.min);
          if (isSelected) btn.classList.add("is-selected");
          btn.addEventListener("click", function () {
            pending = { date: cell.date, hour: cell.hour, min: cell.min };
            if (mode === "inline") commitSelection();
            else renderGrid();
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
    ui.gridWrap.appendChild(table);
  }

  function bindNav() {
    if (!ui) return;
    if (ui.prevBtn && !ui.prevBtn.dataset.deliverySlotBound) {
      ui.prevBtn.dataset.deliverySlotBound = "1";
      ui.prevBtn.addEventListener("click", function () {
        weekStart = addDays(weekStart, -7);
        renderGrid();
      });
    }
    if (ui.nextBtn && !ui.nextBtn.dataset.deliverySlotBound) {
      ui.nextBtn.dataset.deliverySlotBound = "1";
      ui.nextBtn.addEventListener("click", function () {
        weekStart = addDays(weekStart, 7);
        renderGrid();
      });
    }
    if (ui.confirmBtn && !ui.confirmBtn.dataset.deliverySlotBound) {
      ui.confirmBtn.dataset.deliverySlotBound = "1";
      ui.confirmBtn.addEventListener("click", commitSelection);
    }
  }

  function bindConfigRefresh() {
    if (window.__deliverySlotPickerConfigBound) return;
    window.__deliverySlotPickerConfigBound = true;
    window.addEventListener("delivery-config-updated", function () {
      if (!ui || !schedule) return;
      if (mode === "modal" && ui.modal && !ui.modal.classList.contains("is-open")) return;
      schedule.refreshBookings().then(renderGrid);
    });
  }

  function init() {
    ui = {
      modal: document.getElementById("delivery-slot-modal"),
      backdrop: document.getElementById("delivery-slot-backdrop"),
      gridWrap: document.getElementById("delivery-slot-grid"),
      monthEl: document.getElementById("delivery-slot-month"),
      prevBtn: document.getElementById("delivery-slot-prev"),
      nextBtn: document.getElementById("delivery-slot-next"),
      confirmBtn: document.getElementById("delivery-slot-confirm"),
    };
    if (!ui.modal || !schedule) return;
    mode = "modal";
    bindNav();

    if (ui.backdrop) {
      ui.backdrop.addEventListener("click", closePicker);
    }
    var closeBtn = document.getElementById("delivery-slot-close");
    if (closeBtn) closeBtn.addEventListener("click", closePicker);

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && ui.modal.classList.contains("is-open")) closePicker();
    });

    bindConfigRefresh();
  }

  function initInline(opts) {
    if (!schedule || !opts) return;
    ui = {
      modal: null,
      backdrop: null,
      gridWrap: document.getElementById(opts.gridId),
      monthEl: document.getElementById(opts.monthId),
      prevBtn: document.getElementById(opts.prevId),
      nextBtn: document.getElementById(opts.nextId),
      confirmBtn: null,
    };
    if (!ui.gridWrap) return;
    mode = "inline";
    onSelect = opts.onSelect;
    selected = opts.current || null;
    pending = selected
      ? { date: selected.date, hour: selected.hour, min: selected.min }
      : null;
    weekStart = schedule.startOfWeekContaining(
      selected && selected.date ? parseDate(selected.date) : schedule.getMinDate()
    );
    bindNav();
    bindConfigRefresh();
    slotsReady = false;
    renderGrid();
  }

  function activateSlots() {
    slotsReady = true;
    return schedule.refreshBookings().then(renderGrid).catch(function () {
      renderGrid();
    });
  }

  return {
    init: init,
    initInline: initInline,
    activateSlots: activateSlots,
    open: openPicker,
    close: closePicker,
  };
})();
