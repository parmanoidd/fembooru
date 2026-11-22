/* ==========================================================================
   FEMBOORU APPLICATION CONTROLLER:
   - PUBLIC WPLACE / GEOPIXELS MAP LINKED TO OPENSTREETMAP COORDINATES
   - ONE-CLICK IMAGE -> PIXELART STAMPING & RECENT CHANGES FEED
   - VIEW NAVIGATION, AUTO-REFRESH SYNC & INITIALIZATION
   ========================================================================== */
var WPLACE_PALETTE = [
  "#800000", "#FF0000", "#FF8800", "#FFFF00",
  "#00AA00", "#00CCFF", "#0044CC", "#8800CC",
  "#FF66AA", "#FFFFFF", "#888888", "#111111"
];

function initWplaceMap() {
  var pal = document.getElementById("wplacePalette");
  if (pal) {
    var ph = "";
    for (var i = 0; i < WPLACE_PALETTE.length; i++) {
      var c = WPLACE_PALETTE[i];
      ph += "<button type='button' class='wplace-swatch' style='background:" + c + ";' onclick=\"setWplaceColor('" + c + "')\"></button>";
    }
    pal.innerHTML = ph;
  }

  var vp = document.getElementById("wplaceViewport");
  var canvas = document.getElementById("wplaceCanvas");
  if (!vp || !canvas) return;

  function clientToMapGrid(clientX, clientY) {
    var rect = vp.getBoundingClientRect();
    var px = clientX - rect.left;
    var py = clientY - rect.top;
    var scale = Math.pow(2, wplaceState.zoom);
    // Geographic world-fraction coordinates (linked to lat/lon, zoom-independent!)
    var worldX = ((px - wplaceState.offsetX) / scale);
    var worldY = ((py - wplaceState.offsetY) / scale);
    var gx = Math.floor(worldX * 256);
    var gy = Math.floor(worldY * 256);
    var lon = (worldX * 360) - 180;
    var n = Math.PI - (2 * Math.PI * worldY);
    var lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
    return { gx: gx, gy: gy, lat: lat, lon: lon };
  }

  function paintAtClient(clientX, clientY) {
    var pt = clientToMapGrid(clientX, clientY);
    var lbl = document.getElementById("wplaceCoordsLabel");
    if (lbl && !isNaN(pt.lat) && !isNaN(pt.lon)) {
      lbl.textContent = "Lat: " + pt.lat.toFixed(4) + ", Lon: " + pt.lon.toFixed(4);
    }
    if (wplaceState.panMode) return;
    var key = pt.gx + "_" + pt.gy;
    if (key === wplaceState.lastDrawnKey) return;
    wplaceState.lastDrawnKey = key;

    var pix = {
      gx: pt.gx,
      gy: pt.gy,
      color: wplaceState.selectedColor,
      by: getDisplayUsername(),
      lat: pt.lat.toFixed(3),
      lon: pt.lon.toFixed(3),
      at: new Date().getTime()
    };
    state.wplacePixels[key] = pix;
    renderWplaceCanvas();
    dbWrite("PUT", "wplace/pixels/" + key, pix, null);
    recordWplaceChange(pix);
  }

  vp.addEventListener("mousedown", function(e) {
    if (e.button === 1 || wplaceState.panMode) {
      wplaceState.panMode = true;
      wplaceState.panStartX = e.clientX - wplaceState.offsetX;
      wplaceState.panStartY = e.clientY - wplaceState.offsetY;
      return;
    }
    wplaceState.isDrawing = true;
    wplaceState.lastDrawnKey = "";
    paintAtClient(e.clientX, e.clientY);
  });

  vp.addEventListener("mousemove", function(e) {
    if (wplaceState.panMode && e.buttons) {
      wplaceState.offsetX = e.clientX - wplaceState.panStartX;
      wplaceState.offsetY = e.clientY - wplaceState.panStartY;
      renderWplaceCanvas();
      return;
    }
    if (wplaceState.isDrawing) {
      paintAtClient(e.clientX, e.clientY);
    }
  });

  window.addEventListener("mouseup", function() {
    wplaceState.isDrawing = false;
  });

  vp.addEventListener("touchstart", function(e) {
    if (!e.touches.length) return;
    var t = e.touches[0];
    if (wplaceState.panMode) {
      wplaceState.panStartX = t.clientX - wplaceState.offsetX;
      wplaceState.panStartY = t.clientY - wplaceState.offsetY;
    } else {
      wplaceState.isDrawing = true;
      wplaceState.lastDrawnKey = "";
      paintAtClient(t.clientX, t.clientY);
    }
  }, { passive: true });

  vp.addEventListener("touchmove", function(e) {
    if (!e.touches.length) return;
    var t = e.touches[0];
    if (wplaceState.panMode) {
      wplaceState.offsetX = t.clientX - wplaceState.panStartX;
      wplaceState.offsetY = t.clientY - wplaceState.panStartY;
      renderWplaceCanvas();
    } else if (wplaceState.isDrawing) {
      paintAtClient(t.clientX, t.clientY);
    }
  }, { passive: true });

  vp.addEventListener("touchend", function() {
    wplaceState.isDrawing = false;
  });
}

