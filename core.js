/* ==========================================================================
   FEMBOORU CORE: FIREBASE AUTH/RTDB, IMGBB UPLOADER, DYNAMIC SERVICE POLICY,
   MUSIC COMPRESSOR/PLAYER, GLOBAL EFFECTS & SHARED STATE
   ========================================================================== */
var CONFIG = {
  firebaseConfig: {
    apiKey: "AIzaSyB2dRmsNzLoMrCpCp7k4RURFhEiRA9o7yE",
    authDomain: "fembooru-142a4.firebaseapp.com",
    databaseURL: "https://fembooru-142a4-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "fembooru-142a4",
    storageBucket: "fembooru-142a4.firebasestorage.app",
    messagingSenderId: "206195257844",
    appId: "1:206195257844:web:64507a7cbf3f33f26e09a1"
  },
  imgbbApiKey: "120a27bcbb28d3ffd9f03bc4b32bb54f",
  superiorAdminEmail: "admin@fembooru.ua",
  githubRepo: "parmanoidd/fembooru",
  realtimeSyncMs: 1200,
  autoRefreshMs: 3500
};

var SERVICE_POLICY = {
  imgbbMaxBytes: 32 * 1024 * 1024,
  rtdbMaxBytes: 260 * 1024,
  stickerMaxDim: 160,
  stickerMaxBytes: 512 * 1024,
  audioTargetBytes: 210 * 1024,
  wplaceStampMaxDim: 48
};

var DEFAULT_BOARDS = [
  { slug: "b", title: "/b/ — Random", desc: "General discussion, media, and threads." },
  { slug: "ua", title: "/ua/ — Ukraine & Pridnestrovie", desc: "Community hub for Ukraine and Pridnestrovie." },
  { slug: "music", title: "/music/ — Music & Radio", desc: "Upload tracks or post links — auto-added to radio!" },
  { slug: "tech", title: "/tech/ — Tech & Retro", desc: "SeaMonkey, Goanna, web, and hardware." },
  { slug: "art", title: "/art/ — Art & Stickers", desc: "Drawings, sprites, and pixelcraft." }
];

var DEFAULT_AVATAR_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140' viewBox='0 0 140 140'%3E%3Crect width='140' height='140' fill='%23EEAA88'/%3E%3Ccircle cx='70' cy='52' r='26' fill='%23800000'/%3E%3Cpath d='M25,130 C25,95 115,95 115,130' fill='%23800000'/%3E%3C/svg%3E";
var DEFAULT_SPRITE_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='68' height='68' viewBox='0 0 68 68'%3E%3Crect x='4' y='4' width='60' height='60' rx='10' fill='%23EEAA88' stroke='%23800000' stroke-width='3'/%3E%3Ccircle cx='24' cy='28' r='4' fill='%23800000'/%3E%3Ccircle cx='44' cy='28' r='4' fill='%23800000'/%3E%3Cpath d='M22,44 Q34,54 46,44' fill='none' stroke='%23800000' stroke-width='3'/%3E%3C/svg%3E";
var DEFAULT_FAVICON = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAWklEQVR42mP8z8AARQwwBhgZGf8zMjL+Z2Ji+s/AwPCfkZHxPxMT038GBob/DAwM/xkYGP4zMDD8Z2Bg+M/AwPCfgYHhPwMDw38GBob/DAwM/4E0Ix4x3AAAmv4P6X9x5eQAAAAASUVORK5CYII=";

var myClientId = "c_" + new Date().getTime().toString(36) + "_" + Math.floor(Math.random() * 99999);
var lastDataHash = "";
var autoRefreshTimer = null;

var state = {
  view: "boards",
  currentBoard: "b",
  user: null,
  profile: null,
  viewedProfileUid: null,
  boards: [],
  threads: {},
  polls: {},
  users: {},
  walls: {},
  wallFeedFilter: "all",
  groups: {},
  activeGroupId: null,
  dms: {},
  activeDmUid: null,
  stickers: {},
  stickerPickerTarget: null,
  subscriptions: {},
  blocks: {},
  notifications: {},
  music: {},
  wplacePixels: {},
  wplaceRecent: {},
  siteLogo: "",
  snowEffect: null,
  tabLogoEffect: null
};

var worldState = {
  cursors: {},
  cursorNodes: {},
  sprites: {},
  fireworks: {},
  explodedFireworks: {},
  particles: [],
  beams: [],
  hadFx: false,
  grabbedSpriteId: null,
  grabMode: "",
  throwVx: 0,
  throwVy: 0,
  lastMouseX: 200,
  lastMouseY: 200,
  lastCursorSendTime: 0,
  lastCursorRelX: -1,
  lastCursorDocY: -1,
  lastPlaygroundHtml: "",
  cursorChatOpen: false,
  localChatText: "",
  localChatExpiresAt: 0,
  shiftDownClean: false,
  propMenuOpen: false,
  propCatalog: [],
  activeTool: "physgun",
  actorEnabled: false,
  lastActorSendTime: 0,
  actors: {},
  actorNodes: {},
  keys: { left: false, right: false, jump: false },
  myActor: { x: 500, y: 200, vx: 0, vy: 0, facing: 1, hp: 100, grounded: false, swingUntil: 0, updatedAt: 0 }
};

