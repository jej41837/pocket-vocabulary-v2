# 포켓 단어장 AI 버전

Vercel Serverless Function과 Gemini API를 연동한 모바일 단어장입니다. 앱에 입력한 개인 API 키는 `/api/vocab` 요청 헤더로 서버에 전달됩니다.

## 파일 구성

- `api/vocab.js`: Gemini 단어 정보 생성 및 이미지 분석 서버 함수
- `index.html`, `style.css`, `app.js`: 모바일 웹 앱
- `package.json`, `package-lock.json`: Vite와 Gemini 서버 의존성
- `.env.example`: 환경 변수 이름 예시

## 로컬 실행

저장소 루트에서 `npm install` 후 `npm run dev`를 실행하세요. PowerShell 실행 정책으로 `npm.ps1`이 차단되면 `npm.cmd run dev`를 사용하세요. Vite가 같은 주소의 `/api/vocab` 요청을 `api/vocab.js`로 전달합니다. 브라우저에서 열쇠 버튼에 본인 키를 입력하면 별도 환경 변수 없이 AI 기능을 시험할 수 있습니다.

서버 키를 쓰려면 루트에 `.env` 파일을 만들고 `GEMINI_API_KEY=...`를 넣으세요. 환경 변수 이름은 `GOOGLE_API_KEY`가 아니라 `GEMINI_API_KEY`입니다. `/api/vocab`을 브라우저에서 열어 JSON 형태의 `POST 요청만 허용됩니다.`가 보이면 로컬 API 경로가 연결된 것입니다.

## Vercel 배포

1. 이 폴더의 **내용 전체**를 GitHub 저장소 루트에 올립니다. `api` 폴더도 반드시 포함하세요.
2. Vercel에서 저장소를 Import합니다. Framework Preset은 `Other`, Root Directory는 이 파일들이 있는 폴더로 설정합니다.
3. Project Settings → Environment Variables에 `GEMINI_API_KEY`를 추가합니다.
4. 사용할 배포 환경(Production, Preview)에 체크하고 저장합니다.
5. 환경 변수를 추가하거나 바꾼 뒤에는 반드시 새로 Deploy/Redeploy합니다.

GitHub 저장소 첫 화면에는 `vocab.js`가 아니라 `api` 폴더가 보여야 합니다. `api` 폴더를 열었을 때 `vocab.js`가 있어야 합니다.

## 여러 사용자가 각자 API 키 사용

상단의 열쇠 버튼에서 각 사용자가 자신의 Gemini API 키를 입력할 수 있습니다. 키는 Gemini 호출 때 서버 함수로 전달되며 서버에는 저장하지 않습니다. `이 기기에 키 저장`을 선택하지 않으면 현재 탭 세션에서만 유지됩니다. 운영자의 API 사용량을 완전히 막으려면 Vercel의 `GEMINI_API_KEY`를 제거하세요. 그러면 개인 키를 입력한 사용자만 AI 기능을 쓸 수 있습니다.

API 키는 비밀번호처럼 취급해야 하므로 공용 기기에서는 저장하지 마세요.

선택적으로 `GEMINI_MODEL`을 지정할 수 있으며, 미설정 시 `gemini-2.5-flash`를 사용합니다. 이전에 `gemini-3.6-flash`를 설정했다면 해당 환경 변수를 삭제하거나 `gemini-2.5-flash`로 바꾸고 재배포하세요. 지원하지 않는 모델로 404가 나면 서버 함수가 기본 모델로 한 번 다시 시도합니다.

CSV 가져오기는 UTF-8과 한국어 Windows CSV(CP949/EUC-KR)를 지원합니다. 첫 행에는 `영어`, `뜻`, 선택적으로 `챕터`, `영영풀이`를 넣으세요. 한 단어에 뜻이 여러 개면 뜻 셀에서 세미콜론으로 구분하고, 영영풀이 셀에는 뜻 순서대로 줄바꿈하여 입력합니다.

## 오류 확인

배포 후 `https://내주소.vercel.app/api/vocab`을 브라우저에서 열었을 때 `POST 요청만 허용됩니다.`가 보이면 서버 함수가 정상 배포된 것입니다. `404`라면 `api/vocab.js`가 저장소 루트 아래에 없거나 Vercel Root Directory가 잘못된 것입니다.

자동 채우기나 이미지 분석 실패 시 화면에 서버 오류 메시지가 표시됩니다. Vercel의 해당 Deployment → Functions 로그에서도 자세한 오류를 확인할 수 있습니다.