function setWplaceColor(hex) {
  wplaceState.selectedColor = hex;
  var inp = document.getElementById("wplaceColorPicker");
  if (inp) inp.value = hex;
  if (wplaceState.panMode) toggleWplacePanMode();
}

function toggleWplacePanMode() {
  wplaceState.panMode = !wplaceState.panMode;
  var btn = document.getElementById("wplaceModeBtn");
  if (btn) btn.textContent = wplaceState.panMode ? "Mode: Pan / Move" : "Mode: Draw";
}

function wplaceZoom(delta) {
  var vp = document.getElementById("wplaceViewport");
  var cx = vp ? (vp.clientWidth / 2) : 350;
  var cy = vp ? (vp.clientHeight / 2) : 230;
  var oldScale = Math.pow(2, wplaceState.zoom);
  var nextZoom = Math.max(3, Math.min(16, wplaceState.zoom + delta));
  var newScale = Math.pow(2, nextZoom);
  wplaceState.offsetX = cx - ((cx - wplaceState.offsetX) / oldScale) * newScale;
  wplaceState.offsetY = cy - ((cy - wplaceState.offsetY) / oldScale) * newScale;
  wplaceState.zoom = nextZoom;
  renderWplaceCanvas();
}

function recordWplaceChange(pix) {
  var cid = generateId("wc");
  var entry = {
    id: cid,
    by: pix.by || "Anon",
    color: pix.color,
    lat: pix.lat || "0",
    lon: pix.lon || "0",
    at: pix.at || new Date().getTime()
  };
  state.wplaceRecent[cid] = entry;
  renderWplaceRecentList();
  dbWrite("PUT", "wplace/recent/" + cid, entry, null);
}

function renderWplaceRecentList() {
  var box = document.getElementById("wplaceRecentList");
  if (!box) return;
  var list = [];
  for (var id in state.wplaceRecent) {
    if (state.wplaceRecent.hasOwnProperty(id) && state.wplaceRecent[id]) list.push(state.wplaceRecent[id]);
  }
  list.sort(function(a, b) { return (b.at || 0) - (a.at || 0); });
  var h = "";
  for (var i = 0; i < Math.min(18, list.length); i++) {
    var r = list[i];
    h += "<div class='wplace-recent-item'>" +
           "<span style='display:inline-block;width:9px;height:9px;background:" + esc(r.color) + ";border:1px solid #000;'></span> " +
           "<b>" + esc(r.by) + "</b> (" + esc(r.lat) + ", " + esc(r.lon) + ")" +
         "</div>";
  }
  box.innerHTML = h || "<span class='muted'>No map changes yet.</span>";
}

