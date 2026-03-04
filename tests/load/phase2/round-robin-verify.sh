#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────
# 8.3 2서버 독립 동작 + 라운드 로빈 호환성 검증 스크립트
#
# chat-server(8080): 유저/채팅방/메시지 CRUD + STOMP
# api-server(8081):  메시지 이력 조회 (MongoDB 읽기)
#
# 실행: bash tests/load/phase2/round-robin-verify.sh
# ───────────────────────────────────────────────────────────

set -euo pipefail

CHAT_SERVER="http://localhost:8080"
API_SERVER="http://localhost:8081"
PASS=0
FAIL=0

check() {
  local desc="$1" expected="$2" actual="$3"
  if echo "$actual" | grep -q "$expected"; then
    echo "  ✅ $desc"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $desc (expected: $expected, got: $actual)"
    FAIL=$((FAIL + 1))
  fi
}

echo "════════════════════════════════════════════════"
echo "  Phase 2: 2서버 라운드 로빈 호환성 검증"
echo "════════════════════════════════════════════════"
echo ""

# ─── 1) 헬스체크 ───
echo "▶ 1단계: 서버 헬스체크"
R1=$(curl -s "$CHAT_SERVER/api/health")
check "chat-server 헬스" "OK" "$R1"
R2=$(curl -s "$API_SERVER/api/health")
check "api-server 헬스" "OK" "$R2"
echo ""

# ─── 2) chat-server에서 유저 생성 ───
echo "▶ 2단계: chat-server에서 유저 생성"
NICK="rr_test_$(date +%s)"
USER_JSON=$(curl -s -X POST "$CHAT_SERVER/api/users" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "nickname=$NICK")
USER_ID=$(echo "$USER_JSON" | grep -oP '"id"\s*:\s*\K\d+')
check "유저 생성 성공" "$NICK" "$USER_JSON"
echo "  → userId=$USER_ID, nickname=$NICK"
echo ""

# ─── 3) chat-server에서 채팅방 생성 ───
echo "▶ 3단계: chat-server에서 채팅방 생성"
ROOM_NAME="LoadTest_Room_$(date +%s)"
ROOM_JSON=$(curl -s -X POST "$CHAT_SERVER/api/chat-rooms" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "name=$ROOM_NAME&creatorId=$USER_ID")
ROOM_ID=$(echo "$ROOM_JSON" | grep -oP '"roomId"\s*:\s*\K\d+' || echo "$ROOM_JSON" | grep -oP '"id"\s*:\s*\K\d+')
check "채팅방 생성 성공" "$ROOM_NAME" "$ROOM_JSON"
echo "  → roomId=$ROOM_ID"
echo ""

# ─── 4) chat-server에서 다시 채팅방 목록 조회 ───
echo "▶ 4단계: chat-server에서 채팅방 목록 조회 (동일 서버 반복 요청)"
for i in 1 2 3; do
  LIST=$(curl -s "$CHAT_SERVER/api/chat-rooms?userId=$USER_ID")
  check "조회 #$i — 방 목록에 포함" "$ROOM_NAME" "$LIST"
done
echo ""

# ─── 5) api-server에서 메시지 이력 조회 (교차 서버 검증) ───
echo "▶ 5단계: api-server에서 메시지 이력 조회 (MongoDB 교차 읽기)"
MSGS=$(curl -s "$API_SERVER/api/rooms/$ROOM_ID/messages?limit=10")
check "api-server 메시지 응답 정상" "messages" "$MSGS"
echo "  → 응답: $MSGS"
echo ""

# ─── 6) chat-server 반복 호출 (stateless 검증) ───
echo "▶ 6단계: chat-server 10회 반복 호출 (stateless 일관성)"
ALL_OK=true
for i in $(seq 1 10); do
  R=$(curl -s -o /dev/null -w "%{http_code}" "$CHAT_SERVER/api/chat-rooms?userId=$USER_ID")
  if [ "$R" != "200" ]; then
    ALL_OK=false
    echo "  ❌ 호출 #$i: HTTP $R"
  fi
done
if [ "$ALL_OK" = true ]; then
  check "10회 반복 호출 모두 200 OK" "true" "true"
else
  check "10회 반복 호출 실패 있음" "true" "false"
fi
echo ""

# ─── 7) api-server 반복 호출 (stateless 검증) ───
echo "▶ 7단계: api-server 10회 반복 호출 (stateless 일관성)"
ALL_OK=true
for i in $(seq 1 10); do
  R=$(curl -s -o /dev/null -w "%{http_code}" "$API_SERVER/api/rooms/$ROOM_ID/messages?limit=5")
  if [ "$R" != "200" ]; then
    ALL_OK=false
    echo "  ❌ 호출 #$i: HTTP $R"
  fi
done
if [ "$ALL_OK" = true ]; then
  check "10회 반복 호출 모두 200 OK" "true" "true"
else
  check "10회 반복 호출 실패 있음" "true" "false"
fi
echo ""

# ─── 결과 ───
echo "════════════════════════════════════════════════"
echo "  결과: ✅ $PASS 통과 / ❌ $FAIL 실패"
echo "════════════════════════════════════════════════"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
