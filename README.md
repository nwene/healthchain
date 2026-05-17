# HealthChain

HealthChain is a patient-controlled health data access management system. Patients grant granular, time-limited access to sensitive health data through an Ethereum Sepolia smart contract, while encrypted clinical records and file attachments stay in a local PostgreSQL-backed Laravel application.

## Stack

- Smart contract: Solidity 0.8.20, Hardhat, Ethereum Sepolia
- Backend: Laravel 11, PostgreSQL, Laravel Sanctum, local file storage
- Frontend: React 18, Vite, Tailwind CSS, ethers.js v6, wagmi
- Encryption: per-patient AES-256-GCM data encryption keys
- Storage: PostgreSQL plus encrypted files in `backend/storage/app/documents`

## Repository Layout

```text
contracts/   Hardhat project and PatientHealthAccessControl contract
backend/     Laravel API, database migrations, services, controllers
frontend/    React/Vite client application
```

## Core Rules

- The backend verifies on-chain permissions before serving documents or files.
- Blockchain writes are signed by users in MetaMask from the frontend.
- The backend never writes to the blockchain.
- Sensitive database fields are encrypted before storage.
- Files are encrypted before saving to local disk.
- Document hashes are computed from plaintext, not ciphertext.
- Providers must be approved in the backend and registered on-chain.
- No cloud database or cloud file storage is required.

## Local Requirements

- Node.js and npm
- PHP 8.2+
- Composer
- PostgreSQL
- MetaMask
- Sepolia ETH for accounts that send transactions
- Alchemy Sepolia RPC URL

## Environment Files

Create local `.env` files from the examples in each project. Do not commit real secrets.

### `contracts/.env`

```env
DEPLOYER_PRIVATE_KEY=your_metamask_private_key_without_0x
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
```

### `backend/.env`

```env
APP_NAME=HealthChain
APP_URL=http://localhost:8000
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=healthchain
DB_USERNAME=postgres
DB_PASSWORD=postgres
BLOCKCHAIN_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
CONTRACT_ADDRESS=0xYOUR_DEPLOYED_CONTRACT_ADDRESS
FILESYSTEM_DISK=local
```

### `frontend/.env`

```env
VITE_CONTRACT_ADDRESS=0xYOUR_DEPLOYED_CONTRACT_ADDRESS
VITE_SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
VITE_API_URL=http://localhost:8000
```

## Setup

### 1. Database

```bash
psql -U postgres -c "CREATE DATABASE healthchain;"
```

### 2. Smart Contract

```bash
cd contracts
npm install
npx hardhat compile
npx hardhat run scripts/deploy.js --network sepolia
```

Copy the deployed contract address into `backend/.env` and `frontend/.env`.

### 3. Backend

```bash
cd backend
composer install
php artisan key:generate
php artisan migrate
php artisan serve
```

The API runs at `http://localhost:8000/api`.

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs at the Vite URL printed in the terminal, usually `http://localhost:5173`.

## Main Flow

1. Admin signs in and approves provider registrations in the backend.
2. Super admin registers approved providers on-chain with `registerProvider`.
3. Patient connects MetaMask and grants scope-specific access to a provider.
4. Provider sees only patients who granted them access.
5. Provider can view permitted patient scope details and optionally add documents.
6. Patient can review providers with access and revoke permissions.
7. Patient logs and admin logs show blockchain audit activity.

## Local File Storage

Encrypted uploaded files are written to:

```text
backend/storage/app/documents/patients/{patient_address}/scope-{scope_id}/{file}.enc
```

The application uses Laravel's `local` disk only.

## Security Notes

- Keep `.env` files private.
- Never commit private keys, Alchemy keys, database passwords, uploaded medical files, or logs.
- Use test accounts and Sepolia ETH only.
- Rotate keys immediately if a private key was ever exposed.

