/* ==========================================================================
   CORE CONFIGURATION, ADAPTIVE POLICY, AUTH, XHR & MEDIA COMPRESSION
   ========================================================================== */
var CONFIG = {
  firebaseApiKey: "AIzaSyB2dRmsNzLoMrCpCp7k4RURFhEiRA9o7yE",
  firebaseDbUrl: "https://fembooru-142a4-default-rtdb.europe-west1.firebasedatabase.app",
  imgbbApiKey: "120a27bcbb28d3ffd9f03bc4b32bb54f",
  githubRepo: "parmanoidd/fembooru",
  mainLogoRedirectUrl: "https://parmanoidd.github.io/fembooru/",
  emailDomain: "fembooru.ua",
  pollMinVotes: 3,
  autoRefreshMs: 4500,
  realtimeSyncMs: 420
};

var SERVICE_POLICY = {
  imgbbMaxBytes: 32 * 1024 * 1024,
  firebaseInlineImageMaxBytes: 750 * 1024,
  firebaseAudioMaxBytes: 900 * 1024,
  stickerMaxBytes: 2 * 1024 * 1024,
  stickerMaxDim: 1024,
  imgbbOnline: true
};

var DEFAULT_BOARDS = [
  { slug: "b", title: "Random" },
  { slug: "ua", title: "Ukraine" },
  { slug: "pmr", title: "Pridnestrovie" },
  { slug: "music", title: "Music & Audio" },
  { slug: "tech", title: "Technology & Retro Web" }
];

var FAVORITE_CATEGORIES = [
  { key: "films", label: "Favorite films", badge: "FAVORITE FILM", icon: "&#127916;" },
  { key: "tv", label: "Favorite TV-shows", badge: "FAVORITE TV-SHOW", icon: "&#128250;" },
  { key: "books", label: "Favorite books", badge: "FAVORITE BOOK", icon: "&#128214;" },
  { key: "games", label: "Favorite games", badge: "FAVORITE GAME", icon: "&#127918;" }
];

var DEFAULT_FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' fill='%23EEAA88'/%3E%3Ctext x='16' y='23' font-size='20' font-weight='bold' text-anchor='middle' fill='%23800000'%3E%E2%98%98%3C/text%3E%3C/svg%3E";
var DEFAULT_SPRITE_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='32' r='28' fill='%23EEAA88' stroke='%23800000' stroke-width='4'/%3E%3Ctext x='32' y='41' font-size='28' font-weight='bold' text-anchor='middle' fill='%23800000'%3E%E2%98%98%3C/text%3E%3C/svg%3E";
var ADMIN_USERNAME = "admin";
var ADMIN_PASSWORD_INIT = "@!1Abeccod201222";

var memoryStore = {};
var lastDataHash = "";
var autoRefreshTimer = null;
var tabLogoTickTimer = null;
var progressHideTimer = null;

var myClientId = (function() {
  try {
    var id = sessionStorage.getItem("ib_cid");
    if (!id) {
      id = "c_" + (new Date().getTime()) + "_" + Math.floor(Math.random() * 100000);
      sessionStorage.setItem("ib_cid", id);
    }
    return id;
  } catch (e) {
    return "c_" + (new Date().getTime()) + "_" + Math.floor(Math.random() * 100000);
  }
})();

function emptyProfile(name) {
  return {
    nickname: name || "",
    status: "",
    avatarUrl: "",
    pronouns: "",
    relationship: "",
    registeredAt: "",
    hometown: "",
    politicalViews: "",
    birthDate: "",
    website: "",
    city: "",
    interests: "",
    bio: "",
    favorites: { films: [], tv: [], books: [], games: [] },
    customFields: []
  };
}

var state = {
  view: "board",
  currentBoard: "b",
  currentThreadId: null,
  currentProfileUid: null,
  currentGroupId: null,
  currentDmPeerUid: null,
  boards: [],
  threads: {},
  comments: {},
  polls: {},
  users: {},
  walls: {},
  wallComments: {},
  subscriptions: {},
  blocks: {},
  groups: {},
  groupMessages: {},
  dms: {},
  stickers: {},
  selectedStickers: {},
  openStickerPickers: {},
  siteLogo: "",
  snowEffect: null,
  tabLogoEffect: null,
  user: null,
  profile: emptyProfile("")
};

var musicState = { localTracks: [], allTracks: [], currentIndex: -1, currentPlayingId: null };
var snowState = { active: false, expiresAt: 0, flakes: [], animFrame: null };

