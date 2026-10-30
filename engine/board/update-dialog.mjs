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
    if (value && typeof value.target === "string" && typeof value.instance === "string" && (value.recovery === null || typeof value.recovery === "string") && (value.deadline === null || typeof value.deadline === "number" && Number.isFinite(value.deadline)) && typeof value.reloaded === "boolean")
      return value;
  } catch {}
  return null;
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
  let returning = null;
  let refusal = null;
  let checkFailure = null;
  let checking = false;
  let submitting = false;
  let timedOut = false;
  let revisionKey = "";
  let timer;
  let active;
  let epoch = 0;
  const contains = (target) => target instanceof Node && dialog.contains(target);
  controls = { contains };
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
    if (dialog.open)
      return;
    returning = isAutomatic ? opener : document.activeElement;
    dialog.show();
    opener.setAttribute("aria-expanded", "true");
    title.focus();
  };
  const close = (restoreFocus = true) => {
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
    if (restoreFocus || focused)
      (returning?.isConnected && !returning.hidden ? returning : opener).focus();
  };
  const phaseOf = () => timedOut ? "timeout" : refusal ? "update-failed" : pending ? reconnecting ? "restarting" : "updating" : checking ? "checking" : checkFailure ? "check-failed" : response?.update.phase;
  const draw = () => {
    const update = response?.update;
    const phase = phaseOf();
    const busy = phase === "updating" || phase === "restarting";
    const failed = phase === "update-failed" || phase === "check-failed" || phase === "timeout";
    label.textContent = busy ? "Update in progress" : phase === "checking" ? "Checking…" : phase === "check-failed" ? "Update check failed" : failed ? "Update needs attention" : phase === "available" ? "Update available" : phase === "current" ? "Up to date" : "Check for updates";
    const name = !phase || phase === "current" ? "Check for Celetis updates" : `Celetis: ${label.textContent}`;
    opener.setAttribute("aria-label", name);
    opener.title = name;
    opener.setAttribute("aria-disabled", String(phase === "checking"));
    opener.setAttribute("aria-expanded", String(dialog.open));
    if (!phase || phase === "current") {
      if (phase === "current" && live.textContent !== "Up to date")
        live.textContent = "Up to date";
      if (dialog.open)
        close(false);
      return;
    }
    title.textContent = {
      available: "A Celetis update is available",
      checking: "Checking for updates",
      updating: "Updating Celetis",
      restarting: "Restarting the board",
      "update-failed": "The update did not finish",
      "check-failed": "Cannot check for updates",
      timeout: "The board did not return"
    }[phase];
    description.textContent = {
      available: "Update the Celetis program and installed plugins. The board restarts automatically when the update completes.",
      checking: "Checking the configured target and the installed Celetis parts.",
      updating: "The update is running. The board will restart when all components are ready.",
      restarting: "This page will reconnect when the new board confirms the approved revision.",
      "update-failed": "The board has not restarted. Check again before a new attempt.",
      "check-failed": "You can keep using the board. Check again when the source is available.",
      timeout: "The update may have completed. This page could not confirm the new board within 60 seconds."
    }[phase];
    const target = pending?.target ?? offered?.target ?? update?.target;
    const key = JSON.stringify([offered?.parts, target]);
    if (key !== revisionKey) {
      revisionKey = key;
      revisions.replaceChildren();
      if (target && phase !== "check-failed") {
        const installed = el("div", "update-installed");
        for (const part of offered?.parts ?? []) {
          const row = el("span", "", names[part.part]);
          const code = el("code", "", part.installed.slice(0, 12));
          code.title = part.installed;
          row.append(code);
          installed.append(row);
        }
        const available = el("span", "update-target", "Target");
        const code = el("code", "", target.slice(0, 12));
        code.title = target;
        available.append(code);
        revisions.append(installed, available);
      }
    }
    revisions.hidden = phase === "check-failed" || phase === "checking";
    let status = "";
    if (phase === "restarting")
      status = "Reconnecting to the new board…";
    else if (phase === "updating") {
      const stage = update?.stage;
      status = stage ? `${stage.state === "started" ? "Updating" : "Completed"} ${names[stage.part]}…` : "Preparing the update…";
    } else if (phase === "checking")
      status = "Checking for updates…";
    else if (failed)
      status = title.textContent ?? "";
    else
      status = "An update is available.";
    if (progress.textContent !== status)
      progress.textContent = status;
    if (live.textContent !== status)
      live.textContent = status;
    progress.classList.toggle("is-busy", busy || phase === "checking");
    note.textContent = phase === "update-failed" && update ? [
      update.completed.length ? `Completed: ${update.completed.map((part) => names[part]).join(", ")}.` : "",
      update.incomplete.length ? `Incomplete: ${update.incomplete.map((part) => names[part]).join(", ")}.` : ""
    ].filter(Boolean).join(" ") : "Your agent sessions keep running.";
    note.classList.toggle("update-failure", phase === "update-failed");
    diagnostic.textContent = failed ? checkFailure ?? refusal ?? update?.error ?? "" : "";
    diagnostic.hidden = !diagnostic.textContent;
    recovery.textContent = failed ? pending?.recovery ?? update?.recovery ?? "" : "";
    recovery.hidden = !recovery.textContent;
    later.textContent = busy ? "Hide progress" : failed ? "Close" : "Later";
    start.hidden = phase !== "available";
    start.disabled = submitting || checking || !update?.offer;
    check.hidden = !failed;
    check.disabled = checking;
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
    } else if (update.phase === "update-failed" && next.runtime.instance === pending?.instance) {
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
    else if (pending && hidden !== `${pending.instance}:${pending.target}`)
      open(true);
    else if (update.phase === "update-failed" && previousPhase !== "update-failed")
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
  start.addEventListener("click", async () => {
    if (submitting || checking || pending || !response?.update.offer)
      return;
    const offer = response.update.offer;
    stopPoll();
    pending = {
      target: offer.target,
      instance: response.runtime.instance,
      recovery: response.update.recovery,
      deadline: null,
      reloaded: false
    };
    hidden = null;
    refusal = null;
    submitting = true;
    save();
    draw();
    const outcome = await post("/api/update/start", { offerId: offer.id }, "Update failed", { timeout: 1e4 });
    submitting = false;
    if (outcome.status === "rejected") {
      pending = null;
      reconnecting = false;
      refusal = outcome.error;
      save();
      draw();
    } else
      beginReconnect();
    await poll();
  });
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
