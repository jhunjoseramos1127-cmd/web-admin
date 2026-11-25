import { useState, useEffect, useMemo, useRef } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation, NavLink, useSearchParams } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts'
import {
  Waves, Droplets, CheckCircle2, Clock, AlertTriangle, Package, PhilippinePeso,
  Users, RefreshCw, Plus, Filter, ChevronRight, ArrowUpRight, Activity, Calendar,
  CreditCard, Smartphone, CheckCircle, XCircle, Settings, Send, Flame, Sparkles, FileText,
  Printer, Trash2, Archive, Edit3, ShieldAlert, Cpu, MapPin, Eye, Boxes, BarChart3, Bell, UserCheck, Wifi, Truck,
  Sun, CloudSun, CloudFog, CloudRain, CloudLightning, Cloud, Thermometer, WifiOff
} from 'lucide-react'
import InventoryView from './components/InventoryView'
import AnalyticsView from './components/AnalyticsView'
import ReportsView from './components/ReportsView'
import StaffManagementView from './components/StaffManagementView'
import AlertsView from './components/AlertsView'
import SettingsView from './components/SettingsView'
import SupportInbox from './components/SupportInbox'
import LoginPage from './components/LoginPage'
import AuthSplitScreen from './components/auth/AuthSplitScreen'
import PasswordRecoveryPage from './components/auth/PasswordRecoveryPage'
import AppLayout from './components/AppLayout'
import LoyaltyView from './components/LoyaltyView'
import ProtectedRoute from './components/ProtectedRoute'
import { Toast, ConfirmDialog, PaginationControls } from './components/shared'
import ExpandableSearch from './components/ExpandableSearch'
import { useAuth } from './context/AuthContext'
import api from './api/client'
import { formatCurrency } from './utils/currency'
import {
  LAUNDRY_STATUS_FLOW as ORDER_STATUS_STEPS,
  laundryStatusLabel,
  isTerminalLaundryStatus,
} from './utils/orderStatus'

// Reset the content scroller on every route change so each page starts at
// the top instead of inheriting the previous page's scroll position.
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    document.querySelector('main')?.scrollTo({ top: 0 })
  }, [pathname])
  return null
}

