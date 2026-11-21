/* ==========================================================================
   FEMBOORU SOCIAL: BOARDS, POLLS, THREADS, PROFILES, WALL ("STENA"),
   GROUPS, DMs, PUBLIC STICKERS, MUSIC AUTO-COMPRESSOR & NOTIFICATIONS
   ========================================================================== */
function isUserBlockedByMe(uid) {
  if (!state.user || !uid) return false;
  var myBlocks = state.blocks[state.user.uid] || {};
  return Boolean(myBlocks[uid]);
}

function amIBlockedByUser(targetUid) {
  if (!state.user || !targetUid) return false;
  var theirBlocks = state.blocks[targetUid] || {};
  return Boolean(theirBlocks[state.user.uid]);
}

function isSubscribedToUser(targetUid) {
  if (!state.user || !targetUid) return false;
  var mySubs = state.subscriptions[state.user.uid] || {};
  return Boolean(mySubs[targetUid]);
}

function countMapKeys(obj) {
  var c = 0;
  if (!obj) return 0;
  for (var k in obj) {
    if (obj.hasOwnProperty(k) && obj[k]) c++;
  }
  return c;
}

/* ==========================================================================
   NOTIFICATIONS
   ========================================================================== */
function pushNotification(targetUid, text, targetView, targetId) {
  if (!targetUid || (state.user && targetUid === state.user.uid)) return;
  var nid = generateId("nt");
  var item = {
    id: nid,
    text: text,
    view: targetView || "boards",
    targetId: targetId || "",
    read: false,
    createdAt: new Date().getTime()
  };
  dbWrite("PUT", "notifications/" + targetUid + "/" + nid, item, null);
}

function updateNotifBadge() {
  var badge = document.getElementById("notifBadge");
  if (!badge) return;
  if (!state.user) {
    badge.style.display = "none";
    return;
  }
  var myNotifs = state.notifications[state.user.uid] || {};
  var unread = 0;
  for (var id in myNotifs) {
    if (myNotifs.hasOwnProperty(id) && myNotifs[id] && !myNotifs[id].read) unread++;
  }
  badge.style.display = unread > 0 ? "inline-block" : "none";
  badge.textContent = String(unread);
}

