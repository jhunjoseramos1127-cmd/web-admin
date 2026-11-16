import { useCallback, useEffect, useState } from 'react'
import { Award, Gift, History, LoaderCircle, Search, Sparkles, UserRound } from 'lucide-react'
import api from '../api/client'

const EMPTY_DATA = {
  metrics: { total_members: 0, total_stamps_earned: 0, total_rewards_redeemed: 0 },
  rewards: [],
  customers: [],
}

function getErrorMessage(error) {
  return error.response?.data?.message || error.message || 'Unable to load loyalty data.'
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

export default function LoyaltyView({ showToast }) {
  const [data, setData] = useState(EMPTY_DATA)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [stamps, setStamps] = useState('')
  const [reason, setReason] = useState('')

  const loadSummary = useCallback(async (showSpinner = true) => {
    if (showSpinner) {
      setLoading(true)
      setError('')
    }
    try {
      const response = await api.get('/api/loyalty')
      setData(response.data?.data || EMPTY_DATA)
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadSummary(false) }, [loadSummary])

  const openCustomer = async (customer) => {
    setSelected(customer)
    setDetail(null)
    setDetailLoading(true)
    try {
      const response = await api.get(`/api/loyalty/customers/${customer.id}`)
      setDetail(response.data?.data || null)
    } catch (requestError) {
      showToast(getErrorMessage(requestError), 'error')
    } finally {
      setDetailLoading(false)
    }
  }

  const submitAdjustment = async (event) => {
    event.preventDefault()
    if (!selected) return
    setSaving(true)
    try {
      await api.post(`/api/loyalty/customers/${selected.id}/adjustments`, {
        stamps: Number(stamps),
        reason: reason.trim(),
      })
      showToast('Stamp balance updated.')
      setStamps('')
      setReason('')
      await Promise.all([loadSummary(), openCustomer(selected)])
    } catch (requestError) {
      showToast(getErrorMessage(requestError), 'error')
    } finally {
      setSaving(false)
    }
  }

  const redeemReward = async (reward) => {
    if (!selected) return
    setSaving(true)
    try {
      await api.post(`/api/loyalty/customers/${selected.id}/redeem`, { reward_id: reward.id })
      showToast(`${reward.name} redeemed successfully.`)
      await Promise.all([loadSummary(), openCustomer(selected)])
    } catch (requestError) {
      showToast(getErrorMessage(requestError), 'error')
    } finally {
      setSaving(false)
    }
  }

  const customers = data.customers.filter((customer) => {
    const query = search.trim().toLowerCase()
    return !query || [
      customer.full_name,
      customer.phone,
      customer.email,
      customer.customer_code,
    ].some((value) => String(value || '').toLowerCase().includes(query))
  })

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-700">Customer rewards</p>
          <h1 className="mt-1 text-2xl font-extrabold text-navy">Loyalty &amp; Rewards</h1>
          <p className="mt-1 text-sm text-ink-secondary">Manage Wash Stamps and Free Dryer Cycle redemptions.</p>
        </div>
        <button onClick={loadSummary} className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold text-navy hover:bg-brand-tint">
          Refresh
        </button>
      </header>

      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Registered members', value: data.metrics.total_members, icon: UserRound },
          { label: 'Stamps earned', value: data.metrics.total_stamps_earned, icon: Award },
          { label: 'Rewards redeemed', value: data.metrics.total_rewards_redeemed, icon: Gift },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-line bg-white p-4 shadow-card">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-ink-secondary">{label}</span>
              <Icon className="h-5 w-5 text-sky-600" />
            </div>
            <p className="mt-2 text-3xl font-extrabold text-navy">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-line bg-white p-4 shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-bold text-navy">Loyalty members</h2>
            <p className="text-xs text-ink-secondary">Select a registered customer to view history or manage stamps.</p>
          </div>
          <label className="relative block w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-secondary" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, phone, email" className="w-full rounded-xl border border-line py-2 pl-9 pr-3 text-sm outline-none focus:border-sky-500" />
          </label>
        </div>
        {loading ? (
          <div className="flex justify-center py-12"><LoaderCircle className="h-6 w-6 animate-spin text-sky-600" /></div>
        ) : customers.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-secondary">No loyalty members found.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="border-b border-line text-xs uppercase text-ink-secondary">
                <tr><th className="px-3 py-3">Customer</th><th className="px-3 py-3">Contact</th><th className="px-3 py-3">Stamps</th><th className="px-3 py-3">Available rewards</th><th className="px-3 py-3">Redeemed</th><th className="px-3 py-3">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {customers.map((customer) => (
                  <tr key={customer.id} onClick={() => openCustomer(customer)} className="cursor-pointer hover:bg-brand-tint/60">
                    <td className="px-3 py-3 font-bold text-navy">{customer.full_name || `${customer.first_name} ${customer.last_name}`}<div className="text-xs font-normal text-ink-secondary">{customer.customer_code}</div></td>
                    <td className="px-3 py-3 text-ink-secondary">{customer.phone}<div className="text-xs">{customer.email}</div></td>
                    <td className="px-3 py-3 font-bold">{customer.progress_stamps}/5 ({customer.stamp_balance} total)</td>
                    <td className="px-3 py-3">{customer.available_rewards}</td>
                    <td className="px-3 py-3">{customer.redemptions_count}</td>
                    <td className="px-3 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${customer.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{customer.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-navy/50 p-0 sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null) }}>
          <section role="dialog" aria-modal="true" aria-label={`${selected.full_name} loyalty details`} className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-bold uppercase tracking-wider text-sky-700">Loyalty profile</p><h2 className="mt-1 text-xl font-extrabold text-navy">{selected.full_name}</h2><p className="text-sm text-ink-secondary">{selected.phone} · {selected.email}</p></div>
              <button onClick={() => setSelected(null)} className="rounded-lg px-3 py-1 text-sm font-bold text-ink-secondary hover:bg-slate-100">Close</button>
            </div>
            {detailLoading ? <div className="flex justify-center py-10"><LoaderCircle className="h-6 w-6 animate-spin text-sky-600" /></div> : detail && (
              <div className="mt-5 space-y-5">
                <div className="rounded-2xl bg-gradient-to-r from-navy to-sky-700 p-5 text-white">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white/80"><Award className="h-5 w-5" /> Wash Stamps</div>
                  <p className="mt-2 text-3xl font-extrabold">{detail.loyalty_account.stamp_balance} total stamps</p>
                  <p className="mt-1 text-sm text-white/80">{detail.loyalty_account.progress_stamps}/5 toward next reward · {detail.loyalty_account.available_rewards} available</p>
                  <div className="mt-4 flex gap-2">{Array.from({ length: 5 }, (_, index) => <span key={index} className={`grid h-9 w-9 place-items-center rounded-full border-2 ${index < detail.loyalty_account.progress_stamps ? 'border-white bg-white text-sky-700' : 'border-white/50 text-white/40'}`}><Sparkles className="h-4 w-4" /></span>)}</div>
                </div>

                <form onSubmit={submitAdjustment} className="grid gap-3 rounded-xl border border-line p-4 sm:grid-cols-[1fr_2fr_auto]">
                  <label className="text-xs font-bold text-ink-secondary">Add or deduct stamps<input required type="number" min="-1000" max="1000" step="1" value={stamps} onChange={(event) => setStamps(event.target.value)} placeholder="e.g. 1 or -1" className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-navy" /></label>
                  <label className="text-xs font-bold text-ink-secondary">Required reason<input required maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason for adjustment" className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-navy" /></label>
                  <button disabled={saving} className="self-end rounded-lg bg-navy px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Apply</button>
                </form>

                <div>
                  <h3 className="mb-2 flex items-center gap-2 font-bold text-navy"><Gift className="h-4 w-4" /> Available rewards</h3>
                  <div className="grid gap-2 sm:grid-cols-2">{detail.rewards.map((reward) => (
                    <div key={reward.id} className="flex items-center justify-between gap-3 rounded-xl border border-line p-3">
                      <div><p className="font-bold text-navy">{reward.name}</p><p className="text-xs text-ink-secondary">{reward.stamps_required} stamps</p></div>
                      <button disabled={saving || detail.loyalty_account.stamp_balance < reward.stamps_required} onClick={() => redeemReward(reward)} className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">Redeem</button>
                    </div>
                  ))}</div>
                </div>

                <div>
                  <h3 className="mb-2 flex items-center gap-2 font-bold text-navy"><History className="h-4 w-4" /> Transaction history</h3>
                  {detail.transactions.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-ink-secondary">No loyalty transactions yet.</p> : (
                    <div className="max-h-64 divide-y divide-line overflow-y-auto rounded-xl border border-line">
                      {detail.transactions.map((transaction) => <div key={transaction.id} className="flex items-start justify-between gap-3 p-3 text-sm">
                        <div><p className="font-semibold text-navy">{transaction.reason}</p><p className="text-xs text-ink-secondary">{formatDate(transaction.created_at)}{transaction.performer?.name ? ` · ${transaction.performer.name}` : ''}{transaction.order?.order_number ? ` · ${transaction.order.order_number}` : ''}</p></div>
                        <span className={`font-extrabold ${transaction.stamps > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{transaction.stamps > 0 ? '+' : ''}{transaction.stamps}</span>
                      </div>)}
                    </div>
                  )}
                </div>
                {detail.redemptions.length > 0 && <div><h3 className="mb-2 font-bold text-navy">Redemption history</h3><div className="divide-y divide-line rounded-xl border border-line">{detail.redemptions.map((redemption) => <div key={redemption.id} className="flex justify-between gap-3 p-3 text-sm"><div><p className="font-semibold">{redemption.reward?.name}</p><p className="text-xs text-ink-secondary">{formatDate(redemption.redeemed_at)} · Processed by {redemption.processor?.name || 'Staff'}</p></div><span className="text-ink-secondary">−{redemption.stamps_spent} stamps</span></div>)}</div></div>}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
