# 구현용 작업 카드

작성일: 2026-10-30 · 기준 스펙: v0.1.0

이전 98개 태스크의 ID를 유지하면서 Spec, 예상 변경 경로, 검증, 완료 증거를 연결했다. **코드 구현이나 라이브 연결 검증을 완료했다는 문서는 아니다.**
전체 기계 판독 원장은 [tasks.json](./tasks.json). 의존성·현재 착수 가능 목록은 [병렬 실행 계획](./PARALLEL-PLAN.md).

## 실행 규칙

1. 담당자는 해당 카드의 Spec과 선행 작업 결과부터 읽는다.
2. 경로는 새 개발 저장소의 제안 경로다. 현재 개인 프로젝트의 synced sources를 수정하지 않는다.
3. API operation 목록은 같은 큰 작업의 공유 범위이며 카드 하나가 목록 전체를 구현한다는 뜻이 아니다. 해당 태스크의 산출 범위를 우선한다.
4. 문서 작성 완료와 제품에 계약을 적용한 상태, 실제 검증 통과를 구분한다.
5. 공통 계약·마이그레이션·루트 설정은 단일 담당이 합쳐 반영한다.
6. 다른 모듈과 병렬 작업할 때 계약 fixture를 사용하고, 마지막에는 실제 경계를 연결한다.
7. 각 구현 PR에는 태스크 ID, 구현 범위, 검증 방법과 결과, 남은 제약을 적는다.
8. P1·원격 후속 작업은 MVP 범위가 아니며 아직 상세 기능 Spec을 새로 작성해야 한다.

<a id="t00"></a>

## T00 — 로컬 Codex 연결 가능성 검증

우선순위: P0 · 작업 흐름: 런타임

### T00.01 호스트·인증·버전 진단

- **현재 상태:** 미착수
- **선행:** 없음 · **병렬 후보:** W00 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [02-codex-adapter.md](../specs/02-codex-adapter.md)
- **변경 대상(개발 저장소 기준):** `tools/runtime-probe/inspect.ts`, `docs/evidence/runtime-host.json`
- **구현·산출 범위:** 실행 경로, 버전, 인증 상태와 실제 추론 성공을 구별하는 진단 결과 확보. 인증값은 기록하지 않음
- **검증:** 실행 파일 없음·버전 파싱 실패·로그인 조회 실패를 서로 구분 / 인증값을 출력하지 않음
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F02 / A02
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T00.02 독립 App Server 최소 연결

- **현재 상태:** 미착수
- **선행:** T00.01 · **병렬 후보:** W01 · **실제 Codex 필요:** 예
- **읽을 Spec:** [02-codex-adapter.md](../specs/02-codex-adapter.md)
- **변경 대상(개발 저장소 기준):** `tools/runtime-probe/connect.ts`, `docs/evidence/runtime-connect.json`
- **구현·산출 범위:** 앱 전용 자식 프로세스에서 짧은 실제 요청 성공과 종료 확인
- **검증:** 짧은 실제 응답과 프로세스 종료 확인 / initialize 성공만으로 inference 성공 처리하지 않음
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F02 / A01
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T00.03 대화·중단·재시작 복구 실험

- **현재 상태:** 미착수
- **선행:** T00.02 · **병렬 후보:** W02 · **실제 Codex 필요:** 예
- **읽을 Spec:** [02-codex-adapter.md](../specs/02-codex-adapter.md)
- **변경 대상(개발 저장소 기준):** `tools/runtime-probe/lifecycle.ts`, `docs/evidence/runtime-lifecycle.json`
- **구현·산출 범위:** 서로 다른 대화의 유지, 스트리밍, 중단 완료, 재시작 후 복구의 실제 기록 확보
- **검증:** 두 대화 분리·중단 완료·프로세스 재시작 후 복원 / 중단 전에 쓴 파일은 보존
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F02 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T00.04 역할별 도구·파일·설정 상속 검증

- **현재 상태:** 미착수
- **선행:** T00.02 · **병렬 후보:** W02 · **실제 Codex 필요:** 예
- **읽을 Spec:** [02-codex-adapter.md](../specs/02-codex-adapter.md)
- **변경 대상(개발 저장소 기준):** `tools/runtime-probe/role-isolation.ts`, `docs/evidence/runtime-capabilities.json`
- **구현·산출 범위:** 읽기 전용과 읽기 범위 제한을 구분하고 전역 지침·MCP·플러그인 영향을 확인. 불충분하면 대체 격리안 작성
- **검증:** private 파일·다른 작업 폴더·외부 도구 접근 시도 / 읽기 전용과 읽기 제한을 구별
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F02 / A22
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T00.05 프로토콜·승인·사용량 이벤트 조사

- **현재 상태:** 미착수
- **선행:** T00.02 · **병렬 후보:** W02 · **실제 Codex 필요:** 예
- **읽을 Spec:** [02-codex-adapter.md](../specs/02-codex-adapter.md)
- **변경 대상(개발 저장소 기준):** `tools/runtime-probe/protocol.ts`, `packages/codex-adapter/src/generated/`
- **구현·산출 범위:** 설치 버전의 요청/응답 정의, 승인 왕복, 상태·사용량·파일 변경 이벤트와 누락 항목 목록 확보
- **검증:** 설치 버전 schema와 요청 예제 대조 / 실제 승인 응답 왕복 및 미제공 사용량 확인
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F02 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T00.06 연결 방식 결정 및 검증 게이트

- **현재 상태:** 미착수
- **선행:** T00.03, T00.04, T00.05 · **병렬 후보:** W03 · **실제 Codex 필요:** 예
- **읽을 Spec:** [02-codex-adapter.md](../specs/02-codex-adapter.md)
- **변경 대상(개발 저장소 기준):** `docs/decisions/runtime-profile.md`, `docs/evidence/runtime-gate.json`
- **구현·산출 범위:** App Server 채택 가능 범위·제약·버전을 기록. 역할 제한 미충족 시 필요한 재검증을 완료하기 전 후속 게이트 통과 금지
- **검증:** 필수 capability 하나 실패한 경우 live 시작 차단 / replay는 명확히 가상으로 표시
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F02 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

<a id="t01"></a>

## T01 — 공통 Spec과 병렬 개발 계약

우선순위: P0 · 작업 흐름: 공통 설계

### T01.01 공통 용어·ID·역할·책임 Spec 초안

- **현재 상태:** 문서 정의 완료. 앱 구현/라이브 검증 완료가 아님.
- **선행:** 없음 · **병렬 후보:** W00 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [01-platform.md](../specs/01-platform.md)
- **변경 대상(개발 저장소 기준):** `docs/specs/01-platform.md`, `packages/contracts/src/ids.ts`
- **구현·산출 범위:** Attempt, ScenarioVersion, Submission, Event, Evidence 및 역할별 책임의 공통 정의
- **검증:** 용어·ID 접두사·역할이 API와 문서에서 일치
- **완료 증거:** 스펙·계약 변경 또는 현재 기준의 검토 기록 · 필요한 runtime gate 또는 호환성 검증 결과
- **PRD 연결:** 전 요구사항 기반 / PRD §8, §13~14 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T01.02 세션 상태·시간·제출 규칙 Spec

- **현재 상태:** 문서 정의 완료. 앱 구현/라이브 검증 완료가 아님.
- **선행:** T01.01 · **병렬 후보:** W01 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [01-platform.md](../specs/01-platform.md)
- **변경 대상(개발 저장소 기준):** `docs/specs/01-platform.md`, `packages/contracts/src/attempt-state.ts`
- **구현·산출 범위:** 모드별 시간, 허용 상태 전이, 오류 상태, 마감 시 접수 기준, 반복 요청 처리 규칙 확정
- **검증:** 만료·일시정지 실패·마감 경합의 상태 전이 표를 예제로 검토
- **완료 증거:** 스펙·계약 변경 또는 현재 기준의 검토 기록 · 필요한 runtime gate 또는 호환성 검증 결과
- **PRD 연결:** 전 요구사항 기반 / PRD §8, §13~14 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T01.03 API·이벤트·데이터 공통 계약

- **현재 상태:** 스펙 본문·계약 작성됨. 선행 런타임 검증과 프로젝트 반영·확정이 필요.
- **선행:** T00.05, T01.02 · **병렬 후보:** W03 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [01-platform.md](../specs/01-platform.md)
- **변경 대상(개발 저장소 기준):** `packages/contracts/openapi.json`, `packages/contracts/domain.schema.json`
- **구현·산출 범위:** 필수 필드, 오류 코드, 순번·중복 처리, 출처, 접근 범위, 호환 버전 및 모델 이벤트 변환 규칙 명시
- **검증:** OpenAPI와 domain schema 동일성 / 알려지지 않은 필드와 실패 상태 검사
- **완료 증거:** 스펙·계약 변경 또는 현재 기준의 검토 기록 · 필요한 runtime gate 또는 호환성 검증 결과
- **PRD 연결:** 전 요구사항 기반 / PRD §8, §13~14 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T01.04 계약 예시와 재생용 데이터

- **현재 상태:** 스펙 본문·계약 작성됨. 선행 런타임 검증과 프로젝트 반영·확정이 필요.
- **선행:** T01.03 · **병렬 후보:** W04 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [01-platform.md](../specs/01-platform.md)
- **변경 대상(개발 저장소 기준):** `packages/contracts/fixtures/`, `tests/contracts/`
- **구현·산출 범위:** 정상·실패·중단·재연결·미평가 샘플을 UI와 서버가 공유. 실제 로그와 가상 샘플 구분
- **검증:** 정상·실패·중단·불확실·미평가 fixture의 양성/음성 검증
- **완료 증거:** 스펙·계약 변경 또는 현재 기준의 검토 기록 · 필요한 runtime gate 또는 호환성 검증 결과
- **PRD 연결:** 전 요구사항 기반 / PRD §8, §13~14 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T01.05 공통 Spec 검토 및 1차 확정

