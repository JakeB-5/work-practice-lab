# S07 — 검증 실행과 근거

상태: 구현 기준 v0.1.0. 실행 관리자는 모델 판정과 독립적으로 결과를 수집한다.

## 1. 검증 데이터

ValidationRun {id,attemptId,submissionId,checkId,checkVersion,status,origin,command?,startedAt?,endedAt?,exitCode?,evidenceIds,artifactHashBefore,artifactHashAfter}.
status=queued/running/passed/failed/timed_out/error/cancelled/not_run.
origin=fixed_check/user_modified_test/user_confirmation/model_interpretation.
pass는 고정 검사 결과가 기대 조건에 맞을 때만 사용한다. 모델의 “잘 작동한다”는 문장은 origin=model_interpretation의 주장이다.

Evidence {id,attemptId,submissionId?,kind,source,locator,sha256?,redacted,observedAt,confidenceNote?}.
kind=message/file/command/browser_capture/manual_confirmation/condition.
locator는 file path+hash+줄 번호, event seq, validationRunId, captureId 등의 구조화 참조.
로그의 일부 문자열이 “PASS”인 것만으로 passed로 기록하지 않는다. exit code와 검사별 assertion 결과를 함께 확인한다.

## 2. 실행 절차

1. sealed Submission과 고정 validation profile을 읽는다.
2. snapshot에서 검증 workspace를 새로 생성한다.
3. 환경 준비를 수행하고 그 결과를 시험 성과와 구별한다.
4. check 정의의 argv 또는 browser script를 실행한다.
5. timeout 기본120초/검사, browser flow 기본60초. 과제 버전에서 변경 가능.
6. 출력·종료 코드·assertion·화면 캡처를 저장하고 Evidence를 만든다.
7. 원래 snapshot hash 불변을 확인한다.
8. check별 status와 환경 상태를 확정한다.

prepare가 의존성 서버 장애로 실패하면 해당 check는 error/not_run. 응시자가 필수 파일을 누락해 실행할 수 없다는 증거가 있으면 해당 요구의 실패 근거로 남긴다. 둘을 같은 감점으로 처리하지 않는다.
resource budgets: 실행 2개까지(추론 동시성1과 별개), process 출력50MiB, capture 개당10MiB. 초과는 truncation/timeout 원인을 기록한다.
실행 중 취소는 자식 프로세스를 회수하고 cancelled로 기록한다.

## 3. 고정 검사와 사용자 테스트

고정 검사는 제출 workspace 밖의 immutable scenario version에서 로드한다.
응시자의 테스트 파일이 바뀌면 시작 템플릿 대비 diff/hash를 기록한다. 그 테스트가 통과해도 고정 요구 충족을 대신하지 않는다.
사용자 테스트 실행도 가치 있는 작업 근거이므로 버리지 않는다. origin을 명확히 구분한다.
검사 작성자는 특정 함수명·CSS 선택자·DB 구조를 부당하게 강제하지 않는다. 앱이 제공해야 할 외부 동작을 기준으로 검사한다.
필요하면 접근 가능한 기능 식별자가 있는 starter contract를 제공한다. 제출자의 유효한 다른 구현을 검사할 수 없으면 자동 실패 대신 지원되지 않는 검사/사람 확인으로 표시한다.

## 4. 고객 응대 검사

- 최초 화면에서 연습 시작과 응답 작성이 가능.
- 고객 필요를 확인하는 대화와 추천/피드백/재답변 흐름 완료.
- 근거 없는 성능 주장을 검증 사례로 입력.
- 질문 없는 추천과 적절한 질문을 한 추천의 피드백 비교.
- 짧지만 적절한 답변을 길이만으로 벌하지 않는지 확인.
- AI 오류·busy 상태에서 작성 내용이 보존되고 재시도 가능.

정성 판단은 입력·출력·자료 출처를 저장해 evaluator에게 전달한다. 단일 자연어 답변이 기대 문자열과 같아야 한다는 식의 검사는 사용하지 않는다.

## 5. 예약 검사

- 정상 예약, 겹치는 예약, 맞닿는 예약.
- 같은 시간 다른 장비.
- 두 사용자 동시 예약의 실제 저장 결과.
- 본인/타인 취소 권한과 취소 후 예약.
- 시간 단위·최대 길이·시작 전 취소 조건.
- 실패 후 부분 데이터가 남는지.

HTTP 응답만 아니라 준비된 관찰 계약을 통해 저장 결과도 확인한다. DB 구조를 모르는 경우 서비스 조회 API를 사용한다. 고정 검사가 모든 구현을 특정 DB 스키마로 가정하지 않는다.

## 6. 근거 검증

Evidence resolver는 submissionId와 locator를 함께 검사한다.
파일 줄은 고정본에서 1-based inclusive. 존재하지 않는 파일·줄·event ID는 오류.
근거에 포함된 내용이 가려졌으면 redacted=true와 가림 범위를 남긴다. 평가자가 없는 내용을 상상해 채워 넣지 않는다.
큰 출력은 필요한 범위와 전체 blob hash를 함께 보관한다. 잘린 출력이 전부인 것처럼 제시하지 않는다.
사용자 수동 확인은 실제 자동 검증과 같은 아이콘·문구로 표시하지 않는다.

## 7. 완료 조건

VAL-01 실행 오류와 기능 실패 구분, VAL-02 timeout,
VAL-03 수정된 사용자 테스트, VAL-04 다른 유효 구현,
VAL-05 snapshot 불변, VAL-06 허구 locator,
VAL-07 수동 확인 출처, VAL-08 AI 응답 비교 사례를 확인한다.


## 구현 계약 보완 (수정 검증)

`private/validation.json`의 버전·checks를 고정 과제 버전에서 읽으며, 요청의 checkIds가 있으면 해당 검사만 실행한다. 중복·알 수 없는 ID는 거절한다. 각 검사는 독립된 복사본과 checkVersion(정의 해시 포함)을 가진다.

지원 runner: `browser-page`(kind=browser), `retail-flow`(browser/semantic), `booking-flow`(http), `booking-race`(concurrency), `command`(command). 기존 네 검사 ID는 호환 매핑을 유지한다. command의 argv는 셸 문자열이 아닌 배열이며 `${NODE}`, `${WORKSPACE}`, `${SCENARIO_DIR}`를 사용할 수 있다. 고정 스크립트도 argv로 실행할 수 있다. 미지원 runner는 저장 단계에서 거절하며 설명만 바꾸어 실행된 것처럼 표시하지 않는다.

검사별 timeoutSeconds는 1~600초, 기본 명령/흐름120초·첫 화면60초다. 취소/시간 초과는 독립 상태로 기록하고 관리 프로세스를 종료한 후 원본 해시를 확인한다. 첫 화면 실행 오류는 다른 API 성공으로 덮어쓰지 않는다. 고객 응대 feedback 검사에는 실제 마지막 추천 text와 history를 함께 전달한다.
