import axios from 'axios'

const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api`,
  headers: {
    Accept: 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = window.localStorage.getItem('healthchain_token')

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

export function setApiToken(token) {
  if (token) {
    window.localStorage.setItem('healthchain_token', token)
  } else {
    window.localStorage.removeItem('healthchain_token')
  }
}

export function getApiToken() {
  return window.localStorage.getItem('healthchain_token')
}

export async function registerUser(payload) {
  const { data } = await api.post('/register', payload)

  if (data.token) {
    setApiToken(data.token)
  }

  return data
}

export async function loginWithWallet(walletAddress) {
  const { data } = await api.post('/login/wallet', {
    wallet_address: walletAddress,
  })

  if (data.token) {
    setApiToken(data.token)
  }

  return data
}

export async function getCurrentUser() {
  const { data } = await api.get('/user')

  return data
}

export async function getPendingProviders() {
  const { data } = await api.get('/providers/pending')

  return data.providers
}

export async function getProviders() {
  const { data } = await api.get('/providers')

  return data.providers
}

export async function getApprovedProviders() {
  const { data } = await api.get('/providers/approved')

  return data.providers
}

export async function approveProvider(address) {
  const { data } = await api.post(`/providers/${address}/approve`)

  return data.provider
}

export async function rejectProvider(address) {
  const { data } = await api.post(`/providers/${address}/reject`)

  return data
}

export async function disableProvider(address) {
  const { data } = await api.delete(`/providers/${address}`)

  return data.provider
}

export async function getAdmins() {
  const { data } = await api.get('/admins')

  return data.admins
}

export async function createAdmin(payload) {
  const { data } = await api.post('/admins', payload)

  return data.admin
}

export async function getPatients() {
  const { data } = await api.get('/patients')

  return data.patients
}

export async function getPatientDocuments({ patientAddress, scopeId, providerAddress }) {
  const { data } = await api.get(`/patients/${patientAddress}/documents`, {
    params: {
      scope_id: scopeId,
      provider_address: providerAddress,
    },
  })

  return data.documents
}

export async function createDocument({ patientAddress, providerAddress, scopeId, title, description, file }) {
  const formData = new FormData()
  formData.append('patient_address', patientAddress)
  formData.append('provider_address', providerAddress)
  formData.append('scope_id', String(scopeId))
  formData.append('title', title)

  if (description) {
    formData.append('description', description)
  }

  if (file) {
    formData.append('file', file)
  }

  const { data } = await api.post('/documents', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

  return data
}

export async function updateDocumentTxHash(documentId, txHash) {
  const { data } = await api.patch(`/documents/${documentId}/tx-hash`, {
    tx_hash: txHash,
  })

  return data.document
}

export async function downloadDocumentFile(documentId, providerAddress) {
  const response = await api.get(`/documents/${documentId}/file`, {
    params: { provider_address: providerAddress },
    responseType: 'blob',
  })

  return response.data
}

export default api