- **현재 상태:** 미착수
- **선행:** T00.06, T01.03, T01.04 · **병렬 후보:** W05 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [01-platform.md](../specs/01-platform.md)
- **변경 대상(개발 저장소 기준):** `docs/decisions/contracts-baseline.md`, `packages/contracts/package.json`
- **구현·산출 범위:** 역할·상태·API·이벤트·권한에 충돌이 없음. 공통 계약 변경 담당과 버전 규칙 결정
- **검증:** runtime gate 미통과 상태에서 확정했다고 표시하지 않음 / 변경 영향과 계약 버전 기록
- **완료 증거:** 스펙·계약 변경 또는 현재 기준의 검토 기록 · 필요한 runtime gate 또는 호환성 검증 결과
- **PRD 연결:** 전 요구사항 기반 / PRD §8, §13~14 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

<a id="t02"></a>

## T02 — 프로젝트 기반과 저장·보안 공통부

우선순위: P0 · 작업 흐름: 플랫폼

### T02.01 프로젝트·개발 명령·검사 기반 구성

- **현재 상태:** 미착수
- **선행:** T01.01 · **병렬 후보:** W01 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [01-platform.md](../specs/01-platform.md)
- **변경 대상(개발 저장소 기준):** `package.json`, `pnpm-workspace.yaml`, `apps/web/`, `apps/server/`
- **구현·산출 범위:** UI·서버·공통 계약의 경계를 만들고 실행·빌드·타입 검사·테스트 명령을 한 곳에 정리
- **검증:** 깨끗한 디렉터리에서 의존성 설치·타입 검사·개발 실행 / root scripts 설명과 일치
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F09, F13 / PRD §10~11, §14, §17 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T02.02 메타데이터 저장소·마이그레이션

- **현재 상태:** 미착수
- **선행:** T01.05, T02.01 · **병렬 후보:** W06 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [01-platform.md](../specs/01-platform.md)
- **변경 대상(개발 저장소 기준):** `apps/server/src/db/migrations/0001-initial.sql`, `apps/server/src/db/index.ts`
- **구현·산출 범위:** 시도·과제 버전·에이전트 대화·제출·검증·평가 데이터를 저장하고 재시작 후 복구
- **검증:** 마이그레이션 실행 / 두 active attempt 거절·FK 위반·완료 데이터 변경 거절
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F09, F13 / PRD §10~11, §14, §17 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T02.03 로컬 API 인증·접근 경계

- **현재 상태:** 미착수
- **선행:** T01.05, T02.01 · **병렬 후보:** W06 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [01-platform.md](../specs/01-platform.md)
- **변경 대상(개발 저장소 기준):** `apps/server/src/modules/auth/`, `apps/server/src/http/security.ts`
- **구현·산출 범위:** localhost 바인딩, Host/Origin 검사, 로컬 세션 인증, 제어 API와 과제 앱 권한 분리
- **검증:** 외부 Origin·잘못된 CSRF·만료 launch token·preview의 제어 API 요청 거절
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F09, F13 / PRD §10~11, §14, §17 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T02.04 이벤트·파일 저장·민감정보 처리

- **현재 상태:** 미착수
- **선행:** T02.02, T01.04 · **병렬 후보:** W07 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [01-platform.md](../specs/01-platform.md)
- **변경 대상(개발 저장소 기준):** `apps/server/src/modules/events/store.ts`, `apps/server/src/storage/blobs.ts`, `apps/server/src/storage/redaction.ts`
- **구현·산출 범위:** 주체·순번·출처가 있는 이벤트 저장, 중복 방지, 큰 출력 참조, 비밀값 가림과 가림 표시
- **검증:** 중복 이벤트·비밀값 가림·blob 저장 실패 / 저장 전 브로드캐스트하지 않음
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F09 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T02.05 스트리밍 전송과 재연결 커서

- **현재 상태:** 미착수
- **선행:** T02.03, T02.04 · **병렬 후보:** W08 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [01-platform.md](../specs/01-platform.md)
- **변경 대상(개발 저장소 기준):** `apps/server/src/modules/events/sse.ts`, `apps/web/src/api/event-stream.ts`
- **구현·산출 범위:** 저장된 순번 기준으로 재전송하고 중복을 제거. 복구 불가 구간은 기록 공백으로 표시
- **검증:** 커서 재연결·SSE 중복·느린 클라이언트 큐 초과 / audience에 따른 seq 점프 허용
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F09 / A08
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T02.06 공통 장애·정합성 복구

- **현재 상태:** 미착수
- **선행:** T02.04, T02.05 · **병렬 후보:** W09 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [01-platform.md](../specs/01-platform.md)
- **변경 대상(개발 저장소 기준):** `apps/server/src/storage/recovery.ts`, `apps/server/src/modules/events/outbox.ts`
- **구현·산출 범위:** DB와 파일 기록의 연결 실패를 감지하고 정리·재시도. 저장 실패를 성공으로 표시하지 않음
- **검증:** 파일 rename 전후·DB commit 전후 종료 주입 / orphan 처리와 작업 보존
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F09 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

<a id="t03"></a>

## T03 — Codex 실행 어댑터

우선순위: P0 · 작업 흐름: 런타임

### T03.01 Codex 어댑터 상세 Spec

- **현재 상태:** 스펙 본문·계약 작성됨. 선행 런타임 검증과 프로젝트 반영·확정이 필요.
- **선행:** T01.05 · **병렬 후보:** W06 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [02-codex-adapter.md](../specs/02-codex-adapter.md)
- **변경 대상(개발 저장소 기준):** `docs/specs/02-codex-adapter.md`, `packages/codex-adapter/src/types.ts`
- **구현·산출 범위:** 연결·턴·승인·중단·복구·설정·사용량 인터페이스와 지원하지 않는 기능 확정
- **검증:** 설치 버전의 enum·필수 text_elements와 어댑터 interface 대조
- **완료 증거:** 스펙·계약 변경 또는 현재 기준의 검토 기록 · 필요한 runtime gate 또는 호환성 검증 결과
- **PRD 연결:** F04 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T03.02 프로세스와 역할별 대화 수명 관리

- **현재 상태:** 미착수
- **선행:** T03.01, T02.02 · **병렬 후보:** W07 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [02-codex-adapter.md](../specs/02-codex-adapter.md)
- **변경 대상(개발 저장소 기준):** `packages/codex-adapter/src/process.ts`, `packages/codex-adapter/src/sessions.ts`
- **구현·산출 범위:** 앱 전용 프로세스 생성·정리 및 시도/역할별 대화 매핑. 데스크톱 앱의 다른 대화에 영향 없음
- **검증:** 역할별 세션 분리·자식 프로세스 종료 / 기존 Codex 앱 세션을 종료하지 않음
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F02, F04 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T03.03 실행·스트리밍·승인·중단 구현

- **현재 상태:** 미착수
- **선행:** T03.02, T02.04, T02.05 · **병렬 후보:** W09 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [02-codex-adapter.md](../specs/02-codex-adapter.md)
- **변경 대상(개발 저장소 기준):** `packages/codex-adapter/src/rpc.ts`, `packages/codex-adapter/src/events.ts`, `packages/codex-adapter/src/approvals.ts`
- **구현·산출 범위:** 본문과 도구 이벤트 전달, 승인 응답, 실제 중단 완료 확인. 완료 이벤트와 성공을 구별
- **검증:** 승인 요청·거절·늦은 승인·실패 turn/completed / 성공 오인 없음
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F02, F04 / A10
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T03.04 오류 분류와 재연결·복원

- **현재 상태:** 미착수
- **선행:** T03.03 · **병렬 후보:** W10 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [02-codex-adapter.md](../specs/02-codex-adapter.md)
- **변경 대상(개발 저장소 기준):** `packages/codex-adapter/src/reconcile.ts`, `packages/codex-adapter/src/errors.ts`
- **구현·산출 범위:** 인증·네트워크·사용 제한·프로세스 실패 구별. 접수 불명확 시 무조건 재실행하지 않음
- **검증:** 전송 직후 disconnect·unknown 접수 / reconcile 전 자동 재실행 없음
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F02, F04 / A09
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T03.05 모델 설정·동시 실행 큐·사용량

- **현재 상태:** 미착수
- **선행:** T03.03 · **병렬 후보:** W10 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [02-codex-adapter.md](../specs/02-codex-adapter.md)
- **변경 대상(개발 저장소 기준):** `apps/server/src/modules/runtime/queue.ts`, `packages/codex-adapter/src/usage.ts`, `apps/server/src/modules/runtime/config.ts`
- **구현·산출 범위:** 지원 설정 기록, 기본 동시성 1, 대기·취소·순서 변경, 출처별 사용량과 확인 불가 표시
- **검증:** 큐 포화·순서 변경·취소·사용량 누적 중복 / unknown 비용을 숫자로 만들지 않음
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F04, F09 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T03.06 실제 Codex 어댑터 통합 검증

- **현재 상태:** 미착수
- **선행:** T03.04, T03.05 · **병렬 후보:** W11 · **실제 Codex 필요:** 예
- **읽을 Spec:** [02-codex-adapter.md](../specs/02-codex-adapter.md)
- **변경 대상(개발 저장소 기준):** `tests/live/codex-adapter.spec.ts`, `docs/evidence/codex-adapter-live.json`
- **구현·산출 범위:** 실제 파일 수정·명령 실행·승인·중단·복구를 통과. 재생 테스트와 라이브 결과 구별
- **검증:** 실제 계정으로 RT-01~RT-09 기록 / 가상 실행 결과를 혼합하지 않음
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F04 / A01, A06
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

