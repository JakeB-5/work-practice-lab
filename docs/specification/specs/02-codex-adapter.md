# S02 — 로컬 Codex 어댑터

상태: 구현 기준 v0.1.0 / 실제 추론·권한·복원 검증은 G-RUNTIME에서 수행.
자료: [공식 App Server 문서](https://learn.chatgpt.com/docs/app-server), 2026-10-30 호스트 Codex 0.163.0에서 생성한 stable/experimental TypeScript 정의.
공식 문서는 stdio 초기화와 대화·턴·이벤트 기반 연결 및 설치 버전에서 프로토콜 정의를 생성하는 방법을 설명한다. 실제 wire 형식은 설치 버전의 생성 결과를 우선한다.

## 1. 실제로 확인한 것과 확인하지 않은 것

확인: CLI 설치·버전·로그인 상태 조회, JSON Schema/TypeScript 생성 성공, 필드 이름·enum.
미확인: 모델 요청 성공, 권한 제한의 실효성, 중단·재시작 복구의 실동작. 스키마에 필드가 있다는 것과 동작 검증 통과는 다르다.

관찰 결과는 contracts/codex-observation.json에 저장한다. 로컬 sandbox enum은 thread/start에서 read-only/workspace-write/danger-full-access이며, turn/start의 sandboxPolicy.type에서는 readOnly/workspaceWrite 형식이다. 둘을 혼용하지 않는다.
로컬 UserInput text에는 text_elements: []를 포함한다.
stable TurnStartParams에 outputSchema가 있으나, environments와 permissions는 experimental 정의에 있다.

## 2. 제품 인터페이스

CodexAdapter:
- probe(): 실행 경로, 버전, 인증 상태, capability 결과. 실제 inference 확인은 별도 action.
- startSession(attemptId, role, model, context, profile): 제품 AgentSession 반환.
- run(sessionId, clientMessageId, input, outputSchema?): Operation과 이벤트 스트림 연결.
- interrupt(operationId): 중단 요청 접수. 완료 상태는 후속 이벤트로 결정.
- answerApproval(approvalId, decision): 해당 시도/턴에만 전달.
- reconcile(sessionId): 기존 턴과 아이템 조회, 중복/누락 판별.
- closeAttempt(attemptId): 앱 소유 대화와 프로세스만 정리.
- queueSnapshot(), cancelQueued(), reprioritizeQueued(): 제품 큐 관리.

product role=stakeholder/coder/evaluator/scenario_app. 역할 이름을 Codex 모델명이나 내부 스레드 분류로 대체하지 않는다.

## 3. 프로세스와 요청

spawn(binary, ["app-server", "--listen", "stdio://"], {shell:false, cwd:controlledDir}).
전역 Codex config 파일을 수정하지 않는다. stdout은 JSONL wire 전용, stderr는 가림 후 진단용이다. 한 줄 최대 8MiB, 초과·잘못된 JSON은 프로토콜 오류로 처리하고 요청을 불확실 상태로 보존한다.

1. initialize를 보내고 성공 응답을 기다린다.
2. initialized 알림을 보낸다.
3. thread/start로 역할별 대화를 생성한다.
4. turn/start로 입력을 전달한다.
5. item·turn 이벤트를 제품 이벤트로 변환한다.
6. turn/completed의 turn.status를 확인해 성공·실패·중단을 구별한다.

요청 ID는 프로세스별 증가 정수. pending map에 제품 operationId, 시작 시각, timeout을 연결한다.
initialize timeout=10초, 일반 RPC 접수 timeout=30초, 대화 실행은 별도 실행 timeout=10분 기본. 사용자가 중단 가능하고 개발 모드에서만 시간을 조정해 기록한다.
예시는 contracts/codex-requests.json. 값의 존재만 검증한 예시이며 실제 계정 접속 성공 기록이 아니다.

## 4. 역할별 실행 프로필

### coder

- cwd는 해당 attempt workspace.
- thread/start sandbox="workspace-write", approvalPolicy="on-request"를 기본 후보로 한다.
- turn/start에서 writableRoots=[workspace], networkAccess=false, excludeTmpdirEnvVar=true, excludeSlashTmp=true의 workspaceWrite 정책을 사용한다.
- 프로젝트 의존성 준비는 타이머 전 서버 실행 관리자가 별도 수행한다. 네트워크가 필요한 사용자 명령은 지원되는 승인 경로를 통해 처리한다.
- workspace-write가 호스트 읽기 전체를 제한한다고 주장하지 않는다. 비공개 app 데이터 접근 제한은 capability 실험 결과로 별도 확인한다.

### stakeholder / evaluator / scenario_app

- 코드 실행과 호스트 파일 접근이 필요하지 않은 역할이다.
- 0.163.0 experimental의 environments: []를 thread와 turn에 적용하는 방식을 첫 검증 후보로 한다. initialize capabilities.experimentalApi=true 및 requestAttestation=false를 명시한다.
- 빈 환경만으로 외부 MCP·앱·플러그인이 모두 차단됐다고 가정하지 않는다. 활성 도구 목록·실행 시도·상속 설정을 검증한다.
- 역할 호출은 앱이 제공한 텍스트/구조화 자료만 사용한다. evaluator가 임의 셸을 통해 제출본을 실행하지 않는다.
- 프로필이 검증되지 않으면 capability.restrictedRole=false로 기록하고 실제 응시 시작을 422로 차단한다. replay UI 개발은 허용한다.

runtime profile에는 model, config overrides, enabled/disabled capability 목록, instruction source와 hash를 기록한다. 프로필 변경은 새 대화 생성과 조건 변경 표시를 요구한다.
사람이 “승인”한 것처럼 응답을 위조하거나 모든 승인을 자동 허용하는 fallback은 없다.

## 5. 지속성·대화 복원

coder 대화는 persistent. stakeholder/evaluator/scenario_app는 비공개 맥락이 필요하면 ephemeral 사용을 우선 검토하되, 제품 DB의 transcript로 재구성 가능해야 한다.
persistent 복원은 제품에 저장된 threadId로 thread/resume(excludeTurns=true) 후 필요한 history를 페이지 단위로 읽는다.
ephemeral 또는 사라진 대화는 새로운 세션으로 재구성하고 session.recreated 이벤트를 남긴다. 기존 threadId가 유지된 것처럼 표시하지 않는다.
원문 메시지·공개 사실·설정 버전에서 복원하며, 임의 요약만으로 시험 조건을 바꾸지 않는다. 맥락 축약이 필요하면 포함·제외한 이벤트와 요약 hash를 기록한다.

전송 중 프로세스가 죽으면 operation=uncertain. 먼저 provider의 history와 clientUserMessageId를 조회해 일치하는 요청을 찾는다. provider 필드를 보내는 것만으로 exactly-once가 보장된다고 가정하지 않는다.
접수 여부를 판별할 수 없으면 자동 재전송 금지. 사용자가 기존 결과 확인 또는 새 요청을 선택하도록 한다.

## 6. 승인과 중단

승인 요청은 approvalId, attemptId, sessionId, turnId, itemId, kind, availableDecisions, expiresAt으로 저장한다. 응답은 한 번만 전달한다.
화면에서 허용된 선택만 제공한다. 이미 끝난 턴의 승인은 409 INVALID_STATE.
사용자 중단 → interrupting → turn/interrupted 또는 상태 조회로 확인 → interrupted.
중단 RPC 성공 자체는 파일 변경 롤백을 뜻하지 않는다. 이미 반영된 변경은 남기고 최종 변경 hash를 기록한다.
10초 동안 중단 확인이 없으면 앱 소유 프로세스 종료를 시도하고 uncertain으로 표시한다. 제출 상태는 S06의 안정화 확인을 추가로 요구한다.

## 7. 큐와 과제 앱 호출

전역 최대 활성 inference=1. 큐는 20개, FIFO. 명시적 순서 변경은 이벤트로 남긴다. 승인 대기 턴도 슬롯을 점유한다.
queued 메시지 취소는 모델 호출 전에 취소한다. running을 취소하면 interrupt 경로를 사용한다.
scenario_app 호출은 coder가 실행 중이면 대기열에서 무한 대기하지 않고 409 RUNTIME_BUSY + retryable=true를 반환한다. 활성 coder가 실행한 앱 테스트가 자기 모델 호출을 기다리는 교착을 방지한다.
사용자는 coder 종료 후 앱을 테스트한다. 개발 모드에서만 동시성 확대를 허용하고 변경 이력을 남긴다.

## 8. 이벤트 변환과 사용량

provider raw item의 공개 메시지·명령·파일 변경·승인·오류만 정규화한다. 비공개 사고 내용을 요구하거나 저장하지 않는다.
기본 매핑:
agentMessage delta → message.delta,
item 시작/완료 → operation.progress / tool.result,
fileChange → workspace.changed,
승인 → approval.requested,
turn completed → operation.succeeded/failed/interrupted,
알 수 없는 종료 → operation.uncertain.

providerUsage의 누적값과 turn delta를 혼합 합산하지 않는다. 입력/출력 token은 값·출처·누적 기준을 함께 저장한다. 미제공은 null. 비용 금액을 추정하지 않는다.

## 9. G-RUNTIME

RT-01 initialize/짧은 inference, RT-02 역할 대화 비혼입, RT-03 실제 파일·명령,
RT-04 승인, RT-05 중단, RT-06 재시작 복원, RT-07 정보·도구 제한,
RT-08 상속 설정 검사, RT-09 앱용 AI의 busy 동작을 확인한다.
실패한 항목은 supported=false와 근거를 기록한다. 읽기·도구 제한 실패를 “주의사항”으로만 남기고 실제 시험 시작을 허용하지 않는다.