var wplaceState = {
  selectedColor: "#800000",
  panMode: false,
  isDrawing: false,
  panStartX: 0,
  panStartY: 0,
  offsetX: 0,
  offsetY: 0,
  zoom: 12,
  lastDrawnKey: ""
};

/* ==========================================================================
   UTILITIES & LOCAL STORAGE
   ========================================================================== */
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeUrl(u) {
  var s = String(u || "").replace(/^\s+|\s+$/g, "");
  if (!s) return "";
  if (/^(https?:\/\/|data:image\/|data:audio\/|blob:)/i.test(s)) return s;
  return "";
}

function isValidImageSrc(u) {
  var s = safeUrl(u);
  return Boolean(s && /^(https?:\/\/|data:image\/|blob:)/i.test(s));
}

function generateId(prefix) {
  return (prefix || "id") + "_" + new Date().getTime().toString(36) + "_" + Math.floor(Math.random() * 100000).toString(36);
}

function countMapKeys(obj) {
  if (!obj || typeof obj !== "object") return 0;
  var n = 0;
  for (var k in obj) {
    if (obj.hasOwnProperty(k) && obj[k] !== null && obj[k] !== undefined) n++;
  }
  return n;
}

function formatTime(ts) {
  if (!ts) return "";
  var d = new Date(ts);
  function pad(v) { return v < 10 ? "0" + v : "" + v; }
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
}

function storeGet(k) {
  try { return window.localStorage.getItem("fb_" + k); } catch (e) { return null; }
}

function storeSet(k, v) {
  try { window.localStorage.setItem("fb_" + k, v); } catch (e) {}
}

function storeRemove(k) {
  try { window.localStorage.removeItem("fb_" + k); } catch (e) {}
}

var statusTimer = null;
function showStatus(msg, isErr) {
  var el = document.getElementById("statusBanner");
  if (!el) return;
  el.style.display = "block";
  el.style.background = isErr ? "#FFD2D2" : "#FFE4C4";
  el.textContent = msg;
  if (statusTimer) clearTimeout(statusTimer);
  statusTimer = setTimeout(function() { el.style.display = "none"; }, 4500);
}

var progressHideTimer = null;
function setUploadProgress(pct, label) {
  var wrap = document.getElementById("uploadProgressWrap");
  var bar = document.getElementById("uploadProgressBar");
  var lbl = document.getElementById("uploadProgressLabel");
  if (!wrap || !bar || !lbl) return;
  if (progressHideTimer) clearTimeout(progressHideTimer);
  if (pct < 0) {
    wrap.style.display = "none";
    return;
  }
  wrap.style.display = "block";
  var clamped = Math.max(0, Math.min(100, Math.round(pct)));
  bar.style.width = clamped + "%";
  lbl.textContent = (label || "Uploading...") + " " + clamped + "%";
  if (clamped >= 100) {
    progressHideTimer = setTimeout(function() { wrap.style.display = "none"; }, 1400);
  }
}

function openZoomModal(src, title, desc) {
  if (!isValidImageSrc(src)) return;
  var m = document.getElementById("mediaZoomModal");
  var img = document.getElementById("zoomModalImg");
  var t = document.getElementById("zoomModalTitle");
  var d = document.getElementById("zoomModalDesc");
  if (img) img.src = src;
  if (t) t.textContent = title || "Preview";
  if (d) d.textContent = desc || "";
  if (m) m.style.display = "block";
}

function closeZoomModal() {
  var m = document.getElementById("mediaZoomModal");
  if (m) m.style.display = "none";
}

function jumpWplaceTo(lat, lon, zoom) {
  wplaceState.offsetX = Math.round(lon * 20);
  wplaceState.offsetY = Math.round(-lat * 20);
  wplaceState.zoom = Math.max(4, Math.min(36, zoom || 12));
  var lbl = document.getElementById("wplaceCoords");
  if (lbl) lbl.textContent = "Lat: " + lat + ", Lon: " + lon + " • Zoom: " + wplaceState.zoom;
  if (typeof renderWplaceCanvas === "function") renderWplaceCanvas();
}

/* ==========================================================================
   FIREBASE REALTIME DATABASE REST CLIENT
   ========================================================================== */
function buildDbUrl(path, useAuth) {
  var clean = String(path || "").replace(/^\/+|\/+$/g, "");
  var url = CONFIG.firebaseConfig.databaseURL.replace(/\/+$/, "") + "/" + clean + ".json";
  if (useAuth && state.user && state.user.idToken) {
    url += "?auth=" + encodeURIComponent(state.user.idToken);
  }
  return url;
}

function dbGet(path, cb) {
  function sendGet(withAuth) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", buildDbUrl(path, withAuth), true);
    xhr.onreadystatechange = function() {
      if (xhr.readyState !== 4) return;
      if (xhr.status >= 200 && xhr.status < 300) {
        var data = null;
        try { data = JSON.parse(xhr.responseText); } catch (e) {}
        if (cb) cb(null, data);
      } else if (xhr.status === 401 && withAuth) {
        ensureFreshSession(function() { sendGet(false); });
      } else {
        if (cb) cb("HTTP " + xhr.status, null);
      }
    };
    xhr.onerror = function() { if (cb) cb("Network error", null); };
    xhr.send();
  }
  sendGet(Boolean(state.user && state.user.idToken));
}

