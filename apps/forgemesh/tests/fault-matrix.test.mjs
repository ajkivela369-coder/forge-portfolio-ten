import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createService } from "../reference/service.mjs";

async function withServer(run, maxEntries=1000) {
  const { server } = createService({ maxEntries });
  server.listen(0, "127.0.0.1");
  await once(server,"listening");
  const base = "http://127.0.0.1:" + server.address().port;
  try { return await run(base); }
  finally { await new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve())); }
}
const headers=(key="request-0001", client="team_01")=>({
  "content-type":"application/json", "x-client-id":client, "idempotency-key":key,
});
const post=(url,body,key="request-0001",client="team_01")=>fetch(url+"/v1/events",{
  method:"POST",headers:headers(key,client),body:JSON.stringify(body)
});

test("fault matrix: 30 parallel distinct requests produce 30 unique ordered event IDs",async()=>{
  await withServer(async url=>{
    const tasks=Array.from({length:30},(_,i)=>post(url,{topic:"event-log",payload:String(i)}, "request-"+String(i).padStart(6,"0")));
    const results=await Promise.all(tasks);
    assert.ok(results.every(r=>r.status===201));
    const events=await Promise.all(results.map(r=>r.json()));
    assert.equal(new Set(events.map(e=>e.id)).size,30);
    const listed=await fetch(url+"/v1/events?topic=event-log",{headers:headers()}).then(r=>r.json());
    assert.equal(listed.events.length,30);
  },50);
});

test("fault matrix: capacity remains enforced under 30 parallel writes",async()=>{
  await withServer(async url=>{
    const tasks=Array.from({length:30},(_,i)=>post(url,{topic:"capacity",payload:String(i)},"request-"+String(i).padStart(6,"0")));
    const results=await Promise.all(tasks);
    assert.equal(results.filter(r=>r.status===201).length,10);
    assert.equal(results.filter(r=>r.status===503).length,20);
    const listed=await fetch(url+"/v1/events?topic=capacity",{headers:headers()}).then(r=>r.json());
    assert.equal(listed.events.length,10);
  },10);
});

test("fault matrix: exact UTF-8 byte limit rejects multibyte payloads",async()=>{
  await withServer(async url=>{
    const accepted=await post(url,{topic:"bytes",payload:"€".repeat(341)},"request-0002");
    const rejected=await post(url,{topic:"bytes",payload:"€".repeat(342)},"request-0003");
    assert.equal(accepted.status,201);
    assert.equal(rejected.status,422);
  });
});

test("fault matrix: duplicate message JSON cannot be used to append two records",async()=>{
  await withServer(async url=>{
    const response=await fetch(url+"/v1/events",{
      method:"POST",headers:headers(),body:'{"topic":"safe","payload":"a"} {"topic":"safe","payload":"b"}',
    });
    assert.equal(response.status,400);
    const listed=await fetch(url+"/v1/events?topic=safe",{headers:headers()}).then(r=>r.json());
    assert.deepEqual(listed.events,[]);
  });
});

test("fault matrix: client scoped idempotency key is independent of identical content",async()=>{
  await withServer(async url=>{
    const event={topic:"build-ready",payload:"same"};
    const a=await post(url,event,"request-0001","team_01");
    const b=await post(url,event,"request-0001","team_02");
    assert.equal(a.status,201);assert.equal(b.status,201);
    const aa=await a.json(),bb=await b.json();
    assert.notEqual(aa.id,bb.id);
    const replay=await post(url,event,"request-0001","team_01");
    assert.equal(replay.status,200);
    assert.deepEqual(await replay.json(),aa);
  });
});

test("fault matrix: rejected inputs never consume capacity or event IDs",async()=>{
  await withServer(async url=>{
    assert.equal((await fetch(url+"/v1/events",{method:"POST",headers:{"x-client-id":"team_01"},
      body:'{"topic":"ready","payload":"invalid"}'})).status,428);
    assert.equal((await post(url,{topic:"../unsafe",payload:"bad"})).status,422);
    const valid=await post(url,{topic:"ready",payload:"valid"});
    assert.equal(valid.status,201);
    assert.equal((await valid.json()).id,"evt-000001");
  },1);
});
