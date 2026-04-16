import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { eventTypesApi } from '../../api'
import Modal from '../../components/shared/Modal'

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120]
const COLOR_OPTIONS = [
  '#7C3AED', '#006BFF', '#10B981', '#F59E0B',
  '#EF4444', '#EC4899', '#0EA5E9', '#6366F1',
]

export default function CreateEventModal({ editData, onClose }) {
  const queryClient = useQueryClient()
  const isEdit = !!editData

  const [form, setForm] = useState({
    name: '',
    duration: 30,
    description: '',
    location: 'Google Meet',
    color: '#7C3AED',
  })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (editData) {
      setForm({
        name: editData.name,
        duration: editData.duration,
        description: editData.description || '',
        location: editData.location || 'Google Meet',
        color: editData.color,
      })
    }
  }, [editData])

  const createMutation = useMutation({
    mutationFn: (data) => eventTypesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-types'] })
      onClose()
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data) => eventTypesApi.update(editData.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-types'] })
      onClose()
    },
  })

  const validate = () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Event name is required'
    if (!form.duration || form.duration <= 0) errs.duration = 'Duration must be positive'
    return errs
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})
    if (isEdit) {
      updateMutation.mutate(form)
    } else {
      createMutation.mutate(form)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  const error = createMutation.error || updateMutation.error

  return (
    <Modal onClose={onClose}>
      <div className="w-full max-w-md bg-white rounded-xl shadow-modal p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? 'Edit event type' : 'New event type'}
          </h2>
          <button onClick={onClose} className="p-1 rounded-md text-gray-400 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Event Name */}
          <div>
            <label className="label">Event name *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. 30 Minute Meeting"
              className={`input ${errors.name ? 'border-red-400' : ''}`}
            />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
          </div>

          {/* Duration */}
          <div>
            <label className="label">Duration (minutes) *</label>
            <div className="flex flex-wrap gap-2">
              {DURATION_OPTIONS.map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, duration: d }))}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    form.duration === d
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-gray-700 border-border hover:border-primary hover:text-primary'
                  }`}
                >
                  {d} min
                </button>
              ))}
            </div>
            {/* Custom duration */}
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm text-gray-500">Custom:</span>
              <input
                type="number"
                min="5"
                max="480"
                value={DURATION_OPTIONS.includes(form.duration) ? '' : form.duration}
                onChange={e => setForm(f => ({ ...f, duration: parseInt(e.target.value) || 30 }))}
                placeholder="Custom"
                className="input w-24 text-sm"
              />
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="label">Color</label>
            <div className="flex gap-2">
              {COLOR_OPTIONS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, color }))}
                  className={`w-7 h-7 rounded-full transition-transform ${
                    form.color === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="label">Location</label>
            <select
              value={form.location}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              className="input"
            >
              <option>Google Meet</option>
              <option>Zoom</option>
              <option>Microsoft Teams</option>
              <option>Phone Call</option>
              <option>In Person</option>
              <option>Other</option>
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="label">Description (optional)</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Add a description for your invitees..."
              rows={3}
              className="input resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-red-500 text-sm bg-red-50 p-2 rounded-md">
              {error.response?.data?.detail || 'Something went wrong. Please try again.'}
            </p>
          )}

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={isPending} className="btn-primary flex-1">
              {isPending ? 'Saving...' : isEdit ? 'Save changes' : 'Create event type'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  )
}
