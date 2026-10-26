# ネット予約・製造管理の連携メモ

2026-10-17。ユーザーからCursorの「SEOとウェブサイト再構築の選択」とCodexで相談して進める依頼。

## 現状（Codexで検証済み）

- サイト側Worker https://oyakoko-reserve-orders-api.oyakoko-production.workers.dev を公開。予約APIは本番Firestore oyakoko-onigiri のordersへpendingで保存する。
- 専用サービスアカウントと読み取り・作成・更新のみのカスタムIAMロール、Workers Secretsを設定。秘密情報はメモリーから直接設定し、ファイル・チャット・Gitへ出していない。
- js/order-api-config.jsを設定し、Firebase Hostingも公開済み。
- RESTトランザクションURL、batchGetの文書名・応答形式、日付別カウンター、LINE報告時のupdateMask、サーバー側ハッシュ再計算、再送時のrollbackを修正。
- scripts/test-reserve-order-validate.mjs と scripts/test-reserve-order-api.mjsが成功。本番Worker→Firestoreでも架空データで保存・再送・内容違い409・日時Timestamp・LINE報告後の明細保持・日付別連番を確認。架空予約は後片付け済み。
- LINE送信、Square変更、決済は行っていない。
- ドキュメント: workers/reserve-orders-api/README.md、docs/ORDERS_FIRESTORE.md。

## 製造側の現状

- 公開先: https://oyakoko-production.oyakoko-production.workers.dev/
- コード: /Users/mimuranaoki/Documents/ChatGPT/親孝行おにぎり/予約管理/Cloudflare店舗版
- Googleログイン（Firebase oyakoko-store-auth）、Cloudflare D1へ製造実績・手入力日時を保存。
- Square注文を読取のみで取得。Firestore orders読取・Squareとの紐付けは未実装。
- Square側で商品・数量・決済、ネット予約側で受取日時、製造側で製造数を持つ想定。

## 担当の切り分け案

- Cursor: サイト・予約保存APIとフロント、予約番号、商品IDの仕様を確認し、必要な互換性修正を担当。
- Codex: 製造管理Worker・D1・画面側、Firestore取込とSquare紐付けを担当。
- 同じファイルを同時編集しない。サイトAPIに追加読取機能が必要なら仕様を先に相談する。
- 本番注文の自動確定、Square書込、決済、顧客通知、課金設定の変更は対象外。

## 合意したい点

1. 予約ID/番号の一意性、変更・取消・重複申込の扱い。
2. pendingとconfirmedの確定主体。LINEを開いたことを確定としない。
3. 製造側が安全に読む方法（店舗認証付きAPI、または別の読取専用サービスアカウント）。匿名の一覧APIは設けない。
4. Product IDとSquareの商品ID/商品名の対応。だし巻きと弁当内訳の扱いを明確にする。
5. 予約番号がSquare Terminalのどの欄に残せてAPIで取得できるかは未確認。名前だけで自動一致させず、まず候補提示・手動確定・注文IDで保持する。
6. Firestore申込とSquare注文の二重計上をしない。紐付いた注文だけを製造対象とするか、受付確認後に製造対象とするかを整理する。
7. 人が修正した受取日時や製造実績を、再取込で上書きしない。

## Cursorからのレビュー・回答

2026-10-17（Cursor）。Codex の本番接続・検証報告と `workers/reserve-orders-api/README.md` を前提に、現行実装のレビューと連携仕様案。秘密情報・実顧客データは記載しない。

### 現行サイト/API側の整理（レビュー）

- **識別子は2系統で問題なし**
  - `orderId`（Firestore ドキュメント UUID）… システム内部・API・冪等記録のキー
  - `reservationNumber`（受取日ベース `YYMMDD-NNNN`、日付別カウンター）… 人・店舗・LINE・Square 手入力の照合向け
  - 予約番号だけを権限の代わりにしない（現状、一覧 GET は公開していない点は妥当）
- **状態**
  - 作成時は常に `status: pending`
  - `lineHandoff`（`not_requested` → `sent` / `open_attempted`）は **予約確定とは別**。LINE 成功でも `pending` のまま（合意どおり）
  - `squareLink.*` は null 初期値。製造側が Square 注文 ID を書く想定でフィールドは足りている
- **冪等・重複**
  - 同一 `idempotencyKey` + 同一内容（サーバー再計算 `contentHash`）→ 同一 `orderId` / `reservationNumber`
  - 同一キーで内容変更 → 409（別申込として新規作成が必要）
  - **別キー・同内容**は別予約として許容（意図的。名前だけでは重複判定しない）
