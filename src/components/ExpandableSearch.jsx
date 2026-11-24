import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'

export default function ExpandableSearch({
  value,
  onChange,
  placeholder = 'Search...',
  ariaLabel = 'Search',
  className = '',
  inputClassName = '',
  onSubmit,
}) {
  const [expanded, setExpanded] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (expanded) inputRef.current?.focus()
  }, [expanded])

  const handleSubmit = (event) => {
    event.preventDefault()
    onSubmit?.(event)
  }

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      style={{ width: expanded ? '100%' : 44 }}
      className={`relative flex h-11 items-center overflow-hidden rounded-full bg-search transition-[width,box-shadow] duration-300 ease-in-out ${expanded ? 'border border-brand-light ring-2 ring-brand-light/20' : 'border border-transparent'} ${className}`}
    >
      {expanded ? (
        <>
          <Search className="ml-3 h-4 w-4 shrink-0 text-[#088395]" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            aria-label={ariaLabel}
            className={`h-full min-w-0 flex-1 bg-transparent px-3 text-sm text-navy placeholder-ink-secondary outline-none ${inputClassName}`}
          />
          <button type="button" onClick={() => { onChange(''); setExpanded(false) }} aria-label="Clear and close search" className="mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-secondary transition hover:bg-white hover:text-navy">
            <X className="h-4 w-4" />
          </button>
        </>
      ) : (
        <button type="button" onClick={() => setExpanded(true)} aria-label={ariaLabel} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#088395] transition hover:bg-brand-tintstrong hover:text-navy">
          <Search className="h-5 w-5" />
        </button>
      )}
    </form>
  )
}
