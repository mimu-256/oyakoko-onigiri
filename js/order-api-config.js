/**
 * 予約保存 API（Cloudflare Workers 等）のベース URL。
 * デプロイ後に workers/reserve-orders-api/README.md を参照して設定してください。
 * 空のときは保存 API に接続しません（ローカル検証は wrangler dev + 下記 URL）。
 */
window.ORDERS_API = {
  baseUrl: "https://oyakoko-reserve-orders-api.oyakoko-production.workers.dev",
};
