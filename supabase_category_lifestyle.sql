-- 활성 카테고리에 라이프 스타일(lifestyle)을 추가한다.
-- 취향·상황·선택·트렌드 매치업용. 이미 있으면 바꾸지 않는다.
-- Supabase SQL Editor에서 실행해도 되고, 여러 번 실행해도 안전합니다.

UPDATE public.category_admin_config
SET
  data = jsonb_set(
    data,
    '{activeCategories}',
    COALESCE(data->'activeCategories', '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object(
        'id', 'lifestyle',
        'slug', '라이프 스타일',
        'label', '라이프 스타일',
        'pinned', false,
        'iconEmoji', '🌿'
      )
    )
  ),
  updated_at = now()
WHERE id = 'default'
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(data->'activeCategories', '[]'::jsonb)) e
    WHERE e->>'id' = 'lifestyle'
       OR e->>'label' = '라이프 스타일'
  );
