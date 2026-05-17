<?php

namespace App\Services;

use App\Models\EncryptionKey;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Crypt;
use RuntimeException;

class EncryptionService
{
    private const CIPHER = 'aes-256-gcm';
    private const KEY_BYTES = 32;
    private const IV_BYTES = 12;
    private const TAG_BYTES = 16;

    /**
     * Get or create the per-patient data encryption key.
     */
    public function getPatientKey(string $patientAddress): string
    {
        $address = $this->normalizeAddress($patientAddress);
        $record = EncryptionKey::firstOrCreate(
            ['patient_address' => $address],
            ['encrypted_key' => Crypt::encryptString(base64_encode(random_bytes(self::KEY_BYTES)))]
        );

        try {
            $key = base64_decode(Crypt::decryptString($record->encrypted_key), true);
        } catch (DecryptException) {
            throw new RuntimeException('Unable to decrypt patient encryption key.');
        }

        if ($key === false || strlen($key) !== self::KEY_BYTES) {
            throw new RuntimeException('Invalid patient encryption key length.');
        }

        return $key;
    }

    public function encryptField(string $patientAddress, ?string $plaintext): ?string
    {
        if ($plaintext === null) {
            return null;
        }

        return $this->encryptBytes($this->getPatientKey($patientAddress), $plaintext);
    }

    public function decryptField(string $patientAddress, ?string $ciphertext): ?string
    {
        if ($ciphertext === null) {
            return null;
        }

        return $this->decryptBytes($this->getPatientKey($patientAddress), $ciphertext);
    }

    /**
     * Encrypt plaintext file bytes and return the encrypted payload plus the plaintext SHA-256 hash.
     *
     * @return array{encrypted_bytes: string, original_hash: string}
     */
    public function encryptFile(string $patientAddress, string $plaintextBytes): array
    {
        return [
            'encrypted_bytes' => $this->encryptBytes($this->getPatientKey($patientAddress), $plaintextBytes),
            'original_hash' => '0x' . hash('sha256', $plaintextBytes),
        ];
    }

    public function decryptFile(string $patientAddress, string $encryptedBytes): string
    {
        return $this->decryptBytes($this->getPatientKey($patientAddress), $encryptedBytes);
    }

    private function encryptBytes(string $key, string $plaintext): string
    {
        $iv = random_bytes(self::IV_BYTES);
        $tag = '';

        $ciphertext = openssl_encrypt(
            $plaintext,
            self::CIPHER,
            $key,
            OPENSSL_RAW_DATA,
            $iv,
            $tag,
            '',
            self::TAG_BYTES
        );

        if ($ciphertext === false) {
            throw new RuntimeException('Encryption failed.');
        }

        return base64_encode(json_encode([
            'v' => 1,
            'cipher' => self::CIPHER,
            'iv' => base64_encode($iv),
            'tag' => base64_encode($tag),
            'value' => base64_encode($ciphertext),
        ], JSON_THROW_ON_ERROR));
    }

    private function decryptBytes(string $key, string $payload): string
    {
        $decoded = base64_decode($payload, true);
        if ($decoded === false) {
            throw new RuntimeException('Invalid encrypted payload encoding.');
        }

        $data = json_decode($decoded, true, flags: JSON_THROW_ON_ERROR);
        foreach (['iv', 'tag', 'value'] as $field) {
            if (!isset($data[$field]) || !is_string($data[$field])) {
                throw new RuntimeException("Invalid encrypted payload: missing {$field}.");
            }
        }

        $iv = base64_decode($data['iv'], true);
        $tag = base64_decode($data['tag'], true);
        $ciphertext = base64_decode($data['value'], true);

        if ($iv === false || $tag === false || $ciphertext === false) {
            throw new RuntimeException('Invalid encrypted payload binary fields.');
        }

        $plaintext = openssl_decrypt(
            $ciphertext,
            self::CIPHER,
            $key,
            OPENSSL_RAW_DATA,
            $iv,
            $tag
        );

        if ($plaintext === false) {
            throw new RuntimeException('Decryption failed.');
        }

        return $plaintext;
    }

    private function normalizeAddress(string $address): string
    {
        return strtolower($address);
    }
}