<a id="t04"></a>

## T04 — 시도·모드·타이머 관리

우선순위: P0 · 작업 흐름: 플랫폼

### T04.01 시도 상태와 전이 제어

- **현재 상태:** 미착수
- **선행:** T01.05, T02.02 · **병렬 후보:** W07 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [01-platform.md](../specs/01-platform.md), [06-submission.md](../specs/06-submission.md)
- **변경 대상(개발 저장소 기준):** `apps/server/src/modules/attempts/state-machine.ts`, `apps/server/src/modules/attempts/repository.ts`
- **구현·산출 범위:** 상태별 허용 동작과 하나의 활성 시도 규칙을 서버에서 강제
- **검증:** 두 active attempt 생성 경합 / 금지 상태 전이 거절
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F08 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T04.02 환경 준비와 시도 시작

- **현재 상태:** 미착수
- **선행:** T04.01, T05.02, T07.02, T03.03 · **병렬 후보:** W10 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [01-platform.md](../specs/01-platform.md), [06-submission.md](../specs/06-submission.md)
- **변경 대상(개발 저장소 기준):** `apps/server/src/modules/attempts/prepare.ts`, `apps/server/src/modules/attempts/start.ts`
- **구현·산출 범위:** 과제·작업 폴더·의존성·연결 준비 완료 후에만 시작 및 시간 계산
- **검증:** 의존성·DB·inference 준비 실패 시 ready/타이머 진입 금지
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F02, F08 / A02
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T04.03 모드별 서버 타이머

- **현재 상태:** 미착수
- **선행:** T04.01 · **병렬 후보:** W08 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [01-platform.md](../specs/01-platform.md), [06-submission.md](../specs/06-submission.md)
- **변경 대상(개발 저장소 기준):** `apps/server/src/modules/attempts/clock.ts`, `apps/server/src/modules/attempts/pause.ts`
- **구현·산출 범위:** 자유 연습 정지, 시험 연습 마감 시각, 개발 변경 이력. 새로고침·절전 후 규칙 일관
- **검증:** pause 실패·절전 후 deadline·시계 이동 / 서버 만료 판정이 화면보다 우선
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F08 / A12
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T04.04 메시지·실행·저장의 상태별 접수

- **현재 상태:** 미착수
- **선행:** T04.01, T02.03, T03.03 · **병렬 후보:** W10 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [01-platform.md](../specs/01-platform.md), [06-submission.md](../specs/06-submission.md)
- **변경 대상(개발 저장소 기준):** `apps/server/src/modules/attempts/mutation-gate.ts`, `apps/server/src/http/idempotency.ts`
- **구현·산출 범위:** 단계별 요청 허용/차단과 요청 ID 중복 방지. 마감 및 사후 질문 중 쓰기 요청 차단 가능
- **검증:** 동일 key 재전송·다른 body 충돌·sealing 후 메시지/저장/명령 접수 거절
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F08 / A09, A16
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T04.05 브라우저·서버 재시작 후 시도 복원

- **현재 상태:** 미착수
- **선행:** T04.02, T04.03, T04.04, T03.04 · **병렬 후보:** W11 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [01-platform.md](../specs/01-platform.md), [06-submission.md](../specs/06-submission.md)
- **변경 대상(개발 저장소 기준):** `apps/server/src/modules/attempts/recovery.ts`, `apps/web/src/api/attempt-recovery.ts`
- **구현·산출 범위:** 저장된 시도·타이머·대화 상태 복구 및 불확실한 실행 상태 안내
- **검증:** 브라우저·서버 재시작과 만료된 시도 복구 / 상태 추정으로 완료하지 않음
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F08 / A08
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T04.06 새 시도·이어 연습·시도 삭제

- **현재 상태:** 미착수
- **선행:** T04.02, T09.03 · **병렬 후보:** W14 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [01-platform.md](../specs/01-platform.md), [06-submission.md](../specs/06-submission.md)
- **변경 대상(개발 저장소 기준):** `apps/server/src/modules/attempts/fork.ts`, `apps/server/src/modules/attempts/delete.ts`
- **구현·산출 범위:** 이전 제출본 유지, 새 대화/작업 폴더 생성, 선행 맥락 표시, 앱 소유 파일만 삭제
- **검증:** 새 대화/폴더 생성·선행 맥락 표시 / 외부 프로젝트 삭제 금지
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F14 / A21
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

<a id="t05"></a>

## T05 — 과제 패키지와 두 기본 과제 제작

우선순위: P0 · 작업 흐름: 콘텐츠

### T05.01 과제 패키지 Spec

- **현재 상태:** 스펙 본문·계약 작성됨. 선행 런타임 검증과 프로젝트 반영·확정이 필요.
- **선행:** T01.03 · **병렬 후보:** W04 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [03-scenario-package.md](../specs/03-scenario-package.md), [08-evaluation.md](../specs/08-evaluation.md)
- **변경 대상(개발 저장소 기준):** `docs/specs/03-scenario-package.md`, `packages/contracts/src/scenario.ts`
- **구현·산출 범위:** manifest·공개 자료·담당자 사실·평가기준·검증 정의·버전·경로 검사 형식 정의
- **검증:** manifest schema·상대 경로·명령 argv·public/private 경계 확인
- **완료 증거:** 스펙·계약 변경 또는 현재 기준의 검토 기록 · 필요한 runtime gate 또는 호환성 검증 결과
- **PRD 연결:** F01 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T05.02 패키지 검증·로딩·버전 고정

- **현재 상태:** 미착수
- **선행:** T05.01, T02.02, T02.03 · **병렬 후보:** W07 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [03-scenario-package.md](../specs/03-scenario-package.md), [08-evaluation.md](../specs/08-evaluation.md)
- **변경 대상(개발 저장소 기준):** `apps/server/src/modules/scenarios/loader.ts`, `apps/server/src/modules/scenarios/public-dto.ts`
- **구현·산출 범위:** 비공개 자료를 UI/작업 폴더로 내보내지 않으며 진행 중 과제 버전 고정
- **검증:** 동일 version 내용 변경·미등록 resource·private 경로 접근 거절
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F01 / A04
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T05.03 고객 응대 과제 자료와 담당자 사실

- **현재 상태:** 미착수
- **선행:** T05.01 · **병렬 후보:** W05 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [03-scenario-package.md](../specs/03-scenario-package.md), [08-evaluation.md](../specs/08-evaluation.md)
- **변경 대상(개발 저장소 기준):** `scenarios/retail-coaching/public/`, `scenarios/retail-coaching/private/stakeholder.json`
- **구현·산출 범위:** 상품 6종·정책·교육 메모·공개 조건·허용 해결 방식 작성. 풀이 전문을 응시 자료에서 제외
- **검증:** 상품/정책/담당자 사실 모순 검토 / 풀이 코드가 public에 없음
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F01, F03 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T05.04 고객 응대 시작 프로젝트와 앱용 AI 예제

- **현재 상태:** 미착수
- **선행:** T05.03, T06.01, T02.01 · **병렬 후보:** W07 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [03-scenario-package.md](../specs/03-scenario-package.md), [08-evaluation.md](../specs/08-evaluation.md)
- **변경 대상(개발 저장소 기준):** `scenarios/retail-coaching/public/starter/`, `scenarios/retail-coaching/manifest.json`
- **구현·산출 범위:** 필요 최소 시작 코드, 앱용 AI 호출 계약 예제, 실행 안내. 완성 답안은 포함하지 않음
- **검증:** starter clean install와 AI busy/오류 표시 / 브라우저 번들에 scoped secret 없음
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F01, F03, F12 / PRD §12, §15.5 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T05.05 장비 예약 과제 자료와 담당자 사실

- **현재 상태:** 미착수
- **선행:** T05.01 · **병렬 후보:** W05 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [03-scenario-package.md](../specs/03-scenario-package.md), [08-evaluation.md](../specs/08-evaluation.md)
- **변경 대상(개발 저장소 기준):** `scenarios/equipment-booking/public/`, `scenarios/equipment-booking/private/stakeholder.json`
- **구현·산출 범위:** 예약·취소 규칙, 장비 자료, 공개 조건, 허용 설계 대안 작성
- **검증:** 예약 단위·맞닿는 시간·취소 권한이 자료와 일치
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F01, F03 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T05.06 예약 시작 프로젝트·로그인·DB 준비

- **현재 상태:** 미착수
- **선행:** T05.05, T02.01 · **병렬 후보:** W06 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [03-scenario-package.md](../specs/03-scenario-package.md), [08-evaluation.md](../specs/08-evaluation.md)
- **변경 대상(개발 저장소 기준):** `scenarios/equipment-booking/public/starter/`, `scenarios/equipment-booking/manifest.json`
- **구현·산출 범위:** 초기 로그인·장비 데이터·PostgreSQL 준비 및 상태 확인. 기존 사용자 DB를 변경하지 않음
- **검증:** DB 준비 실패와 과제 실패 구별 / 두 attempt DB namespace 혼입 없음
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F01, F03, F12 / PRD §12, §15.5 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T05.07 두 과제 패키지 정합성 검사

- **현재 상태:** 미착수
- **선행:** T05.02, T05.04, T05.06 · **병렬 후보:** W08 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [03-scenario-package.md](../specs/03-scenario-package.md), [08-evaluation.md](../specs/08-evaluation.md)
- **변경 대상(개발 저장소 기준):** `tools/scenarios/validate.ts`, `tests/integration/scenario-packages.spec.ts`
- **구현·산출 범위:** 자료·사실·실행 설정의 모순, 비공개 파일 노출, 경로 이탈 검사 통과
- **검증:** 잘못된 경로·누락 ID·중복 버전·비공개 자료 노출의 음성 fixture
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F01, F03, F12 / PRD §12, §15.5 / A21
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T05.08 과제별 평가 기준과 기준 사례 제작

