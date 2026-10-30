> 이 문서는 개발 착수 시점의 명세 사본입니다. 현재 구현·검증 상태는 [저장소 README](../../README.md)와 [구현 원장](../../tasks/IMPLEMENTATION.md)을 확인하세요.

# Work Practice Lab — 개발 스펙·태스크 패키지

작성일: 2026-10-30 · 계약 버전: 0.1.0

Cofa와 유사한 **개인용 업무 수행 연습 환경**을 개발하기 위한 문서 묶음이다. 로컬 Codex를 사용해 담당자 대화·코딩·검증·제출·사후 질문·평가를 연결한다.

**스펙과 개발 계획을 작성하고 계약 일관성을 검증한 상태다. 앱 구현, 실제 Codex 추론, 런타임 권한 검증은 아직 완료하지 않았다.**
기존 98개 태스크 ID를 유지했으며, 각 태스크에 읽을 문서·예상 변경 파일·선행 작업·검증·완료 증거를 연결했다.

## 1. 먼저 읽을 파일

1. [공통 플랫폼 스펙](./specs/01-platform.md)
2. [Codex 연결 스펙](./specs/02-codex-adapter.md)
3. [구현용 작업 카드 98개](./tasks/IMPLEMENTATION.md)
4. [병렬 착수·의존성 계획](./tasks/PARALLEL-PLAN.md)
5. [기계 판독용 태스크 원장](./tasks/tasks.json)

기획 배경은 [원본 PRD 사본](./references/cofa-practice-environment-prd-2026-10-30.md), 이전 분해는 [원본 작업 계획 사본](./references/work-practice-lab-development-tasks-2026-10-30.md)을 참고한다.
[예시 문제와 풀이](./references/cofa-practice-problems-and-walkthroughs-2026-10-30.md)는 제작 참고용이다. 이 풀이를 응시자의 작업 폴더에 복사하지 않는다.

## 2. 스펙 9종

| 문서 | 실제 구현에서 결정한 내용 |
|---|---|
| [S01 플랫폼](./specs/01-platform.md) | 소스 경계, 상태 전이, 타이머, 멱등성, 오류, 로컬 인증, 이벤트·저장 |
| [S02 Codex](./specs/02-codex-adapter.md) | 프로세스·wire 매핑, 역할 프로필, 중단·복원·승인, 큐·사용량 |
| [S03 과제](./specs/03-scenario-package.md) | manifest, public/private 자료, 사실·검증·평가 기준, 두 과제 |
| [S04 역할](./specs/04-role-context.md) | 정보 경계, 사실 공개, 선택적 공유, 평가 입력, 앱용 AI 범위 |
| [S05 작업 공간](./specs/05-workspace.md) | 파일 저장 CAS, 경로 검사, PTY, 프로세스 회수, 미리보기 |
| [S06 제출](./specs/06-submission.md) | 마감 접수, 실행 정리, 고정 복사본, 해시, 실패·재시작 복구 |
| [S07 검증](./specs/07-validation-evidence.md) | 실제 검사, 고정·수정 테스트 구분, 화면·명령 근거, locator |
| [S08 평가](./specs/08-evaluation.md) | 질문·답변, 12항목 판정, 미평가·점수, 근거 검사, 재평가·내보내기 |
| [S09 화면](./specs/09-ui-and-recovery.md) | 라우트, 패널, 메시지·저장·오류 상태, 제출·평가, 개발 모드 |

## 3. 구현 계약과 예제

| 파일 | 용도 |
|---|---|
| [OpenAPI 3.1](./contracts/openapi.json) | 제품 로컬 API 67개 operation. Codex의 공식 API와는 별개 |
| [도메인 JSON Schema](./contracts/domain.schema.json) | 51개 타입 정의와 이벤트 payload. 서버·클라이언트 계약의 원본 |
| [SQLite DDL](./contracts/storage.sql) | 25개 테이블, active attempt 유일성, 제출·완료 평가 불변성 |
| [터미널 메시지 Schema](./contracts/terminal.schema.json) | PTY WebSocket 입력·크기·중단 메시지 |
| [Codex 관찰 기록](./contracts/codex-observation.json) | 설치 버전에서 확인한 필드와 미검증 항목 |
| [Codex 요청 예제](./contracts/codex-requests.json) | 로컬 생성 schema와 대조한 요청. 모델·경로 placeholder는 실행 때 교체 |
| [18개 양성·음성 fixture](./fixtures/contract-cases.json) | 성공·실패·중단·불확실·충돌·미평가·잘못된 입력 |
| [PRD 추적](./tasks/acceptance-map.json) | F01~F18, A01~A22와 태스크 연결 |

