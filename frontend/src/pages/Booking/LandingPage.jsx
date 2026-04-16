import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { eventTypesApi } from '../../api'
import Spinner from '../../components/shared/Spinner'

export default function LandingPage() {
  const { data: eventTypes = [], isLoading } = useQuery({
    queryKey: ['eventTypes'],
    queryFn: eventTypesApi.list,
  })

  const activeEvents = eventTypes.filter(et => et.is_active)

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <Spinner />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-100 flex items-start justify-center pt-12 pb-8 px-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-[700px] overflow-hidden relative">
        {/* Header */}
        <div className="text-center pt-12 pb-6 px-8">
          <h1 className="text-lg font-bold text-gray-900">Alex Johnson</h1>
          <p className="text-sm text-gray-500 mt-3 leading-relaxed max-w-md mx-auto">
            Welcome to my scheduling page. Please follow the instructions to add an event to my calendar.
          </p>
        </div>

        {/* Divider */}
        <div className="mx-8 border-t border-gray-200" />

        {/* Event types list */}
        <div className="px-8 py-6">
          {activeEvents.length === 0 ? (
            <p className="text-center text-sm text-gray-500 py-8">No active event types available.</p>
          ) : (
            <div className="space-y-0">
              {activeEvents.map(et => (
                <Link
                  key={et.id}
                  to={`/book/${et.slug}`}
                  className="flex items-center gap-4 py-4 hover:bg-gray-50 px-2 rounded-lg -mx-2 transition-colors group"
                >
                  <div
                    className="w-8 h-8 rounded-full shrink-0"
                    style={{ backgroundColor: et.color }}
                  />
                  <span className="text-base font-semibold text-primary group-hover:text-blue-700 flex-1">
                    {et.name}
                  </span>
                  <ChevronRight size={18} className="text-gray-400 group-hover:text-gray-600" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
