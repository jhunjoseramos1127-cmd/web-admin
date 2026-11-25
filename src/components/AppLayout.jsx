import { useState, useEffect, useRef } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Package, Users, PhilippinePeso, FileText,
  Droplets, Box, BarChart3, FileBarChart, Bell, MessageCircle, Settings, LogOut,
  Menu, X, ShieldAlert, HeartHandshake
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import ExpandableSearch from './ExpandableSearch'
import { ConfirmDialog } from './shared'
import FreshSpinLogo from './auth/FreshSpinLogo'

/* Grouped so each web-admin function is labelled by what it does */
const NAV_GROUPS = [
  {
    title: 'Overview',
    items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true }],
  },
  {
    title: 'Operations',
    items: [
      { to: '/orders', label: 'Orders', icon: Package },
      { to: '/customers', label: 'Customers', icon: Users },
      { to: '/payments', label: 'Payments', icon: PhilippinePeso },
      { to: '/loyalty', label: 'Loyalty & Rewards', icon: HeartHandshake, authorizedRoles: ['admin', 'cashier'] },
      { to: '/services', label: 'Pricing', icon: FileText },
    ],
  },
  {
    title: 'Sensor & Stock',
    items: [
      { to: '/humidity', label: 'Humidity', icon: Droplets, authorizedRoles: ['admin', 'staff'] },
      { to: '/inventory', label: 'Inventory', icon: Box },
    ],
  },
  {
    title: 'Insights',
    items: [
      { to: '/analytics', label: 'Analytics', icon: BarChart3, authorizedRoles: ['admin', 'staff'] },
      { to: '/reports', label: 'Reports', icon: FileBarChart },
    ],
  },
  {
    title: 'Administration',
    items: [
      { to: '/users', label: 'Users', icon: ShieldAlert, authorizedRoles: ['admin'] },
      { to: '/notifications', label: 'Notifications', icon: Bell },
      { to: '/support', label: 'Support Inbox', icon: MessageCircle, authorizedRoles: ['admin', 'staff'] },
      { to: '/settings', label: 'Settings', icon: Settings, authorizedRoles: ['admin'] },
    ],
  },
]

function SidebarLink({ to, label, icon: Icon, collapsed, end, onNavigate }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        `sidebar-nav-link relative flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 group ${
          isActive
            ? 'bg-[#DDF3F8] text-[#0A4D68] shadow-card'
            : 'text-white/75 hover:text-white hover:bg-white/10'
        } ${collapsed ? 'justify-center px-3' : ''}`
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-[#0A4D68]' : 'text-[#A5F3F3] group-hover:text-white'}`} strokeWidth={isActive ? 2.25 : 1.75} />
          {!collapsed && <span className="truncate">{label}</span>}
        </>
      )}
    </NavLink>
  )
}

