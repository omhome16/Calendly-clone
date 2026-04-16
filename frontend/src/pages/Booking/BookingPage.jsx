import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  eachDayOfInterval, isSameDay, isToday,
  isBefore, startOfDay, getDay, addDays, isAfter,
} from 'date-fns'
import { ChevronLeft, ChevronRight, Clock, Globe, Monitor, Link2, ChevronDown, Plus, Menu, Search } from 'lucide-react'
import { bookingsApi, slotsApi, notificationsApi } from '../../api'
import Spinner from '../../components/shared/Spinner'

// Common timezone list for the dropdown
const COMMON_TIMEZONES = (() => {
  try {
    return Intl.supportedValuesOf('timeZone')
  } catch {
    // Fallback for older browsers
    return [
      'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
      'America/Toronto', 'America/Vancouver', 'America/Sao_Paulo',
      'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Moscow',
      'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo', 'Asia/Shanghai',
      'Australia/Sydney', 'Pacific/Auckland',
      'UTC',
    ]
  }
})()

function getTimezoneLabel(tz) {
  try {
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' })
    const parts = formatter.formatToParts(now)
    const tzName = parts.find(p => p.type === 'timeZoneName')?.value || ''
    const offset = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' })
      .formatToParts(now).find(p => p.type === 'timeZoneName')?.value || ''
    return `${tz.replace(/_/g, ' ')} (${tzName})`
  } catch {
    return tz
  }
}

