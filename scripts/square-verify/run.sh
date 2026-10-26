#!/usr/bin/env bash
# トークンはこのシェルプロセス内だけ。history 回避のため先頭スペース推奨:  ./run.sh auth
set -euo pipefail
cd "$(dirname "$0")"

MODE="${1:-}"

read_token_hidden() {
  printf 'Production Access Token を貼り付け（非表示・Enter で確定）:\n' >&2
  read -rsp "" SQUARE_ACCESS_TOKEN
  echo >&2
  if [[ -z "${SQUARE_ACCESS_TOKEN// /}" ]]; then
    echo "エラー: トークンが空です。" >&2
    exit 1
  fi
}

case "$MODE" in
  dry-run | plan-create-order | create-order-dry-run)
    exec node square-verify.mjs "$MODE"
    ;;
  auth)
    read_token_hidden
    SQUARE_ACCESS_TOKEN=$SQUARE_ACCESS_TOKEN node square-verify.mjs auth
    unset SQUARE_ACCESS_TOKEN
    ;;
  create-order)
    read_token_hidden
    SQUARE_ACCESS_TOKEN=$SQUARE_ACCESS_TOKEN node square-verify.mjs create-order
    unset SQUARE_ACCESS_TOKEN
    ;;
  *)
    node square-verify.mjs 2>/dev/null || true
    echo "Usage: ./run.sh dry-run | plan-create-order | create-order-dry-run | auth | create-order" >&2
    exit 1
    ;;
esac
