/* ==========================================================================
   FEMBOORU REALTIME WORLD: CURSORS & CURSOR CHAT, THROWABLE SPRITES,
   FIREWORKS, GMOD PROP MENU & HL2 TOOLS, WALKABLE USER MODEL & WPLACE MAP
   ========================================================================== */
var PROP_SOURCES = [
  "https://cataas.com/cat?width=120&height=120&r=",
  "https://picsum.photos/seed/fb",
  "https://robohash.org/fembooru_",
  "https://api.dicebear.com/9.x/pixel-art/svg?seed=fb_"
];

function buildPropCatalog() {
  var list = [];
  var seedBase = Math.floor(Math.random() * 9000) + 100;
  for (var i = 0; i < 12; i++) {
    var s = seedBase + i;
    var mod = i % 4;
    var url = "";
    var label = "Prop #" + (i + 1);
    if (mod === 0) {
      url = "https://picsum.photos/seed/fb" + s + "/110/110";
      label = "Photo #" + s;
    } else if (mod === 1) {
      url = "https://robohash.org/fb_" + s + ".png?size=110x110";
      label = "Bot #" + s;
    } else if (mod === 2) {
      url = "https://api.dicebear.com/9.x/bottts/svg?seed=fb" + s;
      label = "Droid #" + s;
    } else {
      url = "https://cataas.com/cat?width=110&height=110&t=" + s;
      label = "Cat #" + s;
    }
    list.push({ name: label, url: url });
  }
  for (var stId in state.stickers) {
    if (state.stickers.hasOwnProperty(stId) && state.stickers[stId] && isValidImageSrc(state.stickers[stId].url)) {
      list.push({ name: state.stickers[stId].name || "Sticker", url: state.stickers[stId].url });
      if (list.length >= 20) break;
    }
  }
  worldState.propCatalog = list;
}

function togglePropMenu(forceState) {
  worldState.propMenuOpen = (typeof forceState === "boolean") ? forceState : !worldState.propMenuOpen;
  var modal = document.getElementById("propMenuModal");
  if (!modal) return;
  if (worldState.propMenuOpen) {
    if (!worldState.propCatalog.length) buildPropCatalog();
    renderPropMenuGrid();
    modal.style.display = "block";
  } else {
    modal.style.display = "none";
  }
}

function refreshPropCatalog() {
  buildPropCatalog();
  renderPropMenuGrid();
}

function renderPropMenuGrid() {
  var grid = document.getElementById("propMenuGrid");
  if (!grid) return;
  var h = "";
  for (var i = 0; i < worldState.propCatalog.length; i++) {
    var p = worldState.propCatalog[i];
    h += "<div class='prop-card' onclick=\"spawnSpriteFromUrl('" + esc(p.url) + "')\">" +
           "<img src='" + esc(p.url) + "' alt='prop' onerror=\"this.src='" + DEFAULT_SPRITE_ICON + "'\">" +
           "<span>" + esc(p.name) + "</span>" +
         "</div>";
  }
  grid.innerHTML = h;
}

function selectSandboxTool(toolName) {
  worldState.activeTool = toolName;
  var btns = document.querySelectorAll(".tool-btn");
  for (var i = 0; i < btns.length; i++) {
    var t = btns[i].getAttribute("data-tool");
    btns[i].className = "tool-btn" + (t === toolName ? " active-tool" : "");
  }
  showStatus("Tool equipped: " + toolName.toUpperCase(), false);
}

/* ==========================================================================
   SPRITES & FIREWORKS (SPAWN, RMB THROW, PHYSGUN DRAG/ROTATE, FIREWORK LAUNCH)
   ========================================================================== */
function spawnSpriteFromUrl(url) {
  var clean = safeUrl(url);
  if (!clean) { showStatus("Invalid image URL.", true); return; }
  var sid = generateId("sp");
  var scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
  var x = Math.round((window.innerWidth || 900) * 0.45 + (Math.random() * 140 - 70));
  var y = Math.round(scrollY + 180 + (Math.random() * 80 - 40));
  var sp = {
    id: sid,
    url: clean,
    x: x,
    y: y,
    vx: (Math.random() - 0.5) * 4,
    vy: -2,
    rot: 0,
    vrot: 0,
    frozen: false,
    owner: getDisplayUsername(),
    updatedAt: new Date().getTime()
  };
  worldState.sprites[sid] = sp;
  dbWrite("PUT", "realtime/sprites/" + sid, sp, null);
}

function spawnSpriteFromFile() {
  var fEl = document.getElementById("spriteUploadInput");
  var uEl = document.getElementById("spriteUrlInput");
  var direct = uEl ? safeUrl(uEl.value) : "";
  if (fEl && fEl.files && fEl.files[0]) {
    uploadImageToImgbb(fEl, function(err, url) {
      if (!err && url) {
        fEl.value = "";
        spawnSpriteFromUrl(url);
      } else {
        showStatus(err || "Sprite upload failed", true);
      }
    });
  } else if (direct) {
    uEl.value = "";
    spawnSpriteFromUrl(direct);
  } else {
    spawnSpriteFromUrl(DEFAULT_SPRITE_ICON);
  }
}

function spawnFirework() {
  var fid = generateId("fw");
  var scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
  var x = Math.round((window.innerWidth || 900) * 0.5 + (Math.random() * 240 - 120));
  var y = Math.round(scrollY + Math.min(520, (window.innerHeight || 650) - 90));
  var fw = {
    id: fid,
    x: x,
    y: y,
    vy: -7.5,
    fuseAt: new Date().getTime() + 2600,
    attachedSpriteId: "",
    owner: getDisplayUsername(),
    updatedAt: new Date().getTime()
  };
  worldState.fireworks[fid] = fw;
  dbWrite("PUT", "realtime/fireworks/" + fid, fw, null);
  showStatus("Firework spawned! Drag any sprite onto it!", false);
}

