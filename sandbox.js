/* ==========================================================================
   FEMBOORU SANDBOX & REALTIME MULTIPLAYER WORLD:
   - SCROLL-AWARE CURSORS & MOBILE TOUCHES (NO SELF-CURSOR GHOST ON REFRESH)
   - REALTIME CURSOR CHAT ('/' OR 'SHIFT')
   - GMOD / S&BOX PROP MENU ('Q' OR BUTTON) WITH RANDOM INTERNET IMAGES
   - SPRITES (GIF/STATIC), RMB THROWING, FIREWORKS LAUNCH & ATTACHMENT
   - HL2 TOOLS (PHYSGUN, GRAVGUN, CROWBAR, FREEZE, REMOVER) & PLAYABLE ACTOR
   ========================================================================== */
var prevClientId = "";
try {
  prevClientId = sessionStorage.getItem("fembooru_prev_client_id") || "";
  sessionStorage.setItem("fembooru_prev_client_id", myClientId);
} catch (e) {}

var PROP_SOURCES = [
  function(seed) { return "https://picsum.photos/seed/fb" + seed + "/160/130"; },
  function(seed) { return "https://robohash.org/fembooru_" + seed + ".png?size=140x140"; },
  function(seed) { return "https://robohash.org/cat_" + seed + ".png?set=set4&size=140x140"; },
  function(seed) { return "https://loremflickr.com/160/130/meme,cat?lock=" + seed; },
  function(seed) { return "https://loremflickr.com/160/130/anime,retro?lock=" + seed; }
];

function refreshPropCatalog() {
  var list = [];
  var base = Math.floor(Math.random() * 9000) + 100;
  for (var i = 0; i < 15; i++) {
    var seed = base + i * 7;
    var fn = PROP_SOURCES[i % PROP_SOURCES.length];
    list.push({
      id: "prop_" + seed,
      name: "Prop #" + (i + 1),
      url: fn(seed)
    });
  }
  worldState.propCatalog = list;
  renderPropMenuGrid();
}

function renderPropMenuGrid() {
  var grid = document.getElementById("propMenuGrid");
  if (!grid) return;
  if (!worldState.propCatalog.length) refreshPropCatalog();
  var h = "";
  for (var i = 0; i < worldState.propCatalog.length; i++) {
    var p = worldState.propCatalog[i];
    h += "<div class='prop-menu-item' onclick=\"spawnPropFromCatalog(" + i + ")\">" +
           "<img src='" + esc(p.url) + "' alt=''>" +
           "<span class='muted'>" + esc(p.name) + "</span>" +
         "</div>";
  }
  grid.innerHTML = h;
}

function togglePropMenu(forceState) {
  var modal = document.getElementById("propMenuModal");
  if (!modal) return;
  var next = (typeof forceState === "boolean") ? forceState : (modal.style.display === "none");
  worldState.propMenuOpen = next;
  modal.style.display = next ? "block" : "none";
  if (next && !worldState.propCatalog.length) refreshPropCatalog();
}

function setWorldTool(toolName) {
  worldState.activeTool = toolName || "physgun";
  var sel = document.getElementById("worldToolSelect");
  if (sel && sel.value !== worldState.activeTool) sel.value = worldState.activeTool;
  showStatus("Equipped tool: " + worldState.activeTool.toUpperCase(), false);
}

/* ==========================================================================
   SPRITES, RMB THROWING & FIREWORKS
   ========================================================================== */
function createWorldSpriteEntity(imgUrl, x, y) {
  if (!isValidImageSrc(imgUrl)) return;
  var sid = generateId("spr");
  var sx = (typeof x === "number") ? x : (window.pageXOffset || 0) + 280 + Math.random() * 240;
  var sy = (typeof y === "number") ? y : (window.pageYOffset || 0) + 180 + Math.random() * 140;
  var spr = {
    id: sid,
    url: imgUrl,
    ownerClient: myClientId,
    ownerName: getDisplayUsername(),
    x: Math.round(sx),
    y: Math.round(sy),
    vx: 0,
    vy: 0,
    rot: 0,
    vrot: 0,
    frozen: false,
    attachedFw: "",
    updatedAt: new Date().getTime()
  };
  worldState.sprites[sid] = spr;
  worldState.ownedSprites[sid] = true;
  dbWrite("PUT", "realtime/sprites/" + sid, spr, null);
}

function spawnPropFromCatalog(idx) {
  var item = worldState.propCatalog[idx];
  if (!item) return;
  createWorldSpriteEntity(item.url);
  togglePropMenu(false);
}

