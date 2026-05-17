import { BrowserProvider, Contract, JsonRpcProvider } from 'ethers'
import { createDocument, updateDocumentTxHash } from './api'

export const SEPOLIA_CHAIN_ID = 11155111n
export const SEPOLIA_CHAIN_ID_HEX = '0xaa36a7'
export const EXPLORER_BASE_URL = 'https://sepolia.etherscan.io'

export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS
export const SEPOLIA_RPC_URL = import.meta.env.VITE_SEPOLIA_RPC_URL
export const CONTRACT_DEPLOY_BLOCK = Number(import.meta.env.VITE_CONTRACT_DEPLOY_BLOCK || 0)
const AUDIT_LOG_BLOCK_STEP = 10
const AUDIT_LOG_REQUEST_DELAY_MS = 400
const AUDIT_LOG_CACHE_MS = 60_000
const AUDIT_LOG_RETRY_DELAYS_MS = [1200, 2500, 5000]
let auditLogCache = null
let auditLogRequest = null

export const CONTRACT_ABI = [
  'function admin() view returns (address)',
  'function providers(address) view returns (bool isRegistered, string name)',
  'function scopes(uint256) view returns (string)',
  'function scopeCount() view returns (uint256)',
  'function emergencyContacts(address) view returns (address)',
  'function dataHashes(address,uint256) view returns (bytes32)',
  'function registerProvider(address provider, string name)',
  'function removeProvider(address provider)',
  'function addScope(string name)',
  'function grantAccess(address provider, uint256 scopeId, uint256 durationSecs)',
  'function grantAccessBatch(address provider, uint256[] scopeIds, uint256 durationSecs)',
  'function revokeAccess(address provider, uint256 scopeId)',
  'function revokeAllAccess(address provider)',
  'function setEmergencyContact(address contact)',
  'function registerDataHash(uint256 scopeId, bytes32 hash)',
  'function checkAccess(address patient, uint256 scopeId) view returns (bool)',
  'function accessRecord(address patient, uint256 scopeId) returns (string)',
  'function emergencyAccessRecord(address patient, uint256 scopeId) returns (string)',
  'function getPermission(address patient, address provider, uint256 scopeId) view returns (bool granted, uint256 expiryTime, uint256 grantedAt)',
  'function verifyDataHash(address patient, uint256 scopeId, bytes32 hash) view returns (bool)',
  'event ProviderRegistered(address indexed provider, string name)',
  'event ProviderRemoved(address indexed provider)',
  'event ScopeAdded(uint256 indexed scopeId, string name)',
  'event AccessGranted(address indexed patient, address indexed provider, uint256 indexed scopeId, uint256 expiryTime)',
  'event AccessRevoked(address indexed patient, address indexed provider, uint256 indexed scopeId)',
  'event RecordAccessed(address indexed patient, address indexed provider, uint256 indexed scopeId, uint256 timestamp)',
  'event AccessDenied(address indexed patient, address indexed provider, uint256 indexed scopeId, string reason)',
  'event EmergencyContactSet(address indexed patient, address indexed emergencyContact)',
  'event EmergencyAccessUsed(address indexed patient, address indexed emergencyContact, uint256 indexed scopeId)',
  'event DataHashRegistered(address indexed patient, uint256 indexed scopeId, bytes32 dataHash)',
]

function assertConfigured() {
  if (!CONTRACT_ADDRESS || !/^0x[a-fA-F0-9]{40}$/.test(CONTRACT_ADDRESS)) {
    throw new Error('VITE_CONTRACT_ADDRESS is not configured.')
  }

  if (!SEPOLIA_RPC_URL) {
    throw new Error('VITE_SEPOLIA_RPC_URL is not configured.')
  }
}

function requireMetaMask() {
  if (!window.ethereum) {
    throw new Error('MetaMask is required.')
  }

  return window.ethereum
}

async function ensureSepolia() {
  const ethereum = requireMetaMask()
  const chainId = await ethereum.request({ method: 'eth_chainId' })

  if (chainId?.toLowerCase() === SEPOLIA_CHAIN_ID_HEX) {
    return
  }

  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: SEPOLIA_CHAIN_ID_HEX }],
    })
  } catch (error) {
    if (error?.code !== 4902) {
      throw error
    }

    await ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: SEPOLIA_CHAIN_ID_HEX,
        chainName: 'Ethereum Sepolia',
        nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: [SEPOLIA_RPC_URL],
        blockExplorerUrls: [EXPLORER_BASE_URL],
      }],
    })
  }

  const nextChainId = await ethereum.request({ method: 'eth_chainId' })

  if (nextChainId?.toLowerCase() !== SEPOLIA_CHAIN_ID_HEX) {
    throw new Error('Switch MetaMask to Ethereum Sepolia before continuing.')
  }
}

export async function connectWallet() {
  const ethereum = requireMetaMask()
  await ethereum.request({ method: 'eth_requestAccounts' })
  await ensureSepolia()
  const provider = new BrowserProvider(ethereum, Number(SEPOLIA_CHAIN_ID))
  const signer = await provider.getSigner()

  return {
    address: await signer.getAddress(),
    provider,
    signer,
  }
}

