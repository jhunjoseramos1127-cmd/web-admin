const MAX_CURRENCY_AMOUNT = 999999999999.99

export const formatCurrency = (amount) => {
  const parsed = Number(amount)
  const safeAmount = Number.isFinite(parsed)
    ? Math.min(MAX_CURRENCY_AMOUNT, Math.max(0, parsed))
    : 0

  return `₱${safeAmount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  })}`
}

export default formatCurrency