function spawnCustomSprite() {
  var fEl = document.getElementById("spriteSpawnFile");
  var uEl = document.getElementById("spriteSpawnUrl");
  var direct = uEl ? safeUrl(uEl.value) : "";

  if (fEl && fEl.files && fEl.files[0]) {
    uploadImageToImgbb(fEl, function(err, url) {
      if (!err && url) {
        fEl.value = "";
        createWorldSpriteEntity(url);
        showStatus("Sprite spawned! Hold RMB to throw or drag onto a firework.", false);
      } else {
        showStatus(err || "Sprite upload failed", true);
      }
    }, { isSticker: false });
  } else if (direct) {
    if (uEl) uEl.value = "";
    createWorldSpriteEntity(direct);
    showStatus("Sprite spawned! Hold RMB to throw or drag onto a firework.", false);
  } else {
    showStatus("Select an image/GIF or enter a sprite URL.", true);
  }
}

function spawnFirework() {
  var fid = generateId("fw");
  var fx = (window.pageXOffset || 0) + 260 + Math.random() * Math.max(200, (window.innerWidth || 900) - 420);
  var fy = (window.pageYOffset || 0) + Math.max(260, (window.innerHeight || 650) - 90);
  var fw = {
    id: fid,
    ownerClient: myClientId,
    x: Math.round(fx),
    y: Math.round(fy),
    vy: -320,
    fuseAt: new Date().getTime() + 2600,
    attachedSpriteId: "",
    exploded: false
  };
  worldState.fireworks[fid] = fw;
  dbWrite("PUT", "realtime/fireworks/" + fid, fw, null);
  showStatus("Firework spawned! Drag a sprite onto it to launch!", false);
}

function clearMyWorldEntities() {
  for (var sid in worldState.sprites) {
    if (worldState.sprites.hasOwnProperty(sid) && worldState.sprites[sid] &&
        worldState.sprites[sid].ownerClient === myClientId) {
      delete worldState.sprites[sid];
      dbWrite("DELETE", "realtime/sprites/" + sid, null, null);
    }
  }
  for (var fid in worldState.fireworks) {
    if (worldState.fireworks.hasOwnProperty(fid) && worldState.fireworks[fid] &&
        worldState.fireworks[fid].ownerClient === myClientId) {
      delete worldState.fireworks[fid];
      dbWrite("DELETE", "realtime/fireworks/" + fid, null, null);
    }
  }
  renderWorldEntities();
  showStatus("Cleared your sprites & fireworks.", false);
}

function spawnExplosionParticles(docX, docY) {
  var vx = docX - (window.pageXOffset || document.documentElement.scrollLeft || 0);
  var vy = docY - (window.pageYOffset || document.documentElement.scrollTop || 0);
  var colors = ["#FF3300", "#FFAA00", "#FFFF33", "#33FF77", "#33CCFF", "#FF44CC"];
  for (var i = 0; i < 42; i++) {
    var ang = (Math.PI * 2 * i) / 42 + (Math.random() * 0.2);
    var spd = 90 + Math.random() * 240;
    worldState.particles.push({
      x: vx,
      y: vy,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      life: 1.1 + Math.random() * 0.5,
      color: colors[i % colors.length]
    });
  }
  worldState.hadFx = true;
}

/* ==========================================================================
   PLAYABLE WALKABLE USER MODEL (WASD / ARROWS / MOBILE D-PAD)
   ========================================================================== */
function togglePlayableActor() {
  worldState.actorEnabled = !worldState.actorEnabled;
  var btn = document.getElementById("actorToggleBtn");
  var mob = document.getElementById("mobileActorControls");
  if (btn) btn.className = worldState.actorEnabled ? "btn-active" : "";
  if (mob) mob.style.display = worldState.actorEnabled ? "flex" : "none";

  if (worldState.actorEnabled) {
    worldState.myActor.x = (window.pageXOffset || 0) + 320;
    worldState.myActor.y = (window.pageYOffset || 0) + 120;
    worldState.myActor.vx = 0;
    worldState.myActor.vy = 0;
    worldState.myActor.hp = 100;
    scanPagePlatforms();
    showStatus("Walkable character active! Use WASD / Arrows to walk & jump on posts/buttons.", false);
  } else {
    dbWrite("DELETE", "realtime/actors/" + myClientId, null, null);
    delete worldState.actors[myClientId];
    renderWorldEntities();
  }
}

function setActorKey(k, down) {
  worldState.keys[k] = Boolean(down);
  if (k === "down" && down) {
    worldState.dropThroughUntil = new Date().getTime() + 260;
  }
}

function scanPagePlatforms() {
  var now = new Date().getTime();
  if (now - worldState.lastPlatformScan < 900 && worldState.platformCache.length) return;
  worldState.lastPlatformScan = now;
  var sx = window.pageXOffset || document.documentElement.scrollLeft || 0;
  var sy = window.pageYOffset || document.documentElement.scrollTop || 0;
  var list = [];
  var nodes = document.querySelectorAll(".thread-item, .wall-post-card, .box-panel, .side-box, .top-bar, button");
  for (var i = 0; i < nodes.length; i++) {
    var r = nodes[i].getBoundingClientRect();
    if (r.width < 24 || r.height < 14) continue;
    list.push({
      left: r.left + sx,
      right: r.right + sx,
      top: r.top + sy
    });
  }
  worldState.platformCache = list;
}