var worldState = {
  sprites: {},
  fireworks: {},
  explodedFireworks: {},
  cursors: {},
  cursorNodes: {},
  actors: {},
  actorNodes: {},
  particles: [],
  beams: [],
  activeTool: "physgun",
  grabbedSpriteId: null,
  grabMode: "",
  lastMouseX: 240,
  lastMouseY: 200,
  throwVx: 0,
  throwVy: 0,
  lastDragSyncTime: 0,
  lastCursorSendTime: 0,
  lastCursorRelX: 0.5,
  lastCursorDocY: 200,
  lastPlaygroundHtml: "",
  hadFx: false,
  shiftDownClean: false,
  cursorChatOpen: false,
  localChatText: "",
  localChatExpiresAt: 0,
  propMenuOpen: false,
  propCatalog: [],
  actorEnabled: false,
  myActor: { x: 320, y: 260, vx: 0, vy: 0, facing: 1, hp: 100, grounded: false, swingUntil: 0, updatedAt: 0 },
  keys: { left: false, right: false, jump: false },
  lastActorSendTime: 0
};

/* ==========================================================================
   LOCAL STORAGE, STATUS MESSAGES, PROGRESS BAR & ADAPTIVE SERVICE POLICY
   ========================================================================== */
function storeGet(k) {
  try { return localStorage.getItem(k); } catch (e) { return memoryStore[k] || null; }
}
function storeSet(k, v) {
  try { localStorage.setItem(k, v); } catch (e) { memoryStore[k] = v; }
}
function storeRemove(k) {
  try { localStorage.removeItem(k); } catch (e) { delete memoryStore[k]; }
}

function isFirebaseConfigured() {
  return Boolean(CONFIG.firebaseApiKey && CONFIG.firebaseDbUrl && CONFIG.firebaseDbUrl.indexOf("https://") === 0);
}
function isImgbbConfigured() {
  return Boolean(CONFIG.imgbbApiKey && CONFIG.imgbbApiKey.length > 10);
}

function showStatus(msg, isError) {
  var box = document.getElementById("statusBox");
  if (!box) return;
  if (!msg) {
    box.style.display = "none";
    box.innerHTML = "";
    return;
  }
  box.style.display = "block";
  box.style.backgroundColor = isError ? "#FFD2D2" : "#FFE4C4";
  box.innerHTML = esc(msg);
}

function setUploadProgress(pct, label) {
  var box = document.getElementById("uploadProgressBox");
  var fill = document.getElementById("uploadProgressFill");
  var lbl = document.getElementById("uploadProgressLabel");
  var pctEl = document.getElementById("uploadProgressPct");
  if (!box) return;
  if (progressHideTimer) { clearTimeout(progressHideTimer); progressHideTimer = null; }
  if (pct === null || pct === undefined || pct < 0) {
    box.style.display = "none";
    if (fill) fill.style.width = "0%";
    return;
  }
  var clamped = Math.max(0, Math.min(100, Math.round(pct)));
  box.style.display = "block";
  if (fill) fill.style.width = clamped + "%";
  if (lbl && label) lbl.innerHTML = esc(label);
  if (pctEl) pctEl.innerHTML = clamped + "%";
  if (clamped >= 100) {
    progressHideTimer = setTimeout(function() { box.style.display = "none"; }, 1100);
  }
}

function loadSavedPolicy() {
  try {
    var raw = JSON.parse(storeGet("ib_service_policy") || "null");
    if (raw && typeof raw === "object") {
      if (raw.imgbbMaxBytes > 100000) SERVICE_POLICY.imgbbMaxBytes = raw.imgbbMaxBytes;
      if (raw.firebaseInlineImageMaxBytes > 50000) SERVICE_POLICY.firebaseInlineImageMaxBytes = raw.firebaseInlineImageMaxBytes;
      if (raw.firebaseAudioMaxBytes > 80000) SERVICE_POLICY.firebaseAudioMaxBytes = raw.firebaseAudioMaxBytes;
      if (raw.stickerMaxBytes > 50000) SERVICE_POLICY.stickerMaxBytes = raw.stickerMaxBytes;
    }
  } catch (e) {}
  updatePolicyDisplay();
}

function saveAndApplyPolicy(reason) {
  storeSet("ib_service_policy", JSON.stringify(SERVICE_POLICY));
  updatePolicyDisplay();
  if (reason) showStatus("Policy auto-adjusted: " + reason, false);
}

