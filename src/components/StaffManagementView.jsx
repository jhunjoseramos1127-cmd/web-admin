import { useState, useEffect, useRef } from 'react'
import api from '../api/client'
import {
  Users, UserPlus, X, Archive, Edit3, RefreshCw, Eye, Phone
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import ExpandableSearch from './ExpandableSearch'
import { ConfirmDialog, PaginationControls } from './shared'

export default function StaffManagementView({ showToast }) {
  const { user: currentUser } = useAuth()
  const [staffList, setStaffList] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [showArchived, setShowArchived] = useState(false)
  const [archivingUser, setArchivingUser] = useState(null)
  const [restoringUser, setRestoringUser] = useState(null)
  const [selectedStaffDetails, setSelectedStaffDetails] = useState(null)
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('All')
  const [page, setPage] = useState(1)
  const [inactivePage, setInactivePage] = useState(1)
  const [formBusy, setFormBusy] = useState(false)
  const [accountActionBusy, setAccountActionBusy] = useState(false)
  const [detailsLoadingId, setDetailsLoadingId] = useState(null)
  const formInFlight = useRef(false)
  const accountActionInFlight = useRef(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState(null)

  // Form State
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('staff')
  const pageSize = 10

  const fetchStaff = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await api.get('/api/staff')
      if (!Array.isArray(res.data?.data)) throw new Error(res.data?.message || 'The server returned an invalid staff list.')
      setStaffList(res.data.data)
    } catch (err) {
      setLoadError(err.response?.data?.message || 'Unable to load staff. Check your connection and retry.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStaff()
  }, [])

  const handleCreateStaff = async (e) => {
    e.preventDefault()
    if (formInFlight.current) return
    if (!name.trim() || !email.trim() || !password) {
      showToast('Please fill all required fields', 'error')
      return
    }

    formInFlight.current = true
    setFormBusy(true)
    try {
      const res = await api.post('/api/staff', {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        password,
        role
      })

      if (res?.data?.success) {
        showToast(`Staff member "${name}" created successfully!`)
        await fetchStaff()
      } else {
        showToast(res?.data?.message || 'Failed to create staff member', 'error')
        return
      }

      setIsAddModalOpen(false)
      setName('')
      setEmail('')
      setPhone('')
      setPassword('')
      setRole('staff')
    } catch (err) {
      showToast(err.response?.data?.message || 'Error saving staff member', 'error')
    } finally {
      formInFlight.current = false
      setFormBusy(false)
    }
  }

  const handleUpdateStaff = async (e) => {
    e.preventDefault()
    if (!selectedStaff || formInFlight.current) return

    formInFlight.current = true
    setFormBusy(true)
    try {
      const payload = {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        role
      }
      if (password.trim()) {
        payload.password = password.trim()
      }
      const res = await api.put(`/api/staff/${selectedStaff.id}`, payload)

      if (res?.data?.success) {
        showToast(`Staff member "${name}" updated successfully!`)
        await fetchStaff()
      } else {
        showToast(res?.data?.message || 'Failed to update staff member', 'error')
        return
      }

      setIsEditModalOpen(false)
      setSelectedStaff(null)
    } catch (err) {
      showToast(err.response?.data?.message || 'Error updating staff member', 'error')
    } finally {
      formInFlight.current = false
      setFormBusy(false)
    }
  }

  const handleArchiveStaff = async () => {
    if (!archivingUser || accountActionInFlight.current) return
    accountActionInFlight.current = true
    setAccountActionBusy(true)
    try {
      const res = await api.post(`/api/staff/${archivingUser.id}/archive`)
      showToast(res.data?.message || `${archivingUser.name} deactivated.`)
      setArchivingUser(null)
      await fetchStaff()
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to deactivate account.', 'error')
    } finally {
      accountActionInFlight.current = false
      setAccountActionBusy(false)
    }
  }

  const handleRestoreStaff = async () => {
    if (!restoringUser || accountActionInFlight.current) return
    accountActionInFlight.current = true
    setAccountActionBusy(true)
    try {
      const res = await api.post(`/api/staff/${restoringUser.id}/restore`)
      showToast(res.data?.message || `${restoringUser.name} activated.`)
      setRestoringUser(null)
      await fetchStaff()
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to activate account.', 'error')
    } finally {
      accountActionInFlight.current = false
      setAccountActionBusy(false)
    }
  }

  const matchingStaff = staffList.filter(staff => {
    const matchesSearch = !query.trim() || [staff.name, staff.email, staff.phone].some(value => value?.toLowerCase().includes(query.trim().toLowerCase()))
    const matchesRole = roleFilter === 'All' || staff.role === roleFilter
    return matchesSearch && matchesRole
  })
  const activeStaff = matchingStaff.filter(staff => staff.status !== 'inactive')
  const archivedStaff = matchingStaff.filter(staff => staff.status === 'inactive')
  const activePageCount = Math.max(1, Math.ceil(activeStaff.length / pageSize))
  const inactivePageCount = Math.max(1, Math.ceil(archivedStaff.length / pageSize))
  const visibleActiveStaff = activeStaff.slice((page - 1) * pageSize, page * pageSize)
  const visibleInactiveStaff = archivedStaff.slice((inactivePage - 1) * pageSize, inactivePage * pageSize)

  const openEditModal = (staff) => {
    setSelectedStaff(staff)
    setName(staff.name)
    setEmail(staff.email)
    setPhone(staff.phone || '')
    setPassword('')
    setRole(staff.role)
    setIsEditModalOpen(true)
  }

  const openStaffDetails = async (staff) => {
    if (detailsLoadingId !== null) return
    setDetailsLoadingId(staff.id)
    try {
      const res = await api.get(`/api/staff/${staff.id}`)
      if (!res?.data?.data) throw new Error('The server did not return this staff member.')
      setSelectedStaffDetails(res.data.data)
    } catch (err) {
      showToast(err.response?.data?.message || 'Unable to load staff details.', 'error')
    } finally {
      setDetailsLoadingId(null)
    }
  }

  useEffect(() => {
    setPage(1)
    setInactivePage(1)
  }, [query, roleFilter])

  useEffect(() => {
    setPage(current => Math.min(current, activePageCount))
    setInactivePage(current => Math.min(current, inactivePageCount))
  }, [activePageCount, inactivePageCount])

  const renderRoleBadge = (r) => {
    const map = {
      admin: 'bg-navy text-white border-navy',
      staff: 'bg-brand-tintstrong text-navy border-brand-light',
      cashier: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
    }
    return (
      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border uppercase tracking-wider ${map[r?.toLowerCase()] || 'bg-brand-tintstrong text-navy'}`}>
        {r?.toLowerCase() === 'staff' ? 'Laundry Staff' : r}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header & Action Button */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-line">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-navy shrink-0" />
            <h2 className="text-xl font-bold text-navy break-words">Laundry Staff & Cashier Management</h2>
          </div>
          <p className="text-xs text-ink-secondary mt-1">
            Manage system access, assign roles (Admin, Laundry Staff, Cashier), and configure permissions.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={fetchStaff}
            disabled={loading}
            className="p-2.5 rounded-xl bg-brand-tint hover:bg-brand-tintstrong border border-line text-navy transition"
            title="Refresh Staff"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-navy' : ''}`} />
          </button>

          <button
            onClick={() => {
              setName('')
              setEmail('')
              setPhone('')
              setPassword('')
              setRole('staff')
              setIsAddModalOpen(true)
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-navy hover:bg-navy-hover text-white font-semibold text-xs shadow-card transition"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add New Staff</span>
          </button>
        </div>
      </div>

      {/* Staff Table */}
      <div className="bg-white rounded-2xl border border-line shadow-xl overflow-hidden">
        <div className="p-4 border-b border-line space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-bold text-navy">Active Personnel Directory ({activeStaff.length})</h3>
            <button
              type="button"
              onClick={() => setShowArchived(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-brand-tintstrong hover:bg-brand-light border border-brand-light text-navy text-xs font-bold transition"
              aria-label="View inactive staff accounts"
            >
              <Archive className="w-4 h-4" />
              <span>Inactive Accounts ({archivedStaff.length})</span>
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_180px]">
            <ExpandableSearch value={query} onChange={setQuery} placeholder="Search name, email, or phone..." ariaLabel="Search staff" />
            <select value={roleFilter} onChange={event => setRoleFilter(event.target.value)} aria-label="Filter staff by role" className="rounded-xl border border-line bg-white px-3 py-2 text-xs text-navy">
              <option value="All">All staff roles</option>
              <option value="admin">Administrator</option>
              <option value="staff">Laundry Staff</option>
              <option value="cashier">Cashier</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-xs text-navy">
            <thead className="bg-brand-tint uppercase text-[11px] font-bold text-ink-secondary border-b border-line">
              <tr>
                <th className="py-3.5 px-4">Staff Name</th>
                <th className="py-3.5 px-4">Email</th>
                <th className="py-3.5 px-4">Contact</th>
                <th className="py-3.5 px-4">Role / Status</th>
                <th className="py-3.5 px-4">Created Date</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {loading && staffList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-ink-secondary text-xs">
                    Loading staff…
                  </td>
                </tr>
              ) : loadError && staffList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center space-y-2">
                    <p className="text-xs font-bold text-navy">Unable to load staff</p>
                    <p className="text-xs text-ink-secondary">{loadError}</p>
                    <button
                      onClick={fetchStaff}
                      className="px-4 py-2 rounded-xl bg-navy hover:bg-navy-hover text-white text-xs font-bold transition"
                    >
                      Retry
                    </button>
                  </td>
                </tr>
              ) : (
              <>
              {visibleActiveStaff.map((staff) => (
                <tr key={staff.id} className="hover:bg-brand-tint transition">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-tintstrong border border-brand-light flex items-center justify-center font-bold text-navy">
                        {staff.name?.charAt(0) || 'U'}
                      </div>
                      <div>
                        <div className="font-semibold text-navy break-words">{staff.name}</div>
                        <div className="text-[11px] text-ink-secondary">FreshSpin Team</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-navy break-all">
                    {staff.email}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1.5 text-ink-secondary"><Phone className="h-3.5 w-3.5" />{staff.phone || '—'}</span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex flex-col items-start gap-1.5">{renderRoleBadge(staff.role)}<span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Active</span></div>
                  </td>
                  <td className="py-3.5 px-4 text-ink-secondary">
                    {staff.created_at ? new Date(staff.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button type="button" onClick={() => openStaffDetails(staff)} disabled={detailsLoadingId !== null} className="p-1.5 rounded-lg bg-brand-tint hover:bg-brand-tintstrong text-navy disabled:opacity-50" title="View Staff" aria-label={`View ${staff.name}`}>{detailsLoadingId === staff.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}</button>
                      <button
                        onClick={() => openEditModal(staff)}
                        className="p-1.5 rounded-lg bg-brand-tint hover:bg-brand-tintstrong text-navy hover:text-navy transition"
                        title="Edit Staff"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-navy" />
                      </button>
                      {staff.role !== 'admin' && staff.id !== currentUser?.id ? (
                        <button
                          onClick={() => setArchivingUser(staff)}
                          className="p-1.5 rounded-lg bg-brand-tint hover:bg-danger-tint text-ink-secondary hover:text-rose-400 transition"
                          title="Deactivate Staff Account"
                          aria-label={`Deactivate ${staff.name}`}
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {activeStaff.length === 0 && !loading && !loadError && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-ink-secondary">
                    {query || roleFilter !== 'All' ? 'No staff match these filters.' : 'No active staff accounts are registered. Click "Add New Staff" to create one.'}
                  </td>
                </tr>
              )}
              </>
              )}
            </tbody>
          </table>
        </div>
        <PaginationControls page={page} pageSize={pageSize} totalItems={activeStaff.length} onPageChange={nextPage => setPage(Math.max(1, Math.min(nextPage, activePageCount)))} />
      </div>

      {showArchived && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 backdrop-blur-sm p-4" role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="inactive-staff-title"
            className="bg-white border border-line rounded-2xl w-full max-w-5xl max-h-[85vh] shadow-pop flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between p-5 border-b border-line">
              <div>
                <h3 id="inactive-staff-title" className="text-lg font-bold text-navy">Inactive Staff Accounts ({archivedStaff.length})</h3>
                <p className="text-xs text-ink-secondary mt-1">Activate inactive staff and cashier accounts without losing their history.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowArchived(false)}
                className="p-2 rounded-xl text-ink-secondary hover:text-navy hover:bg-brand-tint transition"
                aria-label="Close inactive accounts"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-auto p-5">
              {archivedStaff.length === 0 ? (
                <div className="py-12 text-center text-sm text-ink-secondary">{query || roleFilter !== 'All' ? 'No inactive staff match these filters.' : 'No inactive staff accounts.'}</div>
              ) : (
                <>
                <table className="w-full min-w-[900px] text-left text-xs text-navy">
                  <thead className="bg-brand-tint uppercase text-[11px] font-bold text-ink-secondary">
                    <tr>
                      <th className="py-3 px-4 rounded-l-xl">Staff Name</th>
                      <th className="py-3 px-4">Email</th>
                      <th className="py-3 px-4">Contact</th>
                      <th className="py-3 px-4">Role / Status</th>
                      <th className="py-3 px-4">Created Date</th>
                      <th className="py-3 px-4">Deactivated Date</th>
                      <th className="py-3 px-4 text-right rounded-r-xl">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {visibleInactiveStaff.map((staff) => (
                      <tr key={staff.id} className="hover:bg-brand-tint/60 transition">
                        <td className="py-3 px-4 font-semibold">{staff.name}</td>
                        <td className="py-3 px-4 font-mono break-all">{staff.email}</td>
                        <td className="py-3 px-4">{staff.phone || '—'}</td>
                        <td className="py-3 px-4"><div className="flex flex-col items-start gap-1">{renderRoleBadge(staff.role)}<span className="rounded-full border border-line bg-brand-tint px-2 py-0.5 text-[10px] font-semibold text-ink-secondary">Inactive</span></div></td>
                        <td className="py-3 px-4 text-ink-secondary">
                          {staff.created_at ? new Date(staff.created_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-3 px-4 text-ink-secondary">
                          {staff.archived_at ? new Date(staff.archived_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setRestoringUser(staff)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 border border-emerald-500/30 font-bold transition"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Activate
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <PaginationControls page={inactivePage} pageSize={pageSize} totalItems={archivedStaff.length} onPageChange={nextPage => setInactivePage(Math.max(1, Math.min(nextPage, inactivePageCount)))} />
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedStaffDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg space-y-4 rounded-2xl border border-line bg-white p-6 shadow-pop">
            <div className="flex items-start justify-between gap-4 border-b border-line pb-3">
              <div>
                <h3 className="text-lg font-bold text-navy">{selectedStaffDetails.name}</h3>
                <p className="text-xs text-ink-secondary">Staff account · ID {selectedStaffDetails.id}</p>
              </div>
              <button type="button" onClick={() => setSelectedStaffDetails(null)} className="rounded-lg px-2 py-1 text-ink-secondary hover:bg-brand-tint" aria-label="Close staff details">✕</button>
            </div>
            <div className="grid grid-cols-1 gap-3 rounded-xl border border-line bg-brand-tint p-4 text-sm sm:grid-cols-2">
              <p><span className="text-ink-secondary">Email:</span> <strong className="text-navy">{selectedStaffDetails.email}</strong></p>
              <p><span className="text-ink-secondary">Contact:</span> <strong className="text-navy">{selectedStaffDetails.phone || '—'}</strong></p>
              <p><span className="text-ink-secondary">Role:</span> <strong className="text-navy">{selectedStaffDetails.role}</strong></p>
              <p><span className="text-ink-secondary">Status:</span> <strong className="text-navy">{selectedStaffDetails.status === 'inactive' ? 'Inactive' : 'Active'}</strong></p>
              <p><span className="text-ink-secondary">Registered:</span> <strong className="text-navy">{selectedStaffDetails.created_at ? new Date(selectedStaffDetails.created_at).toLocaleString() : '—'}</strong></p>
              {selectedStaffDetails.archived_at && <p><span className="text-ink-secondary">Deactivated:</span> <strong className="text-navy">{new Date(selectedStaffDetails.archived_at).toLocaleString()}</strong></p>}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Staff */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white border border-line rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="text-base font-bold text-navy flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-navy" />
                Add New Staff Member
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-ink-secondary hover:text-navy"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="space-y-4 text-xs">
              <div>
                <label className="block text-navy font-semibold mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Maria Santos"
                  className="w-full bg-brand-tint border border-line rounded-xl px-3 py-2 text-navy focus:outline-none focus:border-brand-light"
                />
              </div>

              <div>
                <label className="block text-navy font-semibold mb-1">Email / Username *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="staff@freshspin.ph"
                  className="w-full bg-brand-tint border border-line rounded-xl px-3 py-2 text-navy focus:outline-none focus:border-brand-light"
                />
              </div>

              <div>
                <label className="block text-navy font-semibold mb-1">Contact Number</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} placeholder="09XX-XXX-XXXX" className="w-full bg-brand-tint border border-line rounded-xl px-3 py-2 text-navy focus:outline-none focus:border-brand-light" />
              </div>

              <div>
                <label className="block text-navy font-semibold mb-1">Password *</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full bg-brand-tint border border-line rounded-xl px-3 py-2 text-navy focus:outline-none focus:border-brand-light"
                />
              </div>

              <div>
                <label className="block text-navy font-semibold mb-1">Access Role *</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-brand-tint border border-line rounded-xl px-3 py-2 text-navy focus:outline-none focus:border-brand-light"
                >
                  <option value="staff">Laundry Staff (Operations & Humidity Monitoring)</option>
                  <option value="cashier">Cashier (Walk-in Orders & Payments)</option>
                  <option value="admin">Administrator (Full Business Access)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={formBusy}
                  className="px-4 py-2 rounded-xl bg-brand-tint text-navy hover:text-navy"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formBusy}
                  className="px-4 py-2 rounded-xl bg-navy hover:bg-navy-hover text-white font-semibold shadow-card disabled:opacity-50"
                >
                  {formBusy ? 'Saving…' : 'Save Staff Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Staff */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white border border-line rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="text-base font-bold text-navy flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-navy" />
                Edit Staff Member
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                disabled={formBusy}
                className="text-ink-secondary hover:text-navy"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateStaff} className="space-y-4 text-xs">
              <div>
                <label className="block text-navy font-semibold mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-brand-tint border border-line rounded-xl px-3 py-2 text-navy focus:outline-none focus:border-brand-light"
                />
              </div>

              <div>
                <label className="block text-navy font-semibold mb-1">Email / Username *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-brand-tint border border-line rounded-xl px-3 py-2 text-navy focus:outline-none focus:border-brand-light"
                />
              </div>

              <div>
                <label className="block text-navy font-semibold mb-1">Contact Number</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} placeholder="09XX-XXX-XXXX" className="w-full bg-brand-tint border border-line rounded-xl px-3 py-2 text-navy focus:outline-none focus:border-brand-light" />
              </div>

              <div>
                <label className="block text-navy font-semibold mb-1">New Password (leave blank to keep current)</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full bg-brand-tint border border-line rounded-xl px-3 py-2 text-navy focus:outline-none focus:border-brand-light"
                />
              </div>

              <div>
                <label className="block text-navy font-semibold mb-1">Access Role *</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-brand-tint border border-line rounded-xl px-3 py-2 text-navy focus:outline-none focus:border-brand-light"
                >
                  <option value="staff">Laundry Staff (Operations & Humidity Monitoring)</option>
                  <option value="cashier">Cashier (Walk-in Orders & Payments)</option>
                  <option value="admin">Administrator (Full Business Access)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={formBusy}
                  className="px-4 py-2 rounded-xl bg-brand-tint text-navy hover:text-navy"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formBusy}
                  className="px-4 py-2 rounded-xl bg-navy hover:bg-navy-hover text-white font-semibold shadow-card disabled:opacity-50"
                >
                  {formBusy ? 'Saving…' : 'Update Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={!!archivingUser}
        title="Deactivate staff account"
        message={archivingUser ? `Deactivate ${archivingUser.name}? They will lose access to the Staff/Cashier app. Previous order and activity records will be preserved.` : ''}
        confirmLabel="Deactivate Account"
        danger
        busy={accountActionBusy}
        onConfirm={handleArchiveStaff}
        onCancel={() => setArchivingUser(null)}
      />
      <ConfirmDialog
        open={!!restoringUser}
        title="Activate staff account"
        message={restoringUser ? `Activate ${restoringUser.name}? They will be able to sign in again.` : ''}
        confirmLabel="Activate Account"
        busy={accountActionBusy}
        onConfirm={handleRestoreStaff}
        onCancel={() => setRestoringUser(null)}
      />
    </div>
  )
}
