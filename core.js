/* ==========================================================================
   FEMBOORU CORE: CONFIG, ADAPTIVE POLICY, AUTH, FIREBASE REST, IMGBB & EFFECTS
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
  imgbbUploadUrl: "https://api.imgbb.com/1/upload",
  emailDomain: "fembooru.ua",
  adminUsername: "admin",
  adminEmail: "admin@fembooru.ua",
  adminPassword: "@!1Abeccod201222",
  mainLogoRedirectUrl: "https://parmanoidd.github.io/fembooru/",
  githubCommitsApi: "https://api.github.com/repos/parmanoidd/fembooru/commits?per_page=1",
  autoRefreshMs: 4000,
  realtimeSyncMs: 420
};

var SERVICE_POLICY = {
  imgbbMaxBytes: 32 * 1024 * 1024,
  firebaseAudioMaxBytes: 420 * 1024,
  stickerMaxBytes: 900 * 1024,
  stickerMaxDim: 160,
  wplaceStampMaxDim: 36,
  lastCheckedAt: 0
};

var DEFAULT_BOARDS = [
  { slug: "b", title: "Random", desc: "General discussion, media, and threads." },
  { slug: "ua", title: "Ukraine", desc: "Ukrainian community, culture, and news." },
  { slug: "pmr", title: "Pridnestrovie", desc: "Pridnestrovie community and local life." },
  { slug: "music", title: "Music", desc: "Share tracks — auto-added to the radio player." },
  { slug: "art", title: "Art & Pixel", desc: "Drawings, pixel art, and creative works." },
  { slug: "tech", title: "Retro & Tech", desc: "SeaMonkey, Goanna, web, and hardware." }
];

var DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Crect width='120' height='120' fill='%23EEAA88'/%3E%3Ccircle cx='60' cy='45' r='22' fill='%23FFFFEE'/%3E%3Cpath d='M24 108 C24 78 96 78 96 108' fill='%23FFFFEE'/%3E%3C/svg%3E";
var DEFAULT_FAV_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='100' viewBox='0 0 180 100'%3E%3Crect width='180' height='100' fill='%231E1F22'/%3E%3Ctext x='90' y='55' font-family='Arial' font-size='13' fill='%23B5BAC1' text-anchor='middle'%3EFAVORITE%3C/text%3E%3C/svg%3E";
var DEFAULT_SPRITE_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'%3E%3Crect x='6' y='6' width='68' height='68' fill='%23EEAA88' stroke='%23800000' stroke-width='4'/%3E%3Ctext x='40' y='45' font-family='Arial' font-size='12' font-weight='bold' fill='%23800000' text-anchor='middle'%3EPROP%3C/text%3E%3C/svg%3E";

var myClientId = "cli_" + Math.random().toString(36).substring(2, 10) + "_" + new Date().getTime().toString(36);
var lastDataHash = "";
var autoRefreshTimer = null;

var state = {
  user: null,
  profile: {},
  view: "boards",
  currentBoard: "b",
  viewingProfileUid: "",
  wallFilter: "all",
  activeGroupId: "",
  activeDmPeerUid: "",
  activeStickerTarget: "",
  boards: [],
  threads: {},
  polls: {},
  users: {},
  walls: {},
  groups: {},
  dms: {},
  stickers: {},
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
  actors: {},
  actorNodes: {},
  particles: [],
  beams: [],
  hadFx: false,
  lastPlaygroundHtml: "",
  activeTool: "physgun",
  propMenuOpen: false,
  propCatalog: [],
  grabbedSpriteId: null,
  grabMode: "",
  throwVx: 0,
  throwVy: 0,
  lastDragSyncTime: 0,
  lastMouseX: 220,
  lastMouseY: 220,
  lastCursorSendTime: 0,
  lastCursorRelX: -1,
  lastCursorDocY: -1,
  cursorChatOpen: false,
  localChatText: "",
  localChatExpiresAt: 0,
  shiftDownClean: false,
  actorEnabled: false,
  lastActorSendTime: 0,
  keys: { left: false, right: false, jump: false },
  myActor: { x: 500, y: 200, vx: 0, vy: 0, facing: 1, grounded: false, hp: 100, swingUntil: 0 }
};

var musicState = {
  tracks: [],
  currentIndex: -1,
  localTempTrack: null
};

var wplaceState = {
  offsetX: 0,
  offsetY: 0,
  zoom: 12,
  selectedColor: "#800000",
  panMode: false,
  isDrawing: false,
  panStartX: 0,
  panStartY: 0,
  lastDrawnKey: ""
};

/* ==========================================================================
   GENERAL HELPERS, STORAGE, PROGRESS BAR & MODALS
   ========================================================================== */
