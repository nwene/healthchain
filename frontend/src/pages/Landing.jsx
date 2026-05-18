import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { registerUser } from '../lib/api'
import { useWallet } from '../contexts/WalletProvider'

/* ═══ INLINE SVG GRAPHICS ═══ */

function ShieldLockIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 4L6 12v12c0 11.1 7.7 21.5 18 24 10.3-2.5 18-12.9 18-24V12L24 4z" fill="url(#shieldGrad)" opacity="0.12" />
      <path d="M24 4L6 12v12c0 11.1 7.7 21.5 18 24 10.3-2.5 18-12.9 18-24V12L24 4z" stroke="url(#shieldGrad)" strokeWidth="2" fill="none" />
      <rect x="18" y="20" width="12" height="10" rx="2" stroke="url(#shieldGrad)" strokeWidth="2" fill="none" />
      <path d="M20 20v-3a4 4 0 018 0v3" stroke="url(#shieldGrad)" strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="24" cy="25.5" r="1.5" fill="url(#shieldGrad)" />
      <defs>
        <linearGradient id="shieldGrad" x1="6" y1="4" x2="42" y2="44">
          <stop stopColor="#2563eb" />
          <stop offset="1" stopColor="#0d9488" />
        </linearGradient>
      </defs>
    </svg>
  )
}

function ChainIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="8" width="12" height="12" rx="3" stroke="#2563eb" strokeWidth="2" />
      <rect x="14" y="16" width="12" height="12" rx="3" stroke="#0d9488" strokeWidth="2" />
      <rect x="22" y="4" width="12" height="12" rx="3" stroke="#7c3aed" strokeWidth="2" />
      <line x1="14" y1="14" x2="14" y2="16" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
      <line x1="26" y1="12" x2="26" y2="16" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
      <circle cx="8" cy="14" r="2" fill="#2563eb" opacity="0.3" />
      <circle cx="20" cy="22" r="2" fill="#0d9488" opacity="0.3" />
      <circle cx="28" cy="10" r="2" fill="#7c3aed" opacity="0.3" />
    </svg>
  )
}

function DatabaseIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="18" cy="10" rx="12" ry="4" stroke="#0d9488" strokeWidth="2" />
      <path d="M6 10v8c0 2.2 5.4 4 12 4s12-1.8 12-4v-8" stroke="#0d9488" strokeWidth="2" />
      <path d="M6 18v8c0 2.2 5.4 4 12 4s12-1.8 12-4v-8" stroke="#0d9488" strokeWidth="2" />
      <ellipse cx="18" cy="18" rx="12" ry="4" stroke="#0d9488" strokeWidth="1" opacity="0.3" />
      <path d="M14 14l-2 2 2 2" stroke="#0d9488" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
      <path d="M22 14l2 2-2 2" stroke="#0d9488" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
    </svg>
  )
}

function WalletIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="10" width="28" height="20" rx="4" stroke="#d97706" strokeWidth="2" />
      <path d="M4 16h28" stroke="#d97706" strokeWidth="2" />
      <circle cx="26" cy="22" r="2.5" fill="#d97706" opacity="0.3" stroke="#d97706" strokeWidth="1.5" />
      <path d="M8 10V8a4 4 0 014-4h12a4 4 0 014 4v2" stroke="#d97706" strokeWidth="2" />
      <rect x="8" y="20" width="8" height="2" rx="1" fill="#d97706" opacity="0.2" />
    </svg>
  )
}

