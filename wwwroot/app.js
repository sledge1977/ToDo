// Application state is intentionally kept small. PostgreSQL remains the source of truth.
let lists = [];
let currentId = null;
let editing = null;
let registerMode = false;
let currentUserEmail = "";
let language = "en";
let offlineChanges = JSON.parse(localStorage.todoOfflineQueue || "[]");
let isOnline = navigator.onLine;
let cachedLists = JSON.parse(localStorage.todoLists || "[]");

const $ = (selector) => document.querySelector(selector);

// All user-facing client text lives in this dictionary. English is the fallback language.
const translations = {
  en: {
    "common.add": "Add",
    "common.cancel": "Cancel",
    "common.close": "Close",
    "common.create": "Create",
    "common.email": "Email",
    "common.loading": "Loading …",
    "common.name": "Name",
    "common.password": "Password",
    "common.save": "Save",
    "sync.online": "Online",
    "sync.offline": "Offline mode",
    "sync.syncing": "Syncing …",
    "sync.pending": "{count} offline changes pending",
    "sync.pending.one": "1 offline change pending",
    "auth.tagline": "Your tasks. Together, without distractions.",
    "auth.login": "Sign in",
    "auth.register": "Create account",
    "auth.registerPrompt": "No account yet? Register",
    "auth.loginPrompt": "Already have an account? Sign in",
    "auth.logout": "Sign out",
    "auth.logoutDescription": "End the current session",
    "user.menu": "User menu",
    "language.label": "Language",
    "theme.toggle": "Change appearance",
    "theme.description": "Switch between light and dark mode",
    "search.placeholder": "Search",
    "search.label": "Search tasks",
    "list.new": "＋ New list",
    "list.yourList": "YOUR LIST",
    "list.noListsTitle": "No lists yet",
    "list.noListsDescription": "Create your first list before adding tasks.",
    "list.createFirst": "Create first list",
    "list.allLists": "Lists",
    "list.selectTitle": "Select a list",
    "list.selectDescription":
      "Select a list in the sidebar to view and edit its tasks.",
    "list.icon": "Icon",
    "list.namePlaceholder": "e.g. Garden",
    "list.options": "List options",
    "list.ownInfo": "Own list · shared with {count} {people}",
    "list.sharedInfo": "List shared with you",
    "list.delete": "Delete list",
    "list.deleteDescription": "Permanently delete the list and all tasks",
    "list.deleteConfirm": "Permanently delete “{name}” and all its tasks?",
    "task.newPlaceholder": "Add a new task",
    "task.empty": "No matching task yet. Start with something small.",
    "task.progress": "{done} of {total} completed",
    "task.edit": "Edit task",
    "task.title": "Title",
    "task.due": "Due date",
    "task.repeat": "Repeat",
    "task.notes": "Notes",
    "task.notesPlaceholder": "Optional note",
    "task.noteTag": "Note",
    "task.subtaskPrompt": "Subtask",
    "task.addSubtask": "Add subtask",
    "task.editAction": "Edit task",
    "task.deleteAction": "Delete task",
    "task.deleteSubtask": "Delete subtask",
    "task.deleteBlocked": "Tasks with subtasks cannot be deleted",
    "task.completeBlocked": "Complete all subtasks first",
    "task.starAdd": "Mark with a star",
    "task.starRemove": "Remove star",
    "task.deleteCompleted": "Delete completed tasks",
    "task.completedRemovable.one":
      "1 completed task without subtasks can be removed",
    "task.completedRemovable.many":
      "{count} completed tasks without subtasks can be removed",
    "task.deleteCompletedConfirm.one":
      "Permanently delete 1 completed task without subtasks from “{name}”?",
    "task.deleteCompletedConfirm.many":
      "Permanently delete {count} completed tasks without subtasks from “{name}”?",
    "repeat.none": "Do not repeat",
    "repeat.daily": "Daily",
    "repeat.weekly": "Weekly",
    "repeat.monthly": "Monthly",
    "repeat.yearly": "Yearly",
    "share.title": "List shared with …",
    "share.manage": "View and manage people",
    "share.description": "Shared people can edit the list and its tasks.",
    "share.hasAccess": "Has access",
    "share.remove": "Remove",
    "share.none": "This list is not shared with anyone yet.",
    "import.microsoft": "Import Microsoft To Do",
    "import.description": "Select JSON created by the Bash export",
    "import.tooLarge": "The export file is larger than 25 MB.",
    "import.preview":
      "Import {lists} lists and {tasks} tasks?\n\nExisting imported entries will be updated.",
    "import.complete":
      "Import complete.\n{lists} lists processed\n{created} tasks created\n{updated} tasks updated",
    "import.failed": "Import failed:\n{message}",
    "icon.notes": "📝 Notes",
    "icon.shopping": "🛒 Shopping",
    "icon.home": "🏠 Home",
    "icon.work": "💼 Work",
    "icon.packing": "🎒 Packing list",
    "icon.travel": "✈️ Travel",
    "icon.gifts": "🎁 Gifts",
    "icon.food": "🍽️ Food",
    "icon.garden": "🌱 Garden",
    "icon.repairs": "🔧 Repairs",
    "icon.ideas": "💡 Ideas",
    "icon.personal": "❤️ Personal",
    "people.one": "person",
    "people.many": "people",
    "error.default": "Something went wrong.",
    "error.login_failed": "The email address or password is incorrect.",
    "error.list_name_required": "A list name is required.",
    "error.member_not_found": "There is no account for this email address.",
    "error.member_has_access": "This person already has access.",
    "error.task_title_required": "A task title is required.",
    "error.invalid_parent_task": "The parent task is invalid.",
    "error.complete_subtasks_first": "Complete all subtasks first.",
    "error.task_has_subtasks": "Tasks with subtasks cannot be deleted.",
    "error.invalid_microsoft_export":
      "The file is not a supported Microsoft To Do export.",
    "error.unsupported_language": "This language is not supported.",
    "error.DuplicateUserName":
      "An account with this email address already exists.",
    "error.DuplicateEmail":
      "An account with this email address already exists.",
    "error.PasswordTooShort":
      "The password must contain at least eight characters.",
    "error.InvalidEmail": "Enter a valid email address.",
  },
  de: {
    "common.add": "Hinzufügen",
    "common.cancel": "Abbrechen",
    "common.close": "Schließen",
    "common.create": "Erstellen",
    "common.email": "E-Mail",
    "common.loading": "Lädt …",
    "common.name": "Name",
    "common.password": "Passwort",
    "common.save": "Speichern",
    "sync.online": "Online",
    "sync.offline": "Offline arbeiten",
    "sync.syncing": "Wird synchronisiert …",
    "sync.pending": "{count} Offlineänderungen ausstehend",
    "sync.pending.one": "1 Offlineänderung ausstehend",
    "auth.tagline": "Deine Aufgaben. Gemeinsam, ohne Ablenkung.",
    "auth.login": "Anmelden",
    "auth.register": "Konto erstellen",
    "auth.registerPrompt": "Noch kein Konto? Registrieren",
    "auth.loginPrompt": "Bereits ein Konto? Anmelden",
    "auth.logout": "Abmelden",
    "auth.logoutDescription": "Aktuelle Sitzung beenden",
    "user.menu": "Benutzermenü",
    "language.label": "Sprache",
    "theme.toggle": "Erscheinungsbild wechseln",
    "theme.description": "Zwischen hellem und dunklem Modus wechseln",
    "search.placeholder": "Suchen",
    "search.label": "Aufgaben durchsuchen",
    "list.new": "＋ Neue Liste",
    "list.yourList": "DEINE LISTE",
    "list.noListsTitle": "Noch keine Listen",
    "list.noListsDescription":
      "Erstelle zuerst eine Liste, bevor du Aufgaben hinzufügst.",
    "list.createFirst": "Erste Liste erstellen",
    "list.allLists": "Listen",
    "list.selectTitle": "Liste auswählen",
    "list.selectDescription":
      "Wähle in der Seitenleiste eine Liste aus, um ihre Aufgaben anzuzeigen und zu bearbeiten.",
    "list.icon": "Symbol",
    "list.namePlaceholder": "z. B. Garten",
    "list.options": "Listenoptionen",
    "list.ownInfo": "Eigene Liste · mit {count} {people} geteilt",
    "list.sharedInfo": "Mit dir geteilte Liste",
    "list.delete": "Liste löschen",
    "list.deleteDescription": "Liste und alle Aufgaben endgültig löschen",
    "list.deleteConfirm":
      "Liste „{name}“ und alle enthaltenen Aufgaben endgültig löschen?",
    "task.newPlaceholder": "Neue Aufgabe hinzufügen",
    "task.empty":
      "Noch keine passende Aufgabe. Starte mit einer kleinen Sache.",
    "task.progress": "{done} von {total} erledigt",
    "task.edit": "Aufgabe bearbeiten",
    "task.title": "Titel",
    "task.due": "Fällig am",
    "task.repeat": "Wiederholung",
    "task.notes": "Notizen",
    "task.notesPlaceholder": "Optionale Notiz",
    "task.noteTag": "Notiz",
    "task.subtaskPrompt": "Unteraufgabe",
    "task.addSubtask": "Unteraufgabe hinzufügen",
    "task.editAction": "Aufgabe bearbeiten",
    "task.deleteAction": "Aufgabe löschen",
    "task.deleteSubtask": "Unteraufgabe löschen",
    "task.deleteBlocked":
      "Aufgaben mit Unteraufgaben können nicht gelöscht werden",
    "task.completeBlocked": "Zuerst alle Unteraufgaben erledigen",
    "task.starAdd": "Mit Stern markieren",
    "task.starRemove": "Stern entfernen",
    "task.deleteCompleted": "Erledigte Aufgaben löschen",
    "task.completedRemovable.one":
      "1 erledigte Aufgabe ohne Unterpunkte kann entfernt werden",
    "task.completedRemovable.many":
      "{count} erledigte Aufgaben ohne Unterpunkte können entfernt werden",
    "task.deleteCompletedConfirm.one":
      "1 erledigte Aufgabe ohne Unterpunkte aus „{name}“ endgültig löschen?",
    "task.deleteCompletedConfirm.many":
      "{count} erledigte Aufgaben ohne Unterpunkte aus „{name}“ endgültig löschen?",
    "repeat.none": "Nicht wiederholen",
    "repeat.daily": "Täglich",
    "repeat.weekly": "Wöchentlich",
    "repeat.monthly": "Monatlich",
    "repeat.yearly": "Jährlich",
    "share.title": "Liste geteilt mit …",
    "share.manage": "Personen anzeigen und verwalten",
    "share.description":
      "Geteilte Personen können Aufgaben und Liste bearbeiten.",
    "share.hasAccess": "Hat Zugriff",
    "share.remove": "Entfernen",
    "share.none": "Diese Liste ist noch mit niemandem geteilt.",
    "import.microsoft": "Microsoft To Do importieren",
    "import.description": "JSON-Datei aus dem Bash-Export auswählen",
    "import.tooLarge": "Die Exportdatei ist größer als 25 MB.",
    "import.preview":
      "{lists} Listen und {tasks} Aufgaben importieren?\n\nBereits importierte Einträge werden aktualisiert.",
    "import.complete":
      "Import abgeschlossen.\n{lists} Listen verarbeitet\n{created} Aufgaben neu\n{updated} Aufgaben aktualisiert",
    "import.failed": "Import fehlgeschlagen:\n{message}",
    "icon.notes": "📝 Notizen",
    "icon.shopping": "🛒 Einkauf",
    "icon.home": "🏠 Zuhause",
    "icon.work": "💼 Arbeit",
    "icon.packing": "🎒 Packliste",
    "icon.travel": "✈️ Reise",
    "icon.gifts": "🎁 Geschenke",
    "icon.food": "🍽️ Essen",
    "icon.garden": "🌱 Garten",
    "icon.repairs": "🔧 Reparaturen",
    "icon.ideas": "💡 Ideen",
    "icon.personal": "❤️ Persönlich",
    "people.one": "Person",
    "people.many": "Personen",
    "error.default": "Etwas ist schiefgelaufen.",
    "error.login_failed": "E-Mail-Adresse oder Passwort ist nicht korrekt.",
    "error.list_name_required": "Ein Listenname wird benötigt.",
    "error.member_not_found":
      "Für diese E-Mail-Adresse gibt es noch kein Konto.",
    "error.member_has_access": "Diese Person hat bereits Zugriff.",
    "error.task_title_required": "Ein Aufgabentitel wird benötigt.",
    "error.invalid_parent_task": "Die Elternaufgabe ist ungültig.",
    "error.complete_subtasks_first":
      "Zuerst müssen alle Unteraufgaben erledigt werden.",
    "error.task_has_subtasks":
      "Aufgaben mit Unteraufgaben können nicht gelöscht werden.",
    "error.invalid_microsoft_export":
      "Die Datei ist kein unterstützter Microsoft-To-Do-Export.",
    "error.unsupported_language": "Diese Sprache wird nicht unterstützt.",
    "error.DuplicateUserName":
      "Für diese E-Mail-Adresse gibt es bereits ein Konto.",
    "error.DuplicateEmail":
      "Für diese E-Mail-Adresse gibt es bereits ein Konto.",
    "error.PasswordTooShort":
      "Das Passwort muss mindestens acht Zeichen enthalten.",
    "error.InvalidEmail": "Bitte eine gültige E-Mail-Adresse eingeben.",
  },
};

