import { useCallback, useEffect, useMemo, useState } from 'react'
import { downloadDocumentFile, getCurrentUser, getPatientDocuments, getPatients, loginWithWallet } from '../lib/api'
import {
  accessRecord,
  emergencyAccessRecord,
  getPermission,
  getProvider,
  getScopes,
  txUrl,
  uploadDocument,
} from '../lib/contract'
import { useWallet } from '../contexts/WalletProvider'

function shortAddress(address) {
  if (!address) {
    return 'Not connected'
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function formatDate(seconds) {
  if (!seconds) {
    return 'Not granted'
  }

  return new Date(seconds * 1000).toLocaleString()
}

function StatusMessage({ message }) {
  if (!message) {
    return null
  }

  const classes = {
    error: 'border-rose-200 bg-rose-50 text-rose-700',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    info: 'border-blue-200 bg-blue-50 text-blue-700',
  }

  return (
    <div className={`rounded-md border px-3 py-2 text-sm ${classes[message.type] || classes.info}`}>
      {message.link ? (
        <a className="font-medium underline underline-offset-2" href={message.link} target="_blank" rel="noreferrer">
          {message.text}
        </a>
      ) : message.text}
    </div>
  )
}

function Panel({ title, description, children }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl font-semibold text-ink">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}

function Field({ label, children }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-slate-700">
      <span>{label}</span>
      {children}
    </label>
  )
}

function inputClass(extra = '') {
  return `h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-chain focus:ring-2 focus:ring-blue-100 ${extra}`
}

export default function ProviderDashboard() {
  const wallet = useWallet()
  const [currentUser, setCurrentUser] = useState(null)
  const [scopes, setScopes] = useState([])
  const [patientsWithAccess, setPatientsWithAccess] = useState([])
  const [selectedAccessPatient, setSelectedAccessPatient] = useState(null)
  const [patientAddress, setPatientAddress] = useState('')
  const [selectedScopeId, setSelectedScopeId] = useState(1)
  const [permission, setPermission] = useState(null)
  const [providerInfo, setProviderInfo] = useState(null)
  const [documents, setDocuments] = useState([])
  const [modalDocuments, setModalDocuments] = useState([])
  const [uploadForm, setUploadForm] = useState({
    title: '',
    description: '',
    file: null,
  })
  const [modalUploadForm, setModalUploadForm] = useState({
    scopeId: '',
    title: '',
    description: '',
    file: null,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [busyAction, setBusyAction] = useState(null)
  const [message, setMessage] = useState(null)

  const providerAddress = wallet.address || currentUser?.wallet_address
  const isProvider = currentUser?.role === 'provider'
  const isApprovedProvider = isProvider && currentUser?.is_approved

  const selectedScope = useMemo(
    () => scopes.find((scope) => scope.id === Number(selectedScopeId)),
    [scopes, selectedScopeId],
  )

  const loadDashboard = useCallback(async () => {
    setIsLoading(true)
    setMessage(null)

    try {
      let [user, chainScopes] = await Promise.all([
        getCurrentUser(),
        getScopes(),
      ])

      if (wallet.address && user.wallet_address?.toLowerCase() !== wallet.address.toLowerCase()) {
        const login = await loginWithWallet(wallet.address)
        user = login.user
        chainScopes = await getScopes()
      }

      setCurrentUser(user)
      setScopes(chainScopes)
      if (user.role === 'provider') {
        setPatientsWithAccess(await loadPatientsWithAccess(user.wallet_address, chainScopes))
      } else {
        setPatientsWithAccess([])
      }

      if (!selectedScopeId && chainScopes.length) {
        setSelectedScopeId(chainScopes[0].id)
      }
    } catch (error) {
      if (wallet.address && [401, 403, 404].includes(error.response?.status)) {
        try {
          const login = await loginWithWallet(wallet.address)
          const chainScopes = await getScopes()

          setCurrentUser(login.user)
          setScopes(chainScopes)
          if (login.user.role === 'provider') {
            setPatientsWithAccess(await loadPatientsWithAccess(login.user.wallet_address, chainScopes))
          } else {
            setPatientsWithAccess([])
          }
          setIsLoading(false)
          return
        } catch (loginError) {
          setMessage({
            type: 'error',
            text: loginError.response?.data?.message || loginError.message || 'Unable to sign in with the connected wallet.',
          })
          setIsLoading(false)
          return
        }
      }

      setMessage({
        type: 'error',
        text: error.response?.data?.message || error.message || 'Unable to load provider dashboard.',
      })
    } finally {
      setIsLoading(false)
    }
  }, [selectedScopeId, wallet.address])

  async function loadPatientsWithAccess(address, chainScopes) {
    const patients = await getPatients()
    const rows = []

    for (const patient of patients) {
      const permissions = await Promise.all(chainScopes.map(async (scope) => ({
        scope,
        permission: await getPermission(patient.wallet_address, address, scope.id),
      })))
      const activeScopes = permissions
        .filter(({ permission }) => permission.active)
        .map(({ scope, permission }) => ({
          id: scope.id,
          name: scope.name,
          expiryTime: permission.expiryTime,
          grantedAt: permission.grantedAt,
        }))

      if (activeScopes.length > 0) {
        rows.push({
          ...patient,
          activeScopes,
        })
      }
    }

    return rows
  }

  function openPatientAccess(patient) {
    setSelectedAccessPatient(patient)
    setPatientAddress(patient.wallet_address)
    const firstScope = patient.activeScopes[0]?.id || selectedScopeId
    setSelectedScopeId(firstScope)
    setModalUploadForm({
      scopeId: String(firstScope),
      title: '',
      description: '',
      file: null,
    })
    loadModalDocuments(patient.wallet_address, firstScope)
  }

  async function loadModalDocuments(nextPatientAddress, scopeId) {
    setBusyAction('modal-documents')
    setMessage(null)

    try {
      const nextDocuments = await getPatientDocuments({
        patientAddress: nextPatientAddress,
        providerAddress,
        scopeId,
      })
      setModalDocuments(nextDocuments)
    } catch (error) {
      setModalDocuments([])
      setMessage({ type: 'error', text: error.response?.data?.message || error.message || 'Unable to load scope details.' })
    } finally {
      setBusyAction(null)
    }
  }

  function handleModalScopeChange(event) {
    const scopeId = Number(event.target.value)
    setModalUploadForm((current) => ({ ...current, scopeId: event.target.value }))
    setSelectedScopeId(scopeId)
    loadModalDocuments(selectedAccessPatient.wallet_address, scopeId)
  }

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  async function ensureWallet() {
    if (!wallet.address) {
      await wallet.connect()
    }
  }

  async function refreshAccess() {
    if (!patientAddress || !providerAddress || !selectedScopeId) {
      return null
    }

    const [chainProvider, nextPermission] = await Promise.all([
      getProvider(providerAddress),
      getPermission(patientAddress, providerAddress, selectedScopeId),
    ])

    setProviderInfo(chainProvider)
    setPermission(nextPermission)

    return nextPermission
  }

  async function handleCheckAccess(event) {
    event.preventDefault()
    setBusyAction('check')
    setMessage(null)

    try {
      await refreshAccess()
    } catch (error) {
      setMessage({ type: 'error', text: error.reason || error.message || 'Unable to check access.' })
    } finally {
      setBusyAction(null)
    }
  }

  async function handleLogAccess() {
    setBusyAction('access')
    setMessage({ type: 'info', text: 'Waiting for MetaMask signature to log record access.' })

    try {
      await ensureWallet()
      const tx = await accessRecord(patientAddress, selectedScopeId)
      setMessage({ type: 'success', text: `Access event logged. View tx: ${tx.hash}`, link: txUrl(tx.hash) })
      await refreshAccess()
    } catch (error) {
      setMessage({ type: 'error', text: error.reason || error.message || 'Unable to log access.' })
    } finally {
      setBusyAction(null)
    }
  }

  async function handleEmergencyAccess() {
    setBusyAction('emergency')
    setMessage({ type: 'info', text: 'Waiting for MetaMask signature to log emergency access.' })

    try {
      await ensureWallet()
      const tx = await emergencyAccessRecord(patientAddress, selectedScopeId)
      setMessage({ type: 'success', text: `Emergency access logged. View tx: ${tx.hash}`, link: txUrl(tx.hash) })
    } catch (error) {
      setMessage({ type: 'error', text: error.reason || error.message || 'Emergency access failed.' })
    } finally {
      setBusyAction(null)
    }
  }

  async function handleListDocuments() {
    setBusyAction('list')
    setMessage(null)

    try {
      const nextDocuments = await getPatientDocuments({
        patientAddress,
        providerAddress,
        scopeId: selectedScopeId,
      })
      setDocuments(nextDocuments)
      await refreshAccess()
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || error.message || 'Unable to load documents.' })
    } finally {
      setBusyAction(null)
    }
  }

  async function handleUpload(event) {
    event.preventDefault()
    setBusyAction('upload')
    setMessage({ type: 'info', text: 'Uploading encrypted document, then waiting for MetaMask hash anchoring.' })

    try {
      await ensureWallet()
      const result = await uploadDocument({
        patientAddress,
        providerAddress,
        scopeId: selectedScopeId,
        title: uploadForm.title,
        description: uploadForm.description,
        file: uploadForm.file,
      })

      setUploadForm({ title: '', description: '', file: null })
      await handleListDocuments()
      setMessage({ type: 'success', text: `Document uploaded. View hash tx: ${result.txHash}`, link: result.txUrl })
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || error.reason || error.message || 'Document upload failed.' })
    } finally {
      setBusyAction(null)
    }
  }

  async function handleModalUpload(event) {
    event.preventDefault()
    setBusyAction('modal-upload')
    setMessage({ type: 'info', text: 'Uploading encrypted document, then waiting for MetaMask hash anchoring.' })

    try {
      await ensureWallet()
      const scopeId = Number(modalUploadForm.scopeId)
      const result = await uploadDocument({
        patientAddress: selectedAccessPatient.wallet_address,
        providerAddress,
        scopeId,
        title: modalUploadForm.title,
        description: modalUploadForm.description,
        file: modalUploadForm.file,
      })

      setModalUploadForm({
        scopeId: String(scopeId),
        title: '',
        description: '',
        file: null,
      })
      await loadModalDocuments(selectedAccessPatient.wallet_address, scopeId)
      setMessage({
        type: 'success',
        text: result.txHash ? `Scope information saved. View hash tx: ${result.txHash}` : 'Scope information saved.',
        link: result.txUrl,
      })
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || error.reason || error.message || 'Document upload failed.' })
    } finally {
      setBusyAction(null)
    }
  }

  async function handleDownload(document) {
    setBusyAction(`download-${document.id}`)
    setMessage(null)

    try {
      const blob = await downloadDocumentFile(document.id, providerAddress)
      const url = URL.createObjectURL(blob)
      const anchor = window.document.createElement('a')
      anchor.href = url
      anchor.download = document.file_name
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || error.message || 'Unable to download file.' })
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-8">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase text-clinic">Provider</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink sm:text-4xl">Record access</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            View and add documents only after backend approval and active on-chain patient permission for the selected scope.
          </p>
        </div>
        <button
          type="button"
          onClick={loadDashboard}
          className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          Refresh
        </button>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <div className="font-mono text-sm font-semibold text-ink">{shortAddress(providerAddress)}</div>
          <div className="mt-1 text-sm text-slate-600">Provider wallet</div>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <div className={`text-xl font-semibold ${isApprovedProvider ? 'text-clinic' : 'text-amber-700'}`}>
            {isApprovedProvider ? 'Approved' : 'Pending'}
          </div>
          <div className="mt-1 text-sm text-slate-600">Backend status</div>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <div className="text-xl font-semibold text-ink">{documents.length}</div>
          <div className="mt-1 text-sm text-slate-600">Loaded documents</div>
        </div>
      </div>

      <StatusMessage message={message} />

      {!isLoading && !isProvider && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Sign in with a provider account to use provider workflows.
        </div>
      )}

      <Panel
        title="Patients with access granted"
        description="Patients who currently have active, non-expired on-chain permissions for your provider wallet."
      >
        {patientsWithAccess.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 p-6 text-sm text-slate-600">
            No patients have active access granted to this provider.
          </div>
        ) : (
          <div className="grid gap-3">
            {patientsWithAccess.map((patient) => (
              <article key={patient.wallet_address} className="rounded-md border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h3 className="font-semibold text-ink">{patient.name}</h3>
                    <div className="mt-1 break-all font-mono text-xs text-slate-500">{patient.wallet_address}</div>
                    {patient.national_id && <div className="mt-1 text-sm text-slate-600">National ID: {patient.national_id}</div>}
                  </div>
                  <div className="grid gap-3 lg:justify-items-end">
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      {patient.activeScopes.map((scope) => (
                        <span key={scope.id} className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-chain">
                          {scope.name} · expires {formatDate(scope.expiryTime)}
                        </span>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => openPatientAccess(patient)}
                      className="h-10 w-fit rounded-md bg-ink px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      View details
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </Panel>

      {selectedAccessPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <section className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-lg bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <p className="text-sm font-semibold uppercase text-clinic">Patient access</p>
                <h2 className="mt-1 text-2xl font-semibold text-ink">{selectedAccessPatient.name}</h2>
                <p className="mt-1 break-all font-mono text-xs text-slate-500">{selectedAccessPatient.wallet_address}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAccessPatient(null)}
                className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
              <div>
                <div className="text-xs uppercase text-slate-500">Patient identifier</div>
                <div className="mt-1 font-medium text-ink">{selectedAccessPatient.national_id || 'Not provided'}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-slate-500">Active access scopes</div>
                <div className="mt-2 grid gap-2">
                  {selectedAccessPatient.activeScopes.map((scope) => (
                    <div key={scope.id} className="rounded-md border border-slate-200 bg-white px-3 py-2">
                      <div className="font-semibold text-ink">{scope.name}</div>
                      <div className="mt-1 grid gap-1 text-sm text-slate-600">
                        <span>Granted: {formatDate(scope.grantedAt)}</span>
                        <span>Expires: {formatDate(scope.expiryTime)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <form className="mt-5 grid gap-4 border-t border-slate-200 pt-4" onSubmit={handleModalUpload}>
              <div>
                <h3 className="text-lg font-semibold text-ink">Add document to patient</h3>
                <p className="mt-1 text-sm text-slate-600">The backend re-verifies active on-chain access for the selected scope before saving.</p>
              </div>
              <Field label="Scope">
                <select
                  className={inputClass()}
                  value={modalUploadForm.scopeId}
                  onChange={handleModalScopeChange}
                  required
                >
                  {selectedAccessPatient.activeScopes.map((scope) => (
                    <option key={scope.id} value={scope.id}>{scope.id} - {scope.name}</option>
                  ))}
                </select>
              </Field>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-ink">Current scope information</h3>
                  <button
                    type="button"
                    onClick={() => loadModalDocuments(selectedAccessPatient.wallet_address, Number(modalUploadForm.scopeId))}
                    className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    Refresh
                  </button>
                </div>
                {busyAction === 'modal-documents' ? (
                  <div className="mt-4 text-sm text-slate-600">Loading scope details...</div>
                ) : modalDocuments.length === 0 ? (
                  <div className="mt-4 rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-600">
                    No information has been added to this scope yet.
                  </div>
                ) : (
                  <div className="mt-4 grid gap-3">
                    {modalDocuments.map((document) => (
                      <article key={document.id} className="rounded-md border border-slate-200 bg-white p-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <h4 className="font-semibold text-ink">{document.title}</h4>
                            <p className="mt-1 text-sm text-slate-600">{document.description || 'No description'}</p>
                            <div className="mt-2 grid gap-1 font-mono text-xs text-slate-500">
                              <span>{new Date(document.created_at).toLocaleString()}</span>
                              {document.file_name && <span>{document.file_name}</span>}
                              {document.file_hash && <span className="break-all">{document.file_hash}</span>}
                              {document.tx_hash && <span className="break-all">{document.tx_hash}</span>}
                            </div>
                          </div>
                          {document.file_name && (
                            <button
                              type="button"
                              onClick={() => handleDownload(document)}
                              disabled={busyAction === `download-${document.id}`}
                              className="h-10 rounded-md bg-ink px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Download
                            </button>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Title">
                  <input
                    className={inputClass()}
                    value={modalUploadForm.title}
                    onChange={(event) => setModalUploadForm((current) => ({ ...current, title: event.target.value }))}
                    required
                  />
                </Field>
                <Field label="File">
                  <input
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-chain focus:ring-2 focus:ring-blue-100"
                    type="file"
                    onChange={(event) => setModalUploadForm((current) => ({ ...current, file: event.target.files?.[0] ?? null }))}
                  />
                </Field>
              </div>
              <Field label="Description">
                <textarea
                  className="min-h-24 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-chain focus:ring-2 focus:ring-blue-100"
                  value={modalUploadForm.description}
                  onChange={(event) => setModalUploadForm((current) => ({ ...current, description: event.target.value }))}
                />
              </Field>
              <button
                type="submit"
                disabled={!modalUploadForm.scopeId || !modalUploadForm.title || busyAction === 'modal-upload'}
                className="h-10 w-fit rounded-md bg-clinic px-4 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busyAction === 'modal-upload' ? 'Saving' : 'Save scope information'}
              </button>
            </form>
          </section>
        </div>
      )}
    </main>
  )
}
