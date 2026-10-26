# ネット予約の Firestore 保存

## コレクション

| パス | 用途 |
|------|------|
| `orders/{uuid}` | 1件の予約申込（`status: pending` で保存） |
| `order_idempotency/{idempotencyKey}` | 二重送信防止 |
| `system/reservation_counter_YYYY-MM-DD` | 予約番号用の日次連番（API のみ） |

既存の `menu_availability` / `delivery_bookings` は変更していません。

## orders ドキュメント（抜粋）

- `schemaVersion`: 1
- `reservationNumber`: 人が読む番号（`YYMMDD-NNNN`）
- `revision`: 新規作成時 **1**。同一冪等キーでの再送では変更しない
- `status`: `pending` | `confirmed` | `canceled`（作成 API は `pending` のみ）
- `items[]`: 明細。通常おにぎりは `productId` / `productName` / `quantity` / `unitPrice`
- **お弁当**（`productId: "bento"`）には必ず `bentoChoiceId` と **`bentoComposition`**（サーバーが商品マスタから生成。クライアント送信値は拒否）

### bentoComposition（弁当1食あたり）

弁当明細の内側。副菜・だし巻きは含めない。

```json
"bentoComposition": [
  { "productId": "m005", "productName": "鮭", "quantity": 1 },
  { "productId": "m012", "productName": "ツナマヨ", "quantity": 1 }
]
```

付け合わせも鮭（`m005`）のときは同一 ID を合算:

```json
"bentoComposition": [
  { "productId": "m005", "productName": "鮭", "quantity": 2 }
]
```

製造側: 各要素の `quantity` × 弁当明細の `quantity` でおにぎり数を集計する。

**後方互換**: スナップショット導入前の予約に `bentoComposition` がなくても読取エラーにしない（製造側で `bentoChoiceId` + マスタからフォールバック）。

## 店舗側の参照（製造管理・将来 Square 連携）

- Firebase コンソール → Firestore → `orders`
- 製造 Worker + 読取専用 SA（`docs/RESERVATION_COORDINATION.md` 参照）
- `reservationNumber` / `orderId` と Square 注文 ID の紐付け

## お客様

予約番号は Firestore に保存（店舗・製造側の照合用）。お客様向け画面・LINE 本文には表示しない。他者の予約は閲覧不可。

API 詳細: `workers/reserve-orders-api/README.md`
