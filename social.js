/* ==========================================================================
   FEMBOORU SOCIAL & IMAGEBOARD: BOARDS, POLLS, THREADS, PROFILES, WALL (STENA),
   REPOSTS, SUBSCRIPTIONS/BLOCKS, GROUPS, DMs, STICKERS & NOTIFICATIONS
   ========================================================================== */
function renderMediaHtml(imageUrl, videoUrl, stickerUrl) {
  var h = "";
  if (isValidImageSrc(imageUrl)) {
    h += "<img class='post-media' src='" + esc(imageUrl) + "' alt='media' onclick=\"openZoomModal(this.src,'Image','')\">";
  }
  if (isValidImageSrc(stickerUrl)) {
    h += "<img class='post-sticker' src='" + esc(stickerUrl) + "' alt='sticker'>";
  }
  var v = safeUrl(videoUrl);
  if (v) {
    var yt = v.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{6,})/);
    if (yt && yt[1]) {
      h += "<iframe class='video-embed' height='235' src='https://www.youtube.com/embed/" + esc(yt[1]) + "' frameborder='0' allowfullscreen></iframe>";
    } else {
      h += "<video class='video-embed' controls preload='metadata' src='" + esc(v) + "'></video>";
    }
  }
  return h;
}

function renderRoleBadge(uid) {
  var r = getUserRole(uid);
  if (r === "superior_admin") return "<span class='role-badge'>ADMIN</span>";
  if (r === "admin") return "<span class='role-badge'>JR ADMIN</span>";
  if (r === "moderator") return "<span class='role-badge'>MOD</span>";
  return "";
}

/* ==========================================================================
   BOARDS & COMMUNITY BOARD CREATION POLLS
   ========================================================================== */
function renderBoardsSidebar() {
  var box = document.getElementById("boardsList");
  if (!box) return;
  var h = "";
  for (var i = 0; i < state.boards.length; i++) {
    var b = state.boards[i];
    var act = (state.view === "boards" && state.currentBoard === b.slug) ? " class='active-board'" : "";
    h += "<a href='javascript:void(0)'" + act + " onclick=\"selectBoard('" + esc(b.slug) + "')\">" + esc(b.title) + "</a>";
  }
  box.innerHTML = h;
}

function selectBoard(slug) {
  state.currentBoard = slug;
  state.view = "boards";
  var titleEl = document.getElementById("currentBoardTitle");
  var descEl = document.getElementById("currentBoardDesc");
  for (var i = 0; i < state.boards.length; i++) {
    if (state.boards[i].slug === slug) {
      if (titleEl) titleEl.textContent = state.boards[i].title;
      if (descEl) descEl.textContent = state.boards[i].desc || "";
      break;
    }
  }
  if (typeof switchView === "function") switchView("boards");
}

function proposeOrCreateBoard() {
  if (!state.user) { showStatus("Login required.", true); return; }
  var sEl = document.getElementById("newBoardSlug");
  var tEl = document.getElementById("newBoardTitle");
  var dEl = document.getElementById("newBoardDesc");
  var slug = String(sEl ? sEl.value : "").toLowerCase().replace(/[^a-z0-9_-]/g, "").substring(0, 16);
  var title = String(tEl ? tEl.value : "").replace(/^\s+|\s+$/g, "").substring(0, 48);
  var desc = String(dEl ? dEl.value : "").replace(/^\s+|\s+$/g, "").substring(0, 120);
  if (!slug || !title) { showStatus("Enter board slug and title.", true); return; }

  var boardObj = { slug: slug, title: "/" + slug + "/ — " + title, desc: desc || "Community board." };
  if (isSuperiorAdmin() || getUserRole(state.user.uid) === "admin") {
    dbWrite("PUT", "boards/" + slug, boardObj, function(err) {
      if (!err) {
        if (sEl) sEl.value = "";
        if (tEl) tEl.value = "";
        if (dEl) dEl.value = "";
        if (typeof fetchAllData === "function") fetchAllData();
        showStatus("Board created immediately!", false);
      }
    });
  } else {
    var votes = {};
    votes[state.user.uid] = "yes";
    var pollObj = {
      slug: slug,
      title: boardObj.title,
      desc: boardObj.desc,
      createdBy: state.user.uid,
      creatorName: getDisplayUsername(),
      votes: votes,
      status: "open",
      createdAt: new Date().getTime()
    };
    dbWrite("PUT", "polls/" + slug, pollObj, function(err) {
      if (!err) {
        if (sEl) sEl.value = "";
        if (tEl) tEl.value = "";
        if (dEl) dEl.value = "";
        if (typeof fetchAllData === "function") fetchAllData();
        showStatus("Board proposal poll created!", false);
      }
    });
  }
}

function voteBoardPoll(slug, choice) {
  if (!state.user) { showStatus("Login to vote.", true); return; }
  var poll = state.polls[slug];
  if (!poll || poll.status !== "open") return;
  dbWrite("PUT", "polls/" + slug + "/votes/" + state.user.uid, choice, function() {
    poll.votes = poll.votes || {};
    poll.votes[state.user.uid] = choice;
    var yesCount = 0, noCount = 0;
    for (var u in poll.votes) {
      if (poll.votes.hasOwnProperty(u)) {
        if (poll.votes[u] === "yes") yesCount++;
        else if (poll.votes[u] === "no") noCount++;
      }
    }
    var needed = Math.max(2, Math.ceil(countMapKeys(state.users) * 0.5));
    if (yesCount >= needed && yesCount > noCount) {
      dbWrite("PUT", "boards/" + slug, { slug: slug, title: poll.title, desc: poll.desc }, function() {
        dbWrite("DELETE", "polls/" + slug, null, function() {
          if (typeof fetchAllData === "function") fetchAllData();
        });
        showStatus("Majority agreed! Board /" + slug + "/ is now live!", false);
      });
    } else if (typeof fetchAllData === "function") {
      fetchAllData();
    }
  });
}

function cancelBoardPoll(slug) {
  var poll = state.polls[slug];
  if (!state.user || !poll) return;
  if (poll.createdBy !== state.user.uid && !isSuperiorAdmin()) return;
  dbWrite("DELETE", "polls/" + slug, null, function() {
    if (typeof fetchAllData === "function") fetchAllData();
    showStatus("Board proposal cancelled.", false);
  });
}

function renderBoardPolls() {
  var box = document.getElementById("boardPollsBox");
  if (!box) return;
  var h = "";
  for (var slug in state.polls) {
    if (!state.polls.hasOwnProperty(slug) || !state.polls[slug]) continue;
    var p = state.polls[slug];
    var yes = 0, no = 0;
    if (p.votes) {
      for (var k in p.votes) {
        if (p.votes.hasOwnProperty(k)) {
          if (p.votes[k] === "yes") yes++;
          else if (p.votes[k] === "no") no++;
        }
      }
    }
    var canCancel = state.user && (p.createdBy === state.user.uid || isSuperiorAdmin());
    h += "<div class='poll-card'>" +
           "<b>Poll: " + esc(p.title) + "</b><br>" +
           "<span class='muted'>By " + esc(p.creatorName) + " • Agree: " + yes + " / Disagree: " + no + "</span><br>" +
           "<button type='button' onclick=\"voteBoardPoll('" + esc(slug) + "','yes')\">Agree</button> " +
           "<button type='button' onclick=\"voteBoardPoll('" + esc(slug) + "','no')\">Disagree</button> " +
           (canCancel ? "<button type='button' class='btn-danger' onclick=\"cancelBoardPoll('" + esc(slug) + "')\">Cancel</button>" : "") +
         "</div>";
  }
  box.innerHTML = h;
}

