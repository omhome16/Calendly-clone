import { useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ChevronDown, ChevronLeft, ChevronRight, Plus, X, Copy, List, Calendar,
  MoreVertical, HelpCircle, RefreshCw, Clock, Globe, Trash2
} from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, getDay, isSameDay, isToday } from 'date-fns'
import { availabilityApi, holidaysApi } from '../../api'

const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function formatTime12(timeStr) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':').map(Number)
  const suffix = h >= 12 ? 'pm' : 'am'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${m.toString().padStart(2, '0')}${suffix}`
}

export default function AvailabilityPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('schedules')
  const [viewMode, setViewMode] = useState('list')
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [meetingLimit, setMeetingLimit] = useState('')
  const [meetingLimitPeriod, setMeetingLimitPeriod] = useState('day')
  const [holidayCountry, setHolidayCountry] = useState('IN')
  const [conflictModal, setConflictModal] = useState(null)
  const [selectedScheduleId, setSelectedScheduleId] = useState(null)
  const [showCreateSchedule, setShowCreateSchedule] = useState(false)
  const [newScheduleName, setNewScheduleName] = useState('')

  // Queries
  const { data: schedulesList = [] } = useQuery({ queryKey: ['schedulesList'], queryFn: availabilityApi.list })
  // Determine which schedule to load
  const activeScheduleId = selectedScheduleId || schedulesList.find(s => s.is_default)?.id
  const { data: schedule, isLoading } = useQuery({
    queryKey: ['availability', activeScheduleId],
    queryFn: () => activeScheduleId ? availabilityApi.getAll().then(all => all.find(s => s.id === activeScheduleId)) : availabilityApi.get(),
    enabled: !!activeScheduleId || schedulesList.length === 0,
  })

  // Keep selectedScheduleId in sync with default on first load
  useEffect(() => {
    if (!selectedScheduleId && schedulesList.length > 0) {
      const defaultS = schedulesList.find(s => s.is_default)
      if (defaultS) setSelectedScheduleId(defaultS.id)
    }
  }, [schedulesList])

  // Holidays query
  const calendarYear = calendarMonth.getFullYear()
  const { data: holidays = [] } = useQuery({
    queryKey: ['holidays', holidayCountry, calendarYear],
    queryFn: () => holidaysApi.get(holidayCountry, calendarYear),
    enabled: !!holidayCountry,
  })
  const { data: countries = [] } = useQuery({
    queryKey: ['holiday-countries'],
    queryFn: holidaysApi.getCountries,
  })
  // Build a lookup: date string -> holiday name
  const holidayMap = {}
  holidays.forEach(h => {
    if (!holidayMap[h.date]) holidayMap[h.date] = []
    holidayMap[h.date].push(h)
  })

  // Initialize meeting limit from schedule
  useEffect(() => {
    if (schedule?.meeting_limit_per_day !== undefined) {
      setMeetingLimit(schedule.meeting_limit_per_day ? String(schedule.meeting_limit_per_day) : '')
    }
  }, [schedule?.meeting_limit_per_day])

  const updateMutation = useMutation({
    mutationFn: (data) => availabilityApi.update(schedule.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability'] })
      queryClient.invalidateQueries({ queryKey: ['schedulesList'] })
    },
  })

  const overrideMutation = useMutation({
    mutationFn: (data) => availabilityApi.createOverride(schedule?.id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['availability'] }),
  })

  const createScheduleMutation = useMutation({
    mutationFn: (data) => availabilityApi.create(data),
    onSuccess: (newSchedule) => {
      queryClient.invalidateQueries({ queryKey: ['schedulesList'] })
      queryClient.invalidateQueries({ queryKey: ['availability'] })
      setSelectedScheduleId(newSchedule.id)
      setShowCreateSchedule(false)
      setNewScheduleName('')
    },
  })

  const deleteScheduleMutation = useMutation({
    mutationFn: (id) => availabilityApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedulesList'] })
      const defaultS = schedulesList.find(s => s.is_default)
      setSelectedScheduleId(defaultS?.id || null)
    },
  })

  const rules = schedule?.rules || []
  const overrides = schedule?.date_overrides || []

  // Timezone change handler — saves to backend
  const handleTimezoneChange = (newTz) => {
    updateMutation.mutate({ timezone: newTz })
  }

  const handleTimeChange = async (dayOfWeek, field, value) => {
    const newRules = rules.map(r => {
      if (r.day_of_week === dayOfWeek) {
        return { ...r, [field]: value }
      }
      return r
    })
    const payload = newRules.map(r => ({ day_of_week: r.day_of_week, is_available: r.is_available, start_time: r.start_time, end_time: r.end_time }))

    // Issue #13: Check for conflicts before saving rule changes
    if (schedule?.id) {
      try {
        const { conflicts } = await availabilityApi.checkConflicts(schedule.id)
        if (conflicts.length > 0) {
          setConflictModal({
            conflicts,
            pendingAction: () => {
              updateMutation.mutate({ rules: payload })
              setConflictModal(null)
            }
          })
          return
        }
      } catch (e) { /* proceed anyway */ }
    }
    updateMutation.mutate({ rules: payload })
  }

  const handleToggleDay = async (dayOfWeek) => {
    const rule = rules.find(r => r.day_of_week === dayOfWeek)
    const newRules = rules.map(r => {
      if (r.day_of_week === dayOfWeek) {
        return {
          ...r,
          is_available: !r.is_available,
          start_time: !r.is_available ? '09:00' : null,
          end_time: !r.is_available ? '17:00' : null,
        }
      }
      return r
    })

    // Check for conflicts if disabling a day
    if (rule?.is_available && schedule?.id) {
      try {
        const { conflicts } = await availabilityApi.checkConflicts(schedule.id)
        if (conflicts.length > 0) {
          setConflictModal({
            conflicts,
            pendingAction: () => {
              updateMutation.mutate({ rules: newRules.map(r => ({ day_of_week: r.day_of_week, is_available: r.is_available, start_time: r.start_time, end_time: r.end_time })) })
              setConflictModal(null)
            }
          })
          return
        }
      } catch (e) { /* proceed anyway */ }
    }

    updateMutation.mutate({ rules: newRules.map(r => ({ day_of_week: r.day_of_week, is_available: r.is_available, start_time: r.start_time, end_time: r.end_time })) })
  }

  const handleCopyToAll = (dayOfWeek) => {
    const source = rules.find(r => r.day_of_week === dayOfWeek)
    if (!source) return
    const newRules = rules.map(r => ({
      day_of_week: r.day_of_week,
      is_available: source.is_available,
      start_time: source.start_time,
      end_time: source.end_time,
    }))
    updateMutation.mutate({ rules: newRules })
  }

  const handleAddDateOverride = async (dateStr, startTime, endTime, startTime2, endTime2) => {
    const overridePayload = {
      override_date: dateStr,
      is_available: !!(startTime && endTime),
      start_time: startTime || null,
      end_time: endTime || null,
      start_time_2: startTime2 || null,
      end_time_2: endTime2 || null,
    }

    // Issue #10: Check for existing bookings on this date before creating override
    try {
      const { conflicts } = await availabilityApi.checkDateConflicts(dateStr)
      if (conflicts.length > 0) {
        setConflictModal({
          conflicts: conflicts.map(c => ({ ...c, reason: `Meeting on ${dateStr}` })),
          pendingAction: () => {
            overrideMutation.mutate(overridePayload)
            setConflictModal(null)
          }
        })
        return
      }
    } catch (e) { /* proceed anyway */ }

    overrideMutation.mutate(overridePayload)
  }

  const handleSaveMeetingLimit = () => {
    updateMutation.mutate({ meeting_limit_per_day: meetingLimit ? parseInt(meetingLimit) : null })
  }

  // Holiday toggle: on = create unavailable override, off = delete override
  const handleToggleHoliday = (holiday) => {
    const key = holiday.date
    const isEnabled = schedule?.date_overrides?.some(o => o.override_date === key && !o.is_available)
    if (isEnabled) {
      // Remove the override for this holiday
      const existing = schedule.date_overrides.find(o => o.override_date === key)
      if (existing) {
        availabilityApi.deleteOverride(existing.id).then(() => {
          queryClient.invalidateQueries({ queryKey: ['availability'] })
        })
      }
    } else {
      // Create an unavailable override for this holiday
      overrideMutation.mutate({
        override_date: key,
        is_available: false,
        start_time: null,
        end_time: null,
      })
    }
  }

  // Calendar view helpers
  const monthStart = startOfMonth(calendarMonth)
  const monthEnd = endOfMonth(calendarMonth)
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startPad = getDay(monthStart)

  return (
    <div className="flex flex-col h-full bg-gray-100 relative">
      <div className="bg-white border-b border-gray-200">
        <div className="px-8 pt-6">
          {/* Header */}
          <h1 className="text-2xl font-bold text-gray-900 mb-5">Availability</h1>

          {/* Tabs */}
          <div>
            <div className="flex gap-6">
              <button
                onClick={() => setActiveTab('schedules')}
                className={`pb-3 text-sm font-semibold border-b-2 transition-colors duration-150 -mb-px ${activeTab === 'schedules' ? 'border-[#006BFF] text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
              >
                Schedules
              </button>
              <button
                onClick={() => setActiveTab('advanced')}
                className={`pb-3 text-sm font-semibold border-b-2 transition-colors duration-150 -mb-px ${activeTab === 'advanced' ? 'border-[#006BFF] text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
              >
                Advanced settings
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6 w-full">
        {activeTab === 'schedules' && (
          <div className="border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden">
          {/* Schedule header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="text-xs text-gray-500 font-medium">Schedule</div>
            <div className="flex items-center justify-between mt-1">
              <div className="flex items-center gap-2">
                <select
                  value={selectedScheduleId || ''}
                  onChange={(e) => setSelectedScheduleId(parseInt(e.target.value))}
                  className="text-lg font-bold text-[#006BFF] bg-transparent border-none outline-none cursor-pointer p-0 pr-2"
                >
                  {schedulesList.map(s => (
                    <option key={s.id} value={s.id}>{s.name}{s.is_default ? ' (default)' : ''}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowCreateSchedule(true)}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-[#006BFF] border border-[#006BFF] rounded-lg hover:bg-blue-50 transition-colors"
                >
                  <Plus size={14} /> New
                </button>
                {schedule && !schedule.is_default && (
                  <button
                    onClick={() => {
                      if (confirm(`Delete schedule "${schedule.name}"?`)) {
                        deleteScheduleMutation.mutate(schedule.id)
                      }
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* List / Calendar toggle */}
                <div className="flex items-center border border-gray-200 rounded-lg">
                  <button
                    onClick={() => setViewMode('list')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-l-lg transition-colors ${viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    <List size={14} /> List
                  </button>
                  <button
                    onClick={() => setViewMode('calendar')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-r-lg transition-colors ${viewMode === 'calendar' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    <Calendar size={14} /> Calendar
                  </button>
                </div>
                <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                  <MoreVertical size={16} />
                </button>
              </div>
            </div>
            <div className="text-sm text-gray-500 mt-1">
              Active on: <span className="text-[#006BFF] cursor-pointer">1 event type <ChevronDown size={12} className="inline" /></span>
            </div>
          </div>

          {viewMode === 'list' ? (
            <div className="px-6 py-6">
              {/* Two columns: Weekly hours + Date-specific hours */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Weekly hours */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <RefreshCw size={16} className="text-gray-500" />
                    <h3 className="font-bold text-gray-900">Weekly hours</h3>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">Set when you are typically available for meetings</p>

                  <div className="space-y-3">
                    {[0, 1, 2, 3, 4, 5, 6].map(dayIdx => {
                      const rule = rules.find(r => r.day_of_week === dayIdx)
                      return (
                        <div key={dayIdx} className="flex items-center gap-3">
                          {/* Day circle */}
                          <button
                            onClick={() => handleToggleDay(dayIdx)}
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                              rule?.is_available ? 'bg-[#006BFF] text-white' : 'bg-gray-200 text-gray-500'
                            }`}
                          >
                            {DAY_LABELS[dayIdx]}
                          </button>

                          {rule?.is_available ? (
                            <div className="flex items-center gap-2 flex-1">
                              <input
                                type="time"
                                value={rule.start_time || '09:00'}
                                onChange={(e) => handleTimeChange(dayIdx, 'start_time', e.target.value)}
                                className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm w-24 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                              />
                              <span className="text-gray-400">-</span>
                              <input
                                type="time"
                                value={rule.end_time || '17:00'}
                                onChange={(e) => handleTimeChange(dayIdx, 'end_time', e.target.value)}
                                className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm w-24 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                              />
                              <button
                                onClick={() => handleToggleDay(dayIdx)}
                                className="p-1 text-gray-400 hover:text-gray-600"
                              >
                                <X size={14} />
                              </button>
                              <button
                                className="p-1 text-gray-400 hover:text-[#006BFF]"
                                title="Add another interval"
                              >
                                <Plus size={14} />
                              </button>
                              <button
                                onClick={() => handleCopyToAll(dayIdx)}
                                className="p-1 text-gray-400 hover:text-[#006BFF]"
                                title="Copy to all days"
                              >
                                <Copy size={14} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 flex-1">
                              <span className="text-sm text-gray-400">Unavailable</span>
                              <button
                                onClick={() => handleToggleDay(dayIdx)}
                                className="p-1 text-gray-400 hover:text-[#006BFF]"
                                title="Enable this day"
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Timezone */}
                  <div className="mt-6 flex items-center gap-1">
                    <select
                      value={schedule?.timezone || 'Asia/Kolkata'}
                      onChange={(e) => handleTimezoneChange(e.target.value)}
                      className="bg-transparent border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-600 font-medium focus:outline-none focus:ring-1 focus:ring-blue-600 cursor-pointer"
                    >
                      <option value="Asia/Kolkata">India Standard Time (Asia/Kolkata)</option>
                      <option value="America/New_York">Eastern Time (America/New_York)</option>
                      <option value="America/Chicago">Central Time (America/Chicago)</option>
                      <option value="America/Denver">Mountain Time (America/Denver)</option>
                      <option value="America/Los_Angeles">Pacific Time (America/Los_Angeles)</option>
                      <option value="Europe/London">London (Europe/London)</option>
                      <option value="Europe/Berlin">Central European (Europe/Berlin)</option>
                      <option value="Asia/Dubai">Gulf Standard Time (Asia/Dubai)</option>
                      <option value="Asia/Singapore">Singapore (Asia/Singapore)</option>
                      <option value="Asia/Tokyo">Japan (Asia/Tokyo)</option>
                      <option value="Australia/Sydney">Sydney (Australia/Sydney)</option>
                    </select>
                  </div>
                </div>

                {/* Date-specific hours */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Calendar size={16} className="text-gray-500" />
                    <h3 className="font-bold text-gray-900">Date-specific hours</h3>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">Adjust hours for specific days (supports split timing)</p>

                  <DateSpecificHoursManager
                    scheduleId={schedule?.id}
                    overrides={overrides}
                    holidays={holidays}
                    onAdd={handleAddDateOverride}
                  />

                </div>
              </div>
            </div>
          ) : (
            /* Calendar View */
            <div className="px-6 py-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <button onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))} className="p-1 text-gray-400 hover:text-gray-600">
                    <ChevronLeft size={18} />
                  </button>
                  <h3 className="font-bold text-gray-900">{format(calendarMonth, 'MMMM yyyy')}</h3>
                  <button onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))} className="p-1 text-gray-400 hover:text-gray-600">
                    <ChevronRight size={18} />
                  </button>
                </div>
                <div className="text-sm text-gray-500 flex items-center gap-2">
                  <Globe size={14} />
                  <select
                    value={holidayCountry}
                    onChange={(e) => setHolidayCountry(e.target.value)}
                    className="bg-transparent border border-gray-200 rounded px-2 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-600"
                  >
                    {countries.map(c => (
                      <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
                    ))}
                  </select>
                  <span className="text-gray-400">|</span>
                  {schedule?.timezone} <ChevronDown size={12} />
                </div>
              </div>

              <div className="grid grid-cols-7 gap-0">
                {/* Headers */}
                {DAY_NAMES.map(d => (
                  <div key={d} className="py-2 text-center text-xs font-semibold text-gray-500 border-b border-gray-200">{d}</div>
                ))}
                {/* Padding for start of month */}
                {Array.from({ length: startPad }).map((_, i) => (
                  <div key={`pad-${i}`} className="h-28 border-b border-r border-gray-200" />
                ))}
                {/* Days */}
                {monthDays.map(day => {
                  const dayOfWeek = getDay(day)
                  const rule = rules.find(r => r.day_of_week === dayOfWeek)
                  const override = overrides.find(o => isSameDay(new Date(o.override_date), day))
                  const isAvail = override ? override.is_available : rule?.is_available
                  const startTime = override?.start_time || rule?.start_time
                  const endTime = override?.end_time || rule?.end_time
                  const dayStr = format(day, 'yyyy-MM-dd')
                  const dayHolidays = holidayMap[dayStr] || []

                  return (
                    <div key={day.toISOString()} className={`h-28 border-b border-r border-gray-200 p-1.5 ${isToday(day) ? 'bg-blue-50/50' : ''}`}>
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-medium ${isToday(day) ? 'w-6 h-6 rounded-full bg-[#006BFF] text-white flex items-center justify-center' : 'text-gray-700'}`}>
                          {format(day, 'd')}
                        </span>
                        {override && <RefreshCw size={10} className="text-[#006BFF]" />}
                      </div>
                      {isAvail && startTime && endTime && (
                        <div className="mt-1 text-[10px] text-gray-500">
                          {formatTime12(startTime)} – {formatTime12(endTime)}
                        </div>
                      )}
                      {/* Holiday badge */}
                      {dayHolidays.length > 0 && (
                        <div className="mt-0.5">
                          {dayHolidays.map((h, i) => (
                            <div key={i} className={`text-[9px] font-medium truncate rounded px-0.5 mt-0.5 ${
                              h.type === 'national' ? 'bg-red-100 text-red-700' :
                              h.type === 'religious' ? 'bg-amber-100 text-amber-700' :
                              'bg-purple-100 text-purple-700'
                            }`} title={h.name}>
                              {h.name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'advanced' && (
        <AdvancedSettings
          schedule={schedule}
          meetingLimit={meetingLimit}
          setMeetingLimit={setMeetingLimit}
          meetingLimitPeriod={meetingLimitPeriod}
          setMeetingLimitPeriod={setMeetingLimitPeriod}
          onSave={handleSaveMeetingLimit}
          holidays={holidays}
          holidayCountry={holidayCountry}
          setHolidayCountry={setHolidayCountry}
          countries={countries}
          overrides={overrides}
          onToggleHoliday={handleToggleHoliday}
        />
      )}
      </div>

      {/* Conflict Modal */}
      {conflictModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-lg w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">⚠️ Booking Conflicts Detected</h3>
            <p className="text-sm text-gray-500 mb-4">
              Changing availability will affect {conflictModal.conflicts.length} existing booking(s):
            </p>
            <div className="max-h-48 overflow-y-auto space-y-2 mb-4">
              {conflictModal.conflicts.map((c, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-red-50 rounded-lg text-sm">
                  <div>
                    <div className="font-medium text-gray-900">{c.invitee_name}</div>
                    <div className="text-xs text-gray-500">{c.event_type} · {new Date(c.start_time).toLocaleString()}</div>
                  </div>
                  <span className="text-xs text-red-600 font-medium">{c.reason}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConflictModal(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Keep Current
              </button>
              <button
                onClick={conflictModal.pendingAction}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
              >
                Change Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Schedule Modal */}
      {showCreateSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Create New Schedule</h3>
              <button onClick={() => setShowCreateSchedule(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Create a new availability schedule with custom name. It starts with default Mon-Fri 9am-5pm hours.
            </p>
            <input
              value={newScheduleName}
              onChange={(e) => setNewScheduleName(e.target.value)}
              placeholder="e.g. Home Hours, Vacation, Evening Slots"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 mb-4"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newScheduleName.trim()) {
                  createScheduleMutation.mutate({ name: newScheduleName.trim(), timezone: schedule?.timezone || 'Asia/Kolkata' })
                }
              }}
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowCreateSchedule(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
                Cancel
              </button>
              <button
                onClick={() => createScheduleMutation.mutate({ name: newScheduleName.trim() || 'New Schedule', timezone: schedule?.timezone || 'Asia/Kolkata' })}
                disabled={createScheduleMutation.isPending}
                className="px-4 py-2 text-sm bg-[#006BFF] text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {createScheduleMutation.isPending ? 'Creating...' : 'Create Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DateSpecificHoursManager({ scheduleId, overrides, holidays, onAdd }) {
  const [showForm, setShowForm] = useState(false)
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('12:00')
  const [isAvailable, setIsAvailable] = useState(true)
  const [hasSplit, setHasSplit] = useState(false)
  const [startTime2, setStartTime2] = useState('15:00')
  const [endTime2, setEndTime2] = useState('17:00')

  const queryClient = useQueryClient()
  const deleteOverrideMutation = useMutation({
    mutationFn: (id) => availabilityApi.deleteOverride(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['availability'] }),
  })

  const handleSave = () => {
    onAdd(
      date,
      isAvailable ? startTime : null,
      isAvailable ? endTime : null,
      isAvailable && hasSplit ? startTime2 : null,
      isAvailable && hasSplit ? endTime2 : null,
    )
    setShowForm(false)
    setDate('')
    setHasSplit(false)
  }

  return (
    <div>
      {/* Existing overrides */}
      {overrides?.length > 0 && (
        <div className="space-y-2 mb-4">
          {overrides.map(o => (
            <div key={o.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm">
              <div>
                <span className="font-medium">
                  {format(new Date(o.override_date), 'MMM d, yyyy')}
                  {holidays?.find(h => h.date === o.override_date) ? ` — ${holidays.find(h => h.date === o.override_date).name}` : ''}
                </span>
                {o.is_available ? (
                  <span className="text-gray-500 ml-2">
                    {formatTime12(o.start_time)} – {formatTime12(o.end_time)}
                    {o.start_time_2 && o.end_time_2 && (
                      <span className="text-[#006BFF]"> + {formatTime12(o.start_time_2)} – {formatTime12(o.end_time_2)}</span>
                    )}
                  </span>
                ) : (
                  <span className="text-gray-400 ml-2">Unavailable</span>
                )}
              </div>
              <button onClick={() => deleteOverrideMutation.mutate(o.id)} className="p-1 text-gray-400 hover:text-red-500">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <div className="p-4 border border-gray-200 rounded-lg space-y-3">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700 flex items-center gap-2">
              <input type="checkbox" checked={isAvailable} onChange={(e) => setIsAvailable(e.target.checked)} />
              Available
            </label>
          </div>
          {isAvailable && (
            <div className="space-y-2">
              {/* First interval */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-16">Slot 1:</span>
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="px-2 py-1 border border-gray-200 rounded text-sm" />
                <span>-</span>
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="px-2 py-1 border border-gray-200 rounded text-sm" />
              </div>
              {/* Second interval (split timing) */}
              {hasSplit ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-16">Slot 2:</span>
                  <input type="time" value={startTime2} onChange={(e) => setStartTime2(e.target.value)} className="px-2 py-1 border border-gray-200 rounded text-sm" />
                  <span>-</span>
                  <input type="time" value={endTime2} onChange={(e) => setEndTime2(e.target.value)} className="px-2 py-1 border border-gray-200 rounded text-sm" />
                  <button onClick={() => setHasSplit(false)} className="p-1 text-gray-400 hover:text-red-500"><X size={14} /></button>
                </div>
              ) : (
                <button
                  onClick={() => setHasSplit(true)}
                  className="flex items-center gap-1 text-xs text-[#006BFF] hover:text-blue-700 font-medium"
                >
                  <Plus size={12} /> Add split time (e.g. 9-12 and 3-5)
                </button>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={!date} className="px-3 py-1.5 bg-[#006BFF] text-white rounded-lg text-sm disabled:opacity-50">Save</button>
            <button onClick={() => { setShowForm(false); setHasSplit(false) }} className="px-3 py-1.5 text-gray-700 border border-gray-200 rounded-lg text-sm">Cancel</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
        >
          <Plus size={14} /> Hours
        </button>
      )}
    </div>
  )
}

function AdvancedSettings({ schedule, meetingLimit, setMeetingLimit, meetingLimitPeriod, setMeetingLimitPeriod, onSave, holidays, holidayCountry, setHolidayCountry, countries, overrides, onToggleHoliday }) {
  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h3 className="text-xl font-bold text-gray-900 mb-1">Meeting limits</h3>
        <p className="text-sm text-gray-500 mb-4">Set a maximum number of total meetings.</p>
        <div className="border border-gray-200 rounded-lg bg-white p-6">
          <div className="flex items-center gap-2 mt-3">
            <input
              type="number"
              value={meetingLimit}
              onChange={(e) => setMeetingLimit(e.target.value)}
              onBlur={onSave}
              onKeyDown={(e) => e.key === 'Enter' && onSave()}
              placeholder=""
              className="w-20 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
            <span className="text-sm text-gray-500">meetings per</span>
            <select
              value={meetingLimitPeriod}
              onChange={(e) => setMeetingLimitPeriod(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
            >
              <option value="day">day</option>
              <option value="week">week</option>
            </select>
            <button
              onClick={() => {
                setMeetingLimit('');
                availabilityApi.update(schedule.id, { meeting_limit_per_day: null })
              }}
              className="p-2 text-gray-400 hover:text-[#006BFF]"
              title="Clear Limit"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-xl font-bold text-gray-900 mb-1">Holidays</h3>
        <p className="text-sm text-gray-500 mb-4">Toggle holidays to block availability on those dates</p>

        <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-white">
            <div className="text-xs text-gray-500 mb-1">Country for holidays</div>
            <select
              value={holidayCountry}
              onChange={(e) => setHolidayCountry(e.target.value)}
              className="bg-transparent border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-600 w-full max-w-[300px]"
            >
              {countries.map(c => (
                <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
              ))}
            </select>
          </div>

          <div className="divide-y divide-gray-200">
            {holidays.slice(0, 5).map(h => {
              const isBlocked = overrides.some(o => o.override_date === h.date && !o.is_available)
              return (
                <div key={h.date} className="px-6 py-3 flex items-center justify-between bg-white hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3 flex-1">
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      h.type === 'national' ? 'bg-red-500' :
                      h.type === 'religious' ? 'bg-amber-500' :
                      'bg-purple-500'
                    }`} />
                    <span className="font-semibold text-gray-700 w-1/3">{h.name}</span>
                    <span className="text-sm text-gray-400 flex-1">{h.date}</span>
                  </div>
                  <button
                    onClick={() => onToggleHoliday(h)}
                    className={`relative w-10 h-6 rounded-full transition-colors cursor-pointer shrink-0 ${
                      isBlocked ? 'bg-[#006BFF]' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                      isBlocked ? 'left-5' : 'left-1'
                    }`} />
                  </button>
                </div>
              )
            })}
            {holidays.length === 0 && (
              <div className="px-6 py-8 text-center text-sm text-gray-400">No holidays found for this country</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
