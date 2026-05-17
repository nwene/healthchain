<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'wallet_address' => ['required', 'string', 'regex:/^0x[a-fA-F0-9]{40}$/', 'unique:users,wallet_address'],
            'name' => ['required', 'string', 'max:255'],
            'role' => ['required', Rule::in(['patient', 'provider'])],
            'national_id' => ['nullable', 'string', 'max:255'],
            'medical_license' => ['nullable', 'string', 'max:255'],
            'organisation' => ['nullable', 'string', 'max:255'],
            'specialty' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255', 'unique:users,email'],
            'password' => ['nullable', 'string', 'min:8'],
        ]);

        $validated['wallet_address'] = strtolower($validated['wallet_address']);
        $validated['is_approved'] = $validated['role'] !== 'provider';

        if (!empty($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        }

        $user = User::create($validated);
        $token = $user->createToken('healthchain-api')->plainTextToken;

        return response()->json([
            'user' => $user,
            'token' => $token,
        ], 201);
    }

    public function walletLogin(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'wallet_address' => ['required', 'string', 'regex:/^0x[a-fA-F0-9]{40}$/'],
        ]);

        $user = User::query()
            ->where('wallet_address', strtolower($validated['wallet_address']))
            ->firstOrFail();

        $token = $user->createToken('healthchain-api')->plainTextToken;

        return response()->json([
            'user' => $user,
            'token' => $token,
        ]);
    }

    public function pendingProviders(Request $request): JsonResponse
    {
        $this->assertAdmin($request);

        return response()->json([
            'providers' => User::query()
                ->where('role', 'provider')
                ->where('is_approved', false)
                ->orderBy('created_at')
                ->get(),
        ]);
    }

    public function providers(Request $request): JsonResponse
    {
        $this->assertAdmin($request);

        return response()->json([
            'providers' => User::query()
                ->where('role', 'provider')
                ->orderByDesc('is_approved')
                ->orderBy('name')
                ->get(),
        ]);
    }

    public function approvedProviders(Request $request): JsonResponse
    {
        $user = $request->user();

        abort_unless($user instanceof User, 403, 'Authentication required.');

        return response()->json([
            'providers' => User::query()
                ->where('role', 'provider')
                ->where('is_approved', true)
                ->orderBy('name')
                ->get(),
        ]);
    }

    public function patients(Request $request): JsonResponse
    {
        $user = $request->user();

        abort_unless($user instanceof User, 403, 'Authentication required.');

        return response()->json([
            'patients' => User::query()
                ->where('role', 'patient')
                ->where('is_approved', true)
                ->orderBy('name')
                ->get(),
        ]);
    }

    public function approveProvider(string $address, Request $request): JsonResponse
    {
        $this->assertAdmin($request);

        $provider = $this->providerByAddress($address);
        $provider->update(['is_approved' => true]);

        return response()->json(['provider' => $provider->fresh()]);
    }

    public function rejectProvider(string $address, Request $request): JsonResponse
    {
        $this->assertAdmin($request);

        $provider = $this->providerByAddress($address);
        $provider->delete();

        return response()->json(['message' => 'Provider rejected.']);
    }

    public function disableProvider(string $address, Request $request): JsonResponse
    {
        $this->assertSuperAdmin($request);

        $provider = $this->providerByAddress($address);
        $provider->update(['is_approved' => false]);

        return response()->json(['provider' => $provider->fresh()]);
    }

    public function admins(Request $request): JsonResponse
    {
        $this->assertSuperAdmin($request);

        return response()->json([
            'admins' => User::query()
                ->where('role', 'admin')
                ->orderBy('created_at')
                ->get(),
        ]);
    }

    public function createAdmin(Request $request): JsonResponse
    {
        $this->assertSuperAdmin($request);

        $validated = $request->validate([
            'wallet_address' => ['required', 'string', 'regex:/^0x[a-fA-F0-9]{40}$/', 'unique:users,wallet_address'],
            'name' => ['required', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255', 'unique:users,email'],
            'password' => ['nullable', 'string', 'min:8'],
        ]);

        $validated['wallet_address'] = strtolower($validated['wallet_address']);
        $validated['role'] = 'admin';
        $validated['is_approved'] = true;

        if (!empty($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        }

        $admin = User::create($validated);

        return response()->json(['admin' => $admin], 201);
    }

    private function providerByAddress(string $address): User
    {
        abort_unless(preg_match('/^0x[a-fA-F0-9]{40}$/', $address), 422, 'Invalid provider address.');

        return User::query()
            ->where('wallet_address', strtolower($address))
            ->where('role', 'provider')
            ->firstOrFail();
    }

    private function assertAdmin(Request $request): void
    {
        $user = $request->user();

        abort_unless(
            $user instanceof User && $user->role === 'admin' && $user->is_approved,
            403,
            'Only approved admins can manage providers.'
        );
    }

    private function assertSuperAdmin(Request $request): void
    {
        $this->assertAdmin($request);

        $superAdmin = strtolower((string) config('services.blockchain.super_admin_address'));
        $wallet = strtolower((string) $request->user()->wallet_address);

        abort_unless(
            $wallet === $superAdmin,
            403,
            'Only Super Admin can do this.'
        );
    }
}
