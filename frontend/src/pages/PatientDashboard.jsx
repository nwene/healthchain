import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getApprovedProviders,
  getCurrentUser,
  loginWithWallet,
} from '../lib/api'
import {
  getDataHash,
  getEmergencyContact,
  getPermission,
  getProvider,
  getScopes,
  grantAccess,
  grantAccessBatch,
  revokeAccess,
  revokeAllAccess,
  setEmergencyContact,
  txUrl,
} from '../lib/contract'
import { useWallet } from '../contexts/WalletProvider'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const ZERO_HASH = `0x${'0'.repeat(64)}`
const DURATION_PRESETS = {
  1: '1 day',
  7: '7 days',
  30: '30 days',
  90: '90 days',
}

function shortAddress(address) {
  if (!address || address === ZERO_ADDRESS) {
    return 'Not set'
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function formatDate(seconds) {
  if (!seconds) {
    return 'Not granted'
  }

  return new Date(seconds * 1000).toLocaleString()
}

function toDatetimeLocal(date) {
  const local = new Date(date.getTime() - (date.getTimezoneOffset() * 60 * 1000))

  return local.toISOString().slice(0, 16)
}

function secondsFromNowTo(value) {
  const end = new Date(value).getTime()

  if (Number.isNaN(end)) {
    return 0
  }

  return Math.floor((end - Date.now()) / 1000)
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

export default function PatientDashboard() {
  const wallet = useWallet()
  const [currentUser, setCurrentUser] = useState(null)
  const [scopes, setScopes] = useState([])
  const [scopeHashes, setScopeHashes] = useState([])
  const [providersWithAccess, setProvidersWithAccess] = useState([])
  const [emergencyContact, setEmergencyContactState] = useState(ZERO_ADDRESS)
  const [providerAddress, setProviderAddress] = useState('')
  const [selectedScopeId, setSelectedScopeId] = useState(1)
  const [durationDays, setDurationDays] = useState(7)
  const [durationMode, setDurationMode] = useState('preset')
  const [customStartAt, setCustomStartAt] = useState(() => toDatetimeLocal(new Date()))
  const [customEndAt, setCustomEndAt] = useState(() => toDatetimeLocal(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)))
  const [selectedBatchScopes, setSelectedBatchScopes] = useState([])
  const [permission, setPermission] = useState(null)
  const [selectedAccessProvider, setSelectedAccessProvider] = useState(null)
  const [newEmergencyContact, setNewEmergencyContact] = useState('')
  const [providerInfo, setProviderInfo] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [busyAction, setBusyAction] = useState(null)
  const [message, setMessage] = useState(null)

  const patientAddress = wallet.address || currentUser?.wallet_address
  const isPatient = currentUser?.role === 'patient'

  const selectedScope = useMemo(
    () => scopes.find((scope) => scope.id === Number(selectedScopeId)),
    [scopes, selectedScopeId],
  )

  const customDurationSeconds = useMemo(() => secondsFromNowTo(customEndAt), [customEndAt])
  const customStartIsFuture = useMemo(() => {
    const start = new Date(customStartAt).getTime()

    return !Number.isNaN(start) && start > Date.now() + 60 * 1000
  }, [customStartAt])

  const selectedDurationLabel = useMemo(() => {
    if (durationMode === 'preset') {
      return DURATION_PRESETS[durationDays] || `${durationDays} days`
    }

    if (customDurationSeconds <= 0) {
      return 'Invalid custom range'
    }

    return `${customStartIsFuture ? 'Starts on-chain now, ' : ''}expires ${new Date(customEndAt).toLocaleString()}`
  }, [customDurationSeconds, customEndAt, customStartIsFuture, durationDays, durationMode])

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

      const address = user.wallet_address
      const [contact, hashes, approvedProviders] = await Promise.all([
        getEmergencyContact(address),
        Promise.all(chainScopes.map(async (scope) => ({
          ...scope,
          hash: await getDataHash(address, scope.id),
        }))),
        getApprovedProviders(),
      ])
      const providerAccess = await loadProvidersWithAccess(address, approvedProviders, chainScopes)

      setEmergencyContactState(contact)
      setScopeHashes(hashes)
      setProvidersWithAccess(providerAccess)
      if (!selectedScopeId && chainScopes.length) {
        setSelectedScopeId(chainScopes[0].id)
      }
    } catch (error) {
      if (wallet.address && [401, 403, 404].includes(error.response?.status)) {
        try {
          const login = await loginWithWallet(wallet.address)
          const chainScopes = await getScopes()
          const address = login.user.wallet_address
          const [contact, hashes, approvedProviders] = await Promise.all([
            getEmergencyContact(address),
            Promise.all(chainScopes.map(async (scope) => ({
              ...scope,
              hash: await getDataHash(address, scope.id),
            }))),
            getApprovedProviders(),
          ])
          const providerAccess = await loadProvidersWithAccess(address, approvedProviders, chainScopes)

          setCurrentUser(login.user)
          setScopes(chainScopes)
          setEmergencyContactState(contact)
          setScopeHashes(hashes)
          setProvidersWithAccess(providerAccess)
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
        text: error.response?.data?.message || error.message || 'Unable to load patient dashboard.',
      })
    } finally {
      setIsLoading(false)
    }
  }, [selectedScopeId, wallet.address])

  async function loadProvidersWithAccess(address, approvedProviders, chainScopes) {
    const rows = []

    for (const provider of approvedProviders) {
      const permissions = await Promise.all(chainScopes.map(async (scope) => ({
        scope,
        permission: await getPermission(address, provider.wallet_address, scope.id),
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
          ...provider,
          activeScopes,
        })
      }
    }

    return rows
  }

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  async function ensureWallet() {
    if (!wallet.address) {
      await wallet.connect()
    }
  }

  function getDurationSeconds() {
    if (durationMode === 'preset') {
      return Number(durationDays) * 24 * 60 * 60
    }

    if (customDurationSeconds <= 0) {
      throw new Error('Choose a custom end date in the future.')
    }

    return customDurationSeconds
  }

  async function refreshPermission() {
    if (!patientAddress || !providerAddress || !selectedScopeId) {
      return
    }

    const [chainProvider, nextPermission] = await Promise.all([
      getProvider(providerAddress),
      getPermission(patientAddress, providerAddress, selectedScopeId),
    ])

    setProviderInfo(chainProvider)
    setPermission(nextPermission)
  }

  async function ensureRegisteredProvider() {
    const chainProvider = await getProvider(providerAddress)
    setProviderInfo(chainProvider)

    if (!chainProvider.isRegistered) {
      throw new Error('This provider is approved locally but is not registered on-chain yet. Ask the Super Admin to approve/register the provider first.')
    }
  }

  async function handleCheckPermission(event) {
    event?.preventDefault()
    setBusyAction('check')
    setMessage(null)

    try {
      await refreshPermission()
    } catch (error) {
      setMessage({ type: 'error', text: error.reason || error.message || 'Unable to check permission.' })
    } finally {
      setBusyAction(null)
    }
  }

  async function handleGrant(event) {
    event.preventDefault()
    setBusyAction('grant')
    setMessage({ type: 'info', text: 'Waiting for MetaMask signature to grant access.' })

    try {
      await ensureWallet()
      await ensureRegisteredProvider()
      const durationSecs = getDurationSeconds()
      const tx = await grantAccess(providerAddress, selectedScopeId, durationSecs)
      await refreshPermission()
      setMessage({ type: 'success', text: `Access granted. View tx: ${tx.hash}`, link: txUrl(tx.hash) })
    } catch (error) {
      setMessage({ type: 'error', text: error.reason || error.message || 'Unable to grant access.' })
    } finally {
      setBusyAction(null)
    }
  }

  async function handleGrantBatch() {
    if (selectedBatchScopes.length === 0) {
      return
    }

    setBusyAction('grantBatch')
    setMessage({ type: 'info', text: 'Waiting for MetaMask signature to grant batch access.' })

    try {
      await ensureWallet()
      await ensureRegisteredProvider()
      const durationSecs = getDurationSeconds()
      const tx = await grantAccessBatch(providerAddress, selectedBatchScopes, durationSecs)
      await refreshPermission()
      setMessage({ type: 'success', text: `Batch access granted. View tx: ${tx.hash}`, link: txUrl(tx.hash) })
    } catch (error) {
      setMessage({ type: 'error', text: error.reason || error.message || 'Unable to grant batch access.' })
    } finally {
      setBusyAction(null)
    }
  }

  async function refreshAccessProviders() {
    if (!patientAddress || scopes.length === 0) {
      return
    }

    const approvedProviders = await getApprovedProviders()
    const providerAccess = await loadProvidersWithAccess(patientAddress, approvedProviders, scopes)
    setProvidersWithAccess(providerAccess)
    setSelectedAccessProvider((current) => {
      if (!current) {
        return null
      }

      return providerAccess.find((provider) => provider.wallet_address === current.wallet_address) || null
    })
  }

  async function handleRevokeProviderScope(provider, scopeId) {
    setBusyAction(`revoke-${provider.wallet_address}-${scopeId}`)
    setMessage({ type: 'info', text: 'Waiting for MetaMask signature to revoke access.' })

    try {
      await ensureWallet()
      const tx = await revokeAccess(provider.wallet_address, scopeId)
      await refreshAccessProviders()
      setMessage({ type: 'success', text: `Access revoked. View tx: ${tx.hash}`, link: txUrl(tx.hash) })
    } catch (error) {
      setMessage({ type: 'error', text: error.reason || error.message || 'Unable to revoke access.' })
    } finally {
      setBusyAction(null)
    }
  }

  async function handleRevokeProviderAll(provider) {
    setBusyAction(`revoke-all-${provider.wallet_address}`)
    setMessage({ type: 'info', text: 'Waiting for MetaMask signature to revoke all provider access.' })

    try {
      await ensureWallet()
      const tx = await revokeAllAccess(provider.wallet_address)
      await refreshAccessProviders()
      setMessage({ type: 'success', text: `All provider access revoked. View tx: ${tx.hash}`, link: txUrl(tx.hash) })
    } catch (error) {
      setMessage({ type: 'error', text: error.reason || error.message || 'Unable to revoke all access.' })
    } finally {
      setBusyAction(null)
    }
  }

  async function handleEmergencyContact(event) {
    event.preventDefault()
    setBusyAction('emergency')
    setMessage({ type: 'info', text: 'Waiting for MetaMask signature to set emergency contact.' })

    try {
      await ensureWallet()
      const tx = await setEmergencyContact(newEmergencyContact)
      setEmergencyContactState(await getEmergencyContact(patientAddress))
      setMessage({ type: 'success', text: `Emergency contact updated. View tx: ${tx.hash}`, link: txUrl(tx.hash) })
    } catch (error) {
      setMessage({ type: 'error', text: error.reason || error.message || 'Unable to set emergency contact.' })
    } finally {
      setBusyAction(null)
    }
  }

  function toggleBatchScope(scopeId) {
    setSelectedBatchScopes((current) => (
      current.includes(scopeId)
        ? current.filter((id) => id !== scopeId)
        : [...current, scopeId]
    ))
  }

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-8">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase text-clinic">Patient</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink sm:text-4xl">Access control</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Grant provider access per sensitive data scope. Review existing providers below to revoke access.
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
          <div className="font-mono text-sm font-semibold text-ink">{shortAddress(patientAddress)}</div>
          <div className="mt-1 text-sm text-slate-600">Patient wallet</div>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <div className="text-xl font-semibold text-ink">{scopes.length}</div>
          <div className="mt-1 text-sm text-slate-600">On-chain scopes</div>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <div className="font-mono text-sm font-semibold text-ink">{shortAddress(emergencyContact)}</div>
          <div className="mt-1 text-sm text-slate-600">Emergency contact</div>
        </div>
      </div>

      <StatusMessage message={message} />

      {!isLoading && !isPatient && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Sign in with a patient account to manage personal access permissions.
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-ink">Audit logs</h2>
            <p className="mt-1 text-sm text-slate-600">View immutable Sepolia events involving your patient wallet.</p>
          </div>
          <Link
            to="/patient/logs"
            className="h-10 w-fit rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            View patient logs
          </Link>
        </div>
      </div>

      <Panel
        title="Providers with access"
        description="Approved providers that currently have active, non-expired on-chain permission for one or more of your scopes."
      >
        {providersWithAccess.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 p-6 text-sm text-slate-600">
            No providers currently have active access.
          </div>
        ) : (
          <div className="grid gap-3">
            {providersWithAccess.map((provider) => (
              <article key={provider.wallet_address} className="rounded-md border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h3 className="font-semibold text-ink">{provider.name}</h3>
                    <div className="mt-1 break-all font-mono text-xs text-slate-500">{provider.wallet_address}</div>
                    {provider.organisation && <div className="mt-1 text-sm text-slate-600">{provider.organisation}</div>}
                  </div>
                  <div className="grid gap-3 lg:justify-items-end">
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      {provider.activeScopes.map((scope) => (
                        <span key={scope.id} className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-chain">
                          {scope.name} · expires {formatDate(scope.expiryTime)}
                        </span>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedAccessProvider(provider)}
                      className="h-10 w-fit rounded-md bg-ink px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      Review access
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title="Grant access"
        description="Provider access is scoped and time-limited. The backend still re-verifies this contract state before serving records."
      >
        <form className="grid gap-4" onSubmit={handleGrant}>
          <Field label="Provider wallet address">
            <input
              className={inputClass('font-mono')}
              value={providerAddress}
              onChange={(event) => setProviderAddress(event.target.value)}
              placeholder="0x..."
              required
            />
          </Field>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Scope">
              <select
                className={inputClass()}
                value={selectedScopeId}
                onChange={(event) => setSelectedScopeId(Number(event.target.value))}
              >
                {scopes.map((scope) => (
                  <option key={scope.id} value={scope.id}>{scope.id} - {scope.name}</option>
                ))}
              </select>
            </Field>
            <div className="grid gap-1.5 text-sm font-medium text-slate-700">
              <span>Access window</span>
              <div className="grid h-11 grid-cols-2 rounded-md border border-slate-300 bg-white p-1">
                <button
                  type="button"
                  onClick={() => setDurationMode('preset')}
                  className={`rounded text-sm font-semibold transition ${durationMode === 'preset' ? 'bg-blue-50 text-chain' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  Preset
                </button>
                <button
                  type="button"
                  onClick={() => setDurationMode('custom')}
                  className={`rounded text-sm font-semibold transition ${durationMode === 'custom' ? 'bg-blue-50 text-chain' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  Custom
                </button>
              </div>
            </div>
          </div>

          {durationMode === 'preset' ? (
            <Field label="Duration">
              <select
                className={inputClass()}
                value={durationDays}
                onChange={(event) => setDurationDays(Number(event.target.value))}
              >
                <option value={1}>1 day</option>
                <option value={7}>7 days</option>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
              </select>
            </Field>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Start date">
                <input
                  className={inputClass()}
                  type="datetime-local"
                  value={customStartAt}
                  onChange={(event) => setCustomStartAt(event.target.value)}
                />
              </Field>
              <Field label="End date">
                <input
                  className={inputClass()}
                  type="datetime-local"
                  value={customEndAt}
                  onChange={(event) => setCustomEndAt(event.target.value)}
                  required
                />
              </Field>
            </div>
          )}

          <div className={`rounded-md border px-3 py-2 text-sm ${
            durationMode === 'custom' && customDurationSeconds <= 0
              ? 'border-rose-200 bg-rose-50 text-rose-700'
              : durationMode === 'custom' && customStartIsFuture
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-slate-200 bg-slate-50 text-slate-600'
          }`}>
            {durationMode === 'custom' && customStartIsFuture
              ? 'The deployed contract starts access when MetaMask confirms the transaction; the custom end date controls when access expires.'
              : `Selected window: ${selectedDurationLabel}`}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busyAction === 'grant' || (durationMode === 'custom' && customDurationSeconds <= 0)}
              className="h-10 rounded-md bg-clinic px-4 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busyAction === 'grant' ? 'Granting' : 'Grant access'}
            </button>
            <button
              type="button"
              onClick={handleCheckPermission}
              disabled={!providerAddress || busyAction === 'check'}
              className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Check permission
            </button>
          </div>
        </form>

        <div className="mt-5 grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-ink">Provider registry:</span>
            <span className={`rounded-md px-2 py-1 text-xs font-semibold ${providerInfo?.isRegistered ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
              {providerInfo ? (providerInfo.isRegistered ? 'Registered on-chain' : 'Not registered on-chain') : 'Not checked'}
            </span>
            {providerInfo?.name && <span>{providerInfo.name}</span>}
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div>
              <div className="text-xs uppercase text-slate-500">Scope</div>
              <div className="font-medium">{selectedScope?.name || 'Select scope'}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-slate-500">Permission</div>
              <div className={permission?.active ? 'font-medium text-clinic' : 'font-medium text-slate-500'}>
                {permission ? (permission.active ? 'Active' : 'Inactive') : 'Not checked'}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase text-slate-500">Expires</div>
              <div className="font-medium">{permission ? formatDate(permission.expiryTime) : 'Not checked'}</div>
            </div>
          </div>
        </div>
      </Panel>

      <Panel
        title="Batch access"
        description="Grant one provider access to multiple scopes in a single Sepolia transaction."
      >
        <div className="grid gap-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {scopes.map((scope) => (
              <button
                key={scope.id}
                type="button"
                onClick={() => toggleBatchScope(scope.id)}
                className={`rounded-md border px-3 py-2 text-left text-sm font-medium transition ${
                  selectedBatchScopes.includes(scope.id)
                    ? 'border-chain bg-blue-50 text-chain'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {scope.id}. {scope.name}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleGrantBatch}
            disabled={!providerAddress || selectedBatchScopes.length === 0 || busyAction === 'grantBatch' || (durationMode === 'custom' && customDurationSeconds <= 0)}
            className="h-10 w-fit rounded-md bg-ink px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busyAction === 'grantBatch' ? 'Granting batch' : 'Grant selected scopes'}
          </button>
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Emergency contact"
          description="This address can use emergency access on-chain and is audited separately."
        >
          <form className="grid gap-3" onSubmit={handleEmergencyContact}>
            <Field label="Emergency wallet address">
              <input
                className={inputClass('font-mono')}
                value={newEmergencyContact}
                onChange={(event) => setNewEmergencyContact(event.target.value)}
                placeholder="0x..."
                required
              />
            </Field>
            <button
              type="submit"
              disabled={busyAction === 'emergency'}
              className="h-10 w-fit rounded-md bg-clinic px-4 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busyAction === 'emergency' ? 'Saving' : 'Set emergency contact'}
            </button>
          </form>
        </Panel>

        <Panel
          title="Anchored document hashes"
          description="The chain stores SHA-256 document hashes only. Medical data remains encrypted in local PostgreSQL and disk storage."
        >
          <div className="grid gap-2">
            {scopeHashes.map((scope) => (
              <div key={scope.id} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-slate-700">{scope.name}</span>
                  <span className={`rounded-md px-2 py-1 text-xs font-semibold ${scope.hash !== ZERO_HASH ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                    {scope.hash !== ZERO_HASH ? 'Anchored' : 'No hash'}
                  </span>
                </div>
                <div className="mt-1 break-all font-mono text-xs text-slate-500">{scope.hash}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {selectedAccessProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <section className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-lg bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <p className="text-sm font-semibold uppercase text-clinic">Provider access</p>
                <h2 className="mt-1 text-2xl font-semibold text-ink">{selectedAccessProvider.name}</h2>
                <p className="mt-1 break-all font-mono text-xs text-slate-500">{selectedAccessProvider.wallet_address}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAccessProvider(null)}
                className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
              <div>
                <div className="text-xs uppercase text-slate-500">Hospital / Organisation</div>
                <div className="mt-1 font-medium text-ink">{selectedAccessProvider.organisation || 'Not provided'}</div>
              </div>
              {selectedAccessProvider.specialty && (
                <div>
                  <div className="text-xs uppercase text-slate-500">Specialty</div>
                  <div className="mt-1 font-medium text-ink">{selectedAccessProvider.specialty}</div>
                </div>
              )}
            </div>

            <div className="mt-5 grid gap-3">
              {selectedAccessProvider.activeScopes.map((scope) => {
                const busyKey = `revoke-${selectedAccessProvider.wallet_address}-${scope.id}`

                return (
                  <div key={scope.id} className="rounded-md border border-slate-200 bg-white p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="font-semibold text-ink">{scope.name}</div>
                        <div className="mt-1 text-sm text-slate-600">Scope {scope.id}</div>
                        <div className="mt-2 grid gap-1 text-sm text-slate-600">
                          <span>Granted: {formatDate(scope.grantedAt)}</span>
                          <span>Expires: {formatDate(scope.expiryTime)}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRevokeProviderScope(selectedAccessProvider, scope.id)}
                        disabled={busyAction === busyKey}
                        className="h-10 rounded-md border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busyAction === busyKey ? 'Revoking' : 'Revoke scope'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-5 flex justify-end border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => handleRevokeProviderAll(selectedAccessProvider)}
                disabled={busyAction === `revoke-all-${selectedAccessProvider.wallet_address}`}
                className="h-10 rounded-md bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busyAction === `revoke-all-${selectedAccessProvider.wallet_address}` ? 'Revoking all' : 'Revoke all access for this provider'}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}