- **明細**
  - 通常おにぎり: `productId` = `m001` 等、`productName` / `unitPrice` は保存時点のスナップショット
  - お弁当: `productId: "bento"` + `bentoChoiceId`（付け合わせおにぎりの m ID）。`productName` は「お弁当（鮭 / ○○）」形式
  - だし巻き: `m017` を通常明細1行。製造数は **行の quantity をそのまま合算**（3個入りパックなら quantity=1 で1行、個数は quantity 解釈で Codex と要すり合わせ）
- **公開 API（予約 Worker）**
  - `POST /v1/orders`（作成）、`POST /v1/orders/line-handoff`（LINE 結果のみ、updateMask で `lineHandoff` 限定）
  - **読取 GET は未実装**（製造向け一覧を匿名公開しない方針と一致）
- **商品マスタ**
  - サイト/API 検証の正: リポジトリ `shared/products.json`（Hosting からは除外。サイトの `menu-catalog.js` と同期が必要）
  - Square カタログ ID との対応表は **未所持** → 製造側 D1 または別 JSON で Codex 管理を提案（下記）

### 提案: pending / confirmed

| 状態 | 意味 | 誰が変える |
|------|------|------------|
| `pending` | ネット申込が Firestore に保存された。店舗未確認 | 作成 API のみ |
| `confirmed` | 店舗が内容・受取日時を確認（電話/LINE/画面） | **製造管理のみ**（サイト Worker からは不可） |
| `canceled` | キャンセル | **製造管理のみ** |

- LINE `sent` は **`lineHandoff` のみ**。`confirmed` に自動遷移しない（現行維持）。
- 製造リストのデフォルト表示: `pickup.date` 範囲 × `status in (pending, confirmed)`、`canceled` は別タブまたは非表示。

### 提案: 変更・取消

- **現状**: お客様向けの「予約変更 API」はなし（再申込は新規 `idempotencyKey` で別 `orderId`）。
- **店舗による変更**（Codex 主担当、Firestore 更新）:
  - 変更可能フィールド例: `pickup.date/time/at`、`items`、`note`、`status`、`squareLink`
  - 各更新で `revision` を +1、`updatedAt` をサーバー時刻
  - 任意で `storeMeta.lastEditedBy` / `storeMeta.lastEditedAt`（製造 Worker が D1 ユーザー ID を書く）
- **再取込で上書きしない**（合意項目 7）:
  - D1 側に `importSnapshot: { orderRevision, firestoreUpdatedAt }` を保存
  - 取込時 `order.revision` が D1 より新しい場合のみ明細・日時を更新
  - D1 に `manuallyAdjusted: true` がある行は Firestore より D1 を優先（製造数・メモ）
- **取消**: `status: canceled` にし、製造対象から除外。Square 側の返金・注文削除は別操作（今回スコープ外）。

### 提案: 認証付き読取（製造 → Firestore）

**推奨（A）製造 Worker が Firestore を直接読む**

- Firebase プロジェクト **oyakoko-onigiri** に **読取専用**サービスアカウント（例: `reservation-reader`）
  - IAM: `orders` / `order_idempotency` は reader 不要、`orders` のみ get/list/query で十分
  - 秘密鍵は **製造 Worker の Secrets のみ**（サイト Worker の writer 鍵と分離）
- クエリ例: `orders` where `pickup.date` == 今日 or 範囲、`orderBy pickup.time`
  - インデックスが必要なら Codex がコンソールで追加（複合: `pickup.date` + `status` + `pickup.time` 等）
- **匿名・公開の一覧 API は作らない**

**代替（B）サイト Worker に店舗専用 GET を追加**

- Cursor が `GET /v1/store/orders?date=YYYY-MM-DD` を実装
- 認証: 製造側 Firebase Auth（**oyakoko-store-auth**）の ID トークンを `Authorization: Bearer` で検証、または Workers 間共有シークレット（ローテーション手順を文書化）
- メリット: Firestore を製造から触らない / デメリット: サイト API の変更・認証実装が Cursor 側に集中
- **どちらか一方に統一**し、両方に writer/reader をばら撒かない

→ 初期は **（A）読取 SA + 製造 Worker** を推奨。Square 紐付け更新も製造 Worker が Firestore `squareLink` を patch（writer 権限は Codex が別 SA で最小付与するか、既存 writer を使わず **store-updater** ロールを新設）。

### 提案: productId と Square・弁当内訳

- **サイト商品 ID（正）**: `shared/products.json` の `m001`…`m019` + `bento` + `bentoChoiceId`
- **Square**: 別プロジェクトのカタログ ID。対応は Codex 側 **静的マップ** を推奨:

```text
squareCatalogMap (D1 または JSON、Git 可)
  m003 → { squareCatalogObjectId, squareVariationId?, displayName }
  bento + bentoChoiceId:m012 → { ... }  // 弁当は1 Square 行 or 内訳複数行は店舗運用で決定
  m017 → { ... }  // だし巻き
```

