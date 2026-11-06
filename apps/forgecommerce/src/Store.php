<?php
declare(strict_types=1);

namespace ForgeCommerce;

use RuntimeException;
use Throwable;

/** Local, file-backed stock and order-reservation prototype.
 * No payments, card numbers, authentication, public network or guaranteed power-loss durability.
 */
final class BusinessError extends RuntimeException
{
    public function __construct(public readonly int $httpStatus, string $code)
    {
        parent::__construct($code);
    }
}

final class Store
{
    private const CLIENT = '/^[A-Za-z0-9_-]{3,64}$/D';
    private const KEY = '/^[A-Za-z0-9_-]{8,128}$/D';
    private const SKU = '/^[A-Z0-9-]{2,24}$/D';

    public function __construct(private readonly string $stateFile, private readonly array $initialCatalog)
    {
        if ($stateFile === '' || !is_dir(dirname($stateFile))) {
            throw new RuntimeException('State directory must already exist');
        }
        $this->catalogToState($initialCatalog); // validate even if state exists
    }

    /** @return array{products:array<string,array<string,mixed>>,orders:array<string,mixed>,keys:array<string,mixed>,next_id:int} */
    private function catalogToState(array $catalog): array
    {
        $products = [];
        foreach ($catalog as $product) {
            if (!is_array($product) || array_keys($product) !== ['sku', 'title', 'unit_price_cents', 'stock']) {
                throw new RuntimeException('Malformed catalog record');
            }
            $sku = $product['sku'];
            if (!is_string($sku) || !preg_match(self::SKU, $sku) || isset($products[$sku])) {
                throw new RuntimeException('Duplicate or invalid SKU');
            }
            if (!is_string($product['title']) || trim($product['title']) === '' || strlen($product['title']) > 128 ||
                !is_int($product['unit_price_cents']) || $product['unit_price_cents'] < 1 || $product['unit_price_cents'] > 1000000 ||
                !is_int($product['stock']) || $product['stock'] < 0 || $product['stock'] > 100000) {
                throw new RuntimeException('Invalid catalog field');
            }
            $products[$sku] = $product;
        }
        if (!$products) {
            throw new RuntimeException('Catalog cannot be empty');
        }
        ksort($products);
        return ['products' => $products, 'orders' => [], 'keys' => [], 'next_id' => 1];
    }

    /** Lock uses a dedicated *.lock file rather than an inode replaced during atomic writes. */
    private function transact(callable $action): mixed
    {
        $lock = fopen($this->stateFile . '.lock', 'c+');
        if ($lock === false) {
            throw new RuntimeException('Cannot open state lock');
        }
        try {
            if (!flock($lock, LOCK_EX)) {
                throw new RuntimeException('Cannot lock state');
            }
            if (is_file($this->stateFile)) {
                $state = json_decode((string) file_get_contents($this->stateFile), true, 512, JSON_THROW_ON_ERROR);
                if (!is_array($state) || ($state['schema'] ?? null) !== 'forgecommerce-state-v1') {
                    throw new RuntimeException('State schema invalid');
                }
            } else {
                $state = ['schema' => 'forgecommerce-state-v1'] + $this->catalogToState($this->initialCatalog);
            }
            [$result, $changed] = $action($state);
            if ($changed || !is_file($this->stateFile)) {
                $bytes = json_encode($state, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
                $temporary = $this->stateFile . '.tmp.' . bin2hex(random_bytes(8));
                try {
                    if (file_put_contents($temporary, $bytes, LOCK_EX) !== strlen($bytes) ||
                        !rename($temporary, $this->stateFile)) {
                        throw new RuntimeException('Failed to persist state');
                    }
                } finally {
                    if (is_file($temporary)) {
                        unlink($temporary);
                    }
                }
            }
            return $result;
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }

    public static function validateClient(string $client): void
    {
        if (!preg_match(self::CLIENT, $client)) {
            throw new BusinessError(401, 'invalid_client_label');
        }
    }

    public function products(): array
    {
        return $this->transact(static fn(array &$state) => [array_values($state['products']), false]);
    }

    public function order(string $client, string $id): array
    {
        self::validateClient($client);
        if (!preg_match('/^ord-[0-9]{6,15}$/D', $id)) {
            throw new BusinessError(404, 'order_not_found');
        }
        return $this->transact(static function (array &$state) use ($client, $id) {
            if (!isset($state['orders'][$id]) || $state['orders'][$id]['client_id'] !== $client) {
                throw new BusinessError(404, 'order_not_found');
            }
            return [$state['orders'][$id], false];
        });
    }

    public function reserve(string $client, string $key, mixed $payload): array
    {
        self::validateClient($client);
        if (!preg_match(self::KEY, $key)) {
            throw new BusinessError(428, 'invalid_idempotency_key');
        }
        if (!is_array($payload) || array_keys($payload) !== ['items'] ||
            !is_array($payload['items']) || !array_is_list($payload['items']) ||
            count($payload['items']) < 1 || count($payload['items']) > 20) {
            throw new BusinessError(422, 'invalid_order');
        }
        $lines = [];
        foreach ($payload['items'] as $line) {
            if (!is_array($line) || array_keys($line) !== ['sku', 'quantity'] ||
                !is_string($line['sku']) || !preg_match(self::SKU, $line['sku']) ||
                !is_int($line['quantity']) || $line['quantity'] < 1 || $line['quantity'] > 100 ||
                isset($lines[$line['sku']])) {
                throw new BusinessError(422, 'invalid_order');
            }
            $lines[$line['sku']] = $line['quantity'];
        }
        ksort($lines);
        $hash = hash('sha256', json_encode($lines, JSON_THROW_ON_ERROR));
        $scope = $client . ':' . $key;
        return $this->transact(static function (array &$state) use ($client, $scope, $hash, $lines) {
            if (isset($state['keys'][$scope])) {
                $existing = $state['keys'][$scope];
                if ($existing['request_sha256'] !== $hash) {
                    throw new BusinessError(409, 'idempotency_conflict');
                }
                return [['status' => 200, 'order' => $state['orders'][$existing['order_id']], 'replayed' => true], false];
            }
            $total = 0;
            $items = [];
            foreach ($lines as $sku => $qty) {
                if (!isset($state['products'][$sku])) {
                    throw new BusinessError(422, 'unknown_sku');
                }
                $product = $state['products'][$sku];
                if ($product['stock'] < $qty) {
                    throw new BusinessError(409, 'insufficient_stock');
                }
                $sum = $product['unit_price_cents'] * $qty;
                $total += $sum;
                $items[] = ['sku' => $sku, 'quantity' => $qty,
                    'unit_price_cents' => $product['unit_price_cents'], 'line_total_cents' => $sum];
            }
            if ($total > 50000000) {
                throw new BusinessError(422, 'order_total_too_high');
            }
            foreach ($lines as $sku => $qty) {
                $state['products'][$sku]['stock'] -= $qty;
            }
            $id = sprintf('ord-%06d', $state['next_id']++);
            $order = ['id' => $id, 'client_id' => $client, 'status' => 'stock_reserved',
                'items' => $items, 'total_cents' => $total];
            $state['orders'][$id] = $order;
            $state['keys'][$scope] = ['request_sha256' => $hash, 'order_id' => $id];
            return [['status' => 201, 'order' => $order, 'replayed' => false], true];
        });
    }
}