function clearAllWorldProps() {
  worldState.sprites = {};
  worldState.fireworks = {};
  dbWrite("DELETE", "realtime/sprites", null, null);
  dbWrite("DELETE", "realtime/fireworks", null, null);
  renderPlaygroundDom();
}

function addExplosionParticles(x, y) {
  var colors = ["#FF3300", "#FFAA00", "#00CCFF", "#66FF33", "#FF33CC", "#FFFFFF"];
  for (var i = 0; i < 28; i++) {
    var ang = (Math.PI * 2 * i) / 28 + Math.random() * 0.2;
    var spd = 2 + Math.random() * 6;
    worldState.particles.push({
      x: x,
      y: y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      color: colors[i % colors.length],
      life: 32
    });
  }
}

function onSpriteMouseDown(e, sid) {
  e = e || window.event;
  if (e.preventDefault) e.preventDefault();
  if (e.stopPropagation) e.stopPropagation();
  var sp = worldState.sprites[sid];
  if (!sp) return;

  var btn = e.button;
  if (btn === 2 || worldState.activeTool === "physgun" || worldState.activeTool === "gravgun") {
    if (worldState.activeTool === "gravgun" && btn === 0) {
      // Punt sprite away
      sp.frozen = false;
      sp.vx = (sp.x - worldState.lastMouseX) * 0.35 || 14;
      sp.vy = -12;
      sp.vrot = (Math.random() - 0.5) * 18;
      worldState.beams.push({ x1: worldState.lastMouseX, y1: worldState.lastMouseY, x2: sp.x, y2: sp.y, color: "#FF8800", life: 8 });
      dbWrite("PUT", "realtime/sprites/" + sid, sp, null);
      return;
    }
    worldState.grabbedSpriteId = sid;
    worldState.grabMode = (btn === 2) ? "rmb_throw" : "physgun";
    sp.frozen = false;
    worldState.throwVx = 0;
    worldState.throwVy = 0;
  } else if (worldState.activeTool === "remover") {
    delete worldState.sprites[sid];
    dbWrite("DELETE", "realtime/sprites/" + sid, null, null);
  } else if (worldState.activeTool === "thruster") {
    sp.frozen = false;
    sp.vy = -16;
    sp.vrot += 15;
    dbWrite("PUT", "realtime/sprites/" + sid, sp, null);
  } else if (worldState.activeTool === "crowbar") {
    sp.frozen = false;
    sp.vx += (Math.random() > 0.5 ? 12 : -12);
    sp.vy = -10;
    sp.vrot += 14;
    dbWrite("PUT", "realtime/sprites/" + sid, sp, null);
  }
}

function releaseGrabbedSprite() {
  var sid = worldState.grabbedSpriteId;
  if (!sid) return;
  var sp = worldState.sprites[sid];
  worldState.grabbedSpriteId = null;
  worldState.grabMode = "";
  if (!sp) return;

  sp.vx = Math.max(-28, Math.min(28, worldState.throwVx));
  sp.vy = Math.max(-28, Math.min(28, worldState.throwVy));
  sp.vrot = sp.vx * 0.6;
  sp.updatedAt = new Date().getTime();

  // Check if dropped onto a firework
  for (var fid in worldState.fireworks) {
    if (!worldState.fireworks.hasOwnProperty(fid) || !worldState.fireworks[fid]) continue;
    var fw = worldState.fireworks[fid];
    if (Math.abs(fw.x - sp.x) < 65 && Math.abs(fw.y - sp.y) < 65) {
      fw.attachedSpriteId = sid;
      fw.fuseAt = new Date().getTime() + 2200;
      dbWrite("PUT", "realtime/fireworks/" + fid, fw, null);
      showStatus("Sprite attached to firework!", false);
      break;
    }
  }
  dbWrite("PUT", "realtime/sprites/" + sid, sp, null);
}

/* ==========================================================================
   WALKABLE USER MODEL (WASD / ARROWS + BLOCK/BUTTON/CURSOR COLLISION)
   ========================================================================== */
function togglePlayerActor() {
  worldState.actorEnabled = !worldState.actorEnabled;
  var btn = document.getElementById("toggleActorBtn");
  if (btn) btn.textContent = worldState.actorEnabled ? "Disable Model" : "Spawn Model (WASD)";
  if (worldState.actorEnabled) {
    var scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
    worldState.myActor.x = Math.round((window.innerWidth || 900) * 0.5);
    worldState.myActor.y = scrollY + 140;
    worldState.myActor.vx = 0;
    worldState.myActor.vy = 0;
    worldState.myActor.hp = 100;
    syncMyActor(true);
  } else {
    delete worldState.actors[myClientId];
    dbWrite("DELETE", "realtime/actors/" + myClientId, null, null);
    renderActorsDom();
  }
}

function setActorKey(dir, isDown) {
  if (dir === "left") worldState.keys.left = isDown;
  if (dir === "right") worldState.keys.right = isDown;
  if (dir === "jump") worldState.keys.jump = isDown;
}