function t(key, parameters = {}) {
  const template = translations[language]?.[key] ?? translations.en[key] ?? key;
  return Object.entries(parameters).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    template,
  );
}

function applyTranslations() {
  document.documentElement.lang = language;
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.placeholder = t(element.dataset.i18nPlaceholder);
  });
  document.querySelectorAll("[data-i18n-title]").forEach((element) => {
    element.title = t(element.dataset.i18nTitle);
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((element) => {
    element.setAttribute("aria-label", t(element.dataset.i18nAria));
  });
  $("#language-select").value = language;
  updateAuthModeText();
}

function setLanguage(value, remember = false) {
  language = value?.toLowerCase().startsWith("de") ? "de" : "en";
  if (remember) localStorage.todoLanguage = language;
  applyTranslations();
  if (!$("#app-view").hidden) render();
}

function updateAuthModeText() {
  const submit = $("#auth-submit");
  const toggle = $("#auth-switch");
  if (!submit || !toggle) return;
  submit.textContent = t(registerMode ? "auth.register" : "auth.login");
  toggle.textContent = t(
    registerMode ? "auth.loginPrompt" : "auth.registerPrompt",
  );
}

// API errors use stable language-neutral codes. Translation happens in the browser.
async function api(url, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  if (method !== "GET" && options.body) {
    const body = JSON.parse(options.body);
    body.changedAt ||= nowIso();
    if (method === "POST" && (url === "lists" || url.endsWith("/tasks"))) body.clientId ||= crypto.randomUUID();
    options = { ...options, body: JSON.stringify(body) };
  }
  if (!isOnline && method !== "GET") {
    const body = options.body ? JSON.parse(options.body) : null;
    const result = queueOfflineMutation(url, method, body);
    render();
    return result;
  }

  let response;
  try {
    response = await fetch(`/api/${url}`, {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  } catch {
    // navigator.onLine and the online/offline events are unreliable on mobile:
    // a phone can report "online" while it has no actual route to the server
    // (weak signal, captive portal, switching between wifi/cellular). A failed
    // fetch is the only trustworthy offline signal, so treat it as one.
    setOnlineState(false);
    if (method !== "GET") {
      const body = options.body ? JSON.parse(options.body) : null;
      const result = queueOfflineMutation(url, method, body);
      render();
      return result;
    }
    throw new NetworkOfflineError();
  }

  if (!response.ok) {
    if (response.status === 401) {
      showAuth();
      throw new Error(t("error.login_failed"));
    }

    let code = "default";
    try {
      const body = await response.json();
      code = body.code ?? code;
    } catch {
      // Non-JSON server errors intentionally fall back to a generic localized message.
    }
    throw new Error(t(`error.${code}`));
  }

  return response.status === 204 ? null : response.json();
}

class NetworkOfflineError extends Error {}

function setOnlineState(value) {
  if (isOnline === value) return;
  isOnline = value;
  updateSyncStatus();
}

function persistOfflineState() {
  localStorage.todoOfflineQueue = JSON.stringify(offlineChanges);
  localStorage.todoLists = JSON.stringify(lists);
  // load() falls back to cachedLists while offline, so it must reflect
  // locally-applied offline mutations immediately, not just localStorage
  // (which only takes effect on the next page load). Without this, marking
  // a task done or adding one while offline was instantly reverted by the
  // load() call right after, since cachedLists still held the pre-mutation
  // snapshot from boot.
  cachedLists = lists;
}

function nowIso() {
  return new Date().toISOString();
}

function queueOfflineMutation(url, method, body) {
  const changedAt = body && method !== "DELETE" ? nowIso() : undefined;
  if (body && changedAt) body.changedAt = changedAt;
  if (body && method === "POST" && (url === "lists" || url.endsWith("/tasks"))) body.clientId ||= crypto.randomUUID();
  const mutation = { id: crypto.randomUUID(), url, method, body, changedAt: changedAt || nowIso() };
  offlineChanges.push(mutation);
  applyLocalMutation(mutation);
  persistOfflineState();
  return { queued: true };
}

function applyLocalMutation({ url, method, body }) {
  const parts = url.split("/");
  if (method === "POST" && url === "lists") {
    const id = body.clientId || crypto.randomUUID();
    lists.push({ id, name: body.name, icon: body.icon || "📝", tasks: [], isOwner: true, members: [], lastChangedAt: body.changedAt });
    currentId = id;
  } else if (method === "POST" && parts[0] === "lists" && parts[2] === "tasks") {
    const list = lists.find((item) => item.id === parts[1]);
    if (list) list.tasks.push({ id: body.clientId || crypto.randomUUID(), title: body.title, done: false, isStarred: false, dueDate: body.dueDate || null, notes: body.notes || null, repeat: body.repeat || null, parentId: body.parentId || null, lastChangedAt: body.changedAt });
  } else if (method === "PATCH" && parts[0] === "tasks") {
    const task = lists.flatMap((list) => list.tasks).find((item) => item.id === parts[1]);
    if (task) Object.assign(task, body, { lastChangedAt: body.changedAt || nowIso() });
  } else if (method === "DELETE" && parts[0] === "tasks") {
    for (const list of lists) list.tasks = list.tasks.filter((task) => task.id !== parts[1]);
  } else if (method === "DELETE" && parts[0] === "lists" && parts[2] === "completed-tasks") {
    const list = lists.find((item) => item.id === parts[1]);
    if (list) {
      const parentIds = new Set(list.tasks.filter((task) => task.parentId).map((task) => task.parentId));
      list.tasks = list.tasks.filter((task) => !task.done || parentIds.has(task.id));
    }
  } else if (method === "DELETE" && parts[0] === "lists") {
    lists = lists.filter((list) => list.id !== parts[1]);
    if (currentId === parts[1]) currentId = lists[0]?.id;
  }
}

let isSyncing = false;

// The pill is only shown when there is something worth reporting: while
// offline, while actively syncing, or when changes are still queued. In the
// steady-state (online, nothing pending) it stays out of the way.
function updateSyncStatus() {
  const status = $("#sync-status");
  if (!status) return;
  const count = offlineChanges.length;
  if (isOnline && !isSyncing && count === 0) {
    status.hidden = true;
    status.textContent = "";
    return;
  }
  status.hidden = false;
  status.className = `sync-status ${!isOnline ? "offline" : isSyncing ? "syncing" : "online"}`;
  const icon = !isOnline ? "⚡" : isSyncing ? "↻" : "●";
  const label = !isOnline
    ? t("sync.offline")
    : isSyncing
      ? t("sync.syncing")
      : t("sync.online");
  const pending = count
    ? ` · ${t(count === 1 ? "sync.pending.one" : "sync.pending", { count })}`
    : "";
  status.textContent = `${icon} ${label}${pending}`;
  status.title = status.textContent;
}

async function flushOfflineMutations() {
  if (!isOnline || !offlineChanges.length) return;
  isSyncing = true;
  updateSyncStatus();
  const pending = [...offlineChanges];
  for (const mutation of pending) {
    let response;
    try {
      response = await fetch(`/api/${mutation.url}`, { method: mutation.method, credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: mutation.body ? JSON.stringify(mutation.body) : undefined });
    } catch {
      // Real network failure: keep this and every later mutation queued and
      // retry the whole batch next time we're actually back online.
      setOnlineState(false);
      break;
    }
    // A server-rejected mutation (stale edit, already-deleted parent, …) can
    // never succeed by retrying, so drop it instead of blocking every change
    // queued after it forever.
    if (!response.ok && response.status !== 404) {
      console.warn(`Discarding offline change that the server rejected: ${mutation.method} ${mutation.url}`);
    }
    offlineChanges = offlineChanges.filter((item) => item.id !== mutation.id);
    persistOfflineState();
  }
  isSyncing = false;
  updateSyncStatus();
  if (!offlineChanges.length) await load();
}

function showAuth() {
  $("#app-view").hidden = true;
  $("#auth-view").hidden = false;
}

function showApp() {
  $("#auth-view").hidden = true;
  $("#app-view").hidden = false;
}

function setCurrentUser(email) {
  currentUserEmail = email || "";
  if (currentUserEmail) localStorage.todoUserEmail = currentUserEmail;
  $("#current-user").textContent = currentUserEmail || "–";
  $("#current-user").title = currentUserEmail;
  $("#user-menu-email").textContent = currentUserEmail;
}

// Browser language is used until an authenticated user has saved a preference.
async function boot() {
  if (localStorage.theme === "dark") document.body.classList.add("dark");
  setLanguage(localStorage.todoLanguage || navigator.language);

  try {
    const me = await api("auth/me");
    if (me.language) setLanguage(me.language, true);
    setCurrentUser(me.email);
    showApp();
    await load();
  } catch {
    if (!isOnline && localStorage.todoHasSession === "true") {
      lists = cachedLists;
      setCurrentUser(localStorage.todoUserEmail || "");
      showApp();
      render();
    } else showAuth();
  }

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js");
  updateSyncStatus();
}

async function load() {
  if (!isOnline) {
    lists = cachedLists;
    render();
    return;
  }
  await flushOfflineMutations();
  try {
    lists = await api("lists");
  } catch (error) {
    if (error instanceof NetworkOfflineError) {
      lists = cachedLists;
      render();
      return;
    }
    throw error;
  }
  localStorage.todoHasSession = "true";
  cachedLists = lists;
  persistOfflineState();
  if (!currentId || !lists.some((list) => list.id === currentId))
    currentId = lists[0]?.id;
  render();
}

async function goOnline() {
  setOnlineState(true);
  await flushOfflineMutations();
  await load();
}

// The browser's online/offline events are the primary signal, but mobile
// browsers (especially iOS Safari, and PWAs resumed from the background)
// often fail to fire them on real connectivity changes. Re-checking whenever
// the app becomes visible again, plus a periodic fallback, catches those cases.
async function recheckConnectivity() {
  if (isOnline) return;
  try {
    const response = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
    if (response.ok || response.status === 401) await goOnline();
  } catch {
    // Still offline.
  }
}

window.addEventListener("online", goOnline);
window.addEventListener("offline", () => { setOnlineState(false); render(); });
window.addEventListener("focus", recheckConnectivity);
window.addEventListener("pageshow", recheckConnectivity);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") recheckConnectivity();
});
setInterval(recheckConnectivity, 20000);
window.addEventListener("beforeunload", persistOfflineState);

function current() {
  return lists.find((list) => list.id === currentId);
}

function byPriority(first, second) {
  // Open tasks always precede completed tasks. The star only controls the
  // order within those two groups.
  return (
    Number(first.done) - Number(second.done) ||
    Number(second.isStarred) - Number(first.isStarred)
  );
}

function esc(value) {
  return (value || "").replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character],
  );
}

