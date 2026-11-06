<?php
declare(strict_types=1);

require dirname(__DIR__) . '/src/Store.php';
use ForgeCommerce\BusinessError;
use ForgeCommerce\Store;

$catalog = json_decode((string) file_get_contents(dirname(__DIR__) . '/fixtures/catalog.json'), true, 512, JSON_THROW_ON_ERROR);
$folder = sys_get_temp_dir() . '/forgecommerce-' . bin2hex(random_bytes(8));
if (!mkdir($folder, 0700)) {
    throw new RuntimeException('Cannot make fixture dir');
}
$checks = 0;
$failures = [];
function check(string $name, callable $fn): void {
    global $checks, $failures;
    ++$checks;
    try {
        $fn();
        echo "PASS $name\n";
    } catch (Throwable $e) {
        $failures[] = $name . ': ' . $e->getMessage();
        echo "FAIL $name: {$e->getMessage()}\n";
    }
}
function requireTrue(bool $condition, string $details = 'Assertion failed'): void {
    if (!$condition) throw new RuntimeException($details);
}
function errorCode(callable $fn, int $status, string $message): void {
    try { $fn(); }
    catch (BusinessError $e) {
        requireTrue($e->httpStatus === $status && $e->getMessage() === $message,
            "Unexpected business error: {$e->httpStatus} {$e->getMessage()}");
        return;
    }
    throw new RuntimeException('Expected business error');
}
try {
    $file = $folder . '/state.json';
    $store = new Store($file, $catalog);
    $one = ['items' => [['sku'=>'BOOK-01','quantity'=>2],['sku'=>'PIN-02','quantity'=>1]]];
    check('initial catalog has 3 products', fn() => requireTrue(count($store->products()) === 3));
    check('state initialized on read', fn() => requireTrue(is_file($file)));
    check('rejects invalid client before any order', fn() => errorCode(fn() => $store->reserve('../bad', 'request-0001', $one),401,'invalid_client_label'));
    check('rejects missing idempotency key', fn() => errorCode(fn() => $store->reserve('client_01','', $one),428,'invalid_idempotency_key'));
    $created = null;
    check('reserves stock and totals exact integer cents', function() use ($store,$one,&$created) {
        $created = $store->reserve('client_01','request-0001',$one);
        requireTrue($created['status']===201 && !$created['replayed']);
        requireTrue($created['order']['total_cents']===3397);
        requireTrue($created['order']['id']==='ord-000001');
        $products = array_column($store->products(),null,'sku');
        requireTrue($products['BOOK-01']['stock']===3 && $products['PIN-02']['stock']===2);
    });
    check('replayed request does not consume additional stock', function()use($store,$one,$created) {
        $replay = $store->reserve('client_01','request-0001',$one);
        requireTrue($replay['status'] === 200 && $replay['replayed']);
        requireTrue($replay['order'] === $created['order']);
        requireTrue(array_column($store->products(),null,'sku')['BOOK-01']['stock'] === 3);
    });
    check('changed same idempotency key conflicts', fn() => errorCode(fn() => $store->reserve('client_01','request-0001', ['items'=>[['sku'=>'BOOK-01','quantity'=>1]]]),409,'idempotency_conflict'));
    check('isolation between client idempotency scopes', function()use($store,$one) {
        $r = $store->reserve('client_02','request-0001',$one);
        requireTrue($r['status']===201 && $r['order']['id']==='ord-000002');
    });
    check('order retrieval scoped to client', function()use($store) {
        requireTrue($store->order('client_01','ord-000001')['client_id']==='client_01');
        errorCode(fn()=>$store->order('client_02','ord-000001'),404,'order_not_found');
    });
    check('multi-line stock failure has no partial reservation', function()use($store) {
        $before = array_column($store->products(),null,'sku');
        errorCode(fn()=>$store->reserve('client_01','request-0002',['items'=>[['sku'=>'BOOK-01','quantity'=>1],['sku'=>'PIN-02','quantity'=>3]]]),409,'insufficient_stock');
        requireTrue($store->products() === array_values($before));
    });
    check('unknown SKU rejected', fn()=>errorCode(fn()=>$store->reserve('client_01','request-0003',['items'=>[['sku'=>'BAD-ITEM','quantity'=>1]]]),422,'unknown_sku'));
    check('duplicate SKU rejected', fn()=>errorCode(fn()=>$store->reserve('client_01','request-0004',['items'=>[['sku'=>'BOOK-01','quantity'=>1],['sku'=>'BOOK-01','quantity'=>1]]]),422,'invalid_order'));
    check('fractional quantity rejected', fn()=>errorCode(fn()=>$store->reserve('client_01','request-0005',['items'=>[['sku'=>'BOOK-01','quantity'=>1.5]]]),422,'invalid_order'));
    check('unexpected top-level input rejected', fn()=>errorCode(fn()=>$store->reserve('client_01','request-0006',['items'=>[['sku'=>'BOOK-01','quantity'=>1]],'token'=>'private']),422,'invalid_order'));
    check('persistence survives new Store instance', function()use($file,$catalog) {
        $other = new Store($file,$catalog);
        requireTrue($other->order('client_01','ord-000001')['total_cents']===3397);
        requireTrue(array_column($other->products(),null,'sku')['BOOK-01']['stock']===1);
    });
    check('idempotency survives restart', function()use($file,$catalog,$one) {
        $other = new Store($file,$catalog);
        $r=$other->reserve('client_01','request-0001',$one);
        requireTrue($r['status']===200 && $r['replayed']);
    });
    check('rejects invalid catalog', function()use($folder,$catalog) {
        $bad=$catalog; $bad[0]['unit_price_cents'] = 12.99;
        try {new Store($folder.'/broken.json',$bad);} catch (RuntimeException) {return;}
        throw new RuntimeException('Bad catalog accepted');
    });
} finally {
    foreach (glob($folder.'/*') ?: [] as $child) { if (is_file($child)) unlink($child); }
    rmdir($folder);
}
echo "RESULT: " . ($checks-count($failures)) . "/$checks passed; " . count($failures) . " failed\n";
if ($failures) exit(1);