function triggerActorToolAction() {
  var a = worldState.myActor;
  a.swingUntil = new Date().getTime() + 260;
  var reachX = a.x + (a.facing * 48);
  var reachY = a.y + 20;

  // Kick / hit nearby sprites
  for (var sid in worldState.sprites) {
    if (!worldState.sprites.hasOwnProperty(sid) || !worldState.sprites[sid]) continue;
    var s = worldState.sprites[sid];
    if (Math.abs(s.x - reachX) < 85 && Math.abs(s.y - reachY) < 85) {
      s.frozen = false;
      s.vx = a.facing * 460;
      s.vy = -260;
      s.vrot = a.facing * 260;
      s.ownerClient = myClientId;
      worldState.ownedSprites[sid] = true;
      dbWrite("PUT", "realtime/sprites/" + sid, s, null);
    }
  }

  // Hit other players with Crowbar / Tool
  for (var cid in worldState.actors) {
    if (!worldState.actors.hasOwnProperty(cid) || cid === myClientId || cid === prevClientId) continue;
    var other = worldState.actors[cid];
    if (other && Math.abs(other.x - reachX) < 65 && Math.abs(other.y - reachY) < 65) {
      var nextHp = Math.max(0, (other.hp || 100) - 20);
      dbWrite("PATCH", "realtime/actors/" + cid, {
        hp: nextHp,
        vx: a.facing * 380,
        vy: -240
      }, null);
    }
  }
}

/* ==========================================================================
   CURSOR CHAT ('/' OR 'SHIFT')
   ========================================================================== */
function openCursorChat() {
  var bar = document.getElementById("cursorChatBar");
  var inp = document.getElementById("cursorChatInput");
  if (!bar || !inp) return;
  worldState.cursorChatOpen = true;
  bar.style.display = "flex";
  inp.value = worldState.localChatText || "";
  inp.focus();
}

function closeCursorChat() {
  var bar = document.getElementById("cursorChatBar");
  if (bar) bar.style.display = "none";
  worldState.cursorChatOpen = false;
}

function sendCursorChat() {
  var inp = document.getElementById("cursorChatInput");
  var txt = inp ? inp.value.trim() : "";
  worldState.localChatText = txt;
  worldState.localChatExpiresAt = txt ? (new Date().getTime() + 7000) : 0;
  closeCursorChat();
  sendCursorTelemetry(true);
}

/* ==========================================================================
   INPUT LISTENERS (MOUSE, TOUCH, WHEEL, KEYBOARD) & TELEMETRY
   ========================================================================== */
function getDocCoordsFromEvent(e) {
  var sx = window.pageXOffset || document.documentElement.scrollLeft || 0;
  var sy = window.pageYOffset || document.documentElement.scrollTop || 0;
  if (e.touches && e.touches.length) {
    return { x: Math.round(e.touches[0].clientX + sx), y: Math.round(e.touches[0].clientY + sy) };
  }
  return { x: Math.round((e.clientX || 0) + sx), y: Math.round((e.clientY || 0) + sy) };
}

function sendCursorTelemetry(forceNow) {
  var now = new Date().getTime();
  if (!forceNow && (now - worldState.lastCursorSendTime < 140)) return;
  worldState.lastCursorSendTime = now;

  var activeChat = (worldState.localChatExpiresAt > now) ? worldState.localChatText : "";
  var payload = {
    clientId: myClientId,
    uid: state.user ? state.user.uid : "",
    name: getDisplayUsername(),
    x: worldState.lastMouseX,
    y: worldState.lastMouseY,
    tool: worldState.activeTool,
    chat: activeChat,
    updatedAt: now
  };
  dbWrite("PUT", "realtime/cursors/" + myClientId, payload, null);
}

