/* ==========================================================================
   SOCIAL FEATURES: SUBSCRIPTIONS, STICKERS, GROUPS, DMs, MUSIC, POSTS & WALLS
   ========================================================================== */

/* SUBSCRIPTIONS & BLOCKING */
function isUserBlockedByMe(t) {
  return Boolean(state.user && t && t !== state.user.uid && state.blocks[state.user.uid] && state.blocks[state.user.uid][t]);
}
function amIBlockedByUser(t) {
  return Boolean(state.user && t && t !== state.user.uid && state.blocks[t] && state.blocks[t][state.user.uid]);
}
function isSubscribedToUser(t) {
  return Boolean(state.user && t && t !== state.user.uid && state.subscriptions[state.user.uid] && state.subscriptions[state.user.uid][t]);
}
function getSubscriberCount(t) {
  var c = 0;
  for (var u in state.subscriptions) {
    if (state.subscriptions.hasOwnProperty(u) && state.subscriptions[u] && state.subscriptions[u][t]) c++;
  }
  return c;
}
function getSubscriptionCount(t) {
  var m = state.subscriptions[t] || {}, c = 0;
  for (var k in m) if (m.hasOwnProperty(k) && m[k]) c++;
  return c;
}

function toggleSubscribeUser(t) {
  if (!state.user || !t || t === state.user.uid) return;
  var sub = isSubscribedToUser(t);
  dbWrite(sub ? "DELETE" : "PUT", "subscriptions/" + state.user.uid + "/" + t, sub ? null : true, function(e) {
    if (!e) refreshAllData(renderAll);
  });
}

function toggleBlockUser(t) {
  if (!state.user || !t || t === state.user.uid) return;
  var blk = isUserBlockedByMe(t);
  dbWrite(blk ? "DELETE" : "PUT", "blocks/" + state.user.uid + "/" + t, blk ? null : true, function(e) {
    if (!e && !blk && isSubscribedToUser(t)) dbWrite("DELETE", "subscriptions/" + state.user.uid + "/" + t, null, null);
    if (!e) refreshAllData(renderAll);
  });
}

/* PUBLIC STICKERS ARCHIVE & PICKER */
function uploadPublicStickerFromArchive() {
  if (!state.user) { showStatus("Log in to upload stickers.", true); return; }
  var fEl = document.getElementById("archStickerFile");
  var nEl = document.getElementById("archStickerName");
  if (!fEl || !fEl.files || !fEl.files[0]) { showStatus("Select a sticker file.", true); return; }
  var file = fEl.files[0];
  if (file.size > SERVICE_POLICY.stickerMaxBytes) {
    showStatus("Sticker too large! Max " + (SERVICE_POLICY.stickerMaxBytes / 1048576).toFixed(1) + " MB.", true);
    return;
  }
  var tag = String(nEl ? nEl.value : "").replace(/^\s+|\s+$/g, "") || file.name.replace(/\.[^.]+$/, "").substring(0, 20) || "sticker";
  uploadImageToImgbb(fEl, function(err, sUrl) {
    if (err || !sUrl) { setUploadProgress(-1); showStatus(err || "Upload failed.", true); return; }
    function save() {
      var stId = "st_" + generateId();
      dbWrite("PUT", "stickers/" + stId, {
        id: stId,
        url: sUrl,
        name: tag,
        uploadedByUid: state.user.uid,
        uploadedByName: state.profile.nickname || state.user.username,
        createdAt: new Date().getTime()
      }, function(e) {
        if (e) { setUploadProgress(-1); showStatus(formatDbError(e, "Failed."), true); return; }
        setUploadProgress(100, "Sticker added!");
        fEl.value = "";
        if (nEl) nEl.value = "";
        showStatus("Sticker added to public archive!", false);
        refreshAllData(renderAll);
      }, function(p) { setUploadProgress(85 + Math.round(p * 0.15), "Saving sticker..."); });
    }
    var img = new Image();
    img.onload = function() {
      if (img.width > SERVICE_POLICY.stickerMaxDim || img.height > SERVICE_POLICY.stickerMaxDim) {
        setUploadProgress(-1);
        showStatus("Sticker exceeds " + SERVICE_POLICY.stickerMaxDim + "px limit.", true);
        return;
      }
      save();
    };
    img.onerror = save;
    img.src = sUrl;
  }, { maxBytes: SERVICE_POLICY.stickerMaxBytes, keepProgressOpen: true });
}

function deletePublicSticker(stId) {
  var st = state.stickers[stId];
  if (state.user && st && (st.uploadedByUid === state.user.uid || state.user.isAdmin)) {
    dbWrite("DELETE", "stickers/" + stId, null, function() { refreshAllData(renderAll); });
  }
}

function toggleStickerPicker(ctx) {
  state.openStickerPickers[ctx] = !state.openStickerPickers[ctx];
  var b = document.getElementById("stBar_" + ctx);
  if (b) b.style.display = state.openStickerPickers[ctx] ? "block" : "none";
}

function selectStickerForContext(ctx, stId) {
  var st = state.stickers[stId];
  if (!st) return;
  state.selectedStickers[ctx] = st.url;
  state.openStickerPickers[ctx] = false;
  var b = document.getElementById("stBar_" + ctx);
  var p = document.getElementById("stPreview_" + ctx);
  if (b) b.style.display = "none";
  if (p) {
    p.innerHTML = '<img class="sticker-inline" src="' + esc(st.url) + '"> <a class="link-danger" onclick="clearSelectedSticker(\'' + esc(ctx) + '\')">[Remove]</a>';
  }
}

function clearSelectedSticker(ctx) {
  delete state.selectedStickers[ctx];
  var p = document.getElementById("stPreview_" + ctx);
  if (p) p.innerHTML = "";
}

