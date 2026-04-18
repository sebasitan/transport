'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Bus,
  Truck,
  MapPin,
  CalendarClock,
  Settings,
  LogOut,
  Menu,
  X,
  User,
  ActivitySquare,
  FileBarChart2,
} from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transport-requests', label: 'Fleet Operations', icon: Bus },
  { href: '/pickup-monitor', label: 'Pickup Monitor', icon: ActivitySquare },
  { href: '/drivers', label: 'Drivers', icon: User },
  { href: '/transport-schedule', label: 'Shuttle Slots', icon: CalendarClock },
  { href: '/vehicles', label: 'Vehicles', icon: Truck },
  { href: '/pickup-stations', label: 'Stations', icon: MapPin },
  { href: '/reports', label: 'Reports', icon: FileBarChart2 },
  { href: '/settings', label: 'Settings', icon: Settings },
]

interface AdminSidebarProps {
  onLogout: () => void
}

export function AdminSidebar({ onLogout }: AdminSidebarProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* Mobile toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 lg:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Overlay for mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-40 h-screen w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-transform duration-300 lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex items-center gap-3 px-6 py-6 border-b border-sidebar-border">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-primary">
              <Bus className="h-5 w-5 text-sidebar-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-bold">Transport Portal</h1>
              <p className="text-xs text-sidebar-muted">Admin Panel</p>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 space-y-1 px-3 py-4">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-muted hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )
            })}
          </nav>

          {/* Logout */}
          <div className="border-t border-sidebar-border px-3 py-4">
            <button
              onClick={onLogout}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-muted hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
