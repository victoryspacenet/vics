# 앱 스토어·FCM 네이티브 체크리스트 (VICS)

코드/레포에 넣을 수 있는 것은 반영되어 있습니다. 아래는 **반드시 본인 Firebase·Apple 계정에서** 완료해야 하는 작업입니다.

## 1. Android — `google-services.json`

1. [Firebase Console](https://console.firebase.google.com) → 해당 프로젝트 → **프로젝트 설정** → **내 앱**에서 Android 앱(`app.vics.space` 등)이 등록돼 있는지 확인합니다. 없으면 **Android 앱 추가**로 패키지명 `app.vics.space`를 등록합니다.
2. **google-services.json** 을 내려받습니다.
3. 파일을 **`android/app/google-services.json`** 경로에 둡니다. (이 경로는 Git에 올리지 마세요 — `.gitignore`에 포함됨)
4. Gradle은 `android/app/build.gradle`에서 해당 파일이 있으면 `google-services` 플러그인을 자동 적용합니다. `npm run build` 후 `npx cap sync` 로 다시 동기화합니다.

## 2. iOS — APNs + 푸시 capability

1. [Apple Developer](https://developer.apple.com) → **Identifiers** → App ID `app.vics.space` → **Push Notifications** 를 켭니다.
2. [Firebase Console](https://console.firebase.google.com) → 프로젝트 설정 → **클라우드 메시징** → **Apple 앱 구성**에서 **APNs 인증 키**(.p8) 또는 인증서를 등록합니다. (FCM이 iOS로 보낼 때 필요)
3. Xcode에서 `ios/App/App.xcworkspace` 를 열고, 타깃 **App** → **Signing & Capabilities**에 **Push Notifications** 가 보이는지 확인합니다. (레포에는 Debug/Release용 entitlement 파일이 있으며, Release는 `production` APNS 환경입니다.)
4. Mac에서 `cd ios/App && pod install` 후 아카이브·업로드합니다.

## 3. 앱에서 Netlify `/api/*` — `VITE_SITE_ORIGIN`

Capacitor WebView는 상대 경로 `fetch('/api/...')`가 **앱 번들** 기준이라 Netlify Functions로 가지 않습니다. **프로덕션 웹 빌드** 시 실제 사이트 origin을 넣습니다.

1. 저장소 루트에 **`.env.production`** 을 만들고(로컬만, Git 제외 권장) 예를 들어 다음을 넣습니다.  
   `VITE_SITE_ORIGIN=https://www.victoryspace.net`  
   (끝에 `/` 없이)
2. 스토어용 앱 빌드 전에 **`npm run build`** → **`npx cap sync`** 순서로 진행합니다.

참고: `.env.production.example` 파일을 복사해 이름만 `.env.production`으로 바꾼 뒤 값을 채우면 됩니다.

## 4. 심사 시 참고

- 푸시 권한 요청 문구는 OS 기본 또는 앱 내 설명으로 처리됩니다. 필요 시 App Store **앱 설명**에 푸시 용도를 한 줄 적어 두면 도움이 됩니다.