function updatePolicyDisplay() {
  var el = document.getElementById("adaptivePolicyInfo");
  var mh = document.getElementById("musicPolicyHint");
  var imgMb = (SERVICE_POLICY.imgbbMaxBytes / 1048576).toFixed(1);
  var audKb = Math.round(SERVICE_POLICY.firebaseAudioMaxBytes / 1024);
  if (el) {
    el.innerHTML = "Active limits: ImgBB " + (SERVICE_POLICY.imgbbOnline ? ("OK (" + imgMb + " MB)") : "Fallback mode") + ", Audio &le; " + audKb + " KB (auto-compressed).";
  }
  if (mh) {
    mh.innerHTML = "(Auto-compressed &le; " + audKb + " KB &amp; posted to /music/)";
  }
}

function probeServicePolicies() {
  loadSavedPolicy();
  if (!isImgbbConfigured()) {
    SERVICE_POLICY.imgbbOnline = false;
    updatePolicyDisplay();
    return;
  }
  httpRequest(
    "POST",
    "https://api.imgbb.com/1/upload?expiration=60&key=" + encodeURIComponent(CONFIG.imgbbApiKey),
    "image=R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    { "Content-Type": "application/x-www-form-urlencoded" },
    function(err, res) {
      SERVICE_POLICY.imgbbOnline = Boolean(!err && res && res.success);
      if (!SERVICE_POLICY.imgbbOnline && SERVICE_POLICY.imgbbMaxBytes > SERVICE_POLICY.firebaseInlineImageMaxBytes) {
        SERVICE_POLICY.imgbbMaxBytes = SERVICE_POLICY.firebaseInlineImageMaxBytes;
      }
      saveAndApplyPolicy("");
    }
  );
}

function fetchGithubRepoVersion() {
  var el = document.getElementById("siteVersionNum");
  if (!el || !CONFIG.githubRepo) return;
  var xhr = new XMLHttpRequest();
  xhr.open("GET", "https://api.github.com/repos/" + CONFIG.githubRepo + "/commits?per_page=1", true);
  xhr.onreadystatechange = function() {
    if (xhr.readyState === 4 && xhr.status >= 200 && xhr.status < 300) {
      var link = xhr.getResponseHeader("Link") || "";
      var m = link.match(/page=(\d+)>;\s*rel="last"/);
      if (m && m[1]) { el.innerHTML = esc(m[1]); return; }
      try {
        var list = JSON.parse(xhr.responseText || "[]");
        if (list && list.length) el.innerHTML = String(list.length);
      } catch (e) {}
    }
  };
  xhr.send();
}

/* ==========================================================================
   GENERAL FORMATTING & DATA NORMALIZATION HELPERS
   ========================================================================== */
function formatDbError(err, fb) {
  if (!err) return fb;
  var d = (err.data && typeof err.data === "object" && err.data.error) ? String(err.data.error) : (typeof err.data === "string" ? err.data : "");
  if (err.status === 401) return "Session expired. Please sign in again.";
  if (err.status === 403) return "Permission denied by Firebase rules.";
  return fb + (d ? " (" + d + ")" : "");
}

