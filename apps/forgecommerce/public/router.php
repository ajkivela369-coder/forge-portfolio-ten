<?php
declare(strict_types=1);

use ForgeCommerce\BusinessError;
use ForgeCommerce\Store;

require dirname(__DIR__) . '/src/Store.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function reply(int $code, array $data): void
{
    http_response_code($code);
    echo json_encode($data, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES) . "\n";
}

$path = (string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'GET' && $path === '/health') {
    reply(200, ['ok' => true, 'service' => 'ForgeCommerce', 'payments_enabled' => false]);
    return;
}
$validRoute = ($method === 'GET' && $path === '/v1/products') ||
    ($method === 'POST' && $path === '/v1/orders') ||
    ($method === 'GET' && preg_match('~^/v1/orders/ord-[0-9]{6,15}$~D', $path));
if (!$validRoute) {
    reply(404, ['error' => 'not_found']);
    return;
}
try {
    $stateFile = getenv('FORGECOMMERCE_STATE') ?: dirname(__DIR__) . '/var/state.json';
    $catalog = json_decode((string) file_get_contents(dirname(__DIR__) . '/fixtures/catalog.json'), true, 512, JSON_THROW_ON_ERROR);
    $store = new Store($stateFile, $catalog);
    if ($method === 'GET' && $path === '/v1/products') {
        reply(200, ['products' => $store->products()]);
        return;
    }
    $client = $_SERVER['HTTP_X_CLIENT_ID'] ?? '';
    Store::validateClient((string) $client);
    if ($method === 'GET') {
        reply(200, $store->order((string) $client, basename($path)));
        return;
    }
    $key = $_SERVER['HTTP_IDEMPOTENCY_KEY'] ?? '';
    if (!is_string($key) || !preg_match('/^[A-Za-z0-9_-]{8,128}$/D', $key)) {
        throw new BusinessError(428, 'invalid_idempotency_key');
    }
    $raw = file_get_contents('php://input', false, null, 0, 65537);
    if ($raw === false || strlen($raw) > 65536) {
        throw new BusinessError(413, 'body_too_large');
    }
    try {
        $payload = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        throw new BusinessError(400, 'invalid_json');
    }
    $result = $store->reserve((string) $client, $key, $payload);
    if ($result['replayed']) {
        header('Idempotency-Replayed: true');
    }
    reply($result['status'], $result['order']);
} catch (BusinessError $error) {
    reply($error->httpStatus, ['error' => $error->getMessage()]);
} catch (Throwable $error) {
    error_log('ForgeCommerce internal error: ' . $error->getMessage());
    reply(500, ['error' => 'internal_error']);
}