function initSandboxWorld() {
  if (prevClientId && prevClientId !== myClientId) {
    dbWrite("DELETE", "realtime/cursors/" + prevClientId, null, null);
    dbWrite("DELETE", "realtime/actors/" + prevClientId, null, null);
  }

  window.addEventListener("beforeunload", function() {
    dbWrite("DELETE", "realtime/cursors/" + myClientId, null, null);
    dbWrite("DELETE", "realtime/actors/" + myClientId, null, null);
  });

  // Prevent browser context menu when right-clicking a sprite to throw it
  document.addEventListener("contextmenu", function(e) {
    var t = e.target;
    if (t && t.closest && t.closest(".world-sprite-node")) {
      e.preventDefault();
    }
  });

  function onPointerDown(e) {
    var pt = getDocCoordsFromEvent(e);
    var prevX = worldState.lastMouseX;
    var prevY = worldState.lastMouseY;
    worldState.lastMouseX = pt.x;
    worldState.lastMouseY = pt.y;
    worldState.isPointerDown = true;
    worldState.throwVx = (pt.x - prevX) * 12;
    worldState.throwVy = (pt.y - prevY) * 12;

    var target = e.target;
    var sprNode = target && target.closest ? target.closest(".world-sprite-node") : null;
    var actNode = target && target.closest ? target.closest(".world-actor-node") : null;

    if (sprNode) {
      var sid = sprNode.getAttribute("data-sid");
      var spr = worldState.sprites[sid];
      if (!spr) return;
      if (e.button === 2 || worldState.activeTool === "physgun" || worldState.activeTool === "gravgun") {
        e.preventDefault();
        worldState.grabbedSpriteId = sid;
        spr.frozen = false;
        spr.ownerClient = myClientId;
        worldState.ownedSprites[sid] = true;
      } else if (worldState.activeTool === "freeze") {
        spr.frozen = !spr.frozen;
        spr.vx = 0;
        spr.vy = 0;
        dbWrite("PUT", "realtime/sprites/" + sid, spr, null);
      } else if (worldState.activeTool === "remover") {
        delete worldState.sprites[sid];
        dbWrite("DELETE", "realtime/sprites/" + sid, null, null);
        renderWorldEntities();
      } else if (worldState.activeTool === "crowbar") {
        spr.frozen = false;
        spr.vx = (Math.random() > 0.5 ? 1 : -1) * 420;
        spr.vy = -310;
        spr.vrot = 360;
        dbWrite("PUT", "realtime/sprites/" + sid, spr, null);
      }
      return;
    }

    if (actNode && worldState.activeTool === "physgun") {
      worldState.grabbedActorId = actNode.getAttribute("data-cid");
      return;
    }

    if (worldState.actorEnabled && worldState.activeTool === "crowbar" &&
        !(target && /^(INPUT|TEXTAREA|BUTTON|SELECT|A)$/i.test(target.tagName))) {
      triggerActorToolAction();
    }
  }

  function onPointerMove(e) {
    var pt = getDocCoordsFromEvent(e);
    worldState.throwVx = Math.max(-950, Math.min(950, (pt.x - worldState.lastMouseX) * 18));
    worldState.throwVy = Math.max(-950, Math.min(950, (pt.y - worldState.lastMouseY) * 18));
    worldState.lastMouseX = pt.x;
    worldState.lastMouseY = pt.y;

    if (worldState.grabbedSpriteId && worldState.sprites[worldState.grabbedSpriteId]) {
      var s = worldState.sprites[worldState.grabbedSpriteId];
      s.x = pt.x - 45;
      s.y = pt.y - 45;
      s.vx = 0;
      s.vy = 0;
      s.vrot = worldState.throwVx * 0.25;
    }
    if (worldState.grabbedActorId && worldState.actors[worldState.grabbedActorId]) {
      var ac = worldState.actors[worldState.grabbedActorId];
      ac.x = pt.x - 16;
      ac.y = pt.y - 20;
    }
    sendCursorTelemetry(false);
  }

  function onPointerUp() {
    if (worldState.grabbedSpriteId && worldState.sprites[worldState.grabbedSpriteId]) {
      var s = worldState.sprites[worldState.grabbedSpriteId];
      if (worldState.activeTool === "gravgun") {
        s.vx = worldState.throwVx * 1.8 || 420;
        s.vy = worldState.throwVy * 1.8 || -360;
      } else {
        s.vx = worldState.throwVx;
        s.vy = worldState.throwVy;
      }

      // Check if dropped onto any active Firework
      for (var fid in worldState.fireworks) {
        if (!worldState.fireworks.hasOwnProperty(fid) || !worldState.fireworks[fid]) continue;
        var fw = worldState.fireworks[fid];
        if (!fw.exploded && Math.abs(fw.x - (s.x + 40)) < 85 && Math.abs(fw.y - (s.y + 40)) < 85) {
          fw.attachedSpriteId = s.id;
          s.attachedFw = fid;
          dbWrite("PUT", "realtime/fireworks/" + fid, fw, null);
          showStatus("Sprite strapped to firework!", false);
          break;
        }
      }
      dbWrite("PUT", "realtime/sprites/" + s.id, s, null);
    }

    if (worldState.grabbedActorId && worldState.actors[worldState.grabbedActorId]) {
      var targetCid = worldState.grabbedActorId;
      var ac = worldState.actors[targetCid];
      dbWrite("PATCH", "realtime/actors/" + targetCid, {
        x: ac.x,
        y: ac.y,
        vx: worldState.throwVx,
        vy: worldState.throwVy
      }, null);
    }

    worldState.grabbedSpriteId = null;
    worldState.grabbedActorId = null;
    worldState.isPointerDown = false;
  }

  document.addEventListener("mousedown", onPointerDown);
  document.addEventListener("mousemove", onPointerMove);
  document.addEventListener("mouseup", onPointerUp);
  document.addEventListener("touchstart", onPointerDown, { passive: true });
  document.addEventListener("touchmove", onPointerMove, { passive: true });
  document.addEventListener("touchend", onPointerUp);

  // Rotate grabbed sprite with mouse wheel
  window.addEventListener("wheel", function(e) {
    if (worldState.grabbedSpriteId && worldState.sprites[worldState.grabbedSpriteId]) {
      var s = worldState.sprites[worldState.grabbedSpriteId];
      s.rot = ((s.rot || 0) + (e.deltaY > 0 ? 18 : -18)) % 360;
    }
  }, { passive: true });

  // Keyboard shortcuts: Q (Prop Menu), / or Shift (Cursor Chat), WASD/Arrows (Actor)
  document.addEventListener("keydown", function(e) {
    var tag = e.target && e.target.tagName;
    var inField = (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT");

    if (e.key === "Escape") {
      if (worldState.cursorChatOpen) closeCursorChat();
      if (worldState.propMenuOpen) togglePropMenu(false);
      closeZoomModal();
      closeStickerPicker();
      return;
    }

    if (worldState.cursorChatOpen) {
      if (e.key === "Enter") {
        e.preventDefault();
        sendCursorChat();
      }
      return;
    }

    if (e.key === "Shift" && !inField) {
      worldState.shiftDownClean = true;
      return;
    }
    worldState.shiftDownClean = false;

    if (inField) return;

    if (e.key === "/" ) {
      e.preventDefault();
      openCursorChat();
      return;
    }
    if (e.key === "q" || e.key === "Q") {
      e.preventDefault();
      togglePropMenu();
      return;
    }

    if (worldState.actorEnabled) {
      if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") setActorKey("left", true);
      if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") setActorKey("right", true);
      if (e.key === "w" || e.key === "W" || e.key === "ArrowUp" || e.key === " ") {
        e.preventDefault();
        setActorKey("jump", true);
      }
      if (e.key === "s" || e.key === "S" || e.key === "ArrowDown") setActorKey("down", true);
      if (e.key === "f" || e.key === "F" || e.key === "Enter") triggerActorToolAction();
    }
  });

  document.addEventListener("keyup", function(e) {
    if (e.key === "Shift" && worldState.shiftDownClean) {
      worldState.shiftDownClean = false;
      openCursorChat();
      return;
    }
    if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") setActorKey("left", false);
    if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") setActorKey("right", false);
    if (e.key === "w" || e.key === "W" || e.key === "ArrowUp" || e.key === " ") setActorKey("jump", false);
    if (e.key === "s" || e.key === "S" || e.key === "ArrowDown") setActorKey("down", false);
  });

  // Start Physics & Rendering Loop
  var lastFrameMs = new Date().getTime();
  function stepSandboxLoop() {
    var now = new Date().getTime();
    var dt = Math.min(0.05, (now - lastFrameMs) / 1000);
    lastFrameMs = now;
    updateWorldPhysics(dt, now);
    renderWorldEntities();
    requestAnimationFrame(stepSandboxLoop);
  }
  requestAnimationFrame(stepSandboxLoop);
}

/* ==========================================================================
   PHYSICS STEP & DOM / CANVAS RENDERING
   ========================================================================== */
function updateWorldPhysics(dt, now) {
  var docW = Math.max(document.documentElement.scrollWidth || 1000, window.innerWidth || 1000);
  var docH = Math.max(document.documentElement.scrollHeight || 900, window.innerHeight || 900);

  // 1. Fireworks update
  for (var fid in worldState.fireworks) {
    if (!worldState.fireworks.hasOwnProperty(fid) || !worldState.fireworks[fid]) continue;
    var fw = worldState.fireworks[fid];
    if (fw.exploded) continue;
    fw.y += (fw.vy || -320) * dt;
    if (fw.attachedSpriteId && worldState.sprites[fw.attachedSpriteId]) {
      var att = worldState.sprites[fw.attachedSpriteId];
      att.x = fw.x - 40;
      att.y = fw.y - 40;
      att.rot = ((att.rot || 0) + 320 * dt) % 360;
    }
    if (now >= (fw.fuseAt || 0) || fw.y < (window.pageYOffset || 0) + 70) {
      fw.exploded = true;
      if (!worldState.explodedFireworks[fid]) {
        worldState.explodedFireworks[fid] = true;
        spawnExplosionParticles(fw.x, fw.y);
      }
      if (fw.attachedSpriteId && worldState.sprites[fw.attachedSpriteId]) {
        var launched = worldState.sprites[fw.attachedSpriteId];
        launched.attachedFw = "";
        launched.vx = (Math.random() - 0.5) * 480;
        launched.vy = -220;
        launched.vrot = 420;
        if (fw.ownerClient === myClientId) {
          dbWrite("PUT", "realtime/sprites/" + launched.id, launched, null);
        }
      }
      if (fw.ownerClient === myClientId) {
        dbWrite("DELETE", "realtime/fireworks/" + fid, null, null);
      }
      delete worldState.fireworks[fid];
    }
  }

  // 2. Sprites physics (owned sprites)
  for (var sid in worldState.sprites) {
    if (!worldState.sprites.hasOwnProperty(sid) || !worldState.sprites[sid]) continue;
    var s = worldState.sprites[sid];
    if (s.ownerClient !== myClientId) continue;
    if (worldState.grabbedSpriteId === sid || s.frozen || s.attachedFw) continue;

    s.vy = (s.vy || 0) + 640 * dt;
    s.x = (s.x || 0) + (s.vx || 0) * dt;
    s.y = (s.y || 0) + (s.vy || 0) * dt;
    s.rot = ((s.rot || 0) + (s.vrot || 0) * dt) % 360;

    if (s.x < 10) { s.x = 10; s.vx = Math.abs(s.vx || 0) * 0.65; }
    if (s.x > docW - 110) { s.x = docW - 110; s.vx = -Math.abs(s.vx || 0) * 0.65; }
    if (s.y > docH - 110) {
      s.y = docH - 110;
      s.vy = -Math.abs(s.vy || 0) * 0.45;
      s.vx = (s.vx || 0) * 0.82;
      s.vrot = (s.vrot || 0) * 0.7;
      if (Math.abs(s.vy) < 25) s.vy = 0;
    }

    if ((Math.abs(s.vx || 0) > 10 || Math.abs(s.vy || 0) > 10) &&
        (now - (worldState.lastSpriteSyncMap[sid] || 0) > 320)) {
      worldState.lastSpriteSyncMap[sid] = now;
      dbWrite("PUT", "realtime/sprites/" + sid, s, null);
    }
  }

  // 3. Playable Actor physics (jumps on threads, buttons, and cursors!)
  if (worldState.actorEnabled) {
    scanPagePlatforms();
    var a = worldState.myActor;
    var moveSpeed = 250;
    if (worldState.keys.left) { a.vx = -moveSpeed; a.facing = -1; }
    else if (worldState.keys.right) { a.vx = moveSpeed; a.facing = 1; }
    else { a.vx *= 0.78; }

    if (worldState.keys.jump && a.grounded) {
      a.vy = -440;
      a.grounded = false;
    }

    var prevBottom = a.y + 46;
    a.vy += 980 * dt;
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    a.grounded = false;

    if (a.x < 8) a.x = 8;
    if (a.x > docW - 42) a.x = docW - 42;

    if (a.vy >= 0 && now > worldState.dropThroughUntil) {
      var nextBottom = a.y + 46;
      var footX = a.x + 17;
      for (var p = 0; p < worldState.platformCache.length; p++) {
        var pl = worldState.platformCache[p];
        if (footX >= pl.left && footX <= pl.right && prevBottom <= pl.top + 8 && nextBottom >= pl.top) {
          a.y = pl.top - 46;
          a.vy = 0;
          a.grounded = true;
          break;
        }
      }
      // Also allow jumping on remote user cursors!
      for (var cId in worldState.cursors) {
        if (!worldState.cursors.hasOwnProperty(cId) || cId === myClientId || cId === prevClientId) continue;
        var cur = worldState.cursors[cId];
        if (cur && Math.abs(footX - cur.x) < 28 && prevBottom <= cur.y + 8 && nextBottom >= cur.y) {
          a.y = cur.y - 46;
          a.vy = 0;
          a.grounded = true;
          break;
        }
      }
    }

    if (a.y > docH - 54) {
      a.y = docH - 54;
      a.vy = 0;
      a.grounded = true;
    }

    var actorPayload = {
      clientId: myClientId,
      uid: state.user ? state.user.uid : "",
      name: getDisplayUsername(),
      x: Math.round(a.x),
      y: Math.round(a.y),
      facing: a.facing,
      hp: a.hp,
      tool: worldState.activeTool,
      swinging: now < (a.swingUntil || 0),
      updatedAt: now
    };
    worldState.actors[myClientId] = actorPayload;
    if (now - worldState.lastActorSendTime > 180) {
      worldState.lastActorSendTime = now;
      dbWrite("PUT", "realtime/actors/" + myClientId, actorPayload, null);
    }
  }

  // 4. Firework explosion particles on fixed viewport canvas
  var fxCanvas = document.getElementById("worldFxCanvas");
  if (fxCanvas && fxCanvas.getContext && (worldState.particles.length || worldState.hadFx)) {
    var vw = window.innerWidth || 1000;
    var vh = window.innerHeight || 700;
    if (fxCanvas.width !== vw) fxCanvas.width = vw;
    if (fxCanvas.height !== vh) fxCanvas.height = vh;
    var ctx = fxCanvas.getContext("2d");
    ctx.clearRect(0, 0, vw, vh);
    for (var i = worldState.particles.length - 1; i >= 0; i--) {
      var pt = worldState.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += 240 * dt;
      pt.life -= dt;
      if (pt.life <= 0) {
        worldState.particles.splice(i, 1);
        continue;
      }
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x, pt.y, 4, 4);
    }
    worldState.hadFx = worldState.particles.length > 0;
  }
}

