import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { useWallet } from './contexts/WalletProvider'
import AdminDashboard from './pages/AdminDashboard'
import Landing from './pages/Landing'
import PatientDashboard from './pages/PatientDashboard'
import PatientLogs from './pages/PatientLogs'
import ProviderDashboard from './pages/ProviderDashboard'

function PlaceholderPage({ title, description }) {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-72px)] w-full max-w-6xl flex-col justify-center px-6 py-12">
      <div className="flex items-center gap-3">
        <img
          src="/healthchain-logo.png"
          alt="HealthChain logo"
          className="h-12 w-12 rounded-md object-cover object-top"
        />
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-clinic">HealthChain</p>
      </div>
      <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-normal text-ink sm:text-5xl">
        {title}
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">{description}</p>
      <div className="mt-8 flex flex-wrap gap-3 text-sm text-slate-600">
        <span className="rounded-md border border-slate-200 bg-white px-3 py-2">Sepolia contract ready</span>
        <span className="rounded-md border border-slate-200 bg-white px-3 py-2">Laravel API: {import.meta.env.VITE_API_URL}</span>
      </div>
    </main>
  )
}

function App() {
  const wallet = useWallet()

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2 text-lg font-semibold tracking-normal text-ink">
            <img
              src="/healthchain-logo.png"
              alt="HealthChain logo"
              className="h-10 w-10 rounded-md object-cover object-top"
            />
            <span>HealthChain</span>
          </Link>
          <nav className="flex items-center gap-2 text-sm font-medium text-slate-600">
            <Link className="rounded-md px-3 py-2 hover:bg-slate-100" to="/patient">Patient</Link>
            <Link className="rounded-md px-3 py-2 hover:bg-slate-100" to="/patient/logs">Logs</Link>
            <Link className="rounded-md px-3 py-2 hover:bg-slate-100" to="/provider">Provider</Link>
            <Link className="rounded-md px-3 py-2 hover:bg-slate-100" to="/admin">Admin</Link>
            {wallet.address && (
              <span className="hidden rounded-md border border-slate-200 px-3 py-2 font-mono text-xs text-slate-500 sm:inline-flex">
                {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
              </span>
            )}
          </nav>
        </div>
      </header>
      <Routes>
        <Route
          path="/"
          element={<Landing />}
        />
        <Route
          path="/patient"
          element={<PatientDashboard />}
        />
        <Route
          path="/patient/logs"
          element={<PatientLogs />}
        />
        <Route
          path="/provider"
          element={<ProviderDashboard />}
        />
        <Route
          path="/admin"
          element={<AdminDashboard />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

export default App
