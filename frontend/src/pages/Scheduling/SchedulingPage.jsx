import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Search, Copy, ExternalLink, MoreVertical, Link2, CheckCircle,
  ChevronDown, X, HelpCircle, Clock, MapPin, Calendar, User, Pencil, Trash2,
  CalendarPlus, Share, Heart
} from 'lucide-react'
import { format } from 'date-fns'
import { eventTypesApi, singleUseLinksApi } from '../../api'
import { useLayout } from '../../components/Layout/Layout'
import CreateEventPanel from './CreateEventPanel'

const CATEGORY_LABELS = {
  'one-on-one': 'One on One',
  'group': 'Group',
  'round-robin': 'Round Robin',
}

export default function SchedulingPage() {
  const queryClient = useQueryClient()
  const { showCreatePanel, createEventCategory, handleCreateEvent, closeCreatePanel, showSingleUseLinkModal, setShowSingleUseLinkModal } = useLayout()
  const [activeTab, setActiveTab] = useState('event-types')
  const [search, setSearch] = useState('')
  const [copiedId, setCopiedId] = useState(null)
  const [menuId, setMenuId] = useState(null)
  const [editingEvent, setEditingEvent] = useState(null)
  const menuRef = useRef(null)

  // Queries
  const { data: eventTypes = [], isLoading } = useQuery({ queryKey: ['eventTypes'], queryFn: eventTypesApi.list })
  const { data: singleUseLinks = [] } = useQuery({ queryKey: ['singleUseLinks'], queryFn: singleUseLinksApi.list })

  // Mutations
  const deleteMutation = useMutation({
    mutationFn: (id) => eventTypesApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['eventTypes'] }),
  })
  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }) => eventTypesApi.update(id, { is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['eventTypes'] }),
  })
  const createSingleUseMutation = useMutation({
    mutationFn: (eventTypeId) => singleUseLinksApi.create(eventTypeId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['singleUseLinks'] }),
  })
  const deleteSingleUseMutation = useMutation({
    mutationFn: (id) => singleUseLinksApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['singleUseLinks'] }),
  })

  // Close menus on outside click
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuId(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filteredEvents = eventTypes.filter(et =>
    et.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleCopyLink = (slug) => {
    navigator.clipboard.writeText(`${window.location.origin}/book/${slug}`)
    setCopiedId(slug)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleEdit = (et) => {
    setMenuId(null)
    setEditingEvent(et)
  }

  const handleDelete = (id) => {
    setMenuId(null)
    if (confirm('Are you sure you want to delete this event type?')) {
      deleteMutation.mutate(id)
    }
  }

  const handleCreateSingleUse = (eventTypeId) => {
    setMenuId(null)
    createSingleUseMutation.mutate(eventTypeId, {
      onSuccess: () => {
        setActiveTab('single-use-links')
        if (showSingleUseLinkModal) setShowSingleUseLinkModal(false)
      }
    })
  }

  const user = { name: 'Alex Johnson', initial: 'A' }

  // Check if we need to show the create panel from sidebar or + Create button
  const isPanelOpen = showCreatePanel || editingEvent

  return (
    <div className="flex h-full bg-gray-100 relative">
      {/* Main content */}
      <div className={`flex-1 transition-all duration-300 ${isPanelOpen ? 'mr-[400px]' : ''}`}>
        {/* White header block */}
        <div className="bg-white border-b border-gray-200">
          {/* Title row */}
          <div className="px-8 pt-6 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900">Scheduling</h1>
                <HelpCircle size={16} className="text-gray-400 cursor-help" />
              </div>
              <button
                onClick={() => handleCreateEvent('one-on-one')}
                className="flex items-center gap-1.5 pl-4 pr-3.5 py-2 bg-[#006BFF] hover:bg-blue-600 text-white rounded-full text-sm font-semibold transition-colors duration-150"
              >
                <Plus size={16} strokeWidth={2.5} />
                Create
                <ChevronDown size={14} className="ml-0.5" />
              </button>
            </div>
          </div>

          {/* Tabs — border-b-2, -mb-px */}
          <div className="px-8 border-b border-gray-200">
            <div className="flex gap-6">
              <button
                onClick={() => setActiveTab('event-types')}
                className={`pb-3 text-sm font-semibold border-b-2 transition-colors duration-150 -mb-px ${activeTab === 'event-types' ? 'border-[#006BFF] text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
              >
                Event types
              </button>
              <button
                onClick={() => setActiveTab('single-use-links')}
                className={`pb-3 text-sm font-semibold border-b-2 transition-colors duration-150 -mb-px ${activeTab === 'single-use-links' ? 'border-[#006BFF] text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
              >
                Single-use links
              </button>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="px-8 py-6 w-full">
          {activeTab === 'event-types' && (
            <>
              {/* Search — Issue #5: fixed pl-10 for icon spacing */}
              <div className="mb-5">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search event types"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-64 pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>
              </div>

              {/* User header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-xs font-bold">
                    {user.initial}
                  </div>
                  <span className="text-sm font-medium text-gray-900">{user.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => window.open(`/book`, '_blank')}
                    className="flex items-center gap-1.5 text-xs text-[#006BFF] hover:text-blue-600 font-medium"
                  >
                    View landing page
                    <ExternalLink size={13} />
                  </button>
                </div>
              </div>

              {/* Event Type Cards */}
              {filteredEvents.length === 0 && !isLoading && (
                <div className="text-center py-16 text-gray-500">
                  <Calendar size={40} className="mx-auto mb-3 text-gray-300" />
                  <p className="font-medium">No event types yet</p>
                  <p className="text-sm mt-1">Create your first event type to get started.</p>
                </div>
              )}

              {filteredEvents.map(et => (
                <div key={et.id} className="relative group rounded border border-gray-200 bg-white mb-3 hover:shadow-md transition-shadow duration-150">
                  {/* Left color bar */}
                  <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l" style={{ backgroundColor: et.color || '#ab4eff' }} />

                  <div className="flex items-center justify-between py-4 pl-6 pr-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <input type="checkbox" className="mt-1 w-4 h-4 rounded-none border-gray-300 text-[#006BFF] focus:ring-[#006BFF] cursor-pointer accent-[#006BFF]" />
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-gray-900 leading-tight">{et.name}</h3>
                        <div className="flex items-center gap-1 text-xs text-gray-500 mt-1 flex-wrap">
                          <span>{et.duration} min</span>
                          <span className="text-gray-400">·</span>
                          <span>{et.location}</span>
                          <span className="text-gray-400">·</span>
                          <span>{CATEGORY_LABELS[et.event_category] || 'One on One'}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">Weekdays, 9 am - 5 pm</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      {/* Issue #1: Edit/Delete shown on hover, left of Copy link */}
                      <button
                        onClick={() => handleEdit(et)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-[#006BFF] hover:bg-blue-50 rounded-lg transition-all duration-150"
                        title="Edit"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(et.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all duration-150"
                        title="Delete"
                      >
                        <Trash2 size={15} />
                      </button>

                      {/* Copy link pill */}
                      <button
                        onClick={() => handleCopyLink(et.slug)}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 border border-gray-300 rounded-full text-xs font-medium text-gray-900 hover:bg-gray-50 hover:border-gray-400 transition-colors duration-150"
                      >
                        <Link2 size={14} className="text-gray-500" />
                        {copiedId === et.slug ? 'Copied!' : 'Copy link'}
                      </button>

                      {/* External link */}
                      <button
                        onClick={() => window.open(`/book/${et.slug}`, '_blank')}
                        className="text-gray-400 hover:text-[#006BFF] transition-colors duration-150"
                      >
                        <ExternalLink size={16} />
                      </button>

                      {/* Small kebab for toggle active */}
                      <div className="relative" ref={menuId === et.id ? menuRef : null}>
                        <button
                          onClick={() => setMenuId(menuId === et.id ? null : et.id)}
                          className="text-gray-400 hover:text-gray-500 transition-colors duration-150"
                        >
                          <MoreVertical size={18} />
                        </button>
                        {menuId === et.id && (
                          <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-md z-20 py-1 w-44">
                            <button
                              onClick={() => handleCreateSingleUse(et.id)}
                              className="w-full px-4 py-2 text-left text-xs text-gray-900 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <Link2 size={14} /> Create single-use link
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {activeTab === 'single-use-links' && (
            <SingleUseLinksTab
              links={singleUseLinks}
              eventTypes={eventTypes}
              onCopy={handleCopyLink}
              onDelete={(id) => deleteSingleUseMutation.mutate(id)}
            />
          )}
        </div>
      </div>

      {/* Right Sidebar Panel for Create/Edit */}
      {isPanelOpen && (
        <CreateEventPanel
          editingEvent={editingEvent}
          category={createEventCategory || editingEvent?.event_category || 'one-on-one'}
          onClose={() => { closeCreatePanel(); setEditingEvent(null) }}
        />
      )}

      {/* Single Use Link Modal */}
      {showSingleUseLinkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl animate-fadeIn">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Create single-use link</h3>
              <button onClick={() => setShowSingleUseLinkModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Select an event type to generate a one-time booking link. This link will expire after it's used once.
            </p>
            <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
              {eventTypes.filter(et => et.is_active).map(et => (
                <button
                  key={et.id}
                  onClick={() => handleCreateSingleUse(et.id)}
                  className="w-full flex items-center text-left p-3 border border-gray-200 rounded-lg hover:border-blue-600 hover:bg-blue-50 transition-colors"
                >
                  <div className="w-3 h-3 rounded-full mr-3 shrink-0" style={{ backgroundColor: et.color }} />
                  <span className="text-sm font-medium text-gray-900 flex-1">{et.name}</span>
                </button>
              ))}
            </div>
            <div className="flex justify-end pt-4 border-t border-gray-200 mt-4">
              <button onClick={() => setShowSingleUseLinkModal(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SingleUseLinksTab({ links, eventTypes, onCopy, onDelete }) {
  const [search, setSearch] = useState('')
  const [copiedId, setCopiedId] = useState(null)
  const [menuOpenId, setMenuOpenId] = useState(null)

  const filtered = links.filter(link => {
    const et = eventTypes.find(e => e.id === link.event_type_id)
    return et?.name?.toLowerCase().includes(search.toLowerCase())
  })

  const handleCopyLink = (link) => {
    const et = eventTypes.find(e => e.id === link.event_type_id)
    const url = `${window.location.origin}/book/${et?.slug}?token=${link.token}`
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(link.id)
      setTimeout(() => setCopiedId(null), 2000)
    }).catch(() => {
      const textArea = document.createElement('textarea')
      textArea.value = url
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopiedId(link.id)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <div className="relative max-w-md flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search single-use links"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Link2 size={40} className="mx-auto mb-3 text-[#dadce0]" />
          <p className="font-medium">No single-use links</p>
          <p className="text-sm mt-1">Create one from the event type menu.</p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase first:rounded-tl-lg">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Created</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 last:rounded-tr-lg"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(link => {
                const et = eventTypes.find(e => e.id === link.event_type_id)
                return (
                  <tr key={link.id} className="group border-b border-gray-200 last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: et?.color || '#7C3AED' }} />
                        <span className="text-sm font-medium text-gray-900">{et?.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {format(new Date(link.created_at), 'dd/MM/yyyy')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        link.status === 'created' ? 'bg-blue-50 text-blue-700' :
                        link.status === 'used' ? 'bg-green-50 text-green-700' :
                        'bg-red-50 text-red-600'
                      }`}>
                        {link.status === 'created' ? 'Active' : link.status === 'used' ? 'Used' : link.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => onDelete(link.id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all duration-150"
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                        <button
                          onClick={() => handleCopyLink(link)}
                          className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-full text-xs text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          {copiedId === link.id ? (
                            <><CheckCircle size={12} className="text-green-600" /> Copied!</>
                          ) : (
                            <><Link2 size={12} /> Copy link</>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