function triggerActorAttack() {
  if (!worldState.actorEnabled) return;
  var me = worldState.myActor;
  me.swingUntil = new Date().getTime() + 300;
  // Kick nearby sprites
  for (var sid in worldState.sprites) {
    if (!worldState.sprites.hasOwnProperty(sid) || !worldState.sprites[sid]) continue;
    var sp = worldState.sprites[sid];
    if (Math.abs(sp.x - me.x) < 75 && Math.abs(sp.y - me.y) < 75) {
      sp.frozen = false;
      sp.vx = me.facing * 16;
      sp.vy = -11;
      sp.vrot = me.facing * 15;
      dbWrite("PUT", "realtime/sprites/" + sid, sp, null);
    }
  }
  // Fight other player models in melee range
  for (var cid in worldState.actors) {
    if (!worldState.actors.hasOwnProperty(cid) || cid === myClientId || !worldState.actors[cid]) continue;
    var other = worldState.actors[cid];
    if (Math.abs(other.x - me.x) < 65 && Math.abs(other.y - me.y) < 65) {
      var dmg = (worldState.activeTool === "crowbar") ? 25 : 15;
      var newHp = Math.max(0, (other.hp || 100) - dmg);
      dbWrite("PATCH", "realtime/actors/" + cid, {
        hp: newHp,
        vx: me.facing * 14,
        vy: -9
      }, null);
      addExplosionParticles(other.x, other.y - 20);
    }
  }
  syncMyActor(true);
}

var cachedPlatforms = [];
var lastPlatformScan = 0;
function getSolidPlatforms() {
  var now = new Date().getTime();
  if (now - lastPlatformScan < 800 && cachedPlatforms.length) return cachedPlatforms;
  lastPlatformScan = now;
  var rects = [];
  var scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
  var scrollX = window.pageXOffset || document.documentElement.scrollLeft || 0;
  var els = document.querySelectorAll(".thread-item, .box-panel, .wall-post-card, .nav-bar, button");
  for (var i = 0; i < els.length; i++) {
    var r = els[i].getBoundingClientRect();
    if (r.width > 24 && r.height > 12 && r.bottom > 0) {
      rects.push({
        left: r.left + scrollX,
        right: r.right + scrollX,
        top: r.top + scrollY
      });
    }
  }
  // Also allow jumping on other users' live cursors!
  for (var cid in worldState.cursors) {
    if (worldState.cursors.hasOwnProperty(cid) && cid !== myClientId && worldState.cursors[cid]) {
      var c = worldState.cursors[cid];
      var cx = resolveCursorPageX(c);
      rects.push({ left: cx - 18, right: cx + 26, top: c.docY });
    }
  }
  cachedPlatforms = rects;
  return rects;
}

function stepPhysicsLoop() {
  var now = new Date().getTime();
  var dt = 1;
  var maxW = (window.innerWidth || 1000) - 36;
  var docH = Math.max(document.documentElement.scrollHeight || 900, window.innerHeight || 700);
  var dirtySprites = false;

  // 1. Update sprites physics
  for (var sid in worldState.sprites) {
    if (!worldState.sprites.hasOwnProperty(sid) || !worldState.sprites[sid]) continue;
    var sp = worldState.sprites[sid];
    if (worldState.grabbedSpriteId === sid) {
      var nx = worldState.lastMouseX;
      var ny = worldState.lastMouseY;
      worldState.throwVx = (nx - sp.x) * 0.65;
      worldState.throwVy = (ny - sp.y) * 0.65;
      sp.x = nx;
      sp.y = ny;
      sp.rot = (sp.rot || 0) + (worldState.throwVx * 0.4);
      dirtySprites = true;
      continue;
    }
    if (sp.frozen) continue;

    sp.vy = (sp.vy || 0) + 0.42 * dt;
    sp.x = (sp.x || 100) + (sp.vx || 0) * dt;
    sp.y = (sp.y || 100) + sp.vy * dt;
    sp.rot = (sp.rot || 0) + (sp.vrot || 0) * dt;
    sp.vx *= 0.985;
    sp.vrot *= 0.97;

    if (sp.x < 10) { sp.x = 10; sp.vx = Math.abs(sp.vx) * 0.7; }
    if (sp.x > maxW - 30) { sp.x = maxW - 30; sp.vx = -Math.abs(sp.vx) * 0.7; }
    if (sp.y > docH - 60) {
      sp.y = docH - 60;
      sp.vy = -Math.abs(sp.vy) * 0.55;
      sp.vx *= 0.85;
      if (Math.abs(sp.vy) < 1) { sp.vy = 0; sp.vrot = 0; }
    }
    dirtySprites = true;
  }

  // 2. Update fireworks
  for (var fid in worldState.fireworks) {
    if (!worldState.fireworks.hasOwnProperty(fid) || !worldState.fireworks[fid]) continue;
    var fw = worldState.fireworks[fid];
    fw.y += (fw.vy || -7);
    if (fw.attachedSpriteId && worldState.sprites[fw.attachedSpriteId]) {
      var att = worldState.sprites[fw.attachedSpriteId];
      att.x = fw.x;
      att.y = fw.y - 24;
      att.vx = 0;
      att.vy = 0;
      dirtySprites = true;
    }
    if (now >= (fw.fuseAt || 0) || fw.y < 40) {
      if (!worldState.explodedFireworks[fid]) {
        worldState.explodedFireworks[fid] = true;
        addExplosionParticles(fw.x, fw.y);
        if (fw.attachedSpriteId && worldState.sprites[fw.attachedSpriteId]) {
          var rel = worldState.sprites[fw.attachedSpriteId];
          rel.frozen = false;
          rel.vx = (Math.random() - 0.5) * 14;
          rel.vy = -8;
          rel.vrot = (Math.random() - 0.5) * 20;
          dbWrite("PUT", "realtime/sprites/" + rel.id, rel, null);
        }
        delete worldState.fireworks[fid];
        dbWrite("DELETE", "realtime/fireworks/" + fid, null, null);
      }
    }
    dirtySprites = true;
  }

  // 3. Update walkable player model
  if (worldState.actorEnabled) {
    var me = worldState.myActor;
    var prevY = me.y;
    if (worldState.keys.left) { me.vx = -5.2; me.facing = -1; }
    else if (worldState.keys.right) { me.vx = 5.2; me.facing = 1; }
    else { me.vx *= 0.78; }

    if (worldState.keys.jump && me.grounded) {
      me.vy = -11.5;
      me.grounded = false;
    }
    me.vy += 0.55;
    me.x += me.vx;
    me.y += me.vy;
    me.grounded = false;

    if (me.x < 10) me.x = 10;
    if (me.x > maxW) me.x = maxW;

    var plats = getSolidPlatforms();
    for (var p = 0; p < plats.length; p++) {
      var pl = plats[p];
      if (me.x + 22 > pl.left && me.x + 4 < pl.right) {
        if (me.vy >= 0 && prevY + 42 <= pl.top + 8 && me.y + 42 >= pl.top) {
          me.y = pl.top - 42;
          me.vy = 0;
          me.grounded = true;
        }
      }
    }
    if (me.y > docH - 48) {
      me.y = docH - 48;
      me.vy = 0;
      me.grounded = true;
    }

    // Kick sprites when walking into them
    for (var sKey in worldState.sprites) {
      if (worldState.sprites.hasOwnProperty(sKey) && worldState.sprites[sKey]) {
        var spr = worldState.sprites[sKey];
        if (Math.abs(spr.x - me.x) < 38 && Math.abs(spr.y - (me.y + 20)) < 38 && Math.abs(me.vx) > 1.2) {
          spr.frozen = false;
          spr.vx = me.vx * 2.2;
          spr.vy = -5.5;
          spr.vrot = me.vx * 2;
        }
      }
    }

    if (me.hp <= 0) {
      me.hp = 100;
      me.y = (window.pageYOffset || 0) + 120;
    }
    worldState.actors[myClientId] = {
      id: myClientId,
      name: getDisplayUsername(),
      avatar: (state.profile && state.profile.avatar) || DEFAULT_AVATAR_SVG,
      x: Math.round(me.x),
      y: Math.round(me.y),
      facing: me.facing,
      hp: me.hp,
      tool: worldState.activeTool,
      swingUntil: me.swingUntil,
      updatedAt: now
    };
    syncMyActor(false);
    renderActorsDom();
  }

  if (dirtySprites) renderPlaygroundDom();
  renderFxCanvas();
}

