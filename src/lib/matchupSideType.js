/** 매치업 A/B 측 콘텐츠 형식 — image | video | text */

export function isMatchupSideType(type) {
  return type === 'image' || type === 'video' || type === 'text'
}

export function matchupSideTypeLabel(type) {
  if (type === 'image') return '이미지'
  if (type === 'video') return '영상'
  if (type === 'text') return '텍스트'
  return '콘텐츠'
}

/**
 * B측(도전)이 A측(left_type)과 동일 형식인지
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function assertMatchupSideTypeEquals(requiredType, actualType) {
  if (!isMatchupSideType(requiredType)) return { ok: true }
  if (actualType === requiredType) return { ok: true }
  const label = matchupSideTypeLabel(requiredType)
  return {
    ok: false,
    message: `A측이 ${label} 형식이에요. B측도 ${label}로 올려주세요.`,
  }
}

/**
 * 업로드 파일이 요구 형식과 맞는지
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function mediaFileMatchesMatchupSideType(requiredType, file) {
  if (!file || !isMatchupSideType(requiredType)) return { ok: true }
  const isImage = file.type.startsWith('image/')
  const isVideo = file.type.startsWith('video/')
  if (requiredType === 'image' && !isImage) {
    return { ok: false, message: 'A측이 이미지 형식이에요. 이미지만 올려주세요.' }
  }
  if (requiredType === 'video' && !isVideo) {
    return { ok: false, message: 'A측이 영상 형식이에요. 영상만 올려주세요.' }
  }
  if (requiredType === 'text') {
    return { ok: false, message: 'A측이 텍스트 형식이에요. 텍스트로 입력해 주세요.' }
  }
  return { ok: true }
}