function esc(s) {
  return String(s === null || s === undefined ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function generateId(prefix) {
  return (prefix || "id") + "_" + new Date().getTime().toString(36) + "_" + Math.random().toString(36).substring(2, 7);
}

function formatTime(ts) {
  if (!ts) return "";
  var d = new Date(ts);
  function pad(n) { return n < 10 ? "0" + n : String(n); }
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
}

function safeUrl(u) {
  var s = String(u || "").replace(/^\s+|\s+$/g, "");
  if (!s) return "";
  if (/^https?:\/\//i.test(s) || /^data:image\//i.test(s) || /^data:audio\//i.test(s)) return s;
  return "";
}

function isValidImageSrc(u) {
  var s = safeUrl(u);
  return Boolean(s && (/^https?:\/\//i.test(s) || /^data:image\//i.test(s)));
}

function storeGet(k) {
  try { return window.localStorage.getItem("fb_" + k); } catch (e) { return null; }
}

function storeSet(k, v) {
  try {
    if (v === null || v === undefined) window.localStorage.removeItem("fb_" + k);
    else window.localStorage.setItem("fb_" + k, String(v));
  } catch (e) {}
}

function showStatus(msg, isErr) {
  var el = document.getElementById("statusBanner");
  if (!el) return;
  if (!msg) {
    el.style.display = "none";
    el.textContent = "";
    return;
  }
  el.style.display = "block";
  el.style.background = isErr ? "#FFD2D2" : "#FFE4C4";
  el.textContent = msg;
  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(function() { el.style.display = "none"; }, 5500);
}

function setUploadProgress(pct, label) {
  var wrap = document.getElementById("uploadProgressWrap");
  var bar = document.getElementById("uploadProgressBar");
  var lbl = document.getElementById("uploadProgressLabel");
  if (!wrap || !bar || !lbl) return;
  if (pct < 0) {
    wrap.style.display = "none";
    bar.style.width = "0%";
    return;
  }
  wrap.style.display = "block";
  var clamped = Math.max(0, Math.min(100, Math.round(pct)));
  bar.style.width = clamped + "%";
  lbl.textContent = (label || "Uploading...") + " " + clamped + "%";
  if (clamped >= 100) {
    setTimeout(function() { wrap.style.display = "none"; bar.style.width = "0%"; }, 1400);
  }
}

function openZoomModal(src, title, desc) {
  if (!isValidImageSrc(src)) return;
  var m = document.getElementById("mediaZoomModal");
  var img = document.getElementById("zoomModalImg");
  var t = document.getElementById("zoomModalTitle");
  var d = document.getElementById("zoomModalDesc");
  if (!m || !img) return;
  img.src = src;
  if (t) t.textContent = title || "Preview";
  if (d) d.textContent = desc || "";
  m.style.display = "block";
}

function closeZoomModal() {
  var m = document.getElementById("mediaZoomModal");
  if (m) m.style.display = "none";
}

/* ==========================================================================
   ADAPTIVE SERVICE POLICY & GITHUB COMMIT VERSIONING
   ========================================================================== */
function probeServicePolicies() {
  SERVICE_POLICY.lastCheckedAt = new Date().getTime();
  // Check Firebase RTDB reachable payload characteristics & adapt limits automatically
  var xhr = new XMLHttpRequest();
  xhr.open("GET", CONFIG.firebaseConfig.databaseURL + "/site.json?shallow=true", true);
  xhr.onreadystatechange = function() {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        var maxHeader = xhr.getResponseHeader("X-Firebase-Max-Payload");
        if (maxHeader && parseInt(maxHeader, 10) > 10000) {
          SERVICE_POLICY.firebaseAudioMaxBytes = Math.min(750 * 1024, Math.floor(parseInt(maxHeader, 10) * 0.6));
        }
      } else if (xhr.status === 413) {
        SERVICE_POLICY.firebaseAudioMaxBytes = Math.max(120 * 1024, Math.floor(SERVICE_POLICY.firebaseAudioMaxBytes * 0.65));
      }
    }
  };
  xhr.send();
}

function adaptPolicyOnServiceError(serviceName, statusCode, errMsg) {
  var msg = String(errMsg || "").toLowerCase();
  if (serviceName === "imgbb") {
    if (statusCode === 413 || msg.indexOf("size") !== -1 || msg.indexOf("large") !== -1) {
      SERVICE_POLICY.imgbbMaxBytes = Math.max(2 * 1024 * 1024, Math.floor(SERVICE_POLICY.imgbbMaxBytes * 0.6));
      SERVICE_POLICY.stickerMaxBytes = Math.min(SERVICE_POLICY.stickerMaxBytes, Math.floor(SERVICE_POLICY.imgbbMaxBytes * 0.25));
    }
  } else if (serviceName === "firebase") {
    if (statusCode === 413 || msg.indexOf("too large") !== -1 || msg.indexOf("payload") !== -1) {
      SERVICE_POLICY.firebaseAudioMaxBytes = Math.max(120 * 1024, Math.floor(SERVICE_POLICY.firebaseAudioMaxBytes * 0.65));
    }
  }
}

function fetchGithubRepoVersion() {
  var el = document.getElementById("siteVersion");
  if (!el) return;
  var xhr = new XMLHttpRequest();
  xhr.open("GET", CONFIG.githubCommitsApi, true);
  xhr.onreadystatechange = function() {
    if (xhr.readyState === 4 && xhr.status === 200) {
      var link = xhr.getResponseHeader("Link") || "";
      var m = link.match(/[?&]page=(\d+)>;\s*rel="last"/i);
      if (m && m[1]) {
        el.textContent = "fembooru #" + m[1];
        return;
      }
      try {
        var arr = JSON.parse(xhr.responseText);
        if (Array.isArray(arr) && arr.length) {
          el.textContent = "fembooru #" + arr.length;
        }
      } catch (e) {}
    }
  };
  xhr.send();
}

/* ==========================================================================
   FIREBASE AUTHENTICATION (USERNAME -> @FEMBOORU.UA) & STALE TOKEN CLEANUP
   ========================================================================== */
function normalizeUsernameToEmail(rawName) {
  var clean = String(rawName || "").toLowerCase().replace(/[^a-z0-9._-]/g, "");
  if (!clean) return "";
  return clean + "@" + CONFIG.emailDomain;
}

function isAdminUser() {
  return Boolean(state.user && state.user.email === CONFIG.adminEmail);
}

function getDisplayUsername() {
  if (!state.user) return "Anonymous";
  return (state.profile && state.profile.displayName) || state.user.username || "User";
}

function getUserDisplayNameByUid(uid, fallback) {
  if (uid && state.users && state.users[uid]) {
    return state.users[uid].displayName || state.users[uid].username || fallback || "User";
  }
  return fallback || "Anonymous";
}

function saveSession() {
  if (!state.user) {
    storeSet("session", null);
    return;
  }
  storeSet("session", JSON.stringify(state.user));
}

function clearStaleSession() {
  state.user = null;
  state.profile = {};
  storeSet("session", null);
  updateAuthUi();
}

function loadSession() {
  var raw = storeGet("session");
  if (!raw) return;
  try {
    var parsed = JSON.parse(raw);
    if (!parsed || !parsed.uid || !parsed.idToken) {
      clearStaleSession();
      return;
    }
    state.user = parsed;
  } catch (e) {
    clearStaleSession();
  }
}

function ensureFreshSession(cb) {
  if (!state.user) {
    updateAuthUi();
    if (cb) cb();
    return;
  }
  var now = new Date().getTime();
  if (state.user.expiresAt && now < (state.user.expiresAt - 60000)) {
    updateAuthUi();
    if (cb) cb();
    return;
  }
  if (!state.user.refreshToken) {
    clearStaleSession();
    if (cb) cb();
    return;
  }
  var xhr = new XMLHttpRequest();
  xhr.open("POST", "https://securetoken.googleapis.com/v1/token?key=" + encodeURIComponent(CONFIG.firebaseConfig.apiKey), true);
  xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
  xhr.onreadystatechange = function() {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        try {
          var res = JSON.parse(xhr.responseText);
          state.user.idToken = res.id_token;
          state.user.refreshToken = res.refresh_token || state.user.refreshToken;
          state.user.uid = res.user_id || state.user.uid;
          state.user.expiresAt = new Date().getTime() + (parseInt(res.expires_in || "3600", 10) * 1000);
          saveSession();
          updateAuthUi();
        } catch (e) {
          clearStaleSession();
        }
      } else {
        // Auto-clear stale/revoked tokens immediately
        clearStaleSession();
      }
      if (cb) cb();
    }
  };
  xhr.send("grant_type=refresh_token&refresh_token=" + encodeURIComponent(state.user.refreshToken));
}

function updateAuthUi() {
  var outBox = document.getElementById("loggedOutControls");
  var inBox = document.getElementById("loggedInControls");
  var badge = document.getElementById("currentUserBadge");
  var adminBox = document.getElementById("adminLogoBox");
  if (outBox) outBox.style.display = state.user ? "none" : "flex";
  if (inBox) inBox.style.display = state.user ? "flex" : "none";
  if (badge && state.user) {
    badge.textContent = getDisplayUsername() + (isAdminUser() ? " [ADMIN]" : "");
  }
  if (adminBox) adminBox.style.display = isAdminUser() ? "block" : "none";
}

function firebaseAuthRequest(endpoint, payload, cb) {
  var xhr = new XMLHttpRequest();
  xhr.open("POST", "https://identitytoolkit.googleapis.com/v1/" + endpoint + "?key=" + encodeURIComponent(CONFIG.firebaseConfig.apiKey), true);
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.onreadystatechange = function() {
    if (xhr.readyState === 4) {
      var data = null;
      try { data = JSON.parse(xhr.responseText); } catch (e) {}
      if (xhr.status === 200 && data) {
        cb(null, data);
      } else {
        var msg = (data && data.error && data.error.message) || ("Auth error " + xhr.status);
        cb(msg, null);
      }
    }
  };
  xhr.send(JSON.stringify(payload));
}

function reclaimOrCreateUserRecord(uid, username, email, cb) {
  dbGet("users", function(err, allUsers) {
    allUsers = allUsers || {};
    var existingRecord = null;
    for (var oldUid in allUsers) {
      if (allUsers.hasOwnProperty(oldUid) && allUsers[oldUid] && allUsers[oldUid].email === email && oldUid !== uid) {
        existingRecord = allUsers[oldUid];
        // Clean up orphaned record from previous deleted Auth user so username works seamlessly
        dbWrite("DELETE", "users/" + oldUid, null, null);
      }
    }
    var baseProfile = existingRecord || allUsers[uid] || {
      uid: uid,
      username: username,
      email: email,
      displayName: username,
      avatarUrl: DEFAULT_AVATAR,
      status: "",
      pronouns: "",
      relationship: "",
      regDate: formatTime(new Date().getTime()).split(" ")[0],
      hometown: "",
      politics: "",
      birthDate: "",
      website: "",
      city: "",
      interests: "",
      about: "",
      favorites: { film: {}, show: {}, book: {}, game: {} },
      customFields: []
    };
    baseProfile.uid = uid;
    baseProfile.username = username;
    baseProfile.email = email;
    state.profile = baseProfile;
    state.users[uid] = baseProfile;
    dbWrite("PUT", "users/" + uid, baseProfile, function() {
      updateAuthUi();
      if (cb) cb();
    });
  });
}

function loginUser() {
  var uInp = document.getElementById("authUsernameInput");
  var pInp = document.getElementById("authPasswordInput");
  var rawName = uInp ? String(uInp.value || "").replace(/^\s+|\s+$/g, "") : "";
  var pass = pInp ? String(pInp.value || "") : "";
  var email = normalizeUsernameToEmail(rawName);
  if (!email || !pass) {
    showStatus("Enter username and password.", true);
    return;
  }
  var cleanName = email.split("@")[0];
  firebaseAuthRequest("accounts:signInWithPassword", {
    email: email,
    password: pass,
    returnSecureToken: true
  }, function(err, data) {
    if (err) {
      // Auto-provision admin account if logging in with configured admin credentials for the first time
      if (cleanName === CONFIG.adminUsername && pass === CONFIG.adminPassword && err.indexOf("INVALID_LOGIN") !== -1) {
        registerUser();
        return;
      }
      showStatus("Login failed: " + err, true);
      return;
    }
    state.user = {
      uid: data.localId,
      username: cleanName,
      email: email,
      idToken: data.idToken,
      refreshToken: data.refreshToken,
      expiresAt: new Date().getTime() + (parseInt(data.expiresIn || "3600", 10) * 1000)
    };
    saveSession();
    reclaimOrCreateUserRecord(data.localId, cleanName, email, function() {
      if (pInp) pInp.value = "";
      showStatus("Logged in as " + cleanName, false);
      renderAll();
    });
  });
}

function registerUser() {
  var uInp = document.getElementById("authUsernameInput");
  var pInp = document.getElementById("authPasswordInput");
  var rawName = uInp ? String(uInp.value || "").replace(/^\s+|\s+$/g, "") : "";
  var pass = pInp ? String(pInp.value || "") : "";
  var email = normalizeUsernameToEmail(rawName);
  if (!email || pass.length < 6) {
    showStatus("Username required and password must be at least 6 characters.", true);
    return;
  }
  var cleanName = email.split("@")[0];
  firebaseAuthRequest("accounts:signUp", {
    email: email,
    password: pass,
    returnSecureToken: true
  }, function(err, data) {
    if (err) {
      showStatus("Registration failed: " + err, true);
      return;
    }
    state.user = {
      uid: data.localId,
      username: cleanName,
      email: email,
      idToken: data.idToken,
      refreshToken: data.refreshToken,
      expiresAt: new Date().getTime() + (parseInt(data.expiresIn || "3600", 10) * 1000)
    };
    saveSession();
    reclaimOrCreateUserRecord(data.localId, cleanName, email, function() {
      if (pInp) pInp.value = "";
      showStatus("Account registered: " + cleanName, false);
      renderAll();
    });
  });
}

function logoutUser() {
  clearStaleSession();
  showStatus("Logged out.", false);
  renderAll();
}

function deleteOwnAccount() {
  if (!state.user) return;
  if (!window.confirm("Delete your account permanently? Your username will be freed.")) return;
  var uid = state.user.uid;
  var token = state.user.idToken;
  dbWrite("DELETE", "users/" + uid, null, function() {
    firebaseAuthRequest("accounts:delete", { idToken: token }, function() {
      delete state.users[uid];
      clearStaleSession();
      showStatus("Account deleted. Username can now be re-registered.", false);
      renderAll();
    });
  });
}

function loadUserProfile(cb) {
  if (!state.user) {
    if (cb) cb();
    return;
  }
  dbGet("users/" + state.user.uid, function(err, prof) {
    if (!err && prof) {
      state.profile = prof;
      updateAuthUi();
    }
    if (cb) cb();
  });
}

/* ==========================================================================
   FIREBASE REALTIME DATABASE REST CLIENT
   ========================================================================== */
function buildDbUrl(path, withAuth) {
  var cleanPath = String(path || "").replace(/^\/+|\/+$/g, "");
  var url = CONFIG.firebaseConfig.databaseURL + "/" + cleanPath + ".json";
  if (withAuth && state.user && state.user.idToken) {
    url += "?auth=" + encodeURIComponent(state.user.idToken);
  }
  return url;
}

function dbGet(path, cb) {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", buildDbUrl(path, Boolean(state.user)), true);
  xhr.onreadystatechange = function() {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        var data = null;
        try { data = JSON.parse(xhr.responseText); } catch (e) {}
        if (cb) cb(null, data);
      } else if (xhr.status === 401 && state.user) {
        clearStaleSession();
        if (cb) cb("Session expired", null);
      } else {
        if (cb) cb("HTTP " + xhr.status, null);
      }
    }
  };
  xhr.send();
}

