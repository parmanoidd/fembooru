/* ==========================================================================
   SANDBOX PLAYGROUND: REALTIME CURSORS, CURSOR CHAT, PROP MENU (Q),
   HL2 TOOLS (1-5), SPRITES, FIREWORKS & PLAYABLE CHARACTER MODELS
   ========================================================================== */
var HL2_TOOL_HINTS = {
  physgun: "Physgun: Drag/RMB-flick props; [R] or Spin button rotates held prop.",
  gravgun: "Gravity Gun: Click/tap any prop to punt it across the page with spin.",
  crowbar: "Crowbar: Click/tap near props or players to whack & deal damage!",
  pistol: "Pistol: Click/tap anywhere to shoot bullets at props & other players!",
  remover: "Remover Tool: Click/tap any prop to delete it from the map."
};

function getViewportSize() {
  return {
    w: window.innerWidth || document.documentElement.clientWidth || 800,
    h: window.innerHeight || document.documentElement.clientHeight || 600
  };
}

function getScrollOffset() {
  return {
    x: window.pageXOffset || document.documentElement.scrollLeft || 0,
    y: window.pageYOffset || document.documentElement.scrollTop || 0
  };
}

function getWrapRect() {
  var w = document.getElementById("pageWrap");
  if (!w) {
    var v = getViewportSize();
    return { left: 0, width: v.w };
  }
  var r = w.getBoundingClientRect();
  return { left: r.left, width: r.width || 1 };
}

function isTypingField() {
  var e = document.activeElement;
  return Boolean(e && /^(INPUT|TEXTAREA|SELECT)$/i.test(e.tagName || ""));
}

/* ==========================================================================
   LIVE CURSOR CHAT (SHIFT / SLASH / BUTTON) & OPTIMIZED REMOTE CURSORS
   ========================================================================== */
function updateLocalChatBox() {
  var box = document.getElementById("localCursorChatBox");
  var prev = document.getElementById("localCursorBubblePreview");
  var now = new Date().getTime();
  var cx = worldState.lastMouseX;
  var cy = worldState.lastMouseY;
  var vp = getViewportSize();

  if (box) {
    box.style.display = worldState.cursorChatOpen ? "block" : "none";
    if (worldState.cursorChatOpen) {
      box.style.left = Math.max(8, Math.min(vp.w - 310, cx + 10)) + "px";
      box.style.bottom = Math.max(8, Math.min(vp.h - 75, vp.h - cy + 14)) + "px";
    }
  }
  if (prev) {
    if (!worldState.cursorChatOpen && worldState.localChatText && worldState.localChatExpiresAt > now) {
      prev.style.display = "block";
      prev.style.left = Math.max(8, Math.min(vp.w - 220, cx + 10)) + "px";
      prev.style.bottom = Math.max(8, Math.min(vp.h - 45, vp.h - cy + 12)) + "px";
      prev.innerHTML = esc(worldState.localChatText);
    } else {
      prev.style.display = "none";
    }
  }
}

function syncCursor(force) {
  var now = new Date().getTime();
  var sc = getScrollOffset();
  var wr = getWrapRect();
  var relX = Math.round(((worldState.lastMouseX - wr.left) / wr.width) * 10000) / 10000;
  var docY = Math.round(worldState.lastMouseY + sc.y);
  if (!force && (now - worldState.lastCursorSendTime < 110 || (Math.abs(relX - worldState.lastCursorRelX) <= 0.002 && Math.abs(docY - worldState.lastCursorDocY) <= 3))) {
    return;
  }
  worldState.lastCursorSendTime = now;
  worldState.lastCursorRelX = relX;
  worldState.lastCursorDocY = docY;
  var chat = (worldState.localChatText && worldState.localChatExpiresAt > now) ? worldState.localChatText : "";
  dbWrite("PUT", "realtime/cursors/" + myClientId, {
    name: getDisplayUsername(),
    uid: state.user ? state.user.uid : "",
    relX: relX,
    docY: docY,
    tool: worldState.activeTool,
    chatText: chat,
    chatUpdatedAt: chat ? now : 0,
    updatedAt: now
  }, null);
}

function openCursorChat() {
  var i = document.getElementById("cursorChatInput");
  if (!i) return;
  worldState.cursorChatOpen = true;
  worldState.localChatExpiresAt = new Date().getTime() + 15000;
  updateLocalChatBox();
  i.focus();
}

function closeCursorChat(keep) {
  var i = document.getElementById("cursorChatInput");
  worldState.cursorChatOpen = false;
  if (!keep) {
    worldState.localChatText = "";
    worldState.localChatExpiresAt = 0;
    if (i) i.value = "";
  } else {
    worldState.localChatExpiresAt = new Date().getTime() + 9000;
  }
  if (i && i.blur) i.blur();
  updateLocalChatBox();
  syncCursor(true);
}