function renderStickerPickerWidget(ctx) {
  var keys = [];
  for (var k in state.stickers) {
    if (state.stickers.hasOwnProperty(k) && state.stickers[k] && isValidImageSrc(state.stickers[k].url)) keys.push(k);
  }
  keys.sort(function(a, b) { return (state.stickers[b].createdAt || 0) - (state.stickers[a].createdAt || 0); });
  var cur = state.selectedStickers[ctx] || "";
  var open = !!state.openStickerPickers[ctx];
  var h = '<div id="stPreview_' + esc(ctx) + '">' + (cur ? '<img class="sticker-inline" src="' + esc(cur) + '"> <a class="link-danger" onclick="clearSelectedSticker(\'' + esc(ctx) + '\')">[Remove]</a>' : '') + '</div>' +
          '<button type="button" onclick="toggleStickerPicker(\'' + esc(ctx) + '\')">+ Pick Sticker (' + keys.length + ')</button> <a style="font-size:11px;" onclick="switchView(\'stickers\')">[Upload New Sticker]</a>' +
          '<div id="stBar_' + esc(ctx) + '" class="sticker-picker-bar" style="display:' + (open ? 'block' : 'none') + ';">';
  if (!keys.length) {
    h += '<span class="muted">No stickers yet. Click [Upload New Sticker] to add one!</span>';
  } else {
    for (var i = 0; i < keys.length; i++) {
      var st = state.stickers[keys[i]];
      h += '<span class="sticker-pick-btn" onclick="selectStickerForContext(\'' + esc(ctx) + '\', \'' + esc(st.id) + '\')" title="' + esc(st.name) + '"><img src="' + esc(st.url) + '"></span>';
    }
  }
  return h + '</div>';
}

/* GROUPS & DIRECT MESSAGES */
function createGroup() {
  if (!state.user) return;
  var title = String(document.getElementById("newGroupTitle").value || "").replace(/^\s+|\s+$/g, "");
  var desc = String(document.getElementById("newGroupDesc").value || "").replace(/^\s+|\s+$/g, "");
  if (!title) { showStatus("Title required.", true); return; }
  var gid = "grp_" + generateId(), mem = {};
  mem[state.user.uid] = true;
  dbWrite("PUT", "groups/" + gid, {
    id: gid,
    title: title,
    description: desc,
    ownerUid: state.user.uid,
    ownerName: state.profile.nickname || state.user.username,
    createdAt: new Date().getTime(),
    members: mem
  }, function(e) { if (!e) { state.currentGroupId = gid; refreshAllData(renderAll); } });
}

function toggleJoinGroup(gid) {
  if (state.user && state.groups[gid]) {
    var m = state.groups[gid].members && state.groups[gid].members[state.user.uid];
    dbWrite(m ? "DELETE" : "PUT", "groups/" + gid + "/members/" + state.user.uid, m ? null : true, function() { refreshAllData(renderAll); });
  }
}

function deleteGroup(gid) {
  var g = state.groups[gid];
  if (state.user && g && (g.ownerUid === state.user.uid || state.user.isAdmin) && confirm("Delete group?")) {
    dbWrite("DELETE", "groups/" + gid, null, function() {
      dbWrite("DELETE", "groupMessages/" + gid, null, function() { state.currentGroupId = null; refreshAllData(renderAll); });
    });
  }
}

function sendGroupMessage(gid) {
  if (!state.user) return;
  var txt = String(document.getElementById("grpMsgText").value || "").replace(/^\s+|\s+$/g, "");
  var vid = safeUrl(document.getElementById("grpMsgVideo").value);
  var st = state.selectedStickers["group_" + gid] || "";
  var fEl = document.getElementById("grpMsgImage");
  var hasF = Boolean(fEl && fEl.files && fEl.files[0]);
  if (!txt && !vid && !st && !hasF) return;
  uploadImageToImgbb(fEl, function(err, img) {
    if (err) { setUploadProgress(-1); showStatus(err, true); return; }
    var mid = generateId();
    dbWrite("PUT", "groupMessages/" + gid + "/" + mid, {
      id: mid,
      authorUid: state.user.uid,
      authorName: state.profile.nickname || state.user.username,
      text: txt,
      imageUrl: img || "",
      stickerUrl: st,
      videoUrl: vid,
      createdAt: new Date().getTime()
    }, function() {
      if (hasF) setUploadProgress(100, "Sent!");
      clearSelectedSticker("group_" + gid);
      refreshAllData(renderAll);
    }, hasF ? function(p) { setUploadProgress(85 + Math.round(p * 0.15), "Sending message..."); } : null);
  }, { keepProgressOpen: hasF });
}

function deleteGroupMessage(gid, mid) {
  var m = (state.groupMessages[gid] || {})[mid], g = state.groups[gid] || {};
  if (state.user && m && (m.authorUid === state.user.uid || g.ownerUid === state.user.uid || state.user.isAdmin)) {
    dbWrite("DELETE", "groupMessages/" + gid + "/" + mid, null, function() { refreshAllData(renderAll); });
  }
}

function getDmKey(a, b) { return a < b ? (a + "__" + b) : (b + "__" + a); }
function openDmWithUser(uid) {
  if (!state.user) { showStatus("Log in for DMs.", true); return; }
  state.currentDmPeerUid = uid;
  switchView("dms");
}

