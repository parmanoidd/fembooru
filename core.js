/* ==========================================================================
   FEMBOORU CORE ENGINE: FIREBASE REST CLIENT, AUTHENTICATION, SESSION
   MANAGEMENT, SHARED APPLICATION STATE, MEDIA HELPERS & SNOW/TAB EFFECTS
   ========================================================================== */
var CONFIG = {
  firebaseDbUrl: "https://fembooru-142a4-default-rtdb.firebaseio.com",
  firebaseApiKey: "AIzaSyFembooruWebClientKeyPlaceholder",
  imgbbApiKey: "",
  realtimeSyncMs: 420,
  autoRefreshMs: 4000,
  superiorAdminEmail: "admin@fembooru.ua",
  githubRepo: "parmanoidd/fembooru"
};

var SERVICE_POLICY = {
  maxImageBytes: 8 * 1024 * 1024,
  maxAudioBytes: 15 * 1024 * 1024,
  wplaceStampMaxDim: 48
};

var DEFAULT_BOARDS = [
  { slug: "b", title: "/b/ — Random", desc: "General discussion, media, and threads." },
  { slug: "a", title: "/a/ — Anime & Art", desc: "Drawings, anime, comics, and visual culture." },
  { slug: "g", title: "/g/ — Tech & Games", desc: "Programming, Linux, modding, and video games." },
  { slug: "ua", title: "/ua/ — Ukraine & PMR", desc: "Local community, news, cities, and meetups." },
  { slug: "mu", title: "/mu/ — Music", desc: "Tracks, instruments, playlists, and production." },
  { slug: "meta", title: "/meta/ — Site & Polls", desc: "Board proposals, feedback, and site updates." }
];

var DEFAULT_SITE_LOGO =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='210' height='68' viewBox='0 0 210 68'%3E" +
  "%3Crect width='210' height='68' fill='%23EEAA88' stroke='%23800000' stroke-width='3'/%3E" +
  "%3Ctext x='105' y='34' font-family='Arial,sans-serif' font-size='22' font-weight='bold' text-anchor='middle' fill='%23800000'%3Efembooru%3C/text%3E" +
  "%3Ctext x='105' y='52' font-family='Arial,sans-serif' font-size='10' text-anchor='middle' fill='%23800000'%3EUA %E2%80%A2 PMR IMAGEBOARD%3C/text%3E" +
  "%3C/svg%3E";

var DEFAULT_FAVICON =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAWklEQVR42mP8z8AARQwwBhgZGf8zMjL+Z2Ji+s/AwPCfkZHxPxMT038GBob/DAwM/xkYGP4zMDD8Z2Bg+M/AwPCfgYHhPwMDw38GBob/DAwM/4E0Ix4x3AAAmv4P6X9x5eQAAAAASUVORK5CYII=";

var DEFAULT_AVATAR_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E" +
  "%3Crect width='120' height='120' fill='%23EEAA88'/%3E" +
  "%3Ccircle cx='60' cy='44' r='22' fill='%23800000'/%3E" +
  "%3Cpath d='M22 108 C22 80, 98 80, 98 108 Z' fill='%23800000'/%3E" +
  "%3C/svg%3E";

function generateId(prefix) {
  var rnd = Math.floor(Math.random() * 1000000).toString(36);
  var ts = new Date().getTime().toString(36);
  return (prefix || "id") + "_" + ts + "_" + rnd;
}

var myClientId = generateId("cli");
var lastDataHash = "";
var autoRefreshTimer = null;

var state = {
  view: "boards",
  currentBoard: "b",
  boards: [],
  threads: {},
  polls: {},
  users: {},
  walls: {},
  wallFilter: "all",
  viewedProfileUid: "",
  groups: {},
  activeGroupId: "",
  dms: {},
  activeDmUid: "",
  stickers: {},
  stickerPickerTarget: "",
  subscriptions: {},
  blocks: {},
  notifications: {},
  music: {},
  musicPlaylist: [],
  currentTrackIndex: -1,
  wplacePixels: {},
  wplaceRecent: {},
  siteLogo: "",
  snowEffect: null,
  tabLogoEffect: null,
  user: null,
  profile: null
};

