import { useCallback, useEffect, useRef, useState } from 'react'
import { MessageCircle, RefreshCw, Send, CheckCircle2, Clock3 } from 'lucide-react'
import api from '../api/client'

const statusLabel = (status) => ({ open: 'Open', in_progress: 'In Progress', resolved: 'Resolved' }[status] || status)

export default function SupportInbox({ showToast, initialTicketId = null, onUnreadCountChange }) {
  const [tickets, setTickets] = useState([])
  const [supportAlerts, setSupportAlerts] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [selectedSupportAlertId, setSelectedSupportAlertId] = useState(null)
  const unreadCountRef = useRef(0)
  const selectedIdRef = useRef(null)
  const selectedSupportAlertIdRef = useRef(null)
  const readingTicketIds = useRef(new Set())
  const [reply, setReply] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const selected = tickets.find(ticket => ticket.id === selectedId)
  const selectedSupportAlert = supportAlerts.find(alert => alert.id === selectedSupportAlertId)

  const updateUnreadCount = useCallback((count) => {
    const nextCount = Math.max(0, Number(count) || 0)
    unreadCountRef.current = nextCount
    onUnreadCountChange?.(nextCount)
  }, [onUnreadCountChange])

  const markTicketAlertsRead = useCallback(async (ticket) => {
    const ids = ticket?.unread_alert_ids || []
    if (!ids.length || readingTicketIds.current.has(ticket.id)) return

    readingTicketIds.current.add(ticket.id)
    try {
      const results = await Promise.allSettled(ids.map(id => api.put(`/api/alerts/${id}/read`)))
      const markedIds = ids.filter((_, index) => results[index].status === 'fulfilled')
      if (!markedIds.length) return

      setTickets(prev => prev.map(item => item.id === ticket.id
        ? {
          ...item,
          unread_alert_ids: (item.unread_alert_ids || []).filter(id => !markedIds.includes(id)),
          unread_count: Math.max(0, (item.unread_count || 0) - markedIds.length),
        }
        : item))
      updateUnreadCount(unreadCountRef.current - markedIds.length)
    } finally {
      readingTicketIds.current.delete(ticket.id)
    }
  }, [updateUnreadCount])

  const selectTicket = useCallback(async (ticket) => {
    selectedIdRef.current = ticket.id
    selectedSupportAlertIdRef.current = null
    setSelectedId(ticket.id)
    setSelectedSupportAlertId(null)
    const res = await api.get(`/api/support/tickets/${ticket.id}`).catch(() => null)
    const currentTicket = res?.data?.data || ticket
    if (res?.data?.data) setTickets(prev => prev.map(item => item.id === currentTicket.id ? currentTicket : item))
    await markTicketAlertsRead(currentTicket)
  }, [markTicketAlertsRead])

  const selectSupportAlert = useCallback(async (alert) => {
    selectedIdRef.current = null
    selectedSupportAlertIdRef.current = alert.id
    setSelectedId(null)
    setSelectedSupportAlertId(alert.id)
    if (alert.is_read) return
    try {
      await api.put(`/api/alerts/${alert.id}/read`)
      setSupportAlerts(prev => prev.map(item => item.id === alert.id ? { ...item, is_read: true } : item))
      updateUnreadCount(unreadCountRef.current - 1)
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not mark support message as read', 'error')
    }
  }, [showToast, updateUnreadCount])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/api/support/tickets')
      const data = res.data?.data || []
      const alerts = res.data?.support_alerts || []
      setTickets(data)
      setSupportAlerts(alerts)
      const nextSelectedId = selectedSupportAlertIdRef.current !== null
        ? null
        : data.some(ticket => ticket.id === selectedIdRef.current) ? selectedIdRef.current : data[0]?.id ?? null
      selectedIdRef.current = nextSelectedId
      setSelectedId(nextSelectedId)
      const nextSelectedAlertId = nextSelectedId === null
        ? alerts.some(alert => alert.id === selectedSupportAlertIdRef.current)
          ? selectedSupportAlertIdRef.current
          : alerts[0]?.id ?? null
        : null
      selectedSupportAlertIdRef.current = nextSelectedAlertId
      setSelectedSupportAlertId(nextSelectedAlertId)
      const count = Number.isFinite(res.data?.support_unread_count)
        ? res.data.support_unread_count
        : data.reduce((total, ticket) => total + (ticket.unread_count || 0), 0) + alerts.filter(alert => !alert.is_read).length
      updateUnreadCount(count)
      const selectedTicket = data.find(ticket => ticket.id === nextSelectedId)
      if (selectedTicket?.unread_count > 0) void markTicketAlertsRead(selectedTicket)
      const selectedAlert = alerts.find(alert => alert.id === nextSelectedAlertId)
      if (!selectedTicket && selectedAlert && !selectedAlert.is_read) void selectSupportAlert(selectedAlert)
    } catch (err) {
      showToast(err.response?.data?.message || 'Unable to load support requests', 'error')
    } finally { setLoading(false) }
  }, [markTicketAlertsRead, selectSupportAlert, selectedIdRef, selectedSupportAlertIdRef, showToast, updateUnreadCount])

  useEffect(() => {
    refresh()
    const timer = window.setInterval(refresh, 20000)
    return () => window.clearInterval(timer)
  }, [refresh])

  useEffect(() => {
    if (initialTicketId) {
      selectedIdRef.current = Number(initialTicketId)
      selectedSupportAlertIdRef.current = null
      setSelectedId(Number(initialTicketId))
      setSelectedSupportAlertId(null)
    }
  }, [initialTicketId])

  const updateTicket = async (url, method, body) => {
    setBusy(true)
    try {
      const res = await api[method](url, body)
      const ticket = res.data?.data
      if (ticket) setTickets(prev => prev.map(item => item.id === ticket.id ? ticket : item))
      if (ticket && body?.status === 'resolved') {
        await markTicketAlertsRead({ ...ticket, unread_alert_ids: ticket.unread_alert_ids || selected?.unread_alert_ids || [] })
      }
      return ticket
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not update support request', 'error')
      return null
    } finally { setBusy(false) }
  }

  const sendReply = async (event) => {
    event.preventDefault()
    if (!selected || !reply.trim()) return
    const ticket = await updateTicket(`/api/support/tickets/${selected.id}/messages`, 'post', { message: reply.trim() })
    if (ticket) { setReply(''); showToast('Reply sent to customer') }
  }

  return <div className="space-y-5">
    <div className="flex items-center justify-between rounded-2xl border border-line bg-white p-5">
      <div><h2 className="flex items-center gap-2 text-xl font-bold text-navy"><MessageCircle className="h-5 w-5"/> Customer Support Inbox</h2><p className="mt-1 text-xs text-ink-secondary">Review customer requests, reply, and update their ticket status.</p></div>
      <button onClick={refresh} disabled={loading} className="rounded-xl border border-line bg-brand-tint p-2.5 text-navy" title="Refresh"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}/></button>
    </div>
    <div className="grid min-h-[520px] gap-4 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.5fr)]">
      <section className="space-y-2 rounded-2xl border border-line bg-white p-3">
        {tickets.map(ticket => <button key={`ticket-${ticket.id}`} onClick={() => selectTicket(ticket)} className={`w-full rounded-xl border p-3 text-left ${ticket.id === selectedId ? 'border-brand-light bg-brand-tint' : 'border-line hover:bg-brand-tint'}`}>
          <div className="flex items-start justify-between gap-2"><strong className="text-sm text-navy">{ticket.subject}</strong><span className="flex shrink-0 items-center gap-1.5"><span className="whitespace-nowrap rounded-full bg-brand-tintstrong px-2 py-1 text-[10px] font-bold text-navy">{statusLabel(ticket.status)}</span>{ticket.unread_count > 0 && <span className="min-w-5 rounded-full bg-brand-light px-1.5 py-1 text-center text-[10px] font-bold text-white">{ticket.unread_count}</span>}</span></div>
          <div className="mt-1 text-xs text-ink-secondary">{ticket.user?.name || 'Customer'} · {ticket.messages?.length || 0} messages</div>
          <p className="mt-2 line-clamp-2 text-xs text-ink-secondary">{ticket.messages?.at(-1)?.message || ''}</p>
        </button>)}
        {supportAlerts.map(alert => <button key={`alert-${alert.id}`} onClick={() => selectSupportAlert(alert)} className={`w-full rounded-xl border p-3 text-left ${alert.id === selectedSupportAlertId ? 'border-brand-light bg-brand-tint' : 'border-line hover:bg-brand-tint'}`}>
          <div className="flex items-start justify-between gap-2"><strong className="text-sm text-navy">{alert.title}</strong><span className="whitespace-nowrap rounded-full bg-brand-tintstrong px-2 py-1 text-[10px] font-bold text-navy">New</span></div>
          <div className="mt-1 text-xs text-ink-secondary">{alert.created_at ? new Date(alert.created_at).toLocaleString() : 'Recent'}</div>
          <p className="mt-2 line-clamp-2 text-xs text-ink-secondary">{alert.message}</p>
        </button>)}
        {!loading && tickets.length === 0 && supportAlerts.length === 0 && <div className="p-8 text-center text-sm text-ink-secondary">No customer support requests yet.</div>}
        {loading && <div className="p-8 text-center text-sm text-ink-secondary">Loading requests…</div>}
      </section>
      <section className="flex min-h-[520px] flex-col rounded-2xl border border-line bg-white p-4">
        {selectedSupportAlert ? <>
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-3"><div><h3 className="font-bold text-navy">{selectedSupportAlert.title}</h3><p className="text-xs text-ink-secondary">{selectedSupportAlert.created_at ? new Date(selectedSupportAlert.created_at).toLocaleString() : 'Recent'}</p></div>{!selectedSupportAlert.is_read && <span className="rounded-full bg-brand-tintstrong px-2.5 py-1 text-[10px] font-bold text-navy">Unread</span>}</div>
          <div className="flex-1 whitespace-pre-wrap py-4 text-sm leading-relaxed text-navy">{selectedSupportAlert.message}</div>
        </> : selected ? <>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3"><div><h3 className="font-bold text-navy">{selected.subject}</h3><p className="text-xs text-ink-secondary">{selected.user?.name} · {selected.user?.email}</p></div><select value={selected.status} disabled={busy} onChange={e => updateTicket(`/api/support/tickets/${selected.id}`, 'put', { status: e.target.value })} className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-navy"><option value="open">Open</option><option value="in_progress">In Progress</option><option value="resolved">Resolved</option></select></div>
          <div className="flex-1 space-y-3 overflow-y-auto py-4">{selected.messages?.map(message => { const fromStaff = message.sender?.role !== 'customer'; return <div key={message.id} className={`max-w-[85%] rounded-2xl px-4 py-3 ${fromStaff ? 'ml-auto bg-brand-tint text-navy' : 'bg-slate-100 text-slate-800'}`}><div className="mb-1 text-[10px] font-bold opacity-70">{message.sender?.name || 'Customer'} · {new Date(message.created_at).toLocaleString()}</div><p className="whitespace-pre-wrap text-sm">{message.message}</p></div>})}</div>
          {selected.status === 'resolved' ? <div className="flex items-center gap-2 border-t border-line pt-3 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4"/>This request is resolved.</div> : <form onSubmit={sendReply} className="flex gap-2 border-t border-line pt-3"><textarea value={reply} onChange={e => setReply(e.target.value)} maxLength={2000} rows={2} placeholder="Write a reply to the customer…" className="min-w-0 flex-1 resize-y rounded-xl border border-line p-3 text-sm outline-none focus:border-brand-light"/><button disabled={busy || !reply.trim()} className="self-end rounded-xl bg-navy p-3 text-white disabled:opacity-50" title="Send reply"><Send className="h-4 w-4"/></button></form>}
        </> : <div className="flex flex-1 flex-col items-center justify-center text-center text-sm text-ink-secondary"><Clock3 className="mb-2 h-8 w-8"/>Select a support request to view its conversation.</div>}
      </section>
    </div>
  </div>
}
