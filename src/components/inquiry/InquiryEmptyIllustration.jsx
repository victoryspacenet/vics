/** 문의 내역 빈 화면용 캐릭터 일러스트 */
export function InquiryEmptyIllustration({ className = '' }) {
  return (
    <div className={`w-32 h-32 mx-auto ${className}`}>
      <svg viewBox="0 0 128 128" fill="none" className="w-full h-full">
        {/* 배경 원 */}
        <circle cx="64" cy="64" r="56" fill="#ECFDF5" />
        {/* 캐릭터 머리 */}
        <circle cx="64" cy="48" r="24" fill="#10B981" fillOpacity="0.9" />
        {/* 눈 */}
        <ellipse cx="57" cy="45" rx="3" ry="4" fill="#fff" />
        <ellipse cx="71" cy="45" rx="3" ry="4" fill="#fff" />
        {/* 몸통 (말풍선 형태) */}
        <path
          d="M40 72 Q64 92 88 72 Q88 88 64 96 Q40 88 40 72"
          fill="#10B981"
          fillOpacity="0.7"
        />
        {/* 물음표 */}
        <text x="64" y="82" textAnchor="middle" fill="#fff" fontSize="20" fontWeight="bold">?</text>
        {/* 하트/별 장식 */}
        <circle cx="48" cy="38" r="4" fill="#34D399" fillOpacity="0.6" />
        <circle cx="80" cy="38" r="4" fill="#34D399" fillOpacity="0.6" />
      </svg>
    </div>
  )
}