function dbWrite(method, path, payload, cb, onProgress) {
  function execWrite(retried) {
    var xhr = new XMLHttpRequest();
    xhr.open(method, buildDbUrl(path, true), true);
    xhr.setRequestHeader("Content-Type", "application/json");
    if (onProgress && xhr.upload) {
      xhr.upload.onprogress = function(e) {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }
    xhr.onreadystatechange = function() {
      if (xhr.readyState !== 4) return;
      if (xhr.status >= 200 && xhr.status < 300) {
        var res = null;
        try { res = JSON.parse(xhr.responseText); } catch (e) {}
        if (cb) cb(null, res);
      } else if (xhr.status === 401 && state.user && !retried) {
        state.user.expiresAt = 0;
        ensureFreshSession(function() {
          if (state.user && state.user.idToken) execWrite(true);
          else {
            updateAuthUi();
            if (cb) cb("Session expired — please log in again.", null);
          }
        });
      } else {
        var errMsg = "Database error (" + xhr.status + ")";
        try {
          var parsed = JSON.parse(xhr.responseText);
          if (parsed && parsed.error) errMsg = parsed.error;
        } catch (e) {}
        if (cb) cb(errMsg, null);
      }
    };
    xhr.onerror = function() { if (cb) cb("Network error", null); };
    xhr.send(method === "DELETE" ? null : JSON.stringify(payload));
  }

  if (state.user) ensureFreshSession(function() { execWrite(false); });
  else execWrite(false);
}

/* ==========================================================================
   FIREBASE AUTHENTICATION (USERNAME -> @fembooru.ua) & ROLES
   ========================================================================== */
function usernameToEmail(rawName) {
  var clean = String(rawName || "").toLowerCase().replace(/[^a-z0-9._-]/g, "");
  if (!clean) return "";
  return clean + "@fembooru.ua";
}

function saveSession() {
  if (state.user) storeSet("session", JSON.stringify(state.user));
  else storeRemove("session");
}

function clearSession() {
  state.user = null;
  state.profile = null;
  storeRemove("session");
  updateAuthUi();
}

function loadSession() {
  var raw = storeGet("session");
  if (!raw) return;
  try {
    var s = JSON.parse(raw);
    var now = new Date().getTime();
    if (!s || !s.uid || !s.idToken || (!s.refreshToken && (!s.expiresAt || s.expiresAt < now))) {
      clearSession();
      return;
    }
    state.user = s;
  } catch (e) {
    clearSession();
  }
}

function ensureFreshSession(cb) {
  if (!state.user) { if (cb) cb(); return; }
  var now = new Date().getTime();
  if (state.user.expiresAt && (state.user.expiresAt - now) > 120000) {
    if (cb) cb();
    return;
  }
  if (!state.user.refreshToken) {
    clearSession();
    if (cb) cb();
    return;
  }
  var xhr = new XMLHttpRequest();
  xhr.open("POST", "https://securetoken.googleapis.com/v1/token?key=" + encodeURIComponent(CONFIG.firebaseConfig.apiKey), true);
  xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
  xhr.onreadystatechange = function() {
    if (xhr.readyState !== 4) return;
    if (xhr.status === 200) {
      try {
        var d = JSON.parse(xhr.responseText);
        state.user.idToken = d.id_token;
        state.user.refreshToken = d.refresh_token || state.user.refreshToken;
        state.user.expiresAt = new Date().getTime() + (parseInt(d.expires_in || "3600", 10) * 1000);
        saveSession();
      } catch (e) {
        clearSession();
      }
    } else if (xhr.status === 400 || xhr.status === 403) {
      clearSession();
    }
    if (cb) cb();
  };
  xhr.onerror = function() { if (cb) cb(); };
  xhr.send("grant_type=refresh_token&refresh_token=" + encodeURIComponent(state.user.refreshToken));
}

function getDisplayUsername() {
  if (state.profile && state.profile.displayName) return state.profile.displayName;
  if (state.user && state.user.username) return state.user.username;
  return "Anonymous";
}

function isSuperiorAdmin() {
  return Boolean(state.user && state.user.email === CONFIG.superiorAdminEmail);
}

function getUserRole(uid) {
  var u = state.users && state.users[uid];
  if (!u) return "user";
  if (u.email === CONFIG.superiorAdminEmail) return "superior_admin";
  return u.role || "user";
}

function isStaffUser() {
  if (!state.user) return false;
  if (isSuperiorAdmin()) return true;
  var r = getUserRole(state.user.uid);
  return r === "admin" || r === "moderator";
}

function canModerateTargetUser(targetUid) {
  if (!state.user) return false;
  if (isSuperiorAdmin()) return true;
  if (!isStaffUser()) return false;
  if (!targetUid || targetUid === state.user.uid) return true;
  var targetRole = getUserRole(targetUid);
  return targetRole === "user";
}

function isUserBlockedByMe(targetUid) {
  if (!state.user || !targetUid) return false;
  return Boolean(state.blocks && state.blocks[state.user.uid] && state.blocks[state.user.uid][targetUid]);
}

function isMeBlockedByUser(ownerUid) {
  if (!state.user || !ownerUid) return false;
  return Boolean(state.blocks && state.blocks[ownerUid] && state.blocks[ownerUid][state.user.uid]);
}

function updateAuthUi() {
  var outBox = document.getElementById("loggedOutControls");
  var inBox = document.getElementById("loggedInControls");
  var badge = document.getElementById("currentUserBadge");
  var adminBox = document.getElementById("adminLogoBox");
  if (state.user && state.user.uid && state.user.idToken) {
    if (outBox) outBox.style.display = "none";
    if (inBox) inBox.style.display = "flex";
    var roleTag = isSuperiorAdmin() ? " [SUPERIOR ADMIN]" : (getUserRole(state.user.uid) !== "user" ? " [" + getUserRole(state.user.uid).toUpperCase() + "]" : "");
    if (badge) badge.textContent = getDisplayUsername() + " (@" + state.user.username + ")" + roleTag;
    if (adminBox) adminBox.style.display = isSuperiorAdmin() ? "block" : "none";
  } else {
    if (outBox) outBox.style.display = "flex";
    if (inBox) inBox.style.display = "none";
    if (adminBox) adminBox.style.display = "none";
  }
}

function authRequest(endpoint, email, password, cb) {
  var xhr = new XMLHttpRequest();
  xhr.open("POST", "https://identitytoolkit.googleapis.com/v1/" + endpoint + "?key=" + encodeURIComponent(CONFIG.firebaseConfig.apiKey), true);
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.onreadystatechange = function() {
    if (xhr.readyState !== 4) return;
    var data = null;
    try { data = JSON.parse(xhr.responseText); } catch (e) {}
    if (xhr.status === 200 && data && data.idToken) cb(null, data);
    else cb((data && data.error && data.error.message) || "Auth failed", null);
  };
  xhr.onerror = function() { cb("Network error", null); };
  xhr.send(JSON.stringify({ email: email, password: password, returnSecureToken: true }));
}

function loadUserProfile(cb) {
  if (!state.user) { if (cb) cb(); return; }
  dbGet("users/" + state.user.uid, function(err, prof) {
    if (!err && prof && prof.uid) {
      state.profile = prof;
      state.users[state.user.uid] = prof;
      if (cb) cb(null);
    } else {
      var now = new Date().getTime();
      var fresh = {
        uid: state.user.uid,
        username: state.user.username,
        email: state.user.email,
        displayName: state.user.username,
        avatar: DEFAULT_AVATAR_SVG,
        status: "Hello from fembooru!",
        regDate: formatTime(now).split(" ")[0],
        role: state.user.email === CONFIG.superiorAdminEmail ? "superior_admin" : "user",
        createdAt: now
      };
      state.profile = fresh;
      state.users[state.user.uid] = fresh;
      dbWrite("PUT", "users/" + state.user.uid, fresh, function(wErr) {
        if (cb) cb(wErr);
      });
    }
  });
}

function cleanupOrphanUserRecords(email, activeUid) {
  dbGet("users", function(err, allUsers) {
    if (err || !allUsers) return;
    for (var oldUid in allUsers) {
      if (allUsers.hasOwnProperty(oldUid) && oldUid !== activeUid && allUsers[oldUid] && allUsers[oldUid].email === email) {
        dbWrite("DELETE", "users/" + oldUid, null, null);
      }
    }
  });
}

function completeAuthLogin(username, email, authData) {
  var expSec = parseInt(authData.expiresIn || "3600", 10);
  state.user = {
    uid: authData.localId,
    username: username,
    email: email,
    idToken: authData.idToken,
    refreshToken: authData.refreshToken,
    expiresAt: new Date().getTime() + (expSec * 1000)
  };
  saveSession();
  updateAuthUi();
  loadUserProfile(function(profErr) {
    updateAuthUi();
    cleanupOrphanUserRecords(email, state.user.uid);
    fetchAllData();
    if (profErr) {
      showStatus("Auth succeeded, but DB write failed: " + profErr, true);
    } else {
      showStatus("Logged in as " + username, false);
    }
  });
}

function loginUser() {
  var uEl = document.getElementById("authUsernameInput");
  var pEl = document.getElementById("authPasswordInput");
  var rawName = uEl ? uEl.value : "";
  var pass = pEl ? pEl.value : "";
  var email = usernameToEmail(rawName);
  var cleanName = email.split("@")[0];
  if (!email || !pass) {
    showStatus("Enter username and password.", true);
    return;
  }
  authRequest("accounts:signInWithPassword", email, pass, function(err, data) {
    if (!err && data) {
      if (pEl) pEl.value = "";
      completeAuthLogin(cleanName, email, data);
    } else {
      showStatus("Login failed: " + err, true);
    }
  });
}

function registerUser() {
  var uEl = document.getElementById("authUsernameInput");
  var pEl = document.getElementById("authPasswordInput");
  var rawName = uEl ? uEl.value : "";
  var pass = pEl ? pEl.value : "";
  var email = usernameToEmail(rawName);
  var cleanName = email.split("@")[0];
  if (!email || pass.length < 6) {
    showStatus("Username required and password must be at least 6 characters.", true);
    return;
  }
  authRequest("accounts:signUp", email, pass, function(err, data) {
    if (!err && data) {
      if (pEl) pEl.value = "";
      completeAuthLogin(cleanName, email, data);
    } else {
      showStatus("Registration failed: " + err, true);
    }
  });
}

function logoutUser() {
  clearSession();
  renderAll();
  showStatus("Logged out.", false);
}

function deleteOwnAccount() {
  if (!state.user) return;
  if (isSuperiorAdmin()) {
    showStatus("Superior admin account cannot be self-deleted.", true);
    return;
  }
  if (!window.confirm("Delete your account permanently? Someone else will be able to register with this name.")) return;
  var uid = state.user.uid;
  var token = state.user.idToken;
  dbWrite("DELETE", "users/" + uid, null, function() {
    var xhr = new XMLHttpRequest();
    xhr.open("POST", "https://identitytoolkit.googleapis.com/v1/accounts:delete?key=" + encodeURIComponent(CONFIG.firebaseConfig.apiKey), true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        delete state.users[uid];
        clearSession();
        renderAll();
        showStatus("Account deleted.", false);
      }
    };
    xhr.send(JSON.stringify({ idToken: token }));
  });
}

