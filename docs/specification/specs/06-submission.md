# S06 — 마감·제출본 고정·복구

상태: 구현 기준 v0.1.0. live workspace와 submitted artifact를 반드시 구분한다.

## 1. 입력과 결과

POST /attempts/{id}/submit {reason:"manual"}.
타이머는 같은 내부 beginSeal(reason:"deadline")을 호출한다.
Idempotency-Key와 attempt.version을 검사하며 이미 sealing이면 기존 sealing operation을 반환한다. submitted 이후에는 기존 제출 ID를 반환한다.

Submission {id,attemptId,status,sealedAt,cutoffAt,cutoffEventSeq,manifestHash,files,excludedFiles,conditions}.
files[]는 {path,size,sha256}. files의 경로는 제출 루트 상대경로. 실제 호스트 경로는 UI에 전달하지 않는다.
attempt당 최초 고정 제출본은 1개. 재평가는 같은 제출본을 사용한다. 다시 구현하려면 새 attempt를 만든다.

## 2. 단계별 절차

### phase 1 — 요청 차단

DB CAS로 running/paused/pausing → sealing.
cutoffAt와 신규 접수 차단 플래그를 같은 트랜잭션에 기록.
요청 버튼·타이머·중복 HTTP가 경합해도 하나의 sealing operation만 유지.
앞서 접수한 file-write 작업과 실행 중 process/agent 목록을 저장한다.

### phase 2 — drain·중단

마감 전 접수한 저장을 최대5초 drain한다. 실패 저장은 사용자에게 표시하고 last confirmed file을 기준으로 계속할 수 있다.
진행 중 coder/stakeholder/scenario_app 요청과 queued 요청을 취소한다.
관리 terminal/dev_server 프로세스를 중지한다. 중단 확인의 기본 시간은10초.
종료 실패·프로세스 소유 불명확은 submission_failed. 코드·로그를 보존하고 snapshot을 final로 승격하지 않는다.
phase2 동안 workspace에 실제 변경이 있으면 changedAfterCutoff=true와 affected paths를 남긴다. 가짜 정시 제출로 정리하지 않는다.

### phase 3 — 파일 목록과 복사

정규 파일만 포함. 기본 제외:
.git/, node_modules/, vendor/, dist/, build/, coverage/, .next/, .cache/, runtime/,
인증값이 있는 .env/.env.*, 단 .env.example은 허용.
과제 manifest는 추가 제외를 선언할 수 있으나 source·lockfile·사용자 문서를 몰래 제외하지 않는다.
포함/제외 목록은 제출 화면과 manifest에서 확인 가능.
file 최대20MiB, 전체200MiB를 기본 상한으로 한다. 초과는 제출 실패와 조치 안내. 자동으로 큰 원본을 버리고 성공 처리하지 않는다.

각 파일을 no-follow 정책으로 열어 임시 snapshot에 복사하며 SHA-256 계산.
복사 전후 source size/mtime/hash와 전체 경로 목록을 재확인한다. 변화가 있으면 최대2회 다시 시도한다.
관리 프로세스가 모두 멈췄어도 외부 프로세스가 바꾸면 changedDuringSeal로 실패시킨다.
MVP는 임의 외부 프로세스에 대한 OS 원자 snapshot을 보장하지 않는다.

### phase 4 — 고정·확정

manifest 파일 목록은 경로순 정렬, UTF-8 LF, canonical JSON으로 해시.
snapshot과 manifest fsync 후 staging에서 submissions/{submissionId}로 atomic rename.
DB 트랜잭션에서 Submission.status=sealed, attempt.state=submitted, sealedAt, cutoffEventSeq를 확정하고 submission.sealed 이벤트를 기록한다.
cutoffEventSeq는 제출까지의 증거 범위이며 운영상 마감 후 변화 이벤트도 포함한다. cutoffAt 이후의 이벤트를 시험 중 판단으로 가산하지 않는다.
완료 후 앱이 제공하는 API로 snapshot을 변경할 수 없다.

## 3. 실패와 서버 재시작

SubmissionJob의 phase, stagingPath, submissionId, sourceVersion, process outcomes를 영속 저장.
crash가 copy 전이면 drain 상태부터 복구.
snapshot rename 후 DB commit 전이면 manifest hash를 검증하고 같은 ID로 commit.
DB commit 후 응답 전이면 재요청에 같은 제출본을 반환.
staging은 실패 원인 확인 전 삭제하지 않는다. 사용자가 다시 시도해도 기존 소스와 로그를 보존한다.
사용자가 workspace를 수정한 뒤 재시도한 경우 original cutoffAt을 유지하고 조건 변경을 표시한다. 시간 만료를 초기화하지 않는다.

## 4. 평가용 복사본

검증은 snapshot에서 별도 validation workspace를 만들어 실행한다.
검증용 dependency 설치·캐시·로그·앱용 AI token은 이 복사본 또는 runtime에만 생성한다.
검증 후 원래 Submission manifest hash가 달라지면 심각한 정합성 오류로 평가를 중지한다.
사후 질문 화면의 코드 읽기는 snapshot ID를 지정하며 live 파일 API를 사용하지 않는다.

## 5. 사용자 표시

제출 중 단계: “새 작업 마감 → 실행 정리 → 파일 저장 → 제출 완료”.
실패 시 작업물이 삭제되지 않았다는 사실과 실패 phase·다음 행동을 표시한다.
cutoffAt, sealedAt, 변경 조건, 누락된 미저장 draft, 제외 파일을 명확히 구분한다.
제출 이후부터 “현재 코드” 대신 “제출한 코드”라고 표시한다.

## 6. 검증

SUB-01 버튼 중복/타이머 경합, SUB-02 마감 직전 저장,
SUB-03 종료 안 되는 process, SUB-04 copy 중 파일 변경,
SUB-05 rename 후 crash, SUB-06 DB commit 후 응답 유실,
SUB-07 초과 파일과 symlink, SUB-08 재평가·검증 후 hash 불변을 확인한다.