function renderFxCanvas() {
  var canvas = document.getElementById("fxCanvas");
  if (!canvas || !canvas.getContext) return;
  var hasBeams = worldState.grabbedSpriteId && worldState.grabMode === "physgun" && worldState.sprites[worldState.grabbedSpriteId];
  if (!worldState.particles.length && !worldState.beams.length && !hasBeams) {
    if (worldState.hadFx) {
      var clr = canvas.getContext("2d");
      clr.clearRect(0, 0, canvas.width, canvas.height);
      worldState.hadFx = false;
    }
    return;
  }
  worldState.hadFx = true;
  var w = window.innerWidth || 1000;
  var h = window.innerHeight || 700;
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  var ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, w, h);
  var scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;

  // Physgun beam
  if (hasBeams) {
    var target = worldState.sprites[worldState.grabbedSpriteId];
    ctx.strokeStyle = "#00BFFF";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(worldState.lastMouseX, worldState.lastMouseY - scrollY);
    ctx.lineTo(target.x + 28, target.y + 28 - scrollY);
    ctx.stroke();
  }

  for (var b = worldState.beams.length - 1; b >= 0; b--) {
    var bm = worldState.beams[b];
    ctx.strokeStyle = bm.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(bm.x1, bm.y1 - scrollY);
    ctx.lineTo(bm.x2 + 24, bm.y2 + 24 - scrollY);
    ctx.stroke();
    bm.life--;
    if (bm.life <= 0) worldState.beams.splice(b, 1);
  }

  for (var i = worldState.particles.length - 1; i >= 0; i--) {
    var pt = worldState.particles[i];
    pt.x += pt.vx;
    pt.y += pt.vy;
    pt.vy += 0.18;
    pt.life--;
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x, pt.y - scrollY, 4, 4);
    if (pt.life <= 0) worldState.particles.splice(i, 1);
  }
}

function renderPlaygroundDom() {
  var layer = document.getElementById("playgroundLayer");
  if (!layer) return;
  var h = "";
  for (var sid in worldState.sprites) {
    if (!worldState.sprites.hasOwnProperty(sid) || !worldState.sprites[sid]) continue;
    var sp = worldState.sprites[sid];
    if (!isValidImageSrc(sp.url)) continue;
    var rot = Math.round(sp.rot || 0);
    h += "<img class='world-sprite' src='" + esc(sp.url) + "' style='left:" + Math.round(sp.x) + "px;top:" + Math.round(sp.y) + "px;transform:rotate(" + rot + "deg);' onmousedown=\"onSpriteMouseDown(event,'" + esc(sid) + "')\" oncontextmenu='return false;'>";
  }
  for (var fid in worldState.fireworks) {
    if (!worldState.fireworks.hasOwnProperty(fid) || !worldState.fireworks[fid]) continue;
    var fw = worldState.fireworks[fid];
    h += "<div class='world-firework' style='left:" + Math.round(fw.x) + "px;top:" + Math.round(fw.y) + "px;'>FW</div>";
  }
  if (h !== worldState.lastPlaygroundHtml) {
    worldState.lastPlaygroundHtml = h;
    layer.innerHTML = h;
  }
}

