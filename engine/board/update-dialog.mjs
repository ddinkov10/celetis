// engine/board/update-dialog.ts
import { $, el, icon, post } from "./ui.mjs";
var session = {
  get(key) {
    try {
      return sessionStorage.getItem(`agent-board:update-${key}`);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      if (value === null)
        sessionStorage.removeItem(`agent-board:update-${key}`);
      else
        sessionStorage.setItem(`agent-board:update-${key}`, value);
    } catch {}
  }
};
var readPending = () => {
  try {
    const value = JSON.parse(session.get("pending") ?? "null");
    if (value && (value.kind === "update" || value.kind === "restart") && typeof value.target === "string" && typeof value.instance === "string" && (value.recovery === null || typeof value.recovery === "string") && (value.deadline === null || typeof value.deadline === "number" && Number.isFinite(value.deadline)) && typeof value.reloaded === "boolean")
      return value;
  } catch {}
  return null;
};
var isRestartAnswer = (value) => {
  const answer = value;
  return typeof answer?.target === "string" && typeof answer.runtime?.revision === "string" && typeof answer.runtime.instance === "string";
};
var names = { claude: "Claude Code plugin", codex: "Codex plugin", program: "Celetis program" };
var reconnecting = false;
var isReconnecting = () => reconnecting;
var controls;
function setupUpdates() {
  if (controls)
    return controls;
  const dialog = $("update-dialog");
  const opener = $("update-open");
  const label = opener.querySelector(".label");
  opener.prepend(icon("refresh"));
  const title = $("update-title");
  const description = $("update-description");
  const revisions = $("update-revisions");
  const progress = $("update-progress");
  const live = $("update-status");
  const note = $("update-note");
  const diagnostic = $("update-error");
  const recovery = $("update-recovery");
  const later = $("update-later");
  const start = $("update-start");
  const check = $("update-check");
  let response = null;
  let offered = null;
  let pending = readPending();
  let deferred = session.get("deferred");
  let hidden = session.get("hidden");
  let restartShown = session.get("restart-shown");
  let returning = null;
  let refusal = null;
  let checkFailure = null;
  let checking = false;
  let submitting = null;
  let timedOut = false;
  let revisionKey = "";
  let announced = "";
  let announcing;
  let timer;
  let active;
  let epoch = 0;
  const contains = (target) => target instanceof Node && dialog.contains(target);
  const save = () => session.set("pending", pending ? JSON.stringify(pending) : null);
  const beginReconnect = () => {
    if (!pending)
      return;
    if (pending.deadline === null) {
      pending.deadline = Date.now() + 60000;
      save();
    }
    reconnecting = true;
    document.dispatchEvent(new Event("board-reconnect"));
  };
  if (pending)
    beginReconnect();
  const open = (isAutomatic = false) => {
    if (isAutomatic) {
      if (dialog.open)
        return;
      returning = opener;
      dialog.setAttribute("open", "");
    } else {
      returning = document.activeElement;
      if (!dialog.open)
        dialog.show();
      title.focus();
    }
    opener.setAttribute("aria-expanded", "true");
  };
  const close = () => {
    const focused = contains(document.activeElement);
    if (response?.update.offer && !pending) {
      deferred = response.update.offer.id;
      session.set("deferred", deferred);
    } else if (pending) {
      hidden = `${pending.instance}:${pending.target}`;
      session.set("hidden", hidden);
    }
    dialog.close();
    draw();
    if (focused)
      (returning?.isConnected && !returning.hidden ? returning : opener).focus();
  };
  const dismiss = () => {
    if (!dialog.open)
      return false;
    close();
    return true;
  };
  controls = { contains, dismiss };
  const kindOf = () => submitting ?? pending?.kind ?? refusal?.kind ?? "update";
  const phaseOf = () => timedOut ? "timeout" : refusal ? refusal.kind === "restart" ? "restart-refused" : "update-failed" : submitting === "restart" ? "restarting" : pending ? reconnecting || pending.kind === "restart" ? "restarting" : "updating" : checking ? "checking" : checkFailure ? "check-failed" : response?.update.phase;
  const announce = (key, status) => {
    if (key === announced)
      return;
    announced = key;
    clearTimeout(announcing);
    if (live.textContent !== status)
      live.textContent = status;
    else {
      live.textContent = "";
      announcing = setTimeout(() => {
        live.textContent = status;
      }, 100);
    }
  };
  const draw = () => {
    const focused = document.activeElement;
    const update = response?.update;
    const phase = phaseOf();
    const kind = kindOf();
    const busy = phase === "updating" || phase === "restarting";
    const failed = phase === "update-failed" || phase === "restart-refused" || phase === "check-failed" || phase === "timeout";
    label.textContent = busy ? kind === "restart" ? "Restarting…" : "Update in progress" : phase === "checking" ? "Checking…" : phase === "check-failed" ? "Update check failed" : failed ? kind === "restart" ? "Restart needs attention" : "Update needs attention" : phase === "restart-needed" ? "Restart needed" : phase === "available" ? "Update available" : phase === "updated" ? "Update completed" : phase === "current" ? "Up to date" : "Check for updates";
    const name = `Celetis: ${label.textContent}`;
    opener.setAttribute("aria-label", name);
    opener.title = name;
    opener.classList.toggle("is-accent", phase === "available" || phase === "restart-needed");
    opener.setAttribute("aria-disabled", String(phase === "checking"));
    opener.setAttribute("aria-expanded", String(dialog.open));
    const isRestart = kind === "restart" || phase === "restart-needed";
    const target = pending?.target ?? (isRestart ? null : offered?.target) ?? update?.target ?? null;
    if (!phase || phase === "current") {
      if (phase === "current")
        announce(JSON.stringify([phase, target]), "Up to date");
      if (dialog.open)
        close();
      return;
    }
    title.textContent = {
      available: "A Celetis update is available",
      "restart-needed": "Restart the daemon",
      checking: "Checking for updates",
      updating: "Updating Celetis",
      restarting: "Restarting the daemon",
      updated: "Update completed",
      "update-failed": "The update did not finish",
      "restart-refused": "The daemon did not restart",
      "check-failed": "Cannot check for updates",
      timeout: "The daemon did not return"
    }[phase];
    description.textContent = {
      available: "Update the Celetis program and the installed plugins. The daemon restarts when the update completes.",
      "restart-needed": "The daemon runs an older Celetis program than the installed one. Restart the daemon to use the installed program.",
      checking: "Checking the configured target and the installed Celetis parts.",
      updating: "The update is running. The daemon restarts when all parts are ready.",
      restarting: "This page reconnects when the new daemon answers.",
      updated: "The update completed. This daemon runs from a checkout, so it does not restart.",
      "update-failed": "The daemon has not restarted. Check again before a new attempt.",
      "restart-refused": "The daemon still runs its program. Check again before a new attempt.",
      "check-failed": "You can keep using the board. Check again when the source is available.",
      timeout: `The ${kind} may have completed. This page could not reach the new daemon within 60 seconds.`
    }[phase];
    const rows = !target ? [] : isRestart ? [...response ? [["Daemon", response.runtime.revision]] : [], ["Installed", target]] : [
      ...(offered?.parts ?? []).map((part) => [names[part.part], part.installed]),
      ["Target", target]
    ];
    const key = JSON.stringify(rows);
    if (key !== revisionKey) {
      revisionKey = key;
      revisions.replaceChildren(...rows.flatMap(([name, revision]) => {
        const code = el("code", "", revision.slice(0, 12));
        code.title = revision;
        return [el("span", "", name), code];
      }));
    }
    revisions.hidden = phase === "check-failed" || phase === "checking";
    let status = "";
    if (phase === "restarting")
      status = "Reconnecting to the new daemon…";
    else if (phase === "restart-needed")
      status = "The daemon runs an older Celetis program.";
    else if (phase === "updating") {
      const stage = update?.stage;
      status = stage ? `${stage.state === "started" ? "Updating" : "Completed"} ${names[stage.part]}…` : "Preparing the update…";
    } else if (phase === "checking")
      status = "Checking for updates…";
    else if (failed || phase === "updated")
      status = title.textContent ?? "";
    else
      status = "An update is available.";
    if (progress.textContent !== status)
      progress.textContent = status;
    announce(JSON.stringify([phase, kind, target, status]), status);
    progress.classList.toggle("is-busy", busy || phase === "checking");
    note.textContent = phase === "update-failed" && update ? [
      update.completed.length ? `Completed: ${update.completed.map((part) => names[part]).join(", ")}.` : "",
      update.incomplete.length ? `Incomplete: ${update.incomplete.map((part) => names[part]).join(", ")}.` : ""
    ].filter(Boolean).join(" ") : "Your agent sessions keep running in their tabs.";
    note.classList.toggle("update-failure", phase === "update-failed");
    diagnostic.textContent = failed ? checkFailure ?? refusal?.line ?? update?.error ?? "" : "";
    diagnostic.hidden = !diagnostic.textContent;
    recovery.textContent = failed && phase !== "restart-refused" ? pending?.recovery ?? update?.recovery ?? "" : "";
    recovery.hidden = !recovery.textContent;
    later.textContent = busy ? "Hide progress" : failed || phase === "updated" ? "Close" : "Later";
    start.hidden = phase !== "available" && phase !== "restart-needed";
    start.textContent = phase === "restart-needed" ? "Restart" : "Update and restart";
    start.disabled = submitting !== null || checking || phase === "available" && !update?.offer;
    check.hidden = !failed;
    check.disabled = checking;
    if (focused === start && start.hidden || focused === check && check.hidden)
      title.focus();
    opener.setAttribute("aria-expanded", String(dialog.open));
  };
  const expire = () => {
    if (!pending?.deadline || Date.now() < pending.deadline)
      return false;
    timedOut = true;
    clearTimeout(timer);
    active?.abort();
    draw();
    open(true);
    return true;
  };
  const accept = (next) => {
    if (expire())
      return;
    if (!pending && JSON.stringify(response) === JSON.stringify(next))
      return;
    const previousPhase = response?.update.phase;
    response = next;
    const update = next.update;
    if (update.offer)
      offered = update.offer;
    if (pending && next.runtime.revision === pending.target && next.runtime.instance !== pending.instance) {
      if (pending.reloaded) {
        pending = null;
        reconnecting = false;
        save();
        document.dispatchEvent(new Event("board-connected"));
      } else {
        pending.reloaded = true;
        save();
        location.reload();
        return;
      }
    }
    if (update.phase === "updating" || update.phase === "restarting") {
      refusal = null;
      if (!pending && update.target) {
        pending = {
          kind: update.completed.length || update.incomplete.length ? "update" : "restart",
          target: update.target,
          instance: next.runtime.instance,
          recovery: update.recovery,
          deadline: null,
          reloaded: false
        };
        save();
      }
      if (pending && update.recovery) {
        pending.recovery = update.recovery;
        save();
      }
    } else if ((update.phase === "update-failed" || update.phase === "updated") && next.runtime.instance === pending?.instance) {
      if (pending.kind === "restart")
        refusal = { kind: "restart", line: update.error ?? "" };
      pending = null;
      reconnecting = false;
      save();
      document.dispatchEvent(new Event("board-connected"));
    }
    if (pending) {
      if (update.phase === "updating" && update.target === pending.target && next.runtime.instance === pending.instance) {
        if (reconnecting) {
          pending.deadline = null;
          reconnecting = false;
          save();
          document.dispatchEvent(new Event("board-connected"));
        }
      } else
        beginReconnect();
    }
    if (expire())
      return;
    draw();
    if (update.phase === "available" && !pending && !refusal && !checking && update.offer?.id !== deferred)
      open(true);
    else if (phaseOf() === "restart-needed" && update.target !== restartShown) {
      restartShown = update.target;
      session.set("restart-shown", restartShown);
      open(true);
    } else if (pending && hidden !== `${pending.instance}:${pending.target}`)
      open(true);
    else if (update.phase === "update-failed" && previousPhase !== "update-failed")
      open(true);
    else if (update.phase === "updated" && previousPhase !== undefined && previousPhase !== "updated")
      open(true);
  };
  const schedule = () => {
    clearTimeout(timer);
    if (!timedOut)
      timer = setTimeout(poll, pending ? 1000 : 5000);
  };
  const poll = async (forCheck = false) => {
    if (expire())
      return;
    const request = ++epoch;
    const controller = new AbortController;
    active = controller;
    const timeout = setTimeout(() => controller.abort(), Math.min(5000, pending?.deadline ? Math.max(1, pending.deadline - Date.now()) : 5000));
    try {
      const result = await fetch("/api/update", { cache: "no-store", signal: controller.signal });
      if (!result.ok)
        throw new Error("The board server does not answer.");
      const next = await result.json();
      if (!next.runtime || !next.update)
        throw new Error("The update status could not be read.");
      if (request === epoch) {
        if (forCheck)
          checking = false;
        accept(next);
        draw();
      }
    } catch {
      if (request !== epoch)
        return;
      if (forCheck || !pending && response?.update.phase === "checking") {
        checking = false;
        checkFailure ??= "The update status could not be read. Check again.";
      }
      if (pending) {
        beginReconnect();
      }
      draw();
    } finally {
      clearTimeout(timeout);
      if (request === epoch) {
        expire();
        schedule();
      }
    }
  };
  const stopPoll = () => {
    ++epoch;
    clearTimeout(timer);
    active?.abort();
  };
  opener.addEventListener("click", () => {
    const phase = phaseOf();
    if (phase === "checking")
      return;
    if (!phase || phase === "current") {
      requestCheck();
      return;
    }
    if (pending) {
      hidden = null;
      session.set("hidden", null);
    }
    open();
    draw();
  });
  later.addEventListener("click", () => close());
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  });
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    if (contains(document.activeElement))
      close();
  });
  const approve = async () => {
    if (submitting || checking || pending || !response?.update.offer)
      return;
    const offer = response.update.offer;
    stopPoll();
    pending = {
      kind: "update",
      target: offer.target,
      instance: response.runtime.instance,
      recovery: response.update.recovery,
      deadline: null,
      reloaded: false
    };
    hidden = null;
    refusal = null;
    submitting = "update";
    save();
    draw();
    const outcome = await post("/api/update/start", { offerId: offer.id }, "Update failed", { timeout: 1e4 });
    submitting = null;
    if (outcome.status === "rejected") {
      pending = null;
      reconnecting = false;
      refusal = { kind: "update", line: outcome.error };
      save();
      draw();
    } else
      beginReconnect();
    await poll();
  };
  const restart = async () => {
    if (submitting || checking || pending || phaseOf() !== "restart-needed" || !response)
      return;
    const shown = response;
    stopPoll();
    hidden = null;
    refusal = null;
    submitting = "restart";
    draw();
    const request = {};
    const outcome = await post("/api/update/restart", request, "Restart failed", { timeout: 1e4 });
    submitting = null;
    if (outcome.status !== "accepted" && outcome.error !== undefined) {
      refusal = { kind: "restart", line: outcome.error };
      draw();
    } else {
      const answer = outcome.status === "accepted" && isRestartAnswer(outcome.body) ? outcome.body : null;
      pending = {
        kind: "restart",
        target: answer?.target ?? shown.update.target ?? "",
        instance: answer?.runtime.instance ?? shown.runtime.instance,
        recovery: shown.update.recovery,
        deadline: null,
        reloaded: false
      };
      save();
      beginReconnect();
    }
    await poll();
  };
  start.addEventListener("click", () => void (phaseOf() === "restart-needed" ? restart() : approve()));
  const requestCheck = async () => {
    if (phaseOf() === "checking" || pending && !timedOut)
      return;
    if (timedOut) {
      pending = null;
      timedOut = false;
      reconnecting = false;
      save();
      document.dispatchEvent(new Event("board-connected"));
    }
    checking = true;
    refusal = null;
    checkFailure = null;
    stopPoll();
    draw();
    const result = await post("/api/update/check", {}, "Update check failed");
    if (!result)
      checkFailure = "The update check could not start. Check again.";
    await poll(true);
  };
  check.addEventListener("click", () => void requestCheck());
  draw();
  poll();
  return controls;
}
export {
  isReconnecting,
  setupUpdates
};