/* ==========================================================================
   THREADS, COMMENTS & LIKES
   ========================================================================== */
function createThread() {
  if (!state.user) { showStatus("Login required to post.", true); return; }
  var subj = (document.getElementById("threadSubjectInput").value || "").replace(/^\s+|\s+$/g, "");
  var text = (document.getElementById("threadTextInput").value || "").replace(/^\s+|\s+$/g, "");
  var vid = safeUrl(document.getElementById("threadVideoUrlInput").value);
  var sticker = safeUrl(document.getElementById("threadStickerUrl").value);
  var fEl = document.getElementById("threadImageInput");

  function saveThread(imgUrl) {
    if (!text && !imgUrl && !vid && !sticker) { showStatus("Post cannot be empty.", true); return; }
    var tid = generateId("th");
    var now = new Date().getTime();
    var obj = {
      id: tid,
      board: state.currentBoard,
      uid: state.user.uid,
      author: getDisplayUsername(),
      subject: subj,
      text: text,
      imageUrl: imgUrl || "",
      videoUrl: vid || "",
      stickerUrl: sticker || "",
      createdAt: now,
      bumpedAt: now
    };
    dbWrite("PUT", "threads/" + tid, obj, function(err) {
      if (!err) {
        document.getElementById("threadSubjectInput").value = "";
        document.getElementById("threadTextInput").value = "";
        document.getElementById("threadVideoUrlInput").value = "";
        if (fEl) fEl.value = "";
        clearAttachedSticker("thread");
        if (typeof fetchAllData === "function") fetchAllData();
        showStatus("Thread posted!", false);
      } else showStatus(err, true);
    });
  }

  if (fEl && fEl.files && fEl.files[0]) {
    uploadImageToImgbb(fEl, function(err, url) {
      if (!err && url) saveThread(url);
      else showStatus(err || "Image upload failed", true);
    });
  } else {
    saveThread("");
  }
}

function renderThreads() {
  var box = document.getElementById("threadsContainer");
  if (!box) return;
  var list = [];
  for (var tid in state.threads) {
    if (state.threads.hasOwnProperty(tid) && state.threads[tid]) {
      var t = state.threads[tid];
      if (t.board === state.currentBoard && !isUserBlockedByMe(t.uid)) list.push(t);
    }
  }
  list.sort(function(a, b) { return (b.bumpedAt || b.createdAt || 0) - (a.bumpedAt || a.createdAt || 0); });

  var h = "";
  for (var i = 0; i < list.length; i++) {
    var th = list[i];
    var likes = countMapKeys(th.likes);
    var liked = Boolean(state.user && th.likes && th.likes[state.user.uid]);
    var canDel = Boolean(state.user && (th.uid === state.user.uid || canModerateTargetUser(th.uid)));

    h += "<article class='thread-item'>" +
           "<div class='post-header'>" +
             "<span>" +
               (th.subject ? "<span class='post-subject'>" + esc(th.subject) + "</span> " : "") +
               "<span class='post-author' onclick=\"openUserProfile('" + esc(th.uid) + "')\">" + esc(th.author || "Anon") + "</span>" +
               renderRoleBadge(th.uid) +
               " <span class='muted'>" + formatTime(th.createdAt) + "</span>" +
             "</span>" +
             "<span>" +
               "<button type='button' onclick=\"toggleThreadLike('" + esc(th.id) + "')\">" + (liked ? "Liked" : "Like") + " (" + likes + ")</button> " +
               "<button type='button' onclick=\"repostToMyWall('thread','','" + esc(th.id) + "')\">Repost</button> " +
               (canDel ? "<button type='button' class='btn-danger' onclick=\"deleteThread('" + esc(th.id) + "')\">Delete</button>" : "") +
             "</span>" +
           "</div>" +
           renderMediaHtml(th.imageUrl, th.videoUrl, th.stickerUrl) +
           "<div class='post-body'>" + esc(th.text) + "</div>" +
           "<div class='comments-box'>";

    var cList = [];
    if (th.comments) {
      for (var cid in th.comments) {
        if (th.comments.hasOwnProperty(cid) && th.comments[cid] && !isUserBlockedByMe(th.comments[cid].uid)) {
          cList.push(th.comments[cid]);
        }
      }
    }
    cList.sort(function(a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });

    for (var j = 0; j < cList.length; j++) {
      var cm = cList[j];
      var cLikes = countMapKeys(cm.likes);
      var cDel = Boolean(state.user && (cm.uid === state.user.uid || canModerateTargetUser(cm.uid)));
      h += "<div class='comment-item'>" +
             "<div class='post-header'>" +
               "<span><span class='post-author' onclick=\"openUserProfile('" + esc(cm.uid) + "')\">" + esc(cm.author || "Anon") + "</span>" + renderRoleBadge(cm.uid) + " <span class='muted'>" + formatTime(cm.createdAt) + "</span></span>" +
               "<span>" +
                 "<button type='button' onclick=\"toggleCommentLike('" + esc(th.id) + "','" + esc(cm.id) + "')\">Like (" + cLikes + ")</button> " +
                 (cDel ? "<button type='button' class='btn-danger' onclick=\"deleteThreadComment('" + esc(th.id) + "','" + esc(cm.id) + "')\">x</button>" : "") +
               "</span>" +
             "</div>" +
             renderMediaHtml("", "", cm.stickerUrl) +
             "<div class='post-body'>" + esc(cm.text) + "</div>" +
           "</div>";
    }

    h += "<div class='form-row'>" +
           "<input type='text' id='replyInput_" + esc(th.id) + "' placeholder='Reply to thread...'>" +
           "<input type='hidden' id='replySticker_" + esc(th.id) + "'>" +
           "<button type='button' onclick=\"openStickerPicker('reply:" + esc(th.id) + "')\">+ Sticker</button>" +
           "<button type='button' onclick=\"addThreadComment('" + esc(th.id) + "')\">Reply</button>" +
         "</div>" +
         "<div id='replyStickerPreview_" + esc(th.id) + "' class='sticker-attach-preview'></div>" +
       "</div></article>";
  }
  box.innerHTML = h || "<div class='box-panel'><div class='box-body muted'>No threads on this board yet.</div></div>";
}

function toggleThreadLike(tid) {
  if (!state.user) { showStatus("Login to like.", true); return; }
  var th = state.threads[tid];
  if (!th) return;
  var exists = Boolean(th.likes && th.likes[state.user.uid]);
  dbWrite(exists ? "DELETE" : "PUT", "threads/" + tid + "/likes/" + state.user.uid, exists ? null : true, function() {
    if (typeof fetchAllData === "function") fetchAllData();
  });
}

function deleteThread(tid) {
  dbWrite("DELETE", "threads/" + tid, null, function() {
    if (typeof fetchAllData === "function") fetchAllData();
  });
}