function renderActorsDom() {
  var layer = document.getElementById("actorsLayer");
  if (!layer) return;
  var now = new Date().getTime();
  var active = {};
  for (var cid in worldState.actors) {
    if (!worldState.actors.hasOwnProperty(cid) || !worldState.actors[cid]) continue;
    var a = worldState.actors[cid];
    if (now - (a.updatedAt || 0) > 10000) continue;
    active[cid] = true;
    var node = worldState.actorNodes[cid];
    if (!node) {
      node = document.createElement("div");
      node.className = "player-actor";
      node.innerHTML = "<div class='actor-tag'></div><img class='actor-head' src='" + DEFAULT_AVATAR_SVG + "'><div class='actor-body'></div><div class='actor-weapon'></div>";
      layer.appendChild(node);
      worldState.actorNodes[cid] = node;
    }
    node.style.left = Math.round(a.x) + "px";
    node.style.top = Math.round(a.y) + "px";
    node.querySelector(".actor-tag").textContent = (a.name || "User") + " [" + (a.hp != null ? a.hp : 100) + "HP]";
    var head = node.querySelector(".actor-head");
    if (isValidImageSrc(a.avatar) && head.src !== a.avatar) head.src = a.avatar;
    var wpn = node.querySelector(".actor-weapon");
    var swinging = (a.swingUntil && a.swingUntil > now);
    wpn.style.transform = (a.facing < 0 ? "scaleX(-1) " : "") + (swinging ? "rotate(65deg)" : "rotate(0deg)");
  }
  for (var oldId in worldState.actorNodes) {
    if (worldState.actorNodes.hasOwnProperty(oldId) && !active[oldId]) {
      if (worldState.actorNodes[oldId].parentNode) worldState.actorNodes[oldId].parentNode.removeChild(worldState.actorNodes[oldId]);
      delete worldState.actorNodes[oldId];
    }
  }
}

/* ==========================================================================
   OPTIMIZED REALTIME CURSORS, TOUCH SUPPORT & LIVE CURSOR CHAT (Shift or /)
   ========================================================================== */
function computePageRelativeCoords(clientX, clientY) {
  var scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
  var centerCol = document.querySelector(".center-column");
  var relX = 500;
  if (centerCol) {
    var rect = centerCol.getBoundingClientRect();
    relX = Math.round(((clientX - rect.left) / Math.max(1, rect.width)) * 1000);
  } else {
    relX = Math.round((clientX / Math.max(1, window.innerWidth || 1000)) * 1000);
  }
  return {
    relX: Math.max(-500, Math.min(1500, relX)),
    docY: Math.max(0, Math.round(clientY + scrollY))
  };
}

function resolveCursorPageX(cur) {
  var centerCol = document.querySelector(".center-column");
  if (centerCol) {
    var rect = centerCol.getBoundingClientRect();
    var scrollX = window.pageXOffset || document.documentElement.scrollLeft || 0;
    return Math.round(rect.left + scrollX + ((cur.relX / 1000) * rect.width));
  }
  return Math.round((cur.relX / 1000) * (window.innerWidth || 1000));
}

function handlePointerMove(clientX, clientY) {
  var scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
  var scrollX = window.pageXOffset || document.documentElement.scrollLeft || 0;
  worldState.lastMouseX = clientX + scrollX;
  worldState.lastMouseY = clientY + scrollY;

  var coords = computePageRelativeCoords(clientX, clientY);
  worldState.lastCursorRelX = coords.relX;
  worldState.lastCursorDocY = coords.docY;

  var now = new Date().getTime();
  if (now - worldState.lastCursorSendTime > 180) {
    worldState.lastCursorSendTime = now;
    pushMyCursorState();
  }
}

function pushMyCursorState() {
  if (worldState.lastCursorRelX < 0 && worldState.lastCursorDocY < 0) return;
  var now = new Date().getTime();
  var chatStr = (worldState.localChatExpiresAt > now) ? worldState.localChatText : "";
  var payload = {
    id: myClientId,
    name: getDisplayUsername(),
    relX: worldState.lastCursorRelX,
    docY: worldState.lastCursorDocY,
    chat: chatStr,
    updatedAt: now
  };
  dbWrite("PUT", "realtime/cursors/" + myClientId, payload, null);
}

function renderCursorsDom() {
  var layer = document.getElementById("cursorsLayer");
  if (!layer) return;
  var now = new Date().getTime();
  var active = {};

  for (var cid in worldState.cursors) {
    if (!worldState.cursors.hasOwnProperty(cid) || !worldState.cursors[cid]) continue;
    // Never show user's own cursor (prevents self-cursor ghost bug on page refresh)
    if (cid === myClientId) continue;
    var cur = worldState.cursors[cid];
    if (now - (cur.updatedAt || 0) > 12000) continue;
    active[cid] = true;

    var node = worldState.cursorNodes[cid];
    if (!node) {
      node = document.createElement("div");
      node.className = "remote-cursor";
      node.innerHTML = "<div class='cursor-chat-bubble' style='display:none;'></div><div class='cursor-name-tag'></div><div class='cursor-arrow'></div>";
      layer.appendChild(node);
      worldState.cursorNodes[cid] = node;
    }
    var px = resolveCursorPageX(cur);
    node.style.left = px + "px";
    node.style.top = Math.round(cur.docY || 0) + "px";
    node.querySelector(".cursor-name-tag").textContent = cur.name || "Anon";

    var bubble = node.querySelector(".cursor-chat-bubble");
    if (cur.chat) {
      bubble.style.display = "block";
      bubble.textContent = cur.chat;
    } else {
      bubble.style.display = "none";
    }
  }

  for (var oldId in worldState.cursorNodes) {
    if (worldState.cursorNodes.hasOwnProperty(oldId) && !active[oldId]) {
      if (worldState.cursorNodes[oldId].parentNode) worldState.cursorNodes[oldId].parentNode.removeChild(worldState.cursorNodes[oldId]);
      delete worldState.cursorNodes[oldId];
    }
  }
}