// ─── Payment method display helpers ───────────────────────────────────────────
const PAYMENT_METHODS = [
  { value: 'Cash', icon: PhilippinePeso, chip: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  { value: 'GCash', icon: Smartphone, chip: 'bg-brand-tintstrong text-navy border-brand-light' },
  { value: 'Maya', icon: Smartphone, chip: 'bg-teal-500/10 text-teal-400 border-teal-500/30' },
  { value: 'Other', icon: FileText, chip: 'bg-brand-tint text-ink-secondary border-line' },
]
const paymentMethodChip = (method) =>
  (PAYMENT_METHODS.find((m) => m.value === method) || PAYMENT_METHODS[PAYMENT_METHODS.length - 1]).chip
const isSupportAlert = (alert) =>
  alert?.type?.toUpperCase() === 'SUPPORT' || alert?.support_ticket_id != null

function AdminOnly({ children }) {
  const { user } = useAuth()
  return user?.role === 'admin' ? children : <Navigate to="/" replace />
}

const STANDARD_KG_SERVICE_NAME = 'Wash, Dry & Fold'
const MAX_ORDER_WEIGHT_KG = 999.99
const MAX_SPECIAL_ITEM_QUANTITY = 9999
const MAX_ORDER_NOTES_LENGTH = 500
const MAX_ORDER_CURRENCY = 999999999999.99

const normalizeDecimalInput = (value, maximum = null) => {
  const raw = String(value)
  if (raw === '') return ''
  if (!/^\d*\.?\d*$/.test(raw)) return null
  const hasDecimal = raw.includes('.')
  let [whole, fraction = ''] = raw.split('.')
  whole = whole.replace(/^0+(?=\d)/, '') || '0'
  fraction = fraction.slice(0, 2)
  const normalized = hasDecimal ? `${whole}.${fraction}` : whole
  const numeric = Number(normalized)
  if (maximum !== null && Number.isFinite(numeric) && numeric > maximum) {
    return maximum.toFixed(2).replace(/\.?0+$/, '')
  }
  return normalized
}

const normalizeIntegerInput = (value, maximum) => {
  const raw = String(value)
  if (!/^\d*$/.test(raw)) return null
  const normalized = raw.replace(/^0+(?=\d)/, '')
  if (!normalized) return ''
  const numeric = Number(normalized)
  return Number.isFinite(numeric) && numeric > maximum ? String(maximum) : normalized
}

const formatPhilippineMobile = (value) => {
  const digits = String(value).replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 4) return digits
  if (digits.length <= 7) return `${digits.slice(0, 4)}-${digits.slice(4)}`
  return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`
}

const sanitizeCustomerName = (value) => value.replace(/[0-9]/g, '')

const safeOrderAmount = (value, maximum = MAX_ORDER_CURRENCY) => {
  const amount = Number(value)
  return Number.isFinite(amount) ? Math.min(maximum, Math.max(0, amount)) : 0
}

const ADMIN_ORDER_STATUSES = [
  'Pending',
  'Accepted',
  'Washing',
  'Drying',
  'Ready for Pickup',
  'Completed',
  'Cancelled',
]

// ─── Not Found Page ───────────────────────────────────────────────────────────
function NotFound() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const raw = (location.pathname || '').toLowerCase()
    if (raw === '/index.html' || raw.endsWith('/index.html') || raw === '/dashboard') {
      navigate('/', { replace: true })
    }
  }, [location.pathname, navigate])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-6">
      <div className="text-8xl font-black text-line">404</div>
      <div>
        <h2 className="text-2xl font-bold text-navy mb-2">Page Not Found</h2>
        <p className="text-ink-secondary">The page you&apos;re looking for doesn&apos;t exist.</p>
      </div>
      <button
        onClick={() => navigate('/')}
        className="px-6 py-2.5 rounded-xl bg-navy hover:bg-navy-hover text-white font-bold text-sm transition"
      >
        Back to Dashboard
      </button>
    </div>
  )
}

// ─── Main App with all shared state ──────────────────────────────────────────
function MainApp() {
  const navigate = useNavigate()
  const { user } = useAuth()

  // --- Data State ---
  const [apiOnline, setApiOnline] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [telemetryRefreshing, setTelemetryRefreshing] = useState(false)
  const telemetryRefreshInFlight = useRef(false)
  const [dashboardData, setDashboardData] = useState(null)
  const [orders, setOrders] = useState([])
  const [customers, setCustomers] = useState([])
  const [services, setServices] = useState([])
  const [orderPricingLimits, setOrderPricingLimits] = useState(null)
  const [unreadAlerts, setUnreadAlerts] = useState(0)
  const [unreadSupport, setUnreadSupport] = useState(0)
  const [latestHumidity, setLatestHumidity] = useState({
    humidity: null,
    temperature: null,
    temperature_unit: '°C',
    status: 'UNAVAILABLE',
    temperature_status: 'NORMAL',
    threshold: 70.0,
    temperature_alert_threshold: 50.0,
    temperature_warning_threshold: 40.0,
    device_id: 'FRESHSPIN-ESP32-01',
    location: 'Drying Area #1 (Victoria, Laguna)',
    device_status: 'Humidity data temporarily unavailable',
    is_online: false,
    last_updated: null
  })
  const [humidityHistory, setHumidityHistory] = useState([])

  // --- UI State ---
  const [orderSearch, setOrderSearch] = useState('')
  const [orderStatusFilter, setOrderStatusFilter] = useState('All')
  const [orderPaymentFilter, setOrderPaymentFilter] = useState('All')
  const [paymentSearch, setPaymentSearch] = useState('')
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('All')
  const [customerSearch, setCustomerSearch] = useState('')
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false)
  const [isRecordPaymentModalOpen, setIsRecordPaymentModalOpen] = useState(false)
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false)
  const [selectedOrderDetails, setSelectedOrderDetails] = useState(null)
  const [orderDetailsLoadingId, setOrderDetailsLoadingId] = useState(null)
  const [orderForPayment, setOrderForPayment] = useState(null)
  const [notification, setNotification] = useState(null)

  // --- Form State ---
  const [newOrderCustomer, setNewOrderCustomer] = useState('')
  const [newOrderFulfillment, setNewOrderFulfillment] = useState('Pickup')
  const [newOrderNotes, setNewOrderNotes] = useState('')
  const [newOrderItems, setNewOrderItems] = useState([{ service_id: 1, quantity: 0, notes: '' }])
  const [paymentOrderId, setPaymentOrderId] = useState('')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('Cash')
  const [paymentReference, setPaymentReference] = useState('')
  const [paymentOtherMethod, setPaymentOtherMethod] = useState('')
  const [paymentOrderBalance, setPaymentOrderBalance] = useState(null)
  const [paymentOrderLoading, setPaymentOrderLoading] = useState(false)
  const [paymentFormErrors, setPaymentFormErrors] = useState({})
  const [newCustFirstName, setNewCustFirstName] = useState('')
  const [newCustLastName, setNewCustLastName] = useState('')
  const [newCustPhone, setNewCustPhone] = useState('')
  const [newCustEmail, setNewCustEmail] = useState('')
  const [newCustAddress, setNewCustAddress] = useState('')
  const [newCustomerErrors, setNewCustomerErrors] = useState({})
  const [customerStatusFilter, setCustomerStatusFilter] = useState('active')
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [editCustForm, setEditCustForm] = useState({ first_name: '', last_name: '', phone: '', email: '', address: '', notes: '' })
  const [archivingCustomer, setArchivingCustomer] = useState(null)
  const [restoringCustomer, setRestoringCustomer] = useState(null)
  const [customerSaving, setCustomerSaving] = useState(false)
  const [customerAccountActionBusy, setCustomerAccountActionBusy] = useState(false)
  const [orderSaving, setOrderSaving] = useState(false)
  const [paymentSaving, setPaymentSaving] = useState(false)
  const [customerAdding, setCustomerAdding] = useState(false)
  const [markingPaidIds, setMarkingPaidIds] = useState(() => new Set())
  const orderCreateInFlight = useRef(false)
  const paymentInFlight = useRef(false)
  const paymentIdempotencyRef = useRef(null)
  const customerCreateInFlight = useRef(false)
  const markPaidInFlight = useRef(new Set())
  const customerSaveInFlight = useRef(false)
  const customerAccountActionInFlight = useRef(false)
  const [newOrderCharges, setNewOrderCharges] = useState('')
  const [newOrderChargesReason, setNewOrderChargesReason] = useState('')
  const [newOrderDiscount, setNewOrderDiscount] = useState('')
  const [orderValidationVisible, setOrderValidationVisible] = useState(false)

  const showToast = (message, type = 'success') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 4000)
  }

  // --- API Fetch ---
  const fetchAllData = async ({ quiet = false } = {}) => {
    setLoading(true)
    setLoadError(null)
    let requestFailed = false
    const safeGet = async (endpoint) => {
      try {
        return await api.get(endpoint)
      } catch {
        requestFailed = true
        return null
      }
    }

    try {
      const healthRes = await safeGet('/api/health')
      if (healthRes?.data?.status === 'ok') {
        setApiOnline(true)

        const dashRes = await safeGet('/api/dashboard')
        if (dashRes?.data?.data && typeof dashRes.data.data === 'object') {
          setDashboardData(dashRes.data.data)
        } else if (dashRes) {
          requestFailed = true
        }

        const humRes = await safeGet('/api/humidity/latest')
        if (humRes?.data?.data && typeof humRes.data.data === 'object') {
          setLatestHumidity(humRes.data.data)
        } else if (humRes) {
          requestFailed = true
        }

        const histRes = await safeGet('/api/humidity/history?limit=30')
        if (Array.isArray(histRes?.data?.data?.logs)) {
          const formatted = histRes.data.data.logs.map(log => ({
            id: log.id,
            time: new Date(log.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            recorded_at: log.recorded_at,
            humidity: log.humidity !== null && !isNaN(log.humidity) ? parseFloat(log.humidity) : null,
            temperature: log.temperature !== null && !isNaN(log.temperature) ? parseFloat(log.temperature) : null,
            status: log.status
          })).reverse()
          setHumidityHistory(formatted)
        } else if (histRes) {
          requestFailed = true
        }

        const ordersRes = await safeGet('/api/orders')
        if (Array.isArray(ordersRes?.data?.data)) {
          setOrders(ordersRes.data.data)
        } else if (ordersRes) {
          requestFailed = true
        }

        const custRes = await safeGet('/api/customers')
        if (Array.isArray(custRes?.data?.data)) {
          setCustomers(custRes.data.data)
        } else if (custRes) {
          requestFailed = true
        }

        const servRes = await safeGet('/api/services')
        if (Array.isArray(servRes?.data?.data)) {
          setServices(servRes.data.data)
        } else if (servRes) {
          requestFailed = true
        }

        const settingsRes = await safeGet('/api/settings')
        const settings = settingsRes?.data?.data
        if (settings && Number.isFinite(Number(settings.max_additional_charges)) && Number.isFinite(Number(settings.max_discount))) {
          setOrderPricingLimits({
            max_additional_charges: Number(settings.max_additional_charges),
            max_discount: Number(settings.max_discount),
          })
        } else if (settingsRes) {
          requestFailed = true
        }

        const alertsRes = await safeGet('/api/alerts')
        if (Array.isArray(alertsRes?.data?.data)) {
          setUnreadAlerts(Number.isFinite(alertsRes.data.unread_count)
            ? alertsRes.data.unread_count
            : alertsRes.data.data.filter(a => !a.is_read && !isSupportAlert(a)).length)
          setUnreadSupport(Number.isFinite(alertsRes.data.support_unread_count)
            ? alertsRes.data.support_unread_count
            : alertsRes.data.data.filter(a => !a.is_read && isSupportAlert(a)).length)
        } else if (alertsRes) {
          requestFailed = true
        }

        if (requestFailed) {
          const message = 'Some FreshSpin data could not be refreshed. Please retry.'
          setLoadError(message)
          if (!quiet) showToast(message, 'error')
        }
      } else {
        setApiOnline(false)
        const message = 'Unable to connect to FreshSpin. Check your connection and retry.'
        setLoadError(message)
        if (!quiet) showToast(message, 'error')
      }
    } catch {
      setApiOnline(false)
      const message = 'Unable to connect to FreshSpin. Check your connection and retry.'
      setLoadError(message)
      if (!quiet) showToast(message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAllData()
    const interval = setInterval(() => fetchAllData({ quiet: true }), 30000)
    return () => clearInterval(interval)
  }, [])

  // Notification badge polling every 15s
  useEffect(() => {
    if (!apiOnline) return
    const poll = setInterval(async () => {
      try {
        const res = await api.get('/api/alerts')
        if (Array.isArray(res?.data?.data)) {
          setUnreadAlerts(Number.isFinite(res.data.unread_count)
            ? res.data.unread_count
            : res.data.data.filter(a => !a.is_read && !isSupportAlert(a)).length)
          setUnreadSupport(Number.isFinite(res.data.support_unread_count)
            ? res.data.support_unread_count
            : res.data.data.filter(a => !a.is_read && isSupportAlert(a)).length)
        }
      } catch {
        /* keep old count */
      }
    }, 15000)
    return () => clearInterval(poll)
  }, [apiOnline])

  // Telemetry polling every 10s (actual database readings)
  useEffect(() => {
    const poll = setInterval(async () => {
      const res = await api.get('/api/humidity/latest').catch(() => null)
      if (res?.data?.data && typeof res.data.data === 'object' && !Array.isArray(res.data.data)) {
        setLatestHumidity(res.data.data)
      }

      const histRes = await api.get('/api/humidity/history?limit=30').catch(() => null)
      if (Array.isArray(histRes?.data?.data?.logs)) {
        const formatted = histRes.data.data.logs.map(log => ({
          id: log.id,
          time: new Date(log.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          recorded_at: log.recorded_at,
          humidity: log.humidity !== null && !isNaN(log.humidity) ? parseFloat(log.humidity) : null,
          temperature: log.temperature !== null && !isNaN(log.temperature) ? parseFloat(log.temperature) : null,
          status: log.status
        })).reverse()
        setHumidityHistory(formatted)
      }
    }, 10000)
    return () => clearInterval(poll)
  }, [])

  // --- Computed Metrics ---
  const metrics = useMemo(() => {
    const totalOrdersCount = orders.length
    const activeOrders = orders.filter(o => !isTerminalLaundryStatus(o.laundry_status))
    const pickedUpOrders = orders.filter(o => o.laundry_status === 'Completed')
    const totalRevenue = orders.reduce((sum, o) => {
      const paid = o.paid_amount || (o.payment_status === 'Paid' ? o.total_amount : 0)
      return sum + Number(paid || 0)
    }, 0)
    const pendingPaymentsCount = orders.filter(o => o.payment_status === 'Unpaid' || o.payment_status === 'Partial').length
    const unpaidAmount = orders.reduce((sum, o) => sum + Number(o.remaining_balance || (o.payment_status === 'Unpaid' ? o.total_amount : 0)), 0)
    return { totalOrdersCount, activeOrdersCount: activeOrders.length, pickedUpOrdersCount: pickedUpOrders.length, totalRevenue, pendingPaymentsCount, unpaidAmount }
  }, [orders])

  const pipelineCounts = useMemo(() => {
    const counts = Object.fromEntries(ORDER_STATUS_STEPS.map(s => [s, 0]))
    counts.Cancelled = 0
    if (orders?.length > 0) {
      [...ORDER_STATUS_STEPS, 'Cancelled'].forEach(s => { counts[s] = orders.filter(o => o.laundry_status === s).length })
    }
    return counts
  }, [orders])

  const navigateToOrdersWithStatus = (stage) => {
    setOrderStatusFilter(stage)
    setOrderSearch('')
    navigate('/orders')
  }

  const PIPELINE_STAGES = useMemo(() => [
    { id: 'Pending', label: 'Pending', step: '01', icon: Clock, count: pipelineCounts.Pending, color: 'amber', borderColor: 'border-amber-500/40 hover:border-amber-400', bgColor: 'bg-white hover:bg-brand-tint', textColor: 'text-amber-400', badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/30', progressColor: 'bg-amber-400', glowColor: 'hover:shadow-amber-500/10', description: 'Booked, awaiting drop-off at the shop', activeText: 'Awaiting Intake' },
    { id: 'Accepted', label: 'Accepted', step: '02', icon: Package, count: pipelineCounts.Accepted, color: 'blue', borderColor: 'border-brand-light hover:border-navy', bgColor: 'bg-white hover:bg-brand-tint', textColor: 'text-navy', badgeBg: 'bg-brand-tint text-navy border-brand-light', progressColor: 'bg-brand-light', glowColor: 'hover:shadow-card', description: 'Order accepted and queued for processing', activeText: 'Awaiting Wash Cycle' },
    { id: 'Washing', label: 'Washing', step: '03', icon: Waves, count: pipelineCounts.Washing, color: 'cyan', borderColor: 'border-brand-light hover:border-navy', bgColor: 'bg-white hover:bg-brand-tint', textColor: 'text-navy', badgeBg: 'bg-brand-tintstrong text-navy border-brand-light', progressColor: 'bg-brand-light', glowColor: 'hover:shadow-card', description: 'Active drum agitation & cycles', activeText: 'In Drum Processing' },
    { id: 'Drying', label: 'Drying', step: '04', icon: Flame, count: pipelineCounts.Drying, color: 'amber', borderColor: 'border-amber-500/40 hover:border-amber-400', bgColor: 'bg-white hover:bg-brand-tint', textColor: 'text-amber-400', badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/30', progressColor: 'bg-amber-400', glowColor: 'hover:shadow-amber-500/10', description: 'ESP32 sensor-monitored drying', activeText: 'Moisture Tracking' },
    { id: 'Ready for Pickup', label: 'Ready for Pickup', step: '05', icon: CheckCircle2, count: pipelineCounts['Ready for Pickup'], color: 'emerald', borderColor: 'border-emerald-500/40 hover:border-emerald-400', bgColor: 'bg-white hover:bg-brand-tint', textColor: 'text-emerald-400', badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', progressColor: 'bg-emerald-400', glowColor: 'hover:shadow-emerald-500/10', description: 'Ready for customer pickup', activeText: 'Awaiting Pickup' },
    { id: 'Completed', label: 'Completed', step: '06', icon: CheckCircle2, count: pipelineCounts.Completed, color: 'green', borderColor: 'border-green-500/40 hover:border-green-400', bgColor: 'bg-white hover:bg-brand-tint', textColor: 'text-green-400', badgeBg: 'bg-green-500/20 text-green-300 border-green-500/30', progressColor: 'bg-green-400', glowColor: 'hover:shadow-green-500/10', description: 'Order completed', activeText: 'Completed' },
    { id: 'Cancelled', label: 'Cancelled', step: '07', icon: XCircle, count: pipelineCounts.Cancelled, color: 'rose', borderColor: 'border-rose-500/40 hover:border-rose-400', bgColor: 'bg-white hover:bg-brand-tint', textColor: 'text-rose-500', badgeBg: 'bg-rose-500/10 text-rose-700 border-rose-300', progressColor: 'bg-rose-500', glowColor: 'hover:shadow-rose-500/10', description: 'Orders cancelled by the shop or customer', activeText: 'Cancelled' }
  ], [pipelineCounts])

  const allPayments = useMemo(() => {
    let pList = []
    orders.forEach(o => {
      if (o.payments?.length > 0) {
        o.payments.forEach(p => pList.push({ ...p, order_number: o.order_number, customer_name: o.customer ? `${o.customer.first_name} ${o.customer.last_name}` : 'Guest' }))
      }
    })
    return pList.sort((a, b) => new Date(b.payment_date || b.created_at) - new Date(a.payment_date || a.created_at))
  }, [orders])

  // Active services are the only ones selectable when creating a new order.
  const activeServices = useMemo(() => services.filter(s => s.status === 'active'), [services])

  // New kilogram orders always use the standard full-service package.
  const standardKgService = useMemo(() => {
    return activeServices.find(s => s.name === STANDARD_KG_SERVICE_NAME && s.unit === 'kg') || null
  }, [activeServices])

  // Per-piece extras (e.g. Comforter) offered as optional add-ons in the order form.
  const specialServices = useMemo(
    () => activeServices.filter(s => s.unit !== 'kg'),
    [activeServices]
  )

  // Laravel serialises relations snake_cased (order_items) - accept both shapes.
  const orderItemsOf = (order) => order?.order_items || order?.orderItems || []

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchSearch =
        order.order_number.toLowerCase().includes(orderSearch.toLowerCase()) ||
        (order.customer && `${order.customer.first_name} ${order.customer.last_name}`.toLowerCase().includes(orderSearch.toLowerCase())) ||
        (order.customer?.phone && order.customer.phone.includes(orderSearch))
      const matchStatus = orderStatusFilter === 'All' || order.laundry_status === orderStatusFilter
      const paidAmount = Array.isArray(order.payments)
        ? order.payments.reduce((total, payment) => total + (payment.status === 'Paid' ? Number(payment.amount) || 0 : 0), 0)
        : Number(order.paid_amount) || 0
      const isFullyPaid = paidAmount > 0 && paidAmount >= Number(order.total_amount)
      const matchPayment = orderPaymentFilter === 'All' ||
        (orderPaymentFilter === 'Paid' ? isFullyPaid : !isFullyPaid)
      return matchSearch && matchStatus && matchPayment
    })
  }, [orders, orderSearch, orderStatusFilter, orderPaymentFilter])

  // Live order total preview: items + additional charges - discount.
  const newOrderTotals = useMemo(() => {
    const lines = newOrderItems.map((item, index) => {
      const srv = services.find(s => s.id === Number(item.service_id))
      const qty = safeOrderAmount(item.quantity, index === 0 ? MAX_ORDER_WEIGHT_KG : MAX_SPECIAL_ITEM_QUANTITY)
      const price = srv ? safeOrderAmount(srv.price) : 0
      const subtotal = safeOrderAmount(Math.round(qty * price * 100) / 100)
      return { service: srv, qty, price, subtotal }
    })
    const subtotal = safeOrderAmount(Math.round(lines.reduce((sum, line) => sum + line.subtotal, 0) * 100) / 100)
    const charges = safeOrderAmount(newOrderCharges)
    const discount = safeOrderAmount(newOrderDiscount)
    const total = safeOrderAmount(Math.round((subtotal + charges - discount) * 100) / 100)
    return { lines, subtotal, charges, discount, total }
  }, [newOrderItems, newOrderCharges, newOrderDiscount, services])

  const orderValidation = useMemo(() => {
    const extras = newOrderItems.slice(1)
    const kgEntry = String(newOrderItems[0]?.quantity ?? '')
    const kgAmount = kgEntry === '' ? 0 : Number(kgEntry)
    const customerValid = customers.some(customer =>
      customer.status !== 'inactive' && String(customer.id) === String(newOrderCustomer)
    )
    const chargeLimit = Number(orderPricingLimits?.max_additional_charges)
    const discountLimit = Number(orderPricingLimits?.max_discount)
    const limitsReady = Number.isFinite(chargeLimit) && chargeLimit >= 0 && Number.isFinite(discountLimit) && discountLimit >= 0
    const validDecimalEntry = (entry) => {
      if (entry === '') return true
      if (!/^\d+(\.\d{0,2})?$/.test(String(entry))) return false
      const amount = Number(entry)
      return Number.isFinite(amount) && amount >= 0
    }
    const extraErrors = extras.map(item => {
      const quantity = String(item.quantity ?? '')
      const validQuantity = /^\d+$/.test(quantity) && Number(quantity) > 0 && Number(quantity) <= MAX_SPECIAL_ITEM_QUANTITY
      const service = activeServices.find(candidate => candidate.id === Number(item.service_id))
      return !service || service.unit === 'kg' || !validQuantity
    })
    const subtotal = newOrderTotals.subtotal
    const chargesAmount = Number(newOrderCharges) || 0
    const discountAmount = Number(newOrderDiscount) || 0
    const totalBeforeClamp = subtotal + chargesAmount - discountAmount
    const maximumAllowedDiscount = limitsReady ? Math.min(discountLimit, subtotal * 0.5, subtotal) : 0
    const errors = {
      configuration: !limitsReady,
      customer: !customerValid,
      weight: !validDecimalEntry(kgEntry) || (kgAmount > MAX_ORDER_WEIGHT_KG) || (kgAmount <= 0 && extras.length === 0),
      extras: extraErrors,
      charges: !limitsReady || !validDecimalEntry(newOrderCharges) || chargesAmount > chargeLimit,
      chargeReason: chargesAmount > 0 && !newOrderChargesReason.trim(),
      discount: !limitsReady || !validDecimalEntry(newOrderDiscount) || discountAmount > maximumAllowedDiscount,
      total: !Number.isFinite(totalBeforeClamp) || totalBeforeClamp < 0,
      notes: newOrderNotes.length > MAX_ORDER_NOTES_LENGTH,
    }
    const firstMessage = errors.configuration ? 'Order charge limits are unavailable. Refresh the page and try again.'
      : errors.customer ? 'Choose a customer to continue.'
      : errors.weight ? 'Enter a weight from 0.01 to 999.99 kg, or add a special item.'
        : errors.extras.some(Boolean) ? 'Choose a valid special item and enter a whole-number quantity from 1 to 9,999.'
          : errors.charges ? `Additional charges must be from ₱0.00 to ${formatCurrency(chargeLimit)}.`
            : errors.chargeReason ? 'Enter a reason for the additional charge.'
              : errors.discount ? `Discount cannot exceed ${formatCurrency(maximumAllowedDiscount)} (the lower of its configured limit and 50% of laundry subtotal).`
              : errors.total ? 'The order total cannot be less than ₱0.00.'
                : errors.notes ? `Care Instructions must be ${MAX_ORDER_NOTES_LENGTH} characters or fewer.`
                  : ''
    return { errors, firstMessage, hasErrors: Boolean(firstMessage) }
  }, [activeServices, customers, newOrderCustomer, newOrderItems, newOrderCharges, newOrderChargesReason, newOrderDiscount, newOrderNotes, newOrderTotals, orderPricingLimits])

  const filteredPayments = useMemo(() => {
    return allPayments.filter(p => {
      const matchSearch =
        (p.payment_reference && p.payment_reference.toLowerCase().includes(paymentSearch.toLowerCase())) ||
        (p.order_number && p.order_number.toLowerCase().includes(paymentSearch.toLowerCase())) ||
        (p.customer_name && p.customer_name.toLowerCase().includes(paymentSearch.toLowerCase()))
      const matchMethod = paymentMethodFilter === 'All' || p.payment_method === paymentMethodFilter
      return matchSearch && matchMethod
    })
  }, [allPayments, paymentSearch, paymentMethodFilter])

  // --- Actions ---
  const handleUpdateOrderStatus = async (orderId, newStatus, reason = null) => {
    try {
      const res = await api.put(`/api/orders/${orderId}/status`, {
        status: newStatus,
        ...(reason ? { reason } : {}),
      })
      const updated = res?.data?.data
      if (!updated) {
        throw new Error('The server did not return the updated order.')
      }

      setOrders(prev => prev.map(order => order.id === orderId ? { ...order, ...updated } : order))
      setSelectedOrderDetails(current => current?.id === orderId ? { ...current, ...updated } : current)

      try {
        const ordersRes = await api.get('/api/orders')
        if (!Array.isArray(ordersRes?.data?.data)) {
          throw new Error('The server returned an invalid order list.')
        }
        setOrders(ordersRes.data.data)
        const refreshedOrder = ordersRes.data.data.find(order => order.id === orderId)
        if (refreshedOrder) {
          setSelectedOrderDetails(current => current?.id === orderId ? refreshedOrder : current)
        }
      } catch {
        showToast(`Status saved as "${newStatus}", but the order list could not be refreshed.`, 'error')
        return true
      }

      showToast(`Order status updated to "${newStatus}"!`)
      return true
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update status on server.', 'error')
      return false
    }
  }

  const openOrderDetails = async (order) => {
    if (orderDetailsLoadingId !== null) return
    setSelectedOrderDetails(null)
    setOrderDetailsLoadingId(order.id)
    try {
      const res = await api.get(`/api/orders/${order.id}`)
      if (!res?.data?.data) {
        throw new Error('The server did not return this order.')
      }
      setSelectedOrderDetails(res.data.data)
    } catch (err) {
      showToast(err.response?.data?.message || 'Unable to load order details.', 'error')
    } finally {
      setOrderDetailsLoadingId(null)
    }
  }

  const handleCreateOrder = async (e) => {
    e.preventDefault()
    setOrderValidationVisible(true)
    if (orderCreateInFlight.current) return
    if (orderValidation.hasErrors) { showToast(orderValidation.firstMessage, 'error'); return }
    if (activeServices.length === 0) { showToast('No active services available. Check Pricing.', 'error'); return }
    if (!standardKgService) { showToast('The standard per-kilogram service is inactive. Activate it in Pricing.', 'error'); return }
    const items = []
    const [kgLine, ...extras] = newOrderItems
    const weight = Number(kgLine?.quantity) || 0
    for (const item of extras) {
      const srv = activeServices.find(s => s.id === Number(item.service_id))
      if (!srv) { showToast('Please choose an active service for every special item', 'error'); return }
      if (srv.unit === 'kg') { showToast('Special items must be per-piece services — the laundry weight covers per-kilogram services', 'error'); return }
      const qty = Number(item.quantity) || 0
      if (!Number.isInteger(qty) || qty <= 0 || qty > MAX_SPECIAL_ITEM_QUANTITY) { showToast('Special-item quantity must be between 1 and 9,999', 'error'); return }
      items.push({ service_id: srv.id, quantity: qty, notes: item.notes || null })
    }
    if (weight > 0) {
      items.unshift({ service_id: standardKgService.id, quantity: weight, notes: kgLine?.notes || null })
    }
    if (items.length === 0) { showToast('Enter the laundry weight in kilograms or add a special item', 'error'); return }
    orderCreateInFlight.current = true
    setOrderSaving(true)
    try {
      const res = await api.post('/api/orders', {
        customer_id: Number(newOrderCustomer),
        fulfillment_type: 'Pickup',
        notes: newOrderNotes || null,
        additional_charges: Number(newOrderCharges) || 0,
        additional_charges_reason: Number(newOrderCharges) > 0 ? newOrderChargesReason.trim() : null,
        discount: Number(newOrderDiscount) || 0,
        items,
      })
      const created = res.data?.data
      showToast(`Order ${created?.order_number || ''} created successfully! (${formatCurrency(Number(created?.total_amount) || 0)})`.trim())
      setIsNewOrderModalOpen(false)
      resetNewOrderForm()
      await fetchAllData()
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to create order on server.', 'error')
    } finally {
      orderCreateInFlight.current = false
      setOrderSaving(false)
    }
  }

  // The standard kilogram service starts every new order.
  const defaultServiceId = () => standardKgService?.id || ''

  const resetNewOrderForm = () => {
    setOrderValidationVisible(false)
    setNewOrderCustomer('')
    setNewOrderNotes('')
    setNewOrderCharges('')
    setNewOrderChargesReason('')
    setNewOrderDiscount('')
    setNewOrderItems([{ service_id: defaultServiceId(), quantity: 0, notes: '' }])
  }

  // Always start a new order from an active per-kilogram service.
  const handleOpenNewOrder = () => {
    setOrderValidationVisible(false)
    setNewOrderItems([{ service_id: defaultServiceId(), quantity: 0, notes: '' }])
    setNewOrderCharges('')
    setNewOrderChargesReason('')
    setNewOrderDiscount('')
    setIsNewOrderModalOpen(true)
  }

  // One-click payment: settles the full remaining balance of an order.
  const handleMarkAsPaid = async (order) => {
    if (markPaidInFlight.current.has(order.id)) return
    markPaidInFlight.current.add(order.id)
    setMarkingPaidIds(new Set(markPaidInFlight.current))
    try {
      const res = await api.post(`/api/orders/${order.id}/mark-paid`)
      showToast(res.data?.message || `${order.order_number} marked as paid!`)
      await fetchAllData()
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to mark order as paid.', 'error')
    } finally {
      markPaidInFlight.current.delete(order.id)
      setMarkingPaidIds(new Set(markPaidInFlight.current))
    }
  }

  const handleUpdateCustomer = async (e) => {
    e.preventDefault()
    if (!editingCustomer || customerSaveInFlight.current) return
    if (!editCustForm.first_name || !editCustForm.last_name || !editCustForm.phone) {
      showToast('Please fill in required customer fields', 'error')
      return
    }
    customerSaveInFlight.current = true
    setCustomerSaving(true)
    try {
      const res = await api.put(`/api/customers/${editingCustomer.id}`, {
        first_name: editCustForm.first_name,
        last_name: editCustForm.last_name,
        phone: editCustForm.phone,
        email: editCustForm.email || null,
        address: editCustForm.address || null,
        notes: editCustForm.notes || null,
      })
      const updated = res.data?.data
      showToast(`${updated?.first_name || ''} ${updated?.last_name || ''} profile updated.`.trim())
      setEditingCustomer(null)
      await fetchAllData()
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save customer changes.', 'error')
    } finally {
      customerSaveInFlight.current = false
      setCustomerSaving(false)
    }
  }

  const handleArchiveCustomer = async () => {
    if (!archivingCustomer || customerAccountActionInFlight.current) return
    customerAccountActionInFlight.current = true
    setCustomerAccountActionBusy(true)
    try {
      const res = await api.post(`/api/customers/${archivingCustomer.id}/archive`)
      showToast(res.data?.message || 'Customer deactivated.')
      setArchivingCustomer(null)
      await fetchAllData()
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to deactivate customer.', 'error')
    } finally {
      customerAccountActionInFlight.current = false
      setCustomerAccountActionBusy(false)
    }
  }

  const handleRestoreCustomer = async () => {
    if (!restoringCustomer || customerAccountActionInFlight.current) return
    customerAccountActionInFlight.current = true
    setCustomerAccountActionBusy(true)
    try {
      const res = await api.post(`/api/customers/${restoringCustomer.id}/restore`)
      showToast(res.data?.message || 'Customer activated.')
      setRestoringCustomer(null)
      await fetchAllData()
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to activate customer.', 'error')
    } finally {
      customerAccountActionInFlight.current = false
      setCustomerAccountActionBusy(false)
    }
  }

  // Pricing: active services are selectable for new orders.
  const handleToggleService = async (service) => {
    const nextStatus = service.status === 'active' ? 'inactive' : 'active'
    try {
      const res = await api.put(`/api/services/${service.id}`, { status: nextStatus })
      setServices(prev => prev.map(s => (s.id === service.id ? { ...s, status: nextStatus } : s)))
      showToast(
        res.data?.message || `${service.name} is now ${nextStatus === 'active' ? 'Active — available for new orders' : 'Inactive — hidden from new orders'}.`
      )
      await fetchAllData()
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update service status.', 'error')
    }
  }

  // Pricing: update a service's price. Applies to new orders immediately;
  // existing orders keep the unit prices recorded on them.
  const handleUpdateServicePrice = async (service, price, confirmed = false) => {
    const value = Number(price)
    if (!Number.isFinite(value) || value < 0) { showToast('Enter a valid price of ₱0 or more', 'error'); return false }
    if (!confirmed) { showToast('Admin confirmation is required before changing the price.', 'error'); return false }
    const current = Number(service.price)
    const increase = value - current
    const maximumIncrease = Math.min(100, current * 0.30)
    if (increase > 100 || increase > maximumIncrease) {
      showToast(`Price increase exceeds the limit: ₱100.00 or 30% of ₱${current.toFixed(2)} (₱${maximumIncrease.toFixed(2)}), whichever is lower.`, 'error')
      return false
    }
    try {
      const res = await api.put(`/api/services/${service.id}`, { price: value, confirmed: true })
      const updated = res.data?.data
      if (updated) setServices(prev => prev.map(s => (s.id === service.id ? { ...s, ...updated } : s)))
      else await fetchAllData()
      showToast(`${service.name} price updated to ${formatCurrency(value)}`)
      return true
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update price on server.', 'error')
      return false
    }
  }

  const handleRecordPayment = async (e) => {
    e.preventDefault()
    if (paymentInFlight.current) return
    const errors = {}
    if (!paymentOrderId) errors.order = 'Select an order with an outstanding balance.'
    if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(paymentAmount) || Number(paymentAmount) < 1) errors.amount = 'Enter a payment amount of at least ₱1.00 with up to 2 decimal places.'
    if (paymentMethod === 'GCash' || paymentMethod === 'Maya') {
      if (!paymentReference.trim()) errors.reference = `A transaction reference number is required for ${paymentMethod}.`
    }
    if (paymentMethod === 'Other' && !paymentOtherMethod.trim()) errors.otherMethod = 'Specify the payment method.'
    setPaymentFormErrors(errors)
    if (Object.keys(errors).length) return
    const amt = Number(paymentAmount)
    if (paymentOrderBalance !== null && amt > Number(paymentOrderBalance)) {
      setPaymentFormErrors({ ...errors, amount: `Payment cannot exceed the remaining balance of ₱${Number(paymentOrderBalance).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.` })
      return
    }
    paymentInFlight.current = true
    setPaymentSaving(true)
    try {
      const payment = {
        order_id: Number(paymentOrderId),
        amount: paymentAmount,
        payment_method: paymentMethod,
        reference_number: ['GCash', 'Maya'].includes(paymentMethod) ? paymentReference.trim() : null,
        other_method: paymentMethod === 'Other' ? paymentOtherMethod.trim() : null,
        notes: ['GCash', 'Maya'].includes(paymentMethod) ? null : paymentReference.trim() || null,
      }
      const latestOrder = (await api.get(`/api/orders/${paymentOrderId}`)).data?.data
      const latestBalance = Number(latestOrder?.remaining_balance)
      if (!Number.isFinite(latestBalance) || latestBalance <= 0 || latestOrder?.laundry_status === 'Cancelled' || latestOrder?.payment_status === 'Paid') {
        throw new Error('This order has no remaining balance and cannot receive another payment.')
      }
      setPaymentOrderBalance(latestBalance)
      if (amt > latestBalance) throw new Error(`Payment exceeds the latest remaining balance of ₱${latestBalance.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`)
      const fingerprint = JSON.stringify(payment)
      if (!paymentIdempotencyRef.current || paymentIdempotencyRef.current.fingerprint !== fingerprint) {
        paymentIdempotencyRef.current = { fingerprint, key: crypto.randomUUID() }
      }
      const res = await api.post('/api/payments', {
        ...payment,
        idempotency_key: paymentIdempotencyRef.current.key,
      })
      const ref = res.data?.data?.payment?.payment_reference || res.data?.data?.payment?.reference_number
      showToast(`Payment of ₱${amt.toFixed(2)} recorded${ref ? ` (${ref})` : ''}`)
      paymentIdempotencyRef.current = null
      setIsRecordPaymentModalOpen(false)
      setPaymentOrderId('')
      setPaymentAmount('')
      setPaymentReference('')
      setPaymentOtherMethod('')
      setPaymentOrderBalance(null)
      setPaymentFormErrors({})
      await fetchAllData()
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Failed to record payment on server.'
      if (/remaining balance|overpayment/i.test(message)) setPaymentFormErrors(current => ({ ...current, amount: message }))
      if (err.response?.data?.errors?.reference_number) setPaymentFormErrors(current => ({ ...current, reference: err.response.data.errors.reference_number[0] }))
      if (err.response?.data?.errors?.other_method) setPaymentFormErrors(current => ({ ...current, otherMethod: err.response.data.errors.other_method[0] }))
      showToast(message, 'error')
    } finally {
      paymentInFlight.current = false
      setPaymentSaving(false)
    }
  }

  const handlePaymentOrderSelect = async (id) => {
    setPaymentOrderId(id)
    setPaymentAmount('')
    setPaymentOrderBalance(null)
    setPaymentFormErrors({})
    if (!id) return
    setPaymentOrderLoading(true)
    try {
      const order = (await api.get(`/api/orders/${id}`)).data?.data
      const balance = Number(order?.remaining_balance)
      if (!order || !Number.isFinite(balance) || balance <= 0 || order.laundry_status === 'Cancelled' || order.payment_status === 'Paid') {
        setPaymentFormErrors({ order: 'This order is cancelled or already fully paid.' })
        return
      }
      setPaymentOrderBalance(balance)
      setPaymentAmount(balance.toFixed(2))
    } catch (err) {
      setPaymentFormErrors({ order: err.response?.data?.message || 'Unable to retrieve the latest order balance.' })
    } finally {
      setPaymentOrderLoading(false)
    }
  }

  const handleAddCustomer = async (e) => {
    e.preventDefault()
    if (customerCreateInFlight.current) return
    const phoneDigits = newCustPhone.replace(/\D/g, '')
    const errors = {
      first_name: !newCustFirstName.trim() ? 'First name is required.' : newCustFirstName.trim().length > 100 ? 'First name must be 100 characters or fewer.' : '',
      last_name: !newCustLastName.trim() ? 'Last name is required.' : newCustLastName.trim().length > 100 ? 'Last name must be 100 characters or fewer.' : '',
      phone: !phoneDigits ? 'Mobile phone is required.' : !/^09\d{9}$/.test(phoneDigits) ? 'Enter a valid 11-digit mobile number starting with 09.' : '',
      address: newCustAddress.trim().length > 255 ? 'Address must be 255 characters or fewer.' : '',
    }
    setNewCustomerErrors(errors)
    if (Object.values(errors).some(Boolean)) {
      showToast('Please correct the highlighted customer fields.', 'error')
      return
    }
    customerCreateInFlight.current = true
    setCustomerAdding(true)
    try {
      const res = await api.post('/api/customers', {
        first_name: newCustFirstName.trim(),
        last_name: newCustLastName.trim(),
        phone: phoneDigits,
        email: newCustEmail || null,
        address: newCustAddress.trim() || null,
      })
      const created = res.data?.data
      showToast(`Customer ${created?.first_name || newCustFirstName} ${created?.last_name || newCustLastName} added!`.trim())
      setIsAddCustomerModalOpen(false)
      setNewCustFirstName(''); setNewCustLastName(''); setNewCustPhone(''); setNewCustEmail(''); setNewCustAddress('')
      setNewCustomerErrors({})
      await fetchAllData()
    } catch (err) {
      const serverErrors = err.response?.data?.errors
      if (serverErrors) {
        setNewCustomerErrors({
          first_name: serverErrors.first_name?.[0] || '',
          last_name: serverErrors.last_name?.[0] || '',
          phone: serverErrors.phone?.[0] || '',
          address: serverErrors.address?.[0] || '',
        })
      }
      showToast(err.response?.data?.message || 'Failed to add customer on server.', 'error')
    } finally {
      customerCreateInFlight.current = false
      setCustomerAdding(false)
    }
  }

  const handleRefreshTelemetry = async () => {
    if (telemetryRefreshInFlight.current) return
    telemetryRefreshInFlight.current = true
    setTelemetryRefreshing(true)
    try {
      const [humRes, histRes] = await Promise.all([
        api.get('/api/humidity/latest'),
        api.get('/api/humidity/history?limit=30'),
      ])
      const logs = histRes?.data?.data?.logs
      if (!humRes?.data?.data || !Array.isArray(logs)) {
        throw new Error('Invalid telemetry response')
      }
      const formatted = logs.map(log => ({
          id: log.id,
          time: new Date(log.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          recorded_at: log.recorded_at,
          humidity: log.humidity !== null && !isNaN(log.humidity) ? parseFloat(log.humidity) : null,
          temperature: log.temperature !== null && !isNaN(log.temperature) ? parseFloat(log.temperature) : null,
          status: log.status
        })).reverse()
      setHumidityHistory(formatted)
      setLatestHumidity(humRes.data.data)
      showToast('Live telemetry refreshed from database.')
    } catch {
      showToast('Unable to refresh telemetry. Check your connection and try again.', 'error')
    } finally {
      telemetryRefreshInFlight.current = false
      setTelemetryRefreshing(false)
    }
  }
  const handleSimulateESP32Payload = handleRefreshTelemetry

  // --- Badge Helpers ---
  const renderStatusBadge = (status) => {
    const styles = {
      Pending: 'bg-amber-500/10 text-amber-700 border-amber-300',
      Accepted: 'bg-brand-tintstrong text-navy border-brand-light',
      Washing: 'bg-sky-500/10 text-sky-700 border-sky-200',
      Drying: 'bg-orange-500/10 text-orange-700 border-orange-200',
      'Ready for Pickup': 'bg-emerald-500/10 text-emerald-700 border-emerald-300',
      Completed: 'bg-green-600/10 text-green-700 border-green-300',
      Cancelled: 'bg-rose-500/10 text-rose-700 border-rose-300',
    }
    return <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${styles[status] || 'bg-brand-tint text-navy border-line'}`}>{laundryStatusLabel(status)}</span>
  }

  const renderPaymentBadge = (status) => {
    return <span className="px-2.5 py-1 text-xs font-semibold rounded-full border border-line bg-brand-tint text-navy">{status}</span>
  }

  // Shared props for sub-pages
  const sharedProps = { orders, customers, services, orderPricingLimits, activeServices, standardKgService, specialServices, allPayments, filteredOrders, filteredPayments, metrics, pipelineCounts, latestHumidity, humidityHistory, loading, apiOnline, dashboardData, telemetryRefreshing, orderSaving, paymentSaving, customerAdding, markingPaidIds, PIPELINE_STAGES, ORDER_STATUS_STEPS, orderSearch, setOrderSearch, orderStatusFilter, setOrderStatusFilter, orderPaymentFilter, setOrderPaymentFilter, paymentSearch, setPaymentSearch, paymentMethodFilter, setPaymentMethodFilter, customerSearch, setCustomerSearch, customerStatusFilter, setCustomerStatusFilter, editingCustomer, setEditingCustomer, editCustForm, setEditCustForm, archivingCustomer, setArchivingCustomer, restoringCustomer, setRestoringCustomer, customerSaving, customerAccountActionBusy, isNewOrderModalOpen, setIsNewOrderModalOpen, isRecordPaymentModalOpen, setIsRecordPaymentModalOpen, isAddCustomerModalOpen, setIsAddCustomerModalOpen, selectedOrderDetails, setSelectedOrderDetails, orderDetailsLoadingId, openOrderDetails, newOrderCustomer, setNewOrderCustomer, newOrderFulfillment, setNewOrderFulfillment, newOrderNotes, setNewOrderNotes, newOrderItems, setNewOrderItems, newOrderCharges, setNewOrderCharges, newOrderChargesReason, setNewOrderChargesReason, newOrderDiscount, setNewOrderDiscount, newOrderTotals, orderValidation, orderValidationVisible, paymentOrderId, setPaymentOrderId, paymentAmount, setPaymentAmount, paymentMethod, setPaymentMethod, paymentReference, setPaymentReference, newCustFirstName, setNewCustFirstName, newCustLastName, setNewCustLastName, newCustPhone, setNewCustPhone, newCustEmail, setNewCustEmail, newCustAddress, setNewCustAddress, newCustomerErrors, setNewCustomerErrors, handleUpdateOrderStatus, handleCreateOrder, handleRecordPayment, handleAddCustomer, handleRefreshTelemetry, handleSimulateESP32Payload, handleMarkAsPaid, handleUpdateCustomer, handleArchiveCustomer, handleRestoreCustomer, handleToggleService, handleUpdateServicePrice, resetNewOrderForm, handleOpenNewOrder, fetchAllData, navigateToOrdersWithStatus, showToast, renderStatusBadge, renderPaymentBadge, orderItemsOf, formatCurrency }
  sharedProps.handlePaymentOrderSelect = handlePaymentOrderSelect

  return (
    <>
      <ScrollToTop />
      <Toast notification={notification} />
      {!loading && loadError && (
        <div className={`fixed inset-x-0 top-0 z-[60] border-b px-4 py-2.5 flex flex-col sm:flex-row items-center justify-center gap-2 text-center ${apiOnline ? 'bg-brand-tint border-brand-light' : 'bg-danger-tint border-danger'}`}>
          <p className={`text-xs font-bold ${apiOnline ? 'text-navy' : 'text-danger'}`}>
            {loadError} Data shown may be outdated.
          </p>
          <button
            onClick={fetchAllData}
            className={`px-3 py-1 rounded-lg text-white text-xs font-bold transition ${apiOnline ? 'bg-navy' : 'bg-danger'}`}
          >
            Retry
          </button>
        </div>
      )}
      <AppLayout unreadCount={unreadAlerts} supportUnreadCount={unreadSupport} humidityWarning={['WARNING', 'ALERT'].includes(latestHumidity.status)}>
        <Routes>
          <Route path="/" element={<DashboardPage {...sharedProps} />} />
          <Route path="/dashboard" element={<DashboardPage {...sharedProps} />} />
          <Route path="/index.html" element={<Navigate to="/" replace />} />
          <Route path="index.html" element={<Navigate to="/" replace />} />
          <Route path="/orders" element={<OrdersPage {...sharedProps} />} />
          <Route path="/payments" element={<PaymentsPage {...sharedProps} />} />
          <Route path="/loyalty" element={<LoyaltyView showToast={showToast} />} />
          <Route path="/customers" element={<CustomersPage {...sharedProps} />} />
          <Route path="/services" element={<ServicesPage {...sharedProps} />} />
          <Route path="/pricing" element={<Navigate to="/services" replace />} />
          <Route path="/humidity" element={<HumidityPage {...sharedProps} />} />
          <Route path="/inventory" element={<InventoryView showToast={showToast} isAdmin={user?.role === 'admin'} />} />
          <Route path="/analytics" element={<AnalyticsView analyticsData={dashboardData?.analytics} latestHumidity={latestHumidity} humidityHistory={humidityHistory} metrics={metrics} orders={orders} onRefresh={fetchAllData} loading={loading} />} />
          <Route path="/reports" element={<ReportsView showToast={showToast} />} />
          <Route
            path="/notifications"
            element={
              <AlertsView
                showToast={showToast}
                onUnreadCountChange={setUnreadAlerts}
                onSupportUnreadCountChange={setUnreadSupport}
              />
            }
          />
          <Route path="/alerts" element={<Navigate to="/notifications" replace />} />
          <Route path="/support" element={<SupportInbox showToast={showToast} onUnreadCountChange={setUnreadSupport} />} />
          <Route path="/users" element={<AdminOnly><StaffManagementView showToast={showToast} /></AdminOnly>} />
          <Route path="/staff" element={<Navigate to="/users" replace />} />
          <Route path="/settings" element={<AdminOnly><SettingsView showToast={showToast} onLimitsUpdated={setOrderPricingLimits} /></AdminOnly>} />
          <Route path="*" element={<NotFound />} />
        </Routes>

        {/* Modals (global, available from any page) */}
        <OrderModals {...sharedProps} paymentOtherMethod={paymentOtherMethod} setPaymentOtherMethod={setPaymentOtherMethod} paymentOrderBalance={paymentOrderBalance} paymentOrderLoading={paymentOrderLoading} paymentFormErrors={paymentFormErrors} setPaymentFormErrors={setPaymentFormErrors} handlePaymentOrderSelect={handlePaymentOrderSelect} />
      </AppLayout>
    </>
  )
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────
function DashboardPage(p) {
  const { user } = useAuth()
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening'
  const displayName = user?.name === 'Owner Admin' ? 'Owner Admin' : (user?.name?.split(' ')[0] || 'Admin')
  const todayShort = new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
  const weekday = new Date().toLocaleDateString('en-PH', { weekday: 'long' })
  const [weather, setWeather] = useState(null)
  useEffect(() => {
    // Real live weather (keyless Open-Meteo API). Hidden if unreachable — never faked.
    fetch('https://api.open-meteo.com/v1/forecast?latitude=14.13&longitude=121.33&current=temperature_2m,weather_code&timezone=Asia%2FManila')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const c = j?.current
        if (c && typeof c.temperature_2m === 'number') {
          setWeather({ temp: Math.round(c.temperature_2m), code: c.weather_code })
        }
      })
      .catch(() => {})
  }, [])
  const weatherMeta = (() => {
    if (!weather) return null
    const code = weather.code
    if (code === 0) return { label: 'Clear Sky', Icon: Sun }
    if (code <= 3) return { label: 'Partly Cloudy', Icon: CloudSun }
    if (code <= 48) return { label: 'Foggy', Icon: CloudFog }
    if (code <= 67 || (code >= 80 && code <= 82)) return { label: 'Rainy', Icon: CloudRain }
    if (code >= 95) return { label: 'Thunderstorm', Icon: CloudLightning }
    return { label: 'Cloudy', Icon: Cloud }
  })()
  return (
    <div className="space-y-2.5">
      {/* Greeting + date/weather + mini humidity summary */}
      <div className="relative">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <span className="absolute right-[30%] top-2 h-8 w-8 rounded-full border-2 border-brand-light/60 bg-white/50" />
          <span className="absolute right-[24%] top-10 h-5 w-5 rounded-full border border-brand-light/60 bg-white/40" />
          <span className="absolute right-[36%] top-14 h-3.5 w-3.5 rounded-full bg-brand-light/50" />
        </div>
        <div className="relative flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="shrink-0">
            <p className="text-[13px] font-medium text-navy">{greeting},</p>
            <h1 className="text-[20px] font-black text-navy">
              {displayName} <span aria-hidden="true">👋</span>
            </h1>
            <p className="mt-0.5 text-[12px] text-ink-secondary">Here&apos;s what&apos;s happening with your laundry business today.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex items-center gap-2.5 rounded-2xl bg-white border border-line shadow-card px-3.5 py-1.5 shrink-0">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-tintstrong text-navy">
                <Calendar className="w-4.5 h-4.5" />
              </span>
              <span className="leading-tight">
                <span className="block text-[13px] font-bold text-navy">{todayShort}</span>
                <span className="block text-[11px] text-ink-secondary">{weekday}</span>
              </span>
              {weatherMeta && (
                <>
                  <span aria-hidden="true" className="h-8 w-px bg-line" />
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-warning-bg text-warning">
                    <weatherMeta.Icon className="w-4.5 h-4.5" />
                  </span>
                  <span className="leading-tight">
                    <span className="block text-[13px] font-bold text-navy">{weather.temp}°C</span>
                    <span className="block text-[11px] text-ink-secondary">{weatherMeta.label}</span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Humidity Warning Banner */}
      {p.latestHumidity.status === 'WARNING' && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-card">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-100 text-amber-700 border border-amber-200">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-amber-950">High Humidity Warning in Drying Area!</h3>
              <p className="text-xs text-amber-900 mt-0.5">
                Humidity is <strong>{p.latestHumidity.humidity}%</strong> (Threshold: {p.latestHumidity.threshold}%). Check ventilation and dehumidifiers.
              </p>
            </div>
          </div>
          <NavLink to="/humidity" className="px-4 py-2 rounded-xl bg-[#0A4D68] hover:bg-[#083F56] text-white text-xs font-bold whitespace-nowrap transition shadow-card">
            View Humidity Monitor
          </NavLink>
        </div>
      )}

      {p.apiOnline && !p.latestHumidity.is_online && (
        <div role="alert" className="p-4 rounded-2xl bg-rose-50 border border-rose-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-card">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-100 text-rose-700 border border-rose-200">
              <WifiOff className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-rose-800">Hardware Offline</h3>
              <p className="text-xs text-rose-700 mt-0.5">
                The ESP32 has not sent a recent sensor reading. Check the device connection.
              </p>
            </div>
          </div>
          <NavLink to="/humidity" className="px-4 py-2 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold whitespace-nowrap transition shadow-md">
            View Hardware Status
          </NavLink>
        </div>
      )}

      {/* Stat Cards */}
      <div className="fs-admin-card-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="fs-admin-card h-full min-h-[148px] p-4 rounded-[18px] bg-gradient-to-br from-[#0A4D68] to-[#083F56] border border-[#0A4D68] shadow-card hover:shadow-pop transition relative overflow-hidden group">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-white/15 text-[#A5F3F3]"><Package className="w-5 h-5" /></div>
              <span className="text-[11px] font-bold text-white/90 uppercase tracking-wider leading-tight">Active<br />Orders</span>
            </div>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-white"><ArrowUpRight className="w-3.5 h-3.5" /></span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-[24px] leading-none font-black text-white">{p.metrics.activeOrdersCount}</span>
            <span className="text-xs text-white/75">of {p.metrics.totalOrdersCount} total</span>
          </div>
          <div className="mt-2.5 text-xs text-white/85 flex items-center gap-1.5 font-medium"><Clock className="w-3.5 h-3.5 text-[#A5F3F3]" /><span>In process right now</span></div>
        </div>
        <div className="fs-admin-card h-full min-h-[148px] p-4 rounded-[18px] bg-[#EAF6F8] border border-[#BFE0E7] shadow-card hover:shadow-pop transition relative overflow-hidden group">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-emerald-50 text-emerald-700"><PhilippinePeso className="w-5 h-5" /></div>
              <span className="text-[11px] font-bold text-ink-secondary uppercase tracking-wider leading-tight">Revenue<br />Collected</span>
            </div>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#088395] border border-[#BFE0E7]"><ArrowUpRight className="w-3.5 h-3.5" /></span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-[24px] leading-none font-black text-navy">₱{p.metrics.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="mt-2.5 text-xs text-emerald-700 flex items-center gap-1.5 font-semibold"><span aria-hidden="true">↑</span><span>{p.orders.filter(o => o.payment_status === 'Paid').length} Fully Paid Orders</span></div>
        </div>
        <div className="fs-admin-card h-full min-h-[148px] p-4 rounded-[18px] bg-[#F0F9FF] border border-[#BFEAF0] shadow-card hover:shadow-pop transition relative overflow-hidden group">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-amber-50 text-amber-700"><CreditCard className="w-5 h-5" /></div>
              <span className="text-[11px] font-bold text-ink-secondary uppercase tracking-wider leading-tight">Unpaid<br />Receivables</span>
            </div>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#0A4D68] border border-[#BFEAF0]"><ArrowUpRight className="w-3.5 h-3.5" /></span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-[24px] leading-none font-black text-navy">₱{p.metrics.unpaidAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="mt-2.5 text-xs text-amber-700 flex items-center gap-1.5 font-semibold"><AlertTriangle className="w-3.5 h-3.5" /><span>{p.metrics.pendingPaymentsCount} Orders pending payment</span></div>
        </div>
        <div className={`fs-admin-card h-full min-h-[148px] p-4 rounded-[18px] border shadow-card transition relative overflow-hidden group ${p.latestHumidity.status === 'WARNING' ? 'border-amber-300 bg-[#F0F9FF]' : 'border-[#0A4D68] bg-gradient-to-br from-[#0A4D68] to-[#088395]'}`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-full ${p.latestHumidity.status === 'WARNING' ? 'bg-amber-100 text-amber-700' : 'bg-white/15 text-[#A5F3F3]'}`}><Droplets className="w-5 h-5" /></div>
              <span className={`text-[11px] font-bold uppercase tracking-wider leading-tight ${p.latestHumidity.status === 'WARNING' ? 'text-ink-secondary' : 'text-white/90'}`}>Drying Area<br />Telemetry</span>
            </div>
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${p.latestHumidity.is_online ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-[#E0F7FA] text-[#0A4D68] border border-[#A5DDE5]'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${p.latestHumidity.is_online ? 'bg-emerald-600 animate-pulse' : 'bg-[#088395]'}`} />
              {p.latestHumidity.is_online ? 'ESP32 Online' : 'Offline'}
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <div>
              <span className={`text-[22px] leading-none font-black ${p.latestHumidity.status === 'WARNING' ? 'text-amber-900' : 'text-white'}`}>
                {p.latestHumidity.is_online && p.latestHumidity.humidity !== null ? `${p.latestHumidity.humidity}%` : '—'}
              </span>
              <span className={`block text-[10px] font-semibold mt-1 ${p.latestHumidity.status === 'WARNING' ? 'text-ink-secondary' : 'text-white/75'}`}>Humidity</span>
            </div>
            <div className="text-right">
              <span className={`text-[20px] leading-none font-black ${p.latestHumidity.status === 'WARNING' ? 'text-amber-700' : 'text-[#A5F3F3]'}`}>
                {p.latestHumidity.is_online && p.latestHumidity.temperature !== null ? `${p.latestHumidity.temperature}°C` : '—'}
              </span>
              <span className={`block text-[10px] font-semibold mt-1 ${p.latestHumidity.status === 'WARNING' ? 'text-ink-secondary' : 'text-white/75'}`}>Temperature</span>
            </div>
          </div>
          <div className={`mt-2 flex items-center justify-between text-[11px] font-semibold ${p.latestHumidity.status === 'WARNING' ? 'text-ink-secondary' : 'text-white/75'}`}>
            <span>RH Threshold: {p.latestHumidity.threshold ?? 70}%</span>
            <span>{p.latestHumidity.last_updated ? new Date(p.latestHumidity.last_updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
          </div>
          <div className={`mt-2 h-1.5 w-full overflow-hidden rounded-full ${p.latestHumidity.status === 'WARNING' ? 'bg-search' : 'bg-white/20'}`}>
            <div
              className={`h-full rounded-full transition-all ${p.latestHumidity.status === 'WARNING' ? 'bg-amber-500' : 'bg-brand-light'}`}
              style={{ width: `${p.latestHumidity.is_online ? Math.min(100, Math.max(4, (p.latestHumidity.humidity / Math.max(1, p.latestHumidity.threshold ?? 70)) * 100)) : 0}%` }}
            />
          </div>
          <div className={`mt-2 text-[11px] font-medium flex items-center justify-between ${p.latestHumidity.status === 'WARNING' ? 'text-ink-secondary' : 'text-white/75'}`}>
            <span>{p.latestHumidity.is_online ? `Sensor: ${p.latestHumidity.status}` : 'Sensor temporarily unavailable'}</span>
            <span className={`text-[10px] ${p.latestHumidity.status === 'WARNING' ? 'text-slate-500' : 'text-white/60'}`}>{p.latestHumidity.device_id}</span>
          </div>
        </div>
      </div>

      {/* Chart + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 p-4 rounded-2xl bg-gradient-to-br from-white via-white to-[#EAF6F8] border border-[#C9E1E6] space-y-3 flex flex-col shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-tintstrong text-navy border border-brand-light shadow-card shrink-0">
                <Activity className="w-4.5 h-4.5" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-navy">Drying Area Telemetry Trend</h2>
                <p className="text-[11px] text-ink-secondary">Live ESP32 Temperature & Humidity readings at Drying Area #1</p>
              </div>
            </div>
            <button onClick={p.handleRefreshTelemetry} disabled={p.telemetryRefreshing} className="px-3 py-1.5 rounded-xl bg-brand-tint text-navy border border-brand-light text-[11px] font-bold flex items-center gap-1.5 transition hover:bg-brand-tintstrong disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 ${p.telemetryRefreshing ? 'animate-spin' : ''}`} />{p.telemetryRefreshing ? 'Refreshing…' : 'Refresh Live Data'}
            </button>
          </div>
          <div className="flex-1 min-h-[150px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={p.humidityHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.75} />
                <XAxis dataKey="time" stroke="var(--navy)" fontSize={11} tickLine={false} />
                <YAxis domain={['auto', 'auto']} stroke="var(--navy)" fontSize={11} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--white)', borderColor: 'var(--border)', borderRadius: '0.75rem', color: 'var(--navy)' }} />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px', color: 'var(--navy)', fontWeight: 600 }} />
                <ReferenceLine y={p.latestHumidity.threshold ?? 70} stroke="var(--danger)" strokeDasharray="4 4" label={{ value: `WARNING (${p.latestHumidity.threshold ?? 70}%)`, fill: 'var(--danger)', fontSize: 10, position: 'top' }} />
                <Line type="monotone" dataKey="humidity" stroke="var(--blue)" strokeWidth={2.5} dot={{ fill: 'var(--blue)', r: 3 }} activeDot={{ r: 6, fill: 'var(--navy)' }} name="Humidity (% RH)" isAnimationActive={false} />
                <Line type="monotone" dataKey="temperature" stroke="#0A4D68" strokeWidth={2.5} strokeDasharray="6 3" dot={{ fill: '#0A4D68', r: 3 }} activeDot={{ r: 6, fill: '#0A4D68' }} name="Temperature (°C)" isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-gradient-to-br from-white to-[#F1F5F9] border border-[#C9E1E6] flex flex-col shadow-card">
          <div>
            <h2 className="text-sm font-bold text-navy flex items-center gap-2 mb-2"><span className="text-amber-400">⚡</span>Quick Actions</h2>
            <div className="space-y-1.5">
              <button onClick={p.handleOpenNewOrder} className="w-full min-h-11 py-2 px-3 rounded-xl bg-gradient-to-r from-navy to-[#088395] hover:brightness-105 text-white font-bold text-[13px] shadow-card flex items-center justify-between transition group">
                <span className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-light text-navy"><Plus className="w-3.5 h-3.5" /></span>Create New Order</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition" />
              </button>
              <button onClick={() => p.setIsRecordPaymentModalOpen(true)} className="w-full min-h-11 py-2 px-3 rounded-xl bg-search hover:bg-brand-tint border border-line text-navy font-bold text-[13px] flex items-center justify-between transition group">
                <span className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-navy shadow-card"><PhilippinePeso className="w-3.5 h-3.5" /></span>Record Payment</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition" />
              </button>
              <button onClick={() => p.setIsAddCustomerModalOpen(true)} className="w-full min-h-11 py-2 px-3 rounded-xl bg-search hover:bg-brand-tint border border-line text-navy font-bold text-[13px] flex items-center justify-between transition group">
                <span className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-navy shadow-card"><Users className="w-3.5 h-3.5" /></span>Add New Customer</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition" />
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Humidity Summary */}
      <div className="relative overflow-hidden rounded-[20px] bg-gradient-to-r from-[#EAF6F8] via-white to-[#F1F5F9] border border-[#C9E1E6] shadow-card p-4">
        <span aria-hidden="true" className="absolute left-[38%] top-3 h-8 w-8 rounded-full border-2 border-brand-light/50 bg-white/40 animate-float-slow" />
        <span aria-hidden="true" className="absolute left-[46%] top-8 h-5 w-5 rounded-full border border-brand-light/60 bg-white/30 animate-float-slow" />
        <div className="relative flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex-1">
            <h2 className="flex items-center gap-2 text-sm font-bold text-navy">
              <Droplets className="w-4.5 h-4.5" />Humidity Summary
            </h2>
            <p className="text-[11px] text-ink-secondary">Current status for all drying areas</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2">
              <span className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-success-bg text-success transition-transform duration-200 hover:scale-110">
                  <CheckCircle2 className="w-4.5 h-4.5" />
                </span>
                <span className="leading-tight">
                  <span className="block text-[12px] font-bold text-navy">Normal Range</span>
                  <span className="block text-[10px] text-ink-secondary">Below {p.latestHumidity.threshold ?? 70}%</span>
                </span>
              </span>
              <span className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-navy transition-transform duration-200 hover:scale-110">
                  <Waves className="w-4.5 h-4.5" />
                </span>
                <span className="leading-tight">
                  <span className="block text-[12px] font-bold text-navy">
                    {p.latestHumidity.status === 'WARNING' ? 'Elevated' : 'Stable'}
                  </span>
                  <span className="block text-[10px] text-ink-secondary">
                    {p.latestHumidity.status === 'WARNING' ? 'Check ventilation' : 'No alert'}
                  </span>
                </span>
              </span>
              <span className="flex items-center gap-2">
                <span className={`flex h-8 w-8 items-center justify-center rounded-full transition-transform duration-200 hover:scale-110 ${p.latestHumidity.is_online ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-500'}`}>
                  {p.latestHumidity.is_online ? <Wifi className="w-4.5 h-4.5" /> : <WifiOff className="w-4.5 h-4.5" />}
                </span>
                <span className="leading-tight">
                  <span className="block text-[12px] font-bold text-navy">
                    {p.latestHumidity.is_online ? 'ESP32 Connected' : 'ESP32 Offline'}
                  </span>
                  <span className="block text-[10px] text-ink-secondary">
                    {p.latestHumidity.is_online ? 'Online' : 'Offline'}
                  </span>
                </span>
              </span>
            </div>
          </div>
          <img
            src="/images/freshspin-login-bg.jpg"
            alt="Folded fresh laundry"
            className="h-20 w-full rounded-2xl object-cover md:h-24 md:w-52 shrink-0 shadow-card"
          />
        </div>
      </div>

      {/* Pipeline Cards */}
      <div className="p-4 rounded-2xl bg-white border border-line space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-brand-light animate-pulse" />
            <h2 className="text-sm font-black text-navy">Live Laundry Pipeline</h2>
            <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-brand-tintstrong text-navy border border-brand-light">Real-Time</span>
          </div>
          <button onClick={p.fetchAllData} disabled={p.loading} className="p-2 rounded-xl bg-white hover:bg-brand-tintstrong border border-line text-navy hover:text-navy transition">
            <RefreshCw className={`w-3.5 h-3.5 ${p.loading ? 'animate-spin text-navy' : ''}`} />
          </button>
        </div>
        <div className="fs-admin-card-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-2.5">
          {p.PIPELINE_STAGES.map((stage, index) => {
            const Icon = stage.icon
            const percentage = Math.round((stage.count / Math.max(1, p.orders.length)) * 100)
            const step = String(index + 1).padStart(2, '0')
            return (
              <div key={stage.id} onClick={() => p.navigateToOrdersWithStatus(stage.id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && p.navigateToOrdersWithStatus(stage.id)}
                className={`fs-admin-card h-full p-3 rounded-2xl border ${stage.borderColor} ${stage.bgColor} cursor-pointer transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl ${stage.glowColor} group flex flex-col justify-between relative overflow-hidden`}>
                <div className="absolute top-0 right-0 w-28 h-28 bg-white/5 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition duration-500" />
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-md bg-brand-tint/90 text-navy border border-line">STEP {step}</span>
                    <div className={`p-1.5 rounded-xl bg-white border ${stage.borderColor} ${stage.textColor}`}><Icon className="w-4 h-4" /></div>
                  </div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-navy group-hover:text-navy transition mb-1.5">{stage.label}</div>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-xl font-black tracking-tight ${stage.textColor}`}>{stage.count}</span>
                    <span className="text-[11px] text-ink-secondary">{stage.count === 1 ? 'order' : 'orders'}</span>
                  </div>
                  <p className="text-[11px] text-ink-secondary mt-1.5 leading-snug">{stage.description}</p>
                  <div className="mt-2.5 w-full bg-white h-1.5 rounded-full overflow-hidden">
                    <div className={`h-full ${stage.progressColor} transition-all duration-700 rounded-full`} style={{ width: `${Math.min(100, Math.max(stage.count > 0 ? 12 : 0, percentage))}%` }} />
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-line flex items-center justify-between text-[11px]">
                  <span className={`font-semibold ${stage.textColor}`}>{stage.count > 0 ? stage.activeText : 'Queue clear'}</span>
                  <span className="text-ink-secondary group-hover:text-navy flex items-center gap-1 transition">View <ChevronRight className="w-3.5 h-3.5" /></span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Recent Orders */}
      <div className="p-4 rounded-2xl bg-white border border-line space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-navy">Recent Orders</h2>
          <NavLink to="/orders" className="text-xs font-semibold text-navy hover:text-navy flex items-center gap-1">
            View All ({p.orders.length}) <ArrowUpRight className="w-3.5 h-3.5" />
          </NavLink>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-brand-tint text-ink-secondary text-[11px] uppercase font-semibold">
              <tr>
                <th className="p-2.5 rounded-l-xl">Order #</th>
                <th className="p-2.5">Customer</th>
                <th className="p-2.5">Amount</th>
                <th className="p-2.5">Payment</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5 rounded-r-xl text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {p.loading ? (
                <tr><td colSpan="6" className="p-6 text-center text-ink-secondary text-xs">Loading recent orders…</td></tr>
              ) : p.orders.length === 0 ? (
                <tr><td colSpan="6" className="p-6 text-center text-ink-secondary">No orders yet. Create the first order to get started.</td></tr>
              ) : (
              p.orders.slice(0, 5).map(order => (
                <tr key={order.id} className="hover:bg-brand-tint transition">
                  <td className="p-2.5 font-mono font-bold text-navy">{order.order_number}</td>
                  <td className="p-2.5">
                    <div className="font-medium text-navy">{order.customer ? `${order.customer.first_name} ${order.customer.last_name}` : 'Guest'}</div>
                    <div className="text-[11px] text-ink-secondary">{order.customer?.phone}</div>
                  </td>
                  <td className="p-2.5 font-bold text-navy">₱{Number(order.total_amount).toFixed(2)}</td>
                  <td className="p-2.5">{p.renderPaymentBadge(order.payment_status)}</td>
                  <td className="p-2.5">{p.renderStatusBadge(order.laundry_status)}</td>
                  <td className="p-2.5 text-right">
                    <button onClick={() => p.openOrderDetails(order)} disabled={p.orderDetailsLoadingId === order.id} className="p-1.5 rounded-lg bg-brand-tint hover:bg-brand-tintstrong text-navy hover:text-navy transition disabled:opacity-50" aria-label={`View ${order.order_number} details`}>{p.orderDetailsLoadingId === order.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Eye className="w-4 h-4" />}</button>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Orders Page ──────────────────────────────────────────────────────────────
function OrdersPage(p) {
  const [searchParams] = useSearchParams()
  const [page, setPage] = useState(1)
  const [statusChange, setStatusChange] = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const [statusBusy, setStatusBusy] = useState(false)
  const statusRequestInFlight = useRef(false)
  const pageSize = 10

  useEffect(() => {
    setPage(1)
  }, [p.filteredOrders])

  const pageCount = Math.max(1, Math.ceil(p.filteredOrders.length / pageSize))
  const visibleOrders = p.filteredOrders.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => {
    const q = searchParams.get('q')
    if (q !== null && q !== p.orderSearch) p.setOrderSearch(q)
    const id = searchParams.get('id')
    if (id) {
      const order = p.orders.find(item => String(item.id) === id)
      p.openOrderDetails(order || { id: Number(id) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])
  // Kilograms per order for the Weight column (per-piece extras listed below).
  const orderWeightOf = (order) => {
    const items = p.orderItemsOf(order)
    const kg = items
      .filter(i => (i?.service?.unit || 'kg') === 'kg')
      .reduce((sum, i) => sum + Number(i.quantity || 0), 0)
    const extras = items.filter(i => (i?.service?.unit || 'kg') !== 'kg')
    return { kg, extras }
  }

  const requestStatusChange = (order, status) => {
    setCancelReason('')
    setStatusChange({ order, status })
  }

  const confirmStatusChange = async () => {
    if (!statusChange || statusRequestInFlight.current) return
    const reason = cancelReason.trim()
    if (statusChange.status === 'Cancelled' && !reason) {
      p.showToast('Enter a cancellation reason.', 'error')
      return
    }

    statusRequestInFlight.current = true
    setStatusBusy(true)
    try {
      const updated = await p.handleUpdateOrderStatus(
        statusChange.order.id,
        statusChange.status,
        statusChange.status === 'Cancelled' ? reason : null,
      )
      if (updated) {
        setStatusChange(null)
        setCancelReason('')
      }
    } finally {
      statusRequestInFlight.current = false
      setStatusBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-navy">Orders Management</h1>
        </div>
        <button onClick={p.handleOpenNewOrder} className="px-4 py-2.5 rounded-xl bg-navy hover:bg-navy-hover text-white font-bold text-sm shadow-lg flex items-center gap-2 transition">
          <Plus className="w-4 h-4" />Create New Order
        </button>
      </div>

      {/* Status Filter Tabs */}
      <div className="p-3.5 rounded-2xl bg-white border border-line flex flex-wrap items-center gap-2">
        <Filter className="w-3.5 h-3.5 text-navy shrink-0" />
        {[
          { id: 'All', label: 'All', count: p.orders.length },
          ...ADMIN_ORDER_STATUSES.map(status => ({
            id: status,
            label: status,
            count: p.orders.filter(order => order.laundry_status === status).length,
          })),
        ].map(st => (
          <button key={st.id} onClick={() => p.setOrderStatusFilter(st.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${p.orderStatusFilter === st.id ? 'bg-navy text-white shadow-card ring-2 ring-brand-light' : 'bg-white text-navy hover:bg-brand-tint border border-line'}`}>
            {st.label} <span className={`px-1.5 rounded-full text-[10px] font-black ${p.orderStatusFilter === st.id ? 'bg-white/20 text-white' : 'bg-brand-tintstrong text-navy'}`}>{st.count}</span>
          </button>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="p-4 rounded-2xl bg-white border border-line grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr] gap-3">
        <ExpandableSearch value={p.orderSearch} onChange={p.setOrderSearch} placeholder="Order #, Customer, Phone..." ariaLabel="Search orders" />
        <select value={p.orderStatusFilter} onChange={e => p.setOrderStatusFilter(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-white border border-line text-sm text-navy focus:outline-none focus:border-brand-light">
          <option value="All">All Statuses</option>
          {ADMIN_ORDER_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
        </select>
        <select value={p.orderPaymentFilter} onChange={e => p.setOrderPaymentFilter(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-white border border-line text-sm text-navy focus:outline-none focus:border-brand-light">
          <option value="All">All Payment Statuses</option>
          <option value="Paid">Paid</option>
          <option value="Unpaid">Unpaid</option>
        </select>
      </div>

      {/* Orders Table */}
      <div className="p-6 rounded-2xl bg-white border border-line overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-brand-tint text-ink-secondary text-xs uppercase font-semibold">
              <tr>
                <th className="p-3.5 rounded-l-xl">Order Ref</th>
                <th className="p-3.5">Customer</th>
                <th className="p-3.5">Weight</th>
                <th className="p-3.5">Total</th>
                <th className="p-3.5">Payment</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 rounded-r-xl text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {p.filteredOrders.length === 0 ? (
                <tr><td colSpan="7" className="p-8 text-center text-ink-secondary">No orders found matching the selected filters.</td></tr>
              ) : visibleOrders.map(order => (
                <tr key={order.id} className="hover:bg-brand-tint transition">
                  <td className="p-3.5">
                    <span className="font-mono font-bold text-navy block">{order.order_number}</span>
                    <span className="block text-[10px] text-ink-secondary">ID: {order.id}</span>
                    <span className="text-[11px] text-ink-secondary">{new Date(order.order_date).toLocaleDateString()}</span>
                  </td>
                  <td className="p-3.5">
                    <div className="font-medium text-navy">{order.customer ? `${order.customer.first_name} ${order.customer.last_name}` : 'Guest'}</div>
                    <div className="text-xs text-ink-secondary">{order.customer?.phone || 'No phone'}</div>
                  </td>
                  <td className="p-3.5 text-xs">
                    {(() => {
                      const { kg, extras } = orderWeightOf(order)
                      const items = p.orderItemsOf(order)
                      const addons = order.product_addons || []
                      if (kg <= 0 && extras.length === 0 && items.length === 0 && addons.length === 0) return <span className="text-ink-secondary">—</span>
                      return (
                        <>
                          {kg > 0 && <div className="font-bold text-navy text-sm">{kg.toFixed(2)} kg</div>}
                          {items.map((it, idx) => <div key={idx} className="text-ink-secondary mt-0.5">{it.quantity} {it.service?.unit} {it.service?.name}</div>)}
                          {addons.map((addon, idx) => <div key={`addon-${idx}`} className="mt-0.5 text-emerald-700">Add-on: {addon.name} × {addon.quantity}</div>)}
                        </>
                      )
                    })()}
                  </td>
                  <td className="p-3.5">
                    <div className="font-bold text-navy">₱{Number(order.total_amount).toFixed(2)}</div>
                    {Number(order.remaining_balance) > 0 && <div className="text-[11px] text-ink-secondary">Bal: ₱{Number(order.remaining_balance).toFixed(2)}</div>}
                  </td>
                  <td className="p-3.5">{p.renderPaymentBadge(order.payment_status)}</td>
                  <td className="p-3.5">
                    {p.renderStatusBadge(order.laundry_status)}
                  </td>
                  <td className="p-3.5 text-center">
                    <div className="flex flex-wrap items-center justify-center gap-1.5">
                      <button onClick={() => p.openOrderDetails(order)} disabled={p.orderDetailsLoadingId === order.id} className="p-1.5 rounded-lg bg-brand-tint hover:bg-brand-tintstrong text-navy hover:text-navy transition disabled:opacity-50" title="View Details" aria-label={`View ${order.order_number} details`}>{p.orderDetailsLoadingId === order.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Eye className="w-4 h-4" />}</button>
                      {!['Completed', 'Cancelled'].includes(order.laundry_status) && (() => {
                        const statusIndex = ADMIN_ORDER_STATUSES.indexOf(order.laundry_status)
                        const nextStatus = ADMIN_ORDER_STATUSES[statusIndex + 1]
                        const remainingBalance = Number(
                          order.remaining_balance ?? (order.payment_status === 'Paid' ? 0 : order.total_amount ?? 0)
                        )
                        const requiresPayment = nextStatus === 'Completed' && remainingBalance > 0
                        return nextStatus && nextStatus !== 'Cancelled' && !requiresPayment ? (
                          <select
                            value=""
                            disabled={statusBusy && statusChange?.order.id === order.id}
                            aria-label={`Update status for ${order.order_number}`}
                            onChange={event => {
                              if (event.target.value) requestStatusChange(order, event.target.value)
                            }}
                            className="max-w-[155px] rounded-lg border border-line bg-white px-2 py-1.5 text-xs font-semibold text-navy focus:border-brand-light focus:outline-none disabled:opacity-50"
                          >
                            <option value="" disabled>Update Status</option>
                            <option value={nextStatus}>{nextStatus}</option>
                          </select>
                        ) : requiresPayment ? (
                          <span className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] font-semibold text-amber-800">
                            Pay ₱{remainingBalance.toFixed(2)} before pickup
                          </span>
                        ) : null
                      })()}
                      {!['Completed', 'Cancelled'].includes(order.laundry_status) && (
                        <button
                          onClick={() => requestStatusChange(order, 'Cancelled')}
                          disabled={statusBusy && statusChange?.order.id === order.id}
                          className="px-2 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-[11px] font-semibold transition hover:bg-rose-100 disabled:opacity-50"
                          title="Cancel Order"
                        >
                          <XCircle className="mr-1 inline h-3.5 w-3.5" />
                          Cancel Order
                        </button>
                      )}
                      {order.payment_status !== 'Paid' ? (
                        <>
                          <button onClick={() => p.handleMarkAsPaid(order)} disabled={p.markingPaidIds.has(order.id)} className="px-2 py-1.5 rounded-lg bg-navy hover:bg-navy-hover text-white text-[11px] font-bold flex items-center gap-1 transition shadow-card disabled:opacity-50" title="Mark as Paid in one click">
                            {p.markingPaidIds.has(order.id) ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}{p.markingPaidIds.has(order.id) ? 'Processing…' : 'Mark as Paid'}
                          </button>
                          <button onClick={() => { p.handlePaymentOrderSelect(String(order.id)); p.setIsRecordPaymentModalOpen(true) }} className="p-1.5 rounded-lg bg-brand-tint hover:bg-brand-tintstrong text-navy hover:text-navy transition" title="Record partial payment"><PhilippinePeso className="w-4 h-4" /></button>
                        </>
                      ) : (
                        <span className="px-2 py-1.5 rounded-lg bg-brand-tint border border-line text-navy text-[11px] font-bold flex items-center gap-1" title="Fully paid"><CheckCircle2 className="w-3.5 h-3.5" />Paid</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationControls page={page} pageSize={pageSize} totalItems={p.filteredOrders.length} onPageChange={nextPage => setPage(Math.max(1, Math.min(nextPage, pageCount)))} />
      </div>

      {statusChange && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-navy/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-line bg-white p-6 shadow-pop">
            <div>
              <h2 className="text-lg font-bold text-navy">
                {statusChange.status === 'Cancelled' ? 'Cancel Order' : 'Confirm Status Update'}
              </h2>
              <p className="mt-1 text-sm text-ink-secondary">
                {statusChange.order.order_number}: {statusChange.order.laundry_status} → {statusChange.status}
              </p>
            </div>
            {statusChange.status === 'Cancelled' ? (
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-navy">Cancellation reason</span>
                <textarea
                  autoFocus
                  value={cancelReason}
                  onChange={event => setCancelReason(event.target.value)}
                  maxLength={500}
                  rows={4}
                  placeholder="Explain why this order is being cancelled"
                  className="w-full resize-y rounded-xl border border-line p-3 text-sm text-navy outline-none focus:border-brand-light"
                />
              </label>
            ) : (
              <p className="text-sm text-ink-secondary">
                This will update the saved order status and notify connected order views.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setStatusChange(null)}
                disabled={statusBusy}
                className="rounded-xl border border-line px-4 py-2 text-sm font-semibold text-navy hover:bg-brand-tint disabled:opacity-50"
              >
                Keep Order
              </button>
              <button
                onClick={confirmStatusChange}
                disabled={statusBusy || (statusChange.status === 'Cancelled' && !cancelReason.trim())}
                className={`rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${statusChange.status === 'Cancelled' ? 'bg-rose-600 hover:bg-rose-500' : 'bg-navy hover:bg-navy-hover'}`}
              >
                {statusBusy ? 'Saving…' : statusChange.status === 'Cancelled' ? 'Confirm Cancellation' : 'Confirm Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Payments Page ────────────────────────────────────────────────────────────
function PaymentsPage(p) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [paymentDetailState, setPaymentDetailState] = useState({
    paymentId: null,
    payment: null,
    error: null,
    loading: false,
  })
  const [paymentDetailsRetry, setPaymentDetailsRetry] = useState(0)
  const paymentId = searchParams.get('payment')

  useEffect(() => {
    if (!paymentId) return undefined

    let cancelled = false
    api.get(`/api/payments/${encodeURIComponent(paymentId)}`)
      .then((res) => {
        const payment = res.data?.data
        if (!payment) throw new Error('Payment details were not returned.')
        if (!cancelled) {
          setPaymentDetailState({
            paymentId,
            payment,
            error: null,
            loading: false,
          })
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setPaymentDetailState({
            paymentId,
            payment: null,
            error: err.response?.data?.message || 'Unable to load payment details. Retry the request.',
            loading: false,
          })
        }
      })

    return () => { cancelled = true }
  }, [paymentId, paymentDetailsRetry])

  const paymentDetails = paymentDetailState.paymentId === paymentId
    ? paymentDetailState.payment
    : null
  const paymentDetailsError = paymentDetailState.paymentId === paymentId
    ? paymentDetailState.error
    : null
  const paymentDetailsLoading = Boolean(paymentId) && (
    paymentDetailState.paymentId !== paymentId || paymentDetailState.loading
  )

  const closePaymentDetails = () => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('payment')
    setSearchParams(nextParams, { replace: true })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-navy">Payments & Cashier</h1>
          <p className="text-xs text-ink-secondary">Record cash, GCash, or Maya payments — manage receivables</p>
        </div>
        <button onClick={() => p.setIsRecordPaymentModalOpen(true)} className="px-4 py-2.5 rounded-xl bg-navy hover:bg-navy-hover text-white font-bold text-sm shadow-lg flex items-center gap-2 transition">
          <PhilippinePeso className="w-4 h-4" />Record Payment
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-line"><span className="text-xs font-semibold text-ink-secondary uppercase tracking-wider">Total Collected</span><div className="text-3xl font-black text-emerald-400 mt-2">₱{p.metrics.totalRevenue.toFixed(2)}</div><div className="text-xs text-ink-secondary mt-1">{p.allPayments.length} Recorded transactions</div></div>
        <div className="p-5 rounded-2xl bg-white border border-line"><span className="text-xs font-semibold text-ink-secondary uppercase tracking-wider">Outstanding Unpaid</span><div className="text-3xl font-black text-amber-400 mt-2">₱{p.metrics.unpaidAmount.toFixed(2)}</div><div className="text-xs text-ink-secondary mt-1">{p.metrics.pendingPaymentsCount} Orders pending payment</div></div>
        <div className="p-5 rounded-2xl bg-white border border-line"><span className="text-xs font-semibold text-ink-secondary uppercase tracking-wider">Payment Methods</span><div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">{PAYMENT_METHODS.map(m => { const Icon = m.icon; const count = p.allPayments.filter(pp => pp.payment_method === m.value).length; return <span key={m.value} className="flex items-center gap-1.5 text-xs text-navy"><Icon className="w-4 h-4 text-ink-secondary" />{m.value} ({count})</span> })}</div></div>
      </div>
      <div className="p-4 rounded-2xl bg-white border border-line grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ExpandableSearch value={p.paymentSearch} onChange={p.setPaymentSearch} placeholder="Search Payment Ref, Order, Customer..." ariaLabel="Search payments" />
        <select value={p.paymentMethodFilter} onChange={e => p.setPaymentMethodFilter(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-white border border-line text-sm text-navy focus:outline-none focus:border-brand-light"><option value="All">All Methods</option>{PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.value}</option>)}</select>
      </div>
      <div className="p-6 rounded-2xl bg-white border border-line">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-brand-tint text-ink-secondary text-xs uppercase font-semibold"><tr><th className="p-3.5 rounded-l-xl">Payment Ref</th><th className="p-3.5">Order #</th><th className="p-3.5">Customer</th><th className="p-3.5">Amount</th><th className="p-3.5">Method</th><th className="p-3.5 rounded-r-xl">Date</th></tr></thead>
            <tbody className="divide-y divide-line">
              {p.filteredPayments.length === 0 ? <tr><td colSpan="6" className="p-8 text-center text-ink-secondary">No payment transactions recorded yet.</td></tr> : p.filteredPayments.map(pay => (
                <tr key={pay.id} className="hover:bg-brand-tint transition">
                  <td className="p-3.5 font-mono font-bold text-emerald-400">{pay.payment_reference}</td>
                  <td className="p-3.5 font-mono text-navy">{pay.order_number}</td>
                  <td className="p-3.5 font-medium text-navy">{pay.customer_name}</td>
                  <td className="p-3.5 font-bold text-navy">₱{Number(pay.amount).toFixed(2)}</td>
                  <td className="p-3.5"><span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${paymentMethodChip(pay.payment_method)}`}>{pay.other_method || pay.payment_method}</span></td>
                  <td className="p-3.5 text-xs text-ink-secondary">{new Date(pay.payment_date || pay.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {paymentId && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closePaymentDetails()
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-details-title"
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-line bg-white p-5 shadow-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="payment-details-title" className="text-lg font-bold text-navy">Payment Details</h2>
                <p className="mt-1 text-xs text-ink-secondary">Transaction information from FreshSpin records.</p>
              </div>
              <button
                type="button"
                onClick={closePaymentDetails}
                aria-label="Close payment details"
                className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-navy transition hover:bg-brand-tint"
              >
                Close
              </button>
            </div>

            {paymentDetailsLoading ? (
              <div className="flex min-h-40 items-center justify-center gap-3 text-sm text-ink-secondary">
                <RefreshCw className="h-4 w-4 animate-spin text-navy" />
                Loading payment details…
              </div>
            ) : paymentDetailsError ? (
              <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4">
                <p className="text-sm text-rose-800">{paymentDetailsError}</p>
                <button
                  type="button"
                  onClick={() => {
                    setPaymentDetailState({
                      paymentId,
                      payment: null,
                      error: null,
                      loading: true,
                    })
                    setPaymentDetailsRetry(value => value + 1)
                  }}
                  className="mt-3 rounded-lg bg-navy px-3 py-2 text-xs font-bold text-white transition hover:bg-navy-hover"
                >
                  Retry
                </button>
              </div>
            ) : paymentDetails ? (
              <div className="mt-5 space-y-4">
                <div className="grid grid-cols-1 gap-3 rounded-xl bg-brand-tint p-4 sm:grid-cols-2">
                  <div><p className="text-[11px] font-semibold uppercase text-ink-secondary">Payment Reference</p><p className="mt-1 font-mono font-bold text-navy">{paymentDetails.payment_reference || '—'}</p></div>
                  <div><p className="text-[11px] font-semibold uppercase text-ink-secondary">Amount</p><p className="mt-1 text-lg font-bold text-navy">₱{Number(paymentDetails.amount || 0).toFixed(2)}</p></div>
                  <div><p className="text-[11px] font-semibold uppercase text-ink-secondary">Method / Status</p><p className="mt-1 text-sm font-semibold text-navy">{paymentDetails.other_method || paymentDetails.payment_method || '—'} · {paymentDetails.status || '—'}</p></div>
                  <div><p className="text-[11px] font-semibold uppercase text-ink-secondary">Received</p><p className="mt-1 text-sm text-navy">{paymentDetails.payment_date ? new Date(paymentDetails.payment_date).toLocaleString() : paymentDetails.created_at ? new Date(paymentDetails.created_at).toLocaleString() : '—'}</p></div>
                  <div><p className="text-[11px] font-semibold uppercase text-ink-secondary">Reference Number</p><p className="mt-1 break-all text-sm text-navy">{paymentDetails.reference_number || '—'}</p></div>
                  <div><p className="text-[11px] font-semibold uppercase text-ink-secondary">Received By</p><p className="mt-1 text-sm text-navy">{paymentDetails.receiver?.name || '—'}</p></div>
                </div>
                <div className="rounded-xl border border-line p-4">
                  <p className="text-[11px] font-semibold uppercase text-ink-secondary">Order and Customer</p>
                  <p className="mt-1 font-semibold text-navy">{paymentDetails.order?.order_number || 'Order unavailable'}</p>
                  <p className="text-sm text-ink-secondary">
                    {paymentDetails.order?.customer
                      ? `${paymentDetails.order.customer.first_name || ''} ${paymentDetails.order.customer.last_name || ''}`.trim()
                      : 'Customer unavailable'}
                  </p>
                  <p className="mt-1 text-xs text-ink-secondary">
                    Order status: {paymentDetails.order?.laundry_status || '—'} · Payment status: {paymentDetails.order?.payment_status || '—'}
                  </p>
                </div>
                {Array.isArray(paymentDetails.order?.order_items) && paymentDetails.order.order_items.length > 0 && (
                  <div className="rounded-xl border border-line p-4">
                    <p className="text-[11px] font-semibold uppercase text-ink-secondary">Order Items</p>
                    <ul className="mt-2 space-y-1.5 text-sm text-navy">
                      {paymentDetails.order.order_items.map((item, index) => (
                        <li key={item.id || index} className="flex justify-between gap-3">
                          <span>{item.service?.name || 'Laundry service'} × {item.quantity}</span>
                          <span>₱{Number(item.subtotal || 0).toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {paymentDetails.notes && (
                  <div className="rounded-xl border border-line p-4">
                    <p className="text-[11px] font-semibold uppercase text-ink-secondary">Notes</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-navy">{paymentDetails.notes}</p>
                  </div>
                )}
              </div>
            ) : null}
          </section>
        </div>
      )}
    </div>
  )
}

// ─── Customers Page ───────────────────────────────────────────────────────────
function CustomersPage(p) {
  const [page, setPage] = useState(1)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [loadingCustomerId, setLoadingCustomerId] = useState(null)
  const pageSize = 8
  const formatLastLogin = (user) => {
    if (!user) return 'No account'
    if (!user.last_successful_login_at) return 'No login recorded'
    return new Date(user.last_successful_login_at).toLocaleString()
  }
  const filtered = p.customers.filter(c => {
    const s = p.customerSearch.toLowerCase().trim()
    const matchesSearch = !s || `${c.first_name} ${c.last_name}`.toLowerCase().includes(s) || c.phone?.includes(s) || c.email?.toLowerCase().includes(s) || c.customer_code?.toLowerCase().includes(s)
    const matchesStatus = p.customerStatusFilter === 'All'
      || (p.customerStatusFilter === 'active' && c.status !== 'inactive')
      || (p.customerStatusFilter === 'inactive' && c.status === 'inactive')
    return matchesSearch && matchesStatus
  })
  const activeCount = p.customers.filter(c => c.status !== 'inactive').length
  const archivedCount = p.customers.filter(c => c.status === 'inactive').length
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const visibleCustomers = filtered.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => {
    setPage(1)
  }, [p.customerSearch, p.customerStatusFilter])

  const openCustomerDetails = async (customer) => {
    if (loadingCustomerId !== null) return
    setLoadingCustomerId(customer.id)
    setSelectedCustomer({ ...customer, orders: null })
    try {
      const res = await api.get(`/api/customers/${customer.id}`)
      if (!res?.data?.data) throw new Error('The server did not return this customer.')
      setSelectedCustomer(res.data.data)
    } catch (err) {
      p.showToast(err.response?.data?.message || 'Unable to load customer details.', 'error')
      setSelectedCustomer(null)
    } finally {
      setLoadingCustomerId(null)
    }
  }

  const openEdit = (c) => {
    p.setEditingCustomer(c)
    p.setEditCustForm({
      first_name: c.first_name || '',
      last_name: c.last_name || '',
      phone: c.phone || '',
      email: c.email || '',
      address: c.address || '',
      notes: c.notes || '',
    })
  }

  const orderStats = {}
  p.orders.forEach(o => {
    const s = orderStats[o.customer_id] || { n: 0, t: 0 }
    s.n += 1
    s.t += Number(o.total_amount) || 0
    orderStats[o.customer_id] = s
  })

  const tabs = [
    { id: 'active', label: 'Active', count: activeCount },
    { id: 'inactive', label: 'Inactive', count: archivedCount },
    { id: 'All', label: 'All', count: p.customers.length },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div><h1 className="text-2xl font-black text-navy">Customer Profiles</h1><p className="text-xs text-ink-secondary">Manage customer records, contact numbers, and laundry history</p></div>
        <button onClick={() => p.setIsAddCustomerModalOpen(true)} className="px-4 py-2.5 rounded-xl bg-navy hover:bg-navy-hover text-white font-bold text-sm shadow-lg flex items-center gap-2 transition"><Users className="w-4 h-4" />Add New Customer</button>
      </div>

      <div className="p-3.5 rounded-2xl bg-white border border-line flex flex-col lg:flex-row lg:items-center gap-3">
        <ExpandableSearch className="flex-1" value={p.customerSearch} onChange={p.setCustomerSearch} placeholder="Search customer name, phone, email, or code..." ariaLabel="Search customers" />
        <div className="flex items-center gap-2">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => p.setCustomerStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${p.customerStatusFilter === tab.id ? 'bg-navy text-white shadow-card ring-2 ring-brand-light' : 'bg-white text-navy hover:bg-brand-tint border border-line'}`}>
              {tab.label}
              <span className={`px-1.5 rounded-full text-[10px] font-black ${p.customerStatusFilter === tab.id ? 'bg-white/20 text-white' : 'bg-brand-tintstrong text-navy'}`}>{tab.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="fs-admin-card-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {visibleCustomers.map(c => {
          const archived = c.status === 'inactive'
          return (
            <div key={c.id} className={`fs-admin-card flex h-full flex-col p-5 rounded-2xl bg-white border transition space-y-3 ${archived ? 'border-line opacity-75 grayscale-[0.35] hover:opacity-100 hover:grayscale-0' : 'border-line hover:border-brand-light hover:shadow-card'}`}>
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-full border flex items-center justify-center font-bold shrink-0 overflow-hidden ${archived ? 'bg-brand-tint text-ink-secondary border-line' : 'bg-brand-light border-brand-light text-navy'}`}>
                  {c.user?.avatar_url
                    ? <img src={c.user.avatar_url} alt={`${c.first_name} ${c.last_name}`} className="h-full w-full object-cover" />
                    : <span>{c.first_name?.[0]}{c.last_name?.[0]}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold text-navy truncate">{c.first_name} {c.last_name}</h3>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border shrink-0 ${archived ? 'bg-brand-tint text-ink-secondary border-line' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'}`}>{archived ? 'Inactive' : 'Active'}</span>
                  </div>
                  <p className="text-xs text-ink-secondary">{c.phone || c.user?.phone || 'No contact number'}</p>
                  <p className="text-[10px] text-ink-secondary font-mono">{c.customer_code}</p>
                </div>
              </div>
              <div className="text-xs text-ink-secondary space-y-1">
                <p className="truncate">📍 {c.address || 'No address on file'}</p>
                <p className="truncate">✉️ {c.email || c.user?.email || 'No email on file'}</p>
                <p>Registered: {(c.user?.created_at || c.created_at) ? new Date(c.user?.created_at || c.created_at).toLocaleDateString() : '—'}</p>
                <p>Last login: {formatLastLogin(c.user)}</p>
                {archived && <p>Deactivated: {c.archived_at ? new Date(c.archived_at).toLocaleDateString() : '—'}</p>}
              </div>
              <div className="pt-3 border-t border-line flex justify-between text-xs font-semibold">
                <span className="text-ink-secondary">Orders: <strong className="text-navy">{orderStats[c.id]?.n ?? c.orders_count ?? 0}</strong></span>
                <span className="text-emerald-400">₱{(orderStats[c.id]?.t || 0).toFixed(2)}</span>
              </div>
              <div className="mt-auto flex items-center gap-2 border-t border-line pt-3">
                <button onClick={() => openCustomerDetails(c)} disabled={loadingCustomerId !== null} className="flex-1 py-1.5 rounded-xl bg-brand-tint hover:bg-brand-tintstrong text-navy text-xs font-bold flex items-center justify-center gap-1.5 transition disabled:opacity-50">
                  {loadingCustomerId === c.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}View
                </button>
                <button onClick={() => openEdit(c)} className="flex-1 py-1.5 rounded-xl bg-brand-tint hover:bg-brand-tintstrong text-navy text-xs font-bold flex items-center justify-center gap-1.5 transition">
                  <Edit3 className="w-3.5 h-3.5" />Edit
                </button>
                {archived ? (
                  <button onClick={() => p.setRestoringCustomer(c)} className="flex-1 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition">
                    <RefreshCw className="w-3.5 h-3.5" />Activate
                  </button>
                ) : (
                  <button onClick={() => p.setArchivingCustomer(c)} className="flex-1 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition">
                    <Archive className="w-3.5 h-3.5" />Deactivate
                  </button>
                )}
              </div>
              <PaginationControls page={page} pageSize={pageSize} totalItems={filtered.length} onPageChange={nextPage => setPage(Math.max(1, Math.min(nextPage, pageCount)))} />

              {selectedCustomer && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 p-4 backdrop-blur-sm">
                  <div className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl border border-line bg-white p-6 shadow-pop">
                    <div className="flex items-start justify-between gap-4 border-b border-line pb-3">
                      <div>
                        <h2 className="text-lg font-bold text-navy">{selectedCustomer.first_name} {selectedCustomer.last_name}</h2>
                        <p className="text-xs text-ink-secondary">{selectedCustomer.customer_code} · {selectedCustomer.status === 'inactive' ? 'Inactive' : 'Active'}</p>
                      </div>
                      <button type="button" disabled={loadingCustomerId === selectedCustomer.id} onClick={() => setSelectedCustomer(null)} className="rounded-lg px-2 py-1 text-ink-secondary hover:bg-brand-tint disabled:opacity-50" aria-label="Close customer details">✕</button>
                    </div>
                    <div className="grid grid-cols-1 gap-3 rounded-xl border border-line bg-brand-tint p-4 text-sm sm:grid-cols-2">
                      <p><span className="text-ink-secondary">Email:</span> <strong className="text-navy">{selectedCustomer.email || selectedCustomer.user?.email || '—'}</strong></p>
                      <p><span className="text-ink-secondary">Contact:</span> <strong className="text-navy">{selectedCustomer.phone || selectedCustomer.user?.phone || '—'}</strong></p>
                      <p><span className="text-ink-secondary">Address:</span> <strong className="text-navy">{selectedCustomer.address || '—'}</strong></p>
                      <p><span className="text-ink-secondary">Registered:</span> <strong className="text-navy">{(selectedCustomer.user?.created_at || selectedCustomer.created_at) ? new Date(selectedCustomer.user?.created_at || selectedCustomer.created_at).toLocaleString() : '—'}</strong></p>
                      {selectedCustomer.user && <p><span className="text-ink-secondary">Last login:</span> <strong className="text-navy">{formatLastLogin(selectedCustomer.user)}</strong></p>}
                      {selectedCustomer.user && <p><span className="text-ink-secondary">Account role:</span> <strong className="text-navy">{selectedCustomer.user.role}</strong></p>}
                      {selectedCustomer.notes && <p className="sm:col-span-2"><span className="text-ink-secondary">Notes:</span> <strong className="text-navy">{selectedCustomer.notes}</strong></p>}
                    </div>
                    <section className="space-y-2">
                      <h3 className="text-sm font-bold text-navy">Order History ({selectedCustomer.orders_count ?? selectedCustomer.orders?.length ?? 0})</h3>
                      {loadingCustomerId === selectedCustomer.id ? (
                        <p className="flex items-center gap-2 py-5 text-xs text-ink-secondary"><RefreshCw className="h-4 w-4 animate-spin" />Loading customer orders...</p>
                      ) : (selectedCustomer.orders || []).length === 0 ? (
                        <p className="rounded-xl border border-line p-4 text-xs text-ink-secondary">No orders are linked to this customer.</p>
                      ) : (
                        <div className="space-y-2">
                          {selectedCustomer.orders.map(order => (
                            <div key={order.id} className="flex flex-col gap-2 rounded-xl border border-line p-3 sm:flex-row sm:items-center sm:justify-between">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-mono text-xs font-bold text-navy">{order.order_number}</span>
                                  {p.renderStatusBadge(order.laundry_status)}
                                  <span className="text-[11px] text-ink-secondary">{order.payment_status}</span>
                                </div>
                                <p className="mt-1 text-[11px] text-ink-secondary">{order.order_date ? new Date(order.order_date).toLocaleString() : '—'}</p>
                                <p className="mt-1 truncate text-xs text-navy">{(order.order_items || []).map(item => item.service?.name).filter(Boolean).join(', ') || 'Laundry service'}</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <strong className="text-sm text-navy">₱{Number(order.total_amount || 0).toFixed(2)}</strong>
                                <button type="button" onClick={() => { setSelectedCustomer(null); p.openOrderDetails(order) }} className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-navy hover:bg-brand-tint">View Order</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="col-span-full py-16 text-center space-y-2">
            <p className="text-sm font-bold text-navy">No customers found</p>
            <p className="text-xs text-ink-secondary">{p.customerSearch ? 'Try a different search term.' : 'Add your first customer profile to get started.'}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Services Page ────────────────────────────────────────────────────────────
function ServicesPage(p) {
  const [editingId, setEditingId] = useState(null)
  const [priceDraft, setPriceDraft] = useState('')
  const [savingPrice, setSavingPrice] = useState(false)
  const [pendingPrice, setPendingPrice] = useState(null)
  const [priceHistory, setPriceHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const startPriceEdit = (s) => {
    setEditingId(s.id)
    setPriceDraft(String(Number(s.price).toFixed(2)))
    setPriceHistory([])
    setHistoryLoading(true)
    api.get(`/api/services/${s.id}/price-history`)
      .then(res => setPriceHistory(Array.isArray(res?.data?.data) ? res.data.data : []))
      .catch(() => setPriceHistory([]))
      .finally(() => setHistoryLoading(false))
  }
  const requestPriceSave = (s) => {
    const current = Number(s.price)
    const requested = Number(priceDraft)
    if (!Number.isFinite(requested) || requested < 0) {
      p.showToast('Enter a valid price of ₱0.00 or more', 'error')
      return
    }
    const increase = requested - current
    const maximumIncrease = Math.min(100, current * 0.30)
    if (increase > 100 || increase > maximumIncrease) {
      p.showToast(`Price increase exceeds the limit: ₱100.00 or 30% of the current price (₱${maximumIncrease.toFixed(2)}), whichever is lower.`, 'error')
      return
    }
    setPendingPrice({ service: s, price: requested })
  }
  const confirmPriceSave = async () => {
    if (!pendingPrice) return
    setSavingPrice(true)
    const ok = await p.handleUpdateServicePrice(pendingPrice.service, pendingPrice.price, true)
    setSavingPrice(false)
    setPendingPrice(null)
    if (ok) setEditingId(null)
  }
  const services = p.services

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-navy">Pricing</h1>
        <p className="mt-1 text-xs text-ink-secondary">
          Laundry service rates — maximum increase: ₱100.00 or 30% of the current price, whichever is lower. Changes apply to new orders only.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {services.map(service => (
          <div key={service.id} className={`flex min-h-[150px] flex-col justify-between gap-4 rounded-2xl border p-5 transition ${service.status === 'active' ? 'border-line bg-white hover:border-brand-light hover:shadow-card' : 'border-line border-dashed bg-brand-tint/60 opacity-80'}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className={`text-base font-bold ${service.status === 'active' ? 'text-navy' : 'text-ink-secondary'}`}>
                  {service.name}
                </h3>
                <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-navy px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-light" />
                  {service.unit === 'kg' ? 'Per-kilogram service' : 'Per-piece service'} — used for new orders
                </div>
              </div>
              <span className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${service.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {service.status}
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
              {editingId === service.id ? (
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <span className="text-sm font-bold text-navy">₱</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      maxLength={9}
                      value={priceDraft}
                      onChange={e => {
                        const normalized = normalizeDecimalInput(e.target.value, 999999.99)
                        if (normalized !== null) setPriceDraft(normalized)
                      }}
                      disabled={savingPrice} aria-label={`New price for ${service.name}`}
                      className="w-24 rounded-lg border border-line bg-brand-tint px-2 py-1.5 text-sm font-bold text-navy focus:border-brand-light focus:outline-none"
                    />
                    <span className="shrink-0 text-xs text-ink-secondary">/ {service.unit}</span>
                    <button type="button" onClick={() => requestPriceSave(service)} disabled={savingPrice} className="rounded-lg bg-navy px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-navy-hover disabled:opacity-50">Save</button>
                    <button type="button" onClick={() => { setEditingId(null); setPendingPrice(null) }} disabled={savingPrice} className="rounded-lg px-2 py-1.5 text-[11px] font-bold text-ink-secondary transition hover:text-navy disabled:opacity-50">Cancel</button>
                  </div>
                  {(() => {
                    const current = Number(service.price)
                    const requested = Number(priceDraft)
                    if (!Number.isFinite(requested) || requested < 0) return <p className="text-[11px] font-semibold text-rose-600">Enter a valid price of ₱0.00 or more.</p>
                    const increase = requested - current
                    const maximumIncrease = Math.min(100, current * 0.30)
                    if (increase > 100 || increase > maximumIncrease) {
                      return (
                        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-2 text-[11px] font-bold text-rose-700">
                          Increase denied: maximum is ₱100.00 or 30% of the current price (₱{maximumIncrease.toFixed(2)}), whichever is lower.
                        </p>
                      )
                    }
                    if (increase > 0) return <p className="text-[11px] font-semibold text-navy">Requested increase: ₱{increase.toFixed(2)}. This is within the allowed limit.</p>
                    return null
                  })()}
                  <div className="rounded-lg border border-line bg-brand-tint px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-navy">Price history</p>
                    {historyLoading ? (
                      <p className="mt-1 text-[11px] text-ink-secondary">Loading history…</p>
                    ) : priceHistory.length === 0 ? (
                      <p className="mt-1 text-[11px] text-ink-secondary">No price changes recorded.</p>
                    ) : (
                      <div className="mt-1 max-h-28 space-y-1 overflow-y-auto">
                        {priceHistory.map(entry => (
                          <div key={entry.id} className="border-t border-line py-1 text-[10px] text-ink-secondary first:border-t-0">
                            <span className="font-semibold text-navy">{p.formatCurrency(entry.previous_price)} → {p.formatCurrency(entry.new_price)}</span>
                            <span className="block">{entry.changed_at ? new Date(entry.changed_at).toLocaleString('en-PH') : ''} • {entry.admin?.name || 'Admin'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className={`text-lg font-black ${service.status === 'active' ? 'text-navy' : 'text-ink-secondary'}`}>
                    ₱{Number(service.price).toFixed(2)}<span className="ml-1 text-xs font-semibold">/ {service.unit}</span>
                  </span>
                  <button type="button" onClick={() => startPriceEdit(service)} title={`Edit price of ${service.name}`} aria-label={`Edit price of ${service.name}`} className="rounded-lg p-1.5 text-ink-secondary transition hover:bg-brand-tint hover:text-navy">
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <button
                type="button"
                role="switch"
                aria-checked={service.status === 'active'}
                aria-label={`${service.status === 'active' ? 'Deactivate' : 'Activate'} ${service.name}`}
                onClick={() => p.handleToggleService(service)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-light focus:ring-offset-2 ${service.status === 'active' ? 'bg-emerald-500' : 'bg-ink-secondary/40'}`}
              >
                <span className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-card transition-transform duration-200 ${service.status === 'active' ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>
        ))}
        {services.length === 0 && (
          <p role="status" className="rounded-xl border border-line bg-white p-4 text-sm text-ink-secondary">
            No services are configured yet.
          </p>
        )}
      </div>
      <ConfirmDialog
        open={!!pendingPrice}
        title="Confirm laundry price change"
        message={pendingPrice
          ? `Change ${pendingPrice.service.name} from ${p.formatCurrency(pendingPrice.service.price)} to ${p.formatCurrency(pendingPrice.price)}? This update will apply only to new orders.`
          : ''}
        confirmLabel="Apply Price Change"
        busy={savingPrice}
        onConfirm={confirmPriceSave}
        onCancel={() => setPendingPrice(null)}
      />
    </div>
  )
}

// ─── Humidity Page ────────────────────────────────────────────────────────────
function HumidityPage(p) {
  const humidityWarningThreshold = Number(
    p.latestHumidity.humidity_warning_threshold ?? p.latestHumidity.threshold ?? 40,
  )
  const humidityAlertThreshold = Number(p.latestHumidity.humidity_alert_threshold ?? 50)
  const temperatureWarningThreshold = Number(p.latestHumidity.temperature_warning_threshold ?? 40)
  const temperatureAlertThreshold = Number(p.latestHumidity.temperature_alert_threshold ?? 50)
  const getHumidityStatus = (humidity) => {
    if (humidity === null || humidity === undefined || !Number.isFinite(Number(humidity))) {
      return 'UNAVAILABLE'
    }

    const value = Number(humidity)
    if (value >= humidityAlertThreshold) return 'ALERT'
    if (value >= humidityWarningThreshold) return 'WARNING'
    return 'NORMAL'
  }
  const getTemperatureStatus = (temperature) => {
    if (temperature === null || temperature === undefined || !Number.isFinite(Number(temperature))) {
      return 'UNAVAILABLE'
    }

    const value = Number(temperature)
    if (value >= temperatureAlertThreshold) return 'ALERT'
    if (value >= temperatureWarningThreshold) return 'WARNING'
    return 'NORMAL'
  }
  const currentTemperatureStatus = p.latestHumidity.is_online
    ? getTemperatureStatus(p.latestHumidity.temperature)
    : 'UNAVAILABLE'
  const currentHumidityStatus = p.latestHumidity.is_online
    ? getHumidityStatus(p.latestHumidity.humidity)
    : 'UNAVAILABLE'
  const statusClasses = {
    ALERT: 'bg-rose-100 text-rose-700',
    WARNING: 'bg-amber-100 text-amber-700',
    NORMAL: 'bg-emerald-100 text-emerald-700',
    UNAVAILABLE: 'bg-slate-100 text-slate-500',
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-navy flex items-center gap-2">
            <Droplets className="w-6 h-6 text-navy" />Drying Area Telemetry Hub
          </h1>
          <p className="text-xs text-ink-secondary">Real-time ESP32 temperature & humidity monitoring for the drying area in Victoria, Laguna</p>
        </div>
        <button onClick={p.handleRefreshTelemetry} className="px-4 py-2.5 rounded-xl bg-navy hover:bg-navy-hover text-white font-bold text-sm shadow-lg flex items-center gap-2 transition">
          <RefreshCw className="w-4 h-4" />Refresh Live Telemetry
        </button>
      </div>

      <div className="p-6 rounded-2xl bg-white border border-line grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div>
          <span className="text-xs text-ink-secondary uppercase font-semibold">Device ID</span>
          <div className="text-lg font-mono font-bold text-navy mt-1">{p.latestHumidity.device_id || 'FRESHSPIN-ESP32-01'}</div>
          <span className="text-[10px] text-ink-secondary">{p.latestHumidity.location || 'Drying Area #1'}</span>
        </div>
        <div>
          <span className="text-xs text-ink-secondary uppercase font-semibold flex items-center gap-1">
            <Thermometer className="w-3.5 h-3.5 text-amber-500" />Current Temperature
          </span>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-2xl font-black ${
              p.latestHumidity.temperature_status === 'ALERT'
                ? 'text-rose-600'
                : p.latestHumidity.temperature_status === 'WARNING'
                ? 'text-amber-500'
                : 'text-navy'
            }`}>
              {p.latestHumidity.is_online && p.latestHumidity.temperature !== null ? `${p.latestHumidity.temperature} °C` : '—'}
            </span>
            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
              currentTemperatureStatus === 'ALERT'
                ? 'bg-rose-500/10 text-rose-500 border-rose-500/30 animate-pulse'
                : currentTemperatureStatus === 'WARNING'
                ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                : currentTemperatureStatus === 'NORMAL'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-slate-100 text-slate-500 border-slate-200'
            }`}>
              {currentTemperatureStatus}
            </span>
          </div>
          <span className="text-[10px] text-ink-secondary block">
            Warning ≥ {temperatureWarningThreshold}°C • Alert ≥ {temperatureAlertThreshold}°C
          </span>
        </div>
        <div>
          <span className="text-xs text-ink-secondary uppercase font-semibold flex items-center gap-1">
            <Droplets className="w-3.5 h-3.5 text-blue-500" />Current Humidity
          </span>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-2xl font-black ${
              currentHumidityStatus === 'ALERT'
                ? 'text-rose-600'
                : currentHumidityStatus === 'WARNING'
                ? 'text-amber-500'
                : 'text-navy'
            }`}>
              {p.latestHumidity.is_online && p.latestHumidity.humidity !== null ? `${p.latestHumidity.humidity} %` : '—'}
            </span>
            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${statusClasses[currentHumidityStatus]}`}>
              {currentHumidityStatus}
            </span>
          </div>
          <span className="text-[10px] text-ink-secondary">
            Warning ≥ {humidityWarningThreshold}% RH • Alert ≥ {humidityAlertThreshold}% RH
          </span>
        </div>
        <div>
          <span className="text-xs text-ink-secondary uppercase font-semibold">Hardware Status</span>
          <div className="mt-1.5 flex items-center gap-2">
            <span className={`px-2.5 py-1 text-xs font-bold rounded-full border inline-flex items-center gap-1.5 ${p.latestHumidity.is_online ? 'bg-emerald-500/20 text-emerald-600 border-emerald-500/40' : 'bg-rose-500/10 text-rose-600 border-rose-500/30'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${p.latestHumidity.is_online ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              {p.latestHumidity.is_online ? 'ESP32 Connected' : 'Hardware Offline'}
            </span>
          </div>
          <span className="text-[10px] text-ink-secondary block mt-1">
            {p.latestHumidity.is_online
              ? `Humidity: ${currentHumidityStatus} • Temperature: ${currentTemperatureStatus}`
              : 'No recent sensor reading received'}
          </span>
        </div>
        <div>
          <span className="text-xs text-ink-secondary uppercase font-semibold">Last Sensor Update</span>
          <div className="text-sm font-semibold text-navy mt-1.5">
            {p.latestHumidity.last_updated ? new Date(p.latestHumidity.last_updated).toLocaleTimeString() : '—'}
          </div>
          <span className="text-[10px] text-ink-secondary">
            {p.latestHumidity.last_updated ? new Date(p.latestHumidity.last_updated).toLocaleDateString() : 'No readings yet'}
          </span>
        </div>
      </div>

      <div className="p-6 rounded-2xl bg-white border border-line space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-navy">Live Telemetry Stream (Temperature & Relative Humidity)</h3>
          <span className="text-xs text-ink-secondary font-medium">Actual readings from MySQL database</span>
        </div>
        {p.humidityHistory.length === 0 ? (
          <div className="h-80 flex items-center justify-center text-ink-secondary">
            No sensor data in database yet. Connect ESP32 to Android hotspot to begin streaming live telemetry.
          </div>
        ) : (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={p.humidityHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                <XAxis dataKey="time" stroke="var(--navy)" fontSize={11} />
                <YAxis domain={['auto', 'auto']} stroke="var(--navy)" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--white)', borderColor: 'var(--border)', borderRadius: '0.75rem', color: 'var(--navy)' }} />
                <Legend />
                <ReferenceLine y={humidityWarningThreshold} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: `HUMIDITY WARNING (${humidityWarningThreshold}% RH)`, fill: '#f59e0b', fontSize: 10 }} />
                <ReferenceLine y={humidityAlertThreshold} stroke="var(--danger)" strokeDasharray="4 4" label={{ value: `HUMIDITY ALERT (${humidityAlertThreshold}% RH)`, fill: 'var(--danger)', fontSize: 10 }} />
                <ReferenceLine y={p.latestHumidity.temperature_alert_threshold ?? 50} stroke="var(--danger)" strokeDasharray="3 3" label={{ value: `TEMP ALERT (${p.latestHumidity.temperature_alert_threshold ?? 50}°C)`, fill: 'var(--danger)', fontSize: 10 }} />
                <ReferenceLine y={p.latestHumidity.temperature_warning_threshold ?? 40} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: `TEMP WARN (${p.latestHumidity.temperature_warning_threshold ?? 40}°C)`, fill: '#f59e0b', fontSize: 10 }} />
                <Line type="monotone" dataKey="humidity" stroke="var(--blue)" strokeWidth={3} dot={{ fill: 'var(--blue)', r: 3 }} name="Humidity (% RH)" isAnimationActive={false} />
                <Line type="monotone" dataKey="temperature" stroke="#0A4D68" strokeWidth={3} strokeDasharray="6 3" dot={{ fill: '#0A4D68', r: 3 }} name="Temperature (°C)" isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {p.humidityHistory.length > 0 && (
        <div className="p-6 rounded-2xl bg-white border border-line">
          <h3 className="text-base font-bold text-navy mb-3">Recent Sensor Readings Log</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-brand-tint border-b border-line text-navy uppercase font-semibold">
                <tr>
                  <th className="px-3 py-2">Timestamp</th>
                  <th className="px-3 py-2">Temperature</th>
                  <th className="px-3 py-2">Humidity</th>
                  <th className="px-3 py-2">Humidity Status</th>
                  <th className="px-3 py-2">Temperature Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/40">
                {p.humidityHistory.slice(-10).reverse().map((reading, idx) => {
                  const readingHumidityStatus = getHumidityStatus(reading.humidity)
                  const readingTemperatureStatus = getTemperatureStatus(reading.temperature)
                  return (
                    <tr key={reading.id ?? idx} className="hover:bg-brand-tint/30 transition">
                      <td className="px-3 py-2 font-mono text-ink-secondary">{reading.time}</td>
                      <td className="px-3 py-2 font-bold text-amber-600">{reading.temperature !== null ? `${reading.temperature} °C` : '—'}</td>
                      <td className="px-3 py-2 font-bold text-navy">{reading.humidity !== null ? `${reading.humidity} %` : '—'}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusClasses[readingHumidityStatus]}`}>
                          {readingHumidityStatus}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusClasses[readingTemperatureStatus]}`}>
                          {readingTemperatureStatus}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Modals (global, rendered at root level) ──────────────────────────────────
function OrderModals(p) {
  const kgQty = Number(p.newOrderItems[0]?.quantity) || 0
  const kgLine = p.newOrderTotals.lines[0]
  const kgPrice = p.standardKgService ? Number(p.standardKgService.price) : 0
  const chargeLimit = Number(p.orderPricingLimits?.max_additional_charges)
  const configuredDiscountLimit = Number(p.orderPricingLimits?.max_discount)
  const discountLimit = Math.min(
    Number.isFinite(configuredDiscountLimit) ? configuredDiscountLimit : 0,
    Math.floor(p.newOrderTotals.subtotal * 50 + 0.000001) / 100,
  )
  return (
    <>
      {/* Create Order Modal */}
      {p.isNewOrderModalOpen && (
        <div className="fixed inset-0 z-50 bg-navy/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-line rounded-2xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <h3 className="text-lg font-bold text-navy">Create New Laundry Order</h3>
              <button onClick={() => p.setIsNewOrderModalOpen(false)} className="text-ink-secondary hover:text-navy text-xl">✕</button>
            </div>
            <form onSubmit={p.handleCreateOrder} className="space-y-4 text-sm">
              {p.orderValidationVisible && p.orderValidation.hasErrors && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{p.orderValidation.firstMessage}</div>}
              <div>
                <label className="block text-xs font-semibold text-navy mb-1">Select Customer</label>
                <select value={p.newOrderCustomer} onChange={e => p.setNewOrderCustomer(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-brand-tint border border-line text-navy focus:outline-none focus:border-brand-light">
                  <option value="">-- Choose Customer --</option>
                  {p.customers.filter(c => c.status !== 'inactive').map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name} ({c.phone})</option>)}
                </select>
                {p.orderValidationVisible && p.orderValidation.errors.customer && <p className="mt-1 text-xs text-rose-600">Choose an active customer.</p>}
              </div>

              <div className="space-y-3">
                {/* Standard kilogram load */}
                <div className="p-3 rounded-xl bg-brand-tint border border-brand-light space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="block text-xs font-semibold text-navy">Weight (kg)</label>
                    {p.standardKgService && (
                      <span className="px-2 py-0.5 rounded-lg bg-white border border-brand-light text-[10px] font-bold text-navy">{p.standardKgService.name} — {formatCurrency(p.standardKgService.price)}/kg</span>
                    )}
                  </div>
                  {!p.standardKgService ? (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400">
                      No active laundry rate. Activate the standard service in <strong>Pricing</strong> first.
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-2 items-center">
                        <input type="text" inputMode="decimal" maxLength={6} value={p.newOrderItems[0]?.quantity ?? ''} onChange={e => { const value = normalizeDecimalInput(e.target.value, MAX_ORDER_WEIGHT_KG); if (value === null) return; const u = [...p.newOrderItems]; u[0] = { ...(u[0] || { service_id: p.standardKgService.id, notes: '' }), quantity: value }; p.setNewOrderItems(u) }} className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-white border border-line text-navy focus:outline-none focus:border-brand-light" placeholder="e.g. 5" />
                        <span className="text-[11px] font-semibold text-ink-secondary shrink-0">kg</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-ink-secondary">
                        <span>{kgQty} kg × {formatCurrency(kgPrice)} per kilogram</span>
                        <span className="font-bold text-navy">{formatCurrency(kgLine?.subtotal || 0)}</span>
                      </div>
                      {p.orderValidationVisible && p.orderValidation.errors.weight && <p className="text-xs text-rose-600">Enter 0.01–999.99 kg, or add a special item.</p>}
                    </>
                  )}
                </div>

                {/* Per-piece special items */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-navy">Special Items <span className="font-normal text-ink-secondary">(optional, per piece)</span></label>
                    {p.specialServices.length > 0 && (
                      <button type="button" onClick={() => p.setNewOrderItems([...p.newOrderItems, { service_id: p.specialServices[0]?.id || '', quantity: 1, notes: '' }])} className="text-[11px] font-bold text-navy hover:text-navy-hover flex items-center gap-1">
                        <Plus className="w-3 h-3" />Add Special Item
                      </button>
                    )}
                  </div>
                  {p.specialServices.length === 0 ? (
                    <p className="text-[11px] text-ink-secondary">No per-piece extras available — manage them in Pricing.</p>
                  ) : (
                    p.newOrderItems.slice(1).map((item, sIdx) => {
                      const idx = sIdx + 1
                      const line = p.newOrderTotals.lines[idx]
                      return (
                        <div key={idx} className="p-2.5 rounded-xl bg-brand-tint border border-line space-y-2">
                          <div className="flex gap-2 items-center">
                            <select value={item.service_id} onChange={e => { const u = [...p.newOrderItems]; u[idx].service_id = e.target.value; p.setNewOrderItems(u) }} className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-white border border-line text-navy focus:outline-none focus:border-brand-light">
                              {p.specialServices.map(s => <option key={s.id} value={s.id}>{s.name} — {formatCurrency(s.price)}/{s.unit}</option>)}
                            </select>
                            <div className="flex items-center gap-1 shrink-0">
                              <input type="text" inputMode="numeric" maxLength={4} value={item.quantity} onChange={e => { const value = normalizeIntegerInput(e.target.value, MAX_SPECIAL_ITEM_QUANTITY); if (value === null) return; const u = [...p.newOrderItems]; u[idx].quantity = value; p.setNewOrderItems(u) }} className="w-20 px-3 py-2 rounded-xl bg-white border border-line text-navy focus:outline-none focus:border-brand-light" placeholder="Qty" />
                              <span className="text-[11px] font-semibold text-ink-secondary w-6">{line?.service?.unit || 'pcs'}</span>
                            </div>
                            <button type="button" onClick={() => p.setNewOrderItems(p.newOrderItems.filter((_, i) => i !== idx))} className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition shrink-0" title="Remove special item">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-ink-secondary">
                            <span>{line?.service ? `${line.qty} ${line.service.unit} × ${formatCurrency(line.price)}` : 'Select a special item'}</span>
                            <span className="font-bold text-navy">{formatCurrency(line?.subtotal || 0)}</span>
                          </div>
                          {p.orderValidationVisible && p.orderValidation.errors.extras[sIdx] && <p className="text-xs text-rose-600">Choose a valid special item and enter a quantity from 1 to 9,999.</p>}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-navy mb-1">Additional Charges (₱)</label>
                  <input type="text" inputMode="decimal" value={p.newOrderCharges} onChange={e => { const value = normalizeDecimalInput(e.target.value, Number.isFinite(chargeLimit) ? chargeLimit : null); if (value !== null) p.setNewOrderCharges(value) }} placeholder="0.00" className="w-full px-3 py-2 rounded-xl bg-brand-tint border border-line text-navy focus:outline-none focus:border-brand-light" />
                  <p className="mt-1 text-[10px] text-ink-secondary">Maximum: {Number.isFinite(chargeLimit) ? formatCurrency(chargeLimit) : 'Loading configured limit...'}</p>
                  {(p.newOrderCharges !== '' || p.orderValidationVisible) && p.orderValidation.errors.charges && <p className="mt-1 text-xs text-rose-600">Maximum additional charge is {formatCurrency(chargeLimit)}.</p>}
                  {Number(p.newOrderCharges) > 0 && <div className="mt-2">
                    <label className="mb-1 block text-xs font-semibold text-navy" htmlFor="additional-charge-reason">Reason for charge</label>
                    <input id="additional-charge-reason" type="text" maxLength={160} value={p.newOrderChargesReason} onChange={e => p.setNewOrderChargesReason(e.target.value)} placeholder="e.g. Express service" className="w-full rounded-xl border border-line bg-brand-tint px-3 py-2 text-navy focus:border-brand-light focus:outline-none" />
                    {p.orderValidation.errors.chargeReason && <p className="mt-1 text-xs text-rose-600">A reason is required for additional charges.</p>}
                  </div>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-navy mb-1">Discount (₱)</label>
                  <input type="text" inputMode="decimal" value={p.newOrderDiscount} onChange={e => { const value = normalizeDecimalInput(e.target.value, discountLimit); if (value !== null) p.setNewOrderDiscount(value) }} placeholder="0.00" className="w-full px-3 py-2 rounded-xl bg-brand-tint border border-line text-navy focus:outline-none focus:border-brand-light" />
                  <p className="mt-1 text-[10px] text-ink-secondary">Maximum now: {p.orderPricingLimits ? formatCurrency(discountLimit) : 'Loading configured limit...'}</p>
                  {(p.newOrderDiscount !== '' || p.orderValidationVisible) && p.orderValidation.errors.discount && <p className="mt-1 text-xs text-rose-600">Discount cannot exceed {formatCurrency(discountLimit)} (50% of subtotal or the configured limit).</p>}
                </div>
              </div>

              {/* Live total */}
              <div className="p-3 rounded-xl bg-white border border-line space-y-1.5 text-xs">
                <div className="flex justify-between gap-2 text-ink-secondary"><span>Laundry subtotal</span><span className="min-w-0 text-right font-semibold tabular-nums break-all text-navy">{formatCurrency(p.newOrderTotals.subtotal)}</span></div>
                <div className="flex justify-between gap-2 text-ink-secondary"><span>Additional charges</span><span className="min-w-0 text-right font-semibold tabular-nums break-all text-navy">{formatCurrency(p.newOrderTotals.charges)}</span></div>
                <div className="flex justify-between gap-2 text-ink-secondary"><span>Discount</span><span className="min-w-0 text-right font-semibold tabular-nums break-all text-navy">-{formatCurrency(p.newOrderTotals.discount)}</span></div>
                <div className="flex justify-between items-center pt-1.5 border-t border-line">
                  <span className="text-xs font-black text-navy uppercase tracking-wider">Order Total</span>
                  <span className="text-lg font-black text-navy">{formatCurrency(p.newOrderTotals.total)}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy mb-1">Care Instructions</label>
                <textarea rows="2" maxLength={MAX_ORDER_NOTES_LENGTH} value={p.newOrderNotes} onChange={e => p.setNewOrderNotes(e.target.value)} placeholder="e.g. Separate white clothes, extra fabric conditioner..." className="w-full px-3 py-2 rounded-xl bg-brand-tint border border-line text-navy focus:outline-none focus:border-brand-light" />
                <p className={`mt-1 text-right text-[11px] ${p.newOrderNotes.length >= MAX_ORDER_NOTES_LENGTH ? 'text-amber-600' : 'text-ink-secondary'}`}>{p.newOrderNotes.length}/{MAX_ORDER_NOTES_LENGTH}</p>
              </div>
              <div className="pt-3 flex justify-end gap-3 border-t border-line">
                <button type="button" onClick={() => p.setIsNewOrderModalOpen(false)} className="px-4 py-2 rounded-xl bg-brand-tint hover:bg-brand-tintstrong text-navy font-semibold">Cancel</button>
                <button type="submit" disabled={!p.standardKgService || p.orderSaving} className="px-4 py-2 rounded-xl bg-navy hover:bg-navy-hover text-white font-bold shadow-card disabled:opacity-50">{p.orderSaving && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}{p.orderSaving ? 'Submitting…' : `Submit Order • ${formatCurrency(p.newOrderTotals.total)}`}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {p.isRecordPaymentModalOpen && (
        <div className="fixed inset-0 z-50 bg-navy/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-line rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <h3 className="text-lg font-bold text-navy">Record Payment</h3>
              <button onClick={() => p.setIsRecordPaymentModalOpen(false)} className="text-ink-secondary hover:text-navy text-xl">✕</button>
            </div>
            <form onSubmit={p.handleRecordPayment} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-navy mb-1">Select Order</label>
                <select value={p.paymentOrderId} onChange={e => p.handlePaymentOrderSelect(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-brand-tint border border-line text-navy focus:outline-none focus:border-brand-light" required>
                  <option value="">-- Choose Order --</option>
                  {p.orders.filter(o => Number(o.remaining_balance) > 0 && o.payment_status !== 'Paid' && o.laundry_status !== 'Cancelled').map(o => <option key={o.id} value={o.id}>{o.order_number} - {o.customer ? `${o.customer.first_name} ${o.customer.last_name}` : 'Guest'} (Balance: ₱{Number(o.remaining_balance).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</option>)}
                </select>
                {p.paymentOrderLoading && <p className="mt-1 text-xs text-ink-secondary">Retrieving latest balance…</p>}
                {p.paymentFormErrors.order && <p className="mt-1 text-xs text-rose-600">{p.paymentFormErrors.order}</p>}
                {p.paymentOrderId && p.paymentOrderBalance !== null && <p className="mt-1 text-xs font-semibold text-navy">Remaining Balance: ₱{Number(p.paymentOrderBalance).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-navy mb-1">Payment Amount (₱)</label>
                <input type="text" inputMode="decimal" maxLength={p.paymentOrderBalance === null ? 12 : Number(p.paymentOrderBalance).toFixed(2).length} value={p.paymentAmount} onChange={e => { const value = e.target.value; if (/^\d*(?:\.\d{0,2})?$/.test(value)) { if (p.paymentOrderBalance === null || value === '' || Number(value) <= Number(p.paymentOrderBalance)) { p.setPaymentAmount(value); p.setPaymentFormErrors({ ...p.paymentFormErrors, amount: '' }) } else { p.setPaymentFormErrors({ ...p.paymentFormErrors, amount: 'Payment cannot exceed the remaining balance.' }) } } }} className="w-full px-3 py-2 rounded-xl bg-brand-tint border border-line text-navy focus:outline-none focus:border-brand-light" required />
                {p.paymentFormErrors.amount && <p className="mt-1 text-xs text-rose-600">{p.paymentFormErrors.amount}</p>}
                {p.paymentOrderBalance !== null && Number(p.paymentAmount) > Number(p.paymentOrderBalance) && <p className="mt-1 text-xs text-rose-600">Payment cannot exceed the remaining balance.</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-navy mb-1">Payment Method</label>
                <select value={p.paymentMethod} onChange={e => { p.setPaymentMethod(e.target.value); p.setPaymentFormErrors({ ...p.paymentFormErrors, reference: '', otherMethod: '' }) }} className="w-full px-3 py-2 rounded-xl bg-brand-tint border border-line text-navy focus:outline-none focus:border-brand-light">{PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.value}</option>)}</select>
              </div>
              <div>
                {p.paymentMethod === 'Other' && <div><label className="block text-xs font-semibold text-navy mb-1">Specify Payment Method *</label><input type="text" maxLength={100} value={p.paymentOtherMethod} onChange={e => { p.setPaymentOtherMethod(e.target.value); p.setPaymentFormErrors({ ...p.paymentFormErrors, otherMethod: '' }) }} placeholder="e.g. Bank transfer" className="w-full px-3 py-2 rounded-xl bg-brand-tint border border-line text-navy focus:outline-none focus:border-brand-light" />{p.paymentFormErrors.otherMethod && <p className="mt-1 text-xs text-rose-600">{p.paymentFormErrors.otherMethod}</p>}</div>}
                <label className="block text-xs font-semibold text-navy mb-1">Reference / Notes{['GCash', 'Maya'].includes(p.paymentMethod) ? ' *' : ' (optional)'}</label>
                <input type="text" maxLength={['GCash', 'Maya'].includes(p.paymentMethod) ? 100 : 2000} value={p.paymentReference} onChange={e => { p.setPaymentReference(e.target.value); p.setPaymentFormErrors({ ...p.paymentFormErrors, reference: '' }) }} placeholder={p.paymentMethod === 'GCash' || p.paymentMethod === 'Maya' ? 'Enter transaction reference number' : 'Enter a reference or payment note'} className="w-full px-3 py-2 rounded-xl bg-brand-tint border border-line text-navy focus:outline-none focus:border-brand-light" />
                {p.paymentFormErrors.reference && <p className="mt-1 text-xs text-rose-600">{p.paymentFormErrors.reference}</p>}
              </div>
              <div className="pt-3 flex justify-end gap-3 border-t border-line">
                <button type="button" onClick={() => p.setIsRecordPaymentModalOpen(false)} className="px-4 py-2 rounded-xl bg-brand-tint text-navy font-semibold">Cancel</button>
                <button type="submit" disabled={p.paymentSaving || p.paymentOrderLoading || !p.paymentOrderId} className="px-4 py-2 rounded-xl bg-navy hover:bg-navy-hover text-white font-bold shadow-card disabled:opacity-50">{p.paymentSaving && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}{p.paymentSaving ? 'Saving…' : 'Save Payment'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {p.isAddCustomerModalOpen && (
        <div className="fixed inset-0 z-50 bg-navy/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-line rounded-2xl max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <h3 className="text-lg font-bold text-navy">Add New Customer</h3>
              <button onClick={() => { p.setIsAddCustomerModalOpen(false); p.setNewCustomerErrors({}) }} className="text-ink-secondary hover:text-navy text-xl">✕</button>
            </div>
            <form onSubmit={p.handleAddCustomer} className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="new-customer-first-name" className="mb-1 block text-xs font-semibold text-navy">First Name *</label>
                  <input id="new-customer-first-name" type="text" maxLength={100} value={p.newCustFirstName} onChange={e => { p.setNewCustFirstName(sanitizeCustomerName(e.target.value)); p.setNewCustomerErrors({ ...p.newCustomerErrors, first_name: '' }) }} aria-invalid={Boolean(p.newCustomerErrors.first_name)} aria-describedby={p.newCustomerErrors.first_name ? 'new-customer-first-name-error' : undefined} className={`w-full rounded-xl border px-3 py-2 text-navy focus:outline-none focus:border-brand-light ${p.newCustomerErrors.first_name ? 'border-rose-400' : 'border-line bg-brand-tint'}`} />
                  {p.newCustomerErrors.first_name && <p id="new-customer-first-name-error" className="mt-1 text-xs text-rose-600">{p.newCustomerErrors.first_name}</p>}
                </div>
                <div>
                  <label htmlFor="new-customer-last-name" className="mb-1 block text-xs font-semibold text-navy">Last Name *</label>
                  <input id="new-customer-last-name" type="text" maxLength={100} value={p.newCustLastName} onChange={e => { p.setNewCustLastName(sanitizeCustomerName(e.target.value)); p.setNewCustomerErrors({ ...p.newCustomerErrors, last_name: '' }) }} aria-invalid={Boolean(p.newCustomerErrors.last_name)} aria-describedby={p.newCustomerErrors.last_name ? 'new-customer-last-name-error' : undefined} className={`w-full rounded-xl border px-3 py-2 text-navy focus:outline-none focus:border-brand-light ${p.newCustomerErrors.last_name ? 'border-rose-400' : 'border-line bg-brand-tint'}`} />
                  {p.newCustomerErrors.last_name && <p id="new-customer-last-name-error" className="mt-1 text-xs text-rose-600">{p.newCustomerErrors.last_name}</p>}
                </div>
              </div>
              <div>
                <label htmlFor="new-customer-phone" className="mb-1 block text-xs font-semibold text-navy">Mobile Phone * (09XX-XXX-XXXX)</label>
                <input id="new-customer-phone" type="tel" inputMode="numeric" maxLength={13} value={p.newCustPhone} onChange={e => { p.setNewCustPhone(formatPhilippineMobile(e.target.value)); p.setNewCustomerErrors({ ...p.newCustomerErrors, phone: '' }) }} placeholder="0917-000-0000" aria-invalid={Boolean(p.newCustomerErrors.phone)} aria-describedby={p.newCustomerErrors.phone ? 'new-customer-phone-error' : undefined} className={`w-full rounded-xl border px-3 py-2 text-navy focus:outline-none focus:border-brand-light ${p.newCustomerErrors.phone ? 'border-rose-400' : 'border-line bg-brand-tint'}`} />
                {p.newCustomerErrors.phone && <p id="new-customer-phone-error" className="mt-1 text-xs text-rose-600">{p.newCustomerErrors.phone}</p>}
              </div>
              <div>
                <label htmlFor="new-customer-address" className="mb-1 block text-xs font-semibold text-navy">Address</label>
                <input id="new-customer-address" type="text" maxLength={255} value={p.newCustAddress} onChange={e => { p.setNewCustAddress(e.target.value); p.setNewCustomerErrors({ ...p.newCustomerErrors, address: '' }) }} placeholder="Barangay, House No., Victoria, Laguna" aria-invalid={Boolean(p.newCustomerErrors.address)} aria-describedby={p.newCustomerErrors.address ? 'new-customer-address-error' : undefined} className={`w-full rounded-xl border px-3 py-2 text-navy focus:outline-none focus:border-brand-light ${p.newCustomerErrors.address ? 'border-rose-400' : 'border-line bg-brand-tint'}`} />
                {p.newCustomerErrors.address && <p id="new-customer-address-error" className="mt-1 text-xs text-rose-600">{p.newCustomerErrors.address}</p>}
              </div>
              <div className="pt-3 flex justify-end gap-3 border-t border-line">
                <button type="button" onClick={() => { p.setIsAddCustomerModalOpen(false); p.setNewCustomerErrors({}) }} className="px-4 py-2 rounded-xl bg-brand-tint text-navy font-semibold">Cancel</button>
                <button type="submit" disabled={p.customerAdding} className="px-4 py-2 rounded-xl bg-navy hover:bg-navy-hover text-white font-bold disabled:opacity-50">{p.customerAdding && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}{p.customerAdding ? 'Saving…' : 'Save Profile'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit / View Customer Modal */}
      {p.editingCustomer && (
        <div className="fixed inset-0 z-50 bg-navy/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-line rounded-2xl max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div>
                <h3 className="text-lg font-bold text-navy">Edit Customer</h3>
                <p className="text-xs text-ink-secondary">{p.editingCustomer.customer_code} • {p.editingCustomer.status === 'inactive' ? 'Inactive' : 'Active'}</p>
              </div>
              <button onClick={() => p.setEditingCustomer(null)} className="text-ink-secondary hover:text-navy text-xl">✕</button>
            </div>
            <form onSubmit={p.handleUpdateCustomer} className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><label className="block text-xs font-semibold text-navy mb-1">First Name *</label><input type="text" value={p.editCustForm.first_name} onChange={e => p.setEditCustForm({ ...p.editCustForm, first_name: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-brand-tint border border-line text-navy focus:outline-none focus:border-brand-light" required /></div>
                <div><label className="block text-xs font-semibold text-navy mb-1">Last Name *</label><input type="text" value={p.editCustForm.last_name} onChange={e => p.setEditCustForm({ ...p.editCustForm, last_name: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-brand-tint border border-line text-navy focus:outline-none focus:border-brand-light" required /></div>
              </div>
              <div><label className="block text-xs font-semibold text-navy mb-1">Mobile Phone * (09XX-XXX-XXXX)</label><input type="text" value={p.editCustForm.phone} onChange={e => p.setEditCustForm({ ...p.editCustForm, phone: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-brand-tint border border-line text-navy focus:outline-none focus:border-brand-light" required /></div>
              <div><label className="block text-xs font-semibold text-navy mb-1">Email{p.editingCustomer.user_id ? ' * (required for app login)' : ''}</label><input type="email" required={Boolean(p.editingCustomer.user_id)} value={p.editCustForm.email} onChange={e => p.setEditCustForm({ ...p.editCustForm, email: e.target.value })} placeholder="customer@example.com" className="w-full px-3 py-2 rounded-xl bg-brand-tint border border-line text-navy focus:outline-none focus:border-brand-light" /></div>
              <div><label className="block text-xs font-semibold text-navy mb-1">Address</label><input type="text" value={p.editCustForm.address} onChange={e => p.setEditCustForm({ ...p.editCustForm, address: e.target.value })} placeholder="Barangay, House No., Victoria, Laguna" className="w-full px-3 py-2 rounded-xl bg-brand-tint border border-line text-navy focus:outline-none focus:border-brand-light" /></div>
              <div><label className="block text-xs font-semibold text-navy mb-1">Notes</label><textarea rows="2" value={p.editCustForm.notes} onChange={e => p.setEditCustForm({ ...p.editCustForm, notes: e.target.value })} placeholder="Preferences, special instructions..." className="w-full px-3 py-2 rounded-xl bg-brand-tint border border-line text-navy focus:outline-none focus:border-brand-light" /></div>
              <div className="pt-3 flex justify-end gap-3 border-t border-line">
                <button type="button" disabled={p.customerSaving} onClick={() => p.setEditingCustomer(null)} className="px-4 py-2 rounded-xl bg-brand-tint text-navy font-semibold disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={p.customerSaving} className="px-4 py-2 rounded-xl bg-navy hover:bg-navy-hover text-white font-bold disabled:opacity-50">{p.customerSaving ? 'Saving…' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Archive Customer Confirmation */}
      <ConfirmDialog
        open={!!p.archivingCustomer}
        title="Deactivate customer account"
        message="Deactivate this customer’s account? They will lose app access and cannot place orders. Their profile and order history will be preserved."
        confirmLabel="Deactivate Account"
        danger
        busy={p.customerAccountActionBusy}
        onConfirm={p.handleArchiveCustomer}
        onCancel={() => p.setArchivingCustomer(null)}
      />
      <ConfirmDialog
        open={!!p.restoringCustomer}
        title="Activate customer account"
        message={p.restoringCustomer ? `Activate ${p.restoringCustomer.first_name} ${p.restoringCustomer.last_name}? They can sign in and place orders again.` : ''}
        confirmLabel="Activate Account"
        busy={p.customerAccountActionBusy}
        onConfirm={p.handleRestoreCustomer}
        onCancel={() => p.setRestoringCustomer(null)}
      />

      {/* Order Details Modal */}
      {p.selectedOrderDetails && (
        <div className="fixed inset-0 z-50 bg-navy/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-line rounded-2xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div>
                <h3 className="text-lg font-bold text-navy flex items-center gap-2">
                  Order {p.selectedOrderDetails.order_number}
                  {p.renderStatusBadge(p.selectedOrderDetails.laundry_status)}
                </h3>
                <p className="text-xs text-ink-secondary">Placed on {new Date(p.selectedOrderDetails.order_date).toLocaleString()}</p>
              </div>
              <button onClick={() => p.setSelectedOrderDetails(null)} className="text-ink-secondary hover:text-navy text-xl">✕</button>
            </div>
            <div className="p-4 rounded-xl bg-brand-tint border border-line/50 space-y-1 text-xs">
              <span className="font-bold text-navy uppercase tracking-wider block mb-1">Customer Details</span>
              <p className="text-sm font-bold text-navy">{p.selectedOrderDetails.customer ? `${p.selectedOrderDetails.customer.first_name} ${p.selectedOrderDetails.customer.last_name}` : 'Guest'}</p>
              <p className="text-ink-secondary">📞 {p.selectedOrderDetails.customer?.phone}</p>
              {p.selectedOrderDetails.customer?.email && <p className="text-ink-secondary">Email: {p.selectedOrderDetails.customer.email}</p>}
              <p className="text-ink-secondary">📍 {p.selectedOrderDetails.customer?.address || 'Victoria, Laguna'}</p>
              <p className="text-ink-secondary">Fulfillment: <strong className="text-navy">{p.selectedOrderDetails.fulfillment_type}</strong></p>
              <p className="flex items-center gap-2 text-ink-secondary">Payment status: {p.renderPaymentBadge(p.selectedOrderDetails.payment_status)}</p>
            </div>
            <div className="space-y-2">
              <span className="text-xs font-bold text-navy uppercase tracking-wider block">Services Breakdown</span>
              {p.orderItemsOf(p.selectedOrderDetails).map((it, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-brand-tint border border-line/40 flex justify-between items-center text-xs">
                  <div><div className="font-bold text-navy">{it.service?.name}</div><div className="text-ink-secondary">{it.quantity} {it.service?.unit} @ ₱{Number(it.unit_price).toFixed(2)}/{it.service?.unit}</div></div>
                  <div className="font-bold text-navy">₱{Number(it.subtotal).toFixed(2)}</div>
                </div>
              ))}
            </div>
            {(Object.keys(p.selectedOrderDetails.product_preferences || {}).length > 0 ||
              p.selectedOrderDetails.customer_bringing_own_detergent != null) && (
              <div className="p-3 rounded-xl bg-brand-tint border border-line space-y-2">
                <span className="text-xs font-bold text-navy uppercase tracking-wider block">Customer Supplies & Product Preferences</span>
                {p.selectedOrderDetails.customer_bringing_own_detergent != null && (
                  <p className="text-xs text-navy">
                    {p.selectedOrderDetails.customer_bringing_own_detergent
                      ? 'Customer is bringing their own detergent.'
                      : 'Use the laundry detergent.'}
                  </p>
                )}
                {p.selectedOrderDetails.detergent_type && (
                  <p className="text-xs text-navy">
                    Detergent type: {p.selectedOrderDetails.detergent_type}
                  </p>
                )}
                {Object.entries(p.selectedOrderDetails.product_preferences || {}).map(([category, product]) => (
                  <div key={category} className="flex justify-between gap-3 text-xs">
                    <span className="text-ink-secondary">{category}</span>
                    <span className="font-semibold text-navy text-right">{product}</span>
                  </div>
                ))}
              </div>
            )}
            {(p.selectedOrderDetails.product_addons || []).length > 0 && (
              <div className="p-3 rounded-xl bg-brand-tint border border-line space-y-2">
                <span className="text-xs font-bold text-navy uppercase tracking-wider block">Paid Product Add-ons</span>
                {(p.selectedOrderDetails.product_addons || []).map((addon) => (
                  <div key={addon.inventory_id} className="flex justify-between gap-3 text-xs">
                    <span className="text-ink-secondary">
                      {addon.name} · {addon.quantity} {addon.unit} × ₱{Number(addon.unit_price).toFixed(2)}
                    </span>
                    <span className="font-bold text-navy whitespace-nowrap">₱{Number(addon.subtotal).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="p-3 rounded-xl bg-brand-tint border border-line space-y-2">
              <span className="text-xs font-bold text-navy uppercase tracking-wider block">Supplies Used / Stock Deducted</span>
              {(p.selectedOrderDetails.inventory_transactions || []).length === 0 ? (
                <p className="text-xs text-ink-secondary">No supply usage has been recorded for this order.</p>
              ) : (
                p.selectedOrderDetails.inventory_transactions.map((usage) => (
                  <div key={usage.id} className="flex justify-between gap-3 text-xs">
                    <span className="text-navy">
                      {usage.inventory?.name || 'Inventory item'}
                      <span className="block text-ink-secondary">
                        {usage.recorder?.name
                          ? `Recorded by ${usage.recorder.name}`
                          : 'Automatically deducted when order was placed'} · {new Date(usage.created_at).toLocaleString()}
                      </span>
                    </span>
                    <span className="font-bold text-rose-400 whitespace-nowrap">
                      -{usage.quantity} {usage.inventory?.unit || ''}
                    </span>
                  </div>
                ))
              )}
            </div>
            {p.selectedOrderDetails.notes && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300"><strong>Care Instructions:</strong> {p.selectedOrderDetails.notes}</div>
            )}
            <div className="p-3 rounded-xl bg-brand-tint border border-line space-y-2">
              <span className="text-xs font-bold text-navy uppercase tracking-wider block">Status History</span>
              {p.orderDetailsLoadingId === p.selectedOrderDetails.id ? (
                <p className="text-xs text-ink-secondary flex items-center gap-2"><RefreshCw className="h-3.5 w-3.5 animate-spin" />Loading status history...</p>
              ) : (p.selectedOrderDetails.status_history || []).length === 0 ? (
                <p className="text-xs text-ink-secondary">No status updates have been recorded.</p>
              ) : (
                [...p.selectedOrderDetails.status_history].reverse().map(entry => (
                  <div key={entry.id} className="border-b border-line/60 pb-2 last:border-0 last:pb-0 text-xs">
                    <div className="flex flex-wrap justify-between gap-1 font-semibold text-navy">
                      <span>{entry.from_status || 'Created'} → {entry.to_status}</span>
                      <span>{entry.created_at ? new Date(entry.created_at).toLocaleString() : ''}</span>
                    </div>
                    <div className="mt-0.5 text-ink-secondary">Updated by {entry.user?.name || 'System'}</div>
                    {entry.notes && <p className="mt-1 whitespace-pre-wrap text-rose-700">Reason: {entry.notes}</p>}
                  </div>
                ))
              )}
            </div>
            <div className="pt-3 border-t border-line space-y-2 text-sm">
              {Number(p.selectedOrderDetails.additional_charges) > 0 && (
                <div className="flex justify-between text-xs text-ink-secondary"><span>Additional charges</span><span>₱{Number(p.selectedOrderDetails.additional_charges).toFixed(2)}</span></div>
              )}
              {Number(p.selectedOrderDetails.discount) > 0 && (
                <div className="flex justify-between text-xs text-ink-secondary"><span>Discount</span><span>-₱{Number(p.selectedOrderDetails.discount).toFixed(2)}</span></div>
              )}
              <div className="flex justify-between font-bold text-navy"><span>Total:</span><span>₱{Number(p.selectedOrderDetails.total_amount).toFixed(2)}</span></div>
              <div className="flex justify-between text-xs text-emerald-400 font-semibold"><span>Paid:</span><span>₱{Number(p.selectedOrderDetails.paid_amount || 0).toFixed(2)}</span></div>
              <div className="flex justify-between text-xs text-amber-400 font-semibold"><span>Balance:</span><span>₱{Number(p.selectedOrderDetails.remaining_balance || 0).toFixed(2)}</span></div>
            </div>
            <div className="pt-3 flex justify-end gap-3 border-t border-line">
              {p.selectedOrderDetails.payment_status !== 'Paid' && (
                <button onClick={() => { p.handleMarkAsPaid(p.selectedOrderDetails); p.setSelectedOrderDetails(null) }} className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-card">
                  <CheckCircle2 className="w-4 h-4" />Mark as Paid
                </button>
              )}
              <button onClick={() => p.setSelectedOrderDetails(null)} className="px-4 py-2 rounded-xl bg-brand-tint text-navy font-semibold text-xs">Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Root App Component (Router) ──────────────────────────────────────────────
export default function App() {
  return (
    <Routes>
      <Route element={<AuthSplitScreen />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<PasswordRecoveryPage />} />
      </Route>
      <Route path="/index.html" element={<Navigate to="/" replace />} />
      <Route path="/index.html/*" element={<Navigate to="/" replace />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/invoiz" element={<Navigate to="/customers" replace />} />
        <Route path="/*" element={<MainApp />} />
      </Route>
    </Routes>
  )
}
