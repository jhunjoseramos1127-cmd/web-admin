import axios from 'axios'

export const ADMIN_API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim()
  || (import.meta.env.PROD ? 'https://freshspin-backend.onrender.com' : '/')

const api = axios.create({
  baseURL: ADMIN_API_BASE_URL,
  timeout: 15000,
})

function getUserErrorMessage(error) {
  const status = error.response?.status
  const body = error.response?.data

  if (!error.response) {
    return error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT'
      ? 'The request timed out. Check your connection and try again.'
      : 'Unable to connect to the server. Check your connection and try again.'
  }
  if (status === 401) return 'Your session has expired. Please sign in again.'
  if (status === 403) return 'You do not have permission to perform this action.'
  if (status === 404) return 'The requested information could not be found. Refresh and try again.'
  if (status === 429) return 'Too many requests. Please wait a moment and try again.'
  if (status >= 500) return 'The server is temporarily unavailable. Please try again later.'

  if (status === 422 && body?.errors && typeof body.errors === 'object') {
    const firstError = Object.values(body.errors).flat().find(
      (message) => typeof message === 'string' && message.trim()
    )
    if (firstError) return firstError.slice(0, 240)
  }

  const message = body?.message
  return typeof message === 'string' && message.trim() && message.length <= 240
    ? message.trim()
    : 'We could not complete that request. Check the information and try again.'
}

function isLoginRequest(error) {
  const path = error.config?.url?.split('?')[0]
  return path === '/api/login' || path === '/api/auth/login'
}

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('admin_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const isLogin = isLoginRequest(err)
    if (err.response?.status === 401 && !isLogin) {
      sessionStorage.removeItem('admin_token')
      sessionStorage.removeItem('admin_user')
      localStorage.removeItem('admin_token')
      localStorage.removeItem('admin_user')
      if (window.location.pathname !== '/login') {
        window.location.replace('/login')
      }
    }
    const message = err.response?.status === 401 && isLogin
      ? err.response.data?.message || 'Invalid email or password. Please try again.'
      : getUserErrorMessage(err)
    err.userMessage = message
    err.message = message
    if (err.response) {
      err.response.data = {
        success: false,
        message,
      }
    }
    return Promise.reject(err)
  }
)

export default api
