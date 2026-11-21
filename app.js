/* ==========================================================================
   FEMBOORU APP: wPLACE COORDINATE PIXEL CANVAS, VIEW ROUTER,
   AUTO-REFRESH SYNC & INITIALIZATION
   ========================================================================== */
var WPLACE_COLORS = [
  "#800000", "#AF0A0F", "#EEAA88", "#F0E0D6", "#FFFFEE", "#FFFFFF",
  "#000000", "#555555", "#FF4500", "#FFA500", "#FFD700", "#32CD32",
  "#117743", "#00BFFF", "#1E90FF", "#8A2BE2", "#FF1493", "#8B4513"
];

function initWplaceCanvas() {
  var pal = document.getElementById("wplacePalette");
  var canvas = document.getElementById("wplaceCanvas");
  if (pal) {
    var h = "";
    for (var i = 0; i < WPLACE_COLORS.length; i++) {
      var c = WPLACE_COLORS[i];
      var sel = (c === wplaceState.selectedColor) ? "selected-color" : "";
      h += "<div class='wplace-swatch " + sel + "' style='background:" + c + ";' onclick=\"selectWplaceColor('" + c + "')\"></div>";
    }
    pal.innerHTML = h;
  }
  if (!canvas) return;

  function canvasToGrid(clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    var scaleX = canvas.width / Math.max(1, rect.width);
    var scaleY = canvas.height / Math.max(1, rect.height);
    var px = (clientX - rect.left) * scaleX;
    var py = (clientY - rect.top) * scaleY;
    var z = wplaceState.zoom;
    var gx = Math.floor((px - (canvas.width / 2)) / z + wplaceState.offsetX);
    var gy = Math.floor((py - (canvas.height / 2)) / z + wplaceState.offsetY);
    return { gx: gx, gy: gy };
  }

  function handleDown(cx, cy) {
    if (wplaceState.panMode) {
      wplaceState.isDrawing = true;
      wplaceState.panStartX = cx;
      wplaceState.panStartY = cy;
    } else {
      wplaceState.isDrawing = true;
      var g = canvasToGrid(cx, cy);
      placeWplacePixel(g.gx, g.gy, wplaceState.selectedColor, true);
    }
  }

  function handleMove(cx, cy) {
    var g = canvasToGrid(cx, cy);
    var coordLbl = document.getElementById("wplaceCoords");
    if (coordLbl) {
      coordLbl.textContent = "Coord: (" + g.gx + ", " + g.gy + ") • Zoom: " + wplaceState.zoom + "px";
    }
    if (!wplaceState.isDrawing) return;
    if (wplaceState.panMode) {
      var dx = cx - wplaceState.panStartX;
      var dy = cy - wplaceState.panStartY;
      wplaceState.panStartX = cx;
      wplaceState.panStartY = cy;
      wplaceState.offsetX -= dx / wplaceState.zoom;
      wplaceState.offsetY -= dy / wplaceState.zoom;
      renderWplaceCanvas();
    } else {
      placeWplacePixel(g.gx, g.gy, wplaceState.selectedColor, true);
    }
  }

  canvas.onmousedown = function(e) {
    var ev = e || window.event;
    handleDown(ev.clientX, ev.clientY);
  };
  canvas.onmousemove = function(e) {
    var ev = e || window.event;
    handleMove(ev.clientX, ev.clientY);
  };
  window.addEventListener("mouseup", function() {
    wplaceState.isDrawing = false;
    wplaceState.lastDrawnKey = "";
  }, false);

  if (canvas.addEventListener) {
    canvas.addEventListener("touchstart", function(e) {
      if (e.touches && e.touches[0]) {
        e.preventDefault();
        handleDown(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, false);
    canvas.addEventListener("touchmove", function(e) {
      if (e.touches && e.touches[0]) {
        e.preventDefault();
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, false);
    canvas.addEventListener("touchend", function() {
      wplaceState.isDrawing = false;
      wplaceState.lastDrawnKey = "";
    }, false);
  }
}

function selectWplaceColor(hex) {
  wplaceState.selectedColor = hex;
  wplaceState.panMode = false;
  var btn = document.getElementById("wplaceModeBtn");
  if (btn) btn.textContent = "Mode: Draw Pixel";
  initWplaceCanvas();
}

function toggleWplaceMode() {
  wplaceState.panMode = !wplaceState.panMode;
  var btn = document.getElementById("wplaceModeBtn");
  if (btn) btn.textContent = wplaceState.panMode ? "Mode: Pan / Move Map" : "Mode: Draw Pixel";
}

function zoomWplace(dir) {
  wplaceState.zoom = Math.max(4, Math.min(36, wplaceState.zoom + (dir * 3)));
  renderWplaceCanvas();
}

function resetWplaceView() {
  wplaceState.offsetX = 0;
  wplaceState.offsetY = 0;
  wplaceState.zoom = 12;
  renderWplaceCanvas();
}

function placeWplacePixel(gx, gy, color, logChange) {
  var key = gx + "_" + gy;
  if (wplaceState.lastDrawnKey === key) return;
  wplaceState.lastDrawnKey = key;

  var now = new Date().getTime();
  var author = getDisplayUsername();
  var pxObj = {
    gx: gx,
    gy: gy,
    color: color,
    by: author,
    updatedAt: now
  };
  state.wplacePixels[key] = pxObj;
  renderWplaceCanvas();
  dbWrite("PUT", "wplace/pixels/" + key, pxObj, null);

  if (logChange) {
    var recId = generateId("wp");
    var recObj = {
      id: recId,
      gx: gx,
      gy: gy,
      color: color,
      by: author,
      at: now
    };
    state.wplaceRecent[recId] = recObj;
    renderWplaceRecentChanges();
    dbWrite("PUT", "wplace/recent/" + recId, recObj, null);
  }
}

function stampImageToWplace() {
  var fEl = document.getElementById("wplaceImageInput");
  if (!fEl || !fEl.files || !fEl.files[0]) {
    showStatus("Choose an image file to stamp as pixel art.", true);
    return;
  }
  var file = fEl.files[0];
  var img = new Image();
  var url = URL.createObjectURL(file);
  img.onload = function() {
    URL.revokeObjectURL(url);
    var maxD = SERVICE_POLICY.wplaceStampMaxDim;
    var scale = Math.min(maxD / Math.max(1, img.width), maxD / Math.max(1, img.height), 1);
    var w = Math.max(2, Math.round(img.width * scale));
    var h = Math.max(2, Math.round(img.height * scale));

    var off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    var ctx = off.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    var data = ctx.getImageData(0, 0, w, h).data;

    var startX = Math.round(wplaceState.offsetX - (w / 2));
    var startY = Math.round(wplaceState.offsetY - (h / 2));
    var now = new Date().getTime();
    var author = getDisplayUsername();
    var batch = {};
    var count = 0;

    function toHex(n) {
      var s = n.toString(16);
      return s.length < 2 ? "0" + s : s;
    }

    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var idx = (y * w + x) * 4;
        var a = data[idx + 3];
        if (a < 90) continue;
        var hex = "#" + toHex(data[idx]) + toHex(data[idx + 1]) + toHex(data[idx + 2]);
        var gx = startX + x;
        var gy = startY + y;
        var key = gx + "_" + gy;
        var pxObj = { gx: gx, gy: gy, color: hex, by: author, updatedAt: now };
        state.wplacePixels[key] = pxObj;
        batch[key] = pxObj;
        count++;
      }
    }

    renderWplaceCanvas();
    setUploadProgress(45, "Stamping " + count + " pixels...");
    dbWrite("PATCH", "wplace/pixels", batch, function() {
      var recId = generateId("wp");
      var recObj = {
        id: recId,
        gx: Math.round(wplaceState.offsetX),
        gy: Math.round(wplaceState.offsetY),
        color: "#AF0A0F",
        by: author + " (stamp " + w + "x" + h + ")",
        at: now
      };
      state.wplaceRecent[recId] = recObj;
      dbWrite("PUT", "wplace/recent/" + recId, recObj, function() {
        renderWplaceRecentChanges();
        fEl.value = "";
        setUploadProgress(100, "Pixelart stamped!");
        showStatus("Stamped " + count + " pixels onto wPlace!", false);
      });
    });
  };
  img.onerror = function() {
    URL.revokeObjectURL(url);
    showStatus("Could not decode image for pixelart stamp.", true);
  };
  img.src = url;
}

function renderWplaceCanvas() {
  var canvas = document.getElementById("wplaceCanvas");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");
  var w = canvas.width;
  var h = canvas.height;
  var z = wplaceState.zoom;

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, w, h);

  // Subtle coordinate grid when zoomed in
  if (z >= 8) {
    ctx.strokeStyle = "#F0E0D6";
    ctx.lineWidth = 1;
    var startGx = Math.floor((-w / 2) / z + wplaceState.offsetX);
    var endGx = Math.ceil((w / 2) / z + wplaceState.offsetX);
    var startGy = Math.floor((-h / 2) / z + wplaceState.offsetY);
    var endGy = Math.ceil((h / 2) / z + wplaceState.offsetY);
    ctx.beginPath();
    for (var gx = startGx; gx <= endGx; gx++) {
      var sx = Math.round((gx - wplaceState.offsetX) * z + (w / 2));
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, h);
    }
    for (var gy = startGy; gy <= endGy; gy++) {
      var sy = Math.round((gy - wplaceState.offsetY) * z + (h / 2));
      ctx.moveTo(0, sy);
      ctx.lineTo(w, sy);
    }
    ctx.stroke();
  }

  // Origin (0,0) crosshair
  var ox = Math.round((0 - wplaceState.offsetX) * z + (w / 2));
  var oy = Math.round((0 - wplaceState.offsetY) * z + (h / 2));
  ctx.strokeStyle = "#D9BFB7";
  ctx.beginPath();
  ctx.moveTo(ox, 0); ctx.lineTo(ox, h);
  ctx.moveTo(0, oy); ctx.lineTo(w, oy);
  ctx.stroke();

  // Render coordinate-linked pixels
  for (var key in state.wplacePixels) {
    if (!state.wplacePixels.hasOwnProperty(key) || !state.wplacePixels[key]) continue;
    var p = state.wplacePixels[key];
    var px = Math.round((p.gx - wplaceState.offsetX) * z + (w / 2));
    var py = Math.round((p.gy - wplaceState.offsetY) * z + (h / 2));
    if (px + z < 0 || px > w || py + z < 0 || py > h) continue;
    ctx.fillStyle = p.color || "#800000";
    ctx.fillRect(px, py, z, z);
  }
}

function renderWplaceRecentChanges() {
  var box = document.getElementById("wplaceRecentChanges");
  if (!box) return;
  var list = [];
  for (var id in state.wplaceRecent) {
    if (state.wplaceRecent.hasOwnProperty(id) && state.wplaceRecent[id]) {
      list.push(state.wplaceRecent[id]);
    }
  }
  list.sort(function(a, b) { return (b.at || 0) - (a.at || 0); });

  // Trim old entries if list grows large
  if (list.length > 25) {
    for (var k = 25; k < list.length; k++) {
      delete state.wplaceRecent[list[k].id];
      dbWrite("DELETE", "wplace/recent/" + list[k].id, null, null);
    }
    list = list.slice(0, 25);
  }

  var h = "";
  for (var i = 0; i < list.length; i++) {
    var r = list[i];
    h += "<div style='border-bottom:1px dotted #D9BFB7;padding:2px 0;'>" +
           "<span style='display:inline-block;width:8px;height:8px;background:" + esc(r.color || "#800000") + ";border:1px solid #000;'></span> " +
           "<b>" + esc(r.by || "Anon") + "</b> @ (" + r.gx + "," + r.gy + ")" +
         "</div>";
  }
  box.innerHTML = h || "<span class='muted'>No recent changes.</span>";
}

/* ==========================================================================
   VIEW NAVIGATION, DATA SYNC & BOOTSTRAP
   ========================================================================== */
function switchView(viewName) {
  state.view = viewName;
  var views = {
    boards: "viewBoards",
    profile: "viewProfile",
    members: "viewMembers",
    wall: "viewWall",
    groups: "viewGroups",
    dms: "viewDms",
    stickers: "viewStickers",
    wplace: "viewWplace",
    notifs: "viewNotifs"
  };
  var navMap = {
    boards: "navBoards",
    profile: "navMyProfile",
    members: "navMembers",
    wall: "navWall",
    groups: "navGroups",
    dms: "navDms",
    stickers: "navStickers",
    wplace: "navWplace",
    notifs: "navNotifs"
  };

  for (var k in views) {
    if (views.hasOwnProperty(k)) {
      var sec = document.getElementById(views[k]);
      if (sec) sec.style.display = (k === viewName) ? "block" : "none";
    }
  }
  for (var n in navMap) {
    if (navMap.hasOwnProperty(n)) {
      var btn = document.getElementById(navMap[n]);
      if (btn) btn.className = (n === viewName) ? "btn-active" : "";
    }
  }
  renderBoardsSidebar();
  renderCurrentView();
}

function renderCurrentView() {
  if (state.view === "boards") renderThreads();
  else if (state.view === "profile") renderPublicProfile();
  else if (state.view === "members") renderMembersList();
  else if (state.view === "wall") renderGlobalWall();
  else if (state.view === "groups") { renderGroupsList(); renderActiveGroup(); }
  else if (state.view === "dms") renderDmList();
  else if (state.view === "stickers") renderStickersArchive();
  else if (state.view === "wplace") { renderWplaceCanvas(); renderWplaceRecentChanges(); }
  else if (state.view === "notifs") renderNotifications();
}

function renderAll() {
  updateAuthUi();
  renderBoardsSidebar();
  renderBoardPolls();
  rebuildMusicPlaylist();
  updateNotifBadge();
  syncSnowState();
  syncTabLogoState();
  if (state.siteLogo && isValidImageSrc(state.siteLogo)) {
    var logoImg = document.getElementById("siteLogoImg");
    if (logoImg && logoImg.src !== state.siteLogo) logoImg.src = state.siteLogo;
  }
  renderCurrentView();
}

function fetchAllData() {
  dbGet("", function(err, root) {
    if (err || !root) return;

    // Merge default boards with database boards
    var mergedBoards = [];
    var seenSlugs = {};
    for (var i = 0; i < DEFAULT_BOARDS.length; i++) {
      mergedBoards.push(DEFAULT_BOARDS[i]);
      seenSlugs[DEFAULT_BOARDS[i].slug] = true;
    }
    if (root.boards) {
      for (var slug in root.boards) {
        if (root.boards.hasOwnProperty(slug) && root.boards[slug] && !seenSlugs[slug]) {
          mergedBoards.push(root.boards[slug]);
          seenSlugs[slug] = true;
        }
      }
    }
    state.boards = mergedBoards;
    state.threads = root.threads || {};
    state.polls = root.polls || {};
    state.users = root.users || {};
    state.walls = root.walls || {};
    state.groups = root.groups || {};
    state.dms = root.dms || {};
    state.stickers = root.stickers || {};
    state.subscriptions = root.subscriptions || {};
    state.blocks = root.blocks || {};
    state.notifications = root.notifications || {};
    state.music = root.music || {};
    state.wplacePixels = (root.wplace && root.wplace.pixels) || {};
    state.wplaceRecent = (root.wplace && root.wplace.recent) || {};
    state.siteLogo = (root.site && root.site.logo) || "";
    state.snowEffect = (root.effects && root.effects.snow) || null;
    state.tabLogoEffect = (root.effects && root.effects.tabLogo) || null;

    if (state.user && state.users[state.user.uid]) {
      state.profile = state.users[state.user.uid];
    }

    var info = document.getElementById("onlineUsersInfo");
    if (info) {
      var activeCursors = 0;
      var now = new Date().getTime();
      for (var c in worldState.cursors) {
        if (worldState.cursors.hasOwnProperty(c) && worldState.cursors[c] && (now - (worldState.cursors[c].updatedAt || 0)) < 7000) {
          activeCursors++;
        }
      }
      info.textContent = "Members: " + countMapKeys(state.users) + " • Online: " + Math.max(1, activeCursors);
    }

    var nextHash = JSON.stringify({
      b: state.boards.length,
      t: state.threads,
      p: state.polls,
      u: state.users,
      w: state.walls,
      g: state.groups,
      d: state.dms,
      s: state.stickers,
      sub: state.subscriptions,
      blk: state.blocks,
      n: state.user ? state.notifications[state.user.uid] : null,
      m: state.music,
      wp: state.wplacePixels,
      wr: state.wplaceRecent,
      lg: state.siteLogo,
      sn: state.snowEffect,
      tl: state.tabLogoEffect
    });

    if (nextHash !== lastDataHash) {
      lastDataHash = nextHash;
      renderAll();
    } else {
      syncSnowState();
      syncTabLogoState();
    }
  });
}

function initApp() {
  state.boards = DEFAULT_BOARDS.slice(0);
  loadSession();
  probeServicePolicies();
  fetchGithubRepoVersion();
  initMusicPlayer();
  initWplaceCanvas();
  initPlaygroundControls();

  ensureFreshSession(function() {
    loadUserProfile(function() {
      renderAll();
      fetchAllData();
      autoRefreshTimer = setInterval(fetchAllData, CONFIG.autoRefreshMs);
    });
  });
}

if (window.addEventListener) {
  window.addEventListener("load", initApp, false);
} else {
  window.onload = initApp;
}