function esc(s) {
  if (s === null || s === undefined) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function safeUrl(u) {
  var t = String(u || "").replace(/^\s+|\s+$/g, "");
  return /^https?:\/\//i.test(t) ? t : "";
}

function isValidImageSrc(s) {
  if (!s) return false;
  var str = String(s);
  return Boolean(safeUrl(str) || (str.indexOf("data:image/") === 0 && str.toLowerCase().indexOf("<script") === -1));
}

function getFileExtension(n) {
  var s = String(n || ""), i = s.lastIndexOf(".");
  return i !== -1 ? s.substring(i + 1).toLowerCase() : "";
}

function formatTime(ts) {
  if (!ts) return "";
  var d = new Date(ts);
  var p = function(n) { return n < 10 ? "0" + n : "" + n; };
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
}

function formatDateOnly(ts) { return formatTime(ts).substring(0, 10); }
function generateId() { return "id_" + (new Date().getTime()) + "_" + Math.floor(Math.random() * 100000); }
function sanitizeSlug(r) { return String(r || "").toLowerCase().replace(/[^a-z0-9_]/g, "").substring(0, 16); }

function extractUsername(r) {
  var c = String(r || "").replace(/^\s+|\s+$/g, "").toLowerCase();
  var at = c.indexOf("@");
  if (at !== -1) c = c.substring(0, at);
  return c.replace(/[^a-z0-9._-]/g, "") || "user";
}

function usernameToEmail(r) { return extractUsername(r) + "@" + CONFIG.emailDomain; }
function getDisplayUsername() { return state.user ? (state.profile.nickname || state.user.username) : ("Guest_" + myClientId.slice(-4)); }

function getUserDisplayNameByUid(uid, fb) {
  if (uid && state.users[uid]) return state.users[uid].nickname || state.users[uid].username || fb || "User";
  return fb || "User";
}

function renderAuthorLink(uid, fb) {
  var n = getUserDisplayNameByUid(uid, fb);
  return uid ? '<a class="poster-link" onclick="openPublicProfile(\'' + esc(uid) + '\')">' + esc(n) + '</a>' : '<strong>' + esc(n) + '</strong>';
}

function normalizeFavorites(raw) {
  var out = { films: [], tv: [], books: [], games: [] };
  var keys = ["films", "tv", "books", "games"];
  if (!raw || typeof raw !== "object") return out;
  for (var i = 0; i < keys.length; i++) {
    var l = raw[keys[i]];
    if (l && typeof l === "object") {
      for (var k in l) {
        if (l.hasOwnProperty(k) && l[k] && l[k].title) out[keys[i]].push(l[k]);
      }
    }
  }
  return out;
}

function normalizeCustomFields(raw) {
  var out = [];
  if (raw && typeof raw === "object") {
    for (var k in raw) {
      if (raw.hasOwnProperty(k) && raw[k] && (raw[k].label || raw[k].value)) {
        out.push({ label: String(raw[k].label || ""), value: String(raw[k].value || "") });
      }
    }
  }
  return out;
}

/* ==========================================================================
   HTTP XHR CLIENT & FIREBASE AUTH / TOKEN MANAGEMENT
   ========================================================================== */
function httpRequest(method, url, body, headers, cb, onProgress) {
  var xhr = new XMLHttpRequest();
  xhr.open(method, url, true);
  if (headers) {
    for (var k in headers) {
      if (headers.hasOwnProperty(k)) xhr.setRequestHeader(k, headers[k]);
    }
  }
  if (onProgress && xhr.upload) {
    xhr.upload.onprogress = function(ev) {
      if (ev && ev.lengthComputable && ev.total > 0) {
        onProgress(Math.round((ev.loaded / ev.total) * 100));
      }
    };
  }
  xhr.onreadystatechange = function() {
    if (xhr.readyState === 4) {
      var d = null;
      try { d = xhr.responseText ? JSON.parse(xhr.responseText) : null; } catch (e) { d = xhr.responseText; }
      if (xhr.status >= 200 && xhr.status < 300) cb(null, d);
      else cb({ status: xhr.status, data: d }, null);
    }
  };
  xhr.onerror = function() { cb({ status: 0, data: "Network error" }, null); };
  if (body !== null && body !== undefined) {
    if (typeof FormData !== "undefined" && body instanceof FormData) xhr.send(body);
    else if (typeof body === "string") xhr.send(body);
    else { xhr.setRequestHeader("Content-Type", "application/json"); xhr.send(JSON.stringify(body)); }
  } else {
    xhr.send();
  }
}

function dbGet(path, cb) {
  if (!isFirebaseConfigured()) { cb(null, null); return; }
  httpRequest("GET", CONFIG.firebaseDbUrl + "/" + path + ".json", null, null, cb);
}

function dbWrite(method, path, payload, cb, onProgress) {
  var q = (state.user && state.user.idToken) ? ("?auth=" + encodeURIComponent(state.user.idToken)) : "";
  httpRequest(method, CONFIG.firebaseDbUrl + "/" + path + ".json" + q, payload, null, function(err, res) {
    if (err && err.status === 401 && state.user && state.user.refreshToken) {
      refreshAuthToken(function(re) {
        if (re) {
          clearStaleSession();
          if (typeof renderChrome === "function") renderChrome();
          if (cb) cb(err, null);
        } else {
          httpRequest(method, CONFIG.firebaseDbUrl + "/" + path + ".json?auth=" + encodeURIComponent(state.user.idToken), payload, null, function(e2, r2) {
            if (cb) cb(e2, r2);
          }, onProgress);
        }
      });
    } else if (cb) {
      cb(err, res);
    }
  }, onProgress);
}

function saveSession() {
  if (state.user) storeSet("ib_session", JSON.stringify(state.user));
  else storeRemove("ib_session");
}

function clearStaleSession() {
  state.user = null;
  state.profile = emptyProfile("");
  storeRemove("ib_session");
}

function isTokenExpired(tok) {
  if (!tok || typeof tok !== "string") return true;
  var p = tok.split(".");
  if (p.length !== 3) return true;
  try {
    var b = p[1].replace(/-/g, "+").replace(/_/g, "/");
    while (b.length % 4) b += "=";
    var j = JSON.parse(atob(b));
    return !j.exp || Math.floor(new Date().getTime() / 1000) >= (j.exp - 60);
  } catch (e) {
    return true;
  }
}

function loadSession() {
  try {
    var p = JSON.parse(storeGet("ib_session") || "null");
    if (!p || !p.uid || !p.email || !p.idToken || p.email.indexOf("@" + CONFIG.emailDomain) === -1 || (isTokenExpired(p.idToken) && !p.refreshToken)) {
      clearStaleSession();
      return;
    }
    state.user = p;
  } catch (e) {
    clearStaleSession();
  }
}

function refreshAuthToken(cb) {
  if (!state.user || !state.user.refreshToken) { clearStaleSession(); cb("No token"); return; }
  httpRequest(
    "POST",
    "https://securetoken.googleapis.com/v1/token?key=" + encodeURIComponent(CONFIG.firebaseApiKey),
    "grant_type=refresh_token&refresh_token=" + encodeURIComponent(state.user.refreshToken),
    { "Content-Type": "application/x-www-form-urlencoded" },
    function(err, d) {
      if (err || !d || !d.id_token) { clearStaleSession(); cb("Expired"); return; }
      state.user.idToken = d.id_token;
      state.user.refreshToken = d.refresh_token;
      saveSession();
      cb(null);
    }
  );
}

function ensureFreshSession(cb) {
  if (!state.user || !isFirebaseConfigured()) { cb(); return; }
  function check() {
    httpRequest("POST", "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + encodeURIComponent(CONFIG.firebaseApiKey), { idToken: state.user.idToken }, null, function(e, d) {
      if (e || !d || !d.users || !d.users.length) clearStaleSession();
      cb();
    });
  }
  if (isTokenExpired(state.user.idToken)) {
    refreshAuthToken(function(e) { if (e) { clearStaleSession(); cb(); } else check(); });
  } else {
    check();
  }
}

