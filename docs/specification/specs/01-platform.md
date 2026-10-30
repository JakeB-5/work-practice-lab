# S01 — 플랫폼·세션·API 공통 규칙

상태: 구현 기준 v0.1.0 / 런타임 연동의 실제 검증은 별도 게이트.
기준: PRD §6~10, §13~14. 이 문서와 contracts의 식별자·상태 이름을 모든 모듈에서 공통 사용한다.

## 1. 구조와 책임

단일 로컬 서버 + 브라우저 UI + SQLite + 파일 저장소. Node.js 22 이상, TypeScript, pnpm workspace를 기본 구현 대상으로 한다. 특정 라이브러리 최신 버전은 이 Spec이 보장하지 않는다. 시작 태스크에서 호환되는 정확한 버전을 lockfile에 고정한다.

| 제안 경로 | 소유 책임 |
|---|---|
| apps/web/src/features | 화면·클라이언트 상태 |
| apps/server/src/modules/attempts | 시도·시간·상태 전이 |
| apps/server/src/modules/auth | bootstrap·쿠키·Origin·CSRF |
| apps/server/src/modules/events | 이벤트 저장·SSE·출처 |
| apps/server/src/modules/scenarios | 과제 버전과 공개 자료 |
| apps/server/src/modules/workspace | 파일·PTY·개발 서버 |
| apps/server/src/modules/submissions | 마감·스냅샷 |
| apps/server/src/modules/validation | 고정 검사 실행 |
| apps/server/src/modules/evaluation | 질문·판정·점수 |
| packages/contracts | 검증 가능한 API/도메인 계약 |
| packages/codex-adapter | Codex 프로토콜 변환 |
| scenarios | 제작자가 관리하는 과제 패키지 |
| tests/integration, tests/e2e | 기능 경계·실제 사용자 흐름 |

브라우저는 파일·Codex·SQLite에 직접 접근하지 않는다. 백엔드는 서버 모듈만 호출하고, Codex wire 형식을 제품 API로 노출하지 않는다. UI는 동일한 API를 구현한 replay transport로 먼저 개발할 수 있다.

실행 데이터 루트는 기본 ~/.local/share/work-practice-lab, 설정 변수는 WPL_DATA_DIR다. 앱 소스와 분리하며 시작 시 사용자에게 절대경로를 보여준다. 이 경로는 제안된 제품 기본값이고 이번 문서 작성에서 생성하지 않았다.

## 2. ID·시각·버전

- 제품 ID는 prefix + UUIDv4 문자열. 접두사: att, scv, op, msg, ses, sub, val, evi, int, qst, eva, exp, proc, apr, evt, nte.
- Codex threadId/turnId/itemId는 외부 식별자다. 제품 ID와 혼용하지 않는다.
- API 시각은 UTC RFC3339 밀리초 문자열. 화면은 Asia/Seoul로 표시한다.
- version은 낙관적 잠금용 정수. 변경 트랜잭션마다 1 증가.
- scenarioVersionId와 계약 버전은 시도 시작 시 고정한다.
- 입력의 알 수 없는 필드는 400 VALIDATION_ERROR로 거절한다. null과 생략을 구분한다.
- 목록 기본 limit=50, 최대 200. cursor는 서버 발급 opaque 문자열이다.

## 3. 상태 머신

Attempt.state:
preparing → ready → running → sealing → submitted → interviewing → evaluating → completed.

추가 전이:
- preparing → preparation_failed → preparing.
- running → pausing → paused → running. 자유 연습·개발에서만 허용.
- pausing 실패 → running. 타이머는 pausing 동안 계속 진행.
- running/paused/pausing → sealing. paused 수동 제출은 자유 연습·개발에서 허용.
- sealing → submission_failed → sealing.
- evaluating → evaluation_failed → evaluating.
- completed → evaluating는 재평가 요청일 때만 허용하며 이전 평가를 보존.
- preparing/ready/running/paused/실패 상태 → abandoned는 관리 작업 중단 완료 후 허용.
- completed/abandoned만 삭제 가능. 활성 작업이 있으면 409 PROCESS_BUSY.

완료된 시도의 재평가를 시작할 때 다른 active attempt가 있으면 409 ACTIVE_ATTEMPT_EXISTS로 거절한다. 하나의 active attempt만 허용한다. completed와 abandoned 외의 상태는 active다. SQLite 부분 유일 인덱스와 트랜잭션으로 보호하며 단순 메모리 플래그로 구현하지 않는다.

