/* ==========================================================================
   FEMBOORU APPLICATION CONTROLLER: CLICK-SAFE VIEW ROUTING, REALTIME SYNC,
   AUTHORITATIVE SPRITE RECONCILIATION, HOTKEYS & BOOTSTRAP
   ========================================================================== */
var pendingDeferredRender = false;
var lastSidebarSig = "";
var lastActiveViewSig = "";

function switchView(viewName) {
  state.view = viewName || "boards";
  lastActiveViewSig = "";
  worldState.lastPlatformScan = 0;

  var sections = document.querySelectorAll(".view-section");
  for (var i = 0; i < sections.length; i++) {
    sections[i].className = (sections[i].id === "view-" + state.view) ? "view-section active" : "view-section";
  }

  var navBtns = document.querySelectorAll(".top-nav-links button");
  var viewOrder = ["boards", "wall", "profile", "members", "groups", "dms", "stickers", "wplace", "notifications"];
  for (var j = 0; j < navBtns.length; j++) {
    navBtns[j].className = (viewOrder[j] === state.view) ? "active-nav" : "";
  }

  renderActiveViewOnly(true);
  sendCursorPresence(true);
}

function renderActiveViewOnly(force) {
  var sbSig = JSON.stringify({ b: state.boards, cb: state.currentBoard });
  if (force || sbSig !== lastSidebarSig) {
    lastSidebarSig = sbSig;
    renderBoardsSidebar();
  }

  var viewPayload = null;
  if (state.view === "boards") {
    viewPayload = { v: "boards", cb: state.currentBoard, t: state.threads, p: state.polls, u: state.users };
  } else if (state.view === "wall") {
    viewPayload = { v: "wall", wf: state.wallFilter, w: state.walls, sub: state.subscriptions, u: state.users };
  } else if (state.view === "profile") {
    viewPayload = { v: "profile", vp: state.viewedProfileUid, u: state.users, w: state.walls, sub: state.subscriptions, blk: state.blocks };
  } else if (state.view === "members") {
    viewPayload = { v: "members", u: state.users, sub: state.subscriptions };
  } else if (state.view === "groups") {
    viewPayload = { v: "groups", g: state.groups, ag: state.activeGroupId, u: state.users };
  } else if (state.view === "dms") {
    viewPayload = { v: "dms", d: state.dms, ad: state.activeDmUid, u: state.users };
  } else if (state.view === "stickers") {
    viewPayload = { v: "stickers", s: state.stickers, u: state.users };
  } else if (state.view === "wplace") {
    viewPayload = { v: "wplace", wp: countMapKeys(state.wplacePixels), wpr: state.wplaceRecent };
  } else if (state.view === "notifications") {
    viewPayload = { v: "notifications", n: state.user ? state.notifications[state.user.uid] : null };
  }

  var vSig = JSON.stringify(viewPayload);
  if (!force && vSig === lastActiveViewSig) return;
  lastActiveViewSig = vSig;
  worldState.lastPlatformScan = 0;

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
    renderWplaceRecent();
  } else if (state.view === "notifications") {
    renderNotifications();
  }
}

function renderAll() {
  // Never destroy DOM elements mid-click while user pointer is pressed
  if (worldState.isPointerDown) {
    pendingDeferredRender = true;
    return;
  }
  pendingDeferredRender = false;

  var logoImg = document.getElementById("siteLogoImg");
  if (logoImg) {
    var targetLogo = isValidImageSrc(state.siteLogo) ? state.siteLogo : DEFAULT_SITE_LOGO;
    if (logoImg.src !== targetLogo) logoImg.src = targetLogo;
  }

  updateAuthUi();
  rebuildMusicPlaylist();
  updateNotifBadge();
  syncSnowState();
  syncTabLogoState();
  renderActiveViewOnly(false);
}

function mergeBoardsList(dbBoards) {
  var merged = [];
  var seen = {};
  for (var i = 0; i < DEFAULT_BOARDS.length; i++) {
    merged.push(DEFAULT_BOARDS[i]);
    seen[DEFAULT_BOARDS[i].slug] = true;
  }
  if (dbBoards && typeof dbBoards === "object") {
    for (var slug in dbBoards) {
      if (dbBoards.hasOwnProperty(slug) && dbBoards[slug] && !seen[slug]) {
        merged.push(dbBoards[slug]);
        seen[slug] = true;
      }
    }
  }
  state.boards = merged;
}