function addThreadComment(tid) {
  if (!state.user) { showStatus("Login to reply.", true); return; }
  var inp = document.getElementById("replyInput_" + tid);
  var stInp = document.getElementById("replySticker_" + tid);
  var txt = (inp ? inp.value : "").replace(/^\s+|\s+$/g, "");
  var st = safeUrl(stInp ? stInp.value : "");
  if (!txt && !st) return;

  var cid = generateId("cm");
  var now = new Date().getTime();
  var cmObj = {
    id: cid,
    uid: state.user.uid,
    author: getDisplayUsername(),
    text: txt,
    stickerUrl: st || "",
    createdAt: now
  };
  dbWrite("PUT", "threads/" + tid + "/comments/" + cid, cmObj, function(err) {
    if (!err) {
      dbWrite("PUT", "threads/" + tid + "/bumpedAt", now, function() {
        if (typeof fetchAllData === "function") fetchAllData();
      });
      var th = state.threads[tid];
      if (th && th.uid && th.uid !== state.user.uid) {
        pushNotification(th.uid, getDisplayUsername() + " replied to your thread.", "boards", tid);
      }
    }
  });
}

function toggleCommentLike(tid, cid) {
  if (!state.user) { showStatus("Login to like.", true); return; }
  var cm = state.threads[tid] && state.threads[tid].comments && state.threads[tid].comments[cid];
  if (!cm) return;
  var exists = Boolean(cm.likes && cm.likes[state.user.uid]);
  dbWrite(exists ? "DELETE" : "PUT", "threads/" + tid + "/comments/" + cid + "/likes/" + state.user.uid, exists ? null : true, function() {
    if (typeof fetchAllData === "function") fetchAllData();
  });
}

function deleteThreadComment(tid, cid) {
  dbWrite("DELETE", "threads/" + tid + "/comments/" + cid, null, function() {
    if (typeof fetchAllData === "function") fetchAllData();
  });
}

/* ==========================================================================
   PUBLIC PROFILES, DISCORD FAVORITE CARDS, SUBSCRIPTIONS & BLOCKS
   ========================================================================== */
function openMyProfile() {
  if (!state.user) { showStatus("Login to view/edit your profile.", true); return; }
  state.viewedProfileUid = state.user.uid;
  if (typeof switchView === "function") switchView("profile");
}

function openUserProfile(uid) {
  if (!uid) return;
  state.viewedProfileUid = uid;
  if (typeof switchView === "function") switchView("profile");
}

function renderPublicProfile() {
  var uid = state.viewedProfileUid || (state.user && state.user.uid);
  if (!uid) {
    var keys = Object.keys(state.users);
    if (keys.length) uid = keys[0];
  }
  state.viewedProfileUid = uid;
  var p = (uid && state.users[uid]) || { displayName: "Guest", username: "guest", avatar: DEFAULT_AVATAR_SVG };
  var isOwn = Boolean(state.user && uid === state.user.uid);

  document.getElementById("profHeaderTitle").textContent = (p.displayName || p.username || "User") + " (@" + (p.username || "user") + ")";
  document.getElementById("profStatusBanner").textContent = p.status || "No status message.";
  document.getElementById("profViewAvatar").src = isValidImageSrc(p.avatar) ? p.avatar : DEFAULT_AVATAR_SVG;
  document.getElementById("profViewDisplayName").innerHTML = esc(p.displayName || p.username || "User") + renderRoleBadge(uid);

  var subCount = 0;
  for (var sUid in state.subscriptions) {
    if (state.subscriptions.hasOwnProperty(sUid) && state.subscriptions[sUid] && state.subscriptions[sUid][uid]) subCount++;
  }
  document.getElementById("profSubStats").textContent = subCount + " subscribers";

  var actBox = document.getElementById("profActionButtons");
  if (actBox) {
    if (!isOwn && state.user && uid) {
      var isSub = Boolean(state.subscriptions[state.user.uid] && state.subscriptions[state.user.uid][uid]);
      var isBlk = isUserBlockedByMe(uid);
      actBox.innerHTML =
        "<button type='button' onclick=\"toggleSubscribe('" + esc(uid) + "')\">" + (isSub ? "Unsubscribe" : "Subscribe") + "</button> " +
        "<button type='button' class='btn-danger' onclick=\"toggleBlockUser('" + esc(uid) + "')\">" + (isBlk ? "Unblock" : "Block") + "</button> " +
        "<button type='button' onclick=\"openDmWithUser('" + esc(uid) + "')\">Message</button>";
    } else {
      actBox.innerHTML = "";
    }
  }

  var roleBar = document.getElementById("superiorAdminRoleBar");
  if (roleBar) roleBar.style.display = (isSuperiorAdmin() && uid && !isOwn) ? "block" : "none";

  function setText(id, val) { var el = document.getElementById(id); if (el) el.textContent = val || "—"; }
  setText("profViewPronouns", p.pronouns);
  setText("profViewRelationship", p.relationship);
  setText("profViewRegDate", p.regDate || formatTime(p.createdAt).split(" ")[0]);
  setText("profViewHometown", p.hometown);
  setText("profViewPolitics", p.politics);
  setText("profViewBirthDate", p.birthDate);
  setText("profViewCity", p.city);
  setText("profViewInterests", p.interests);
  setText("profViewAbout", p.about);

  var webEl = document.getElementById("profViewWebsite");
  if (webEl) {
    var wUrl = safeUrl(p.website);
    webEl.innerHTML = wUrl ? "<a href='" + esc(wUrl) + "' target='_blank' rel='noopener'>" + esc(wUrl) + "</a>" : esc(p.website || "—");
  }

  var custBox = document.getElementById("profViewCustomFields");
  if (custBox) {
    var ch = "";
    if (p.customFields && p.customFields.length) {
      ch += "<table class='info-table'>";
      for (var c = 0; c < p.customFields.length; c++) {
        ch += "<tr><th>" + esc(p.customFields[c].label) + ":</th><td>" + esc(p.customFields[c].value) + "</td></tr>";
      }
      ch += "</table>";
    }
    custBox.innerHTML = ch;
  }

  var favBox = document.getElementById("profFavoritesCards");
  if (favBox) {
    var favs = [
      { type: "Favorite Film", title: p.favFilmTitle, img: p.favFilmImg },
      { type: "Favorite TV-Show", title: p.favShowTitle, img: p.favShowImg },
      { type: "Favorite Book", title: p.favBookTitle, img: p.favBookImg },
      { type: "Favorite Game", title: p.favGameTitle, img: p.favGameImg }
    ];
    var fh = "";
    for (var f = 0; f < favs.length; f++) {
      if (favs[f].title || favs[f].img) {
        var cardImg = isValidImageSrc(favs[f].img) ? favs[f].img : DEFAULT_AVATAR_SVG;
        fh += "<div class='fav-card' onclick=\"openZoomModal('" + esc(cardImg) + "','" + esc(favs[f].type) + "','" + esc(favs[f].title || "") + "')\">" +
                "<img src='" + esc(cardImg) + "' alt='card'>" +
                "<div class='fav-card-type'>" + esc(favs[f].type) + "</div>" +
                "<div class='fav-card-title'>" + esc(favs[f].title || "Untitled") + "</div>" +
              "</div>";
      }
    }
    favBox.innerHTML = fh || "<span class='muted'>No favorite cards added yet.</span>";
  }

  var ed = document.getElementById("myProfileEditor");
  if (ed) {
    ed.style.display = isOwn ? "block" : "none";
    if (isOwn) {
      document.getElementById("editProfStatus").value = p.status || "";
      document.getElementById("editProfDisplayName").value = p.displayName || "";
      document.getElementById("editProfAvatarUrl").value = p.avatar || "";
      document.getElementById("editProfPronouns").value = p.pronouns || "";
      document.getElementById("editProfRelationship").value = p.relationship || "";
      document.getElementById("editProfHometown").value = p.hometown || "";
      document.getElementById("editProfPolitics").value = p.politics || "";
      document.getElementById("editProfBirthDate").value = p.birthDate || "";
      document.getElementById("editProfWebsite").value = p.website || "";
      document.getElementById("editProfCity").value = p.city || "";
      document.getElementById("editProfInterests").value = p.interests || "";
      document.getElementById("editProfAbout").value = p.about || "";
      document.getElementById("editFavFilmTitle").value = p.favFilmTitle || "";
      document.getElementById("editFavFilmImg").value = p.favFilmImg || "";
      document.getElementById("editFavShowTitle").value = p.favShowTitle || "";
      document.getElementById("editFavShowImg").value = p.favShowImg || "";
      document.getElementById("editFavBookTitle").value = p.favBookTitle || "";
      document.getElementById("editFavBookImg").value = p.favBookImg || "";
      document.getElementById("editFavGameTitle").value = p.favGameTitle || "";
      document.getElementById("editFavGameImg").value = p.favGameImg || "";

      var ce = document.getElementById("customFieldsEditor");
      ce.innerHTML = "";
      if (p.customFields) {
        for (var k = 0; k < p.customFields.length; k++) {
          addCustomProfileFieldRow(p.customFields[k].label, p.customFields[k].value);
        }
      }
    }
  }

  document.getElementById("profileWallTitle").textContent = (p.displayName || p.username || "User") + "'s Wall (Stena)";
  renderProfileWall(uid);
}