function renderWorldEntities() {
  var layer = document.getElementById("worldOverlayLayer");
  var curLayer = document.getElementById("remoteCursorsLayer");
  var now = new Date().getTime();

  // Render Sprites & Fireworks
  if (layer) {
    var activeSpriteIds = {};
    for (var sid in worldState.sprites) {
      if (!worldState.sprites.hasOwnProperty(sid) || !worldState.sprites[sid]) continue;
      var s = worldState.sprites[sid];
      if (!isValidImageSrc(s.url)) continue;
      activeSpriteIds[sid] = true;
      var node = worldState.spriteNodes[sid];
      if (!node) {
        node = document.createElement("div");
        node.className = "world-sprite-node";
        node.setAttribute("data-sid", sid);
        node.innerHTML = "<img src='" + esc(s.url) + "' alt=''><span class='world-sprite-badge'>" + esc(s.ownerName || "Anon") + "</span>";
        layer.appendChild(node);
        worldState.spriteNodes[sid] = node;
      }
      node.style.left = Math.round(s.x || 0) + "px";
      node.style.top = Math.round(s.y || 0) + "px";
      node.style.transform = "rotate(" + Math.round(s.rot || 0) + "deg)";
    }
    for (var oldSid in worldState.spriteNodes) {
      if (worldState.spriteNodes.hasOwnProperty(oldSid) && !activeSpriteIds[oldSid]) {
        if (worldState.spriteNodes[oldSid].parentNode) {
          worldState.spriteNodes[oldSid].parentNode.removeChild(worldState.spriteNodes[oldSid]);
        }
        delete worldState.spriteNodes[oldSid];
      }
    }

    var activeFwIds = {};
    for (var fid in worldState.fireworks) {
      if (!worldState.fireworks.hasOwnProperty(fid) || !worldState.fireworks[fid] || worldState.fireworks[fid].exploded) continue;
      var fw = worldState.fireworks[fid];
      activeFwIds[fid] = true;
      var fNode = worldState.fireworkNodes[fid];
      if (!fNode) {
        fNode = document.createElement("div");
        fNode.className = "world-sprite-node";
        fNode.innerHTML = "<div style='width:14px;height:28px;background:#CC0000;border:1px solid #FFFF00;border-radius:4px 4px 0 0;'></div>";
        layer.appendChild(fNode);
        worldState.fireworkNodes[fid] = fNode;
      }
      fNode.style.left = Math.round(fw.x || 0) + "px";
      fNode.style.top = Math.round(fw.y || 0) + "px";
    }
    for (var oldFid in worldState.fireworkNodes) {
      if (worldState.fireworkNodes.hasOwnProperty(oldFid) && !activeFwIds[oldFid]) {
        if (worldState.fireworkNodes[oldFid].parentNode) {
          worldState.fireworkNodes[oldFid].parentNode.removeChild(worldState.fireworkNodes[oldFid]);
        }
        delete worldState.fireworkNodes[oldFid];
      }
    }

    // Render Walkable Actors
    var activeActIds = {};
    for (var cid in worldState.actors) {
      if (!worldState.actors.hasOwnProperty(cid) || !worldState.actors[cid]) continue;
      if (cid === prevClientId) continue;
      var ac = worldState.actors[cid];
      if (now - (ac.updatedAt || 0) > 12000 && cid !== myClientId) continue;
      activeActIds[cid] = true;
      var aNode = worldState.actorNodes[cid];
      if (!aNode) {
        aNode = document.createElement("div");
        aNode.className = "world-actor-node";
        aNode.setAttribute("data-cid", cid);
        aNode.innerHTML =
          "<div class='world-actor-name'>" + esc(ac.name || "Player") + " [" + (ac.hp || 100) + "]</div>" +
          "<svg width='34' height='48' viewBox='0 0 34 48'>" +
            "<circle cx='17' cy='10' r='7' fill='#EEAA88' stroke='#800000' stroke-width='2'/>" +
            "<rect x='10' y='18' width='14' height='16' fill='#E07A48' stroke='#800000' stroke-width='2'/>" +
            "<line x1='12' y1='34' x2='9' y2='46' stroke='#800000' stroke-width='3'/>" +
            "<line x1='22' y1='34' x2='25' y2='46' stroke='#800000' stroke-width='3'/>" +
            "<line x1='24' y1='22' x2='33' y2='16' stroke='#333333' stroke-width='3'/>" +
          "</svg>";
        layer.appendChild(aNode);
        worldState.actorNodes[cid] = aNode;
      }
      aNode.style.left = Math.round(ac.x || 0) + "px";
      aNode.style.top = Math.round(ac.y || 0) + "px";
      var nameBadge = aNode.querySelector(".world-actor-name");
      if (nameBadge) nameBadge.textContent = (ac.name || "Player") + " [" + (ac.hp || 100) + "]";
    }
    for (var oldAid in worldState.actorNodes) {
      if (worldState.actorNodes.hasOwnProperty(oldAid) && !activeActIds[oldAid]) {
        if (worldState.actorNodes[oldAid].parentNode) {
          worldState.actorNodes[oldAid].parentNode.removeChild(worldState.actorNodes[oldAid]);
        }
        delete worldState.actorNodes[oldAid];
      }
    }
  }

  // Render Remote Cursors (Strictly excluding myClientId & prevClientId so user never sees own mouse!)
  if (curLayer) {
    var activeCurIds = {};
    for (var cId in worldState.cursors) {
      if (!worldState.cursors.hasOwnProperty(cId) || !worldState.cursors[cId]) continue;
      if (cId === myClientId || cId === prevClientId) continue;
      var cur = worldState.cursors[cId];
      if (now - (cur.updatedAt || 0) > 10000) continue;
      activeCurIds[cId] = true;

      var cNode = worldState.cursorNodes[cId];
      if (!cNode) {
        cNode = document.createElement("div");
        cNode.className = "remote-cursor-node";
        cNode.innerHTML =
          "<svg width='14' height='18' viewBox='0 0 14 18'><polygon points='0,0 13,11 7,12 10,17 7,18 4,13 0,16' fill='#E07A48' stroke='#800000' stroke-width='1.5'/></svg>" +
          "<div class='remote-cursor-label'></div>" +
          "<div class='remote-cursor-chat' style='display:none;'></div>";
        curLayer.appendChild(cNode);
        worldState.cursorNodes[cId] = cNode;
      }
      cNode.style.left = Math.round(cur.x || 0) + "px";
      cNode.style.top = Math.round(cur.y || 0) + "px";
      var lbl = cNode.querySelector(".remote-cursor-label");
      if (lbl) lbl.textContent = cur.name || "Anon";
      var chatEl = cNode.querySelector(".remote-cursor-chat");
      if (chatEl) {
        if (cur.chat) {
          chatEl.style.display = "block";
          chatEl.textContent = cur.chat;
        } else {
          chatEl.style.display = "none";
        }
      }
    }
    for (var oldCid in worldState.cursorNodes) {
      if (worldState.cursorNodes.hasOwnProperty(oldCid) && !activeCurIds[oldCid]) {
        if (worldState.cursorNodes[oldCid].parentNode) {
          worldState.cursorNodes[oldCid].parentNode.removeChild(worldState.cursorNodes[oldCid]);
        }
        delete worldState.cursorNodes[oldCid];
      }
    }
  }
}