- **현재 상태:** 미착수
- **선행:** T05.03, T05.05, T11.01 · **병렬 후보:** W07 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [03-scenario-package.md](../specs/03-scenario-package.md), [08-evaluation.md](../specs/08-evaluation.md)
- **변경 대상(개발 저장소 기준):** `scenarios/retail-coaching/private/rubric.json`, `scenarios/equipment-booking/private/rubric.json`, `scenarios/*/private/calibration/`
- **구현·산출 범위:** 강한/부분/실패/근거 부족 수행, 잘못된 AI 주장과 사용자 검증을 구분할 사례 및 기대 판정 작성
- **검증:** 강한/부분/실패/근거 부족 사례의 기대 판정과 허용 대안 명시
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F01, F03, F12 / PRD §12, §15.5 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

<a id="t06"></a>

## T06 — 담당자·코딩 도우미·과제 앱의 역할 연결

우선순위: P0 · 작업 흐름: 에이전트 기능

### T06.01 역할별 맥락·공유·권한 Spec

- **현재 상태:** 스펙 본문·계약 작성됨. 선행 런타임 검증과 프로젝트 반영·확정이 필요.
- **선행:** T01.05 · **병렬 후보:** W06 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [04-role-context.md](../specs/04-role-context.md), [02-codex-adapter.md](../specs/02-codex-adapter.md)
- **변경 대상(개발 저장소 기준):** `docs/specs/04-role-context.md`, `packages/contracts/src/context.ts`
- **구현·산출 범위:** 입력 출처, 공개 사실, 공유 동작, 앱용 AI 범위, 금지 접근과 런타임 정책 정의
- **검증:** 모든 role/purpose의 입력·도구·권한 표에서 누락 없는지 검토
- **완료 증거:** 스펙·계약 변경 또는 현재 기준의 검토 기록 · 필요한 runtime gate 또는 호환성 검증 결과
- **PRD 연결:** F03 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T06.02 역할별 맥락 구성기

- **현재 상태:** 미착수
- **선행:** T06.01, T03.02, T05.02 · **병렬 후보:** W08 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [04-role-context.md](../specs/04-role-context.md), [02-codex-adapter.md](../specs/02-codex-adapter.md)
- **변경 대상(개발 저장소 기준):** `apps/server/src/modules/agents/context-builder.ts`, `apps/server/src/modules/agents/policy.ts`
- **구현·산출 범위:** 시도와 역할별로 맥락을 구성. 코딩 도우미에 비공개 사실·평가기준을 넣지 않음
- **검증:** 다른 attempt·미공개 fact·rubric을 coder context로 넣는 요청 거절
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F03 / A04
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T06.03 담당자 사실 선택과 답변·공개 이력

- **현재 상태:** 미착수
- **선행:** T06.02, T05.03, T03.03, T02.04 · **병렬 후보:** W10 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [04-role-context.md](../specs/04-role-context.md), [02-codex-adapter.md](../specs/02-codex-adapter.md)
- **변경 대상(개발 저장소 기준):** `apps/server/src/modules/stakeholder/router.ts`, `apps/server/src/modules/stakeholder/reply.ts`, `apps/server/src/modules/stakeholder/disclosures.ts`
- **구현·산출 범위:** 답변과 fact ID 연결. 표현이 다른 동등한 질문에 답하고 자료 밖 사실을 창작하지 않도록 검증
- **검증:** 동의어·모호한 질문·선택 범위 밖 fact ID·모르는 질문 / 모순된 답변 확인
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F03 / A03
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T06.04 코딩 도우미와 선택적 맥락 공유

- **현재 상태:** 미착수
- **선행:** T06.02, T03.03, T04.04, T07.02 · **병렬 후보:** W11 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [04-role-context.md](../specs/04-role-context.md), [02-codex-adapter.md](../specs/02-codex-adapter.md)
- **변경 대상(개발 저장소 기준):** `apps/server/src/modules/coder/`, `apps/server/src/modules/notes/`, `apps/server/src/modules/agents/share.ts`
- **구현·산출 범위:** 사용자 선택 공개 메시지와 메모만 출처를 붙여 전달. 사용자 수정/AI 요약 구분
- **검증:** 공개되지 않은 메시지 공유 거절 / AI 요약과 사용자 편집 출처 보존
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F04 / A05
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T06.05 과제 앱용 AI 연결

- **현재 상태:** 미착수
- **선행:** T06.01, T03.03, T02.03, T04.01 · **병렬 후보:** W10 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [04-role-context.md](../specs/04-role-context.md), [02-codex-adapter.md](../specs/02-codex-adapter.md)
- **변경 대상(개발 저장소 기준):** `apps/server/src/modules/scenario-ai/`, `packages/contracts/src/scenario-ai.ts`
- **구현·산출 범위:** 해당 시도의 앱 호출만 허용. 별도 대화·로그·사용량·실패 표시, 제어 API 접근 불가
- **검증:** 만료/revoked token·다른 attempt·sealing·coder busy·private resource 요청 거절
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F03, F04 / PRD §8, §12.3 / A19
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T06.06 역할 혼입·정보 노출 검증

- **현재 상태:** 미착수
- **선행:** T06.03, T06.04, T06.05, T03.06 · **병렬 후보:** W12 · **실제 Codex 필요:** 예
- **읽을 Spec:** [04-role-context.md](../specs/04-role-context.md), [02-codex-adapter.md](../specs/02-codex-adapter.md)
- **변경 대상(개발 저장소 기준):** `tests/live/role-boundaries.spec.ts`, `tests/integration/context-scopes.spec.ts`
- **구현·산출 범위:** 비공개 정보 요구, 다른 시도 접근, 불필요한 도구 실행, 전역 설정 영향 사례를 실제 연결로 확인
- **검증:** 실제 Codex로 도구 제한·설정 상속·private 정보 접근·앱 token 범위 검증
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F03, F04 / PRD §8, §12.3 / A03, A04, A19, A22
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

<a id="t07"></a>

## T07 — 파일·터미널·미리보기 실행 환경

우선순위: P0 · 작업 흐름: 작업 환경

### T07.01 작업 환경 상세 Spec

- **현재 상태:** 스펙 본문·계약 작성됨. 선행 런타임 검증과 프로젝트 반영·확정이 필요.
- **선행:** T01.05 · **병렬 후보:** W06 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [05-workspace.md](../specs/05-workspace.md), [01-platform.md](../specs/01-platform.md)
- **변경 대상(개발 저장소 기준):** `docs/specs/05-workspace.md`, `packages/contracts/src/workspace.ts`
- **구현·산출 범위:** 폴더·파일 버전·경로 제한·프로세스·포트·중단 API와 마감 제어 연결 정의
- **검증:** 파일/명령/중단 계약과 제출 coordinator의 호출 순서 검토
- **완료 증거:** 스펙·계약 변경 또는 현재 기준의 검토 기록 · 필요한 runtime gate 또는 호환성 검증 결과
- **PRD 연결:** F05, F06, F07 / PRD §11, §13 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T07.02 시도 작업 폴더 생성·접근 범위

- **현재 상태:** 미착수
- **선행:** T07.01, T02.03 · **병렬 후보:** W07 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [05-workspace.md](../specs/05-workspace.md), [01-platform.md](../specs/01-platform.md)
- **변경 대상(개발 저장소 기준):** `apps/server/src/modules/workspace/roots.ts`, `apps/server/src/modules/workspace/paths.ts`
- **구현·산출 범위:** 공개 템플릿 복사, 루트 밖/심볼릭 링크 이탈 차단, 원본 패키지 보호
- **검증:** ../·절대 경로·symlink 교체·다른 attempt 경로·원본 패키지 쓰기 거절
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F05 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T07.03 파일 탐색·저장·변경 감지·충돌

- **현재 상태:** 미착수
- **선행:** T07.02, T02.04 · **병렬 후보:** W08 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [05-workspace.md](../specs/05-workspace.md), [01-platform.md](../specs/01-platform.md)
- **변경 대상(개발 저장소 기준):** `apps/server/src/modules/workspace/files.ts`, `apps/server/src/modules/workspace/watch.ts`
- **구현·산출 범위:** 편집과 AI 변경 버전 비교, 저장 확인, 충돌 시 사용자 내용 보존
- **검증:** 사용자와 AI 저장 경합·신규 파일 If-None-Match·저장 실패 후 draft 보존
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F05 / A06, A07
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T07.04 PTY 터미널과 프로세스 관리자

- **현재 상태:** 미착수
- **선행:** T07.02, T02.04 · **병렬 후보:** W08 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [05-workspace.md](../specs/05-workspace.md), [01-platform.md](../specs/01-platform.md)
- **변경 대상(개발 저장소 기준):** `apps/server/src/modules/workspace/pty.ts`, `apps/server/src/modules/workspace/processes.ts`
- **구현·산출 범위:** 시도별 실행·출력·중단·자식 프로세스 추적. 사용자와 AI 명령 출처 구분
- **검증:** PTY 재접속·resize·출력 한도·자식 프로세스 그룹 종료·명령 출처
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F06 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T07.05 개발 서버·포트·미리보기 격리

- **현재 상태:** 미착수
- **선행:** T07.04, T02.03 · **병렬 후보:** W09 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [05-workspace.md](../specs/05-workspace.md), [01-platform.md](../specs/01-platform.md)
- **변경 대상(개발 저장소 기준):** `apps/server/src/modules/workspace/preview.ts`, `apps/server/src/http/preview-proxy.ts`
- **구현·산출 범위:** 등록된 시도 포트만 노출. 제출 앱에서 제어 API 권한을 얻지 못함
- **검증:** 미등록 포트·외부 URL·preview의 cookie/CSRF 공격·서버 실패
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F07 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T07.06 작업 중지·프로세스 회수

