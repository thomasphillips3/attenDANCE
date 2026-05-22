import { useState, useRef } from 'react'
import imageCompression from 'browser-image-compression'
import { supabase } from '../../lib/supabase'

interface PhotoUploadProps {
  /** Signed URL for displaying the current photo (from GET /students/:id) */
  currentPhotoUrl?: string | null
  /** Called with the storage path after successful upload */
  onUpload: (storagePath: string) => void
  /** Student ID for the upload path — 'new' if creating */
  studentId?: string
  /** Organization ID from JWT for storage RLS scoping (children's data, T-02-08) */
  organizationId: string
}

/**
 * PhotoUpload — client-side image compression + Supabase Storage upload.
 *
 * CHILDREN'S DATA: Upload path includes organization_id for storage RLS
 * scoping. Photos stored in private bucket with signed URL access only.
 *
 * Compresses to 200KB max / 400px max dimension before upload (T-02-08).
 */
export default function PhotoUpload({
  currentPhotoUrl,
  onUpload,
  studentId,
  organizationId,
}: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const displayUrl = previewUrl || currentPhotoUrl

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setErrorMsg(null)
    setUploading(true)

    try {
      // Client-side compression — maxSizeMB 0.2 (200KB), 400px max dimension
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.2,
        maxWidthOrHeight: 400,
        useWebWorker: true,
      })

      // CHILDREN'S DATA — path MUST include organization_id for storage RLS (T-02-08)
      const path = `${organizationId}/${studentId || 'new'}/${Date.now()}.jpg`

      const { error: uploadError } = await supabase.storage
        .from('student-photos')
        .upload(path, compressed, {
          contentType: 'image/jpeg',
          upsert: true,
        })

      if (uploadError) {
        setErrorMsg(uploadError.message || 'Upload failed')
        return
      }

      // Show local preview immediately
      setPreviewUrl(URL.createObjectURL(compressed))

      // Notify parent with the storage path (not the URL)
      onUpload(path)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      {/* Photo circle — 96x96 */}
      <div
        style={{
          width: 96,
          height: 96,
          borderRadius: '50%',
          overflow: 'hidden',
          backgroundColor: 'var(--color-line)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {displayUrl ? (
          <img
            src={displayUrl}
            alt="Student photo"
            style={{ width: 96, height: 96, objectFit: 'cover' }}
          />
        ) : (
          // Simple person silhouette SVG placeholder
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-ink-3)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
          </svg>
        )}
      </div>

      {/* Upload button */}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        aria-label="Upload student photo"
        style={{
          height: 48,
          minHeight: 56, // 56px tap target
          padding: '8px 16px',
          fontSize: 14,
          fontWeight: 600,
          fontFamily: 'var(--font-body)',
          border: '1px solid var(--color-line-strong)',
          borderRadius: 'var(--radius-sm)',
          background: 'white',
          color: 'var(--color-ink-2)',
          cursor: uploading ? 'wait' : 'pointer',
          opacity: uploading ? 0.6 : 1,
        }}
      >
        {uploading
          ? 'Uploading...'
          : displayUrl
            ? 'Change Photo'
            : 'Upload Photo'}
      </button>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        aria-hidden="true"
      />

      {/* Error message */}
      {errorMsg && (
        <span
          style={{
            color: '#D32F2F',
            fontSize: 14,
            fontFamily: 'var(--font-body)',
            textAlign: 'center',
          }}
        >
          {errorMsg}
        </span>
      )}
    </div>
  )
}
