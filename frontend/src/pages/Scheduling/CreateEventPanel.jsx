import { useState, useEffect } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { X, ChevronDown, ChevronUp, Clock, MapPin, Calendar, AlertCircle, Link2, Users, Copy, Check, Layers } from 'lucide-react'
import { eventTypesApi, availabilityApi, singleUseLinksApi } from '../../api'

const CATEGORY_LABELS = {
  'one-on-one': 'One-on-One',
  'group': 'Group',
  'round-robin': 'Round Robin',
}

const COLORS = [
  '#7C3AED', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444',
  '#EC4899', '#6366F1', '#14B8A6', '#F97316', '#8B5CF6'
]

const LOCATIONS = ['Google Meet', 'Zoom', 'Microsoft Teams', 'Phone Call', 'In Person', 'Custom']

function formatTime12h(timeStr) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':').map(Number)
  const suffix = h >= 12 ? 'pm' : 'am'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${m.toString().padStart(2, '0')}${suffix}`
}

export default function CreateEventPanel({ editingEvent, category, onClose }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [duration, setDuration] = useState(30)
  const [color, setColor] = useState('#7C3AED')
  const [location, setLocation] = useState('Google Meet')
  const [description, setDescription] = useState('')
  const [bufferBefore, setBufferBefore] = useState(0)
  const [bufferAfter, setBufferAfter] = useState(0)
  const [maxPerDay, setMaxPerDay] = useState('')
  const [scheduleDays, setScheduleDays] = useState(60)
  const [minNotice, setMinNotice] = useState(4)
  const [maxInvitees, setMaxInvitees] = useState(category === 'group' ? 10 : 1)
  const [generateSingleUseLink, setGenerateSingleUseLink] = useState(false)
  const [generatedLink, setGeneratedLink] = useState(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const [customQuestions, setCustomQuestions] = useState('')
  const [scheduleId, setScheduleId] = useState(null)

  // Sections
  const [durationOpen, setDurationOpen] = useState(true)
  const [locationOpen, setLocationOpen] = useState(false)
  const [availabilityOpen, setAvailabilityOpen] = useState(false)

  // Availability schedules list
  const { data: schedule } = useQuery({ queryKey: ['availability'], queryFn: availabilityApi.get })
  const { data: allSchedules = [] } = useQuery({ queryKey: ['schedulesList'], queryFn: availabilityApi.list })

  useEffect(() => {
    if (editingEvent) {
      setName(editingEvent.name)
      setDuration(editingEvent.duration)
      setColor(editingEvent.color)
      setLocation(editingEvent.location)
      setDescription(editingEvent.description || '')
      setBufferBefore(editingEvent.buffer_before || 0)
      setBufferAfter(editingEvent.buffer_after || 0)
      setMaxPerDay(editingEvent.max_per_day || '')
      setScheduleDays(editingEvent.schedule_days_ahead || 60)
      setMinNotice(editingEvent.min_notice_hours || 4)
      setMaxInvitees(editingEvent.max_invitees || 1)
      setCustomQuestions(editingEvent.custom_questions || '')
      setScheduleId(editingEvent.schedule_id || null)
    }
  }, [editingEvent])

  const createMutation = useMutation({
    mutationFn: (data) => eventTypesApi.create(data),
    onSuccess: async (newEventType) => {
      queryClient.invalidateQueries({ queryKey: ['eventTypes'] })
      // If single-use link requested, generate one
      if (generateSingleUseLink && newEventType?.id) {
        try {
          const link = await singleUseLinksApi.create(newEventType.id)
          setGeneratedLink(link)
          queryClient.invalidateQueries({ queryKey: ['singleUseLinks'] })
        } catch (e) {
          console.error('Failed to generate single-use link:', e)
          onClose()
        }
      } else {
        onClose()
      }
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => eventTypesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eventTypes'] })
      onClose()
    },
  })

  const handleSubmit = () => {
    const data = {
      name,
      duration,
      color,
      location,
      description: description || null,
      event_category: category,
      max_invitees: category === 'group' ? maxInvitees : 1,
      buffer_before: bufferBefore,
      buffer_after: bufferAfter,
      max_per_day: maxPerDay ? parseInt(maxPerDay) : null,
      schedule_days_ahead: scheduleDays,
      min_notice_hours: minNotice,
      custom_questions: customQuestions || null,
      schedule_id: scheduleId,
    }
    if (editingEvent) {
      updateMutation.mutate({ id: editingEvent.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  const handleCopyLink = () => {
    if (generatedLink) {
      const url = `${window.location.origin}/book/${generatedLink.event_type?.slug || ''}?token=${generatedLink.token}`
      navigator.clipboard.writeText(url)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    }
  }

  // If we just generated a single-use link, show the success view
  if (generatedLink) {
    return (
      <div className="fixed right-0 top-0 h-full w-[400px] bg-white border-l border-gray-200 shadow-xl z-40 flex flex-col animate-slideIn">
        <div className="flex items-center justify-end p-3 border-b border-gray-200 shrink-0">
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-8">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <Check size={32} className="text-green-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Event Created!</h3>
          <p className="text-sm text-gray-500 text-center mb-6">
            Your single-use link has been generated. Share it with your invitee — it can only be used once.
          </p>
          <div className="w-full p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs text-gray-600 break-all mb-4">
            {`${window.location.origin}/book/${generatedLink.event_type?.slug || ''}?token=${generatedLink.token}`}
          </div>
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#006BFF] text-white rounded-full text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            {linkCopied ? <><Check size={16} /> Copied!</> : <><Copy size={16} /> Copy Link</>}
          </button>
        </div>
        <div className="p-4 border-t border-gray-200 shrink-0">
          <button onClick={onClose} className="w-full py-2 text-sm text-gray-600 hover:text-gray-900 font-medium text-center">
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed right-0 top-0 h-full w-[400px] bg-white border-l border-gray-200 shadow-xl z-40 flex flex-col animate-slideIn">
      {/* Close button */}
      <div className="flex items-center justify-end p-3 border-b border-gray-200 shrink-0">
        <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
          <X size={20} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200">
          <div className="text-xs text-gray-500 font-medium">Event type</div>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="New Meeting"
              className="text-lg font-bold text-gray-900 border-none outline-none bg-transparent flex-1 p-0"
            />
          </div>
          <div className="text-sm text-gray-500 mt-0.5">{CATEGORY_LABELS[category]}</div>
        </div>

        {/* Color picker */}
        <div className="px-5 py-3 border-b border-gray-200">
          <div className="flex gap-2">
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full border-2 transition-colors ${color === c ? 'border-gray-900 scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {/* Duration Section */}
        <div className="border-b border-gray-200">
          <button
            onClick={() => setDurationOpen(!durationOpen)}
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50"
          >
            <span className="font-semibold text-gray-900">Duration</span>
            {durationOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {durationOpen && (
            <div className="px-5 pb-4">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-gray-400" />
                <select
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value))}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                >
                  <option value={15}>15 min</option>
                  <option value={30}>30 min</option>
                  <option value={45}>45 min</option>
                  <option value={60}>60 min</option>
                  <option value={90}>90 min</option>
                  <option value={120}>120 min</option>
                </select>
              </div>
              {/* Buffer time */}
              <div className="mt-3 space-y-2">
                <div className="text-xs text-gray-500 font-medium">Buffer time</div>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-gray-400">Before</label>
                    <select value={bufferBefore} onChange={(e) => setBufferBefore(parseInt(e.target.value))} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm">
                      <option value={0}>None</option>
                      <option value={5}>5 min</option>
                      <option value={10}>10 min</option>
                      <option value={15}>15 min</option>
                      <option value={30}>30 min</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-400">After</label>
                    <select value={bufferAfter} onChange={(e) => setBufferAfter(parseInt(e.target.value))} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm">
                      <option value={0}>None</option>
                      <option value={5}>5 min</option>
                      <option value={10}>10 min</option>
                      <option value={15}>15 min</option>
                      <option value={30}>30 min</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Location Section */}
        <div className="border-b border-gray-200">
          <button
            onClick={() => setLocationOpen(!locationOpen)}
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50"
          >
            <span className="font-semibold text-gray-900">Location</span>
            {locationOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {!locationOpen && (
            <div className="px-5 pb-3 flex items-center gap-2 text-sm text-gray-500">
              {!location || location === 'No location set' ? (
                <><AlertCircle size={14} className="text-orange-500" /> No location set</>
              ) : (
                <><MapPin size={14} /> {location}</>
              )}
            </div>
          )}
          {locationOpen && (
            <div className="px-5 pb-4">
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              >
                {LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Group: Max Invitees */}
        {category === 'group' && (
          <div className="px-5 py-4 border-b border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <Users size={16} className="text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Max invitees</span>
            </div>
            <select
              value={maxInvitees}
              onChange={(e) => setMaxInvitees(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            >
              {[2, 3, 5, 10, 15, 20, 30, 50].map(n => (
                <option key={n} value={n}>{n} people</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">Maximum number of people who can book this event at the same time slot.</p>
          </div>
        )}

        {/* Availability Section */}
        <div className="border-b border-gray-200">
          <button
            onClick={() => setAvailabilityOpen(!availabilityOpen)}
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50"
          >
            <span className="font-semibold text-gray-900">Availability</span>
            {availabilityOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {availabilityOpen && (
            <div className="px-5 pb-4 space-y-3">
              <div>
                <div className="text-sm font-medium text-gray-700">Date range</div>
                <div className="text-xs text-gray-500 mt-1">
                  Invitees can schedule <select value={scheduleDays} onChange={(e) => setScheduleDays(parseInt(e.target.value))} className="inline px-1 py-0.5 border border-gray-300 rounded text-xs text-[#006BFF] font-medium">
                    <option value={30}>30 days</option>
                    <option value={60}>60 days</option>
                    <option value={90}>90 days</option>
                  </select> into the future with at least <select value={minNotice} onChange={(e) => setMinNotice(parseInt(e.target.value))} className="inline px-1 py-0.5 border border-gray-300 rounded text-xs text-[#006BFF] font-medium">
                    <option value={1}>1 hour</option>
                    <option value={2}>2 hours</option>
                    <option value={4}>4 hours</option>
                    <option value={24}>24 hours</option>
                  </select> notice
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-700">Availability Schedule</div>
              <select
                value={scheduleId || ''}
                onChange={(e) => setScheduleId(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              >
                <option value="">Default schedule</option>
                {allSchedules.map(s => (
                  <option key={s.id} value={s.id}>{s.name}{s.is_default ? ' (default)' : ''}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">Choose which schedule to use for this event type.</p>
                <div className="mt-2 p-3 bg-gray-50 rounded-lg text-xs text-gray-500">
                  This event type uses the weekly and custom hours saved on the schedule.
                  <div className="mt-2 font-medium text-gray-700">Weekly hours</div>
                  {schedule?.rules?.filter(r => r.is_available).map(r => {
                    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
                    return (
                      <div key={r.day_of_week} className="flex items-center gap-2 mt-1">
                        <span className="w-5 h-5 rounded-full bg-[#006BFF] text-white flex items-center justify-center text-[10px] font-bold">{days[r.day_of_week]}</span>
                        <span>{formatTime12h(r.start_time)} - {formatTime12h(r.end_time)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Description */}
        <div className="px-5 py-4 border-b border-gray-200">
          <div className="text-sm font-medium text-gray-700 mb-2">Description</div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add a description..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 resize-none"
          />
        </div>

        {/* Custom Invitee Question */}
        <div className="px-5 py-4 border-b border-gray-200">
          <div className="text-sm font-medium text-gray-700 mb-2">Custom invitee question</div>
          <input
            value={customQuestions}
            onChange={(e) => setCustomQuestions(e.target.value)}
            placeholder="e.g. What topic would you like to discuss?"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          />
          <p className="text-xs text-gray-400 mt-1">This question will be shown to invitees on the booking form.</p>
        </div>

        {/* Single-use link toggle (only for new events) */}
        {!editingEvent && (
          <div className="px-5 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Link2 size={16} className="text-gray-400" />
                <span className="text-sm font-medium text-gray-700">Generate single-use link</span>
              </div>
              <button
                onClick={() => setGenerateSingleUseLink(!generateSingleUseLink)}
                className={`relative w-9 h-5 rounded-full transition-colors ${generateSingleUseLink ? 'bg-[#006BFF]' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${generateSingleUseLink ? 'left-[18px]' : 'left-0.5'}`} />
              </button>
            </div>
            {generateSingleUseLink && (
              <p className="text-xs text-gray-400 mt-2">A one-time booking link will be generated after creation. It expires after being used once.</p>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between p-4 border-t border-gray-200 shrink-0 bg-white">
        <button
          onClick={onClose}
          className="text-sm text-gray-600 hover:text-gray-900 font-medium"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!name.trim() || createMutation.isPending || updateMutation.isPending}
          className="px-6 py-2 bg-[#006BFF] text-white rounded-full text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {editingEvent ? 'Save' : 'Create'}
        </button>
      </div>
    </div>
  )
}