- **현재 상태:** 미착수
- **선행:** T07.04, T03.03 · **병렬 후보:** W10 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [05-workspace.md](../specs/05-workspace.md), [01-platform.md](../specs/01-platform.md)
- **변경 대상(개발 저장소 기준):** `apps/server/src/modules/workspace/quiesce.ts`, `apps/server/src/modules/workspace/cleanup.ts`
- **구현·산출 범위:** 관리 중 에이전트/터미널 쓰기 작업의 중단 결과와 실패를 확인하는 공통 동작 제공
- **검증:** 종료 안 되는 자식·이미 끝난 PID·소유권 불명확 / 강제 성공 상태 금지
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F06 / A10
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T07.07 서버 상태와 파일·명령 접수 연결

- **현재 상태:** 미착수
- **선행:** T07.03, T07.06, T04.04 · **병렬 후보:** W11 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [05-workspace.md](../specs/05-workspace.md), [01-platform.md](../specs/01-platform.md)
- **변경 대상(개발 저장소 기준):** `apps/server/src/modules/workspace/mutations.ts`, `apps/server/src/modules/attempts/mutation-gate.ts`
- **구현·산출 범위:** 마감 뒤 새 쓰기 차단, 마감 전 접수된 저장의 완료 경계와 변경 시각 기록
- **검증:** 마감 전 접수 write drain·마감 후 input 거절·afterCutoff 변경 기록
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F05 / A12
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

<a id="t08"></a>

## T08 — 사용자 작업 화면

우선순위: P0 · 작업 흐름: UI

### T08.01 화면 흐름·패널·상태 설계

- **현재 상태:** 스펙 본문·계약 작성됨. 선행 런타임 검증과 프로젝트 반영·확정이 필요.
- **선행:** T01.01 · **병렬 후보:** W01 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [09-ui-and-recovery.md](../specs/09-ui-and-recovery.md)
- **변경 대상(개발 저장소 기준):** `docs/specs/09-ui-and-recovery.md`, `docs/ui/flows.md`
- **구현·산출 범위:** 과제 목록·환경 확인·작업 화면·제출·질의응답·리포트의 빈/진행/오류 상태 설계
- **검증:** 모든 라우트의 빈/진행/오류/완료 상태 / 역할과 다음 행동 식별 가능
- **완료 증거:** 스펙·계약 변경 또는 현재 기준의 검토 기록 · 필요한 runtime gate 또는 호환성 검증 결과
- **PRD 연결:** F01~F08 / PRD §7 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T08.02 공통 화면과 재생 데이터 연결

- **현재 상태:** 미착수
- **선행:** T08.01, T02.01, T01.04 · **병렬 후보:** W05 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [09-ui-and-recovery.md](../specs/09-ui-and-recovery.md)
- **변경 대상(개발 저장소 기준):** `apps/web/src/layout/`, `apps/web/src/routes/`, `apps/web/src/api/replay.ts`
- **구현·산출 범위:** 패널 조절, 탭, 연결·저장 상태, 개발용 표시를 가상 데이터로 확인
- **검증:** 좁은 창·패널 조절·replay 배지·공통 상태 표시
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F01~F08 / PRD §7 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T08.03 과제 목록·설정·시작 화면 실연결

- **현재 상태:** 미착수
- **선행:** T08.02, T04.02, T05.02 · **병렬 후보:** W11 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [09-ui-and-recovery.md](../specs/09-ui-and-recovery.md)
- **변경 대상(개발 저장소 기준):** `apps/web/src/features/scenarios/`, `apps/web/src/features/setup/`
- **구현·산출 범위:** 준비 실패와 실제 연결 성공을 구분하며 준비 전 시간 시작 없음
- **검증:** 잘못된 경로·미로그인·실추론 실패·prepare 실패가 시작을 막음
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F01, F02 / A01, A02
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T08.04 담당자·코딩 도우미 대화 UI

- **현재 상태:** 미착수
- **선행:** T08.02, T06.03, T06.04, T02.05, T03.05 · **병렬 후보:** W12 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [09-ui-and-recovery.md](../specs/09-ui-and-recovery.md)
- **변경 대상(개발 저장소 기준):** `apps/web/src/features/chat/`, `apps/web/src/features/approvals/`
- **구현·산출 범위:** 상대 구분, 입력 초안 보존, 스트리밍, 공유, 승인, 대기·취소·중단 표시
- **검증:** 한글 IME·역할별 draft·delta 중복·늦은 승인·대기 순서·명시적 공유
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F03, F04 / A05, A10
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T08.05 파일 편집기 UI

- **현재 상태:** 미착수
- **선행:** T08.02, T07.03 · **병렬 후보:** W09 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [09-ui-and-recovery.md](../specs/09-ui-and-recovery.md)
- **변경 대상(개발 저장소 기준):** `apps/web/src/features/editor/`, `apps/web/src/features/file-tree/`
- **구현·산출 범위:** 파일 탐색·저장 상태·변경 비교·충돌 해결. 새로고침 전 미저장 내용 안내
- **검증:** 파일 충돌 diff·내 내용 보존·실패 저장을 저장됨으로 표시하지 않음
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F05 / A07
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T08.06 터미널·미리보기 UI

- **현재 상태:** 미착수
- **선행:** T08.02, T07.04, T07.05 · **병렬 후보:** W10 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [09-ui-and-recovery.md](../specs/09-ui-and-recovery.md)
- **변경 대상(개발 저장소 기준):** `apps/web/src/features/terminal/`, `apps/web/src/features/preview/`
- **구현·산출 범위:** 명령 실행/중단/출력, 서버 시작·오류·미리보기 갱신과 분리된 출처 확인
- **검증:** PTY disconnect·preview start 실패·등록 포트만 열기
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F06, F07 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T08.07 타이머·모드·복구 화면

- **현재 상태:** 미착수
- **선행:** T08.03, T04.03, T04.05 · **병렬 후보:** W12 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [09-ui-and-recovery.md](../specs/09-ui-and-recovery.md)
- **변경 대상(개발 저장소 기준):** `apps/web/src/features/attempt-status/`, `apps/web/src/features/recovery/`
- **구현·산출 범위:** 서버 시각 기준 표시, 조건 변경 배지, 연결 복구 중 잘못된 완료 표시 방지
- **검증:** 새로고침·절전·expired deadline·서버 복구 / timer가 초기화되지 않음
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F08 / A08
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T08.08 제출·사후 질문 UI

- **현재 상태:** 미착수
- **선행:** T08.02, T09.04, T11.03 · **병렬 후보:** W17 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [09-ui-and-recovery.md](../specs/09-ui-and-recovery.md)
- **변경 대상(개발 저장소 기준):** `apps/web/src/features/submission/`, `apps/web/src/features/interview/`
- **구현·산출 범위:** 고정 제출본과 검사 상태 표시, 답변 임시 저장·미응답·확정, 코딩 도우미 잠금
- **검증:** 미저장 상태 제출·deadline 무확인 마감·skipped 답변·도움 차단
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F11 / A16
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T08.09 전체 화면 접근성과 사용성 확인

- **현재 상태:** 미착수
- **선행:** T08.04, T08.05, T08.06, T08.07, T08.08 · **병렬 후보:** W18 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [09-ui-and-recovery.md](../specs/09-ui-and-recovery.md)
- **변경 대상(개발 저장소 기준):** `tests/e2e/workbench-usability.spec.ts`, `docs/evidence/ui-review.md`
- **구현·산출 범위:** 키보드 이동, 좁은 창, 긴 출력, 역할 혼동, 오류 후 다음 행동을 실제 화면에서 확인
- **검증:** 키보드만으로 주요 흐름 완료·긴 텍스트·오류에서 복구 동작 확인
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F01~F08 / PRD §7 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

<a id="t09"></a>

## T09 — 마감과 제출본 고정

우선순위: P0 · 작업 흐름: 플랫폼

### T09.01 제출 프로토콜 상세 Spec

- **현재 상태:** 스펙 본문·계약 작성됨. 선행 런타임 검증과 프로젝트 반영·확정이 필요.
- **선행:** T01.05, T07.01 · **병렬 후보:** W07 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [06-submission.md](../specs/06-submission.md)
- **변경 대상(개발 저장소 기준):** `docs/specs/06-submission.md`, `packages/contracts/src/submission.ts`
- **구현·산출 범위:** 중복 제출, 마감 접수 경계, 중단 대기, 마감 후 변경, 복사 실패·재시도·해시 규칙 정의
- **검증:** 마감과 sealed 시각·제외 파일·복구 phase·immutable 경계 검토
- **완료 증거:** 스펙·계약 변경 또는 현재 기준의 검토 기록 · 필요한 runtime gate 또는 호환성 검증 결과
- **PRD 연결:** F10 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T09.02 마감 상태 전이와 쓰기 작업 정지

- **현재 상태:** 미착수
- **선행:** T09.01, T04.04, T07.07, T03.03 · **병렬 후보:** W12 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [06-submission.md](../specs/06-submission.md)
- **변경 대상(개발 저장소 기준):** `apps/server/src/modules/submissions/seal.ts`, `apps/server/src/modules/submissions/mutation-barrier.ts`
- **구현·산출 범위:** 버튼·타임아웃 경합에도 한 번만 마감. 모든 관리 쓰기 채널과 중단 상태를 확인
- **검증:** 더블 클릭/타이머 경합·queued 요청 취소·모든 쓰기 채널 차단
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F10 / A11
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T09.03 파일·이벤트 범위 고정과 해시

