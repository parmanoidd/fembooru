/* ==========================================================================
   FEMBOORU APPLICATION CONTROLLER: VIEW ROUTING, AUTO-REFRESH SYNC,
   KEYBOARD/MOUSE/TOUCH BINDINGS & BOOTSTRAP
   ========================================================================== */
function switchView(viewName) {
  state.view = viewName;
  var sections = document.querySelectorAll(".view-section");
  for (var i = 0; i < sections.length; i++) {
    var sec = sections[i];
    sec.className = "view-section" + (sec.id === "view-" + viewName ? " active" : "");
  }

  var navBtns = document.querySelectorAll(".top-nav-links button");
  for (var j = 0; j < navBtns.length; j++) {
    var btn = navBtns[j];
    var onclk = btn.getAttribute("onclick") || "";
    var isMatch = onclk.indexOf("'" + viewName + "'") !== -1 || (viewName === "profile" && onclk.indexOf("openMyProfile") !== -1);
    btn.className = isMatch ? "active-nav" : "";
  }

  renderBoardsSidebar();
  if (viewName === "boards") {
    renderBoardPolls();
    renderThreads();
  } else if (viewName === "wall") {
    renderGlobalWall();
  } else if (viewName === "members") {
    renderMembersList();
  } else if (viewName === "groups") {
    renderGroupsList();
    renderActiveGroup();
  } else if (viewName === "dms") {
    renderDmList();
  } else if (viewName === "stickers") {
    renderStickersArchive();
  } else if (viewName === "wplace") {
    renderWplaceCanvas();
    renderWplaceRecent();
  } else if (viewName === "notifications") {
    renderNotifications();
  } else if (viewName === "profile") {
    renderPublicProfile();
  }
}

function renderAll() {
  renderBoardsSidebar();
  rebuildMusicPlaylist();
  updateNotifBadge();
  syncSnowState();
  syncTabLogoState();

  if (state.siteLogo && isValidImageSrc(state.siteLogo)) {
    var logoImg = document.getElementById("siteLogoImg");
    if (logoImg && logoImg.src !== state.siteLogo) logoImg.src = state.siteLogo;
  }

  if (state.view === "boards") {
    renderBoardPolls();
    renderThreads();
  } else if (state.view === "wall") {
    renderGlobalWall();
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
  } else if (state.view === "profile") {
    renderPublicProfile();
  }
}

function fetchAllData() {
  dbGet("", function(err, root) {
    if (err || !root) {
      if (!state.boards.length) {
        state.boards = DEFAULT_BOARDS.slice();
        renderBoardsSidebar();
      }
      return;
    }

    if (!root.boards) {
      var seedObj = {};
      for (var i = 0; i < DEFAULT_BOARDS.length; i++) {
        seedObj[DEFAULT_BOARDS[i].slug] = DEFAULT_BOARDS[i];
      }
      state.boards = DEFAULT_BOARDS.slice();
      dbWrite("PUT", "boards", seedObj, null);
    } else {
      var bList = [];
      for (var slug in root.boards) {
        if (root.boards.hasOwnProperty(slug) && root.boards[slug]) bList.push(root.boards[slug]);
      }
      state.boards = bList.length ? bList : DEFAULT_BOARDS.slice();
    }

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

    syncSnowState();
    syncTabLogoState();
    updateNotifBadge();
    updateAuthUi();

    var hash = [
      countMapKeys(state.threads),
      JSON.stringify(state.threads).length,
      JSON.stringify(state.walls).length,
      JSON.stringify(state.groups).length,
      JSON.stringify(state.dms).length,
      JSON.stringify(state.polls).length,
      countMapKeys(state.stickers),
      countMapKeys(state.music),
      countMapKeys(state.users),
      countMapKeys(state.wplacePixels),
      state.siteLogo
    ].join(":");

    if (hash !== lastDataHash) {
      lastDataHash = hash;
      renderAll();
    }
  });
}

