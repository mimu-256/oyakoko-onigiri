import assert from 'node:assert/strict';
import api from '../workers/reserve-orders-api/src/index.js';
const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const pem='-----BEGIN PRIVATE KEY-----\n'+Buffer.from(await crypto.subtle.exportKey('pkcs8',pair.privateKey)).toString('base64')+'\n-----END PRIVATE KEY-----';
const env={FIREBASE_PROJECT_ID:'oyakoko-test',FIREBASE_CLIENT_EMAIL:'test@example.com',FIREBASE_PRIVATE_KEY:pem};
const docs=new Map();const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>{
 if(url==='https://oauth2.googleapis.com/token')return Response.json({access_token:'test-only'});
 assert(!url.includes('/documents/:'));
 const body=JSON.parse(options.body);
 if(url.endsWith(':rollback'))return Response.json({});
 if(url.endsWith(':beginTransaction'))return Response.json({transaction:'test'});
 if(url.endsWith(':batchGet'))return Response.json(body.documents.map(name=>{assert(name.startsWith('projects/'));return docs.has(name)?{found:docs.get(name)}:{missing:name};}));
 if(url.endsWith(':commit')){
  for(const write of body.writes||[]){
   if(write.update){const old=docs.get(write.update.name);if(write.currentDocument?.exists===false&&old)return Response.json({error:{status:'ALREADY_EXISTS'}},{status:409});}
  }
  for(const write of body.writes||[]){if(write.update){let next=structuredClone(write.update);if(write.updateMask){next={name:next.name,fields:{...docs.get(next.name)?.fields}};for(const f of write.updateMask.fieldPaths)next.fields[f]=write.update.fields[f];}docs.set(next.name,next);}}
  return Response.json({commitTime:new Date().toISOString()});
 }
 throw Error('unexpected URL');
};
const base={idempotencyKey:crypto.randomUUID(),contentHash:'a'.repeat(64),customer:{name:'架空APIテスト'},pickup:{date:'2026-10-19',time:'10:45'},note:'架空',items:[{lineId:'pid-m003',productId:'m003',quantity:2}]};
async function post(path,body){return api.fetch(new Request('https://example.test'+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://oyakoko-onigiri.web.app'},body:JSON.stringify(body)}),env);}
try{
 const first=await post('/v1/orders',base);assert.equal(first.status,201);const saved=await first.json();
 const repeat=await post('/v1/orders',base);assert.equal(repeat.status,200);assert.equal((await repeat.json()).reservationNumber,saved.reservationNumber);
 const changed=await post('/v1/orders',{...base,items:[{lineId:'pid-m003',productId:'m003',quantity:3}]});assert.equal(changed.status,409);
 await post('/v1/orders',{...base,idempotencyKey:crypto.randomUUID(),pickup:{date:'2026-10-20',time:'10:45'}});
 const third=await (await post('/v1/orders',{...base,idempotencyKey:crypto.randomUUID()})).json();assert.equal(third.reservationNumber,'261019-0002');
 const report=await post('/v1/orders/line-handoff',{orderId:saved.orderId,idempotencyKey:base.idempotencyKey,status:'open_attempted'});assert.equal(report.status,200);
 const order=docs.get('projects/oyakoko-test/databases/(default)/documents/orders/'+saved.orderId);assert(order.fields.items.arrayValue.values.length===1);assert.equal(order.fields.status.stringValue,'pending');assert.equal(order.fields.revision.integerValue,'1');assert.equal(order.fields.lineHandoff.mapValue.fields.status.stringValue,'open_attempted');
 const bentoKey=crypto.randomUUID();const bentoBody={idempotencyKey:bentoKey,contentHash:'b'.repeat(64),customer:{name:'弁当テスト'},pickup:{date:'2026-10-19',time:'11:00'},note:'',items:[{lineId:'bento-m005',productId:'bento',bentoChoiceId:'m005',quantity:1}]};
 const bentoRes=await post('/v1/orders',bentoBody);assert.equal(bentoRes.status,201);const bentoSaved=await bentoRes.json();
 const bentoDoc=docs.get('projects/oyakoko-test/databases/(default)/documents/orders/'+bentoSaved.orderId);
 const bentoItem=bentoDoc.fields.items.arrayValue.values[0].mapValue.fields;
 const comp=bentoItem.bentoComposition.arrayValue.values;
 assert.equal(comp.length,1);assert.equal(comp[0].mapValue.fields.productId.stringValue,'m005');assert.equal(comp[0].mapValue.fields.quantity.integerValue,'2');
 const bentoRepeat=await post('/v1/orders',bentoBody);assert.equal(bentoRepeat.status,200);assert.equal((await bentoRepeat.json()).orderId,bentoSaved.orderId);
 const bentoDoc2=docs.get('projects/oyakoko-test/databases/(default)/documents/orders/'+bentoSaved.orderId);assert.equal(bentoDoc2.fields.revision.integerValue,'1');
 const bad=await api.fetch(new Request('https://example.test/v1/orders',{method:'POST',headers:{Origin:'https://evil.test'},body:'{}'}),env);assert.equal(bad.status,403);
 console.log('OK: API保存・再試行・改変ハッシュ・日付別連番・LINE報告・bentoComposition・revision・CORS（実データ未使用）');
}finally{globalThis.fetch=originalFetch;}