- **현재 상태:** 미착수
- **선행:** T09.02, T02.04 · **병렬 후보:** W13 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [06-submission.md](../specs/06-submission.md)
- **변경 대상(개발 저장소 기준):** `apps/server/src/modules/submissions/snapshot.ts`, `apps/server/src/modules/submissions/manifest.ts`
- **구현·산출 범위:** 파일·마감 시각·고정 시각·마감 후 변경·이벤트 순번을 묶어 제출본 생성
- **검증:** copy 중 변경·file cap·symlink·hash 정렬·cutoff 이후 변경 기록
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F10 / A13
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T09.04 제출 실패 복구와 조회 API

- **현재 상태:** 미착수
- **선행:** T09.03, T02.06 · **병렬 후보:** W14 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [06-submission.md](../specs/06-submission.md)
- **변경 대상(개발 저장소 기준):** `apps/server/src/modules/submissions/recovery.ts`, `apps/server/src/modules/submissions/routes.ts`
- **구현·산출 범위:** 고정 실패 시 평가 금지, 원본 보존·재시도, 중복 클릭에 같은 제출 결과 반환
- **검증:** rename 후 crash·commit 후 응답 유실·같은 제출 ID 재반환
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F10 / A11
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T09.05 제출 경합·불변성 검증

- **현재 상태:** 미착수
- **선행:** T09.04, T04.03 · **병렬 후보:** W15 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [06-submission.md](../specs/06-submission.md)
- **변경 대상(개발 저장소 기준):** `tests/integration/submission-races.spec.ts`, `tests/integration/submission-immutability.spec.ts`
- **구현·산출 범위:** 시간 만료/저장/명령/중복 클릭/외부 변경 사례 확인. 제출 뒤 편집해도 기존 근거 불변
- **검증:** SUB-01~SUB-08과 snapshot hash 불변을 통합 확인
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F10 / A11, A12, A13
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

<a id="t10"></a>

## T10 — 검증 실행과 근거 수집

우선순위: P0 · 작업 흐름: 검증 실행

### T10.01 검증 실행·근거 Spec

- **현재 상태:** 스펙 본문·계약 작성됨. 선행 런타임 검증과 프로젝트 반영·확정이 필요.
- **선행:** T01.05, T05.01 · **병렬 후보:** W06 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [07-validation-evidence.md](../specs/07-validation-evidence.md)
- **변경 대상(개발 저장소 기준):** `docs/specs/07-validation-evidence.md`, `packages/contracts/src/evidence.ts`
- **구현·산출 범위:** 제출본 복사, 검사 버전, 결과·실패·시간 초과, 사용자 확인과 자동 검증 구분
- **검증:** 검사 상태·환경 오류·사용자 확인·모델 주장 분리와 locator 계약 검토
- **완료 증거:** 스펙·계약 변경 또는 현재 기준의 검토 기록 · 필요한 runtime gate 또는 호환성 검증 결과
- **PRD 연결:** F12 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T10.02 별도 복사본에서 검사 실행

- **현재 상태:** 미착수
- **선행:** T10.01, T09.03, T07.06 · **병렬 후보:** W14 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [07-validation-evidence.md](../specs/07-validation-evidence.md)
- **변경 대상(개발 저장소 기준):** `apps/server/src/modules/validation/runner.ts`, `apps/server/src/modules/validation/copy.ts`
- **구현·산출 범위:** 고정 제출본을 수정하지 않고 명령 실행·시간 초과·종료 코드 수집
- **검증:** 검증용 복사본·timeout·exit code·원본 제출본 변경 여부
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F12 / A06, A13, A14
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T10.03 브라우저 검증·화면 근거

- **현재 상태:** 미착수
- **선행:** T10.02, T07.05 · **병렬 후보:** W15 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [07-validation-evidence.md](../specs/07-validation-evidence.md)
- **변경 대상(개발 저장소 기준):** `apps/server/src/modules/validation/browser.ts`, `apps/server/src/modules/validation/captures.ts`
- **구현·산출 범위:** 제출 앱 실행 상태 확인, 사용자 흐름·캡처·검증 환경 기록
- **검증:** 실제 화면을 캡처하고 실패 흐름 재현 / 사람 확인을 자동 실행으로 표시하지 않음
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F12 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T10.04 근거 목록과 제출본 위치 연결

- **현재 상태:** 미착수
- **선행:** T10.02, T02.04 · **병렬 후보:** W15 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [07-validation-evidence.md](../specs/07-validation-evidence.md)
- **변경 대상(개발 저장소 기준):** `apps/server/src/modules/evidence/repository.ts`, `apps/server/src/modules/evidence/resolver.ts`
- **구현·산출 범위:** 검사 ID·파일 해시·줄 번호·출처 연결, 실패를 통과로 기록하지 않음
- **검증:** 없는 파일·잘못된 줄·다른 제출 ID·redaction·truncation 검사
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F09, F12 / A14
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T10.05 과제별 검사와 변경된 테스트 구분

- **현재 상태:** 미착수
- **선행:** T10.03, T10.04, T05.07, T05.08 · **병렬 후보:** W16 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [07-validation-evidence.md](../specs/07-validation-evidence.md)
- **변경 대상(개발 저장소 기준):** `scenarios/*/private/validation.json`, `tests/integration/scenario-validation.spec.ts`
- **구현·산출 범위:** 사용자 수정 테스트와 고정 검사를 구분. 두 과제의 실제 요구 충족 증거 확보
- **검증:** 서로 다른 유효 구현·수정된 테스트·응대 정성 사례·동시 예약 실제 결과
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F12 / A14
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

<a id="t11"></a>

## T11 — 사후 질문과 근거 기반 평가

우선순위: P0 · 작업 흐름: 평가

### T11.01 질문·판정·점수·근거 상세 Spec

- **현재 상태:** 스펙 본문·계약 작성됨. 선행 런타임 검증과 프로젝트 반영·확정이 필요.
- **선행:** T01.05 · **병렬 후보:** W06 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [08-evaluation.md](../specs/08-evaluation.md), [04-role-context.md](../specs/04-role-context.md)
- **변경 대상(개발 저장소 기준):** `docs/specs/08-evaluation.md`, `packages/contracts/src/evaluation.ts`
- **구현·산출 범위:** 평가 스키마, 3~5개 질문, 미평가, 점수 산식, 근거 검증, 보완 1회, 결과 버전 정의
- **검증:** 12개 기준·미평가·질문3~5개·보완1회·계산식·결과 버전 계약 확인
- **완료 증거:** 스펙·계약 변경 또는 현재 기준의 검토 기록 · 필요한 runtime gate 또는 호환성 검증 결과
- **PRD 연결:** F11 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T11.02 제출·기록 기반 평가 입력 구성

- **현재 상태:** 미착수
- **선행:** T11.01, T09.03, T02.04, T06.02 · **병렬 후보:** W14 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [08-evaluation.md](../specs/08-evaluation.md), [04-role-context.md](../specs/04-role-context.md)
- **변경 대상(개발 저장소 기준):** `apps/server/src/modules/evaluation/context.ts`, `apps/server/src/modules/evaluation/selection.ts`
- **구현·산출 범위:** 고정 제출본만 사용하고 사용자/AI 출처를 보존. 큰 기록의 선택 기준과 제외·누락 구간 표시
- **검증:** live workspace 대신 snapshot·출처 구분·context budget 초과의 제외 구간 기록
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F11 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T11.03 사후 질문 생성·답변 저장

- **현재 상태:** 미착수
- **선행:** T11.02, T10.04, T03.03, T04.04 · **병렬 후보:** W16 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [08-evaluation.md](../specs/08-evaluation.md), [04-role-context.md](../specs/04-role-context.md)
- **변경 대상(개발 저장소 기준):** `apps/server/src/modules/interview/`, `apps/server/src/modules/evaluation/interview-prompt.ts`
- **구현·산출 범위:** 실제 근거에 연결된 질문, 답변 임시 저장·확정·건너뛰기, 시험 모드 도움 차단
- **검증:** 없는 기능 전제 질문·답변 draft/skipped·확정 이후 수정·AI 도움 차단
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F11 / A16
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T11.04 평가 실행과 항목별 판정

- **현재 상태:** 미착수
- **선행:** T11.03, T05.08, T03.03 · **병렬 후보:** W17 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [08-evaluation.md](../specs/08-evaluation.md), [04-role-context.md](../specs/04-role-context.md)
- **변경 대상(개발 저장소 기준):** `apps/server/src/modules/evaluation/runner.ts`, `apps/server/src/modules/evaluation/prompts/`
- **구현·산출 범위:** 기술·의도·인지 항목별 근거/해석/미평가를 구조화. 실패와 중단을 성공으로 처리하지 않음
- **검증:** 실패와 근거 부족 구분·특정 설계 강제 없음·사용자/AI 기여 구분
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F12 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T11.05 평가 응답·근거 검증 및 재평가

- **현재 상태:** 미착수
- **선행:** T11.04, T10.04 · **병렬 후보:** W18 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [08-evaluation.md](../specs/08-evaluation.md), [04-role-context.md](../specs/04-role-context.md)
- **변경 대상(개발 저장소 기준):** `apps/server/src/modules/evaluation/validate.ts`, `apps/server/src/modules/evaluation/retry.ts`
- **구현·산출 범위:** 허구 ID·잘못된 줄·스키마 위반을 검출. 최대 1회 보완 후 오류 처리, 재평가 버전 분리. 제출 파일의 평가 지시를 실행하지 않는 사례 검증
- **검증:** 허구 ID·줄 번호·만점 지시·보완2회 이상 요청·재평가 덮어쓰기 차단
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F12 / A15, A17
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T11.06 점수·평가 가능 범위 계산

