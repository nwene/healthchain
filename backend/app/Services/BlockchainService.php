<?php

namespace App\Services;

use GuzzleHttp\Client;
use RuntimeException;

class BlockchainService
{
    private const GET_PERMISSION_SELECTOR = '0x584fa0d8';
    private const PROVIDERS_SELECTOR = '0x0787bc27';
    private const VERIFY_DATA_HASH_SELECTOR = '0x41553359';

    public function __construct(
        private readonly ?Client $client = null,
    ) {
    }

    public function hasAccess(string $patient, string $provider, int $scopeId): bool
    {
        [$granted, $expiryTime] = $this->getPermission($patient, $provider, $scopeId);

        return $granted && ($expiryTime === 0 || time() <= $expiryTime);
    }

    /**
     * @return array{0: bool, 1: int, 2: int}
     */
    public function getPermission(string $patient, string $provider, int $scopeId): array
    {
        $result = $this->ethCall(
            self::GET_PERMISSION_SELECTOR
            . $this->encodeAddress($patient)
            . $this->encodeAddress($provider)
            . $this->encodeUint($scopeId)
        );

        return [
            $this->decodeBool($result, 0),
            $this->decodeUint($result, 1),
            $this->decodeUint($result, 2),
        ];
    }

    public function isRegisteredProvider(string $provider): bool
    {
        $result = $this->ethCall(
            self::PROVIDERS_SELECTOR
            . $this->encodeAddress($provider)
        );

        return $this->decodeBool($result, 0);
    }

    public function verifyHash(string $patient, int $scopeId, string $hash): bool
    {
        if (strtolower($hash) === '0x' . str_repeat('0', 64)) {
            return false;
        }

        $result = $this->ethCall(
            self::VERIFY_DATA_HASH_SELECTOR
            . $this->encodeAddress($patient)
            . $this->encodeUint($scopeId)
            . $this->encodeBytes32($hash)
        );

        return $this->decodeBool($result, 0);
    }

    private function ethCall(string $data): string
    {
        $rpcUrl = config('services.blockchain.rpc_url');
        $contractAddress = config('services.blockchain.contract_address');

        if (!is_string($rpcUrl) || $rpcUrl === '') {
            throw new RuntimeException('Blockchain RPC URL is not configured.');
        }

        if (!is_string($contractAddress) || !preg_match('/^0x[a-fA-F0-9]{40}$/', $contractAddress)) {
            throw new RuntimeException('Blockchain contract address is not configured.');
        }

        $response = $this->httpClient()->post($rpcUrl, [
            'json' => [
                'jsonrpc' => '2.0',
                'id' => 1,
                'method' => 'eth_call',
                'params' => [[
                    'to' => $contractAddress,
                    'data' => $data,
                ], 'latest'],
            ],
        ]);

        $payload = json_decode((string) $response->getBody(), true, flags: JSON_THROW_ON_ERROR);

        if (isset($payload['error'])) {
            $message = $payload['error']['message'] ?? 'Unknown JSON-RPC error.';
            throw new RuntimeException("Blockchain call failed: {$message}");
        }

        if (!isset($payload['result']) || !is_string($payload['result'])) {
            throw new RuntimeException('Blockchain call returned an invalid response.');
        }

        return $payload['result'];
    }

    private function httpClient(): Client
    {
        return $this->client ?? new Client([
            'timeout' => 15,
            'connect_timeout' => 10,
        ]);
    }

    private function encodeAddress(string $address): string
    {
        $normalized = strtolower($address);
        if (!preg_match('/^0x[a-f0-9]{40}$/', $normalized)) {
            throw new RuntimeException("Invalid Ethereum address: {$address}");
        }

        return str_pad(substr($normalized, 2), 64, '0', STR_PAD_LEFT);
    }

    private function encodeUint(int $value): string
    {
        if ($value < 0) {
            throw new RuntimeException('Unsigned integer cannot be negative.');
        }

        return str_pad(dechex($value), 64, '0', STR_PAD_LEFT);
    }

    private function encodeBytes32(string $hash): string
    {
        $normalized = strtolower($hash);
        if (!preg_match('/^0x[a-f0-9]{64}$/', $normalized)) {
            throw new RuntimeException("Invalid bytes32 hash: {$hash}");
        }

        return substr($normalized, 2);
    }

    private function decodeBool(string $result, int $wordIndex): bool
    {
        return $this->word($result, $wordIndex) === str_repeat('0', 63) . '1';
    }

    private function decodeUint(string $result, int $wordIndex): int
    {
        return intval(hexdec($this->word($result, $wordIndex)));
    }

    private function word(string $result, int $wordIndex): string
    {
        $hex = str_starts_with($result, '0x') ? substr($result, 2) : $result;
        $word = substr($hex, $wordIndex * 64, 64);

        if (strlen($word) !== 64) {
            throw new RuntimeException('Blockchain response is shorter than expected.');
        }

        return strtolower($word);
    }
}
