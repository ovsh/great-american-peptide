# Expo dev server — operations guide

Scope: how to stop, start, and prove the Metro/Expo dev server for `peptide-lab/mobile` on port 8081.
Written 2026-08-06 after a restart that failed twice in two different ways. Every command and every
number below was run and measured on this machine. Nothing here is from memory.

---

## 1. Quick start

Use a real terminal. This is the only fully reliable form, because the Expo CLI wants a TTY.

```bash
cd ~/Documents/code/archive/peptide-lab/mobile && npx expo start --port 8081
```

Then use the interactive keys in that same terminal: `i` for iOS, `a` for Android, `w` for web,
`r` to reload, `shift+i` to pick a simulator.

If you must start it from a script or an agent, read section 5 first. A background start has two
failure modes, and both are silent.

---

## 2. Why this document exists

On 2026-08-06 a simple "kill it and restart it" took four attempts. Each attempt failed for a
different reason, and no attempt printed a useful error. This is the full sequence.

| # | Step | Command or event | Result | Root cause |
|---|------|------------------|--------|------------|
| 1 | Survey | `lsof -ti:8081` and `ps aux \| grep expo` | Found **two** stale server trees: pid 91382 from 03:39, and pid 12053 from 23:28. Only pid 91382 held the port. | An earlier session left a server alive. A second session started another one, which lost the port race and stayed alive but idle. |
| 2 | Stop | `kill -9 91382 91361 12053 12027` | Port 8081 became free. Confirmed. | Correct. You must kill the `node` child **and** the `npm exec` parent. See section 4. |
| 3 | Start (attempt 1) | `npx expo start --port 8081` as a background job | Server came up, served `/status` = 200, then **died with exit code 1 and an empty error log**. | The interactive Expo CLI reads stdin to drive its keyboard UI. A background job has no TTY and its stdin closes. The CLI treats that end-of-file as "quit". It does not print a reason. |
| 4 | Start (attempt 2) | `CI=1 nohup npx expo start --port 8081 ... &` | Process started, then **skipped the dev server and exited**. Log said: `Port 8081 is running this app in another window (pid 13778)` / `Input is required, but 'npx expo' is in non-interactive mode.` / `Required input: > Use port 8082 instead?` / `Skipping dev server` | `CI=1` fixes failure mode 3, but it also makes the CLI refuse every prompt. The port was taken again, the CLI wanted to ask "use 8082 instead?", could not ask, and gave up. |
| 5 | Investigate | `lsof -nP -iTCP:8081 -sTCP:LISTEN` and `ps -o pid,ppid,lstart,command` | Port 8081 was held by pid 13778, started 23:34:16, command `expo start --port 8081 --clear`. Its grandparent shell wrote to `/tmp/claude-a375-cwd`. | **A different agent session** started its own server in the ~1 minute gap between the free-port check in step 2 and the launch in step 3. The `--clear` flag and the different session marker prove it was not ours. |
| 6 | Verify | Manifest and bundle requests (section 6) | Healthy. Manifest 200. iOS bundle 200, 13.8 MB. | The winning server works. It was left alone rather than killed, because it belongs to another session. |

The lesson from the table: **a free-port check has a short shelf life**, and **both background start
methods fail quietly**. Verify the end state; never assume your own start command is the thing that
is listening.

---

## 3. How to see the true state of port 8081

Run all three. Each one answers a different question.

### 3.1 Which process holds the port?

```bash
lsof -nP -iTCP:8081 -sTCP:LISTEN
```

This gives you the single listening pid. It does not tell you about idle servers that lost the port
race, so it is not sufficient on its own.

### 3.2 Which Expo processes exist at all?

```bash
ps -o pid,ppid,lstart,command -p $(pgrep -f "expo start" | tr '\n' ',' | sed 's/,$//')
```

This shows the whole family, with true start times. Read three things from it:

- **`lstart`** — the real start time. This separates a server from this minute from a leftover from
  last night.
- **`ppid` chains** — a healthy tree is `zsh -c` → `npm exec expo start` → `node .../expo start`.
  All three must go when you stop it.
- **the parent `zsh -c` command line** — an agent-started server carries a marker such as
  `/tmp/claude-a375-cwd`. **The four hex characters identify the session that owns it.** If the
  marker is not yours, another session owns that server. Think before you kill it.

### 3.3 Is the server actually answering?

```bash
curl -s http://localhost:8081/status
```

A healthy server replies `packager-status:running`. Anything else, or an empty reply, means no
usable server, whatever `ps` shows.

---

## 4. How to stop a dev server correctly

`kill` on the port owner alone is not enough. The `npm exec` parent survives, and in some shells it
will respawn or hold the terminal. Kill the whole tree.