function normalizeRepeat(value) {
  return (
    {
      Täglich: "daily",
      Wöchentlich: "weekly",
      Monatlich: "monthly",
      Jährlich: "yearly",
    }[value] ??
    value ??
    ""
  );
}

// Render list navigation and task rows, then bind events to the newly created elements.
function render() {
  updateSyncStatus();
  const list = current();
  $("#lists").innerHTML = lists
    .map(
      (item) => `
    <button data-list="${item.id}" class="${item.id === currentId ? "active" : ""}">
      <span>${item.icon}</span>${esc(item.name)}<span class="list-count">${item.tasks.filter((task) => !task.done).length}</span>
    </button>`,
    )
    .join("");
  $("#mobile-list-current").textContent = list
    ? `${list.icon} ${list.name}`
    : t("list.allLists");
  $("#mobile-list-options").innerHTML = lists.length
    ? lists
        .map(
          (item) => `
      <button data-list="${item.id}" class="${item.id === currentId ? "active" : ""}">
        <span>${item.icon}</span><span>${esc(item.name)}</span><span class="list-count">${item.tasks.filter((task) => !task.done).length}</span>
      </button>`,
        )
        .join("")
    : `<p class="hint">${t("list.noListsDescription")}</p>`;

  if (!list) {
    const hasLists = lists.length > 0;
    $("#list-title").textContent = t(
      hasLists ? "list.selectTitle" : "list.noListsTitle",
    );
    $("#progress").innerHTML = "";
    $("#progress").hidden = true;
    $(".add-task").hidden = true;
    $(".search").hidden = true;
    $("#list-menu").hidden = true;
    $("#tasks").innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon" aria-hidden="true">${hasLists ? "☰" : "✓"}</span>
        <h2>${t(hasLists ? "list.selectTitle" : "list.noListsTitle")}</h2>
        <p>${t(hasLists ? "list.selectDescription" : "list.noListsDescription")}</p>
        ${hasLists ? "" : `<button id="create-first-list" class="primary">${t("list.createFirst")}</button>`}
      </div>`;

    $("#create-first-list")?.addEventListener("click", openListDialog);
    bindListNavigation();
    return;
  }

  $("#progress").hidden = false;
  $(".add-task").hidden = false;
  $(".search").hidden = false;
  $("#list-menu").hidden = false;
  $("#list-title").textContent = `${list.icon} ${list.name}`;
  const topLevelTasks = list.tasks
    .filter((task) => !task.parentId)
    .sort(byPriority);
  const completed = list.tasks.filter((task) => task.done).length;
  $("#progress").innerHTML =
    `${t("task.progress", { done: completed, total: list.tasks.length })}
    <div class="progress-line"><i style="width:${list.tasks.length ? (completed / list.tasks.length) * 100 : 0}%"></i></div>`;

  const query = $("#search").value.toLowerCase();
  const visible = (task) =>
    !query ||
    [task.title, task.notes]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(query);
  const html = topLevelTasks
    .filter(visible)
    .map((task) =>
      taskHtml(
        task,
        list.tasks
          .filter((child) => child.parentId === task.id)
          .sort(byPriority),
        visible,
      ),
    )
    .join("");
  $("#tasks").innerHTML = html
    ? `<div class="task-group">${html}</div>`
    : `<div class="task-group empty">${t("task.empty")}</div>`;

  bindListNavigation();
  bindTaskActions();
}

function bindListNavigation() {
  document.querySelectorAll("[data-list]").forEach((button) => {
    button.onclick = () => {
      currentId = button.dataset.list;
      if ($("#mobile-lists-dialog").open) $("#mobile-lists-dialog").close();
      render();
    };
  });
}

function bindTaskActions() {
  document.querySelectorAll(".check").forEach((checkbox) => {
    checkbox.onchange = async () => {
      try {
        await api(`tasks/${checkbox.dataset.id}`, {
          method: "PATCH",
          body: JSON.stringify({ done: checkbox.checked, clearDueDate: false }),
        });
        await load();
      } catch (error) {
        await load();
        alert(error.message);
      }
    };
  });

  document.querySelectorAll(".star").forEach((button) => {
    button.onclick = async () => {
      try {
        await api(`tasks/${button.dataset.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            isStarred: button.dataset.starred !== "true",
            clearDueDate: false,
          }),
        });
        await load();
      } catch (error) {
        await load();
        alert(error.message);
      }
    };
  });

  document.querySelectorAll(".edit").forEach((button) => {
    button.onclick = () => openEdit(button.dataset.id);
  });

  document.querySelectorAll(".sub").forEach((button) => {
    button.onclick = async () => {
      const title = prompt(t("task.subtaskPrompt"));
      if (!title?.trim()) return;
      try {
        await api(`lists/${currentId}/tasks`, {
          method: "POST",
          body: JSON.stringify({
            title: title.trim(),
            parentId: button.dataset.id,
          }),
        });
        await load();
      } catch (error) {
        await load();
        alert(error.message);
      }
    };
  });

  document.querySelectorAll(".remove").forEach((button) => {
    button.onclick = async () => {
      try {
        await api(`tasks/${button.dataset.id}`, { method: "DELETE" });
        await load();
      } catch (error) {
        alert(error.message);
      }
    };
  });
}

