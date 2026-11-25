import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import SupportInbox from './SupportInbox'
import {
  Bell, AlertTriangle, ShieldAlert, Info, CheckCircle2, Clock, Droplets,
  RefreshCw, CheckCheck, PackageOpen, Trash2, CreditCard, RotateCcw, Thermometer
} from 'lucide-react'

const isSupportAlert = (alert) =>
  alert?.type?.toUpperCase() === 'SUPPORT' || alert?.support_ticket_id != null

export default function AlertsView({ showToast, onUnreadCountChange, onSupportUnreadCountChange }) {
  const navigate = useNavigate()
  const [alerts, setAlerts] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const unreadCountRef = useRef(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [filterSeverity, setFilterSeverity] = useState('ALL')
  const [activeTab, setActiveTab] = useState('alerts')
  const [showDeleted, setShowDeleted] = useState(false)
  const [supportTicketId, setSupportTicketId] = useState(null)
  const [selectedAlert, setSelectedAlert] = useState(null)

  const updateUnreadCount = useCallback((count) => {
    const nextCount = Math.max(0, Number(count) || 0)
    unreadCountRef.current = nextCount
    setUnreadCount(nextCount)
    onUnreadCountChange?.(nextCount)
  }, [onUnreadCountChange])

  const fetchAlerts = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    try {
      const res = await api.get(`/api/alerts${showDeleted ? '?deleted=1' : ''}`)
      const loaded = res.data?.data
      if (!Array.isArray(loaded)) {
        throw new Error('The server returned an invalid notifications response.')
      }
      setLoadError(null)
      const count = Number.isFinite(res.data?.unread_count)
        ? res.data.unread_count
        : loaded.filter(alert => !alert.is_read && !isSupportAlert(alert)).length
      const supportCount = Number.isFinite(res.data?.support_unread_count)
        ? res.data.support_unread_count
        : loaded.filter(alert => !alert.is_read && isSupportAlert(alert)).length
      setAlerts(loaded.filter(alert => !isSupportAlert(alert)))
      updateUnreadCount(count)
      onSupportUnreadCountChange?.(supportCount)
    } catch (err) {
      setLoadError(err.response?.data?.message || 'Unable to load alerts. Check your connection and retry.')
    } finally {
      setLoading(false)
    }
  }, [onSupportUnreadCountChange, showDeleted, updateUnreadCount])

  useEffect(() => {
    void fetchAlerts({ silent: true })
    const timer = window.setInterval(() => fetchAlerts({ silent: true }), 15000)
    return () => window.clearInterval(timer)
  }, [fetchAlerts])

  const handleMarkAsRead = async (id, { notify = true } = {}) => {
    const alert = alerts.find(item => item.id === id)
    try {
      await api.put(`/api/alerts/${id}/read`)
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_read: true } : a))
      if (alert && !alert.is_read) {
        updateUnreadCount(unreadCountRef.current - 1)
      }
      if (notify) showToast('Notification marked as read')
      return true
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to mark notification as read', 'error')
      return false
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await api.post('/api/alerts/read-all')
      setAlerts(prev => prev.map(a => ({ ...a, is_read: true })))
      updateUnreadCount(0)
      showToast('All notifications marked as read')
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to mark notifications as read', 'error')
    }
  }

  const handleDelete = async (alert) => {
    try {
      await api.delete(`/api/alerts/${alert.id}`)
      setAlerts(prev => prev.filter(item => item.id !== alert.id))
      if (!alert.is_read) {
        updateUnreadCount(unreadCountRef.current - 1)
      }
      showToast('Notification removed from the inbox')
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete notification', 'error')
    }
  }

  const handleRestore = async (alert) => {
    try {
      await api.post(`/api/alerts/${alert.id}/restore`)
      setAlerts(prev => prev.filter(item => item.id !== alert.id))
      showToast('Notification restored to the inbox')
      await fetchAlerts({ silent: true })
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to restore notification', 'error')
    }
  }

  const filteredAlerts = alerts.filter(a => {
    if (isSupportAlert(a)) return false
    if (filterSeverity === 'ALL') return true
    return a.severity?.toUpperCase() === filterSeverity
  })

  const getSupportTicketId = (alert) => {
    if (alert.support_ticket_id) return alert.support_ticket_id
    const match = alert.message?.match(/Ticket\s*#(\d+)/i)
    return match ? Number(match[1]) : null
  }

  const handleAlertClick = async (alert) => {
    if (!alert.is_read) {
      await handleMarkAsRead(alert.id, { notify: false })
    }

    if (alert.payment_id) {
      navigate(`/payments?payment=${encodeURIComponent(alert.payment_id)}`)
    } else if (alert.order_id) {
      navigate(`/orders?id=${alert.order_id}`)
    } else if (alert.inventory_id) {
      navigate(`/inventory?product=${alert.inventory_id}${alert.inventory_transaction_id ? `&transaction=${alert.inventory_transaction_id}` : ''}`)
    } else if (alert.support_ticket_id || alert.type === 'SUPPORT') {
      setSupportTicketId(getSupportTicketId(alert))
      setActiveTab('support')
    } else if (alert.device_id || ['HIGH_HUMIDITY', 'CRITICAL_HUMIDITY', 'HIGH_TEMP', 'LOW_TEMP', 'ESP32_OFFLINE', 'HUMIDITY_WARNING'].includes(alert.type?.toUpperCase())) {
      navigate('/humidity')
    } else {
      setSelectedAlert(alert)
    }
  }

  const renderSeverityBadge = (severity) => {
    const s = severity?.toUpperCase()
    if (s === 'CRITICAL') {
      return (
        <span className="flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30 animate-pulse">
          <ShieldAlert className="w-3 h-3" />
          CRITICAL
        </span>
      )
    }
    if (s === 'WARNING') {
      return (
        <span className="flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
          <AlertTriangle className="w-3 h-3" />
          WARNING
        </span>
      )
    }
    return (
      <span className="flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-brand-tintstrong text-navy border border-brand-light">
        <Info className="w-3 h-3" />
        INFO
      </span>
    )
  }

  const renderAlertIcon = (alert) => {
    const type = alert.type?.toUpperCase() || ''
    if (type.includes('TEMP')) return <Thermometer className="w-5 h-5 text-rose-500" />
    if (type.includes('PAYMENT')) return <CreditCard className="w-5 h-5" />
    if (type.includes('HUMIDITY') || type.includes('ESP32') || alert.device_id) {
      return <Droplets className="w-5 h-5" />
    }
    if (type.includes('STOCK') || alert.inventory_id) {
      return <PackageOpen className="w-5 h-5" />
    }
    if (type === 'ORDER_COMPLETED') return <CheckCircle2 className="w-5 h-5" />
    if (type.includes('ORDER')) return <PackageOpen className="w-5 h-5" />
    if (alert.severity?.toUpperCase() === 'CRITICAL') {
      return <ShieldAlert className="w-5 h-5" />
    }
    if (alert.severity?.toUpperCase() === 'WARNING') {
      return <AlertTriangle className="w-5 h-5" />
    }
    return <Info className="w-5 h-5" />
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2 rounded-2xl border border-line bg-white p-2">
        <button onClick={() => setActiveTab('alerts')} className={`rounded-xl px-4 py-2 text-sm font-semibold ${activeTab === 'alerts' ? 'bg-navy text-white' : 'text-ink-secondary hover:bg-brand-tint'}`}>System Alerts</button>
        <button onClick={() => setActiveTab('support')} className={`rounded-xl px-4 py-2 text-sm font-semibold ${activeTab === 'support' ? 'bg-navy text-white' : 'text-ink-secondary hover:bg-brand-tint'}`}>Customer Support</button>
      </div>
      {activeTab === 'support' ? <SupportInbox showToast={showToast} initialTicketId={supportTicketId} onUnreadCountChange={onSupportUnreadCountChange} /> : <>
      <div className="flex items-center gap-2">
        <button onClick={() => setShowDeleted(false)} className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${!showDeleted ? 'border-brand-light bg-brand-tintstrong text-navy' : 'border-line bg-white text-ink-secondary hover:bg-brand-tint'}`}>Active</button>
        <button onClick={() => setShowDeleted(true)} className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${showDeleted ? 'border-brand-light bg-brand-tintstrong text-navy' : 'border-line bg-white text-ink-secondary hover:bg-brand-tint'}`}>Deleted</button>
      </div>
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-line">
        <div>
          <div className="flex items-center gap-2">
            <Bell className="w-6 h-6 text-navy" />
            <h2 className="text-xl font-bold text-navy">System Alerts & IoT Notifications</h2>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-rose-500 text-white">
                {unreadCount} unread
              </span>
            )}
          </div>
          <p className="text-xs text-ink-secondary mt-1">
            Temperature warnings and critical alerts, humidity thresholds, ESP32 disruptions, and low inventory.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Severity Filter */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-line">
            {['ALL', 'CRITICAL', 'WARNING', 'INFO'].map(sev => (
              <button
                key={sev}
                onClick={() => setFilterSeverity(sev)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                  filterSeverity === sev
                    ? 'bg-navy text-white shadow-sm shadow-card'
                    : 'text-ink-secondary hover:text-navy'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>

          <button
            onClick={fetchAlerts}
            disabled={loading}
            className="p-2.5 rounded-xl bg-brand-tint hover:bg-brand-tintstrong border border-line text-navy transition"
            title="Refresh Alerts"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-navy' : ''}`} />
          </button>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-brand-tint hover:bg-brand-tintstrong border border-line text-xs font-semibold text-navy transition"
            >
              <CheckCheck className="w-4 h-4 text-navy" />
              <span>Mark All as Read</span>
            </button>
          )}
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {loadError && alerts.length > 0 && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            <span>{loadError}</span>
            <button onClick={fetchAlerts} className="font-bold underline">Retry</button>
          </div>
        )}
        {loading && alerts.length === 0 ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 rounded-2xl bg-white border border-line animate-pulse" />
            ))}
            <p className="text-center text-xs text-ink-secondary">Loading alerts…</p>
          </div>
        ) : loadError && alerts.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-line text-center space-y-3">
            <p className="text-sm font-bold text-navy">Unable to load alerts</p>
            <p className="text-xs text-ink-secondary">{loadError}</p>
            <button
              onClick={fetchAlerts}
              className="px-4 py-2 rounded-xl bg-navy hover:bg-navy-hover text-white text-xs font-bold transition"
            >
              Retry
            </button>
          </div>
        ) : (
        <>
        {filteredAlerts.map(alert => (
          <div
            key={alert.id}
            role="button"
            tabIndex={0}
            aria-label={`Open notification: ${alert.title}`}
            onClick={() => { if (!showDeleted) handleAlertClick(alert) }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                if (!showDeleted) handleAlertClick(alert)
              }
            }}
            className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:border-brand-light hover:bg-brand-tint hover:shadow-card hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-light ${
              !alert.is_read
                ? 'bg-white border-line shadow-card'
                : 'bg-brand-tint border-line opacity-80'
            }`}
          >
            <div className="flex items-start gap-3.5">
              <div className={`p-2.5 rounded-xl mt-0.5 ${
                alert.severity?.toUpperCase() === 'CRITICAL'
                  ? 'bg-rose-500/10 text-rose-400'
                  : alert.severity?.toUpperCase() === 'WARNING'
                  ? 'bg-amber-500/10 text-amber-400'
                  : 'bg-brand-tintstrong text-navy'
              }`}>
                {renderAlertIcon(alert)}
              </div>

              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h4 className={`text-sm font-bold ${!alert.is_read ? 'text-navy' : 'text-ink-secondary'}`}>
                    {alert.title}
                  </h4>
                  {renderSeverityBadge(alert.severity)}
                  {!alert.is_read && (
                    <span className="w-2 h-2 rounded-full bg-brand-light"></span>
                  )}
                </div>

                <p className="text-xs text-navy mt-1">
                  {alert.message}
                </p>

                <div className="flex items-center gap-4 text-[11px] text-ink-secondary mt-2 flex-wrap">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {alert.created_at ? new Date(alert.created_at).toLocaleString() : 'Recent'}
                  </span>
                  {alert.device_id && (
                    <span className="font-mono text-navy">
                      Sensor: {alert.device_id}
                    </span>
                  )}
                  {alert.order_id && (
                    <span className="text-amber-400">
                      Order: #{alert.order_id}
                    </span>
                  )}
                  {alert.payment_id && (
                    <span className="text-navy">
                      Payment: #{alert.payment_id}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              {alert.inventory_id && (
                <button
                  onClick={(event) => {
                    event.stopPropagation()
                    handleAlertClick(alert)
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-tint hover:bg-brand-tintstrong text-navy text-xs font-semibold border border-line transition"
                >
                  <PackageOpen className="w-3.5 h-3.5" />
                  <span>Open Inventory</span>
                </button>
              )}
              {!showDeleted && !alert.is_read && (
                <button
                  onClick={(event) => {
                    event.stopPropagation()
                    void handleMarkAsRead(alert.id)
                  }}
                  aria-label={`Mark ${alert.title} as read`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-tint hover:bg-brand-tintstrong text-navy hover:text-navy text-xs font-semibold border border-line transition"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-navy" />
                  <span>Mark Read</span>
                </button>
              )}
              {showDeleted ? <button
                onClick={(event) => {
                  event.stopPropagation()
                  void handleRestore(alert)
                }}
                aria-label={`Restore ${alert.title}`}
                title="Restore notification"
                className="flex items-center gap-1.5 rounded-lg border border-brand-light bg-brand-tint px-3 py-2 text-xs font-semibold text-navy transition hover:bg-brand-tintstrong"
              >
                <RotateCcw className="h-4 w-4" />Restore
              </button> : <button
                onClick={(event) => {
                  event.stopPropagation()
                  void handleDelete(alert)
                }}
                aria-label={`Delete ${alert.title}`}
                title="Delete notification"
                className="flex items-center justify-center rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-700 transition hover:bg-rose-100"
              >
                <Trash2 className="h-4 w-4" />
              </button>}
            </div>
          </div>
        ))}

        {filteredAlerts.length === 0 && !loading && !loadError && (
          <div className="bg-white p-12 rounded-2xl border border-line text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
            <h4 className="text-base font-bold text-navy">{showDeleted ? 'No deleted alerts' : 'No active alerts found'}</h4>
            <p className="text-xs text-ink-secondary">
              {showDeleted ? 'Deleted notifications will appear here and can be restored to the active inbox.' : 'No active temperature, humidity, sensor, or inventory alerts.'}
            </p>
          </div>
        )}
        </>
        )}
      </div>
      </>}
      {selectedAlert && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedAlert(null)
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="alert-detail-title"
            className="w-full max-w-lg rounded-2xl border border-line bg-white p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <h2 id="alert-detail-title" className="text-lg font-bold text-navy">
                {selectedAlert.title}
              </h2>
              <button
                type="button"
                onClick={() => setSelectedAlert(null)}
                className="rounded-lg px-3 py-1 text-sm font-semibold text-navy hover:bg-brand-tint"
              >
                Close
              </button>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink-secondary">
              {selectedAlert.message}
            </p>
            <p className="mt-4 text-xs text-ink-secondary">
              {selectedAlert.created_at ? new Date(selectedAlert.created_at).toLocaleString() : 'Recent'}
            </p>
          </section>
        </div>
      )}
    </div>
  )
}