function applyRealtimeSnapshot(rt, effects) {
  var now = new Date().getTime();
  if (rt && typeof rt === "object") {
    // 1. Merge remote cursors without overwriting local cursor
    var incomingCursors = rt.cursors || {};
    for (var cid in worldState.cursors) {
      if (worldState.cursors.hasOwnProperty(cid) && cid !== myClientId && !incomingCursors[cid]) {
        delete worldState.cursors[cid];
      }
    }
    for (var icid in incomingCursors) {
      if (incomingCursors.hasOwnProperty(icid) && icid !== myClientId && incomingCursors[icid]) {
        if ((now - (incomingCursors[icid].updatedAt || 0)) <= 15000) {
          worldState.cursors[icid] = incomingCursors[icid];
        }
      }
    }

    // 2. Merge remote sprites strictly (NEVER overwrite locally owned/falling/grabbed sprites with stale data)
    var incomingSprites = rt.sprites || {};
    for (var sid in worldState.sprites) {
      if (worldState.sprites.hasOwnProperty(sid)) {
        var curLocal = worldState.sprites[sid];
        var isLocallyAuth = (sid === worldState.grabbedSpriteId || curLocal.ownerId === myClientId || worldState.ownedSprites[sid]);
        if (!incomingSprites[sid] && !isLocallyAuth) {
          delete worldState.sprites[sid];
        }
      }
    }
    for (var isid in incomingSprites) {
      if (!incomingSprites.hasOwnProperty(isid) || !incomingSprites[isid]) continue;
      if (isid === worldState.grabbedSpriteId) continue;

      var localSp = worldState.sprites[isid];
      var remSp = incomingSprites[isid];
      var ownedByMe = localSp && (localSp.ownerId === myClientId || worldState.ownedSprites[isid]);

      if (!localSp) {
        worldState.sprites[isid] = remSp;
      } else if (!ownedByMe && (remSp.updatedAt || 0) > (localSp.updatedAt || 0) + 120) {
        worldState.sprites[isid] = remSp;
      } else if (ownedByMe && remSp.ownerId && remSp.ownerId !== myClientId && (remSp.updatedAt || 0) > (localSp.updatedAt || 0) + 150) {
        // Another user explicitly grabbed/punted this prop
        delete worldState.ownedSprites[isid];
        worldState.sprites[isid] = remSp;
      }
    }

    // 3. Merge remote fireworks
    var incomingFw = rt.fireworks || {};
    for (var fid in incomingFw) {
      if (incomingFw.hasOwnProperty(fid) && incomingFw[fid] && !worldState.explodedFireworks[fid] && !worldState.fireworks[fid]) {
        worldState.fireworks[fid] = incomingFw[fid];
      }
    }

    // 4. Merge remote actors (skip self and any actor currently grabbed by our Physgun)
    var incomingActors = rt.actors || {};
    for (var aid in worldState.actors) {
      if (worldState.actors.hasOwnProperty(aid) && aid !== myClientId && aid !== worldState.grabbedActorId && !incomingActors[aid]) {
        delete worldState.actors[aid];
      }
    }
    for (var iaid in incomingActors) {
      if (incomingActors.hasOwnProperty(iaid) && iaid !== myClientId && iaid !== worldState.grabbedActorId && incomingActors[iaid]) {
        if ((now - (incomingActors[iaid].updatedAt || 0)) <= 15000) {
          worldState.actors[iaid] = incomingActors[iaid];
        }
      }
    }
  }

  if (effects && typeof effects === "object") {
    state.snowEffect = effects.snow || null;
    state.tabLogoEffect = effects.tabLogo || null;
    syncSnowState();
    syncTabLogoState();
  }
}

function syncRealtimeWorld() {
  dbGet("realtime", function(err, rt) {
    if (!err) {
      dbGet("effects", function(eErr, eff) {
        applyRealtimeSnapshot(rt, eErr ? null : eff);
      });
    }
  });
}

function fetchAllData() {
  dbGet("", function(err, root) {
    if (err || !root || typeof root !== "object") return;

    mergeBoardsList(root.boards);
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

    if (state.user && state.users[state.user.uid]) {
      state.profile = state.users[state.user.uid];
    }

    applyRealtimeSnapshot(root.realtime, root.effects);

    var snapshotSig = JSON.stringify({
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
      n: state.notifications,
      m: state.music,
      wp: countMapKeys(state.wplacePixels),
      wpr: countMapKeys(state.wplaceRecent),
      logo: state.siteLogo
    });

    if (snapshotSig !== lastDataHash) {
      lastDataHash = snapshotSig;
      var activeEl = document.activeElement;
      var isTypingInForm = activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA");
      if (!isTypingInForm) {
        renderAll();
      } else {
        updateNotifBadge();
        rebuildMusicPlaylist();
      }
    }
  });
}