function taskHtml(task, children, visible) {
  const metadata = [];
  const hasChildren = children.length > 0;
  const hasOpenChildren = children.some((child) => !child.done);
  if (task.dueDate) {
    metadata.push(
      `◷ ${new Date(`${task.dueDate}T00:00`).toLocaleDateString(language === "de" ? "de-DE" : "en-GB", { day: "2-digit", month: "short" })}`,
    );
  }
  if (task.repeat)
    metadata.push(`↻ ${t(`repeat.${normalizeRepeat(task.repeat)}`)}`);
  if (task.notes) metadata.push(t("task.noteTag"));

  const starTitle = t(task.isStarred ? "task.starRemove" : "task.starAdd");
  const completionRestriction = hasOpenChildren
    ? `disabled title="${t("task.completeBlocked")}"`
    : "";
  const deleteRestriction = hasChildren
    ? `disabled title="${t("task.deleteBlocked")}"`
    : `title="${t("task.deleteAction")}"`;

  return `<article class="task ${task.done ? "done" : ""} ${task.isStarred ? "starred" : ""}">
    <input class="check" data-id="${task.id}" type="checkbox" ${task.done ? "checked" : ""} ${completionRestriction}>
    <div class="task-body">
      <div class="task-title edit" data-id="${task.id}">${esc(task.title)}</div>
      ${metadata.length ? `<div class="details">${metadata.map((item) => `<span class="tag">${item}</span>`).join("")}</div>` : ""}
    </div>
    <button class="task-actions star ${task.isStarred ? "active" : ""}" data-id="${task.id}" data-starred="${task.isStarred}" title="${starTitle}" aria-label="${starTitle}">${task.isStarred ? "★" : "☆"}</button>
    <button class="task-actions sub" data-id="${task.id}" title="${t("task.addSubtask")}">＋</button>
    <button class="task-actions edit" data-id="${task.id}" title="${t("task.editAction")}">✎</button>
    <button class="task-actions remove" data-id="${task.id}" ${deleteRestriction}>×</button>
  </article>${children
    .filter(visible)
    .map((child) => subtaskHtml(child))
    .join("")}`;
}