function assignUserRole(newRole) {
  if (!isSuperiorAdmin() || !state.viewedProfileUid) return;
  if (state.viewedProfileUid === state.user.uid) return;
  dbWrite("PUT", "users/" + state.viewedProfileUid + "/role", newRole, function(err) {
    if (!err) {
      if (state.users[state.viewedProfileUid]) state.users[state.viewedProfileUid].role = newRole;
      renderPublicProfile();
      showStatus("Role updated to " + newRole, false);
    } else {
      showStatus("Failed to update role: " + err, true);
    }
  });
}

/* ==========================================================================
   DYNAMIC SERVICE POLICY PROBE & GITHUB COMMIT COUNT
   ========================================================================== */
function probeServicePolicies() {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", "https://api.imgbb.com/1/upload?key=" + encodeURIComponent(CONFIG.imgbbApiKey), true);
  xhr.onreadystatechange = function() {
    if (xhr.readyState === 4 && xhr.status === 0) {
      SERVICE_POLICY.imgbbMaxBytes = 10 * 1024 * 1024;
    }
  };
  xhr.send();
}

function fetchGithubRepoVersion() {
  var el = document.getElementById("siteVersion");
  if (!el) return;
  var xhr = new XMLHttpRequest();
  xhr.open("GET", "https://api.github.com/repos/" + CONFIG.githubRepo + "/commits?per_page=1", true);
  xhr.onreadystatechange = function() {
    if (xhr.readyState !== 4) return;
    if (xhr.status === 200) {
      var link = xhr.getResponseHeader("Link") || "";
      var m = link.match(/[?&]page=(\d+)>;\s*rel="last"/);
      if (m && m[1]) {
        el.textContent = "fembooru (" + m[1] + ")";
      } else {
        try {
          var arr = JSON.parse(xhr.responseText);
          if (arr && arr.length) el.textContent = "fembooru (" + arr.length + ")";
        } catch (e) {}
      }
    }
  };
  xhr.send();
}

