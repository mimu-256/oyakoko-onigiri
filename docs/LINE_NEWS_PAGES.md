# LINE向けお知らせ記事の共通仕様

`line-entry/news/` 配下に作る、公式LINEから開くお知らせ記事の共通ルールです。

## 基本構成

既存記事を参考に、必要な要素だけを使用する。

1. ロゴ
2. 「お知らせ」
3. 記事タイトル
4. 挨拶・リード文
5. 写真またはイラスト
6. 商品・受付条件などの本文
7. 注文方法や注意事項
8. 注文ページへのボタン
9. 公式LINEへの相談案内

共通スタイルは `css/reserve.css` の `.news-page*` を使用する。他の記事へ影響する調整が必要な場合は、記事専用クラスを追加する。

## LIFFの入口とログイン

公式LINEのリッチメッセージなどには、通常の `web.app` URLではなくLIFF URLを設定する。

```text
https://liff.line.me/2011941067-G1JIcyJa/line-entry/news/<記事名>
```

例：配達記事

```text
https://liff.line.me/2011941067-G1JIcyJa/line-entry/news/delivery
```

記事では次の共通スクリプトを読み込む。

```html
<script src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script>
<script src="js/liff-env.js"></script>
<script src="js/liff-core.js"></script>
<script src="js/liff-page-bootstrap.js"></script>
```

`js/liff-page-bootstrap.js` がLIFFを初期化し、LIFF内で未ログインの場合は記事を開いた時点でログインへ進める。

公開中の `web.app` URLはブラウザ確認用として使用できるが、通常URLから直接開いた場合はLIFFの入口にならない。

## 記事から注文画面へのリンク

記事内の注文ボタンは、通常のサイト内リンクでよい。

```html
<a href="/line-entry/reserve">注文する</a>
```

```html
<a href="/line-entry/reserve-bulk">配達メニューを見る</a>
```

記事をLIFF URLから開いていれば、同じLIFFブラウザ内で注文画面へ移動し、ログイン状態を引き継げる。

## HTMLの共通設定

- `<html lang="ja" class="reserve-page">` を使用する。
- `<base href="/" />` を指定する。
- LIFF表示用に `news-liff-gate` と `news-liff-content` を用意する。
- 本文は `<main class="news-page" id="news-liff-content" hidden aria-hidden="true">` 内へ置く。
- タイトルや説明文に未確認情報を追加しない。
- 画像には内容が分かる `alt` と `width`・`height` 属性を付ける。
- 画像の形や内容を勝手に加工しない。
- 画像ファイルは原則 `images/` 配下で管理する。

## 新しい記事を追加するとき

1. `line-entry/news/<記事名>.html` を作る。
2. `firebase.json` に拡張子なしURLのrewriteを追加する。
3. 必要に応じて対象HTMLへ `Cache-Control` を追加する。
4. CSSやJavaScriptを変更した場合は、読み込みURLの `?v=` を更新する。
5. ローカルサーバー経由でスマートフォン幅の表示を確認する。
6. ボタンの遷移先と、実際の注文画面の流れを確認する。
7. Firebase Hostingへデプロイ後、公開URLと画像URLが取得できることを確認する。
8. リッチメッセージにはLIFF URLを設定する。

## 現在の記事

| 内容 | ソース | 公開URL |
| --- | --- | --- |
| お惣菜・唐揚げ | `line-entry/news/side-dish.html` | `https://oyakoko-onigiri.web.app/line-entry/news/side-dish` |
| 豚汁 | `line-entry/news/tonjiru.html` | `https://oyakoko-onigiri.web.app/line-entry/news/tonjiru` |
| 配達 | `line-entry/news/delivery.html` | `https://oyakoko-onigiri.web.app/line-entry/news/delivery` |

## 配達記事の導線

- LIFF入口：`https://liff.line.me/2011941067-G1JIcyJa/line-entry/news/delivery`
- 記事内ボタン：`/line-entry/reserve-bulk`
- 配達日時：注文画面のカレンダーから選択する。
- 注文期限：配達希望日の2日前まで。
- 最低注文数：おにぎり20個、またはお惣菜5個。
