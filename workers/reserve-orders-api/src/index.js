import {
  getAccessToken,
  rollback,
  docPath,
  parseDocFields,
  pickupAtTimestamp,
  beginTransaction,
  batchGet,
  commit,
  buildDocWrite,
  buildServerTimestampTransforms,
} from "./firestore.js";
import { validateCreateBody, validateBodySize } from "./validate.js";

var ALLOWED_ORIGINS = [
  "https://oyakoko-onigiri.web.app",
  "https://oyakoko-onigiri.firebaseapp.com",
  "http://127.0.0.1:5003",
  "http://localhost:5003",
];

function corsHeaders(origin) {
  var allow = ALLOWED_ORIGINS.indexOf(origin) >= 0 ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function jsonResponse(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: Object.assign(
      { "Content-Type": "application/json; charset=utf-8" },
      corsHeaders(origin)
    ),
  });
}

function reservationNumberFrom(dateStr, seq) {
  var p = dateStr.split("-");
  var yy = p[0].slice(-2);
  var mm = p[1];
  var dd = p[2];
  return yy + mm + dd + "-" + String(seq).padStart(4, "0");
}

function nextSeqForDay(counter, pickupDate) {
  var day = pickupDate;
  var seq = 1;
  if (counter && counter.day === day && counter.seq) {
    seq = counter.seq + 1;
  }
  return { day: day, seq: seq };
}

function orderItemsForStore(items) {
  return items.map(function (it) {
    var row = {
      lineId: it.lineId,
      productId: it.productId,
      productName: it.productName,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
    };
    if (it.bentoChoiceId) row.bentoChoiceId = it.bentoChoiceId;
    if (it.bentoComposition) row.bentoComposition = it.bentoComposition;
    return row;
  });
}

async function handleCreateOrder(request, env, origin, attempt = 0) {
  if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
    return jsonResponse({ error: "server_not_configured" }, 503, origin);
  }
  var retryRequest=request.clone();
  var raw = await request.text();
  if (!validateBodySize(raw)) {
    return jsonResponse({ error: "payload_too_large" }, 413, origin);
  }
  var body;
  try {
    body = JSON.parse(raw);
  } catch (e) {
    return jsonResponse({ error: "invalid_json" }, 400, origin);
  }
  var validated = validateCreateBody(body);
  if (validated.error) {
    return jsonResponse({ error: validated.error }, 400, origin);
  }

  // 内容ハッシュはクライアント値を信用せず、入力の正規化後に再計算。
  var canonical = {customer: validated.customer, pickup:{date:validated.pickup.date,time:validated.pickup.time},items:validated.items.map(function(i){var row={lineId:i.lineId,productId:i.productId,quantity:i.quantity};if(i.bentoChoiceId)row.bentoChoiceId=i.bentoChoiceId;return row;}),note:validated.note};
  validated.contentHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(canonical))))).map(function(v){return v.toString(16).padStart(2,'0');}).join('');
  var token = await getAccessToken(env);
  var projectId = env.FIREBASE_PROJECT_ID;
  var idemPath = "order_idempotency/" + validated.idempotencyKey;
  var counterPath = "system/reservation_counter_" + validated.pickup.date;

  var txn = await beginTransaction(env, token);
  var batch = await batchGet(
    env,
    token,
    [idemPath, counterPath],
    txn
  );

  var idemDoc = null;
  var counterDoc = null;
  (batch || []).forEach(function (entry) {
    if (!entry.found) return;
    var path = entry.document.name.split("/documents/")[1];
    if (path === idemPath) idemDoc = parseDocFields(entry.document);
    if (path === counterPath) counterDoc = parseDocFields(entry.document);
  });

  if (idemDoc) {
    await rollback(env,token,txn);
    if (idemDoc.contentHash === validated.contentHash) {
      return jsonResponse(
        {
          orderId: idemDoc.orderId,
          reservationNumber: idemDoc.reservationNumber,
          reused: true,
        },
        200,
        origin
      );
    }
    return jsonResponse({ error: "idempotency_conflict" }, 409, origin);
  }

  var seqInfo = nextSeqForDay(counterDoc, validated.pickup.date);
  var reservationNumber = reservationNumberFrom(validated.pickup.date, seqInfo.seq);
  var orderId = crypto.randomUUID();

  var orderData = {
    schemaVersion: 1,
    reservationNumber: reservationNumber,
    source: "web_line",
    customer: validated.customer,
    pickup: {
      date: validated.pickup.date,
      time: validated.pickup.time,
      timeZone: "Asia/Tokyo",
      at: pickupAtTimestamp(validated.pickup.date, validated.pickup.time),
    },
    items: orderItemsForStore(validated.items),
    totalQuantity: validated.totalQuantity,
    note: validated.note,
    status: "pending",
    lineHandoff: {
      status: "not_requested",
      requestedAt: null,
    },
    squareLink: {
      orderId: null,
      locationId: null,
      linkedAt: null,
      method: null,
    },
    revision: 1,
  };

  var idemData = {
    orderId: orderId,
    reservationNumber: reservationNumber,
    contentHash: validated.contentHash,
  };

  var writes = [
    buildDocWrite(projectId, "orders/" + orderId, orderData, false),
    buildServerTimestampTransforms(projectId, "orders/" + orderId, [
      "createdAt",
      "updatedAt",
    ]),
    buildDocWrite(projectId, idemPath, idemData, false),
    buildServerTimestampTransforms(projectId, idemPath, ["createdAt"]),
  ];
  writes.push(
    buildDocWrite(
      projectId,
      counterPath,
      { day: seqInfo.day, seq: seqInfo.seq },
      counterDoc ? undefined : false
    )
  );

  try {
    await commit(env, token, txn, writes);
  } catch (e) {
    if (attempt < 3 && (e.code === 'ABORTED' || e.code === 'ALREADY_EXISTS')) return handleCreateOrder(retryRequest, env, origin, attempt+1);
    return jsonResponse({ error: "save_failed" }, 500, origin);
  }

  return jsonResponse(
    {
      orderId: orderId,
      reservationNumber: reservationNumber,
      reused: false,
    },
    201,
    origin
  );
}