function dbWrite(method, path, payload, cb, onProgress) {
  var execute = function() {
    var xhr = new XMLHttpRequest();
    xhr.open(method, buildDbUrl(path, Boolean(state.user)), true);
    xhr.setRequestHeader("Content-Type", "application/json");
    if (onProgress && xhr.upload) {
      xhr.upload.onprogress = function(e) {
        if (e.lengthComputable && e.total > 0) onProgress(e.loaded / e.total);
      };
    }
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        if (xhr.status >= 200 && xhr.status < 300) {
          var data = null;
          try { data = JSON.parse(xhr.responseText); } catch (e) {}
          if (cb) cb(null, data);
        } else {
          adaptPolicyOnServiceError("firebase", xhr.status, xhr.responseText);
          if (xhr.status === 401 && state.user) clearStaleSession();
          if (cb) cb("HTTP " + xhr.status, null);
        }
      }
    };
    xhr.send(method === "DELETE" ? null : JSON.stringify(payload));
  };

  if (state.user && state.user.expiresAt && new Date().getTime() > (state.user.expiresAt - 60000)) {
    ensureFreshSession(execute);
  } else {
    execute();
  }
}

/* ==========================================================================
   IMGBB UNIVERSAL IMAGE UPLOADER (ALL FORMATS + PROGRESS BAR) & VIDEO EMBEDS
   ========================================================================== */