submitted는 고정 제출본이 존재하는 상태다. 검증 실행은 별도 ValidationRun.status로 관리한다. 검증이 실패해도 제출본이 사라지거나 running으로 돌아가지 않는다. 실패한 기능도 평가의 증거가 될 수 있다.

## 4. 상태별 동작

| 상태 | 읽기 | 편집·터미널·코딩 AI·담당자 질문 | 제출 | 사후 답변 |
|---|---|---|---|---|
| preparing / ready | 허용 | 차단 | 차단 | 차단 |
| running | 허용 | 허용 | 허용 | 차단 |
| pausing / sealing | 허용 | 새 요청 차단 | 같은 작업 조회만 | 차단 |
| paused | 허용 | 차단 | 자유/개발만 허용 | 차단 |
| submission_failed | 허용 | 차단 | 재시도 허용 | 차단 |
| submitted | 고정본·기록 | 차단 | 기존 결과 조회 | 아직 차단 |
| interviewing | 고정본·기록 | 차단 | 기존 결과 조회 | 허용 |
| evaluating / evaluation_failed / completed | 고정본·기록·결과 | 차단 | 기존 결과 조회 | 읽기 전용 |

개발 모드의 우회도 서버 액션을 거친다. 개발 표시를 해제하거나 원래 모드로 되돌리는 API는 제공하지 않는다.

## 5. 타이머

durationSeconds는 과제 기본값을 사용한다. 자유/개발 모드만 ready 단계에서 변경 가능. 시험 연습은 manifest 값으로 고정한다.
running 시작 트랜잭션에서 startedAt, deadlineAt, pausedTotalMs=0을 기록한다.
remainingMs=max(0, deadlineAt-nowUTC). paused 동안 화면은 pause 시점의 remainingMs를 표시한다.
정지 요청 시 pausing으로 전이하고 새 쓰기 차단·실행 중단을 수행한다. 중단 완료 시 pausedAt을 기록한다. 재개 시 deadlineAt += now-pausedAt, pausedTotalMs도 증가한다.
모든 쓰기 요청에서 now>=deadlineAt를 재검사한다. 스케줄러는 보조 수단이며 만료 이벤트가 늦어져도 추가 요청을 수락하지 않는다.
시험 연습의 절전·서버 종료는 시간을 멈추지 않는다. 복구 시 만료됐으면 즉시 sealing으로 이동한다.
호스트 시계가 비정상적으로 이동하면 clock_anomaly 조건을 기록하고 사용자에게 표시한다. 모르게 시간을 보정하지 않는다.

## 6. 요청·반복·오류

API base=/api/v1. JSON 요청/응답은 UTF-8.
상태 변경 POST/PUT/DELETE는 Idempotency-Key 필수. key는 UUIDv4이며 scope=(localSession, method, normalizedRoute, key).
서버는 canonical body hash, 최초 응답, operationId를 저장한다. 같은 키·같은 본문은 같은 결과를 반환하고, 다른 본문이면 409 IDEMPOTENCY_CONFLICT.
수명은 해당 시도 삭제 시까지다. bootstrap은 별도 일회성 launch token 규칙을 사용한다.

긴 작업은 HTTP 202 + Operation으로 응답한다. Operation.status=queued/running/awaiting_approval/interrupting/succeeded/failed/interrupted/uncertain.
uncertain은 요청 접수 여부를 알 수 없는 상태이며 완료나 실패가 아니다. 자동 재실행하지 않는다.
파일 저장에는 Idempotency-Key와 If-Match가 모두 필요하다. 단순 GET에는 멱등성 키를 요구하지 않는다.

오류 envelope:
{ error: { code, message, retryable, requestId, details? } }
details는 서버 내부 경로·인증값·비공개 사실을 포함하지 않는다.

| HTTP | 대표 코드 |
|---|---|
| 400 | VALIDATION_ERROR, INVALID_CURSOR |
| 401 | AUTH_REQUIRED, LAUNCH_TOKEN_INVALID |
| 403 | ORIGIN_DENIED, CSRF_DENIED, ROLE_SCOPE_DENIED |
| 404 | NOT_FOUND |
| 409 | INVALID_STATE, ACTIVE_ATTEMPT_EXISTS, VERSION_CONFLICT, IDEMPOTENCY_CONFLICT, PROCESS_BUSY, RUNTIME_BUSY |
| 410 | CURSOR_EXPIRED |
| 413 | PAYLOAD_TOO_LARGE |
| 422 | SCENARIO_INVALID, RUNTIME_CAPABILITY_MISSING |
| 429 | LOCAL_QUEUE_FULL |
| 502 | CODEX_FAILED |
| 503 | RUNTIME_UNAVAILABLE |
| 504 | OPERATION_TIMEOUT |

