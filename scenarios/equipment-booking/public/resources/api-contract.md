# 외부 API 계약

기존 로그인은 유지합니다. 조회·예약·취소는 다음 인터페이스로 제공합니다.

- GET /api/equipment → 장비 배열 또는 {items:[...]}.
- GET /api/reservations → 예약 배열 또는 {items:[...]}. 각 항목에 id, equipmentId, userId, startAt, endAt, status 포함.
- POST /api/reservations: {equipmentId,startAt,endAt}; 성공 시 201과 예약 객체(id 포함), 충돌은409.
- DELETE /api/reservations/:id: 본인 취소 성공 200/204, 타인 취소403.
- 시간은 UTC ISO8601으로 전달하며 화면에서는 한국 시간으로 표시합니다.
- 잘못된 입력은400/422, 미로그인은401.

화면과 데이터 저장 방식은 자유롭게 정할 수 있습니다. 업무 세부 규칙은 담당자에게 확인하세요.