function renderRemoteCursors() {
  var layer = document.getElementById("cursorsLayer");
  if (!layer) return;
  var sc = getScrollOffset();
  var wr = getWrapRect();
  var now = new Date().getTime();
  var act = {};

  for (var cid in worldState.cursors) {
    if (!worldState.cursors.hasOwnProperty(cid) || cid === myClientId) continue;
    var cur = worldState.cursors[cid];
    if (!cur || !cur.updatedAt || (now - cur.updatedAt) > 7000) continue;
    if (state.user && cur.uid && cur.uid === state.user.uid) continue;
    if (cur.uid && isUserBlockedByMe(cur.uid)) continue;

    act[cid] = true;
    var sx = Math.round(wr.left + ((typeof cur.relX === "number" ? cur.relX : 0.5) * wr.width));
    var sy = Math.round((typeof cur.docY === "number" ? cur.docY : 200) - sc.y);
    var hasChat = cur.chatText && cur.chatUpdatedAt && (now - cur.chatUpdatedAt) < 12000;
    var node = worldState.cursorNodes[cid];

    if (!node) {
      node = document.createElement("div");
      node.className = "remote-cursor";
      node.innerHTML =
        '<div class="remote-cursor-header">' +
          '<div class="cursor-chat-bubble" style="display:none;"></div>' +
          '<div class="remote-cursor-label"></div>' +
        '</div>' +
        '<svg width="16" height="20" viewBox="0 0 16 20" style="display:block;">' +
          '<polygon points="0,0 0,16 4,12 8,19 10,18 6,11 12,11" fill="#AF0A0F" stroke="#FFFFEE" stroke-width="1"/>' +
        '</svg>';
      layer.appendChild(node);
      worldState.cursorNodes[cid] = node;
    }

    var hdr = node.firstChild;
    var bubbleEl = hdr.childNodes[0];
    var labelEl = hdr.childNodes[1];
    node.style.transform = "translate3d(" + sx + "px," + sy + "px,0)";

    var tagText = (cur.name || "User") + (cur.tool ? (" [" + cur.tool + "]") : "");
    if (labelEl.textContent !== tagText) labelEl.textContent = tagText;
    bubbleEl.style.display = hasChat ? "block" : "none";
    if (hasChat && bubbleEl.textContent !== cur.chatText) bubbleEl.textContent = cur.chatText;
  }

  for (var old in worldState.cursorNodes) {
    if (worldState.cursorNodes.hasOwnProperty(old) && !act[old]) {
      if (worldState.cursorNodes[old].parentNode) worldState.cursorNodes[old].parentNode.removeChild(worldState.cursorNodes[old]);
      delete worldState.cursorNodes[old];
    }
  }
}

/* ==========================================================================
   GMOD / S&BOX PROP SPAWNER (Q MENU) — PURE RANDOM INTERNET IMAGES (NO TAGS)
   ========================================================================== */
