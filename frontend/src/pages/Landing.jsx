import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { registerUser } from '../lib/api'
import { useWallet } from '../contexts/WalletProvider'

const roleOptions = [
  { value: 'patient', label: 'Patient', icon: '🛡️', desc: 'Control who sees your records' },
  { value: 'provider', label: 'Healthcare Provider', icon: '⚕️', desc: 'Access granted patient data' },
]

function shortAddress(address) {
  if (!address) return ''
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function dashboardPath(role) {
  if (role === 'provider') return '/provider'
  if (role === 'admin') return '/admin'
  return '/patient'
}

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
    <main className="relative min-h-[calc(100vh-72px)] overflow-hidden bg-gradient-to-b from-white via-slate-50/80 to-blue-50/30">
      {/* Dot pattern overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: 'radial-gradient(circle, #cbd5e1 0.8px, transparent 0.8px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Colour accents */}
      <div className="pointer-events-none absolute -right-20 top-16 h-72 w-72 rounded-full bg-blue-200/20 blur-3xl" />
      <div className="pointer-events-none absolute -left-16 bottom-20 h-56 w-56 rounded-full bg-teal-200/15 blur-3xl" />

      <div className="relative mx-auto grid w-full max-w-6xl gap-10 px-6 py-12 lg:grid-cols-[1fr_480px] lg:items-center lg:gap-16 lg:py-16">

        {/* ── Left: Hero ── */}
        <section>
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/80 px-3.5 py-1.5 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-600">Live on Sepolia</span>
          </div>

          <h1 className="mt-6 text-[2.5rem] font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl">
            Your health data,<br />
            <span className="bg-gradient-to-r from-blue-600 to-teal-500 bg-clip-text text-transparent">your permissions.</span>
          </h1>

          <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-slate-500">
            HealthChain gives patients granular, time-limited, blockchain-audited control over who can access their most sensitive medical records.
          </p>

          {/* Architecture cards */}
          <div className="mt-9 grid gap-3 sm:grid-cols-3">
            {[
              { label: 'On-chain', value: 'Permissions & audit trail', color: 'blue' },
              { label: 'Off-chain', value: 'Encrypted records & files', color: 'teal' },
              { label: 'Identity', value: 'MetaMask wallet signing', color: 'amber' },
            ].map((card) => (
              <div
                key={card.label}
                className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-white/80 p-4 backdrop-blur-sm transition hover:shadow-md"
              >
                {/* Corner accent */}
                <div className={`absolute -right-3 -top-3 h-10 w-10 rounded-full opacity-10
                  ${card.color === 'blue' ? 'bg-blue-500' : card.color === 'teal' ? 'bg-teal-500' : 'bg-amber-500'}`}
                />
                <div className={`text-[10px] font-bold uppercase tracking-[0.15em]
                  ${card.color === 'blue' ? 'text-blue-500' : card.color === 'teal' ? 'text-teal-600' : 'text-amber-600'}`}>
                  {card.label}
                </div>
                <div className="mt-1.5 text-[13px] leading-snug text-slate-600">{card.value}</div>
              </div>
            ))}
          </div>

          {/* Scope badges */}
          <div className="mt-8">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Protected data scopes</div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {[
                { name: 'HIV Status', bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-100' },
                { name: 'Mental Health', bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-100' },
                { name: 'Gender Identity', bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100' },
                { name: 'Medical History', bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100' },
                { name: 'Prescriptions', bg: 'bg-teal-50', text: 'text-teal-600', border: 'border-teal-100' },
              ].map((s) => (
                <span key={s.name} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${s.bg} ${s.text} ${s.border}`}>
                  {s.name}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── Right: Registration form ── */}
        <section className="rounded-2xl border border-slate-200/80 bg-white/90 shadow-xl shadow-slate-200/30 backdrop-blur-sm">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Create account</h2>
              <p className="mt-0.5 text-xs text-slate-400">Your wallet address becomes your on-chain identity</p>
            </div>
            <button
              type="button"
              onClick={handleConnect}
              disabled={wallet.isConnecting}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition
                ${wallet.address
                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60'
                }`}
            >
              {wallet.address ? (
                <><span className="h-2 w-2 rounded-full bg-emerald-500" /><span className="font-mono text-xs">{shortAddress(wallet.address)}</span></>
              ) : wallet.isConnecting ? 'Connecting...' : 'Connect Wallet'}
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
              <Field label="National ID" hint="Optional — links your identity off-chain">
                <input className={inp} name="national_id" value={form.national_id} onChange={updateField} placeholder="PT-123456789" />
              </Field>
            )}

            {form.role === 'provider' && (
              <div className="grid gap-4 rounded-xl border border-blue-100 bg-blue-50/30 p-4">
                <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-blue-500">Provider verification</div>
                <Field label="Medical license"><input className={inp + ' !bg-white'} name="medical_license" value={form.medical_license} onChange={updateField} placeholder="PT-MED-2024-XXXX" /></Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Organisation"><input className={inp + ' !bg-white'} name="organisation" value={form.organisation} onChange={updateField} placeholder="Hospital de Santa Maria" /></Field>
                  <Field label="Specialty"><input className={inp + ' !bg-white'} name="specialty" value={form.specialty} onChange={updateField} placeholder="General Practitioner" /></Field>
                </div>
                <p className="text-[11px] leading-relaxed text-blue-400">
                  Admin must verify your license and call <code className="rounded bg-blue-100 px-1 font-mono text-[10px] text-blue-600">registerProvider()</code> on-chain before access is enabled.
                </p>
              </div>
            )}

            <Field label="Wallet address" hint="Read-only — from MetaMask">
              <div className={`flex h-11 items-center rounded-lg border px-3.5 font-mono text-sm
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
              className="h-12 rounded-xl bg-gradient-to-r from-blue-600 to-teal-600 text-sm font-bold text-white shadow-lg shadow-blue-200/40 transition-all hover:shadow-xl hover:shadow-blue-200/50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />Creating account...</span>
              ) : 'Create Account'}
            </button>

            <p className="text-center text-[11px] text-slate-400">Already registered? Navigate to your dashboard from the header.</p>
          </form>
        </section>
      </div>
    </main>
  )
}