function sendDirectMessage(peer) {
  if (!state.user || isUserBlockedByMe(peer) || amIBlockedByUser(peer)) return;
  var txt = String(document.getElementById("dmMsgText").value || "").replace(/^\s+|\s+$/g, "");
  var vid = safeUrl(document.getElementById("dmMsgVideo").value);
  var st = state.selectedStickers["dm_" + peer] || "";
  var fEl = document.getElementById("dmMsgImage");
  var hasF = Boolean(fEl && fEl.files && fEl.files[0]);
  if (!txt && !vid && !st && !hasF) return;
  uploadImageToImgbb(fEl, function(err, img) {
    if (err) { setUploadProgress(-1); showStatus(err, true); return; }
    var ck = getDmKey(state.user.uid, peer), mid = generateId();
    dbWrite("PUT", "dms/" + ck + "/" + mid, {
      id: mid,
      fromUid: state.user.uid,
      fromName: state.profile.nickname || state.user.username,
      toUid: peer,
      text: txt,
      imageUrl: img || "",
      stickerUrl: st,
      videoUrl: vid,
      createdAt: new Date().getTime()
    }, function() {
      if (hasF) setUploadProgress(100, "DM Sent!");
      clearSelectedSticker("dm_" + peer);
      refreshAllData(renderAll);
    }, hasF ? function(p) { setUploadProgress(85 + Math.round(p * 0.15), "Sending DM..."); } : null);
  }, { keepProgressOpen: hasF });
}

function deleteDirectMessage(ck, mid) {
  var m = (state.dms[ck] || {})[mid];
  if (state.user && m && (m.fromUid === state.user.uid || state.user.isAdmin)) {
    dbWrite("DELETE", "dms/" + ck + "/" + mid, null, function() { refreshAllData(renderAll); });
  }
}

/* ADMIN LOGO, 1-MIN TAB ICON & 1-MIN SNOW */
function uploadAdminSiteLogo(id) {
  if (!state.user || !state.user.isAdmin) return;
  uploadImageToImgbb(document.getElementById(id), function(err, u) {
    if (err || !u) { setUploadProgress(-1); showStatus(err || "Select an image.", true); return; }
    dbWrite("PUT", "site/logo", u, function() {
      setUploadProgress(100, "Logo updated!");
      state.siteLogo = u;
      syncTabLogoState();
      renderChrome();
      showStatus("Logo updated!", false);
    }, function(p) { setUploadProgress(85 + Math.round(p * 0.15), "Saving logo..."); });
  }, { keepProgressOpen: true });
}

function removeAdminSiteLogo() {
  if (state.user && state.user.isAdmin) {
    dbWrite("DELETE", "site/logo", null, function() { state.siteLogo = ""; syncTabLogoState(); renderChrome(); });
  }
}

function triggerGlobalTabLogo() {
  var fEl = document.getElementById("tabLogoFileInput");
  var uEl = document.getElementById("tabLogoUrlInput");
  var pUrl = uEl ? safeUrl(uEl.value) : "";
  if (fEl && fEl.files && fEl.files[0]) {
    uploadImageToImgbb(fEl, function(e, u) {
      if (!e && u) { saveTabLogo(u, true); fEl.value = ""; }
      else { setUploadProgress(-1); showStatus(e || "Failed.", true); }
    }, { keepProgressOpen: true });
    return;
  }
  if (pUrl) { saveTabLogo(pUrl, false); uEl.value = ""; return; }
  showStatus("Select an image or paste URL.", true);
}

function saveTabLogo(u, hasProgress) {
  var now = new Date().getTime();
  var p = { iconUrl: u, expiresAt: now + 60000 };
  state.tabLogoEffect = p;
  syncTabLogoState();
  dbWrite("PUT", "effects/tabLogo", p, function() {
    if (hasProgress) setUploadProgress(100, "Tab icon updated!");
    showStatus("Tab icon changed for 1 minute!", false);
  }, hasProgress ? function(pr) { setUploadProgress(85 + Math.round(pr * 0.15), "Applying tab icon..."); } : null);
}

function syncTabLogoState() {
  var now = new Date().getTime();
  var eff = state.tabLogoEffect;
  var lbl = document.getElementById("tabLogoTimerLabel");
  var lnk = document.getElementById("siteFavicon");
  if (eff && eff.iconUrl && eff.expiresAt > now && isValidImageSrc(eff.iconUrl)) {
    if (lnk && lnk.getAttribute("href") !== eff.iconUrl) lnk.setAttribute("href", eff.iconUrl);
    if (lbl) lbl.innerHTML = "Custom tab icon (" + Math.ceil((eff.expiresAt - now) / 1000) + "s)";
    if (!tabLogoTickTimer) tabLogoTickTimer = setInterval(syncTabLogoState, 1000);
  } else {
    if (tabLogoTickTimer) { clearInterval(tabLogoTickTimer); tabLogoTickTimer = null; }
    var def = isValidImageSrc(state.siteLogo) ? state.siteLogo : DEFAULT_FAVICON;
    if (lnk && lnk.getAttribute("href") !== def) lnk.setAttribute("href", def);
    if (lbl) lbl.innerHTML = "Default tab icon active";
  }
}

function triggerGlobalSnow() {
  var now = new Date().getTime();
  var p = { expiresAt: now + 60000 };
  state.snowEffect = p;
  syncSnowState();
  dbWrite("PUT", "effects/snow", p, function() { showStatus("Snow enabled for everyone for 1 minute!", false); });
}

function syncSnowState() {
  if (state.snowEffect && state.snowEffect.expiresAt > new Date().getTime()) {
    snowState.expiresAt = state.snowEffect.expiresAt;
    if (!snowState.active) startSnow();
  } else if (snowState.active) {
    stopSnow();
  }
}

