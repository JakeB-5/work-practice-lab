# S05 — 파일·터미널·미리보기

상태: 구현 기준 v0.1.0. 작업 환경은 개인용 로컬 실행이며 적대적 사용자의 OS 전체를 격리하는 서비스가 아니다.

## 1. 디렉터리

dataRoot/attempts/{attemptId}/
workspace/             응시자 작업
public-resources/      원본 공개 자료
runtime/               PID·포트·실행 설정
staging/               스냅샷 임시 파일
submissions/           고정 제출본
validation/            검사별 실행 복사본

private 과제 자료와 app DB는 이 루트의 workspace 안에 넣지 않는다.
작업 폴더 생성은 신규 빈 경로에만 가능. 기존 사용자 프로젝트를 작업 대상으로 덮어쓰지 않는다.
시도 삭제는 DB에 등록한 소유 루트만 대상으로 한다. 경로 계산 결과가 dataRoot 밖이면 즉시 거절한다.

## 2. 파일 API

GET /attempts/{id}/files?path=<relative-directory>
GET /attempts/{id}/file?path=<relative-file>
PUT /attempts/{id}/file {path,content}
DELETE /attempts/{id}/file?path=...
POST /attempts/{id}/files/move {from,to}

path는 UTF-8 상대경로. 절대경로·NUL·상위 디렉터리·symlink 통과를 거절한다.
실제 경로를 정규화하고 각 구성 요소를 lstat로 검사한다. 시점 차이로 symlink가 바뀌는 사례를 검증한다. Node의 단순 문자열 startsWith만으로 접근을 허용하지 않는다.
MVP 파일 서비스는 symlink를 생성·추적하지 않는다. 발견하면 read-only metadata와 차단 사유를 표시한다.
텍스트 편집은 UTF-8, 최대2MiB. 바이너리는 metadata/download만 허용하고 편집은 거절한다.
파일 목록은 최대500개 단위로 반환한다. .git,node_modules,build 산출물은 기본 숨김이며 검색·제출 규칙과 혼동하지 않는다.

파일 응답: {path,content,encoding:"utf-8",sha256,version,modifiedAt}.
ETag는 원본 bytes SHA-256. 저장에는 If-Match 필수. 신규 생성은 If-None-Match:*를 쓴다.
변경된 파일의 hash가 일치하지 않으면 409 VERSION_CONFLICT + 최신 hash를 반환하고 사용자의 편집 버퍼를 덮어쓰지 않는다.
원자 저장은 같은 디렉터리의 임시 파일과 rename을 사용한다. 사용자의 저장과 AI 변경은 각각 다른 actor로 기록한다.
자동저장 기본 debounce=800ms. “저장됨”은 서버의 확정 응답 뒤에만 표시한다. 브라우저 local draft는 임시 복구용이며 서버 저장으로 간주하지 않는다.

## 3. 프로세스 관리자

ManagedProcess {id,attemptId,kind,argv,cwdRelative,startedAt,pid,pgid,state,exitCode,port?}.
kind=terminal/dev_server/prepare/validation. 외부 프로세스를 앱 소유로 추정하지 않는다.
서버의 spawn은 shell:false와 argv를 쓴다. 사용자 통합 터미널만 PTY 셸을 허용한다.
자식 프로세스 group을 기록하고 stop은 SIGTERM → 3초 대기 → 앱 소유 group에 SIGKILL로 에스컬레이션한다. 종료 확인 없이는 succeeded로 표시하지 않는다.
환경변수는 명시적 허용 목록과 과제별 environmentKeys에서 구성한다. 인증 token·Codex 제어 정보·앱 DB 경로를 과제 프로세스에 전달하지 않는다.
터미널 자체는 사용자 명령을 실행하므로 같은 OS 사용자의 모든 접근을 차단한다고 주장하지 않는다. 역할별 Codex 제한과 별개의 신뢰 경계다.

## 4. PTY 연결

POST /attempts/{id}/terminals → processId + wsTicket.
GET /attempts/{id}/terminals/{processId}/ticket → 새 일회성 ticket.
WS /api/v1/terminal-stream?ticket=...은 Origin 검사, ticket 소비 후 연결.
input/resize/interrupt 메시지 schema를 검증한다. cols=20..300, rows=5..100.
사용자 입력은 terminal.input, 출력은 terminal.output, 종료는 process.exited로 기록. 개별 키 입력을 성적 분석 대상으로 사용하지 않고 입력·출력 출처 추적에 한정한다.
연결이 끊겨도 프로세스는 즉시 죽이지 않는다. 재접속 시 cursor부터 저장 출력 재생.
출력은 raw bytes와 화면 제어 문자를 구분한다. 로그·리포트에서 터미널 escape를 안전하게 제거한다.
저장 상한 기본50MiB/프로세스. 상한 초과 시 명시적으로 output.truncated를 남기며 누락 구간은 평가 근거로 사용하지 않는다. truncation이 감지된 후 계속 보관한다고 표시하지 않는다.

## 5. 개발 서버·미리보기

POST /attempts/{id}/preview/start는 manifest.run의 argv를 관리 프로세스로 실행한다.
포트는 서버가 사용 가능한 loopback 포트를 할당한다. health check는 해당 등록 포트만 조회한다.
미리보기 URL은 localhost의 허용 포트. 임의 외부 URL이나 사용자가 준 호스트로 proxy하지 않는다.
프로젝트 서버가 다른 주소에 바인딩하면 관리 proxy가 localhost에 노출하되 대상은 등록한 loopback 포트로 고정한다.
제어 UI는 127.0.0.1, preview는 localhost로 호스트를 분리한다. iframe 허용 정책과 파일 다운로드·popup은 기본 제한한다.
preview에서 control origin으로 fetch/WS를 보내도 쿠키·Origin·CSRF 검사에서 막혀야 한다.
개발 서버 실행 실패는 stdout/stderr·exitCode와 함께 표시한다. “미리보기 시작” 버튼을 눌렀다는 이유로 실행 중으로 표시하지 않는다.

## 6. 마감과 저장 접수

모든 사용자 편집·터미널 input·새 명령·Codex 요청은 S01의 mutation coordinator에서 state를 검사한다.
sealing 이후 신규 요청은 409 INVALID_STATE.
마감 전 서버가 접수한 저장은 drain 대상으로 등록하고 완료하거나 명시적으로 실패 처리한다. 브라우저에만 남은 draft는 제출에 자동 포함하지 않는다.
관리 중 프로세스의 중단과 workspace hash 확인은 S06이 조율한다. 파일 변경을 롤백하는 기능은 기본 제출 절차에 없다.

## 7. 검증

WS-01 경로 이탈/인코딩/심볼릭 링크, WS-02 동시에 사용자·AI 저장,
WS-03 브라우저 재접속과 PTY 출력, WS-04 자식 프로세스 종료,
WS-05 preview의 control API 접근, WS-06 임의 URL proxy 요청,
WS-07 마감 후 입력, WS-08 출력 상한·binary 편집을 확인한다.
