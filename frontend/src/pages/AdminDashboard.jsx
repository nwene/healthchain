import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  approveProvider,
  createAdmin,
  disableProvider,
  getAdmins,
  getCurrentUser,
  getPendingProviders,
  getProviders,
  loginWithWallet,
  rejectProvider,
} from '../lib/api'
import { addScope, getAdmin, getAllAuditLogs, getProvider, getScopes, registerProvider, removeProvider, txUrl } from '../lib/contract'
import { useWallet } from '../contexts/WalletProvider'

function shortAddress(address) {
  if (!address) {
    return ''
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`
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

function formatDate(seconds) {
  if (!seconds) {
    return 'Unknown time'
  }

  return new Date(seconds * 1000).toLocaleString()
}

function AuditLogList({ logs }) {
  if (logs.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 p-6 text-sm text-slate-600">
        No contract audit logs found yet.
      </div>
    )
  }

  return (
    <div className="grid max-h-[520px] gap-2 overflow-auto pr-1">
      {logs.map((log) => (
        <article key={log.id} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-chain">{log.event}</span>
                <span className="text-sm font-medium text-ink">{log.summary}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs text-slate-500">
                {log.args.patient && <span>patient {shortAddress(log.args.patient)}</span>}
                {log.args.provider && <span>provider {shortAddress(log.args.provider)}</span>}
                {log.args.emergencyContact && <span>emergency {shortAddress(log.args.emergencyContact)}</span>}
                {log.args.scopeId && <span>scope {log.args.scopeId}</span>}
                {log.args.expiryTime && <span>expires {formatDate(log.args.expiryTime)}</span>}
              </div>
            </div>
            <a
              className="font-mono text-xs font-semibold text-chain underline underline-offset-2"
              href={txUrl(log.transactionHash)}
              target="_blank"
              rel="noreferrer"
            >
              {shortAddress(log.transactionHash)}
            </a>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {formatDate(log.timestamp)} · block {log.blockNumber}
          </div>
        </article>
      ))}
    </div>
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

function ProviderCard({ provider, busyId, onApprove, onReject }) {
  const isBusy = busyId === provider.wallet_address

  return (
    <article className="rounded-md border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-ink">{provider.name}</h3>
            <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">Pending</span>
          </div>
          <div className="mt-2 grid gap-1 text-sm text-slate-600">
            <span className="font-mono text-xs text-slate-500">{provider.wallet_address}</span>
            {provider.organisation && <span>{provider.organisation}</span>}
            {provider.specialty && <span>{provider.specialty}</span>}
            {provider.medical_license && <span>License: {provider.medical_license}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onApprove(provider)}
            disabled={isBusy}
            className="h-10 rounded-md bg-clinic px-4 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isBusy ? 'Working' : 'Approve'}
          </button>
          <button
            type="button"
            onClick={() => onReject(provider)}
            disabled={isBusy}
            className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Reject
          </button>
        </div>
      </div>
    </article>
  )
}

function ProviderDirectoryCard({ provider, busyId, onRemove }) {
  const isBusy = busyId === provider.wallet_address

  return (
    <article className="rounded-md border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-ink">{provider.name}</h3>
            <span className={`rounded-md px-2 py-1 text-xs font-medium ${
              provider.is_approved ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            }`}>
              {provider.is_approved ? 'Approved' : 'Pending or disabled'}
            </span>
          </div>
          <div className="mt-2 grid gap-1 text-sm text-slate-600">
            <span className="break-all font-mono text-xs text-slate-500">{provider.wallet_address}</span>
            {provider.organisation && <span>{provider.organisation}</span>}
            {provider.specialty && <span>{provider.specialty}</span>}
            {provider.medical_license && <span>License: {provider.medical_license}</span>}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onRemove(provider)}
          disabled={isBusy}
          className="h-10 rounded-md border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isBusy ? 'Removing' : 'Remove'}
        </button>
      </div>
    </article>
  )
}

function adminActionError(error, fallback) {
  const text = error.response?.data?.message || error.reason || error.message || fallback

  if (text.includes('Only admin can call this') || text.includes('contract admin wallet')) {
    return 'Only Super Admin can do this.'
  }

  return text
}

export default function AdminDashboard() {
  const wallet = useWallet()
  const [currentUser, setCurrentUser] = useState(null)
  const [contractAdmin, setContractAdmin] = useState(null)
  const [providers, setProviders] = useState([])
  const [allProviders, setAllProviders] = useState([])
  const [admins, setAdmins] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [scopes, setScopes] = useState([])
  const [newScope, setNewScope] = useState('')
  const [newAdmin, setNewAdmin] = useState({
    name: '',
    wallet_address: '',
    email: '',
    password: '',
  })
  const [isLoading, setIsLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [isAddingScope, setIsAddingScope] = useState(false)
  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false)
  const [message, setMessage] = useState(null)

  const isApprovedAdmin = currentUser?.role === 'admin' && currentUser?.is_approved
  const isSuperAdmin = currentUser?.wallet_address?.toLowerCase() === contractAdmin?.toLowerCase()

  const loadDashboard = useCallback(async () => {
    setIsLoading(true)
    setMessage(null)

    try {
      let [user, pending, providerList, chainScopes, adminAddress] = await Promise.all([
        getCurrentUser(),
        getPendingProviders(),
        getProviders(),
        getScopes(),
        getAdmin(),
      ])

      if (wallet.address && user.wallet_address?.toLowerCase() !== wallet.address.toLowerCase()) {
        const login = await loginWithWallet(wallet.address)
        user = login.user
        ;[pending, providerList, chainScopes] = await Promise.all([
          getPendingProviders(),
          getProviders(),
          getScopes(),
        ])
      }

      setCurrentUser(user)
      setContractAdmin(adminAddress)
      setProviders(pending)
      setAllProviders(providerList)
      setScopes(chainScopes)
      getAllAuditLogs()
        .then(setAuditLogs)
        .catch(() => {
          setMessage({ type: 'error', text: 'Audit logs are temporarily rate-limited. Try Refresh again in a minute.' })
        })

      if (user.wallet_address?.toLowerCase() === adminAddress.toLowerCase()) {
        setAdmins(await getAdmins())
      } else {
        setAdmins([])
      }
    } catch (error) {
      if (wallet.address && [401, 403].includes(error.response?.status)) {
        try {
          const login = await loginWithWallet(wallet.address)
          const [pending, providerList, chainScopes, adminAddress] = await Promise.all([
            getPendingProviders(),
            getProviders(),
            getScopes(),
            getAdmin(),
          ])

          setCurrentUser(login.user)
          setContractAdmin(adminAddress)
          setProviders(pending)
          setAllProviders(providerList)
          setScopes(chainScopes)
          getAllAuditLogs()
            .then(setAuditLogs)
            .catch(() => {
              setMessage({ type: 'error', text: 'Audit logs are temporarily rate-limited. Try Refresh again in a minute.' })
            })
          setAdmins(login.user.wallet_address?.toLowerCase() === adminAddress.toLowerCase() ? await getAdmins() : [])
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
        text: error.response?.data?.message || error.message || 'Unable to load admin dashboard.',
      })
    } finally {
      setIsLoading(false)
    }
  }, [wallet.address])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  const stats = useMemo(() => ([
    { label: 'Pending providers', value: providers.length },
    { label: 'Total providers', value: allProviders.length },
    { label: 'On-chain scopes', value: scopes.length },
    { label: 'Wallet', value: wallet.address ? shortAddress(wallet.address) : 'Not connected' },
    { label: 'Super Admin', value: contractAdmin ? shortAddress(contractAdmin) : 'Loading' },
  ]), [allProviders.length, contractAdmin, providers.length, scopes.length, wallet.address])

  async function ensureContractAdminWallet() {
    if (!wallet.address) {
      await wallet.connect()
    }

    const adminAddress = contractAdmin || await getAdmin()
    setContractAdmin(adminAddress)

    const connectedAddress = window.ethereum?.selectedAddress || wallet.address

    if (!connectedAddress || connectedAddress.toLowerCase() !== adminAddress.toLowerCase()) {
      throw new Error('Only Super Admin can do this.')
    }
  }

  async function handleApprove(provider) {
    setBusyId(provider.wallet_address)
    setMessage({ type: 'info', text: 'Checking on-chain provider registry.' })

    try {
      await ensureContractAdminWallet()

      const chainProvider = await getProvider(provider.wallet_address)
      let registrationTxHash = null

      if (!chainProvider.isRegistered) {
        setMessage({ type: 'info', text: 'Waiting for MetaMask signature to register provider on Sepolia.' })
        const tx = await registerProvider(provider.wallet_address, provider.organisation || provider.name)
        registrationTxHash = tx.hash
      }

      await approveProvider(provider.wallet_address)
      await loadDashboard()

      setMessage({
        type: 'success',
        text: registrationTxHash
          ? `Provider approved. View registration tx: ${registrationTxHash}`
          : 'Provider approved. It was already registered on-chain.',
        link: registrationTxHash ? txUrl(registrationTxHash) : null,
      })
    } catch (error) {
      setMessage({
        type: 'error',
        text: adminActionError(error, 'Provider approval failed.'),
      })
    } finally {
      setBusyId(null)
    }
  }

  async function handleReject(provider) {
    setBusyId(provider.wallet_address)
    setMessage(null)

    try {
      await rejectProvider(provider.wallet_address)
      await loadDashboard()
      setMessage({ type: 'success', text: 'Provider rejected and removed from the backend.' })
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || error.message || 'Provider rejection failed.',
      })
    } finally {
      setBusyId(null)
    }
  }

  async function handleRemoveProvider(provider) {
    setBusyId(provider.wallet_address)
    setMessage({ type: 'info', text: 'Checking on-chain provider registry.' })

    try {
      await ensureContractAdminWallet()
      const chainProvider = await getProvider(provider.wallet_address)
      let removalTxHash = null

      if (chainProvider.isRegistered) {
        setMessage({ type: 'info', text: 'Waiting for MetaMask signature to remove provider on Sepolia.' })
        const tx = await removeProvider(provider.wallet_address)
        removalTxHash = tx.hash
      }

      await disableProvider(provider.wallet_address)
      await loadDashboard()
      setMessage({
        type: 'success',
        text: removalTxHash
          ? `Provider removed. View removal tx: ${removalTxHash}`
          : 'Provider disabled locally. It was not registered on-chain.',
        link: removalTxHash ? txUrl(removalTxHash) : null,
      })
    } catch (error) {
      setMessage({
        type: 'error',
        text: adminActionError(error, 'Unable to remove provider.'),
      })
    } finally {
      setBusyId(null)
    }
  }

  async function handleAddScope(event) {
    event.preventDefault()

    if (!newScope.trim()) {
      return
    }

    setIsAddingScope(true)
    setMessage({ type: 'info', text: 'Waiting for MetaMask signature to add scope.' })

    try {
      await ensureContractAdminWallet()

      const tx = await addScope(newScope.trim())
      setNewScope('')
      setScopes(await getScopes())
      setMessage({
        type: 'success',
        text: `Scope added on Sepolia. View tx: ${tx.hash}`,
        link: txUrl(tx.hash),
      })
    } catch (error) {
      setMessage({
        type: 'error',
        text: adminActionError(error, 'Unable to add scope.'),
      })
    } finally {
      setIsAddingScope(false)
    }
  }

  function updateNewAdmin(event) {
    const { name, value } = event.target
    setNewAdmin((current) => ({ ...current, [name]: value }))
  }

  async function handleCreateAdmin(event) {
    event.preventDefault()
    setIsCreatingAdmin(true)
    setMessage(null)

    try {
      await ensureContractAdminWallet()
      const payload = {
        wallet_address: newAdmin.wallet_address.trim(),
        name: newAdmin.name.trim(),
      }

      if (newAdmin.email.trim()) {
        payload.email = newAdmin.email.trim()
      }

      if (newAdmin.password) {
        payload.password = newAdmin.password
      }

      await createAdmin(payload)
      setNewAdmin({ name: '', wallet_address: '', email: '', password: '' })
      setAdmins(await getAdmins())
      setMessage({ type: 'success', text: 'Admin created by Super Admin.' })
    } catch (error) {
      setMessage({
        type: 'error',
        text: adminActionError(error, 'Unable to create admin.'),
      })
    } finally {
      setIsCreatingAdmin(false)
    }
  }

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-8">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase text-clinic">Admin</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink sm:text-4xl">Provider approval</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Approve healthcare providers only after the Super Admin wallet registers them on the Sepolia contract.
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-md border border-slate-200 bg-white p-4">
            <div className="text-xl font-semibold text-ink">{stat.value}</div>
            <div className="mt-1 text-sm text-slate-600">{stat.label}</div>
          </div>
        ))}
      </div>

      <StatusMessage message={message} />

      {!isLoading && !isApprovedAdmin && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Sign in with an approved admin account before approving providers.
        </div>
      )}

      <Panel
        title="All audit logs"
        description="Every event emitted by the Sepolia contract, including provider registration, access grants, revocations, record access, emergency access, data hashes, and scope changes."
      >
        <AuditLogList logs={auditLogs} />
      </Panel>

      <Panel
        title="Pending providers"
        description="Backend approval is only completed after the provider is registered on-chain."
      >
        {isLoading ? (
          <div className="text-sm text-slate-600">Loading providers...</div>
        ) : providers.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 p-6 text-sm text-slate-600">
            No providers are waiting for approval.
          </div>
        ) : (
          <div className="grid gap-3">
            {providers.map((provider) => (
              <ProviderCard
                key={provider.wallet_address}
                provider={provider}
                busyId={busyId}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title="Providers"
        description="View every registered provider account. Removing a provider revokes the on-chain provider registration and disables the local account."
      >
        {isLoading ? (
          <div className="text-sm text-slate-600">Loading providers...</div>
        ) : allProviders.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 p-6 text-sm text-slate-600">
            No provider accounts exist yet.
          </div>
        ) : (
          <div className="grid gap-3">
            {allProviders.map((provider) => (
              <ProviderDirectoryCard
                key={provider.wallet_address}
                provider={provider}
                busyId={busyId}
                onRemove={handleRemoveProvider}
              />
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title="Data scopes"
        description="Scopes live on-chain and are used by patients when granting provider access."
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_0.85fr]">
          <div className="grid gap-2">
            {scopes.map((scope) => (
              <div key={scope.id} className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="text-sm font-medium text-slate-700">{scope.name}</span>
                <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-chain">Scope {scope.id}</span>
              </div>
            ))}
          </div>
          <form className="grid content-start gap-3" onSubmit={handleAddScope}>
            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              <span>New scope name</span>
              <input
                className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-chain focus:ring-2 focus:ring-blue-100"
                value={newScope}
                onChange={(event) => setNewScope(event.target.value)}
                placeholder="e.g. Genetic Testing"
              />
            </label>
            <button
              type="submit"
              disabled={isAddingScope || !newScope.trim()}
              className="h-11 rounded-md bg-ink px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isAddingScope ? 'Adding scope' : 'Add scope'}
            </button>
          </form>
        </div>
      </Panel>

      <Panel
        title="Admin creation"
        description="Public admin registration is disabled. The Super Admin can create approved app admins from here."
      >
        {!isSuperAdmin ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Only Super Admin can create admins.
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
            <form className="grid gap-3" onSubmit={handleCreateAdmin}>
              <Field label="Admin wallet address">
                <input
                  className={inputClass('font-mono')}
                  name="wallet_address"
                  value={newAdmin.wallet_address}
                  onChange={updateNewAdmin}
                  placeholder="0x..."
                  required
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Name">
                  <input
                    className={inputClass()}
                    name="name"
                    value={newAdmin.name}
                    onChange={updateNewAdmin}
                    required
                  />
                </Field>
                <Field label="Email">
                  <input
                    className={inputClass()}
                    name="email"
                    type="email"
                    value={newAdmin.email}
                    onChange={updateNewAdmin}
                  />
                </Field>
              </div>
              <Field label="Password">
                <input
                  className={inputClass()}
                  name="password"
                  type="password"
                  minLength={8}
                  value={newAdmin.password}
                  onChange={updateNewAdmin}
                />
              </Field>
              <button
                type="submit"
                disabled={isCreatingAdmin || !newAdmin.wallet_address.trim() || !newAdmin.name.trim()}
                className="h-11 w-fit rounded-md bg-clinic px-4 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCreatingAdmin ? 'Creating admin' : 'Create admin'}
              </button>
            </form>

            <div className="grid content-start gap-2">
              {admins.map((admin) => (
                <div key={admin.wallet_address} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-ink">{admin.name}</span>
                    <span className={`rounded-md px-2 py-1 text-xs font-semibold ${
                      admin.wallet_address?.toLowerCase() === contractAdmin?.toLowerCase()
                        ? 'bg-blue-50 text-chain'
                        : 'bg-slate-200 text-slate-600'
                    }`}>
                      {admin.wallet_address?.toLowerCase() === contractAdmin?.toLowerCase() ? 'Super Admin' : 'Admin'}
                    </span>
                  </div>
                  <div className="mt-1 break-all font-mono text-xs text-slate-500">{admin.wallet_address}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Panel>
    </main>
  )
}