function handleAuth(mode) {
  var raw = String(document.getElementById("authUsername").value || "").replace(/^\s+|\s+$/g, "");
  var pass = String(document.getElementById("authPassword").value || "");
  if (!raw || !pass) { showStatus("Enter name and password.", true); return; }
  var username = extractUsername(raw);
  var email = usernameToEmail(username);
  var isAdminTry = (username === ADMIN_USERNAME && pass === ADMIN_PASSWORD_INIT);
  clearStaleSession();

  var ep = (mode === "register") ? "signUp" : "signInWithPassword";
  var url = "https://identitytoolkit.googleapis.com/v1/accounts:" + ep + "?key=" + encodeURIComponent(CONFIG.firebaseApiKey);
  var payload = { email: email, password: pass, returnSecureToken: true };
  showStatus("Connecting as " + email + "...", false);

  httpRequest("POST", url, payload, null, function(err, data) {
    if (err && mode === "login" && isAdminTry) {
      httpRequest("POST", "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=" + encodeURIComponent(CONFIG.firebaseApiKey), payload, null, function(re, rd) {
        if (re || !rd || !rd.idToken) { showStatus("Enable Email/Password in Firebase Auth.", true); return; }
        finalizeAuth(username, email, rd, true);
      });
      return;
    }
    if (err || !data || !data.idToken) {
      var c = (err && err.data && err.data.error && err.data.error.message) ? err.data.error.message : "";
      showStatus((c === "EMAIL_NOT_FOUND" || c === "INVALID_LOGIN_CREDENTIALS") ? "Account not found. Click 'Register New Account'." : ("Auth error: " + (c || "Failed")), true);
      return;
    }
    finalizeAuth(username, email, data, email === (ADMIN_USERNAME + "@" + CONFIG.emailDomain));
  });
}