function makeFallbackPropSvg(label) {
  var txt = String(label || "PROP").substring(0, 10).replace(/[<>&'"]/g, "");
  return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E" +
    "%3Crect width='120' height='120' fill='%23EEAA88' stroke='%23800000' stroke-width='4'/%3E" +
    "%3Ctext x='60' y='66' font-family='arial,sans-serif' font-size='14' font-weight='bold' text-anchor='middle' fill='%23800000'%3E" +
    encodeURIComponent(txt) + "%3C/text%3E%3C/svg%3E";
}

function buildRandomPropCatalog() {
  var r = function() { return Math.floor(Math.random() * 999999) + 1; };
  var sets = ["set1", "set2", "set3", "set4", "set5"];
  var list = [];
  for (var i = 0; i < 5; i++) {
    var s1 = r();
    list.push({
      name: "Random #" + (i + 1),
      url: "https://picsum.photos/160/160?random=" + s1
    });
  }
  for (var j = 0; j < 5; j++) {
    var s2 = r();
    list.push({
      name: "Random #" + (j + 6),
      url: "https://robohash.org/" + s2 + ".png?set=" + sets[j % sets.length] + "&size=160x160"
    });
  }
  return list;
}

function handlePropThumbError(imgEl, idx) {
  if (!imgEl || imgEl.getAttribute("data-fb-done")) return;
  imgEl.setAttribute("data-fb-done", "1");
  var item = worldState.propCatalog[idx];
  var fallback = makeFallbackPropSvg(item ? item.name : "PROP");
  if (item) item.url = fallback;
  imgEl.src = fallback;
}

function rerollRandomProps() {
  worldState.propCatalog = buildRandomPropCatalog();
  var grid = document.getElementById("qPropGrid");
  if (!grid) return;

  // Fetch completely random untagged files from Wikimedia Commons
  var xhr = new XMLHttpRequest();
  xhr.open("GET", "https://commons.wikimedia.org/w/api.php?action=query&generator=random&grnnamespace=6&grnlimit=8&prop=imageinfo&iiprop=url&iiurlwidth=160&format=json&origin=*", true);
  xhr.onreadystatechange = function() {
    if (xhr.readyState === 4 && xhr.status === 200) {
      try {
        var data = JSON.parse(xhr.responseText);
        var pages = data && data.query && data.query.pages;
        var slot = 5;
        if (pages) {
          for (var pid in pages) {
            if (pages.hasOwnProperty(pid) && pages[pid].imageinfo && pages[pid].imageinfo[0]) {
              var info = pages[pid].imageinfo[0];
              var thumb = info.thumburl || info.url;
              if (thumb && /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(thumb) && slot < worldState.propCatalog.length) {
                var cleanTitle = String(pages[pid].title || "Random").replace(/^File:/i, "").replace(/\.[^.]+$/, "").substring(0, 18);
                worldState.propCatalog[slot] = { name: cleanTitle, url: thumb };
                var imgNode = document.getElementById("qPropImg_" + slot);
                var lblNode = document.getElementById("qPropLbl_" + slot);
                if (imgNode) { imgNode.removeAttribute("data-fb-done"); imgNode.src = thumb; }
                if (lblNode) lblNode.textContent = cleanTitle;
                slot++;
              }
            }
          }
        }
      } catch (e) {}
    }
  };
  xhr.send();

  var h = "";
  for (var i = 0; i < worldState.propCatalog.length; i++) {
    var item = worldState.propCatalog[i];
    h += '<div class="q-prop-card" onclick="spawnPropFromCatalog(' + i + ')">' +
           '<img id="qPropImg_' + i + '" src="' + esc(item.url) + '" alt="prop" onerror="handlePropThumbError(this,' + i + ')">' +
           '<span id="qPropLbl_' + i + '">' + esc(item.name) + '</span>' +
         '</div>';
  }
  grid.innerHTML = h;
}

function togglePropMenu(forceState) {
  var modal = document.getElementById("qPropModal");
  if (!modal) return;
  worldState.propMenuOpen = (typeof forceState === "boolean") ? forceState : !worldState.propMenuOpen;
  modal.style.display = worldState.propMenuOpen ? "block" : "none";
  if (worldState.propMenuOpen && !worldState.propCatalog.length) rerollRandomProps();
}

function spawnPropFromCatalog(idx) {
  var item = worldState.propCatalog[idx];
  if (!item) return;
  saveSprite(item.url, false);
}

function spawnSharedSprite() {
  var fEl = document.getElementById("spriteFileInput");
  var uEl = document.getElementById("spriteUrlInput");
  var pUrl = uEl ? safeUrl(uEl.value) : "";
  if (fEl && fEl.files && fEl.files[0]) {
    uploadImageToImgbb(fEl, function(e, u) {
      if (!e && u) { saveSprite(u, true); fEl.value = ""; }
      else { setUploadProgress(-1); showStatus(e || "Failed.", true); }
    }, { keepProgressOpen: true });
    return;
  }
  if (uEl) uEl.value = "";
  saveSprite(pUrl || DEFAULT_SPRITE_ICON, false);
}

function saveSprite(u, hasProgress) {
  var sid = "sp_" + generateId();
  var obj = {
    id: sid,
    url: u,
    x: 380 + Math.floor(Math.random() * 240),
    y: 320 + Math.floor(Math.random() * 180),
    vx: (Math.random() - 0.5) * 8,
    vy: -5,
    angle: 0,
    vAngle: (Math.random() - 0.5) * 8,
    attachedFireworkId: "",
    spawnedBy: getDisplayUsername(),
    updatedAt: new Date().getTime()
  };
  worldState.sprites[sid] = obj;
  dbWrite("PUT", "realtime/sprites/" + sid, obj, function() {
    if (hasProgress) setUploadProgress(100, "Prop spawned!");
  }, hasProgress ? function(p) { setUploadProgress(85 + Math.round(p * 0.15), "Spawning prop..."); } : null);
}

function clearAllSprites() {
  worldState.sprites = {};
  worldState.grabbedSpriteId = null;
  dbWrite("DELETE", "realtime/sprites", null, null);
}

function spawnSharedFirework() {
  var fid = "fw_" + generateId();
  var now = new Date().getTime();
  var fw = {
    id: fid,
    x: 260 + Math.floor(Math.random() * 480),
    y: 880,
    launchAt: now + 4500,
    launched: false,
    exploded: false,
    updatedAt: now
  };
  worldState.fireworks[fid] = fw;
  dbWrite("PUT", "realtime/fireworks/" + fid, fw, null);
}

/* ==========================================================================
   HL2 TOOLS (PHYSGUN, GRAVGUN, CROWBAR, PISTOL, REMOVER) & COMBAT
   ========================================================================== */
function selectHl2Tool(tool) {
  if (!HL2_TOOL_HINTS[tool]) return;
  worldState.activeTool = tool;
  var tools = ["physgun", "gravgun", "crowbar", "pistol", "remover"];
  for (var i = 0; i < tools.length; i++) {
    var btn = document.getElementById("toolBtn_" + tools[i]);
    if (btn) btn.className = (tools[i] === tool) ? "btn-active" : "";
  }
  var help = document.getElementById("toolHelpText");
  if (help) help.innerHTML = esc(HL2_TOOL_HINTS[tool]);
  syncCursor(true);
}

function rotateHeldProp() {
  var sid = worldState.grabbedSpriteId;
  if (!sid || !worldState.sprites[sid]) {
    var keys = Object.keys(worldState.sprites);
    if (!keys.length) return;
    sid = keys[keys.length - 1];
  }
  var sp = worldState.sprites[sid];
  sp.angle = ((sp.angle || 0) + 45) % 360;
  sp.vAngle = 12;
  sp.updatedAt = new Date().getTime();
  dbWrite("PUT", "realtime/sprites/" + sp.id, sp, null);
}

function spawnBurstParticles(px, py, color, count) {
  for (var i = 0; i < count; i++) {
    var a = (Math.PI * 2 * i) / count;
    var spd = 2 + Math.random() * 6;
    worldState.particles.push({
      x: px,
      y: py,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      color: color,
      life: 28
    });
  }
}

function applyToolToProp(sp, clientX, clientY) {
  var vp = getViewportSize();
  var now = new Date().getTime();
  var px = (sp.x / 1000) * vp.w;
  var py = (sp.y / 1000) * vp.h;

  if (worldState.activeTool === "remover") {
    spawnBurstParticles(px, py, "#FF2222", 18);
    worldState.beams.push({ x1: clientX, y1: clientY, x2: px, y2: py, color: "#FF3333", life: 10 });
    delete worldState.sprites[sp.id];
    dbWrite("DELETE", "realtime/sprites/" + sp.id, null, null);
    return true;
  }
  if (worldState.activeTool === "gravgun") {
    var dx = px - clientX, dy = py - clientY;
    var dist = Math.sqrt(dx * dx + dy * dy) || 1;
    sp.attachedFireworkId = "";
    sp.vx = (dx / dist) * 26 + (Math.random() - 0.5) * 6;
    sp.vy = (dy / dist) * 24 - 12;
    sp.vAngle = (Math.random() - 0.5) * 35;
    sp.updatedAt = now;
    worldState.beams.push({ x1: clientX, y1: clientY, x2: px, y2: py, color: "#FF8800", life: 12 });
    spawnBurstParticles(px, py, "#FFA500", 14);
    dbWrite("PUT", "realtime/sprites/" + sp.id, sp, null);
    return true;
  }
  if (worldState.activeTool === "crowbar" || worldState.activeTool === "pistol") {
    sp.attachedFireworkId = "";
    sp.vx = (px >= clientX ? 1 : -1) * (14 + Math.random() * 10);
    sp.vy = -12 - Math.random() * 8;
    sp.vAngle = (Math.random() - 0.5) * 40;
    sp.updatedAt = now;
    spawnBurstParticles(px, py, "#FFD700", 12);
    dbWrite("PUT", "realtime/sprites/" + sp.id, sp, null);
    return true;
  }
  return false;
}

function useActiveHl2Tool(clickX, clickY) {
  var vp = getViewportSize();
  var sc = getScrollOffset();
  var wr = getWrapRect();
  var tx = (typeof clickX === "number") ? clickX : worldState.lastMouseX;
  var ty = (typeof clickY === "number") ? clickY : worldState.lastMouseY;
  var tool = worldState.activeTool;

  if (tool === "crowbar") {
    worldState.myActor.swingUntil = new Date().getTime() + 260;
    spawnBurstParticles(tx, ty, "#EEAA88", 10);
  } else if (tool === "pistol") {
    var ox = worldState.actorEnabled ? Math.round(wr.left + (worldState.myActor.x / 1000) * wr.width) : Math.round(vp.w * 0.5);
    var oy = worldState.actorEnabled ? Math.round(worldState.myActor.y - 28 - sc.y) : (vp.h - 20);
    worldState.beams.push({ x1: ox, y1: oy, x2: tx, y2: ty, color: "#FFD700", life: 8 });
    spawnBurstParticles(tx, ty, "#FFAA00", 10);
  }

  for (var sid in worldState.sprites) {
    if (!worldState.sprites.hasOwnProperty(sid) || !worldState.sprites[sid]) continue;
    var sp = worldState.sprites[sid];
    var spx = (sp.x / 1000) * vp.w;
    var spy = (sp.y / 1000) * vp.h;
    if (Math.abs(spx - tx) < 62 && Math.abs(spy - ty) < 62) {
      applyToolToProp(sp, tx, ty);
      break;
    }
  }

  if (tool === "crowbar" || tool === "pistol" || tool === "gravgun") {
    var dmg = (tool === "crowbar") ? 25 : (tool === "pistol" ? 20 : 10);
    for (var aid in worldState.actors) {
      if (!worldState.actors.hasOwnProperty(aid) || aid === myClientId) continue;
      var ac = worldState.actors[aid];
      if (!ac) continue;
      var ax = wr.left + (ac.x / 1000) * wr.width;
      var ay = ac.y - 26 - sc.y;
      if (Math.abs(ax - tx) < 48 && Math.abs(ay - ty) < 55) {
        var nextHp = Math.max(0, (typeof ac.hp === "number" ? ac.hp : 100) - dmg);
        spawnBurstParticles(ax, ay, "#CC0000", 16);
        dbWrite("PATCH", "realtime/actors/" + aid, {
          hp: nextHp <= 0 ? 100 : nextHp,
          vy: -11,
          vx: (ax >= tx ? 8 : -8),
          updatedAt: new Date().getTime()
        }, null);
        break;
      }
    }
  }
}

/* ==========================================================================
   PLAYABLE CHARACTER MODEL (WALK & JUMP ON WEBSITE BLOCKS WITH WASD/ARROWS)
   ========================================================================== */
function togglePlayableActor() {
  worldState.actorEnabled = !worldState.actorEnabled;
  var btn = document.getElementById("actorToggleBtn");
  if (btn) {
    btn.innerHTML = worldState.actorEnabled ? "&#127939; Despawn Player Model" : "&#127939; Spawn Player Model";
    btn.className = worldState.actorEnabled ? "btn-full btn-active" : "btn-full";
  }
  if (worldState.actorEnabled) {
    var sc = getScrollOffset();
    worldState.myActor.x = 500;
    worldState.myActor.y = sc.y + 140;
    worldState.myActor.vx = 0;
    worldState.myActor.vy = 0;
    worldState.myActor.hp = 100;
    syncMyActor(true);
  } else {
    dbWrite("DELETE", "realtime/actors/" + myClientId, null, null);
  }
}

function toggleMobileDpad() {
  var pad = document.getElementById("mobileDpad");
  if (!pad) return;
  pad.style.display = (pad.style.display === "block") ? "none" : "block";
}

function setVirtualKey(dir, isDown) {
  worldState.keys[dir] = isDown;
  if (isDown && dir === "jump" && !worldState.actorEnabled) togglePlayableActor();
}

function getWalkablePlatforms() {
  var wr = getWrapRect();
  var sc = getScrollOffset();
  var selectors = [".top-bar", ".side-box", ".music-widget", ".box-panel", ".thread-item", ".wall-post-card", ".poll-card", ".profile-card"];
  var plats = [];
  for (var s = 0; s < selectors.length; s++) {
    var nodes = document.querySelectorAll(selectors[s]);
    for (var i = 0; i < nodes.length; i++) {
      var r = nodes[i].getBoundingClientRect();
      if (r.width < 40 || r.height < 12) continue;
      var leftRel = ((r.left - wr.left) / wr.width) * 1000;
      var rightRel = ((r.right - wr.left) / wr.width) * 1000;
      var topDoc = r.top + sc.y;
      plats.push({ left: leftRel, right: rightRel, top: topDoc });
    }
  }
  return plats;
}

function stepMyActorPhysics() {
  if (!worldState.actorEnabled) return;
  var a = worldState.myActor;
  var speed = 7.5;
  if (worldState.keys.left) { a.vx = -speed; a.facing = -1; }
  else if (worldState.keys.right) { a.vx = speed; a.facing = 1; }
  else { a.vx *= 0.72; if (Math.abs(a.vx) < 0.2) a.vx = 0; }

  if (worldState.keys.jump && a.grounded) {
    a.vy = -13.5;
    a.grounded = false;
  }

  var prevY = a.y;
  a.vy = Math.min(18, a.vy + 0.75);
  a.x = Math.max(10, Math.min(990, a.x + a.vx));
  a.y += a.vy;
  a.grounded = false;

  if (a.vy >= 0) {
    var plats = getWalkablePlatforms();
    for (var i = 0; i < plats.length; i++) {
      var p = plats[i];
      if (a.x >= p.left && a.x <= p.right && prevY <= p.top + 8 && a.y >= p.top) {
        a.y = p.top;
        a.vy = 0;
        a.grounded = true;
        break;
      }
    }
  }

  var docH = Math.max(document.body.scrollHeight || 900, 700);
  if (a.y >= docH - 12) {
    a.y = docH - 12;
    a.vy = 0;
    a.grounded = true;
  }
  syncMyActor(false);
}

function syncMyActor(force) {
  if (!worldState.actorEnabled) return;
  var now = new Date().getTime();
  if (!force && (now - worldState.lastActorSendTime < 120)) return;
  worldState.lastActorSendTime = now;
  var a = worldState.myActor;
  a.updatedAt = now;
  dbWrite("PUT", "realtime/actors/" + myClientId, {
    name: getDisplayUsername(),
    x: Math.round(a.x * 10) / 10,
    y: Math.round(a.y * 10) / 10,
    facing: a.facing,
    hp: a.hp,
    tool: worldState.activeTool,
    swinging: a.swingUntil > now,
    updatedAt: now
  }, null);
}

function renderActorsLayer() {
  var layer = document.getElementById("actorsLayer");
  if (!layer) return;
  var sc = getScrollOffset();
  var wr = getWrapRect();
  var now = new Date().getTime();
  var act = {};

  var allActors = {};
  for (var k in worldState.actors) {
    if (worldState.actors.hasOwnProperty(k) && worldState.actors[k]) allActors[k] = worldState.actors[k];
  }
  if (worldState.actorEnabled) {
    allActors[myClientId] = {
      name: getDisplayUsername(),
      x: worldState.myActor.x,
      y: worldState.myActor.y,
      facing: worldState.myActor.facing,
      hp: worldState.myActor.hp,
      tool: worldState.activeTool,
      swinging: worldState.myActor.swingUntil > now,
      updatedAt: now
    };
  }

  for (var id in allActors) {
    if (!allActors.hasOwnProperty(id)) continue;
    var ac = allActors[id];
    if (!ac || !ac.updatedAt || (now - ac.updatedAt) > 8000) continue;
    act[id] = true;
    var sx = Math.round(wr.left + ((ac.x / 1000) * wr.width));
    var sy = Math.round(ac.y - sc.y);
    var node = worldState.actorNodes[id];
    if (!node) {
      node = document.createElement("div");
      node.className = "player-avatar-actor";
      node.innerHTML =
        '<div class="actor-hud">' +
          '<div class="actor-name-tag"></div>' +
          '<div class="actor-hp-bar"><div class="actor-hp-fill"></div></div>' +
        '</div>' +
        '<svg width="34" height="54" viewBox="0 0 34 54">' +
          '<circle cx="17" cy="10" r="7" fill="#FFE4C4" stroke="#800000" stroke-width="2"/>' +
          '<rect x="11" y="18" width="12" height="18" fill="#EEAA88" stroke="#800000" stroke-width="2"/>' +
          '<line x1="14" y1="36" x2="11" y2="52" stroke="#800000" stroke-width="3"/>' +
          '<line x1="20" y1="36" x2="23" y2="52" stroke="#800000" stroke-width="3"/>' +
          '<line x1="17" y1="23" x2="31" y2="21" stroke="#AF0A0F" stroke-width="3"/>' +
        '</svg>';
      layer.appendChild(node);
      worldState.actorNodes[id] = node;
    }
    var hud = node.firstChild;
    var nameEl = hud.childNodes[0];
    var hpFill = hud.childNodes[1].firstChild;
    var svgEl = node.childNodes[1];

    node.style.transform = "translate3d(" + sx + "px," + sy + "px,0)";
    svgEl.style.transform = (ac.facing < 0 ? "scaleX(-1)" : "scaleX(1)") + (ac.swinging ? " rotate(18deg)" : "");
    var label = (ac.name || "Player") + " [" + (ac.tool || "physgun") + "]";
    if (nameEl.textContent !== label) nameEl.textContent = label;
    hpFill.style.width = Math.max(0, Math.min(100, ac.hp || 100)) + "%";
  }

  for (var old in worldState.actorNodes) {
    if (worldState.actorNodes.hasOwnProperty(old) && !act[old]) {
      if (worldState.actorNodes[old].parentNode) worldState.actorNodes[old].parentNode.removeChild(worldState.actorNodes[old]);
      delete worldState.actorNodes[old];
    }
  }
}

/* ==========================================================================
   POINTER DRAG / THROW / TOOL EVENTS & REALTIME PHYSICS LOOP
   ========================================================================== */
function handlePointerMove(cx, cy) {
  var vp = getViewportSize();
  var now = new Date().getTime();
  worldState.lastMouseX = cx;
  worldState.lastMouseY = cy;
  updateLocalChatBox();
  syncCursor(false);

  if (worldState.grabbedSpriteId && worldState.sprites[worldState.grabbedSpriteId]) {
    var sp = worldState.sprites[worldState.grabbedSpriteId];
    var nx = Math.max(20, Math.min(980, (cx / vp.w) * 1000));
    var ny = Math.max(20, Math.min(980, (cy / vp.h) * 1000));
    worldState.throwVx = Math.max(-36, Math.min(36, (nx - sp.x) * 0.65));
    worldState.throwVy = Math.max(-36, Math.min(36, (ny - sp.y) * 0.65));
    sp.vAngle = Math.max(-25, Math.min(25, worldState.throwVx * 1.1));
    sp.angle = ((sp.angle || 0) + sp.vAngle * 0.4) % 360;
    sp.x = nx;
    sp.y = ny;
    sp.vx = 0;
    sp.vy = 0;
    sp.attachedFireworkId = "";
    sp.updatedAt = now;

    if (now - worldState.lastDragSyncTime > 130) {
      worldState.lastDragSyncTime = now;
      dbWrite("PUT", "realtime/sprites/" + sp.id, sp, null);
    }
  }
}

function handlePointerRelease() {
  if (!worldState.grabbedSpriteId) return;
  var sp = worldState.sprites[worldState.grabbedSpriteId];
  var mode = worldState.grabMode;
  worldState.grabbedSpriteId = null;
  worldState.grabMode = "";
  if (!sp) return;

  for (var fid in worldState.fireworks) {
    if (worldState.fireworks.hasOwnProperty(fid) && worldState.fireworks[fid] && !worldState.fireworks[fid].exploded) {
      var fw = worldState.fireworks[fid];
      if (Math.abs(sp.x - fw.x) < 75 && Math.abs(sp.y - fw.y) < 85) {
        sp.attachedFireworkId = fid;
        sp.x = fw.x;
        sp.y = fw.y - 18;
        sp.vx = 0;
        sp.vy = 0;
        sp.vAngle = 0;
        sp.updatedAt = new Date().getTime();
        dbWrite("PUT", "realtime/sprites/" + sp.id, sp, null);
        if (!fw.launched) {
          fw.launched = true;
          fw.launchAt = sp.updatedAt;
          fw.updatedAt = sp.updatedAt;
          dbWrite("PUT", "realtime/fireworks/" + fid, fw, null);
        }
        return;
      }
    }
  }

  var mult = (mode === "rmb" || mode === "touch") ? 1.15 : 0.55;
  sp.vx = (worldState.throwVx || (Math.random() - 0.5) * 16) * mult;
  sp.vy = (worldState.throwVy || -13) * mult;
  sp.vAngle = Math.max(-28, Math.min(28, sp.vx * 1.3));
  sp.updatedAt = new Date().getTime();
  dbWrite("PUT", "realtime/sprites/" + sp.id, sp, null);
}

function handleSpriteGrabStart(e, sid, isTouch) {
  var ev = e || window.event;
  if (ev.preventDefault) ev.preventDefault();
  if (ev.stopPropagation) ev.stopPropagation();
  var sp = worldState.sprites[sid];
  if (!sp) return;

  var cx = isTouch && ev.touches && ev.touches[0] ? ev.touches[0].clientX : ev.clientX;
  var cy = isTouch && ev.touches && ev.touches[0] ? ev.touches[0].clientY : ev.clientY;
  if (worldState.activeTool !== "physgun" && applyToolToProp(sp, cx, cy)) return;

  worldState.grabbedSpriteId = sid;
  worldState.grabMode = isTouch ? "touch" : (ev.button === 2 ? "rmb" : "lmb");
  worldState.throwVx = 0;
  worldState.throwVy = 0;
  sp.attachedFireworkId = "";
}

function initPlaygroundControls() {
  selectHl2Tool("physgun");
  var inp = document.getElementById("cursorChatInput");
  if (inp) {
    inp.oninput = function() {
      worldState.localChatText = String(inp.value || "").substring(0, 90);
      worldState.localChatExpiresAt = new Date().getTime() + 12000;
      syncCursor(true);
    };
    inp.onkeydown = function(e) {
      var ev = e || window.event, c = ev.keyCode || ev.which;
      if (ev.stopPropagation) ev.stopPropagation();
      if (c === 13) closeCursorChat(Boolean(worldState.localChatText));
      else if (c === 27) closeCursorChat(false);
    };
  }

  document.onkeydown = function(e) {
    var ev = e || window.event, c = ev.keyCode || ev.which;
    if (isTypingField()) { worldState.shiftDownClean = false; return true; }

    if (c === 16) { if (!ev.repeat) worldState.shiftDownClean = true; return true; }
    worldState.shiftDownClean = false;

    if (c === 191 && !ev.ctrlKey && !ev.altKey) { if (ev.preventDefault) ev.preventDefault(); openCursorChat(); return false; }
    if (c === 81) { togglePropMenu(); return false; }
    if (c === 82) { rotateHeldProp(); return false; }
    if (c === 49) selectHl2Tool("physgun");
    else if (c === 50) selectHl2Tool("gravgun");
    else if (c === 51) selectHl2Tool("crowbar");
    else if (c === 52) selectHl2Tool("pistol");
    else if (c === 53) selectHl2Tool("remover");

    if (c === 65 || c === 37) worldState.keys.left = true;
    else if (c === 68 || c === 39) worldState.keys.right = true;
    else if (c === 87 || c === 38 || c === 32) {
      if (worldState.actorEnabled) {
        if (ev.preventDefault) ev.preventDefault();
        worldState.keys.jump = true;
      }
    }
  };

  document.onkeyup = function(e) {
    var ev = e || window.event, c = ev.keyCode || ev.which;
    if (c === 16 && worldState.shiftDownClean && !isTypingField()) {
      worldState.shiftDownClean = false;
      openCursorChat();
    }
    if (c === 65 || c === 37) worldState.keys.left = false;
    else if (c === 68 || c === 39) worldState.keys.right = false;
    else if (c === 87 || c === 38 || c === 32) worldState.keys.jump = false;
  };

  dbWrite("DELETE", "realtime/cursors/" + myClientId, null, null);
  dbWrite("DELETE", "realtime/actors/" + myClientId, null, null);

  document.oncontextmenu = function(e) {
    var t = (e || window.event).target;
    if (worldState.grabbedSpriteId) return false;
    while (t) {
      if (t.className && String(t.className).indexOf("world-sprite") !== -1) return false;
      t = t.parentNode;
    }
    return true;
  };

  document.onmousedown = function(e) {
    var ev = e || window.event;
    if (ev.button === 0 && !isTypingField() && worldState.activeTool !== "physgun") {
      var t = ev.target;
      while (t) {
        if (t.tagName && /^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/i.test(t.tagName)) return;
        if (t.className && (String(t.className).indexOf("q-prop-modal") !== -1 || String(t.className).indexOf("mobile-dpad") !== -1)) return;
        t = t.parentNode;
      }
      useActiveHl2Tool(ev.clientX, ev.clientY);
    }
  };

  document.onmousemove = function(e) { var ev = e || window.event; handlePointerMove(ev.clientX, ev.clientY); };
  document.onmouseup = handlePointerRelease;

  if (document.addEventListener) {
    document.addEventListener("touchstart", function(e) {
      if (e.touches && e.touches[0]) {
        worldState.lastMouseX = e.touches[0].clientX;
        worldState.lastMouseY = e.touches[0].clientY;
        syncCursor(true);
      }
    }, false);
    document.addEventListener("touchmove", function(e) {
      if (e.touches && e.touches[0]) handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
    }, false);
    document.addEventListener("touchend", handlePointerRelease, false);
    window.addEventListener("scroll", function() { renderRemoteCursors(); renderActorsLayer(); }, false);
  }

  window.onbeforeunload = function() {
    dbWrite("DELETE", "realtime/cursors/" + myClientId, null, null);
    dbWrite("DELETE", "realtime/actors/" + myClientId, null, null);
  };

  setInterval(stepWorldPhysicsAndRender, 33);
  setInterval(syncRealtimeWorld, CONFIG.realtimeSyncMs);
}

function stepWorldPhysicsAndRender() {
  var now = new Date().getTime();
  var vp = getViewportSize();

  if (worldState.localChatText && worldState.localChatExpiresAt <= now && !worldState.cursorChatOpen) {
    worldState.localChatText = "";
    updateLocalChatBox();
  }

  stepMyActorPhysics();
  renderActorsLayer();

  for (var fid in worldState.fireworks) {
    if (!worldState.fireworks.hasOwnProperty(fid)) continue;
    var fw = worldState.fireworks[fid];
    if (!fw || worldState.explodedFireworks[fid] || fw.exploded) { delete worldState.fireworks[fid]; continue; }
    if (!fw.launched && now >= fw.launchAt) fw.launched = true;
    if (fw.launched) {
      fw.y -= 13;
      if (fw.y <= 115) {
        fw.exploded = true;
        worldState.explodedFireworks[fid] = now;
        var cols = ["#FF4500", "#FFA500", "#FFD700", "#FF1493", "#00BFFF", "#32CD32"];
        for (var i = 0; i < 40; i++) {
          var a = (Math.PI * 2 * i) / 40, spd = 2 + Math.random() * 6;
          worldState.particles.push({ x: (fw.x / 1000) * vp.w, y: 0.115 * vp.h, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, color: cols[i % cols.length], life: 36 });
        }
        for (var sid in worldState.sprites) {
          if (worldState.sprites.hasOwnProperty(sid) && worldState.sprites[sid] && worldState.sprites[sid].attachedFireworkId === fid) {
            var sp = worldState.sprites[sid];
            sp.attachedFireworkId = "";
            sp.vx = (Math.random() - 0.5) * 12;
            sp.vy = 2;
            sp.vAngle = (Math.random() - 0.5) * 20;
            sp.updatedAt = now;
            dbWrite("PUT", "realtime/sprites/" + sid, sp, null);
          }
        }
        dbWrite("DELETE", "realtime/fireworks/" + fid, null, null);
        delete worldState.fireworks[fid];
      }
    }
  }

  for (var id in worldState.sprites) {
    if (!worldState.sprites.hasOwnProperty(id)) continue;
    var s = worldState.sprites[id];
    if (!s || worldState.grabbedSpriteId === id) continue;
    if (s.attachedFireworkId && worldState.fireworks[s.attachedFireworkId]) {
      s.x = worldState.fireworks[s.attachedFireworkId].x;
      s.y = worldState.fireworks[s.attachedFireworkId].y - 18;
      continue;
    } else if (s.attachedFireworkId) {
      s.attachedFireworkId = "";
      s.vy = 2;
    }

    if (Math.abs(s.vx) > 0.05 || Math.abs(s.vy) > 0.05 || Math.abs(s.vAngle || 0) > 0.1 || s.y < 955) {
      s.vy += 0.45;
      s.vx *= 0.99;
      s.vy *= 0.99;
      s.x += s.vx;
      s.y += s.vy;
      s.angle = ((s.angle || 0) + (s.vAngle || 0)) % 360;
      s.vAngle = (s.vAngle || 0) * 0.97;

      if (s.x < 25) { s.x = 25; s.vx = Math.abs(s.vx) * 0.75; }
      else if (s.x > 975) { s.x = 975; s.vx = -Math.abs(s.vx) * 0.75; }
      if (s.y < 25) { s.y = 25; s.vy = Math.abs(s.vy) * 0.75; }
      else if (s.y > 955) {
        s.y = 955;
        s.vy = -Math.abs(s.vy) * 0.48;
        s.vx *= 0.85;
        s.vAngle *= 0.75;
        if (Math.abs(s.vy) < 1.2) s.vy = 0;
        if (Math.abs(s.vx) < 0.2) s.vx = 0;
        if (Math.abs(s.vAngle) < 0.3) s.vAngle = 0;
      }
    }
  }

  var fc = document.getElementById("fxCanvas");
  var hasActiveBeam = Boolean(worldState.grabbedSpriteId && worldState.sprites[worldState.grabbedSpriteId]);
  if (fc && fc.getContext && (worldState.particles.length || worldState.beams.length || hasActiveBeam || worldState.hadFx)) {
    if (fc.width !== vp.w || fc.height !== vp.h) { fc.width = vp.w; fc.height = vp.h; }
    var ctx = fc.getContext("2d");
    ctx.clearRect(0, 0, vp.w, vp.h);

    if (hasActiveBeam) {
      var held = worldState.sprites[worldState.grabbedSpriteId];
      ctx.strokeStyle = "#00BFFF";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(worldState.lastMouseX, worldState.lastMouseY);
      ctx.lineTo((held.x / 1000) * vp.w, (held.y / 1000) * vp.h);
      ctx.stroke();
    }

    for (var b = worldState.beams.length - 1; b >= 0; b--) {
      var bm = worldState.beams[b];
      ctx.strokeStyle = bm.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(bm.x1, bm.y1);
      ctx.lineTo(bm.x2, bm.y2);
      ctx.stroke();
      bm.life--;
      if (bm.life <= 0) worldState.beams.splice(b, 1);
    }

    for (var p = worldState.particles.length - 1; p >= 0; p--) {
      var pt = worldState.particles[p];
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.vy += 0.12;
      pt.life--;
      if (pt.life <= 0) worldState.particles.splice(p, 1);
      else {
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2, true);
        ctx.fill();
      }
    }
    worldState.hadFx = Boolean(worldState.particles.length || worldState.beams.length || hasActiveBeam);
  }

  var layer = document.getElementById("playgroundLayer");
  if (layer) {
    var h = "";
    for (var rId in worldState.fireworks) {
      if (worldState.fireworks.hasOwnProperty(rId) && worldState.fireworks[rId]) {
        var r = worldState.fireworks[rId];
        h += '<div class="world-firework" style="left:' + Math.round((r.x / 1000) * vp.w) + 'px;top:' + Math.round((r.y / 1000) * vp.h) + 'px;">' +
               '<div class="fw-fuse-label">' + (r.launched ? "FLY!" : (Math.max(0, Math.ceil((r.launchAt - now) / 1000)) + "s")) + '</div>' +
               '<div class="fw-rocket-body"></div>' +
             '</div>';
      }
    }
    for (var sId in worldState.sprites) {
      if (worldState.sprites.hasOwnProperty(sId) && worldState.sprites[sId] && isValidImageSrc(worldState.sprites[sId].url)) {
        var si = worldState.sprites[sId];
        var ang = Math.round(si.angle || 0);
        h += '<div class="world-sprite" style="left:' + Math.round((si.x / 1000) * vp.w) + 'px;top:' + Math.round((si.y / 1000) * vp.h) + 'px;transform:rotate(' + ang + 'deg);" onmousedown="handleSpriteGrabStart(event,\'' + esc(si.id) + '\',false)" ontouchstart="handleSpriteGrabStart(event,\'' + esc(si.id) + '\',true)">' +
               '<img src="' + esc(si.url) + '">' +
               '<div class="sprite-tag">' + esc(si.spawnedBy || "user") + '</div>' +
             '</div>';
      }
    }
    if (h !== worldState.lastPlaygroundHtml) {
      worldState.lastPlaygroundHtml = h;
      layer.innerHTML = h;
    }
  }
}

function syncRealtimeWorld() {
  var now = new Date().getTime();
  dbGet("realtime", function(e, rt) {
    if (e || !rt) return;

    for (var ex in worldState.explodedFireworks) {
      if (worldState.explodedFireworks.hasOwnProperty(ex) && (now - worldState.explodedFireworks[ex]) > 60000) {
        delete worldState.explodedFireworks[ex];
      }
    }

    var rSp = rt.sprites || {};
    for (var os in worldState.sprites) {
      if (worldState.sprites.hasOwnProperty(os) && !rSp[os] && os !== worldState.grabbedSpriteId) delete worldState.sprites[os];
    }
    for (var sid in rSp) {
      if (rSp.hasOwnProperty(sid) && rSp[sid] && sid !== worldState.grabbedSpriteId) {
        if (rSp[sid].updatedAt && (now - rSp[sid].updatedAt) > 900000) {
          dbWrite("DELETE", "realtime/sprites/" + sid, null, null);
          continue;
        }
        if (!worldState.sprites[sid] || (rSp[sid].updatedAt || 0) > (worldState.sprites[sid].updatedAt || 0)) {
          worldState.sprites[sid] = rSp[sid];
        }
      }
    }

    var rFw = rt.fireworks || {};
    for (var of in worldState.fireworks) {
      if (worldState.fireworks.hasOwnProperty(of) && !rFw[of]) delete worldState.fireworks[of];
    }
    for (var fid in rFw) {
      if (rFw.hasOwnProperty(fid) && rFw[fid]) {
        if (worldState.explodedFireworks[fid] || rFw[fid].exploded || (rFw[fid].updatedAt && (now - rFw[fid].updatedAt) > 20000)) {
          dbWrite("DELETE", "realtime/fireworks/" + fid, null, null);
          continue;
        }
        if (!worldState.fireworks[fid]) worldState.fireworks[fid] = rFw[fid];
        else if (rFw[fid].launched && !worldState.fireworks[fid].launched) {
          worldState.fireworks[fid].launched = true;
          worldState.fireworks[fid].launchAt = rFw[fid].launchAt || now;
        }
      }
    }

    var rAc = rt.actors || {};
    if (worldState.actorEnabled && rAc[myClientId] && typeof rAc[myClientId].hp === "number" && rAc[myClientId].hp < worldState.myActor.hp) {
      worldState.myActor.hp = rAc[myClientId].hp;
      worldState.myActor.vy = rAc[myClientId].vy || -9;
      worldState.myActor.vx = rAc[myClientId].vx || 0;
    }
    worldState.actors = rAc;
    worldState.cursors = rt.cursors || {};
    renderRemoteCursors();
    renderActorsLayer();
  });
}