function addCustomProfileFieldRow(labelVal, valueVal) {
  var box = document.getElementById("customFieldsEditor");
  if (!box) return;
  var row = document.createElement("div");
  row.className = "form-row custom-field-row";
  row.innerHTML =
    "<input type='text' class='cf-label' placeholder='Option Name' value='" + esc(labelVal || "") + "'>" +
    "<input type='text' class='cf-value' placeholder='Value' value='" + esc(valueVal || "") + "'>" +
    "<button type='button' class='btn-danger' onclick='this.parentNode.parentNode.removeChild(this.parentNode)'>x</button>";
  box.appendChild(row);
}

function saveMyProfile() {
  if (!state.user) return;
  var fEl = document.getElementById("editProfAvatarFile");

  function commitProfile(avatarUrl) {
    var rows = document.querySelectorAll("#customFieldsEditor .custom-field-row");
    var customArr = [];
    for (var i = 0; i < rows.length; i++) {
      var l = rows[i].querySelector(".cf-label").value.replace(/^\s+|\s+$/g, "");
      var v = rows[i].querySelector(".cf-value").value.replace(/^\s+|\s+$/g, "");
      if (l && v) customArr.push({ label: l, value: v });
    }

    var cur = state.profile || {};
    var updated = {
      uid: state.user.uid,
      username: state.user.username,
      email: state.user.email,
      role: getUserRole(state.user.uid),
      regDate: cur.regDate || formatTime(new Date().getTime()).split(" ")[0],
      createdAt: cur.createdAt || new Date().getTime(),
      status: document.getElementById("editProfStatus").value,
      displayName: document.getElementById("editProfDisplayName").value || state.user.username,
      avatar: avatarUrl || safeUrl(document.getElementById("editProfAvatarUrl").value) || DEFAULT_AVATAR_SVG,
      pronouns: document.getElementById("editProfPronouns").value,
      relationship: document.getElementById("editProfRelationship").value,
      hometown: document.getElementById("editProfHometown").value,
      politics: document.getElementById("editProfPolitics").value,
      birthDate: document.getElementById("editProfBirthDate").value,
      website: document.getElementById("editProfWebsite").value,
      city: document.getElementById("editProfCity").value,
      interests: document.getElementById("editProfInterests").value,
      about: document.getElementById("editProfAbout").value,
      favFilmTitle: document.getElementById("editFavFilmTitle").value,
      favFilmImg: safeUrl(document.getElementById("editFavFilmImg").value),
      favShowTitle: document.getElementById("editFavShowTitle").value,
      favShowImg: safeUrl(document.getElementById("editFavShowImg").value),
      favBookTitle: document.getElementById("editFavBookTitle").value,
      favBookImg: safeUrl(document.getElementById("editFavBookImg").value),
      favGameTitle: document.getElementById("editFavGameTitle").value,
      favGameImg: safeUrl(document.getElementById("editFavGameImg").value),
      customFields: customArr
    };

    dbWrite("PUT", "users/" + state.user.uid, updated, function(err) {
      if (!err) {
        state.profile = updated;
        state.users[state.user.uid] = updated;
        updateAuthUi();
        renderPublicProfile();
        showStatus("Profile saved!", false);
      } else showStatus(err, true);
    });
  }

  if (fEl && fEl.files && fEl.files[0]) {
    uploadImageToImgbb(fEl, function(err, url) {
      if (!err && url) { fEl.value = ""; commitProfile(url); }
      else showStatus(err || "Avatar upload failed", true);
    });
  } else {
    commitProfile("");
  }
}

function toggleSubscribe(targetUid) {
  if (!state.user || !targetUid || targetUid === state.user.uid) return;
  var exists = Boolean(state.subscriptions[state.user.uid] && state.subscriptions[state.user.uid][targetUid]);
  dbWrite(exists ? "DELETE" : "PUT", "subscriptions/" + state.user.uid + "/" + targetUid, exists ? null : true, function() {
    if (!exists) pushNotification(targetUid, getDisplayUsername() + " subscribed to you!", "profile", state.user.uid);
    if (typeof fetchAllData === "function") fetchAllData();
  });
}

function toggleBlockUser(targetUid) {
  if (!state.user || !targetUid || targetUid === state.user.uid) return;
  var exists = isUserBlockedByMe(targetUid);
  dbWrite(exists ? "DELETE" : "PUT", "blocks/" + state.user.uid + "/" + targetUid, exists ? null : true, function() {
    if (typeof fetchAllData === "function") fetchAllData();
  });
}

/* ==========================================================================
   WALL ("STENA") & REPOSTS
   ========================================================================== */
function setWallFeedFilter(mode) {
  state.wallFeedFilter = mode;
  document.getElementById("wallFilterAllBtn").className = (mode === "all") ? "btn-active" : "";
  document.getElementById("wallFilterSubBtn").className = (mode === "subs") ? "btn-active" : "";
  renderGlobalWall();
}