### 4.1 Stop every Expo server on the machine

```bash
pkill -f "expo start"; sleep 2; lsof -ti:8081 || echo "port 8081 free"
```

### 4.2 Stop only the tree that holds port 8081

```bash
PID=$(lsof -ti:8081); PPID_=$(ps -o ppid= -p "$PID" | tr -d ' '); kill -9 "$PID" "$PPID_"; sleep 2; lsof -ti:8081 || echo "port 8081 free"
```

### 4.3 Cautions

| Caution | Detail |
|---------|--------|
| Check the TTY column first | In the incident, one of the killed trees (pid 12053) ran in the **foreground of a real terminal, `s004`**. That was a person's own window, not an orphan. `ps aux` shows `S+` and a `tty` for these. Killing one makes somebody's terminal drop back to a prompt with no warning. |
| Check the session marker first | See section 3.2. Do not kill another agent session's server unless you mean to take the port from it. |
| Always confirm the port is free | Add `; sleep 2; lsof -ti:8081 \|\| echo "port 8081 free"` to the end of any kill command. The port does not free instantly. |
| The free port will not stay free | On a machine with several agent sessions, the gap between "free" and your own start is a real race. In the incident that gap was about one minute, and another session won it. |

---

## 5. How to start a dev server that stays alive

Pick the row that matches your situation. There is no method that is both fully interactive and fully
background-safe.

| Method | Command | Stays alive without a TTY? | Hot reload / Fast Refresh? | Interactive keys (`i`/`a`/`w`)? | Behaviour when port 8081 is busy | Use it when |
|--------|---------|----------------------------|----------------------------|-------------------------------|----------------------------------|-------------|
| **Real terminal (preferred)** | `cd ~/Documents/code/archive/peptide-lab/mobile && npx expo start --port 8081` | Not applicable — it has a TTY | **Yes** | **Yes** | Asks you: "Use port 8082 instead?" | You are a person at a keyboard, and you will edit code. This is the normal way. |
| **Background, interactive CLI** | `npx expo start --port 8081` as a background job | **No.** Dies with exit code 1 and an empty log when stdin closes. | Not applicable | No | Asks a question that nobody can answer | Never. This is failure mode 3 above. |
| **Background, non-interactive** | `CI=1 nohup npx expo start --port 8081 > /tmp/expo.log 2>&1 < /dev/null & disown` | **Yes** | **No — watch mode is off (L11)** | No | **Silently skips the dev server and exits.** Log says `Skipping dev server`. | Smoke tests, one-shot bundle checks, and agent runs. **Not for a code-edit loop.** Prove the port is free first, and read the log after the start. |

### 5.1 The safe background recipe

Free the port, start detached, then poll until the server answers. Do not trust the start command's
own exit; read `/status`.

```bash
pkill -f "expo start"; sleep 2
cd ~/Documents/code/archive/peptide-lab/mobile && CI=1 nohup npx expo start --port 8081 > /tmp/expo-8081.log 2>&1 < /dev/null & disown
for i in $(seq 1 30); do s=$(curl -s http://localhost:8081/status); [ -n "$s" ] && { echo "UP after ${i}s: $s"; break; }; sleep 1; done; tail -20 /tmp/expo-8081.log
```

### 5.2 Why `CI=1` is required, and what it costs

`CI=1` stops the CLI from opening its keyboard UI, so the CLI no longer needs stdin and no longer
quits at end-of-file. That is the fix for failure mode 3. It has two costs, and the second one is
easy to miss.

**Cost 1 — the CLI can no longer ask you anything.** Every prompt becomes a hard stop. The port
prompt is the one you will meet: with `CI=1` and a busy port, the server **does not start at all**,
and the only sign is one line in the log. There is no non-zero exit code that says "port busy" in a
way you would notice. **Always read the log after a `CI=1` start.**

**Cost 2 — watch mode and reloads are off.** The startup log says it plainly:

```
Metro is running in CI mode, reloads are disabled. Remove CI=true to enable watch mode.
```

The server bundles and serves correctly, so a device can load the app. But Metro no longer watches
the file system. **Edits to source files will not appear in the running app**, and there is no Fast
Refresh. This makes a `CI=1` server good for a smoke test or a one-shot bundle check, and wrong for
a code-edit loop. For real development, use a real terminal (section 1). To pick up a code change on
a `CI=1` server, you must stop it and start it again.

---

## 6. How to prove the server works

`/status` proves a process is listening. It does **not** prove the app bundles. Do the full check
when it matters.

### 6.1 The trap: `/index.bundle` returns 404, and that is correct

This app uses **expo-router**. There is no `index.js` at the project root. So the classic React
Native health-check URL fails:

