import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Info,
  Loader2,
  Lock,
  LockKeyhole,
  Mail,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import api from '../../api/client'
import LoginInput from './LoginInput'
import FreshSpinLogo, { FreshSpinWordmark } from './FreshSpinLogo'

const REMEMBER_KEY = 'admin_remember_email'
const LOCKOUT_EMAIL_KEY = 'admin_login_lock_email'
const RESET_INFO = 'Password resets are handled by your system administrator. Please contact them to regain access to your admin account.'

const formatCountdown = (seconds) => {
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

const lockoutMessage = 'Too many unsuccessful login attempts. Please wait before trying again.'

export default function LoginForm() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [capsLockOn, setCapsLockOn] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [notification, setNotification] = useState({ message: RESET_INFO, type: 'info' })
  const [submitting, setSubmitting] = useState(false)
  const [lockoutUntil, setLockoutUntil] = useState(null)
  const [lockoutSeconds, setLockoutSeconds] = useState(0)
  const [checkingLockout, setCheckingLockout] = useState(false)
  const recheckInFlight = useRef(false)
  const lockoutStatusRequest = useRef(0)
  const isLocked = Boolean(lockoutUntil)

  const notify = (message, type = 'info') => setNotification({ message, type })

  useEffect(() => {
    const normalizedEmail = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return undefined

    let active = true
    const requestId = ++lockoutStatusRequest.current
    const timeout = window.setTimeout(async () => {
      setCheckingLockout(true)
      try {
        const response = await api.post('/api/login-lockout-status', { email: normalizedEmail })
        if (!active || requestId !== lockoutStatusRequest.current) return
        const data = response.data?.data || {}
        if (data.locked && data.locked_until) {
          setLockoutUntil(data.locked_until)
          setLockoutSeconds(data.remaining_seconds || 1)
          notify(lockoutMessage, 'warning')
        } else {
          setLockoutUntil(null)
          setLockoutSeconds(0)
        }
      } catch (requestError) {
        if (!active || requestId !== lockoutStatusRequest.current || requestError.response?.status !== 423) return
        const data = requestError.response.data?.data || {}
        if (data.locked_until) {
          setLockoutUntil(data.locked_until)
          setLockoutSeconds(data.remaining_seconds || 1)
          notify(lockoutMessage, 'warning')
        }
      } finally {
        if (active) setCheckingLockout(false)
      }
    }, 300)

    return () => {
      active = false
      window.clearTimeout(timeout)
    }
  }, [email])

  useEffect(() => {
    if (!lockoutUntil) return undefined

    const updateCountdown = async () => {
      const remaining = Math.max(0, Math.ceil((Date.parse(lockoutUntil) - Date.now()) / 1000))
      setLockoutSeconds(remaining)
      if (remaining > 0 || recheckInFlight.current) return

      recheckInFlight.current = true
      setCheckingLockout(true)
      try {
        const response = await api.post('/api/login-lockout-status', { email: email.trim() })
        const data = response.data?.data || {}
        if (data.locked && data.locked_until) {
          setLockoutUntil(data.locked_until)
          setLockoutSeconds(data.remaining_seconds || 1)
        } else {
          setLockoutUntil(null)
          setLockoutSeconds(0)
          notify('You can now try logging in again.', 'success')
        }
      } catch (requestError) {
        const data = requestError.response?.data?.data || {}
        if (data.locked_until) {
          setLockoutUntil(data.locked_until)
          setLockoutSeconds(data.remaining_seconds || 1)
        }
      } finally {
        recheckInFlight.current = false
        setCheckingLockout(false)
      }
    }

    updateCountdown()
    const interval = window.setInterval(updateCountdown, 1000)
    return () => window.clearInterval(interval)
  }, [lockoutUntil, email])

  const handleSubmit = async (event) => {
    event.preventDefault()
    const errors = {}
    if (!email.trim()) errors.email = 'Please enter your email address.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = 'Please enter a valid email address.'
    if (!password) errors.password = 'Please enter your password.'
    setFieldErrors(errors)
    if (Object.keys(errors).length) {
      notify(Object.values(errors)[0], 'error')
      return
    }

    sessionStorage.setItem(LOCKOUT_EMAIL_KEY, email.trim())
    notify('Authenticating your account...', 'info')
    setSubmitting(true)
    try {
      const response = await api.post('/api/login', { email: email.trim(), password })
      const data = response.data?.data || response.data

      if (!data?.token || !data?.user) {
        notify('Invalid server response. Please try again.', 'error')
        return
      }
      if (data.user.role !== 'admin') {
        notify('You are not authorized to access the admin panel.', 'error')
        return
      }

      if (rememberMe) localStorage.setItem(REMEMBER_KEY, email.trim())
      else localStorage.removeItem(REMEMBER_KEY)
      sessionStorage.removeItem(LOCKOUT_EMAIL_KEY)

      notify('Login successful. Redirecting...', 'success')
      await new Promise((resolve) => window.setTimeout(resolve, 350))
      login(data.user, data.token)
      navigate('/', { replace: true })
    } catch (requestError) {
      const status = requestError.response?.status
      if (status === 423) {
        lockoutStatusRequest.current += 1
        const data = requestError.response.data?.data || {}
        if (data.locked_until) {
          setLockoutUntil(data.locked_until)
          setLockoutSeconds(data.remaining_seconds || 1)
        }
        setPassword('')
        setShowPassword(false)
        notify(lockoutMessage, 'warning')
      } else if (status === 401) {
        const message = requestError.response.data?.message || 'Invalid email or password. Please try again.'
        const type = message.startsWith('Security notice') || message.startsWith('Warning:') ? 'warning' : 'error'
        notify(message, type)
      } else if (!requestError.response) {
        notify('Unable to connect to the server. Check your connection and try again.', 'error')
      } else {
        notify(requestError.response.data?.message || 'Unable to connect to the server. Please try again.', 'error')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const notificationStyle = {
    info: 'border-[#BFEAF0] bg-[#E0F7FA] text-[#0A4D68]',
    warning: 'border-warning/30 bg-warning-tint text-navy',
    error: 'border-danger/25 bg-danger-tint text-danger',
    success: 'border-success/25 bg-success-bg text-success',
  }[notification.type] || 'border-[#BFEAF0] bg-[#E0F7FA] text-[#0A4D68]'
  const NotificationIcon = {
    info: Info,
    warning: LockKeyhole,
    error: AlertCircle,
    success: CheckCircle2,
  }[notification.type] || Info
  return (
    <div className="w-full max-w-[460px] py-6 sm:py-8">
      <div className="mb-6 flex justify-end">
        <span className="text-[11px] font-medium tracking-wide text-slate-500">
          Authorized personnel only
        </span>
      </div>

      <div className="mb-5 flex flex-col items-center text-center">
        <span className="flex h-[88px] w-[88px] items-center justify-center rounded-full bg-white p-2 shadow-[0_10px_28px_rgba(8,131,149,0.18)] ring-1 ring-[#E2E8F0]">
          <FreshSpinLogo size={72} />
        </span>
        <div className="mt-3">
          <FreshSpinWordmark compact tone="brand" />
        </div>
      </div>

      <div className="mb-5 text-center">
        <h2 className="text-[26px] font-bold leading-tight tracking-tight text-[#0A4D68]">
          Welcome Back, Admin!
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Log in to manage FreshSpin Laundry operations.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off" noValidate>
        <LoginInput
          id="admin-email"
          label="Email Address"
          type="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value)
            setFieldErrors((current) => ({ ...current, email: undefined }))
            if (notification.type === 'error') notify(RESET_INFO, 'info')
          }}
          placeholder="admin@freshspin.test"
          icon={Mail}
          error={fieldErrors.email}
          disabled={submitting || isLocked}
          autoComplete="off"
        />
        <div>
          <LoginInput
            id="admin-password"
            label="Password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value)
              setFieldErrors((current) => ({ ...current, password: undefined }))
              if (notification.type === 'error') notify(RESET_INFO, 'info')
            }}
            onKeyUp={(event) => setCapsLockOn(event.getModifierState('CapsLock'))}
            onBlur={() => setCapsLockOn(false)}
            placeholder="Enter your password"
            icon={Lock}
            error={fieldErrors.password}
            disabled={submitting || isLocked}
            autoComplete="new-password"
            showToggle
            showPassword={showPassword}
            onTogglePassword={() => setShowPassword((value) => !value)}
          />
          {capsLockOn && !isLocked && (
            <p role="status" className="mt-1.5 text-xs font-medium text-amber-700">
              Caps Lock is on.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-0.5">
          <label htmlFor="remember-me" className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-[#0A4D68]">
            <input
              id="remember-me"
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
              disabled={submitting || isLocked}
              className="h-4 w-4 rounded accent-[#088395]"
            />
            Remember me
          </label>
          <button
            type="button"
            onClick={() => navigate('/forgot-password', { state: { email: email.trim() } })}
            className="text-[13px] font-semibold text-[#0A4D68] underline-offset-4 transition hover:text-[#088395] hover:underline"
          >
            Forgot password?
          </button>
        </div>

        <div className="flex items-start gap-2.5 rounded-[14px] border border-[#BFEAF0] bg-[#E0F7FA] px-4 py-3.5 text-[12px] leading-relaxed text-[#0A4D68]">
          <Info size={17} className="mt-0.5 shrink-0 text-[#0A4D68]" />
          <span>{RESET_INFO}</span>
        </div>

        {(notification.message !== RESET_INFO || isLocked) && (
          <div
            role={notification.type === 'error' || notification.type === 'warning' ? 'alert' : 'status'}
            className={`flex min-h-11 items-start gap-2.5 rounded-[14px] border px-4 py-3 text-[12px] leading-relaxed ${notificationStyle}`}
          >
            {submitting ? (
              <Loader2 size={16} className="mt-0.5 shrink-0 animate-spin" />
            ) : (
              <NotificationIcon size={16} className="mt-0.5 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              {isLocked && <span className="mb-0.5 block font-bold">Account Temporarily Locked</span>}
              <span>{notification.message}</span>
              {isLocked && (
                <span className="ml-1.5 font-semibold tabular-nums">
                  Time remaining: {formatCountdown(lockoutSeconds)}
                </span>
              )}
            </div>
          </div>
        )}

        <button
          id="admin-login-btn"
          type="submit"
          disabled={submitting || isLocked || checkingLockout}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#0A4D68] to-[#088395] px-4 text-[15px] font-bold text-white shadow-[0_10px_24px_rgba(8,131,149,0.22)] transition-all duration-200 hover:from-[#083F56] hover:to-[#077584] hover:shadow-[0_12px_28px_rgba(8,131,149,0.3)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Authenticating...</>
          ) : (
            <>Log In <ArrowRight className="h-4 w-4" /></>
          )}
        </button>
      </form>

      <div className="mt-4 text-center text-[12px] font-medium text-slate-500">
        Laundry made easy.
      </div>
    </div>
  )
}