export function getReadContract() {
  assertConfigured()

  return new Contract(
    CONTRACT_ADDRESS,
    CONTRACT_ABI,
    new JsonRpcProvider(SEPOLIA_RPC_URL, Number(SEPOLIA_CHAIN_ID)),
  )
}

export async function getWriteContract() {
  assertConfigured()

  await ensureSepolia()
  const provider = new BrowserProvider(requireMetaMask(), Number(SEPOLIA_CHAIN_ID))
  const signer = await provider.getSigner()

  return new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer)
}

export function txUrl(txHash) {
  return `${EXPLORER_BASE_URL}/tx/${txHash}`
}

export function addressUrl(address) {
  return `${EXPLORER_BASE_URL}/address/${address}`
}

function normalizeLogValue(value) {
  if (typeof value === 'bigint') {
    return Number(value)
  }

  if (Array.isArray(value)) {
    return value.map(normalizeLogValue)
  }

  return value
}

function auditSummary(eventName, args) {
  if (eventName === 'ProviderRegistered') {
    return `Provider registered: ${args.provider}`
  }

  if (eventName === 'ProviderRemoved') {
    return `Provider removed: ${args.provider}`
  }

  if (eventName === 'ScopeAdded') {
    return `Scope ${args.scopeId} added: ${args.name}`
  }

  if (eventName === 'AccessGranted') {
    return `Access granted to ${args.provider} for scope ${args.scopeId}`
  }

  if (eventName === 'AccessRevoked') {
    return `Access revoked from ${args.provider} for scope ${args.scopeId}`
  }

  if (eventName === 'RecordAccessed') {
    return `Record accessed by ${args.provider} for scope ${args.scopeId}`
  }

  if (eventName === 'AccessDenied') {
    return `Access denied for ${args.provider} on scope ${args.scopeId}`
  }

  if (eventName === 'EmergencyContactSet') {
    return `Emergency contact set: ${args.emergencyContact}`
  }

  if (eventName === 'EmergencyAccessUsed') {
    return `Emergency access used by ${args.emergencyContact} for scope ${args.scopeId}`
  }

  if (eventName === 'DataHashRegistered') {
    return `Document hash anchored for scope ${args.scopeId}`
  }

  return eventName
}

async function enrichAuditLogs(logs, contract, provider) {
  const blockTimes = new Map()
  const parsedLogs = []

  for (const log of logs) {
    let parsed

    try {
      parsed = contract.interface.parseLog(log)
    } catch {
      continue
    }

    if (!blockTimes.has(log.blockNumber)) {
      const block = await provider.getBlock(log.blockNumber)
      blockTimes.set(log.blockNumber, Number(block.timestamp))
    }

    const args = {}
    parsed.fragment.inputs.forEach((input, index) => {
      args[input.name] = normalizeLogValue(parsed.args[index])
    })

    parsedLogs.push({
      id: `${log.transactionHash}-${log.index}`,
      event: parsed.name,
      args,
      summary: auditSummary(parsed.name, args),
      transactionHash: log.transactionHash,
      blockNumber: log.blockNumber,
      timestamp: blockTimes.get(log.blockNumber),
    })
  }

  return parsedLogs.sort((left, right) => (
    right.blockNumber - left.blockNumber || right.id.localeCompare(left.id)
  ))
}

function isPatientAuditLog(log, patientAddress) {
  return log.args.patient?.toLowerCase() === patientAddress.toLowerCase()
}

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function isRateLimitError(error) {
  const message = [
    error?.message,
    error?.shortMessage,
    error?.info?.responseBody,
    error?.error?.message,
  ].filter(Boolean).join(' ')

  return error?.code === 429 || message.includes('429') || message.includes('compute units')
}

async function getLogsWithRetry(provider, filter) {
  for (let attempt = 0; attempt <= AUDIT_LOG_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await provider.getLogs(filter)
    } catch (error) {
      if (!isRateLimitError(error) || attempt === AUDIT_LOG_RETRY_DELAYS_MS.length) {
        throw error
      }

      await delay(AUDIT_LOG_RETRY_DELAYS_MS[attempt])
    }
  }

  return []
}

export async function getAuditLogs() {
  assertConfigured()

  const now = Date.now()

  if (auditLogCache && now - auditLogCache.createdAt < AUDIT_LOG_CACHE_MS) {
    return auditLogCache.logs
  }

  if (auditLogRequest) {
    return auditLogRequest
  }

  auditLogRequest = loadAuditLogs().finally(() => {
    auditLogRequest = null
  })

  return auditLogRequest
}

