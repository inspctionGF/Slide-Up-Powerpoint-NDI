import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { createPortal } from 'react-dom'
import './Tooltip.css'

type TipState = {
  text: string
  x: number
  y: number
  placement: 'top' | 'bottom'
}

const TITLEBAR_SAFE = 56
const TIP_ESTIMATE = 48

function ensureTipLayer(): HTMLElement {
  let layer = document.getElementById('slideup-tooltip-root')
  if (!layer) {
    layer = document.createElement('div')
    layer.id = 'slideup-tooltip-root'
    layer.className = 'tip-layer'
    layer.setAttribute('aria-hidden', 'true')
    document.body.appendChild(layer)
  }
  return layer
}

function resolveTipTarget(node: EventTarget | null): HTMLElement | null {
  if (!(node instanceof Element)) return null
  return node.closest('[data-tip]') as HTMLElement | null
}

function TooltipProvider({ children }: { children: ReactNode }): JSX.Element {
  const [tip, setTip] = useState<TipState | null>(null)
  const [layer, setLayer] = useState<HTMLElement | null>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const activeEl = useRef<HTMLElement | null>(null)
  const hideTimer = useRef<number | null>(null)

  useEffect(() => {
    setLayer(ensureTipLayer())
    return () => {
      // garder la couche pour les remontages HMR
    }
  }, [])

  const clearHide = useCallback(() => {
    if (hideTimer.current != null) {
      window.clearTimeout(hideTimer.current)
      hideTimer.current = null
    }
  }, [])

  const hide = useCallback(() => {
    clearHide()
    activeEl.current = null
    setTip(null)
  }, [clearHide])

  const showFor = useCallback(
    (el: HTMLElement) => {
      const text = el.getAttribute('data-tip')?.trim()
      if (!text) {
        hide()
        return
      }
      clearHide()
      activeEl.current = el
      const rect = el.getBoundingClientRect()
      const spaceAbove = rect.top
      const spaceBelow = window.innerHeight - rect.bottom
      const needsRoom = TIP_ESTIMATE + 12
      let placement: 'top' | 'bottom' = 'top'
      if (spaceAbove < TITLEBAR_SAFE + needsRoom && spaceBelow > needsRoom) {
        placement = 'bottom'
      } else if (spaceAbove < needsRoom && spaceBelow > spaceAbove) {
        placement = 'bottom'
      }
      setTip({
        text,
        x: rect.left + rect.width / 2,
        y: placement === 'top' ? rect.top : rect.bottom,
        placement
      })
    },
    [clearHide, hide]
  )

  useEffect(() => {
    const onEnter = (event: MouseEvent): void => {
      const el = resolveTipTarget(event.target)
      if (!el) return
      showFor(el)
    }

    const onLeave = (event: MouseEvent): void => {
      const el = resolveTipTarget(event.target)
      if (!el || el !== activeEl.current) return
      const related = event.relatedTarget
      if (related instanceof Node && el.contains(related)) return
      hideTimer.current = window.setTimeout(hide, 40)
    }

    const onFocusIn = (event: FocusEvent): void => {
      const el = resolveTipTarget(event.target)
      if (el) showFor(el)
    }

    const onFocusOut = (event: FocusEvent): void => {
      const el = resolveTipTarget(event.target)
      if (!el || el !== activeEl.current) return
      hide()
    }

    const onScroll = (): void => {
      if (activeEl.current) showFor(activeEl.current)
      else hide()
    }

    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') hide()
    }

    document.addEventListener('mouseover', onEnter)
    document.addEventListener('mouseout', onLeave)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', hide)
    document.addEventListener('keydown', onKey)

    return () => {
      document.removeEventListener('mouseover', onEnter)
      document.removeEventListener('mouseout', onLeave)
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', hide)
      document.removeEventListener('keydown', onKey)
      clearHide()
    }
  }, [clearHide, hide, showFor])

  useLayoutEffect(() => {
    if (!tip || !tipRef.current) return
    const node = tipRef.current
    const width = node.offsetWidth
    const pad = 8
    let left = tip.x
    left = Math.min(window.innerWidth - pad - width / 2, Math.max(pad + width / 2, left))
    node.style.left = `${left}px`
    node.style.top = `${tip.y}px`
  }, [tip])

  return (
    <>
      {children}
      {tip && layer
        ? createPortal(
            <div
              ref={tipRef}
              className={`tip-bubble tip-bubble--${tip.placement}${tip.text.length > 28 ? ' tip-bubble--wrap' : ''}`}
              style={{ left: tip.x, top: tip.y }}
              role="tooltip"
            >
              {tip.text}
            </div>,
            layer
          )
        : null}
    </>
  )
}

export default TooltipProvider
