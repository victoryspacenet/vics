import { useRef, useState, useCallback, useEffect } from 'react'
import { Bold, Italic, Underline, Image, Link2 } from 'lucide-react'

const FONT_SIZES = [
  { value: '1', label: '작게' },
  { value: '3', label: '보통' },
  { value: '5', label: '크게' },
  { value: '7', label: '아주 크게' },
]

/** contentEditable 안의 현재 Range를 복제해 둡니다 (툴바 클릭·링크 입력창 포커스로 선택이 사라지는 것 방지) */
function cloneRangeInEditor(editor, range) {
  if (!editor || !range) return null
  try {
    const root = range.commonAncestorContainer
    if (root.nodeType === Node.TEXT_NODE) {
      if (!editor.contains(root.parentNode)) return null
    } else if (!editor.contains(root)) {
      return null
    }
    return range.cloneRange()
  } catch {
    return null
  }
}

function restoreRangeInEditor(editor, range) {
  if (!editor || !range) return false
  try {
    const root = range.commonAncestorContainer
    const inside =
      root.nodeType === Node.TEXT_NODE
        ? editor.contains(root.parentNode)
        : editor.contains(root)
    if (!inside) return false
    const sel = window.getSelection()
    if (!sel) return false
    sel.removeAllRanges()
    sel.addRange(range)
    return true
  } catch {
    return false
  }
}

function placeCaretAtEnd(editor) {
  if (!editor) return
  const range = document.createRange()
  range.selectNodeContents(editor)
  range.collapse(false)
  const sel = window.getSelection()
  if (!sel) return
  sel.removeAllRanges()
  sel.addRange(range)
}

const UNSAFE_HREF = /^\s*(javascript:|data:|vbscript:)/i

/** contentEditable 안에서 링크가 클릭·탐색 가능하도록 보강 */
function normalizeAnchorsInEditor(root) {
  if (!root?.querySelectorAll) return
  root.querySelectorAll('a[href]').forEach((a) => {
    const href = (a.getAttribute('href') || '').trim()
    if (!href || UNSAFE_HREF.test(href)) return
    a.setAttribute('contenteditable', 'false')
    if (!a.hasAttribute('target')) a.setAttribute('target', '_blank')
    const rel = (a.getAttribute('rel') || '').toLowerCase()
    if (!rel.includes('noopener')) a.setAttribute('rel', 'noopener noreferrer')
  })
}

function openHrefFromEditorAnchor(a) {
  const raw = (a?.getAttribute?.('href') || '').trim()
  if (!raw || UNSAFE_HREF.test(raw)) return
  try {
    const url = new URL(raw, window.location.href).href
    window.open(url, '_blank', 'noopener,noreferrer')
  } catch {
    /* ignore invalid URL */
  }
}