function finalizeAuth(username, email, data, isAdmin) {
  state.user = {
    uid: data.localId,
    username: username,
    email: email,
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    isAdmin: isAdmin
  };
  saveSession();
  dbGet("users", function(e, all) {
    if (all) {
      for (var old in all) {
        if (all.hasOwnProperty(old) && old !== state.user.uid && all[old] && (all[old].email === email || all[old].username === username)) {
          dbWrite("DELETE", "users/" + old, null, null);
        }
      }
    }
    loadUserProfile(function() {
      var nick = state.profile.nickname || username;
      var reg = state.profile.registeredAt || formatDateOnly(new Date().getTime());
      state.profile.nickname = nick;
      state.profile.registeredAt = reg;
      dbWrite("PATCH", "users/" + state.user.uid, { username: username, email: email, nickname: nick, registeredAt: reg }, null);
      showStatus("Welcome, " + username + "!", false);
      if (typeof refreshAllData === "function" && typeof switchView === "function") {
        refreshAllData(function() { switchView("board"); });
      }
    });
  });
}

function logoutUser() {
  clearStaleSession();
  showStatus("Logged out.", false);
  if (typeof renderAll === "function") renderAll();
}

function loadUserProfile(cb) {
  if (!state.user) { if (cb) cb(); return; }
  dbGet("users/" + state.user.uid, function(e, d) {
    var b = emptyProfile(state.user.username);
    if (d && typeof d === "object") {
      for (var k in b) {
        if (b.hasOwnProperty(k) && d[k] !== undefined) b[k] = d[k];
      }
      b.nickname = d.nickname || state.user.username;
      b.registeredAt = d.registeredAt || formatDateOnly(new Date().getTime());
      b.favorites = normalizeFavorites(d.favorites);
      b.customFields = normalizeCustomFields(d.customFields);
    } else {
      b.registeredAt = formatDateOnly(new Date().getTime());
      dbWrite("PATCH", "users/" + state.user.uid, {
        username: state.user.username,
        email: state.user.email,
        nickname: state.user.username,
        registeredAt: b.registeredAt
      }, null);
    }
    state.profile = b;
    if (cb) cb();
  });
}

function adminRemoveUserRecord(uid) {
  if (!state.user || !state.user.isAdmin || uid === state.user.uid) return;
  if (!confirm("Remove user DB record so their name can be reused?")) return;
  dbWrite("DELETE", "users/" + uid, null, function(e) {
    if (!e) {
      showStatus("User record removed.", false);
      if (typeof refreshAllData === "function" && typeof renderAll === "function") refreshAllData(renderAll);
    }
  });
}

/* ==========================================================================
   ADAPTIVE IMAGE UPLOADER (ALL FORMATS) & AUTOMATIC COMPRESSION
   ========================================================================== */
function readLocalDataUrl(file, cb, onReadProgress) {
  if (typeof FileReader === "undefined") { cb("FileReader unsupported.", null); return; }
  if (getFileExtension(file.name) === "svg" || file.type === "image/svg+xml") {
    var tr = new FileReader();
    tr.onprogress = function(ev) {
      if (onReadProgress && ev.lengthComputable && ev.total > 0) onReadProgress(Math.round((ev.loaded / ev.total) * 100));
    };
    tr.onload = function(e) {
      var cleanSvg = String(e.target.result || "").replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "").replace(/\son[a-z]+\s*=\s*["'][^"']*["']/gi, "");
      cb(null, "data:image/svg+xml;charset=utf-8," + encodeURIComponent(cleanSvg));
    };
    tr.onerror = function() { cb("SVG read error.", null); };
    tr.readAsText(file);
    return;
  }
  var r = new FileReader();
  r.onprogress = function(ev) {
    if (onReadProgress && ev.lengthComputable && ev.total > 0) onReadProgress(Math.round((ev.loaded / ev.total) * 100));
  };
  r.onload = function(e) { cb(null, e.target.result); };
  r.onerror = function() { cb("Image read error.", null); };
  r.readAsDataURL(file);
}

