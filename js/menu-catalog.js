/** 予約メニュー一覧（reserve.js の GROUPS と同期すること） */
window.MenuCatalog = {
  soldOutMessageDefault: "申し訳ございません。\n本日売り切れです。",
  groups: [
    {
      label: "限定",
      items: [
        {
          id: "m001",
          name: "イカ明太おにぎり\n(11月限定)",
          price: 330,
        },
        {
          id: "m019",
          name: "高菜明太\n(モバイルオーダー限定)",
          price: 300,
        },
      ],
    },
    {
      label: "420円",
      items: [{ id: "m002", name: "うなぎ", price: 420 }],
    },
    {
      label: "360円",
      items: [
        { id: "m003", name: "肉そぼろ卵黄", price: 360 },
        { id: "m004", name: "卵黄", price: 360 },
        { id: "m005", name: "鮭", price: 360 },
      ],
    },
    {
      label: "330円",
      items: [
        { id: "m006", name: "明太クリームチーズ", price: 330 },
        { id: "m007", name: "豚の生姜焼き", price: 330 },
        { id: "m008", name: "豚キムチ", price: 330 },
        { id: "m009", name: "肉そぼろ", price: 330 },
      ],
    },
    {
      label: "300円",
      items: [{ id: "m011", name: "明太子", price: 300 }],
    },
    {
      label: "280円",
      items: [
        { id: "m012", name: "ツナマヨ", price: 280 },
        { id: "m013", name: "梅かつお", price: 280 },
        { id: "m014", name: "おかか", price: 280 },
        { id: "m015", name: "高菜", price: 280 },
        { id: "m016", name: "こんぶ", price: 280 },
      ],
    },
    {
      label: "その他",
      items: [
        { id: "m018", name: "お惣菜セット", price: 550 },
        { id: "m020", name: "唐揚げ", price: 550 },
        { id: "m017", name: "だし巻き玉子", price: 290 },
      ],
    },
  ],
};