export function RichTextEditor({ value, onChange, placeholder = '내용을 입력하세요...' }) {
  const editorRef = useRef(null)
  const fileInputRef = useRef(null)
  const savedRangeRef = useRef(null)
  const [linkUrl, setLinkUrl] = useState('')
  const [showLinkInput, setShowLinkInput] = useState(false)

  const execCmd = useCallback((cmd, value = null) => {
    document.execCommand(cmd, false, value)
    const el = editorRef.current
    if (el) normalizeAnchorsInEditor(el)
    el?.focus()
    onChange?.(el?.innerHTML || '')
  }, [onChange])

  const handleInput = useCallback(() => {
    const el = editorRef.current
    if (el) normalizeAnchorsInEditor(el)
    onChange?.(el?.innerHTML || '')
  }, [onChange])

  const handleEditorMouseDown = useCallback((e) => {
    if (e.button !== 0) return
    const t = e.target
    const el = t?.nodeType === Node.TEXT_NODE ? t.parentElement : t
    const a = typeof el?.closest === 'function' ? el.closest('a[href]') : null
    const editor = editorRef.current
    if (!a || !editor?.contains(a)) return
    const href = (a.getAttribute('href') || '').trim()
    if (!href || UNSAFE_HREF.test(href)) return
    e.preventDefault()
    openHrefFromEditorAnchor(a)
  }, [])

  const handleImageClick = () => {
    fileInputRef.current?.click()
  }

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      execCmd('insertImage', reader.result)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleLink = () => {
    const editor = editorRef.current
    if (!editor) return

    editor.focus()
    const sel = window.getSelection()
    let range = sel?.rangeCount ? sel.getRangeAt(0) : null
    if (!range || !cloneRangeInEditor(editor, range)) {
      placeCaretAtEnd(editor)
      const sel2 = window.getSelection()
      range = sel2?.rangeCount ? sel2.getRangeAt(0) : null
    }
    if (!range) return

    const saved = cloneRangeInEditor(editor, range)
    savedRangeRef.current = saved

    if (range.collapsed) {
      setShowLinkInput(true)
      return
    }

    const url = window.prompt('링크 URL을 입력하세요:')
    const trimmed = url?.trim()
    if (!trimmed) {
      savedRangeRef.current = null
      return
    }
    editor.focus()
    if (savedRangeRef.current && restoreRangeInEditor(editor, savedRangeRef.current)) {
      document.execCommand('createLink', false, trimmed)
      normalizeAnchorsInEditor(editor)
      editor.focus()
      onChange?.(editor.innerHTML || '')
    }
    savedRangeRef.current = null
  }

  const handleLinkSubmit = () => {
    const editor = editorRef.current
    const trimmed = linkUrl.trim()
    if (!editor || !trimmed) return

    editor.focus()
    let r = savedRangeRef.current
    if (!r || !restoreRangeInEditor(editor, r)) {
      placeCaretAtEnd(editor)
      const sel = window.getSelection()
      const live = sel?.rangeCount ? sel.getRangeAt(0) : null
      r = cloneRangeInEditor(editor, live)
    }
    if (!r || !restoreRangeInEditor(editor, r)) {
      savedRangeRef.current = null
      setLinkUrl('')
      setShowLinkInput(false)
      return
    }

    const ok = document.execCommand('createLink', false, trimmed)
    if (!ok) {
      const a = document.createElement('a')
      a.href = trimmed
      a.textContent = trimmed
      a.rel = 'noopener noreferrer'
      a.target = '_blank'
      a.setAttribute('contenteditable', 'false')
      const sel = window.getSelection()
      if (sel?.rangeCount) {
        const cr = sel.getRangeAt(0)
        cr.deleteContents()
        cr.insertNode(a)
        cr.setStartAfter(a)
        cr.collapse(true)
        sel.removeAllRanges()
        sel.addRange(cr)
      }
    }
    normalizeAnchorsInEditor(editor)
    onChange?.(editor.innerHTML || '')

    savedRangeRef.current = null
    setLinkUrl('')
    setShowLinkInput(false)
    editor.focus()
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer?.files?.[0]
    if (file?.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = () => execCmd('insertImage', reader.result)
      reader.readAsDataURL(file)
    }
  }

  const handleDragOver = (e) => e.preventDefault()

  useEffect(() => {
    if (editorRef.current && value !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = value || ''
      normalizeAnchorsInEditor(editorRef.current)
    }
  }, []) // 초기값만 설정

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      {/* 툴바 */}
      <div className="flex flex-wrap items-center gap-1 p-2 border-b border-gray-100 bg-gray-50">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => execCmd('bold')}
          className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
          title="굵게"
        >
          <Bold size={16} className="text-gray-600" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => execCmd('italic')}
          className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
          title="기울임"
        >
          <Italic size={16} className="text-gray-600" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => execCmd('underline')}
          className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
          title="밑줄"
        >
          <Underline size={16} className="text-gray-600" />
        </button>
        <span className="w-px h-5 bg-gray-200 mx-1" />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleImageClick}
          className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
          title="이미지 삽입"
        >
          <Image size={16} className="text-gray-600" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageUpload}
        />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleLink}
          className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
          title="링크 삽입"
        >
          <Link2 size={16} className="text-gray-600" />
        </button>
        <span className="w-px h-5 bg-gray-200 mx-1" />
        <select
          onChange={(e) => execCmd('fontSize', e.target.value)}
          className="text-xs font-medium px-2 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600"
          title="폰트 크기"
        >
          {FONT_SIZES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* 링크 입력 (선택 영역 없을 때) */}
      {showLinkInput && (
        <div className="flex gap-2 p-2 bg-amber-50 border-b border-amber-100">
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://..."
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-amber-200 bg-white"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleLinkSubmit()
              }
            }}
          />
          <button
            type="button"
            onClick={handleLinkSubmit}
            className="px-3 py-2 text-sm font-bold text-amber-700 hover:bg-amber-100 rounded-lg"
          >
            삽입
          </button>
          <button
            type="button"
            onClick={() => {
              savedRangeRef.current = null
              setShowLinkInput(false)
              setLinkUrl('')
            }}
            className="px-3 py-2 text-sm text-gray-500 hover:bg-amber-100 rounded-lg"
          >
            취소
          </button>
        </div>
      )}

      {/* 에디터 영역 */}
      <div
        ref={editorRef}
        contentEditable
        onMouseDown={handleEditorMouseDown}
        onInput={handleInput}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        data-placeholder={placeholder}
        className="min-h-[200px] max-h-[400px] overflow-y-auto px-4 py-3 text-[15px] leading-[1.8] text-gray-700 focus:outline-none [&:empty::before]:content-[attr(data-placeholder)] [&:empty::before]:text-gray-400 [&_a[href]]:cursor-pointer [&_a[href]]:text-fuchsia-700 [&_a[href]]:underline"
      />
    </div>
  )
}
