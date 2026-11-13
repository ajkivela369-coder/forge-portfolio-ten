import test from "node:test";
import assert from "node:assert/strict";
import worker, {safeUrl, validatePayload, handleRedirectValidation} from "../worker.mjs";

const HOST = "https://forge-studio-portfolio.forge-studio-ajkivela.workers.dev";
const HEADERS = {"origin":HOST,"content-type":"application/json"};
const env = (extra={}) => ({
 ALLOWED_AUDIT_HOSTS: "example.com,www.example.com,example.org,www.example.org,github.com",
 SEARCHSIGNAL_RATE: {limit: async ({key,delta}) => ({success:true})},
 ...extra,
});
const req = (value,headers=HEADERS,method="POST") =>
 new Request(HOST+"/api/redirect-validate",{
  method,
  headers,
  ...(method === "POST" ? {body:JSON.stringify({json:value})}:{}),
 });
const payload = (mappings=[{from:"/old",to:"/new"}],baseUrl="https://example.com")=>({baseUrl,mappings});
const parse = async r => (await r.json()).json;
const fake = sequence => {
 let n=0,paths=[];
 const f=async (url,opts)=>{
  paths.push({url,opts});
  if(n>=sequence.length)throw Error("unexpected outbound request");
  const item=sequence[n++];
  return new Response(item.body||"",{status:item.status,headers:item.headers||{"content-type":"text/html"}});
 };
 f.paths=paths;
 return f;
};

test("returns a real observed two-hop chain and canonical instead of guessing",async()=>{
 const transport=fake([
  {status:301,headers:{location:"/new"}},
  {status:200,body:'<html><link href="/new" rel="canonical"><title>Destination</title></html>',headers:{"content-type":"text/html"}},
 ]);
 const r=await handleRedirectValidation(req(payload()),env(),transport);
 assert.equal(r.status,200);
 const result=(await parse(r)).results[0];
 assert.equal(result.sourceUrl,"https://example.com/old");
 assert.equal(result.observedStatus,301);
 assert.equal(result.finalUrl,"https://example.com/new");
 assert.equal(result.finalCanonical,"https://example.com/new");
 assert.equal(result.chain.length,2);
 assert.deepEqual(result.chain.map(x=>x.status),[301,200]);
 assert.equal(result.reachesIntendedDestination,true);
 assert.equal(result.proposedApacheRule,"Redirect 301 /old /new");
 assert.equal(transport.paths.length,2);
 for(const {opts} of transport.paths){
   assert.equal(opts.method,"GET");
   assert.equal(opts.redirect,"manual");
   assert.equal(opts.headers.cookie,undefined);
   assert.equal(opts.headers.authorization,undefined);
 }
});

test("does not invent matches for an observed 404",async()=>{
 const r=await handleRedirectValidation(req(payload()),env(),fake([{status:404,body:"Not found"}]));
 const v=(await parse(r)).results[0];
 assert.equal(v.observedStatus,404);
 assert.equal(v.reachesIntendedDestination,false);
 assert.equal(v.finalUrl,"https://example.com/old");
 assert.equal(v.chain[0].status,404);
});

test("blocks a redirect to an unapproved host without fetching it",async()=>{
 const transport=fake([{status:302,headers:{location:"https://169.254.169.254/latest/meta-data/"}}]);
 const r=await handleRedirectValidation(req(payload()),env(),transport);
 const result=(await parse(r)).results[0];
 assert.equal(result.finalUrl,null);
 assert.match(result.error,/outside approved/i);
 assert.equal(result.reachesIntendedDestination,false);
 assert.equal(transport.paths.length,1);
});

test("refuses redirect to same-domain HTTP downgrade",async()=>{
 const transport=fake([{status:301,headers:{location:"http://example.com/new"}}]);
 const result=(await parse(await handleRedirectValidation(req(payload()),env(),transport))).results[0];
 assert.equal(transport.paths.length,1);
 assert.equal(result.finalUrl,null);
});

test("limits redirect loops to at most five observed responses",async()=>{
 const transport=fake(Array.from({length:5},()=>({status:302,headers:{location:"/old"}})));
 const res=(await parse(await handleRedirectValidation(req(payload()),env(),transport))).results[0];
 assert.equal(transport.paths.length,5);
 assert.equal(res.chain.length,5);
 assert.equal(res.truncated,true);
 assert.equal(res.finalUrl,null);
});

test("approved list is exact, preventing hostname suffix tricks",()=>{
 const ok=new Set(["example.com"]);
 for(const url of ["https://example.com.evil.org/", "https://evil-example.com/",
  "https://example.com@evil.net/","http://example.com/","https://127.0.0.1/",
  "https://[::1]/","https://localhost/","https://foo.internal/","https://example.com:8443/"]){
   assert.throws(()=>safeUrl(url,ok),url);
 }
 assert.equal(safeUrl("https://example.com/ok#fragment",ok).href,"https://example.com/ok");
});

