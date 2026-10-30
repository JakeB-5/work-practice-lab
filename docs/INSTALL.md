# 직접 설치하기

보통은 에이전트에게 저장소 링크와 함께 “설치하고 실행해줘”라고 요청하면 됩니다. 아래는 직접 설치하거나 오류를 확인할 때 사용하는 방법입니다.

## 자동 설치

Node.js 24 이상, npm, Git이 준비된 macOS에서:

```sh
git clone https://github.com/JakeB-5/work-practice-lab.git
cd work-practice-lab
node tools/setup.mjs
```

설치 도구가 필요한 의존성을 준비하고 실제 접속 URL을 출력합니다. 4310이 사용 중이면 다른 빈 포트를 선택합니다. 서버는 백그라운드에서 실행됩니다. 로그인 요청이 나오면 출력된 명령으로 Codex 로그인을 완료한 뒤 연결 검사를 이어갑니다. 에이전트에게 맡겼다면 이 후속 작업도 에이전트가 진행합니다.

## 수동 설치

```sh
npm install -g pnpm@12.9.1 @openai/codex@0.163.0
codex login
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm build
pnpm start
```

브라우저에서 [http://127.0.0.1:4310](http://127.0.0.1:4310)을 열고 **연결 설정 → 실제 연결·권한 검사**를 실행하세요. 이 방식은 터미널을 열어 둬야 하며 `Ctrl+C`로 서버를 종료합니다.

[Codex 공식 CLI 안내](https://learn.chatgpt.com/docs/codex/cli) · [공식 로그인 안내](https://learn.chatgpt.com/docs/auth)

장비 예약 과제에는 실행 중인 Docker가 필요합니다. PostgreSQL은 앱이 별도 컨테이너로 준비합니다. 이 과제는 재생 모드에서도 환경 준비에 Docker를 사용합니다.

## 문제 생성

앱의 **AI로 새 문제 만들기**를 사용하거나 에이전트에게 맡기세요. 직접 명령을 쓰려면:

```sh
pnpm lab generate --brief "가상 동아리 행사 신청을 관리하는 초급 해커톤 문제" --duration 60
```

에이전트가 직접 작성한 JSON은 `pnpm lab validate --file <파일>`로 검사하고 `pnpm lab import --file <파일>`로 등록할 수 있습니다. [초안 작성 규칙](agents/workflows.md)을 먼저 확인하세요.

## 실행 설정과 복구

- `pnpm lab start`: 저장된 서버를 확인하고 재사용합니다. 다른 체크아웃의 서버를 멈추지 않습니다.
- `pnpm lab stop`: 에이전트 설치 도구가 시작한 서버만 확인 후 종료합니다. 데이터는 보존합니다.
- `pnpm lab doctor`: 설치·로그인·추론 검사 상태를 확인합니다.
- `pnpm lab configure --model <모델 ID>`: 실제 모델 목록에서 확인한 기본 모델을 설정합니다.
- `WPL_DATA_DIR=/원하는/경로 node tools/setup.mjs`: 별도 데이터 폴더를 사용합니다. 이후 명령에도 같은 환경변수를 지정하세요.
- `PORT=4312 pnpm start`: 수동 실행 포트를 바꿉니다.

| 증상 | 확인할 것 |
| --- | --- |
| Codex 실행 파일 없음 | 설치 도구 재실행 또는 `pnpm lab configure --binary <설치된 경로>` |
| 모델 없음·권한 오류 | `pnpm lab models`, 로그인 계정과 과제의 허용 목록 |
| 설치 결과 `needs_user_action` | 출력된 로그인 명령으로 브라우저 인증 후 `pnpm lab check-runtime` |
| 문제 생성이 `pending` | 출력된 operation ID로 `pnpm lab operation --id <ID>`; 중복 생성하지 않기 |
| 장비 예약 준비 실패 | Docker 실행 후 환경 준비 재시도 |
| macOS `posix_spawnp failed` | `node tools/postinstall.mjs` 후 재시작 |
| node-pty 컴파일 실패 | Xcode Command Line Tools 등 로컬 빌드 도구 확인 |
| 서버 시작 실패 | 선택한 데이터 폴더의 `server.log` 확인 |
| 수정한 화면이 그대로임 | `pnpm build` 후 서버 재시작 또는 `pnpm dev` |

`.wpl-data`를 지우면 생성한 문제와 응시 기록을 잃을 수 있습니다. 설치나 복구를 위해 임의로 지우지 마세요. [운영·복구 안내](runbooks/local-operations.md)에 데이터 보존 방법이 있습니다.
