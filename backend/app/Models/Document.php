<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Document extends Model
{
    use HasFactory;

    protected $fillable = [
        'patient_address',
        'provider_address',
        'scope_id',
        'title',
        'description',
        'file_path',
        'file_name',
        'file_hash',
        'tx_hash',
        'mime_type',
        'file_size',
    ];

    protected function casts(): array
    {
        return [
            'scope_id' => 'integer',
            'file_size' => 'integer',
        ];
    }
}
