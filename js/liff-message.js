window.LiffMessage = {
  formatDateTime: function (dateStr, hour, min) {
    if (!dateStr) return "";
    var parts = dateStr.split("-");
    var h = String(hour || "0");
    var m = String(min || "0");
    if (h.length === 1) h = "0" + h;
    if (m.length === 1) m = "0" + m;
    if (parts.length !== 3) {
      return dateStr + " " + h + ":" + m;
    }
    var month = parseInt(parts[1], 10);
    var day = parseInt(parts[2], 10);
    return month + "/" + day + " " + h + ":" + m;
  },

  formatSubtotal: function (count, total, opts) {
    var c = String(count || "")
      .replace(/[（）]/g, "")
      .replace(/点$/g, "")
      .trim();
    var countPart = c ? c + "点 " : "";
    var line = "小計：" + countPart + String(total || "").trim();
    if (opts && opts.taxIncluded) {
      line += "（税込）";
    }
    return line;
  },

  buildReserveMessage: function (info) {
    var lines = ["【ご予約】", "お名前：" + info.name];
    if (info.tel) {
      lines.push("電話：" + info.tel);
    }
    lines.push(
      "日時：" + this.formatDateTime(info.date, info.hour, info.min),
      "",
      "ご注文：\n" + (info.order || ""),
      this.formatSubtotal(info.count, info.total)
    );
    return lines.join("\n");
  },
};
