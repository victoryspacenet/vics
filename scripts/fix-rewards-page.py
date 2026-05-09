import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('src/pages/PointRewardsPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the !isDiamondTier branch - card only shows when isDiamondTier is true
old = """                {!isDiamondTier ? (
                  <p className="mt-3 text-[11px] font-bold leading-snug text-violet-800/90 sm:text-xs">
                    다이아몬드 등급(Clap 5,000+) 달성 시 자동으로 이용할 수 있어요.{' '}
                    <Link to="/fandom" className="underline underline-offset-2 hover:text-violet-950">
                      내 팬덤
                    </Link>
                    에서 진행 상황을 확인해 보세요.
                  </p>
                ) : (
                  <div className="mt-4 flex flex-col gap-3 border-t border-pink-100/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-black text-cyan-900 sm:text-sm">
                        상태: {legendShellOn ? '켜짐 · 레전드 셸 적용 중' : '꺼짐 · 기본 화면'}
                      </p>
                      <p className="mt-1 text-[10px] font-medium text-slate-500 sm:text-[11px]">
                        포인트 차감 없음 · 언제든 다시 켤 수 있어요
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={legendThemeBusy}
                      onClick={() => void toggleLegendDiamondShell()}
                      className={cn(
                        'shrink-0 rounded-xl px-4 py-2.5 text-xs font-black transition disabled:opacity-50 sm:text-sm',
                        legendShellOn
                          ? 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                          : 'border border-cyan-400/60 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-cyan-100 shadow-md hover:brightness-110',
                      )}
                    >
                      {legendThemeBusy ? '저장 중…' : legendShellOn ? '기본 화면으로' : '레전드 테마 켜기'}
                    </button>
                  </div>
                )}"""

new = """                <div className="mt-4 flex flex-col gap-3 border-t border-pink-100/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-black text-cyan-900 sm:text-sm">
                      상태: {legendShellOn ? '켜짐 · 레전드 셸 적용 중' : '꺼짐 · 기본 화면'}
                    </p>
                    <p className="mt-1 text-[10px] font-medium text-slate-500 sm:text-[11px]">
                      포인트 차감 없음 · 언제든 다시 켤 수 있어요
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={legendThemeBusy}
                    onClick={() => void toggleLegendDiamondShell()}
                    className={cn(
                      'shrink-0 rounded-xl px-4 py-2.5 text-xs font-black transition disabled:opacity-50 sm:text-sm',
                      legendShellOn
                        ? 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                        : 'border border-cyan-400/60 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-cyan-100 shadow-md hover:brightness-110',
                    )}
                  >
                    {legendThemeBusy ? '저장 중…' : legendShellOn ? '기본 화면으로' : '레전드 테마 켜기'}
                  </button>
                </div>"""

if old in content:
    content = content.replace(old, new)
    print('Branch simplified successfully')
else:
    print('ERROR: Pattern not found')
    # Debug: show the relevant section
    idx = content.find('isDiamondTier ?')
    if idx >= 0:
        print(repr(content[idx-5:idx+200]))

with open('src/pages/PointRewardsPage.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done!')
