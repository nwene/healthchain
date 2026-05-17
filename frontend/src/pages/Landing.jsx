import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { registerUser } from '../lib/api'
import { useWallet } from '../contexts/WalletProvider'

const roleOptions = [
  { value: 'patient', label: 'Patient' },
  { value: 'provider', label: 'Provider' },
]

function shortAddress(address) {
  if (!address) {
    return ''
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function dashboardPath(role) {
  if (role === 'provider') {
    return '/provider'
  }

  if (role === 'admin') {
    return '/admin'
  }

  return '/patient'
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

export default function Landing() {
  const navigate = useNavigate()
  const wallet = useWallet()
  const [form, setForm] = useState({
    name: '',
    role: 'patient',
    email: '',
    password: '',
    national_id: '',
    medical_license: '',
    organisation: '',
    specialty: '',
  })
  const [message, setMessage] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const canSubmit = useMemo(() => (
    wallet.address
    && form.name.trim()
    && form.email.trim()
    && form.password.length >= 8
  ), [form.email, form.name, form.password, wallet.address])

  function updateField(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  async function handleConnect() {
    try {
      setMessage(null)
      await wallet.connect()
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Unable to connect wallet.' })
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (!wallet.address) {
      setMessage({ type: 'error', text: 'Connect MetaMask before registering.' })
      return
    }

    setIsSubmitting(true)
    setMessage(null)

    try {
      const payload = {
        wallet_address: wallet.address,
        name: form.name.trim(),
        role: form.role,
        email: form.email.trim(),
        password: form.password,
      }

      if (form.role === 'patient' && form.national_id.trim()) {
        payload.national_id = form.national_id.trim()
      }

      if (form.role === 'provider') {
        payload.medical_license = form.medical_license.trim()
        payload.organisation = form.organisation.trim()
        payload.specialty = form.specialty.trim()
      }

      const data = await registerUser(payload)
      setMessage({
        type: 'success',
        text: data.user.role === 'provider'
          ? 'Provider registered. An admin must approve the account before document access is enabled.'
          : 'Registration complete.',
      })
      navigate(dashboardPath(data.user.role))
    } catch (error) {
      const text = error.response?.data?.message || error.message || 'Registration failed.'
      setMessage({ type: 'error', text })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="mx-auto grid min-h-[calc(100vh-72px)] w-full max-w-6xl gap-10 px-6 py-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
      <section>
        <img
          src="/healthchain-logo.png"
          alt="HealthChain logo"
          className="h-24 w-24 rounded-lg object-cover object-top shadow-sm sm:h-28 sm:w-28"
        />
        <p className="mt-5 text-sm font-semibold uppercase tracking-[0.12em] text-clinic">HealthChain</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-normal text-ink sm:text-5xl">
          Patient-controlled access for sensitive health records
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
          Connect MetaMask, register your local HealthChain profile, and route every permission decision through the Sepolia smart contract.
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-slate-200 bg-white p-4">
            <div className="text-2xl font-semibold text-chain">5</div>
            <div className="mt-1 text-sm text-slate-600">default data scopes</div>
          </div>
          <div className="rounded-md border border-slate-200 bg-white p-4">
            <div className="text-2xl font-semibold text-clinic">Local</div>
            <div className="mt-1 text-sm text-slate-600">encrypted records and files</div>
          </div>
          <div className="rounded-md border border-slate-200 bg-white p-4">
            <div className="text-2xl font-semibold text-ink">Sepolia</div>
            <div className="mt-1 text-sm text-slate-600">permission audit trail</div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/healthchain-logo.png"
              alt="HealthChain logo"
              className="h-12 w-12 rounded-md object-cover object-top"
            />
            <div>
              <h2 className="text-xl font-semibold tracking-normal text-ink">Register</h2>
              <p className="mt-1 text-sm text-slate-600">Your wallet address becomes your identity anchor.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleConnect}
            disabled={wallet.isConnecting}
            className="h-10 rounded-md bg-ink px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {wallet.address ? shortAddress(wallet.address) : wallet.isConnecting ? 'Connecting' : 'Connect Wallet'}
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2 text-xs font-medium">
          <span className={`rounded-md px-2.5 py-1 ${wallet.hasMetaMask ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
            {wallet.hasMetaMask ? 'MetaMask detected' : 'MetaMask unavailable'}
          </span>
          <span className={`rounded-md px-2.5 py-1 ${wallet.isSepolia ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
            {wallet.isSepolia ? 'Sepolia connected' : 'Sepolia required'}
          </span>
        </div>

        <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
          <Field label="Role">
            <div className="grid grid-cols-2 gap-2">
              {roleOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, role: option.value }))}
                  className={`h-10 rounded-md border text-sm font-semibold transition ${
                    form.role === option.value
                      ? 'border-chain bg-blue-50 text-chain'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name">
              <input className={inputClass()} name="name" value={form.name} onChange={updateField} required />
            </Field>
            <Field label="Email">
              <input className={inputClass()} name="email" type="email" value={form.email} onChange={updateField} required />
            </Field>
          </div>

          <Field label="Password">
            <input className={inputClass()} name="password" type="password" minLength={8} value={form.password} onChange={updateField} required />
          </Field>

          {form.role === 'patient' && (
            <Field label="National ID">
              <input className={inputClass()} name="national_id" value={form.national_id} onChange={updateField} />
            </Field>
          )}

          {form.role === 'provider' && (
            <div className="grid gap-4">
              <Field label="Medical License">
                <input className={inputClass()} name="medical_license" value={form.medical_license} onChange={updateField} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Organisation">
                  <input className={inputClass()} name="organisation" value={form.organisation} onChange={updateField} />
                </Field>
                <Field label="Specialty">
                  <input className={inputClass()} name="specialty" value={form.specialty} onChange={updateField} />
                </Field>
              </div>
            </div>
          )}

          <Field label="Wallet Address">
            <input className={inputClass('font-mono')} value={wallet.address || ''} readOnly placeholder="Connect MetaMask" />
          </Field>

          {message && (
            <div className={`rounded-md px-3 py-2 text-sm ${message.type === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit || isSubmitting}
            className="h-11 rounded-md bg-clinic px-4 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Registering' : 'Create Account'}
          </button>
        </form>
      </section>
    </main>
  )
}
