-- =============================================
-- VICS - 댓글 답글(parent_id)
-- Supabase SQL Editor에서 실행하세요
-- =============================================
-- parent_id: ON DELETE SET NULL → 부모/답글 삭제 시 해당 행만 제거, 자식은 parent_id만 NULL로 승격

ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS parent_id uuid;

ALTER TABLE public.comments DROP CONSTRAINT IF EXISTS comments_parent_id_fkey;

ALTER TABLE public.comments
  ADD CONSTRAINT comments_parent_id_fkey
  FOREIGN KEY (parent_id) REFERENCES public.comments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS comments_parent_id_idx ON public.comments(parent_id);

COMMENT ON COLUMN public.comments.parent_id IS '대댓글인 경우 부모 댓글 id (최상위는 NULL). 부모 삭제 시 NULL로 승격';

-- 같은 매치업의 댓글만 부모로 지정 가능
CREATE OR REPLACE FUNCTION public.validate_comment_parent_matchup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.comments c
    WHERE c.id = NEW.parent_id AND c.matchup_id = NEW.matchup_id
  ) THEN
    RAISE EXCEPTION '유효하지 않은 부모 댓글입니다'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_comment_validate_parent ON public.comments;
CREATE TRIGGER on_comment_validate_parent
  BEFORE INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_comment_parent_matchup();

-- 댓글 알림 비활성화 (매치업 작성자에게 댓글 알림 없음)
DROP TRIGGER IF EXISTS on_comment_notify ON public.comments;
DROP FUNCTION IF EXISTS notify_on_comment();
