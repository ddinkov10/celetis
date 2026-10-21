#!/usr/bin/env bash
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../.." && pwd)
output_dir=
mcp_config='{"mcpServers":{}}'
while [ $# -gt 0 ]; do
  case $1 in
    --output-dir) [ $# -ge 2 ] || exit 2; output_dir=$2; shift 2 ;;
    *) echo "usage: $0 [--output-dir DIR]" >&2; exit 2 ;;
  esac
done
metadata_recording='For test evidence only, emit each actual lstat result as JSON with its absolute path and boolean file, directory, and symlink fields from isFile(), isDirectory(), and isSymbolicLink() on that result. For an actual ENOENT error, emit its exact path and code.'
if [ -n "$output_dir" ]; then
  mkdir -p "$output_dir"
  output_dir=$(cd "$output_dir" && pwd)
fi
tmp=$(mktemp -d)
tmp=$(cd "$tmp" && pwd -P)
lane="$tmp/project/.claude/worktrees/lane"
plugin="$tmp/plugin"
observer="$tmp/observer"
output_files=()
cleanup() {
  local status=$? file
  kill $(jobs -p) 2>/dev/null || true
  if [ -n "$output_dir" ] && [ "${#output_files[@]}" -gt 0 ]; then
    for file in "${output_files[@]}"; do
      [ ! -f "$file" ] || cp "$file" "$output_dir/" || status=1
    done
  fi
  rm -rf "$tmp"
  exit "$status"
}
trap cleanup EXIT
export CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=1
unset AI_AGENT CLAUDECODE CLAUDE_CODE_CHILD_SESSION CLAUDE_CODE_ENTRYPOINT CLAUDE_CODE_EXECPATH \
  CLAUDE_CODE_MESSAGING_SOCKET CLAUDE_CODE_MESSAGING_TOKEN CLAUDE_CODE_SESSION_ATTENDED \
  CLAUDE_CODE_SESSION_ID CLAUDE_EFFORT CLAUDE_PID

mkdir -p "$plugin" "$tmp/project/sub" "$tmp/outside" "$tmp/missing"
cp -R "$root/skills" "$root/docs" "$root/scripts" "$root/.claude-plugin" "$root/hooks" "$plugin/"
cp "$root/step-prompt.md" "$plugin/"
cp -R "$root/tests/manual/native-observer" "$observer"
selected() {
  case " ${CUSTOM_PART_CASES:-$1} " in *" $1 "*) return 0 ;; esac
  return 1
}
claude --version >"$tmp/version" 2>&1
output_files+=("$tmp/version")
sources() {
  local base=$1 origin=$2
  shift 2
  (cd "$base" && shasum -a 256 "$@") | jq -Rsc --arg base "$base" --arg origin "$origin" '
    [split("\n")[] | select(length > 0) | capture("^(?<sha256>[0-9a-f]{64}) [ *](?<file>.+)$") |
      {path:($base + "/" + .file),source:($origin + "/" + .file),sha256}]'
}
plugin_sources=$(sources "$plugin" "$root" docs/hosts/entry.md docs/hosts/claude.md docs/configuration.md \
  skills/guide/SKILL.md skills/writing-for-agents/SKILL.md skills/lesson-review/SKILL.md skills/lesson/SKILL.md hooks/hooks.json hooks/entry.js)
observer_sources=$(sources "$observer" "$root/tests/manual/native-observer" .claude-plugin/plugin.json hooks/hooks.json hooks/register.js)
git -C "$tmp/project" init -q
git -C "$tmp/project" -c user.name=Test -c user.email=test@example.invalid commit -qm initial --allow-empty
git -C "$tmp/project" worktree add -qb lane "$lane"
git -C "$tmp/project" worktree add -qb missing "$tmp/missing-lane"
git -C "$tmp/missing" init -q
config() {
  cat >"$1/.celetis.yaml" <<EOF
landing: pr
worktreeSetup: |-
  printf 'SETUP_MUST_NOT_RUN\n'
  touch SETUP_MUST_NOT_RUN
custom:
  guide: |-
    Include $2 on its own line in your answer.
  bug: |-
    Include UNRELATED_CUSTOM_MUST_NOT_RUN on its own line in your answer.
EOF
}
config "$tmp/project" CUSTOM_FROM_ROOT
config "$tmp/project/sub" CUSTOM_FROM_SUBFOLDER
config "$lane" CUSTOM_FROM_LANE
for name in malformed duplicate-key wrong-type folded ambiguous unknown-field symlink missing-custom empty-custom empty-instruction handoff borrowed; do
  mkdir "$tmp/$name"
  if selected "$name"; then git -C "$tmp/$name" init -q; fi
