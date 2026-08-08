#!/usr/bin/env bash
set -Eeuo pipefail

output_file="microsoft-todo-export.json"
token_file=""
graph_base="https://graph.microsoft.com/v1.0"

usage() {
  printf '%s\n' \
    "Export Microsoft To Do as JSON" \
    "" \
    "Usage:" \
    "  $0 [--output FILE] [--token-file FILE]" \
    "" \
    "The token can also be provided through MSTODO_ACCESS_TOKEN." \
    "Required tools: bash, curl, and jq"
}

while (($#)); do
  case "$1" in
    -o|--output)
      [[ $# -ge 2 ]] || { printf 'Missing value for %s\n' "$1" >&2; exit 2; }
      output_file=$2
      shift 2
      ;;
    --token-file)
      [[ $# -ge 2 ]] || { printf 'Missing value for %s\n' "$1" >&2; exit 2; }
      token_file=$2
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      printf 'Unknown option: %s\n' "$1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

# Fail early with a useful message instead of failing halfway through an export.
for command_name in curl jq; do
  command -v "$command_name" >/dev/null 2>&1 || {
    printf 'Required command not found: %s\n' "$command_name" >&2
    exit 1
  }
done

access_token=${MSTODO_ACCESS_TOKEN:-}
if [[ -n "$token_file" ]]; then
  [[ -r "$token_file" ]] || { printf 'Token file is not readable: %s\n' "$token_file" >&2; exit 1; }
  access_token=$(<"$token_file")
fi

if [[ -z "$access_token" ]]; then
  read -r -s -p 'Microsoft Graph token: ' access_token
  printf '\n' >&2
fi

[[ -n "$access_token" ]] || { printf 'No token was provided.\n' >&2; exit 1; }

temporary_dir=$(mktemp -d)
cleanup() {
  rm -rf -- "$temporary_dir"
}
trap cleanup EXIT

graph_collection() {
  local next_url=$1
  local destination=$2
  local page_file="$temporary_dir/graph-page.json"

  : >"$destination"

  # Write newline-delimited JSON to disk. This avoids the operating system's
  # command-line size limit when an account contains large task bodies.
  while [[ -n "$next_url" ]]; do
    curl --silent --show-error --fail-with-body \
      --header "Authorization: Bearer $access_token" \
      --header 'Accept: application/json' \
      --output "$page_file" \
      "$next_url"
    jq -c '.value[]?' "$page_file" >>"$destination"
    next_url=$(jq -r '."@odata.nextLink" // empty' "$page_file")
  done
}

urlencode() {
  jq -nr --arg value "$1" '$value | @uri'
}

printf 'Loading Microsoft To Do lists …\n' >&2
lists_source="$temporary_dir/lists-source.ndjson"
export_lists="$temporary_dir/export-lists.ndjson"
graph_collection "$graph_base/me/todo/lists?\$top=100" "$lists_source"
: >"$export_lists"
list_index=0

while IFS= read -r list; do
  list_id=$(jq -r '.id' <<<"$list")
  list_name=$(jq -r '.displayName // "Unnamed list"' <<<"$list")
  encoded_list_id=$(urlencode "$list_id")
  printf '  %s\n' "$list_name" >&2

  tasks_source="$temporary_dir/list-${list_index}-tasks-source.ndjson"
  enriched_tasks="$temporary_dir/list-${list_index}-tasks.ndjson"
  tasks_array="$temporary_dir/list-${list_index}-tasks.json"
  graph_collection "$graph_base/me/todo/lists/$encoded_list_id/tasks?\$top=100" "$tasks_source"
  : >"$enriched_tasks"
  task_index=0

  while IFS= read -r task; do
    task_id=$(jq -r '.id' <<<"$task")
    encoded_task_id=$(urlencode "$task_id")
    checklist_source="$temporary_dir/checklist-source.ndjson"
    checklist_array="$temporary_dir/checklist.json"
    graph_collection "$graph_base/me/todo/lists/$encoded_list_id/tasks/$encoded_task_id/checklistItems?\$top=100" "$checklist_source"
    jq -s '.' "$checklist_source" >"$checklist_array"
    jq -c --slurpfile checklist "$checklist_array" \
      '. + {checklistItems: $checklist[0]}' <<<"$task" >>"$enriched_tasks"
    ((task_index += 1))
  done <"$tasks_source"

  jq -s '.' "$enriched_tasks" >"$tasks_array"

  jq -c --slurpfile tasks "$tasks_array" \
    '. + {tasks: $tasks[0]}' <<<"$list" >>"$export_lists"
  ((list_index += 1))
done <"$lists_source"

exported_at=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
if ((list_index)); then
  jq -s --arg exported_at "$exported_at" \
    '{format: "todo-microsoft-export", version: 1, exportedAt: $exported_at, lists: .}' \
    "$export_lists" >"$output_file"
else
  jq -n --arg exported_at "$exported_at" \
    '{format: "todo-microsoft-export", version: 1, exportedAt: $exported_at, lists: []}' \
    >"$output_file"
fi

unset access_token
printf 'Export complete: %s lists written to %s\n' "$list_index" "$output_file"