function startSnow() {
  var c = document.getElementById("snowCanvas");
  if (!c || !c.getContext) return;
  snowState.active = true;
  c.style.display = "block";
  c.width = window.innerWidth || 800;
  c.height = window.innerHeight || 600;
  snowState.flakes = [];
  for (var i = 0; i < 60; i++) {
    snowState.flakes.push({ x: Math.random() * c.width, y: Math.random() * c.height, r: 1.5 + Math.random() * 3, d: 0.7 + Math.random() * 1.4 });
  }
  var ctx = c.getContext("2d"), lastSec = -1;
  (function step() {
    if (!snowState.active) return;
    var rem = Math.ceil((snowState.expiresAt - new Date().getTime()) / 1000);
    if (rem <= 0) {
      stopSnow();
      var b = document.getElementById("snowSideBtn");
      if (b) b.innerHTML = "&#10052; Snow for All (1m)";
      return;
    }
    if (rem !== lastSec) {
      lastSec = rem;
      var btn = document.getElementById("snowSideBtn");
      if (btn) btn.innerHTML = "&#10052; Snowing (" + rem + "s)";
    }
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = "rgba(180,215,255,0.85)";
    ctx.beginPath();
    for (var j = 0; j < snowState.flakes.length; j++) {
      var f = snowState.flakes[j];
      ctx.moveTo(f.x, f.y);
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2, true);
      f.y += f.d;
      f.x += Math.sin(f.y * 0.02) * 0.5;
      if (f.y > c.height) { f.y = -5; f.x = Math.random() * c.width; }
    }
    ctx.fill();
    snowState.animFrame = setTimeout(step, 40);
  })();
}

function stopSnow() {
  snowState.active = false;
  if (snowState.animFrame) { clearTimeout(snowState.animFrame); snowState.animFrame = null; }
  var c = document.getElementById("snowCanvas");
  if (c) c.style.display = "none";
}

/* MUSIC PLAYER & SEAMLESS LOCAL-TO-CLOUD REPLACEMENT */
function isDirectAudioUrl(u) {
  return /\.(mp3|ogg|wav|m4a|flac)(\?.*)?$/i.test(String(u || ""));
}

function renderVideoHtml(raw) {
  var u = safeUrl(raw);
  if (!u) return "";
  if (isDirectAudioUrl(u)) return '<div class="video-box"><audio controls preload="none" src="' + esc(u) + '"></audio></div>';
  var yt = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (yt && yt[1]) return '<div class="video-box"><iframe width="360" height="215" src="https://www.youtube.com/embed/' + esc(yt[1]) + '" frameborder="0" allowfullscreen></iframe></div>';
  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(u)) return '<div class="video-box"><video width="360" controls preload="metadata" src="' + esc(u) + '"></video></div>';
  return '<div class="video-box"><strong>[Video]</strong> <a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(u) + '</a></div>';
}

function initMusicPlayer() {
  var a = document.getElementById("audioPlayer");
  var w = document.getElementById("musicWidget");
  var b = document.getElementById("musicPlayBtn");
  if (!a) return;
  a.onplay = function() { w.className = "music-widget is-playing"; b.innerHTML = "Pause"; };
  a.onpause = function() { w.className = "music-widget"; b.innerHTML = "Play"; };
  a.onended = function() { w.className = "music-widget"; b.innerHTML = "Play"; musicNext(); };
}

