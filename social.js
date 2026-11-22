/* ==========================================================================
   FEMBOORU SOCIAL & IMAGEBOARD FEATURES: BOARDS, POLLS, THREADS, REPLIES,
   WALL (STENA), PROFILES, MEMBERS, GROUPS, DMS, STICKERS, MUSIC & NOTIFS
   ========================================================================== */
function canModerateTarget(targetUid) {
  if (!state.user) return false;
  if (isSuperiorAdmin()) return true;
  if (state.user.uid === targetUid) return true;
  if (!isStaffUser()) return false;
  var targetRole = getUserRole(targetUid);
  var targetEmail = (state.users[targetUid] && state.users[targetUid].email) || "";
  if (targetEmail === CONFIG.superiorAdminEmail) return false;
  if (targetRole === "admin" || targetRole === "moderator") return false;
  return true;
}

function renderRoleBadgeHtml(uid) {
  var r = getUserRole(uid);
  if (r === "admin") return "<span class='role-badge'>ADMIN</span>";
  if (r === "moderator") return "<span class='role-badge'>MOD</span>";
  return "";
}

function renderVideoOrAudioEmbed(rawUrl) {
  var u = safeUrl(rawUrl);
  if (!u) return "";
  var ytMatch = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{6,})/);
  if (ytMatch && ytMatch[1]) {
    return "<iframe class='video-embed' height='235' src='https://www.youtube.com/embed/" + esc(ytMatch[1]) +
      "' frameborder='0' allowfullscreen></iframe>";
  }
  if (/\.(mp3|ogg|wav|flac|m4a)(\?|$)/i.test(u) || /^data:audio\//i.test(u)) {
    return "<audio controls preload='none' src='" + esc(u) + "' style='display:block;margin:6px 0;max-width:100%;'></audio>";
  }
  return "<video class='video-embed' controls preload='metadata' src='" + esc(u) + "'></video>";
}

/* ==========================================================================
   ADMIN SITE LOGO
   ========================================================================== */
function adminUpdateSiteLogo() {
  if (!isSuperiorAdmin()) return;
  var fEl = document.getElementById("adminLogoFile");
  var uEl = document.getElementById("adminLogoUrl");
  var direct = uEl ? safeUrl(uEl.value) : "";

  function saveLogo(logoUrl) {
    state.siteLogo = logoUrl;
    dbWrite("PUT", "site/logo", logoUrl, function(err) {
      if (!err) {
        renderAll();
        showStatus("Site logo updated!", false);
      } else {
        showStatus("Logo update failed: " + err, true);
      }
    });
  }

  if (fEl && fEl.files && fEl.files[0]) {
    uploadImageToImgbb(fEl, function(err, url) {
      if (!err && url) {
        fEl.value = "";
        saveLogo(url);
      } else {
        showStatus(err || "Upload failed", true);
      }
    }, { isSticker: false });
  } else if (direct) {
    if (uEl) uEl.value = "";
    saveLogo(direct);
  } else {
    showStatus("Select an image or enter a logo URL.", true);
  }
}

function adminResetLogos() {
  if (!isSuperiorAdmin()) return;
  state.siteLogo = "";
  dbWrite("DELETE", "site/logo", null, function() {
    renderAll();
    showStatus("Site logo reset to default.", false);
  });
}

/* ==========================================================================
   BOARDS & COMMUNITY BOARD POLLS
   ========================================================================== */
function renderBoardsSidebar() {
  var box = document.getElementById("boardsList");
  if (!box) return;
  var h = "";
  var activeObj = null;
  for (var i = 0; i < state.boards.length; i++) {
    var b = state.boards[i];
    var isAct = (b.slug === state.currentBoard && state.view === "boards");
    if (b.slug === state.currentBoard) activeObj = b;
    h += "<a href='#' class='" + (isAct ? "active-board" : "") + "' onclick=\"selectBoard('" + esc(b.slug) + "');return false;\">" +
           esc(b.title || ("/" + b.slug + "/")) +
         "</a>";
  }
  box.innerHTML = h;

  if (activeObj) {
    var tEl = document.getElementById("currentBoardTitle");
    var dEl = document.getElementById("currentBoardDesc");
    if (tEl) tEl.textContent = activeObj.title || ("/" + activeObj.slug + "/");
    if (dEl) dEl.textContent = activeObj.desc || "";
  }
}

function selectBoard(slug) {
  state.currentBoard = slug || "b";
  switchView("boards");
}