function syncRealtimeWorld() {
  dbGet("realtime", function(err, rt) {
    if (err || !rt || typeof rt !== "object") return;
    worldState.cursors = rt.cursors || {};
    if (rt.sprites) {
      for (var sid in rt.sprites) {
        if (rt.sprites.hasOwnProperty(sid) && rt.sprites[sid]) {
          if (worldState.grabbedSpriteId !== sid && rt.sprites[sid].ownerClient !== myClientId) {
            worldState.sprites[sid] = rt.sprites[sid];
          }
        }
      }
      for (var localSid in worldState.sprites) {
        if (worldState.sprites.hasOwnProperty(localSid) && !rt.sprites[localSid] &&
            worldState.sprites[localSid].ownerClient !== myClientId) {
          delete worldState.sprites[localSid];
        }
      }
    } else {
      for (var k in worldState.sprites) {
        if (worldState.sprites.hasOwnProperty(k) && worldState.sprites[k].ownerClient !== myClientId) {
          delete worldState.sprites[k];
        }
      }
    }
    if (rt.fireworks) {
      for (var fid in rt.fireworks) {
        if (rt.fireworks.hasOwnProperty(fid) && rt.fireworks[fid] &&
            rt.fireworks[fid].ownerClient !== myClientId) {
          worldState.fireworks[fid] = rt.fireworks[fid];
        }
      }
    }
    if (rt.actors) {
      for (var aid in rt.actors) {
        if (rt.actors.hasOwnProperty(aid) && aid !== myClientId && aid !== prevClientId) {
          worldState.actors[aid] = rt.actors[aid];
        }
      }
      var myRemote = rt.actors[myClientId];
      if (myRemote && worldState.actorEnabled && typeof myRemote.hp === "number" &&
          myRemote.hp < worldState.myActor.hp) {
        worldState.myActor.hp = myRemote.hp;
        if (typeof myRemote.vx === "number") worldState.myActor.vx = myRemote.vx;
        if (typeof myRemote.vy === "number") worldState.myActor.vy = myRemote.vy;
      }
    }
  });
}