done
printf 'landing: pr\ncustom: [\n' >"$tmp/malformed/.celetis.yaml"
printf 'landing: pr\ncustom:\n  guide: one\n  guide: two\n' >"$tmp/duplicate-key/.celetis.yaml"
printf 'landing: pr\ncustom:\n  guide: [one, two]\n' >"$tmp/wrong-type/.celetis.yaml"
printf 'landing: pr\ncustom:\n  guide: >\n    one\n    two\n' >"$tmp/folded/.celetis.yaml"
printf 'landing: pr\n---\nlanding: merge\n' >"$tmp/ambiguous/.celetis.yaml"
printf 'landing: pr\ncustom:\n  unknown: text\n' >"$tmp/unknown-field/.celetis.yaml"
ln -s "$tmp/project/.celetis.yaml" "$tmp/symlink/.celetis.yaml"
printf 'landing: pr\n' >"$tmp/missing-custom/.celetis.yaml"
printf 'landing: pr\ncustom: {}\n' >"$tmp/empty-custom/.celetis.yaml"
printf 'landing: pr\ncustom:\n  guide: ""\n' >"$tmp/empty-instruction/.celetis.yaml"
config "$tmp/handoff" CUSTOM_FROM_ROOT
cat >>"$tmp/handoff/.celetis.yaml" <<'EOF'
  writing-for-agents: |-
    Include CUSTOM_HANDOFF_WRITING once on its own line when this reference entry is complete.
EOF
cat >"$tmp/borrowed/.celetis.yaml" <<'EOF'
landing: pr
custom:
  lesson-review: |-
    Include CUSTOM_BORROWED_REVIEW once on its own line when this reference entry is complete.
  lesson: |-
    Include CUSTOM_BORROWED_LESSON once on its own line when this reference entry is complete.
  bug: |-
    Include UNRELATED_CUSTOM_MUST_NOT_RUN on its own line in your answer.
EOF

