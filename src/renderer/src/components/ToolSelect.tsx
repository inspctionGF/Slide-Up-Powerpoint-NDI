import { useEffect, useId, useRef, useState } from 'react'
import './ToolSelect.css'

export type SelectOption<T extends string | number = string | number> = {
  value: T
  label: string
}

type ToolSelectProps<T extends string | number> = {
  label: string
  value: T
  options: Array<T | SelectOption<T>>
  ariaLabel: string
  onChange: (value: T) => void
  variant?: 'toolbar' | 'field'
  disabled?: boolean
  className?: string
}

function normalizeOptions<T extends string | number>(
  options: Array<T | SelectOption<T>>
): SelectOption<T>[] {
  return options.map((option) =>
    typeof option === 'object' ? option : { value: option, label: String(option) }
  )
}

function ToolSelect<T extends string | number>({
  label,
  value,
  options,
  ariaLabel,
  onChange,
  variant = 'toolbar',
  disabled,
  className
}: ToolSelectProps<T>): JSX.Element {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const items = normalizeOptions(options)
  const current = items.find((item) => item.value === value) ?? items[0]

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (disabled) setOpen(false)
  }, [disabled])

  return (
    <div
      className={`select-field select-field--${variant}${open ? ' is-open' : ''}${className ? ` ${className}` : ''}`}
      ref={rootRef}
    >
      <span className="select-field__label">{label}</span>
      <div className="select-field__wrap">
        <button
          type="button"
          className="select-field__trigger"
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="select-field__value">{current?.label ?? String(value)}</span>
          <span className="select-field__chevron" aria-hidden="true" />
        </button>

        {open && (
          <ul id={listId} className="select-field__menu" role="listbox" aria-label={ariaLabel}>
            {items.map((item) => {
              const selected = item.value === value
              return (
                <li key={String(item.value)} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={`select-field__option${selected ? ' is-selected' : ''}`}
                    onClick={() => {
                      onChange(item.value)
                      setOpen(false)
                    }}
                  >
                    {item.label}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

export default ToolSelect
