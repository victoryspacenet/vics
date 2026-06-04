# 스토리지 업로드 MIME·시그니처 검증

## 현재 상태

- **브라우저**: `src/lib/uploadMediaValidation.js` 에서 허용 MIME·확장자 화이트리스트와 파일 앞부분 매직 바이트 검사를 수행합니다. `File.type`(클라이언트 제공)만 믿지 않습니다.
- **서버(Node)**: 같은 규칙을 모듈로 옮긴 `netlify/lib/uploadMediaMagic.cjs` 로 `Buffer`(또는 앞쪽 슬라이스) 검증이 가능합니다. Netlify 함수에서 **본문 바이트**를 받은 직후·Supabase 업로드 직전에 호출하면 됩니다.

허용 이미지(선택 파일): **JPG, PNG, GIF** (표시 카피는 `IMAGE_FORMATS` 와 동일).  
허용 영상: **MP4, MOV**(ISO BMFF — 앞쪽 구간에 `ftyp` 박스 시그니처).

## 한계

클라이언트 검증만으로는 **직접 Supabase Storage API** 호출 같은 우회는 막기 어렵습니다. 근본 방어를 하려면:

1. 업로드를 **항상 거치는 서버(또는 Supabase Edge Function)** 가 전체 또는 충분한 바이트를 읽어 시그니처를 검사한 뒤, **서비스 롤**로만 `bucket.upload` 하는 경로가 필요합니다.
2. 영상처럼 **수십 MB**인 경우 Netlify Functions 기본 페이로드 한도 때문에 **청크/스트리밍** 처리나 Edge 업로드를 고려해야 합니다. 이미지도 프록시할 때 페이로드 상한 내에서만 처리하는 게 안전합니다.

## 참고

- 브라우저에서 크롭·압축 후 결과는 JPEG이므로, 업로드 직전에는 `validatePipelineJpegOutput` 으로 JPEG 시그니처를 재확인합니다.
- `uploadMediaMagic.cjs` 수정 시 브라우저 모듈과 **항상 동일한 규칙**을 유지하세요(`STORAGE_UPLOAD_VALIDATION.md`, 파일 상단 코멘트).
