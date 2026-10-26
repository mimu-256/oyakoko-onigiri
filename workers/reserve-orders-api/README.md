# ネット予約保存 API（Cloudflare Workers）

通常予約（`reserve.html` → `liff.js`）の内容を Firestore `orders` に保存します。  
**Firebase Spark（無料）のまま**、Cloud Functions を使わず Workers + サービスアカウントで書き込みます。

## 前提

- Firebase プロジェクト: **oyakoko-onigiri**（店舗サイト用。別ログイン用プロジェクトと混同しない）
- Firestore ルール: `orders` / `order_idempotency` / `system` はクライアント直アクセス不可
- 商品マスタ: リポジトリ直下 `shared/products.json`（`menu-catalog.js` と同期）

## セットアップ

1. Firebase コンソール → プロジェクト設定 → サービスアカウント → 新しい秘密鍵（JSON）
2. `wrangler.toml.example` を `wrangler.toml` にコピー
3. 秘密情報を設定（Git に含めない）:

```bash
cd workers/reserve-orders-api
npm install
wrangler secret put FIREBASE_CLIENT_EMAIL
wrangler secret put FIREBASE_PRIVATE_KEY
```

`wrangler.toml` の `[vars]` に `FIREBASE_PROJECT_ID = "oyakoko-onigiri"`

4. デプロイ:

```bash
npm run deploy
```

5. 表示された Workers URL を `js/order-api-config.js` の `ORDERS_API.baseUrl` に設定

6. Firestore ルールをデプロイ（リポジトリルート）:

```bash
firebase deploy --only firestore:rules
```

## ローカル

```bash
npm run dev
# http://127.0.0.1:8787
```

`js/order-api-config.js`:

```javascript
window.ORDERS_API = { baseUrl: "http://127.0.0.1:8787" };
```

`firebase serve` の予約ページからは CORS 許可済み（`127.0.0.1:5003`）。

## エンドポイント

- `POST /v1/orders` — 予約作成（idempotencyKey + contentHash）
- `POST /v1/orders/line-handoff` — LINE 送信結果の記録（`sent` / `open_attempted`）

### お弁当明細 `bentoComposition`

- 新規の `productId: "bento"` 行に必須。`shared/products.json` の `fixedOnigiriId` と `bentoChoiceId` から **サーバーが生成**（リクエスト内の `bentoComposition` は拒否）。
- 1食あたりのおにぎり内訳配列。同一 `productId` は `quantity` を合算（鮭+鮭なら `quantity: 2`）。
- 予約全体の `revision` は新規作成時 `1`。同一冪等キー再送では既存ドキュメントを返し、`bentoComposition` / `revision` は更新しない。
- 仕様詳細: `docs/ORDERS_FIRESTORE.md`

## 製造管理画面（将来）

Firestore コンソール、または別途 **店舗認証付き** 管理 API / Admin SDK から `orders` を参照。  
`reservationNumber` と `squareLink.orderId` を後から紐付け。D1 製造実績との二重計上は、製造側で「未紐付けネット予約」の取込ルールを1本に限定する想定。


## 2026-10-17 本番接続と検証

- API公開先: https://oyakoko-reserve-orders-api.oyakoko-production.workers.dev
- js/order-api-config.jsへ設定し、oyakoko-onigiriのHostingも公開済み。
- 専用サービスアカウント reserve-orders-writer を作成。カスタムIAMロール reservationWriter は datastore.databases.get と entities.get/create/update のみに限定。削除権限・プロジェクト管理権限は持たせていない。
- 秘密鍵はメモリー内で発行し、Wranglerの標準入力からSecretsへ直接登録。鍵ファイルを作らず、コード・Git・Hostingへ含めていない。
- WorkersにIPごと30回/60秒のレート制限を設定。CORS許可外のOriginは拒否する。ただしCORSは認証ではなく、公開申込APIとして扱う。大規模な不正投稿へのTurnstile等は別途検討。
- APIエラー応答・正常応答は注文の内容や秘密情報を含めない。
- Firestore RESTのトランザクションURL、batchGet文書名と応答形式を修正。
- 日付ごとに system/reservation_counter_YYYY-MM-DD を使うよう変更し、別の日に予約後に元の日へ戻っても番号を重複させない。
- 同じ冪等キーでの再送・内容変更の拒否ではトランザクションをrollbackしてロックを解放。
- contentHashは検証後の入力からサーバー側で再計算。クライアント値による内容偽装を防ぐ。
- LINE報告ではupdateMaskを指定し、lineHandoff以外の明細・日時・状態を上書きしない。
- 作成時刻はFirestoreのサーバー時刻。状態はpendingを維持。
- Hostingからworkers、scripts、docs、shared、Firestoreルール、ログ、依存パッケージの設定を除外。

検証: node scripts/test-reserve-order-validate.mjs と node scripts/test-reserve-order-api.mjs が成功。
さらに本番Worker→Firestoreで架空予約を作成し、保存、再送で同じ予約ID/番号、内容改変時409、日本時間Timestamp、LINE報告後の明細保持、日付を戻した連番を検証済み。
テストの予約・冪等記録とテスト専用日付のカウンターを片付け済み。残った架空予約が0件であることを再確認。実際のLINE送信・予約確定・Square注文作成・決済は行っていない。

製造画面からのFirestore読取とSquare紐付けはまだ未実装。現時点でネット申込が製造数に自動加算されるわけではない。
