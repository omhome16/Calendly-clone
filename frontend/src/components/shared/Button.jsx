import clsx from 'clsx'

const variants = {
  primary: 'bg-primary text-white hover:bg-primary-hover',
  secondary: 'bg-white text-gray-700 border border-border hover:bg-gray-50',
  danger: 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100',
}

export default function Button({
  children,
  variant = 'primary',
  className = '',
  disabled = false,
  ...props
}) {
  return (
    <button
      className={clsx(
        'px-4 py-2 rounded-md text-sm font-medium transition-colors duration-150',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        className
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}