function CalendarGrid({ currentMonth, selectedDate, onSelectDate, availableDays, maxDate }) {
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

  const startPad = (getDay(monthStart) + 6) % 7
  const paddedDays = [
    ...Array(startPad).fill(null),
    ...days,
  ]

  const today = startOfDay(new Date())
  const maxDay = maxDate ? new Date(maxDate) : null

  return (
    <div>
      <div className="grid grid-cols-7 mb-2">
        {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(d => (
          <div key={d} className="text-center text-xs font-semibold text-gray-500 py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {paddedDays.map((day, i) => {
          if (!day) return <div key={`pad-${i}`} />

          const isPast = isBefore(day, today)
          const isBeyondMax = maxDay && isAfter(day, maxDay)
          const isSelected = selectedDate && isSameDay(day, selectedDate)
          const isTodayDay = isToday(day)
          const isAvailable = availableDays?.has(format(day, 'yyyy-MM-dd'))
          const isDisabled = isPast || !isAvailable || isBeyondMax

          return (
            <div key={day.toISOString()} className="flex flex-col items-center py-0.5">
              <button
                onClick={() => !isDisabled && onSelectDate(day)}
                disabled={isDisabled}
                className={`
                  w-10 h-10 rounded-full text-sm flex items-center justify-center transition-all font-medium relative
                  ${isDisabled ? 'text-gray-300 cursor-default' : ''}
                  ${!isDisabled && !isSelected ? 'text-[#006BFF] bg-blue-50 hover:bg-blue-100 cursor-pointer' : ''}
                  ${isSelected ? 'bg-[#006BFF] text-white hover:bg-blue-600' : ''}
                `}
              >
                {format(day, 'd')}
              </button>
              {isTodayDay && (
                <div className={`w-1 h-1 rounded-full mt-0.5 ${isSelected ? 'bg-white' : 'bg-[#006BFF]'}`} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function BookingPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [step, setStep] = useState('calendar')
  const [form, setForm] = useState({ name: '', email: '', notes: '', guests: '' })
  const [formErrors, setFormErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [showGuests, setShowGuests] = useState(false)
  const [tokenUsed, setTokenUsed] = useState(false)

  // Issue #3: Timezone selector — default to browser timezone
  const [inviteeTz, setInviteeTz] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'
  )
  const [tzSearch, setTzSearch] = useState('')
  const [tzOpen, setTzOpen] = useState(false)

  const filteredTimezones = useMemo(() => {
    if (!tzSearch) return COMMON_TIMEZONES.slice(0, 20)
    const q = tzSearch.toLowerCase()
    return COMMON_TIMEZONES.filter(tz => tz.toLowerCase().includes(q)).slice(0, 20)
  }, [tzSearch])

  // Fetch event type info
  const { data: eventType, isLoading: loadingET, error: etError } = useQuery({
    queryKey: ['public-event-type', slug],
    queryFn: () => bookingsApi.getPublicEventType(slug),
  })

  // Validate single-use token
  const { data: tokenValidation, isLoading: validatingToken } = useQuery({
    queryKey: ['validate-token', token],
    queryFn: () => bookingsApi.validateToken(token),
    enabled: !!token,
  })

  useEffect(() => {
    if (tokenValidation && !tokenValidation.valid) {
      setTokenUsed(true)
    }
  }, [tokenValidation])

  // Fetch slots when date selected — pass invitee timezone
  const dateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null
  const { data: slots = [], isLoading: loadingSlots } = useQuery({
    queryKey: ['slots', slug, dateStr, inviteeTz],
    queryFn: () => slotsApi.getSlots(slug, dateStr, inviteeTz),
    enabled: !!dateStr,
  })

  // Fetch available days — pass invitee timezone
  const { data: availableDaysData } = useQuery({
    queryKey: ['available-days', slug, format(currentMonth, 'yyyy'), format(currentMonth, 'M'), inviteeTz],
    queryFn: () => slotsApi.getAvailableDays(slug, currentMonth.getFullYear(), currentMonth.getMonth() + 1, inviteeTz),
    enabled: !!slug,
  })
  const availableDays = new Set(availableDaysData?.available_dates || [])
  const maxDate = availableDaysData?.max_date || null

  const availableSlots = slots.filter(s => s.available)

  // Issue #6: Limit month navigation based on schedule_days_ahead
  const canGoNextMonth = () => {
    if (!maxDate) return true
    const nextMonthStart = startOfMonth(addMonths(currentMonth, 1))
    return !isAfter(nextMonthStart, new Date(maxDate))
  }

  const handleSlotClick = (slot) => {
    if (selectedSlot?.start === slot.start) {
      setStep('form')
    } else {
      setSelectedSlot(slot)
    }
  }

  const validateForm = () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Name is required'
    if (!form.email.trim()) errs.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Invalid email address'
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validateForm()
    if (Object.keys(errs).length > 0) { setFormErrors(errs); return }

    setSubmitting(true)
    try {
      const payload = {
        invitee_name: form.name,
        invitee_email: form.email,
        start_time: selectedSlot.start,
        notes: form.notes || null,
        guest_emails: form.guests || null,
        custom_answers: form.customAnswer || null,
        invitee_timezone: inviteeTz,
      }
      if (token) payload.token = token

      const booking = await bookingsApi.create(slug, payload)
      notificationsApi.send(booking.id, 'confirmation').catch(() => {})
      if (token) setTokenUsed(true)
      navigate(`/book/${slug}/confirm`, {
        state: { booking, eventType, slot: selectedSlot },
      })
    } catch (err) {
      const detail = err.response?.data?.detail || ''
      if (detail.includes('single-use') || detail.includes('already been used')) {
        setTokenUsed(true)
        setFormErrors({ submit: 'This single-use link has already been used.' })
      } else {
        setFormErrors({ submit: detail || 'Failed to book. The slot may have just been taken.' })
      }
      setSubmitting(false)
    }
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
  }

  if (loadingET) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <Spinner />
    </div>
  )

  if (tokenUsed) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white rounded-xl shadow-lg p-10 text-center max-w-md">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <Link2 size={28} className="text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Link Already Used</h2>
        <p className="text-sm text-gray-500">This single-use booking link has already been used and cannot be used again. Please request a new link from the organizer.</p>
      </div>
    </div>
  )

  if (etError || !eventType) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <p className="text-lg font-semibold text-gray-700">Event type not found</p>
        <p className="text-sm text-gray-500 mt-2">This link may be invalid or inactive.</p>
      </div>
    </div>
  )

  const TimezoneSelector = () => (
    <div className="mt-6 relative">
      <div className="text-sm font-semibold text-gray-900">Time zone</div>
      <button
        onClick={() => setTzOpen(!tzOpen)}
        className="flex items-center gap-1.5 text-sm text-gray-600 mt-1 hover:text-[#006BFF] transition-colors"
      >
        <Globe size={14} className="text-gray-400 shrink-0" />
        <span className="truncate max-w-[200px]">{getTimezoneLabel(inviteeTz)}</span>
        <ChevronDown size={12} className={`text-gray-400 transition-transform ${tzOpen ? 'rotate-180' : ''}`} />
      </button>
      {tzOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setTzOpen(false)} />
          <div className="absolute bottom-full mb-1 left-0 w-72 bg-white border border-gray-200 rounded-lg shadow-xl z-20 overflow-hidden">
            <div className="p-2 border-b border-gray-100">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={tzSearch}
                  onChange={e => setTzSearch(e.target.value)}
                  placeholder="Search timezone..."
                  className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-500"
                  autoFocus
                />
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filteredTimezones.map(tz => (
                <button
                  key={tz}
                  onClick={() => { setInviteeTz(tz); setTzOpen(false); setTzSearch('') }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors ${tz === inviteeTz ? 'bg-blue-50 text-[#006BFF] font-medium' : 'text-gray-700'}`}
                >
                  {tz.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-end">
        <button
          onClick={handleCopyLink}
          className="flex items-center gap-1.5 px-4 py-1.5 border border-gray-300 rounded-full text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Link2 size={14} /> Copy link
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-start justify-center py-8 px-4">
        <div className="bg-white rounded-xl shadow-lg w-full max-w-[950px] overflow-hidden relative">
          {step === 'calendar' ? (
            <div className="flex flex-col md:flex-row min-h-[550px]">
              {/* Left panel — Event info */}
              <div className="w-full md:w-[320px] border-b md:border-b-0 md:border-r border-gray-200 p-8">
                {step === 'calendar' && selectedSlot && (
                  <button
                    onClick={() => { setSelectedSlot(null) }}
                    className="mb-4 w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center text-[#006BFF] hover:bg-gray-50"
                  >
                    <ChevronLeft size={20} />
                  </button>
                )}
                <p className="text-sm text-gray-500 mb-1">Alex Johnson</p>
                <h1 className="text-2xl font-bold text-gray-900 mb-4">{eventType.name}</h1>

                <div className="space-y-3 text-sm text-gray-600">
                  <div className="flex items-center gap-2.5">
                    <Clock size={16} className="text-gray-400 shrink-0" />
                    <span>{eventType.duration} min</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Monitor size={16} className="text-gray-400 shrink-0" />
                    <span>Web conferencing details provided upon confirmation.</span>
                  </div>
                  {selectedSlot && (
                    <>
                      <div className="flex items-center gap-2.5">
                        <svg className="w-4 h-4 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        <span>
                          {format(new Date(selectedSlot.start), 'h:mma')} - {format(new Date(selectedSlot.end), 'h:mma')}, {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <Globe size={16} className="text-gray-400 shrink-0" />
                        <span>{getTimezoneLabel(inviteeTz)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Right panel — Calendar + Slots */}
              <div className="flex-1 p-8">
                <h2 className="text-lg font-bold text-gray-900 mb-6">
                  Select a Date & Time
                </h2>

                <div className="flex flex-col lg:flex-row gap-6">
                  {/* Month calendar */}
                  <div className="flex-1">
                    {/* Month nav — Issue #6: disable future months beyond limit */}
                    <div className="flex items-center justify-center gap-4 mb-4">
                      <button
                        onClick={() => setCurrentMonth(m => subMonths(m, 1))}
                        className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <p className="font-semibold text-gray-900 text-sm min-w-[120px] text-center">
                        {format(currentMonth, 'MMMM yyyy')}
                      </p>
                      <button
                        onClick={() => canGoNextMonth() && setCurrentMonth(m => addMonths(m, 1))}
                        disabled={!canGoNextMonth()}
                        className={`p-1.5 rounded-full transition-colors ${canGoNextMonth() ? 'hover:bg-gray-100 text-[#006BFF]' : 'text-gray-300 cursor-not-allowed'}`}
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>

                    <CalendarGrid
                      currentMonth={currentMonth}
                      selectedDate={selectedDate}
                      availableDays={availableDays}
                      maxDate={maxDate}
                      onSelectDate={(day) => {
                        setSelectedDate(day)
                        setSelectedSlot(null)
                      }}
                    />

                    {/* Timezone — Issue #3: Actual timezone selector */}
                    <TimezoneSelector />
                  </div>

                  {/* Time slots */}
                  {selectedDate && (
                    <div className="w-full lg:w-52 shrink-0">
                      <p className="text-sm font-semibold text-gray-900 mb-3">
                        {format(selectedDate, 'EEEE, MMMM d')}
                      </p>
                      {loadingSlots ? (
                        <div className="flex justify-center py-8"><Spinner /></div>
                      ) : availableSlots.length === 0 ? (
                        <p className="text-sm text-gray-500 py-4">
                          No available slots for this day.
                        </p>
                      ) : (
                        <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                          {availableSlots.map((slot, i) => {
                            const isSelected = selectedSlot?.start === slot.start
                            return (
                              <div key={i} className="flex gap-2">
                                <button
                                  onClick={() => handleSlotClick(slot)}
                                  className={`flex-1 text-center py-2.5 px-3 border rounded-lg text-sm font-semibold transition-all ${
                                    isSelected
                                      ? 'bg-gray-700 text-white border-gray-700'
                                      : 'border-primary text-[#006BFF] hover:bg-blue-50'
                                  }`}
                                >
                                  {format(new Date(slot.start), 'h:mma').toLowerCase()}
                                </button>
                                {isSelected && (
                                  <button
                                    onClick={() => setStep('form')}
                                    className="px-4 py-2.5 bg-[#006BFF] text-white rounded-lg text-sm font-semibold hover:bg-blue-600 transition-colors"
                                  >
                                    Next
                                  </button>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Booking Form */
            <div className="flex flex-col md:flex-row min-h-[550px]">
              <div className="w-full md:w-[320px] border-b md:border-b-0 md:border-r border-gray-200 p-8">
                <button
                  onClick={() => { setStep('calendar'); setSelectedSlot(null) }}
                  className="mb-4 w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center text-[#006BFF] hover:bg-gray-50"
                >
                  <ChevronLeft size={20} />
                </button>
                <p className="text-sm text-gray-500 mb-1">Alex Johnson</p>
                <h1 className="text-2xl font-bold text-gray-900 mb-4">{eventType.name}</h1>

                <div className="space-y-3 text-sm text-gray-600">
                  <div className="flex items-center gap-2.5">
                    <Clock size={16} className="text-gray-400 shrink-0" />
                    <span>{eventType.duration} min</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Monitor size={16} className="text-gray-400 shrink-0" />
                    <span>Web conferencing details provided upon confirmation.</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <svg className="w-4 h-4 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    <span>
                      {format(new Date(selectedSlot.start), 'h:mma')} - {format(new Date(selectedSlot.end), 'h:mma')}, {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Globe size={16} className="text-gray-400 shrink-0" />
                    <span>{getTimezoneLabel(inviteeTz)}</span>
                  </div>
                </div>
              </div>

              <div className="flex-1 p-8">
                <h2 className="text-xl font-bold text-gray-900 mb-5">Enter Details</h2>

                <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Name *</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 ${formErrors.name ? 'border-red-400' : 'border-gray-300'}`}
                    />
                    {formErrors.name && <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>}
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Email *</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 ${formErrors.email ? 'border-red-400' : 'border-gray-300'}`}
                    />
                    {formErrors.email && <p className="text-red-500 text-xs mt-1">{formErrors.email}</p>}
                  </div>

                  {eventType.event_category === 'group' && (
                    !showGuests ? (
                      <button
                        type="button"
                        onClick={() => setShowGuests(true)}
                        className="text-sm text-[#006BFF] font-medium hover:text-blue-700 border border-[#006BFF] rounded-full px-4 py-1.5"
                      >
                        Add Guests {eventType.max_invitees > 1 ? `(max ${eventType.max_invitees})` : ''}
                      </button>
                    ) : (
                      <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">Guest emails (comma-separated)</label>
                        <input
                          type="text"
                          value={form.guests}
                          onChange={e => setForm(f => ({ ...f, guests: e.target.value }))}
                          placeholder="guest1@email.com, guest2@email.com"
                          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                        />
                        {eventType.max_invitees > 1 && (
                          <p className="text-xs text-gray-400 mt-1">Maximum {eventType.max_invitees} total invitees including yourself</p>
                        )}
                      </div>
                    )
                  )}
                  {eventType.event_category === 'round-robin' && (
                    <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
                      🔄 This is a round-robin event. You'll be matched with an available host automatically.
                    </p>
                  )}

                  <div>
                    <label className="text-sm text-gray-700 block mb-1">
                      Please share anything that will help prepare for our meeting.
                    </label>
                    <textarea
                      value={form.notes}
                      onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                      rows={3}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 resize-none"
                    />
                  </div>

                  {eventType.custom_questions && (
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">
                        {eventType.custom_questions}
                      </label>
                      <textarea
                        value={form.customAnswer || ''}
                        onChange={e => setForm(f => ({ ...f, customAnswer: e.target.value }))}
                        rows={2}
                        placeholder="Your answer..."
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 resize-none"
                      />
                    </div>
                  )}

                  {formErrors.submit && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-600">{formErrors.submit}</p>
                    </div>
                  )}

                  <p className="text-xs text-gray-500">
                    By proceeding, you confirm that you have read and agree to{' '}
                    <a href="#" className="text-[#006BFF] hover:underline">Calendly's Invitee Terms</a>{' '}
                    and <a href="#" className="text-[#006BFF] hover:underline">Privacy Notice</a>.
                  </p>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2.5 bg-[#006BFF] text-white rounded-full text-sm font-semibold hover:bg-blue-600 disabled:opacity-50 transition-colors"
                  >
                    {submitting ? 'Scheduling...' : 'Schedule Event'}
                  </button>
                </form>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