var worldState = {
  propMenuOpen: false,
  propCatalog: [],
  activeTool: "physgun",
  sprites: {},
  spriteNodes: {},
  ownedSprites: {},
  lastSpriteSyncMap: {},
  grabbedSpriteId: null,
  grabbedActorId: null,
  isPointerDown: false,
  lastMouseX: 320,
  lastMouseY: 200,
  throwVx: 0,
  throwVy: 0,
  cursors: {},
  cursorNodes: {},
  lastCursorSendTime: 0,
  cursorChatOpen: false,
  localChatText: "",
  localChatExpiresAt: 0,
  shiftDownClean: false,
  fireworks: {},
  fireworkNodes: {},
  explodedFireworks: {},
  particles: [],
  hadFx: false,
  actorEnabled: false,
  actors: {},
  actorNodes: {},
  lastActorSendTime: 0,
  lastPlatformScan: 0,
  platformCache: [],
  dropThroughUntil: 0,
  keys: { left: false, right: false, jump: false, down: false },
  myActor: {
    x: 360,
    y: 120,
    vx: 0,
    vy: 0,
    facing: 1,
    hp: 100,
    grounded: false,
    frozen: false,
    swingUntil: 0
  }
};

var wplaceState = {
  selectedColor: "#800000",
  zoom: 12,
  offsetX: 622,
  offsetY: -968,
  isDrawing: false,
  panMode: false,
  panStartX: 0,
  panStartY: 0,
  lastDrawnKey: ""
};

/* ==========================================================================
   STRING, URL & UI HELPERS
   ========================================================================== */
function esc(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
  var d = new Date(Number(ts));
  if (isNaN(d.getTime())) return "";
  function pad(v) { return v < 10 ? "0" + v : String(v); }
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
    " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
}

function safeUrl(raw) {
  var u = String(raw || "").trim();
  if (!u) return "";
  if (/^https?:\/\//i.test(u) || /^data:image\//i.test(u) || /^data:audio\//i.test(u)) {
    return u;
  }
  return "";
}