function renderWplaceCanvas() {
  var vp = document.getElementById("wplaceViewport");
  var tileLayer = document.getElementById("osmTileLayer");
  var canvas = document.getElementById("wplaceCanvas");
  if (!vp || !tileLayer || !canvas || !canvas.getContext) return;

  var vw = vp.clientWidth || 720;
  var vh = vp.clientHeight || 460;
  if (canvas.width !== vw) canvas.width = vw;
  if (canvas.height !== vh) canvas.height = vh;

  var z = wplaceState.zoom;
  var maxTiles = Math.pow(2, z);
  var tileSize = 256;
  var originX = wplaceState.offsetX * 256;
  var originY = wplaceState.offsetY * 256;

  var startCol = Math.floor(-originX / tileSize);
  var endCol = Math.floor((vw - originX) / tileSize);
  var startRow = Math.floor(-originY / tileSize);
  var endRow = Math.floor((vh - originY) / tileSize);

  var tilesHtml = "";
  for (var col = startCol; col <= endCol; col++) {
    for (var row = startRow; row <= endRow; row++) {
      if (row < 0 || row >= maxTiles) continue;
      var wrapCol = ((col % maxTiles) + maxTiles) % maxTiles;
      var left = Math.round(originX + col * tileSize);
      var top = Math.round(originY + row * tileSize);
      tilesHtml += "<img src='https://tile.openstreetmap.org/" + z + "/" + wrapCol + "/" + row + ".png' " +
        "style='position:absolute;left:" + left + "px;top:" + top + "px;width:256px;height:256px;pointer-events:none;' alt=''>";
    }
  }
  tileLayer.innerHTML = tilesHtml;

  var ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, vw, vh);
  var cellPx = Math.max(1, Math.pow(2, z) / 256);

  for (var key in state.wplacePixels) {
    if (!state.wplacePixels.hasOwnProperty(key) || !state.wplacePixels[key]) continue;
    var p = state.wplacePixels[key];
    var sx = wplaceState.offsetX + (p.gx * cellPx);
    var sy = wplaceState.offsetY + (p.gy * cellPx);
    if (sx + cellPx < 0 || sx > vw || sy + cellPx < 0 || sy > vh) continue;
    ctx.fillStyle = p.color || "#800000";
    ctx.fillRect(Math.floor(sx), Math.floor(sy), Math.ceil(cellPx), Math.ceil(cellPx));
  }
  renderWplaceRecentList();
}