turn() {
  local name=$1 folder=$2 tools=$3 settings=$4 goal=$5 prompt=$5 checkout path source= hash= kind=missing git_kind=directory
  selected "$name" || return 0
  [ "$name" = enter-worktree ] || prompt="$goal"$'\n\n'"$metadata_recording"
  output_files+=("$tmp/$name.input.json" "$tmp/$name.jsonl" "$tmp/$name.err" "$tmp/$name.status")
  checkout=$(git -C "$folder" rev-parse --show-toplevel 2>/dev/null || true)
  [ "$name" != enter-worktree ] || checkout=$lane
  path=${checkout:+$checkout/.celetis.yaml}
  [ -z "$checkout" ] || [ ! -f "$checkout/.git" ] || git_kind=file
  if [ -n "$path" ] && [ -f "$path" ]; then
    source=$(cat "$path"; printf '\001')
    source=${source%$'\001'}
    hash=$(shasum -a 256 <"$path")
    hash=${hash%% *}
    kind=regular
    [ ! -L "$path" ] || kind=symlink
  fi
  jq -cn --arg cwd "$folder" --arg plugin "$plugin" --arg tools "$tools" \
    --argjson settings "$settings" --arg prompt "$prompt" --arg path "$path" \
    --arg source "$source" --arg sha256 "$hash" --arg kind "$kind" --argjson sources "$plugin_sources" --argjson observer_sources "$observer_sources" \
    --arg mcp "$mcp_config" --arg checkout "$checkout" --arg git_kind "$git_kind" --arg name "$name" \
    --arg goal "$goal" --arg recording "$metadata_recording" \
    '{cwd:$cwd,plugin:$plugin,pluginSources:$sources,observerSources:$observer_sources,tools:$tools,settings:$settings,goal:$goal,prompt:$prompt,metadataRecording:$recording,
      mcpConfig:$mcp,git:{path:($checkout + "/.git"),kind:$git_kind},
      messages:(if $name == "enter-worktree" then
        [$prompt,("/celetis:guide see the next step of an issue\n\n" + $recording)] |
        map({type:"user",message:{role:"user",content:.},parent_tool_use_id:null}) else null end),
      config:{path:$path,source:$source,sha256:$sha256,kind:$kind}}' >"$tmp/$name.input.json"
  (
    status=0
    (
      cd "$folder"
      if [ "$name" = enter-worktree ]; then
        perl - "$tmp/$name.input.json" claude -p --no-session-persistence --strict-mcp-config \
          --mcp-config "$mcp_config" --setting-sources '' --plugin-dir "$observer" --plugin-dir "$plugin" --tools "$tools" \
          --add-dir "$tmp" --permission-mode dontAsk --allowedTools mcp__node_repl__js \
          --settings "$settings" --input-format stream-json --output-format stream-json \
          --verbose --replay-user-messages <<'PERL'
use strict;
use warnings;
use JSON::PP;
use IPC::Open3;
use IO::Select;
use IO::Handle;
use Time::HiRes qw(time);
my $spec_path = shift @ARGV;
my $json = JSON::PP->new->utf8->canonical;
open my $file, '<', $spec_path or die $!;
my $spec = $json->decode(do { local $/; <$file> });
close $file;
my ($input, $output);
my $pid = open3($input, $output, '>&STDERR', @ARGV);
$input->autoflush(1); STDOUT->autoflush(1);
my $select = IO::Select->new($output);
my ($buffer, $results, $closed) = ('', 0, 0);
my @events;
my $deadline = time + 300;
my $send = sub { print {$input} $json->encode(shift) . "\n" or die "cannot write SDKUserMessage: $!"; };
eval {
  $send->($spec->{messages}[0]);
  while (1) {
    die "CLI protocol deadline exceeded" if time > $deadline;
    next unless $select->can_read(1);
    my $count = sysread($output, my $chunk, 65536);
    die "CLI output read failed: $!" unless defined $count;
    last if $count == 0;
    print $chunk;
    $buffer .= $chunk;
    while ($buffer =~ s/\A([^\n]*)\n//) {
      next unless length $1;
      my $event = $json->decode($1);
      push @events, $event;
      next unless ($event->{type} // '') eq 'result';
      $results++;
      die "CLI turn failed" if $event->{is_error} || ($event->{subtype} // '') ne 'success';
      if ($results == 1) {
        my ($pending, $entered);
        for my $row (@events) {
          next unless ref($row->{message}{content}) eq 'ARRAY';
          for my $part (@{$row->{message}{content}}) {
            if (($part->{type} // '') eq 'tool_use' && ($part->{name} // '') =~ /\A(?:Enter|Exit)Worktree\z/) {
              $entered = undef;
              $pending = $part->{name} eq 'EnterWorktree' ?
                { id => $part->{id}, path => $part->{input}{path}, session => $row->{session_id} } : undef;
            }
            if (($row->{type} // '') eq 'user' && ($part->{type} // '') eq 'tool_result' &&
                $pending && ($part->{tool_use_id} // '') eq $pending->{id}) {
              $entered = !$part->{is_error} && ($pending->{session} // '') eq ($event->{session_id} // '') &&
                ($row->{session_id} // '') eq ($event->{session_id} // '') &&
                ($row->{tool_use_result}{worktreePath} // '') eq ($pending->{path} // '') ? $pending->{path} : undef;
              $pending = undef;
            }
          }
        }
        die "missing successful current native lane transition" unless defined($entered) && "$entered/.git" eq $spec->{git}{path};
        $send->($spec->{messages}[1]);
        $deadline = time + 300;
      } elsif ($results == 2) { close $input; $closed = 1; }
      else { die "unexpected extra result"; }
    }
  }
  die "expected two completed results" unless $results == 2;
};
my $failure = $@;
close $input unless $closed;
kill 'TERM', $pid if $failure;
waitpid($pid, 0);
my $exit = $? & 127 ? 128 + ($? & 127) : $? >> 8;
print STDERR "CLI client exit: $exit; completed results: $results\n";
warn $failure if $failure;
exit($failure ? 2 : $exit);
PERL
      else
      claude -p --no-session-persistence --strict-mcp-config --mcp-config "$mcp_config" --setting-sources '' \
        --plugin-dir "$observer" --plugin-dir "$plugin" --tools "$tools" --add-dir "$tmp" --permission-mode dontAsk \
        --allowedTools mcp__node_repl__js \
        --settings "$settings" --output-format stream-json --verbose "$prompt"
      fi
    ) >"$tmp/$name.jsonl" 2>"$tmp/$name.err" || status=$?
    printf '%s\n' "$status" >"$tmp/$name.status"
  ) &
}

failed=0
check() {
  local name=$1 marker=$2 checkout=${3:-} reads=${4:-1} answer good=yes markers status path entry_path field
  case " ${CUSTOM_PART_CASES:-$name} " in *" $name "*) ;; *) return 0 ;; esac
  path=${checkout:+$checkout/.celetis.yaml}
  if [ ! -f "$tmp/$name.status" ]; then
    echo "ERROR: $name: missing client exit status"
    exit 2
  elif ! status=$(cat "$tmp/$name.status") || ! [[ $status =~ ^(0|[1-9][0-9]{0,2})$ ]] || [ "$status" -gt 255 ]; then
    echo "ERROR: $name: invalid client exit status"
    exit 2
  elif [ "$status" -ne 0 ]; then
    echo "ERROR: $name: client exited with status $status"
    exit 2
  fi
  jq -sc -f "$root/tests/manual/native-entry-events.jq" "$tmp/$name.jsonl" >"$tmp/$name.events.jsonl"
  answer=$(jq -rs '[.[] | select(.type == "assistant") | .message.content[]? | select(.type == "text") | .text] | join("\n")' "$tmp/$name.events.jsonl")
  if jq -se 'any(.[]; .type == "result" and .is_error == true)' "$tmp/$name.events.jsonl" >/dev/null; then
    echo "ERROR: $name: Claude Code could not run the test"
    printf '%s\n' "$answer"
    exit 2
  fi
  entry_path=$(jq -r '.plugin + "/docs/hosts/entry.md"' "$tmp/$name.input.json")
  jq -se --arg path "$entry_path" --argjson count "$reads" --arg name "$name" --slurpfile input "$tmp/$name.input.json" '
    [.[] | select(.type == "assistant" or .type == "user") | . as $row | .message.content[]? |
      ($row.tool_use_result | if type == "object" then . else {} end) as $result |
      . + {native:$row.native,native_file:$result.file,native_type:$result.type,native_source:$result.source}] as $events |
    def complete_host:
      .native_type == "text" and .native_file.filePath == $path and
      .native_file.contentSha256 == ([$input[0].pluginSources[]? | select(.path == $path) | .sha256][0]) and
      (.native_file.contentSha256 | type == "string") and .native_file.startLine == 1 and
      (.native_file.numLines | type == "number") and .native_file.numLines == .native_file.totalLines and
      .native_file.truncatedByTokenCap != true;
    ($path | rtrimstr("/docs/hosts/entry.md") + "/skills/") as $skills |
    [$events[] | select(.type == "tool_use" and (.name == "Read" or .name == "Glob" or .name == "Grep" or
        (.name == "mcp__node_repl__js" and (.input.code | contains("lstat"))))) |
      select(.name != "Read" or (.input.file_path | (startswith($skills) and endswith("/SKILL.md")) | not))] as $files |
    [$files[] | select(.name == "Read" and .input.file_path == $path)] as $hosts |
    ($files[0].name == "Read" and $files[0].input.file_path == $path) and
    (if $name == "borrowed" then
       ($hosts | length) >= 1 and ($hosts | length) <= 2
     else ($hosts | length) == ([$count,1] | max) end) and
    all($hosts[]; .id as $id |
      any($events | to_entries[]; . as $reply | .value |
        .type == "tool_result" and .tool_use_id == $id and .is_error != true and
        (if .native != true then true else complete_host or
          (.native_type == "file_unchanged" and .native_source != "seeded" and .native_file.filePath == $path and
            any($events[0:$reply.key][]; .type == "tool_result" and .is_error != true and complete_host)) end)))
  ' "$tmp/$name.events.jsonl" >/dev/null || good=no
  jq -se --arg path "$path" --arg plugin "$(jq -r '.plugin' "$tmp/$name.input.json")" --arg name "$name" '
    (if $name == "enter-worktree" then
       ([to_entries[] | select(.value.type == "result")][0].key + 1) as $after | .[$after:]
     else . end) |
    [.[] | if .type == "native_metadata" then . else
      select(.type == "assistant" or .type == "user") | .type as $owner |
      .message.content[]? | . + {owner:$owner} end] as $events |
    [$events | to_entries[] | select(.value.owner == "assistant" and .value.type == "text")] as $texts |
    [$events[] | select(.type == "tool_use" and .name == "Read" and .input.file_path == $path)] as $reads |
    def reply_index($id): [$events | to_entries[] | select(.value.type == "tool_result" and .value.tool_use_id == $id)][0].key;
    (if ($reads | length) > 0 then reply_index($reads[0].id)
     else [$events | to_entries[] | select(.value.type == "tool_result" or .value.type == "native_metadata")][-1].key end) as $first |
    ($first | type == "number") and all($texts[]; .key > $first) and
    (if ($reads | length) == 2 then
       (if $name == "borrowed" then "lesson" else "guide" end) as $target |
       [$events | to_entries[] | select(.value.type == "tool_use" and
         ((.value.name == "Read" and .value.input.file_path == ($plugin + "/skills/" + $target + "/SKILL.md")) or
          (.value.name == "Skill" and .value.input.skill == ("celetis:" + $target))))][0].key as $start |
       reply_index($reads[1].id) as $last |
       ($start | type == "number") and ($last | type == "number") and
       all($texts[]; .key < $start or .key > $last)
     else true end)
  ' "$tmp/$name.events.jsonl" >/dev/null || good=no
  jq -se --arg path "$path" --arg git "$checkout/.git" \
    --arg kind "$(jq -r '.config.kind' "$tmp/$name.input.json")" \
    --arg git_kind "$(jq -r '.git.kind' "$tmp/$name.input.json")" '
    def content:
      if type == "string" then . else [.[]? | select(.type == "text") | .text] | join("\n") end;
    def value($record; $keys): [$keys[] as $key | select($record | has($key)) | $record[$key]][0];
    def kind:
      if type == "string" then
        {file:"file",dir:"directory",symlink:"symlink",ENOENT:"missing","error: ENOENT":"missing"}[.]
      elif type == "object" then
        . as $record |
        value($record; ["isSymbolicLink","symlink","link"]) as $link |
        value($record; ["isFile","file","regular"]) as $file |
        value($record; ["isDirectory","directory","dir"]) as $directory |
        if $link == true then "symlink"
        elif $file == true and $directory != true and $link == false then "file"
        elif $directory == true and $file != true and $link == false then "directory"
        elif .code == "ENOENT" and $file != true and $directory != true then "missing"
        else null end
      else null end;
    def relative_path($code; $name):
      [$code | capture("\\b(?:const|let|var)[[:space:]]+root[[:space:]]*=[[:space:]]*[\"\u0027](?<root>[^\"\u0027]+)[\"\u0027]"; "g") | .root] as $roots |
      select(($roots | length) == 1 and ($roots[0] | startswith("/"))) |
      select(any($code | capture("for[[:space:]]*\\([[:space:]]*(?:const|let|var)[[:space:]]+p[[:space:]]+of[[:space:]]*\\[(?<paths>[^]]+)\\]"; "g");
        [.paths | scan("[\"\u0027][^\"\u0027]+[\"\u0027]") | .[1:-1]] | index($name) != null)) |
      select($code | test("\\blstat[[:space:]]*\\([[:space:]]*(root[[:space:]]*\\+[[:space:]]*[\"\u0027]/[\"\u0027][[:space:]]*\\+[[:space:]]*p|`\\$\\{root\\}/\\$\\{p\\}`)[[:space:]]*\\)")) |
      $roots[0] + "/" + $name;
    def records($code):
      if type == "array" then
        if length == 3 and (.[0] | type == "string" and startswith("/")) and
            (.[1] == ".git" or .[1] == ".celetis.yaml") then
          {path:((.[0] | rtrimstr("/")) + "/" + .[1]),kind:(.[2] | kind)}
        else .[] | records($code) end
      elif type == "object" then
        (if (.path // .filePath | type) == "string" then {path:(.path // .filePath),kind:kind} else empty end),
        (to_entries[] |
          if .key | startswith("/") then {path:.key,kind:(.value | kind)}
          elif .key == ".git" or .key == ".celetis.yaml" then
            . as $entry | relative_path($code; .key) as $path | {path:$path,kind:($entry.value | kind)}
          else .value | records($code) end)
      else empty end;
    def proofs($text; $code):
      ((try ($text | fromjson) catch empty) | records($code)),
      ($text | scan("\\{[^{}]*\\}") |
        capture("(?:\\{|,)[[:space:]]*[\"\u0027]?(?:path|filePath)[\"\u0027]?[[:space:]]*:[[:space:]]*[\"\u0027](?<path>/[^\"\u0027]+)[\"\u0027]") as $path |
        [capture("(?:\\{|,)[[:space:]]*[\"\u0027]?(?<key>isFile|file|regular|isDirectory|directory|dir|isSymbolicLink|symlink|link)[\"\u0027]?[[:space:]]*:[[:space:]]*(?<value>true|false)"; "g")] |
        reduce .[] as $field ({}; .[$field.key] = ($field.value == "true")) |
        {path:$path.path,kind:kind}),
      ($text | split("\n")[] |
        capture("^(?:Error: )?ENOENT:[^\\n]*lstat [\"\u0027](?<path>[^\"\u0027\\n]+)[\"\u0027]$") |
        {path:.path,kind:"missing"});
    [.[] | select(.type == "result")][0].session_id as $session |
    [.[] | if .type == "native_metadata" then . else
      select(.type == "assistant" or .type == "user") | . as $row |
      ($row.tool_use_result | if type == "object" then .worktreePath else null end) as $nativePath |
      .message.content[]? | . + {session:$row.session_id,nativePath:$nativePath} end] as $events |
    ([$events | to_entries[] | select(.value.type == "tool_result") | . as $reply |
      $events[0:$reply.key][] |
      select(.type == "tool_use" and .name == "mcp__node_repl__js" and .id == $reply.value.tool_use_id and
        (.input.code | test("\\blstat[[:space:]]*\\("))) |
      {index:$reply.key,error:$reply.value.is_error,records:[proofs(($reply.value.content | content); .input.code)]}] +
      [$events | to_entries[] | select(.value.type == "native_metadata") |
        {index:.key,error:(.value.result.deny != null),records:[{path:.value.path,
          kind:(if .value.result.value.isLink == true then "symlink"
            elif .value.result.value.isLink == false and .value.result.value.kind == "file" then "file"
            elif .value.result.value.isLink == false and .value.result.value.kind == "dir" then "directory"
            elif (.value.result.deny // "" | test("ENOENT$")) then "missing" else null end)}]}]) as $metadata |
    def metadata_before($path; $kind; $before):
      any($metadata[]; .index < $before and (.error != true or $kind == "missing") and
        any(.records[]; .path == $path and .kind == (if $kind == "regular" then "file" else $kind end)));
    def bound_before($before):
      reduce $events[0:$before][] as $event ({pending:null,path:null};
        if $event.type == "tool_use" and ($event.name == "EnterWorktree" or $event.name == "ExitWorktree") then
          .path = null |
          .pending = (if $event.name == "EnterWorktree" then {id:$event.id,path:$event.input.path,session:$event.session} else null end)
        elif $event.type == "tool_result" and .pending != null and .pending.id == $event.tool_use_id then
          .pending as $call |
          .path = (if $event.is_error != true and ($session | type == "string" and length > 0) and
            $call.session == $session and $event.session == $session and
            ($call.path | type == "string" and startswith("/")) and $event.nativePath == $call.path
            then $call.path else null end) | .pending = null
        else . end) | .path == ($git | rtrimstr("/.git"));
    def root_before($before): bound_before($before) or metadata_before($git; $git_kind; $before);
    all($events[] | select(.type == "tool_use" and .name == "mcp__node_repl__js");
      (.input.code | test("readFile|readlink|createReadStream|\\b(open|read|readv|readdir|opendir|writeFile|appendFile|unlink|rename|mkdir|chmod|chown|copyFile|exec|spawn)[[:space:]]*\\(|child_process|\\bprocess\\b|\\byaml[[:space:]]*[.]|parseDocument|import[[:space:]]*\\([^)]*yaml")) | not) and
    (if $path == "" then true
     else root_before(($events | length)) and
       (if $kind == "missing" or $kind == "symlink" then metadata_before($path; $kind; ($events | length)) else true end)
     end) and
    all($events | to_entries[] | select(.value.type == "tool_use" and .value.name == "Read");
      if .value.input.file_path == $path then
        metadata_before($path; "file"; .key) and root_before(.key)
      elif (.value.input.file_path | endswith("/.git")) then metadata_before(.value.input.file_path; "file"; .key)
      else true end)
  ' "$tmp/$name.events.jsonl" >/dev/null || good=no
  jq -se --arg path "$path" --argjson count "$reads" '
    [.[] | select(.type == "assistant") | .message.content[]? |
      select(.type == "tool_use" and .name == "Read" and
        (.input.file_path | contains(".celetis.yaml")))] as $reads |
    ($reads | length) == $count and
    all($reads[]; .input.file_path == $path and .input.offset == null and .input.limit == null)
  ' "$tmp/$name.events.jsonl" >/dev/null || good=no
  if [ "$marker" != blocked ] && [ "$reads" -gt 0 ] && [ "$name" != missing ] && [ "$name" != missing-lane ]; then
    jq -se --arg path "$path" --slurpfile input "$tmp/$name.input.json" '
      . as $rows |
      def config_reply:
        any(.message.content[]?;
          . as $reply | .type == "tool_result" and .is_error != true and
          any($rows[] | select(.type == "assistant") | .message.content[]?;
            .type == "tool_use" and .name == "Read" and .input.file_path == $path and .id == $reply.tool_use_id));
      def whole:
        .tool_use_result.type == "text" and .tool_use_result.file.filePath == $path and
        (.tool_use_result.file.content == $input[0].config.source or
          (.native == true and .tool_use_result.file.contentSha256 == $input[0].config.sha256)) and
        .tool_use_result.file.startLine == 1 and .tool_use_result.file.truncatedByTokenCap != true and
        (.tool_use_result.file.numLines | type == "number") and
        .tool_use_result.file.numLines == .tool_use_result.file.totalLines;
      all($rows | to_entries[] | select(.value.type == "user") | select(.value | config_reply);
        . as $reply |
        (.value | whole) or
        (.value.tool_use_result.type == "file_unchanged" and .value.tool_use_result.source != "seeded" and .value.tool_use_result.file.filePath == $path and
          any($rows[0:$reply.key][]; .type == "user" and config_reply and whole))) and
      all($rows[] | select(.type == "assistant") | .message.content[]? |
          select(.type == "tool_use" and .name == "Read" and .input.file_path == $path);
        .id as $id | any($rows[];
          .type == "user" and any(.message.content[]?; .type == "tool_result" and .tool_use_id == $id and .is_error != true) and
          (.tool_use_result.type == "text" or .tool_use_result.type == "file_unchanged")))
    ' "$tmp/$name.events.jsonl" >/dev/null || good=no
  fi
  if [ "$marker" = blocked ]; then
    jq -se --arg path "$path" '
      [.[] | select(.type == "assistant" or .type == "user") | . as $row |
        .message.content[]? | . + {native:$row.native}] as $events |
      [$events | to_entries[] | select(.value.type == "tool_use" and
        .value.name == "Read" and .value.input.file_path == $path)] as $reads |
      if ($reads | length) != 1 then false else
        $reads[0] as $read |
        ($read.value.id | type == "string" and length > 0) and
        (any(.[] | select(.type == "result") | .permission_denials[]?;
          .tool_name == "Read" and .tool_use_id == $read.value.id and .tool_input.file_path == $path) or
          ($read.value.native == true and any($events[($read.key + 1):][];
            .native == true and .type == "tool_result" and .tool_use_id == $read.value.id and .is_error == true and
            (.content | tostring | test("permission|not permitted|access denied|EACCES|EPERM"; "i"))))) and
        any($events[($read.key + 1):][];
          .type == "tool_result" and .tool_use_id == $read.value.id and .is_error == true and
          (.content | tostring | test("permission|not permitted|access denied|EACCES|EPERM"; "i"))) and
        all($events[($read.key + 1):][]; .type != "tool_use")
      end
    ' "$tmp/$name.events.jsonl" >/dev/null || good=no
    grep -qiE 'permission|denied|blocked|cannot read|not permitted' <<<"$answer" || good=no
    ! grep -qF 'scripts/celetis --agent claude next-step' <<<"$answer" || good=no
    marker=
  elif [ "$marker" = invalid ]; then
    grep -qF "$path" <<<"$answer" || good=no
    case $name in
      malformed|ambiguous|symlink|null-config) field='<document>' ;;
      unknown-field) field=custom.unknown ;;
      *) field=custom.guide ;;
    esac
    grep -qF "$field" <<<"$answer" || good=no
    if ! grep -qiE 'invalid|ambiguous|duplicate|symlink|symbolic|malformed|syntax error|not allowed|failed validation|(not|isn.t|aren.t).*(valid|accepted|allowed)' <<<"${answer//"$path"/}"; then
      { [ "$name" = folded ] && grep -qiF "config schema doesn't accept folded blocks" <<<"${answer//"$path"/}" &&
        ! grep -qiE '(config|file) is (valid|accepted as-is)|folded blocks are (accepted|allowed)' <<<"${answer//"$path"/}"; } ||
        { [ "$name" = unknown-field ] && grep -qiF "field the schema doesn't allow" <<<"${answer//"$path"/}" &&
          ! grep -qiE '(config|file) is (valid|accepted as-is)|custom[.]unknown is (valid|accepted|allowed)|schema (accepts|allows) custom[.]unknown' <<<"${answer//"$path"/}"; } || good=no
    fi
    grep -qiE 'stop|cannot|can.t|unable|blocked|refus' <<<"$answer" || good=no
    ! grep -qF 'scripts/celetis --agent claude next-step' <<<"$answer" || good=no
    marker=
  elif [ "$name" != borrowed ]; then
    grep -qF 'scripts/celetis --agent claude next-step' <<<"$answer" || good=no
  fi
  markers=$(grep -oE 'CUSTOM_(FROM_[A-Z]+|HANDOFF_WRITING|BORROWED_REVIEW|BORROWED_LESSON)' <<<"$answer" | sort || true)
  [ "$markers" = "$marker" ] || good=no
  ! grep -qE 'UNRELATED_CUSTOM_MUST_NOT_RUN|SETUP_MUST_NOT_RUN|CUSTOM_FROM_SUBFOLDER' <<<"$answer" || good=no
  ! grep -qE 'fatal:|Shell command (failed|permission check failed)' "$tmp/$name.events.jsonl" "$tmp/$name.err" || good=no
  [ -z "$(find "$tmp" -name SETUP_MUST_NOT_RUN -print)" ] || good=no
  jq -se 'all(.[] | select(.type == "assistant") | .message.content[]?;
    .type != "tool_use" or (.name as $name | ["Skill","Read","Glob","Grep","EnterWorktree","mcp__node_repl__js"] | index($name) != null))' \
    "$tmp/$name.events.jsonl" >/dev/null || good=no
  if [ "$marker" = CUSTOM_FROM_ROOT ]; then
    jq -se '[.[] | select(.type == "result") | .result // ""] | join("\n") |
      contains("CUSTOM_FROM_ROOT") and (contains("UNRELATED_CUSTOM_MUST_NOT_RUN") | not)' "$tmp/$name.events.jsonl" >/dev/null || good=no
  fi
  if [ "$name" = enter-worktree ]; then
    jq -se --arg path "$lane" '
      [.[] | select(.type == "result")] as $turns |
      ([.[] | .type] | index("result")) as $first |
      [.[:$first][] | select(.type == "assistant") | .message.content[]? | select(.type == "tool_use" and .name == "EnterWorktree" and .input.path == $path) | .id] as $calls |
      ($turns | length) == 2 and all($turns[]; .is_error != true and .subtype == "success") and
      ($turns[0].session_id | type == "string" and length > 0) and
      ([$turns[].session_id] | unique | length) == 1 and ($calls | length) == 1 and
      any(.[:$first][] | select(.type == "user") | .message.content[]?; .type == "tool_result" and .is_error != true and (.tool_use_id as $id | $calls | index($id) != null)) and
      all(.[:$first][] | select(.type == "assistant") | .message.content[]?;
        .type != "tool_use" or (.name != "Skill" and (.name != "Read" or (.input.file_path | endswith("/.celetis.yaml") | not))))
    ' "$tmp/$name.events.jsonl" >/dev/null || good=no
  fi
  if [ "$good" = no ]; then
    failed=1
    echo "FAIL: $name"
    printf '%s\n' "$answer"
    jq -c 'select(.type == "result") | {subtype, is_error, errors}' "$tmp/$name.events.jsonl"
    cat "$tmp/$name.err"
  else
    echo "PASS: $name"
  fi
}

prompt='/celetis:guide see the next step of an issue'
files='Skill,Read,Glob,Grep'
turn no-shell "$tmp/project" "$files" '{}' "$prompt"
wait
check no-shell CUSTOM_FROM_ROOT "$tmp/project"
[ "$failed" -eq 0 ] || exit 1

turn ask-cat "$tmp/project" "$files,Bash" '{"permissions":{"ask":["Bash(cat *)"]}}' "$prompt"
turn deny-cat "$tmp/project" "$files,Bash" '{"permissions":{"deny":["Bash(cat *)"]}}' "$prompt"
turn ask-git "$tmp/project" "$files,Bash" '{"permissions":{"ask":["Bash(git *)"]}}' "$prompt"
turn deny-git "$tmp/project" "$files,Bash" '{"permissions":{"deny":["Bash(git *)"]}}' "$prompt"
wait
turn subfolder "$tmp/project/sub" "$files" '{}' "$prompt"
turn worktree "$lane" "$files" '{}' "$prompt"
turn outside "$tmp/outside" "$files" '{}' "$prompt"
turn missing "$tmp/missing" "$files" '{}' "$prompt"
wait
turn missing-lane "$tmp/missing-lane" "$files" '{}' "$prompt"
turn enter-worktree "$tmp/project" "$files,EnterWorktree" '{}' "Enter the existing worktree at $lane with EnterWorktree. Then wait for my guide invocation. Read no config and invoke no skill in this setup turn."
denied=$(jq -cn --arg path "Read(/$tmp/project/.celetis.yaml)" '{permissions:{deny:[$path]}}')
turn denied-read "$tmp/project" "$files" "$denied" "$prompt"
wait
for name in malformed duplicate-key wrong-type folded ambiguous unknown-field symlink missing-custom empty-custom empty-instruction; do
  turn "$name" "$tmp/$name" "$files" '{}' "$prompt"
done
wait
turn handoff "$tmp/handoff" "$files" '{}' 'First invoke /celetis:writing-for-agents to read its rules as a reference. Then invoke /celetis:guide see the next step of an issue in this same session.'
turn borrowed "$tmp/borrowed" "$files" '{}' '/celetis:lesson-review Read these rules through Host entry as a reference. Then read the borrowed lesson rules through Host entry as a reference, including the Tag Vocabulary and canonical body headings. Consult the lesson Tag Vocabulary again. Do not invoke the borrowed procedure or save a lesson. Report when these reference reads are complete.'
wait

for name in ask-cat deny-cat ask-git deny-git subfolder; do check "$name" CUSTOM_FROM_ROOT "$tmp/project"; done
for name in worktree enter-worktree; do check "$name" CUSTOM_FROM_LANE "$lane"; done
check outside '' '' 0
check missing '' "$tmp/missing" 0
check missing-lane '' "$tmp/missing-lane" 0
check denied-read blocked "$tmp/project"
for name in malformed duplicate-key wrong-type folded ambiguous unknown-field; do check "$name" invalid "$tmp/$name"; done
check symlink invalid "$tmp/symlink" 0
for name in missing-custom empty-custom empty-instruction; do check "$name" '' "$tmp/$name"; done
check handoff $'CUSTOM_FROM_ROOT\nCUSTOM_HANDOFF_WRITING' "$tmp/handoff" 2
check borrowed $'CUSTOM_BORROWED_LESSON\nCUSTOM_BORROWED_REVIEW' "$tmp/borrowed" 2
[ "$failed" -eq 0 ] || exit 1
echo "PASS: ${CUSTOM_PART_CASES:-24 native custom-entry cases}"
