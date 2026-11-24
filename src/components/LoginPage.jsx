import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import LoginForm from './auth/LoginForm'

export default function LoginPage() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-[320px] w-full items-center justify-center">
        <span className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-[#0A4D68]" />
      </div>
    )
  }

  if (user) return <Navigate to="/" replace />

  return <LoginForm />
}