function compressImageToTargetBytes(dataUrl, targetBytes, cb) {
  setUploadProgress(35, "Optimizing image size...");
  var img = new Image();
  img.onload = function() {
    var w = img.width || 800, h = img.height || 600, maxDim = 1600, q = 0.82;
    if (w > maxDim || h > maxDim) {
      var sc = maxDim / Math.max(w, h);
      w = Math.round(w * sc);
      h = Math.round(h * sc);
    }
    var canvas = document.createElement("canvas");
    if (!canvas.getContext) { cb(dataUrl); return; }
    var result = dataUrl;
    for (var attempt = 0; attempt < 5; attempt++) {
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      result = canvas.toDataURL("image/jpeg", q);
      if (result.length * 0.75 <= targetBytes) break;
      q = Math.max(0.4, q - 0.14);
      w = Math.round(w * 0.78);
      h = Math.round(h * 0.78);
    }
    setUploadProgress(48, "Image ready to upload...");
    cb(result);
  };
  img.onerror = function() { cb(dataUrl); };
  img.src = dataUrl;
}

function uploadImageToImgbb(fileInput, cb, options) {
  if (!fileInput || !fileInput.files || !fileInput.files[0]) { cb(null, ""); return; }
  var file = fileInput.files[0];
  var maxBytes = (options && options.maxBytes) ? options.maxBytes : SERVICE_POLICY.imgbbMaxBytes;
  var keepBar = Boolean(options && options.keepProgressOpen);

  setUploadProgress(5, "Preparing image: " + file.name);
  var isSvg = (getFileExtension(file.name) === "svg" || file.type === "image/svg+xml");

  if (!isImgbbConfigured() || !SERVICE_POLICY.imgbbOnline || isSvg) {
    readLocalDataUrl(file, function(re, dUrl) {
      if (re) { setUploadProgress(-1); cb(re, null); return; }
      if (isSvg || dUrl.length * 0.75 <= SERVICE_POLICY.firebaseInlineImageMaxBytes) {
        setUploadProgress(keepBar ? 85 : 100, keepBar ? "Saving..." : "Image ready!");
        cb(null, dUrl);
        return;
      }
      compressImageToTargetBytes(dUrl, SERVICE_POLICY.firebaseInlineImageMaxBytes, function(cUrl) {
        setUploadProgress(keepBar ? 85 : 100, keepBar ? "Saving..." : "Image compressed!");
        cb(null, cUrl);
      });
    }, function(rp) { setUploadProgress(5 + Math.round(rp * 0.35), "Reading image..."); });
    return;
  }

  function sendToImgbb(payloadData, isBlob) {
    var url = "https://api.imgbb.com/1/upload?key=" + encodeURIComponent(CONFIG.imgbbApiKey);
    setUploadProgress(45, "Uploading image to ImgBB...");
    var body = isBlob ? (function() { var fd = new FormData(); fd.append("image", payloadData); return fd; })() : ("image=" + encodeURIComponent(payloadData.split(",")[1]));
    var hdrs = isBlob ? null : { "Content-Type": "application/x-www-form-urlencoded" };
    httpRequest("POST", url, body, hdrs, function(err, res) {
      if (!err && res && res.data && (res.data.url || res.data.display_url)) {
        setUploadProgress(keepBar ? 85 : 100, keepBar ? "Saving record..." : "Image uploaded!");
        cb(null, res.data.url || res.data.display_url);
        return;
      }
      var errMsg = (err && err.data && err.data.error && err.data.error.message) ? String(err.data.error.message).toLowerCase() : "";
      if ((err && err.status === 413) || errMsg.indexOf("size") !== -1 || errMsg.indexOf("large") !== -1) {
        SERVICE_POLICY.imgbbMaxBytes = Math.max(512000, Math.floor((file.size || 2000000) * 0.75));
        saveAndApplyPolicy("ImgBB limit set to " + (SERVICE_POLICY.imgbbMaxBytes / 1048576).toFixed(1) + " MB");
      }
      readLocalDataUrl(file, function(re2, dUrl2) {
        if (re2) { setUploadProgress(-1); cb("Upload failed.", null); return; }
        compressImageToTargetBytes(dUrl2, SERVICE_POLICY.firebaseInlineImageMaxBytes, function(cUrl2) {
          setUploadProgress(keepBar ? 85 : 100, keepBar ? "Saving record..." : "Image ready!");
          cb(null, cUrl2);
        });
      });
    }, function(upPct) {
      setUploadProgress(45 + Math.round(upPct * (keepBar ? 0.40 : 0.55)), "Uploading image to ImgBB...");
    });
  }

  if (file.size && file.size > maxBytes) {
    readLocalDataUrl(file, function(re, dUrl) {
      if (re) { setUploadProgress(-1); cb(re, null); return; }
      compressImageToTargetBytes(dUrl, maxBytes, function(cUrl) { sendToImgbb(cUrl, false); });
    }, function(rp) { setUploadProgress(5 + Math.round(rp * 0.30), "Reading oversized image..."); });
    return;
  }

  if (typeof FormData !== "undefined") sendToImgbb(file, true);
  else readLocalDataUrl(file, function(re, dUrl) { if (re) { setUploadProgress(-1); cb(re, null); } else sendToImgbb(dUrl, false); }, function(rp) { setUploadProgress(5 + Math.round(rp * 0.35), "Reading image..."); });
}