## 7. 로컬 인증·출처

제어 UI와 API는 기본 http://127.0.0.1:4310의 같은 origin으로 서비스한다. 개발 UI 서버도 이 origin 뒤에서 프록시한다.
실행 시 256-bit 일회성 launch token을 메모리에 만들고 URL fragment로 로컬 브라우저에 전달한다. POST /bootstrap에서 1회 교환하고 fragment를 즉시 제거한다. 토큰은 60초 만료, 로그·이벤트에 기록 금지.
교환 후 HttpOnly, SameSite=Strict, Path=/api/v1의 host-only session cookie를 설정하고 CSRF 토큰을 응답한다. 로컬 HTTP이므로 Secure 여부는 환경에 맞게 설정하며 원격 공개는 지원하지 않는다.
변경 요청은 정확한 Host, Origin, cookie와 X-WPL-CSRF를 검사한다. CORS wildcard 금지. SSE/WS도 인증하며 WS는 별도 일회성 30초 ticket 사용.
제출 앱은 localhost의 별도 포트로 미리보기한다. 127.0.0.1 제어 쿠키가 공유되지 않게 호스트를 분리한다. 포트만 다르게 해도 쿠키가 격리된다고 가정하지 않는다.
임의 외부 웹페이지나 제출 앱은 제어 API의 Origin/CSRF 검사를 통과할 수 없어야 한다.

## 8. 이벤트와 복구

Event: schemaVersion, attemptId, seq, id, type, actor, audience, occurredAt, operationId?, causationId?, payload.
seq는 attempt별 증가 정수이며 DB 트랜잭션 안에서 할당한다. audience=public/developer/evaluator. 공개 스트림은 허용 이벤트만 전달하므로 seq는 연속일 필요 없다.
커서는 마지막으로 받은 seq. GET /attempts/{id}/events?after=N 또는 Last-Event-ID. 같은 event id는 클라이언트가 중복 제거한다.
저장 후 브로드캐스트한다. 저장되지 않은 메시지를 “저장됨”으로 표시하지 않는다.
SSE heartbeat=15초. 클라이언트 송신 큐가 2MiB를 넘으면 연결을 종료하고 저장된 커서에서 재접속하게 한다. 저장되지 않은 이벤트를 조용히 버리지 않는다.
replay gap은 event.gap 이벤트와 lost interval로 명시한다. 단순 audience 필터에 따른 seq 점프는 gap이 아니다.
로그는 원시 비밀값을 남기기 전에 가린다. 코드의 보존본과 평가용 가림본은 구분하며 가림 때문에 확인할 수 없는 항목은 미평가 가능하다.

## 9. 데이터 정합성

SQLite WAL, foreign_keys=ON. DDL 초안은 contracts/storage.sql.
하나의 상태 변경과 해당 이벤트·outbox를 같은 트랜잭션에서 기록한다. 파일/DB 원자성을 가정하지 않는다.
파일은 임시 파일 → fsync → rename → DB 참조 확정 순서. crash 복구는 orphan 파일과 완료되지 않은 작업을 찾아 재연결 또는 격리한다.
시도 삭제는 FK 관계에 맞춰 export/evaluation/interview/evidence/validation/session/token/event 등 자식 데이터를 먼저 정리한 뒤 attempt를 지운다. 인증·비공개 과제·다른 시도의 blob은 공유 참조를 확인하고 보존한다. 앱 소유 파일 삭제는 별도 삭제 job으로 재시도하며 DB 삭제만으로 외부 경로를 지우지 않는다.

동일 시도의 mutation coordinator는 상태·파일 저장·시작/중단 접수를 직렬화한다. 단일 Node 프로세스의 메모리 mutex만 믿지 않고 DB version 조건도 검사한다.

## 10. 완료 검증

CT-01 상태 전이 표, CT-02 같은 요청 재전송, CT-03 만료 직전 저장, CT-04 재시작 후 타이머, CT-05 이벤트 중복/공백, CT-06 Origin/CSRF, CT-07 파일-DB 중간 종료를 확인한다.
이 검증명은 앞으로 구현할 테스트의 계약이다. 이번 문서에서 앱 테스트를 실행했다는 뜻은 아니다.