function uploadImageToImgbb(fileOrInput, cb, opts) {
  opts = opts || {};
  var file = null;
  if (fileOrInput && fileOrInput.files && fileOrInput.files[0]) {
    file = fileOrInput.files[0];
  } else if (fileOrInput && typeof fileOrInput.size === "number") {
    file = fileOrInput;
  }
  if (!file) {
    cb("No file selected.", null);
    return;
  }
  if (file.size > SERVICE_POLICY.imgbbMaxBytes) {
    cb("File exceeds current service limit (" + Math.round(SERVICE_POLICY.imgbbMaxBytes / 1048576) + " MB).", null);
    return;
  }

  setUploadProgress(5, "Uploading image...");
  var fd = new FormData();
  fd.append("key", CONFIG.imgbbApiKey);
  fd.append("image", file);

  var xhr = new XMLHttpRequest();
  xhr.open("POST", CONFIG.imgbbUploadUrl, true);
  if (xhr.upload) {
    xhr.upload.onprogress = function(e) {
      if (e.lengthComputable && e.total > 0) {
        var pct = Math.round((e.loaded / e.total) * (opts.keepProgressOpen ? 85 : 96));
        setUploadProgress(pct, "Uploading image...");
      }
    };
  }
  xhr.onreadystatechange = function() {
    if (xhr.readyState === 4) {
      var res = null;
      try { res = JSON.parse(xhr.responseText); } catch (e) {}
      if (xhr.status === 200 && res && res.success && res.data) {
        var finalUrl = res.data.url || (res.data.image && res.data.image.url) || res.data.display_url;
        if (!opts.keepProgressOpen) setUploadProgress(100, "Upload complete!");
        cb(null, finalUrl);
      } else {
        var errMsg = (res && res.error && res.error.message) || ("Upload failed (" + xhr.status + ")");
        adaptPolicyOnServiceError("imgbb", xhr.status, errMsg);
        // Fallback for SVG / exotic formats not accepted directly by imgbb
        if (file.size <= 350 * 1024) {
          var reader = new FileReader();
          reader.onload = function() {
            if (!opts.keepProgressOpen) setUploadProgress(100, "Encoded inline!");
            cb(null, reader.result);
          };
          reader.onerror = function() {
            setUploadProgress(-1);
            cb(errMsg, null);
          };
          reader.readAsDataURL(file);
          return;
        }
        setUploadProgress(-1);
        cb(errMsg, null);
      }
    }
  };
  xhr.onerror = function() {
    setUploadProgress(-1);
    cb("Network error during upload.", null);
  };
  xhr.send(fd);
}

