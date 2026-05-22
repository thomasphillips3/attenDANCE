import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
} from '@radix-ui/react-dialog'

interface ConfirmModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
  presentCount: number
  absentCount: number
  unmarkedCount: number
  isSubmitting: boolean
}

/**
 * ConfirmModal — attendance submission confirmation dialog.
 *
 * Uses @radix-ui/react-dialog primitives for accessible overlay behavior
 * (focus trap, Escape to close, ARIA roles).
 *
 * Visual spec from interfaces block:
 * - Overlay: fixed inset-0, black at 40% opacity
 * - Content: centered, white bg, border-radius 28px (--radius-xl), box-shadow --shadow-modal, padding 36px, max-width 480px
 * - DialogTitle: "Submit Attendance" in DM Serif Display 32px --color-ink
 * - Body line: "{presentCount} Present · {absentCount} Absent · {unmarkedCount} Not marked" 20px --color-ink-2
 * - Actions: Cancel (border, white bg) + Submit (purple bg) — each min-height 56px, flex-1, border-radius 14px
 * - Submit disabled + spinner while isSubmitting is true
 * - Cancel always calls onClose() and is never disabled
 */
export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  presentCount,
  absentCount,
  unmarkedCount,
  isSubmitting,
}: ConfirmModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogPortal>
        {/* Overlay — fixed inset-0, black at 40% opacity */}
        <DialogOverlay
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.40)',
            zIndex: 50,
          }}
        />

        {/* Content — centered modal panel */}
        <DialogContent
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 51,
            background: 'var(--color-white)',
            borderRadius: 28,
            boxShadow: 'var(--shadow-modal)',
            padding: 36,
            maxWidth: 480,
            width: 'calc(100vw - 48px)',
            outline: 'none',
          }}
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          {/* Title */}
          <DialogTitle
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 32,
              fontWeight: 400,
              color: 'var(--color-ink)',
              lineHeight: 1.15,
              margin: '0 0 16px 0',
            }}
          >
            Submit Attendance
          </DialogTitle>

          {/* Counts summary line */}
          <p
            style={{
              fontSize: 20,
              color: 'var(--color-ink-2)',
              margin: '0 0 32px 0',
              lineHeight: 1.4,
            }}
          >
            {presentCount} Present · {absentCount} Absent · {unmarkedCount} Not marked
          </p>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 12 }}>
            {/* Cancel — always enabled, never disabled */}
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                minHeight: 56,
                border: '1px solid var(--color-line)',
                background: 'var(--color-white)',
                color: 'var(--color-ink-2)',
                borderRadius: 14,
                fontSize: 17,
                fontFamily: 'var(--font-body)',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              Cancel
            </button>

            {/* Submit — disabled + spinner while isSubmitting */}
            <button
              type="button"
              onClick={onConfirm}
              disabled={isSubmitting}
              style={{
                flex: 1,
                minHeight: 56,
                background: isSubmitting
                  ? 'var(--color-purple-deep)'
                  : 'var(--color-purple)',
                color: 'var(--color-white)',
                border: 'none',
                borderRadius: 14,
                fontSize: 17,
                fontFamily: 'var(--font-body)',
                fontWeight: 700,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
              }}
            >
              {isSubmitting ? (
                <>
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      border: '2px solid var(--color-purple-tint)',
                      borderTopColor: 'white',
                      borderRadius: '50%',
                      display: 'inline-block',
                      animation: 'spin 0.7s linear infinite',
                    }}
                  />
                  Submitting…
                </>
              ) : (
                'Submit'
              )}
            </button>
          </div>

          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  )
}