OpenAPI의 components.schemas는 domain.schema.json에서 같은 내용을 변환한 것이다. 양쪽이 달라지면 검증 스크립트가 실패한다.
카드에 적힌 apps/, packages/, tests/ 경로는 **앞으로 만들 개발 저장소의 경로**다. 이 문서 패키지에 실행 가능한 앱이 이미 있다는 뜻이 아니다.

## 4. 지금 시작하는 순서

현재 병렬 착수 후보:
- **T00.01:** 호스트·인증·버전 진단 → 실제 연결/권한 검증.
- **T02.01:** 새 개발 저장소와 UI·서버·계약 패키지 구성.
- **T08.01:** 작성된 화면 스펙을 라우트·화면 설계에 적용.

T01.01/T01.02의 문서 정의는 완료했다. 나머지 기능별 스펙도 본문이 준비돼 있다.
T01.05의 최종 공통 계약 확정은 G-RUNTIME의 결과를 반영한 후 진행한다.
G-RUNTIME 전에는 계약·fixture 기반 개발을 할 수 있지만 **실제 Codex 연결이나 역할 제한이 검증됐다고 표시할 수 없다.**

권장 코드 저장소 구조는 S01을 따른다. 이 패키지를 새 저장소의 docs/specification/으로 복사하고 contracts를 packages/contracts로 가져오되, 이후에는 한 쪽을 원본으로 지정해 중복 변경을 방지한다.
원본 동기화 프로젝트의 sources/는 개발 대상으로 사용하지 않는다.

## 5. 개발 실행 규칙

- 공개·비공개 과제 자료와 app 제어 API를 먼저 분리한다.
- 역할/사용자/시스템의 출처를 이벤트에 남긴다.
- 화면은 서버 상태를 표시하고 독자적으로 제출·평가 완료를 결정하지 않는다.
- 모델의 “테스트 통과” 발언을 실제 실행 결과로 기록하지 않는다.
- 제출본은 live 파일과 분리하며 이후 검사와 재평가는 같은 고정본을 사용한다.
- 모든 항목이 평가되지 않으면 전체 점수를 만들지 않는다.
- 공통 타입·마이그레이션·루트 설정 파일은 담당자를 정해 합쳐 반영한다.
- 실험적 Codex 필드가 존재한다는 것만으로 기능이 보장된다고 판단하지 않는다.

## 6. 문서·계약 검증 결과

[검증 보고서](./reports/validation.json)에 실제 실행한 결과를 기록했다.

확인한 것:
- JSON Schema와 18개 양성·음성 fixture.
- OpenAPI 3.1 구조와 schema 동기화.
- SQLite DDL 실행 및 활성 시도 중복·상태 enum·제출/평가 불변성 제약.
- 98개 태스크의 참조·순환·병렬 묶음·MVP의 90개 P0 포괄.
- F01~F18 및 A01~A22 추적.
- 설치 Codex 0.163.0에서 생성한 experimental 요청 schema와 7개 wire 요청 예제의 일치.
- 스펙 문서의 로컬 링크와 점수 예제.

**확인하지 않은 것:** 제품 코드의 작동, 실제 모델 요청, 역할별 읽기·도구 권한 차단, 중단·복원, 실제 두 과제 응시. 이 항목들은 구현 카드의 라이브 검증 태스크로 남아 있다.

## 7. 검증을 다시 실행하는 방법

이 패키지 루트에서 실행한다. 임시 가상 환경에 문서 검증 의존성만 설치한다.

~~~bash
python3 -m venv /tmp/wpl-spec-check
/tmp/wpl-spec-check/bin/python -m pip install -r tools/requirements.txt
/tmp/wpl-spec-check/bin/python tools/validate_spec.py
~~~

설치된 Codex 요청 형식까지 다시 대조하려면:

~~~bash
codex app-server generate-json-schema --experimental --out /tmp/wpl-codex-protocol
/tmp/wpl-spec-check/bin/python tools/validate_spec.py --codex-schema /tmp/wpl-codex-protocol/ClientRequest.json --report reports/validation-local.json
~~~

이 검증은 모델에 요청하지 않는다. Codex 실연결 검증은 이후 별도 작업이다.
의존성 버전은 [requirements.txt](./tools/requirements.txt)에 고정했다.

## 8. 완료 상태와 문서 변경

본 패키지는 구현 기준 v0.1.0이다. 확인하지 못한 런타임 capability는 구현 게이트로 명시했다.
PRD의 범위를 바꾸지 않고 구체적인 기본값을 정했다. 예: localhost origin, API 경로, 파일 크기·timeout, 상태 이름, 오류 코드.
이 기본값을 변경하면 관련 Spec, schema, fixture, task dependency와 검증 보고서를 함께 갱신한다.
P1(과제 제작 UI·비교·도구 가져오기)와 원격 다중 사용자 범위는 태스크에 보존하되 이번 MVP 스펙에 상세 구현을 억지로 포함하지 않았다.