function openCursorChatBar() {
  var bar = document.getElementById("cursorChatBar");
  var inp = document.getElementById("cursorChatInput");
  if (!bar || !inp) return;
  worldState.cursorChatOpen = true;
  bar.style.display = "flex";
  inp.value = (worldState.localChatExpiresAt > new Date().getTime()) ? worldState.localChatText : "";
  inp.focus();
}

function closeCursorChatBar() {
  var bar = document.getElementById("cursorChatBar");
  if (bar) bar.style.display = "none";
  worldState.cursorChatOpen = false;
}

function onCursorChatTyping(val) {
  worldState.localChatText = String(val || "").substring(0, 80);
  worldState.localChatExpiresAt = new Date().getTime() + 7000;
  pushMyCursorState();
}

function syncMyActor(force) {
  var now = new Date().getTime();
  if (!force && now - worldState.lastActorSendTime < 220) return;
  worldState.lastActorSendTime = now;
  if (worldState.actors[myClientId]) {
    dbWrite("PUT", "realtime/actors/" + myClientId, worldState.actors[myClientId], null);
  }
}

function syncRealtimeWorld() {
  dbGet("realtime", function(err, data) {
    if (err || !data) return;
    if (data.cursors) {
      // Remove any stale node of our own clientId if present
      delete data.cursors[myClientId];
      worldState.cursors = data.cursors;
      renderCursorsDom();
    }
    if (data.sprites && !worldState.grabbedSpriteId) {
      worldState.sprites = data.sprites;
      renderPlaygroundDom();
    }
    if (data.fireworks) {
      worldState.fireworks = data.fireworks;
    }
    if (data.actors) {
      var myLocal = worldState.actorEnabled ? worldState.actors[myClientId] : null;
      worldState.actors = data.actors;
      if (myLocal) worldState.actors[myClientId] = myLocal;
      else delete worldState.actors[myClientId];
      renderActorsDom();
    }
  });
}

/* ==========================================================================
   PUBLIC WPLACE / GEOPIXELS MAP (OPENSTREETMAP + GEO-COORDINATE PIXELS)
   ========================================================================== */
var osmTileCache = {};

function initWplaceControls() {
  var pal = document.getElementById("wplacePalette");
  var colors = ["#800000", "#FF6600", "#FFD700", "#008000", "#0066CC", "#6600CC", "#FF3399", "#111111", "#FFFFFF", "#8B4513", "#00CCCC", "#99CC00"];
  if (pal) {
    var h = "";
    for (var i = 0; i < colors.length; i++) {
      h += "<span class='color-swatch" + (i === 0 ? " active-swatch" : "") + "' style='background:" + colors[i] + ";' onclick=\"pickWplaceColor('" + colors[i] + "', this)\"></span>";
    }
    pal.innerHTML = h;
  }

  var canvas = document.getElementById("wplaceCanvas");
  if (!canvas) return;

  function canvasClientToGeo(clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    var px = clientX - rect.left;
    var py = clientY - rect.top;
    var cellSize = Math.max(4, wplaceState.zoom);
    var gx = Math.floor((px - canvas.width / 2) / cellSize) + wplaceState.offsetX;
    var gy = Math.floor((py - canvas.height / 2) / cellSize) + wplaceState.offsetY;
    var lat = (-gy / 20).toFixed(4);
    var lon = (gx / 20).toFixed(4);
    return { gx: gx, gy: gy, lat: lat, lon: lon, key: gx + "_" + gy };
  }

  canvas.onmousedown = function(e) {
    e = e || window.event;
    if (wplaceState.panMode || e.button === 2 || e.button === 1) {
      wplaceState.isDrawing = false;
      wplaceState.panStartX = e.clientX;
      wplaceState.panStartY = e.clientY;
      canvas.setAttribute("data-panning", "1");
      return;
    }
    wplaceState.isDrawing = true;
    var g = canvasClientToGeo(e.clientX, e.clientY);
    paintGeoPixel(g.gx, g.gy, g.lat, g.lon, wplaceState.selectedColor);
  };

  canvas.onmousemove = function(e) {
    e = e || window.event;
    var g = canvasClientToGeo(e.clientX, e.clientY);
    var lbl = document.getElementById("wplaceCoords");
    if (lbl) lbl.textContent = "Lat: " + g.lat + ", Lon: " + g.lon + " • Zoom: " + wplaceState.zoom;

    if (canvas.getAttribute("data-panning") === "1") {
      var cell = Math.max(4, wplaceState.zoom);
      var dx = Math.round((e.clientX - wplaceState.panStartX) / cell);
      var dy = Math.round((e.clientY - wplaceState.panStartY) / cell);
      if (dx !== 0 || dy !== 0) {
        wplaceState.offsetX -= dx;
        wplaceState.offsetY -= dy;
        wplaceState.panStartX = e.clientX;
        wplaceState.panStartY = e.clientY;
        renderWplaceCanvas();
      }
      return;
    }
    if (wplaceState.isDrawing && wplaceState.lastDrawnKey !== g.key) {
      wplaceState.lastDrawnKey = g.key;
      paintGeoPixel(g.gx, g.gy, g.lat, g.lon, wplaceState.selectedColor);
    }
  };

  canvas.onmouseup = function() {
    wplaceState.isDrawing = false;
    wplaceState.lastDrawnKey = "";
    canvas.removeAttribute("data-panning");
  };
  canvas.onmouseleave = canvas.onmouseup;
  canvas.oncontextmenu = function() { return false; };

  // Touch support for wPlace canvas
  canvas.addEventListener("touchstart", function(e) {
    if (!e.touches || !e.touches[0]) return;
    e.preventDefault();
    var t = e.touches[0];
    if (wplaceState.panMode) {
      wplaceState.panStartX = t.clientX;
      wplaceState.panStartY = t.clientY;
      canvas.setAttribute("data-panning", "1");
    } else {
      var g = canvasClientToGeo(t.clientX, t.clientY);
      paintGeoPixel(g.gx, g.gy, g.lat, g.lon, wplaceState.selectedColor);
    }
  }, { passive: false });

  canvas.addEventListener("touchmove", function(e) {
    if (!e.touches || !e.touches[0]) return;
    e.preventDefault();
    var t = e.touches[0];
    if (canvas.getAttribute("data-panning") === "1") {
      var cell = Math.max(4, wplaceState.zoom);
      var dx = Math.round((t.clientX - wplaceState.panStartX) / cell);
      var dy = Math.round((t.clientY - wplaceState.panStartY) / cell);
      if (dx !== 0 || dy !== 0) {
        wplaceState.offsetX -= dx;
        wplaceState.offsetY -= dy;
        wplaceState.panStartX = t.clientX;
        wplaceState.panStartY = t.clientY;
        renderWplaceCanvas();
      }
    } else {
      var g = canvasClientToGeo(t.clientX, t.clientY);
      if (wplaceState.lastDrawnKey !== g.key) {
        wplaceState.lastDrawnKey = g.key;
        paintGeoPixel(g.gx, g.gy, g.lat, g.lon, wplaceState.selectedColor);
      }
    }
  }, { passive: false });

  canvas.addEventListener("touchend", function() {
    canvas.removeAttribute("data-panning");
    wplaceState.lastDrawnKey = "";
  });

  // Default center on Ukraine / Pridnestrovie (~48.4 N, 31.1 E)
  jumpWplaceTo(48.4, 31.1, 12);
}