/* ==========================================================================
   IMGBB IMAGE UPLOADER (ALL FORMATS + STICKER SIZE LIMITER + PROGRESS BAR)
   ========================================================================== */
function resizeStickerBlob(file, cb) {
  var isAnimatedOrVector = /\.(gif|apng|mng|bpg|flif|svg)$/i.test(file.name || "") || /gif|svg/i.test(file.type || "");
  if (isAnimatedOrVector && file.size <= SERVICE_POLICY.stickerMaxBytes) {
    cb(null, file);
    return;
  }
  var img = new Image();
  var objUrl = URL.createObjectURL(file);
  img.onload = function() {
    URL.revokeObjectURL(objUrl);
    if (img.width <= SERVICE_POLICY.stickerMaxDim && img.height <= SERVICE_POLICY.stickerMaxDim && file.size <= SERVICE_POLICY.stickerMaxBytes) {
      cb(null, file);
      return;
    }
    var maxD = SERVICE_POLICY.stickerMaxDim;
    var scale = Math.min(maxD / Math.max(1, img.width), maxD / Math.max(1, img.height), 1);
    var w = Math.max(16, Math.round(img.width * scale));
    var h = Math.max(16, Math.round(img.height * scale));
    var c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    var ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    if (c.toBlob) {
      c.toBlob(function(blob) {
        cb(null, blob || file);
      }, "image/webp", 0.85);
    } else {
      cb(null, file);
    }
  };
  img.onerror = function() {
    URL.revokeObjectURL(objUrl);
    cb(null, file);
  };
  img.src = objUrl;
}