```
GET /index.bundle?platform=ios&dev=true   →   HTTP 404
{"type":"UnableToResolveError","targetModuleName":"./index",
 "message":"Unable to resolve module ./index ... None of these files exist: index(.ios.ts|.native.ts|.ts|...)"}
```

**This 404 is not a broken server.** It is the wrong URL for this project. The real entry point is
`node_modules/expo-router/entry`. Do not chase this error.

### 6.2 The correct three-step health check

| Step | What it proves | Command |
|------|----------------|---------|
| 1. Packager status | A process is listening and Metro is up | `curl -s http://localhost:8081/status` |
| 2. Manifest | Expo serves a valid app manifest for the platform | `curl -s -o /dev/null -w "http=%{http_code} bytes=%{size_download}\n" -H "expo-platform: ios" http://localhost:8081/` |
| 3. Real bundle | Metro transforms and bundles the whole app without an error | Take `launchAsset.url` from the manifest, then `curl` it (see below) |

```bash
B=$(curl -s -H "expo-platform: ios" http://localhost:8081/ | python3 -c "import sys,json;print(json.load(sys.stdin)['launchAsset']['url'])")
echo "bundleUrl: $B"
curl -s -o /dev/null -w "http=%{http_code} bytes=%{size_download} time=%{time_total}s\n" --max-time 300 "$B"
```

Always read the bundle URL from the manifest. Do not write it by hand. It carries the transform flags
this project needs (`transform.routerRoot=app`, `transform.reactCompiler=true`, Hermes settings), and
a hand-written URL will bundle something that is not what the app actually loads.

---

## 7. Learnings, in full

**L1 — The interactive Expo CLI needs a TTY, and it dies without one, silently.**
Start it as a background job and it exits with code 1 and an empty error log as soon as its stdin
closes. There is no message. If a background `expo start` "fails for no reason", this is why. Fix it
with `CI=1`.

**L2 — `CI=1` trades one silent failure for another.**
It keeps the server alive without a TTY, but it turns every CLI prompt into a hard stop. With a busy
port the server does not start, and the only evidence is `Skipping dev server` in the log. Read the
log after every `CI=1` start.

**L3 — Killing the port owner is not the same as stopping the server.**
The tree is `zsh -c` → `npm exec expo start` → `node .../expo start`. `lsof -ti:8081` names only the
`node` child. Kill the parent too, or use `pkill -f "expo start"`.

**L4 — `lsof -ti:8081` under-reports.**
A second Expo server that lost the port race keeps running, holds memory and file watches, and never
appears in a port query. Only `pgrep -f "expo start"` finds it. In the incident there were two such
trees, one of them about 20 hours old.

**L5 — Port 8081 is contested, and a free-port check goes stale in seconds.**
Several agent sessions run on this machine. In the incident, another session claimed the port in the
gap between the check and the start. Re-check the owner after you start, not only before.

**L6 — The parent shell's command line tells you who owns a server.**
An agent-started tree carries a marker such as `/tmp/claude-a375-cwd` in its `zsh -c` parent. The hex
id identifies the session. Use it before you kill anything you did not start. A `--clear` flag, or
any flag you did not pass, is a second strong hint that the server is not yours.

**L7 — `/index.bundle` is the wrong health check for this app.**
expo-router means no root `index.js`, so that URL always 404s with `UnableToResolveError` on
`./index`. Use the manifest's `launchAsset.url`. See section 6.

**L8 — A 200 from `/status` is a weak signal.**
It proves a listener exists. It does not prove the app compiles. Only a real bundle request does
that. The distinction matters: in the incident the server answered `/status` correctly and then died
seconds later.

**L9 — Version drift warnings at startup are noise, not failure.**
The server prints them and then works normally. Current drift is recorded in section 9.

**L10 — Do not report a server as "started by me" without checking, and do not rely on one you did
not start.**
In the incident the healthy server was another session's. The right report names the true owner,
because that server's lifetime is tied to a session you do not control, and its interactive keys
belong to a terminal you cannot reach. This was proved about 15 minutes later: **that server died on
its own**, with no action from this session, and took port 8081 down with it. A borrowed server is a
temporary server.

**L11 — `CI=1` disables watch mode, so code edits do not reach the app.**
The startup log says `Metro is running in CI mode, reloads are disabled.` The server still bundles
and serves correctly, so the app loads and runs. But Metro stops watching the file system, and there
is no Fast Refresh. A `CI=1` server is right for a smoke test and wrong for a code-edit loop. This is
the strongest reason to prefer a real terminal for development work. See section 5.2.

**L12 — `nohup ... & disown` reparents the tree to pid 1.**
A terminal-started server has three levels (`zsh -c` → `npm exec` → `node`). A detached server has
two, and its `npm exec` parent shows `PPID 1`. Both levels still need to go when you stop it, and
`pkill -f "expo start"` handles either shape. Do not expect the three-level tree from section 3.2
when the server was started detached.