function subtaskHtml(task) {
  const starTitle = t(task.isStarred ? "task.starRemove" : "task.starAdd");
  return `<article class="task subtask ${task.done ? "done" : ""} ${task.isStarred ? "starred" : ""}">
    <input class="check" data-id="${task.id}" type="checkbox" ${task.done ? "checked" : ""}>
    <div class="task-body"><div class="task-title edit" data-id="${task.id}">↳ ${esc(task.title)}</div></div>
    <button class="task-actions star ${task.isStarred ? "active" : ""}" data-id="${task.id}" data-starred="${task.isStarred}" title="${starTitle}" aria-label="${starTitle}">${task.isStarred ? "★" : "☆"}</button>
    <button class="task-actions remove" data-id="${task.id}" title="${t("task.deleteSubtask")}">×</button>
  </article>`;
}

async function addTask() {
  const title = $("#task-title").value.trim();
  if (!title || !currentId) return;
  await api(`lists/${currentId}/tasks`, {
    method: "POST",
    body: JSON.stringify({ title }),
  });
  $("#task-title").value = "";
  await load();
}

function openEdit(id) {
  editing = current().tasks.find((task) => task.id === id);
  $("#edit-title").value = editing.title;
  $("#edit-date").value = editing.dueDate || "";
  $("#edit-repeat").value = normalizeRepeat(editing.repeat);
  $("#edit-notes").value = editing.notes || "";
  $("#task-dialog").showModal();
}

