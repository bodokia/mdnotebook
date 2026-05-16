import { useEffect, useState } from 'react'

export interface ToastItem {
  id: string
  message: string
  onUndo?: () => void
  duration?: number
}

interface Props {
  toasts: ToastItem[]
  onDismiss: (id: string) => void
}

export default function Toast({ toasts, onDismiss }: Props) {
  if (toasts.length === 0) return null
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => (
        <ToastNotification key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function ToastNotification({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  const duration = toast.duration ?? 5000
  const [progress, setProgress] = useState(100)

  useEffect(() => {
    const start = Date.now()
    const interval = setInterval(() => {
      const pct = Math.max(0, 100 - ((Date.now() - start) / duration) * 100)
      setProgress(pct)
      if (pct === 0) {
        clearInterval(interval)
        onDismiss(toast.id)
      }
    }, 50)
    return () => clearInterval(interval)
  }, [toast.id, duration, onDismiss])

  return (
    <div
      className="pointer-events-auto relative overflow-hidden flex items-center gap-3 px-4 py-2.5 rounded-lg shadow-lg text-sm"
      style={{ backgroundColor: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', minWidth: 240 }}
    >
      <span className="flex-1">{toast.message}</span>
      {toast.onUndo && (
        <button
          className="font-semibold shrink-0 hover:opacity-70 transition-opacity"
          style={{ color: 'var(--accent)' }}
          onClick={() => { toast.onUndo?.(); onDismiss(toast.id) }}
        >
          Отменить
        </button>
      )}
      {/* progress bar */}
      <div
        className="absolute bottom-0 left-0 h-0.5 transition-none"
        style={{ width: `${progress}%`, backgroundColor: 'var(--accent)' }}
      />
    </div>
  )
}