async function loadAuditLogs() {
  const provider = new JsonRpcProvider(SEPOLIA_RPC_URL, Number(SEPOLIA_CHAIN_ID))
  const contract = getReadContract()
  const latest = await provider.getBlockNumber()
  const fromBlock = CONTRACT_DEPLOY_BLOCK || Math.max(0, latest - 1000)
  const logs = []

  for (let start = fromBlock; start <= latest; start += AUDIT_LOG_BLOCK_STEP) {
    const end = Math.min(start + AUDIT_LOG_BLOCK_STEP - 1, latest)
    const chunk = await getLogsWithRetry(provider, {
      address: CONTRACT_ADDRESS,
      fromBlock: start,
      toBlock: end,
    })

    logs.push(...chunk)

    if (end < latest) {
      await delay(AUDIT_LOG_REQUEST_DELAY_MS)
    }
  }

  const enrichedLogs = await enrichAuditLogs(logs, contract, provider)
  auditLogCache = {
    createdAt: Date.now(),
    logs: enrichedLogs,
  }

  return enrichedLogs
}

export async function getPatientAuditLogs(patientAddress) {
  const logs = await getAuditLogs()

  return logs.filter((log) => isPatientAuditLog(log, patientAddress))
}

export async function getAllAuditLogs() {
  return getAuditLogs()
}

async function waitForTx(tx) {
  const receipt = await tx.wait()

  return {
    hash: tx.hash,
    receipt,
  }
}

export async function getAdmin() {
  return getReadContract().admin()
}

export async function getScopeCount() {
  return Number(await getReadContract().scopeCount())
}

export async function getScopes() {
  const contract = getReadContract()
  const count = Number(await contract.scopeCount())
  const scopes = []

  for (let scopeId = 1; scopeId <= count; scopeId += 1) {
    scopes.push({
      id: scopeId,
      name: await contract.scopes(scopeId),
    })
  }

  return scopes
}

export async function getEmergencyContact(patient) {
  return getReadContract().emergencyContacts(patient)
}

export async function getDataHash(patient, scopeId) {
  return getReadContract().dataHashes(patient, scopeId)
}

export async function getProvider(address) {
  const [isRegistered, name] = await getReadContract().providers(address)

  return { address, isRegistered, name }
}

export async function isRegisteredProvider(address) {
  const provider = await getProvider(address)

  return provider.isRegistered
}

export async function getPermission(patient, provider, scopeId) {
  const [granted, expiryTime, grantedAt] = await getReadContract().getPermission(patient, provider, scopeId)

  return {
    granted,
    expiryTime: Number(expiryTime),
    grantedAt: Number(grantedAt),
    active: granted && (expiryTime === 0n || BigInt(Math.floor(Date.now() / 1000)) <= expiryTime),
  }
}

export async function verifyDataHash(patient, scopeId, hash) {
  if (hash === `0x${'0'.repeat(64)}`) {
    return false
  }

  return getReadContract().verifyDataHash(patient, scopeId, hash)
}

export async function registerProvider(provider, name) {
  const contract = await getWriteContract()
  const tx = await contract.registerProvider(provider, name)

  return waitForTx(tx)
}

export async function removeProvider(provider) {
  const contract = await getWriteContract()
  const tx = await contract.removeProvider(provider)

  return waitForTx(tx)
}

export async function addScope(name) {
  const contract = await getWriteContract()
  const tx = await contract.addScope(name)

  return waitForTx(tx)
}

export async function grantAccess(provider, scopeId, durationSecs) {
  const contract = await getWriteContract()
  const tx = await contract.grantAccess(provider, scopeId, durationSecs)

  return waitForTx(tx)
}

export async function grantAccessBatch(provider, scopeIds, durationSecs) {
  const contract = await getWriteContract()
  const tx = await contract.grantAccessBatch(provider, scopeIds, durationSecs)

  return waitForTx(tx)
}

export async function revokeAccess(provider, scopeId) {
  const contract = await getWriteContract()
  const tx = await contract.revokeAccess(provider, scopeId)

  return waitForTx(tx)
}

export async function revokeAllAccess(provider) {
  const contract = await getWriteContract()
  const tx = await contract.revokeAllAccess(provider)

  return waitForTx(tx)
}

export async function setEmergencyContact(contact) {
  const contract = await getWriteContract()
  const tx = await contract.setEmergencyContact(contact)

  return waitForTx(tx)
}

export async function registerDataHash(scopeId, hash) {
  const contract = await getWriteContract()
  const tx = await contract.registerDataHash(scopeId, hash)

  return waitForTx(tx)
}

export async function accessRecord(patient, scopeId) {
  const contract = await getWriteContract()
  const tx = await contract.accessRecord(patient, scopeId)

  return waitForTx(tx)
}

export async function emergencyAccessRecord(patient, scopeId) {
  const contract = await getWriteContract()
  const tx = await contract.emergencyAccessRecord(patient, scopeId)

  return waitForTx(tx)
}

export async function uploadDocument({ patientAddress, providerAddress, scopeId, title, description, file }) {
  const data = await createDocument({ patientAddress, providerAddress, scopeId, title, description, file })

  if (!data.file_hash) {
    return {
      document: data.document,
      fileHash: null,
      txHash: null,
      txUrl: null,
    }
  }

  const { hash } = await registerDataHash(scopeId, data.file_hash)

  await updateDocumentTxHash(data.document.id, hash)

  return {
    document: data.document,
    fileHash: data.file_hash,
    txHash: hash,
    txUrl: txUrl(hash),
  }
}
