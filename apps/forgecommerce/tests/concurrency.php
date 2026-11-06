<?php
declare(strict_types=1);
require dirname(__DIR__) . '/src/Store.php';
use ForgeCommerce\BusinessError;
use ForgeCommerce\Store;
if (!function_exists('pcntl_fork')) {
    echo "SKIP: pcntl_fork is not available on this platform\n";
    exit(0);
}
$dir = sys_get_temp_dir() . '/forgecommerce-concurrent-' . bin2hex(random_bytes(8));
if (!mkdir($dir, 0700)) throw new RuntimeException('Cannot create test dir');
$catalog=[['sku'=>'BOOK-01','title'=>'Race fixture','unit_price_cents'=>500,'stock'=>5]];
$path=$dir.'/state.json';
$children=[];
try {
    (new Store($path,$catalog))->products();
    for($i=0;$i<4;$i++) {
        $child=pcntl_fork();
        if ($child === -1) throw new RuntimeException('Fork failed');
        if ($child === 0) {
            try {
                $result=(new Store($path,$catalog))->reserve('client_01','request-'.$i.'0000', ['items'=>[['sku'=>'BOOK-01','quantity'=>2]]]);
                exit($result['status'] === 201 ? 0 : 4);
            } catch (BusinessError $e) {
                exit($e->httpStatus === 409 ? 10 : 5);
            } catch (Throwable $e) {
                exit(6);
            }
        }
        $children[]=$child;
    }
    $success=0;$stockFailures=0;
    foreach ($children as $pid) {
        pcntl_waitpid($pid, $status);
        $code=pcntl_wexitstatus($status);
        if ($code === 0) $success++;
        elseif($code === 10) $stockFailures++;
        else throw new RuntimeException('Child process failed '.$pid.': '.$code);
    }
    $products=array_column((new Store($path,$catalog))->products(),null,'sku');
    if($success!==2 || $stockFailures!==2 || $products['BOOK-01']['stock']!==1) {
        throw new RuntimeException("Oversell/race detected: successes=$success rejected=$stockFailures stock=".$products['BOOK-01']['stock']);
    }
    echo "PASS concurrent stock gate: 2 orders accepted, 2 rejected, 1 stock left\n";
} finally {
    foreach(glob($dir.'/*') ?: [] as $f) if(is_file($f)) unlink($f);
    rmdir($dir);
}
