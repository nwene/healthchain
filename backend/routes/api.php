<?php

use App\Http\Controllers\DocumentController;
use App\Http\Controllers\UserController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::post('/register', [UserController::class, 'register']);
Route::post('/login/wallet', [UserController::class, 'walletLogin']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/providers/pending', [UserController::class, 'pendingProviders']);
    Route::get('/providers', [UserController::class, 'providers']);
    Route::get('/providers/approved', [UserController::class, 'approvedProviders']);
    Route::post('/providers/{address}/approve', [UserController::class, 'approveProvider']);
    Route::post('/providers/{address}/reject', [UserController::class, 'rejectProvider']);
    Route::delete('/providers/{address}', [UserController::class, 'disableProvider']);
    Route::get('/admins', [UserController::class, 'admins']);
    Route::post('/admins', [UserController::class, 'createAdmin']);
    Route::get('/patients', [UserController::class, 'patients']);

    Route::get('/patients/{address}/documents', [DocumentController::class, 'indexForPatient']);
    Route::post('/documents', [DocumentController::class, 'store']);
    Route::patch('/documents/{document}/tx-hash', [DocumentController::class, 'updateTxHash']);
    Route::get('/documents/{document}/file', [DocumentController::class, 'file']);

    Route::get('/user', function (Request $request) {
        return $request->user();
    });
});
