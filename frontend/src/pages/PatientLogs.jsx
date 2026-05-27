import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getApprovedProviders, getCurrentUser, loginWithWallet } from '../lib/api'
import { getPatientAuditLogs, txUrl } from '../lib/contract'
import { useWallet } from '../contexts/WalletProvider'

function shortAddress(address) {
  if (!address) {
    return 'Not set'
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function formatDate(seconds) {
  if (!seconds) {
    return 'Unknown time'
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
      {message.text}
    </div>
  )
}

function AuditLogList({ logs }) {
  if (logs.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 p-6 text-sm text-slate-600">
        No audit logs found for this patient yet.
      </div>
    )
  }

  return (
    <div className="grid gap-2">
      {logs.map((log) => (
        <article key={log.id} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-chain">{log.event}</span>
                <span className="text-sm font-medium text-ink">{log.summary}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs text-slate-500">
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

export default function PatientLogs() {
  const wallet = useWallet()
  const [currentUser, setCurrentUser] = useState(null)
  const [logs, setLogs] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState(null)

  const loadLogs = useCallback(async () => {
    setIsLoading(true)
    setMessage(null)

    try {
      let user = await getCurrentUser()

      if (wallet.address && user.wallet_address?.toLowerCase() !== wallet.address.toLowerCase()) {
        const login = await loginWithWallet(wallet.address)
        user = login.user
      }

      setCurrentUser(user)

      if (user.role !== 'patient') {
        setLogs([])
        return
      }

      const providers = await getApprovedProviders()
      setLogs(await getPatientAuditLogs(
        user.wallet_address,
        providers.map((provider) => provider.wallet_address),
      ))
    } catch (error) {
      if (wallet.address && [401, 403, 404].includes(error.response?.status)) {
        try {
          const login = await loginWithWallet(wallet.address)
          setCurrentUser(login.user)
          if (login.user.role === 'patient') {
            const providers = await getApprovedProviders()
            setLogs(await getPatientAuditLogs(
              login.user.wallet_address,
              providers.map((provider) => provider.wallet_address),
            ))
          } else {
            setLogs([])
          }
          return
        } catch (loginError) {
          setMessage({
            type: 'error',
            text: loginError.response?.data?.message || loginError.message || 'Unable to sign in with the connected wallet.',
          })
          return
        }
      }

      setMessage({
        type: 'error',
        text: error.message?.includes('compute units')
          ? 'Audit logs are temporarily rate-limited. Try Refresh again in a minute.'
          : error.response?.data?.message || error.message || 'Unable to load patient logs.',
      })
    } finally {
      setIsLoading(false)
    }
  }, [wallet.address])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  const isPatient = currentUser?.role === 'patient'

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-8">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase text-clinic">Patient</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink sm:text-4xl">My audit logs</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Immutable Sepolia events involving your patient wallet.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/patient"
            className="h-10 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Back to dashboard
          </Link>
          <button
            type="button"
            onClick={loadLogs}
            className="h-10 rounded-md bg-ink px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Refresh logs
          </button>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <div className="font-mono text-sm font-semibold text-ink">{shortAddress(currentUser?.wallet_address || wallet.address)}</div>
          <div className="mt-1 text-sm text-slate-600">Patient wallet</div>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <div className="text-xl font-semibold text-ink">{logs.length}</div>
          <div className="mt-1 text-sm text-slate-600">Loaded events</div>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <div className={`text-xl font-semibold ${isPatient ? 'text-clinic' : 'text-amber-700'}`}>
            {isPatient ? 'Patient' : 'Not patient'}
          </div>
          <div className="mt-1 text-sm text-slate-600">Current account</div>
        </div>
      </div>

      <StatusMessage message={message} />

      {!isLoading && !isPatient && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Sign in with a patient account to view patient logs.
        </div>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        {isLoading ? (
          <div className="text-sm text-slate-600">Loading patient logs...</div>
        ) : (
          <AuditLogList logs={logs} />
        )}
      </section>
    </main>
  )
}