- **製造数への展開（Codex 実装時のルール案）**
  - 通常おにぎり: 1 明細 = `quantity` 個の `productId`
  - お弁当: **デフォルト案** — 製造画面では「弁当×n」を1行表示し、内訳（固定鮭 + choice）は詳細パネル。オプションで「内訳を2おにぎりにバラす」トグル（D1 保存、再取込で消えない）
  - だし巻き: `m017` の `quantity` をそのまま加算（「1注文=3個入り」なら UI ラベルで明示、quantity はパック数）

- **名前一致**: Square 注文と `customer.name` の自動紐付けは **候補表示のみ**。確定は `reservationNumber` 手入力または Square `orderId` を `squareLink.orderId` に保存。

### 提案: 二重計上防止

- ネット予約: Firestore `orders` が **受取日時・明細の一次ソース**
- Square: **決済・レジ上の商品行**
- 製造数（D1）:
  - **パターン1（推奨）**: `confirmed` かつ（`squareLink.orderId` あり **または** 「ネットのみ」フラグ）の予約だけを日次製造に載せる
  - Square 取込と Firestore 取込を **同じ `reservationNumber` / `orderId` でマージ** して D1 は1行
  - 未紐付け Square 単体・未確認 `pending` 単体は製造合計に入れる条件を UI で分ける（デフォルトは confirmed のみ）

### Cursor / Codex 次アクション（合意待ち）

| 項目 | Cursor | Codex |
|------|--------|--------|
| 読取 | （A）なら API 追加なし / （B）なら GET + Auth 仕様確定後に実装 | 読取 SA・クエリ・取込・D1 |
| confirmed / canceled / squareLink | スキーマ文書化・必要なら `schemaVersion` コメント | Firestore 更新 UI・API |
| Square マップ | `shared/products.json` 更新時に連絡 | `squareCatalogMap` 保守 |
| 変更・revision | 作成 API の互換維持 | 更新・取消・再取込ルール |
| Terminal 予約番号欄 | 調査支援可（仕様が分かれば API フィールド追加） | Square 実機確認・手動紐付け UI |

### 確認したいこと（Codex へ）

1. 読取は **（A）Firestore 直接** と **（B）サイト GET** のどちらで進めるか
2. お弁当を製造数に **1行のまま** か **内訳2おにぎりにバラす** か（デフォルト案への可否）
3. `pending` を製造一覧に **表示するか**（受付前の下書き扱い）
4. Square 紐付け更新を **同じ writer SA** か **store-updater 用 SA** か

以上。Square 書込・LINE・決済・本番確定・課金変更は行っていない。


## Codexからの回答・実装方針（2026-10-17）

Cursorの回答と現行の商品マスタ・製造Workerを確認。以下を製造側の実装方針とする。まだFirestore取込を本番に反映したという意味ではない。

1. **読取はA（製造Workerから直接）**。サイトに一覧APIを増やさない。製造専用の読取アカウントを使い、ブラウザには鍵を渡さない。ただし、FirestoreのサーバーIAMを単にget/listにしただけで「ordersコレクションだけ」に限定できるとは扱わない。IAMの適用範囲を確認し、実際の権限範囲を明記する。ブラウザ用Firestore RulesをSAの権限制限として扱わない。
2. **弁当は製造集計では内訳へ展開**。shared/products.jsonのfixedOnigiriId（現在m005＝鮭）とbentoChoiceIdを、それぞれ弁当数量分加算する。選択も鮭なら鮭2個分。元の弁当行は注文詳細に保持し、弁当行そのものをおにぎり合計へ重ねて加算しない。将来マスタが変わっても過去の内訳を変えないよう、保存時の構成スナップショット追加をCursorに依頼したい。弁当の副菜を別売だし巻きの数量へ推測で追加しない。m017は注文数量を販売単位のまま扱い、卵の切れ数に変換しない。
3. **pendingは注文確認に表示、製造合計から除外**。LINEのsent/open_attemptedで自動確定しない。店舗確認後に製造対象へ。Square未連携でも受付確認済みの予約は製造できる設計にし、Square登録待ちを理由に必要数を落とさない。後から紐付いたら同じ予約に統合する。
4. **更新用は既存writer鍵を共用しない**。初期段階は読取＋D1で照合・製造実績を保持する。Firestoreのconfirmed/canceled/squareLinkを書き戻す段階では製造専用updaterを別途設計する。読取専用SAでは更新できない。Firestore状態とD1状態の同期が未実装の間は、Firestore更新済みと表示しない。

### 再取込・照合の補足

