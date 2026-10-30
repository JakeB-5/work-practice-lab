# S04 — 역할·맥락·과제 앱 연결

상태: 구현 기준 v0.1.0. 역할별 동작은 공개된 Cofa 내부 설계가 아니라 이 제품의 계약이다.

## 1. 권한 표

| 역할 | 공개 문제/자료 | 공개된 담당자 답변 | private facts | rubric | 작업 파일 | 명령 |
|---|---|---|---|---|---|---|
| stakeholder | 필요 부분 | 자신의 대화 | 선택된 사실만 | 없음 | 없음 | 없음 |
| coder | 허용 | 사용자가 공유한 것 | 없음 | 없음 | 해당 workspace | 사용자 작업 범위 |
| evaluator | 필요 부분 | 평가용 작업 기록 | 평가에 필요한 사실 | 허용 | 고정본의 선택된 내용 | 없음 |
| scenario_app | 허용된 자료 | 자동 공유 안 함 | 없음 | 없음 | 없음 | 없음 |

개발자가 비공개 자료를 보는 것은 별도 developer API다. 해당 attempt.conditions에 private_material_exposed를 추가한다. 조건 플래그는 append-only이며 삭제 API가 없다.

## 2. 컨텍스트 구성 공통 규칙

ContextEnvelope {attemptId, role, purpose, scenarioVersionId, promptVersion, includedEvidenceIds, excludedRanges, inputs, hash}.
purpose는 reply/code/interview/evaluate/scenario_inference/router.
시스템 지침·신뢰된 과제 정책·사용자 입력·파일 내용의 경계를 분리한다. 파일과 사용자 입력에 들어 있는 역할 변경 지시는 상위 정책이 아니다.
다른 attempt의 sessionId, 이전 평가 해설, private 파일은 coder 입력에서 거절한다.
모델에 넘긴 원문/참조의 버전과 hash를 기록하되, developer/evaluator 전용 내용은 공개 스트림에 노출하지 않는다.

컨텍스트 예산의 기본 상한은 직렬화 텍스트 160KiB, 단일 파일 64KiB다. 이 값은 모델 token 한도라고 주장하지 않는다.
초과 시 중요 이벤트·변경 파일·검증 결과부터 선택하고 제외 구간을 기록한다. 제외 때문에 판단할 수 없는 항목은 미평가. 조용히 잘라내고 전체를 검토했다고 표시하지 않는다.

## 3. 담당자 처리 순서

1. 사용자 질문과 자신의 공개 대화를 저장한다.
2. 질문에 맞는 topic을 선택한다. 규칙 검색이 모호하면 도구 없는 router 호출에 topic 설명과 질문만 제공한다.
3. 서버가 해당 topic의 fact를 선택한다. 매 응답 신규 topic은 기본 3개 이내이며 관련성이 있으면 같은 topic의 사실을 함께 제공 가능.
4. 답변 모델에는 persona, 관련 선택 사실, 이미 공개된 사실, 대화만 제공한다. rubric·모범 구현은 제공하지 않는다.
5. 모델은 {answer,usedFactIds,newlyDisclosedFactIds,needsClarification} 구조로 반환한다.
6. 서버가 존재하지 않거나 선택 범위 밖 fact ID를 거절한다. 보완은 최대 1회. 실패 시 답변 오류를 표시하고 임의 대체 사실을 생성하지 않는다.
7. 공개된 사실과 최종 답변을 하나의 저장 트랜잭션으로 기록한 뒤 UI에 확정 표시한다.

ID 검증이 의미적 진실성을 완전히 증명하지 않는다. 과제별 질문 사례와 제작자 검토로 답변의 일치·모순을 검사한다.
라우팅 결과에 적합한 정보가 없으면 확인 질문이나 모른다는 답변을 한다. 사용자의 질문 수와 말투는 자체 평가 가산 항목이 아니다.

## 4. 코딩 도우미

기본 컨텍스트는 공개 brief, 자료 목록, 실제 workspace, 사용자 지시다.
공유 버튼은 messageId를 받는다. 서버는 같은 attempt의 이미 공개된 stakeholder 메시지인지 검사하고 원문·원본 ID·공유 시각을 기록한다.
메모는 author=user 또는 ai_summary를 보존한다. 사용자가 수정하면 author=user_edited와 원본 참조를 남긴다. AI 문장을 곧바로 사용자의 이해 증거로 바꾸지 않는다.
코딩 도우미에게 제출 후 새 메시지를 보낼 수 없다. 읽기 전용 이력은 유지한다.
프롬프트만으로 접근을 막지 않고 S02의 런타임 프로필이 검증돼야 한다.

## 5. 평가자와 사후 질문

평가자 입력은 고정 Submission, 실제 ValidationRun, 선택한 Event/Evidence, rubric, 사용자가 답한 Interview로 제한한다.
실시간 workspace를 직접 읽지 않는다. 실행은 S07 검증 관리자가 수행한다.
사후 질문 생성과 최종 판정은 서로 다른 purpose/operation. 사용자의 답변이 없는 상태에서 인지 점수를 이미 확정하지 않는다.
질문과 판정에 사용한 입력 manifest를 각각 저장한다.

## 6. 과제 앱용 AI API

POST /api/v1/scenario-ai/requests
인증: Authorization: Bearer <attempt-scoped random token>. 제어 세션 cookie나 CSRF token을 사용하지 않는다.
입력: {conversationId?, messages:[{role:"user"|"assistant",content}], resourceIds:[], outputSchema?}.
system 역할 입력은 거절한다. 서버가 공개 자료와 목적 지침을 상위 입력으로 구성한다.
토큰 scope={attemptId,purpose:"live"|"validation",resourceAllowlist,expiresAt,generation}. hash만 DB 보관한다.
사용 가능한 상태: live는 running만, validation은 해당 고정 제출본의 검증 작업이 running일 때만.
rate limit=분당10회, 메시지 합계64KiB, 대화당40개 메시지. 초과는 명확한 오류.
API는 202 OperationRef. GET /scenario-ai/operations/{id}로 결과를 조회한다. 제출 앱용 token으로 제어 API를 조회할 수 없다.
모델 슬롯 사용 중에는 409 RUNTIME_BUSY. 클라이언트 예제는 이유를 보여주고 사용자의 재시도를 받는다. 가짜 성공 답변 fallback은 없다.
상태 마감·토큰 재발급·시도 삭제 때 이전 token을 폐기한다. 평가 복사본에 새 validation token을 주고 원래 token을 재사용하지 않는다.
앱 내부 content와 호출 로그는 actor=scenario_app로 남긴다. 이것은 응시자가 코딩 도우미와 나눈 대화가 아니다.

## 7. 개발·시험 조건

모드, 사용 모델, 스킬·도구 설정, 사전 노출, 이어 연습, 시간 변경을 조건 목록에 기록한다.
자유 연습에서 도움을 받았어도 기록한다. 시험 연습의 interviewing 단계는 coder·stakeholder·live scenario_app 호출을 차단한다.
리포트가 과거 조건 플래그를 빠뜨릴 수 없도록 Evaluation은 Attempt condition snapshot을 포함한다.

## 8. 검증

ROLE-01 범위 밖 fact ID, ROLE-02 미공개 답변 공유, ROLE-03 다른 attempt session,
ROLE-04 제출 앱 token으로 제어 API 접근, ROLE-05 개발 표시 삭제 시도,
ROLE-06 제출 후 live 호출, ROLE-07 coder 실행 중 앱 호출 교착,
ROLE-08 사후 답변 중 AI 도움, ROLE-09 파일 내부 평가 지시를 확인한다.