function pickWplaceColor(hex, swatchEl) {
  wplaceState.selectedColor = hex;
  var custom = document.getElementById("wplaceCustomColor");
  if (custom) custom.value = hex;
  var all = document.querySelectorAll(".color-swatch");
  for (var i = 0; i < all.length; i++) all[i].className = "color-swatch";
  if (swatchEl) swatchEl.className = "color-swatch active-swatch";
}

function toggleWplacePan() {
  wplaceState.panMode = !wplaceState.panMode;
  var btn = document.getElementById("wplacePanBtn");
  if (btn) btn.textContent = wplaceState.panMode ? "Draw Mode" : "Pan Mode";
}

function zoomWplace(delta) {
  wplaceState.zoom = Math.max(4, Math.min(36, wplaceState.zoom + delta));
  renderWplaceCanvas();
}

function paintGeoPixel(gx, gy, lat, lon, color) {
  var key = gx + "_" + gy;
  var entry = {
    gx: gx,
    gy: gy,
    lat: lat,
    lon: lon,
    color: color,
    by: getDisplayUsername(),
    updatedAt: new Date().getTime()
  };
  state.wplacePixels[key] = entry;
  var recId = generateId("wp");
  state.wplaceRecent[recId] = entry;
  renderWplaceCanvas();
  renderWplaceRecent();
  dbWrite("PUT", "wplace/pixels/" + key, entry, null);
  dbWrite("PUT", "wplace/recent/" + recId, entry, null);
}

function stampImageToWplace() {
  var fEl = document.getElementById("wplaceImageFile");
  if (!fEl || !fEl.files || !fEl.files[0]) {
    showStatus("Select an image first to convert into map pixel-art.", true);
    return;
  }
  var file = fEl.files[0];
  var img = new Image();
  var objUrl = URL.createObjectURL(file);
  img.onload = function() {
    URL.revokeObjectURL(objUrl);
    var maxD = Math.min(32, SERVICE_POLICY.wplaceStampMaxDim);
    var scale = Math.min(maxD / Math.max(1, img.width), maxD / Math.max(1, img.height), 1);
    var w = Math.max(4, Math.round(img.width * scale));
    var h = Math.max(4, Math.round(img.height * scale));
    var c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    var ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    var data = ctx.getImageData(0, 0, w, h).data;

    var startGx = wplaceState.offsetX - Math.floor(w / 2);
    var startGy = wplaceState.offsetY - Math.floor(h / 2);
    var patchPixels = {};
    var now = new Date().getTime();
    var author = getDisplayUsername();

    function toHex(n) { var s = n.toString(16); return s.length < 2 ? "0" + s : s; }

    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var idx = (y * w + x) * 4;
        if (data[idx + 3] < 110) continue;
        var hex = "#" + toHex(data[idx]) + toHex(data[idx + 1]) + toHex(data[idx + 2]);
        var gx = startGx + x;
        var gy = startGy + y;
        var key = gx + "_" + gy;
        var pObj = {
          gx: gx,
          gy: gy,
          lat: (-gy / 20).toFixed(4),
          lon: (gx / 20).toFixed(4),
          color: hex,
          by: author,
          updatedAt: now
        };
        state.wplacePixels[key] = pObj;
        patchPixels[key] = pObj;
      }
    }

    var recId = generateId("stamp");
    var summaryEntry = {
      gx: wplaceState.offsetX,
      gy: wplaceState.offsetY,
      lat: (-wplaceState.offsetY / 20).toFixed(4),
      lon: (wplaceState.offsetX / 20).toFixed(4),
      color: "#FF6600",
      by: author + " (PixelArt " + w + "x" + h + ")",
      updatedAt: now
    };
    state.wplaceRecent[recId] = summaryEntry;
    fEl.value = "";
    renderWplaceCanvas();
    renderWplaceRecent();
    dbWrite("PATCH", "wplace/pixels", patchPixels, null);
    dbWrite("PUT", "wplace/recent/" + recId, summaryEntry, null);
    showStatus("Stamped " + w + "x" + h + " pixel-art onto the map!", false);
  };
  img.src = objUrl;
}

