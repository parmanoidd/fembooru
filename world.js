/* ==========================================================================
   FEMBOORU REALTIME WORLD & WPLACE: MOUSE CURSORS, CURSOR CHAT, WIKIPEDIA
   PROP SPAWNMENU [Q], HL2 TOOLS, SMOOTH 60FPS PHYSICS, ACTORS & GEOPIXELS
   ========================================================================== */
var WIKIPEDIA_PROP_TITLES = [
  "Traffic cone", "Rubber duck", "Microwave oven", "Watermelon",
  "Shopping cart", "Computer monitor", "Chair", "Bicycle",
  "Toaster", "Acoustic guitar", "Barrel", "Anvil",
  "Teapot", "Cactus", "Globe", "Vending machine",
  "Fire extinguisher", "Lawn mower", "Boombox", "Typewriter",
  "Bowling ball", "Couch", "Lamp", "Alarm clock",
  "Telescope", "Skateboard", "Camera", "Drum kit",
  "Chessboard", "Electric fan", "Radio", "Umbrella",
  "Suitcase", "Safe", "Refrigerator", "Washing machine",
  "Hard hat", "Megaphone", "Trophy", "Sandcastle",
  "Garden gnome", "Teddy bear", "Potted plant", "Desk"
];

var WIKIPEDIA_FALLBACK_PROPS = [
  { title: "Traffic cone", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Traffic_cone.jpg/180px-Traffic_cone.jpg" },
  { title: "Rubber duck", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Rubber_duck_assisting_with_debugging.jpg/180px-Rubber_duck_assisting_with_debugging.jpg" },
  { title: "Watermelon", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Taiwan_2009_Tainan_City_Organic_Farm_Watermelon_FRD_7962.jpg/180px-Taiwan_2009_Tainan_City_Organic_Farm_Watermelon_FRD_7962.jpg" },
  { title: "Shopping cart", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Shopping_cart_with_food_clip_art.svg/180px-Shopping_cart_with_food_clip_art.svg.png" },
  { title: "Toaster", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/2-slice_toaster.jpg/180px-2-slice_toaster.jpg" },
  { title: "Anvil", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/Anvil_42.jpg/180px-Anvil_42.jpg" },
  { title: "Teapot", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/A_small_cup_of_tea.JPG/180px-A_small_cup_of_tea.JPG" },
  { title: "Globe", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Geo_Globe.jpg/180px-Geo_Globe.jpg" },
  { title: "Fire extinguisher", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/FireExtinguisherABC.jpg/180px-FireExtinguisherABC.jpg" },
  { title: "Typewriter", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Olivetti_Lettera_22.jpg/180px-Olivetti_Lettera_22.jpg" },
  { title: "Garden gnome", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Gartenzwerg.jpg/180px-Gartenzwerg.jpg" },
  { title: "Bicycle", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/Left_side_of_Flying_Pigeon.jpg/180px-Left_side_of_Flying_Pigeon.jpg" }
];

var WPLACE_COLORS = [
  "#000000", "#555555", "#AAAAAA", "#FFFFFF",
  "#800000", "#CC1105", "#D96B27", "#FFD700",
  "#117743", "#2E8B57", "#008080", "#1E90FF",
  "#000080", "#6A0DAD", "#FF69B4", "#8B4513"
];

var worldAnimRaf = null;
var lastFrameMs = 0;

/* ==========================================================================
   WIKIPEDIA API PROP CATALOG & SPAWNMENU [Q]
   ========================================================================== */
function makePropFallbackSvg(label) {
  var shortTxt = String(label || "PROP").substring(0, 14);
  return "data:image/svg+xml," + encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 96 96'>" +
    "<rect width='96' height='96' fill='#F0E0D6' stroke='#800000' stroke-width='3'/>" +
    "<rect x='14' y='18' width='68' height='44' fill='#EEAA88' stroke='#800000' stroke-width='2'/>" +
    "<text x='48' y='44' font-family='Arial,sans-serif' font-size='10' font-weight='bold' text-anchor='middle' fill='#800000'>" + esc(shortTxt) + "</text>" +
    "<text x='48' y='80' font-family='Arial,sans-serif' font-size='9' text-anchor='middle' fill='#6E5248'>WIKIPEDIA PROP</text>" +
    "</svg>"
  );
}

function togglePropMenu(forceOpen) {
  var modal = document.getElementById("propMenuModal");
  if (!modal) return;
  if (typeof forceOpen === "boolean") worldState.propMenuOpen = forceOpen;
  else worldState.propMenuOpen = !worldState.propMenuOpen;

  modal.style.display = worldState.propMenuOpen ? "block" : "none";
  if (worldState.propMenuOpen) {
    if (!worldState.propCatalog || !worldState.propCatalog.length) {
      refreshPropCatalog();
    } else {
      renderPropMenu();
    }
  }
}

function refreshPropCatalog() {
  var grid = document.getElementById("propMenuGrid");
  if (!worldState.propCatalog || !worldState.propCatalog.length) {
    worldState.propCatalog = WIKIPEDIA_FALLBACK_PROPS.slice(0);
    renderPropMenu();
  } else if (grid) {
    grid.innerHTML = "<div class='muted'>Fetching random Wikipedia prop thumbnails...</div>";
  }

  var pool = WIKIPEDIA_PROP_TITLES.slice(0);
  for (var i = pool.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }
  var picked = pool.slice(0, 22);
  var apiUrl = "https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&prop=pageimages&piprop=thumbnail&pithumbsize=180&titles=" +
    encodeURIComponent(picked.join("|"));

  var xhr = new XMLHttpRequest();
  xhr.open("GET", apiUrl, true);
  xhr.onreadystatechange = function() {
    if (xhr.readyState !== 4) return;
    var loaded = [];
    if (xhr.status === 200) {
      try {
        var json = JSON.parse(xhr.responseText);
        var pages = json && json.query && json.query.pages;
        if (pages) {
          for (var pid in pages) {
            if (pages.hasOwnProperty(pid) && pages[pid] && pages[pid].thumbnail && pages[pid].thumbnail.source) {
              loaded.push({
                title: pages[pid].title || "Wikipedia Prop",
                url: pages[pid].thumbnail.source
              });
            }
          }
        }
      } catch (e) {}
    }
    if (loaded.length >= 4) {
      worldState.propCatalog = loaded;
    } else if (!worldState.propCatalog || !worldState.propCatalog.length) {
      worldState.propCatalog = WIKIPEDIA_FALLBACK_PROPS.slice(0);
    }
    renderPropMenu();
  };
  xhr.onerror = function() {
    if (!worldState.propCatalog || !worldState.propCatalog.length) {
      worldState.propCatalog = WIKIPEDIA_FALLBACK_PROPS.slice(0);
    }
    renderPropMenu();
  };
  xhr.send();
}

function renderPropMenu() {
  var grid = document.getElementById("propMenuGrid");
  if (!grid) return;
  var list = worldState.propCatalog || [];
  var h = "";
  for (var i = 0; i < list.length; i++) {
    var item = list[i];
    var fallback = makePropFallbackSvg(item.title);
    h += "<div class='prop-card' title='" + esc(item.title) + "' onclick=\"spawnCatalogProp(" + i + ")\">" +
           "<img src='" + esc(item.url) + "' referrerpolicy='no-referrer' alt='" + esc(item.title) + "' onerror=\"this.onerror=null;this.src='" + esc(fallback) + "'\">" +
           "<span>" + esc(item.title) + "</span>" +
         "</div>";
  }
  grid.innerHTML = h || "<span class='muted'>No props loaded.</span>";
}

function spawnCatalogProp(idx) {
  var item = worldState.propCatalog && worldState.propCatalog[idx];
  if (!item) return;
  var docW = Math.max(320, document.documentElement.clientWidth || window.innerWidth || 900);
  var scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
  var spawnX = Math.max(40, Math.min(docW - 120, worldState.lastMouseX - 36));
  var spawnY = Math.max(60, scrollY + worldState.lastMouseY - 36);
  spawnWorldSprite(item.url, item.title, spawnX, spawnY, (Math.random() - 0.5) * 140, -120);
  togglePropMenu(false);
}

function selectSandboxTool(toolName) {
  worldState.activeTool = toolName || "physgun";
  var btns = document.querySelectorAll(".tool-btn");
  for (var i = 0; i < btns.length; i++) {
    var t = btns[i].getAttribute("data-tool");
    if (t === worldState.activeTool) btns[i].className = "tool-btn active-tool";
    else btns[i].className = "tool-btn";
  }
  showStatus("Tool selected: " + worldState.activeTool.toUpperCase(), false);
}

/* ==========================================================================
   WORLD SPRITES / PROPS (SPAWN, DRAG, ROTATE, FREEZE, PUNT, THRUSTER, REMOVE)
   ========================================================================== */
function spawnWorldSprite(url, label, x, y, vx, vy) {
  if (!isValidImageSrc(url)) return;
  var sid = generateId("sp");
  var now = new Date().getTime();
  var sp = {
    id: sid,
    url: url,
    label: label || "Prop",
    x: typeof x === "number" ? x : 240,
    y: typeof y === "number" ? y : 200,
    vx: typeof vx === "number" ? vx : 0,
    vy: typeof vy === "number" ? vy : 0,
    rot: 0,
    frozen: false,
    thruster: false,
    by: getDisplayUsername(),
    updatedAt: now
  };
  worldState.sprites[sid] = sp;
  syncSingleSpriteToDb(sp);
}

function syncSingleSpriteToDb(sp) {
  if (!sp || !sp.id) return;
  sp.updatedAt = new Date().getTime();
  dbWrite("PUT", "realtime/sprites/" + sp.id, sp, null);
}

function spawnSpriteFromFile() {
  var fEl = document.getElementById("spriteUploadInput");
  var uEl = document.getElementById("spriteUrlInput");
  var direct = uEl ? safeUrl(uEl.value) : "";
  var scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;

  if (fEl && fEl.files && fEl.files[0]) {
    uploadImageToImgbb(fEl, function(err, url) {
      if (!err && url) {
        fEl.value = "";
        spawnWorldSprite(url, "Custom Sprite", 260, scrollY + 180, 60, -140);
        showStatus("Sprite spawned!", false);
      } else {
        showStatus(err || "Sprite upload failed", true);
      }
    }, { isSticker: true });
  } else if (direct) {
    if (uEl) uEl.value = "";
    spawnWorldSprite(direct, "Custom Sprite", 260, scrollY + 180, 60, -140);
    showStatus("Sprite spawned!", false);
  } else {
    showStatus("Choose a sprite image or enter an image URL.", true);
  }
}

function clearAllWorldProps() {
  worldState.sprites = {};
  var layer = document.getElementById("playgroundLayer");
  if (layer) layer.innerHTML = "";
  worldState.spriteNodes = {};
  dbWrite("DELETE", "realtime/sprites", null, function() {
    showStatus("Cleared all sandbox props.", false);
  });
}

function handleWorldPropPointerDown(sid, e) {
  e = e || window.event;
  if (e.preventDefault) e.preventDefault();
  if (e.stopPropagation) e.stopPropagation();

  var sp = worldState.sprites[sid];
  if (!sp) return;
  var tool = worldState.activeTool || "physgun";

  if (tool === "remover") {
    delete worldState.sprites[sid];
    if (worldState.spriteNodes[sid] && worldState.spriteNodes[sid].parentNode) {
      worldState.spriteNodes[sid].parentNode.removeChild(worldState.spriteNodes[sid]);
    }
    delete worldState.spriteNodes[sid];
    dbWrite("DELETE", "realtime/sprites/" + sid, null, null);
    spawnSparkBurst(sp.x + 32, sp.y + 32, "#CC1105", 10);
    return;
  }

  if (tool === "gravgun") {
    sp.frozen = false;
    var angle = Math.atan2((sp.y + 32) - (e.pageY || e.clientY), (sp.x + 32) - (e.pageX || e.clientX));
    sp.vx = Math.cos(angle) * 780;
    sp.vy = Math.sin(angle) * 780 - 220;
    spawnSparkBurst(sp.x + 32, sp.y + 32, "#FF9900", 14);
    syncSingleSpriteToDb(sp);
    return;
  }

  if (tool === "crowbar") {
    sp.frozen = false;
    sp.vx = (Math.random() > 0.5 ? 1 : -1) * 440;
    sp.vy = -360;
    sp.rot = (sp.rot || 0) + 35;
    spawnSparkBurst(sp.x + 32, sp.y + 32, "#FFD700", 12);
    syncSingleSpriteToDb(sp);
    return;
  }

  if (tool === "thruster") {
    sp.frozen = false;
    sp.thruster = !sp.thruster;
    spawnSparkBurst(sp.x + 32, sp.y + 52, "#1E90FF", 10);
    syncSingleSpriteToDb(sp);
    showStatus(sp.thruster ? "Thruster ON!" : "Thruster OFF.", false);
    return;
  }

  // Default: physgun grab
  worldState.grabbedSpriteId = sid;
  sp.frozen = false;
  sp.vx = 0;
  sp.vy = 0;
}

/* ==========================================================================
   MOUSE CURSORS (CLASSIC ARROW POINTER) & LIVE CURSOR CHAT
   ========================================================================== */
function createMouseCursorSvg() {
  return "<svg class='cursor-mouse-icon' width='16' height='22' viewBox='0 0 16 22' xmlns='http://www.w3.org/2000/svg'>" +
    "<polygon points='1,1 1,18 5,14 8,21 11,19 8,13 14,13' fill='#FFFFFF' stroke='#000000' stroke-width='1.5' stroke-linejoin='round'/>" +
  "</svg>";
}

function openCursorChatBar() {
  var bar = document.getElementById("cursorChatBar");
  var inp = document.getElementById("cursorChatInput");
  if (!bar || !inp) return;
  worldState.cursorChatOpen = true;
  bar.style.display = "flex";
  inp.value = worldState.localChatText || "";
  setTimeout(function() { inp.focus(); }, 10);
}

function closeCursorChatBar() {
  var bar = document.getElementById("cursorChatBar");
  if (bar) bar.style.display = "none";
  worldState.cursorChatOpen = false;
}

function onCursorChatTyping(val) {
  worldState.localChatText = String(val || "").substring(0, 80);
  worldState.localChatExpiresAt = new Date().getTime() + 8000;
  sendCursorPresence(true);
}

function sendCursorPresence(force) {
  var now = new Date().getTime();
  if (!force && (now - worldState.lastCursorSendTime) < 260) return;
  worldState.lastCursorSendTime = now;

  var docW = Math.max(320, document.documentElement.clientWidth || window.innerWidth || 1000);
  var scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
  var relX = Math.max(0, Math.min(1, worldState.lastMouseX / docW));
  var docY = Math.max(0, Math.round(scrollY + worldState.lastMouseY));
  var activeChat = (worldState.localChatExpiresAt > now) ? worldState.localChatText : "";

  var payload = {
    id: myClientId,
    name: getDisplayUsername(),
    relX: Math.round(relX * 10000) / 10000,
    y: docY,
    chat: activeChat,
    updatedAt: now
  };
  worldState.cursors[myClientId] = payload;
  dbWrite("PUT", "realtime/cursors/" + myClientId, payload, null);
}

/* ==========================================================================
   FIREWORKS & CANVAS PARTICLE EFFECTS
   ========================================================================== */
function spawnFirework() {
  var docW = Math.max(320, document.documentElement.clientWidth || window.innerWidth || 1000);
  var scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
  var winH = window.innerHeight || 700;
  var fid = generateId("fw");
  var now = new Date().getTime();
  var fw = {
    id: fid,
    x: Math.round(120 + Math.random() * Math.max(200, docW - 240)),
    y: Math.round(scrollY + winH - 30),
    targetY: Math.round(scrollY + 90 + Math.random() * Math.max(120, winH * 0.42)),
    color: ["#CC1105", "#FF8C00", "#1E90FF", "#2E8B57", "#9932CC"][Math.floor(Math.random() * 5)],
    by: getDisplayUsername(),
    createdAt: now
  };
  worldState.fireworks[fid] = fw;
  dbWrite("PUT", "realtime/fireworks/" + fid, fw, null);
}

function spawnSparkBurst(docX, docY, color, count) {
  var scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
  var vxBase = docX;
  var vyBase = docY - scrollY;
  var n = count || 18;
  for (var i = 0; i < n; i++) {
    var ang = (Math.PI * 2 * i) / n + (Math.random() * 0.25);
    var spd = 70 + Math.random() * 210;
    worldState.particles.push({
      x: vxBase,
      y: vyBase,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      life: 0.55 + Math.random() * 0.45,
      maxLife: 1.0,
      color: color || "#FFD700",
      size: 2.5 + Math.random() * 2.5
    });
  }
}

/* ==========================================================================
   PLAYABLE 2D CHARACTER ACTOR (WASD + JUMP + [F] ATTACK)
   ========================================================================== */
function togglePlayerActor() {
  worldState.actorEnabled = !worldState.actorEnabled;
  var btn = document.getElementById("toggleActorBtn");
  if (btn) btn.textContent = worldState.actorEnabled ? "Despawn Model" : "Spawn Model (WASD)";

  if (worldState.actorEnabled) {
    var scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
    worldState.myActor.x = 460;
    worldState.myActor.y = scrollY + 180;
    worldState.myActor.vx = 0;
    worldState.myActor.vy = 0;
    worldState.myActor.hp = 100;
    syncMyActorToDb(true);
    showStatus("Model spawned! Use [W][A][S][D] or Arrows to move, [F] to hit.", false);
  } else {
    delete worldState.actors[myClientId];
    if (worldState.actorNodes[myClientId] && worldState.actorNodes[myClientId].parentNode) {
      worldState.actorNodes[myClientId].parentNode.removeChild(worldState.actorNodes[myClientId]);
    }
    delete worldState.actorNodes[myClientId];
    dbWrite("DELETE", "realtime/actors/" + myClientId, null, null);
  }
}

function setActorKey(dir, isDown) {
  if (worldState.keys && worldState.keys.hasOwnProperty(dir)) {
    worldState.keys[dir] = Boolean(isDown);
  }
}

function triggerActorAttack() {
  if (!worldState.actorEnabled) return;
  var now = new Date().getTime();
  worldState.myActor.swingUntil = now + 260;
  var hitX = worldState.myActor.x + (worldState.myActor.facing > 0 ? 34 : -14);
  var hitY = worldState.myActor.y + 20;
  spawnSparkBurst(hitX, hitY, "#FFD700", 10);

  // Knock nearby props
  for (var sid in worldState.sprites) {
    if (!worldState.sprites.hasOwnProperty(sid) || !worldState.sprites[sid]) continue;
    var sp = worldState.sprites[sid];
    var dx = (sp.x + 30) - hitX;
    var dy = (sp.y + 30) - hitY;
    if ((dx * dx + dy * dy) < 6400) {
      sp.frozen = false;
      sp.vx = worldState.myActor.facing * 420;
      sp.vy = -260;
      syncSingleSpriteToDb(sp);
    }
  }
  syncMyActorToDb(true);
}

function syncMyActorToDb(force) {
  if (!worldState.actorEnabled) return;
  var now = new Date().getTime();
  if (!force && (now - worldState.lastActorSendTime) < 220) return;
  worldState.lastActorSendTime = now;

  var avatar = (state.profile && isValidImageSrc(state.profile.avatar)) ? state.profile.avatar : DEFAULT_AVATAR_SVG;
  var payload = {
    id: myClientId,
    name: getDisplayUsername(),
    avatar: avatar,
    x: Math.round(worldState.myActor.x),
    y: Math.round(worldState.myActor.y),
    facing: worldState.myActor.facing,
    hp: worldState.myActor.hp,
    swingUntil: worldState.myActor.swingUntil,
    updatedAt: now
  };
  worldState.actors[myClientId] = payload;
  dbWrite("PUT", "realtime/actors/" + myClientId, payload, null);
}

/* ==========================================================================
   60FPS WORLD ENGINE (SMOOTH DOM POOLING + LERP, ZERO-JITTER ANIMATION)
   ========================================================================== */
function initWorldEngine() {
  document.addEventListener("mousemove", function(e) {
    e = e || window.event;
    var prevX = worldState.lastMouseX;
    var prevY = worldState.lastMouseY;
    worldState.lastMouseX = e.clientX;
    worldState.lastMouseY = e.clientY;
    worldState.throwVx = (e.clientX - prevX) * 28;
    worldState.throwVy = (e.clientY - prevY) * 28;

    if (worldState.grabbedSpriteId && worldState.sprites[worldState.grabbedSpriteId]) {
      var sp = worldState.sprites[worldState.grabbedSpriteId];
      var scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
      sp.x = Math.round(e.clientX - 32);
      sp.y = Math.round(scrollY + e.clientY - 32);
      sp.vx = 0;
      sp.vy = 0;
    }

    sendCursorPresence(false);
  });

  document.addEventListener("mouseup", function() {
    if (worldState.grabbedSpriteId) {
      var sp = worldState.sprites[worldState.grabbedSpriteId];
      worldState.grabbedSpriteId = null;
      if (sp) {
        sp.vx = Math.max(-900, Math.min(900, worldState.throwVx));
        sp.vy = Math.max(-900, Math.min(900, worldState.throwVy));
        syncSingleSpriteToDb(sp);
      }
    }
  });

  document.addEventListener("wheel", function(e) {
    if (worldState.grabbedSpriteId && worldState.sprites[worldState.grabbedSpriteId]) {
      var sp = worldState.sprites[worldState.grabbedSpriteId];
      sp.rot = ((sp.rot || 0) + (e.deltaY > 0 ? 18 : -18)) % 360;
    }
  }, { passive: true });

  document.addEventListener("contextmenu", function(e) {
    var tgt = e.target || e.srcElement;
    var tag = tgt && tgt.tagName ? tgt.tagName.toUpperCase() : "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "A" || tag === "BUTTON" || tag === "CANVAS" || tag === "IMG") return;
    if (e.preventDefault) e.preventDefault();
    var cat = (worldState.propCatalog && worldState.propCatalog.length) ? worldState.propCatalog : WIKIPEDIA_FALLBACK_PROPS;
    var pick = cat[Math.floor(Math.random() * cat.length)];
    var scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
    spawnWorldSprite(pick.url, pick.title, e.clientX - 28, scrollY + e.clientY - 28, (Math.random() - 0.5) * 420, -280);
  });

  lastFrameMs = new Date().getTime();
  function tickWorld() {
    var now = new Date().getTime();
    var dt = Math.min(0.05, Math.max(0.004, (now - lastFrameMs) / 1000));
    lastFrameMs = now;

    stepWorldPhysics(dt, now);
    renderWorldDom(dt, now);
    renderFxParticles(dt);

    worldAnimRaf = window.requestAnimationFrame(tickWorld);
  }
  if (window.requestAnimationFrame) {
    worldAnimRaf = window.requestAnimationFrame(tickWorld);
  } else {
    setInterval(tickWorld, 33);
  }
}

function stepWorldPhysics(dt, now) {
  var docW = Math.max(320, document.documentElement.clientWidth || window.innerWidth || 1000);
  var floorY = Math.max(600, (document.documentElement.scrollHeight || 900) - 86);

  // Step sprites
  for (var sid in worldState.sprites) {
    if (!worldState.sprites.hasOwnProperty(sid) || !worldState.sprites[sid]) continue;
    var sp = worldState.sprites[sid];
    if (sid === worldState.grabbedSpriteId || sp.frozen) continue;

    if (sp.thruster) {
      sp.vy -= 920 * dt;
      sp.vx += Math.sin(now * 0.01) * 140 * dt;
    } else {
      sp.vy += 680 * dt;
    }

    sp.x += (sp.vx || 0) * dt;
    sp.y += (sp.vy || 0) * dt;
    sp.vx *= (1 - 0.6 * dt);

    if (sp.x < 8) { sp.x = 8; sp.vx = Math.abs(sp.vx) * 0.72; }
    if (sp.x > docW - 84) { sp.x = docW - 84; sp.vx = -Math.abs(sp.vx) * 0.72; }
    if (sp.y < 10) { sp.y = 10; sp.vy = Math.abs(sp.vy) * 0.6; }
    if (sp.y > floorY) {
      sp.y = floorY;
      sp.vy = -Math.abs(sp.vy) * 0.52;
      sp.vx *= 0.86;
      if (Math.abs(sp.vy) < 24) sp.vy = 0;
    }
  }

  // Step fireworks
  for (var fid in worldState.fireworks) {
    if (!worldState.fireworks.hasOwnProperty(fid) || !worldState.fireworks[fid]) continue;
    var fw = worldState.fireworks[fid];
    if (worldState.explodedFireworks[fid]) continue;
    fw.y -= 340 * dt;
    if (fw.y <= (fw.targetY || 140) || (now - (fw.createdAt || now)) > 2600) {
      worldState.explodedFireworks[fid] = true;
      spawnSparkBurst(fw.x, fw.y, fw.color || "#FFD700", 26);
      delete worldState.fireworks[fid];
      dbWrite("DELETE", "realtime/fireworks/" + fid, null, null);
    }
  }

  // Step local player actor
  if (worldState.actorEnabled) {
    var a = worldState.myActor;
    var moveSpeed = 260;
    if (worldState.keys.left) { a.vx = -moveSpeed; a.facing = -1; }
    else if (worldState.keys.right) { a.vx = moveSpeed; a.facing = 1; }
    else { a.vx *= (1 - 10 * dt); }

    if (worldState.keys.jump && a.grounded) {
      a.vy = -440;
      a.grounded = false;
    }
    a.vy += 980 * dt;
    a.x += a.vx * dt;
    a.y += a.vy * dt;

    var actorFloor = Math.max(400, (document.documentElement.scrollHeight || 800) - 52);
    if (a.x < 10) a.x = 10;
    if (a.x > docW - 46) a.x = docW - 46;
    if (a.y >= actorFloor) {
      a.y = actorFloor;
      a.vy = 0;
      a.grounded = true;
    }
    syncMyActorToDb(false);
  }
}

function renderWorldDom(dt, now) {
  var docW = Math.max(320, document.documentElement.clientWidth || window.innerWidth || 1000);
  var lerpAlpha = Math.min(1, dt * 14);

  // 1. Render Sprites (Persistent DOM Nodes)
  var spLayer = document.getElementById("playgroundLayer");
  if (spLayer) {
    for (var sid in worldState.spriteNodes) {
      if (worldState.spriteNodes.hasOwnProperty(sid) && !worldState.sprites[sid]) {
        if (worldState.spriteNodes[sid].parentNode) worldState.spriteNodes[sid].parentNode.removeChild(worldState.spriteNodes[sid]);
        delete worldState.spriteNodes[sid];
      }
    }
    for (var id in worldState.sprites) {
      if (!worldState.sprites.hasOwnProperty(id) || !worldState.sprites[id]) continue;
      var sp = worldState.sprites[id];
      var node = worldState.spriteNodes[id];
      if (!node) {
        node = document.createElement("img");
        node.className = "world-sprite";
        node.setAttribute("referrerpolicy", "no-referrer");
        node.src = sp.url;
        node.title = (sp.label || "Prop") + " (by " + (sp.by || "Anon") + ")";
        (function(spriteId) {
          node.onmousedown = function(ev) { handleWorldPropPointerDown(spriteId, ev); };
          node.ontouchstart = function(ev) { handleWorldPropPointerDown(spriteId, ev); };
        })(id);
        spLayer.appendChild(node);
        worldState.spriteNodes[id] = node;
      }
      node.style.left = Math.round(sp.x) + "px";
      node.style.top = Math.round(sp.y) + "px";
      node.style.transform = "rotate(" + Math.round(sp.rot || 0) + "deg)";
      node.style.outline = sp.frozen ? "2px solid #1E90FF" : "none";
    }
  }

  // 2. Render Fireworks (Persistent DOM Nodes)
  if (spLayer) {
    for (var fnId in worldState.fireworkNodes) {
      if (worldState.fireworkNodes.hasOwnProperty(fnId) && !worldState.fireworks[fnId]) {
        if (worldState.fireworkNodes[fnId].parentNode) worldState.fireworkNodes[fnId].parentNode.removeChild(worldState.fireworkNodes[fnId]);
        delete worldState.fireworkNodes[fnId];
      }
    }
    for (var fid in worldState.fireworks) {
      if (!worldState.fireworks.hasOwnProperty(fid) || !worldState.fireworks[fid]) continue;
      var fw = worldState.fireworks[fid];
      var fNode = worldState.fireworkNodes[fid];
      if (!fNode) {
        fNode = document.createElement("div");
        fNode.className = "world-firework";
        fNode.textContent = "FW";
        spLayer.appendChild(fNode);
        worldState.fireworkNodes[fid] = fNode;
      }
      fNode.style.left = Math.round(fw.x) + "px";
      fNode.style.top = Math.round(fw.y) + "px";
    }
  }

  // 3. Render Remote Mouse Cursors + Local Chat Bubble (Smooth LERP)
  var curLayer = document.getElementById("cursorsLayer");
  if (curLayer) {
    for (var cId in worldState.cursorNodes) {
      if (worldState.cursorNodes.hasOwnProperty(cId)) {
        var cData = worldState.cursors[cId];
        var isStale = !cData || ((now - (cData.updatedAt || 0)) > 15000);
        var hideLocal = (cId === myClientId && !(worldState.localChatExpiresAt > now && worldState.localChatText));
        if (isStale || hideLocal) {
          if (worldState.cursorNodes[cId].parentNode) worldState.cursorNodes[cId].parentNode.removeChild(worldState.cursorNodes[cId]);
          delete worldState.cursorNodes[cId];
        }
      }
    }

    for (var cid in worldState.cursors) {
      if (!worldState.cursors.hasOwnProperty(cid) || !worldState.cursors[cid]) continue;
      var cur = worldState.cursors[cid];
      if ((now - (cur.updatedAt || 0)) > 15000) continue;

      var isMe = (cid === myClientId);
      if (isMe && !(worldState.localChatExpiresAt > now && worldState.localChatText)) continue;

      var targetX = isMe ? worldState.lastMouseX : Math.round((cur.relX || 0) * docW);
      var scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
      var targetY = isMe ? (scrollY + worldState.lastMouseY) : (cur.y || 0);

      var cNode = worldState.cursorNodes[cid];
      if (!cNode) {
        cNode = document.createElement("div");
        cNode.className = "remote-cursor";
        cNode.innerHTML =
          (isMe ? "" : createMouseCursorSvg()) +
          "<div class='cursor-hud'>" +
            "<div class='cursor-chat-bubble' style='display:none;'></div>" +
            "<div class='cursor-name-tag'></div>" +
          "</div>";
        cNode._curX = targetX;
        cNode._curY = targetY;
        curLayer.appendChild(cNode);
        worldState.cursorNodes[cid] = cNode;
      }

      if (isMe) {
        cNode._curX = targetX;
        cNode._curY = targetY;
      } else {
        cNode._curX += (targetX - cNode._curX) * lerpAlpha;
        cNode._curY += (targetY - cNode._curY) * lerpAlpha;
      }

      cNode.style.left = Math.round(cNode._curX) + "px";
      cNode.style.top = Math.round(cNode._curY) + "px";

      var nameEl = cNode.querySelector(".cursor-name-tag");
      if (nameEl) {
        nameEl.style.display = isMe ? "none" : "inline-block";
        if (!isMe && nameEl.textContent !== (cur.name || "Anon")) {
          nameEl.textContent = cur.name || "Anon";
        }
      }

      var chatEl = cNode.querySelector(".cursor-chat-bubble");
      var chatMsg = isMe ? ((worldState.localChatExpiresAt > now) ? worldState.localChatText : "") : (cur.chat || "");
      if (chatEl) {
        if (chatMsg) {
          chatEl.style.display = "block";
          if (chatEl.textContent !== chatMsg) chatEl.textContent = chatMsg;
        } else {
          chatEl.style.display = "none";
        }
      }
    }
  }

  // 4. Render 2D Player Actors (Smooth LERP)
  var actLayer = document.getElementById("actorsLayer");
  if (actLayer) {
    for (var aNodeId in worldState.actorNodes) {
      if (worldState.actorNodes.hasOwnProperty(aNodeId)) {
        var aInfo = worldState.actors[aNodeId];
        if (!aInfo || ((now - (aInfo.updatedAt || 0)) > 15000)) {
          if (worldState.actorNodes[aNodeId].parentNode) worldState.actorNodes[aNodeId].parentNode.removeChild(worldState.actorNodes[aNodeId]);
          delete worldState.actorNodes[aNodeId];
        }
      }
    }

    for (var aid in worldState.actors) {
      if (!worldState.actors.hasOwnProperty(aid) || !worldState.actors[aid]) continue;
      var act = worldState.actors[aid];
      if ((now - (act.updatedAt || 0)) > 15000) continue;
      var isSelf = (aid === myClientId);
      var ax = isSelf ? worldState.myActor.x : (act.x || 300);
      var ay = isSelf ? worldState.myActor.y : (act.y || 200);
      var facing = isSelf ? worldState.myActor.facing : (act.facing || 1);
      var swinging = isSelf ? (worldState.myActor.swingUntil > now) : ((act.swingUntil || 0) > now);

      var aNode = worldState.actorNodes[aid];
      if (!aNode) {
        aNode = document.createElement("div");
        aNode.className = "player-actor";
        aNode.innerHTML =
          "<div class='actor-tag'></div>" +
          "<img class='actor-head' src='" + esc(isValidImageSrc(act.avatar) ? act.avatar : DEFAULT_AVATAR_SVG) + "' alt='head'>" +
          "<div class='actor-body'></div>" +
          "<div class='actor-weapon'></div>";
        aNode._ax = ax;
        aNode._ay = ay;
        actLayer.appendChild(aNode);
        worldState.actorNodes[aid] = aNode;
      }

      if (isSelf) {
        aNode._ax = ax;
        aNode._ay = ay;
      } else {
        aNode._ax += (ax - aNode._ax) * lerpAlpha;
        aNode._ay += (ay - aNode._ay) * lerpAlpha;
      }

      aNode.style.left = Math.round(aNode._ax) + "px";
      aNode.style.top = Math.round(aNode._ay) + "px";
      var tagEl = aNode.querySelector(".actor-tag");
      if (tagEl && tagEl.textContent !== (act.name || "Player")) tagEl.textContent = act.name || "Player";
      var wepEl = aNode.querySelector(".actor-weapon");
      if (wepEl) {
        wepEl.style.left = facing > 0 ? "24px" : "-6px";
        wepEl.style.transform = swinging ? ("rotate(" + (facing > 0 ? "55deg" : "-55deg") + ")") : "rotate(0deg)";
      }
    }
  }
}

function renderFxParticles(dt) {
  var canvas = document.getElementById("fxCanvas");
  if (!canvas || !canvas.getContext) return;
  if (!worldState.particles.length && !worldState.hadFx) return;

  var w = window.innerWidth || 1000;
  var h = window.innerHeight || 700;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  var ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, w, h);

  if (!worldState.particles.length) {
    worldState.hadFx = false;
    return;
  }
  worldState.hadFx = true;

  for (var i = worldState.particles.length - 1; i >= 0; i--) {
    var p = worldState.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      worldState.particles.splice(i, 1);
      continue;
    }
    p.vy += 320 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.maxLife));
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

/* ==========================================================================
   WPLACE / GEOPIXELS INTERACTIVE PIXEL MAP
   ========================================================================== */
function initWplaceMap() {
  var palBox = document.getElementById("wplacePalette");
  if (palBox) {
    var h = "";
    for (var i = 0; i < WPLACE_COLORS.length; i++) {
      var col = WPLACE_COLORS[i];
      var act = (col === wplaceState.selectedColor) ? " active-swatch" : "";
      h += "<span class='color-swatch" + act + "' style='background:" + col + ";' onclick=\"pickWplaceColor('" + col + "', this)\"></span>";
    }
    palBox.innerHTML = h;
  }

  var canvas = document.getElementById("wplaceCanvas");
  if (!canvas) return;

  function getGridCoord(clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    var scaleX = canvas.width / Math.max(1, rect.width);
    var scaleY = canvas.height / Math.max(1, rect.height);
    var cx = (clientX - rect.left) * scaleX;
    var cy = (clientY - rect.top) * scaleY;
    var z = wplaceState.zoom;
    var gx = Math.floor((cx - canvas.width / 2) / z) + wplaceState.offsetX;
    var gy = Math.floor((cy - canvas.height / 2) / z) + wplaceState.offsetY;
    return { gx: gx, gy: gy, cx: cx, cy: cy };
  }

  function paintAt(clientX, clientY) {
    var pt = getGridCoord(clientX, clientY);
    var key = pt.gx + "_" + pt.gy;
    if (key === wplaceState.lastDrawnKey) return;
    wplaceState.lastDrawnKey = key;

    var color = wplaceState.selectedColor || "#800000";
    state.wplacePixels[key] = color;
    renderWplaceCanvas();

    var lat = (-pt.gy / 20).toFixed(4);
    var lon = (pt.gx / 20).toFixed(4);
    var lbl = document.getElementById("wplaceCoords");
    if (lbl) lbl.textContent = "Lat: " + lat + ", Lon: " + lon + " • Zoom: " + wplaceState.zoom;

    dbWrite("PUT", "wplace/pixels/" + key, color, null);
    var recId = generateId("wpix");
    var recObj = {
      id: recId,
      gx: pt.gx,
      gy: pt.gy,
      lat: lat,
      lon: lon,
      color: color,
      by: getDisplayUsername(),
      createdAt: new Date().getTime()
    };
    state.wplaceRecent[recId] = recObj;
    renderWplaceRecent();
    dbWrite("PUT", "wplace/recent/" + recId, recObj, null);
  }

  canvas.onmousedown = function(e) {
    e = e || window.event;
    wplaceState.isDrawing = true;
    wplaceState.lastDrawnKey = "";
    if (wplaceState.panMode || e.button === 1 || e.button === 2) {
      wplaceState.panStartX = e.clientX;
      wplaceState.panStartY = e.clientY;
    } else {
      paintAt(e.clientX, e.clientY);
    }
  };

  canvas.onmousemove = function(e) {
    e = e || window.event;
    var pt = getGridCoord(e.clientX, e.clientY);
    var lbl = document.getElementById("wplaceCoords");
    if (lbl) lbl.textContent = "Lat: " + (-pt.gy / 20).toFixed(4) + ", Lon: " + (pt.gx / 20).toFixed(4) + " • Zoom: " + wplaceState.zoom;

    if (!wplaceState.isDrawing) return;
    if (wplaceState.panMode) {
      var dx = e.clientX - wplaceState.panStartX;
      var dy = e.clientY - wplaceState.panStartY;
      if (Math.abs(dx) >= wplaceState.zoom || Math.abs(dy) >= wplaceState.zoom) {
        wplaceState.offsetX -= Math.round(dx / wplaceState.zoom);
        wplaceState.offsetY -= Math.round(dy / wplaceState.zoom);
        wplaceState.panStartX = e.clientX;
        wplaceState.panStartY = e.clientY;
        renderWplaceCanvas();
      }
    } else {
      paintAt(e.clientX, e.clientY);
    }
  };

  window.addEventListener("mouseup", function() {
    wplaceState.isDrawing = false;
    wplaceState.lastDrawnKey = "";
  });

  // Start centered over Ukraine / Pridnestrovie
  jumpWplaceTo(48.40, 31.10, 12);
}

function pickWplaceColor(hex, swatchEl) {
  wplaceState.selectedColor = hex;
  wplaceState.panMode = false;
  var panBtn = document.getElementById("wplacePanBtn");
  if (panBtn) panBtn.className = "";
  var all = document.querySelectorAll("#wplacePalette .color-swatch");
  for (var i = 0; i < all.length; i++) all[i].className = "color-swatch";
  if (swatchEl) swatchEl.className = "color-swatch active-swatch";
}

function toggleWplacePan() {
  wplaceState.panMode = !wplaceState.panMode;
  var panBtn = document.getElementById("wplacePanBtn");
  if (panBtn) panBtn.className = wplaceState.panMode ? "btn-active" : "";
}

function zoomWplace(delta) {
  wplaceState.zoom = Math.max(4, Math.min(36, wplaceState.zoom + delta));
  renderWplaceCanvas();
}

function renderWplaceCanvas() {
  var canvas = document.getElementById("wplaceCanvas");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");
  var w = canvas.width;
  var h = canvas.height;
  var z = wplaceState.zoom;

  ctx.fillStyle = "#F5EFE6";
  ctx.fillRect(0, 0, w, h);

  var halfCols = Math.ceil(w / (2 * z)) + 1;
  var halfRows = Math.ceil(h / (2 * z)) + 1;
  var minGx = wplaceState.offsetX - halfCols;
  var maxGx = wplaceState.offsetX + halfCols;
  var minGy = wplaceState.offsetY - halfRows;
  var maxGy = wplaceState.offsetY + halfRows;

  // Geographic reference markers (Kyiv, Odesa, Tiraspol)
  var cities = [
    { name: "Kyiv", gx: Math.round(30.52 * 20), gy: Math.round(-50.45 * 20) },
    { name: "Odesa", gx: Math.round(30.72 * 20), gy: Math.round(-46.48 * 20) },
    { name: "Tiraspol", gx: Math.round(29.63 * 20), gy: Math.round(-46.84 * 20) }
  ];

  // Grid lines
  if (z >= 8) {
    ctx.strokeStyle = "#E5D8CE";
    ctx.lineWidth = 1;
    for (var gx = minGx; gx <= maxGx; gx++) {
      var sx = Math.floor(w / 2 + (gx - wplaceState.offsetX) * z);
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, h);
      ctx.stroke();
    }
    for (var gy = minGy; gy <= maxGy; gy++) {
      var sy = Math.floor(h / 2 + (gy - wplaceState.offsetY) * z);
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(w, sy);
      ctx.stroke();
    }
  }

  // Painted pixels
  for (var key in state.wplacePixels) {
    if (!state.wplacePixels.hasOwnProperty(key) || !state.wplacePixels[key]) continue;
    var parts = key.split("_");
    var px = parseInt(parts[0], 10);
    var py = parseInt(parts[1], 10);
    if (px < minGx || px > maxGx || py < minGy || py > maxGy) continue;
    var drawX = Math.floor(w / 2 + (px - wplaceState.offsetX) * z);
    var drawY = Math.floor(h / 2 + (py - wplaceState.offsetY) * z);
    ctx.fillStyle = state.wplacePixels[key];
    ctx.fillRect(drawX, drawY, z, z);
  }

  // City labels
  ctx.fillStyle = "#800000";
  ctx.font = "bold 11px Arial, sans-serif";
  for (var c = 0; c < cities.length; c++) {
    var cx = Math.floor(w / 2 + (cities[c].gx - wplaceState.offsetX) * z);
    var cy = Math.floor(h / 2 + (cities[c].gy - wplaceState.offsetY) * z);
    if (cx >= -40 && cx <= w + 40 && cy >= -20 && cy <= h + 20) {
      ctx.fillRect(cx - 2, cy - 2, 5, 5);
      ctx.fillText(cities[c].name, cx + 6, cy + 4);
    }
  }
}

function renderWplaceRecent() {
  var box = document.getElementById("wplaceRecentList");
  if (!box) return;
  var list = [];
  for (var id in state.wplaceRecent) {
    if (state.wplaceRecent.hasOwnProperty(id) && state.wplaceRecent[id]) list.push(state.wplaceRecent[id]);
  }
  list.sort(function(a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
  var h = "";
  for (var i = 0; i < Math.min(18, list.length); i++) {
    var r = list[i];
    h += "<div class='wplace-recent-item' onclick='jumpWplaceTo(" + Number(r.lat || 48.4) + "," + Number(r.lon || 31.1) + ",16)'>" +
           "<span class='wplace-recent-dot' style='background:" + esc(r.color || "#800000") + ";'></span>" +
           "<b>" + esc(r.by || "Anon") + "</b> (" + esc(r.lat) + ", " + esc(r.lon) + ")" +
         "</div>";
  }
  box.innerHTML = h || "<span class='muted'>No pixel edits yet.</span>";
}

function stampImageToWplace() {
  var fEl = document.getElementById("wplaceImageFile");
  if (!fEl || !fEl.files || !fEl.files[0]) {
    showStatus("Select an image first to stamp onto the map.", true);
    return;
  }
  var file = fEl.files[0];
  var img = new Image();
  var objUrl = URL.createObjectURL(file);
  img.onload = function() {
    URL.revokeObjectURL(objUrl);
    var maxD = SERVICE_POLICY.wplaceStampMaxDim;
    var scale = Math.min(maxD / Math.max(1, img.width), maxD / Math.max(1, img.height), 1);
    var sw = Math.max(4, Math.round(img.width * scale));
    var sh = Math.max(4, Math.round(img.height * scale));
    var off = document.createElement("canvas");
    off.width = sw;
    off.height = sh;
    var octx = off.getContext("2d");
    octx.drawImage(img, 0, 0, sw, sh);
    var data = octx.getImageData(0, 0, sw, sh).data;

    var patch = {};
    var startX = wplaceState.offsetX - Math.floor(sw / 2);
    var startY = wplaceState.offsetY - Math.floor(sh / 2);
    var count = 0;

    function toHex(v) { var s = v.toString(16); return s.length < 2 ? "0" + s : s; }

    for (var y = 0; y < sh; y++) {
      for (var x = 0; x < sw; x++) {
        var idx = (y * sw + x) * 4;
        if (data[idx + 3] < 90) continue;
        var hex = "#" + toHex(data[idx]) + toHex(data[idx + 1]) + toHex(data[idx + 2]);
        var k = (startX + x) + "_" + (startY + y);
        state.wplacePixels[k] = hex;
        patch[k] = hex;
        count++;
      }
    }

    renderWplaceCanvas();
    fEl.value = "";
    dbWrite("PATCH", "wplace/pixels", patch, function(err) {
      if (!err) showStatus("Stamped " + count + " pixels onto WPlace map!", false);
      else showStatus("Stamp sync error: " + err, true);
    });
  };
  img.onerror = function() {
    URL.revokeObjectURL(objUrl);
    showStatus("Could not decode image.", true);
  };
  img.src = objUrl;
}
