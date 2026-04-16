export default function EmptyState({ title, description, action }) {
  return (
    <div className="py-16 flex flex-col items-center text-center px-6">
      <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-7 h-7 text-gray-400">
          <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </div>
      <p className="font-semibold text-gray-900 mb-1">{title}</p>
      {description && <p className="text-sm text-text-secondary mb-4 max-w-xs">{description}</p>}
      {action}
    </div>
  )
}