function renderNotifications() {
  var box = document.getElementById("notificationsList");
  if (!box) return;
  if (!state.user) {
    box.innerHTML = "<p class='muted'>Log in to see your notifications.</p>";
    return;
  }
  var myNotifs = state.notifications[state.user.uid] || {};
  var list = [];
  for (var id in myNotifs) {
    if (myNotifs.hasOwnProperty(id) && myNotifs[id]) list.push(myNotifs[id]);
  }
  list.sort(function(a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
  if (!list.length) {
    box.innerHTML = "<p class='muted'>No notifications yet.</p>";
    return;
  }
  var h = "";
  for (var i = 0; i < list.length; i++) {
    var n = list[i];
    h += "<div class='comment-item' style='" + (n.read ? "" : "border-left:3px solid #AF0A0F;") + "'>" +
           "<span>" + esc(n.text) + "</span> <span class='muted'>(" + formatTime(n.createdAt) + ")</span>" +
         "</div>";
  }
  box.innerHTML = h;
}

function markAllNotificationsRead() {
  if (!state.user) return;
  var myNotifs = state.notifications[state.user.uid] || {};
  for (var id in myNotifs) {
    if (myNotifs.hasOwnProperty(id) && myNotifs[id] && !myNotifs[id].read) {
      myNotifs[id].read = true;
      dbWrite("PATCH", "notifications/" + state.user.uid + "/" + id, { read: true }, null);
    }
  }
  updateNotifBadge();
  renderNotifications();
}

/* ==========================================================================
   ADMIN SITE LOGO, BOARDS & COMMUNITY BOARD POLLS
   ========================================================================== */
function adminUpdateSiteLogo() {
  if (!isAdminUser()) {
    showStatus("Only admin can change the website logo.", true);
    return;
  }
  var fEl = document.getElementById("adminLogoFile");
  var uEl = document.getElementById("adminLogoUrl");
  var url = uEl ? safeUrl(uEl.value) : "";

  var saveLogo = function(finalUrl) {
    state.siteLogo = finalUrl;
    var img = document.getElementById("siteLogoImg");
    if (img) img.src = finalUrl;
    dbWrite("PUT", "site/logo", finalUrl, function() {
      if (fEl) fEl.value = "";
      if (uEl) uEl.value = "";
      showStatus("Main website logo updated!", false);
    });
  };

  if (fEl && fEl.files && fEl.files[0]) {
    uploadImageToImgbb(fEl, function(err, upUrl) {
      if (!err && upUrl) saveLogo(upUrl);
      else showStatus(err || "Logo upload failed.", true);
    });
    return;
  }
  if (!url) {
    showStatus("Choose a file or enter a logo URL.", true);
    return;
  }
  saveLogo(url);
}

function renderBoardsSidebar() {
  var box = document.getElementById("boardsList");
  if (!box) return;
  var h = "";
  for (var i = 0; i < state.boards.length; i++) {
    var b = state.boards[i];
    var active = (state.view === "boards" && state.currentBoard === b.slug) ? "active-board" : "";
    h += "<a href='#' class='" + active + "' onclick=\"selectBoard('" + esc(b.slug) + "');return false;\">/" + esc(b.slug) + "/ — " + esc(b.title) + "</a>";
  }
  box.innerHTML = h;
}

function selectBoard(slug) {
  state.currentBoard = slug;
  switchView("boards");
}

function proposeOrCreateBoard() {
  if (!state.user) {
    showStatus("Log in to propose or create a board.", true);
    return;
  }
  var slugInp = document.getElementById("newBoardSlug");
  var titleInp = document.getElementById("newBoardTitle");
  var descInp = document.getElementById("newBoardDesc");
  var slug = String(slugInp ? slugInp.value : "").toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 14);
  var title = String(titleInp ? titleInp.value : "").replace(/^\s+|\s+$/g, "").substring(0, 40);
  var desc = String(descInp ? descInp.value : "").replace(/^\s+|\s+$/g, "").substring(0, 120);

  if (!slug || !title) {
    showStatus("Enter board slug and title.", true);
    return;
  }
  for (var i = 0; i < state.boards.length; i++) {
    if (state.boards[i].slug === slug) {
      showStatus("Board /" + slug + "/ already exists.", true);
      return;
    }
  }

  if (isAdminUser()) {
    var bObj = { slug: slug, title: title, desc: desc || title, createdAt: new Date().getTime() };
    dbWrite("PUT", "boards/" + slug, bObj, function(err) {
      if (err) { showStatus("Failed to create board.", true); return; }
      state.boards.push(bObj);
      if (slugInp) slugInp.value = "";
      if (titleInp) titleInp.value = "";
      if (descInp) descInp.value = "";
      renderBoardsSidebar();
      showStatus("Admin created board /" + slug + "/ immediately!", false);
    });
    return;
  }

  var votes = {};
  votes[state.user.uid] = "yes";
  var pollObj = {
    slug: slug,
    title: title,
    desc: desc || title,
    createdBy: state.user.uid,
    createdByName: getDisplayUsername(),
    status: "open",
    votes: votes,
    createdAt: new Date().getTime()
  };
  state.polls[slug] = pollObj;
  dbWrite("PUT", "polls/" + slug, pollObj, function(err) {
    if (err) { showStatus("Failed to start board poll.", true); return; }
    if (slugInp) slugInp.value = "";
    if (titleInp) titleInp.value = "";
    if (descInp) descInp.value = "";
    renderBoardPolls();
    showStatus("Board proposal /" + slug + "/ created! Waiting for user votes.", false);
  });
}

function voteBoardPoll(slug, choice) {
  if (!state.user) {
    showStatus("Log in to vote on board proposals.", true);
    return;
  }
  var poll = state.polls[slug];
  if (!poll || poll.status === "approved") return;
  poll.votes = poll.votes || {};
  poll.votes[state.user.uid] = choice;

  var yes = 0, no = 0;
  for (var u in poll.votes) {
    if (poll.votes.hasOwnProperty(u)) {
      if (poll.votes[u] === "yes") yes++;
      else if (poll.votes[u] === "no") no++;
    }
  }
  var totalUsers = Math.max(2, countMapKeys(state.users));
  var majorityThreshold = Math.max(2, Math.floor(totalUsers / 2) + 1);

  dbWrite("PUT", "polls/" + slug + "/votes/" + state.user.uid, choice, function() {
    if (yes > no && yes >= majorityThreshold) {
      var newBoard = { slug: poll.slug, title: poll.title, desc: poll.desc || poll.title, createdAt: new Date().getTime() };
      poll.status = "approved";
      dbWrite("PUT", "boards/" + slug, newBoard, function() {
        dbWrite("PATCH", "polls/" + slug, { status: "approved" }, function() {
          state.boards.push(newBoard);
          renderBoardsSidebar();
          renderBoardPolls();
          showStatus("Majority agreed! Board /" + slug + "/ has been created!", false);
        });
      });
    } else {
      renderBoardPolls();
    }
  });
}

function cancelBoardPoll(slug) {
  var poll = state.polls[slug];
  if (!poll || !state.user) return;
  if (poll.createdBy !== state.user.uid && !isAdminUser()) return;
  delete state.polls[slug];
  dbWrite("DELETE", "polls/" + slug, null, function() {
    renderBoardPolls();
    showStatus("Board proposal /" + slug + "/ canceled.", false);
  });
}

function renderBoardPolls() {
  var box = document.getElementById("boardPollsBox");
  if (!box) return;
  var h = "";
  for (var slug in state.polls) {
    if (!state.polls.hasOwnProperty(slug) || !state.polls[slug]) continue;
    var p = state.polls[slug];
    if (p.status === "approved") continue;
    var yes = 0, no = 0;
    if (p.votes) {
      for (var u in p.votes) {
        if (p.votes.hasOwnProperty(u)) {
          if (p.votes[u] === "yes") yes++;
          else if (p.votes[u] === "no") no++;
        }
      }
    }
    var canCancel = state.user && (p.createdBy === state.user.uid || isAdminUser());
    h += "<div class='poll-card'>" +
           "<b>/" + esc(p.slug) + "/ — " + esc(p.title) + "</b><br>" +
           "<span class='muted'>By " + esc(p.createdByName || "User") + "</span><br>" +
           "<button type='button' onclick=\"voteBoardPoll('" + esc(p.slug) + "','yes')\">Agree (" + yes + ")</button> " +
           "<button type='button' onclick=\"voteBoardPoll('" + esc(p.slug) + "','no')\">Disagree (" + no + ")</button>" +
           (canCancel ? " <button type='button' class='btn-danger' onclick=\"cancelBoardPoll('" + esc(p.slug) + "')\">Cancel</button>" : "") +
         "</div>";
  }
  box.innerHTML = h || "<div class='muted' style='margin-top:4px;'>No active board proposals.</div>";
}

/* ==========================================================================
   IMAGEBOARD THREADS, COMMENTS, LIKES & DELETION
   ========================================================================== */
function createThread() {
  if (!state.user) {
    showStatus("Please log in to create a thread.", true);
    return;
  }
  var subjEl = document.getElementById("threadSubjectInput");
  var textEl = document.getElementById("threadTextInput");
  var imgEl = document.getElementById("threadImageInput");
  var vidEl = document.getElementById("threadVideoUrlInput");
  var stkEl = document.getElementById("threadStickerUrl");

  var subject = String(subjEl ? subjEl.value : "").replace(/^\s+|\s+$/g, "");
  var text = String(textEl ? textEl.value : "").replace(/^\s+|\s+$/g, "");
  var videoUrl = safeUrl(vidEl ? vidEl.value : "");
  var stickerUrl = safeUrl(stkEl ? stkEl.value : "");
  var hasFile = Boolean(imgEl && imgEl.files && imgEl.files[0]);

  if (!subject && !text && !videoUrl && !stickerUrl && !hasFile) {
    showStatus("Add text, an image, a sticker, or a video link.", true);
    return;
  }

  var finalizePost = function(uploadedImgUrl) {
    var tid = generateId("th");
    var now = new Date().getTime();
    var threadObj = {
      id: tid,
      board: state.currentBoard,
      uid: state.user.uid,
      authorName: getDisplayUsername(),
      subject: subject,
      text: text,
      imageUrl: uploadedImgUrl || "",
      videoUrl: videoUrl,
      stickerUrl: stickerUrl,
      likes: {},
      comments: {},
      createdAt: now,
      bumpedAt: now
    };
    state.threads[tid] = threadObj;
    dbWrite("PUT", "threads/" + tid, threadObj, function(err) {
      if (err) { showStatus("Failed to save thread.", true); return; }
      if (subjEl) subjEl.value = "";
      if (textEl) textEl.value = "";
      if (imgEl) imgEl.value = "";
      if (vidEl) vidEl.value = "";
      clearTargetSticker("thread");
      renderThreads();
      showStatus("Thread posted!", false);
    });
  };

  if (hasFile) {
    uploadImageToImgbb(imgEl, function(err, url) {
      if (err) { showStatus(err, true); return; }
      finalizePost(url);
    });
  } else {
    finalizePost("");
  }
}

function toggleThreadLike(tid) {
  if (!state.user) { showStatus("Log in to like posts.", true); return; }
  var t = state.threads[tid];
  if (!t) return;
  t.likes = t.likes || {};
  var uid = state.user.uid;
  if (t.likes[uid]) {
    delete t.likes[uid];
    dbWrite("DELETE", "threads/" + tid + "/likes/" + uid, null, function() { renderThreads(); });
  } else {
    t.likes[uid] = true;
    dbWrite("PUT", "threads/" + tid + "/likes/" + uid, true, function() {
      pushNotification(t.uid, getDisplayUsername() + " liked your thread.", "boards", tid);
      renderThreads();
    });
  }
}

function deleteThread(tid) {
  var t = state.threads[tid];
  if (!t || !state.user) return;
  if (t.uid !== state.user.uid && !isAdminUser()) return;
  delete state.threads[tid];
  dbWrite("DELETE", "threads/" + tid, null, function() {
    renderThreads();
    showStatus("Thread removed.", false);
  });
}

function createComment(tid) {
  if (!state.user) { showStatus("Log in to comment.", true); return; }
  var t = state.threads[tid];
  if (!t) return;
  var inp = document.getElementById("cmtInput_" + tid);
  var stkInp = document.getElementById("cmtSticker_" + tid);
  var text = String(inp ? inp.value : "").replace(/^\s+|\s+$/g, "");
  var stickerUrl = safeUrl(stkInp ? stkInp.value : "");
  if (!text && !stickerUrl) return;

  var cid = generateId("cm");
  var now = new Date().getTime();
  var cmt = {
    id: cid,
    uid: state.user.uid,
    authorName: getDisplayUsername(),
    text: text,
    stickerUrl: stickerUrl,
    likes: {},
    createdAt: now
  };
  t.comments = t.comments || {};
  t.comments[cid] = cmt;
  t.bumpedAt = now;
  dbWrite("PUT", "threads/" + tid + "/comments/" + cid, cmt, function() {
    dbWrite("PUT", "threads/" + tid + "/bumpedAt", now, null);
    pushNotification(t.uid, getDisplayUsername() + " commented on your thread.", "boards", tid);
    renderThreads();
  });
}

function deleteComment(tid, cid) {
  var t = state.threads[tid];
  if (!t || !t.comments || !t.comments[cid] || !state.user) return;
  var c = t.comments[cid];
  if (c.uid !== state.user.uid && !isAdminUser()) return;
  delete t.comments[cid];
  dbWrite("DELETE", "threads/" + tid + "/comments/" + cid, null, function() {
    renderThreads();
  });
}

function renderThreads() {
  var titleEl = document.getElementById("currentBoardTitle");
  var descEl = document.getElementById("currentBoardDesc");
  var box = document.getElementById("threadsContainer");
  if (!box) return;

  var curBoardObj = { slug: state.currentBoard, title: state.currentBoard, desc: "" };
  for (var b = 0; b < state.boards.length; b++) {
    if (state.boards[b].slug === state.currentBoard) {
      curBoardObj = state.boards[b];
      break;
    }
  }
  if (titleEl) titleEl.textContent = "/" + curBoardObj.slug + "/ — " + curBoardObj.title;
  if (descEl) descEl.textContent = curBoardObj.desc || "";

  var list = [];
  for (var tid in state.threads) {
    if (state.threads.hasOwnProperty(tid) && state.threads[tid] && state.threads[tid].board === state.currentBoard) {
      if (!isUserBlockedByMe(state.threads[tid].uid)) list.push(state.threads[tid]);
    }
  }
  list.sort(function(a, b) { return (b.bumpedAt || b.createdAt || 0) - (a.bumpedAt || a.createdAt || 0); });

  if (!list.length) {
    box.innerHTML = "<div class='box-panel'><div class='box-body muted'>No threads on /" + esc(state.currentBoard) + "/ yet. Start one above!</div></div>";
    return;
  }

  var h = "";
  for (var i = 0; i < list.length; i++) {
    var t = list[i];
    var canDel = state.user && (t.uid === state.user.uid || isAdminUser());
    var likeCount = countMapKeys(t.likes);
    var liked = state.user && t.likes && t.likes[state.user.uid];

    h += "<article class='thread-item'>" +
           "<div class='post-header'>" +
             "<div>" +
               (t.subject ? "<span class='post-subject'>" + esc(t.subject) + "</span> — " : "") +
               "<span class='post-author' onclick=\"openPublicProfile('" + esc(t.uid) + "')\">" + esc(getUserDisplayNameByUid(t.uid, t.authorName)) + "</span> " +
               "<span class='muted'>" + formatTime(t.createdAt) + "</span>" +
             "</div>" +
             "<div>" +
               "<button type='button' class='" + (liked ? "btn-active" : "") + "' onclick=\"toggleThreadLike('" + esc(t.id) + "')\">Like (" + likeCount + ")</button> " +
               "<button type='button' onclick=\"repostToWall('thread','" + esc(t.id) + "')\">Repost</button>" +
               (canDel ? " <button type='button' class='btn-danger' onclick=\"deleteThread('" + esc(t.id) + "')\">Delete</button>" : "") +
             "</div>" +
           "</div>";

    if (isValidImageSrc(t.imageUrl)) {
      h += "<img class='post-media' src='" + esc(t.imageUrl) + "' alt='Attachment' onclick=\"openZoomModal(this.src,'" + esc(t.subject || "Thread Image") + "','')\">";
    }
    if (isValidImageSrc(t.stickerUrl)) {
      h += "<img class='post-sticker' src='" + esc(t.stickerUrl) + "' alt='Sticker'>";
    }
    if (t.videoUrl) h += renderVideoHtml(t.videoUrl);
    if (t.audioData) {
      h += "<audio controls preload='none' src='" + esc(t.audioData) + "' style='display:block;margin:6px 0;max-width:100%;'></audio>";
    }
    if (t.text) h += "<div class='post-body'>" + esc(t.text) + "</div>";

    // Comments
    var cmts = [];
    if (t.comments) {
      for (var cid in t.comments) {
        if (t.comments.hasOwnProperty(cid) && t.comments[cid] && !isUserBlockedByMe(t.comments[cid].uid)) {
          cmts.push(t.comments[cid]);
        }
      }
    }
    cmts.sort(function(a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });

    h += "<div class='comments-box'>";
    for (var c = 0; c < cmts.length; c++) {
      var cm = cmts[c];
      var canDelCm = state.user && (cm.uid === state.user.uid || isAdminUser());
      h += "<div class='comment-item'>" +
             "<div class='post-header'>" +
               "<span><b class='post-author' onclick=\"openPublicProfile('" + esc(cm.uid) + "')\">" + esc(getUserDisplayNameByUid(cm.uid, cm.authorName)) + "</b> <span class='muted'>" + formatTime(cm.createdAt) + "</span></span>" +
               (canDelCm ? "<button type='button' class='btn-danger' onclick=\"deleteComment('" + esc(t.id) + "','" + esc(cm.id) + "')\">x</button>" : "") +
             "</div>" +
             (isValidImageSrc(cm.stickerUrl) ? "<img class='post-sticker' src='" + esc(cm.stickerUrl) + "' alt='Sticker'>" : "") +
             "<div>" + esc(cm.text) + "</div>" +
           "</div>";
    }
    h += "<div class='form-row'>" +
           "<input type='text' id='cmtInput_" + esc(t.id) + "' placeholder='Write comment...'>" +
           "<input type='hidden' id='cmtSticker_" + esc(t.id) + "'>" +
           "<button type='button' onclick=\"openStickerPicker('cmt_" + esc(t.id) + "')\">+ Sticker</button>" +
           "<button type='button' onclick=\"createComment('" + esc(t.id) + "')\">Reply</button>" +
         "</div>" +
         "<div id='cmtStickerPreview_" + esc(t.id) + "' class='sticker-attach-preview'></div>" +
       "</div></article>";
  }
  box.innerHTML = h;
}

/* ==========================================================================
   PROFILES, FAVORITE CARDS (DISCORD STYLE), MEMBERS SEARCH, SUBSCRIPTIONS & BLOCKS
   ========================================================================== */
function openMyProfile() {
  if (!state.user) {
    showStatus("Log in to view and edit your profile.", true);
    return;
  }
  openPublicProfile(state.user.uid);
}

function openPublicProfile(uid) {
  if (!uid) return;
  state.viewingProfileUid = uid;
  switchView("profile");
}

function renderPublicProfile() {
  var uid = state.viewingProfileUid || (state.user && state.user.uid) || "";
  var prof = state.users[uid] || (state.user && state.user.uid === uid ? state.profile : null);
  if (!prof) return;

  var isOwn = Boolean(state.user && state.user.uid === uid);
  var editor = document.getElementById("myProfileEditor");
  if (editor) editor.style.display = isOwn ? "block" : "none";

  document.getElementById("profHeaderTitle").textContent = (prof.displayName || prof.username || "User") + " (@" + (prof.username || "user") + ")";
  document.getElementById("profStatusBanner").textContent = prof.status ? ("\"" + prof.status + "\"") : "No status message set.";
  document.getElementById("profViewAvatar").src = isValidImageSrc(prof.avatarUrl) ? prof.avatarUrl : DEFAULT_AVATAR;
  document.getElementById("profViewDisplayName").textContent = prof.displayName || prof.username || "User";
  document.getElementById("profViewPronouns").textContent = prof.pronouns || "—";
  document.getElementById("profViewRelationship").textContent = prof.relationship || "—";
  document.getElementById("profViewRegDate").textContent = prof.regDate || "—";
  document.getElementById("profViewHometown").textContent = prof.hometown || "—";
  document.getElementById("profViewPolitics").textContent = prof.politics || "—";
  document.getElementById("profViewBirthDate").textContent = prof.birthDate || "—";

  var siteEl = document.getElementById("profViewWebsite");
  var cleanSite = safeUrl(prof.website);
  siteEl.innerHTML = cleanSite ? ("<a href='" + esc(cleanSite) + "' target='_blank' rel='noopener'>" + esc(cleanSite) + "</a>") : "—";
  document.getElementById("profViewCity").textContent = prof.city || "—";
  document.getElementById("profViewInterests").textContent = prof.interests || "—";
  document.getElementById("profViewAbout").textContent = prof.about || "—";

  // Custom Fields
  var cfBox = document.getElementById("profViewCustomFields");
  var cf = Array.isArray(prof.customFields) ? prof.customFields : [];
  if (cf.length) {
    var cfHtml = "<table class='info-table'>";
    for (var i = 0; i < cf.length; i++) {
      if (cf[i] && cf[i].label) {
        cfHtml += "<tr><th>" + esc(cf[i].label) + ":</th><td>" + esc(cf[i].value || "—") + "</td></tr>";
      }
    }
    cfBox.innerHTML = cfHtml + "</table>";
  } else {
    cfBox.innerHTML = "";
  }

  // Discord-Style Zoomable Cards for Favorites
  var favBox = document.getElementById("profFavoritesCards");
  var favs = prof.favorites || {};
  var cardDefs = [
    { key: "film", label: "Favorite Film" },
    { key: "show", label: "Favorite TV-Show" },
    { key: "book", label: "Favorite Book" },
    { key: "game", label: "Favorite Game" }
  ];
  var cardsHtml = "";
  for (var c = 0; c < cardDefs.length; c++) {
    var item = favs[cardDefs[c].key];
    if (item && (item.title || item.img)) {
      var imgSrc = isValidImageSrc(item.img) ? item.img : DEFAULT_FAV_IMG;
      cardsHtml += "<div class='fav-card' onclick=\"openZoomModal('" + esc(imgSrc) + "','" + esc(cardDefs[c].label) + "','" + esc(item.title || "") + "')\">" +
                     "<img src='" + esc(imgSrc) + "' alt='" + esc(cardDefs[c].label) + "'>" +
                     "<div class='fav-card-type'>" + esc(cardDefs[c].label) + "</div>" +
                     "<div class='fav-card-title'>" + esc(item.title || "Untitled") + "</div>" +
                   "</div>";
    }
  }
  favBox.innerHTML = cardsHtml || "<span class='muted'>No favorite cards added yet.</span>";

  // Subscriber count + Subscribe/Block/DM buttons
  var subCount = 0;
  for (var su in state.subscriptions) {
    if (state.subscriptions.hasOwnProperty(su) && state.subscriptions[su] && state.subscriptions[su][uid]) subCount++;
  }
  document.getElementById("profSubStats").textContent = subCount + " subscriber(s)";

  var actBox = document.getElementById("profActionButtons");
  if (!isOwn && state.user) {
    var subbed = isSubscribedToUser(uid);
    var blocked = isUserBlockedByMe(uid);
    actBox.innerHTML =
      "<button type='button' class='" + (subbed ? "btn-active" : "") + "' onclick=\"toggleSubscribeUser('" + esc(uid) + "')\">" + (subbed ? "Subscribed" : "Subscribe") + "</button> " +
      "<button type='button' onclick=\"openDmConversation('" + esc(uid) + "')\">Send DM</button> " +
      "<button type='button' class='btn-danger' onclick=\"toggleBlockUser('" + esc(uid) + "')\">" + (blocked ? "Unblock" : "Block") + "</button>";
  } else {
    actBox.innerHTML = "";
  }

  // Populate editor inputs if own profile
  if (isOwn) {
    document.getElementById("editProfStatus").value = prof.status || "";
    document.getElementById("editProfDisplayName").value = prof.displayName || prof.username || "";
    document.getElementById("editProfAvatarUrl").value = prof.avatarUrl || "";
    document.getElementById("editProfPronouns").value = prof.pronouns || "";
    document.getElementById("editProfRelationship").value = prof.relationship || "";
    document.getElementById("editProfHometown").value = prof.hometown || "";
    document.getElementById("editProfPolitics").value = prof.politics || "";
    document.getElementById("editProfBirthDate").value = prof.birthDate || "";
    document.getElementById("editProfWebsite").value = prof.website || "";
    document.getElementById("editProfCity").value = prof.city || "";
    document.getElementById("editProfInterests").value = prof.interests || "";
    document.getElementById("editProfAbout").value = prof.about || "";

    document.getElementById("editFavFilmTitle").value = (favs.film && favs.film.title) || "";
    document.getElementById("editFavFilmImg").value = (favs.film && favs.film.img) || "";
    document.getElementById("editFavShowTitle").value = (favs.show && favs.show.title) || "";
    document.getElementById("editFavShowImg").value = (favs.show && favs.show.img) || "";
    document.getElementById("editFavBookTitle").value = (favs.book && favs.book.title) || "";
    document.getElementById("editFavBookImg").value = (favs.book && favs.book.img) || "";
    document.getElementById("editFavGameTitle").value = (favs.game && favs.game.title) || "";
    document.getElementById("editFavGameImg").value = (favs.game && favs.game.img) || "";

    var edCf = document.getElementById("customFieldsEditor");
    edCf.innerHTML = "";
    for (var j = 0; j < cf.length; j++) {
      addCustomProfileFieldRow(cf[j].label, cf[j].value);
    }
  }

  document.getElementById("profileWallTitle").textContent = (prof.displayName || prof.username || "User") + "'s Wall (Stena)";
  renderProfileWall(uid);
}

function addCustomProfileFieldRow(labelVal, valueVal) {
  var box = document.getElementById("customFieldsEditor");
  if (!box) return;
  var row = document.createElement("div");
  row.className = "form-row custom-field-row";
  row.innerHTML =
    "<input type='text' class='cf-label' placeholder='Field name (e.g. Discord)' value='" + esc(labelVal || "") + "'>" +
    "<input type='text' class='cf-value' placeholder='Value' value='" + esc(valueVal || "") + "'>" +
    "<button type='button' class='btn-danger' onclick='this.parentNode.parentNode.removeChild(this.parentNode)'>x</button>";
  box.appendChild(row);
}

function saveMyProfile() {
  if (!state.user) return;
  var uid = state.user.uid;
  var fileEl = document.getElementById("editProfAvatarFile");
  var urlEl = document.getElementById("editProfAvatarUrl");

  var finishSave = function(avatarUrl) {
    var cfRows = document.querySelectorAll("#customFieldsEditor .custom-field-row");
    var customFields = [];
    for (var i = 0; i < cfRows.length; i++) {
      var l = cfRows[i].querySelector(".cf-label").value.replace(/^\s+|\s+$/g, "");
      var v = cfRows[i].querySelector(".cf-value").value.replace(/^\s+|\s+$/g, "");
      if (l) customFields.push({ label: l, value: v });
    }

    var updated = {
      uid: uid,
      username: state.user.username,
      email: state.user.email,
      status: document.getElementById("editProfStatus").value.replace(/^\s+|\s+$/g, ""),
      displayName: document.getElementById("editProfDisplayName").value.replace(/^\s+|\s+$/g, "") || state.user.username,
      avatarUrl: safeUrl(avatarUrl) || DEFAULT_AVATAR,
      pronouns: document.getElementById("editProfPronouns").value.replace(/^\s+|\s+$/g, ""),
      relationship: document.getElementById("editProfRelationship").value.replace(/^\s+|\s+$/g, ""),
      regDate: (state.profile && state.profile.regDate) || formatTime(new Date().getTime()).split(" ")[0],
      hometown: document.getElementById("editProfHometown").value.replace(/^\s+|\s+$/g, ""),
      politics: document.getElementById("editProfPolitics").value.replace(/^\s+|\s+$/g, ""),
      birthDate: document.getElementById("editProfBirthDate").value,
      website: document.getElementById("editProfWebsite").value.replace(/^\s+|\s+$/g, ""),
      city: document.getElementById("editProfCity").value.replace(/^\s+|\s+$/g, ""),
      interests: document.getElementById("editProfInterests").value.replace(/^\s+|\s+$/g, ""),
      about: document.getElementById("editProfAbout").value.replace(/^\s+|\s+$/g, ""),
      favorites: {
        film: { title: document.getElementById("editFavFilmTitle").value.trim(), img: safeUrl(document.getElementById("editFavFilmImg").value) },
        show: { title: document.getElementById("editFavShowTitle").value.trim(), img: safeUrl(document.getElementById("editFavShowImg").value) },
        book: { title: document.getElementById("editFavBookTitle").value.trim(), img: safeUrl(document.getElementById("editFavBookImg").value) },
        game: { title: document.getElementById("editFavGameTitle").value.trim(), img: safeUrl(document.getElementById("editFavGameImg").value) }
      },
      customFields: customFields
    };

    state.profile = updated;
    state.users[uid] = updated;
    dbWrite("PUT", "users/" + uid, updated, function(err) {
      if (err) { showStatus("Failed to save profile.", true); return; }
      updateAuthUi();
      renderPublicProfile();
      showStatus("Profile saved!", false);
    });
  };

  if (fileEl && fileEl.files && fileEl.files[0]) {
    uploadImageToImgbb(fileEl, function(err, upUrl) {
      if (err) { showStatus(err, true); return; }
      fileEl.value = "";
      finishSave(upUrl);
    });
  } else {
    finishSave(urlEl ? urlEl.value : "");
  }
}

function toggleSubscribeUser(targetUid) {
  if (!state.user || !targetUid || targetUid === state.user.uid) return;
  var uid = state.user.uid;
  state.subscriptions[uid] = state.subscriptions[uid] || {};
  if (state.subscriptions[uid][targetUid]) {
    delete state.subscriptions[uid][targetUid];
    dbWrite("DELETE", "subscriptions/" + uid + "/" + targetUid, null, function() { renderPublicProfile(); });
  } else {
    state.subscriptions[uid][targetUid] = true;
    dbWrite("PUT", "subscriptions/" + uid + "/" + targetUid, true, function() {
      pushNotification(targetUid, getDisplayUsername() + " subscribed to you!", "profile", uid);
      renderPublicProfile();
    });
  }
}

function toggleBlockUser(targetUid) {
  if (!state.user || !targetUid || targetUid === state.user.uid) return;
  var uid = state.user.uid;
  state.blocks[uid] = state.blocks[uid] || {};
  if (state.blocks[uid][targetUid]) {
    delete state.blocks[uid][targetUid];
    dbWrite("DELETE", "blocks/" + uid + "/" + targetUid, null, function() {
      renderPublicProfile();
      showStatus("User unblocked.", false);
    });
  } else {
    state.blocks[uid][targetUid] = true;
    dbWrite("PUT", "blocks/" + uid + "/" + targetUid, true, function() {
      renderPublicProfile();
      showStatus("User blocked.", false);
    });
  }
}

function renderMembersList() {
  var grid = document.getElementById("membersDirectoryGrid");
  if (!grid) return;
  var fName = (document.getElementById("memberFilterName").value || "").toLowerCase();
  var fPron = (document.getElementById("memberFilterPronouns").value || "").toLowerCase();
  var fCity = (document.getElementById("memberFilterCity").value || "").toLowerCase();
  var fRel = (document.getElementById("memberFilterRelation").value || "").toLowerCase();
  var fPol = (document.getElementById("memberFilterPolitics").value || "").toLowerCase();
  var fInt = (document.getElementById("memberFilterInterest").value || "").toLowerCase();

  var h = "";
  for (var uid in state.users) {
    if (!state.users.hasOwnProperty(uid) || !state.users[uid]) continue;
    var u = state.users[uid];
    var hayName = ((u.displayName || "") + " " + (u.username || "")).toLowerCase();
    var hayCity = ((u.city || "") + " " + (u.hometown || "")).toLowerCase();
    var favs = u.favorites || {};
    var hayInt = ((u.interests || "") + " " + JSON.stringify(favs)).toLowerCase();

    if (fName && hayName.indexOf(fName) === -1) continue;
    if (fPron && String(u.pronouns || "").toLowerCase().indexOf(fPron) === -1) continue;
    if (fCity && hayCity.indexOf(fCity) === -1) continue;
    if (fRel && String(u.relationship || "").toLowerCase().indexOf(fRel) === -1) continue;
    if (fPol && String(u.politics || "").toLowerCase().indexOf(fPol) === -1) continue;
    if (fInt && hayInt.indexOf(fInt) === -1) continue;

    h += "<div class='member-card'>" +
           "<div style='display:flex;gap:8px;align-items:center;'>" +
             "<img src='" + esc(isValidImageSrc(u.avatarUrl) ? u.avatarUrl : DEFAULT_AVATAR) + "' style='width:46px;height:46px;object-fit:cover;border:1px solid #800000;'>" +
             "<div>" +
               "<a href='#' onclick=\"openPublicProfile('" + esc(uid) + "');return false;\"><b>" + esc(u.displayName || u.username) + "</b></a>" +
               "<div class='muted'>@" + esc(u.username) + (u.pronouns ? " • " + esc(u.pronouns) : "") + "</div>" +
               "<div class='muted'>" + esc(u.city || u.hometown || "") + "</div>" +
             "</div>" +
           "</div>" +
         "</div>";
  }
  grid.innerHTML = h || "<p class='muted'>No members match your filter.</p>";
}

/* ==========================================================================
   WALL ("STENA") & REPOSTS
   ========================================================================== */
function setWallFeedFilter(mode) {
  state.wallFilter = mode;
  var bAll = document.getElementById("wallFilterAllBtn");
  var bSub = document.getElementById("wallFilterSubBtn");
  if (bAll) bAll.className = mode === "all" ? "btn-active" : "";
  if (bSub) bSub.className = mode === "subs" ? "btn-active" : "";
  renderGlobalWall();
}

function submitWallPost(targetUid, textId, fileId, vidId, stkId, stkKey) {
  if (!state.user) { showStatus("Log in to post on walls.", true); return; }
  if (amIBlockedByUser(targetUid)) { showStatus("You are blocked from posting on this wall.", true); return; }

  var tEl = document.getElementById(textId);
  var fEl = document.getElementById(fileId);
  var vEl = document.getElementById(vidId);
  var sEl = document.getElementById(stkId);

  var text = String(tEl ? tEl.value : "").replace(/^\s+|\s+$/g, "");
  var videoUrl = safeUrl(vEl ? vEl.value : "");
  var stickerUrl = safeUrl(sEl ? sEl.value : "");
  var hasFile = Boolean(fEl && fEl.files && fEl.files[0]);

  if (!text && !videoUrl && !stickerUrl && !hasFile) {
    showStatus("Write a message or attach media.", true);
    return;
  }

  var savePost = function(imgUrl) {
    var pid = generateId("wp");
    var postObj = {
      id: pid,
      targetUid: targetUid,
      authorUid: state.user.uid,
      authorName: getDisplayUsername(),
      text: text,
      imageUrl: imgUrl || "",
      videoUrl: videoUrl,
      stickerUrl: stickerUrl,
      likes: {},
      comments: {},
      createdAt: new Date().getTime()
    };
    state.walls[targetUid] = state.walls[targetUid] || { posts: {} };
    state.walls[targetUid].posts = state.walls[targetUid].posts || {};
    state.walls[targetUid].posts[pid] = postObj;

    dbWrite("PUT", "walls/" + targetUid + "/posts/" + pid, postObj, function() {
      if (tEl) tEl.value = "";
      if (fEl) fEl.value = "";
      if (vEl) vEl.value = "";
      clearTargetSticker(stkKey);
      pushNotification(targetUid, getDisplayUsername() + " wrote on your wall!", "profile", targetUid);
      renderProfileWall(targetUid);
      renderGlobalWall();
      showStatus("Posted to wall!", false);
    });
  };

  if (hasFile) {
    uploadImageToImgbb(fEl, function(err, upUrl) {
      if (err) { showStatus(err, true); return; }
      savePost(upUrl);
    });
  } else {
    savePost("");
  }
}

function postToUserWall() {
  var uid = state.viewingProfileUid || (state.user && state.user.uid);
  if (uid) submitWallPost(uid, "profileWallText", "profileWallFile", "profileWallVideo", "profileWallSticker", "profileWall");
}

function postToGlobalWall() {
  if (!state.user) { showStatus("Log in to post.", true); return; }
  submitWallPost(state.user.uid, "globalWallText", "globalWallFile", "globalWallVideo", "globalWallSticker", "globalWall");
}

function repostToWall(kind, itemId, extraUid) {
  if (!state.user) { showStatus("Log in to repost.", true); return; }
  var src = null;
  if (kind === "thread" && state.threads[itemId]) {
    var t = state.threads[itemId];
    src = { authorName: t.authorName, text: (t.subject ? t.subject + ": " : "") + (t.text || ""), imageUrl: t.imageUrl || "", videoUrl: t.videoUrl || "", stickerUrl: t.stickerUrl || "" };
  } else if (kind === "wall" && extraUid && state.walls[extraUid] && state.walls[extraUid].posts && state.walls[extraUid].posts[itemId]) {
    var w = state.walls[extraUid].posts[itemId];
    src = { authorName: w.authorName, text: w.text || "", imageUrl: w.imageUrl || "", videoUrl: w.videoUrl || "", stickerUrl: w.stickerUrl || "" };
  }
  if (!src) return;

  var myUid = state.user.uid;
  var pid = generateId("wp");
  var postObj = {
    id: pid,
    targetUid: myUid,
    authorUid: myUid,
    authorName: getDisplayUsername(),
    text: "",
    repostOf: src,
    likes: {},
    comments: {},
    createdAt: new Date().getTime()
  };
  state.walls[myUid] = state.walls[myUid] || { posts: {} };
  state.walls[myUid].posts = state.walls[myUid].posts || {};
  state.walls[myUid].posts[pid] = postObj;
  dbWrite("PUT", "walls/" + myUid + "/posts/" + pid, postObj, function() {
    renderGlobalWall();
    showStatus("Reposted to your wall!", false);
  });
}

function renderWallPostCard(p) {
  var targetUid = p.targetUid;
  var liked = state.user && p.likes && p.likes[state.user.uid];
  var canDel = state.user && (p.authorUid === state.user.uid || targetUid === state.user.uid || isAdminUser());
  var wallOwnerName = getUserDisplayNameByUid(targetUid, "User");

  var h = "<div class='wall-post-card'>" +
            "<div class='post-header'>" +
              "<div>" +
                "<span class='post-author' onclick=\"openPublicProfile('" + esc(p.authorUid) + "')\">" + esc(getUserDisplayNameByUid(p.authorUid, p.authorName)) + "</span>" +
                (p.authorUid !== targetUid ? " &rarr; <a href='#' onclick=\"openPublicProfile('" + esc(targetUid) + "');return false;\">" + esc(wallOwnerName) + "'s wall</a>" : "") +
                " <span class='muted'>" + formatTime(p.createdAt) + "</span>" +
              "</div>" +
              "<div>" +
                "<button type='button' class='" + (liked ? "btn-active" : "") + "' onclick=\"toggleWallLike('" + esc(targetUid) + "','" + esc(p.id) + "')\">Like (" + countMapKeys(p.likes) + ")</button> " +
                "<button type='button' onclick=\"repostToWall('wall','" + esc(p.id) + "','" + esc(targetUid) + "')\">Repost</button>" +
                (canDel ? " <button type='button' class='btn-danger' onclick=\"deleteWallPost('" + esc(targetUid) + "','" + esc(p.id) + "')\">Delete</button>" : "") +
              "</div>" +
            "</div>";

  if (p.text) h += "<div class='post-body'>" + esc(p.text) + "</div>";
  if (isValidImageSrc(p.imageUrl)) h += "<img class='post-media' src='" + esc(p.imageUrl) + "' onclick=\"openZoomModal(this.src,'Wall Image','')\">";
  if (isValidImageSrc(p.stickerUrl)) h += "<img class='post-sticker' src='" + esc(p.stickerUrl) + "'>";
  if (p.videoUrl) h += renderVideoHtml(p.videoUrl);

  if (p.repostOf) {
    var r = p.repostOf;
    h += "<div class='repost-embed'>" +
           "<div class='mini-title'>Reposted from " + esc(r.authorName || "User") + ":</div>" +
           (r.text ? "<div class='post-body'>" + esc(r.text) + "</div>" : "") +
           (isValidImageSrc(r.imageUrl) ? "<img class='post-media' src='" + esc(r.imageUrl) + "' onclick=\"openZoomModal(this.src,'Reposted Media','')\">" : "") +
           (isValidImageSrc(r.stickerUrl) ? "<img class='post-sticker' src='" + esc(r.stickerUrl) + "'>" : "") +
           (r.videoUrl ? renderVideoHtml(r.videoUrl) : "") +
         "</div>";
  }
  return h + "</div>";
}

function toggleWallLike(targetUid, pid) {
  if (!state.user) return;
  var p = state.walls[targetUid] && state.walls[targetUid].posts && state.walls[targetUid].posts[pid];
  if (!p) return;
  p.likes = p.likes || {};
  var uid = state.user.uid;
  if (p.likes[uid]) {
    delete p.likes[uid];
    dbWrite("DELETE", "walls/" + targetUid + "/posts/" + pid + "/likes/" + uid, null, function() {
      renderProfileWall(targetUid);
      renderGlobalWall();
    });
  } else {
    p.likes[uid] = true;
    dbWrite("PUT", "walls/" + targetUid + "/posts/" + pid + "/likes/" + uid, true, function() {
      renderProfileWall(targetUid);
      renderGlobalWall();
    });
  }
}

function deleteWallPost(targetUid, pid) {
  if (!state.user) return;
  delete state.walls[targetUid].posts[pid];
  dbWrite("DELETE", "walls/" + targetUid + "/posts/" + pid, null, function() {
    renderProfileWall(targetUid);
    renderGlobalWall();
  });
}

function renderProfileWall(targetUid) {
  var box = document.getElementById("profileWallPosts");
  if (!box) return;
  var postsMap = (state.walls[targetUid] && state.walls[targetUid].posts) || {};
  var list = [];
  for (var pid in postsMap) {
    if (postsMap.hasOwnProperty(pid) && postsMap[pid] && !isUserBlockedByMe(postsMap[pid].authorUid)) {
      list.push(postsMap[pid]);
    }
  }
  list.sort(function(a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
  var h = "";
  for (var i = 0; i < list.length; i++) h += renderWallPostCard(list[i]);
  box.innerHTML = h || "<p class='muted' style='margin-top:6px;'>Wall is empty.</p>";
}

function renderGlobalWall() {
  var box = document.getElementById("wallPostsContainer");
  if (!box) return;
  var list = [];
  for (var tUid in state.walls) {
    if (!state.walls.hasOwnProperty(tUid) || !state.walls[tUid] || !state.walls[tUid].posts) continue;
    if (state.wallFilter === "subs" && state.user && tUid !== state.user.uid && !isSubscribedToUser(tUid)) continue;
    var pMap = state.walls[tUid].posts;
    for (var pid in pMap) {
      if (pMap.hasOwnProperty(pid) && pMap[pid] && !isUserBlockedByMe(pMap[pid].authorUid)) {
        list.push(pMap[pid]);
      }
    }
  }
  list.sort(function(a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
  var h = "";
  for (var i = 0; i < list.length; i++) h += renderWallPostCard(list[i]);
  box.innerHTML = h || "<div class='box-panel'><div class='box-body muted'>No wall posts to display.</div></div>";
}

/* ==========================================================================
   GROUPS, DMs & PUBLIC STICKERS ARCHIVE (STATIC + ANIMATED, SIZE LIMITED)
   ========================================================================== */
function createGroup() {
  if (!state.user) { showStatus("Log in to create a group.", true); return; }
  var nEl = document.getElementById("groupNameInput");
  var dEl = document.getElementById("groupDescInput");
  var name = String(nEl ? nEl.value : "").replace(/^\s+|\s+$/g, "");
  var desc = String(dEl ? dEl.value : "").replace(/^\s+|\s+$/g, "");
  if (!name) { showStatus("Enter a group name.", true); return; }

  var gid = generateId("grp");
  var members = {};
  members[state.user.uid] = true;
  var grp = {
    id: gid,
    name: name,
    desc: desc,
    ownerUid: state.user.uid,
    members: members,
    messages: {},
    createdAt: new Date().getTime()
  };
  state.groups[gid] = grp;
  dbWrite("PUT", "groups/" + gid, grp, function() {
    if (nEl) nEl.value = "";
    if (dEl) dEl.value = "";
    renderGroupsList();
    openGroup(gid);
  });
}

function renderGroupsList() {
  var box = document.getElementById("groupsList");
  if (!box) return;
  var h = "";
  for (var gid in state.groups) {
    if (!state.groups.hasOwnProperty(gid) || !state.groups[gid]) continue;
    var g = state.groups[gid];
    h += "<div class='group-card'>" +
           "<b>" + esc(g.name) + "</b> <span class='muted'>(" + countMapKeys(g.members) + " members)</span><br>" +
           "<span class='muted'>" + esc(g.desc || "") + "</span><br>" +
           "<button type='button' style='margin-top:4px;' onclick=\"openGroup('" + esc(gid) + "')\">Open Chat</button>" +
         "</div>";
  }
  box.innerHTML = h || "<p class='muted'>No groups yet.</p>";
}

function openGroup(gid) {
  state.activeGroupId = gid;
  renderActiveGroup();
}

function toggleJoinActiveGroup() {
  if (!state.user || !state.activeGroupId) return;
  var g = state.groups[state.activeGroupId];
  if (!g) return;
  g.members = g.members || {};
  var uid = state.user.uid;
  if (g.members[uid]) {
    delete g.members[uid];
    dbWrite("DELETE", "groups/" + g.id + "/members/" + uid, null, function() { renderActiveGroup(); renderGroupsList(); });
  } else {
    g.members[uid] = true;
    dbWrite("PUT", "groups/" + g.id + "/members/" + uid, true, function() { renderActiveGroup(); renderGroupsList(); });
  }
}

function sendGroupMessage() {
  if (!state.user || !state.activeGroupId) { showStatus("Log in and select a group.", true); return; }
  var g = state.groups[state.activeGroupId];
  if (!g) return;
  var inp = document.getElementById("groupMsgInput");
  var fEl = document.getElementById("groupImgFile");
  var vEl = document.getElementById("groupVideoUrl");
  var sEl = document.getElementById("groupStickerUrl");

  var text = String(inp ? inp.value : "").replace(/^\s+|\s+$/g, "");
  var videoUrl = safeUrl(vEl ? vEl.value : "");
  var stickerUrl = safeUrl(sEl ? sEl.value : "");
  var hasFile = Boolean(fEl && fEl.files && fEl.files[0]);
  if (!text && !videoUrl && !stickerUrl && !hasFile) return;

  var pushMsg = function(imgUrl) {
    var mid = generateId("gm");
    var msg = {
      id: mid,
      authorUid: state.user.uid,
      authorName: getDisplayUsername(),
      text: text,
      imageUrl: imgUrl || "",
      videoUrl: videoUrl,
      stickerUrl: stickerUrl,
      createdAt: new Date().getTime()
    };
    g.messages = g.messages || {};
    g.messages[mid] = msg;
    dbWrite("PUT", "groups/" + g.id + "/messages/" + mid, msg, function() {
      if (inp) inp.value = "";
      if (fEl) fEl.value = "";
      if (vEl) vEl.value = "";
      clearTargetSticker("group");
      renderActiveGroup();
    });
  };

  if (hasFile) {
    uploadImageToImgbb(fEl, function(err, upUrl) {
      if (err) { showStatus(err, true); return; }
      pushMsg(upUrl);
    });
  } else {
    pushMsg("");
  }
}

function renderActiveGroup() {
  var wrap = document.getElementById("activeGroupView");
  if (!wrap) return;
  var g = state.groups[state.activeGroupId];
  if (!g) { wrap.style.display = "none"; return; }
  wrap.style.display = "block";
  document.getElementById("activeGroupTitle").textContent = "Group: " + g.name;
  var isMem = Boolean(state.user && g.members && g.members[state.user.uid]);
  document.getElementById("groupJoinLeaveBtn").textContent = isMem ? "Leave Group" : "Join Group";

  var feed = document.getElementById("groupMessagesList");
  var msgs = [];
  if (g.messages) {
    for (var mid in g.messages) {
      if (g.messages.hasOwnProperty(mid) && g.messages[mid] && !isUserBlockedByMe(g.messages[mid].authorUid)) {
        msgs.push(g.messages[mid]);
      }
    }
  }
  msgs.sort(function(a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
  var h = "";
  for (var i = 0; i < msgs.length; i++) {
    var m = msgs[i];
    h += "<div class='chat-msg'>" +
           "<b>" + esc(getUserDisplayNameByUid(m.authorUid, m.authorName)) + "</b> <span class='muted'>" + formatTime(m.createdAt) + "</span>: " +
           esc(m.text) +
           (isValidImageSrc(m.imageUrl) ? "<img class='post-media' src='" + esc(m.imageUrl) + "'>" : "") +
           (isValidImageSrc(m.stickerUrl) ? "<img class='post-sticker' src='" + esc(m.stickerUrl) + "'>" : "") +
           (m.videoUrl ? renderVideoHtml(m.videoUrl) : "") +
         "</div>";
  }
  feed.innerHTML = h || "<span class='muted'>No messages yet.</span>";
  feed.scrollTop = feed.scrollHeight;
}

function getDmConvKey(uidA, uidB) {
  return uidA < uidB ? (uidA + "_" + uidB) : (uidB + "_" + uidA);
}

function startDmWithUsername() {
  if (!state.user) { showStatus("Log in to send DMs.", true); return; }
  var target = String(document.getElementById("dmNewTargetInput").value || "").toLowerCase().replace(/[^a-z0-9._-]/g, "");
  if (!target) return;
  for (var uid in state.users) {
    if (state.users.hasOwnProperty(uid) && state.users[uid] && state.users[uid].username === target) {
      openDmConversation(uid);
      return;
    }
  }
  showStatus("User @" + target + " not found.", true);
}

function openDmConversation(peerUid) {
  if (!state.user) { showStatus("Log in to use DMs.", true); return; }
  state.activeDmPeerUid = peerUid;
  switchView("dms");
}

function renderDmList() {
  var box = document.getElementById("dmThreadsList");
  if (!box) return;
  if (!state.user) { box.innerHTML = "<div class='muted' style='padding:6px;'>Log in to view DMs.</div>"; return; }
  var myUid = state.user.uid;
  var peers = {};
  if (state.activeDmPeerUid) peers[state.activeDmPeerUid] = true;
  for (var ck in state.dms) {
    if (state.dms.hasOwnProperty(ck) && ck.indexOf(myUid) !== -1) {
      var parts = ck.split("_");
      var other = parts[0] === myUid ? parts[1] : parts[0];
      if (other) peers[other] = true;
    }
  }
  var h = "";
  for (var pUid in peers) {
    if (peers.hasOwnProperty(pUid)) {
      var act = state.activeDmPeerUid === pUid ? "active-dm" : "";
      h += "<div class='dm-thread-item " + act + "' onclick=\"openDmConversation('" + esc(pUid) + "')\">" + esc(getUserDisplayNameByUid(pUid, pUid)) + "</div>";
    }
  }
  box.innerHTML = h || "<div class='muted' style='padding:6px;'>No active chats.</div>";
  renderActiveDm();
}

function sendDmMessage() {
  if (!state.user || !state.activeDmPeerUid) { showStatus("Select a user first.", true); return; }
  if (amIBlockedByUser(state.activeDmPeerUid)) { showStatus("You cannot message this user.", true); return; }

  var inp = document.getElementById("dmMsgInput");
  var fEl = document.getElementById("dmImgFile");
  var vEl = document.getElementById("dmVideoUrl");
  var sEl = document.getElementById("dmStickerUrl");

  var text = String(inp ? inp.value : "").replace(/^\s+|\s+$/g, "");
  var videoUrl = safeUrl(vEl ? vEl.value : "");
  var stickerUrl = safeUrl(sEl ? sEl.value : "");
  var hasFile = Boolean(fEl && fEl.files && fEl.files[0]);
  if (!text && !videoUrl && !stickerUrl && !hasFile) return;

  var ck = getDmConvKey(state.user.uid, state.activeDmPeerUid);
  var saveMsg = function(imgUrl) {
    var mid = generateId("dm");
    var msg = {
      id: mid,
      fromUid: state.user.uid,
      fromName: getDisplayUsername(),
      text: text,
      imageUrl: imgUrl || "",
      videoUrl: videoUrl,
      stickerUrl: stickerUrl,
      createdAt: new Date().getTime()
    };
    state.dms[ck] = state.dms[ck] || { messages: {} };
    state.dms[ck].messages = state.dms[ck].messages || {};
    state.dms[ck].messages[mid] = msg;

    dbWrite("PUT", "dms/" + ck + "/messages/" + mid, msg, function() {
      if (inp) inp.value = "";
      if (fEl) fEl.value = "";
      if (vEl) vEl.value = "";
      clearTargetSticker("dm");
      pushNotification(state.activeDmPeerUid, "New DM from " + getDisplayUsername(), "dms", state.user.uid);
      renderActiveDm();
    });
  };

  if (hasFile) {
    uploadImageToImgbb(fEl, function(err, upUrl) {
      if (err) { showStatus(err, true); return; }
      saveMsg(upUrl);
    });
  } else {
    saveMsg("");
  }
}

function renderActiveDm() {
  var hdr = document.getElementById("dmActiveHeader");
  var feed = document.getElementById("dmMessagesList");
  if (!hdr || !feed) return;
  if (!state.user || !state.activeDmPeerUid) {
    hdr.textContent = "Select a user to message";
    feed.innerHTML = "";
    return;
  }
  hdr.textContent = "Chat with " + getUserDisplayNameByUid(state.activeDmPeerUid, "User");
  var ck = getDmConvKey(state.user.uid, state.activeDmPeerUid);
  var mMap = (state.dms[ck] && state.dms[ck].messages) || {};
  var list = [];
  for (var mid in mMap) {
    if (mMap.hasOwnProperty(mid) && mMap[mid]) list.push(mMap[mid]);
  }
  list.sort(function(a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
  var h = "";
  for (var i = 0; i < list.length; i++) {
    var m = list[i];
    h += "<div class='chat-msg'>" +
           "<b>" + esc(getUserDisplayNameByUid(m.fromUid, m.fromName)) + "</b> <span class='muted'>" + formatTime(m.createdAt) + "</span>: " +
           esc(m.text) +
           (isValidImageSrc(m.imageUrl) ? "<img class='post-media' src='" + esc(m.imageUrl) + "'>" : "") +
           (isValidImageSrc(m.stickerUrl) ? "<img class='post-sticker' src='" + esc(m.stickerUrl) + "'>" : "") +
           (m.videoUrl ? renderVideoHtml(m.videoUrl) : "") +
         "</div>";
  }
  feed.innerHTML = h || "<span class='muted'>Say hello!</span>";
  feed.scrollTop = feed.scrollHeight;
}

/* Public Stickers Archive + Size/Dimension Limiter */
function resizeStaticStickerIfNeeded(file, cb) {
  var isAnimatedHint = /gif|apng|webp/i.test(file.type || file.name || "");
  if (isAnimatedHint) {
    if (file.size > SERVICE_POLICY.stickerMaxBytes) {
      cb("Animated sticker exceeds max sticker limit (" + Math.round(SERVICE_POLICY.stickerMaxBytes / 1024) + " KB).", null);
      return;
    }
    cb(null, file);
    return;
  }
  var img = new Image();
  var objUrl = URL.createObjectURL(file);
  img.onload = function() {
    URL.revokeObjectURL(objUrl);
    var maxD = SERVICE_POLICY.stickerMaxDim;
    if (img.width <= maxD && img.height <= maxD && file.size <= SERVICE_POLICY.stickerMaxBytes) {
      cb(null, file);
      return;
    }
    var scale = Math.min(maxD / img.width, maxD / img.height, 1);
    var cw = Math.max(16, Math.round(img.width * scale));
    var ch = Math.max(16, Math.round(img.height * scale));
    var canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    var ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, cw, ch);
    if (canvas.toBlob) {
      canvas.toBlob(function(blob) {
        cb(null, blob || file);
      }, "image/png");
    } else {
      cb(null, file);
    }
  };
  img.onerror = function() {
    URL.revokeObjectURL(objUrl);
    if (file.size > SERVICE_POLICY.stickerMaxBytes) {
      cb("Sticker file too large.", null);
    } else {
      cb(null, file);
    }
  };
  img.src = objUrl;
}

function uploadPublicSticker() {
  if (!state.user) { showStatus("Log in to upload stickers.", true); return; }
  var nEl = document.getElementById("stickerNameInput");
  var fEl = document.getElementById("stickerFileInput");
  if (!fEl || !fEl.files || !fEl.files[0]) { showStatus("Choose a sticker image file.", true); return; }
  var file = fEl.files[0];
  var name = String(nEl ? nEl.value : "").replace(/^\s+|\s+$/g, "") || file.name.replace(/\.[^.]+$/, "").substring(0, 24);

  resizeStaticStickerIfNeeded(file, function(err, processedFile) {
    if (err) { showStatus(err, true); return; }
    uploadImageToImgbb(processedFile, function(upErr, url) {
      if (upErr || !url) { showStatus(upErr || "Sticker upload failed.", true); return; }
      var stId = generateId("st");
      var stObj = {
        id: stId,
        name: name,
        url: url,
        uploadedByUid: state.user.uid,
        uploadedByName: getDisplayUsername(),
        createdAt: new Date().getTime()
      };
      state.stickers[stId] = stObj;
      dbWrite("PUT", "stickers/" + stId, stObj, function() {
        if (nEl) nEl.value = "";
        fEl.value = "";
        renderStickersArchive();
        showStatus("Sticker added to public archive!", false);
      });
    });
  });
}

function renderStickersArchive() {
  var grid = document.getElementById("stickersArchiveGrid");
  if (!grid) return;
  var h = "";
  for (var id in state.stickers) {
    if (!state.stickers.hasOwnProperty(id) || !state.stickers[id]) continue;
    var s = state.stickers[id];
    h += "<div class='sticker-card' onclick=\"openZoomModal('" + esc(s.url) + "','" + esc(s.name) + "','Uploaded by " + esc(s.uploadedByName || "User") + "')\">" +
           "<img src='" + esc(s.url) + "' alt='" + esc(s.name) + "'>" +
           "<span>" + esc(s.name) + "</span>" +
         "</div>";
  }
  grid.innerHTML = h || "<p class='muted'>No stickers in the archive yet.</p>";
}

function openStickerPicker(targetKey) {
  state.activeStickerTarget = targetKey;
  var modal = document.getElementById("stickerPickerModal");
  var grid = document.getElementById("stickerPickerGrid");
  if (!modal || !grid) return;
  var h = "";
  for (var id in state.stickers) {
    if (!state.stickers.hasOwnProperty(id) || !state.stickers[id]) continue;
    var s = state.stickers[id];
    h += "<div class='sticker-card' onclick=\"selectStickerForTarget('" + esc(s.url) + "')\">" +
           "<img src='" + esc(s.url) + "' alt='" + esc(s.name) + "'>" +
           "<span>" + esc(s.name) + "</span>" +
         "</div>";
  }
  grid.innerHTML = h || "<p class='muted'>No stickers uploaded yet. Add one in [Stickers]!</p>";
  modal.style.display = "block";
}

function closeStickerPicker() {
  var modal = document.getElementById("stickerPickerModal");
  if (modal) modal.style.display = "none";
}

function selectStickerForTarget(url) {
  var t = state.activeStickerTarget;
  closeStickerPicker();
  if (!t) return;
  var hiddenId = "", prevId = "";
  if (t === "thread") { hiddenId = "threadStickerUrl"; prevId = "threadStickerPreview"; }
  else if (t === "profileWall") { hiddenId = "profileWallSticker"; prevId = "profileWallStickerPreview"; }
  else if (t === "globalWall") { hiddenId = "globalWallSticker"; prevId = "globalWallStickerPreview"; }
  else if (t === "group") { hiddenId = "groupStickerUrl"; prevId = "groupStickerPreview"; }
  else if (t === "dm") { hiddenId = "dmStickerUrl"; prevId = "dmStickerPreview"; }
  else if (t.indexOf("cmt_") === 0) {
    var tid = t.substring(4);
    hiddenId = "cmtSticker_" + tid;
    prevId = "cmtStickerPreview_" + tid;
  }
  var hid = document.getElementById(hiddenId);
  var prv = document.getElementById(prevId);
  if (hid) hid.value = url;
  if (prv) prv.innerHTML = "<img src='" + esc(url) + "'> <button type='button' onclick=\"clearTargetSticker('" + esc(t) + "')\">Remove Sticker</button>";
}

function clearTargetSticker(t) {
  var hiddenId = "", prevId = "";
  if (t === "thread") { hiddenId = "threadStickerUrl"; prevId = "threadStickerPreview"; }
  else if (t === "profileWall") { hiddenId = "profileWallSticker"; prevId = "profileWallStickerPreview"; }
  else if (t === "globalWall") { hiddenId = "globalWallSticker"; prevId = "globalWallStickerPreview"; }
  else if (t === "group") { hiddenId = "groupStickerUrl"; prevId = "groupStickerPreview"; }
  else if (t === "dm") { hiddenId = "dmStickerUrl"; prevId = "dmStickerPreview"; }
  else if (t.indexOf("cmt_") === 0) {
    var tid = t.substring(4);
    hiddenId = "cmtSticker_" + tid;
    prevId = "cmtStickerPreview_" + tid;
  }
  var hid = document.getElementById(hiddenId);
  var prv = document.getElementById(prevId);
  if (hid) hid.value = "";
  if (prv) prv.innerHTML = "";
}

/* ==========================================================================
   MUSIC PLAYER WITH AUTO-COMPRESSION & SEAMLESS [LOCAL] -> CLOUD REPLACEMENT
   ========================================================================== */
function initMusicPlayer() {
  var audio = document.getElementById("audioPlayerEl");
  var widget = document.querySelector(".music-widget");
  var playBtn = document.getElementById("musicPlayBtn");
  if (!audio) return;

  audio.onplay = function() {
    if (widget) widget.className = "side-box music-widget is-playing";
    if (playBtn) playBtn.textContent = "Pause";
  };
  audio.onpause = function() {
    if (widget) widget.className = "side-box music-widget";
    if (playBtn) playBtn.textContent = "Play";
  };
  audio.onended = function() {
    nextMusicTrack();
  };
}

function rebuildMusicPlaylist() {
  var list = [];
  if (musicState.localTempTrack) {
    list.push(musicState.localTempTrack);
  }
  for (var id in state.music) {
    if (state.music.hasOwnProperty(id) && state.music[id]) {
      list.push(state.music[id]);
    }
  }
  // Automatically include audio threads from /music/ board
  for (var tid in state.threads) {
    if (state.threads.hasOwnProperty(tid) && state.threads[tid] && state.threads[tid].board === "music") {
      var t = state.threads[tid];
      var src = t.audioData || (/\.(mp3|ogg|wav|m4a|flac)(\?.*)?$/i.test(t.videoUrl || "") ? t.videoUrl : "");
      if (src) {
        list.push({
          id: "th_" + tid,
          title: t.subject || ("/music/ #" + tid.substring(3, 8)),
          url: src,
          createdAt: t.createdAt || 0
        });
      }
    }
  }
  list.sort(function(a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
  musicState.tracks = list;

  var box = document.getElementById("musicPlaylist");
  if (!box) return;
  var h = "";
  for (var i = 0; i < list.length; i++) {
    var act = (i === musicState.currentIndex) ? "active-track" : "";
    h += "<div class='music-track-item " + act + "' onclick='playMusicIndex(" + i + ")'>" + esc(list[i].title) + "</div>";
  }
  box.innerHTML = h || "<div class='muted' style='padding:4px;'>No tracks yet. Upload one!</div>";
}

function playMusicIndex(idx) {
  if (idx < 0 || idx >= musicState.tracks.length) return;
  var tr = musicState.tracks[idx];
  musicState.currentIndex = idx;
  var audio = document.getElementById("audioPlayerEl");
  var np = document.getElementById("musicNowPlaying");
  if (np) np.textContent = tr.title;
  if (audio) {
    audio.src = tr.url;
    audio.play();
  }
  rebuildMusicPlaylist();
}

function toggleMusicPlay() {
  var audio = document.getElementById("audioPlayerEl");
  if (!audio) return;
  if (!audio.src && musicState.tracks.length) {
    playMusicIndex(0);
    return;
  }
  if (audio.paused) audio.play();
  else audio.pause();
}

function prevMusicTrack() {
  if (!musicState.tracks.length) return;
  var next = musicState.currentIndex <= 0 ? (musicState.tracks.length - 1) : (musicState.currentIndex - 1);
  playMusicIndex(next);
}

function nextMusicTrack() {
  if (!musicState.tracks.length) return;
  var next = (musicState.currentIndex + 1) % musicState.tracks.length;
  playMusicIndex(next);
}

function encodeMonoWavDataUri(samples, sampleRate) {
  var len = samples.length;
  var buf = new ArrayBuffer(44 + len);
  var view = new DataView(buf);
  function writeStr(off, s) {
    for (var i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  }
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + len, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  writeStr(36, "data");
  view.setUint32(40, len, true);
  for (var j = 0; j < len; j++) {
    var clamped = Math.max(-1, Math.min(1, samples[j]));
    view.setUint8(44 + j, Math.round((clamped + 1) * 127.5));
  }
  var bytes = new Uint8Array(buf);
  var bin = "";
  for (var k = 0; k < bytes.length; k++) bin += String.fromCharCode(bytes[k]);
  return "data:audio/wav;base64," + window.btoa(bin);
}

function compressAudioForService(file, cb) {
  var maxRawBytes = Math.floor(SERVICE_POLICY.firebaseAudioMaxBytes * 0.72);
  if (file.size <= maxRawBytes) {
    var r = new FileReader();
    r.onload = function() { cb(null, r.result); };
    r.onerror = function() { cb("Could not read audio file.", null); };
    r.readAsDataURL(file);
    return;
  }
  var AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) {
    cb("Audio file exceeds service size limit on this browser.", null);
    return;
  }
  var reader = new FileReader();
  reader.onload = function() {
    var ctx = new AudioCtx();
    ctx.decodeAudioData(reader.result, function(audioBuf) {
      var duration = audioBuf.duration || 1;
      var targetRate = Math.max(8000, Math.min(22050, Math.floor(maxRawBytes / duration)));
      var outLen = Math.min(maxRawBytes, Math.floor(duration * targetRate));
      var ch0 = audioBuf.getChannelData(0);
      var ratio = ch0.length / Math.max(1, outLen);
      var downsampled = new Float32Array(outLen);
      for (var i = 0; i < outLen; i++) {
        downsampled[i] = ch0[Math.min(ch0.length - 1, Math.floor(i * ratio))];
      }
      var wavUri = encodeMonoWavDataUri(downsampled, targetRate);
      if (ctx.close) ctx.close();
      cb(null, wavUri);
    }, function() {
      if (ctx.close) ctx.close();
      cb("Unsupported audio format for compression.", null);
    });
  };
  reader.readAsArrayBuffer(file);
}

function uploadMusicTrack() {
  var fEl = document.getElementById("musicFileInput");
  var tEl = document.getElementById("musicTitleInput");
  if (!fEl || !fEl.files || !fEl.files[0]) {
    showStatus("Select an audio file first.", true);
    return;
  }
  var file = fEl.files[0];
  var cleanTitle = String(tEl ? tEl.value : "").replace(/^\s+|\s+$/g, "") || file.name.replace(/\.[^.]+$/, "");
  var localUrl = URL.createObjectURL(file);

  // Immediately play local track while compressing & uploading
  musicState.localTempTrack = {
    id: "local_tmp",
    title: "[local] " + cleanTitle,
    url: localUrl,
    createdAt: new Date().getTime() + 10000
  };
  rebuildMusicPlaylist();
  playMusicIndex(0);

  if (!state.user) {
    showStatus("Playing locally (log in to upload audio to cloud).", false);
    return;
  }

  setUploadProgress(20, "Compressing audio for service...");
  compressAudioForService(file, function(err, dataUri) {
    if (err || !dataUri) {
      setUploadProgress(-1);
      showStatus(err || "Compression failed.", true);
      return;
    }
    setUploadProgress(55, "Uploading audio...");
    var trackId = generateId("trk");
    var now = new Date().getTime();
    var trackObj = {
      id: trackId,
      title: cleanTitle,
      url: dataUri,
      uid: state.user.uid,
      authorName: getDisplayUsername(),
      createdAt: now
    };
    dbWrite("PUT", "music/" + trackId, trackObj, function(wErr) {
      if (wErr) {
        setUploadProgress(-1);
        showStatus("Audio upload failed (" + wErr + ").", true);
        return;
      }
      // Remove [local] prefix & seamlessly update active track name without duplicating or restarting
      musicState.localTempTrack = null;
      state.music[trackId] = trackObj;
      var np = document.getElementById("musicNowPlaying");
      if (np) np.textContent = cleanTitle;
      rebuildMusicPlaylist();
      for (var i = 0; i < musicState.tracks.length; i++) {
        if (musicState.tracks[i].id === trackId) {
          musicState.currentIndex = i;
          break;
        }
      }
      rebuildMusicPlaylist();
      if (tEl) tEl.value = "";
      fEl.value = "";
      setUploadProgress(100, "Audio uploaded!");
      showStatus("Track uploaded & synced to radio!", false);
    }, function(p) {
      setUploadProgress(55 + Math.round(p * 40), "Uploading audio...");
    });
  });
}
