"""Loopback-only HTTP smoke test for the locally launched ForgeCommerce PHP server.
Run: python tools/http_smoke.py http://127.0.0.1:4937
"""
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from uuid import uuid4

origin = sys.argv[1].rstrip('/')
url = urllib.parse.urlsplit(origin)
assert url.scheme == 'http' and url.hostname in ('127.0.0.1','localhost') and url.port, 'Loopback only'
client = 'client_' + uuid4().hex[:16]
key = 'request_' + uuid4().hex[:16]
headers = {'X-Client-Id': client, 'Idempotency-Key': key, 'Content-Type': 'application/json'}
checks = []

def request(path, method='GET', body=None, h=None):
    data = None if body is None else (body.encode() if isinstance(body, str) else json.dumps(body).encode())
    req = urllib.request.Request(origin+path, method=method, headers=h or {}, data=data)
    try:
        resp = urllib.request.urlopen(req, timeout=4)
    except urllib.error.HTTPError as e:
        resp = e
    with resp:
        return resp.status, json.loads(resp.read().decode()), dict(resp.headers)

def check(name, fn):
    fn()
    checks.append(name)
    print('PASS',name)

def assert_status(r, status): assert r[0]==status, (r[0], r[1])
def assert_eq(a,b): assert a==b, (a,b)

check('health', lambda: (lambda r: (assert_status(r,200), assert_eq(r[1]['payments_enabled'],False)))(request('/health')))


check('products', lambda: (lambda r: (assert_status(r,200), assert_eq(len(r[1]['products']),3)))(request('/v1/products')))
payload={'items':[{'sku':'BOOK-01','quantity':2},{'sku':'PIN-02','quantity':1}]}
state={}

def create():
    r=request('/v1/orders', 'POST',payload,headers)
    assert_status(r,201)
    assert_eq(r[1]['total_cents'],3397)
    state['order']=r[1]
check('create_order',create)

def replay():
    r=request('/v1/orders','POST',payload,headers)
    assert_status(r,200)
    assert_eq(r[1],state['order'])
    assert_eq(r[2].get('Idempotency-Replayed'),'true')
check('idempotent_replay',replay)
check('conflict',lambda:assert_status(request('/v1/orders','POST',{'items':[{'sku':'BOOK-01','quantity':1}]},headers),409))
check('scoped_retrieve',lambda:assert_status(request('/v1/orders/'+state['order']['id'],h=headers),200))
check('private_other_client',lambda:assert_status(request('/v1/orders/'+state['order']['id'],h={**headers,'X-Client-Id':'another_01'}),404))
check('invalid_json',lambda:assert_status(request('/v1/orders','POST','{bad',headers),400))
check('unknown_field',lambda:assert_status(request('/v1/orders','POST',{'items':payload['items'],'token':'secret'},headers),422))
check('missing_key',lambda:assert_status(request('/v1/orders','POST',payload,{'X-Client-Id':client,'Content-Type':'application/json'}),428))
check('oversized',lambda:assert_status(request('/v1/orders','POST','x'*70000,headers),413))
check('out_of_stock',lambda:assert_status(request('/v1/orders','POST',{'items':[{'sku':'PIN-02','quantity':3}]},{**headers,'Idempotency-Key':'request_'+uuid4().hex[:16]}),409))
print(json.dumps({'schema':'forgecommerce-http-smoke-v1','runtime':'php-built-in-loopback','passed':len(checks),'total':len(checks),'failures':0,'checks':checks},indent=2))
