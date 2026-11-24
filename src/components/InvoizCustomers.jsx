import { useMemo, useState } from 'react'
import {
  BarChart3,
  ChevronRight,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Mail,
  Package,
  Phone,
  Search,
  Settings,
  Store,
  Truck,
  UsersRound,
  X,
} from 'lucide-react'
import './InvoizCustomers.css'
import ExpandableSearch from './ExpandableSearch'

const navigation = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Orders', icon: ClipboardList },
  { label: 'Customers', icon: UsersRound },
  { label: 'Products', icon: Package },
  { label: 'Sellers', icon: Store },
  { label: 'Finance', icon: CreditCard },
  { label: 'Logistics', icon: Truck },
  { label: 'Reports', icon: BarChart3 },
  { label: 'Settings', icon: Settings },
]

const customers = [
  { name: 'Maria Santos', email: 'maria.santos@email.com', phone: '+63 917 204 5812', orders: 3, status: 'active', initials: 'MS', color: 'lilac' },
  { name: 'Juan Dela Cruz', email: 'juan.delacruz@email.com', phone: '+63 918 365 7421', orders: 1, status: 'unpaid', initials: 'JD', color: 'peach' },
  { name: 'Ana Reyes', email: 'ana.reyes@email.com', phone: '+63 920 418 9365', orders: 5, status: 'active', initials: 'AR', color: 'mint' },
  { name: 'Carlos Lim', email: 'carlos.lim@email.com', phone: '+63 917 852 6403', orders: 2, status: 'active', initials: 'CL', color: 'blue' },
  { name: 'Bea Mendoza', email: 'bea.mendoza@email.com', phone: '+63 905 673 1284', orders: 1, status: 'unpaid', initials: 'BM', color: 'rose' },
]

