import React, { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../api/client'
import {
  Package, Plus, Filter, AlertTriangle, CheckCircle2,
  XCircle, ArrowDown, ArrowUp, RefreshCw, Trash2, Edit3, Layers, Box, Eye, Pencil
} from 'lucide-react'
import { PaginationControls } from './shared'
import ExpandableSearch from './ExpandableSearch'

const getInventoryImagePath = (name) => {
  const slug = String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `/images/laundry-products/${slug}.png`
}

const getLiquidSupplyProfile = (name = '', category = '') => {
  const product = `${name} ${category}`.toLowerCase()
  if (product.includes('powder') || product.includes('solid') || product.includes(' bar')
    || (product.includes('soap') && !product.includes('liquid'))) return null
  if (product.includes('concentrate')) return { category: 'Liquid Detergent', minimum: 1000, restock: 3000, maximum: 10000 }
  if (product.includes('color safe') || product.includes('color-safe')) return { category: 'Bleach', minimum: 2000, restock: 5000, maximum: 20000 }
  if (product.includes('stain remover')) return { category: 'Stain Remover', minimum: 1000, restock: 2000, maximum: 10000 }
  if (product.includes('conditioner') || product.includes('fabcon') || product.includes('softener')) return { category: 'Fabric Conditioner / Fabcon', minimum: 5000, restock: 10000, maximum: 40000 }
  if (product.includes('bleach')) return { category: 'Bleach', minimum: 2000, restock: 5000, maximum: 20000 }
  if (product.includes('liquid detergent')) return { category: 'Liquid Detergent', minimum: 5000, restock: 10000, maximum: 50000 }
  return null
}

const getExpectedSupplyUnit = (name = '', category = '') => {
  const product = `${name} ${category}`.toLowerCase()
  if (product.includes('powder') || product.includes('solid') || product.includes(' bar')
    || (product.includes('soap') && !product.includes('liquid'))) return 'kg'
  if (product.includes('liquid') || product.includes('solution') || product.includes('chemical')) return 'mL'
  if (getLiquidSupplyProfile(name, category)) return 'mL'
  return null
}

const isLiquidSupply = (item) => getLiquidSupplyProfile(item.name, item.category) !== null && String(item.unit).trim().toLowerCase() === 'ml'

export default function InventoryView({
  inventory: inventoryProp,
  loading: loadingProp,
  onRefresh: onRefreshProp,
  showToast,
  isAdmin = false,
}) {
  const [searchParams] = useSearchParams()
  const [items, setItems] = useState([])
  const [fetching, setFetching] = useState(false)
  const [fetchError, setFetchError] = useState(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditItemModalOpen, setIsEditItemModalOpen] = useState(false)
  const [isAddonEditModalOpen, setIsAddonEditModalOpen] = useState(false)
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [adjustType, setAdjustType] = useState('stock_in')
  const [adjustQty, setAdjustQty] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [overrideMaximum, setOverrideMaximum] = useState(false)
  const [savingAdjustment, setSavingAdjustment] = useState(false)
  const [savingItem, setSavingItem] = useState(false)
  const [transactionLoadingId, setTransactionLoadingId] = useState(null)
  const [addonItem, setAddonItem] = useState(null)
  const [addonPrice, setAddonPrice] = useState('0')
  const [addonUnit, setAddonUnit] = useState('portion')
  const [addonStockQuantity, setAddonStockQuantity] = useState('0')
  const [addonManualStatus, setAddonManualStatus] = useState('ACTIVE')
  const [usageRate, setUsageRate] = useState('0')
  const [maximumStock, setMaximumStock] = useState('50')
  const [restockLevel, setRestockLevel] = useState('12.5')
  const [minimumStock, setMinimumStock] = useState('0')
  const [highlightedProductId, setHighlightedProductId] = useState(null)
  const [selectedTransaction, setSelectedTransaction] = useState(null)
  const [page, setPage] = useState(1)
  const rowRefs = useRef({})
  const handledDeepLink = useRef('')
  const itemSaveInFlight = useRef(false)
  const pageSize = 10

  // New Item State
  const [newItemName, setNewItemName] = useState('')
  const [newItemCategory, setNewItemCategory] = useState('Detergent')
  const [newItemQuantity, setNewItemQuantity] = useState('')
  const [newItemUnit, setNewItemUnit] = useState('kg')
  const [newItemMinStock, setNewItemMinStock] = useState('')
  const [newItemMaxStock, setNewItemMaxStock] = useState('50')
  const [newItemRestockLevel, setNewItemRestockLevel] = useState('12.5')
  const [editItem, setEditItem] = useState(null)
  const [editItemName, setEditItemName] = useState('')
  const [editItemCategory, setEditItemCategory] = useState('')
  const [editItemMinimum, setEditItemMinimum] = useState('')
  const [editItemMaximum, setEditItemMaximum] = useState('')
  const [editItemRestock, setEditItemRestock] = useState('')

  const fetchItems = async () => {
    setFetching(true)
    setFetchError(null)
    try {
      const res = await api.get('/api/inventory')
      setItems(res.data?.data || [])
    } catch (err) {
      setFetchError(err.response?.data?.message || 'Unable to load inventory. Check your connection and retry.')
    } finally {
      setFetching(false)
    }
  }

  useEffect(() => {
    if (inventoryProp !== undefined) return undefined

    fetchItems()
    const refreshTimer = window.setInterval(fetchItems, 15000)
    const refreshOnFocus = () => fetchItems()
    window.addEventListener('focus', refreshOnFocus)

    return () => {
      window.clearInterval(refreshTimer)
      window.removeEventListener('focus', refreshOnFocus)
    }
  }, [])

  const inventory = inventoryProp ?? items
  const loading = loadingProp ?? fetching
  const refresh = () => {
    if (onRefreshProp) onRefreshProp()
    else fetchItems()
  }

  const inventoryStatus = (item) => {
    if (Number(item.quantity) <= 0) return 'OUT_OF_STOCK'
    if (Number(item.quantity) <= Number(item.minimum_stock)) return 'LOW_STOCK'
    return 'IN_STOCK'
  }

  useEffect(() => {
    const productId = Number(searchParams.get('product'))
    const transactionId = Number(searchParams.get('transaction')) || null
    const itemIndex = inventory.findIndex((item) => Number(item.id) === productId)
    if (!productId || itemIndex < 0) return
    const linkKey = `${productId}:${transactionId || ''}`
    if (handledDeepLink.current === linkKey) return
    handledDeepLink.current = linkKey
    setSearch('')
    setCategoryFilter('All')
    setStatusFilter('ALL')
    setHighlightedProductId(productId)
    if (transactionId) {
      api.get(`/api/inventory/${productId}`)
        .then((res) => {
          const transaction = (res.data?.data?.transactions || []).find((entry) => Number(entry.id) === transactionId)
          if (transaction) setSelectedTransaction({ history: res.data?.data?.transactions || [], item: inventory.find((entry) => Number(entry.id) === productId) })
        })
        .catch(() => showToast('Could not load the linked stock transaction.', 'error'))
    }
  }, [inventory, searchParams])

  useEffect(() => {
    if (
      highlightedProductId === null
      || search
      || categoryFilter !== 'All'
      || statusFilter !== 'ALL'
    ) return undefined

    const itemIndex = inventory.findIndex(
      (item) => Number(item.id) === highlightedProductId,
    )
    if (itemIndex < 0) return undefined

    const targetPage = Math.floor(itemIndex / pageSize) + 1
    if (page !== targetPage) setPage(targetPage)

    const timeout = window.setTimeout(
      () => rowRefs.current[highlightedProductId]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      }),
      200,
    )
    return () => window.clearTimeout(timeout)
  }, [highlightedProductId, inventory, search, categoryFilter, statusFilter, page])

  // Categories list
  const categories = [
    'All',
    'Liquid Supplies',
    ...new Set([
      'Detergent',
      'Powder Detergent',
      'Liquid Detergent',
      'Fabric Conditioner / Fabcon',
      'Bleach',
      'Stain Remover',
      'Fabric Softener',
      'Plastic Bags',
      'Laundry Supplies',
      'Other Supplies',
      ...inventory.map(item => item.category),
    ]),
  ]

  // Filtering
  const liquidInventory = inventory.filter(isLiquidSupply)
  const filteredItems = inventory.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) ||
                          item.category.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = categoryFilter === 'All' || (categoryFilter === 'Liquid Supplies' ? isLiquidSupply(item) : item.category === categoryFilter)
    const matchesStatus = statusFilter === 'ALL' || inventoryStatus(item) === statusFilter
    return matchesSearch && matchesCategory && matchesStatus
  })

  // Summary counts
  const totalCount = inventory.length
  const inStockCount = inventory.filter(item => inventoryStatus(item) === 'IN_STOCK').length
  const lowStockCount = inventory.filter(item => inventoryStatus(item) === 'LOW_STOCK').length
  const outOfStockCount = inventory.filter(item => inventoryStatus(item) === 'OUT_OF_STOCK').length
  const pageCount = Math.max(1, Math.ceil(filteredItems.length / pageSize))
  const visibleItems = filteredItems.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => {
    setPage(1)
  }, [search, categoryFilter, statusFilter])

  useEffect(() => {
    setPage(current => Math.min(current, pageCount))
  }, [pageCount])

  const defaultMaximum = (category, unit) => {
    const isLiquid = category.toLowerCase().includes('liquid')
    const normalizedUnit = unit.toLowerCase()
    if (['ml', 'milliliter', 'milliliters'].includes(normalizedUnit)) return 50000
    if (isLiquid) return ['ml', 'milliliter', 'milliliters'].includes(normalizedUnit) ? 50000 : 50
    if (category.toLowerCase().includes('powder')) return ['g', 'gram', 'grams'].includes(normalizedUnit) ? 50000 : 50
    return 50
  }

  const applyLiquidProfile = (name, category) => {
    const profile = getLiquidSupplyProfile(name, category)
    const expectedUnit = getExpectedSupplyUnit(name, category)
    setNewItemCategory(profile?.category || category)
    if (expectedUnit) setNewItemUnit(expectedUnit)
    if (profile) {
      setNewItemMinStock(String(profile.minimum))
      setNewItemRestockLevel(String(profile.restock))
      setNewItemMaxStock(String(profile.maximum))
    } else if (expectedUnit) {
      const maximum = defaultMaximum(category, expectedUnit)
      setNewItemMinStock('0')
      setNewItemMaxStock(String(maximum))
      setNewItemRestockLevel(String(maximum * 0.25))
    }
    return Boolean(profile || expectedUnit)
  }

  const handleOpenAdjust = (item, type = 'stock_in') => {
    setSelectedItem(item)
    setAdjustType(type)
    setAdjustQty(type === 'stock_in' && item.stock_state !== 'MAXIMUM_STOCK_REACHED'
      ? String(item.recommended_restock_quantity || '')
      : '')
    setAdjustReason(type === 'stock_in' ? 'Supplier restock' : 'Laundry supply usage')
    setOverrideMaximum(false)
    setIsAdjustModalOpen(true)
  }

  const handleOpenEditItem = (item) => {
    setEditItem(item)
    setEditItemName(item.name)
    setEditItemCategory(item.category)
    setEditItemMinimum(String(item.minimum_stock ?? 0))
    setEditItemMaximum(String(item.maximum_stock ?? 50))
    setEditItemRestock(String(item.restock_level ?? 12.5))
    setIsEditItemModalOpen(true)
  }

  const handleSaveItem = async (e) => {
    e.preventDefault()
    if (!editItem || itemSaveInFlight.current) return
    const minimum = Number(editItemMinimum)
    const maximum = Number(editItemMaximum)
    const restock = Number(editItemRestock)
    if (!editItemName.trim() || !editItemCategory.trim() || !Number.isFinite(minimum) || !Number.isFinite(maximum) || !Number.isFinite(restock)) {
      showToast('Enter valid item details and stock thresholds.', 'error')
      return
    }

    itemSaveInFlight.current = true
    setSavingItem(true)
    try {
      const res = await api.put(`/api/inventory/${editItem.id}`, {
        name: editItemName.trim(),
        category: editItemCategory.trim(),
        minimum_stock: minimum,
        maximum_stock: maximum,
        restock_level: restock,
      })
      if (!res.data?.success) throw new Error(res.data?.message || 'Failed to update inventory item.')
      showToast(`${editItemName.trim()} updated successfully.`)
      setIsEditItemModalOpen(false)
      setEditItem(null)
      await refresh()
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Failed to update inventory item.', 'error')
    } finally {
      itemSaveInFlight.current = false
      setSavingItem(false)
    }
  }

  const handleViewItem = async (item) => {
    if (transactionLoadingId !== null) return
    setTransactionLoadingId(item.id)
    try {
      const res = await api.get(`/api/inventory/${item.id}`)
      if (!Array.isArray(res.data?.data?.transactions)) throw new Error('The server did not return stock history.')
      setSelectedTransaction({ history: res.data.data.transactions, item: res.data.data })
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Unable to load stock history.', 'error')
    } finally {
      setTransactionLoadingId(null)
    }
  }

  const handleOpenAddonEdit = (item) => {
    setAddonItem(item)
    setAddonPrice(String(item.addon_price ?? 0))
    setAddonUnit(item.addon_unit || 'portion')
    setAddonStockQuantity(String(item.addon_stock_quantity ?? 0))
    setAddonManualStatus(item.addon_manual_status || 'ACTIVE')
    setUsageRate(String(item.usage_rate ?? 0))
    setMaximumStock(String(item.maximum_stock ?? 50))
    setRestockLevel(String(item.restock_level ?? 12.5))
    setMinimumStock(String(item.minimum_stock ?? 0))
    setIsAddonEditModalOpen(true)
  }

  const handleSaveAddonConfig = async (e) => {
    e.preventDefault()
    if (!addonItem || !addonUnit.trim() || Number(addonPrice) < 0 || Number(addonStockQuantity) < 0 || Number(usageRate) < 0) {
      showToast('Enter a valid add-on price, name, and stock amount.', 'error')
      return
    }
    try {
      await api.put(`/api/inventory/${addonItem.id}`, {
        addon_price: Number(addonPrice),
        addon_unit: addonUnit.trim(),
        addon_stock_quantity: Number(addonStockQuantity),
        addon_manual_status: addonManualStatus,
        usage_rate: Number(usageRate),
        maximum_stock: Number(maximumStock),
        restock_level: Number(restockLevel),
        minimum_stock: Number(minimumStock),
      })
      showToast(`Inventory and add-on settings saved for ${addonItem.name}.`)
      setIsAddonEditModalOpen(false)
      refresh()
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save add-on pricing.', 'error')
    }
  }

  const handleSaveAdjustment = async (e) => {
    e.preventDefault()
    if (savingAdjustment) return
    if (!selectedItem || !adjustQty || Number(adjustQty) <= 0) {
      showToast('Please enter a valid quantity.', 'error')
      return
    }
    if (!adjustReason.trim()) {
      showToast('Enter a reason for this stock movement.', 'error')
      return
    }

    setSavingAdjustment(true)
    try {
      const res = await api.post(`/api/inventory/${selectedItem.id}/stock`, {
        type: adjustType,
        quantity: Number(adjustQty),
        reason: adjustReason,
        unit: selectedItem.unit,
        override_maximum: overrideMaximum,
        idempotency_key: crypto.randomUUID(),
      })
      if (!res.data?.success) throw new Error(res.data?.message || 'Failed to adjust stock.')
      showToast(`Stock updated: ${adjustType === 'stock_in' ? '+' : '-'}${adjustQty} ${selectedItem.unit} for ${selectedItem.name}`)
      setIsAdjustModalOpen(false)
      refresh()
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to adjust stock', 'error')
    } finally {
      setSavingAdjustment(false)
    }
  }

  const handleCreateItem = async (e) => {
    e.preventDefault()
    if (itemSaveInFlight.current) return
    if (!newItemName.trim() || newItemQuantity === '' || newItemMinStock === '') {
      showToast('Please fill out all required fields.', 'error')
      return
    }

    itemSaveInFlight.current = true
    setSavingItem(true)
    try {
      const res = await api.post('/api/inventory', {
        name: newItemName.trim(),
        category: newItemCategory,
        quantity: Number(newItemQuantity),
        unit: newItemUnit,
        minimum_stock: Number(newItemMinStock),
        maximum_stock: Number(newItemMaxStock),
        restock_level: Number(newItemRestockLevel),
        idempotency_key: crypto.randomUUID(),
        reason: 'Initial stock',
        addon_price: Number(addonPrice),
        addon_unit: addonUnit.trim() || 'portion',
        addon_stock_quantity: Number(addonStockQuantity),
      })
      if (!res.data?.success) throw new Error(res.data?.message || 'Failed to create inventory item.')
      showToast(`Item "${newItemName.trim()}" added to inventory!`)
      setIsAddModalOpen(false)
      setNewItemName('')
      setNewItemQuantity('')
      setNewItemMinStock('')
      setNewItemMaxStock('50')
      setNewItemRestockLevel('12.5')
      setAddonPrice('0')
      setAddonUnit('portion')
      setAddonStockQuantity('0')
      refresh()
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Failed to create inventory item', 'error')
    } finally {
      itemSaveInFlight.current = false
      setSavingItem(false)
    }
  }

  const handleDeleteItem = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete ${name}?`)) return
    try {
      const res = await api.delete(`/api/inventory/${id}`)
      if (!res.data?.success) throw new Error(res.data?.message || 'Failed to delete inventory item.')
      showToast(`Deleted ${name}`)
      refresh()
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Failed to delete item', 'error')
    }
  }

  return (
    <div className="space-y-4">
      {/* Header and Add Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-navy">Laundry Supplies & Inventory</h2>
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Live Stock Tracking
            </span>
          </div>
          <p className="text-xs text-ink-secondary">Monitor detergent, softener, packaging bags, and laundry supply levels</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            disabled={loading}
            className="p-2.5 rounded-xl bg-brand-tint hover:bg-brand-tintstrong border border-line text-navy hover:text-navy transition"
            title="Refresh Inventory"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-navy' : ''}`} />
          </button>
          {isAdmin && <button
            onClick={() => {
              setAddonPrice('0')
              setAddonUnit('portion')
              setAddonStockQuantity('0')
              setIsAddModalOpen(true)
            }}
            className="px-4 py-2.5 rounded-xl bg-navy hover:bg-navy-hover text-white font-bold text-sm shadow-card flex items-center gap-2 transition"
          >
            <Plus className="w-4 h-4" />
            Add Supply Item
          </button>}
        </div>
      </div>

      {/* Metrics Summary Grid */}
      <div className="fs-admin-card-grid grid grid-cols-2 xl:grid-cols-4 gap-2.5">
          {[
            { label: 'Inventory Items', value: totalCount, color: 'text-navy', icon: Layers },
            { label: 'In Stock', value: inStockCount, color: 'text-emerald-700', icon: CheckCircle2 },
            { label: 'Low Stock', value: lowStockCount, color: 'text-amber-700', icon: AlertTriangle },
            { label: 'Out of Stock', value: outOfStockCount, color: 'text-rose-700', icon: XCircle },
        ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} className="fs-admin-card flex h-full min-h-[88px] flex-col rounded-xl border border-line bg-white p-3">
            <div className="flex min-h-8 items-start justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider leading-tight text-ink-secondary">{label}</span>
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
            <div className={`mt-auto pt-1.5 text-xl font-black leading-none ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 rounded-xl bg-white border border-line flex flex-col sm:flex-row items-center justify-between gap-2.5">
        <ExpandableSearch className="w-full sm:max-w-80" value={search} onChange={setSearch} placeholder="Search supplies, category..." ariaLabel="Search inventory" />

        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto no-scrollbar">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-xl bg-white border border-line text-xs text-navy">
            <option value="ALL">All statuses</option>
            <option value="IN_STOCK">In Stock</option>
            <option value="LOW_STOCK">Low Stock</option>
            <option value="OUT_OF_STOCK">Out of Stock</option>
          </select>
          <Filter className="w-4 h-4 text-ink-secondary" />
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                categoryFilter === cat
                  ? 'bg-brand-light text-navy font-black'
                  : 'bg-white text-navy hover:text-navy border border-line'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Inventory Items Table */}
      {loading && inventory.length === 0 ? (
        <div className="p-6 rounded-2xl bg-white border border-line space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-12 rounded-xl bg-brand-tint animate-pulse" />
          ))}
          <p className="text-center text-xs text-ink-secondary">Loading inventory…</p>
        </div>
      ) : fetchError && inventory.length === 0 ? (
        <div className="p-12 rounded-2xl bg-white border border-line text-center space-y-3">
          <p className="text-sm font-bold text-navy">Unable to load inventory</p>
          <p className="text-xs text-ink-secondary">{fetchError}</p>
          <button
            onClick={refresh}
            className="px-4 py-2 rounded-xl bg-navy hover:bg-navy-hover text-white text-xs font-bold transition"
          >
            Retry
          </button>
        </div>
      ) : (
      <div className="p-3 rounded-lg bg-white border border-line overflow-hidden">
        <div className="w-full">
          <table className="w-full table-fixed text-left text-[12px]">
            <thead className="bg-brand-tint text-ink-secondary text-[12px] uppercase font-semibold">
              <tr>
                <th className="w-[20%] rounded-l-xl px-2 py-2.5">Item Name</th>
                <th className="w-[10%] px-2 py-2.5">Category</th>
                <th className="w-[13%] px-2 py-2.5">Current Stock{categoryFilter === 'Liquid Supplies' ? ' (mL)' : ''}</th>
                <th className="w-[12%] px-2 py-2.5">Status</th>
                <th className="w-[9%] px-2 py-2.5">Low-stock threshold{categoryFilter === 'Liquid Supplies' ? ' (mL)' : ''}</th>
                <th className="w-[12%] px-2 py-2.5">Restock Level{categoryFilter === 'Liquid Supplies' ? ' (mL)' : ''}</th>
                <th className="w-[9%] px-2 py-2.5">Maximum{categoryFilter === 'Liquid Supplies' ? ' (mL)' : ''}</th>
                <th className="w-[15%] rounded-r-xl px-2 py-2.5 text-right">Quick Stock Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-ink-secondary">
                    No laundry supplies found matching criteria.
                  </td>
                </tr>
              ) : (
                visibleItems.map(item => {
                  const pct = Math.min(100, Math.round((item.quantity / Math.max(1, item.maximum_stock || 50)) * 100))
                  const state = inventoryStatus(item)
                  const stateLabel = { IN_STOCK: 'In Stock', LOW_STOCK: 'Low Stock', OUT_OF_STOCK: 'Out of Stock' }[state]
                  const statusClass = {
                    IN_STOCK: 'border-emerald-300 bg-emerald-50 text-emerald-700',
                    LOW_STOCK: 'border-amber-300 bg-amber-50 text-amber-700',
                    OUT_OF_STOCK: 'border-rose-300 bg-rose-50 text-rose-700',
                  }[state]

                  return (
                    <tr
                      key={item.id}
                      ref={(node) => { rowRefs.current[item.id] = node }}
                      className={`transition hover:bg-brand-tint ${
                        highlightedProductId === Number(item.id)
                          ? 'bg-brand-light/30 outline outline-2 outline-brand-light outline-offset-[-2px]'
                          : ''
                      }`}
                    >
                      <td className="px-2 py-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <img
                            src={getInventoryImagePath(item.name)}
                            alt={`${item.name} product`}
                            loading="lazy"
                            onError={(event) => {
                              if (!event.currentTarget.src.endsWith('/other-supply.png')) {
                                event.currentTarget.src = '/images/laundry-products/other-supply.png'
                              }
                            }}
                            className="hidden h-9 w-9 shrink-0 rounded-lg border border-line bg-brand-tint object-contain xl:block"
                          />
                          <div className="min-w-0 break-words">
                            <div className="font-bold leading-5 text-navy">{item.name}</div>
                            <div className="text-[11px] text-ink-secondary">ID: INV-{String(item.id).padStart(4, '0')}</div>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-normal break-words px-2 py-2 text-[13px] text-ink-secondary">{item.category}</td>
                      <td className="whitespace-normal px-2 py-2">
                        <div className="flex flex-wrap items-baseline gap-x-1">
                          <span className="font-mono text-[14px] font-bold text-navy">
                            {item.quantity}
                          </span>
                          <span className="text-[13px] text-ink-secondary">{item.unit}</span>
                        </div>
                        {/* Visual stock bar */}
                        <div className="mt-1 h-1.5 w-full max-w-[90px] overflow-hidden rounded-full bg-brand-tint">
                          <div
                            className="h-full rounded-full bg-navy"
                            style={{ width: `${Math.max(5, pct)}%` }}
                          />
                        </div>
                      </td>
                      <td className="whitespace-normal px-2 py-2">
                        <span className={`inline-block rounded-full border px-1.5 py-0.5 text-center text-[11px] font-bold ${statusClass}`}>
                          {stateLabel}
                        </span>
                      </td>
                      <td className="whitespace-normal break-words px-2 py-2 text-[13px] text-ink-secondary font-mono">{item.minimum_stock} {item.unit}</td>
                      <td className="whitespace-normal break-words px-2 py-2 text-[13px] text-ink-secondary font-mono">{item.restock_level} {item.unit}</td>
                      <td className="whitespace-normal break-words px-2 py-2 text-[13px] text-navy font-mono">{item.maximum_stock} {item.unit}</td>
                      <td className="px-2 py-2 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          <button onClick={() => handleViewItem(item)} disabled={transactionLoadingId !== null} aria-label={`View ${item.name}`} title="View stock history" className="rounded-md border border-sky-500/30 bg-sky-500/10 p-1.5 text-sky-700 disabled:opacity-50">{transactionLoadingId === item.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}</button>
                          {isAdmin && <button onClick={() => handleOpenEditItem(item)} aria-label={`Edit ${item.name}`} title="Edit inventory item" className="rounded-md border border-line bg-brand-tint p-1.5 text-navy"><Pencil className="h-3.5 w-3.5" /></button>}
                          {isAdmin && <button
                            onClick={() => handleOpenAddonEdit(item)}
                            className="rounded-md border border-line bg-brand-tint p-1.5 text-navy transition hover:bg-brand-tintstrong"
                            title="Configure add-on price and stock use"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>}
                          <button
                            onClick={() => handleOpenAdjust(item, 'stock_in')}
                            className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-1.5 text-emerald-700 transition hover:bg-emerald-500/20"
                            title="Restock / Add Stock"
                            aria-label={`Restock ${item.name}`}
                          >
                            <span className="text-base font-bold leading-none">+</span>
                          </button>
                          {Number(item.quantity) > 0 && <button
                            onClick={() => handleOpenAdjust(item, 'stock_out')}
                            className="rounded-md border border-amber-500/30 bg-amber-500/10 p-1.5 text-amber-700 transition hover:bg-amber-500/20"
                            title="Deduct Stock"
                            aria-label={`Stock out ${item.name}`}
                          >
                            <span className="text-base font-bold leading-none">−</span>
                          </button>}
                          {isAdmin && <button
                            onClick={() => handleDeleteItem(item.id, item.name)}
                            className="rounded-md border border-line bg-brand-tint p-1.5 text-ink-secondary transition hover:bg-danger-tint hover:text-rose-400"
                            title="Delete Item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        <PaginationControls page={page} pageSize={pageSize} totalItems={filteredItems.length} onPageChange={nextPage => setPage(Math.max(1, Math.min(nextPage, pageCount)))} />
      </div>
      )}

      {/* Adjust Stock Modal */}
      {isAdjustModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white border border-line rounded-3xl p-6 shadow-2xl">
            <h3 className="text-lg font-black text-navy flex items-center gap-2 mb-1">
              {adjustType === 'stock_in' ? (
                <ArrowUp className="w-5 h-5 text-emerald-400" />
              ) : (
                <ArrowDown className="w-5 h-5 text-amber-400" />
              )}
              {adjustType === 'stock_in' ? 'Stock In (Restock)' : 'Stock Out (Usage)'}
            </h3>
            <p className="text-xs text-ink-secondary mb-4">
              Item: <strong className="text-navy">{selectedItem.name}</strong> (Current: {selectedItem.quantity} {selectedItem.unit})
            </p>

            <form onSubmit={handleSaveAdjustment} className="space-y-4">
              <div className="rounded-xl bg-brand-tint p-3 text-xs text-ink-secondary">
                Capacity: {selectedItem.quantity} / {selectedItem.maximum_stock} {selectedItem.unit} · Remaining: {Math.max(0, Number(selectedItem.maximum_stock) - Number(selectedItem.quantity))} {selectedItem.unit}
                {adjustType === 'stock_in' && <div className="mt-1">Recommended restock: {selectedItem.recommended_restock_quantity} {selectedItem.unit}</div>}
              </div>
              <div>
                <label className="text-xs font-bold text-ink-secondary block mb-1">Quantity ({selectedItem.unit})</label>
                <input
                  type="text"
                  inputMode="decimal"
                  maxLength={12}
                  step="0.1"
                  min="0.1"
                  required
                  placeholder={`Amount in ${selectedItem.unit}`}
                  value={adjustQty}
                  max={adjustType === 'stock_in' && !(isAdmin && overrideMaximum)
                    ? Math.max(0, Number(selectedItem.maximum_stock) - Number(selectedItem.quantity))
                    : adjustType === 'stock_out' ? Number(selectedItem.quantity) : undefined}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1').replace(/^0+(?=\d)/, '')
                    const limit = adjustType === 'stock_in'
                      ? Math.max(0, Number(selectedItem.maximum_stock) - Number(selectedItem.quantity))
                      : Number(selectedItem.quantity)
                    if (raw === '' || raw === '.') {
                      setAdjustQty('')
                    } else if (adjustType === 'stock_in' && isAdmin && overrideMaximum) {
                      setAdjustQty(raw)
                    } else {
                      setAdjustQty(Number(raw) > limit ? String(limit) : raw)
                    }
                  }}
                  className="w-full px-3 py-2.5 rounded-xl bg-brand-tint border border-line text-sm text-navy focus:outline-none focus:border-brand-light"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-ink-secondary block mb-1">Reason / Notes</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Supplier restock, Daily detergent batch"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-brand-tint border border-line text-sm text-navy focus:outline-none focus:border-brand-light"
                />
              </div>

              {adjustType === 'stock_in' && isAdmin && (
                <label className="flex items-start gap-2 rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs text-rose-700">
                  <input type="checkbox" checked={overrideMaximum} onChange={(e) => { setOverrideMaximum(e.target.checked); if (!e.target.checked) setAdjustQty((value) => Number(value) > Math.max(0, Number(selectedItem.maximum_stock) - Number(selectedItem.quantity)) ? String(Math.max(0, Number(selectedItem.maximum_stock) - Number(selectedItem.quantity))) : value) }} />
                  Authorized admin override: receive above maximum. The reason and your admin account will be recorded.
                </label>
              )}

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-brand-tint hover:bg-brand-tintstrong text-navy font-bold text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAdjustment || (adjustType === 'stock_in' && Number(adjustQty) > Math.max(0, Number(selectedItem.maximum_stock) - Number(selectedItem.quantity)) && (!isAdmin || !overrideMaximum))}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-xs text-white shadow-lg transition ${
                    adjustType === 'stock_in'
                      ? 'bg-navy hover:bg-navy-hover shadow-card'
                      : 'bg-navy hover:bg-navy-hover shadow-card'
                  }`}
                >
                  {savingAdjustment ? 'Saving…' : `Confirm ${adjustType === 'stock_in' ? 'Restock' : 'Deduction'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEditItemModalOpen && editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/40 backdrop-blur-sm">
          <div className="w-full max-w-lg space-y-4 rounded-3xl border border-line bg-white p-6 shadow-pop">
            <div>
              <h3 className="text-lg font-black text-navy">Edit Inventory Item</h3>
              <p className="mt-1 text-xs text-ink-secondary">Update item details and stock thresholds. Quantity changes must be recorded as stock movements.</p>
            </div>
            <form onSubmit={handleSaveItem} className="space-y-3">
              <label className="block text-xs font-bold text-ink-secondary">
                Item name
                <input required maxLength={100} value={editItemName} onChange={event => setEditItemName(event.target.value)} className="mt-1 w-full rounded-xl border border-line bg-brand-tint px-3 py-2.5 text-sm text-navy focus:border-brand-light focus:outline-none" />
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-xs font-bold text-ink-secondary">
                  Category
                  <select value={editItemCategory} onChange={event => setEditItemCategory(event.target.value)} className="mt-1 w-full rounded-xl border border-line bg-brand-tint px-3 py-2.5 text-sm text-navy focus:border-brand-light focus:outline-none">
                    {categories.filter(category => category !== 'All' && category !== 'Liquid Supplies').map(category => <option key={category} value={category}>{category}</option>)}
                  </select>
                </label>
                <div className="rounded-xl border border-line bg-brand-tint px-3 py-2.5 text-xs text-ink-secondary">
                  Unit of measure
                  <strong className="mt-1 block text-sm text-navy">{editItem.unit}</strong>
                  Unit is fixed after movements are recorded.
                </div>
              </div>
              <StockLimitFields
                maximum={editItemMaximum}
                onMaximumChange={setEditItemMaximum}
                restock={editItemRestock}
                onRestockChange={setEditItemRestock}
                minimum={editItemMinimum}
                onMinimumChange={setEditItemMinimum}
                unit={editItem.unit}
                maximumCap={getLiquidSupplyProfile(editItemName, editItemCategory)?.maximum}
              />
              <div className="flex gap-3 pt-2">
                <button type="button" disabled={savingItem} onClick={() => setIsEditItemModalOpen(false)} className="flex-1 rounded-xl bg-brand-tint py-2.5 text-xs font-bold text-navy hover:bg-brand-tintstrong disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={savingItem} className="flex-1 rounded-xl bg-navy py-2.5 text-xs font-bold text-white shadow-card hover:bg-navy-hover disabled:opacity-50">{savingItem ? 'Saving…' : 'Save Item Details'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAddonEditModalOpen && addonItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/40 backdrop-blur-sm">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-white border border-line rounded-3xl p-6 shadow-2xl">
            <h3 className="text-lg font-black text-navy mb-1">Edit Inventory & Add-on</h3>
            <p className="text-xs text-ink-secondary mb-4">{addonItem.name} · inventory unit: {addonItem.unit}</p>
            <form onSubmit={handleSaveAddonConfig} className="space-y-4">
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-line bg-brand-tint/50 p-3 text-xs">
                <div><span className="block font-bold text-ink-secondary">Item Name</span><span className="text-navy">{addonItem.name}</span></div>
                <div><span className="block font-bold text-ink-secondary">Category</span><span className="text-navy">{addonItem.category}</span></div>
                <div><span className="block font-bold text-ink-secondary">Current Stock</span><span className="text-navy">{addonItem.quantity} {addonItem.unit}</span></div>
                <div><span className="block font-bold text-ink-secondary">Linked Inventory Product</span><span className="text-navy">INV-{String(addonItem.id).padStart(4, '0')} · {addonItem.name}</span></div>
                <div><span className="block font-bold text-ink-secondary">Unit</span><span className="text-navy">{addonItem.unit} (assigned)</span></div>
              </div>
              <AddonConfigFields
                price={addonPrice}
                onPriceChange={setAddonPrice}
                unit={addonUnit}
                onUnitChange={setAddonUnit}
                stockQuantity={addonStockQuantity}
                onStockQuantityChange={setAddonStockQuantity}
                stockUnit={addonItem.unit}
              />
              <div>
                <label className="text-xs font-bold text-ink-secondary block mb-1">Add-on Status</label>
                <select value={addonManualStatus} onChange={(e) => setAddonManualStatus(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-brand-tint border border-line text-sm text-navy focus:outline-none focus:border-brand-light">
                  <option value="ACTIVE">Automatic (based on stock)</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="NOT_FOR_SALE">Not for Sale</option>
                </select>
                <p className="mt-1 text-[11px] text-ink-secondary">Automatic availability requires a price, serving size, and enough current inventory.</p>
              </div>
              <StockLimitFields maximum={maximumStock} onMaximumChange={setMaximumStock} restock={restockLevel} onRestockChange={setRestockLevel} minimum={minimumStock} onMinimumChange={setMinimumStock} unit={addonItem.unit} maximumCap={getLiquidSupplyProfile(addonItem.name, addonItem.category)?.maximum} />
              <label className="block text-xs font-bold text-ink-secondary">
                Standard usage per laundry kg ({addonItem.unit}/kg)
                <input type="number" min="0" step="0.01" required value={usageRate} onChange={(e) => setUsageRate(e.target.value)} className="mt-1 w-full px-3 py-2.5 rounded-xl bg-brand-tint border border-line text-sm text-navy focus:outline-none focus:border-brand-light" />
                <span className="mt-1 block font-normal">This rate calculates and deducts the selected product amount for each order.</span>
              </label>
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsAddonEditModalOpen(false)} className="flex-1 py-2.5 rounded-xl bg-brand-tint hover:bg-brand-tintstrong text-navy font-bold text-xs transition">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 rounded-xl bg-navy hover:bg-navy-hover text-white font-bold text-xs shadow-card transition">Save Add-on</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedTransaction?.history && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/40 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[85vh] overflow-auto bg-white border border-line rounded-3xl p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div><h3 className="text-lg font-black text-navy">Product Details & Stock History</h3><p className="text-xs text-ink-secondary">{selectedTransaction.item.name}</p></div>
              <button onClick={() => setSelectedTransaction(null)} className="px-3 py-1 rounded-lg border border-line text-xs font-bold">Close</button>
            </div>
            <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                ['Current', selectedTransaction.item.quantity],
                ['Minimum', selectedTransaction.item.minimum_stock],
                ['Restock', selectedTransaction.item.restock_level],
                ['Maximum', selectedTransaction.item.maximum_stock],
              ].map(([label, value]) => <div key={label} className="rounded-xl bg-brand-tint p-3 text-xs"><div className="text-ink-secondary">{label}</div><strong className="text-navy">{value} {selectedTransaction.item.unit}</strong></div>)}
              <div className="col-span-2 sm:col-span-4 rounded-xl border border-line p-3 text-xs text-ink-secondary">Recommended restock: <strong className="text-navy">{selectedTransaction.item.recommended_restock_quantity} {selectedTransaction.item.unit}</strong> · Status: <strong className="text-navy">{inventoryStatus(selectedTransaction.item).replaceAll('_', ' ')}</strong></div>
            </div>
            <div className="space-y-2">
              {selectedTransaction.history.length ? selectedTransaction.history.map((tx) => <div key={tx.id} className="rounded-xl border border-line p-3 text-xs">
                <div className="flex justify-between gap-3"><strong className="text-navy">{tx.type === 'stock_in' ? 'Stock In' : 'Stock Out'} · {tx.quantity} {selectedTransaction.item.unit}</strong><span className="text-ink-secondary">{tx.created_at ? new Date(tx.created_at).toLocaleString() : ''}</span></div>
                <p className="mt-1 text-ink-secondary">{tx.reason || '—'} · Recorded by {tx.recorder?.name || 'System'}</p>
              </div>) : <p className="text-sm text-ink-secondary">No stock movements recorded.</p>}
            </div>
          </div>
        </div>
      )}

      {/* Add New Item Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white border border-line rounded-3xl p-6 shadow-2xl">
            <h3 className="text-lg font-black text-navy flex items-center gap-2 mb-1">
              <Box className="w-5 h-5 text-navy" />
              Add New Supply Item
            </h3>
            <p className="text-xs text-ink-secondary mb-4">Register a new supply or packaging consumable</p>

            <form onSubmit={handleCreateItem} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-ink-secondary block mb-1">Item Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ariel Oxy Liquid Detergent"
                  value={newItemName}
                  onChange={(e) => {
                    const name = e.target.value
                    setNewItemName(name)
                    applyLiquidProfile(name, newItemCategory)
                  }}
                  className="w-full px-3 py-2.5 rounded-xl bg-brand-tint border border-line text-sm text-navy focus:outline-none focus:border-brand-light"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-ink-secondary block mb-1">Category</label>
                  <select
                    value={newItemCategory}
                    onChange={(e) => {
                      const category = e.target.value
                      if (!applyLiquidProfile(newItemName, category)) {
                        setNewItemCategory(category)
                        const max = defaultMaximum(category, newItemUnit)
                        setNewItemMinStock('0')
                        setNewItemMaxStock(String(max))
                        setNewItemRestockLevel(String(max * 0.25))
                      }
                    }}
                    className="w-full px-3 py-2.5 rounded-xl bg-brand-tint border border-line text-sm text-navy focus:outline-none focus:border-brand-light"
                  >
                    <option value="Detergent">Detergent</option>
                    <option value="Powder Detergent">Powder Detergent</option>
                    <option value="Liquid Detergent">Liquid Detergent</option>
                    <option value="Fabric Conditioner / Fabcon">Fabric Conditioner / Fabcon</option>
                    <option value="Bleach">Bleach</option>
                    <option value="Stain Remover">Stain Remover</option>
                    <option value="Fabric Softener">Fabric Softener</option>
                    <option value="Plastic Bags">Plastic Bags</option>
                    <option value="Laundry Supplies">Laundry Supplies</option>
                    <option value="Other Supplies">Other Supplies</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-ink-secondary block mb-1">Unit of Measure</label>
                  <select
                    value={newItemUnit}
                    disabled={Boolean(getExpectedSupplyUnit(newItemName, newItemCategory))}
                    onChange={(e) => { setNewItemUnit(e.target.value); const max = defaultMaximum(newItemCategory, e.target.value); setNewItemMaxStock(String(max)); setNewItemRestockLevel(String(max * 0.25)) }}
                    className="w-full px-3 py-2.5 rounded-xl bg-brand-tint border border-line text-sm text-navy focus:outline-none focus:border-brand-light"
                  >
                    <option value="liters">liters (L)</option>
                    <option value="mL">milliliters (mL)</option>
                    <option value="kg">kilograms (kg)</option>
                    <option value="pcs">pieces (pcs)</option>
                    <option value="packs">packs</option>
                    <option value="bottles">bottles</option>
                  </select>
                </div>
              </div>

              <div>
                <div>
                  <label className="text-xs font-bold text-ink-secondary block mb-1">Initial Quantity</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    maxLength={12}
                    step="0.1"
                    min="0"
                    required
                    placeholder="0.0"
                    value={newItemQuantity}
                    max={newItemMaxStock}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1').replace(/^0+(?=\d)/, '')
                      setNewItemQuantity(Number(raw) > Number(newItemMaxStock) ? newItemMaxStock : raw)
                    }}
                    className="w-full px-3 py-2.5 rounded-xl bg-brand-tint border border-line text-sm text-navy focus:outline-none focus:border-brand-light"
                  />
                </div>
              </div>

              <StockLimitFields maximum={newItemMaxStock} onMaximumChange={setNewItemMaxStock} restock={newItemRestockLevel} onRestockChange={setNewItemRestockLevel} minimum={newItemMinStock} onMinimumChange={setNewItemMinStock} unit={newItemUnit} maximumCap={getLiquidSupplyProfile(newItemName, newItemCategory)?.maximum} />

              <AddonConfigFields
                price={addonPrice}
                onPriceChange={setAddonPrice}
                unit={addonUnit}
                onUnitChange={setAddonUnit}
                stockQuantity={addonStockQuantity}
                onStockQuantityChange={setAddonStockQuantity}
                stockUnit={newItemUnit}
              />

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={savingItem}
                  className="flex-1 py-2.5 rounded-xl bg-brand-tint hover:bg-brand-tintstrong text-navy font-bold text-xs transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingItem}
                  className="flex-1 py-2.5 rounded-xl bg-navy hover:bg-navy-hover text-white font-bold text-xs shadow-card transition disabled:opacity-50"
                >
                  {savingItem ? 'Saving…' : 'Save Supply Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function AddonConfigFields({
  price,
  onPriceChange,
  unit,
  onUnitChange,
  stockQuantity,
  onStockQuantityChange,
  stockUnit,
}) {
  const inputClass = 'w-full px-3 py-2.5 rounded-xl bg-brand-tint border border-line text-sm text-navy focus:outline-none focus:border-brand-light'
  return (
    <div className="rounded-xl border border-line bg-brand-tint/50 p-3 space-y-3">
      <div>
        <label className="text-xs font-bold text-ink-secondary block mb-1">Customer add-on price per serving/pack (₱)</label>
        <input type="number" min="0" step="0.01" value={price} onChange={(e) => onPriceChange(e.target.value)} className={inputClass} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-bold text-ink-secondary block mb-1">Serving/pack label</label>
          <input type="text" maxLength="30" value={unit} onChange={(e) => onUnitChange(e.target.value)} placeholder="scoop, pack" className={inputClass} />
        </div>
        <div>
          <label className="text-xs font-bold text-ink-secondary block mb-1">Stock used per serving ({stockUnit})</label>
          <input type="number" min="0" step="0.01" value={stockQuantity} onChange={(e) => onStockQuantityChange(e.target.value)} className={inputClass} />
        </div>
      </div>
      <p className="text-[11px] text-ink-secondary">Set both price and stock used above zero to sell this item as an add-on.</p>
    </div>
  )
}

function StockLimitFields({ maximum, onMaximumChange, restock, onRestockChange, minimum, onMinimumChange, unit, maximumCap }) {
  const inputClass = 'w-full px-3 py-2.5 rounded-xl bg-brand-tint border border-line text-sm text-navy focus:outline-none focus:border-brand-light'
  return (
    <div className="grid grid-cols-3 gap-2 rounded-xl border border-line bg-brand-tint/40 p-3">
      <label className="text-[11px] font-bold text-ink-secondary">Minimum ({unit})<input required type="number" min="0" step="0.01" value={minimum} onChange={(e) => onMinimumChange(e.target.value)} className={`${inputClass} mt-1`} /></label>
      <label className="text-[11px] font-bold text-ink-secondary">Restock at ({unit})<input required type="number" min="0" step="0.01" value={restock} onChange={(e) => onRestockChange(e.target.value)} className={`${inputClass} mt-1`} /></label>
      <label className="text-[11px] font-bold text-ink-secondary">Maximum ({unit})<input required type="number" min="0.01" max={maximumCap} step="0.01" value={maximum} onChange={(e) => { const value = e.target.value; onMaximumChange(maximumCap && value !== '' && Number(value) > maximumCap ? String(maximumCap) : value) }} className={`${inputClass} mt-1`} /></label>
    </div>
  )
}
