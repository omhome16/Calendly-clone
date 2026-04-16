import { useLocation, useParams, Link } from 'react-router-dom'
import { format } from 'date-fns'
import { CheckCircle, Clock, Globe, Monitor, User, Link2, Mail } from 'lucide-react'

export default function ConfirmationPage() {
  const { slug } = useParams()
  const { state } = useLocation()
  const { booking, eventType, slot } = state || {}

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.origin + `/book/${slug}`)
  }

  if (!booking || !eventType) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-700">No booking data found.</p>
          <Link to="/scheduling" className="text-[#006BFF] text-sm hover:underline mt-2 inline-block">
            Go to Scheduling
          </Link>
        </div>
      </div>
    )
  }

  const startDt = new Date(booking.start_time)
  const endDt = new Date(booking.end_time)

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

      {/* Content */}
      <div className="flex-1 flex items-start justify-center py-12 px-4">
        <div className="bg-white rounded-xl shadow-lg w-full max-w-[800px] overflow-hidden relative">
          {/* Success content */}
          <div className="text-center py-10 px-8">
            {/* Green check */}
            <div className="flex items-center justify-center gap-2 mb-3">
              <CheckCircle size={28} className="text-green-600" />
              <h1 className="text-2xl font-bold text-gray-900">You are scheduled</h1>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              A calendar invitation has been sent to your email address.
            </p>

            {/* Check email message */}
            <div className="inline-flex items-center gap-2 px-5 py-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700 mb-8">
              <Mail size={18} />
              <span className="font-medium">Check your email for the meeting details and calendar invite.</span>
            </div>

            {/* Booking details card */}
            <div className="max-w-md mx-auto border border-gray-200 rounded-xl p-6 text-left">
              <h2 className="text-lg font-semibold text-gray-500 mb-4">{eventType.name}</h2>

              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <User size={16} className="text-gray-400 shrink-0" />
                  <span>{booking.invitee_name}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <svg className="w-4 h-4 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  <span>
                    {format(startDt, 'h:mma').toLowerCase()} - {format(endDt, 'h:mma').toLowerCase()}, {format(startDt, 'EEEE, MMMM d, yyyy')}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <Globe size={16} className="text-gray-400 shrink-0" />
                  <span>India Standard Time</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <Monitor size={16} className="text-gray-400 shrink-0" />
                  <span>Web conferencing details to follow.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
