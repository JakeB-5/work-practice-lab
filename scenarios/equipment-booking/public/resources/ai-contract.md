# 과제 앱용 AI 연결 계약

제공된 server.mjs의 scenarioAI를 서버에서만 호출합니다. 브라우저에 URL의 인증 토큰이나 환경변수를 노출하지 않습니다.

- messages는 `{role:"user"|"assistant",content:string}` 배열입니다. `system` 역할은 허용하지 않습니다. 코치 역할·응답 지침은 user 메시지의 내용으로 전달합니다.
- resourceIds에는 공개 자료 ID만 지정합니다. 고객 응대 과제는 catalog, policy, training을 사용합니다.
- outputSchema는 선택적인 JSON Schema입니다. 구조화 요청이면 반환 객체를 검증하고 사용합니다.
- 모델 실행 중이면 busy 오류가 발생할 수 있습니다. 입력을 보존하고 명시적인 재시도를 제공하세요. 실패를 가짜 성공 응답으로 대체하지 않습니다.
- 제공 helper는 접수 뒤 결과를 조회합니다. 오류 응답과 제한 시간을 처리하고, API 비밀값은 서버에만 둡니다.

예시:

```js
const result = await scenarioAI([
  {role:'user', content:'교육 코치로서 공개 상품 자료에 근거해 다음 직원 응대를 검토해주세요. 점수 대신 좋았던 표현과 바꿀 표현을 제시하세요.'},
  {role:'user', content:JSON.stringify({history, recommendation})}
], ['catalog','policy','training'], responseSchema);
```

고객 응대 자동 검사를 지원하려면 POST /api/practice를 제공할 수 있습니다. 요청은 `{action:'start'|'message'|'feedback'|'retry',text,history}`이며 응답의 reply는 비어 있지 않은 문자열입니다. feedback에는 마지막 추천 text와 대화 history를 함께 보냅니다. 피드백 의미의 타당성은 실행 성공과 별도로 판단됩니다.

작업 폴더 권한에서 Node 문법 검사가 OpenSSL 설정 접근 때문에 실패하면 `OPENSSL_CONF=/dev/null node --check server.mjs`를 사용할 수 있습니다. 실행하지 않은 검사는 통과했다고 기록하지 마세요.