/* ==========================================================================
   AUTOMATIC WEB AUDIO COMPRESSOR (ADAPTS TO SERVICE LIMIT)
   ========================================================================== */
function encodeMonoWavBase64(samples, sampleRate, bitsPerSample) {
  var bytesPerSample = bitsPerSample === 8 ? 1 : 2;
  var dataSize = samples.length * bytesPerSample;
  var buf = new ArrayBuffer(44 + dataSize);
  var v = new DataView(buf);
  function writeStr(off, s) { for (var i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); }
  writeStr(0, "RIFF");
  v.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * bytesPerSample, true);
  v.setUint16(32, bytesPerSample, true);
  v.setUint16(34, bitsPerSample, true);
  writeStr(36, "data");
  v.setUint32(40, dataSize, true);
  var offset = 44;
  for (var j = 0; j < samples.length; j++) {
    var s = Math.max(-1, Math.min(1, samples[j]));
    if (bitsPerSample === 8) { v.setUint8(offset, Math.round((s + 1) * 127.5)); offset += 1; }
    else { v.setInt16(offset, s < 0 ? s * 32768 : s * 32767, true); offset += 2; }
  }
  var bytes = new Uint8Array(buf);
  var bin = "";
  for (var b = 0; b < bytes.length; b++) bin += String.fromCharCode(bytes[b]);
  return "data:audio/wav;base64," + btoa(bin);
}

function compressAudioToServiceLimit(file, targetBytes, cb) {
  if (typeof FileReader === "undefined") { cb("FileReader unsupported.", null); return; }
  setUploadProgress(5, "Reading audio: " + file.name);
  if (file.size <= targetBytes) {
    var rDirect = new FileReader();
    rDirect.onprogress = function(ev) {
      if (ev.lengthComputable && ev.total > 0) setUploadProgress(5 + Math.round((ev.loaded / ev.total) * 45), "Preparing audio...");
    };
    rDirect.onload = function(e) { setUploadProgress(55, "Audio ready to upload..."); cb(null, e.target.result); };
    rDirect.onerror = function() { cb("Audio read error.", null); };
    rDirect.readAsDataURL(file);
    return;
  }
  var AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) {
    cb("Browser lacks Web Audio compression; file exceeds " + Math.round(targetBytes / 1024) + " KB.", null);
    return;
  }
  var rBuf = new FileReader();
  rBuf.onprogress = function(ev) {
    if (ev.lengthComputable && ev.total > 0) setUploadProgress(5 + Math.round((ev.loaded / ev.total) * 25), "Reading audio buffer...");
  };
  rBuf.onload = function(e) {
    setUploadProgress(35, "Compressing audio to " + Math.round(targetBytes / 1024) + " KB limit...");
    var ctx = new AudioCtx();
    ctx.decodeAudioData(e.target.result, function(audioBuf) {
      setUploadProgress(48, "Encoding compressed audio...");
      var duration = audioBuf.duration || 1;
      var maxRawBytes = Math.max(40000, Math.floor(targetBytes * 0.72) - 64);
      var sampleRate = Math.max(8000, Math.min(22050, Math.floor(maxRawBytes / duration)));
      var src = audioBuf.getChannelData(0);
      var step = audioBuf.sampleRate / sampleRate;
      var outLen = Math.min(maxRawBytes, Math.floor(src.length / step));
      var down = new Float32Array(outLen);
      for (var i = 0; i < outLen; i++) down[i] = src[Math.floor(i * step)] || 0;
      if (ctx.close) try { ctx.close(); } catch (ce) {}
      var wavData = encodeMonoWavBase64(down, sampleRate, 8);
      setUploadProgress(55, "Compressed audio ready...");
      cb(null, wavData);
    }, function() {
      if (ctx.close) try { ctx.close(); } catch (ce) {}
      cb("Could not decode audio format for compression.", null);
    });
  };
  rBuf.onerror = function() { cb("Audio read error.", null); };
  rBuf.readAsArrayBuffer(file);
}