# 식단 기록 페이지

아이폰, 윈도우와 맥에서 같은 데이터를 사용하는 개인용 칼로리·영양정보
기록 웹앱입니다. 화면은 GitHub Pages에 정적으로 배포하고, 인증·데이터·사진과
서버 측 API 호출은 Supabase에서 처리합니다.

## 주요 기능

- 월간 캘린더와 날짜별 식단 기록
- 캘린더의 `운동 하는 날`·`운동 없는 날` 설정과 날짜별 영양 목표
- 칼로리, 탄수화물, 단백질, 지방 요약
- 일·주·월 인사이트와 24시간대별 독립 영양 그래프
- 음식 직접 입력 및 식품 데이터 검색
- 음식 이름으로 식약처·USDA 공식 영양 DB 값을 불러와 수정 후 기록
- 기록에 사용한 음식을 내 음식 DB에 자동 보관하고 출처별로 분류
- 음식 DB·공식 DB 값을 불러온 뒤 기록 전 섭취량·단위 변경 시 영양정보 자동 환산
- 음식·영양정보 사진 업로드
- OpenAI 이미지 분석 결과 확인 후 저장
- 캘린더와 식사 기록에서 비공개 원본 사진 다시 보기
- 일반 ChatGPT 대화에서 OAuth로 연결한 뒤 음식·식사 기록 조회와 추가
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
- `OPENAI_MODEL`: 이미지 분석 모델, 기본값 `gpt-5.6-sol` (사진 분석은
  원본 해상도와 medium 추론 강도 사용)
- `OPENAI_LOOKUP_MODEL`: 한국어 음식명을 USDA 검색어로 바꾸는 저비용 모델,
  기본값 `gpt-5.6-luna`
- `FOOD_DB_API_KEY`: 식약처 식품영양성분 DB 검색
- `USDA_FOODDATA_API_KEY`: USDA FoodData Central 검색. 비어 있으면
  저용량 `DEMO_KEY`를 사용합니다.
- `APP_ORIGIN`: 기본 허용 주소, `https://twillyeauginger.github.io`
- `APP_ORIGINS`: 추가 허용 주소를 쉼표로 구분
- `CHATGPT_API_TOKEN`: Custom GPT Action 전용 Bearer 토큰
- `CHATGPT_USER_ID`: Action이 기록할 Supabase Auth 사용자 UUID

API 키는 GitHub 변수나 프런트엔드 코드에 넣지 않습니다.

## GitHub Pages

`.github/workflows/github-pages.yml`이 `main` 브랜치 변경을 자동으로 빌드하고
배포합니다. 저장소 Settings → Pages의 Source는 **GitHub Actions**로 설정합니다.

## 기존 로컬 서버 환경 변수

`.env.example`을 참고하여 필요한 값을 설정합니다.

- `OPENAI_API_KEY`: 음식 사진 분석
- `OPENAI_MODEL`: 이미지 분석 모델
- `FOOD_DB_API_KEY`: 식약처 식품영양성분 DB 검색
- `USDA_FOODDATA_API_KEY`: USDA FoodData Central 검색

API 키는 저장소에 커밋하지 않습니다.

## ChatGPT Custom GPT Action

외부 API는 Supabase Edge Function `chatgpt-api`로 제공되며 모든 요청에
전용 Bearer 토큰이 필요합니다. `CHATGPT_API_TOKEN`은 충분히 긴 무작위
문자열로 만들고 `CHATGPT_USER_ID`에는 기록을 소유할 사용자 UUID를 넣습니다.

```bash
supabase secrets set CHATGPT_API_TOKEN=... CHATGPT_USER_ID=...
supabase functions deploy chatgpt-api --no-verify-jwt
```

`openapi.yaml`을 GPT 편집 화면의 **Actions → Import from URL/File**에서
불러온 뒤 인증 방식을 **API Key → Bearer**로 선택하고 같은 토큰을 입력합니다.
스키마에는 식품·식사 등록과 삭제 전에 반드시 사용자 확인을 받도록 명시되어
있습니다.

공개 HTTPS 기본 주소:

`https://lexsvklkikuggtyrkzrk.supabase.co/functions/v1/chatgpt-api/api/chatgpt`

테스트용 식품 예시:

```json
{
  "name": "구운계란",
  "servingAmount": 1,
  "servingUnit": "개",
  "weightGrams": 50,
  "caloriesKcal": 73,
  "carbohydratesGrams": 0.7,
  "proteinGrams": 6.7,
  "fatGrams": 4.3,
  "sodiumMilligrams": 64,
  "sugarsGrams": null,
  "source": "사용자 제공",
  "notes": null
}
```

## 일반 ChatGPT 대화 연결

`chatgpt-mcp` Edge Function은 ChatGPT의 일반 대화에 연결할 수 있는 데이터 전용
MCP 서버입니다. 읽기 도구는 바로 사용할 수 있고, 등록·삭제 도구는 실행 직전에
사용자 확인을 받도록 설명과 안전 속성을 설정했습니다. 인증은 별도 고정 API 키가
아니라 Aprico Diary의 Supabase 계정으로 진행됩니다.

1. Supabase 대시보드의 **Authentication → URL Configuration**에서 Site
   URL을 `https://twillyeauginger.github.io`로 지정하고, Redirect URLs에는
   `https://twillyeauginger.github.io/aprico.diary/`를 유지합니다.
2. **Authentication → OAuth Server**에서 OAuth 2.1 Server를 활성화하고
   Authorization Path를 `/aprico.diary/`로 지정한 뒤 Dynamic Client
   Registration을 활성화합니다. OAuth 동의 요청은 배포된 Aprico Diary가
   `authorization_id`를 받아 표시합니다.
3. 새 Edge Function을 배포합니다.

```bash
supabase functions deploy chatgpt-mcp --no-verify-jwt
```

4. ChatGPT의 **설정 → Apps → 고급 설정**에서 개발자 모드를 켠 뒤 새 앱을
   만들고 다음 HTTPS MCP 주소를 입력합니다.

`https://lexsvklkikuggtyrkzrk.supabase.co/functions/v1/chatgpt-mcp`

5. 앱을 연결하면 Aprico Diary 로그인·동의 화면이 열립니다. 같은 계정으로
   로그인하고 `연결 허용`을 누릅니다.
6. 일반 대화에서 예를 들어 “오늘 아침 구운계란 2개 먹었어. Aprico Diary에
   기록해줘”라고 말하면 ChatGPT가 내 음식 DB를 먼저 검색하고, 실제 저장값을
   보여준 뒤 확인을 받아 기록합니다.

OAuth 연결에는 Supabase Auth의 OAuth 2.1 Server 기능과 최신
`@supabase/supabase-js`가 필요합니다. MCP 서버는 접근 토큰에서 사용자를
검증하고 기존 RLS 정책으로 각 사용자의 데이터만 읽고 씁니다.

## 사진 분석값과 내 음식 DB

사진으로 기록할 때는 두 값을 분리합니다.

- 식사 기록에는 실제 먹은 퍼센트나 g을 적용한 영양정보를 저장합니다.
- 내 음식 DB에는 사용자가 확인한 음식 이름과 **먹기 전 사진 속 기준량의
  영양정보**를 저장합니다.
- 내 음식 DB 항목을 선택한 경우에는 기존 DB 값을 그대로 재사용합니다.

따라서 잘못된 AI 음식 이름을 사용자가 고쳤다면 잘못된 원문이 아니라 확인한
이름으로 저장되고, 30%만 먹었다고 입력해도 DB의 기준 영양정보가 30%로
축소되지 않습니다.