function proposeOrCreateBoard() {
  if (!state.user) {
    showStatus("Login to propose or create a board.", true);
    return;
  }
  var slugEl = document.getElementById("newBoardSlug");
  var titleEl = document.getElementById("newBoardTitle");
  var descEl = document.getElementById("newBoardDesc");
  var slug = String(slugEl ? slugEl.value : "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  var title = String(titleEl ? titleEl.value : "").trim();
  var desc = String(descEl ? descEl.value : "").trim();

  if (!slug || !title) {
    showStatus("Enter board slug and title.", true);
    return;
  }
  var formattedTitle = title.indexOf("/") === 0 ? title : ("/" + slug + "/ — " + title);

  if (isSuperiorAdmin() || getUserRole(state.user.uid) === "admin") {
    var bObj = { slug: slug, title: formattedTitle, desc: desc || "Community board." };
    dbWrite("PUT", "boards/" + slug, bObj, function(err) {
      if (!err) {
        if (slugEl) slugEl.value = "";
        if (titleEl) titleEl.value = "";
        if (descEl) descEl.value = "";
        fetchAllData();
        showStatus("Board " + formattedTitle + " created!", false);
      } else {
        showStatus("Board creation error: " + err, true);
      }
    });
  } else {
    var pollObj = {
      slug: slug,
      title: formattedTitle,
      desc: desc || "Proposed community board.",
      createdBy: state.user.uid,
      authorName: getDisplayUsername(),
      status: "open",
      votes: {}
    };
    pollObj.votes[state.user.uid] = "yes";
    dbWrite("PUT", "polls/" + slug, pollObj, function(err) {
      if (!err) {
        if (slugEl) slugEl.value = "";
        if (titleEl) titleEl.value = "";
        if (descEl) descEl.value = "";
        fetchAllData();
        showStatus("Board proposal poll created! Needs 3 YES votes to open.", false);
      } else {
        showStatus("Poll error: " + err, true);
      }
    });
  }
}

function renderBoardPolls() {
  var box = document.getElementById("boardPollsBox");
  if (!box) return;
  var h = "";
  for (var slug in state.polls) {
    if (!state.polls.hasOwnProperty(slug) || !state.polls[slug]) continue;
    var p = state.polls[slug];
    if (p.status !== "open") continue;
    var yesCount = 0;
    var noCount = 0;
    var votes = p.votes || {};
    for (var vUid in votes) {
      if (votes.hasOwnProperty(vUid)) {
        if (votes[vUid] === "yes") yesCount++;
        else if (votes[vUid] === "no") noCount++;
      }
    }
    h += "<div class='poll-card'>" +
           "<b>Board Proposal: " + esc(p.title) + "</b> — " + esc(p.desc || "") +
           " <span class='muted'>(by " + esc(p.authorName || "User") + ")</span><br>" +
           "Votes: <b>" + yesCount + " YES</b> / <b>" + noCount + " NO</b> (3 YES opens board) " +
           "<button type='button' onclick=\"voteBoardPoll('" + esc(slug) + "','yes')\">Vote YES</button> " +
           "<button type='button' onclick=\"voteBoardPoll('" + esc(slug) + "','no')\">Vote NO</button>" +
         "</div>";
  }
  box.innerHTML = h;
}

function voteBoardPoll(slug, choice) {
  if (!state.user) {
    showStatus("Login to vote in board polls.", true);
    return;
  }
  var p = state.polls[slug];
  if (!p) return;
  dbWrite("PUT", "polls/" + slug + "/votes/" + state.user.uid, choice, function(err) {
    if (err) {
      showStatus("Vote error: " + err, true);
      return;
    }
    var votes = p.votes || {};
    votes[state.user.uid] = choice;
    var yesCount = 0;
    for (var k in votes) {
      if (votes.hasOwnProperty(k) && votes[k] === "yes") yesCount++;
    }
    if (yesCount >= 3) {
      var bObj = { slug: slug, title: p.title, desc: p.desc || "" };
      dbWrite("PUT", "boards/" + slug, bObj, function() {
        dbWrite("PUT", "polls/" + slug + "/status", "approved", function() {
          fetchAllData();
          showStatus("Poll passed! Board " + p.title + " is now live!", false);
        });
      });
    } else {
      fetchAllData();
      showStatus("Vote recorded!", false);
    }
  });
}

/* ==========================================================================
   THREADS & REPLIES
   ========================================================================== */
function createThread() {
  if (!state.user) {
    showStatus("Login to post a thread.", true);
    return;
  }
  var subjEl = document.getElementById("threadSubjectInput");
  var textEl = document.getElementById("threadTextInput");
  var vidEl = document.getElementById("threadVideoUrlInput");
  var imgEl = document.getElementById("threadImageInput");
  var stEl = document.getElementById("threadStickerUrl");

  var subject = subjEl ? subjEl.value.trim() : "";
  var text = textEl ? textEl.value.trim() : "";
  var videoUrl = vidEl ? safeUrl(vidEl.value) : "";
  var stickerUrl = stEl ? safeUrl(stEl.value) : "";

  function finishThread(imgUrl) {
    if (!subject && !text && !imgUrl && !videoUrl && !stickerUrl) {
      showStatus("Write a comment or attach media/sticker.", true);
      return;
    }
    var tid = generateId("thr");
    var now = new Date().getTime();
    var threadObj = {
      id: tid,
      board: state.currentBoard || "b",
      uid: state.user.uid,
      authorName: getDisplayUsername(),
      subject: subject,
      text: text,
      imageUrl: imgUrl || "",
      videoUrl: videoUrl,
      stickerUrl: stickerUrl,
      createdAt: now,
      bumpedAt: now,
      likes: {},
      comments: {}
    };
    dbWrite("PUT", "threads/" + tid, threadObj, function(err) {
      if (!err) {
        if (subjEl) subjEl.value = "";
        if (textEl) textEl.value = "";
        if (vidEl) vidEl.value = "";
        if (imgEl) imgEl.value = "";
        clearSelectedSticker("thread");
        fetchAllData();
        showStatus("Thread posted!", false);
      } else {
        showStatus("Thread post failed: " + err, true);
      }
    });
  }

  if (imgEl && imgEl.files && imgEl.files[0]) {
    uploadImageToImgbb(imgEl, function(err, url) {
      if (!err && url) finishThread(url);
      else showStatus(err || "Image upload failed", true);
    }, { isSticker: false });
  } else {
    finishThread("");
  }
}

function renderThreads() {
  var box = document.getElementById("threadsContainer");
  if (!box) return;
  var list = [];
  for (var tid in state.threads) {
    if (!state.threads.hasOwnProperty(tid) || !state.threads[tid]) continue;
    var t = state.threads[tid];
    if ((t.board || "b") === state.currentBoard) list.push(t);
  }
  list.sort(function(a, b) { return (b.bumpedAt || b.createdAt || 0) - (a.bumpedAt || a.createdAt || 0); });

  if (!list.length) {
    box.innerHTML = "<div class='box-panel'><div class='box-body muted'>No threads on this board yet. Be the first to post!</div></div>";
    return;
  }

  var h = "";
  for (var i = 0; i < list.length; i++) {
    var th = list[i];
    var likeCount = countMapKeys(th.likes);
    var likedByMe = state.user && th.likes && th.likes[state.user.uid];
    var repostPayload = encodeURIComponent(JSON.stringify({
      authorName: th.authorName || "Anon",
      subject: th.subject || "",
      text: th.text || "",
      imageUrl: th.imageUrl || "",
      videoUrl: th.videoUrl || "",
      stickerUrl: th.stickerUrl || ""
    }));

    h += "<article class='thread-item'>" +
           "<div class='post-header'>" +
             "<div>" +
               (th.subject ? "<span class='post-subject'>" + esc(th.subject) + "</span> &bull; " : "") +
               "<span class='post-author' onclick=\"openUserProfile('" + esc(th.uid) + "')\">" + esc(th.authorName || "Anon") + "</span>" +
               renderRoleBadgeHtml(th.uid) +
               " <span class='muted'>" + formatTime(th.createdAt) + " &bull; No." + esc(th.id.slice(-6)) + "</span>" +
             "</div>" +
             "<div class='btn-row'>" +
               "<button type='button' class='" + (likedByMe ? "btn-active" : "") + "' onclick=\"toggleThreadLike('" + esc(th.id) + "')\">Like (" + likeCount + ")</button>" +
               "<button type='button' onclick=\"repostToWall('" + repostPayload + "')\">Repost</button>" +
               (canModerateTarget(th.uid) ? "<button type='button' class='btn-danger' onclick=\"deleteThread('" + esc(th.id) + "')\">Delete</button>" : "") +
             "</div>" +
           "</div>";

    if (isValidImageSrc(th.imageUrl)) {
      h += "<img class='post-media' src='" + esc(th.imageUrl) + "' alt='Attachment' onclick=\"openZoomModal(this.src,'" + esc(th.subject || "Thread Image") + "','" + esc(th.authorName || "") + "')\">";
    }
    if (isValidImageSrc(th.stickerUrl)) {
      h += "<img class='post-sticker' src='" + esc(th.stickerUrl) + "' alt='Sticker'>";
    }
    if (th.videoUrl) {
      h += renderVideoOrAudioEmbed(th.videoUrl);
    }
    if (th.text) {
      h += "<div class='post-body'>" + esc(th.text) + "</div>";
    }

    // Comments
    var cList = [];
    if (th.comments && typeof th.comments === "object") {
      for (var cid in th.comments) {
        if (th.comments.hasOwnProperty(cid) && th.comments[cid]) cList.push(th.comments[cid]);
      }
    }
    cList.sort(function(a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });

    h += "<div class='comments-box'>";
    for (var c = 0; c < cList.length; c++) {
      var cm = cList[c];
      var cLikes = countMapKeys(cm.likes);
      var cLiked = state.user && cm.likes && cm.likes[state.user.uid];
      h += "<div class='comment-item'>" +
             "<div class='post-header'>" +
               "<div><span class='post-author' onclick=\"openUserProfile('" + esc(cm.uid) + "')\">" + esc(cm.authorName || "Anon") + "</span>" +
               renderRoleBadgeHtml(cm.uid) + " <span class='muted'>" + formatTime(cm.createdAt) + "</span></div>" +
               "<div>" +
                 "<button type='button' class='" + (cLiked ? "btn-active" : "") + "' onclick=\"toggleCommentLike('" + esc(th.id) + "','" + esc(cm.id) + "')\">Like (" + cLikes + ")</button> " +
                 (canModerateTarget(cm.uid) ? "<button type='button' class='btn-danger' onclick=\"deleteThreadComment('" + esc(th.id) + "','" + esc(cm.id) + "')\">X</button>" : "") +
               "</div>" +
             "</div>" +
             (isValidImageSrc(cm.imageUrl) ? "<img class='post-media' src='" + esc(cm.imageUrl) + "' alt='Reply' onclick=\"openZoomModal(this.src,'Reply Image','')\">" : "") +
             (cm.text ? "<div class='post-body'>" + esc(cm.text) + "</div>" : "") +
           "</div>";
    }

    h += "<div class='form-row'>" +
           "<input type='text' id='replyText_" + esc(th.id) + "' placeholder='Reply to thread...'>" +
           "<input type='file' id='replyFile_" + esc(th.id) + "' accept='image/*,.gif,.apng,.webp,.avif,.svg'>" +
           "<button type='button' onclick=\"addThreadComment('" + esc(th.id) + "')\">Reply</button>" +
         "</div>" +
       "</div></article>";
  }
  box.innerHTML = h;
}

function toggleThreadLike(tid) {
  if (!state.user) { showStatus("Login to like threads.", true); return; }
  var th = state.threads[tid];
  if (!th) return;
  var liked = th.likes && th.likes[state.user.uid];
  var method = liked ? "DELETE" : "PUT";
  dbWrite(method, "threads/" + tid + "/likes/" + state.user.uid, liked ? null : true, function() {
    if (!liked && th.uid && th.uid !== state.user.uid) {
      pushNotification(th.uid, getDisplayUsername() + " liked your thread.", "boards", tid);
    }
    fetchAllData();
  });
}

function addThreadComment(tid) {
  if (!state.user) { showStatus("Login to reply.", true); return; }
  var th = state.threads[tid];
  if (!th) return;
  var txtEl = document.getElementById("replyText_" + tid);
  var fileEl = document.getElementById("replyFile_" + tid);
  var text = txtEl ? txtEl.value.trim() : "";

  function saveReply(imgUrl) {
    if (!text && !imgUrl) {
      showStatus("Enter reply text or attach an image.", true);
      return;
    }
    var cid = generateId("cmt");
    var now = new Date().getTime();
    var cObj = {
      id: cid,
      uid: state.user.uid,
      authorName: getDisplayUsername(),
      text: text,
      imageUrl: imgUrl || "",
      createdAt: now,
      likes: {}
    };
    dbWrite("PUT", "threads/" + tid + "/comments/" + cid, cObj, function(err) {
      if (!err) {
        if (txtEl) txtEl.value = "";
        if (fileEl) fileEl.value = "";
        dbWrite("PUT", "threads/" + tid + "/bumpedAt", now, null);
        if (th.uid && th.uid !== state.user.uid) {
          pushNotification(th.uid, getDisplayUsername() + " replied to your thread.", "boards", tid);
        }
        fetchAllData();
      } else {
        showStatus("Reply failed: " + err, true);
      }
    });
  }

  if (fileEl && fileEl.files && fileEl.files[0]) {
    uploadImageToImgbb(fileEl, function(err, url) {
      if (!err && url) saveReply(url);
      else showStatus(err || "Image upload failed", true);
    }, { isSticker: false });
  } else {
    saveReply("");
  }
}

function toggleCommentLike(tid, cid) {
  if (!state.user) { showStatus("Login to like replies.", true); return; }
  var th = state.threads[tid];
  var cm = th && th.comments && th.comments[cid];
  if (!cm) return;
  var liked = cm.likes && cm.likes[state.user.uid];
  dbWrite(liked ? "DELETE" : "PUT", "threads/" + tid + "/comments/" + cid + "/likes/" + state.user.uid, liked ? null : true, function() {
    fetchAllData();
  });
}

function deleteThread(tid) {
  if (!confirm("Delete this thread?")) return;
  dbWrite("DELETE", "threads/" + tid, null, function(err) {
    if (!err) {
      delete state.threads[tid];
      renderAll();
      showStatus("Thread deleted.", false);
    } else {
      showStatus("Delete error: " + err, true);
    }
  });
}

function deleteThreadComment(tid, cid) {
  dbWrite("DELETE", "threads/" + tid + "/comments/" + cid, null, function(err) {
    if (!err) {
      if (state.threads[tid] && state.threads[tid].comments) delete state.threads[tid].comments[cid];
      renderAll();
    }
  });
}

/* ==========================================================================
   WALL (STENA) & REPOSTS
   ========================================================================== */
function setWallFeedFilter(mode) {
  state.wallFilter = mode || "all";
  var allB = document.getElementById("wallFilterAllBtn");
  var subB = document.getElementById("wallFilterSubBtn");
  if (allB) allB.className = state.wallFilter === "all" ? "btn-active" : "";
  if (subB) subB.className = state.wallFilter === "subs" ? "btn-active" : "";
  renderGlobalWall();
}

function createWallPostRecord(targetUid, text, fileInput, videoInput, stickerInput, cb) {
  if (!state.user) {
    showStatus("Login to post on a wall.", true);
    return;
  }
  var videoUrl = videoInput ? safeUrl(videoInput.value) : "";
  var stickerUrl = stickerInput ? safeUrl(stickerInput.value) : "";

  function commit(imgUrl) {
    if (!text && !imgUrl && !videoUrl && !stickerUrl) {
      showStatus("Write text or attach media/sticker.", true);
      return;
    }
    var pid = generateId("wp");
    var now = new Date().getTime();
    var postObj = {
      id: pid,
      targetUid: targetUid,
      authorUid: state.user.uid,
      authorName: getDisplayUsername(),
      text: text,
      imageUrl: imgUrl || "",
      videoUrl: videoUrl,
      stickerUrl: stickerUrl,
      createdAt: now,
      likes: {}
    };
    dbWrite("PUT", "walls/" + targetUid + "/posts/" + pid, postObj, function(err) {
      if (!err) {
        if (targetUid !== state.user.uid) {
          pushNotification(targetUid, getDisplayUsername() + " wrote on your wall.", "profile", targetUid);
        }
        if (cb) cb();
      } else {
        showStatus("Wall post failed: " + err, true);
      }
    });
  }

  if (fileInput && fileInput.files && fileInput.files[0]) {
    uploadImageToImgbb(fileInput, function(err, url) {
      if (!err && url) commit(url);
      else showStatus(err || "Image upload failed", true);
    }, { isSticker: false });
  } else {
    commit("");
  }
}

function postToGlobalWall() {
  if (!state.user) { showStatus("Login to post on your wall.", true); return; }
  var txtEl = document.getElementById("globalWallText");
  var fileEl = document.getElementById("globalWallFile");
  var vidEl = document.getElementById("globalWallVideo");
  var stEl = document.getElementById("globalWallSticker");
  createWallPostRecord(state.user.uid, txtEl ? txtEl.value.trim() : "", fileEl, vidEl, stEl, function() {
    if (txtEl) txtEl.value = "";
    if (fileEl) fileEl.value = "";
    if (vidEl) vidEl.value = "";
    clearSelectedSticker("globalWall");
    fetchAllData();
    showStatus("Posted to wall!", false);
  });
}

function repostToWall(encodedPayload) {
  if (!state.user) { showStatus("Login to repost onto your wall.", true); return; }
  var orig = null;
  try { orig = JSON.parse(decodeURIComponent(encodedPayload)); } catch (e) {}
  if (!orig) return;

  var pid = generateId("wp");
  var postObj = {
    id: pid,
    targetUid: state.user.uid,
    authorUid: state.user.uid,
    authorName: getDisplayUsername(),
    text: "",
    repostOf: orig,
    createdAt: new Date().getTime(),
    likes: {}
  };
  dbWrite("PUT", "walls/" + state.user.uid + "/posts/" + pid, postObj, function(err) {
    if (!err) {
      fetchAllData();
      showStatus("Reposted to your wall!", false);
    } else {
      showStatus("Repost failed: " + err, true);
    }
  });
}

function renderWallPostCard(p) {
  var likes = countMapKeys(p.likes);
  var liked = state.user && p.likes && p.likes[state.user.uid];
  var canDel = canModerateTarget(p.authorUid) || (state.user && state.user.uid === p.targetUid);
  var targetUser = state.users[p.targetUid];
  var targetLabel = (p.targetUid && p.targetUid !== p.authorUid && targetUser)
    ? (" &rarr; <span class='post-author' onclick=\"openUserProfile('" + esc(p.targetUid) + "')\">" + esc(targetUser.displayName || targetUser.username) + "</span>")
    : "";

  var repostHtml = "";
  if (p.repostOf) {
    var ro = p.repostOf;
    repostHtml = "<div class='repost-embed'>" +
      "<div class='mini-title'>Reposted from " + esc(ro.authorName || "User") + (ro.subject ? (" — " + esc(ro.subject)) : "") + "</div>" +
      (isValidImageSrc(ro.imageUrl) ? "<img class='post-media' src='" + esc(ro.imageUrl) + "' alt='' onclick=\"openZoomModal(this.src,'Repost','')\">" : "") +
      (isValidImageSrc(ro.stickerUrl) ? "<img class='post-sticker' src='" + esc(ro.stickerUrl) + "' alt=''>" : "") +
      (ro.videoUrl ? renderVideoOrAudioEmbed(ro.videoUrl) : "") +
      (ro.text ? "<div class='post-body'>" + esc(ro.text) + "</div>" : "") +
    "</div>";
  }

  return "<div class='wall-post-card'>" +
    "<div class='post-header'>" +
      "<div><span class='post-author' onclick=\"openUserProfile('" + esc(p.authorUid) + "')\">" + esc(p.authorName || "Anon") + "</span>" +
      renderRoleBadgeHtml(p.authorUid) + targetLabel +
      " <span class='muted'>" + formatTime(p.createdAt) + "</span></div>" +
      "<div class='btn-row'>" +
        "<button type='button' class='" + (liked ? "btn-active" : "") + "' onclick=\"toggleWallPostLike('" + esc(p.targetUid) + "','" + esc(p.id) + "')\">Like (" + likes + ")</button>" +
        (canDel ? "<button type='button' class='btn-danger' onclick=\"deleteWallPost('" + esc(p.targetUid) + "','" + esc(p.id) + "')\">Delete</button>" : "") +
      "</div>" +
    "</div>" +
    (isValidImageSrc(p.imageUrl) ? "<img class='post-media' src='" + esc(p.imageUrl) + "' alt='Wall Image' onclick=\"openZoomModal(this.src,'Wall Image','')\">" : "") +
    (isValidImageSrc(p.stickerUrl) ? "<img class='post-sticker' src='" + esc(p.stickerUrl) + "' alt='Sticker'>" : "") +
    (p.videoUrl ? renderVideoOrAudioEmbed(p.videoUrl) : "") +
    (p.text ? "<div class='post-body'>" + esc(p.text) + "</div>" : "") +
    repostHtml +
  "</div>";
}

function renderGlobalWall() {
  var box = document.getElementById("wallPostsContainer");
  if (!box) return;
  var mySubs = (state.user && state.subscriptions[state.user.uid]) || {};
  var list = [];

  for (var tUid in state.walls) {
    if (!state.walls.hasOwnProperty(tUid) || !state.walls[tUid] || !state.walls[tUid].posts) continue;
    var posts = state.walls[tUid].posts;
    for (var pid in posts) {
      if (!posts.hasOwnProperty(pid) || !posts[pid]) continue;
      var p = posts[pid];
      if (state.wallFilter === "subs" && state.user) {
        if (p.authorUid !== state.user.uid && !mySubs[p.authorUid]) continue;
      }
      list.push(p);
    }
  }
  list.sort(function(a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });

  if (!list.length) {
    box.innerHTML = "<div class='box-panel'><div class='box-body muted'>No wall posts to show yet.</div></div>";
    return;
  }
  var h = "";
  for (var i = 0; i < list.length; i++) h += renderWallPostCard(list[i]);
  box.innerHTML = h;
}

function toggleWallPostLike(targetUid, pid) {
  if (!state.user) { showStatus("Login to like wall posts.", true); return; }
  var post = state.walls[targetUid] && state.walls[targetUid].posts && state.walls[targetUid].posts[pid];
  if (!post) return;
  var liked = post.likes && post.likes[state.user.uid];
  dbWrite(liked ? "DELETE" : "PUT", "walls/" + targetUid + "/posts/" + pid + "/likes/" + state.user.uid, liked ? null : true, function() {
    fetchAllData();
  });
}

function deleteWallPost(targetUid, pid) {
  dbWrite("DELETE", "walls/" + targetUid + "/posts/" + pid, null, function(err) {
    if (!err) {
      if (state.walls[targetUid] && state.walls[targetUid].posts) delete state.walls[targetUid].posts[pid];
      renderAll();
      showStatus("Wall post deleted.", false);
    }
  });
}

/* ==========================================================================
   PROFILES, CUSTOM FIELDS, FAVORITES, SUBSCRIPTIONS & BLOCKS
   ========================================================================== */
function openMyProfile() {
  if (!state.user) {
    showStatus("Login to view and edit your profile.", true);
    return;
  }
  state.viewedProfileUid = state.user.uid;
  switchView("profile");
}

function openUserProfile(uid) {
  if (!uid) return;
  state.viewedProfileUid = uid;
  switchView("profile");
}

function renderPublicProfile() {
  var uid = state.viewedProfileUid || (state.user && state.user.uid);
  if (!uid) {
    for (var k in state.users) {
      if (state.users.hasOwnProperty(k)) { uid = k; break; }
    }
  }
  if (!uid) return;
  state.viewedProfileUid = uid;

  var u = state.users[uid] || { uid: uid, username: "User", displayName: "User", avatar: DEFAULT_AVATAR_SVG };
  var isMe = Boolean(state.user && state.user.uid === uid);

  var titleEl = document.getElementById("profHeaderTitle");
  if (titleEl) titleEl.textContent = (u.displayName || u.username || "User") + " — Profile";

  var subCount = 0;
  for (var sUid in state.subscriptions) {
    if (state.subscriptions.hasOwnProperty(sUid) && state.subscriptions[sUid] && state.subscriptions[sUid][uid]) subCount++;
  }
  var statsEl = document.getElementById("profSubStats");
  if (statsEl) statsEl.textContent = "Subscribers: " + subCount;

  var statusEl = document.getElementById("profStatusBanner");
  if (statusEl) {
    statusEl.style.display = u.status ? "block" : "none";
    statusEl.textContent = u.status || "";
  }

  var avEl = document.getElementById("profViewAvatar");
  if (avEl) avEl.src = isValidImageSrc(u.avatar) ? u.avatar : DEFAULT_AVATAR_SVG;

  var nameEl = document.getElementById("profViewDisplayName");
  if (nameEl) nameEl.innerHTML = esc(u.displayName || u.username || "User") + renderRoleBadgeHtml(uid);

  function setTxt(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val || "—";
  }
  setTxt("profViewPronouns", u.pronouns);
  setTxt("profViewRelationship", u.relationship);
  setTxt("profViewRegDate", u.regDate);
  setTxt("profViewHometown", u.hometown);
  setTxt("profViewPolitics", u.politics);
  setTxt("profViewBirthDate", u.birthDate);
  setTxt("profViewCity", u.city);
  setTxt("profViewInterests", u.interests);
  setTxt("profViewAbout", u.about);

  var webEl = document.getElementById("profViewWebsite");
  if (webEl) {
    var safeW = safeUrl(u.website);
    webEl.innerHTML = safeW ? ("<a href='" + esc(safeW) + "' target='_blank' rel='noopener'>" + esc(safeW) + "</a>") : esc(u.website || "—");
  }

  // Custom fields
  var cfBox = document.getElementById("profViewCustomFields");
  if (cfBox) {
    var cfHtml = "";
    if (u.customFields && u.customFields.length) {
      cfHtml += "<table class='info-table'>";
      for (var c = 0; c < u.customFields.length; c++) {
        var cf = u.customFields[c];
        if (cf && (cf.label || cf.value)) {
          cfHtml += "<tr><th>" + esc(cf.label || "Option") + ":</th><td>" + esc(cf.value || "") + "</td></tr>";
        }
      }
      cfHtml += "</table>";
    }
    cfBox.innerHTML = cfHtml;
  }

  // Favorite Cards
  var favBox = document.getElementById("profFavoritesCards");
  if (favBox) {
    var favs = [
      { type: "Favorite Film", title: u.favFilmTitle, img: u.favFilmImg },
      { type: "Favorite TV-Show", title: u.favShowTitle, img: u.favShowImg },
      { type: "Favorite Book", title: u.favBookTitle, img: u.favBookImg },
      { type: "Favorite Game", title: u.favGameTitle, img: u.favGameImg }
    ];
    var fHtml = "";
    for (var f = 0; f < favs.length; f++) {
      if (!favs[f].title && !isValidImageSrc(favs[f].img)) continue;
      var cover = isValidImageSrc(favs[f].img) ? favs[f].img : DEFAULT_SITE_LOGO;
      fHtml += "<div class='fav-card' onclick=\"openZoomModal('" + esc(cover) + "','" + esc(favs[f].type) + "','" + esc(favs[f].title || "") + "')\">" +
                 "<img src='" + esc(cover) + "' alt=''>" +
                 "<div class='fav-card-type'>" + esc(favs[f].type) + "</div>" +
                 "<div class='fav-card-title'>" + esc(favs[f].title || "Untitled") + "</div>" +
               "</div>";
    }
    favBox.innerHTML = fHtml || "<span class='muted'>No favorites added yet.</span>";
  }

  // Action Buttons
  var actBox = document.getElementById("profActionButtons");
  if (actBox) {
    if (!isMe && state.user) {
      var isSub = Boolean(state.subscriptions[state.user.uid] && state.subscriptions[state.user.uid][uid]);
      var isBlk = Boolean(state.blocks[state.user.uid] && state.blocks[state.user.uid][uid]);
      actBox.innerHTML =
        "<button type='button' class='" + (isSub ? "btn-active" : "btn-primary") + "' onclick=\"toggleSubscribeUser('" + esc(uid) + "')\">" + (isSub ? "Unsubscribe" : "Subscribe") + "</button>" +
        "<button type='button' onclick=\"openDmWithUser('" + esc(uid) + "')\">Send Message</button>" +
        "<button type='button' class='btn-danger' onclick=\"toggleBlockUser('" + esc(uid) + "')\">" + (isBlk ? "Unblock User" : "Block Wall") + "</button>";
    } else {
      actBox.innerHTML = "";
    }
  }

  var roleBar = document.getElementById("superiorAdminRoleBar");
  if (roleBar) roleBar.style.display = (isSuperiorAdmin() && !isMe) ? "block" : "none";

  // Profile Editor (only for own profile)
  var edBox = document.getElementById("myProfileEditor");
  if (edBox) {
    edBox.style.display = isMe ? "block" : "none";
    if (isMe) {
      function setVal(id, v) { var el = document.getElementById(id); if (el) el.value = v || ""; }
      setVal("editProfStatus", u.status);
      setVal("editProfDisplayName", u.displayName || u.username);
      setVal("editProfAvatarUrl", u.avatar);
      setVal("editProfPronouns", u.pronouns);
      setVal("editProfRelationship", u.relationship);
      setVal("editProfHometown", u.hometown);
      setVal("editProfPolitics", u.politics);
      setVal("editProfBirthDate", u.birthDate);
      setVal("editProfWebsite", u.website);
      setVal("editProfCity", u.city);
      setVal("editProfInterests", u.interests);
      setVal("editProfAbout", u.about);
      setVal("editFavFilmTitle", u.favFilmTitle);
      setVal("editFavFilmImg", u.favFilmImg);
      setVal("editFavShowTitle", u.favShowTitle);
      setVal("editFavShowImg", u.favShowImg);
      setVal("editFavBookTitle", u.favBookTitle);
      setVal("editFavBookImg", u.favBookImg);
      setVal("editFavGameTitle", u.favGameTitle);
      setVal("editFavGameImg", u.favGameImg);

      var cfEd = document.getElementById("customFieldsEditor");
      if (cfEd) {
        cfEd.innerHTML = "";
        var listCf = u.customFields || [];
        for (var idx = 0; idx < listCf.length; idx++) {
          addCustomProfileFieldRow(listCf[idx].label, listCf[idx].value);
        }
      }
    }
  }

  // Profile Wall
  var wPostsBox = document.getElementById("profileWallPosts");
  if (wPostsBox) {
    var wMap = (state.walls[uid] && state.walls[uid].posts) || {};
    var wList = [];
    for (var wpId in wMap) {
      if (wMap.hasOwnProperty(wpId) && wMap[wpId]) wList.push(wMap[wpId]);
    }
    wList.sort(function(a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
    var wh = "";
    for (var wi = 0; wi < wList.length; wi++) wh += renderWallPostCard(wList[wi]);
    wPostsBox.innerHTML = wh || "<div class='muted' style='margin-top:6px;'>No posts on this wall yet.</div>";
  }
}

function addCustomProfileFieldRow(labelVal, valueVal) {
  var box = document.getElementById("customFieldsEditor");
  if (!box) return;
  var row = document.createElement("div");
  row.className = "form-row custom-field-row";
  row.innerHTML =
    "<input type='text' class='cf-label' placeholder='Option name' value='" + esc(labelVal || "") + "'>" +
    "<input type='text' class='cf-value' placeholder='Value' value='" + esc(valueVal || "") + "'>" +
    "<button type='button' class='btn-danger' onclick='this.parentNode.parentNode.removeChild(this.parentNode)'>Remove</button>";
  box.appendChild(row);
}

function saveMyProfile() {
  if (!state.user) return;
  var uid = state.user.uid;
  var fEl = document.getElementById("editProfAvatarFile");

  function commitProfile(avatarUrl) {
    function getV(id) { var el = document.getElementById(id); return el ? el.value.trim() : ""; }
    var customFields = [];
    var rows = document.querySelectorAll("#customFieldsEditor .custom-field-row");
    for (var i = 0; i < rows.length; i++) {
      var l = rows[i].querySelector(".cf-label").value.trim();
      var v = rows[i].querySelector(".cf-value").value.trim();
      if (l || v) customFields.push({ label: l, value: v });
    }

    var base = state.profile || state.users[uid] || {};
    var updated = {
      uid: uid,
      email: state.user.email || base.email || "",
      username: base.username || getV("editProfDisplayName") || "user",
      displayName: getV("editProfDisplayName") || base.username || "User",
      avatar: avatarUrl || safeUrl(getV("editProfAvatarUrl")) || base.avatar || DEFAULT_AVATAR_SVG,
      role: base.role || getUserRole(uid),
      regDate: base.regDate || formatTime(new Date().getTime()),
      status: getV("editProfStatus"),
      pronouns: getV("editProfPronouns"),
      relationship: getV("editProfRelationship"),
      hometown: getV("editProfHometown"),
      politics: getV("editProfPolitics"),
      birthDate: getV("editProfBirthDate"),
      website: getV("editProfWebsite"),
      city: getV("editProfCity"),
      interests: getV("editProfInterests"),
      about: getV("editProfAbout"),
      favFilmTitle: getV("editFavFilmTitle"),
      favFilmImg: safeUrl(getV("editFavFilmImg")),
      favShowTitle: getV("editFavShowTitle"),
      favShowImg: safeUrl(getV("editFavShowImg")),
      favBookTitle: getV("editFavBookTitle"),
      favBookImg: safeUrl(getV("editFavBookImg")),
      favGameTitle: getV("editFavGameTitle"),
      favGameImg: safeUrl(getV("editFavGameImg")),
      customFields: customFields
    };

    dbWrite("PUT", "users/" + uid, updated, function(err) {
      if (!err) {
        state.profile = updated;
        state.users[uid] = updated;
        updateAuthUi();
        renderPublicProfile();
        showStatus("Profile saved!", false);
      } else {
        showStatus("Save error: " + err, true);
      }
    });
  }

  if (fEl && fEl.files && fEl.files[0]) {
    uploadImageToImgbb(fEl, function(err, url) {
      if (!err && url) {
        fEl.value = "";
        commitProfile(url);
      } else {
        showStatus(err || "Avatar upload failed", true);
      }
    }, { isSticker: true });
  } else {
    commitProfile("");
  }
}

function postToUserWall() {
  var uid = state.viewedProfileUid || (state.user && state.user.uid);
  if (!uid) return;
  var txtEl = document.getElementById("profileWallText");
  var fileEl = document.getElementById("profileWallFile");
  var vidEl = document.getElementById("profileWallVideo");
  var stEl = document.getElementById("profileWallSticker");
  createWallPostRecord(uid, txtEl ? txtEl.value.trim() : "", fileEl, vidEl, stEl, function() {
    if (txtEl) txtEl.value = "";
    if (fileEl) fileEl.value = "";
    if (vidEl) vidEl.value = "";
    clearSelectedSticker("profileWall");
    fetchAllData();
    showStatus("Posted on wall!", false);
  });
}

function toggleSubscribeUser(targetUid) {
  if (!state.user) return;
  var myUid = state.user.uid;
  var isSub = Boolean(state.subscriptions[myUid] && state.subscriptions[myUid][targetUid]);
  dbWrite(isSub ? "DELETE" : "PUT", "subscriptions/" + myUid + "/" + targetUid, isSub ? null : true, function() {
    if (!isSub) pushNotification(targetUid, getDisplayUsername() + " subscribed to you!", "profile", myUid);
    fetchAllData();
  });
}

function toggleBlockUser(targetUid) {
  if (!state.user) return;
  var myUid = state.user.uid;
  var isBlk = Boolean(state.blocks[myUid] && state.blocks[myUid][targetUid]);
  dbWrite(isBlk ? "DELETE" : "PUT", "blocks/" + myUid + "/" + targetUid, isBlk ? null : true, function() {
    fetchAllData();
    showStatus(isBlk ? "User unblocked." : "User blocked from writing on your wall.", false);
  });
}

function assignUserRole(roleName) {
  if (!isSuperiorAdmin() || !state.viewedProfileUid) return;
  dbWrite("PUT", "users/" + state.viewedProfileUid + "/role", roleName, function(err) {
    if (!err) {
      fetchAllData();
      showStatus("Role set to " + roleName.toUpperCase(), false);
    }
  });
}

/* ==========================================================================
   MEMBERS DIRECTORY
   ========================================================================== */
function renderMembersList() {
  var grid = document.getElementById("membersDirectoryGrid");
  if (!grid) return;
  function val(id) { var el = document.getElementById(id); return el ? el.value.trim().toLowerCase() : ""; }
  var fName = val("memberFilterName");
  var fPron = val("memberFilterPronouns");
  var fCity = val("memberFilterCity");
  var fRel = val("memberFilterRelation");
  var fPol = val("memberFilterPolitics");
  var fInt = val("memberFilterInterest");

  var h = "";
  for (var uid in state.users) {
    if (!state.users.hasOwnProperty(uid) || !state.users[uid]) continue;
    var u = state.users[uid];
    var nameStr = ((u.displayName || "") + " " + (u.username || "")).toLowerCase();
    var cityStr = ((u.city || "") + " " + (u.hometown || "")).toLowerCase();
    var intStr = ((u.interests || "") + " " + (u.favFilmTitle || "") + " " + (u.favGameTitle || "") + " " + (u.favBookTitle || "")).toLowerCase();

    if (fName && nameStr.indexOf(fName) === -1) continue;
    if (fPron && String(u.pronouns || "").toLowerCase().indexOf(fPron) === -1) continue;
    if (fCity && cityStr.indexOf(fCity) === -1) continue;
    if (fRel && String(u.relationship || "").toLowerCase().indexOf(fRel) === -1) continue;
    if (fPol && String(u.politics || "").toLowerCase().indexOf(fPol) === -1) continue;
    if (fInt && intStr.indexOf(fInt) === -1) continue;

    var av = isValidImageSrc(u.avatar) ? u.avatar : DEFAULT_AVATAR_SVG;
    h += "<div class='member-card'>" +
           "<div style='display:flex;gap:8px;align-items:center;'>" +
             "<img src='" + esc(av) + "' style='width:46px;height:46px;object-fit:cover;border:1px solid #800000;'>" +
             "<div>" +
               "<a href='#' onclick=\"openUserProfile('" + esc(uid) + "');return false;\"><b>" + esc(u.displayName || u.username) + "</b></a>" +
               renderRoleBadgeHtml(uid) +
               "<div class='muted'>" + esc([u.pronouns, u.city, u.relationship].filter(Boolean).join(" • ") || "Member") + "</div>" +
             "</div>" +
           "</div>" +
         "</div>";
  }
  grid.innerHTML = h || "<span class='muted'>No members match those filters.</span>";
}

/* ==========================================================================
   GROUPS
   ========================================================================== */
function createGroup() {
  if (!state.user) { showStatus("Login to create a group.", true); return; }
  var nEl = document.getElementById("groupNameInput");
  var dEl = document.getElementById("groupDescInput");
  var name = nEl ? nEl.value.trim() : "";
  var desc = dEl ? dEl.value.trim() : "";
  if (!name) { showStatus("Enter a group name.", true); return; }

  var gid = generateId("grp");
  var gObj = {
    id: gid,
    name: name,
    desc: desc,
    ownerUid: state.user.uid,
    ownerName: getDisplayUsername(),
    members: {},
    messages: {}
  };
  gObj.members[state.user.uid] = true;
  dbWrite("PUT", "groups/" + gid, gObj, function(err) {
    if (!err) {
      if (nEl) nEl.value = "";
      if (dEl) dEl.value = "";
      state.activeGroupId = gid;
      fetchAllData();
      showStatus("Group created!", false);
    }
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
           "<button type='button' style='margin-top:4px;' onclick=\"openGroup('" + esc(gid) + "')\">Open Group</button>" +
         "</div>";
  }
  box.innerHTML = h || "<span class='muted'>No groups created yet.</span>";
}

function openGroup(gid) {
  state.activeGroupId = gid;
  renderActiveGroup();
}

function toggleJoinActiveGroup() {
  if (!state.user || !state.activeGroupId) { showStatus("Login first.", true); return; }
  var g = state.groups[state.activeGroupId];
  if (!g) return;
  var isMem = g.members && g.members[state.user.uid];
  dbWrite(isMem ? "DELETE" : "PUT", "groups/" + g.id + "/members/" + state.user.uid, isMem ? null : true, function() {
    fetchAllData();
  });
}

function renderActiveGroup() {
  var wrap = document.getElementById("activeGroupView");
  if (!wrap) return;
  var g = state.activeGroupId && state.groups[state.activeGroupId];
  if (!g) {
    wrap.style.display = "none";
    return;
  }
  wrap.style.display = "block";
  var tEl = document.getElementById("activeGroupTitle");
  if (tEl) tEl.textContent = g.name + " (" + countMapKeys(g.members) + " members)";

  var btn = document.getElementById("groupJoinLeaveBtn");
  var isMem = state.user && g.members && g.members[state.user.uid];
  if (btn) btn.textContent = isMem ? "Leave Group" : "Join Group";

  var feed = document.getElementById("groupMessagesList");
  if (!feed) return;
  var msgs = [];
  if (g.messages) {
    for (var mid in g.messages) {
      if (g.messages.hasOwnProperty(mid) && g.messages[mid]) msgs.push(g.messages[mid]);
    }
  }
  msgs.sort(function(a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });

  var h = "";
  for (var i = 0; i < msgs.length; i++) {
    var m = msgs[i];
    h += "<div class='chat-msg'>" +
           "<b>" + esc(m.authorName || "User") + "</b> <span class='muted'>" + formatTime(m.createdAt) + "</span>: " +
           esc(m.text || "") +
           (isValidImageSrc(m.imageUrl) ? "<img class='post-media' src='" + esc(m.imageUrl) + "' alt='' onclick=\"openZoomModal(this.src,'Group Image','')\">" : "") +
           (isValidImageSrc(m.stickerUrl) ? "<img class='post-sticker' src='" + esc(m.stickerUrl) + "' alt=''>" : "") +
           (m.videoUrl ? renderVideoOrAudioEmbed(m.videoUrl) : "") +
         "</div>";
  }
  feed.innerHTML = h || "<span class='muted'>No messages yet.</span>";
  feed.scrollTop = feed.scrollHeight;
}

function sendGroupMessage() {
  if (!state.user || !state.activeGroupId) { showStatus("Login and open a group first.", true); return; }
  var txtEl = document.getElementById("groupMsgInput");
  var fileEl = document.getElementById("groupImgFile");
  var vidEl = document.getElementById("groupVideoUrl");
  var stEl = document.getElementById("groupStickerUrl");
  var text = txtEl ? txtEl.value.trim() : "";
  var videoUrl = vidEl ? safeUrl(vidEl.value) : "";
  var stickerUrl = stEl ? safeUrl(stEl.value) : "";

  function commit(imgUrl) {
    if (!text && !imgUrl && !videoUrl && !stickerUrl) return;
    var mid = generateId("gm");
    var mObj = {
      id: mid,
      authorUid: state.user.uid,
      authorName: getDisplayUsername(),
      text: text,
      imageUrl: imgUrl || "",
      videoUrl: videoUrl,
      stickerUrl: stickerUrl,
      createdAt: new Date().getTime()
    };
    dbWrite("PUT", "groups/" + state.activeGroupId + "/messages/" + mid, mObj, function(err) {
      if (!err) {
        if (txtEl) txtEl.value = "";
        if (fileEl) fileEl.value = "";
        if (vidEl) vidEl.value = "";
        clearSelectedSticker("group");
        fetchAllData();
      }
    });
  }

  if (fileEl && fileEl.files && fileEl.files[0]) {
    uploadImageToImgbb(fileEl, function(err, url) {
      if (!err && url) commit(url);
      else showStatus(err || "Upload failed", true);
    }, { isSticker: false });
  } else {
    commit("");
  }
}

/* ==========================================================================
   DIRECT MESSAGES (DMS)
   ========================================================================== */
function getDmConvKey(uid1, uid2) {
  return uid1 < uid2 ? (uid1 + "__" + uid2) : (uid2 + "__" + uid1);
}

function startDmWithUsername() {
  var inp = document.getElementById("dmNewTargetInput");
  var query = inp ? inp.value.trim().toLowerCase() : "";
  if (!query) return;
  for (var uid in state.users) {
    if (!state.users.hasOwnProperty(uid) || !state.users[uid]) continue;
    var u = state.users[uid];
    if (String(u.username || "").toLowerCase() === query || String(u.displayName || "").toLowerCase() === query) {
      if (inp) inp.value = "";
      openDmWithUser(uid);
      return;
    }
  }
  showStatus("User not found.", true);
}

function openDmWithUser(targetUid) {
  if (!state.user) { showStatus("Login to send direct messages.", true); return; }
  state.activeDmUid = targetUid;
  switchView("dms");
}

function renderDmList() {
  var side = document.getElementById("dmThreadsList");
  var feed = document.getElementById("dmMessagesList");
  var head = document.getElementById("dmActiveHeader");
  if (!side || !feed) return;

  if (!state.user) {
    side.innerHTML = "<div class='muted' style='padding:6px;'>Login to view DMs.</div>";
    feed.innerHTML = "";
    return;
  }

  var myUid = state.user.uid;
  var partners = {};
  if (state.activeDmUid && state.activeDmUid !== myUid) partners[state.activeDmUid] = true;

  for (var convKey in state.dms) {
    if (!state.dms.hasOwnProperty(convKey)) continue;
    var parts = convKey.split("__");
    if (parts[0] === myUid && parts[1]) partners[parts[1]] = true;
    if (parts[1] === myUid && parts[0]) partners[parts[0]] = true;
  }

  var sh = "";
  for (var pUid in partners) {
    if (!partners.hasOwnProperty(pUid)) continue;
    var pu = state.users[pUid] || { displayName: pUid };
    var act = (pUid === state.activeDmUid) ? " active-dm" : "";
    sh += "<div class='dm-thread-item" + act + "' onclick=\"openDmWithUser('" + esc(pUid) + "')\">" +
            esc(pu.displayName || pu.username || pUid) +
          "</div>";
  }
  side.innerHTML = sh || "<div class='muted' style='padding:6px;'>No conversations yet.</div>";

  if (!state.activeDmUid) {
    if (head) head.textContent = "Select a user";
    feed.innerHTML = "";
    return;
  }

  var targetUser = state.users[state.activeDmUid] || { displayName: state.activeDmUid };
  if (head) head.textContent = "Chat with " + (targetUser.displayName || targetUser.username || state.activeDmUid);

  var key = getDmConvKey(myUid, state.activeDmUid);
  var msgsMap = (state.dms[key] && state.dms[key].messages) || {};
  var list = [];
  for (var mid in msgsMap) {
    if (msgsMap.hasOwnProperty(mid) && msgsMap[mid]) list.push(msgsMap[mid]);
  }
  list.sort(function(a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });

  var mh = "";
  for (var i = 0; i < list.length; i++) {
    var m = list[i];
    mh += "<div class='chat-msg'>" +
            "<b>" + esc(m.fromName || "User") + "</b> <span class='muted'>" + formatTime(m.createdAt) + "</span>: " +
            esc(m.text || "") +
            (isValidImageSrc(m.imageUrl) ? "<img class='post-media' src='" + esc(m.imageUrl) + "' alt='' onclick=\"openZoomModal(this.src,'DM Image','')\">" : "") +
            (isValidImageSrc(m.stickerUrl) ? "<img class='post-sticker' src='" + esc(m.stickerUrl) + "' alt=''>" : "") +
            (m.videoUrl ? renderVideoOrAudioEmbed(m.videoUrl) : "") +
          "</div>";
  }
  feed.innerHTML = mh || "<span class='muted'>Say hello!</span>";
  feed.scrollTop = feed.scrollHeight;
}

function sendDmMessage() {
  if (!state.user || !state.activeDmUid) { showStatus("Select a user to message.", true); return; }
  var txtEl = document.getElementById("dmMsgInput");
  var fileEl = document.getElementById("dmImgFile");
  var vidEl = document.getElementById("dmVideoUrl");
  var stEl = document.getElementById("dmStickerUrl");
  var text = txtEl ? txtEl.value.trim() : "";
  var videoUrl = vidEl ? safeUrl(vidEl.value) : "";
  var stickerUrl = stEl ? safeUrl(stEl.value) : "";

  function commit(imgUrl) {
    if (!text && !imgUrl && !videoUrl && !stickerUrl) return;
    var key = getDmConvKey(state.user.uid, state.activeDmUid);
    var mid = generateId("dm");
    var mObj = {
      id: mid,
      fromUid: state.user.uid,
      fromName: getDisplayUsername(),
      toUid: state.activeDmUid,
      text: text,
      imageUrl: imgUrl || "",
      videoUrl: videoUrl,
      stickerUrl: stickerUrl,
      createdAt: new Date().getTime()
    };
    dbWrite("PUT", "dms/" + key + "/messages/" + mid, mObj, function(err) {
      if (!err) {
        if (txtEl) txtEl.value = "";
        if (fileEl) fileEl.value = "";
        if (vidEl) vidEl.value = "";
        clearSelectedSticker("dm");
        pushNotification(state.activeDmUid, "New DM from " + getDisplayUsername(), "dms", state.user.uid);
        fetchAllData();
      }
    });
  }

  if (fileEl && fileEl.files && fileEl.files[0]) {
    uploadImageToImgbb(fileEl, function(err, url) {
      if (!err && url) commit(url);
      else showStatus(err || "Upload failed", true);
    }, { isSticker: false });
  } else {
    commit("");
  }
}

/* ==========================================================================
   PUBLIC STICKERS & STICKER PICKER
   ========================================================================== */
function uploadPublicSticker() {
  if (!state.user) { showStatus("Login to upload stickers.", true); return; }
  var nameEl = document.getElementById("stickerNameInput");
  var fileEl = document.getElementById("stickerFileInput");
  var name = nameEl ? nameEl.value.trim() : "Sticker";
  if (!fileEl || !fileEl.files || !fileEl.files[0]) {
    showStatus("Select a sticker image file.", true);
    return;
  }
  uploadImageToImgbb(fileEl, function(err, url) {
    if (!err && url) {
      var stId = generateId("st");
      var stObj = {
        id: stId,
        name: name || "Sticker",
        url: url,
        uploadedByUid: state.user.uid,
        uploadedByName: getDisplayUsername(),
        createdAt: new Date().getTime()
      };
      dbWrite("PUT", "stickers/" + stId, stObj, function(wErr) {
        if (!wErr) {
          if (nameEl) nameEl.value = "";
          fileEl.value = "";
          fetchAllData();
          showStatus("Sticker added to public archive!", false);
        }
      });
    } else {
      showStatus(err || "Sticker upload failed", true);
    }
  }, { isSticker: true });
}

function renderStickersArchive() {
  var grid = document.getElementById("stickersArchiveGrid");
  if (!grid) return;
  var h = "";
  for (var id in state.stickers) {
    if (!state.stickers.hasOwnProperty(id) || !state.stickers[id]) continue;
    var s = state.stickers[id];
    h += "<div class='sticker-card' onclick=\"openZoomModal('" + esc(s.url) + "','" + esc(s.name || "Sticker") + "','By " + esc(s.uploadedByName || "User") + "')\">" +
           "<img src='" + esc(s.url) + "' alt=''>" +
           "<span>" + esc(s.name || "Sticker") + "</span>" +
         "</div>";
  }
  grid.innerHTML = h || "<span class='muted'>No stickers uploaded yet.</span>";
}

function openStickerPicker(targetContext) {
  state.stickerPickerTarget = targetContext;
  var modal = document.getElementById("stickerPickerModal");
  var grid = document.getElementById("stickerPickerGrid");
  if (!modal || !grid) return;

  var h = "";
  for (var id in state.stickers) {
    if (!state.stickers.hasOwnProperty(id) || !state.stickers[id]) continue;
    var s = state.stickers[id];
    h += "<div class='sticker-card' onclick=\"selectStickerForTarget('" + esc(s.url) + "')\">" +
           "<img src='" + esc(s.url) + "' alt=''>" +
           "<span>" + esc(s.name || "Sticker") + "</span>" +
         "</div>";
  }
  grid.innerHTML = h || "<span class='muted'>No stickers yet. Upload one in [Stickers]!</span>";
  modal.style.display = "block";
}

function selectStickerForTarget(url) {
  var map = {
    thread: ["threadStickerUrl", "threadStickerPreview"],
    globalWall: ["globalWallSticker", "globalWallStickerPreview"],
    profileWall: ["profileWallSticker", "profileWallStickerPreview"],
    group: ["groupStickerUrl", "groupStickerPreview"],
    dm: ["dmStickerUrl", "dmStickerPreview"]
  };
  var pair = map[state.stickerPickerTarget];
  if (pair) {
    var inp = document.getElementById(pair[0]);
    var prev = document.getElementById(pair[1]);
    if (inp) inp.value = url;
    if (prev) prev.innerHTML = "<img src='" + esc(url) + "' alt='Sticker'> <button type='button' onclick=\"clearSelectedSticker('" + esc(state.stickerPickerTarget) + "')\">Remove</button>";
  }
  closeStickerPicker();
}

function clearSelectedSticker(targetContext) {
  var map = {
    thread: ["threadStickerUrl", "threadStickerPreview"],
    globalWall: ["globalWallSticker", "globalWallStickerPreview"],
    profileWall: ["profileWallSticker", "profileWallStickerPreview"],
    group: ["groupStickerUrl", "groupStickerPreview"],
    dm: ["dmStickerUrl", "dmStickerPreview"]
  };
  var pair = map[targetContext];
  if (!pair) return;
  var inp = document.getElementById(pair[0]);
  var prev = document.getElementById(pair[1]);
  if (inp) inp.value = "";
  if (prev) prev.innerHTML = "";
}

function closeStickerPicker() {
  var modal = document.getElementById("stickerPickerModal");
  if (modal) modal.style.display = "none";
}

/* ==========================================================================
   MUSIC RADIO PLAYER
   ========================================================================== */
function initMusicPlayer() {
  var audio = document.getElementById("audioPlayerEl");
  var box = document.getElementById("musicWidgetBox");
  var playBtn = document.getElementById("musicPlayBtn");
  if (!audio) return;

  audio.addEventListener("play", function() {
    if (box) box.className = "side-box music-widget is-playing";
    if (playBtn) playBtn.textContent = "Pause";
  });
  audio.addEventListener("pause", function() {
    if (box) box.className = "side-box music-widget";
    if (playBtn) playBtn.textContent = "Play";
  });
  audio.addEventListener("ended", function() {
    nextMusicTrack();
  });
}

function rebuildMusicPlaylist() {
  var list = [];
  for (var id in state.music) {
    if (state.music.hasOwnProperty(id) && state.music[id]) list.push(state.music[id]);
  }
  list.sort(function(a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
  state.musicPlaylist = list;

  var box = document.getElementById("musicPlaylist");
  if (!box) return;
  var h = "";
  for (var i = 0; i < list.length; i++) {
    var tr = list[i];
    var act = (i === state.currentTrackIndex) ? " active-track" : "";
    h += "<div class='music-track-item" + act + "' onclick='playMusicTrack(" + i + ")'>" +
           (i + 1) + ". " + esc(tr.title || "Track") + " <span class='muted'>(" + esc(tr.by || "Anon") + ")</span>" +
         "</div>";
  }
  box.innerHTML = h || "<span class='muted'>No tracks uploaded yet.</span>";
}

function playMusicTrack(idx) {
  var tr = state.musicPlaylist[idx];
  var audio = document.getElementById("audioPlayerEl");
  var np = document.getElementById("musicNowPlaying");
  if (!tr || !audio) return;
  state.currentTrackIndex = idx;
  audio.src = tr.url;
  if (np) np.textContent = tr.title || "Playing Track";
  audio.play();
  rebuildMusicPlaylist();
}

function toggleMusicPlay() {
  var audio = document.getElementById("audioPlayerEl");
  if (!audio) return;
  if (!audio.src && state.musicPlaylist.length) {
    playMusicTrack(0);
    return;
  }
  if (audio.paused) audio.play();
  else audio.pause();
}

function prevMusicTrack() {
  if (!state.musicPlaylist.length) return;
  var next = (state.currentTrackIndex - 1 + state.musicPlaylist.length) % state.musicPlaylist.length;
  playMusicTrack(next);
}

function nextMusicTrack() {
  if (!state.musicPlaylist.length) return;
  var next = (state.currentTrackIndex + 1) % state.musicPlaylist.length;
  playMusicTrack(next);
}

function uploadMusicTrack() {
  if (!state.user) { showStatus("Login to upload music.", true); return; }
  var titleEl = document.getElementById("musicTitleInput");
  var fileEl = document.getElementById("musicFileInput");
  if (!fileEl || !fileEl.files || !fileEl.files[0]) {
    showStatus("Select an audio file first.", true);
    return;
  }
  var title = (titleEl && titleEl.value.trim()) || fileEl.files[0].name.replace(/\.[^.]+$/, "");
  uploadAudioToHost(fileEl, function(err, dataUrl) {
    if (err || !dataUrl) {
      showStatus(err || "Audio upload failed", true);
      return;
    }
    var tid = generateId("trk");
    var trObj = {
      id: tid,
      title: title,
      url: dataUrl,
      uid: state.user.uid,
      by: getDisplayUsername(),
      createdAt: new Date().getTime()
    };
    dbWrite("PUT", "music/" + tid, trObj, function(wErr) {
      if (!wErr) {
        if (titleEl) titleEl.value = "";
        fileEl.value = "";
        fetchAllData();
        showStatus("Track uploaded to radio!", false);
      } else {
        showStatus("Music save error: " + wErr, true);
      }
    });
  });
}

/* ==========================================================================
   NOTIFICATIONS
   ========================================================================== */
function pushNotification(targetUid, text, linkView, linkId) {
  if (!targetUid) return;
  var nid = generateId("ntf");
  var nObj = {
    id: nid,
    text: text,
    linkView: linkView || "boards",
    linkId: linkId || "",
    read: false,
    createdAt: new Date().getTime()
  };
  dbWrite("PUT", "notifications/" + targetUid + "/" + nid, nObj, null);
}

function updateNotifBadge() {
  var badge = document.getElementById("notifBadge");
  if (!badge) return;
  if (!state.user || !state.notifications[state.user.uid]) {
    badge.style.display = "none";
    return;
  }
  var map = state.notifications[state.user.uid];
  var unread = 0;
  for (var id in map) {
    if (map.hasOwnProperty(id) && map[id] && !map[id].read) unread++;
  }
  if (unread > 0) {
    badge.style.display = "inline";
    badge.textContent = String(unread);
  } else {
    badge.style.display = "none";
  }
}

function renderNotifications() {
  var box = document.getElementById("notificationsList");
  if (!box) return;
  if (!state.user) {
    box.innerHTML = "<span class='muted'>Login to view notifications.</span>";
    return;
  }
  var map = state.notifications[state.user.uid] || {};
  var list = [];
  for (var id in map) {
    if (map.hasOwnProperty(id) && map[id]) list.push(map[id]);
  }
  list.sort(function(a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });

  var h = "";
  for (var i = 0; i < list.length; i++) {
    var n = list[i];
    h += "<div class='chat-msg' style='" + (n.read ? "" : "font-weight:bold;") + "'>" +
           esc(n.text) + " <span class='muted'>" + formatTime(n.createdAt) + "</span>" +
         "</div>";
  }
  box.innerHTML = h || "<span class='muted'>No notifications yet.</span>";
}

function markAllNotificationsRead() {
  if (!state.user || !state.notifications[state.user.uid]) return;
  var map = state.notifications[state.user.uid];
  var patch = {};
  for (var id in map) {
    if (map.hasOwnProperty(id) && map[id] && !map[id].read) {
      map[id].read = true;
      patch[id + "/read"] = true;
    }
  }
  updateNotifBadge();
  renderNotifications();
  dbWrite("PATCH", "notifications/" + state.user.uid, patch, null);
}
