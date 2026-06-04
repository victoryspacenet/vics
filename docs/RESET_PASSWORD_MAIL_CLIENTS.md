# 비밀번호 재설정 링크: 메일·브라우저 메모

## Edge에서 하얀 화면 / 폼이 안 뜸

개발 모드에서 React Strict Mode가 컴포넌트를 두 번 마운트하면서, Supabase가 URL `#access_token=…` 해시를 한 번 처리한 뒤 비워 버리는 경우가 있습니다. 첫 렌더에서만 “복구 링크”로 인식하면 두 번째 마운트에서는 해시가 없어 UX가 깨질 수 있습니다.

앱에서는 **`sessionStorage`에 `vics_recovery_landing` 플래그**를 두어, 최초에 복구 토큰·`type=recovery`·PKCE `code`가 보인 순간을 기억하고, **`hashchange`**·`setTimeout(0)`으로 늦게 붙는 해시도 다시 반영합니다. 비밀번호 변경 완료·링크 무효(`hint`)·URL 오류 시 플래그를 지웁니다.

## 일부 메일(Outlook 등)에서 `#` 조각이 사라짐

안전 링크·리디렉트 과정에서 **URL 프래그먼트가 서버로 전달되지 않아** `#access_token`이 빠지면 implicit 복구는 동작하지 않습니다. 운영 환경에서는 Supabase 문서의 **메일 템플릿에 `token_hash` + `email`을 쿼리로 두고 `verifyOtp` / PKCE 형태**로 처리하는 방식을 검토하는 것이 좋습니다.

## 로컬 개발 시 메일의 localhost 링크

메일 클라이언트가 다른 브라우저 프로필이나 컨테이너에서 링크를 열면, 개발 서버(`localhost`)가 해당 창과 맞지 않을 수 있습니다. 문제가 계속되면 링크 URL을 **로컬 개발 중인 브라우저 주소창에 붙여넣기**해 같은 프로필·같은 origin에서 여는지 확인하세요.