export default function AppLayout({ children, unreadCount = 0, supportUnreadCount = 0, humidityWarning = false }) {
  const { user, logout } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [logoutDialog, setLogoutDialog] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024)
  const [globalSearch, setGlobalSearch] = useState('')
  const location = useLocation()
  const navigate = useNavigate()
  const drawerRef = useRef(null)

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 1024)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // Close drawer on route change
  useEffect(() => { setDrawerOpen(false) }, [location.pathname])

  const handleLogout = async () => {
    await logout()
    window.location.replace('/login')
  }

  const sidebarContent = (onNavigate) => (
      <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Brand */}
      <div className={`sidebar-brand shrink-0 flex items-center gap-3 px-4 py-4 border-b border-white/10 ${collapsed && !isMobile ? 'flex-col justify-center gap-2' : ''}`}>
        <span className="shrink-0 drop-shadow-lg">
          <FreshSpinLogo size={collapsed && !isMobile ? 36 : 40} />
        </span>
        {(!collapsed || isMobile) && (
          <div className="min-w-0 flex-1">
            <div className="text-[17px] font-extrabold text-white tracking-tight truncate">FreshSpin</div>
            <div className="text-[10px] font-semibold tracking-[0.2em] text-brand-light truncate">LAUNDRY SERVICE</div>
          </div>
        )}
        {!isMobile && (
          <button
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="shrink-0 p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav — never scrolls; grouped and compact so all items fit 100vh */}
      <nav className="flex-1 min-h-0 overflow-y-hidden overflow-x-hidden px-2 pb-1">
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="mb-0.5">
            {(collapsed && !isMobile) ? (
              <div aria-hidden="true" className="mx-auto my-1.5 h-px w-6 bg-white/25" />
            ) : (
              <div className="sidebar-section-label truncate px-3 pb-0.5 pt-1 text-[9px] font-bold uppercase tracking-[0.16em] text-[#A5F3F3]/85">
                {group.title}
              </div>
            )}
            <div className="space-y-0">
              {group.items.filter((item) => !item.authorizedRoles || item.authorizedRoles.includes(user?.role)).map((item) => {
                const hasAlert = item.to === '/humidity' && humidityWarning
                return (
                  <div key={item.to} className="relative">
                    <SidebarLink {...item} collapsed={collapsed && !isMobile} onNavigate={onNavigate} />
                    {hasAlert && (
                      <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                    )}
                    {item.to === '/notifications' && unreadCount > 0 && (
                      <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-[#DDF3F8] text-[#0A4D68] rounded-full flex items-center justify-center">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                    {item.to === '/support' && supportUnreadCount > 0 && (
                      <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-[#DDF3F8] text-[#0A4D68] rounded-full flex items-center justify-center">
                        {supportUnreadCount > 99 ? '99+' : supportUnreadCount}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Decorative footer — shown only when the viewport is tall enough
          to fit it without scrolling */}
      {(!collapsed || isMobile) && (
        <div className="mt-auto shrink-0 relative mx-4 mb-3 overflow-hidden rounded-2xl px-3 pb-3 pt-3 text-center hidden tall:block">
          <span aria-hidden="true" className="absolute -left-5 -top-5 h-16 w-16 rounded-full bg-brand-light/25" />
          <span aria-hidden="true" className="absolute -bottom-6 -right-6 h-20 w-20 rounded-full bg-brand-light/15" />
          <span aria-hidden="true" className="absolute right-8 top-3 h-3 w-3 rounded-full border-2 border-white/50 bg-white/20" />
          <span aria-hidden="true" className="absolute left-10 bottom-8 h-2 w-2 rounded-full border border-white/40" />
          <p className="font-script relative text-[24px] leading-[1.1] text-white">
            Clean Clothes
            <br />
            Happy Customers ♡
          </p>
          <svg
            aria-hidden="true"
            viewBox="0 0 160 10"
            className="relative mx-auto -mt-1 h-2.5 w-32"
          >
            <path
              d="M4,7 C50,2 110,2 156,6"
              fill="none"
              stroke="var(--blue)"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.8"
            />
          </svg>
          <svg
            aria-hidden="true"
            viewBox="0 0 200 24"
            preserveAspectRatio="none"
            className="absolute bottom-0 left-0 h-5 w-full"
          >
            <path
              d="M0,14 C40,4 80,22 120,12 C150,5 175,16 200,10 L200,24 L0,24 Z"
              fill="var(--blue)"
              opacity="0.55"
            />
          </svg>
        </div>
      )}
    </div>
  )

  return (
    <div className="h-screen overflow-hidden bg-brand-tint text-navy flex font-sans">
      {/* ── Desktop Sidebar ── */}
      {!isMobile && (
        <aside className={`fixed inset-y-0 left-0 z-40 flex flex-col h-screen overflow-hidden bg-navy border-r border-navy transition-all duration-300 ${collapsed ? 'w-[76px]' : 'w-[290px]'}`}>
          {sidebarContent(() => {})}
        </aside>
      )}

      {/* ── Mobile Drawer ── */}
      {isMobile && drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <aside ref={drawerRef} className="relative z-10 w-64 max-h-screen overflow-hidden bg-navy border-r border-navy flex flex-col">
            <button
              onClick={() => setDrawerOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
            {sidebarContent(() => setDrawerOpen(false))}
          </aside>
        </div>
      )}

      {/* ── Main ── */}
      <div className={`flex-1 flex flex-col min-w-0 h-screen overflow-hidden ${collapsed ? 'lg:ml-[76px]' : 'lg:ml-[290px]'}`}>
        {/* Topbar */}
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xl border-b border-line shadow-card px-4 lg:px-6 py-3 flex items-center gap-4">
          <div className="flex items-center gap-3 shrink-0">
            {isMobile && (
              <button
                onClick={() => setDrawerOpen(true)}
                className="p-2 rounded-full hover:bg-brand-tint text-navy transition"
                aria-label="Open navigation menu"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
          </div>
          {/* Global search → Orders page filter */}
          <ExpandableSearch
            className="hidden sm:flex w-full max-w-md"
            value={globalSearch}
            onChange={setGlobalSearch}
            placeholder="Search..."
            ariaLabel="Search orders"
            onSubmit={() => navigate(`/orders${globalSearch.trim() ? `?q=${encodeURIComponent(globalSearch.trim())}` : ''}`)}
          />
          {/* Right side: user menu */}
          <div className="flex items-center gap-3 ml-auto">
            <NavLink
              to="/notifications"
              aria-label="Notifications"
              className="relative p-2.5 rounded-full hover:bg-brand-tint text-navy transition"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-danger text-white rounded-full flex items-center justify-center border-2 border-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </NavLink>
            <div className="flex items-center gap-3 pl-3 border-l border-line">
              <span className="hidden sm:flex h-10 w-10 items-center justify-center rounded-full bg-navy text-sm font-extrabold text-white shrink-0">
                {(user?.name || 'A').trim().charAt(0).toUpperCase()}
              </span>
              <div className="hidden md:block text-left leading-tight">
                <div className="text-sm font-bold text-navy">{user?.name}</div>
                <div className="text-[11px] text-ink-secondary">Administrator</div>
              </div>
              <button
                onClick={() => setLogoutDialog(true)}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white hover:bg-brand-tint border-[1.5px] border-brand-light text-navy text-xs font-semibold transition shadow-card"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </header>

        {/* Scrollable content — stable gutter so the scrollbar appearing or
            disappearing never changes the content width mid-scroll */}
        <main className="relative flex-1 p-4 lg:p-6 overflow-y-auto [scrollbar-gutter:stable] bg-[#F8FAFC]">
          <div className="fs-admin-page relative">{children}</div>
        </main>
        <footer className="flex flex-col sm:flex-row items-center justify-between gap-1 border-t border-line bg-white/80 px-4 lg:px-6 py-1.5 text-[11px] text-ink-secondary">
          <span>© 2025 FreshSpin Laundry. All rights reserved.</span>
          <span className="flex items-center gap-1.5">FreshSpin <span aria-hidden="true" className="h-1 w-1 rounded-full bg-brand-light" /> Clean Clothes <span aria-hidden="true" className="h-1 w-1 rounded-full bg-brand-light" /> Happier Days <span aria-hidden="true">♡</span></span>
        </footer>
      </div>

      {/* Logout Confirm Dialog */}
      <ConfirmDialog
        open={logoutDialog}
        title="Sign Out"
        message="Are you sure you want to sign out of your admin account?"
        confirmLabel="Log Out"
        danger
        onConfirm={handleLogout}
        onCancel={() => setLogoutDialog(false)}
      />
    </div>
  )
}
