/**
 * Single source of truth for laundry order statuses (DB values).
 *
 * Flow (strict, one step at a time):
 * Pending → Accepted → Washing → Drying → Ready for Pickup → Completed,
 * plus Cancelled from any open step.
 */
export const LAUNDRY_STATUS_FLOW = [
  'Pending',
  'Accepted',
  'Washing',
  'Drying',
  'Ready for Pickup',
  'Completed',
]

export const LAUNDRY_STATUSES = [...LAUNDRY_STATUS_FLOW, 'Cancelled']

export const LAUNDRY_STATUS_LABELS = {
  Pending: 'Pending',
  Accepted: 'Accepted',
  Washing: 'Washing',
  Drying: 'Drying',
  'Ready for Pickup': 'Ready for Pickup',
  Completed: 'Completed',
  Cancelled: 'Cancelled',
}

export const laundryStatusLabel = (status) =>
  LAUNDRY_STATUS_LABELS[status] || status

export const isTerminalLaundryStatus = (status) =>
  status === 'Completed' || status === 'Cancelled'
