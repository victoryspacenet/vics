import { useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react'
import {
  compressImageContain,
  compressImageSquareForMatchup,
} from '../../lib/imageCompression'
import { cn } from '../../lib/utils'

/**
 * @typedef {'contain' | 'square'} ImageUploadVariant
 * - contain: 비율 유지, 긴 변 기준 리사이즈 + JPEG (첨부·에디터용)
 * - square: 매치업 미디어용 1:1 중앙 크롭 (mediaCrop)
 */

const defaultContain = {
  maxEdge: 1920,
  quality: 0.82,
  maxBytes: 1.8 * 1024 * 1024,
}

/**
 * 파일 선택 → 브라우저에서 압축 → `onReady(File)` 로 전달합니다.
 *
 * @param {{
 *   variant?: ImageUploadVariant,
 *   containOptions?: Partial<{ maxEdge: number, quality: number, maxBytes: number }>,
 *   accept?: string,
 *   disabled?: boolean,
 *   className?: string,
 *   inputClassName?: string,
 *   'aria-label'?: string,
 *   onReady: (file: File) => void | Promise<void>,
 *   onError?: (message: string) => void,
 *   children?: React.ReactNode | ((state: { compressing: boolean, open: () => void }) => React.ReactNode),
 * }} props
 */
export const ImageUploadWithCompression = forwardRef(function ImageUploadWithCompression(
  {
    variant = 'contain',
    containOptions,
    accept = 'image/*',
    disabled = false,
    className,
    inputClassName = 'hidden',
    'aria-label': ariaLabel = '이미지 파일 선택',
    onReady,
    onError,
    children,
  },
  ref,
) {
  const inputRef = useRef(null)
  const [compressing, setCompressing] = useState(false)

  const open = useCallback(() => {
    if (disabled || compressing) return
    inputRef.current?.click()
  }, [disabled, compressing])

  useImperativeHandle(ref, () => ({ open, focusInput: open }), [open])

  const handleChange = useCallback(
    async (e) => {
      const raw = e.target.files?.[0]
      e.target.value = ''
      if (!raw) return
      if (!raw.type.startsWith('image/')) {
        onError?.('이미지 파일만 선택할 수 있어요.')
        return
      }
      setCompressing(true)
      try {
        const file =
          variant === 'square'
            ? await compressImageSquareForMatchup(raw)
            : await compressImageContain(raw, { ...defaultContain, ...containOptions })
        await onReady?.(file)
      } catch (err) {
        const msg = err?.message || '이미지를 처리하지 못했어요.'
        onError?.(msg)
      } finally {
        setCompressing(false)
      }
    },
    [variant, containOptions, onReady, onError],
  )

  const slot =
    typeof children === 'function'
      ? children({ compressing, open })
      : children

  return (
    <span className={cn('inline-flex flex-col', className)}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className={inputClassName}
        aria-label={ariaLabel}
        disabled={disabled || compressing}
        onChange={handleChange}
      />
      {slot ?? (
        <button
          type="button"
          disabled={disabled || compressing}
          onClick={open}
          className="rounded-xl border border-pink-200 bg-white px-4 py-2 text-sm font-bold text-pink-800 shadow-sm transition hover:bg-pink-50 disabled:opacity-50"
        >
          {compressing ? '압축 중…' : '이미지 선택'}
        </button>
      )}
    </span>
  )
})

ImageUploadWithCompression.displayName = 'ImageUploadWithCompression'
