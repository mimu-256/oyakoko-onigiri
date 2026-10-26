#!/usr/bin/env node
/**
 * ローカル専用 Square 検証（親孝行おにぎり モバイルオーダー）
 * トークンは run.sh 経由の非表示入力のみ。ファイル・.env・引数に載せない。
 * 未会計 OPEN 注文の Terminal 一覧表示は Square 公式保証外（構成依存）。
 */

import fs from "fs";

const SQUARE_HOST = "https://connect.squareup.com";
const SQUARE_VERSION = "2026-01-23";

/** POST 前の明示確認で入力必須の文字列（表示用・秘密ではない） */
export const CREATE_CONFIRM_PHRASE = "CREATE-VERIFY";

export const VERIFY = {
  idempotencyKey: "verify-pickup-a-oyakoko-20261009",
  referenceId: "VERIFY-PICKUP-A-20261009",
  locationId: "LKQTC90T89RB3",
  locationNameExpected: "親孝行おにぎり",
  lineName: "鮭",
  amount: 360,
  currency: "JPY",
  pickupDisplayName: "検証",
};

function usage() {
  console.log(`用法: ./run.sh <mode>

  dry-run              構文・定数確認（トークン不要）
  plan-create-order    CreateOrder 予定 JSON（送信しない）
  create-order-dry-run POST 前確認フローの表示のみ（API なし）
  auth                 GET /v2/locations（トークン・非表示入力）
  create-order         本番 CreateOrder 1 件 + RetrieveOrder（トークン・非表示入力）

create-order は既存 idempotency_key 再利用時も Square 側で同一注文扱いの可能性あり（最大 1 件想定）。
Payments / Terminal Checkout / 更新・取消 / Catalog 変更は行いません。`);
}

function buildCreateOrderBody(locationId) {
  return {
    idempotency_key: VERIFY.idempotencyKey,
    order: {
      location_id: locationId,
      reference_id: VERIFY.referenceId,
      line_items: [
        {
          name: VERIFY.lineName,
          quantity: "1",
          base_price_money: {
            amount: VERIFY.amount,
            currency: VERIFY.currency,
          },
        },
      ],
      fulfillments: [
        {
          type: "PICKUP",
          state: "PROPOSED",
          pickup_details: {
            recipient: {
              display_name: VERIFY.pickupDisplayName,
            },
            schedule_type: "ASAP",
          },
        },
      ],
    },
  };
}

function clearToken() {
  delete process.env.SQUARE_ACCESS_TOKEN;
}

function tokenFromEnv() {
  const t = process.env.SQUARE_ACCESS_TOKEN;
  if (!t || !String(t).trim()) {
    console.error("エラー: トークンがありません。./run.sh create-order を使用してください。");
    process.exit(1);
  }
  return String(t).trim();
}

