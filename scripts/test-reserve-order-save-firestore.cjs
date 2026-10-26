/**
 * 架空データで Firestore orders へ1件保存（確認後に削除）
 * node scripts/test-reserve-order-save-firestore.cjs
 */
const admin = require("firebase-admin");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");

const PROJECT = "oyakoko-onigiri";
const TEST_TAG = "local_save_test_" + Date.now();

if (admin.getApps().length === 0) {
  admin.initializeApp({
    projectId: PROJECT,
    credential: admin.applicationDefault(),
  });
}

const db = getFirestore();

function pickupAt(dateStr, timeStr) {
  const iso = dateStr + "T" + timeStr + ":00+09:00";
  return Timestamp.fromDate(new Date(iso));
}

async function main() {
  const orderId = crypto.randomUUID();
  const reservationNumber = "TEST-" + String(Date.now()).slice(-8);

  const doc = {
    schemaVersion: 1,
    reservationNumber,
    source: "web_line",
    customer: { name: "保存テスト（架空）" },
    pickup: {
      date: "2099-01-15",
      time: "10:45",
      timeZone: "Asia/Tokyo",
      at: pickupAt("2099-01-15", "10:45"),
    },
    items: [
      {
        lineId: "pid-m003",
        productId: "m003",
        productName: "肉そぼろ卵黄",
        quantity: 2,
        unitPrice: 360,
      },
    ],
    totalQuantity: 2,
    note: TEST_TAG,
    status: "pending",
    lineHandoff: { status: "not_requested", requestedAt: null },
    squareLink: {
      orderId: null,
      locationId: null,
      linkedAt: null,
      method: null,
    },
    revision: 1,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  console.log("Writing test order", orderId, reservationNumber);
  await db.collection("orders").doc(orderId).set(doc);

  const snap = await db.collection("orders").doc(orderId).get();
  if (!snap.exists) {
    console.error("FAIL: document missing after write");
    process.exit(1);
  }

  const data = snap.data();
  const ok =
    data.reservationNumber === reservationNumber &&
    data.pickup.date === "2099-01-15" &&
    data.pickup.time === "10:45" &&
    data.totalQuantity === 2 &&
    data.items[0].productId === "m003" &&
    data.status === "pending" &&
    data.note === TEST_TAG;

  if (!ok) {
    console.error("FAIL: field mismatch");
    process.exit(1);
  }

  console.log("OK readback:", {
    orderId,
    reservationNumber: data.reservationNumber,
    pickup: data.pickup.date + " " + data.pickup.time,
    totalQuantity: data.totalQuantity,
  });

  await db.collection("orders").doc(orderId).delete();
  console.log("OK deleted test document");
}

main().catch(function (err) {
  console.error("FAIL:", err.message || err);
  process.exit(1);
});
