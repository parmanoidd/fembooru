/* ==========================================================================
   FEMBOORU REALTIME SANDBOX & WPLACE MAP:
   - REALTIME CURSORS WITH SCROLL-AWARE COORDINATES & LIVE CHAT (SHIFT OR /)
   - SPRITES/GIFS WITH RMB THROWING, FIREWORKS & GMOD/HL2 TOOLS (PHYSGUN, ETC.)
   - RANDOMIZED INTERNET PROP MENU [Q] & WALKABLE/JUMPABLE WASD USER MODEL
   - PUBLIC WPLACE / GEOPIXELS OPENSTREETMAP PIXEL ENGINE
   ========================================================================== */
var WPLACE_COLORS = [
  "#800000", "#D96B27", "#FFD700", "#117743", "#0066CC",
  "#663399", "#CC1105", "#FFFFFF", "#888888", "#111111"
];

var CURATED_PROPS = [
  { name: "Wooden Crate", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Wooden_box_icon.svg/120px-Wooden_box_icon.svg.png" },
  { name: "Traffic Cone", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Traffic_cone_icon.svg/120px-Traffic_cone_icon.svg.png" },
  { name: "Rubber Duck", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Rubber_duck_icon.svg/120px-Rubber_duck_icon.svg.png" },
  { name: "Watermelon", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Watermelon_icon.svg/120px-Watermelon_icon.svg.png" },
  { name: "Hazard Barrel", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Biohazard_symbol.svg/120px-Biohazard_symbol.svg.png" },
  { name: "CRT Monitor", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Desktop_computer_clipart_-_Yellow_theme.svg/120px-Desktop_computer_clipart_-_Yellow_theme.svg.png" }
];

var wplaceTileCache = {};

/* ==========================================================================
   REALTIME CURSORS & LIVE CURSOR CHAT (SHIFT OR /)
   ========================================================================== */
function getPageShellMetrics() {
  var shell = document.querySelector(".page-center");
  if (!shell) return { left: 0, width: Math.max(320, window.innerWidth || 1000) };
  var rect = shell.getBoundingClientRect();
  return {
    left: rect.left + (window.pageXOffset || document.documentElement.scrollLeft || 0),
    width: Math.max(320, rect.width || 1000)
  };
}

function pointerToWorldCoords(clientX, clientY) {
  var scrollX = window.pageXOffset || document.documentElement.scrollLeft || 0;
  var scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
  var docX = clientX + scrollX;
  var docY = clientY + scrollY;
  var m = getPageShellMetrics();
  var relX = (docX - m.left) / m.width;
  return { docX: docX, docY: docY, relX: Math.round(relX * 10000) / 10000 };
}

function relXToDocX(relX) {
  var m = getPageShellMetrics();
  return Math.round(m.left + (relX * m.width));
}

function sendCursorUpdate(force) {
  var now = new Date().getTime();
  if (!force && (now - worldState.lastCursorSendTime) < 420) return;
  var coords = pointerToWorldCoords(worldState.lastMouseX, worldState.lastMouseY);
  var chatActive = worldState.localChatText && worldState.localChatExpiresAt > now;
  if (!force &&
      Math.abs(coords.relX - worldState.lastCursorRelX) < 0.004 &&
      Math.abs(coords.docY - worldState.lastCursorDocY) < 6 &&
      !chatActive) {
    return;
  }
  worldState.lastCursorSendTime = now;
  worldState.lastCursorRelX = coords.relX;
  worldState.lastCursorDocY = coords.docY;

  var payload = {
    clientId: myClientId,
    uid: state.user ? state.user.uid : "",
    name: getDisplayUsername(),
    relX: coords.relX,
    docY: Math.round(coords.docY),
    chat: chatActive ? worldState.localChatText : "",
    chatExpiresAt: chatActive ? worldState.localChatExpiresAt : 0,
    updatedAt: now
  };
  dbWrite("PUT", "realtime/cursors/" + myClientId, payload, null);
}

function openCursorChatBar() {
  var bar = document.getElementById("cursorChatBar");
  var inp = document.getElementById("cursorChatInput");
  if (!bar || !inp) return;
  worldState.cursorChatOpen = true;
  bar.style.display = "flex";
  inp.focus();
  inp.select();
}

function closeCursorChatBar() {
  var bar = document.getElementById("cursorChatBar");
  if (bar) bar.style.display = "none";
  worldState.cursorChatOpen = false;
}

function onCursorChatTyping(val) {
  worldState.localChatText = String(val || "").substring(0, 80);
  worldState.localChatExpiresAt = new Date().getTime() + 8000;
  sendCursorUpdate(true);
}

function renderRemoteCursors() {
  var layer = document.getElementById("cursorsLayer");
  if (!layer) return;
  var now = new Date().getTime();
  var activeIds = {};
  var prevClientId = storeGet("prevClientId") || "";

  for (var cId in worldState.cursors) {
    if (!worldState.cursors.hasOwnProperty(cId)) continue;
    var c = worldState.cursors[cId];
    if (!c || !c.updatedAt || (now - c.updatedAt) > 15000) continue;
    if (cId === myClientId || cId === prevClientId) continue;
    if (state.user && c.uid && c.uid === state.user.uid) continue;

    activeIds[cId] = true;
    var node = worldState.cursorNodes[cId];
    if (!node) {
      node = document.createElement("div");
      node.className = "remote-cursor";
      node.innerHTML =
        "<div class='cursor-chat-bubble' style='display:none;'></div>" +
        "<div class='cursor-name-tag'></div>" +
        "<div class='cursor-arrow'></div>";
      layer.appendChild(node);
      worldState.cursorNodes[cId] = node;
    }

    var px = relXToDocX(c.relX || 0.5);
    var py = c.docY || 100;
    node.style.left = px + "px";
    node.style.top = py + "px";

    var tag = node.querySelector(".cursor-name-tag");
    if (tag && tag.textContent !== (c.name || "Anon")) tag.textContent = c.name || "Anon";

    var bubble = node.querySelector(".cursor-chat-bubble");
    if (bubble) {
      if (c.chat && c.chatExpiresAt > now) {
        bubble.style.display = "block";
        if (bubble.textContent !== c.chat) bubble.textContent = c.chat;
      } else {
        bubble.style.display = "none";
      }
    }
  }

  for (var existingId in worldState.cursorNodes) {
    if (worldState.cursorNodes.hasOwnProperty(existingId) && !activeIds[existingId]) {
      var dead = worldState.cursorNodes[existingId];
      if (dead && dead.parentNode) dead.parentNode.removeChild(dead);
      delete worldState.cursorNodes[existingId];
    }
  }
}

/* ==========================================================================
   SPRITES / GIFS, RMB THROWING, FIREWORKS & GMOD / HL2 TOOLS
   ========================================================================== */
function spawnSpriteEntity(url, label) {
  if (!isValidImageSrc(url)) {
    showStatus("Provide a valid image or GIF URL.", true);
    return;
  }
  var id = generateId("sp");
  var coords = pointerToWorldCoords(worldState.lastMouseX, worldState.lastMouseY);
  var obj = {
    id: id,
    url: url,
    name: label || "Sprite",
    x: Math.round(coords.docX),
    y: Math.round(coords.docY),
    vx: (Math.random() - 0.5) * 4,
    vy: -2,
    rot: 0,
    vrot: 0,
    frozen: false,
    attachedFireworkId: "",
    by: getDisplayUsername(),
    updatedAt: new Date().getTime()
  };
  worldState.sprites[id] = obj;
  dbWrite("PUT", "realtime/sprites/" + id, obj, null);
}

function spawnSpriteFromFile() {
  var fEl = document.getElementById("spriteUploadInput");
  var uEl = document.getElementById("spriteUrlInput");
  var direct = uEl ? safeUrl(uEl.value) : "";

  if (fEl && fEl.files && fEl.files[0]) {
    uploadImageToImgbb(fEl, function(err, url) {
      if (!err && url) {
        fEl.value = "";
        spawnSpriteEntity(url, "Sprite");
        showStatus("Sprite spawned for everyone!", false);
      } else {
        showStatus(err || "Sprite upload failed.", true);
      }
    });
  } else if (direct) {
    if (uEl) uEl.value = "";
    spawnSpriteEntity(direct, "Sprite");
    showStatus("Sprite spawned for everyone!", false);
  } else {
    showStatus("Select an image/GIF or enter a URL.", true);
  }
}

function spawnFirework() {
  var id = generateId("fw");
  var coords = pointerToWorldCoords(worldState.lastMouseX, worldState.lastMouseY);
  var now = new Date().getTime();
  var fw = {
    id: id,
    x: Math.round(coords.docX),
    y: Math.round(coords.docY + 80),
    vy: -7.5,
    fuseAt: now + 2600,
    by: getDisplayUsername(),
    updatedAt: now
  };
  worldState.fireworks[id] = fw;
  dbWrite("PUT", "realtime/fireworks/" + id, fw, null);
  showStatus("Firework launched! Drag a sprite onto it to ride up!", false);
}

function clearAllWorldProps() {
  worldState.sprites = {};
  worldState.fireworks = {};
  dbWrite("DELETE", "realtime/sprites", null, null);
  dbWrite("DELETE", "realtime/fireworks", null, null);
  showStatus("Cleared world sprites and fireworks.", false);
}

function selectSandboxTool(toolName) {
  worldState.activeTool = toolName;
  var btns = document.querySelectorAll(".tool-btn");
  for (var i = 0; i < btns.length; i++) {
    var t = btns[i].getAttribute("data-tool");
    btns[i].className = (t === toolName) ? "tool-btn active-tool" : "tool-btn";
  }
}

function togglePropMenu(forceState) {
  var modal = document.getElementById("propMenuModal");
  if (!modal) return;
  worldState.propMenuOpen = (typeof forceState === "boolean") ? forceState : !worldState.propMenuOpen;
  modal.style.display = worldState.propMenuOpen ? "block" : "none";
  if (worldState.propMenuOpen && !worldState.propCatalog.length) {
    refreshPropCatalog();
  }
}

function refreshPropCatalog() {
  var grid = document.getElementById("propMenuGrid");
  if (!grid) return;
  var items = [];
  for (var i = 0; i < CURATED_PROPS.length; i++) {
    items.push(CURATED_PROPS[i]);
  }
  var seeds = ["crate", "barrel", "cyber", "ua", "cat", "bot", "pixel", "orb"];
  for (var j = 0; j < 6; j++) {
    var seed = seeds[Math.floor(Math.random() * seeds.length)] + "_" + Math.floor(Math.random() * 9999);
    items.push({
      name: "Random Prop #" + (j + 1),
      url: "https://robohash.org/" + encodeURIComponent(seed) + ".png?size=96x96"
    });
  }
  worldState.propCatalog = items;

  var h = "";
  for (var k = 0; k < items.length; k++) {
    h += "<div class='prop-card' onclick=\"spawnSpriteEntity('" + esc(items[k].url) + "','" + esc(items[k].name) + "')\">" +
           "<img src='" + esc(items[k].url) + "' alt='prop'>" +
           "<span>" + esc(items[k].name) + "</span>" +
         "</div>";
  }
  grid.innerHTML = h;

  var xhr = new XMLHttpRequest();
  xhr.open("GET", "https://commons.wikimedia.org/w/api.php?action=query&generator=random&grnnamespace=6&grnlimit=6&prop=imageinfo&iiprop=url&iiurlwidth=120&format=json&origin=*", true);
  xhr.onreadystatechange = function() {
    if (xhr.readyState === 4 && xhr.status === 200) {
      try {
        var data = JSON.parse(xhr.responseText);
        var pages = data && data.query && data.query.pages;
        if (!pages) return;
        var extraHtml = "";
        for (var pid in pages) {
          if (!pages.hasOwnProperty(pid)) continue;
          var pg = pages[pid];
          var ii = pg.imageinfo && pg.imageinfo[0];
          var thumb = ii && (ii.thumburl || ii.url);
          if (thumb && /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(thumb)) {
            var cleanTitle = String(pg.title || "Wiki Prop").replace(/^File:/i, "").substring(0, 22);
            extraHtml += "<div class='prop-card' onclick=\"spawnSpriteEntity('" + esc(thumb) + "','" + esc(cleanTitle) + "')\">" +
                           "<img src='" + esc(thumb) + "' alt='prop'>" +
                           "<span>" + esc(cleanTitle) + "</span>" +
                         "</div>";
          }
        }
        if (extraHtml && grid) grid.innerHTML += extraHtml;
      } catch (e) {}
    }
  };
  xhr.send();
}

function handleSpriteMouseDown(e, spriteId) {
  e = e || window.event;
  if (e.preventDefault) e.preventDefault();
  if (e.stopPropagation) e.stopPropagation();
  var sp = worldState.sprites[spriteId];
  if (!sp) return;

  if (e.button === 2) {
    worldState.grabbedSpriteId = spriteId;
    worldState.grabMode = "rmb";
    sp.frozen = false;
    sp.attachedFireworkId = "";
    worldState.throwVx = 0;
    worldState.throwVy = 0;
    return;
  }

  var tool = worldState.activeTool;
  if (tool === "physgun") {
    worldState.grabbedSpriteId = spriteId;
    worldState.grabMode = "physgun";
    sp.frozen = false;
    sp.attachedFireworkId = "";
  } else if (tool === "gravgun") {
    var coords = pointerToWorldCoords(e.clientX, e.clientY);
    var dx = (sp.x + 32) - coords.docX;
    var dy = (sp.y + 32) - coords.docY;
    var dist = Math.max(12, Math.sqrt(dx * dx + dy * dy));
    sp.frozen = false;
    sp.vx = (dx / dist) * 18;
    sp.vy = (dy / dist) * 18 - 6;
    sp.vrot = (Math.random() - 0.5) * 20;
    dbWrite("PUT", "realtime/sprites/" + spriteId, sp, null);
  } else if (tool === "crowbar") {
    sp.frozen = false;
    sp.vx = (Math.random() - 0.5) * 16;
    sp.vy = -12;
    sp.vrot = 15;
    spawnExplosionParticles(sp.x + 30, sp.y + 30, "#FFD700", 10);
    dbWrite("PUT", "realtime/sprites/" + spriteId, sp, null);
  } else if (tool === "thruster") {
    sp.frozen = false;
    sp.vy = -16;
    sp.vrot += 6;
    spawnExplosionParticles(sp.x + 30, sp.y + 50, "#FF6600", 12);
    dbWrite("PUT", "realtime/sprites/" + spriteId, sp, null);
  } else if (tool === "remover") {
    spawnExplosionParticles(sp.x + 30, sp.y + 30, "#00BFFF", 14);
    delete worldState.sprites[spriteId];
    dbWrite("DELETE", "realtime/sprites/" + spriteId, null, null);
  }
}

function spawnExplosionParticles(x, y, color, count) {
  for (var i = 0; i < (count || 24); i++) {
    var ang = Math.random() * Math.PI * 2;
    var spd = 2 + Math.random() * 8;
    worldState.particles.push({
      x: x,
      y: y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd - 2,
      life: 35 + Math.floor(Math.random() * 20),
      color: color || ["#FF4500", "#FFD700", "#00BFFF", "#FF1493"][i % 4]
    });
  }
}

/* ==========================================================================
   WALKABLE & JUMPABLE USER MODEL (WASD / ARROWS / JUMP ON BLOCKS & CURSORS)
   ========================================================================== */
function togglePlayerActor() {
  worldState.actorEnabled = !worldState.actorEnabled;
  var btn = document.getElementById("toggleActorBtn");
  if (btn) btn.textContent = worldState.actorEnabled ? "Despawn Model" : "Spawn Model (WASD)";
  if (worldState.actorEnabled) {
    var coords = pointerToWorldCoords(worldState.lastMouseX, worldState.lastMouseY);
    worldState.myActor.x = Math.max(40, Math.round(coords.docX));
    worldState.myActor.y = Math.max(40, Math.round(coords.docY - 60));
    worldState.myActor.vx = 0;
    worldState.myActor.vy = 0;
    worldState.myActor.hp = 100;
    syncMyActor(true);
  } else {
    dbWrite("DELETE", "realtime/actors/" + myClientId, null, null);
  }
}

function setActorKey(dir, isDown) {
  worldState.keys[dir] = isDown;
}

function triggerActorAttack() {
  if (!worldState.actorEnabled) return;
  var now = new Date().getTime();
  worldState.myActor.swingUntil = now + 260;
  var ax = worldState.myActor.x + 18;
  var ay = worldState.myActor.y + 20;

  for (var sid in worldState.sprites) {
    if (!worldState.sprites.hasOwnProperty(sid) || !worldState.sprites[sid]) continue;
    var sp = worldState.sprites[sid];
    var dx = (sp.x + 32) - ax;
    var dy = (sp.y + 32) - ay;
    if (Math.abs(dx) < 85 && Math.abs(dy) < 85) {
      sp.frozen = false;
      sp.vx = (dx >= 0 ? 1 : -1) * 15;
      sp.vy = -11;
      sp.vrot = (dx >= 0 ? 14 : -14);
      dbWrite("PUT", "realtime/sprites/" + sid, sp, null);
      spawnExplosionParticles(sp.x + 32, sp.y + 32, "#FFD700", 8);
    }
  }

  for (var aid in worldState.actors) {
    if (!worldState.actors.hasOwnProperty(aid) || aid === myClientId) continue;
    var other = worldState.actors[aid];
    if (!other || (now - (other.updatedAt || 0)) > 12000) continue;
    if (Math.abs(other.x - worldState.myActor.x) < 60 && Math.abs(other.y - worldState.myActor.y) < 60) {
      var nextHp = Math.max(0, (other.hp || 100) - 25);
      spawnExplosionParticles(other.x + 18, other.y + 18, "#CC1105", 14);
      dbWrite("PATCH", "realtime/actors/" + aid, {
        hp: nextHp === 0 ? 100 : nextHp,
        vx: worldState.myActor.facing * 14,
        vy: -10
      }, null);
    }
  }
  syncMyActor(true);
}

function getSolidPlatforms() {
  var scrollX = window.pageXOffset || document.documentElement.scrollLeft || 0;
  var scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
  var plats = [];
  var nodes = document.querySelectorAll(".thread-item, .wall-post-card, .box-panel, .side-box, button");
  for (var i = 0; i < nodes.length; i++) {
    var r = nodes[i].getBoundingClientRect();
    if (r.width > 12 && r.height > 10 && r.bottom > -100 && r.top < (window.innerHeight + 200)) {
      plats.push({
        left: r.left + scrollX,
        right: r.right + scrollX,
        top: r.top + scrollY
      });
    }
  }
  for (var cId in worldState.cursors) {
    if (!worldState.cursors.hasOwnProperty(cId) || cId === myClientId) continue;
    var c = worldState.cursors[cId];
    if (c && (new Date().getTime() - (c.updatedAt || 0)) < 12000) {
      var cx = relXToDocX(c.relX || 0.5);
      plats.push({ left: cx - 18, right: cx + 38, top: c.docY || 100 });
    }
  }
  return plats;
}

function syncMyActor(force) {
  if (!worldState.actorEnabled) return;
  var now = new Date().getTime();
  if (!force && (now - worldState.lastActorSendTime) < 420) return;
  worldState.lastActorSendTime = now;
  var a = worldState.myActor;
  var av = (state.profile && isValidImageSrc(state.profile.avatar)) ? state.profile.avatar : DEFAULT_AVATAR_SVG;
  var payload = {
    clientId: myClientId,
    name: getDisplayUsername(),
    avatar: av,
    x: Math.round(a.x),
    y: Math.round(a.y),
    vx: Math.round(a.vx * 10) / 10,
    vy: Math.round(a.vy * 10) / 10,
    facing: a.facing,
    hp: a.hp,
    swingUntil: a.swingUntil,
    updatedAt: now
  };
  worldState.actors[myClientId] = payload;
  dbWrite("PUT", "realtime/actors/" + myClientId, payload, null);
}

/* ==========================================================================
   WORLD PHYSICS & RENDER LOOP
   ========================================================================== */
function stepWorldSimulation() {
  var now = new Date().getTime();
  var docW = Math.max(document.documentElement.scrollWidth || 1000, window.innerWidth || 1000);
  var docH = Math.max(document.documentElement.scrollHeight || 1200, window.innerHeight || 800);
  var pointerCoords = pointerToWorldCoords(worldState.lastMouseX, worldState.lastMouseY);

  // 1. Step Fireworks
  for (var fwId in worldState.fireworks) {
    if (!worldState.fireworks.hasOwnProperty(fwId) || !worldState.fireworks[fwId]) continue;
    var fw = worldState.fireworks[fwId];
    fw.y += (fw.vy || -7.5);
    if (now >= (fw.fuseAt || 0) || fw.y < 30) {
      if (!worldState.explodedFireworks[fwId]) {
        worldState.explodedFireworks[fwId] = true;
        spawnExplosionParticles(fw.x, Math.max(30, fw.y), null, 32);
        for (var spId in worldState.sprites) {
          if (worldState.sprites.hasOwnProperty(spId) && worldState.sprites[spId] && worldState.sprites[spId].attachedFireworkId === fwId) {
            var rider = worldState.sprites[spId];
            rider.attachedFireworkId = "";
            rider.vx = (Math.random() - 0.5) * 14;
            rider.vy = -8 - Math.random() * 6;
            rider.vrot = (Math.random() - 0.5) * 24;
            dbWrite("PUT", "realtime/sprites/" + spId, rider, null);
          }
        }
      }
      delete worldState.fireworks[fwId];
      dbWrite("DELETE", "realtime/fireworks/" + fwId, null, null);
    }
  }

  // 2. Step Sprites
  for (var sId in worldState.sprites) {
    if (!worldState.sprites.hasOwnProperty(sId) || !worldState.sprites[sId]) continue;
    var sp = worldState.sprites[sId];
    if (worldState.grabbedSpriteId === sId) {
      var targetX = pointerCoords.docX - 32;
      var targetY = pointerCoords.docY - 32;
      worldState.throwVx = (targetX - sp.x) * 0.65;
      worldState.throwVy = (targetY - sp.y) * 0.65;
      sp.x = targetX;
      sp.y = targetY;
      sp.vx = 0;
      sp.vy = 0;
      for (var fKey in worldState.fireworks) {
        if (worldState.fireworks.hasOwnProperty(fKey) && worldState.fireworks[fKey]) {
          var candFw = worldState.fireworks[fKey];
          if (Math.abs(candFw.x - sp.x) < 60 && Math.abs(candFw.y - sp.y) < 60) {
            sp.attachedFireworkId = fKey;
            worldState.grabbedSpriteId = null;
            dbWrite("PUT", "realtime/sprites/" + sId, sp, null);
            break;
          }
        }
      }
    } else if (sp.attachedFireworkId && worldState.fireworks[sp.attachedFireworkId]) {
      var hostFw = worldState.fireworks[sp.attachedFireworkId];
      sp.x = hostFw.x - 24;
      sp.y = hostFw.y - 24;
      sp.rot = (sp.rot || 0) + 8;
    } else if (!sp.frozen) {
      sp.vy = (sp.vy || 0) + 0.35;
      sp.x = (sp.x || 0) + (sp.vx || 0);
      sp.y = (sp.y || 0) + (sp.vy || 0);
      sp.rot = (sp.rot || 0) + (sp.vrot || 0);
      sp.vx = (sp.vx || 0) * 0.985;
      sp.vrot = (sp.vrot || 0) * 0.96;

      if (sp.x < 0) { sp.x = 0; sp.vx = Math.abs(sp.vx) * 0.7; }
      if (sp.x > docW - 76) { sp.x = docW - 76; sp.vx = -Math.abs(sp.vx) * 0.7; }
      if (sp.y < 0) { sp.y = 0; sp.vy = Math.abs(sp.vy) * 0.6; }
      if (sp.y > docH - 80) {
        sp.y = docH - 80;
        sp.vy = -Math.abs(sp.vy) * 0.45;
        if (Math.abs(sp.vy) < 1.2) sp.vy = 0;
      }
    }
  }

  // 3. Step Local Walkable Player Actor
  if (worldState.actorEnabled) {
    var a = worldState.myActor;
    var prevBottom = a.y + 42;
    if (worldState.keys.left) { a.vx = -4.5; a.facing = -1; }
    else if (worldState.keys.right) { a.vx = 4.5; a.facing = 1; }
    else { a.vx *= 0.75; }

    if (worldState.keys.jump && a.grounded) {
      a.vy = -10.5;
      a.grounded = false;
    }

    a.vy += 0.52;
    a.x += a.vx;
    a.y += a.vy;
    a.grounded = false;

    if (a.x < 8) a.x = 8;
    if (a.x > docW - 44) a.x = docW - 44;

    if (a.vy >= 0) {
      var plats = getSolidPlatforms();
      var footLeft = a.x + 6;
      var footRight = a.x + 30;
      var nextBottom = a.y + 42;
      for (var p = 0; p < plats.length; p++) {
        var pl = plats[p];
        if (footRight >= pl.left && footLeft <= pl.right && prevBottom <= pl.top + 8 && nextBottom >= pl.top) {
          a.y = pl.top - 42;
          a.vy = 0;
          a.grounded = true;
          break;
        }
      }
    }

    if (a.y > docH - 46) {
      a.y = docH - 46;
      a.vy = 0;
      a.grounded = true;
    }

    // Auto-kick sprites when walking into them
    for (var ksId in worldState.sprites) {
      if (!worldState.sprites.hasOwnProperty(ksId) || !worldState.sprites[ksId]) continue;
      var ksp = worldState.sprites[ksId];
      if (Math.abs((ksp.x + 32) - (a.x + 18)) < 38 && Math.abs((ksp.y + 32) - (a.y + 22)) < 38 && Math.abs(a.vx) > 1.2) {
        ksp.frozen = false;
        ksp.vx = a.facing * 11;
        ksp.vy = -7;
        ksp.vrot = a.facing * 12;
        dbWrite("PUT", "realtime/sprites/" + ksId, ksp, null);
      }
    }
    syncMyActor(false);
  }

  renderPlaygroundDOM();
  renderActorsDOM();
  renderFxCanvas(pointerCoords);
}

function renderPlaygroundDOM() {
  var layer = document.getElementById("playgroundLayer");
  if (!layer) return;
  var h = "";
  for (var sId in worldState.sprites) {
    if (!worldState.sprites.hasOwnProperty(sId) || !worldState.sprites[sId]) continue;
    var sp = worldState.sprites[sId];
    if (!isValidImageSrc(sp.url)) continue;
    var style = "left:" + Math.round(sp.x) + "px;top:" + Math.round(sp.y) + "px;transform:rotate(" + Math.round(sp.rot || 0) + "deg);";
    if (sp.frozen) style += "outline:2px solid #00BFFF;";
    h += "<img class='world-sprite' src='" + esc(sp.url) + "' style='" + style + "' oncontextmenu='return false;' onmousedown=\"handleSpriteMouseDown(event,'" + esc(sId) + "')\" ontouchstart=\"handleSpriteMouseDown(event,'" + esc(sId) + "')\" title='RMB: Throw | Physgun: Drag/Wheel Rotate/[E] Freeze'>";
  }
  for (var fId in worldState.fireworks) {
    if (!worldState.fireworks.hasOwnProperty(fId) || !worldState.fireworks[fId]) continue;
    var fw = worldState.fireworks[fId];
    h += "<div class='world-firework' style='left:" + Math.round(fw.x) + "px;top:" + Math.round(fw.y) + "px;'>FIREWORK</div>";
  }
  if (h !== worldState.lastPlaygroundHtml) {
    layer.innerHTML = h;
    worldState.lastPlaygroundHtml = h;
  }
}

function renderActorsDOM() {
  var layer = document.getElementById("actorsLayer");
  if (!layer) return;
  var now = new Date().getTime();
  var active = {};

  for (var aId in worldState.actors) {
    if (!worldState.actors.hasOwnProperty(aId)) continue;
    var a = worldState.actors[aId];
    if (!a || (now - (a.updatedAt || 0)) > 12000) continue;
    if (aId === myClientId && !worldState.actorEnabled) continue;

    active[aId] = true;
    var node = worldState.actorNodes[aId];
    if (!node) {
      node = document.createElement("div");
      node.className = "player-actor";
      node.innerHTML =
        "<div class='actor-tag'></div>" +
        "<img class='actor-head' src='" + DEFAULT_AVATAR_SVG + "' alt='head'>" +
        "<div class='actor-body'></div>" +
        "<div class='actor-weapon'></div>";
      layer.appendChild(node);
      worldState.actorNodes[aId] = node;
    }

    node.style.left = Math.round(a.x || 0) + "px";
    node.style.top = Math.round(a.y || 0) + "px";
    var tag = node.querySelector(".actor-tag");
    if (tag) tag.textContent = (a.name || "Player") + " (" + (a.hp || 100) + ")";
    var head = node.querySelector(".actor-head");
    if (head && isValidImageSrc(a.avatar) && head.src !== a.avatar) head.src = a.avatar;
    var wep = node.querySelector(".actor-weapon");
    if (wep) {
      var swinging = (a.swingUntil || 0) > now;
      wep.style.left = (a.facing === -1) ? "-6px" : "24px";
      wep.style.transform = swinging ? "rotate(" + (a.facing === -1 ? "-65deg" : "65deg") + ")" : "rotate(0deg)";
    }
  }

  for (var oldId in worldState.actorNodes) {
    if (worldState.actorNodes.hasOwnProperty(oldId) && !active[oldId]) {
      var el = worldState.actorNodes[oldId];
      if (el && el.parentNode) el.parentNode.removeChild(el);
      delete worldState.actorNodes[oldId];
    }
  }
}

function renderFxCanvas(pointerCoords) {
  var canvas = document.getElementById("fxCanvas");
  if (!canvas || !canvas.getContext) return;
  var hasBeam = Boolean(worldState.grabbedSpriteId && worldState.grabMode === "physgun" && worldState.sprites[worldState.grabbedSpriteId]);
  if (!worldState.particles.length && !hasBeam) {
    if (worldState.hadFx) {
      canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
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

  var scrollX = window.pageXOffset || document.documentElement.scrollLeft || 0;
  var scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;

  if (hasBeam) {
    var sp = worldState.sprites[worldState.grabbedSpriteId];
    ctx.strokeStyle = "#00BFFF";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(worldState.lastMouseX, worldState.lastMouseY);
    ctx.lineTo((sp.x + 32) - scrollX, (sp.y + 32) - scrollY);
    ctx.stroke();
  }

  for (var i = worldState.particles.length - 1; i >= 0; i--) {
    var pt = worldState.particles[i];
    pt.x += pt.vx;
    pt.y += pt.vy;
    pt.vy += 0.25;
    pt.life--;
    if (pt.life <= 0) {
      worldState.particles.splice(i, 1);
      continue;
    }
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - scrollX, pt.y - scrollY, 4, 4);
  }
}

/* ==========================================================================
   WPLACE / GEOPIXELS PUBLIC OPENSTREETMAP PIXEL CANVAS
   ========================================================================== */
function initWplaceMap() {
  var palBox = document.getElementById("wplacePalette");
  if (palBox) {
    var h = "";
    for (var i = 0; i < WPLACE_COLORS.length; i++) {
      var col = WPLACE_COLORS[i];
      var act = (col === wplaceState.selectedColor) ? " active-swatch" : "";
      h += "<span class='color-swatch" + act + "' style='background:" + col + ";' onclick=\"pickWplaceColor('" + col + "',this)\"></span>";
    }
    palBox.innerHTML = h;
  }

  // Center on Ukraine / Pridnestrovie region
  wplaceState.offsetX = Math.round(31.1 * 20);
  wplaceState.offsetY = Math.round(-48.4 * 20);

  var canvas = document.getElementById("wplaceCanvas");
  if (!canvas) return;

  function canvasClientToGrid(clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    var scaleX = canvas.width / Math.max(1, rect.width);
    var scaleY = canvas.height / Math.max(1, rect.height);
    var cx = (clientX - rect.left) * scaleX;
    var cy = (clientY - rect.top) * scaleY;
    var z = wplaceState.zoom;
    var gx = Math.floor((cx - canvas.width / 2) / z + wplaceState.offsetX);
    var gy = Math.floor((cy - canvas.height / 2) / z + wplaceState.offsetY);
    var lon = Math.round((gx / 20) * 10000) / 10000;
    var lat = Math.round((-gy / 20) * 10000) / 10000;
    return { gx: gx, gy: gy, lat: lat, lon: lon };
  }

  function handlePointerDown(clientX, clientY) {
    if (wplaceState.panMode) {
      wplaceState.isDrawing = true;
      wplaceState.panStartX = clientX;
      wplaceState.panStartY = clientY;
      return;
    }
    wplaceState.isDrawing = true;
    var pos = canvasClientToGrid(clientX, clientY);
    paintWplacePixel(pos.gx, pos.gy, pos.lat, pos.lon, wplaceState.selectedColor);
  }

  function handlePointerMove(clientX, clientY) {
    var pos = canvasClientToGrid(clientX, clientY);
    var lbl = document.getElementById("wplaceCoords");
    if (lbl) lbl.textContent = "Lat: " + pos.lat + ", Lon: " + pos.lon + " • Zoom: " + wplaceState.zoom;
    if (!wplaceState.isDrawing) return;
    if (wplaceState.panMode) {
      var dx = (clientX - wplaceState.panStartX) / wplaceState.zoom;
      var dy = (clientY - wplaceState.panStartY) / wplaceState.zoom;
      wplaceState.offsetX -= dx;
      wplaceState.offsetY -= dy;
      wplaceState.panStartX = clientX;
      wplaceState.panStartY = clientY;
      renderWplaceCanvas();
    } else {
      paintWplacePixel(pos.gx, pos.gy, pos.lat, pos.lon, wplaceState.selectedColor);
    }
  }

  canvas.onmousedown = function(e) { e = e || window.event; handlePointerDown(e.clientX, e.clientY); };
  canvas.onmousemove = function(e) { e = e || window.event; handlePointerMove(e.clientX, e.clientY); };
  window.addEventListener("mouseup", function() { wplaceState.isDrawing = false; });

  canvas.ontouchstart = function(e) {
    if (e.touches && e.touches[0]) {
      e.preventDefault();
      handlePointerDown(e.touches[0].clientX, e.touches[0].clientY);
    }
  };
  canvas.ontouchmove = function(e) {
    if (e.touches && e.touches[0]) {
      e.preventDefault();
      handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  };
  canvas.ontouchend = function() { wplaceState.isDrawing = false; };
}

function pickWplaceColor(hex, swatchEl) {
  wplaceState.selectedColor = hex;
  wplaceState.panMode = false;
  var pBtn = document.getElementById("wplacePanBtn");
  if (pBtn) pBtn.className = "";
  var all = document.querySelectorAll(".color-swatch");
  for (var i = 0; i < all.length; i++) all[i].className = "color-swatch";
  if (swatchEl) swatchEl.className = "color-swatch active-swatch";
}

function toggleWplacePan() {
  wplaceState.panMode = !wplaceState.panMode;
  var pBtn = document.getElementById("wplacePanBtn");
  if (pBtn) pBtn.className = wplaceState.panMode ? "btn-active" : "";
}

function zoomWplace(delta) {
  wplaceState.zoom = Math.max(4, Math.min(36, wplaceState.zoom + delta));
  renderWplaceCanvas();
}

function gridToWplaceKey(gx, gy) {
  return String(gx).replace("-", "m") + "_" + String(gy).replace("-", "m");
}

function wplaceKeyToGrid(key) {
  var parts = String(key || "").split("_");
  if (parts.length !== 2) return null;
  var gx = parseInt(parts[0].replace("m", "-"), 10);
  var gy = parseInt(parts[1].replace("m", "-"), 10);
  if (isNaN(gx) || isNaN(gy)) return null;
  return { gx: gx, gy: gy };
}

function paintWplacePixel(gx, gy, lat, lon, color) {
  var key = gridToWplaceKey(gx, gy);
  if (wplaceState.lastDrawnKey === key && state.wplacePixels[key] && state.wplacePixels[key].c === color) return;
  wplaceState.lastDrawnKey = key;

  var pxObj = { c: color, lat: lat, lon: lon, by: getDisplayUsername(), t: new Date().getTime() };
  state.wplacePixels[key] = pxObj;
  renderWplaceCanvas();
  dbWrite("PUT", "wplace/pixels/" + key, pxObj, null);

  var recId = generateId("wp");
  var recObj = { id: recId, by: pxObj.by, c: color, lat: lat, lon: lon, t: pxObj.t };
  state.wplaceRecent[recId] = recObj;
  renderWplaceRecent();
  dbWrite("PUT", "wplace/recent/" + recId, recObj, null);
}

function stampImageToWplace() {
  var fEl = document.getElementById("wplaceImageFile");
  if (!fEl || !fEl.files || !fEl.files[0]) {
    showStatus("Select an image to stamp onto the map.", true);
    return;
  }
  var file = fEl.files[0];
  var img = new Image();
  var objUrl = URL.createObjectURL(file);
  img.onload = function() {
    URL.revokeObjectURL(objUrl);
    var maxD = SERVICE_POLICY.wplaceStampMaxDim;
    var scale = Math.min(maxD / Math.max(1, img.width), maxD / Math.max(1, img.height), 1);
    var w = Math.max(4, Math.round(img.width * scale));
    var h = Math.max(4, Math.round(img.height * scale));
    var off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    var ctx = off.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    var data = ctx.getImageData(0, 0, w, h).data;

    var startGx = Math.round(wplaceState.offsetX - w / 2);
    var startGy = Math.round(wplaceState.offsetY - h / 2);
    var patch = {};
    var now = new Date().getTime();
    var author = getDisplayUsername();

    function toHex(v) { var s = v.toString(16); return s.length < 2 ? "0" + s : s; }

    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var idx = (y * w + x) * 4;
        if (data[idx + 3] < 128) continue;
        var hex = "#" + toHex(data[idx]) + toHex(data[idx + 1]) + toHex(data[idx + 2]);
        var gx = startGx + x;
        var gy = startGy + y;
        var key = gridToWplaceKey(gx, gy);
        var pxObj = {
          c: hex,
          lat: Math.round((-gy / 20) * 10000) / 10000,
          lon: Math.round((gx / 20) * 10000) / 10000,
          by: author,
          t: now
        };
        state.wplacePixels[key] = pxObj;
        patch[key] = pxObj;
      }
    }

    renderWplaceCanvas();
    setUploadProgress(45, "Drawing pixel-art onto map...");
    dbWrite("PATCH", "wplace/pixels", patch, function(err) {
      if (!err) {
        var recId = generateId("wp");
        var recObj = {
          id: recId,
          by: author + " (Image Stamp)",
          c: "#D96B27",
          lat: Math.round((-wplaceState.offsetY / 20) * 10000) / 10000,
          lon: Math.round((wplaceState.offsetX / 20) * 10000) / 10000,
          t: now
        };
        state.wplaceRecent[recId] = recObj;
        dbWrite("PUT", "wplace/recent/" + recId, recObj, null);
        renderWplaceRecent();
        fEl.value = "";
        setUploadProgress(100, "Pixel-art drawn on map!");
      } else {
        setUploadProgress(-1);
        showStatus(err, true);
      }
    });
  };
  img.src = objUrl;
}

function getOsmTileImage(z, tx, ty) {
  var maxT = Math.pow(2, z);
  var wrappedX = ((tx % maxT) + maxT) % maxT;
  if (ty < 0 || ty >= maxT) return null;
  var key = z + "/" + wrappedX + "/" + ty;
  if (wplaceTileCache[key]) return wplaceTileCache[key];
  var img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = function() {
    if (state.view === "wplace") renderWplaceCanvas();
  };
  img.src = "https://tile.openstreetmap.org/" + key + ".png";
  wplaceTileCache[key] = img;
  return img;
}

function renderWplaceCanvas() {
  var canvas = document.getElementById("wplaceCanvas");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");
  var w = canvas.width;
  var h = canvas.height;
  var z = wplaceState.zoom;

  ctx.fillStyle = "#DDEEFF";
  ctx.fillRect(0, 0, w, h);

  // Render OpenStreetMap background tiles aligned to geographic coordinates
  var centerLon = wplaceState.offsetX / 20;
  var centerLat = Math.max(-85, Math.min(85, -wplaceState.offsetY / 20));
  var osmZoom = Math.max(3, Math.min(16, Math.round(Math.log(z * 16) / Math.LN2)));
  var nTiles = Math.pow(2, osmZoom);
  var latRad = centerLat * Math.PI / 180;
  var centerTileX = ((centerLon + 180) / 360) * nTiles;
  var centerTileY = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * nTiles;
  var metersPerGrid = 5560;
  var tileMeters = (40075016 * Math.cos(latRad)) / nTiles;
  var tilePx = Math.max(64, (tileMeters / metersPerGrid) * z);

  var spanX = Math.ceil(w / tilePx) + 1;
  var spanY = Math.ceil(h / tilePx) + 1;
  var baseTx = Math.floor(centerTileX);
  var baseTy = Math.floor(centerTileY);

  for (var dy = -spanY; dy <= spanY; dy++) {
    for (var dx = -spanX; dx <= spanX; dx++) {
      var tx = baseTx + dx;
      var ty = baseTy + dy;
      var tileImg = getOsmTileImage(osmZoom, tx, ty);
      if (tileImg && tileImg.complete && tileImg.naturalWidth > 0) {
        var drawX = (w / 2) + (tx - centerTileX) * tilePx;
        var drawY = (h / 2) + (ty - centerTileY) * tilePx;
        ctx.drawImage(tileImg, drawX, drawY, tilePx, tilePx);
      }
    }
  }

  // Subtle coordinate grid overlay when zoomed in
  if (z >= 10) {
    ctx.strokeStyle = "rgba(128, 0, 0, 0.14)";
    ctx.lineWidth = 1;
    var startGx = Math.floor(wplaceState.offsetX - (w / 2) / z);
    var endGx = Math.ceil(wplaceState.offsetX + (w / 2) / z);
    for (var gx = startGx; gx <= endGx; gx++) {
      var sx = Math.round((w / 2) + (gx - wplaceState.offsetX) * z);
      ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, h); ctx.stroke();
    }
    var startGy = Math.floor(wplaceState.offsetY - (h / 2) / z);
    var endGy = Math.ceil(wplaceState.offsetY + (h / 2) / z);
    for (var gy = startGy; gy <= endGy; gy++) {
      var sy = Math.round((h / 2) + (gy - wplaceState.offsetY) * z);
      ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(w, sy); ctx.stroke();
    }
  }

  // Render coordinate-linked pixels
  for (var key in state.wplacePixels) {
    if (!state.wplacePixels.hasOwnProperty(key) || !state.wplacePixels[key]) continue;
    var g = wplaceKeyToGrid(key);
    if (!g) continue;
    var px = (w / 2) + (g.gx - wplaceState.offsetX) * z;
    var py = (h / 2) + (g.gy - wplaceState.offsetY) * z;
    if (px < -z || px > w + z || py < -z || py > h + z) continue;
    ctx.fillStyle = state.wplacePixels[key].c || "#800000";
    ctx.fillRect(Math.floor(px), Math.floor(py), Math.ceil(z), Math.ceil(z));
  }
}

function renderWplaceRecent() {
  var box = document.getElementById("wplaceRecentList");
  if (!box) return;
  var list = [];
  for (var id in state.wplaceRecent) {
    if (state.wplaceRecent.hasOwnProperty(id) && state.wplaceRecent[id]) list.push(state.wplaceRecent[id]);
  }
  list.sort(function(a, b) { return (b.t || 0) - (a.t || 0); });
  var h = "";
  var limit = Math.min(list.length, 15);
  for (var i = 0; i < limit; i++) {
    var r = list[i];
    h += "<div class='wplace-recent-item' onclick=\"jumpWplaceTo(" + Number(r.lat || 0) + "," + Number(r.lon || 0) + ",16)\">" +
           "<span class='wplace-recent-dot' style='background:" + esc(r.c || "#800000") + ";'></span>" +
           "<b>" + esc(r.by || "Anon") + "</b> (" + esc(r.lat) + ", " + esc(r.lon) + ")" +
         "</div>";
  }
  box.innerHTML = h || "<span class='muted'>No changes yet.</span>";
}

/* ==========================================================================
   GLOBAL INPUT LISTENERS FOR SANDBOX, CURSORS & ACTOR
   ========================================================================== */
function initWorldEngine() {
  // Clean up previous page-load client cursor so refreshing never leaves a ghost cursor
  var prevClientId = storeGet("prevClientId");
  if (prevClientId && prevClientId !== myClientId) {
    dbWrite("DELETE", "realtime/cursors/" + prevClientId, null, null);
    dbWrite("DELETE", "realtime/actors/" + prevClientId, null, null);
  }
  storeSet("prevClientId", myClientId);

  window.addEventListener("mousemove", function(e) {
    e = e || window.event;
    worldState.lastMouseX = e.clientX;
    worldState.lastMouseY = e.clientY;
    sendCursorUpdate(false);
  });

  window.addEventListener("touchmove", function(e) {
    if (e.touches && e.touches[0]) {
      worldState.lastMouseX = e.touches[0].clientX;
      worldState.lastMouseY = e.touches[0].clientY;
      sendCursorUpdate(false);
    }
  });

  window.addEventListener("touchstart", function(e) {
    if (e.touches && e.touches[0]) {
      worldState.lastMouseX = e.touches[0].clientX;
      worldState.lastMouseY = e.touches[0].clientY;
      sendCursorUpdate(true);
    }
  });

  window.addEventListener("mouseup", function(e) {
    e = e || window.event;
    if (worldState.grabbedSpriteId) {
      var sp = worldState.sprites[worldState.grabbedSpriteId];
      if (sp) {
        if (worldState.grabMode === "rmb") {
          sp.vx = Math.max(-28, Math.min(28, worldState.throwVx));
          sp.vy = Math.max(-28, Math.min(28, worldState.throwVy));
          sp.vrot = (sp.vx || 1) * 1.4;
        }
        dbWrite("PUT", "realtime/sprites/" + sp.id, sp, null);
      }
      worldState.grabbedSpriteId = null;
      worldState.grabMode = "";
    }
  });

  window.addEventListener("wheel", function(e) {
    if (worldState.grabbedSpriteId && worldState.sprites[worldState.grabbedSpriteId]) {
      if (e.preventDefault) e.preventDefault();
      var sp = worldState.sprites[worldState.grabbedSpriteId];
      sp.rot = (sp.rot || 0) + ((e.deltaY || 0) > 0 ? 18 : -18);
      dbWrite("PUT", "realtime/sprites/" + sp.id, sp, null);
    }
  }, { passive: false });

  window.addEventListener("keydown", function(e) {
    e = e || window.event;
    var tag = (e.target && e.target.tagName || "").toUpperCase();
    var inField = (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT");
    var code = e.keyCode || e.which;

    if (code === 16 || e.key === "Shift") {
      worldState.shiftDownClean = !inField;
      return;
    } else {
      worldState.shiftDownClean = false;
    }

    if (code === 27) {
      closeCursorChatBar();
      togglePropMenu(false);
      closeStickerPicker();
      closeZoomModal();
      return;
    }

    if (inField) return;

    // '/' opens live cursor chat
    if (e.key === "/" || code === 191) {
      if (e.preventDefault) e.preventDefault();
      openCursorChatBar();
      return;
    }

    // 'Q' toggles GMod/S&Box Prop Menu
    if (code === 81 || e.key === "q" || e.key === "Q") {
      togglePropMenu();
      return;
    }

    // 'E' freezes/unfreezes Physgun grabbed sprite
    if ((code === 69 || e.key === "e" || e.key === "E") && worldState.grabbedSpriteId) {
      var sp = worldState.sprites[worldState.grabbedSpriteId];
      if (sp) {
        sp.frozen = !sp.frozen;
        sp.vx = 0; sp.vy = 0; sp.vrot = 0;
        dbWrite("PUT", "realtime/sprites/" + sp.id, sp, null);
        worldState.grabbedSpriteId = null;
        showStatus(sp.frozen ? "Prop frozen!" : "Prop unfrozen!", false);
      }
      return;
    }

    // 'F' kicks images / fights other player models
    if (code === 70 || e.key === "f" || e.key === "F") {
      triggerActorAttack();
      return;
    }

    // WASD / Arrow movement for walkable player model
    if (code === 65 || code === 37) worldState.keys.left = true;
    if (code === 68 || code === 39) worldState.keys.right = true;
    if (code === 87 || code === 38 || code === 32) {
      if (worldState.actorEnabled && e.preventDefault) e.preventDefault();
      worldState.keys.jump = true;
    }
  });

  window.addEventListener("keyup", function(e) {
    e = e || window.event;
    var code = e.keyCode || e.which;
    if ((code === 16 || e.key === "Shift") && worldState.shiftDownClean) {
      worldState.shiftDownClean = false;
      openCursorChatBar();
    }
    if (code === 65 || code === 37) worldState.keys.left = false;
    if (code === 68 || code === 39) worldState.keys.right = false;
    if (code === 87 || code === 38 || code === 32) worldState.keys.jump = false;
  });

  window.addEventListener("beforeunload", function() {
    dbWrite("DELETE", "realtime/cursors/" + myClientId, null, null);
    dbWrite("DELETE", "realtime/actors/" + myClientId, null, null);
  });

  setInterval(stepWorldSimulation, 33);
}