- **현재 상태:** 미착수
- **선행:** T11.01 · **병렬 후보:** W07 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [08-evaluation.md](../specs/08-evaluation.md), [04-role-context.md](../specs/04-role-context.md)
- **변경 대상(개발 저장소 기준):** `apps/server/src/modules/evaluation/scoring.ts`, `tests/unit/scoring.spec.ts`
- **구현·산출 범위:** 서버에서 산식 계산. 미평가를 0점으로 바꾸지 않고 총점 생성을 막는 경계 사례 확인
- **검증:** 전부3점=225·미평가1개면 total null·0점과 unknown·반올림 전 총합
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F12 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T11.07 평가 기준 사례와 편향·변동 검토

- **현재 상태:** 미착수
- **선행:** T11.05, T11.06, T05.08, T10.05 · **병렬 후보:** W19 · **실제 Codex 필요:** 예
- **읽을 Spec:** [08-evaluation.md](../specs/08-evaluation.md), [04-role-context.md](../specs/04-role-context.md)
- **변경 대상(개발 저장소 기준):** `tools/evaluation/calibrate.ts`, `tests/live/evaluation-calibration.spec.ts`, `docs/evidence/calibration/`
- **구현·산출 범위:** 강한/부분/실패/근거 부족 수행 구분, 허위 주장·질문 수·토큰 수의 부당 가산 여부와 반복 변동 확인
- **검증:** CAL-01~CAL-08 반복 평가 / 잘못된 근거율·변동·질문 수 편향 기록
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F12 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

<a id="t12"></a>

## T12 — 리포트·재연습·내보내기

우선순위: P0 · 작업 흐름: UI·제품

### T12.01 리포트·근거 탐색 UI

- **현재 상태:** 미착수
- **선행:** T08.02, T11.05, T11.06 · **병렬 후보:** W19 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [08-evaluation.md](../specs/08-evaluation.md), [09-ui-and-recovery.md](../specs/09-ui-and-recovery.md)
- **변경 대상(개발 저장소 기준):** `apps/web/src/features/report/`, `apps/web/src/features/evidence/`
- **구현·산출 범위:** 실제 결과와 평가 해석 구분, 근거 클릭 이동, 미평가·비공식·조건 변경 표시
- **검증:** 점수보다 근거 먼저·제출본 위치 이동·조건·미평가 배지
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F12 / A17
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T12.02 Markdown·JSON·제출 파일 내보내기

- **현재 상태:** 미착수
- **선행:** T11.05, T11.06, T09.03, T02.04 · **병렬 후보:** W19 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [08-evaluation.md](../specs/08-evaluation.md), [09-ui-and-recovery.md](../specs/09-ui-and-recovery.md)
- **변경 대상(개발 저장소 기준):** `apps/server/src/modules/exports/`, `apps/server/src/modules/evaluation/report-dto.ts`
- **구현·산출 범위:** 판정·근거·버전·미확인 사항 포함, 비공개 과제·인증정보 제외
- **검증:** ZIP 경로 안전·private·credential 제외·로컬 절대 경로 제거
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F14 / A20
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T12.03 시도 목록·새 시도·이어 연습 UI

- **현재 상태:** 미착수
- **선행:** T12.01, T04.06 · **병렬 후보:** W20 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [08-evaluation.md](../specs/08-evaluation.md), [09-ui-and-recovery.md](../specs/09-ui-and-recovery.md)
- **변경 대상(개발 저장소 기준):** `apps/web/src/features/history/`, `apps/web/src/features/retry/`
- **구현·산출 범위:** 이전 결과 유지, 사전 노출·이어 연습 표시, 삭제 대상 확인
- **검증:** 이어 연습 사전 노출 표시·이전 결과 불변·삭제 대상 앱 소유만
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F14 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T12.04 리포트 및 내보내기 일치 검증

- **현재 상태:** 미착수
- **선행:** T12.01, T12.02, T12.03 · **병렬 후보:** W21 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [08-evaluation.md](../specs/08-evaluation.md), [09-ui-and-recovery.md](../specs/09-ui-and-recovery.md)
- **변경 대상(개발 저장소 기준):** `tests/integration/export-parity.spec.ts`, `tests/e2e/report-evidence.spec.ts`
- **구현·산출 범위:** 화면과 파일의 점수·근거가 같고 이전 제출본의 링크가 최신 파일로 바뀌지 않음
- **검증:** UI/Markdown/JSON의 같은 version·점수·evidence 참조 일치
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F14 / A20
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

<a id="t13"></a>

## T13 — 개발 모드·진단·실패 재현

우선순위: P0 · 작업 흐름: 개발 도구

### T13.01 개발 모드와 변경·노출 기록

- **현재 상태:** 미착수
- **선행:** T04.01, T02.03, T02.04 · **병렬 후보:** W08 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [09-ui-and-recovery.md](../specs/09-ui-and-recovery.md), [02-codex-adapter.md](../specs/02-codex-adapter.md)
- **변경 대상(개발 저장소 기준):** `apps/server/src/modules/developer/conditions.ts`, `apps/server/src/modules/developer/routes.ts`
- **구현·산출 범위:** 시간·설정 변경 및 비공개 자료 열기를 기록하고 일반 시험으로 세탁되지 않음
- **검증:** developer 자료 열기·시간 변경의 조건 플래그 영구 보존
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F13 / A18
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T13.02 재생 어댑터와 실패 입력 주입

- **현재 상태:** 미착수
- **선행:** T01.04, T02.01 · **병렬 후보:** W05 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [09-ui-and-recovery.md](../specs/09-ui-and-recovery.md), [02-codex-adapter.md](../specs/02-codex-adapter.md)
- **변경 대상(개발 저장소 기준):** `packages/codex-adapter/src/replay.ts`, `tests/fixtures/runtime/`
- **구현·산출 범위:** 스트리밍·중단·인증 실패·연결 단절·평가 오류를 재현. 가상 실행 배지 필수
- **검증:** replay가 live 진단 성공으로 보이지 않음 / 실패 종류별 fixture
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F13 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T13.03 역할·실행·사실·사용량 진단 UI

- **현재 상태:** 미착수
- **선행:** T08.02, T06.03, T03.05, T13.01 · **병렬 후보:** W11 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [09-ui-and-recovery.md](../specs/09-ui-and-recovery.md), [02-codex-adapter.md](../specs/02-codex-adapter.md)
- **변경 대상(개발 저장소 기준):** `apps/web/src/features/developer/`, `apps/server/src/modules/developer/diagnostics.ts`
- **구현·산출 범위:** fact ID·프롬프트 버전·역할별 호출·오류·제공된 사용량 확인. 비밀값은 가림
- **검증:** private 진단 권한·token 가림·역할별 사용량 unknown 표시
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F09, F13 / A18
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T13.04 저장 실패·복구·중복 이벤트 재현

- **현재 상태:** 미착수
- **선행:** T13.02, T02.06, T03.04, T09.04 · **병렬 후보:** W15 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [09-ui-and-recovery.md](../specs/09-ui-and-recovery.md), [02-codex-adapter.md](../specs/02-codex-adapter.md)
- **변경 대상(개발 저장소 기준):** `tools/fault-injection/`, `tests/integration/recovery-faults.spec.ts`
- **구현·산출 범위:** 중간 종료·재접속·중복 수신·제출 실패를 재현할 수 있는 점검 절차 확보
- **검증:** 서버/DB/파일/stream 중간 실패를 다시 실행해 같은 오류 상태 재현
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F13 / A09
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T13.05 라이브·재생 모드 교차 확인

- **현재 상태:** 미착수
- **선행:** T13.03, T13.04, T03.06 · **병렬 후보:** W16 · **실제 Codex 필요:** 예
- **읽을 Spec:** [09-ui-and-recovery.md](../specs/09-ui-and-recovery.md), [02-codex-adapter.md](../specs/02-codex-adapter.md)
- **변경 대상(개발 저장소 기준):** `tests/integration/replay-live-contract.spec.ts`, `docs/evidence/runtime-modes.md`
- **구현·산출 범위:** 같은 UI 계약을 사용하되 재생 통과가 실제 연결 성공으로 표시되지 않음
- **검증:** 동일 계약 fixture와 실제 결과의 UI 상태 일치 / 실제 연결 성공은 별도 근거
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F13 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

<a id="t14"></a>

## T14 — 통합 검증·MVP 릴리스

우선순위: P0 · 작업 흐름: 통합·QA

### T14.01 고객 응대 과제 첫 전체 실연결

- **현재 상태:** 미착수
- **선행:** T08.08, T12.01, T05.04, T06.05, T10.03, T03.06, T08.04, T08.05, T08.06, T08.07, T06.06 · **병렬 후보:** W20 · **실제 Codex 필요:** 예
- **읽을 Spec:** [01-platform.md](../specs/01-platform.md), [09-ui-and-recovery.md](../specs/09-ui-and-recovery.md)
- **변경 대상(개발 저장소 기준):** `tests/e2e/retail-live-journey.spec.ts`, `docs/evidence/retail-first-journey/`
- **구현·산출 범위:** 실제 Codex로 질문·구현·검증·제출·질의응답·리포트 완료. 발견된 결함을 원래 태스크로 환류
- **검증:** 첫 고객 응대 전체 사이클을 실제 Codex로 수행 / 작성·실행·판정 근거 보존
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F01~F14 / A01~A22 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T14.02 예약 과제 전체 실연결

- **현재 상태:** 미착수
- **선행:** T14.01, T05.07, T10.05 · **병렬 후보:** W21 · **실제 Codex 필요:** 예
- **읽을 Spec:** [01-platform.md](../specs/01-platform.md), [09-ui-and-recovery.md](../specs/09-ui-and-recovery.md)
- **변경 대상(개발 저장소 기준):** `tests/e2e/booking-live-journey.spec.ts`, `docs/evidence/booking-journey/`
- **구현·산출 범위:** DB 준비부터 예약 과제의 별도 폴더·대화·기준 적용까지 완료
- **검증:** 예약 준비부터 종료까지 실행 / 과제별 사실·검증·대화 분리
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F01~F14 / A01~A22 / A21
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T14.03 수용 테스트 22개와 접근 경계 점검