function isTypingInField(el) {
  if (!el) return false;
  var tag = (el.tagName || "").toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

function bindGlobalEvents() {
  document.addEventListener("mousemove", function(e) {
    e = e || window.event;
    handlePointerMove(e.clientX, e.clientY);
  });

  document.addEventListener("mouseup", function() {
    releaseGrabbedSprite();
  });

  document.addEventListener("touchstart", function(e) {
    if (e.touches && e.touches[0]) {
      handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: true });

  document.addEventListener("touchmove", function(e) {
    if (e.touches && e.touches[0]) {
      handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: true });

  document.addEventListener("touchend", function() {
    releaseGrabbedSprite();
  }, { passive: true });

  document.addEventListener("wheel", function(e) {
    if (worldState.grabbedSpriteId && worldState.sprites[worldState.grabbedSpriteId]) {
      var sp = worldState.sprites[worldState.grabbedSpriteId];
      sp.rot = (sp.rot || 0) + (e.deltaY > 0 ? 15 : -15);
    }
  }, { passive: true });

  document.addEventListener("keydown", function(e) {
    e = e || window.event;
    var key = e.key || "";
    var code = e.keyCode || 0;

    if (key === "Escape" || code === 27) {
      closeZoomModal();
      closeStickerPicker();
      closeCursorChatBar();
      if (worldState.propMenuOpen) togglePropMenu(false);
      return;
    }

    if (isTypingInField(e.target || e.srcElement)) return;

    if (key === "Shift" || code === 16) {
      worldState.shiftDownClean = true;
      return;
    } else {
      worldState.shiftDownClean = false;
    }

    if (key === "/" || code === 191) {
      if (e.preventDefault) e.preventDefault();
      openCursorChatBar();
      return;
    }

    if (key === "q" || key === "Q" || code === 81) {
      togglePropMenu();
      return;
    }

    if (key === "f" || key === "F" || code === 70) {
      triggerActorAttack();
      return;
    }

    if ((key === "e" || key === "E" || code === 69) && worldState.grabbedSpriteId) {
      var gSp = worldState.sprites[worldState.grabbedSpriteId];
      if (gSp) {
        gSp.frozen = true;
        gSp.vx = 0;
        gSp.vy = 0;
        releaseGrabbedSprite();
      }
      return;
    }

    if (worldState.actorEnabled) {
      if (key === "a" || key === "A" || key === "ArrowLeft" || code === 65 || code === 37) {
        setActorKey("left", true);
      } else if (key === "d" || key === "D" || key === "ArrowRight" || code === 68 || code === 39) {
        setActorKey("right", true);
      } else if (key === "w" || key === "W" || key === "ArrowUp" || key === " " || code === 87 || code === 38 || code === 32) {
        if (e.preventDefault) e.preventDefault();
        setActorKey("jump", true);
      }
    }
  });

  document.addEventListener("keyup", function(e) {
    e = e || window.event;
    var key = e.key || "";
    var code = e.keyCode || 0;

    if ((key === "Shift" || code === 16) && worldState.shiftDownClean && !isTypingInField(e.target || e.srcElement)) {
      worldState.shiftDownClean = false;
      openCursorChatBar();
      return;
    }

    if (key === "a" || key === "A" || key === "ArrowLeft" || code === 65 || code === 37) {
      setActorKey("left", false);
    } else if (key === "d" || key === "D" || key === "ArrowRight" || code === 68 || code === 39) {
      setActorKey("right", false);
    } else if (key === "w" || key === "W" || key === "ArrowUp" || key === " " || code === 87 || code === 38 || code === 32) {
      setActorKey("jump", false);
    }
  });

  window.addEventListener("beforeunload", function() {
    try {
      var xhr1 = new XMLHttpRequest();
      xhr1.open("DELETE", buildDbUrl("realtime/cursors/" + myClientId, false), false);
      xhr1.send();
      if (worldState.actorEnabled) {
        var xhr2 = new XMLHttpRequest();
        xhr2.open("DELETE", buildDbUrl("realtime/actors/" + myClientId, false), false);
        xhr2.send();
      }
    } catch (e) {}
  });
}

function initApp() {
  loadSession();
  updateAuthUi();
  probeServicePolicies();
  fetchGithubRepoVersion();
  initMusicPlayer();
  initWplaceControls();
  bindGlobalEvents();

  if (state.user) {
    ensureFreshSession(function() {
      updateAuthUi();
      loadUserProfile(function() {
        updateAuthUi();
        fetchAllData();
      });
    });
  } else {
    fetchAllData();
  }

  autoRefreshTimer = setInterval(fetchAllData, CONFIG.autoRefreshMs);
  setInterval(syncRealtimeWorld, CONFIG.realtimeSyncMs);
  setInterval(stepPhysicsLoop, 33);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