export default function InvoizCustomers() {
  const [query, setQuery] = useState('')
  const [activeNav, setActiveNav] = useState('Customers')
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const visibleCustomers = useMemo(() => {
    const search = query.trim().toLowerCase()
    if (!search) return customers
    return customers.filter((customer) =>
      [customer.name, customer.email, customer.phone].some((value) =>
        value.toLowerCase().includes(search),
      ),
    )
  }, [query])

  return (
    <div className="invoiz-page">
      <aside className="invoiz-sidebar" aria-label="Main navigation">
        <a className="invoiz-brand" href="/invoiz" aria-label="Invoiz home">
          <span className="invoiz-brand-mark">i</span>
          <span className="invoiz-brand-name">Invoiz</span>
        </a>

        <div className="invoiz-nav-label">Workspace</div>
        <nav className="invoiz-nav">
          {navigation.map(({ label, icon: Icon }) => (
            <button
              className={`invoiz-nav-item${activeNav === label ? ' is-active' : ''}`}
              key={label}
              onClick={() => setActiveNav(label)}
              type="button"
            >
              <Icon size={19} strokeWidth={1.8} />
              <span>{label}</span>
              {label === 'Customers' && <span className="invoiz-nav-dot" />}
            </button>
          ))}
        </nav>

        <div className="invoiz-sidebar-bottom">
          <div className="invoiz-help-card">
            <span className="invoiz-help-orb" />
            <strong>Need a hand?</strong>
            <span>Our support team is here to help.</span>
            <button type="button">Visit help center <ChevronRight size={14} /></button>
          </div>
          <button className="invoiz-nav-item invoiz-logout" onClick={() => setActiveNav('Logout')} type="button">
            <LogOut size={19} strokeWidth={1.8} />
            <span>Logout</span>
          </button>
          <div className="invoiz-profile">
            <div className="invoiz-profile-avatar">AM</div>
            <div className="invoiz-profile-copy"><strong>Alex Morgan</strong><span>Administrator</span></div>
            <span className="invoiz-profile-menu">···</span>
          </div>
        </div>
      </aside>

      <main className="invoiz-main">
        <header className="invoiz-mobile-header">
          <a className="invoiz-brand" href="/invoiz">
            <span className="invoiz-brand-mark">i</span><span className="invoiz-brand-name">Invoiz</span>
          </a>
          <button className="invoiz-mobile-menu" onClick={() => setMobileNavOpen((open) => !open)} type="button" aria-label="Toggle navigation" aria-expanded={mobileNavOpen}>
            {mobileNavOpen ? <X size={19} /> : <UsersRound size={19} />}
          </button>
        </header>
        {mobileNavOpen && (
          <nav className="invoiz-mobile-nav" aria-label="Mobile navigation">
            {navigation.map(({ label, icon: Icon }) => (
              <button
                className={`invoiz-nav-item${activeNav === label ? ' is-active' : ''}`}
                key={label}
                onClick={() => { setActiveNav(label); setMobileNavOpen(false) }}
                type="button"
              >
                <Icon size={18} strokeWidth={1.8} />{label}
              </button>
            ))}
            <button className="invoiz-nav-item" onClick={() => setMobileNavOpen(false)} type="button"><LogOut size={18} />Logout</button>
          </nav>
        )}

        <div className="invoiz-content">
          <div className="invoiz-page-heading">
            <div>
              <div className="invoiz-breadcrumb">Workspace <ChevronRight size={13} /> Customers</div>
              <h1>Customers</h1>
              <p>Manage your customers and their order status.</p>
            </div>
            <ExpandableSearch className="max-w-[300px]" value={query} onChange={setQuery} placeholder="Search customer..." ariaLabel="Search customer" />
          </div>

          <section className="invoiz-customer-section" aria-label="Customer list">
            <div className="invoiz-list-heading">
              <div>
                <h2>Customer directory</h2>
                <p>{visibleCustomers.length} customers in your store</p>
              </div>
              <span className="invoiz-updated"><span /> All customers</span>
            </div>

            <div className="invoiz-customer-list">
              {visibleCustomers.map((customer, index) => (
                <article className="invoiz-customer-card" key={customer.email} style={{ '--card-index': index }}>
                  <div className={`invoiz-avatar avatar-${customer.color}`}>{customer.initials}</div>
                  <div className="invoiz-customer-info">
                    <h3>{customer.name}</h3>
                    <div className="invoiz-contact-line"><Mail size={14} /><span>{customer.email}</span></div>
                    <div className="invoiz-contact-line"><Phone size={14} /><span>{customer.phone}</span></div>
                  </div>
                  <div className="invoiz-orders-count">
                    <span className="invoiz-orders-icon"><ClipboardList size={17} /></span>
                    <span><strong>{customer.orders}</strong><small>{customer.orders === 1 ? 'Order' : 'Orders'}</small></span>
                  </div>
                  <div className="invoiz-customer-status">
                    <span className={`invoiz-status-badge ${customer.status === 'active' ? 'status-active' : 'status-unpaid'}`}>
                      <span className="invoiz-status-dot" />
                      {customer.status === 'active' ? 'Active Orders' : 'Unpaid Balance'}
                    </span>
                  </div>
                  <button className="invoiz-details-button" onClick={() => setSelectedCustomer(customer)} type="button">
                    View Details <span>→</span>
                  </button>
                </article>
              ))}
              {visibleCustomers.length === 0 && (
                <div className="invoiz-empty-state">
                  <span className="invoiz-empty-icon"><Search size={21} /></span>
                  <strong>No customers found</strong>
                  <span>Try another name, email, or phone number.</span>
                  <button onClick={() => setQuery('')} type="button">Clear search</button>
                </div>
              )}
            </div>
            <div className="invoiz-list-footer">Showing <strong>{visibleCustomers.length}</strong> of <strong>{customers.length}</strong> customers</div>
          </section>
        </div>
      </main>

      {selectedCustomer && (
        <div className="invoiz-modal-backdrop" onClick={() => setSelectedCustomer(null)} role="presentation">
          <section className="invoiz-customer-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="invoiz-modal-title">
            <button className="invoiz-modal-close" onClick={() => setSelectedCustomer(null)} aria-label="Close details" type="button"><X size={18} /></button>
            <div className={`invoiz-avatar invoiz-modal-avatar avatar-${selectedCustomer.color}`}>{selectedCustomer.initials}</div>
            <h2 id="invoiz-modal-title">{selectedCustomer.name}</h2>
            <p className="invoiz-modal-caption">Customer profile</p>
            <div className="invoiz-modal-info"><Mail size={16} />{selectedCustomer.email}</div>
            <div className="invoiz-modal-info"><Phone size={16} />{selectedCustomer.phone}</div>
            <div className="invoiz-modal-stat"><span>Total orders</span><strong>{selectedCustomer.orders}</strong></div>
            <span className={`invoiz-status-badge ${selectedCustomer.status === 'active' ? 'status-active' : 'status-unpaid'}`}>
              <span className="invoiz-status-dot" />
              {selectedCustomer.status === 'active' ? 'Active Orders' : 'Unpaid Balance'}
            </span>
          </section>
        </div>
      )}
    </div>
  )
}
