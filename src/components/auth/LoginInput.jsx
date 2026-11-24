import { Eye, EyeOff } from 'lucide-react'

export default function LoginInput({
  id,
  label,
  type = 'text',
  value,
  onChange,
  onKeyUp,
  onBlur,
  placeholder,
  icon: Icon,
  error,
  disabled,
  autoComplete,
  showToggle,
  showPassword,
  onTogglePassword,
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0A4D68]"
      >
        {label}
      </label>
      <div className="relative">
        {Icon && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2">
            <Icon className="text-[#088395]" size={18} />
          </span>
        )}
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          onKeyUp={onKeyUp}
          onBlur={onBlur}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className="w-full rounded-[14px] border border-transparent bg-[#F1F5F9] py-3.5 pl-11 pr-11 text-sm text-[#0A4D68] placeholder:text-slate-500 transition focus:border-[#088395] focus:outline-none focus:ring-2 focus:ring-[#088395]/15 disabled:cursor-not-allowed disabled:opacity-50"
        />
        {showToggle && (
          <button
            type="button"
            onClick={onTogglePassword}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-[#0A4D68] transition hover:bg-[#E0F7FA]"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
