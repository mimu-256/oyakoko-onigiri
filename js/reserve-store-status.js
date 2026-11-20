/**
 * 営業終了モード（本日分を一括で受付停止する表示）。
 * 通常は Firestore（在庫管理ページの「営業終了」）で ON/OFF します。
 * ここは未接続時の初期値。closed: true でも画面上部バナーのみ（商品ごとは出しません）。
 */
window.RESERVE_STORE_STATUS = {
  closed: false,
  message:
    "大変申し訳ございません。\n本日の営業は終了いたしました。\n明日以降はご予約できます。",
};
