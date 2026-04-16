import { useState, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Link2,
  CalendarDays,
  Clock,
  ChevronLeft,
  ChevronRight,
  Plus,
  ChevronDown,
  User,
  Users,
  RefreshCw,
} from 'lucide-react'
import clsx from 'clsx'

const NAV_ITEMS = [
  { label: 'Scheduling', path: '/scheduling', icon: Link2 },
  { label: 'Meetings', path: '/meetings', icon: CalendarDays },
  { label: 'Availability', path: '/availability', icon: Clock },
]

export default function Sidebar({ collapsed, onToggle, onCreateEvent }) {
  const location = useLocation()
  const [createOpen, setCreateOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setCreateOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <>
      {/* Mobile overlay */}
      {!collapsed && (
        <div className="fixed inset-0 bg-black/30 z-30 md:hidden" onClick={onToggle} />
      )}
      <aside
        className={clsx(
          'fixed left-0 top-0 h-screen bg-white border-r border-gray-200 z-40',
          'flex flex-col transition-all duration-300 overflow-hidden',
          // On mobile: slide in/out; on desktop: collapse to narrow
          collapsed ? 'w-0 md:w-[64px] -translate-x-full md:translate-x-0' : 'w-64 translate-x-0'
        )}
      >
      {/* Header: Logo + Collapse Toggle */}
      <div className="relative flex items-center h-20 px-6 shrink-0">
        {!collapsed ? (
          <img src="/Calendly_idA4lPSDzF_0.svg" alt="Calendly" className="h-7 ml-1" />
        ) : (
          <img src="/logo.svg" alt="Calendly" className="w-9 h-9 mx-auto" />
        )}
        <button
          onClick={onToggle}
          className="p-1 rounded text-gray-500 hover:bg-gray-100 transition-colors"
        >
          {collapsed ? <ChevronRight size={16} /> : <div className="flex"><ChevronLeft size={14} /><ChevronLeft size={14} className="-ml-1.5" /></div>}
        </button>
      </div>

      {/* Create Button with Dropdown */}
      <div className="px-5 pt-1 pb-3 relative" ref={dropdownRef}>
        {!collapsed ? (
          <button
            onClick={() => setCreateOpen(!createOpen)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-full text-sm font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
          >
            <Plus size={16} className="text-gray-900" />
            Create
          </button>
        ) : (
          <button
            onClick={onToggle}
            className="w-10 h-10 mx-auto flex items-center justify-center border border-gray-300 rounded-full text-gray-900 hover:bg-gray-50 transition-colors"
          >
            <Plus size={16} />
          </button>
        )}

        {/* Dropdown */}
        {createOpen && !collapsed && (
          <div className="absolute left-5 right-5 top-[52px] bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-2">
            <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Event Types</div>
            <button
              onClick={() => { setCreateOpen(false); onCreateEvent?.('one-on-one') }}
              className="w-full px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="text-sm font-semibold text-[#006bff]">One-on-one</div>
              <div className="text-xs text-gray-500 mt-0.5">1 host → 1 invitee</div>
              <div className="text-xs text-gray-400">Good for coffee chats, 1:1 interviews, etc.</div>
            </button>
            <button
              onClick={() => { setCreateOpen(false); onCreateEvent?.('group') }}
              className="w-full px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="text-sm font-semibold text-[#006bff]">Group</div>
              <div className="text-xs text-gray-500 mt-0.5">1 host → Multiple invitees</div>
              <div className="text-xs text-gray-400">Webinars, online classes, etc.</div>
            </button>
            <button
              onClick={() => { setCreateOpen(false); onCreateEvent?.('round-robin') }}
              className="w-full px-4 py-2.5 text-left hover:bg-gray-50 transition-colors border-b border-gray-100"
            >
              <div className="text-sm font-semibold text-[#006bff]">Round robin</div>
              <div className="text-xs text-gray-500 mt-0.5">Rotating hosts → 1 invitee</div>
              <div className="text-xs text-gray-400">Distribute meetings between team members</div>
            </button>
            <button
              onClick={() => { setCreateOpen(false); onCreateEvent?.('single-use-link') }}
              className="w-full px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="text-sm font-semibold text-[#006bff]">Single-use link</div>
              <div className="text-xs text-gray-500 mt-0.5">One-time booking link</div>
              <div className="text-xs text-gray-400">Creates a temporary link for an existing event type</div>
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-1">
        {NAV_ITEMS.map(({ label, path, icon: Icon }) => {
          const isActive = location.pathname.startsWith(path)
          return (
            <Link
              key={path}
              to={path}
              className={clsx(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-semibold transition-colors',
                isActive
                  ? 'bg-blue-50 text-[#006bff]'
                  : 'text-gray-700 hover:bg-gray-100/50',
                collapsed && 'justify-center px-0'
              )}
              title={collapsed ? label : undefined}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          )
        })}
      </nav>

    </aside>
    </>
  )
}