function HeroIllustration() {
  return (
    <svg className="w-full max-w-md mx-auto" viewBox="0 0 400 320" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Background grid */}
      <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
        </pattern>
        <linearGradient id="heroGrad1" x1="0" y1="0" x2="400" y2="320">
          <stop stopColor="#2563eb" stopOpacity="0.08" />
          <stop offset="1" stopColor="#0d9488" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
          <stop stopColor="#2563eb" />
          <stop offset="1" stopColor="#0d9488" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <rect width="400" height="320" fill="url(#heroGrad1)" rx="16" />
      <rect width="400" height="320" fill="url(#grid)" rx="16" opacity="0.5" />

      {/* Central shield */}
      <g transform="translate(160, 80)">
        <path d="M40 0L0 16v24c0 22.2 15.4 43 36 48 4-1 7.6-2.4 11-4.2" fill="#2563eb" opacity="0.06" />
        <path d="M40 0L80 16v24c0 22.2-15.4 43-36 48-4-1-7.6-2.4-11-4.2" fill="#0d9488" opacity="0.06" />
        <path d="M40 0L0 16v24c0 22.2 15.4 43 36 48 20.6-5 36-25.8 36-48V16L40 0z" stroke="url(#lineGrad)" strokeWidth="2" fill="none" />
        {/* Lock inside shield */}
        <rect x="28" y="38" width="24" height="18" rx="3" stroke="url(#lineGrad)" strokeWidth="2" fill="white" />
        <path d="M33 38v-5a7 7 0 0114 0v5" stroke="url(#lineGrad)" strokeWidth="2" fill="none" strokeLinecap="round" />
        <circle cx="40" cy="48" r="2.5" fill="#2563eb" />
        <line x1="40" y1="50.5" x2="40" y2="53" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" />
      </g>

      {/* Patient node (left) */}
      <g transform="translate(30, 120)">
        <rect width="80" height="80" rx="12" fill="white" stroke="#e2e8f0" strokeWidth="1.5" />
        <circle cx="40" cy="30" r="12" fill="#dbeafe" />
        <circle cx="40" cy="27" r="5" fill="#2563eb" opacity="0.6" />
        <path d="M28 42a12 12 0 0124 0" fill="#2563eb" opacity="0.3" />
        <text x="40" y="62" textAnchor="middle" fill="#64748b" fontSize="8" fontWeight="600">PATIENT</text>
        <text x="40" y="72" textAnchor="middle" fill="#94a3b8" fontSize="6" fontFamily="monospace">0xA1b2...C3d4</text>
      </g>

      {/* Provider node (right) */}
      <g transform="translate(290, 120)">
        <rect width="80" height="80" rx="12" fill="white" stroke="#e2e8f0" strokeWidth="1.5" />
        <circle cx="40" cy="30" r="12" fill="#ccfbf1" />
        <circle cx="40" cy="27" r="5" fill="#0d9488" opacity="0.6" />
        <path d="M28 42a12 12 0 0124 0" fill="#0d9488" opacity="0.3" />
        <text x="40" y="62" textAnchor="middle" fill="#64748b" fontSize="8" fontWeight="600">PROVIDER</text>
        <text x="40" y="72" textAnchor="middle" fill="#94a3b8" fontSize="6" fontFamily="monospace">0xE5f6...G7h8</text>
      </g>

      {/* Connection lines with animated dashes */}
      <line x1="110" y1="160" x2="160" y2="140" stroke="#2563eb" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.4">
        <animate attributeName="stroke-dashoffset" from="0" to="-14" dur="2s" repeatCount="indefinite" />
      </line>
      <line x1="240" y1="140" x2="290" y2="160" stroke="#0d9488" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.4">
        <animate attributeName="stroke-dashoffset" from="0" to="-14" dur="2s" repeatCount="indefinite" />
      </line>

      {/* Permission granted badge */}
      <g transform="translate(140, 230)" filter="url(#glow)">
        <rect width="120" height="32" rx="16" fill="white" stroke="#16a34a" strokeWidth="1.5" />
        <circle cx="18" cy="16" r="5" fill="#dcfce7" />
        <circle cx="18" cy="16" r="2.5" fill="#16a34a" />
        <text x="32" y="19.5" fill="#15803d" fontSize="8.5" fontWeight="600">SCOPE 4 GRANTED</text>
      </g>

      {/* Access denied badge */}
      <g transform="translate(140, 268)">
        <rect width="120" height="32" rx="16" fill="white" stroke="#dc2626" strokeWidth="1.5" opacity="0.7" />
        <circle cx="18" cy="16" r="5" fill="#fee2e2" />
        <path d="M15 13l6 6M21 13l-6 6" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" />
        <text x="32" y="19.5" fill="#dc2626" fontSize="8.5" fontWeight="600" opacity="0.8">SCOPE 1 DENIED</text>
      </g>

      {/* Scope labels on shield */}
      <g transform="translate(155, 10)">
        {['HIV', 'Mental Health', 'Gender', 'History', 'Rx'].map((label, i) => (
          <g key={label} transform={`translate(${i * 19}, 0)`}>
            <rect width="16" height="16" rx="3" fill={i < 2 ? '#fee2e2' : i < 3 ? '#fef3c7' : '#dcfce7'} />
            <text x="8" y="11" textAnchor="middle" fill={i < 2 ? '#dc2626' : i < 3 ? '#d97706' : '#16a34a'} fontSize="5" fontWeight="700">
              {(i + 1)}
            </text>
          </g>
        ))}
      </g>

      {/* Blockchain blocks bottom */}
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i} transform={`translate(${55 + i * 65}, 300)`}>
          <rect width="50" height="14" rx="3" fill="white" stroke="#e2e8f0" strokeWidth="1" />
          <text x="25" y="10" textAnchor="middle" fill="#94a3b8" fontSize="5.5" fontFamily="monospace">
            blk #{48100000 + i}
          </text>
          {i < 4 && <line x1="50" y1="7" x2="65" y2="7" stroke="#cbd5e1" strokeWidth="1" />}
        </g>
      ))}
    </svg>
  )
}

