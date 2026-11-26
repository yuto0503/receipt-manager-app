#!/usr/bin/env bash
# Run from the repository root on Linux, after migrations and both builds.
set -euo pipefail

: "${RECEIPT_ACCEPTANCE_ISOLATED:?Use an empty, dedicated database}"
test "$RECEIPT_ACCEPTANCE_ISOLATED" = 1
: "${SERVER_API_BASE_URL:?}"
: "${RECEIPT_UI_TEST_URL:?}"
: "${RECEIPT_TEST_API_URL:?}"
: "${E2E_API_BINARY:?Build the API before running E2E}"
export RECEIPT_E2E_OUTPUT_DIR="${RECEIPT_E2E_OUTPUT_DIR:-$PWD/frontend/test-results/acceptance}"
mkdir -p "$RECEIPT_E2E_OUTPUT_DIR"
# Do not inherit a developer's browser or external Playwright installation.
unset PLAYWRIGHT_MODULE PLAYWRIGHT_CHANNEL

api_pid=
frontend_pid=
test_pid=
cleanup() {
  result=$?
  trap - EXIT INT TERM
  for pid in "$test_pid" "$frontend_pid" "$api_pid"; do
    if [ -n "$pid" ]; then
      kill -TERM -- "-$pid" 2>/dev/null || :
    fi
  done
  for pid in "$test_pid" "$frontend_pid" "$api_pid"; do
    if [ -n "$pid" ]; then
      # Bound shutdown even if a server ignores SIGTERM.
      for ((attempt = 0; attempt < 30; attempt++)); do
        if ! kill -0 -- "-$pid" 2>/dev/null; then break; fi
        sleep 0.1
      done
      kill -KILL -- "-$pid" 2>/dev/null || :
      wait "$pid" 2>/dev/null || :
    fi
  done
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

wait_http() {
  local url=$1 pid=$2 deadline=$((SECONDS + 60))
  until curl --fail --silent --show-error --max-time 2 "$url" > /dev/null 2>&1; do
    if ! kill -0 "$pid" 2>/dev/null || ((SECONDS >= deadline)); then
      echo "Server failed to become ready: $url" >&2
      return 1
    fi
    sleep 0.5
  done
  kill -0 "$pid"
}

# Never reuse unrelated servers on the test ports.
node --input-type=module <<'JS'
import { createServer } from 'node:net';
for (const port of [8080, 3100]) {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '0.0.0.0', resolve);
  });
  await new Promise((resolve) => server.close(resolve));
}
JS

setsid "$E2E_API_BINARY" > "$RECEIPT_E2E_OUTPUT_DIR/api.log" 2>&1 &
api_pid=$!
wait_http "$RECEIPT_TEST_API_URL/health" "$api_pid"
# /health checks the process; /receipts also checks the migrated DB.
wait_http "$RECEIPT_TEST_API_URL/receipts" "$api_pid"
setsid node frontend/node_modules/next/dist/bin/next start frontend --hostname 127.0.0.1 --port 3100 > "$RECEIPT_E2E_OUTPUT_DIR/frontend.log" 2>&1 &
frontend_pid=$!
wait_http "$RECEIPT_UI_TEST_URL/receipts" "$frontend_pid"

cd frontend
# Share one database sequentially. Fault injection needs a separate recovery flow.
read -r -a steps <<< "${E2E_STEPS:-1}"
for step in "${steps[@]}"; do
  case "$step" in
    1|2|3|4|5|6|7|8|12) ;;
    *) echo "Unsupported CI acceptance step: $step" >&2; exit 1 ;;
  esac
  echo "Running acceptance step $step"
  setsid timeout --foreground --signal=TERM --kill-after=5s 180s node tests/receipt-acceptance.e2e.mjs "$step" > "$RECEIPT_E2E_OUTPUT_DIR/step-$step.log" 2>&1 &
  test_pid=$!
  if wait "$test_pid"; then
    cat "$RECEIPT_E2E_OUTPUT_DIR/step-$step.log"
  else
    result=$?
    cat "$RECEIPT_E2E_OUTPUT_DIR/step-$step.log"
    exit "$result"
  fi
  kill -KILL -- "-$test_pid" 2>/dev/null || :
  test_pid=
done