function renderMembers() {
  const list = current();
  $("#members").innerHTML = list.members.length
    ? `<h3>${t("share.hasAccess")}</h3>${list.members
        .map(
          (member) => `
        <div class="member"><span>${esc(member.email)}</span>${list.isOwner ? `<button data-member="${member.id}">${t("share.remove")}</button>` : ""}</div>`,
        )
        .join("")}`
    : `<p class="hint">${t("share.none")}</p>`;

  document.querySelectorAll("[data-member]").forEach((button) => {
    button.onclick = async () => {
      await api(`lists/${currentId}/members/${button.dataset.member}`, {
        method: "DELETE",
      });
      await load();
      renderMembers();
    };
  });
}

function openShareDialog() {
  const list = current();
  $("#share-error").textContent = "";
  $("#share-email").value = "";
  $("#share-email-label").hidden = !list.isOwner;
  $("#add-member").hidden = !list.isOwner;
  renderMembers();
  $("#share-dialog").showModal();
}

function removableCompletedTasks(list) {
  const parentIds = new Set(
    list.tasks.filter((task) => task.parentId).map((task) => task.parentId),
  );
  return list.tasks.filter((task) => task.done && !parentIds.has(task.id));
}

// Static event handlers are registered once. Dynamic task handlers are bound after rendering.
$("#add-task").onclick = addTask;
$("#task-title").onkeydown = (event) => {
  if (event.key === "Enter") addTask();
};
$("#search").oninput = render;

