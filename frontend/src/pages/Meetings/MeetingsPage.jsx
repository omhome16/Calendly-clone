import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ChevronDown, HelpCircle, Download, SlidersHorizontal,
  ChevronRight, ChevronLeft, X, Calendar, Clock, RefreshCw, XCircle,
  Mail, MapPin, Globe, MessageSquare, Send, FileText
} from 'lucide-react'
import { format, isToday, isTomorrow, parseISO, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isBefore, startOfDay, getDay } from 'date-fns'
import { bookingsApi, slotsApi, notificationsApi } from '../../api'

export default function MeetingsPage() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState('upcoming')
  const [showBuffers, setShowBuffers] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [cancelModal, setCancelModal] = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const [rescheduleModal, setRescheduleModal] = useState(null)
  const [rescheduleStep, setRescheduleStep] = useState('choose')
  const [rescheduleMonth, setRescheduleMonth] = useState(new Date())
  const [rescheduleDate, setRescheduleDate] = useState(null)
  const [rescheduleSlot, setRescheduleSlot] = useState(null)
  const [rescheduleEmail, setRescheduleEmail] = useState({ to: '', subject: '', body: '' })
  const [filterOpen, setFilterOpen] = useState(false)
  const filterRef = useRef(null)

  // Queries for 3 tabs
  const { data: upcoming = [] } = useQuery({ queryKey: ['bookings', 'upcoming'], queryFn: () => bookingsApi.list('upcoming') })
  const { data: past = [] } = useQuery({ queryKey: ['bookings', 'past'], queryFn: () => bookingsApi.list('past') })
  const { data: cancelled = [] } = useQuery({ queryKey: ['bookings', 'cancelled'], queryFn: () => bookingsApi.list('cancelled') })

  const bookings = tab === 'upcoming' ? upcoming : tab === 'past' ? past : cancelled

  // Reschedule: fetch available days for the booking's event type
  const rescheduleSlug = rescheduleModal?.event_type?.slug
  const { data: rescheduleAvailDays } = useQuery({
    queryKey: ['reschedule-avail-days', rescheduleSlug, format(rescheduleMonth, 'yyyy'), format(rescheduleMonth, 'M')],
    queryFn: () => slotsApi.getAvailableDays(rescheduleSlug, rescheduleMonth.getFullYear(), rescheduleMonth.getMonth() + 1),
    enabled: !!rescheduleSlug && rescheduleStep === 'now',
  })
  const rescheduleAvailSet = new Set(rescheduleAvailDays?.available_dates || [])

  // Reschedule: fetch slots for selected date
  const rescheduleDateStr = rescheduleDate ? format(rescheduleDate, 'yyyy-MM-dd') : null
  const { data: rescheduleSlots = [], isLoading: loadingRescheduleSlots } = useQuery({
    queryKey: ['reschedule-slots', rescheduleSlug, rescheduleDateStr],
    queryFn: () => slotsApi.getSlots(rescheduleSlug, rescheduleDateStr),
    enabled: !!rescheduleSlug && !!rescheduleDateStr,
  })
  const availableRescheduleSlots = rescheduleSlots.filter(s => s.available)

  // Mutations
  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }) => bookingsApi.cancel(id, reason),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      setCancelModal(null)
      setRescheduleModal(null)
      setRescheduleStep('choose')
      setCancelReason('')
      const notifType = variables.notificationType || 'cancellation'
      notificationsApi.send(data.id, notifType).catch(() => {})
    },
  })
  const rescheduleMutation = useMutation({
    mutationFn: ({ id, newStartTime }) => bookingsApi.reschedule(id, newStartTime),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      setRescheduleModal(null)
      setRescheduleStep('choose')
      setRescheduleDate(null)
      setRescheduleSlot(null)
      notificationsApi.send(data.id, 'reschedule').catch(() => {})
    },
  })

  // Close filter on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setFilterOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Group bookings by date
  const groupedByDate = bookings.reduce((acc, b) => {
    const dateKey = format(parseISO(b.start_time), 'yyyy-MM-dd')
    if (!acc[dateKey]) acc[dateKey] = []
    acc[dateKey].push(b)
    return acc
  }, {})

  const handleExport = () => {
    const csvRows = [
      ['Name', 'Email', 'Event Type', 'Start Time', 'End Time', 'Status'],
      ...bookings.map(b => [
        b.invitee_name,
        b.invitee_email,
        b.event_type?.name || '',
        format(parseISO(b.start_time), 'PPpp'),
        format(parseISO(b.end_time), 'PPpp'),
        b.status
      ])
    ]
    const csvContent = csvRows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `meetings_${tab}_${format(new Date(), 'yyyy-MM-dd')}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const getDateLabel = (dateStr) => {
    const d = parseISO(dateStr)
    if (isToday(d)) return `Today, ${format(d, 'dd MMMM yyyy')}`
    if (isTomorrow(d)) return `Tomorrow, ${format(d, 'dd MMMM yyyy')}`
    return format(d, 'EEEE, dd MMMM yyyy')
  }

  const openReschedule = (booking) => {
    setRescheduleModal(booking)
    setRescheduleStep('choose')
    setRescheduleMonth(new Date())
    setRescheduleDate(null)
    setRescheduleSlot(null)
    setRescheduleEmail({
      to: booking.invitee_email,
      subject: 'Schedule a new time with me',
      body: `Hi ${booking.invitee_name},\n\nUnfortunately, I can no longer make our original meeting time. Could you please select a new time?\n\nThanks for the flexibility!`
    })
  }

  const parseCustomAnswers = (jsonStr) => {
    if (!jsonStr) return null
    try {
      return JSON.parse(jsonStr)
    } catch {
      return null
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-100 relative">
      {/* Top Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-4 sm:px-8 pt-6 pb-4">
          <div className="flex items-center gap-2 mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Meetings</h1>
            <HelpCircle size={16} className="text-gray-400 cursor-help" />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
              <div className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-[#0B3558] cursor-pointer hover:border-gray-400 transition-colors bg-white">
                My Calendly <ChevronDown size={14} />
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                Show buffers
                <button
                  onClick={() => setShowBuffers(!showBuffers)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${showBuffers ? 'bg-[#006BFF]' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${showBuffers ? 'left-[18px]' : 'left-0.5'}`} />
                </button>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              Displaying {bookings.length} Events
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 w-full">
        <div className="border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden">
          {/* Tabs row — 3 tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 sm:px-6 border-b border-gray-200 bg-white">
            <div className="flex gap-4 sm:gap-6">
              {[
                { key: 'upcoming', label: 'Upcoming' },
                { key: 'past', label: 'Past' },
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`py-4 text-sm font-semibold border-b-2 transition-colors ${tab === t.key ? 'border-[#006BFF] text-[#006BFF]' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 pb-3 sm:pb-0">
              <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-full text-sm font-medium text-[#0B3558] hover:border-gray-400 transition-colors">
                <Download size={14} /> Export
              </button>
            </div>
          </div>

          {/* Booking list */}
          <div>
            {Object.keys(groupedByDate).length === 0 && (
              <div className="py-16 text-center text-gray-500">
                <Calendar size={40} className="mx-auto mb-3 text-gray-300" />
                <p className="font-medium">No {tab} meetings</p>
                <p className="text-sm mt-1">Meetings will appear here when bookings are made.</p>
              </div>
            )}

            {Object.entries(groupedByDate).map(([dateKey, dateBookings]) => (
              <div key={dateKey}>
                <div className="px-4 sm:px-6 py-2 text-sm font-medium text-[#006BFF] bg-gray-50/50">
                  {getDateLabel(dateKey)}
                </div>

                {dateBookings.map(b => {
                  const isExpanded = expanded === b.id
                  const startLocal = parseISO(b.start_time)
                  const endLocal = parseISO(b.end_time)
                  const customAnswers = parseCustomAnswers(b.custom_answers)
                  const isPast = isBefore(startLocal, new Date())
                  return (
                    <div key={b.id} className="border-b border-gray-200 last:border-0">
                      {/* Main row */}
                      <div className="flex flex-col sm:flex-row sm:items-center px-4 sm:px-6 py-4 hover:bg-gray-50 transition-colors gap-2 sm:gap-0">
                        <div className="hidden sm:flex w-8 h-8 rounded-full mr-4 shrink-0 items-center justify-center" style={{ backgroundColor: b.event_type?.color || '#7C3AED' }} />
                        <div className="sm:w-40 shrink-0">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {format(startLocal, 'h:mm a')} – {format(endLocal, 'h:mm a')}
                          </div>
                          {showBuffers && (b.event_type?.buffer_before > 0 || b.event_type?.buffer_after > 0) && (
                            <div className="text-xs text-gray-400 mt-0.5 truncate">
                              Buffer: {b.event_type?.buffer_before || 0}m before, {b.event_type?.buffer_after || 0}m after
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 sm:ml-2">
                          <div className="text-sm font-semibold text-gray-900 truncate">{b.invitee_name}</div>
                          <div className="text-sm text-gray-500 truncate">{b.event_type?.name}</div>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3 mt-1 sm:mt-0 flex-wrap">
                          {b.status === 'cancelled' && (
                            b.cancel_reason === 'Rescheduled via email share' ? (
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">Rescheduling underway</span>
                            ) : (
                              <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full font-medium">Cancelled</span>
                            )
                          )}
                          {b.status === 'rescheduled' && (
                            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full font-medium">Rescheduled</span>
                          )}
                          <button
                            onClick={() => setExpanded(isExpanded ? null : b.id)}
                            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 ml-auto"
                          >
                            Details <ChevronRight size={14} className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                          </button>
                        </div>
                      </div>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="px-4 sm:px-6 py-4 bg-gray-50 border-t border-gray-200">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                            <div className="flex items-start gap-2">
                              <Mail size={14} className="text-gray-400 mt-0.5 shrink-0" />
                              <div>
                                <div className="text-xs text-gray-500 uppercase font-medium">Email</div>
                                <div className="font-medium text-gray-900">{b.invitee_email}</div>
                              </div>
                            </div>
                            <div className="flex items-start gap-2">
                              <MapPin size={14} className="text-gray-400 mt-0.5 shrink-0" />
                              <div>
                                <div className="text-xs text-gray-500 uppercase font-medium">Location</div>
                                <div className="font-medium text-gray-900">{b.event_type?.location || 'N/A'}</div>
                              </div>
                            </div>
                            <div className="flex items-start gap-2">
                              <Globe size={14} className="text-gray-400 mt-0.5 shrink-0" />
                              <div>
                                <div className="text-xs text-gray-500 uppercase font-medium">Invitee Time Zone</div>
                                <div className="font-medium text-gray-900">{b.invitee_timezone || 'Asia/Kolkata'}</div>
                              </div>
                            </div>
                            {/* Issue #4: Show event description */}
                            {b.event_type?.description && (
                              <div className="flex items-start gap-2">
                                <FileText size={14} className="text-gray-400 mt-0.5 shrink-0" />
                                <div>
                                  <div className="text-xs text-gray-500 uppercase font-medium">Description</div>
                                  <div className="font-medium text-gray-900">{b.event_type.description}</div>
                                </div>
                              </div>
                            )}
                            {b.notes && (
                              <div className="flex items-start gap-2">
                                <MessageSquare size={14} className="text-gray-400 mt-0.5 shrink-0" />
                                <div>
                                  <div className="text-xs text-gray-500 uppercase font-medium">Notes</div>
                                  <div className="font-medium text-gray-900">{b.notes}</div>
                                </div>
                              </div>
                            )}
                            {b.guest_emails && (
                              <div className="col-span-1 sm:col-span-2 flex items-start gap-2">
                                <Mail size={14} className="text-gray-400 mt-0.5 shrink-0" />
                                <div>
                                  <div className="text-xs text-gray-500 uppercase font-medium">Guests</div>
                                  <div className="font-medium text-gray-900">{b.guest_emails}</div>
                                </div>
                              </div>
                            )}
                            {/* Issue #4: Show invitee question */}
                            {b.event_type?.custom_questions && (
                              <div className="col-span-1 sm:col-span-2 flex items-start gap-2">
                                <MessageSquare size={14} className="text-gray-400 mt-0.5 shrink-0" />
                                <div>
                                  <div className="text-xs text-gray-500 uppercase font-medium">Invitee Question</div>
                                  <div className="text-xs text-gray-500 mb-0.5">{b.event_type.custom_questions}</div>
                                  <div className="font-medium text-gray-900">{b.custom_answers || 'No answer provided'}</div>
                                </div>
                              </div>
                            )}
                            {customAnswers && !b.event_type?.custom_questions && (
                              <div className="col-span-1 sm:col-span-2 flex items-start gap-2">
                                <MessageSquare size={14} className="text-gray-400 mt-0.5 shrink-0" />
                                <div>
                                  <div className="text-xs text-gray-500 uppercase font-medium mb-1">Questions</div>
                                  {Object.entries(customAnswers).map(([q, a]) => (
                                    <div key={q} className="mb-1.5">
                                      <div className="text-xs text-gray-500">{q}</div>
                                      <div className="font-medium text-gray-900">{a}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Actions — Issue #11: cancelled can reschedule, past completed cannot */}
                          {b.status === 'active' && !isPast && (
                            <div className="flex items-center gap-3 mt-4 pt-3 border-t border-gray-200 flex-wrap">
                              <button
                                onClick={() => openReschedule(b)}
                                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-white transition-colors"
                              >
                                <RefreshCw size={14} /> Reschedule
                              </button>
                              <button
                                onClick={() => setCancelModal(b)}
                                className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-50 transition-colors"
                              >
                                <XCircle size={14} /> Cancel
                              </button>
                            </div>
                          )}
                          {b.status === 'cancelled' && (
                            <div className="flex items-center gap-3 mt-4 pt-3 border-t border-gray-200 flex-wrap">
                              <button
                                onClick={() => openReschedule(b)}
                                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-white transition-colors"
                              >
                                <RefreshCw size={14} /> Reschedule
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}

            {bookings.length > 0 && (
              <div className="py-4 text-center text-sm text-[#006BFF]">
                You've reached the end of the list
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cancel Modal */}
      {cancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Cancel Meeting</h3>
              <button onClick={() => setCancelModal(null)} className="p-1 text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to cancel the meeting with <strong>{cancelModal.invitee_name}</strong>?
            </p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Reason for cancellation (optional)"
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 mb-4 resize-none"
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setCancelModal(null)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">
                Keep Meeting
              </button>
              <button
                onClick={() => cancelMutation.mutate({ id: cancelModal.id, reason: cancelReason })}
                disabled={cancelMutation.isPending}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {cancelMutation.isPending ? 'Cancelling...' : 'Cancel Meeting'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal — Issue #7: shows available slots */}
      {rescheduleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Reschedule meeting</h3>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: rescheduleModal.event_type?.color || '#7C3AED' }} />
                  <span className="text-sm text-gray-500">{rescheduleModal.event_type?.name}</span>
                </div>
              </div>
              <button onClick={() => { setRescheduleModal(null); setRescheduleStep('choose') }} className="p-1 text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              {/* Step 1: Choose method */}
              {rescheduleStep === 'choose' && (
                <div>
                  <p className="text-sm text-gray-600 mb-5">How would you like to reschedule this meeting?</p>
                  <div className="space-y-3">
                    <button
                      onClick={() => setRescheduleStep('share')}
                      className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-[#006BFF] hover:bg-blue-50/30 transition-all text-left group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 group-hover:bg-blue-100">
                        <Mail size={20} className="text-[#006BFF]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900">Share new times to meet</div>
                        <div className="text-sm text-gray-500">Ask your invitee(s) to select a new time to meet.</div>
                      </div>
                      <ChevronRight size={16} className="text-gray-400 shrink-0" />
                    </button>
                    <button
                      onClick={() => setRescheduleStep('now')}
                      className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-[#006BFF] hover:bg-blue-50/30 transition-all text-left group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 group-hover:bg-blue-100">
                        <Calendar size={20} className="text-[#006BFF]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900">Reschedule meeting now</div>
                        <div className="text-sm text-gray-500">Select a new time from available slots.</div>
                      </div>
                      <ChevronRight size={16} className="text-gray-400 shrink-0" />
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2a: Share via email */}
              {rescheduleStep === 'share' && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-semibold text-gray-900">Share via email</span>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-800">
                    This will send a reschedule request to the invitee.
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">To:</label>
                      <input
                        value={rescheduleEmail.to}
                        onChange={(e) => setRescheduleEmail(prev => ({ ...prev, to: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Subject:</label>
                      <input
                        value={rescheduleEmail.subject}
                        onChange={(e) => setRescheduleEmail(prev => ({ ...prev, subject: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Message:</label>
                      <textarea
                        value={rescheduleEmail.body}
                        onChange={(e) => setRescheduleEmail(prev => ({ ...prev, body: e.target.value }))}
                        rows={5}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 resize-none"
                      />
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                      Sending this request will cancel the currently scheduled meeting on {format(parseISO(rescheduleModal.start_time), 'dd MMM yyyy')}.
                    </div>
                  </div>
                  <div className="flex justify-between mt-5">
                    <button onClick={() => setRescheduleStep('choose')} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
                      Back
                    </button>
                    <button
                      onClick={() => {
                        cancelMutation.mutate({ 
                          id: rescheduleModal.id, 
                          reason: 'Rescheduled via email share',
                          notificationType: 'reschedule_request'
                        })
                      }}
                      className="flex items-center gap-2 px-4 py-2 text-sm bg-[#006BFF] text-white rounded-lg hover:bg-blue-700"
                    >
                      <Send size={14} /> Send Request
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2b: Pick new time from available slots — Issue #7 */}
              {rescheduleStep === 'now' && (
                <div>
                  <p className="text-sm text-gray-600 mb-4">
                    Select a new time for the meeting with <strong>{rescheduleModal.invitee_name}</strong>
                  </p>

                  <div className="flex flex-col lg:flex-row gap-4">
                    {/* Mini calendar */}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-3">
                        <button onClick={() => setRescheduleMonth(m => subMonths(m, 1))} className="p-1 rounded hover:bg-gray-100">
                          <ChevronLeft size={16} />
                        </button>
                        <span className="text-sm font-semibold">{format(rescheduleMonth, 'MMMM yyyy')}</span>
                        <button onClick={() => setRescheduleMonth(m => addMonths(m, 1))} className="p-1 rounded hover:bg-gray-100">
                          <ChevronRight size={16} />
                        </button>
                      </div>
                      <div className="grid grid-cols-7 gap-0.5">
                        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                          <div key={i} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
                        ))}
                        {(() => {
                          const mStart = startOfMonth(rescheduleMonth)
                          const mEnd = endOfMonth(rescheduleMonth)
                          const days = eachDayOfInterval({ start: mStart, end: mEnd })
                          const pad = (getDay(mStart) + 6) % 7
                          return [...Array(pad).fill(null), ...days].map((day, i) => {
                            if (!day) return <div key={`p-${i}`} />
                            const dayStr = format(day, 'yyyy-MM-dd')
                            const isAvail = rescheduleAvailSet.has(dayStr)
                            const isPastDay = isBefore(day, startOfDay(new Date()))
                            const isSel = rescheduleDate && isSameDay(day, rescheduleDate)
                            return (
                              <button
                                key={dayStr}
                                disabled={isPastDay || !isAvail}
                                onClick={() => { setRescheduleDate(day); setRescheduleSlot(null) }}
                                className={`w-8 h-8 rounded-full text-xs mx-auto flex items-center justify-center transition-all
                                  ${isPastDay || !isAvail ? 'text-gray-300' : ''}
                                  ${!isPastDay && isAvail && !isSel ? 'text-[#006BFF] hover:bg-blue-50' : ''}
                                  ${isSel ? 'bg-[#006BFF] text-white' : ''}`}
                              >
                                {format(day, 'd')}
                              </button>
                            )
                          })
                        })()}
                      </div>
                    </div>

                    {/* Available slots */}
                    {rescheduleDate && (
                      <div className="w-full lg:w-44 shrink-0">
                        <p className="text-xs font-semibold text-gray-900 mb-2">{format(rescheduleDate, 'EEE, MMM d')}</p>
                        {loadingRescheduleSlots ? (
                          <p className="text-xs text-gray-400 py-4">Loading...</p>
                        ) : availableRescheduleSlots.length === 0 ? (
                          <p className="text-xs text-gray-400 py-4">No available slots</p>
                        ) : (
                          <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
                            {availableRescheduleSlots.map((slot, i) => {
                              const isSel = rescheduleSlot?.start === slot.start
                              return (
                                <button
                                  key={i}
                                  onClick={() => setRescheduleSlot(slot)}
                                  className={`w-full text-center py-2 px-2 border rounded-lg text-xs font-semibold transition-all ${
                                    isSel ? 'bg-[#006BFF] text-white border-[#006BFF]' : 'border-blue-200 text-[#006BFF] hover:bg-blue-50'
                                  }`}
                                >
                                  {format(new Date(slot.start), 'h:mm a')}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between mt-5 pt-4 border-t border-gray-200">
                    <button onClick={() => setRescheduleStep('choose')} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
                      Back
                    </button>
                    <button
                      onClick={() => rescheduleMutation.mutate({ id: rescheduleModal.id, newStartTime: rescheduleSlot.start })}
                      disabled={!rescheduleSlot || rescheduleMutation.isPending}
                      className="px-4 py-2 text-sm bg-[#006BFF] text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {rescheduleMutation.isPending ? 'Rescheduling...' : 'Reschedule'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