async function squareRequest(method, path, token, jsonBody) {
  const res = await fetch(`${SQUARE_HOST}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Square-Version": SQUARE_VERSION,
      "Content-Type": "application/json",
    },
    body: jsonBody ? JSON.stringify(jsonBody) : undefined,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body.errors ? JSON.stringify(body.errors) : res.statusText;
    console.error(`Square API エラー (${res.status}): ${msg}`);
    process.exit(1);
  }
  return body;
}

function squareGet(path, token) {
  return squareRequest("GET", path, token);
}

function squarePost(path, token, jsonBody) {
  return squareRequest("POST", path, token, jsonBody);
}

async function fetchAndAssertLocation(token) {
  const data = await squareGet("/v2/locations", token);
  const locations = data.locations || [];
  const loc = locations.find((l) => l.id === VERIFY.locationId);
  if (!loc) {
    console.error(
      `停止: location_id ${VERIFY.locationId} が GET /v2/locations にありません。`
    );
    process.exit(1);
  }
  const name = (loc.name || "").trim();
  if (name !== VERIFY.locationNameExpected) {
    console.error(
      `停止: 店舗名不一致。期待「${VERIFY.locationNameExpected}」実際「${name}」`
    );
    process.exit(1);
  }
  if (loc.status && loc.status !== "ACTIVE") {
    console.error(`停止: 店舗 status が ACTIVE ではありません (${loc.status})`);
    process.exit(1);
  }
  return loc;
}

function printCreateSummary(loc) {
  console.log("--- 本番 CreateOrder 検証（1 件限定）---");
  console.log(`店舗: ${loc.name} (${loc.id})`);
  console.log(`状態: OPEN（CreateOrder デフォルト） / fulfillment: PICKUP`);
  console.log(`受取表示名: ${VERIFY.pickupDisplayName}`);
  console.log(`商品: ad hoc「${VERIFY.lineName}」× 1 = ${VERIFY.amount} ${VERIFY.currency}`);
  console.log(`reference_id: ${VERIFY.referenceId}`);
  console.log(`idempotency_key: ${VERIFY.idempotencyKey}`);
  console.log("POST /v2/orders のみ。成功後 GET /v2/orders/{id} のみ。");
  console.log("※ Terminal 未会計一覧への表示は保証されません。");
  console.log("----------------------------------------");
}

function readConfirmPhrase() {
  const tty = fs.openSync("/dev/tty", "r+");
  try {
    const prompt = `上記内容で本番に 1 件作成する場合は「${CREATE_CONFIRM_PHRASE}」と入力: `;
    fs.writeSync(tty, prompt);
    const buf = Buffer.alloc(256);
    const n = fs.readSync(tty, buf, 0, buf.length, null);
    const line = buf.slice(0, n).toString("utf8").trim();
    return line;
  } finally {
    fs.closeSync(tty);
  }
}

function assertConfirmOrExit(phrase) {
  if (phrase !== CREATE_CONFIRM_PHRASE) {
    console.error("停止: 確認文字列が一致しません。POST しません。");
    process.exit(1);
  }
}

async function modeAuth() {
  const token = tokenFromEnv();
  try {
    const data = await squareGet("/v2/locations", token);
    const locations = data.locations || [];
    if (!locations.length) {
      console.log("locations: 0 件");
      return;
    }
    console.log("認証 OK — 店舗一覧（id / name / status）:");
    locations.forEach((loc) => {
      console.log(`  - ${loc.id}  ${loc.name || "(no name)"}  [${loc.status || "?"}]`);
    });
  } finally {
    clearToken();
  }
}

function modeDryRun() {
  console.log("dry-run OK");
  console.log("Square-Version:", SQUARE_VERSION);
  console.log("CREATE_CONFIRM_PHRASE:", CREATE_CONFIRM_PHRASE);
  console.log("VERIFY:", { ...VERIFY });
}

function modePlanCreateOrder() {
  console.log("CreateOrder 予定（送信しません）");
  console.log(JSON.stringify(buildCreateOrderBody(VERIFY.locationId), null, 2));
}

function modeCreateOrderDryRun() {
  const loc = {
    id: VERIFY.locationId,
    name: VERIFY.locationNameExpected,
    status: "ACTIVE",
  };
  printCreateSummary(loc);
  console.log(
    `\ncreate-order 実行時: トークン非表示入力 → GET locations で店舗検証 → 確認「${CREATE_CONFIRM_PHRASE}」→ POST → Retrieve`
  );
  console.log("（このモードでは API 呼び出し・確認入力は行いません）");
}

async function modeCreateOrder() {
  const token = tokenFromEnv();
  try {
    const loc = await fetchAndAssertLocation(token);
    printCreateSummary(loc);
    const typed = readConfirmPhrase();
    assertConfirmOrExit(typed);

    const created = await squarePost("/v2/orders", token, buildCreateOrderBody(loc.id));
    const order = created.order;
    if (!order || !order.id) {
      console.error("停止: CreateOrder レスポンスに order.id がありません。");
      process.exit(1);
    }

    console.log("CreateOrder OK");
    console.log(`  order_id: ${order.id}`);
    console.log(`  state: ${order.state || "?"}`);
    console.log(`  reference_id: ${order.reference_id || VERIFY.referenceId}`);

    const retrieved = await squareGet(`/v2/orders/${order.id}`, token);
    const ro = retrieved.order;
    if (!ro) {
      console.error("停止: RetrieveOrder に order がありません。");
      process.exit(1);
    }
    console.log("RetrieveOrder OK");
    console.log(`  order_id: ${ro.id}`);
    console.log(`  state: ${ro.state || "?"}`);
    console.log(`  location_id: ${ro.location_id || "?"}`);
    const items = ro.line_items || [];
    if (items[0]) {
      console.log(`  line[0]: ${items[0].name} qty=${items[0].quantity}`);
    }
    console.log("\n次: Square Terminal の注文一覧で「検証 / 鮭」を目視（表示は保証外）。");
  } finally {
    clearToken();
  }
}

const mode = process.argv[2] || "";

switch (mode) {
  case "dry-run":
    modeDryRun();
    break;
  case "plan-create-order":
    modePlanCreateOrder();
    break;
  case "create-order-dry-run":
    modeCreateOrderDryRun();
    break;
  case "auth":
    await modeAuth();
    break;
  case "create-order":
    await modeCreateOrder();
    break;
  default:
    usage();
    process.exit(mode ? 1 : 0);
}