function renderVideoHtml(rawUrl) {
  var u = safeUrl(rawUrl);
  if (!u || !/^https?:\/\//i.test(u)) return "";
  var yt = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  if (yt && yt[1]) {
    return '<iframe class="video-embed" height="240" src="https://www.youtube.com/embed/' + esc(yt[1]) + '" frameborder="0" allowfullscreen></iframe>';
  }
  return '<video class="video-embed" controls preload="metadata" src="' + esc(u) + '"></video>';
}

/* ==========================================================================
   GLOBAL 1-MINUTE EFFECTS: SNOW & TAB FAVICON FOR ALL USERS
   ========================================================================== */
var snowFlakes = [];
var snowLoopStarted = false;

function triggerGlobalSnow() {
  var now = new Date().getTime();
  var payload = {
    enabledBy: getDisplayUsername(),
    expiresAt: now + 60000
  };
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
  var active = Boolean(state.snowEffect && state.snowEffect.expiresAt && state.snowEffect.expiresAt > now);

  if (lbl) {
    lbl.textContent = active
      ? ("Snow active (" + Math.ceil((state.snowEffect.expiresAt - now) / 1000) + "s left)")
      : "";
  }
  if (!canvas) return;
  canvas.style.display = active ? "block" : "none";
  if (active && !snowLoopStarted) {
    snowLoopStarted = true;
    for (var i = 0; i < 65; i++) {
      snowFlakes.push({
        x: Math.random() * 1200,
        y: Math.random() * 800,
        r: 1.5 + Math.random() * 2.5,
        vy: 1 + Math.random() * 2,
        vx: (Math.random() - 0.5) * 0.8
      });
    }
    setInterval(stepSnowCanvas, 45);
  }
}

function stepSnowCanvas() {
  var canvas = document.getElementById("snowCanvas");
  var now = new Date().getTime();
  var active = Boolean(state.snowEffect && state.snowEffect.expiresAt && state.snowEffect.expiresAt > now);
  var lbl = document.getElementById("snowTimerText");
  if (lbl) {
    lbl.textContent = active ? ("Snow active (" + Math.ceil((state.snowEffect.expiresAt - now) / 1000) + "s left)") : "";
  }
  if (!canvas) return;
  if (!active) {
    canvas.style.display = "none";
    return;
  }
  canvas.style.display = "block";
  var w = window.innerWidth || 800;
  var h = window.innerHeight || 600;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  var ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#FFFFFF";
  ctx.strokeStyle = "#800000";
  for (var i = 0; i < snowFlakes.length; i++) {
    var f = snowFlakes[i];
    f.x += f.vx;
    f.y += f.vy;
    if (f.y > h) { f.y = -5; f.x = Math.random() * w; }
    if (f.x > w) f.x = 0;
    if (f.x < 0) f.x = w;
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2, true);
    ctx.fill();
  }
}