function rebuildMusicPlaylist() {
  var bTracks = [];
  for (var tid in state.threads) {
    if (state.threads.hasOwnProperty(tid) && state.threads[tid] && state.threads[tid].board === "music") {
      var t = state.threads[tid];
      var m = String(t.text || "").match(/https?:\/\/[^\s<>"']+\.(?:mp3|ogg|wav|m4a|flac)(?:\?[^\s<>"']*)?/i);
      var src = (t.audioData && t.audioData.indexOf("data:audio/") === 0) ? t.audioData : (isDirectAudioUrl(t.videoUrl) ? safeUrl(t.videoUrl) : (m ? m[0] : ""));
      if (src) {
        bTracks.push({
          id: "t_" + t.id,
          title: (t.subject || t.audioName || "Track") + " (" + (t.authorName || "User") + ")",
          src: src,
          createdAt: t.createdAt || 0
        });
      }
    }
  }
  bTracks.sort(function(a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
  var activeId = musicState.currentPlayingId || ((musicState.currentIndex >= 0 && musicState.allTracks[musicState.currentIndex]) ? musicState.allTracks[musicState.currentIndex].id : null);
  var all = musicState.localTracks.concat(bTracks);
  musicState.allTracks = all;

  var cnt = document.getElementById("musicCountLabel");
  var sel = document.getElementById("musicSelect");
  var te = document.getElementById("musicTrackTitle");
  if (cnt) cnt.innerHTML = all.length + " track" + (all.length === 1 ? "" : "s");
  if (sel) {
    var o = '<option value="-1">-- Playlist (' + all.length + ') --</option>';
    for (var i = 0; i < all.length; i++) o += '<option value="' + i + '">' + esc(all[i].title) + '</option>';
    sel.innerHTML = o;
  }
  if (activeId) {
    for (var j = 0; j < all.length; j++) {
      if (all[j].id === activeId) {
        musicState.currentIndex = j;
        musicState.currentPlayingId = activeId;
        if (sel) sel.value = String(j);
        if (te) te.innerHTML = esc(all[j].title);
        return;
      }
    }
  }
  if (all.length && (musicState.currentIndex < 0 || musicState.currentIndex >= all.length)) {
    musicState.currentIndex = 0;
    musicState.currentPlayingId = all[0].id;
    var au = document.getElementById("audioPlayer");
    if (te) te.innerHTML = esc(all[0].title);
    if (au && !au.src) au.src = all[0].src;
    if (sel) sel.value = "0";
  }
}

function musicSelectTrack(iStr) {
  var i = parseInt(iStr, 10);
  if (isNaN(i) || i < 0 || i >= musicState.allTracks.length) return;
  musicState.currentIndex = i;
  var tr = musicState.allTracks[i];
  var au = document.getElementById("audioPlayer");
  var te = document.getElementById("musicTrackTitle");
  var sel = document.getElementById("musicSelect");
  musicState.currentPlayingId = tr.id;
  if (te) te.innerHTML = esc(tr.title);
  if (sel) sel.value = String(i);
  if (au) { au.src = tr.src; au.play(); }
}

function musicTogglePlay() {
  var a = document.getElementById("audioPlayer");
  if (!a || !musicState.allTracks.length) return;
  if (musicState.currentIndex < 0) { musicSelectTrack(0); return; }
  if (a.paused) { if (!a.src) a.src = musicState.allTracks[musicState.currentIndex].src; a.play(); }
  else a.pause();
}
function musicNext() { if (musicState.allTracks.length) musicSelectTrack((musicState.currentIndex + 1) % musicState.allTracks.length); }
function musicPrev() { if (musicState.allTracks.length) musicSelectTrack((musicState.currentIndex - 1 + musicState.allTracks.length) % musicState.allTracks.length); }

function removeTempLocalTrack(tempId) {
  for (var i = musicState.localTracks.length - 1; i >= 0; i--) {
    if (musicState.localTracks[i].id === tempId) {
      var u = window.URL || window.webkitURL;
      if (u && u.revokeObjectURL && musicState.localTracks[i].blobUrl) {
        try { u.revokeObjectURL(musicState.localTracks[i].blobUrl); } catch (e) {}
      }
      musicState.localTracks.splice(i, 1);
    }
  }
}

function handleMusicFileUpload(inp) {
  if (!inp || !inp.files || !inp.files[0]) return;
  var f = inp.files[0], u = window.URL || window.webkitURL;
  var blobUrl = (u && u.createObjectURL) ? u.createObjectURL(f) : "";

  if (!state.user) {
    if (blobUrl) {
      var guestId = "loc_" + generateId();
      musicState.localTracks.unshift({ id: guestId, title: "[Local] " + f.name, src: blobUrl, blobUrl: blobUrl, createdAt: new Date().getTime() });
      rebuildMusicPlaylist();
      musicSelectTrack(0);
      setUploadProgress(100, "Loaded local track (log in to upload to /music/)");
    }
    return;
  }

  var tid = generateId();
  var tempId = "uploading_" + tid;
  var authorDisplay = state.profile.nickname || state.user.username;
  var cloudTrackId = "t_" + tid;
  var cloudTitle = f.name + " (" + authorDisplay + ")";

  if (blobUrl) {
    musicState.localTracks.unshift({ id: tempId, title: cloudTitle, src: blobUrl, blobUrl: blobUrl, createdAt: new Date().getTime() });
    rebuildMusicPlaylist();
    musicSelectTrack(0);
  }

  function publishCompressedAudio(limitBytes) {
    compressAudioToServiceLimit(f, limitBytes, function(cErr, dataUrl) {
      if (cErr || !dataUrl || dataUrl.indexOf("data:audio/") !== 0) {
        setUploadProgress(-1);
        if (cErr) showStatus(cErr, true);
        return;
      }
      var now = new Date().getTime();
      var threadObj = {
        id: tid,
        board: "music",
        subject: f.name,
        text: "Audio: " + f.name,
        audioData: dataUrl,
        audioName: f.name,
        uid: state.user.uid,
        authorName: authorDisplay,
        createdAt: now,
        bumpedAt: now
      };
      dbWrite("PUT", "threads/" + tid, threadObj, function(wErr) {
        if (wErr && (wErr.status === 413 || String(wErr.data || "").toLowerCase().indexOf("size") !== -1) && limitBytes > 120000) {
          SERVICE_POLICY.firebaseAudioMaxBytes = Math.floor(limitBytes * 0.65);
          saveAndApplyPolicy("Firebase audio limit set to " + Math.round(SERVICE_POLICY.firebaseAudioMaxBytes / 1024) + " KB");
          publishCompressedAudio(SERVICE_POLICY.firebaseAudioMaxBytes);
          return;
        }
        if (wErr) { setUploadProgress(-1); showStatus(formatDbError(wErr, "Audio upload failed."), true); return; }

        var au = document.getElementById("audioPlayer");
        var wasPlayingTemp = Boolean(au && musicState.currentPlayingId === tempId);
        var savedTime = (wasPlayingTemp && au.currentTime) ? au.currentTime : 0;
        var shouldResume = Boolean(wasPlayingTemp && !au.paused);

        state.threads[tid] = threadObj;
        removeTempLocalTrack(tempId);
        if (wasPlayingTemp) musicState.currentPlayingId = cloudTrackId;
        rebuildMusicPlaylist();

        if (wasPlayingTemp && au) {
          for (var k = 0; k < musicState.allTracks.length; k++) {
            if (musicState.allTracks[k].id === cloudTrackId) {
              musicState.currentIndex = k;
              var sel = document.getElementById("musicSelect"), te = document.getElementById("musicTrackTitle");
              if (sel) sel.value = String(k);
              if (te) te.innerHTML = esc(cloudTitle);
              au.onloadedmetadata = function() {
                au.onloadedmetadata = null;
                if (savedTime > 0 && au.duration && savedTime < au.duration) {
                  try { au.currentTime = savedTime; } catch (teErr) {}
                }
                if (shouldResume) au.play();
              };
              au.src = dataUrl;
              break;
            }
          }
        }
        setUploadProgress(100, "Audio uploaded to /music/!");
        showStatus("Audio uploaded to /music/!", false);
        refreshAllData(renderAll);
      }, function(upPct) { setUploadProgress(55 + Math.round(upPct * 0.43), "Uploading audio to /music/..."); });
    });
  }
  publishCompressedAudio(SERVICE_POLICY.firebaseAudioMaxBytes);
}

/* THREADS, COMMENTS, WALLS, REPOSTS, POLLS & PROFILE ACTIONS */
function countLikes(o) {
  if (!o) return 0;
  var c = 0;
  for (var k in o) if (o.hasOwnProperty(k) && o[k]) c++;
  return c;
}

function createThread() {
  if (!state.user) return;
  var sub = String(document.getElementById("newThreadSubject").value || "").replace(/^\s+|\s+$/g, "");
  var txt = String(document.getElementById("newThreadText").value || "").replace(/^\s+|\s+$/g, "");
  var vid = safeUrl(document.getElementById("newThreadVideo").value);
  var st = state.selectedStickers["thread_new"] || "";
  var fEl = document.getElementById("newThreadImage");
  var hasF = Boolean(fEl && fEl.files && fEl.files[0]);
  if (!txt && !vid && !st && !hasF) { showStatus("Enter text, sticker, image, or video link.", true); return; }

  uploadImageToImgbb(fEl, function(err, img) {
    if (err) { setUploadProgress(-1); showStatus(err, true); return; }
    var tid = generateId(), now = new Date().getTime();
    dbWrite("PUT", "threads/" + tid, {
      id: tid,
      board: state.currentBoard,
      subject: sub,
      text: txt,
      imageUrl: img || "",
      stickerUrl: st,
      videoUrl: vid,
      uid: state.user.uid,
      authorName: state.profile.nickname || state.user.username,
      authorAvatar: state.profile.avatarUrl || "",
      isAdminPost: !!state.user.isAdmin,
      createdAt: now,
      bumpedAt: now
    }, function() {
      if (hasF) setUploadProgress(100, "Thread posted!");
      clearSelectedSticker("thread_new");
      showStatus("Thread posted.", false);
      refreshAllData(renderAll);
    }, hasF ? function(p) { setUploadProgress(85 + Math.round(p * 0.15), "Posting thread..."); } : null);
  }, { keepProgressOpen: hasF });
}

function createComment(tid) {
  if (!state.user) return;
  var txt = String(document.getElementById("replyText").value || "").replace(/^\s+|\s+$/g, "");
  var vid = safeUrl(document.getElementById("replyVideo").value);
  var st = state.selectedStickers["reply_" + tid] || "";
  var fEl = document.getElementById("replyImage");
  var hasF = Boolean(fEl && fEl.files && fEl.files[0]);
  if (!txt && !vid && !st && !hasF) return;

  uploadImageToImgbb(fEl, function(err, img) {
    if (err) { setUploadProgress(-1); showStatus(err, true); return; }
    var cid = generateId(), now = new Date().getTime();
    dbWrite("PUT", "comments/" + tid + "/" + cid, {
      id: cid,
      text: txt,
      imageUrl: img || "",
      stickerUrl: st,
      videoUrl: vid,
      uid: state.user.uid,
      authorName: state.profile.nickname || state.user.username,
      authorAvatar: state.profile.avatarUrl || "",
      isAdminPost: !!state.user.isAdmin,
      createdAt: now
    }, function() {
      if (hasF) setUploadProgress(100, "Reply posted!");
      clearSelectedSticker("reply_" + tid);
      dbWrite("PATCH", "threads/" + tid, { bumpedAt: now }, function() { refreshAllData(renderAll); });
    }, hasF ? function(p) { setUploadProgress(85 + Math.round(p * 0.15), "Posting reply..."); } : null);
  }, { keepProgressOpen: hasF });
}

function deleteThread(tid) {
  var t = state.threads[tid];
  if (t && state.user && (t.uid === state.user.uid || state.user.isAdmin) && confirm("Delete thread?")) {
    dbWrite("DELETE", "threads/" + tid, null, function() {
      dbWrite("DELETE", "comments/" + tid, null, function() {
        if (state.view === "thread") state.view = "board";
        refreshAllData(renderAll);
      });
    });
  }
}

function deleteComment(tid, cid) {
  var c = (state.comments[tid] || {})[cid];
  if (c && state.user && (c.uid === state.user.uid || state.user.isAdmin) && confirm("Delete comment?")) {
    dbWrite("DELETE", "comments/" + tid + "/" + cid, null, function() { refreshAllData(renderAll); });
  }
}

function toggleThreadLike(tid) {
  if (state.user && state.threads[tid]) {
    var l = state.threads[tid].likes && state.threads[tid].likes[state.user.uid];
    dbWrite(l ? "DELETE" : "PUT", "threads/" + tid + "/likes/" + state.user.uid, l ? null : true, function() { refreshAllData(renderAll); });
  }
}

function toggleCommentLike(tid, cid) {
  if (state.user && (state.comments[tid] || {})[cid]) {
    var l = state.comments[tid][cid].likes && state.comments[tid][cid].likes[state.user.uid];
    dbWrite(l ? "DELETE" : "PUT", "comments/" + tid + "/" + cid + "/likes/" + state.user.uid, l ? null : true, function() { refreshAllData(renderAll); });
  }
}

function createWallPost(tUid) {
  if (!state.user || amIBlockedByUser(tUid)) return;
  var txt = String(document.getElementById("newWallText").value || "").replace(/^\s+|\s+$/g, "");
  var vid = safeUrl(document.getElementById("newWallVideo").value);
  var st = state.selectedStickers["wall_" + tUid] || "";
  var fEl = document.getElementById("newWallImage");
  var hasF = Boolean(fEl && fEl.files && fEl.files[0]);
  if (!txt && !vid && !st && !hasF) return;

  uploadImageToImgbb(fEl, function(err, img) {
    if (err) { setUploadProgress(-1); showStatus(err, true); return; }
    var pid = generateId();
    dbWrite("PUT", "walls/" + tUid + "/" + pid, {
      id: pid,
      wallOwnerUid: tUid,
      authorUid: state.user.uid,
      authorName: state.profile.nickname || state.user.username,
      text: txt,
      imageUrl: img || "",
      stickerUrl: st,
      videoUrl: vid,
      createdAt: new Date().getTime()
    }, function() {
      if (hasF) setUploadProgress(100, "Posted to wall!");
      clearSelectedSticker("wall_" + tUid);
      refreshAllData(renderAll);
    }, hasF ? function(p) { setUploadProgress(85 + Math.round(p * 0.15), "Posting to wall..."); } : null);
  }, { keepProgressOpen: hasF });
}

function deleteWallPost(tUid, pid) {
  var p = (state.walls[tUid] || {})[pid];
  if (state.user && p && (p.authorUid === state.user.uid || tUid === state.user.uid || state.user.isAdmin) && confirm("Delete wall post?")) {
    dbWrite("DELETE", "walls/" + tUid + "/" + pid, null, function() {
      dbWrite("DELETE", "wallComments/" + tUid + "/" + pid, null, function() { refreshAllData(renderAll); });
    });
  }
}

function toggleWallPostLike(tUid, pid) {
  if (state.user && (state.walls[tUid] || {})[pid]) {
    var l = state.walls[tUid][pid].likes && state.walls[tUid][pid].likes[state.user.uid];
    dbWrite(l ? "DELETE" : "PUT", "walls/" + tUid + "/" + pid + "/likes/" + state.user.uid, l ? null : true, function() { refreshAllData(renderAll); });
  }
}

function createWallComment(tUid, pid) {
  if (!state.user || amIBlockedByUser(tUid)) return;
  var i = document.getElementById("wcInput_" + pid);
  var txt = i ? String(i.value || "").replace(/^\s+|\s+$/g, "") : "";
  if (!txt) return;
  var cid = generateId();
  dbWrite("PUT", "wallComments/" + tUid + "/" + pid + "/" + cid, {
    id: cid,
    authorUid: state.user.uid,
    authorName: state.profile.nickname || state.user.username,
    text: txt,
    createdAt: new Date().getTime()
  }, function() { refreshAllData(renderAll); });
}

function repostToMyWall(type, itemId, parentId) {
  if (!state.user) { showStatus("Log in to repost.", true); return; }
  var sp = null;
  if (type === "thread" && state.threads[itemId]) {
    var t = state.threads[itemId];
    sp = { sourceAuthorUid: t.uid || "", sourceAuthorName: getUserDisplayNameByUid(t.uid, t.authorName), text: t.text || "", imageUrl: t.imageUrl || "", stickerUrl: t.stickerUrl || "", videoUrl: t.videoUrl || "", originLabel: "/" + (t.board || "b") + "/ Thread" };
  } else if (type === "comment" && (state.comments[parentId] || {})[itemId]) {
    var c = state.comments[parentId][itemId];
    sp = { sourceAuthorUid: c.uid || "", sourceAuthorName: getUserDisplayNameByUid(c.uid, c.authorName), text: c.text || "", imageUrl: c.imageUrl || "", stickerUrl: c.stickerUrl || "", videoUrl: c.videoUrl || "", originLabel: "Reply" };
  } else if (type === "wall" && (state.walls[parentId] || {})[itemId]) {
    var w = state.walls[parentId][itemId];
    sp = w.repostOf || { sourceAuthorUid: w.authorUid || "", sourceAuthorName: getUserDisplayNameByUid(w.authorUid, w.authorName), text: w.text || "", imageUrl: w.imageUrl || "", stickerUrl: w.stickerUrl || "", videoUrl: w.videoUrl || "", originLabel: "Wall" };
  }
  if (!sp) return;
  var note = prompt("Comment on repost:", "");
  if (note === null) return;
  var pid = generateId();
  dbWrite("PUT", "walls/" + state.user.uid + "/" + pid, {
    id: pid,
    wallOwnerUid: state.user.uid,
    authorUid: state.user.uid,
    authorName: state.profile.nickname || state.user.username,
    text: String(note || "").replace(/^\s+|\s+$/g, ""),
    repostOf: sp,
    createdAt: new Date().getTime()
  }, function() { showStatus("Reposted to your Wall!", false); refreshAllData(renderAll); });
}

function createBoardAdmin() {
  if (!state.user || !state.user.isAdmin) return;
  var s = sanitizeSlug(document.getElementById("adminBoardSlug").value);
  var t = String(document.getElementById("adminBoardTitle").value || "").replace(/^\s+|\s+$/g, "");
  if (s && t) {
    dbWrite("PUT", "boards/" + s, { slug: s, title: t, createdBy: state.user.uid, createdAt: new Date().getTime() }, function() {
      showStatus("Board /" + s + "/ created.", false);
      refreshAllData(renderAll);
    });
  }
}

function createBoardPoll() {
  if (!state.user) return;
  var s = sanitizeSlug(document.getElementById("pollBoardSlug").value);
  var t = String(document.getElementById("pollBoardTitle").value || "").replace(/^\s+|\s+$/g, "");
  var d = String(document.getElementById("pollBoardDesc").value || "").replace(/^\s+|\s+$/g, "");
  if (!s || !t) return;
  var v = {};
  v[state.user.uid] = "yes";
  dbWrite("PUT", "polls/" + s, { slug: s, title: t, description: d, createdBy: state.user.uid, createdAt: new Date().getTime(), status: "open", votes: v }, function() {
    showStatus("Poll started!", false);
    refreshAllData(renderAll);
  });
}

function cancelBoardPoll(s) {
  var p = state.polls[s];
  if (p && state.user && (p.createdBy === state.user.uid || state.user.isAdmin)) {
    dbWrite("DELETE", "polls/" + s, null, function() { refreshAllData(renderAll); });
  }
}

function voteOnPoll(s, ch) {
  if (!state.user) return;
  dbWrite("PUT", "polls/" + s + "/votes/" + state.user.uid, ch, function() {
    dbGet("polls/" + s, function(e, p) {
      if (!p || !p.votes) { refreshAllData(renderAll); return; }
      var y = 0, n = 0;
      for (var u in p.votes) if (p.votes.hasOwnProperty(u)) { if (p.votes[u] === "yes") y++; else if (p.votes[u] === "no") n++; }
      if (p.status !== "approved" && (y + n) >= CONFIG.pollMinVotes && y > n) {
        dbWrite("PUT", "boards/" + s, { slug: s, title: p.title, createdBy: p.createdBy, createdAt: new Date().getTime() }, function() {
          dbWrite("PATCH", "polls/" + s, { status: "approved" }, function() { refreshAllData(renderAll); });
        });
      } else {
        refreshAllData(renderAll);
      }
    });
  });
}

function addFavoriteCardItem() {
  if (!state.user) return;
  var cat = document.getElementById("favCategory").value;
  var title = String(document.getElementById("favTitle").value || "").replace(/^\s+|\s+$/g, "");
  var sub = String(document.getElementById("favSubtitle").value || "").replace(/^\s+|\s+$/g, "");
  var fEl = document.getElementById("favImageFile");
  var pUrl = safeUrl(document.getElementById("favImageUrl").value);
  var hasF = Boolean(fEl && fEl.files && fEl.files[0]);
  if (!title) { showStatus("Title required.", true); return; }
  function save(img) {
    if (!state.profile.favorites) state.profile.favorites = { films: [], tv: [], books: [], games: [] };
    if (!state.profile.favorites[cat]) state.profile.favorites[cat] = [];
    state.profile.favorites[cat].push({ id: generateId(), title: title, subtitle: sub, imageUrl: img || "" });
    dbWrite("PUT", "users/" + state.user.uid + "/favorites", state.profile.favorites, function() {
      if (hasF) setUploadProgress(100, "Card saved!");
      refreshAllData(renderAll);
    }, hasF ? function(p) { setUploadProgress(85 + Math.round(p * 0.15), "Saving favorite card..."); } : null);
  }
  if (hasF) uploadImageToImgbb(fEl, function(e, u) { if (!e) save(u); else { setUploadProgress(-1); showStatus(e, true); } }, { keepProgressOpen: true });
  else save(pUrl);
}

function removeFavoriteCardItem(cat, idx) {
  if (state.user && (state.profile.favorites || {})[cat]) {
    state.profile.favorites[cat].splice(idx, 1);
    dbWrite("PUT", "users/" + state.user.uid + "/favorites", state.profile.favorites, function() { refreshAllData(renderAll); });
  }
}

function addCustomProfileField() {
  if (!state.user) return;
  var l = String(document.getElementById("newCustomLabel").value || "").replace(/^\s+|\s+$/g, "");
  var v = String(document.getElementById("newCustomValue").value || "").replace(/^\s+|\s+$/g, "");
  if (l && v) {
    if (!state.profile.customFields) state.profile.customFields = [];
    state.profile.customFields.push({ label: l, value: v });
    dbWrite("PUT", "users/" + state.user.uid + "/customFields", state.profile.customFields, function() { refreshAllData(renderAll); });
  }
}

function removeCustomProfileField(idx) {
  if (state.user && state.profile.customFields) {
    state.profile.customFields.splice(idx, 1);
    dbWrite("PUT", "users/" + state.user.uid + "/customFields", state.profile.customFields, function() { refreshAllData(renderAll); });
  }
}

function saveUserProfile() {
  if (!state.user) return;
  var cust = [], ex = state.profile.customFields || [];
  for (var i = 0; i < ex.length; i++) {
    var l = document.getElementById("custLbl_" + i), v = document.getElementById("custVal_" + i);
    if ((l && l.value) || (v && v.value)) cust.push({ label: String(l ? l.value : ex[i].label), value: String(v ? v.value : ex[i].value) });
  }
  var fEl = document.getElementById("profAvatarFile");
  var hasF = Boolean(fEl && fEl.files && fEl.files[0]);
  uploadImageToImgbb(fEl, function(err, av) {
    if (err) { setUploadProgress(-1); showStatus(err, true); return; }
    var upd = {
      username: state.user.username,
      email: state.user.email,
      nickname: String(document.getElementById("profNickname").value || "").replace(/^\s+|\s+$/g, "") || state.user.username,
      status: String(document.getElementById("profStatus").value || "").replace(/^\s+|\s+$/g, ""),
      avatarUrl: av || state.profile.avatarUrl || "",
      pronouns: String(document.getElementById("profPronouns").value || "").replace(/^\s+|\s+$/g, ""),
      relationship: String(document.getElementById("profRelationship").value || "").replace(/^\s+|\s+$/g, ""),
      registeredAt: state.profile.registeredAt || formatDateOnly(new Date().getTime()),
      hometown: String(document.getElementById("profHometown").value || "").replace(/^\s+|\s+$/g, ""),
      politicalViews: String(document.getElementById("profPolitical").value || "").replace(/^\s+|\s+$/g, ""),
      birthDate: String(document.getElementById("profBirthDate").value || "").replace(/^\s+|\s+$/g, ""),
      website: safeUrl(document.getElementById("profWebsite").value),
      city: String(document.getElementById("profCity").value || "").replace(/^\s+|\s+$/g, ""),
      interests: String(document.getElementById("profInterests").value || "").replace(/^\s+|\s+$/g, ""),
      bio: String(document.getElementById("profBio").value || "").replace(/^\s+|\s+$/g, ""),
      favorites: state.profile.favorites || { films: [], tv: [], books: [], games: [] },
      customFields: cust
    };
    dbWrite("PATCH", "users/" + state.user.uid, upd, function() {
      if (hasF) setUploadProgress(100, "Profile & avatar saved!");
      for (var k in upd) if (upd.hasOwnProperty(k)) state.profile[k] = upd[k];
      showStatus("Profile saved!", false);
      renderAll();
    }, hasF ? function(p) { setUploadProgress(85 + Math.round(p * 0.15), "Saving profile..."); } : null);
  }, { keepProgressOpen: hasF });
}