import { useEffect } from 'react'

// Close a dialog with the Escape key while it is open.
export default function useEscape(onEscape, active) {
  useEffect(() => {
    if (!active) return
    const handler = e => { if (e.key === 'Escape') onEscape() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onEscape, active])
}