function isValidImageSrc(src) {
  var s = String(src || "").trim();
  if (!s) return false;
  return (/^https?:\/\//i.test(s) || /^data:image\//i.test(s));
}

function showStatus(msg, isError) {
  var el = document.getElementById("statusBanner");
  if (!el) return;
  if (!msg) {
    el.style.display = "none";
    return;
  }
  el.textContent = msg;
  el.style.display = "block";
  el.style.backgroundColor = isError ? "#F4C7C3" : "#FFE4C4";
  el.style.color = isError ? "#990000" : "#800000";
  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(function() {
    el.style.display = "none";
  }, 4200);
}

function setUploadProgress(pct, label) {
  var wrap = document.getElementById("uploadProgressWrap");
  var bar = document.getElementById("uploadProgressBar");
  var lbl = document.getElementById("uploadProgressLabel");
  if (!wrap || !bar || !lbl) return;
  if (pct < 0 || pct >= 100) {
    wrap.style.display = "none";
    bar.style.width = "0%";
    return;
  }
  wrap.style.display = "block";
  bar.style.width = Math.max(2, Math.min(100, Math.round(pct))) + "%";
  lbl.textContent = label || ("Uploading... " + Math.round(pct) + "%");
}

function openZoomModal(src, title, desc) {
  if (!isValidImageSrc(src)) return;
  var modal = document.getElementById("mediaZoomModal");
  var img = document.getElementById("zoomModalImg");
  var tEl = document.getElementById("zoomModalTitle");
  var dEl = document.getElementById("zoomModalDesc");
  if (!modal || !img) return;
  img.src = src;
  if (tEl) tEl.textContent = title || "Preview";
  if (dEl) dEl.textContent = desc || "";
  modal.style.display = "block";
}

function closeZoomModal() {
  var modal = document.getElementById("mediaZoomModal");
  if (modal) modal.style.display = "none";
}

/* ==========================================================================
   USER ROLES & DISPLAY IDENTITY
   ========================================================================== */
function getDisplayUsername() {
  if (state.profile && state.profile.displayName) return state.profile.displayName;
  if (state.profile && state.profile.username) return state.profile.username;
  if (state.user && state.user.email) return state.user.email.split("@")[0];
  return "Anon";
}

function getUserRole(uid) {
  if (!uid || !state.users[uid]) return "user";
  var u = state.users[uid];
  if (u.email === CONFIG.superiorAdminEmail) return "admin";
  return u.role || "user";
}

function isSuperiorAdmin() {
  return Boolean(state.user && state.user.email === CONFIG.superiorAdminEmail);
}

function isStaffUser() {
  if (!state.user) return false;
  if (isSuperiorAdmin()) return true;
  var r = getUserRole(state.user.uid);
  return (r === "admin" || r === "moderator");
}

/* ==========================================================================
   FIREBASE REALTIME DATABASE REST CLIENT
   ========================================================================== */
function buildDbUrl(path, withAuth) {
  var base = CONFIG.firebaseDbUrl.replace(/\/+$/, "");
  var cleanPath = String(path || "").replace(/^\/+|\/+$/g, "");
  var url = base + (cleanPath ? "/" + cleanPath : "") + ".json";
  if (withAuth && state.user && state.user.idToken) {
    url += "?auth=" + encodeURIComponent(state.user.idToken);
  }
  return url;
}

function dbGet(path, callback) {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", buildDbUrl(path, Boolean(state.user && state.user.idToken)), true);
  xhr.onreadystatechange = function() {
    if (xhr.readyState !== 4) return;
    if (xhr.status >= 200 && xhr.status < 300) {
      var parsed = null;
      try { parsed = JSON.parse(xhr.responseText); } catch (e) {}
      if (callback) callback(null, parsed);
    } else {
      if (callback) callback("HTTP " + xhr.status, null);
    }
  };
  xhr.onerror = function() {
    if (callback) callback("Network error", null);
  };
  xhr.send();
}

function dbWrite(method, path, data, callback) {
  var xhr = new XMLHttpRequest();
  xhr.open(method, buildDbUrl(path, true), true);
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.onreadystatechange = function() {
    if (xhr.readyState !== 4) return;
    if (xhr.status >= 200 && xhr.status < 300) {
      var parsed = null;
      try { parsed = JSON.parse(xhr.responseText); } catch (e) {}
      if (callback) callback(null, parsed);
    } else {
      var errMsg = "Error " + xhr.status;
      try {
        var j = JSON.parse(xhr.responseText);
        if (j && j.error) errMsg = j.error;
      } catch (e2) {}
      if (callback) callback(errMsg, null);
    }
  };
  xhr.onerror = function() {
    if (callback) callback("Network error", null);
  };
  if (method === "DELETE") {
    xhr.send();
  } else {
    xhr.send(JSON.stringify(data));
  }
}

/* ==========================================================================
   FIREBASE AUTHENTICATION & SESSION PERSISTENCE
   ========================================================================== */
function saveSession() {
  try {
    if (state.user) localStorage.setItem("fembooru_session", JSON.stringify(state.user));
    else localStorage.removeItem("fembooru_session");
  } catch (e) {}
}

function loadSession() {
  try {
    var raw = localStorage.getItem("fembooru_session");
    if (raw) state.user = JSON.parse(raw);
  } catch (e) {
    state.user = null;
  }
}

function clearSession() {
  state.user = null;
  state.profile = null;
  saveSession();
}

function normalizeAuthEmail(rawName) {
  var v = String(rawName || "").trim();
  if (!v) return "";
  if (v.indexOf("@") !== -1) return v.toLowerCase();
  return v.toLowerCase().replace(/[^a-z0-9._-]/g, "") + "@fembooru.ua";
}

function ensureFreshSession(callback) {
  if (!state.user || !state.user.refreshToken) {
    if (callback) callback();
    return;
  }
  var now = new Date().getTime();
  if (state.user.expiresAt && now < (state.user.expiresAt - 120000)) {
    if (callback) callback();
    return;
  }
  var xhr = new XMLHttpRequest();
  xhr.open("POST", "https://securetoken.googleapis.com/v1/token?key=" + encodeURIComponent(CONFIG.firebaseApiKey), true);
  xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
  xhr.onreadystatechange = function() {
    if (xhr.readyState !== 4) return;
    if (xhr.status === 200) {
      try {
        var res = JSON.parse(xhr.responseText);
        if (res && res.id_token) {
          state.user.idToken = res.id_token;
          state.user.refreshToken = res.refresh_token || state.user.refreshToken;
          state.user.expiresAt = new Date().getTime() + (parseInt(res.expires_in || "3600", 10) * 1000);
          saveSession();
        }
      } catch (e) {}
    }
    if (callback) callback();
  };
  xhr.onerror = function() { if (callback) callback(); };
  xhr.send("grant_type=refresh_token&refresh_token=" + encodeURIComponent(state.user.refreshToken));
}

function updateAuthUi() {
  var outBox = document.getElementById("loggedOutControls");
  var inBox = document.getElementById("loggedInControls");
  var badge = document.getElementById("currentUserBadge");
  var adminBox = document.getElementById("adminLogoBox");

  if (state.user) {
    if (outBox) outBox.style.display = "none";
    if (inBox) inBox.style.display = "flex";
    var role = getUserRole(state.user.uid);
    var roleTag = role !== "user" ? (" [" + role.toUpperCase() + "]") : "";
    if (badge) badge.textContent = getDisplayUsername() + roleTag;
    if (adminBox) adminBox.style.display = isSuperiorAdmin() ? "block" : "none";
  } else {
    if (outBox) outBox.style.display = "flex";
    if (inBox) inBox.style.display = "none";
    if (adminBox) adminBox.style.display = "none";
  }
}

function loadUserProfile(callback) {
  if (!state.user || !state.user.uid) {
    if (callback) callback();
    return;
  }
  dbGet("users/" + state.user.uid, function(err, prof) {
    if (!err && prof && typeof prof === "object") {
      state.profile = prof;
      state.users[state.user.uid] = prof;
      if (callback) callback();
    } else {
      var uname = (state.user.email || "user").split("@")[0];
      var fresh = {
        uid: state.user.uid,
        email: state.user.email || "",
        username: uname,
        displayName: uname,
        avatar: DEFAULT_AVATAR_SVG,
        role: (state.user.email === CONFIG.superiorAdminEmail) ? "admin" : "user",
        regDate: formatTime(new Date().getTime()),
        status: "",
        pronouns: "",
        relationship: "",
        hometown: "",
        politics: "",
        birthDate: "",
        website: "",
        city: "",
        interests: "",
        about: ""
      };
      state.profile = fresh;
      state.users[state.user.uid] = fresh;
      dbWrite("PUT", "users/" + state.user.uid, fresh, function() {
        if (callback) callback();
      });
    }
  });
}

function loginUser() {
  var uEl = document.getElementById("authUsernameInput");
  var pEl = document.getElementById("authPasswordInput");
  var email = normalizeAuthEmail(uEl ? uEl.value : "");
  var pass = pEl ? pEl.value : "";
  if (!email || !pass) {
    showStatus("Enter username and password.", true);
    return;
  }
  var xhr = new XMLHttpRequest();
  xhr.open("POST", "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" + encodeURIComponent(CONFIG.firebaseApiKey), true);
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.onreadystatechange = function() {
    if (xhr.readyState !== 4) return;
    var res = {};
    try { res = JSON.parse(xhr.responseText); } catch (e) {}
    if (xhr.status === 200 && res.idToken) {
      state.user = {
        uid: res.localId,
        email: res.email,
        idToken: res.idToken,
        refreshToken: res.refreshToken,
        expiresAt: new Date().getTime() + (parseInt(res.expiresIn || "3600", 10) * 1000)
      };
      saveSession();
      if (pEl) pEl.value = "";
      loadUserProfile(function() {
        updateAuthUi();
        fetchAllData();
        showStatus("Logged in as " + getDisplayUsername(), false);
      });
    } else {
      var msg = (res && res.error && res.error.message) ? res.error.message : "Login failed";
      showStatus("Auth error: " + msg, true);
    }
  };
  xhr.send(JSON.stringify({ email: email, password: pass, returnSecureToken: true }));
}

function registerUser() {
  var uEl = document.getElementById("authUsernameInput");
  var pEl = document.getElementById("authPasswordInput");
  var rawName = uEl ? uEl.value.trim() : "";
  var email = normalizeAuthEmail(rawName);
  var pass = pEl ? pEl.value : "";
  if (!email || pass.length < 6) {
    showStatus("Enter username and password (min 6 chars).", true);
    return;
  }
  var xhr = new XMLHttpRequest();
  xhr.open("POST", "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=" + encodeURIComponent(CONFIG.firebaseApiKey), true);
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.onreadystatechange = function() {
    if (xhr.readyState !== 4) return;
    var res = {};
    try { res = JSON.parse(xhr.responseText); } catch (e) {}
    if (xhr.status === 200 && res.idToken) {
      state.user = {
        uid: res.localId,
        email: res.email,
        idToken: res.idToken,
        refreshToken: res.refreshToken,
        expiresAt: new Date().getTime() + (parseInt(res.expiresIn || "3600", 10) * 1000)
      };
      saveSession();
      if (pEl) pEl.value = "";
      var uname = rawName.indexOf("@") !== -1 ? rawName.split("@")[0] : rawName;
      var prof = {
        uid: res.localId,
        email: res.email,
        username: uname,
        displayName: uname,
        avatar: DEFAULT_AVATAR_SVG,
        role: (res.email === CONFIG.superiorAdminEmail) ? "admin" : "user",
        regDate: formatTime(new Date().getTime())
      };
      state.profile = prof;
      state.users[res.localId] = prof;
      dbWrite("PUT", "users/" + res.localId, prof, function() {
        updateAuthUi();
        fetchAllData();
        showStatus("Registered & logged in as " + uname + "!", false);
      });
    } else {
      var msg = (res && res.error && res.error.message) ? res.error.message : "Registration failed";
      showStatus("Register error: " + msg, true);
    }
  };
  xhr.send(JSON.stringify({ email: email, password: pass, returnSecureToken: true }));
}

function logoutUser() {
  clearSession();
  updateAuthUi();
  renderAll();
  showStatus("Logged out.", false);
}

function deleteOwnAccount() {
  if (!state.user) return;
  if (!confirm("Delete your account permanently?")) return;
  var uid = state.user.uid;
  var token = state.user.idToken;
  dbWrite("DELETE", "users/" + uid, null, function() {
    var xhr = new XMLHttpRequest();
    xhr.open("POST", "https://identitytoolkit.googleapis.com/v1/accounts:delete?key=" + encodeURIComponent(CONFIG.firebaseApiKey), true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.onreadystatechange = function() {
      if (xhr.readyState !== 4) return;
      clearSession();
      updateAuthUi();
      fetchAllData();
      showStatus("Account deleted.", false);
    };
    xhr.send(JSON.stringify({ idToken: token }));
  });
}

/* ==========================================================================
   IMAGE & AUDIO UPLOAD PIPELINE (IMGBB + LOCAL CANVAS DATA-URL FALLBACK)
   ========================================================================== */
function encodeFileToOptimizedDataUrl(file, opts, callback) {
  var isAnimatedOrVector = /image\/(gif|svg\+xml|apng)/i.test(file.type || "");
  var reader = new FileReader();
  reader.onload = function(ev) {
    var rawDataUrl = ev.target.result;
    if (isAnimatedOrVector || file.size <= 220 * 1024) {
      setUploadProgress(-1);
      callback(null, rawDataUrl);
      return;
    }
    var img = new Image();
    img.onload = function() {
      var maxDim = (opts && opts.isSticker) ? 260 : 960;
      var scale = Math.min(maxDim / Math.max(1, img.width), maxDim / Math.max(1, img.height), 1);
      var w = Math.max(1, Math.round(img.width * scale));
      var h = Math.max(1, Math.round(img.height * scale));
      var canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      var outUrl = canvas.toDataURL("image/webp", 0.84);
      if (!outUrl || outUrl.indexOf("data:image/webp") !== 0) {
        outUrl = canvas.toDataURL("image/jpeg", 0.84);
      }
      setUploadProgress(-1);
      callback(null, outUrl);
    };
    img.onerror = function() {
      setUploadProgress(-1);
      callback(null, rawDataUrl);
    };
    img.src = rawDataUrl;
  };
  reader.onerror = function() {
    setUploadProgress(-1);
    callback("Failed to read file.", null);
  };
  reader.readAsDataURL(file);
}

function uploadImageToImgbb(fileInput, callback, opts) {
  var file = (fileInput && fileInput.files) ? fileInput.files[0] : fileInput;
  if (!file) {
    callback("No file selected.", null);
    return;
  }
  if (file.size > SERVICE_POLICY.maxImageBytes) {
    callback("Image exceeds 8 MB limit.", null);
    return;
  }
  setUploadProgress(25, "Processing image...");

  if (!CONFIG.imgbbApiKey) {
    encodeFileToOptimizedDataUrl(file, opts, callback);
    return;
  }

  var reader = new FileReader();
  reader.onload = function(ev) {
    var b64 = String(ev.target.result || "").replace(/^data:[^;]+;base64,/, "");
    var form = new FormData();
    form.append("image", b64);
    var xhr = new XMLHttpRequest();
    xhr.open("POST", "https://api.imgbb.com/1/upload?key=" + encodeURIComponent(CONFIG.imgbbApiKey), true);
    if (xhr.upload) {
      xhr.upload.onprogress = function(pe) {
        if (pe.lengthComputable) {
          setUploadProgress((pe.loaded / pe.total) * 100, "Uploading image...");
        }
      };
    }
    xhr.onreadystatechange = function() {
      if (xhr.readyState !== 4) return;
      setUploadProgress(-1);
      if (xhr.status === 200) {
        try {
          var res = JSON.parse(xhr.responseText);
          if (res && res.data && res.data.url) {
            callback(null, res.data.url);
            return;
          }
        } catch (e) {}
      }
      encodeFileToOptimizedDataUrl(file, opts, callback);
    };
    xhr.onerror = function() {
      setUploadProgress(-1);
      encodeFileToOptimizedDataUrl(file, opts, callback);
    };
    xhr.send(form);
  };
  reader.readAsDataURL(file);
}

function uploadAudioToHost(fileInput, callback) {
  var file = (fileInput && fileInput.files) ? fileInput.files[0] : fileInput;
  if (!file) {
    callback("No audio file selected.", null);
    return;
  }
  if (file.size > SERVICE_POLICY.maxAudioBytes) {
    callback("Audio exceeds 15 MB limit.", null);
    return;
  }
  setUploadProgress(30, "Reading audio track...");
  var reader = new FileReader();
  reader.onload = function(ev) {
    setUploadProgress(-1);
    callback(null, ev.target.result);
  };
  reader.onerror = function() {
    setUploadProgress(-1);
    callback("Could not read audio file.", null);
  };
  reader.readAsDataURL(file);
}

function probeServicePolicies() {
  // Ensures policy defaults remain active
}

function fetchGithubRepoVersion() {
  var el = document.getElementById("siteVersion");
  if (!el) return;
  var xhr = new XMLHttpRequest();
  xhr.open("GET", "https://api.github.com/repos/" + CONFIG.githubRepo + "/commits?per_page=1", true);
  xhr.onreadystatechange = function() {
    if (xhr.readyState !== 4 || xhr.status !== 200) return;
    try {
      var list = JSON.parse(xhr.responseText);
      if (list && list[0] && list[0].sha) {
        el.textContent = "fembooru (" + list[0].sha.substring(0, 7) + ")";
      }
    } catch (e) {}
  };
  xhr.send();
}

/* ==========================================================================
   GLOBAL 1-MINUTE EFFECTS: SNOWFALL & TAB FAVICON
   ========================================================================== */
var snowParticles = [];
var snowAnimId = null;

function triggerGlobalSnow() {
  var now = new Date().getTime();
  var payload = {
    expiresAt: now + 60000,
    by: getDisplayUsername()
  };
  state.snowEffect = payload;
  syncSnowState();
  dbWrite("PUT", "effects/snow", payload, function() {
    showStatus("Global snow enabled for 1 minute!", false);
  });
}

function syncSnowState() {
  var canvas = document.getElementById("snowCanvas");
  var timerEl = document.getElementById("snowTimerText");
  var now = new Date().getTime();
  var active = state.snowEffect && state.snowEffect.expiresAt && state.snowEffect.expiresAt > now;

  if (!active) {
    if (timerEl) timerEl.textContent = "";
    if (snowAnimId) {
      cancelAnimationFrame(snowAnimId);
      snowAnimId = null;
    }
    if (canvas && canvas.getContext) {
      canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    }
    return;
  }

  var secs = Math.ceil((state.snowEffect.expiresAt - now) / 1000);
  if (timerEl) timerEl.textContent = "Snow active: " + secs + "s left";

  if (!snowParticles.length) {
    for (var i = 0; i < 90; i++) {
      snowParticles.push({
        x: Math.random() * (window.innerWidth || 1000),
        y: Math.random() * (window.innerHeight || 700),
        r: 1.5 + Math.random() * 3,
        vy: 35 + Math.random() * 65,
        vx: (Math.random() - 0.5) * 28
      });
    }
  }

  if (!snowAnimId && canvas && canvas.getContext) {
    var lastSnowMs = now;
    function stepSnow() {
      var t = new Date().getTime();
      if (!state.snowEffect || state.snowEffect.expiresAt <= t) {
        syncSnowState();
        return;
      }
      var dt = Math.min(0.05, (t - lastSnowMs) / 1000);
      lastSnowMs = t;
      var w = window.innerWidth || 1000;
      var h = window.innerHeight || 700;
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      var ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.strokeStyle = "rgba(180, 200, 220, 0.75)";
      for (var j = 0; j < snowParticles.length; j++) {
        var f = snowParticles[j];
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        if (f.y > h) { f.y = -5; f.x = Math.random() * w; }
        if (f.x < 0) f.x = w;
        if (f.x > w) f.x = 0;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      snowAnimId = requestAnimationFrame(stepSnow);
    }
    snowAnimId = requestAnimationFrame(stepSnow);
  }
}

function triggerGlobalTabIcon() {
  var fEl = document.getElementById("tabIconFileInput");
  var uEl = document.getElementById("tabIconUrlInput");
  var direct = uEl ? safeUrl(uEl.value) : "";

  function applyIcon(iconUrl) {
    var payload = {
      url: iconUrl,
      expiresAt: new Date().getTime() + 60000,
      by: getDisplayUsername()
    };
    state.tabLogoEffect = payload;
    syncTabLogoState();
    dbWrite("PUT", "effects/tabLogo", payload, function() {
      showStatus("Tab icon changed globally for 1 minute!", false);
    });
  }

  if (fEl && fEl.files && fEl.files[0]) {
    uploadImageToImgbb(fEl, function(err, url) {
      if (!err && url) {
        fEl.value = "";
        applyIcon(url);
      } else {
        showStatus(err || "Tab icon upload failed.", true);
      }
    }, { isSticker: true });
  } else if (direct) {
    if (uEl) uEl.value = "";
    applyIcon(direct);
  } else {
    showStatus("Select an image or enter a tab icon URL.", true);
  }
}

function syncTabLogoState() {
  var fav = document.getElementById("dynamicFavicon");
  var timerEl = document.getElementById("tabIconTimerText");
  var now = new Date().getTime();
  var active = state.tabLogoEffect && state.tabLogoEffect.expiresAt &&
    state.tabLogoEffect.expiresAt > now && isValidImageSrc(state.tabLogoEffect.url);

  if (active) {
    if (fav && fav.href !== state.tabLogoEffect.url) fav.href = state.tabLogoEffect.url;
    var secs = Math.ceil((state.tabLogoEffect.expiresAt - now) / 1000);
    if (timerEl) timerEl.textContent = "Tab icon active: " + secs + "s left";
  } else {
    if (fav && fav.href !== DEFAULT_FAVICON) fav.href = DEFAULT_FAVICON;
    if (timerEl) timerEl.textContent = "";
  }
}