async function handleLineHandoff(request, env, origin) {
  if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
    return jsonResponse({ error: "server_not_configured" }, 503, origin);
  }
  var raw=await request.text();if(!validateBodySize(raw))return jsonResponse({error:'payload_too_large'},413,origin);
  var body;try{body=JSON.parse(raw);}catch{return jsonResponse({error:'invalid_json'},400,origin);}
  var orderId = String(body.orderId || "").trim();
  var idempotencyKey = String(body.idempotencyKey || "").trim();
  var status = String(body.status || "").trim();
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(orderId) || !/^[0-9a-f-]{36}$/i.test(idempotencyKey)) {
    return jsonResponse({ error: "invalid_request" }, 400, origin);
  }
  if (status !== "sent" && status !== "open_attempted") {
    return jsonResponse({ error: "invalid_status" }, 400, origin);
  }

  var token = await getAccessToken(env);
  var idemPath = "order_idempotency/" + idempotencyKey;
  var idemRes = await batchGet(env, token, [idemPath], null);
  var idemDoc = null;
  (idemRes || []).forEach(function (entry) {
    if (entry.found) idemDoc = parseDocFields(entry.document);
  });
  if (!idemDoc || idemDoc.orderId !== orderId) {
    return jsonResponse({ error: "forbidden" }, 403, origin);
  }

  var txn = await beginTransaction(env, token);
  var orderPath = "orders/" + orderId;
  var orderBatch = await batchGet(env, token, [orderPath], txn);
  var orderDoc = null;
  (orderBatch || []).forEach(function (entry) {
    if (entry.found) orderDoc = parseDocFields(entry.document);
  });
  if (!orderDoc || orderDoc.status !== "pending") {
    return jsonResponse({ error: "order_not_mutable" }, 409, origin);
  }

  var writes = [
    buildDocWrite(
      env.FIREBASE_PROJECT_ID,
      orderPath,
      {
        lineHandoff: {
          status: status,
          requestedAt: { _type: "timestamp", iso: new Date().toISOString() },
        },
      },
      true,
      ["lineHandoff"]
    ),
    buildServerTimestampTransforms(env.FIREBASE_PROJECT_ID, orderPath, ["updatedAt"]),
  ];

  try {
    await commit(env, token, txn, writes);
  } catch (e) {
    return jsonResponse({ error: "update_failed" }, 500, origin);
  }

  return jsonResponse({ ok: true }, 200, origin);
}

export default {
  async fetch(request, env) {
    var origin = request.headers.get("Origin") || "";
    if(origin && ALLOWED_ORIGINS.indexOf(origin)<0)return jsonResponse({error:'origin_not_allowed'},403,origin);
    if(request.method==='POST' && Number(request.headers.get('Content-Length'))>32000)return jsonResponse({error:'payload_too_large'},413,origin);
    if(request.method==='POST' && env.RESERVE_RATE_LIMIT){var ip=request.headers.get('CF-Connecting-IP')||'unknown';var result=await env.RESERVE_RATE_LIMIT.limit({key:ip});if(!result.success)return jsonResponse({error:'too_many_requests'},429,origin);}
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    var url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/v1/orders") {
      try{return await handleCreateOrder(request, env, origin);}catch(e){return jsonResponse({error:'save_failed',stage:['oauth_failed','begin_transaction_failed','batch_get_failed'].includes(e.message)?e.message:'unexpected',upstreamCode:e.code||null},502,origin);}
    }
    if (request.method === "POST" && url.pathname === "/v1/orders/line-handoff") {
      try{return await handleLineHandoff(request, env, origin);}catch{return jsonResponse({error:'update_failed'},502,origin);}
    }
    return jsonResponse({ error: "not_found" }, 404, origin);
  },
};