function uploadImageToImgbb(fileInputOrBlob, cb, opts) {
  opts = opts || {};
  var file = (fileInputOrBlob && fileInputOrBlob.files) ? fileInputOrBlob.files[0] : fileInputOrBlob;
  if (!file) { cb("No file selected.", null); return; }
  if (file.size > SERVICE_POLICY.imgbbMaxBytes) {
    cb("File exceeds service limit (" + Math.round(SERVICE_POLICY.imgbbMaxBytes / 1048576) + " MB).", null);
    return;
  }

  function sendToImgbb(uploadBlob) {
    var fd = new FormData();
    fd.append("image", uploadBlob, file.name || "upload.png");
    var xhr = new XMLHttpRequest();
    xhr.open("POST", "https://api.imgbb.com/1/upload?key=" + encodeURIComponent(CONFIG.imgbbApiKey), true);
    if (xhr.upload) {
      xhr.upload.onprogress = function(e) {
        if (e.lengthComputable) {
          setUploadProgress(Math.round((e.loaded / e.total) * 90), "Uploading image...");
        }
      };
    }
    xhr.onreadystatechange = function() {
      if (xhr.readyState !== 4) return;
      if (xhr.status === 200) {
        try {
          var res = JSON.parse(xhr.responseText);
          var url = res && res.data && (res.data.url || res.data.display_url);
          if (url) {
            if (!opts.keepProgressOpen) setUploadProgress(100, "Image uploaded!");
            cb(null, url);
            return;
          }
        } catch (e) {}
      }
      setUploadProgress(-1);
      cb("Image upload failed (" + xhr.status + ").", null);
    };
    xhr.onerror = function() {
      setUploadProgress(-1);
      cb("Network error during upload.", null);
    };
    setUploadProgress(5, "Preparing upload...");
    xhr.send(fd);
  }

  if (opts.isSticker) resizeStickerBlob(file, function(e, resized) { sendToImgbb(resized); });
  else sendToImgbb(file);
}

/* ==========================================================================
   ADMIN LOGO & GLOBAL 1-MINUTE EFFECTS (SNOW & TAB ICON)
   ========================================================================== */
function adminUpdateSiteLogo() {
  if (!isSuperiorAdmin()) return;
  var fEl = document.getElementById("adminLogoFile");
  var uEl = document.getElementById("adminLogoUrl");
  var direct = uEl ? safeUrl(uEl.value) : "";

  function saveLogo(url) {
    dbWrite("PUT", "site/logo", url, function(err) {
      if (!err) {
        state.siteLogo = url;
        var img = document.getElementById("siteLogoImg");
        if (img) img.src = url;
        if (uEl) uEl.value = "";
        showStatus("Site logo updated!", false);
      }
    });
  }

  if (fEl && fEl.files && fEl.files[0]) {
    uploadImageToImgbb(fEl, function(err, url) {
      if (!err && url) { fEl.value = ""; saveLogo(url); }
      else showStatus(err || "Logo upload failed", true);
    });
  } else if (direct) {
    saveLogo(direct);
  }
}

function adminResetLogos() {
  if (!isSuperiorAdmin()) return;
  dbWrite("DELETE", "site/logo", null, null);
  dbWrite("DELETE", "effects/tabLogo", null, null);
  state.siteLogo = "";
  state.tabLogoEffect = null;
  var img = document.getElementById("siteLogoImg");
  if (img) {
    img.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='210' height='68' viewBox='0 0 210 68'%3E%3Crect width='210' height='68' fill='%23EEAA88' stroke='%23800000' stroke-width='3'/%3E%3Ctext x='105' y='34' font-family='Arial,sans-serif' font-size='22' font-weight='bold' text-anchor='middle' fill='%23800000'%3Efembooru%3C/text%3E%3Ctext x='105' y='52' font-family='Arial,sans-serif' font-size='10' text-anchor='middle' fill='%23800000'%3EUA %E2%80%A2 PMR IMAGEBOARD%3C/text%3E%3C/svg%3E";
  }
  var fav = document.getElementById("dynamicFavicon");
  if (fav) fav.href = DEFAULT_FAVICON;
  showStatus("Site and tab logos reset to default.", false);
}

var snowAnimTimer = null;
var snowFlakes = [];
function triggerGlobalSnow() {
  var now = new Date().getTime();
  var payload = { expiresAt: now + 60000, by: getDisplayUsername() };
  state.snowEffect = payload;
  syncSnowState();
  dbWrite("PUT", "effects/snow", payload, function() {
    showStatus("Snow enabled for everyone for 1 minute!", false);
  });
}