function getOsmTile(z, x, y) {
  var maxT = Math.pow(2, z);
  var wx = ((x % maxT) + maxT) % maxT;
  if (y < 0 || y >= maxT) return null;
  var key = z + "_" + wx + "_" + y;
  if (osmTileCache[key]) return osmTileCache[key];
  var img = new Image();
  img.crossOrigin = "Anonymous";
  img.onload = function() {
    img.loadedOk = true;
    renderWplaceCanvas();
  };
  img.src = "https://tile.openstreetmap.org/" + z + "/" + wx + "/" + y + ".png";
  osmTileCache[key] = img;
  return img;
}

function renderWplaceCanvas() {
  var canvas = document.getElementById("wplaceCanvas");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");
  var w = canvas.width;
  var h = canvas.height;
  ctx.fillStyle = "#DCE8F2";
  ctx.fillRect(0, 0, w, h);

  // Draw OpenStreetMap tiles aligned with current geo-offset
  var osmZoom = Math.max(3, Math.min(14, Math.floor(wplaceState.zoom / 2.2) + 2));
  var centerLat = -wplaceState.offsetY / 20;
  var centerLon = wplaceState.offsetX / 20;
  var clampedLat = Math.max(-82, Math.min(82, centerLat));
  var n = Math.pow(2, osmZoom);
  var tileXf = ((centerLon + 180) / 360) * n;
  var latRad = (clampedLat * Math.PI) / 180;
  var tileYf = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  var baseTx = Math.floor(tileXf);
  var baseTy = Math.floor(tileYf);
  var offPxX = (tileXf - baseTx) * 256;
  var offPxY = (tileYf - baseTy) * 256;

  for (var dx = -2; dx <= 2; dx++) {
    for (var dy = -2; dy <= 2; dy++) {
      var tImg = getOsmTile(osmZoom, baseTx + dx, baseTy + dy);
      if (tImg && tImg.loadedOk) {
        var drawX = Math.round(w / 2 - offPxX + dx * 256);
        var drawY = Math.round(h / 2 - offPxY + dy * 256);
        ctx.drawImage(tImg, drawX, drawY, 256, 256);
      }
    }
  }

  // Subtle geo-grid
  var cell = Math.max(4, wplaceState.zoom);
  ctx.strokeStyle = "rgba(128, 0, 0, 0.14)";
  ctx.lineWidth = 1;
  var cols = Math.ceil(w / cell) + 2;
  var rows = Math.ceil(h / cell) + 2;
  var startX = (w / 2) % cell;
  var startY = (h / 2) % cell;
  for (var c = 0; c < cols; c++) {
    ctx.beginPath();
    ctx.moveTo(startX + c * cell, 0);
    ctx.lineTo(startX + c * cell, h);
    ctx.stroke();
  }
  for (var r = 0; r < rows; r++) {
    ctx.beginPath();
    ctx.moveTo(0, startY + r * cell);
    ctx.lineTo(w, startY + r * cell);
    ctx.stroke();
  }

  // Render geo-anchored pixels
  for (var key in state.wplacePixels) {
    if (!state.wplacePixels.hasOwnProperty(key) || !state.wplacePixels[key]) continue;
    var px = state.wplacePixels[key];
    var sx = Math.round(w / 2 + (px.gx - wplaceState.offsetX) * cell);
    var sy = Math.round(h / 2 + (px.gy - wplaceState.offsetY) * cell);
    if (sx < -cell || sx > w + cell || sy < -cell || sy > h + cell) continue;
    ctx.fillStyle = px.color || "#800000";
    ctx.fillRect(sx, sy, cell, cell);
  }
}

function renderWplaceRecent() {
  var box = document.getElementById("wplaceRecentList");
  if (!box) return;
  var list = [];
  for (var id in state.wplaceRecent) {
    if (state.wplaceRecent.hasOwnProperty(id) && state.wplaceRecent[id]) list.push(state.wplaceRecent[id]);
  }
  list.sort(function(a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
  var h = "";
  var lim = Math.min(20, list.length);
  for (var i = 0; i < lim; i++) {
    var item = list[i];
    h += "<div class='wplace-recent-item' onclick='jumpWplaceTo(" + parseFloat(item.lat || 0) + "," + parseFloat(item.lon || 0) + "," + wplaceState.zoom + ")'>" +
           "<span class='wplace-recent-dot' style='background:" + esc(item.color || "#800000") + ";'></span>" +
           "<b>" + esc(item.by || "Anon") + "</b> @ " + esc(item.lat) + ", " + esc(item.lon) +
         "</div>";
  }
  box.innerHTML = h || "<span class='muted'>No edits yet.</span>";
}