function base64UrlEncode(bytes) {
  var bin = "";
  bytes.forEach(function (b) {
    bin += String.fromCharCode(b);
  });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem) {
  var body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  var binary = atob(body);
  var bytes = new Uint8Array(binary.length);
  for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function signJwt(payload, privateKeyPem) {
  var header = { alg: "RS256", typ: "JWT" };
  var enc = new TextEncoder();
  var headerB64 = base64UrlEncode(enc.encode(JSON.stringify(header)));
  var payloadB64 = base64UrlEncode(enc.encode(JSON.stringify(payload)));
  var unsigned = headerB64 + "." + payloadB64;
  var key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  var sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    enc.encode(unsigned)
  );
  return unsigned + "." + base64UrlEncode(new Uint8Array(sig));
}

var cachedAccessToken=null;
export async function getAccessToken(env) {
  if(cachedAccessToken&&cachedAccessToken.email===env.FIREBASE_CLIENT_EMAIL&&cachedAccessToken.expires>Date.now())return cachedAccessToken.token;
  var email = env.FIREBASE_CLIENT_EMAIL;
  var key = (env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  var now = Math.floor(Date.now() / 1000);
  var jwt = await signJwt(
    {
      iss: email,
      sub: email,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
      scope: "https://www.googleapis.com/auth/datastore",
    },
    key
  );
  var res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=" + jwt,
  });
  if (!res.ok) throw new Error("oauth_failed");
  var data = await res.json();
  cachedAccessToken={email:env.FIREBASE_CLIENT_EMAIL,token:data.access_token,expires:Date.now()+Math.max(60,(data.expires_in||3600)-120)*1000};
  return data.access_token;
}

export function docPath(projectId, path) {
  return "projects/" + projectId + "/databases/(default)/documents/" + path;
}

function toFsValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === "string") return { stringValue: val };
  if (typeof val === "boolean") return { booleanValue: val };
  if (typeof val === "number") {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (val && val._type === "timestamp") {
    return { timestampValue: val.iso };
  }
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFsValue) } };
  }
  if (typeof val === "object") {
    var fields = {};
    Object.keys(val).forEach(function (k) {
      if (val[k] !== undefined) fields[k] = toFsValue(val[k]);
    });
    return { mapValue: { fields: fields } };
  }
  return { stringValue: String(val) };
}

function fromFsValue(v) {
  if (!v) return null;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return parseInt(v.integerValue, 10);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.timestampValue !== undefined) return v.timestampValue;
  if (v.arrayValue) return (v.arrayValue.values || []).map(fromFsValue);
  if (v.nullValue !== undefined) return null;
  if (v.mapValue && v.mapValue.fields) {
    var o = {};
    Object.keys(v.mapValue.fields).forEach(function (k) {
      o[k] = fromFsValue(v.mapValue.fields[k]);
    });
    return o;
  }
  return null;
}

export function parseDocFields(doc) {
  if (!doc || !doc.fields) return null;
  var o = {};
  Object.keys(doc.fields).forEach(function (k) {
    o[k] = fromFsValue(doc.fields[k]);
  });
  return o;
}

export function pickupAtTimestamp(dateStr, timeStr) {
  var parts = timeStr.split(":");
  var iso =
    dateStr +
    "T" +
    parts[0].padStart(2, "0") +
    ":" +
    parts[1].padStart(2, "0") +
    ":00+09:00";
  return { _type: "timestamp", iso: new Date(iso).toISOString() };
}

export async function beginTransaction(env, token) {
  var url =
    "https://firestore.googleapis.com/v1/" +
    docPath(env.FIREBASE_PROJECT_ID, "").replace(/\/$/, "") +
    ":beginTransaction";
  var res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  var data = await res.json();
  if (!res.ok){var error=new Error('begin_transaction_failed');error.code=data.error?.status;throw error;}
  return data.transaction;
}

export async function batchGet(env, token, paths, transaction) {
  var url =
    "https://firestore.googleapis.com/v1/" +
    docPath(env.FIREBASE_PROJECT_ID, "").replace(/\/$/, "") +
    ":batchGet";
  var res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      documents: paths.map(function (p) {
        return docPath(env.FIREBASE_PROJECT_ID, p);
      }),
      transaction: transaction || undefined,
    }),
  });
  var data = await res.json();
  if (!res.ok) throw new Error("batch_get_failed");
  return (Array.isArray(data) ? data : [data]).map(function(entry) {
    return entry.found ? { found: true, document: entry.found } : { found: false, missing: entry.missing };
  });
}

export async function commit(env, token, transaction, writes) {
  var url =
    "https://firestore.googleapis.com/v1/" +
    docPath(env.FIREBASE_PROJECT_ID, "").replace(/\/$/, "") +
    ":commit";
  var res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ transaction: transaction, writes: writes }),
  });
  var data = await res.json();
  if (!res.ok) {
    var err = new Error("commit_failed");
    err.details = data;
    err.code = data.error && data.error.status;
    throw err;
  }
  return data;
}

export function buildDocWrite(projectId, path, fields, exists, updateMask) {
  var name = docPath(projectId, path);
  var fsFields = {};
  Object.keys(fields).forEach(function (k) {
    fsFields[k] = toFsValue(fields[k]);
  });
  var write = {
    update: { name: name, fields: fsFields },
  };
  if (updateMask) write.updateMask = { fieldPaths: updateMask };
  if (exists === false) {
    write.currentDocument = { exists: false };
  }
  return write;
}

export function buildServerTimestampTransforms(projectId, path, fieldPaths) {
  return {
    transform: {
      document: docPath(projectId, path),
      fieldTransforms: fieldPaths.map(function (fp) {
        return { fieldPath: fp, setToServerValue: "REQUEST_TIME" };
      }),
    },
  };
}

export async function rollback(env,token,transaction){
 if(!transaction)return;
 await fetch('https://firestore.googleapis.com/v1/'+docPath(env.FIREBASE_PROJECT_ID,'').replace(/\/$/,'')+':rollback',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({transaction})});
}
