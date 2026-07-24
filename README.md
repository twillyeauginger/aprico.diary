# 식단 기록 페이지

아이폰, 윈도우와 맥에서 같은 데이터를 사용하는 개인용 칼로리·영양정보
기록 웹앱입니다. 화면은 GitHub Pages에 정적으로 배포하고, 인증·데이터·사진과
서버 측 API 호출은 Supabase에서 처리합니다.

## 주요 기능

- 월간 캘린더와 날짜별 식단 기록
- 칼로리, 탄수화물, 단백질, 지방 요약
- 음식 직접 입력 및 식품 데이터 검색
- 음식·영양정보 사진 업로드
- OpenAI 이미지 분석 결과 확인 후 저장
- 데이터 출처를 검증 DB, 제품 표시값, AI 추정값으로 구분
- Google 로그인, 이메일 매직 링크와 기기 간 데이터 동기화
- 홈 화면에 추가할 수 있는 PWA

## 로컬 실행

Node.js 22.13 이상이 필요합니다.

```bash
pnpm install
pnpm run dev
```

GitHub Pages용 정적 화면은 다음 명령으로 확인합니다.

```bash
pnpm run build:pages
pnpm run preview:pages
```

## Supabase 설정

1. Supabase 프로젝트를 만들고 `supabase/migrations`의 SQL을 적용합니다.
2. `analyze-photo`, `search-foods` Edge Function을 배포합니다.
3. Supabase Auth의 Site URL을
   `https://twillyeauginger.github.io/aprico.diary/`로 설정합니다.
4. Google Cloud에서 웹 OAuth 클라이언트를 만들고 아래 주소를 등록합니다.
   - JavaScript origin: `https://twillyeauginger.github.io`
   - Redirect URI: `https://lexsvklkikuggtyrkzrk.supabase.co/auth/v1/callback`
5. Google Client ID와 Client Secret을 Supabase Auth의 Google provider에
   등록합니다.
6. 첫 사용자 계정을 만든 뒤 개인용 사용이라면 새 사용자 가입을 끕니다.
7. GitHub 저장소의 Actions variables에 아래 두 값을 등록합니다.

- `VITE_SUPABASE_URL`: Supabase 프로젝트 URL
- `VITE_SUPABASE_PUBLISHABLE_KEY`: 브라우저 공개용 publishable key

Edge Function 비밀값은 Supabase에만 설정합니다.

- `OPENAI_API_KEY`: 음식 사진 분석
- `OPENAI_MODEL`: 이미지 분석 모델, 기본값 `gpt-5.6-sol`
- `FOOD_DB_API_KEY`: 식약처 식품영양성분 DB 검색
- `APP_ORIGIN`: 기본 허용 주소, `https://twillyeauginger.github.io`
- `APP_ORIGINS`: 추가 허용 주소를 쉼표로 구분

`OPENAI_API_KEY`와 `FOOD_DB_API_KEY`는 GitHub 변수나 프런트엔드 코드에
넣지 않습니다.

## GitHub Pages

`.github/workflows/github-pages.yml`이 `main` 브랜치 변경을 자동으로 빌드하고
배포합니다. 저장소 Settings → Pages의 Source는 **GitHub Actions**로 설정합니다.

## 기존 로컬 서버 환경 변수

`.env.example`을 참고하여 필요한 값을 설정합니다.

- `OPENAI_API_KEY`: 음식 사진 분석
- `OPENAI_MODEL`: 이미지 분석 모델
- `FOOD_DB_API_KEY`: 식약처 식품영양성분 DB 검색

API 키는 저장소에 커밋하지 않습니다.
