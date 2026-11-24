import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle2, KeyRound, Loader2, Mail, ShieldCheck } from 'lucide-react'
import api from '../../api/client'
import FreshSpinLogo, { FreshSpinWordmark } from './FreshSpinLogo'

const passwordChecks = (value) => ({
  length: value.length >= 10,
  lower: /[a-z]/.test(value),
  upper: /[A-Z]/.test(value),
  number: /\d/.test(value),
  symbol: /[^A-Za-z0-9]/.test(value),
})

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`
}

export default function PasswordRecoveryPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [step, setStep] = useState('email')
  const [email, setEmail] = useState(location.state?.email || '')
  const [code, setCode] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [expiresIn, setExpiresIn] = useState(0)
  const [resendIn, setResendIn] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const checks = passwordChecks(password)
  const strength = Object.values(checks).filter(Boolean).length

  useEffect(() => {
    if (step !== 'otp' || (expiresIn <= 0 && resendIn <= 0)) return undefined
    const timer = window.setInterval(() => {
      setExpiresIn((value) => Math.max(0, value - 1))
      setResendIn((value) => Math.max(0, value - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [step, expiresIn, resendIn])

  const requestCode = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')
    const normalizedEmail = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Enter a valid email address to continue.')
      return
    }

    setBusy(true)
    try {
      const response = await api.post('/api/admin/forgot-password', { email: normalizedEmail })
      const data = response.data?.data || {}
      setEmail(normalizedEmail)
      setCode('')
      setExpiresIn(data.expires_in || 300)
      setResendIn(data.resend_after || 60)
      setNotice(data.message || 'If an admin account is associated with that address, a verification code has been sent.')
      setStep('otp')
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'We could not process this request. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  const verifyCode = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the six-digit code from your email.')
      return
    }
    setBusy(true)
    try {
      const response = await api.post('/api/admin/verify-reset-otp', { email, code })
      const data = response.data?.data || {}
      if (!data.reset_token) throw new Error('Missing reset authorization')
      setResetToken(data.reset_token)
      setStep('password')
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'We could not verify that code. Request a new one and try again.')
    } finally {
      setBusy(false)
    }
  }

  const resendCode = async () => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const response = await api.post('/api/admin/resend-reset-otp', { email })
      const data = response.data?.data || {}
      setCode('')
      setExpiresIn(data.expires_in || 300)
      setResendIn(data.resend_after || 60)
      setNotice(data.message || 'If an admin account is associated with that address, a new code has been sent.')
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'We could not resend the code. Please try again shortly.')
    } finally {
      setBusy(false)
    }
  }

  const updatePassword = async (event) => {
    event.preventDefault()
    setError('')
    const allChecksPass = Object.values(checks).every(Boolean)
    if (!allChecksPass) {
      setError('Use at least 10 characters with uppercase and lowercase letters, a number, and a symbol.')
      return
    }
    if (password !== confirmation) {
      setError('The passwords do not match.')
      return
    }
    setBusy(true)
    try {
      await api.post('/api/admin/reset-password', {
        reset_token: resetToken,
        password,
        password_confirmation: confirmation,
      })
      setResetToken('')
      setPassword('')
      setConfirmation('')
      setStep('success')
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'We could not update the password. Verify your reset session and try again.')
    } finally {
      setBusy(false)
    }
  }

  const heading = {
    email: 'Forgot your password?',
    otp: 'Check your email',
    password: 'Create a new password',
    success: 'Password updated',
  }[step]

  return (
    <div className="w-full max-w-[460px] py-4 sm:py-8">
      <button
        type="button"
        onClick={() => navigate('/login')}
        className="mb-7 inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-[#0A4D68] transition hover:text-[#088395] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#088395]/40"
      >
        <ArrowLeft size={17} /> Back to login
      </button>

      <div className="mb-7 flex flex-col items-center text-center">
        <span className="flex h-[84px] w-[84px] items-center justify-center rounded-full bg-white p-2 shadow-[0_10px_26px_rgba(8,131,149,0.18)] ring-1 ring-[#E2E8F0]">
          <FreshSpinLogo size={68} />
        </span>
        <div className="mt-3">
          <FreshSpinWordmark compact tone="brand" />
        </div>
      </div>

      <div className="mb-6 text-center">
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#E0F7FA] text-[#088395] ring-1 ring-[#BFEAF0]">
          {step === 'success' ? <CheckCircle2 size={22} /> : step === 'otp' ? <Mail size={21} /> : step === 'password' ? <KeyRound size={21} /> : <ShieldCheck size={22} />}
        </span>
        <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-[#0A4D68]">{heading}</h1>
        <p className="mx-auto mt-2 max-w-[390px] text-sm leading-relaxed text-slate-600">
          {step === 'email' && 'Enter your registered admin email and we will send a verification code.'}
          {step === 'otp' && <>Enter the six-digit code sent to <span className="font-semibold text-[#0A4D68]">{email}</span>.</>}
          {step === 'password' && 'Your email is verified. Choose a strong new password for your account.'}
          {step === 'success' && 'Your password has been changed. You can now sign in with your new password.'}
        </p>
      </div>

      {notice && <p role="status" className="mb-4 rounded-[14px] border border-[#BFEAF0] bg-[#E0F7FA] px-4 py-3 text-sm leading-relaxed text-[#0A4D68]">{notice}</p>}
      {error && <p role="alert" className="mb-4 rounded-[14px] border border-danger/25 bg-danger-tint px-4 py-3 text-sm leading-relaxed text-danger">{error}</p>}

      {step === 'email' && (
        <form onSubmit={requestCode} className="space-y-5">
          <div>
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0A4D68]" htmlFor="recovery-email">Registered email address</label>
            <div className="relative">
              <Mail size={18} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#088395]" />
              <input
                id="recovery-email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                className="w-full rounded-[14px] border border-transparent bg-[#F1F5F9] py-3.5 pl-11 pr-4 text-sm text-[#0A4D68] placeholder:text-slate-500 transition focus:border-[#088395] focus:outline-none focus:ring-2 focus:ring-[#088395]/15"
              />
            </div>
          </div>
          <button disabled={busy} className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#0A4D68] to-[#088395] px-4 text-sm font-bold text-white shadow-[0_10px_24px_rgba(8,131,149,0.22)] transition-all duration-200 hover:from-[#083F56] hover:to-[#077584] hover:shadow-[0_12px_28px_rgba(8,131,149,0.3)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60">
            {busy ? <><Loader2 size={17} className="animate-spin" /> Sending code...</> : <>Send OTP <ArrowRight size={17} /></>}
          </button>
        </form>
      )}

      {step === 'otp' && (
        <form onSubmit={verifyCode} className="space-y-5">
          <div>
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0A4D68]" htmlFor="recovery-code">Six-digit verification code</label>
            <input
              id="recovery-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="w-full rounded-[14px] border border-transparent bg-[#F1F5F9] px-4 py-4 text-center font-mono text-2xl font-bold tracking-[0.55em] text-[#0A4D68] placeholder:text-slate-400 transition focus:border-[#088395] focus:outline-none focus:ring-2 focus:ring-[#088395]/15"
            />
            <div className="mt-2 flex justify-between gap-2 text-xs text-slate-600">
              <span>{expiresIn > 0 ? `Code expires in ${formatTime(expiresIn)}` : 'This code has expired.'}</span>
              <button type="button" onClick={() => { setStep('email'); setError(''); setNotice('') }} className="font-semibold text-[#0A4D68] underline underline-offset-4 transition hover:text-[#088395]">Change email</button>
            </div>
          </div>
          <button disabled={busy || expiresIn === 0} className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#0A4D68] to-[#088395] px-4 text-sm font-bold text-white shadow-[0_10px_24px_rgba(8,131,149,0.22)] transition-all duration-200 hover:from-[#083F56] hover:to-[#077584] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60">
            {busy ? <><Loader2 size={17} className="animate-spin" /> Verifying...</> : <>Verify OTP <ArrowRight size={17} /></>}
          </button>
          <button type="button" disabled={busy || resendIn > 0} onClick={resendCode} className="w-full text-sm font-semibold text-[#0A4D68] transition hover:text-[#088395] disabled:cursor-not-allowed disabled:text-slate-400">
            {resendIn > 0 ? `Resend code in ${formatTime(resendIn)}` : 'Resend OTP'}
          </button>
        </form>
      )}

      {step === 'password' && (
        <form onSubmit={updatePassword} className="space-y-4">
          <div>
            <label htmlFor="new-password" className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0A4D68]">New password</label>
            <div className="relative">
              <input id="new-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-[14px] border border-transparent bg-[#F1F5F9] px-4 py-3.5 pr-20 text-sm text-[#0A4D68] transition focus:border-[#088395] focus:outline-none focus:ring-2 focus:ring-[#088395]/15" />
              <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-semibold text-[#0A4D68] transition hover:bg-[#E0F7FA]">{showPassword ? 'Hide' : 'Show'}</button>
            </div>
            <div className="mt-2" aria-label={`Password strength: ${strength} of 5`}>
              <div className="flex gap-1">{Array.from({ length: 5 }, (_, index) => <span key={index} className={`h-1.5 flex-1 rounded-full ${index < strength ? (strength < 3 ? 'bg-danger' : strength < 5 ? 'bg-warning' : 'bg-success') : 'bg-slate-200'}`} />)}</div>
              <p className="mt-1 text-[11px] text-slate-600">Strength: {strength < 3 ? 'weak' : strength < 5 ? 'good' : 'strong'} · 10+ characters, upper and lowercase, number, symbol</p>
            </div>
          </div>
          <div>
            <label htmlFor="confirm-password" className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0A4D68]">Confirm new password</label>
            <div className="relative">
              <input id="confirm-password" type={showConfirmation ? 'text' : 'password'} autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="w-full rounded-[14px] border border-transparent bg-[#F1F5F9] px-4 py-3.5 pr-20 text-sm text-[#0A4D68] transition focus:border-[#088395] focus:outline-none focus:ring-2 focus:ring-[#088395]/15" />
              <button type="button" onClick={() => setShowConfirmation((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-semibold text-[#0A4D68] transition hover:bg-[#E0F7FA]">{showConfirmation ? 'Hide' : 'Show'}</button>
            </div>
          </div>
          <button disabled={busy} className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#0A4D68] to-[#088395] px-4 text-sm font-bold text-white shadow-[0_10px_24px_rgba(8,131,149,0.22)] transition-all duration-200 hover:from-[#083F56] hover:to-[#077584] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60">
            {busy ? <><Loader2 size={17} className="animate-spin" /> Updating password...</> : <>Update Password <ArrowRight size={17} /></>}
          </button>
        </form>
      )}

      {step === 'success' && (
        <button type="button" onClick={() => navigate('/login')} className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#0A4D68] to-[#088395] px-4 text-sm font-bold text-white shadow-[0_10px_24px_rgba(8,131,149,0.22)] transition-all duration-200 hover:from-[#083F56] hover:to-[#077584] active:scale-[0.99]">
          Back to Login <ArrowRight size={17} />
        </button>
      )}
    </div>
  )
}