function ScopeIcon({ index }) {
  const colors = ['#dc2626', '#7c3aed', '#d97706', '#2563eb', '#0d9488']
  const bgs = ['#fee2e2', '#ede9fe', '#fef3c7', '#dbeafe', '#ccfbf1']
  return (
    <span
      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold"
      style={{ backgroundColor: bgs[index], color: colors[index] }}
    >
      {index + 1}
    </span>
  )
}

/* ═══ FORM HELPERS ═══ */

const roleOptions = [
  { value: 'patient', label: 'Patient', icon: '🛡️', desc: 'Control who sees your records' },
  { value: 'provider', label: 'Healthcare Provider', icon: '⚕️', desc: 'Access granted patient data' },
]

function shortAddress(a) { return a ? `${a.slice(0, 6)}...${a.slice(-4)}` : '' }
function dashboardPath(r) { return r === 'provider' ? '/provider' : r === 'admin' ? '/admin' : '/patient' }
function Field({ label, hint, children }) {
  return (
    <label className="grid gap-1">
      <span className="text-[13px] font-medium text-slate-600">{label}</span>
      {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
      {children}
    </label>
  )
}
const inp = "h-11 rounded-lg border border-slate-200 bg-slate-50/50 px-3.5 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-300 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-50"

/* ═══ MAIN COMPONENT ═══ */

export default function Landing() {
  const navigate = useNavigate()
  const wallet = useWallet()
  const [form, setForm] = useState({
    name: '', role: 'patient', email: '', password: '',
    national_id: '', medical_license: '', organisation: '', specialty: '',
  })
  const [message, setMessage] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const canSubmit = useMemo(() => (
    wallet.address && form.name.trim() && form.email.trim() && form.password.length >= 8
  ), [form.email, form.name, form.password, wallet.address])

  function updateField(e) { const { name, value } = e.target; setForm((c) => ({ ...c, [name]: value })) }

  async function handleConnect() {
    try { setMessage(null); await wallet.connect() }
    catch (error) { setMessage({ type: 'error', text: error.message || 'Unable to connect wallet.' }) }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!wallet.address) { setMessage({ type: 'error', text: 'Connect MetaMask before registering.' }); return }
    setIsSubmitting(true); setMessage(null)
    try {
      const payload = { wallet_address: wallet.address, name: form.name.trim(), role: form.role, email: form.email.trim(), password: form.password }
      if (form.role === 'patient' && form.national_id.trim()) payload.national_id = form.national_id.trim()
      if (form.role === 'provider') { payload.medical_license = form.medical_license.trim(); payload.organisation = form.organisation.trim(); payload.specialty = form.specialty.trim() }
      const data = await registerUser(payload)
      setMessage({ type: 'success', text: data.user.role === 'provider' ? 'Provider registered. An admin must approve the account before document access is enabled.' : 'Registration complete.' })
      navigate(dashboardPath(data.user.role))
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || error.message || 'Registration failed.' })
    } finally { setIsSubmitting(false) }
  }

  return (
    <main className="relative min-h-[calc(100vh-72px)] overflow-hidden">
      {/* Background layers */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-blue-50/30" />
      <div className="pointer-events-none absolute -right-32 -top-32 h-[500px] w-[500px] rounded-full bg-blue-100/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-[400px] w-[400px] rounded-full bg-teal-50/30 blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-blue-200/40 to-transparent" />

      <div className="relative mx-auto w-full max-w-6xl px-6 py-10 lg:py-14">

        {/* ── Top hero section ── */}
        <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-16">
          {/* Left text */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50/60 px-3.5 py-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-blue-600">Deployed on Sepolia</span>
            </div>

            <h1 className="mt-6 text-[2.6rem] font-bold leading-[1.08] tracking-tight text-slate-900 sm:text-5xl lg:text-[3.2rem]">
              Your health data,<br />
              <span className="bg-gradient-to-r from-blue-600 via-blue-500 to-teal-500 bg-clip-text text-transparent">your permissions.</span>
            </h1>

            <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-slate-500">
              HealthChain gives patients granular, time-limited, blockchain-audited control over sensitive medical records. Every permission is a signed transaction. Every access is an immutable event.
            </p>

            {/* Architecture cards */}
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200/80 bg-white/80 p-4 backdrop-blur-sm transition hover:border-blue-200 hover:shadow-md hover:shadow-blue-50">
                <ChainIcon className="h-9 w-9" />
                <div className="mt-3 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">On-chain</div>
                <div className="mt-1 text-[13px] leading-snug text-slate-600">Permissions, audit trail, data hashes</div>
              </div>
              <div className="rounded-xl border border-slate-200/80 bg-white/80 p-4 backdrop-blur-sm transition hover:border-teal-200 hover:shadow-md hover:shadow-teal-50">
                <DatabaseIcon className="h-9 w-9" />
                <div className="mt-3 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Off-chain</div>
                <div className="mt-1 text-[13px] leading-snug text-slate-600">AES-256-GCM encrypted records</div>
              </div>
              <div className="rounded-xl border border-slate-200/80 bg-white/80 p-4 backdrop-blur-sm transition hover:border-amber-200 hover:shadow-md hover:shadow-amber-50">
                <WalletIcon className="h-9 w-9" />
                <div className="mt-3 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Identity</div>
                <div className="mt-1 text-[13px] leading-snug text-slate-600">MetaMask wallet signs every action</div>
              </div>
            </div>
          </div>

          {/* Right illustration */}
          <div className="flex justify-center lg:justify-end">
            <HeroIllustration />
          </div>
        </div>

        {/* Scope bar */}
        <div className="mt-10 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200/80 bg-white/60 px-5 py-3.5 backdrop-blur-sm">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Protected scopes</span>
          <span className="hidden h-4 w-px bg-slate-200 sm:block" />
          {['HIV Status', 'Mental Health', 'Gender Identity', 'Medical History', 'Prescriptions'].map((s, i) => (
            <span key={s} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500">
              <ScopeIcon index={i} />
              {s}
            </span>
          ))}
        </div>

        {/* ── Registration form ── */}
        <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_500px] lg:items-start">
          {/* Left info panel */}
          <div className="hidden lg:block">
            <div className="sticky top-28">
              <ShieldLockIcon className="h-14 w-14" />
              <h2 className="mt-5 text-2xl font-bold text-slate-900">How it works</h2>
              <div className="mt-6 grid gap-5">
                {[
                  { step: '01', title: 'Register & connect wallet', desc: 'Your MetaMask address becomes your on-chain identity. Providers require admin approval before accessing any data.' },
                  { step: '02', title: 'Patient grants scoped access', desc: 'Select which data categories a provider can see. Set time limits. Choose read-only or read+write. Every grant is a signed blockchain transaction.' },
                  { step: '03', title: 'Provider accesses records', desc: 'The backend independently verifies on-chain permissions before serving any encrypted data. No trust in the frontend.' },
                  { step: '04', title: 'Immutable audit trail', desc: 'Every grant, revoke, access, and denial is recorded as a blockchain event — tamper-proof and verifiable on Etherscan.' },
                ].map((item) => (
                  <div key={item.step} className="flex gap-4">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-teal-500 text-xs font-bold text-white">
                      {item.step}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-800">{item.title}</div>
                      <div className="mt-1 text-[13px] leading-relaxed text-slate-400">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right form */}
          <section className="rounded-2xl border border-slate-200/80 bg-white/90 shadow-xl shadow-slate-200/30 backdrop-blur-sm">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Create account</h2>
                <p className="mt-0.5 text-xs text-slate-400">Your wallet address anchors your identity on-chain</p>
              </div>
              <button
                type="button"
                onClick={handleConnect}
                disabled={wallet.isConnecting}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition
                  ${wallet.address
                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'bg-slate-900 text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800 disabled:opacity-60'
                  }`}
              >
                {wallet.address ? (
                  <><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span><span className="font-mono text-xs">{shortAddress(wallet.address)}</span></>
                ) : wallet.isConnecting ? (
                  <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />Connecting...</>
                ) : (
                  <>
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none"><path d="M21 7L12 2 3 7v10l9 5 9-5V7z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M12 22V12M3 7l9 5 9-5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
                    Connect Wallet
                  </>
                )}
              </button>
            </div>

            {/* Status */}
            <div className="flex gap-2 border-b border-slate-100 px-6 py-3">
              <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold ${wallet.hasMetaMask ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${wallet.hasMetaMask ? 'bg-emerald-500' : 'bg-red-400'}`} />
                {wallet.hasMetaMask ? 'MetaMask detected' : 'MetaMask required'}
              </span>
              <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold ${wallet.isSepolia ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${wallet.isSepolia ? 'bg-blue-500' : 'bg-amber-400'}`} />
                {wallet.isSepolia ? 'Sepolia network' : 'Switch to Sepolia'}
              </span>
            </div>

            <form className="grid gap-5 px-6 py-6" onSubmit={handleSubmit}>
              {/* Role */}
              <div className="grid grid-cols-2 gap-3">
                {roleOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm((c) => ({ ...c, role: opt.value }))}
                    className={`group rounded-xl border-2 p-4 text-left transition-all
                      ${form.role === opt.value
                        ? 'border-blue-500 bg-blue-50/50 shadow-sm shadow-blue-100'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                  >
                    <div className="text-xl">{opt.icon}</div>
                    <div className={`mt-2 text-sm font-semibold ${form.role === opt.value ? 'text-blue-700' : 'text-slate-700'}`}>{opt.label}</div>
                    <div className="mt-0.5 text-[11px] text-slate-400">{opt.desc}</div>
                  </button>
                ))}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name"><input className={inp} name="name" value={form.name} onChange={updateField} placeholder="Maria Santos" required /></Field>
                <Field label="Email"><input className={inp} name="email" type="email" value={form.email} onChange={updateField} placeholder="maria@hospital.pt" required /></Field>
              </div>

              <Field label="Password" hint="Minimum 8 characters"><input className={inp} name="password" type="password" minLength={8} value={form.password} onChange={updateField} required /></Field>

              {form.role === 'patient' && (
                <Field label="National ID" hint="Optional — links your real-world identity off-chain">
                  <input className={inp} name="national_id" value={form.national_id} onChange={updateField} placeholder="PT-123456789" />
                </Field>
              )}

              {form.role === 'provider' && (
                <div className="grid gap-4 rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50/40 to-teal-50/20 p-4">
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-blue-500" viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" /></svg>
                    <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-blue-500">Provider verification</span>
                  </div>
                  <Field label="Medical license"><input className={inp + ' !bg-white'} name="medical_license" value={form.medical_license} onChange={updateField} placeholder="PT-MED-2024-XXXX" /></Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Organisation"><input className={inp + ' !bg-white'} name="organisation" value={form.organisation} onChange={updateField} placeholder="Hospital de Santa Maria" /></Field>
                    <Field label="Specialty"><input className={inp + ' !bg-white'} name="specialty" value={form.specialty} onChange={updateField} placeholder="General Practitioner" /></Field>
                  </div>
                  <p className="text-[11px] leading-relaxed text-blue-400">
                    Admin must verify your license and call <code className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-[10px] text-blue-600">registerProvider()</code> on-chain before you can access patient data.
                  </p>
                </div>
              )}

              <Field label="Wallet address" hint="Read-only — derived from MetaMask">
                <div className={`flex h-11 items-center rounded-lg border px-3.5 font-mono text-sm transition-all
                  ${wallet.address ? 'border-emerald-200 bg-emerald-50/50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-300'}`}>
                  {wallet.address || 'Connect MetaMask to populate'}
                </div>
              </Field>

              {message && (
                <div className={`rounded-lg border px-4 py-3 text-sm font-medium
                  ${message.type === 'error' ? 'border-red-100 bg-red-50 text-red-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}>
                  {message.text}
                </div>
              )}

              <button
                type="submit"
                disabled={!canSubmit || isSubmitting}
                className="relative h-12 overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-teal-600 text-sm font-bold text-white shadow-lg shadow-blue-200/50 transition-all hover:shadow-xl hover:shadow-blue-300/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />Creating account...</span>
                ) : 'Create Account'}
              </button>

              <p className="text-center text-[11px] text-slate-400">Already registered? Navigate to your dashboard from the header.</p>
            </form>
          </section>
        </div>
      </div>
    </main>
  )
}
