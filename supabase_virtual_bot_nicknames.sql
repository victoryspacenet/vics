-- =============================================================================
-- VICS — 관전봇 개별 닉네임 (공개는 일반 닉네임, 관리자만 '관전봇' 표시)
-- supabase_virtual_vote_bots.sql 이후 실행하세요.
--
-- 재실행 시 기존 관전봇 닉네임도 새 풀로 다시 부여합니다.
-- 한글·영어를 섞고, 2~10자로 길이를 흩어 사람 닉네임처럼 보이게 합니다.
-- (가입 닉네임 상한 10자와 맞춤)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.virtual_bot_nickname_pool()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ARRAY[
    -- 한글 2자 · 영어 짧은 닉 · 한글 긴 닉을 섞어 둠 (부여 때 한 번 더 셔플)
    '노을','Jay','집밥','chill','칼퇴','Mina','혼밥','sky88','꿀잠','Leo',
    '직진','latte','별밤','Hana','국밥','nightowl','아아','Joon','민초','soju',
    '찍먹','Ivy','부먹','ramyeon','야근','Yuna','선톡','weekend','햇살','Kai',
    '야식킹','Noah','혼술러','matcha','등산러','Bora','독서광','lowkey','축구팬','Haru',
    '야구팬','mocha','배달왕','justme','집순이','배고프면먹','밖순이','bingsu','올빼미','Tae',
    '수다왕','gymlife','공감러','Soo','리뷰어','hongdae','가성비','Nari','가심비','catnap',
    '재택러','Yoon','줄서기','oatlatte','디저트','밀크','파스타','seoulite','떡볶이','단짠',
    '월요병','bookworm','불금러','Sky','요가러','midnight','영화광','hana2','새벽감성','Leo7',
    '골목카페','minty','퇴근라면','rainy','주말산책','sunny','한강바람','yeonnam','심야버스','namsan',
    '별빛야식','joon9','카페순례','냥이','영화덕후','비옴','요가초보','바다뷰','산뜻아침','산뜻함',
    '느긋저녁','현실파','혼밥장인','온건파','배달고수','친구많은','취향존중','정시기상','솔직후기','Jay2',
    '즉흥여행','주말침대','국밥진리','겨울이좋아','알람지옥','여름이좋아','스누즈왕','가벼운발','계산깔끔','비오는버스',
    '거절잘함','비오는창가','아침형인간','민초긍정파','별점후하게','수면부족러','디카페인파','매운떡볶이',
    '점심혼밥러','야근반대파','읽씹이해함','단톡기피러','소수정예팀','자연만남파','가벼운농담','진중한편임',
    '취미하나뿐','따뜻한빵집','카페순례러','일단먹고생각','주말에만운동','창가에앉아','선택장애있음',
    '알람스누즈함','줄서는거싫음','예약하고감','주말엔침대'
  ];
$$;

CREATE OR REPLACE FUNCTION public.virtual_bot_pick_seed_nickname(p_i integer)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pool text[];
  v_nick text;
BEGIN
  v_pool := public.virtual_bot_nickname_pool();
  IF p_i IS NOT NULL AND p_i >= 1 AND p_i <= COALESCE(array_length(v_pool, 1), 0) THEN
    v_nick := v_pool[p_i];
  END IF;
  IF v_nick IS NULL OR length(trim(v_nick)) = 0 THEN
    v_nick := '별빛' || GREATEST(1, COALESCE(p_i, 1))::text;
  END IF;
  RETURN v_nick;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_virtual_bot_nicknames()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bot record;
  v_pool text[];
  v_nick text;
  v_old text;
  v_idx integer := 0;
  v_pool_len integer;
  v_updated integer := 0;
  v_fallback integer := 0;
BEGIN
  SELECT array_agg(x ORDER BY random())
  INTO v_pool
  FROM unnest(public.virtual_bot_nickname_pool()) AS x;

  v_pool_len := COALESCE(array_length(v_pool, 1), 0);

  FOR v_bot IN
    SELECT p.id, p.nickname
    FROM public.profiles p
    WHERE COALESCE(p.is_bot, false)
    ORDER BY p.created_at, p.id
  LOOP
    v_old := v_bot.nickname;
    v_nick := NULL;
    WHILE v_idx < v_pool_len LOOP
      v_idx := v_idx + 1;
      v_nick := v_pool[v_idx];
      EXIT WHEN v_nick IS NOT NULL
        AND length(trim(v_nick)) > 0
        AND char_length(v_nick) <= 10
        AND NOT EXISTS (
          SELECT 1 FROM public.profiles x
          WHERE x.nickname = v_nick AND x.id IS DISTINCT FROM v_bot.id
        );
      v_nick := NULL;
    END LOOP;

    IF v_nick IS NULL THEN
      v_fallback := v_fallback + 1;
      LOOP
        v_nick := '별빛' || v_fallback::text;
        EXIT WHEN NOT EXISTS (
          SELECT 1 FROM public.profiles x
          WHERE x.nickname = v_nick AND x.id IS DISTINCT FROM v_bot.id
        );
        v_fallback := v_fallback + 1;
      END LOOP;
    END IF;

    UPDATE public.profiles
    SET nickname = v_nick, updated_at = now()
    WHERE id = v_bot.id;

    UPDATE auth.users
    SET
      raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('nickname', v_nick),
      updated_at = now()
    WHERE id = v_bot.id;

    UPDATE public.matchups
    SET left_label = v_nick, updated_at = now()
    WHERE user_id = v_bot.id
      AND (
        left_label IS NULL
        OR left_label = v_old
        OR left_label ~ '^관전봇[0-9]+$'
        OR left_label LIKE '관전봇%'
      );

    UPDATE public.matchups
    SET right_label = v_nick, updated_at = now()
    WHERE right_user_id = v_bot.id
      AND (
        right_label IS NULL
        OR right_label = v_old
        OR right_label ~ '^관전봇[0-9]+$'
        OR right_label LIKE '관전봇%'
      );

    v_updated := v_updated + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'updated', v_updated,
    'pool_size', v_pool_len,
    'fallback_used', v_fallback
  );
END;
$$;

COMMENT ON FUNCTION public.assign_virtual_bot_nicknames() IS
  '관전봇 닉네임을 한글·영어·글자 수가 섞인 개별 닉네임으로 부여. 재실행 시 기존 봇 닉네임도 다시 부여.';

REVOKE ALL ON FUNCTION public.virtual_bot_nickname_pool() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.virtual_bot_pick_seed_nickname(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assign_virtual_bot_nicknames() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_virtual_bot_nicknames() TO service_role;
GRANT EXECUTE ON FUNCTION public.virtual_bot_pick_seed_nickname(integer) TO service_role;

SELECT public.assign_virtual_bot_nicknames() AS virtual_bot_nicknames_assigned;
