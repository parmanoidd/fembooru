/* ==========================================================================
   FEMBOORU APPLICATION CONTROLLER:
   - VIEW ROUTING, AUTO-REFRESH SYNC ENGINE & INITIALIZATION
   ========================================================================== */
function switchView(viewName) {
  state.view = viewName;
  var sections = document.querySelectorAll(".view-section");
  for (var i = 0; i < sections.length; i++) {
    sections[i].className = (sections[i].id === "view-" + viewName) ? "view-section active" : "view-section";
  }

  var navBtns = document.querySelectorAll(".top-nav-links button");
  var viewOrder = ["boards", "wall", "profile", "members", "groups", "dms", "stickers", "wplace", "notifications"];
  for (var j = 0; j < navBtns.length; j++) {
    navBtns[j].className = (viewOrder[j] === viewName) ? "active-nav" : "";
  }

  renderBoardsSidebar();
  renderCurrentView();
}

function renderCurrentView() {
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
  updateAuthUi();
  renderBoardsSidebar();
  updateNotifBadge();
  rebuildMusicPlaylist();
  syncSnowState();
  syncTabLogoState();
  renderCurrentView();
}

/* ==========================================================================
   AUTO-REFRESH DATA SYNC (BOARDS, MESSAGES, POLLS, EFFECTS, WPLACE)
   ========================================================================== */
function computeDataFingerprint() {
  return [
    state.boards.length,
    countMapKeys(state.threads),
    countMapKeys(state.polls),
    countMapKeys(state.users),
    countMapKeys(state.walls),
    countMapKeys(state.groups),
    countMapKeys(state.dms),
    countMapKeys(state.stickers),
    countMapKeys(state.music),
    countMapKeys(state.wplacePixels),
    state.user ? countMapKeys(state.notifications[state.user.uid]) : 0,
    JSON.stringify(state.threads).length,
    JSON.stringify(state.walls).length,
    JSON.stringify(state.groups).length,
    JSON.stringify(state.dms).length
  ].join("|");
}

function fetchAllData() {
  var pending = 13;
  var dbFailed = false;

  function done() {
    pending--;
    if (pending > 0) return;

    if (!state.boards.length) {
      state.boards = DEFAULT_BOARDS.slice(0);
      if (isSuperiorAdmin() && !dbFailed) {
        for (var i = 0; i < DEFAULT_BOARDS.length; i++) {
          dbWrite("PUT", "boards/" + DEFAULT_BOARDS[i].slug, DEFAULT_BOARDS[i], null);
        }
      }
    }

    var logoEl = document.getElementById("siteLogoImg");
    if (logoEl && isValidImageSrc(state.siteLogo) && logoEl.src !== state.siteLogo) {
      logoEl.src = state.siteLogo;
    }

    var nextHash = computeDataFingerprint();
    if (nextHash !== lastDataHash) {
      lastDataHash = nextHash;
      renderAll();
    } else {
      syncSnowState();
      syncTabLogoState();
      updateNotifBadge();
    }
  }

  dbGet("boards", function(err, data) {
    if (err) dbFailed = true;
    var arr = [];
    if (data && typeof data === "object") {
      for (var k in data) {
        if (data.hasOwnProperty(k) && data[k] && data[k].slug) arr.push(data[k]);
      }
    }
    if (arr.length) state.boards = arr;
    done();
  });

  dbGet("threads", function(err, data) { state.threads = data || {}; done(); });
  dbGet("polls", function(err, data) { state.polls = data || {}; done(); });
  dbGet("users", function(err, data) {
    state.users = data || {};
    if (state.user && state.users[state.user.uid]) state.profile = state.users[state.user.uid];
    done();
  });
  dbGet("walls", function(err, data) { state.walls = data || {}; done(); });
  dbGet("groups", function(err, data) { state.groups = data || {}; done(); });
  dbGet("stickers", function(err, data) { state.stickers = data || {}; done(); });
  dbGet("subscriptions", function(err, data) { state.subscriptions = data || {}; done(); });
  dbGet("blocks", function(err, data) { state.blocks = data || {}; done(); });
  dbGet("music", function(err, data) { state.music = data || {}; done(); });
  dbGet("site", function(err, data) { state.siteLogo = (data && data.logo) || ""; done(); });
  dbGet("effects", function(err, data) {
    state.snowEffect = (data && data.snow) || null;
    state.tabLogoEffect = (data && data.tabLogo) || null;
    done();
  });
  dbGet("wplace", function(err, data) {
    state.wplacePixels = (data && data.pixels) || {};
    state.wplaceRecent = (data && data.recent) || {};
    done();
  });

  if (state.user && state.user.uid) {
    dbGet("dms", function(err, data) {
      state.dms = data || {};
      if (state.view === "dms") renderDmList();
    });
    dbGet("notifications/" + state.user.uid, function(err, data) {
      state.notifications[state.user.uid] = data || {};
      updateNotifBadge();
      if (state.view === "notifications") renderNotifications();
    });
  }
}

function syncRealtimeEntities() {
  dbGet("realtime", function(err, data) {
    if (err || !data) return;
    worldState.cursors = data.cursors || {};
    renderRemoteCursors();

    var remoteSprites = data.sprites || {};
    for (var sId in remoteSprites) {
      if (remoteSprites.hasOwnProperty(sId) && remoteSprites[sId] && worldState.grabbedSpriteId !== sId) {
        worldState.sprites[sId] = remoteSprites[sId];
      }
    }
    for (var localSid in worldState.sprites) {
      if (worldState.sprites.hasOwnProperty(localSid) && !remoteSprites[localSid] && worldState.grabbedSpriteId !== localSid) {
        delete worldState.sprites[localSid];
      }
    }

    var remoteFw = data.fireworks || {};
    for (var fId in remoteFw) {
      if (remoteFw.hasOwnProperty(fId) && remoteFw[fId] && !worldState.explodedFireworks[fId]) {
        worldState.fireworks[fId] = remoteFw[fId];
      }
    }

    var remoteActors = data.actors || {};
    for (var aId in remoteActors) {
      if (remoteActors.hasOwnProperty(aId) && remoteActors[aId] && aId !== myClientId) {
        worldState.actors[aId] = remoteActors[aId];
      }
    }
    for (var oldAid in worldState.actors) {
      if (worldState.actors.hasOwnProperty(oldAid) && oldAid !== myClientId && !remoteActors[oldAid]) {
        delete worldState.actors[oldAid];
      }
    }
  });
}

/* ==========================================================================
   APPLICATION BOOTSTRAP
   ========================================================================== */
function bootApplication() {
  state.boards = DEFAULT_BOARDS.slice(0);
  loadSession();
  updateAuthUi();
  initMusicPlayer();
  initWplaceMap();
  initWorldEngine();
  probeServicePolicies();
  fetchGithubRepoVersion();
  renderAll();

  ensureFreshSession(function() {
    updateAuthUi();
    if (state.user) {
      loadUserProfile(function() {
        updateAuthUi();
        fetchAllData();
      });
    } else {
      fetchAllData();
    }
  });

  if (autoRefreshTimer) clearInterval(autoRefreshTimer);
  autoRefreshTimer = setInterval(fetchAllData, CONFIG.autoRefreshMs);
  setInterval(syncRealtimeEntities, CONFIG.realtimeSyncMs);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootApplication);
} else {
  bootApplication();
}