function bindGlobalHotkeys() {
  document.addEventListener("mouseup", function() {
    if (pendingDeferredRender) {
      setTimeout(renderAll, 20);
    }
  });

  document.addEventListener("keydown", function(e) {
    e = e || window.event;
    var code = e.keyCode || e.which;
    var key = String(e.key || "").toLowerCase();
    var tgt = e.target || e.srcElement;
    var tag = tgt && tgt.tagName ? tgt.tagName.toUpperCase() : "";
    var inInput = (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT");

    if (key === "shift" || code === 16) {
      worldState.shiftDownClean = true;
    } else {
      worldState.shiftDownClean = false;
    }

    if (code === 27 || key === "escape") {
      if (worldState.cursorChatOpen) closeCursorChatBar();
      if (worldState.propMenuOpen) togglePropMenu(false);
      closeStickerPicker();
      closeZoomModal();
      return;
    }

    if (inInput) return;

    // [Q] Toggle Sandbox Spawnmenu
    if (key === "q" || code === 81) {
      if (e.preventDefault) e.preventDefault();
      togglePropMenu();
      return;
    }

    // [/] Open Cursor Chat
    if (key === "/" || code === 191) {
      if (e.preventDefault) e.preventDefault();
      openCursorChatBar();
      return;
    }

    // [E] Freeze / Unfreeze grabbed prop or character actor with Physgun
    if (key === "e" || code === 69) {
      if (worldState.grabbedSpriteId) {
        var sp = worldState.sprites[worldState.grabbedSpriteId];
        worldState.grabbedSpriteId = null;
        if (sp) {
          sp.frozen = true;
          sp.vx = 0;
          sp.vy = 0;
          syncSingleSpriteToDb(sp);
          showStatus("Prop frozen in place!", false);
        }
        return;
      }
      if (worldState.grabbedActorId) {
        var aid = worldState.grabbedActorId;
        worldState.grabbedActorId = null;
        if (aid === myClientId) {
          worldState.myActor.frozen = true;
          worldState.myActor.vx = 0;
          worldState.myActor.vy = 0;
          syncMyActorToDb(true);
          showStatus("Character frozen in mid-air!", false);
        }
        return;
      }
    }

    // [F] Actor melee attack
    if (key === "f" || code === 70) {
      triggerActorAttack();
      return;
    }

    // [WASD] / Arrows for playable character actor
    if (key === "a" || code === 65 || code === 37) setActorKey("left", true);
    if (key === "d" || code === 68 || code === 39) setActorKey("right", true);
    if (key === "w" || code === 87 || code === 38 || code === 32) {
      if (worldState.actorEnabled && (key === " " || code === 32) && e.preventDefault) e.preventDefault();
      setActorKey("jump", true);
    }
    if (key === "s" || code === 83 || code === 40) setActorKey("down", true);
  });

  document.addEventListener("keyup", function(e) {
    e = e || window.event;
    var code = e.keyCode || e.which;
    var key = String(e.key || "").toLowerCase();
    var tgt = e.target || e.srcElement;
    var tag = tgt && tgt.tagName ? tgt.tagName.toUpperCase() : "";
    var inInput = (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT");

    if ((key === "shift" || code === 16) && worldState.shiftDownClean && !inInput) {
      worldState.shiftDownClean = false;
      openCursorChatBar();
      return;
    }

    if (key === "a" || code === 65 || code === 37) setActorKey("left", false);
    if (key === "d" || code === 68 || code === 39) setActorKey("right", false);
    if (key === "w" || code === 87 || code === 38 || code === 32) setActorKey("jump", false);
    if (key === "s" || code === 83 || code === 40) setActorKey("down", false);
  });
}

function bootstrapFembooru() {
  mergeBoardsList(null);
  loadSession();
  updateAuthUi();
  initMusicPlayer();
  initWplaceMap();
  initWorldEngine();
  bindGlobalHotkeys();
  refreshPropCatalog();
  probeServicePolicies();
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

  setInterval(syncRealtimeWorld, CONFIG.realtimeSyncMs);
  autoRefreshTimer = setInterval(fetchAllData, CONFIG.autoRefreshMs);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrapFembooru);
} else {
  bootstrapFembooru();
}