function openListDialog() {
  $("#list-dialog").showModal();
  $("#list-name").focus();
}

$(".new-list").onclick = openListDialog;
$("#mobile-list-picker").onclick = () => $("#mobile-lists-dialog").showModal();
$("#close-mobile-lists").onclick = () => $("#mobile-lists-dialog").close();
$("#mobile-new-list").onclick = () => {
  $("#mobile-lists-dialog").close();
  openListDialog();
};
$("#cancel-list").onclick = () => {
  $("#list-dialog").close();
  $("#list-form").reset();
};
$("#list-form").onsubmit = async (event) => {
  event.preventDefault();
  const name = $("#list-name").value.trim();
  if (!name) return;
  const list = await api("lists", {
    method: "POST",
    body: JSON.stringify({ name, icon: $("#list-icon").value }),
  });
  currentId = list.id;
  $("#list-dialog").close();
  $("#list-form").reset();
  await load();
};

$("#save-task").onclick = async (event) => {
  event.preventDefault();
  if (!editing) return;
  const dueDate = $("#edit-date").value;
  await api(`tasks/${editing.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      title: $("#edit-title").value,
      dueDate: dueDate || null,
      clearDueDate: !dueDate,
      repeat: $("#edit-repeat").value || null,
      notes: $("#edit-notes").value || null,
    }),
  });
  $("#task-dialog").close();
  await load();
};

$("#auth-switch").onclick = () => {
  registerMode = !registerMode;
  $("#auth-password").autocomplete = registerMode
    ? "new-password"
    : "current-password";
  $("#auth-error").textContent = "";
  updateAuthModeText();
};

$("#auth-form").onsubmit = async (event) => {
  event.preventDefault();
  const submit = $("#auth-submit");
  submit.disabled = true;
  $("#auth-error").textContent = "";
  try {
    const me = await api(`auth/${registerMode ? "register" : "login"}`, {
      method: "POST",
      body: JSON.stringify({
        email: $("#auth-email").value,
        password: $("#auth-password").value,
      }),
    });
    if (me.language) setLanguage(me.language, true);
    setCurrentUser(me.email);
    await load();
    showApp();
  } catch (error) {
    showAuth();
    $("#auth-error").textContent = error.message;
  } finally {
    submit.disabled = false;
  }
};

$("#user-menu").onclick = () => $("#user-menu-dialog").showModal();
$("#close-user-menu").onclick = () => $("#user-menu-dialog").close();
$("#language-select").onchange = async (event) => {
  setLanguage(event.currentTarget.value, true);
  await api("auth/language", {
    method: "PATCH",
    body: JSON.stringify({ language }),
  });
};
$("#theme").onclick = () => {
  document.body.classList.toggle("dark");
  localStorage.theme = document.body.classList.contains("dark")
    ? "dark"
    : "light";
  $("#user-menu-dialog").close();
};
$("#logout").onclick = async () => {
  $("#user-menu-dialog").close();
  await api("auth/logout", { method: "POST" });
  lists = [];
  currentId = null;
  setCurrentUser("");
  showAuth();
};

$("#list-menu").onclick = () => {
  const list = current();
  if (!list) return;
  const completed = removableCompletedTasks(list).length;
  $("#list-menu-title").textContent = `${list.icon} ${list.name}`;
  $("#list-menu-info").textContent = list.isOwner
    ? t("list.ownInfo", {
        count: list.members.length,
        people: t(list.members.length === 1 ? "people.one" : "people.many"),
      })
    : t("list.sharedInfo");
  $("#completed-tasks-info").textContent = t(
    completed === 1
      ? "task.completedRemovable.one"
      : "task.completedRemovable.many",
    { count: completed },
  );
  $("#menu-delete-completed").disabled = completed === 0;
  $("#menu-delete").hidden = !list.isOwner;
  $("#list-menu-dialog").showModal();
};
$("#close-list-menu").onclick = () => $("#list-menu-dialog").close();
$("#menu-share").onclick = () => {
  $("#list-menu-dialog").close();
  openShareDialog();
};
$("#menu-delete-completed").onclick = async () => {
  const list = current();
  const completed = list ? removableCompletedTasks(list).length : 0;
  const key =
    completed === 1
      ? "task.deleteCompletedConfirm.one"
      : "task.deleteCompletedConfirm.many";
  if (!completed || !confirm(t(key, { count: completed, name: list.name })))
    return;
  await api(`lists/${currentId}/completed-tasks`, { method: "DELETE" });
  $("#list-menu-dialog").close();
  await load();
};
$("#menu-delete").onclick = async () => {
  const list = current();
  if (!list?.isOwner || !confirm(t("list.deleteConfirm", { name: list.name })))
    return;
  await api(`lists/${currentId}`, { method: "DELETE" });
  $("#list-menu-dialog").close();
  currentId = null;
  await load();
};

$("#add-member").onclick = async (event) => {
  event.preventDefault();
  try {
    await api(`lists/${currentId}/members`, {
      method: "POST",
      body: JSON.stringify({ email: $("#share-email").value }),
    });
    await load();
    renderMembers();
    $("#share-email").value = "";
  } catch (error) {
    $("#share-error").textContent = error.message;
  }
};

$("#import-microsoft").onclick = () => $("#microsoft-import-file").click();
$("#microsoft-import-file").onchange = async (event) => {
  const input = event.currentTarget;
  const file = input.files?.[0];
  if (!file) return;

  try {
    if (file.size > 25 * 1024 * 1024) throw new Error(t("import.tooLarge"));
    const exportDocument = JSON.parse(await file.text());
    if (
      exportDocument.format !== "todo-microsoft-export" ||
      !Array.isArray(exportDocument.lists)
    ) {
      throw new Error(t("error.invalid_microsoft_export"));
    }
    const taskCount = exportDocument.lists.reduce(
      (sum, list) =>
        sum +
        (Array.isArray(list.tasks)
          ? list.tasks.reduce(
              (taskSum, task) =>
                taskSum +
                1 +
                (Array.isArray(task.checklistItems)
                  ? task.checklistItems.length
                  : 0),
              0,
            )
          : 0),
      0,
    );
    if (
      !confirm(
        t("import.preview", {
          lists: exportDocument.lists.length,
          tasks: taskCount,
        }),
      )
    )
      return;

    $("#user-menu-dialog").close();
    const result = await api("import/microsoft", {
      method: "POST",
      body: JSON.stringify(exportDocument),
    });
    await load();
    alert(
      t("import.complete", {
        lists: result.lists,
        created: result.createdTasks,
        updated: result.updatedTasks,
      }),
    );
  } catch (error) {
    alert(t("import.failed", { message: error.message }));
  } finally {
    input.value = "";
  }
};

boot();
