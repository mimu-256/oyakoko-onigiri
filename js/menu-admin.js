(function () {
  var statusEl = document.getElementById("admin-status");
  var listRoot = document.getElementById("admin-menu-list");

  var localState = {};
  var saving = false;

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

  function renderList() {
    if (!listRoot || !window.MenuCatalog) return;
    listRoot.innerHTML = "";
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
        localState = (snap.exists && snap.data().items) || {};
        renderList();
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

  if (listRoot) {
    listRoot.addEventListener("change", function (e) {
      var t = e.target;
      if (!t || !t.classList.contains("menu-admin__check")) return;
      if (saving) {
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
})();
