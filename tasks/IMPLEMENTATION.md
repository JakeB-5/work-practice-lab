> 2026-10-30 수정 검증: 재개방 14개 중 13개 완료, T14.05는 검토 범위를 제한합니다. 전체 98개를 이번에 개별 재감사한 것은 아닙니다. [결과보고서](../docs/evidence/remediation-report.md)를 확인하세요.

# 구현 태스크 원장

P0 90개, P1 6개, 후속 설계 2개. 원본 태스크 ID를 유지했다. 각 행의 증거에는 구현 코드와 재현 가능한 검사 또는 실연결 결과가 있다.

| 태스크 | 산출물 | 상태 | 핵심 증거 |
|---|---|---|---|
| T00.01 | 호스트·인증·버전 진단 | 완료 | [runtime-lifecycle.json](../docs/evidence/runtime-lifecycle.json), [live-journeys.json](../docs/evidence/live-journeys.json) |
| T00.02 | 독립 App Server 최소 연결 | 완료 | [runtime-lifecycle.json](../docs/evidence/runtime-lifecycle.json), [live-journeys.json](../docs/evidence/live-journeys.json) |
| T00.03 | 대화·중단·재시작 복구 실험 | 완료 | [runtime-lifecycle.json](../docs/evidence/runtime-lifecycle.json), [live-journeys.json](../docs/evidence/live-journeys.json) |
| T00.04 | 역할별 도구·파일·설정 상속 검증 | 완료 | [runtime-lifecycle.json](../docs/evidence/runtime-lifecycle.json), [live-journeys.json](../docs/evidence/live-journeys.json) |
| T00.05 | 프로토콜·승인·사용량 이벤트 조사 | 완료 | [runtime-lifecycle.json](../docs/evidence/runtime-lifecycle.json), [live-journeys.json](../docs/evidence/live-journeys.json) |
| T00.06 | 연결 방식 결정 및 검증 게이트 | 완료 | [runtime-lifecycle.json](../docs/evidence/runtime-lifecycle.json), [live-journeys.json](../docs/evidence/live-journeys.json) |
| T01.01 | 공통 용어·ID·역할·책임 Spec 초안 | 완료 | [implementation-boundaries.md](../docs/decisions/implementation-boundaries.md), [journey.test.ts](../tests/integration/journey.test.ts) |
| T01.02 | 세션 상태·시간·제출 규칙 Spec | 완료 | [implementation-boundaries.md](../docs/decisions/implementation-boundaries.md), [journey.test.ts](../tests/integration/journey.test.ts) |
| T01.03 | API·이벤트·데이터 공통 계약 | 완료 | [implementation-boundaries.md](../docs/decisions/implementation-boundaries.md), [journey.test.ts](../tests/integration/journey.test.ts) |
| T01.04 | 계약 예시와 재생용 데이터 | 완료 | [implementation-boundaries.md](../docs/decisions/implementation-boundaries.md), [journey.test.ts](../tests/integration/journey.test.ts) |
| T01.05 | 공통 Spec 검토 및 1차 확정 | 완료 | [implementation-boundaries.md](../docs/decisions/implementation-boundaries.md), [journey.test.ts](../tests/integration/journey.test.ts) |
| T02.01 | 프로젝트·개발 명령·검사 기반 구성 | 완료 | [app.ts](../apps/server/src/app.ts), [safety.test.ts](../tests/integration/safety.test.ts) |
| T02.02 | 메타데이터 저장소·마이그레이션 | 완료 | [app.ts](../apps/server/src/app.ts), [safety.test.ts](../tests/integration/safety.test.ts) |
| T02.03 | 로컬 API 인증·접근 경계 | 완료 | [app.ts](../apps/server/src/app.ts), [safety.test.ts](../tests/integration/safety.test.ts) |
| T02.04 | 이벤트·파일 저장·민감정보 처리 | 완료 | [app.ts](../apps/server/src/app.ts), [safety.test.ts](../tests/integration/safety.test.ts) |
| T02.05 | 스트리밍 전송과 재연결 커서 | 완료 | [app.ts](../apps/server/src/app.ts), [safety.test.ts](../tests/integration/safety.test.ts) |
| T02.06 | 공통 장애·정합성 복구 | 수정·재검증 완료 | [remediation.test.ts](../tests/integration/remediation.test.ts), [remediation-automated-tests.json](../docs/evidence/remediation-automated-tests.json) |
| T03.01 | Codex 어댑터 상세 Spec | 완료 | [runtime-lifecycle.json](../docs/evidence/runtime-lifecycle.json), [live-journeys.json](../docs/evidence/live-journeys.json) |
| T03.02 | 프로세스와 역할별 대화 수명 관리 | 완료 | [runtime-lifecycle.json](../docs/evidence/runtime-lifecycle.json), [live-journeys.json](../docs/evidence/live-journeys.json) |
| T03.03 | 실행·스트리밍·승인·중단 구현 | 완료 | [runtime-lifecycle.json](../docs/evidence/runtime-lifecycle.json), [live-journeys.json](../docs/evidence/live-journeys.json) |
| T03.04 | 오류 분류와 재연결·복원 | 완료 | [runtime-lifecycle.json](../docs/evidence/runtime-lifecycle.json), [live-journeys.json](../docs/evidence/live-journeys.json) |
| T03.05 | 모델 설정·동시 실행 큐·사용량 | 완료 | [runtime-lifecycle.json](../docs/evidence/runtime-lifecycle.json), [live-journeys.json](../docs/evidence/live-journeys.json) |
| T03.06 | 실제 Codex 어댑터 통합 검증 | 완료 | [runtime-lifecycle.json](../docs/evidence/runtime-lifecycle.json), [live-journeys.json](../docs/evidence/live-journeys.json) |
| T04.01 | 시도 상태와 전이 제어 | 완료 | [safety.test.ts](../tests/integration/safety.test.ts), [journey.test.ts](../tests/integration/journey.test.ts) |
| T04.02 | 환경 준비와 시도 시작 | 완료 | [safety.test.ts](../tests/integration/safety.test.ts), [journey.test.ts](../tests/integration/journey.test.ts) |
| T04.03 | 모드별 서버 타이머 | 완료 | [safety.test.ts](../tests/integration/safety.test.ts), [journey.test.ts](../tests/integration/journey.test.ts) |
| T04.04 | 메시지·실행·저장의 상태별 접수 | 완료 | [safety.test.ts](../tests/integration/safety.test.ts), [journey.test.ts](../tests/integration/journey.test.ts) |
| T04.05 | 브라우저·서버 재시작 후 시도 복원 | 완료 | [safety.test.ts](../tests/integration/safety.test.ts), [journey.test.ts](../tests/integration/journey.test.ts) |
| T04.06 | 새 시도·이어 연습·시도 삭제 | 완료 | [safety.test.ts](../tests/integration/safety.test.ts), [journey.test.ts](../tests/integration/journey.test.ts) |
| T05.01 | 과제 패키지 Spec | 완료 | [manifest.json](../scenarios/equipment-booking/manifest.json), [live-journeys.json](../docs/evidence/live-journeys.json) |
| T05.02 | 패키지 검증·로딩·버전 고정 | 완료 | [manifest.json](../scenarios/equipment-booking/manifest.json), [live-journeys.json](../docs/evidence/live-journeys.json) |
| T05.03 | 고객 응대 과제 자료와 담당자 사실 | 완료 | [manifest.json](../scenarios/equipment-booking/manifest.json), [live-journeys.json](../docs/evidence/live-journeys.json) |
| T05.04 | 고객 응대 시작 프로젝트와 앱용 AI 예제 | 완료 | [manifest.json](../scenarios/equipment-booking/manifest.json), [live-journeys.json](../docs/evidence/live-journeys.json) |
| T05.05 | 장비 예약 과제 자료와 담당자 사실 | 완료 | [manifest.json](../scenarios/equipment-booking/manifest.json), [live-journeys.json](../docs/evidence/live-journeys.json) |
| T05.06 | 예약 시작 프로젝트·로그인·DB 준비 | 완료 | [manifest.json](../scenarios/equipment-booking/manifest.json), [live-journeys.json](../docs/evidence/live-journeys.json) |
| T05.07 | 두 과제 패키지 정합성 검사 | 완료 | [manifest.json](../scenarios/equipment-booking/manifest.json), [live-journeys.json](../docs/evidence/live-journeys.json) |
| T05.08 | 과제별 평가 기준과 기준 사례 제작 | 완료 | [manifest.json](../scenarios/equipment-booking/manifest.json), [live-journeys.json](../docs/evidence/live-journeys.json) |
| T06.01 | 역할별 맥락·공유·권한 Spec | 완료 | [live-extensions.json](../docs/evidence/live-extensions.json), [safety.test.ts](../tests/integration/safety.test.ts) |
| T06.02 | 역할별 맥락 구성기 | 완료 | [live-extensions.json](../docs/evidence/live-extensions.json), [safety.test.ts](../tests/integration/safety.test.ts) |
| T06.03 | 담당자 사실 선택과 답변·공개 이력 | 완료 | [live-extensions.json](../docs/evidence/live-extensions.json), [safety.test.ts](../tests/integration/safety.test.ts) |
| T06.04 | 코딩 도우미와 선택적 맥락 공유 | 완료 | [live-extensions.json](../docs/evidence/live-extensions.json), [safety.test.ts](../tests/integration/safety.test.ts) |
| T06.05 | 과제 앱용 AI 연결 | 완료 | [live-extensions.json](../docs/evidence/live-extensions.json), [safety.test.ts](../tests/integration/safety.test.ts) |
| T06.06 | 역할 혼입·정보 노출 검증 | 완료 | [live-extensions.json](../docs/evidence/live-extensions.json), [safety.test.ts](../tests/integration/safety.test.ts) |
| T07.01 | 작업 환경 상세 Spec | 완료 | [safety.test.ts](../tests/integration/safety.test.ts), [browser-result.json](../docs/evidence/browser-result.json) |
| T07.02 | 시도 작업 폴더 생성·접근 범위 | 완료 | [safety.test.ts](../tests/integration/safety.test.ts), [browser-result.json](../docs/evidence/browser-result.json) |
| T07.03 | 파일 탐색·저장·변경 감지·충돌 | 수정·재검증 완료 | [workspace-state.ts](../apps/web/src/workspace-state.ts), [remediation-browser.json](../docs/evidence/remediation-browser.json) |
| T07.04 | PTY 터미널과 프로세스 관리자 | 수정·재검증 완료 | [workspace.ts](../apps/server/src/modules/workspace.ts), [remediation-browser.json](../docs/evidence/remediation-browser.json), [remediation-automated-tests.json](../docs/evidence/remediation-automated-tests.json) |
| T07.05 | 개발 서버·포트·미리보기 격리 | 완료 | [safety.test.ts](../tests/integration/safety.test.ts), [browser-result.json](../docs/evidence/browser-result.json) |
| T07.06 | 작업 중지·프로세스 회수 | 수정·재검증 완료 | [workspace.ts](../apps/server/src/modules/workspace.ts), [live-deadline-race.json](../docs/evidence/live-deadline-race.json) |
| T07.07 | 서버 상태와 파일·명령 접수 연결 | 완료 | [safety.test.ts](../tests/integration/safety.test.ts), [browser-result.json](../docs/evidence/browser-result.json) |
| T08.01 | 화면 흐름·패널·상태 설계 | 완료 | [browser-result.json](../docs/evidence/browser-result.json), [browser-flow.mjs](../tests/e2e/browser-flow.mjs) |
| T08.02 | 공통 화면과 재생 데이터 연결 | 완료 | [browser-result.json](../docs/evidence/browser-result.json), [browser-flow.mjs](../tests/e2e/browser-flow.mjs) |
| T08.03 | 과제 목록·설정·시작 화면 실연결 | 완료 | [browser-result.json](../docs/evidence/browser-result.json), [browser-flow.mjs](../tests/e2e/browser-flow.mjs) |
| T08.04 | 담당자·코딩 도우미 대화 UI | 완료 | [browser-result.json](../docs/evidence/browser-result.json), [browser-flow.mjs](../tests/e2e/browser-flow.mjs) |
| T08.05 | 파일 편집기 UI | 수정·재검증 완료 | [workspace-state.ts](../apps/web/src/workspace-state.ts), [remediation-browser.json](../docs/evidence/remediation-browser.json) |
| T08.06 | 터미널·미리보기 UI | 수정·재검증 완료 | [main.tsx](../apps/web/src/main.tsx), [browser-result.json](../docs/evidence/browser-result.json), [remediation-browser.json](../docs/evidence/remediation-browser.json) |
| T08.07 | 타이머·모드·복구 화면 | 완료 | [browser-result.json](../docs/evidence/browser-result.json), [browser-flow.mjs](../tests/e2e/browser-flow.mjs) |
| T08.08 | 제출·사후 질문 UI | 완료 | [browser-result.json](../docs/evidence/browser-result.json), [browser-flow.mjs](../tests/e2e/browser-flow.mjs) |
| T08.09 | 전체 화면 접근성과 사용성 확인 | 수정·재검증 완료 | [remediation-flow.mjs](../tests/e2e/remediation-flow.mjs), [remediation-browser.json](../docs/evidence/remediation-browser.json), [browser-result.json](../docs/evidence/browser-result.json) |
| T09.01 | 제출 프로토콜 상세 Spec | 완료 | [journey.test.ts](../tests/integration/journey.test.ts), [safety.test.ts](../tests/integration/safety.test.ts) |
| T09.02 | 마감 상태 전이와 쓰기 작업 정지 | 완료 | [journey.test.ts](../tests/integration/journey.test.ts), [safety.test.ts](../tests/integration/safety.test.ts) |
| T09.03 | 파일·이벤트 범위 고정과 해시 | 완료 | [journey.test.ts](../tests/integration/journey.test.ts), [safety.test.ts](../tests/integration/safety.test.ts) |
| T09.04 | 제출 실패 복구와 조회 API | 완료 | [journey.test.ts](../tests/integration/journey.test.ts), [safety.test.ts](../tests/integration/safety.test.ts) |
| T09.05 | 제출 경합·불변성 검증 | 수정·재검증 완료 | [remediation.test.ts](../tests/integration/remediation.test.ts), [live-deadline-race.json](../docs/evidence/live-deadline-race.json), [live-remediation.json](../docs/evidence/live-remediation.json) |
| T10.01 | 검증 실행·근거 Spec | 완료 | [live-extensions.json](../docs/evidence/live-extensions.json), [safety.test.ts](../tests/integration/safety.test.ts) |
| T10.02 | 별도 복사본에서 검사 실행 | 수정·재검증 완료 | [validation.ts](../apps/server/src/modules/validation.ts), [remediation.test.ts](../tests/integration/remediation.test.ts) |
| T10.03 | 브라우저 검증·화면 근거 | 완료 | [live-extensions.json](../docs/evidence/live-extensions.json), [safety.test.ts](../tests/integration/safety.test.ts) |
| T10.04 | 근거 목록과 제출본 위치 연결 | 완료 | [live-extensions.json](../docs/evidence/live-extensions.json), [safety.test.ts](../tests/integration/safety.test.ts) |
| T10.05 | 과제별 검사와 변경된 테스트 구분 | 수정·재검증 완료 | [live-remediation.json](../docs/evidence/live-remediation.json), [booking-live-matrix.json](../docs/evidence/booking-live-matrix.json), [retail-post-fix-validation.json](../docs/evidence/retail-post-fix-validation.json) |
| T11.01 | 질문·판정·점수·근거 상세 Spec | 완료 | [calibration.json](../docs/evidence/calibration.json), [live-extensions.json](../docs/evidence/live-extensions.json) |
| T11.02 | 제출·기록 기반 평가 입력 구성 | 완료 | [calibration.json](../docs/evidence/calibration.json), [live-extensions.json](../docs/evidence/live-extensions.json) |
| T11.03 | 사후 질문 생성·답변 저장 | 완료 | [calibration.json](../docs/evidence/calibration.json), [live-extensions.json](../docs/evidence/live-extensions.json) |
| T11.04 | 평가 실행과 항목별 판정 | 완료 | [calibration.json](../docs/evidence/calibration.json), [live-extensions.json](../docs/evidence/live-extensions.json) |
| T11.05 | 평가 응답·근거 검증 및 재평가 | 완료 | [calibration.json](../docs/evidence/calibration.json), [live-extensions.json](../docs/evidence/live-extensions.json) |
| T11.06 | 점수·평가 가능 범위 계산 | 완료 | [calibration.json](../docs/evidence/calibration.json), [live-extensions.json](../docs/evidence/live-extensions.json) |
| T11.07 | 평가 기준 사례와 편향·변동 검토 | 수정·재검증 완료 | [full-calibration-retail-coaching.json](../docs/evidence/full-calibration-retail-coaching.json), [full-calibration-equipment-booking.json](../docs/evidence/full-calibration-equipment-booking.json), [evaluation-policy.ts](../apps/server/src/modules/evaluation-policy.ts) |
| T12.01 | 리포트·근거 탐색 UI | 완료 | [journey.test.ts](../tests/integration/journey.test.ts), [browser-result.json](../docs/evidence/browser-result.json) |
| T12.02 | Markdown·JSON·제출 파일 내보내기 | 완료 | [journey.test.ts](../tests/integration/journey.test.ts), [browser-result.json](../docs/evidence/browser-result.json) |
| T12.03 | 시도 목록·새 시도·이어 연습 UI | 완료 | [journey.test.ts](../tests/integration/journey.test.ts), [browser-result.json](../docs/evidence/browser-result.json) |
| T12.04 | 리포트 및 내보내기 일치 검증 | 완료 | [journey.test.ts](../tests/integration/journey.test.ts), [browser-result.json](../docs/evidence/browser-result.json) |
| T13.01 | 개발 모드와 변경·노출 기록 | 완료 | [main.tsx](../apps/web/src/main.tsx), [safety.test.ts](../tests/integration/safety.test.ts) |
| T13.02 | 재생 어댑터와 실패 입력 주입 | 완료 | [main.tsx](../apps/web/src/main.tsx), [safety.test.ts](../tests/integration/safety.test.ts) |
| T13.03 | 역할·실행·사실·사용량 진단 UI | 완료 | [main.tsx](../apps/web/src/main.tsx), [safety.test.ts](../tests/integration/safety.test.ts) |
| T13.04 | 저장 실패·복구·중복 이벤트 재현 | 완료 | [main.tsx](../apps/web/src/main.tsx), [safety.test.ts](../tests/integration/safety.test.ts) |
| T13.05 | 라이브·재생 모드 교차 확인 | 완료 | [main.tsx](../apps/web/src/main.tsx), [safety.test.ts](../tests/integration/safety.test.ts) |
| T14.01 | 고객 응대 과제 첫 전체 실연결 | 완료 | [README.md](../README.md), [local-operations.md](../docs/runbooks/local-operations.md) |
| T14.02 | 예약 과제 전체 실연결 | 완료 | [README.md](../README.md), [local-operations.md](../docs/runbooks/local-operations.md) |
| T14.03 | 수용 테스트 22개와 접근 경계 점검 | 수정·재검증 완료 | [acceptance.md](../docs/evidence/acceptance.md), [live-remediation.json](../docs/evidence/live-remediation.json), [remediation-automated-tests.json](../docs/evidence/remediation-automated-tests.json) |
| T14.04 | 설치·실행·복구·정리 안내 | 완료 | [README.md](../README.md), [local-operations.md](../docs/runbooks/local-operations.md) |
| T14.05 | MVP 릴리스 검토와 버전 고정 | 검토 완료·범위 제한 | [release-check.json](../docs/evidence/release-check.json), [remediation-report.md](../docs/evidence/remediation-report.md) |
| T15.01 | 과제 제작 UI Spec | 완료 | [safety.test.ts](../tests/integration/safety.test.ts), [live-extensions.json](../docs/evidence/live-extensions.json) |
| T15.02 | 과제 제작 UI 구현·검증 | 수정·재검증 완료 | [check-definitions.ts](../apps/server/src/modules/check-definitions.ts), [browser-result.json](../docs/evidence/browser-result.json), [remediation.test.ts](../tests/integration/remediation.test.ts) |
| T15.03 | 시도 비교 기준 Spec | 완료 | [safety.test.ts](../tests/integration/safety.test.ts), [live-extensions.json](../docs/evidence/live-extensions.json) |
| T15.04 | 시도 비교 UI·내보내기 | 완료 | [safety.test.ts](../tests/integration/safety.test.ts), [live-extensions.json](../docs/evidence/live-extensions.json) |
| T15.05 | 사용자 스킬·도구 연결 Spec | 완료 | [safety.test.ts](../tests/integration/safety.test.ts), [live-extensions.json](../docs/evidence/live-extensions.json) |
| T15.06 | 스킬·도구 가져오기 구현·검증 | 완료 | [safety.test.ts](../tests/integration/safety.test.ts), [live-extensions.json](../docs/evidence/live-extensions.json) |
| T16.01 | 원격 실행·다중 사용자 별도 Spec | 완료 | [remote-multiuser.md](../docs/specs/remote-multiuser.md), [remote-implementation-tasks.md](../docs/plans/remote-implementation-tasks.md) |
| T16.02 | 후속 구현 계획 재분해 | 완료 | [remote-multiuser.md](../docs/specs/remote-multiuser.md), [remote-implementation-tasks.md](../docs/plans/remote-implementation-tasks.md) |

### 2026-10-30 과제별 모델 허용 목록

버전별 `allowedModels`, 제작 화면 복수 선택, 응시 모델 선택·고정, 서버 허용 목록 및 현재 목록 검사, 이어 연습 모델 유지, 공개 계약을 추가했습니다. 검증: `docs/evidence/model-policy.md`, `model-policy-live.json`, `model-policy-browser.json`.