function applyFaviconHref(href) {
  var link = document.getElementById("dynamicFavicon");
  if (!link) return;
  var parent = link.parentNode;
  var clone = document.createElement("link");
  clone.id = "dynamicFavicon";
  clone.rel = "icon";
  clone.href = href;
  if (parent) {
    parent.removeChild(link);
    parent.appendChild(clone);
  }
}

var defaultFaviconHref = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAWklEQVR42mP8z8AARQwwBhgZGf8zMjL+Z2Ji+s/AwPCfkZHxPxMT038GBob/DAwM/xkYGP4zMDD8Z2Bg+M/AwPCfgYHhPwMDw38GBob/DAwM/4E0Ix4x3AAAmv4P6X9x5eQAAAAASUVORK5CYII=";
var lastAppliedTabIcon = "";

function triggerGlobalTabIcon() {
  var fEl = document.getElementById("tabIconFileInput");
  var uEl = document.getElementById("tabIconUrlInput");
  var rawUrl = uEl ? safeUrl(uEl.value) : "";

  var saveTabIcon = function(iconUrl) {
    var now = new Date().getTime();
    var payload = {
      iconUrl: iconUrl,
      setBy: getDisplayUsername(),
      expiresAt: now + 60000
    };
    state.tabLogoEffect = payload;
    syncTabLogoState();
    dbWrite("PUT", "effects/tabLogo", payload, function() {
      if (uEl) uEl.value = "";
      if (fEl) fEl.value = "";
      showStatus("Tab icon changed for everyone for 1 minute!", false);
    });
  };

  if (fEl && fEl.files && fEl.files[0]) {
    uploadImageToImgbb(fEl, function(err, url) {
      if (!err && url) saveTabIcon(url);
      else showStatus(err || "Tab icon upload failed.", true);
    });
    return;
  }
  if (!rawUrl) {
    showStatus("Select an icon file or enter an image URL.", true);
    return;
  }
  saveTabIcon(rawUrl);
}

function syncTabLogoState() {
  var lbl = document.getElementById("tabIconTimerText");
  var now = new Date().getTime();
  var active = Boolean(state.tabLogoEffect && state.tabLogoEffect.iconUrl && state.tabLogoEffect.expiresAt && state.tabLogoEffect.expiresAt > now);
  if (lbl) {
    lbl.textContent = active ? ("Custom tab icon active (" + Math.ceil((state.tabLogoEffect.expiresAt - now) / 1000) + "s left)") : "";
  }
  var targetHref = active ? state.tabLogoEffect.iconUrl : defaultFaviconHref;
  if (targetHref !== lastAppliedTabIcon) {
    lastAppliedTabIcon = targetHref;
    applyFaviconHref(targetHref);
  }
}

setInterval(syncTabLogoState, 1000);
