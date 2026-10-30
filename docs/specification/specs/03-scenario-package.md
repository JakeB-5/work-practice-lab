# S03 — 과제 패키지

상태: 구현 기준 v0.1.0. 과제 내용을 앱 코드와 분리한다.

## 1. 패키지 계약

root:
manifest.json
public/brief.md
public/resources/*
public/starter/*
private/stakeholder.json
private/rubric.json
private/validation.json
private/calibration/*

manifest는 contracts/domain.schema.json의 ScenarioManifest를 따른다.
필수: schemaVersion, scenarioId, version, title, summary, durationSeconds, publicBrief, resources, starterDir, prepare, run, validationProfile.
scenarioId는 소문자 kebab-case, version은 semver. publicBrief/resources/starterDir는 public/ 아래 상대 경로만 허용한다.
prepare/run은 CommandSpec {argv:string[], cwdRelative:string, timeoutSeconds:number, environmentKeys:string[]}이다. shell 문자열 연결 대신 argv로 실행한다. 예외적으로 사용자가 입력한 PTY 셸 명령은 별도 작업 환경의 권한으로 실행한다.
prepare.timeoutSeconds는 명령 종료 제한이며, run.timeoutSeconds는 개발 서버의 준비 완료 확인 제한이다. 준비가 끝난 개발 서버는 해당 시간이 지나도 자동 종료하지 않고 시도 마감/명시적 중단 때 회수한다.
허용 placeholder는 ${WORKSPACE}, ${PORT}, ${DATA_DIR} 세 개이며 서버에서 값으로 확정한다. 임의 환경변수/쉘 치환은 하지 않는다.

## 2. 공개·비공개

GET /scenarios는 공개 제목·요약·시간·versionId만 반환한다.
GET /scenarios/{versionId}는 public DTO와 공개 자료 목록만 반환한다. 디스크 manifest 전체를 JSON 직렬화해 반환하지 않는다.
공개 DTO의 briefResourceId는 예약된 "brief"이며 공개 resource 목록에도 포함한다. 브리프·자료 조회는 등록된 resourceId로만 한다. 클라이언트에서 디스크 경로를 받지 않는다.
private 내용은 서버 로더만 읽고 담당자/평가자 입력 구성기에서 해당 권한으로 선택한다. 프런트엔드 build import와 정적 폴더에 두지 않는다.
시도는 scenarioVersionId와 packageDigest를 고정한다. 같은 version의 내용이 바뀌면 로더가 거절하고 version 증가를 요구한다.
리소스 read-only는 파일 서비스 정책으로 강제한다. 사용자가 공개 자료를 별도 파일로 복사해 수정하면 원본과 별개임을 표시한다.

## 3. 담당자 사실

StakeholderBundle:
persona {name, job, tone}
topics [{id,label,description}]
facts [{id,topicIds,statement,sourceResourceIds,disclosureRule,unknownResponse?}]
constraints [{id,statement}]
routingExamples [{question,expectedTopicIds}]
answerExamples [{question,disclosedFactIds,expectedBehavior}]

fact ID는 과제 버전 안에서 유일. sourceResourceIds는 존재하는 공개 자료 또는 private 제작 근거를 참조한다.
disclosureRule은 on_relevant_question 또는 initially_public. 시험의 정답 구현 코드와 rubric은 담당자 사실에 넣지 않는다.
사용자가 묻지 않은 세부 요구를 한꺼번에 전달하지 않되, 필요한 맥락을 자연스럽게 설명할 수 있도록 같은 주제의 사실을 묶는다.
모르는 질문에 임의 규칙을 추가하지 않는다. 질문의 동의어·모호한 표현·후속 질문을 검증 예시에 포함한다.

## 4. 평가·검증 분리

rubric은 12개 criterion으로 구성: technology 4, intent 4, cognition 4.
criterion에는 id, axis, title, anchors[0..4], relevantEvidenceKinds, alternativeSolutions, insufficientEvidenceRule가 있다.
완성 기능의 모양이나 DB 설계를 유일 정답으로 강제하지 않는다.
validation은 고정된 검사 ID, 대상 범위, command/browser/manual 방식, expectedOutcome, timeout과 resource budget을 지정한다.
calibration은 평가 품질을 확인할 사례다. 응시자의 시작 코드나 공개 자료로 복사하지 않는다.

## 5. 두 기본 과제의 구현 입력

### 고객 응대

scenarioId=retail-coaching, durationSeconds=7200.
필수 공개 자료: 가상 상품 6종, 교환·반품 정책, 기존 교육 메모.
상품 데이터의 필수 필드: productId,name,priceWon,useCases,verifiedFeatures,limitations,sourceNote.
임의 건강·의료 효능은 넣지 않는다. 상품별 숫자·정책은 자료 간 동일해야 한다.
담당자 사실의 주제: 현업 문제, 교육 방식, 사용 환경, 성공 기준, 제외 범위.
핵심 비공개 사실: 5분 모바일 연습, 고객 필요 확인 후 추천, 좋은 표현 1개와 개선 표현 1개, 재답변, 음성/직원 순위는 초기 범위 밖.
시작 코드는 빈 화면·실행 환경·샘플 자료 읽기·앱용 AI 연결 예제까지 제공한다. 추천·피드백의 완성 로직은 제공하지 않는다.
과제 앱의 서버 측 프록시에 scoped credential을 주입하고 브라우저 번들에 secret을 넣지 않는다.

### 장비 예약

scenarioId=equipment-booking, durationSeconds=9000.
로그인 샘플 사용자 2명, 개별 장비 3개 이상, 초기 예약을 제공한다.
실제 개인 계정이나 업무 DB를 쓰지 않는다. DB namespace는 attempt ID로 분리.
담당자 사실: 30분 단위, 최대4시간, 즉시확정, 맞닿는 시간 허용, 시작 전 본인 예약만 취소.
검증은 업무 동작 기준이며 슬롯/범위 제약 등 특정 구현을 강제하지 않는다.
준비 단계는 DB 접근과 seed 상태를 확인하고 실패하면 준비 오류로 처리한다. 시험 시간을 소모시키지 않는다.

## 6. 패키지 검증 알고리즘

1. JSON schema와 고유 ID 검사.
2. 정규화된 경로가 해당 영역 안인지 확인. 절대 경로, '..', symlink, 특수 파일 거절.
3. 참조 resource/fact/criterion/check ID 존재 검사.
4. title/version/duration과 명령 timeout 범위 검사.
5. public 폴더에서 rubric/calibration/풀이 전문 또는 비밀값을 포함하지 않는지 제작 검사.
6. 공개 자료와 private 사실의 모순은 자동 검사 가능한 값 비교 + 제작자 검토로 확인.
7. sorted regular file path와 SHA-256으로 packageDigest 생성, DB 등록.
8. 준비 명령과 검사 명령을 시험 폴더에서 실행해 기록. 본 단계의 명령 성공은 추후 구현 테스트다.

변경된 version을 실행 중 시도에 덮어씌우지 않는다. 새로운 시도만 새 버전을 사용한다.

## 7. 제작 완료 조건

SC-01 public/private 경로 침범, SC-02 누락 참조, SC-03 같은 version 내용 변경,
SC-04 고객 응대 자료·사실 일치, SC-05 예약 DB 초기화 분리,
SC-06 동등 질문 표현, SC-07 서로 다른 타당한 해결 방식 허용을 확인한다.