test("rejects unapproved baseURL and mappings before outbound network",async()=>{
 let count=0;
 const fetcher=async()=>{count++;return new Response("");};
 for(const [base,mappings] of [
  ["https://untrusted.example/",[{from:"/a",to:"/b"}]],
  ["https://example.com",[{from:"//untrusted.example/a",to:"/b"}]],
  ["https://example.com",[{from:"https://foo.example.net/a",to:"/b"}]],
  ["https://example.com",[{from:"/a",to:"http://example.com/b"}]],
  ["https://example.com",[{from:"/a",to:"//169.254.169.254/b"}]],
 ]){
  const r=await handleRedirectValidation(req(payload(mappings,base)),env(),fetcher);
  assert.equal(r.status,422);
 }
 assert.equal(count,0);
});

test("handles superjson and plain JSON in the expected client response shape",async()=>{
 const r=await handleRedirectValidation(req(payload()),env(),fake([{status:200,body:"page"}]));
 const encoded=await r.json();
 assert.ok(Array.isArray(encoded.json.results));
 assert.equal(encoded.json.results[0].observedStatus,200);
 const plain=new Request(HOST+"/api/redirect-validate",{
  method:"POST",headers:HEADERS,body:JSON.stringify(payload()),
 });
 const p=await handleRedirectValidation(plain,env(),fake([{status:200}]));
 assert.equal((await parse(p)).results.length,1);
});

test("enforces origin, content type and method",async()=>{
 const transport=()=>{throw Error("network should not be touched")};
 const badOrigin=await handleRedirectValidation(req(payload(),{"origin":"https://evil.net","content-type":"application/json"}),env(),transport);
 assert.equal(badOrigin.status,403);
 const badType=await handleRedirectValidation(req(payload(),{"origin":HOST,"content-type":"text/plain"}),env(),transport);
 assert.equal(badType.status,415);
 const get=await handleRedirectValidation(new Request(HOST+"/api/redirect-validate",{method:"GET"}),env(),transport);
 assert.equal(get.status,405);
 assert.equal(get.headers.get("allow"),"POST");
});

test("enforces rate-limit binding availability and quota before external fetch",async()=>{
 const fetcher=()=>{throw Error("network should not be touched");};
 const noBinding=await handleRedirectValidation(req(payload()),env({SEARCHSIGNAL_RATE:null}),fetcher);
 assert.equal(noBinding.status,503);
 const exceeded=await handleRedirectValidation(req(payload()),env({SEARCHSIGNAL_RATE:{limit:async()=>({success:false})}}),fetcher);
 assert.equal(exceeded.status,429);
});

test("enforces maximum mappings and body size",async()=>{
 const fetcher=()=>{throw Error("network should not be touched")};
 const many=Array.from({length:9},(_,i)=>({from:"/old"+i,to:"/new"+i}));
 assert.equal((await handleRedirectValidation(req(payload(many)),env(),fetcher)).status,422);
 const huge=new Request(HOST+"/api/redirect-validate",{method:"POST",headers:HEADERS,body:"x".repeat(17000)});
 assert.equal((await handleRedirectValidation(huge,env(),fetcher)).status,422);
});

test("a fetch failure is represented as unresolved, never as observed success",async()=>{
 const result=(await parse(await handleRedirectValidation(req(payload()),env(),async()=>{throw Error("outage")}))).results[0];
 assert.equal(result.observedStatus,null);
 assert.equal(result.finalUrl,null);
 assert.equal(result.reachesIntendedDestination,false);
 assert.match(result.error,/failed/i);
});

test("returns partial observation when a redirect location is missing",async()=>{
 const result=(await parse(await handleRedirectValidation(req(payload()),env(),fake([
 {status:301,headers:{"content-type":"text/html"}}
 ])))).results[0];
 assert.equal(result.observedStatus,301);
 assert.equal(result.reachesIntendedDestination,false);
 assert.equal(result.chain.length,1);
});

test("preserves verified production asset semantics on Ember paths and other static routes",async()=>{
 const reqApi=new Request(HOST+"/api/ember/state",{method:"GET"});
 const reqAsset=new Request(HOST+"/apps/searchsignal/",{method:"GET"});
 const calls=[];
 const mock={
  EMBER_SERVICE:{fetch:async req=>{calls.push("ember");return new Response("EM", {status:202});}},
  ASSETS:{fetch:async req=>{calls.push("assets");return new Response("AS", {status:201});}},
 };
 assert.equal((await worker.fetch(reqApi,mock)).status,201);
 assert.equal((await worker.fetch(reqAsset,mock)).status,201);
 assert.deepEqual(calls,["assets","assets"]);
});


test("identity mapping without an observed redirect is not falsely marked as a redirect success",async()=>{
 const r=await handleRedirectValidation(req(payload([{from:"/",to:"/"}])),env(),fake([{status:200,body:"ok"}]));
 const result=(await parse(r)).results[0];
 assert.equal(result.observedStatus,200);
 assert.equal(result.reachesIntendedDestination,false);
 assert.match(result.proposedApacheRule,/No redirect proposed/);
});