function createWallEntry(targetUid, textId, fileId, videoId, stickerTarget) {
  if (!state.user) { showStatus("Login required.", true); return; }
  if (isMeBlockedByUser(targetUid)) { showStatus("You are blocked from posting on this wall.", true); return; }

  var txt = (document.getElementById(textId).value || "").replace(/^\s+|\s+$/g, "");
  var vid = safeUrl(document.getElementById(videoId).value);
  var st = safeUrl(document.getElementById(stickerTarget + "Sticker") ? document.getElementById(stickerTarget + "Sticker").value : "");
  var fEl = document.getElementById(fileId);

  function saveWall(imgUrl) {
    if (!txt && !imgUrl && !vid && !st) { showStatus("Wall post cannot be empty.", true); return; }
    var pid = generateId("wp");
    var postObj = {
      id: pid,
      targetUid: targetUid,
      authorUid: state.user.uid,
      authorName: getDisplayUsername(),
      text: txt,
      imageUrl: imgUrl || "",
      videoUrl: vid || "",
      stickerUrl: st || "",
      createdAt: new Date().getTime()
    };
    dbWrite("PUT", "walls/" + targetUid + "/posts/" + pid, postObj, function(err) {
      if (!err) {
        document.getElementById(textId).value = "";
        document.getElementById(videoId).value = "";
        if (fEl) fEl.value = "";
        clearAttachedSticker(stickerTarget);
        if (targetUid !== state.user.uid) {
          pushNotification(targetUid, getDisplayUsername() + " wrote on your wall!", "profile", targetUid);
        }
        if (typeof fetchAllData === "function") fetchAllData();
        showStatus("Posted to wall!", false);
      } else showStatus(err, true);
    });
  }

  if (fEl && fEl.files && fEl.files[0]) {
    uploadImageToImgbb(fEl, function(err, url) {
      if (!err && url) saveWall(url);
      else showStatus(err || "Image upload failed", true);
    });
  } else {
    saveWall("");
  }
}

function postToUserWall() {
  var target = state.viewedProfileUid || (state.user && state.user.uid);
  if (!target) return;
  createWallEntry(target, "profileWallText", "profileWallFile", "profileWallVideo", "profileWall");
}

function postToGlobalWall() {
  if (!state.user) { showStatus("Login required.", true); return; }
  createWallEntry(state.user.uid, "globalWallText", "globalWallFile", "globalWallVideo", "globalWall");
}

function repostToMyWall(sourceType, targetUid, pid) {
  if (!state.user) { showStatus("Login to repost.", true); return; }
  var src = null;
  if (sourceType === "thread") {
    var th = state.threads[pid];
    if (th) src = { author: th.author, text: (th.subject ? th.subject + ": " : "") + th.text, imageUrl: th.imageUrl, videoUrl: th.videoUrl, stickerUrl: th.stickerUrl };
  } else {
    var wp = state.walls[targetUid] && state.walls[targetUid].posts && state.walls[targetUid].posts[pid];
    if (wp) src = { author: wp.authorName, text: wp.text, imageUrl: wp.imageUrl, videoUrl: wp.videoUrl, stickerUrl: wp.stickerUrl };
  }
  if (!src) return;

  var newPid = generateId("rp");
  var repObj = {
    id: newPid,
    targetUid: state.user.uid,
    authorUid: state.user.uid,
    authorName: getDisplayUsername(),
    text: "Reposted from " + (src.author || "User"),
    repost: src,
    createdAt: new Date().getTime()
  };
  dbWrite("PUT", "walls/" + state.user.uid + "/posts/" + newPid, repObj, function(err) {
    if (!err) {
      if (typeof fetchAllData === "function") fetchAllData();
      showStatus("Reposted to your wall!", false);
    }
  });
}

function renderWallPostCard(p) {
  var likes = countMapKeys(p.likes);
  var liked = Boolean(state.user && p.likes && p.likes[state.user.uid]);
  var canDel = Boolean(state.user && (p.authorUid === state.user.uid || p.targetUid === state.user.uid || canModerateTargetUser(p.authorUid)));
  var ownerUser = state.users[p.targetUid];
  var targetLabel = (p.targetUid && p.targetUid !== p.authorUid && ownerUser) ? (" &rarr; " + esc(ownerUser.displayName || ownerUser.username)) : "";

  var h = "<div class='wall-post-card'>" +
            "<div class='post-header'>" +
              "<span><span class='post-author' onclick=\"openUserProfile('" + esc(p.authorUid) + "')\">" + esc(p.authorName || "User") + "</span>" + renderRoleBadge(p.authorUid) + targetLabel + " <span class='muted'>" + formatTime(p.createdAt) + "</span></span>" +
              "<span>" +
                "<button type='button' onclick=\"toggleWallPostLike('" + esc(p.targetUid) + "','" + esc(p.id) + "')\">" + (liked ? "Liked" : "Like") + " (" + likes + ")</button> " +
                "<button type='button' onclick=\"repostToMyWall('wall','" + esc(p.targetUid) + "','" + esc(p.id) + "')\">Repost</button> " +
                (canDel ? "<button type='button' class='btn-danger' onclick=\"deleteWallPost('" + esc(p.targetUid) + "','" + esc(p.id) + "')\">Delete</button>" : "") +
              "</span>" +
            "</div>" +
            "<div class='post-body'>" + esc(p.text) + "</div>" +
            renderMediaHtml(p.imageUrl, p.videoUrl, p.stickerUrl);

  if (p.repost) {
    h += "<div class='repost-embed'>" +
           "<div class='mini-title'>Reposted from " + esc(p.repost.author || "User") + ":</div>" +
           "<div class='post-body'>" + esc(p.repost.text || "") + "</div>" +
           renderMediaHtml(p.repost.imageUrl, p.repost.videoUrl, p.repost.stickerUrl) +
         "</div>";
  }
  h += "</div>";
  return h;
}