- **현재 상태:** 미착수
- **선행:** T14.02, T06.06, T09.05, T11.07, T12.04, T13.05, T08.09 · **병렬 후보:** W22 · **실제 Codex 필요:** 예
- **읽을 Spec:** [01-platform.md](../specs/01-platform.md), [09-ui-and-recovery.md](../specs/09-ui-and-recovery.md)
- **변경 대상(개발 저장소 기준):** `tests/e2e/acceptance.spec.ts`, `docs/evidence/acceptance-matrix.json`
- **구현·산출 범위:** A01~A22 실제 결과와 근거 연결. 정보 노출·제출 정합성·허위 성공 판정 미해결 없이 완료
- **검증:** A01~A22 모두 결과/증거/버전 연결 / 중요 경계 실패가 남으면 릴리스 금지
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F01~F14 / A01~A22 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T14.04 설치·실행·복구·정리 안내

- **현재 상태:** 미착수
- **선행:** T14.01, T13.05, T04.06 · **병렬 후보:** W21 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [01-platform.md](../specs/01-platform.md), [09-ui-and-recovery.md](../specs/09-ui-and-recovery.md)
- **변경 대상(개발 저장소 기준):** `README.md`, `docs/runbooks/local-development.md`, `docs/runbooks/recovery.md`
- **구현·산출 범위:** 깨끗한 폴더에서 실행, Codex 인증 안내, 두 과제 준비, 장애 복구, 생성 파일 범위 문서화
- **검증:** 새 폴더에서 문서만 보고 실행·복구·삭제 / 다른 사용자 설정 보존
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F01~F14 / A01~A22 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

### T14.05 MVP 릴리스 검토와 버전 고정

- **현재 상태:** 미착수
- **선행:** T14.03, T14.04 · **병렬 후보:** W23 · **실제 Codex 필요:** 예
- **읽을 Spec:** [01-platform.md](../specs/01-platform.md), [09-ui-and-recovery.md](../specs/09-ui-and-recovery.md)
- **변경 대상(개발 저장소 기준):** `CHANGELOG.md`, `docs/releases/0.1.0.md`, `docs/evidence/release-gate.json`
- **구현·산출 범위:** 모든 P0 태스크와 F01~F14 충족 확인. 라이브 검증 근거·호환 버전·알려진 한계 포함
- **검증:** 모든 P0 완료·G-RUNTIME 통과·실연결 증거·known limitations 검토
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F01~F14 / A01~A22 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** 다른 역할·모듈의 계약을 합의 없이 변경하지 않음

<a id="t15"></a>

## T15 — MVP 이후 확장

우선순위: P1 · 작업 흐름: 확장

### T15.01 과제 제작 UI Spec

- **현재 상태:** 미착수
- **선행:** T14.05 · **병렬 후보:** W24 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [03-scenario-package.md](../specs/03-scenario-package.md), [08-evaluation.md](../specs/08-evaluation.md), [04-role-context.md](../specs/04-role-context.md)
- **변경 대상(개발 저장소 기준):** `docs/specs/scenario-authoring.md`
- **구현·산출 범위:** 공개/비공개 편집, 미리보기, 검증, 새 버전 배포와 기존 시도 보호 정의
- **검증:** 편집/미리보기/버전/공개 범위 계약과 기존 시도 보호
- **완료 증거:** 스펙·계약 변경 또는 현재 기준의 검토 기록 · 필요한 runtime gate 또는 호환성 검증 결과
- **PRD 연결:** F15 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** P0 범위 변경과 공식 점수 재현은 제외

### T15.02 과제 제작 UI 구현·검증

- **현재 상태:** 미착수
- **선행:** T15.01 · **병렬 후보:** W25 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [03-scenario-package.md](../specs/03-scenario-package.md), [08-evaluation.md](../specs/08-evaluation.md), [04-role-context.md](../specs/04-role-context.md)
- **변경 대상(개발 저장소 기준):** `apps/web/src/features/scenario-authoring/`, `apps/server/src/modules/scenario-authoring/`
- **구현·산출 범위:** 코드 수정 없이 과제 제작·검사·버전 생성, 비공개 정보의 공개 전환 실수 방지
- **검증:** private의 public 전환·버전 충돌·유효하지 않은 과제 거절
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F15 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** P0 범위 변경과 공식 점수 재현은 제외

### T15.03 시도 비교 기준 Spec

- **현재 상태:** 미착수
- **선행:** T14.05 · **병렬 후보:** W24 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [03-scenario-package.md](../specs/03-scenario-package.md), [08-evaluation.md](../specs/08-evaluation.md), [04-role-context.md](../specs/04-role-context.md)
- **변경 대상(개발 저장소 기준):** `docs/specs/attempt-comparison.md`
- **구현·산출 범위:** 과제·기준·모델·모드·사전 노출 차이의 비교 가능성과 표시 규칙 정의
- **검증:** 다른 모델·과제·노출 조건을 같은 조건으로 비교하지 않음
- **완료 증거:** 스펙·계약 변경 또는 현재 기준의 검토 기록 · 필요한 runtime gate 또는 호환성 검증 결과
- **PRD 연결:** F16 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** P0 범위 변경과 공식 점수 재현은 제외

### T15.04 시도 비교 UI·내보내기

- **현재 상태:** 미착수
- **선행:** T15.03 · **병렬 후보:** W25 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [03-scenario-package.md](../specs/03-scenario-package.md), [08-evaluation.md](../specs/08-evaluation.md), [04-role-context.md](../specs/04-role-context.md)
- **변경 대상(개발 저장소 기준):** `apps/web/src/features/comparison/`, `apps/server/src/modules/comparison/`
- **구현·산출 범위:** 같은 조건 우선 비교, 조건이 다른 점수의 단순 우열 해석 방지
- **검증:** 비교 결과와 원래 평가 version·근거 보존
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F16 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** P0 범위 변경과 공식 점수 재현은 제외

### T15.05 사용자 스킬·도구 연결 Spec

- **현재 상태:** 미착수
- **선행:** T14.05 · **병렬 후보:** W24 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [03-scenario-package.md](../specs/03-scenario-package.md), [08-evaluation.md](../specs/08-evaluation.md), [04-role-context.md](../specs/04-role-context.md)
- **변경 대상(개발 저장소 기준):** `docs/specs/tool-import.md`
- **구현·산출 범위:** 가져올 범위·권한·설정 기록·해제·역할별 사용 제한 설계
- **검증:** 설정 범위·권한·해제·역할 경계 계약 검토
- **완료 증거:** 스펙·계약 변경 또는 현재 기준의 검토 기록 · 필요한 runtime gate 또는 호환성 검증 결과
- **PRD 연결:** F17 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** P0 범위 변경과 공식 점수 재현은 제외

### T15.06 스킬·도구 가져오기 구현·검증

- **현재 상태:** 미착수
- **선행:** T15.05 · **병렬 후보:** W25 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [03-scenario-package.md](../specs/03-scenario-package.md), [08-evaluation.md](../specs/08-evaluation.md), [04-role-context.md](../specs/04-role-context.md)
- **변경 대상(개발 저장소 기준):** `apps/web/src/features/tool-import/`, `apps/server/src/modules/tool-import/`
- **구현·산출 범위:** 실제 활성 설정과 추가 접근 기록, 역할 정보 경계 유지, 되돌리기 가능
- **검증:** 가져온 도구의 추가 권한 기록·해제·다른 역할 private 접근 방지
- **완료 증거:** 관련 코드와 변경 범위 · 명시한 검증 결과 및 재현 방법 · 필요 시 실행 로그·화면·고정 파일 hash
- **PRD 연결:** F17 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** P0 범위 변경과 공식 점수 재현은 제외

<a id="t16"></a>

## T16 — 원격·다중 사용자 후속 기획

우선순위: 이후 · 작업 흐름: 후속 설계

### T16.01 원격 실행·다중 사용자 별도 Spec

- **현재 상태:** 미착수
- **선행:** T14.05 · **병렬 후보:** W24 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [01-platform.md](../specs/01-platform.md)
- **변경 대상(개발 저장소 기준):** `docs/specs/remote-multiuser.md`
- **구현·산출 범위:** 사용자/테넌트 격리, 인증, 비밀 관리, 원격 실행, 비용·보존·운영 요구 재정의
- **검증:** 테넌트·원격 인증·격리·비용·보존 요구를 새 PRD와 연결
- **완료 증거:** 스펙·계약 변경 또는 현재 기준의 검토 기록 · 필요한 runtime gate 또는 호환성 검증 결과
- **PRD 연결:** F18 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** MVP와 원격 실제 구현은 범위 밖

### T16.02 후속 구현 계획 재분해

- **현재 상태:** 미착수
- **선행:** T16.01 · **병렬 후보:** W25 · **실제 Codex 필요:** 이 태스크 자체는 필수 아님
- **읽을 Spec:** [01-platform.md](../specs/01-platform.md)
- **변경 대상(개발 저장소 기준):** `docs/plans/remote-implementation-tasks.md`
- **구현·산출 범위:** 선택한 호스팅·격리 방식에 근거해 구현·테스트·운영 태스크 작성. 미확정 구현을 MVP에 포함하지 않음
- **검증:** 선택한 인프라에 따라 별도 구현·검증·운영 의존성 분해
- **완료 증거:** 스펙·계약 변경 또는 현재 기준의 검토 기록 · 필요한 runtime gate 또는 호환성 검증 결과
- **PRD 연결:** F18 / 기능 검증 후 T14.03에서 통합 확인
- **범위 제한:** MVP와 원격 실제 구현은 범위 밖
