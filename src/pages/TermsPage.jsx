import { Link } from 'react-router-dom'

import { ArrowLeft } from 'lucide-react'

import { Logo } from '../components/ui/Logo'

import { cn } from '../lib/utils'



/** MZ 파스텔 — 개인정보처리방침과 동일 계열 */

const PAGE_BG =

  'bg-gradient-to-br from-rose-50/98 via-fuchsia-50/35 to-cyan-50/50'

const SECTION_CARD =

  'rounded-2xl border border-pink-100/60 bg-white/92 shadow-[0_4px_28px_-10px_rgba(244,114,182,0.18)] backdrop-blur-[2px]'



const bodyText = 'text-fuchsia-900/88'

const headingClass = 'text-base font-black text-fuchsia-950 mb-3'



export function TermsPage() {

  return (

    <div className={cn('min-h-screen', PAGE_BG)}>

      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">

        <Link

          to="/"

          className="inline-flex items-center gap-2 text-sm font-bold text-fuchsia-700 hover:text-fuchsia-900 mb-8 transition-colors"

        >

          <ArrowLeft size={16} className="shrink-0" />

          홈으로

        </Link>



        <div

          className={cn(

            SECTION_CARD,

            'p-6 sm:p-8 mb-8 border-pink-100/70 bg-gradient-to-br from-white/95 via-rose-50/30 to-fuchsia-50/20'

          )}

        >

          <div className="flex items-center gap-3">

            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-fuchsia-100 to-cyan-100 border border-pink-200/50 flex items-center justify-center shadow-sm">

              <Logo size={28} dark={false} link={false} />

            </div>

            <h1 className="text-2xl font-black text-fuchsia-950 tracking-tight">이용약관</h1>

          </div>

        </div>



        <div className={cn(SECTION_CARD, 'p-6 sm:p-8 border-pink-100/70')}>

          <div className="max-w-none text-sm leading-relaxed space-y-8">

            <p className="text-xs font-black text-fuchsia-500 uppercase tracking-wider">

              시행일: 2026년 1월 1일

            </p>



            <section>

              <h2 className={headingClass}>제1조 (목적)</h2>

              <p className={bodyText}>

                본 약관은 VictorySpace(이하 &quot;회사&quot;)가 제공하는 경쟁·투표 서비스(이하 &quot;서비스&quot;)의 이용 조건 및 절차, 회사와 이용자 간의 권리·의무 및 책임 사항을 규정함을 목적으로 합니다.

              </p>

            </section>



            <section>

              <h2 className={headingClass}>제2조 (서비스의 내용)</h2>

              <p className={bodyText}>

                회사는 사용자가 다양한 주제에 대해 경쟁을 생성하고, 다른 사용자들이 투표에 참여할 수 있는 플랫폼을 제공합니다. 서비스 내 랭킹, 포인트, 배지 등은 서비스 운영 목적으로 제공됩니다.

              </p>

            </section>



            <section>

              <h2 className={headingClass}>제3조 (콘텐츠 저작권 및 책임)</h2>

              <p className={bodyText}>

                사용자가 업로드한 게시물(이미지, 영상, 텍스트 등)에 대한 저작권은 사용자 본인에게 있습니다. 다만, 회사는 서비스 홍보 및 운영 목적으로 해당 게시물을 활용할 수 있습니다. 타인의 저작권 및 초상권을 침해하여 발생하는 모든 법적 책임은 업로드한 사용자 본인에게 있습니다.

              </p>

            </section>



            <section>

              <h2 className={headingClass}>제4조 (부정행위 및 서비스 이용 제한)</h2>

              <p className={bodyText}>

                매크로, 대리 투표, 주제 이탈 게시물 반복 업로드 등 플랫폼의 정상적인 운영을 방해하는 행위 적발 시, 회사는 사전 통보 없이 해당 계정을 정지하거나 랭킹 보상을 회수할 수 있습니다.

              </p>

            </section>



            <section>

              <h2 className={headingClass}>제5조 (경쟁 결과에 대한 면책)</h2>

              <p className={bodyText}>

                본 서비스의 투표 결과는 사용자의 주관적인 평가에 기반하며, 회사는 경쟁의 결과가 특정 개인이나 제품의 객관적인 가치를 증명한다고 보장하지 않습니다.

              </p>

            </section>



            <section>

              <h2 className={headingClass}>제6조 (약관의 변경)</h2>

              <p className={bodyText}>

                회사는 필요한 경우 관련 법령을 위반하지 않는 범위에서 본 약관을 변경할 수 있으며, 변경 시 서비스 내 공지 또는 이메일 등으로 안내합니다.

              </p>

            </section>

          </div>

        </div>



        <div

          className={cn(

            SECTION_CARD,

            'mt-8 p-5 flex flex-wrap items-center justify-center gap-3 border-pink-100/70'

          )}

        >

          <Link

            to="/privacy"

            className="text-sm font-black text-fuchsia-700 hover:text-fuchsia-900 underline decoration-fuchsia-300/70 underline-offset-2"

          >

            개인정보처리방침 보기 →

          </Link>

          <Link

            to="/community-policy"

            className="text-sm font-black text-fuchsia-700 hover:text-fuchsia-900 underline decoration-fuchsia-300/70 underline-offset-2"

          >

            커뮤니티 가이드라인 →

          </Link>

        </div>

      </div>

    </div>

  )

}