function stampImageToWplace() {
  var fEl = document.getElementById("wplaceStampFile");
  var vp = document.getElementById("wplaceViewport");
  if (!fEl || !fEl.files || !fEl.files[0]) {
    showStatus("Select an image to draw as pixelart on the map.", true);
    return;
  }
  var file = fEl.files[0];
  var reader = new FileReader();
  reader.onload = function(ev) {
    var img = new Image();
    img.onload = function() {
      var maxD = SERVICE_POLICY.wplaceStampMaxDim;
      var scale = Math.min(maxD / Math.max(1, img.width), maxD / Math.max(1, img.height), 1);
      var w = Math.max(1, Math.round(img.width * scale));
      var h = Math.max(1, Math.round(img.height * scale));
      var c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      var ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      var data = ctx.getImageData(0, 0, w, h).data;

      var centerPx = (vp ? vp.clientWidth / 2 : 350);
      var centerPy = (vp ? vp.clientHeight / 2 : 230);
      var mapScale = Math.pow(2, wplaceState.zoom);
      var startGx = Math.floor(((centerPx - wplaceState.offsetX) / mapScale) * 256) - Math.floor(w / 2);
      var startGy = Math.floor(((centerPy - wplaceState.offsetY) / mapScale) * 256) - Math.floor(h / 2);

      var patch = {};
      var now = new Date().getTime();
      var author = getDisplayUsername();
      function hex2(n) { var s = n.toString(16); return s.length < 2 ? "0" + s : s; }

      for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
          var idx = (y * w + x) * 4;
          if (data[idx + 3] < 90) continue;
          var hex = "#" + hex2(data[idx]) + hex2(data[idx + 1]) + hex2(data[idx + 2]);
          var gx = startGx + x;
          var gy = startGy + y;
          var key = gx + "_" + gy;
          var pix = { gx: gx, gy: gy, color: hex, by: author, at: now };
          state.wplacePixels[key] = pix;
          patch[key] = pix;
        }
      }
      fEl.value = "";
      renderWplaceCanvas();
      dbWrite("PATCH", "wplace/pixels", patch, function() {
        recordWplaceChange({ by: author, color: "#E07A48", lat: "Image", lon: w + "x" + h, at: now });
        showStatus("Pixelart stamped onto map (" + w + "x" + h + ")!", false);
      });
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

/* ==========================================================================
   VIEW SWITCHING, FULL DATA SYNC & BOOTSTRAP
   ========================================================================== */
function switchView(viewName) {
  state.view = viewName || "boards";
  var sections = document.querySelectorAll(".view-section");
  for (var i = 0; i < sections.length; i++) {
    sections[i].style.display = (sections[i].id === "view-" + state.view) ? "block" : "none";
  }
  var tabs = document.querySelectorAll(".nav-tab");
  for (var t = 0; t < tabs.length; t++) {
    if (tabs[t].id) {
      tabs[t].className = (tabs[t].id === "nav-" + state.view) ? "nav-tab active-tab" : "nav-tab";
    }
  }
  renderAll();
}

function renderAll() {
  var logoImg = document.getElementById("siteLogoImg");
  if (logoImg) {
    logoImg.src = isValidImageSrc(state.siteLogo) ? state.siteLogo : DEFAULT_SITE_LOGO;
  }

  renderBoardsSidebar();
  rebuildMusicPlaylist();
  updateNotifBadge();
  syncSnowState();
  syncTabLogoState();

  if (state.view === "boards") {
    renderBoardPolls();
    renderThreads();
  } else if (state.view === "wall") {
    renderGlobalWall();
  } else if (state.view === "profile") {
    renderPublicProfile();
  } else if (state.view === "members") {
    renderMembersList();
  } else if (state.view === "groups") {
    renderGroupsList();
    renderActiveGroup();
  } else if (state.view === "dms") {
    renderDmList();
  } else if (state.view === "stickers") {
    renderStickersArchive();
  } else if (state.view === "wplace") {
    renderWplaceCanvas();
  } else if (state.view === "notifications") {
    renderNotifications();
  }
}

function fetchAllData(isManual) {
  ensureFreshSession(function() {
    dbGet("", function(err, root) {
      if (err || !root || typeof root !== "object") {
        if (isManual) showStatus("Refresh failed: " + (err || "Offline"), true);
        return;
      }

      // Merge default + database boards
      var mergedBoards = [];
      var seenSlugs = {};
      for (var d = 0; d < DEFAULT_BOARDS.length; d++) {
        mergedBoards.push(DEFAULT_BOARDS[d]);
        seenSlugs[DEFAULT_BOARDS[d].slug] = true;
      }
      if (root.boards && typeof root.boards === "object") {
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
      state.siteLogo = (root.site && root.site.logo) || "";
      state.snowEffect = (root.effects && root.effects.snow) || null;
      state.tabLogoEffect = (root.effects && root.effects.tabLogo) || null;

      if (root.wplace) {
        state.wplacePixels = root.wplace.pixels || {};
        state.wplaceRecent = root.wplace.recent || {};
      }

      if (state.user && state.users[state.user.uid]) {
        state.profile = state.users[state.user.uid];
      }

      var newHash = JSON.stringify({
        b: state.boards.length,
        t: state.threads,
        p: state.polls,
        w: state.walls,
        g: state.groups,
        d: state.dms,
        s: state.stickers,
        m: state.music,
        n: state.user ? state.notifications[state.user.uid] : null,
        logo: state.siteLogo,
        snow: state.snowEffect,
        tab: state.tabLogoEffect
      });

      if (newHash !== lastDataHash || isManual) {
        lastDataHash = newHash;
        updateAuthUi();
        renderAll();
      } else {
        syncSnowState();
        syncTabLogoState();
      }

      if (isManual) showStatus("Refreshed!", false);
    });
  });
}

window.addEventListener("DOMContentLoaded", function() {
  state.boards = DEFAULT_BOARDS.slice();
  probeServicePolicies();
  loadSession();
  updateAuthUi();
  initMusicPlayer();
  initWplaceMap();
  initSandboxWorld();
  fetchGithubRepoVersion();

  ensureFreshSession(function() {
    if (state.user) {
      loadUserProfile(function() {
        updateAuthUi();
        fetchAllData();
      });
    } else {
      fetchAllData();
    }
  });

  // Auto-refresh messages, threads, walls & notifications
  autoRefreshTimer = setInterval(function() {
    fetchAllData(false);
  }, CONFIG.autoRefreshMs);

  // Realtime multiplayer cursors, actors, sprites & fireworks loop
  setInterval(function() {
    syncRealtimeWorld();
  }, CONFIG.realtimeSyncMs);
});
