-- 1:1 문의 답변(inquiry_replies) 등록 시 수신자에게 앱 내 알림 1건 생성
-- Supabase SQL Editor에서 실행하세요. (notifications.type 에 inquiry_reply 추가)

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'vote', 'comment', 'like', 'match_complete', 'ranking',
    'notice', 'content_deletion', 'restriction_lift', 'appeal_result',
    'inquiry_reply'
  ));

create or replace function public.notify_on_inquiry_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid;
  v_title   text;
  v_receipt text;
  v_preview text;
  v_head    text;
begin
  select i.user_id, i.title, i.receipt_id
  into v_uid, v_title, v_receipt
  from public.inquiries i
  where i.id = new.inquiry_id;

  if v_uid is null then
    return new;
  end if;

  v_preview := left(regexp_replace(coalesce(new.content, ''), '\s+', ' ', 'g'), 200);
  if new.reply_type = 'auto' then
    v_head := '🤖 문의 답변이 등록되었습니다';
  else
    v_head := '📩 1:1 문의 답변이 도착했습니다';
  end if;

  insert into public.notifications (user_id, type, title, body, related_matchup_id, is_read, payload)
  values (
    v_uid,
    'inquiry_reply',
    v_head,
    v_preview,
    null,
    false,
    jsonb_build_object(
      'inquiry_id', new.inquiry_id::text,
      'receipt_id', coalesce(v_receipt, ''),
      'reply_type', coalesce(new.reply_type, 'manual')
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_on_inquiry_reply on public.inquiry_replies;
create trigger trg_notify_on_inquiry_reply
  after insert on public.inquiry_replies
  for each row execute function public.notify_on_inquiry_reply();