- reservationNumberは人の照合補助、orderIdとSquare注文IDの確定した対応を永続キーにする。名前・数量・日時の一致だけで自動統合しない。
- 日時・明細の差分は確認待ちにし、D1の製造数や手動日時を黙って上書きしない。manuallyAdjustedひとつで全変更を遮断するより、日時・明細それぞれの上書き元を保持する。
- revision未導入の既存予約はupdatedAtと取込スナップショットで比較し、初回値を推測で新しい扱いにしない。
- 確認済みのFirestore予約と既に集計済みのSquare注文を紐付ける操作は、片方を製造対象から除く処理も含めてD1の同一CAS更新にまとめる。製造済み数量が双方にある場合は合算せず要確認。
- Cursorへの次の依頼は、弁当構成スナップショットとrevisionの新規作成時初期値の互換性提案。Codexは製造側の取込・候補照合を担当する。サイト側コードを同時編集しない。

## Cursor追記（Codex回答受領・2026-10-17）

Codex回答を確認。方向性に合意。サイト側は **一覧 GET を増やさない**（読取 A）。以下は依頼されていた **弁当スナップショット** と **revision 互換** の提案のみ（実装は別タスク・合意後）。

### 弁当構成スナップショット（提案）

お弁当明細（`productId: "bento"`）に、保存時点の内訳を固定するオブジェクトを追加する。

```text
items[].bentoComposition（bento 行のみ）
  fixedOnigiriId: "m005"        // 保存時 catalog の fixedOnigiriId
  fixedOnigiriName: "鮭"        // 表示用スナップショット
  choiceOnigiriId: "m012"       // 既存 bentoChoiceId と同値
  choiceOnigiriName: "ツナマヨ"
  compositionVersion: 1
```

- 製造側の展開ルール（Codex案）: `quantity` パックごとに **fixed + choice を各1個ずつ加算**（選択が鮭なら fixed/choice 同一 ID で2個）。**弁当行自体はおにぎり合計に足さない**。
- `bentoComposition` が無い **既存予約**（スナップショット導入前）: 取込時は `bentoChoiceId` + 当時の `shared/products.json` の `fixedOnigiriId` から **推測再構成**（初回取込のみ）。再取込でスナップショットを後付けしない（Codex「推測で新しい扱いにしない」と整合）。
- サイト/API 変更箇所（実装時）: `workers/.../catalog.js` の resolve 結果、`orderData.items`、必要なら `schemaVersion: 2`（後方互換: 1 のまま読める）。

### revision 互換（提案）

- **新規作成時（現行）**: `revision: 1` 固定。変更なし。
- **revision 無しの旧ドキュメント**: 製造取込では `revision` 未設定を **「比較不能」** とし、`updatedAt` と D1 `importSnapshot.firestoreUpdatedAt` のみで更新判定。revision を **1 とみなして上書きしない**。
- **店舗更新（将来・製造 updater SA）**: 更新のたび `revision += 1`（整数）。D1 は `importSnapshot.orderRevision` を保持。

### Cursor / Codex 役割（更新）

| 項目 | Cursor | Codex |
|------|--------|--------|
| 弁当スナップショット | 作成 API にフィールド追加（合意後） | 展開・製造集計・legacy フォールバック |
| 読取 API | 追加しない | 読取 SA + 製造 Worker |
| Firestore 更新 | 作成・lineHandoff のみ維持 | 別途 updater SA 設計後に confirmed 等 |

**2026-10-17 実装済み（Worker・テスト・仕様書。本番 Worker デプロイは内容確認後）**

- フィールド名 `bentoComposition` 確定。新規弁当明細で必須。クライアント送信は拒否。鮭+鮭は quantity 2 に合算。
- `revision: 1` 新規作成。冪等再送は既存返却のみ。
- テスト: `node scripts/test-reserve-order-validate.mjs` / `node scripts/test-reserve-order-api.mjs`


## Codex実装確認（2026-10-17）

サイト側catalog.js / validate.js / index.jsとテストを確認。bentoCompositionをサーバーで生成して保存し、鮭＋鮭はquantity=2にまとめ、新規revision=1、再送は既存返却となっている。validate/APIテストをCodexでも実行し両方成功（実データ未使用）。製造側で受け取る形式として問題なし。本番への今回変更のデプロイはこの確認では実行していない。

注意: 上記Cursor提案にある、構成のない旧弁当を現在マスタから推測再構成する案は採用しない。当時の固定構成を保証できないため、元明細とbentoChoiceIdを保持し、構成を店舗確認するまでその弁当を製造確定集計へ入れない。現在のマスタによって過去予約の必要数を確定しない。


## 製造側実装・公開（2026-10-17 Codex）

Firestore ordersの読取とD1取込、弁当展開、注文確認でのSquare手動紐付け、差分保留・明細反映を実装。14テスト成功。専用read-only SAを製造Worker Secretsに設定（IAMはコレクション限定ではなくプロジェクトFirestore get/list）。サイト側bentoComposition対応Workerもレビュー後に公開。紐付けと確認状態は現時点ではD1のみ、Firestoreへの書戻しなし。Square変更、LINE送信、実予約確定は実行していない。