function renderProfileWall(targetUid) {
  var box = document.getElementById("profileWallPosts");
  if (!box) return;
  var postsMap = (state.walls[targetUid] && state.walls[targetUid].posts) || {};
  var list = [];
  for (var pid in postsMap) {
    if (postsMap.hasOwnProperty(pid) && postsMap[pid] && !isUserBlockedByMe(postsMap[pid].authorUid)) list.push(postsMap[pid]);
  }
  list.sort(function(a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
  var h = "";
  for (var i = 0; i < list.length; i++) h += renderWallPostCard(list[i]);
  box.innerHTML = h || "<div class='muted' style='margin-top:6px;'>No wall posts yet.</div>";
}

function renderGlobalWall() {
  var box = document.getElementById("wallPostsContainer");
  if (!box) return;
  var list = [];
  var mySubs = (state.user && state.subscriptions[state.user.uid]) || {};
  for (var tUid in state.walls) {
    if (!state.walls.hasOwnProperty(tUid) || !state.walls[tUid] || !state.walls[tUid].posts) continue;
    var pMap = state.walls[tUid].posts;
    for (var pid in pMap) {
      if (pMap.hasOwnProperty(pid) && pMap[pid]) {
        var p = pMap[pid];
        if (isUserBlockedByMe(p.authorUid)) continue;
        if (state.wallFeedFilter === "subs" && state.user && p.authorUid !== state.user.uid && !mySubs[p.authorUid]) continue;
        list.push(p);
      }
    }
  }
  list.sort(function(a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
  var h = "";
  for (var i = 0; i < list.length; i++) h += renderWallPostCard(list[i]);
  box.innerHTML = h || "<div class='box-panel'><div class='box-body muted'>No wall posts found.</div></div>";
}

function toggleWallPostLike(targetUid, pid) {
  if (!state.user) { showStatus("Login to like.", true); return; }
  var p = state.walls[targetUid] && state.walls[targetUid].posts && state.walls[targetUid].posts[pid];
  if (!p) return;
  var exists = Boolean(p.likes && p.likes[state.user.uid]);
  dbWrite(exists ? "DELETE" : "PUT", "walls/" + targetUid + "/posts/" + pid + "/likes/" + state.user.uid, exists ? null : true, function() {
    if (typeof fetchAllData === "function") fetchAllData();
  });
}

function deleteWallPost(targetUid, pid) {
  dbWrite("DELETE", "walls/" + targetUid + "/posts/" + pid, null, function() {
    if (typeof fetchAllData === "function") fetchAllData();
  });
}

/* ==========================================================================
   MEMBERS DIRECTORY & PREFERENCE SEARCH
   ========================================================================== */
function renderMembersList() {
  var box = document.getElementById("membersDirectoryGrid");
  if (!box) return;
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
    var nameStr = ((u.displayName || "") + " " + (u.username || "")).toLowerCase();
    var cityStr = ((u.city || "") + " " + (u.hometown || "")).toLowerCase();
    var intStr = ((u.interests || "") + " " + (u.favFilmTitle || "") + " " + (u.favShowTitle || "") + " " + (u.favBookTitle || "") + " " + (u.favGameTitle || "")).toLowerCase();

    if (fName && nameStr.indexOf(fName) === -1) continue;
    if (fPron && String(u.pronouns || "").toLowerCase().indexOf(fPron) === -1) continue;
    if (fCity && cityStr.indexOf(fCity) === -1) continue;
    if (fRel && String(u.relationship || "").toLowerCase().indexOf(fRel) === -1) continue;
    if (fPol && String(u.politics || "").toLowerCase().indexOf(fPol) === -1) continue;
    if (fInt && intStr.indexOf(fInt) === -1) continue;

    var av = isValidImageSrc(u.avatar) ? u.avatar : DEFAULT_AVATAR_SVG;
    h += "<div class='member-card'>" +
           "<div style='display:flex;gap:8px;align-items:center;'>" +
             "<img src='" + esc(av) + "' style='width:48px;height:48px;object-fit:cover;border:1px solid #800000;'>" +
             "<div>" +
               "<a href='javascript:void(0)' onclick=\"openUserProfile('" + esc(uid) + "')\"><b>" + esc(u.displayName || u.username) + "</b></a>" + renderRoleBadge(uid) + "<br>" +
               "<span class='muted'>Pronouns: " + esc(u.pronouns || "—") + " • City: " + esc(u.city || u.hometown || "—") + "</span>" +
             "</div>" +
           "</div>" +
           "<div class='muted' style='margin-top:4px;'>Interests: " + esc(u.interests || "—") + "</div>" +
         "</div>";
  }
  box.innerHTML = h || "<div class='muted'>No members match those filters.</div>";
}

/* ==========================================================================
   GROUPS, DIRECT MESSAGES & PUBLIC STICKERS ARCHIVE
   ========================================================================== */
function createGroup() {
  if (!state.user) { showStatus("Login to create a group.", true); return; }
  var name = (document.getElementById("groupNameInput").value || "").replace(/^\s+|\s+$/g, "");
  var desc = (document.getElementById("groupDescInput").value || "").replace(/^\s+|\s+$/g, "");
  if (!name) { showStatus("Enter a group name.", true); return; }
  var gid = generateId("grp");
  var members = {};
  members[state.user.uid] = true;
  var obj = {
    id: gid,
    name: name,
    desc: desc,
    ownerUid: state.user.uid,
    members: members,
    createdAt: new Date().getTime()
  };
  dbWrite("PUT", "groups/" + gid, obj, function(err) {
    if (!err) {
      document.getElementById("groupNameInput").value = "";
      document.getElementById("groupDescInput").value = "";
      state.activeGroupId = gid;
      if (typeof fetchAllData === "function") fetchAllData();
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
           "<b>" + esc(g.name) + "</b> (" + countMapKeys(g.members) + " members)<br>" +
           "<span class='muted'>" + esc(g.desc || "") + "</span><br>" +
           "<button type='button' style='margin-top:4px;' onclick=\"openGroup('" + esc(gid) + "')\">Open Chat</button>" +
         "</div>";
  }
  box.innerHTML = h || "<span class='muted'>No groups yet.</span>";
}

function openGroup(gid) {
  state.activeGroupId = gid;
  renderActiveGroup();
}

function toggleJoinActiveGroup() {
  if (!state.user || !state.activeGroupId) return;
  var g = state.groups[state.activeGroupId];
  if (!g) return;
  var isMem = Boolean(g.members && g.members[state.user.uid]);
  dbWrite(isMem ? "DELETE" : "PUT", "groups/" + state.activeGroupId + "/members/" + state.user.uid, isMem ? null : true, function() {
    if (typeof fetchAllData === "function") fetchAllData();
  });
}

function renderActiveGroup() {
  var wrap = document.getElementById("activeGroupView");
  if (!wrap) return;
  var g = state.activeGroupId && state.groups[state.activeGroupId];
  if (!g) { wrap.style.display = "none"; return; }
  wrap.style.display = "block";
  document.getElementById("activeGroupTitle").textContent = "Group: " + g.name;
  var isMem = Boolean(state.user && g.members && g.members[state.user.uid]);
  document.getElementById("groupJoinLeaveBtn").textContent = isMem ? "Leave Group" : "Join Group";

  var feed = document.getElementById("groupMessagesList");
  var list = [];
  if (g.messages) {
    for (var mid in g.messages) {
      if (g.messages.hasOwnProperty(mid) && g.messages[mid] && !isUserBlockedByMe(g.messages[mid].authorUid)) list.push(g.messages[mid]);
    }
  }
  list.sort(function(a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
  var h = "";
  for (var i = 0; i < list.length; i++) {
    var m = list[i];
    var canDel = Boolean(state.user && (m.authorUid === state.user.uid || g.ownerUid === state.user.uid || isStaffUser()));
    h += "<div class='chat-msg'>" +
           "<b>" + esc(m.authorName || "User") + "</b> <span class='muted'>" + formatTime(m.createdAt) + "</span> " +
           (canDel ? "<button type='button' class='btn-danger' onclick=\"deleteGroupMessage('" + esc(g.id) + "','" + esc(m.id) + "')\">x</button>" : "") +
           "<div>" + esc(m.text || "") + "</div>" +
           renderMediaHtml(m.imageUrl, m.videoUrl, m.stickerUrl) +
         "</div>";
  }
  feed.innerHTML = h || "<span class='muted'>No messages yet.</span>";
  feed.scrollTop = feed.scrollHeight;
}

function sendGroupMessage() {
  if (!state.user || !state.activeGroupId) { showStatus("Login and select a group.", true); return; }
  var txt = (document.getElementById("groupMsgInput").value || "").replace(/^\s+|\s+$/g, "");
  var vid = safeUrl(document.getElementById("groupVideoUrl").value);
  var st = safeUrl(document.getElementById("groupStickerUrl").value);
  var fEl = document.getElementById("groupImgFile");

  function saveMsg(imgUrl) {
    if (!txt && !imgUrl && !vid && !st) return;
    var mid = generateId("gm");
    var msgObj = {
      id: mid,
      authorUid: state.user.uid,
      authorName: getDisplayUsername(),
      text: txt,
      imageUrl: imgUrl || "",
      videoUrl: vid || "",
      stickerUrl: st || "",
      createdAt: new Date().getTime()
    };
    dbWrite("PUT", "groups/" + state.activeGroupId + "/messages/" + mid, msgObj, function(err) {
      if (!err) {
        document.getElementById("groupMsgInput").value = "";
        document.getElementById("groupVideoUrl").value = "";
        if (fEl) fEl.value = "";
        clearAttachedSticker("group");
        if (typeof fetchAllData === "function") fetchAllData();
      }
    });
  }

  if (fEl && fEl.files && fEl.files[0]) {
    uploadImageToImgbb(fEl, function(err, url) { if (!err && url) saveMsg(url); });
  } else saveMsg("");
}

function deleteGroupMessage(gid, mid) {
  dbWrite("DELETE", "groups/" + gid + "/messages/" + mid, null, function() {
    if (typeof fetchAllData === "function") fetchAllData();
  });
}

function getDmConvKey(uid1, uid2) {
  return uid1 < uid2 ? (uid1 + "__" + uid2) : (uid2 + "__" + uid1);
}

function startDmWithUsername() {
  var targetName = (document.getElementById("dmNewTargetInput").value || "").toLowerCase().replace(/[^a-z0-9._-]/g, "");
  if (!targetName) return;
  for (var uid in state.users) {
    if (state.users.hasOwnProperty(uid) && state.users[uid] && String(state.users[uid].username || "").toLowerCase() === targetName) {
      document.getElementById("dmNewTargetInput").value = "";
      openDmWithUser(uid);
      return;
    }
  }
  showStatus("User not found.", true);
}

function openDmWithUser(uid) {
  if (!state.user) { showStatus("Login to use DMs.", true); return; }
  state.activeDmUid = uid;
  if (typeof switchView === "function") switchView("dms");
}

function renderDmList() {
  var listBox = document.getElementById("dmThreadsList");
  var msgBox = document.getElementById("dmMessagesList");
  var hdr = document.getElementById("dmActiveHeader");
  if (!listBox || !msgBox) return;

  if (!state.user) {
    listBox.innerHTML = "<div class='muted' style='padding:6px;'>Login to view DMs.</div>";
    return;
  }

  var partners = {};
  if (state.activeDmUid) partners[state.activeDmUid] = true;
  for (var cKey in state.dms) {
    if (state.dms.hasOwnProperty(cKey) && cKey.indexOf(state.user.uid) !== -1) {
      var parts = cKey.split("__");
      var other = parts[0] === state.user.uid ? parts[1] : parts[0];
      if (other) partners[other] = true;
    }
  }

  var lh = "";
  for (var pUid in partners) {
    if (!partners.hasOwnProperty(pUid)) continue;
    var u = state.users[pUid];
    var label = u ? (u.displayName || u.username) : pUid;
    var act = (pUid === state.activeDmUid) ? " active-dm" : "";
    lh += "<div class='dm-thread-item" + act + "' onclick=\"openDmWithUser('" + esc(pUid) + "')\">" + esc(label) + "</div>";
  }
  listBox.innerHTML = lh || "<div class='muted' style='padding:6px;'>No conversations yet.</div>";

  if (!state.activeDmUid) {
    if (hdr) hdr.textContent = "Select a user";
    msgBox.innerHTML = "";
    return;
  }

  var targetUser = state.users[state.activeDmUid];
  if (hdr) hdr.textContent = "Chat with " + (targetUser ? (targetUser.displayName || targetUser.username) : state.activeDmUid);
  var key = getDmConvKey(state.user.uid, state.activeDmUid);
  var msgsMap = (state.dms[key] && state.dms[key].messages) || {};
  var list = [];
  for (var mid in msgsMap) {
    if (msgsMap.hasOwnProperty(mid) && msgsMap[mid]) list.push(msgsMap[mid]);
  }
  list.sort(function(a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });

  var mh = "";
  for (var i = 0; i < list.length; i++) {
    var m = list[i];
    var canDel = Boolean(m.fromUid === state.user.uid || isSuperiorAdmin());
    mh += "<div class='chat-msg'>" +
            "<b>" + esc(m.fromName || "User") + "</b> <span class='muted'>" + formatTime(m.createdAt) + "</span> " +
            (canDel ? "<button type='button' class='btn-danger' onclick=\"deleteDmMessage('" + esc(key) + "','" + esc(m.id) + "')\">x</button>" : "") +
            "<div>" + esc(m.text || "") + "</div>" +
            renderMediaHtml(m.imageUrl, m.videoUrl, m.stickerUrl) +
          "</div>";
  }
  msgBox.innerHTML = mh || "<span class='muted'>Say hello!</span>";
  msgBox.scrollTop = msgBox.scrollHeight;
}

function sendDmMessage() {
  if (!state.user || !state.activeDmUid) { showStatus("Select a user first.", true); return; }
  if (isMeBlockedByUser(state.activeDmUid)) { showStatus("This user has blocked you.", true); return; }

  var txt = (document.getElementById("dmMsgInput").value || "").replace(/^\s+|\s+$/g, "");
  var vid = safeUrl(document.getElementById("dmVideoUrl").value);
  var st = safeUrl(document.getElementById("dmStickerUrl").value);
  var fEl = document.getElementById("dmImgFile");

  function saveDm(imgUrl) {
    if (!txt && !imgUrl && !vid && !st) return;
    var key = getDmConvKey(state.user.uid, state.activeDmUid);
    var mid = generateId("dm");
    var obj = {
      id: mid,
      fromUid: state.user.uid,
      fromName: getDisplayUsername(),
      text: txt,
      imageUrl: imgUrl || "",
      videoUrl: vid || "",
      stickerUrl: st || "",
      createdAt: new Date().getTime()
    };
    dbWrite("PUT", "dms/" + key + "/messages/" + mid, obj, function(err) {
      if (!err) {
        document.getElementById("dmMsgInput").value = "";
        document.getElementById("dmVideoUrl").value = "";
        if (fEl) fEl.value = "";
        clearAttachedSticker("dm");
        pushNotification(state.activeDmUid, "New DM from " + getDisplayUsername(), "dms", state.user.uid);
        if (typeof fetchAllData === "function") fetchAllData();
      }
    });
  }

  if (fEl && fEl.files && fEl.files[0]) {
    uploadImageToImgbb(fEl, function(err, url) { if (!err && url) saveDm(url); });
  } else saveDm("");
}

function deleteDmMessage(convKey, mid) {
  dbWrite("DELETE", "dms/" + convKey + "/messages/" + mid, null, function() {
    if (typeof fetchAllData === "function") fetchAllData();
  });
}

/* ==========================================================================
   PUBLIC STICKERS ARCHIVE & STICKER PICKER
   ========================================================================== */
function uploadPublicSticker() {
  if (!state.user) { showStatus("Login to upload stickers.", true); return; }
  var name = (document.getElementById("stickerNameInput").value || "").replace(/^\s+|\s+$/g, "") || "Sticker";
  var fEl = document.getElementById("stickerFileInput");
  if (!fEl || !fEl.files || !fEl.files[0]) { showStatus("Choose a sticker image/GIF.", true); return; }

  uploadImageToImgbb(fEl, function(err, url) {
    if (err || !url) { showStatus(err || "Sticker upload failed", true); return; }
    var stId = generateId("st");
    var obj = {
      id: stId,
      name: name,
      url: url,
      uploadedByUid: state.user.uid,
      uploadedByName: getDisplayUsername(),
      createdAt: new Date().getTime()
    };
    dbWrite("PUT", "stickers/" + stId, obj, function(wErr) {
      if (!wErr) {
        document.getElementById("stickerNameInput").value = "";
        fEl.value = "";
        if (typeof fetchAllData === "function") fetchAllData();
        showStatus("Sticker added to public archive!", false);
      }
    });
  }, { isSticker: true });
}

function renderStickersArchive() {
  var box = document.getElementById("stickersArchiveGrid");
  if (!box) return;
  var h = "";
  for (var stId in state.stickers) {
    if (!state.stickers.hasOwnProperty(stId) || !state.stickers[stId]) continue;
    var s = state.stickers[stId];
    if (!isValidImageSrc(s.url)) continue;
    h += "<div class='sticker-card' onclick=\"openZoomModal('" + esc(s.url) + "','" + esc(s.name) + "','Uploaded by " + esc(s.uploadedByName || "User") + "')\">" +
           "<img src='" + esc(s.url) + "' alt='sticker'>" +
           "<span>" + esc(s.name) + "</span>" +
         "</div>";
  }
  box.innerHTML = h || "<span class='muted'>No stickers in archive yet.</span>";
}

function openStickerPicker(target) {
  state.stickerPickerTarget = target;
  var modal = document.getElementById("stickerPickerModal");
  var grid = document.getElementById("stickerPickerGrid");
  if (!modal || !grid) return;
  var h = "";
  for (var stId in state.stickers) {
    if (!state.stickers.hasOwnProperty(stId) || !state.stickers[stId]) continue;
    var s = state.stickers[stId];
    if (!isValidImageSrc(s.url)) continue;
    h += "<div class='sticker-card' onclick=\"selectStickerForTarget('" + esc(s.url) + "')\">" +
           "<img src='" + esc(s.url) + "' alt='sticker'>" +
           "<span>" + esc(s.name) + "</span>" +
         "</div>";
  }
  grid.innerHTML = h || "<span class='muted'>No stickers uploaded yet. Visit [Stickers] tab to add one!</span>";
  modal.style.display = "block";
}

function closeStickerPicker() {
  var modal = document.getElementById("stickerPickerModal");
  if (modal) modal.style.display = "none";
}

function selectStickerForTarget(url) {
  var t = state.stickerPickerTarget || "";
  if (t.indexOf("reply:") === 0) {
    var tid = t.split(":")[1];
    var inp = document.getElementById("replySticker_" + tid);
    var prev = document.getElementById("replyStickerPreview_" + tid);
    if (inp) inp.value = url;
    if (prev) prev.innerHTML = "<img src='" + esc(url) + "'> <button type='button' onclick=\"clearAttachedSticker('" + esc(t) + "')\">x</button>";
  } else {
    var map = {
      thread: ["threadStickerUrl", "threadStickerPreview"],
      profileWall: ["profileWallSticker", "profileWallStickerPreview"],
      globalWall: ["globalWallSticker", "globalWallStickerPreview"],
      group: ["groupStickerUrl", "groupStickerPreview"],
      dm: ["dmStickerUrl", "dmStickerPreview"]
    };
    if (map[t]) {
      var iEl = document.getElementById(map[t][0]);
      var pEl = document.getElementById(map[t][1]);
      if (iEl) iEl.value = url;
      if (pEl) pEl.innerHTML = "<img src='" + esc(url) + "'> <button type='button' onclick=\"clearAttachedSticker('" + esc(t) + "')\">x</button>";
    }
  }
  closeStickerPicker();
}

function clearAttachedSticker(t) {
  if (!t) return;
  if (t.indexOf("reply:") === 0) {
    var tid = t.split(":")[1];
    var inp = document.getElementById("replySticker_" + tid);
    var prev = document.getElementById("replyStickerPreview_" + tid);
    if (inp) inp.value = "";
    if (prev) prev.innerHTML = "";
    return;
  }
  var map = {
    thread: ["threadStickerUrl", "threadStickerPreview"],
    profileWall: ["profileWallSticker", "profileWallStickerPreview"],
    globalWall: ["globalWallSticker", "globalWallStickerPreview"],
    group: ["groupStickerUrl", "groupStickerPreview"],
    dm: ["dmStickerUrl", "dmStickerPreview"]
  };
  if (map[t]) {
    var iEl = document.getElementById(map[t][0]);
    var pEl = document.getElementById(map[t][1]);
    if (iEl) iEl.value = "";
    if (pEl) pEl.innerHTML = "";
  }
}

/* ==========================================================================
   NOTIFICATIONS
   ========================================================================== */
function pushNotification(targetUid, text, linkView, linkId) {
  if (!targetUid || (state.user && targetUid === state.user.uid)) return;
  var nid = generateId("nt");
  dbWrite("PUT", "notifications/" + targetUid + "/" + nid, {
    id: nid,
    text: text,
    linkView: linkView || "boards",
    linkId: linkId || "",
    read: false,
    createdAt: new Date().getTime()
  }, null);
}

function updateNotifBadge() {
  var badge = document.getElementById("notifBadge");
  if (!badge) return;
  if (!state.user || !state.notifications[state.user.uid]) {
    badge.style.display = "none";
    return;
  }
  var unread = 0;
  var map = state.notifications[state.user.uid];
  for (var nid in map) {
    if (map.hasOwnProperty(nid) && map[nid] && !map[nid].read) unread++;
  }
  badge.style.display = unread > 0 ? "inline-block" : "none";
  badge.textContent = unread;
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
  for (var nid in map) {
    if (map.hasOwnProperty(nid) && map[nid]) list.push(map[nid]);
  }
  list.sort(function(a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
  var h = "";
  for (var i = 0; i < list.length; i++) {
    var n = list[i];
    h += "<div class='comment-item' style='" + (n.read ? "opacity:0.7;" : "border-color:#800000;font-weight:bold;") + "'>" +
           esc(n.text) + " <span class='muted'>(" + formatTime(n.createdAt) + ")</span>" +
         "</div>";
  }
  box.innerHTML = h || "<span class='muted'>No notifications.</span>";
}

function markAllNotificationsRead() {
  if (!state.user || !state.notifications[state.user.uid]) return;
  var map = state.notifications[state.user.uid];
  var patch = {};
  for (var nid in map) {
    if (map.hasOwnProperty(nid) && map[nid] && !map[nid].read) {
      patch[nid + "/read"] = true;
    }
  }
  dbWrite("PATCH", "notifications/" + state.user.uid, patch, function() {
    if (typeof fetchAllData === "function") fetchAllData();
  });
}