function syncSnowState() {
  var canvas = document.getElementById("snowCanvas");
  var lbl = document.getElementById("snowTimerText");
  var now = new Date().getTime();
  var active = Boolean(state.snowEffect && state.snowEffect.expiresAt > now);

  if (!active) {
    if (snowAnimTimer) { clearInterval(snowAnimTimer); snowAnimTimer = null; }
    if (canvas && canvas.getContext) {
      var ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    if (lbl) lbl.textContent = "";
    return;
  }

  var secs = Math.ceil((state.snowEffect.expiresAt - now) / 1000);
  if (lbl) lbl.textContent = "Snow active (" + secs + "s left) by " + (state.snowEffect.by || "user");

  if (!snowAnimTimer && canvas && canvas.getContext) {
    snowFlakes = [];
    for (var i = 0; i < 65; i++) {
      snowFlakes.push({ x: Math.random() * 1200, y: Math.random() * 800, r: 2 + Math.random() * 3, vy: 1 + Math.random() * 2.2 });
    }
    snowAnimTimer = setInterval(function() {
      if (!state.snowEffect || state.snowEffect.expiresAt <= new Date().getTime()) {
        syncSnowState();
        return;
      }
      var w = window.innerWidth || 1000;
      var h = window.innerHeight || 700;
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      var c = canvas.getContext("2d");
      c.clearRect(0, 0, w, h);
      c.fillStyle = "rgba(180, 215, 255, 0.85)";
      for (var j = 0; j < snowFlakes.length; j++) {
        var f = snowFlakes[j];
        f.y += f.vy;
        f.x += Math.sin(f.y * 0.02) * 0.6;
        if (f.y > h) { f.y = -5; f.x = Math.random() * w; }
        c.beginPath();
        c.arc(f.x, f.y, f.r, 0, Math.PI * 2, true);
        c.fill();
      }
    }, 40);
  }
}

function triggerGlobalTabIcon() {
  var fEl = document.getElementById("tabIconFileInput");
  var uEl = document.getElementById("tabIconUrlInput");
  var direct = uEl ? safeUrl(uEl.value) : "";

  function applyIcon(url) {
    var payload = { url: url, expiresAt: new Date().getTime() + 60000, by: getDisplayUsername() };
    state.tabLogoEffect = payload;
    syncTabLogoState();
    dbWrite("PUT", "effects/tabLogo", payload, function() {
      if (uEl) uEl.value = "";
      showStatus("Tab icon changed for everyone for 1 minute!", false);
    });
  }

  if (fEl && fEl.files && fEl.files[0]) {
    uploadImageToImgbb(fEl, function(err, url) {
      if (!err && url) { fEl.value = ""; applyIcon(url); }
      else showStatus(err || "Tab icon upload failed", true);
    }, { isSticker: true });
  } else if (direct) {
    applyIcon(direct);
  } else {
    showStatus("Choose an image or URL for tab icon.", true);
  }
}

function syncTabLogoState() {
  var fav = document.getElementById("dynamicFavicon");
  var lbl = document.getElementById("tabIconTimerText");
  var now = new Date().getTime();
  if (state.tabLogoEffect && state.tabLogoEffect.expiresAt > now && isValidImageSrc(state.tabLogoEffect.url)) {
    if (fav && fav.href !== state.tabLogoEffect.url) fav.href = state.tabLogoEffect.url;
    var secs = Math.ceil((state.tabLogoEffect.expiresAt - now) / 1000);
    if (lbl) lbl.textContent = "Custom tab icon (" + secs + "s left)";
  } else {
    if (fav && fav.href !== DEFAULT_FAVICON) fav.href = DEFAULT_FAVICON;
    if (lbl) lbl.textContent = "";
  }
}

/* ==========================================================================
   MUSIC PLAYER (AUTO-COMPRESSION + SEAMLESS [local] -> CLOUD TRANSITION)
   ========================================================================== */
var musicState = {
  playlist: [],
  localQueue: [],
  currentIndex: 0,
  currentId: ""
};

function initMusicPlayer() {
  var audio = document.getElementById("audioPlayerEl");
  var widget = document.querySelector(".music-widget");
  if (!audio) return;
  audio.onplay = function() {
    var b = document.getElementById("musicPlayBtn");
    if (b) b.textContent = "Pause";
    if (widget) widget.className = "side-box music-widget is-playing";
  };
  audio.onpause = function() {
    var b = document.getElementById("musicPlayBtn");
    if (b) b.textContent = "Play";
    if (widget) widget.className = "side-box music-widget";
  };
  audio.onended = function() {
    nextMusicTrack();
  };
}

function rebuildMusicPlaylist() {
  var list = [];
  var seen = {};

  for (var i = 0; i < musicState.localQueue.length; i++) {
    var loc = musicState.localQueue[i];
    list.push(loc);
    seen[loc.id] = true;
  }

  for (var tid in state.music) {
    if (state.music.hasOwnProperty(tid) && state.music[tid] && !seen[tid]) {
      list.push(state.music[tid]);
      seen[tid] = true;
    }
  }

  for (var thId in state.threads) {
    if (state.threads.hasOwnProperty(thId) && state.threads[thId]) {
      var th = state.threads[thId];
      if (th.board === "music" && th.videoUrl && /\.(mp3|ogg|wav|m4a|flac|opus)(\?.*)?$/i.test(th.videoUrl)) {
        var autoId = "board_" + thId;
        if (!seen[autoId]) {
          list.push({
            id: autoId,
            title: (th.subject || "Music Thread") + " (" + (th.author || "Anon") + ")",
            src: th.videoUrl,
            createdAt: th.createdAt || 0
          });
          seen[autoId] = true;
        }
      }
    }
  }

  musicState.playlist = list;
  renderMusicPlaylist();
}

function renderMusicPlaylist() {
  var box = document.getElementById("musicPlaylist");
  if (!box) return;
  var h = "";
  for (var i = 0; i < musicState.playlist.length; i++) {
    var tr = musicState.playlist[i];
    var act = (tr.id === musicState.currentId) ? " active-track" : "";
    h += "<div class='music-track-item" + act + "' onclick='playMusicIndex(" + i + ")'>" + esc(tr.title) + "</div>";
  }
  box.innerHTML = h || "<div class='muted'>No tracks yet.</div>";
}

function playMusicIndex(idx) {
  if (!musicState.playlist.length) return;
  if (idx < 0) idx = musicState.playlist.length - 1;
  if (idx >= musicState.playlist.length) idx = 0;
  musicState.currentIndex = idx;
  var tr = musicState.playlist[idx];
  musicState.currentId = tr.id;
  var audio = document.getElementById("audioPlayerEl");
  var np = document.getElementById("musicNowPlaying");
  if (np) np.textContent = tr.title;
  if (audio && audio.src !== tr.src) {
    audio.src = tr.src;
  }
  if (audio && audio.play) audio.play();
  renderMusicPlaylist();
}

function toggleMusicPlay() {
  var audio = document.getElementById("audioPlayerEl");
  if (!audio) return;
  if (!audio.src && musicState.playlist.length) {
    playMusicIndex(0);
    return;
  }
  if (audio.paused) audio.play();
  else audio.pause();
}

function prevMusicTrack() { playMusicIndex(musicState.currentIndex - 1); }
function nextMusicTrack() { playMusicIndex(musicState.currentIndex + 1); }

function compressAudioToDataUrl(file, cb) {
  var AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx || !window.FileReader) {
    var fr = new FileReader();
    fr.onload = function() { cb(null, fr.result); };
    fr.onerror = function() { cb("Failed to read audio.", null); };
    fr.readAsDataURL(file);
    return;
  }

  var reader = new FileReader();
  reader.onload = function() {
    var ctx = new AudioCtx();
    ctx.decodeAudioData(reader.result, function(buf) {
      var targetRate = 11025;
      var maxSamples = Math.max(targetRate, Math.floor((SERVICE_POLICY.audioTargetBytes - 64) * 0.72));
      var srcData = buf.getChannelData(0);
      var ratio = buf.sampleRate / targetRate;
      var outLen = Math.min(maxSamples, Math.floor(srcData.length / ratio));

      var wavBytes = 44 + outLen;
      var ab = new ArrayBuffer(wavBytes);
      var view = new DataView(ab);
      function writeStr(off, s) { for (var i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); }
      writeStr(0, "RIFF");
      view.setUint32(4, 36 + outLen, true);
      writeStr(8, "WAVE");
      writeStr(12, "fmt ");
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);
      view.setUint32(24, targetRate, true);
      view.setUint32(28, targetRate, true);
      view.setUint16(32, 1, true);
      view.setUint16(34, 8, true);
      writeStr(36, "data");
      view.setUint32(40, outLen, true);

      for (var i = 0; i < outLen; i++) {
        var sample = Math.max(-1, Math.min(1, srcData[Math.floor(i * ratio)] || 0));
        view.setUint8(44 + i, Math.round((sample + 1) * 127.5));
      }

      var blob = new Blob([ab], { type: "audio/wav" });
      var bReader = new FileReader();
      bReader.onload = function() {
        if (ctx.close) ctx.close();
        cb(null, bReader.result);
      };
      bReader.readAsDataURL(blob);
    }, function() {
      if (ctx.close) ctx.close();
      cb("Unsupported audio codec for compression.", null);
    });
  };
  reader.onerror = function() { cb("Could not read audio file.", null); };
  reader.readAsArrayBuffer(file);
}

