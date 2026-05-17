<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\User;
use App\Services\BlockchainService;
use App\Services\EncryptionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DocumentController extends Controller
{
    public function __construct(
        private readonly BlockchainService $blockchain,
        private readonly EncryptionService $encryption,
    ) {
    }

    public function indexForPatient(string $address, Request $request): JsonResponse
    {
        $patientAddr = $this->validatedAddress($address, 'patient');
        $validated = $request->validate([
            'scope_id' => ['required', 'integer', 'min:1'],
            'provider_address' => ['required', 'string', 'regex:/^0x[a-fA-F0-9]{40}$/'],
        ]);

        $providerAddr = strtolower($validated['provider_address']);
        $scopeId = (int) $validated['scope_id'];
        $this->assertAuthenticatedProvider($request, $providerAddr);
        $this->assertProviderCanAccess($patientAddr, $providerAddr, $scopeId);

        $documents = Document::query()
            ->where('patient_address', $patientAddr)
            ->where('scope_id', $scopeId)
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (Document $document) => $this->serializeDocument($document));

        return response()->json(['documents' => $documents]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'patient_address' => ['required', 'string', 'regex:/^0x[a-fA-F0-9]{40}$/'],
            'provider_address' => ['required', 'string', 'regex:/^0x[a-fA-F0-9]{40}$/'],
            'scope_id' => ['required', 'integer', 'min:1'],
            'title' => ['required', 'string'],
            'description' => ['nullable', 'string'],
            'file' => ['nullable', 'file', 'max:20480'],
        ]);

        $patientAddr = strtolower($validated['patient_address']);
        $providerAddr = strtolower($validated['provider_address']);
        $scopeId = (int) $validated['scope_id'];
        $this->assertAuthenticatedProvider($request, $providerAddr);
        $this->assertProviderCanAccess($patientAddr, $providerAddr, $scopeId);

        $document = Document::create([
            'patient_address' => $patientAddr,
            'provider_address' => $providerAddr,
            'scope_id' => $scopeId,
            'title' => $this->encryption->encryptField($patientAddr, $validated['title']),
            'description' => $this->encryption->encryptField($patientAddr, $validated['description'] ?? null),
            'file_path' => null,
            'file_name' => null,
            'file_hash' => null,
            'tx_hash' => null,
            'mime_type' => null,
            'file_size' => 0,
        ]);

        $file = $request->file('file');

        if ($file !== null) {
            $plaintextBytes = file_get_contents($file->getRealPath());
            abort_if($plaintextBytes === false, 422, 'Unable to read uploaded file.');

            $patient = User::query()
                ->where('wallet_address', $patientAddr)
                ->where('role', 'patient')
                ->first();
            $baseName = $this->patientDocumentBaseName($patient?->name, $document->id);
            $extension = strtolower($file->getClientOriginalExtension() ?: 'bin');
            $downloadName = "{$baseName}.{$extension}";
            $storagePath = "documents/patients/{$patientAddr}/scope-{$scopeId}/{$baseName}.enc";
            $encryptedFile = $this->encryption->encryptFile($patientAddr, $plaintextBytes);

            Storage::disk('local')->put($storagePath, $encryptedFile['encrypted_bytes']);

            $document->update([
                'file_path' => $storagePath,
                'file_name' => $downloadName,
                'file_hash' => $encryptedFile['original_hash'],
                'mime_type' => $file->getClientMimeType(),
                'file_size' => $file->getSize() ?? strlen($plaintextBytes),
            ]);

            $document = $document->fresh();
        }

        return response()->json([
            'document' => $this->serializeDocument($document),
            'file_hash' => $document->file_hash,
        ], 201);
    }

    public function updateTxHash(Document $document, Request $request): JsonResponse
    {
        $validated = $request->validate([
            'tx_hash' => ['required', 'string', 'regex:/^0x[a-fA-F0-9]{64}$/'],
        ]);

        $document->update(['tx_hash' => strtolower($validated['tx_hash'])]);

        return response()->json(['document' => $this->serializeDocument($document->fresh())]);
    }

    public function file(Document $document, Request $request): StreamedResponse
    {
        $validated = $request->validate([
            'provider_address' => ['required', 'string', 'regex:/^0x[a-fA-F0-9]{40}$/'],
        ]);

        $providerAddr = strtolower($validated['provider_address']);
        $this->assertAuthenticatedProvider($request, $providerAddr);
        $this->assertProviderCanAccess($document->patient_address, $providerAddr, $document->scope_id);
        abort_if($document->file_path === null, 404, 'This scope entry does not have a file attachment.');

        $encrypted = Storage::disk('local')->get($document->file_path);
        abort_if($encrypted === null || $encrypted === false, 404, 'Document file not found.');

        $plaintext = $this->encryption->decryptFile($document->patient_address, $encrypted);

        return response()->streamDownload(
            fn () => print $plaintext,
            $document->file_name,
            ['Content-Type' => $document->mime_type ?: 'application/octet-stream']
        );
    }

    private function assertProviderCanAccess(string $patientAddr, string $providerAddr, int $scopeId): void
    {
        $provider = User::query()
            ->where('wallet_address', $providerAddr)
            ->where('role', 'provider')
            ->where('is_approved', true)
            ->first();

        abort_if($provider === null, 403, 'Provider is not approved by HealthChain.');
        abort_unless($this->blockchain->isRegisteredProvider($providerAddr), 403, 'Provider is not registered on-chain.');
        abort_unless($this->blockchain->hasAccess($patientAddr, $providerAddr, $scopeId), 403, 'No active on-chain permission for this scope.');
    }

    private function assertAuthenticatedProvider(Request $request, string $providerAddr): void
    {
        $user = $request->user();

        abort_unless(
            $user instanceof User && $user->role === 'provider' && strtolower($user->wallet_address) === $providerAddr,
            403,
            'Authenticated provider does not match the requested provider address.'
        );
    }

    private function serializeDocument(Document $document): array
    {
        return [
            'id' => $document->id,
            'patient_address' => $document->patient_address,
            'provider_address' => $document->provider_address,
            'scope_id' => $document->scope_id,
            'title' => $this->encryption->decryptField($document->patient_address, $document->title),
            'description' => $this->encryption->decryptField($document->patient_address, $document->description),
            'file_name' => $document->file_name,
            'file_hash' => $document->file_hash,
            'tx_hash' => $document->tx_hash,
            'mime_type' => $document->mime_type,
            'file_size' => $document->file_size,
            'created_at' => $document->created_at,
            'updated_at' => $document->updated_at,
        ];
    }

    private function validatedAddress(string $address, string $label): string
    {
        abort_unless(preg_match('/^0x[a-fA-F0-9]{40}$/', $address), 422, "Invalid {$label} address.");

        return strtolower($address);
    }

    private function patientDocumentBaseName(?string $patientName, int $documentId): string
    {
        $slug = Str::slug($patientName ?: 'patient');

        if ($slug === '') {
            $slug = 'patient';
        }

        return "{$slug}-doc-{$documentId}";
    }
}