---

## 8. Troubleshooting

| Symptom | Most likely cause | Fix |
|---------|-------------------|-----|
| Background `expo start` exits with code 1, and the log has no error | No TTY; stdin closed; the interactive CLI quit (L1) | Restart with `CI=1` and `< /dev/null`. See section 5.1. |
| Log says `Skipping dev server` and `Input is required, but 'npx expo' is in non-interactive mode` | `CI=1` plus a busy port. The CLI wanted to ask about port 8082 (L2) | Free the port (section 4), then start again. Or use a different port on purpose. |
| Log says `Port 8081 is running this app in another window (pid N)` | Another server already holds the port | `ps -o pid,ppid,lstart,command -p N` and read the session marker (section 3.2) before you kill it. |
| Port 8081 was free, but your server is not the one listening | Another session won the race (L5) | Identify the owner with section 3.2, then decide: take the port, or use the running server. |
| `/index.bundle` returns 404 `UnableToResolveError: ./index` | Wrong URL for an expo-router app (L7) | Use the manifest `launchAsset.url`. See section 6.2. |
| `/status` answers, but the app will not load on a device | Only the listener was checked, not the bundle (L8) | Run the full three-step health check in section 6.2. |
| The port frees, then re-fills by itself | An `npm exec` parent survived the kill (L3) | `pkill -f "expo start"`, then confirm the port is free. |
| **You edit a source file, but the app does not change. No Fast Refresh.** | The server runs with `CI=1`, so watch mode is off (L11) | Check the log for `Metro is running in CI mode, reloads are disabled.` Stop the server and start it from a real terminal without `CI=1`. |
| A server that worked ten minutes ago is gone, and you did not stop it | It belonged to another session, and that session ended (L10) | Start your own with section 5.1. Do not build a workflow on a server you did not start. |
| Device on the LAN cannot connect | Wrong host. `localhost` does not work from a phone | Use `exp://<LAN-IP>:8081`. Get the IP with `ipconfig getifaddr en0`. |
| The startup log lists package version mismatches | Normal drift (L9) | Ignore it, or run `npx expo install --check`. |

---

## 9. Reference values measured on 2026-08-06

These are real measurements from this machine, kept so a future run has something to compare against.

| Item | Value |
|------|-------|
| Project path | `/Users/ovsh/Documents/code/archive/peptide-lab/mobile` |
| Port | 8081 |
| Local URL | `http://localhost:8081` |
| LAN URL (Expo Go) | `exp://192.168.1.72:8081` — get the IP with `ipconfig getifaddr en0` |
| `/status` reply | `packager-status:running` |
| Manifest reply (iOS) | HTTP 200. 3417 bytes from the interactive server, 3270 bytes from the `CI=1` server. The small difference is normal; the manifest carries per-run fields. |
| iOS bundle reply | HTTP 200, **13,792,737 bytes** (13.8 MB). Measured twice, on two different servers, with the same byte count. 0.08 s and 0.76 s, both with a warm Metro cache. |
| iOS bundle URL | `http://127.0.0.1:8081/node_modules/expo-router/entry.bundle?platform=ios&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.bytecode=1&transform.routerRoot=app&transform.reactCompiler=true&unstable_transformProfile=hermes-stable` |
| Startup banner | `React Compiler enabled` |
| Package drift at the time | `expo@54.0.34` → expected `~54.0.36`; `expo-font@14.0.11` → expected `~14.0.12`; `expo-router@6.0.23` → expected `~6.0.24` |

Both bundle times are **warm** results. The first server had run with `--clear` about ten minutes
before, and the second re-used Metro's on-disk cache from it. A true cold bundle of this app, after
`--clear` or a cache wipe, takes far longer. Do not use 0.08 s or 0.76 s as a baseline for a fresh
start.

The identical byte count (13,792,737) across two separate servers is the useful signal here. It shows
the bundle is deterministic, so a future run that produces a very different size is worth a look.

---

## 10. Open items

| Item | Note |
|------|------|
| Package drift | Three packages are behind the versions Expo SDK 54 expects (section 9). The server runs correctly with them. Run `npx expo install --check` to fix, and re-test after. |
| Port contention between sessions | There is no lock or convention that stops two agent sessions from fighting over 8081. Until there is one, section 3.2 is the manual guard. |
| Related native-build notes | `DECISIONS.md` records a separate iOS build problem from the same night (an `actool` handshake failure, and a `xcode-select` path that disables the simulator panel). That is a build problem, not a dev-server problem, but the two get confused because both end in "the app will not run". Keep them separate. |
