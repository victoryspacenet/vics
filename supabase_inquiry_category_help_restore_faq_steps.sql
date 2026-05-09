-- 카테고리 도움말: 마이그레이션으로 steps가 비고 본문만 answer에 남은 행을
-- FAQ와 동일한 요약·단계·바로가기·일러스트로 복원 (제목·카테고리 일치 시)

update public.inquiry_category_help
set
  answer = '매치업 결과가 확정된 후 포인트가 지급됩니다.',
  steps = '["매치업 결과가 확정되면 24시간 이내에 적중 시 포인트가 자동 지급됩니다.","마이페이지/랭킹페이지에서 내 포인트 현황을 확인할 수 있어요.","포인트는 시즌별로 집계되며, 시즌 종료 시 일부 리셋될 수 있습니다."]'::jsonb,
  actions = '[{"text":"랭킹에서 포인트 확인하기","to":"/ranking"},{"text":"경쟁 참여하기","to":"/"}]'::jsonb,
  illustration = 'points',
  body = ''
where category_slug = 'matchup' and title = '승리 포인트는 언제 들어오나요?';

update public.inquiry_category_help
set
  answer = '매치업 카드를 탭하고 선택지를 누르면 됩니다.',
  steps = '["홈 또는 매치업 피드에서 원하는 매치업 카드를 탭합니다.","화면에 표시된 두 선택지 중 하나를 탭합니다.","투표가 완료되면 결과를 확인할 수 있어요."]'::jsonb,
  actions = '[{"text":"경쟁 참여하기","to":"/"},{"text":"매치업 목록 보기","to":"/matchups"}]'::jsonb,
  illustration = 'vote',
  body = ''
where category_slug = 'matchup' and title = '투표는 어떻게 하나요?';

update public.inquiry_category_help
set
  answer = '마이페이지에서 프로필을 수정할 수 있어요.',
  steps = '["마이페이지로 이동합니다.","프로필 수정 버튼을 탭합니다.","닉네임을 변경하고 저장합니다.","변경 후 같은 시즌 동안 재변경이 제한됩니다. 한 시즌에 1회 변경 가능합니다."]'::jsonb,
  actions = '[{"text":"프로필 수정하기","to":"/mypage/edit"},{"text":"마이페이지로 이동","to":"/mypage"}]'::jsonb,
  illustration = 'profile',
  body = ''
where category_slug = 'account' and title = '닉네임 변경하고 싶어요!';

update public.inquiry_category_help
set
  answer = '마이페이지 설정에서 계정 삭제를 진행할 수 있어요.',
  steps = '["마이페이지로 이동합니다.","프로필 수정 탭을 찾습니다.","회원탈퇴를 선택하고 안내에 따라 진행합니다.","삭제 시 모든 데이터가 영구 삭제되며 복구할 수 없습니다."]'::jsonb,
  actions = '[{"text":"계정 삭제하기","to":"/mypage/delete"},{"text":"마이페이지로 이동","to":"/mypage"}]'::jsonb,
  illustration = 'delete',
  body = ''
where category_slug = 'account' and title = '계정 삭제는 어떻게 하나요?';

update public.inquiry_category_help
set
  answer = '문의하기의 「1:1 문의하기」에서 카테고리 「신고」로 접수할 수 있어요.',
  steps = '["문의하기 → 「1:1 문의하기」로 이동합니다.","카테고리에서 「신고」를 선택합니다.","신고 대상(매치업 링크·상황 설명 등)을 적고 제출하면 운영팀 검토 후 조치됩니다."]'::jsonb,
  actions = '[{"text":"신고 접수하기 (1:1 문의)","to":"/inquiry/form?category=report"},{"text":"커뮤니티 가이드 보기","to":"/community-policy"}]'::jsonb,
  illustration = 'report',
  body = ''
where category_slug = 'report' and title = '주제와 상관없는 글 신고는 어디서?';