function uploadMusicTrack() {
  var fEl = document.getElementById("musicFileInput");
  var tEl = document.getElementById("musicTitleInput");
  if (!fEl || !fEl.files || !fEl.files[0]) {
    showStatus("Select an audio file first.", true);
    return;
  }
  var file = fEl.files[0];
  var cleanTitle = (tEl && tEl.value.replace(/^\s+|\s+$/g, "")) || file.name.replace(/\.[^.]+$/, "");
  var localId = generateId("loc");
  var blobUrl = URL.createObjectURL(file);

  musicState.localQueue.unshift({ id: localId, title: "[local] " + cleanTitle, src: blobUrl, isLocal: true });
  musicState.currentId = localId;
  rebuildMusicPlaylist();
  var audio = document.getElementById("audioPlayerEl");
  var np = document.getElementById("musicNowPlaying");
  if (np) np.textContent = "[local] " + cleanTitle;
  if (audio) { audio.src = blobUrl; if (audio.play) audio.play(); }

  setUploadProgress(15, "Compressing audio for service policy...");
  compressAudioToDataUrl(file, function(err, dataUrl) {
    if (err || !dataUrl) {
      setUploadProgress(-1);
      showStatus(err || "Audio compression failed.", true);
      return;
    }
    var cloudId = generateId("trk");
    var trackObj = {
      id: cloudId,
      title: cleanTitle,
      src: dataUrl,
      uid: state.user ? state.user.uid : "anon",
      author: getDisplayUsername(),
      createdAt: new Date().getTime()
    };
    dbWrite("PUT", "music/" + cloudId, trackObj, function(wErr) {
      if (!wErr) {
        for (var i = musicState.localQueue.length - 1; i >= 0; i--) {
          if (musicState.localQueue[i].id === localId) musicState.localQueue.splice(i, 1);
        }
        state.music[cloudId] = trackObj;
        if (musicState.currentId === localId) {
          musicState.currentId = cloudId;
          if (np) np.textContent = cleanTitle;
        }
        rebuildMusicPlaylist();
        if (tEl) tEl.value = "";
        fEl.value = "";
        setUploadProgress(100, "Audio synced to cloud!");
        showStatus("Track uploaded: " + cleanTitle, false);
      } else {
        setUploadProgress(-1);
        showStatus("Upload failed: " + wErr, true);
      }
    }, function(p) {
      setUploadProgress(25 + Math.round(p * 0.75), "Uploading compressed audio...");
    });
  });
}
