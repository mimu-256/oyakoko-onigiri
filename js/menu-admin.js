(function () {
  var statusEl = document.getElementById("admin-status");
  var listRoot = document.getElementById("admin-menu-list");
  var storeClosedRoot = document.getElementById("admin-store-closed");

  var localState = {};
  var storeClosed = false;
  var storeClosedDate = "";
  var saving = false;
  var savingStoreClosed = false;

  function setError(msg) {
    if (!statusEl) return;
    if (!msg) {
      statusEl.hidden = true;
      statusEl.textContent = "";
      return;
    }
    statusEl.hidden = false;
    statusEl.textContent = msg;
  }

  function getDb() {
    if (!window.MenuAvailability || !MenuAvailability.isConfigured()) return null;
    if (typeof firebase === "undefined") return null;
    if (!firebase.apps.length) {
      firebase.initializeApp(window.FIREBASE_CONFIG);
    }
    return firebase.firestore();
  }

  function renderStoreClosedPanel() {
    if (!storeClosedRoot) return;
    storeClosedRoot.innerHTML = "";
    var sec = document.createElement("section");
    sec.className =
      "menu-admin__store-closed" +
      (storeClosed ? " menu-admin__store-closed--on" : "");
    var h2 = document.createElement("h2");
    h2.className = "menu-admin__store-closed-title";
    h2.textContent = "本日の営業";
    sec.appendChild(h2);
    var label = document.createElement("label");
    label.className = "menu-admin__store-closed-label";
    var cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "menu-admin__store-closed-check";
    cb.checked = storeClosed;
    cb.setAttribute("aria-label", "本日営業終了");
    var text = document.createElement("span");
    text.className = "menu-admin__store-closed-name";
    text.textContent = "営業終了";
    var badge = document.createElement("span");
    badge.className = "menu-admin__store-closed-badge";
    badge.textContent = "ON";
    badge.hidden = !storeClosed;
    label.appendChild(cb);
    label.appendChild(text);
    label.appendChild(badge);
    sec.appendChild(label);
    storeClosedRoot.appendChild(sec);
  }

  function renderList() {
    if (!listRoot || !window.MenuCatalog) return;
    listRoot.innerHTML = "";
    var h2Sold = document.createElement("h2");
    h2Sold.className = "menu-admin__section-heading";
    h2Sold.textContent = "商品の売り切れ（本日受取のみ）";
    listRoot.appendChild(h2Sold);
    MenuCatalog.groups.forEach(function (group) {
      var sec = document.createElement("section");
      sec.className = "menu-admin__group";
      var h2 = document.createElement("h2");
      h2.className = "menu-admin__group-title";
      h2.textContent = group.label;
      sec.appendChild(h2);
      var ul = document.createElement("ul");
      ul.className = "menu-admin__items";
      group.items.forEach(function (item) {
        var sold = !!(localState[item.id] && localState[item.id].soldOut);
        var li = document.createElement("li");
        li.className = "menu-admin__item" + (sold ? " menu-admin__item--sold" : "");
        var label = document.createElement("label");
        label.className = "menu-admin__label";
        var cb = document.createElement("input");
        cb.type = "checkbox";
        cb.className = "menu-admin__check";
        cb.checked = sold;
        cb.setAttribute("data-id", item.id);
        cb.setAttribute("aria-label", item.name + "を売り切れにする");
        var text = document.createElement("span");
        text.className = "menu-admin__name";
        text.textContent = item.name;
        var badge = document.createElement("span");
        badge.className = "menu-admin__badge";
        badge.textContent = "←売切";
        badge.hidden = !sold;
        label.appendChild(cb);
        label.appendChild(text);
        label.appendChild(badge);
        li.appendChild(label);
        ul.appendChild(li);
      });
      sec.appendChild(ul);
      listRoot.appendChild(sec);
    });
  }

  function renderAll() {
    renderStoreClosedPanel();
    renderList();
  }

  function loadRemoteState() {
    var db = getDb();
    if (!db) {
      setError("接続できません。しばらくして開き直してください。");
      return Promise.resolve();
    }
    setError("");
    return db
      .collection(MenuAvailability.collection)
      .doc(MenuAvailability.docId)
      .get()
      .then(function (snap) {
        var data = snap.exists ? snap.data() : {};
        localState = data.items || {};
        storeClosedDate = data.storeClosedDate || "";
        if (
          data.storeClosed &&
          !MenuAvailability.isStoreClosedEffective(true, storeClosedDate)
        ) {
          return autoReleaseStoreClosedIfNeeded(true);
        }
        storeClosed = MenuAvailability.isStoreClosedEffective(
          !!data.storeClosed,
          storeClosedDate
        );
        renderAll();
      })
      .catch(function () {
        setError("読み込みに失敗しました。");
      });
  }

  function persistItem(id, soldOut) {
    var db = getDb();
    if (!db) return Promise.reject(new Error("db"));
    var payload = {
      items: {},
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    if (soldOut) {
      payload.items[id] = {
        soldOut: true,
        soldOutMessage: MenuAvailability.defaultMessage(),
      };
    } else {
      payload.items[id] = { soldOut: false };
    }
    saving = true;
    setError("");
    return db
      .collection(MenuAvailability.collection)
      .doc(MenuAvailability.docId)
      .set(payload, { merge: true })
      .then(function () {
        if (soldOut) {
          localState[id] = payload.items[id];
        } else {
          delete localState[id];
        }
        saving = false;
      })
      .catch(function () {
        saving = false;
        setError("保存に失敗しました。");
        return Promise.reject(new Error("save"));
      });
  }

  function autoReleaseStoreClosedIfNeeded(forcePersist) {
    if (!storeClosed && !forcePersist) return Promise.resolve();
    if (MenuAvailability.isStoreClosedEffective(storeClosed, storeClosedDate)) {
      storeClosed = true;
      renderAll();
      return Promise.resolve();
    }
    if (!forcePersist && savingStoreClosed) return Promise.resolve();
    return persistStoreClosed(false).then(function () {
      renderAll();
    });
  }

  function persistStoreClosed(closed) {
    var db = getDb();
    if (!db) return Promise.reject(new Error("db"));
    savingStoreClosed = true;
    setError("");
    return db
      .collection(MenuAvailability.collection)
      .doc(MenuAvailability.docId)
      .set(
        {
          storeClosed: closed,
          storeClosedDate: closed ? MenuAvailability.getJstDateString() : "",
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
      .then(function () {
        storeClosed = closed;
        storeClosedDate = closed ? MenuAvailability.getJstDateString() : "";
        savingStoreClosed = false;
      })
      .catch(function () {
        savingStoreClosed = false;
        setError("保存に失敗しました。");
        return Promise.reject(new Error("save"));
      });
  }

  if (storeClosedRoot) {
    storeClosedRoot.addEventListener("change", function (e) {
      var t = e.target;
      if (!t || !t.classList.contains("menu-admin__store-closed-check")) return;
      if (savingStoreClosed || saving) {
        t.checked = !t.checked;
        return;
      }
      var next = t.checked;
      var sec = t.closest(".menu-admin__store-closed");
      var badge = sec && sec.querySelector(".menu-admin__store-closed-badge");
      persistStoreClosed(next)
        .then(function () {
          if (sec) sec.classList.toggle("menu-admin__store-closed--on", next);
          if (badge) badge.hidden = !next;
        })
        .catch(function () {
          t.checked = !next;
        });
    });
  }

  if (listRoot) {
    listRoot.addEventListener("change", function (e) {
      var t = e.target;
      if (!t || !t.classList.contains("menu-admin__check")) return;
      if (saving || savingStoreClosed) {
        t.checked = !t.checked;
        return;
      }
      var id = t.getAttribute("data-id");
      var soldOut = t.checked;
      var li = t.closest(".menu-admin__item");
      var badge = li && li.querySelector(".menu-admin__badge");
      persistItem(id, soldOut)
        .then(function () {
          if (li) li.classList.toggle("menu-admin__item--sold", soldOut);
          if (badge) badge.hidden = !soldOut;
        })
        .catch(function () {
          t.checked = !soldOut;
        });
    });
  }

  loadRemoteState();

  setInterval(function () {
    autoReleaseStoreClosedIfNeeded(false).catch(function () {});
  }, 60000);
})();
