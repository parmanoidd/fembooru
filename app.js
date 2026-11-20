/* ==========================================================================
   DATA REFRESH, VIEW RENDERING & APPLICATION BOOTSTRAP
   ========================================================================== */
function refreshAllData(cb) {
  dbGet("boards", function(eB, cB) {
    var m = [], seen = {};
    for (var i = 0; i < DEFAULT_BOARDS.length; i++) {
      m.push(DEFAULT_BOARDS[i]);
      seen[DEFAULT_BOARDS[i].slug] = true;
    }
    if (cB) {
      for (var s in cB) {
        if (cB.hasOwnProperty(s) && cB[s] && !seen[s]) {
          m.push({ slug: s, title: cB[s].title || s, custom: true });
          seen[s] = true;
        }
      }
    }
    state.boards = m;

    dbGet("threads", function(e1, d1) { state.threads = d1 || {};
      dbGet("comments", function(e2, d2) { state.comments = d2 || {};
        dbGet("polls", function(e3, d3) { state.polls = d3 || {};
          dbGet("users", function(e4, d4) { state.users = d4 || {};
            dbGet("walls", function(e5, d5) { state.walls = d5 || {};
              dbGet("wallComments", function(e6, d6) { state.wallComments = d6 || {};
                dbGet("subscriptions", function(e7, d7) { state.subscriptions = d7 || {};
                  dbGet("blocks", function(e8, d8) { state.blocks = d8 || {};
                    dbGet("groups", function(e9, d9) { state.groups = d9 || {};
                      dbGet("groupMessages", function(e10, d10) { state.groupMessages = d10 || {};
                        dbGet("dms", function(e11, d11) { state.dms = d11 || {};
                          dbGet("stickers", function(e12, d12) { state.stickers = d12 || {};
                            dbGet("site/logo", function(e13, d13) { state.siteLogo = d13 || "";
                              dbGet("effects/snow", function(e14, d14) { state.snowEffect = d14 || null;
                                dbGet("effects/tabLogo", function(e15, d15) { state.tabLogoEffect = d15 || null;
                                  syncSnowState();
                                  syncTabLogoState();
                                  rebuildMusicPlaylist();
                                  var h = JSON.stringify({
                                    b: state.boards, t: state.threads, c: state.comments, p: state.polls,
                                    u: state.users, w: state.walls, wc: state.wallComments, g: state.groups,
                                    gm: state.groupMessages, dms: state.dms, st: state.stickers, l: state.siteLogo
                                  });
                                  var ch = (h !== lastDataHash);
                                  lastDataHash = h;
                                  if (cb) cb(ch);
                                });
                              });
                            });
                          });
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
}

function startAutoRefresh() {
  if (autoRefreshTimer) clearInterval(autoRefreshTimer);
  autoRefreshTimer = setInterval(function() {
    refreshAllData(function(ch) {
      if (ch) updateDynamicFeed();
    });
  }, CONFIG.autoRefreshMs);
}

function switchView(v, p) {
  showStatus("", false);
  state.view = v;
  if (v === "board" && p) { state.currentBoard = p; state.currentThreadId = null; }
  else if (v === "thread" && p) state.currentThreadId = p;
  else if (v === "public_profile" && p) state.currentProfileUid = p;
  renderAll();
}

function openPublicProfile(uid) {
  if (uid) switchView("public_profile", uid);
}

/* ==========================================================================
   CHROME (TOP BAR & LEFT SIDEBAR)
   ========================================================================== */
function renderChrome() {
  var tCnt = 0;
  for (var t in state.threads) if (state.threads.hasOwnProperty(t) && state.threads[t]) tCnt++;

  var leftNav =
    '<span class="nav-pill">[<a onclick="switchView(\'board\',state.currentBoard)">Boards</a>]</span>' +
    '<span class="nav-pill">[<a onclick="switchView(\'groups\')">Groups</a>]</span>' +
    '<span class="nav-pill">[<a onclick="switchView(\'dms\')">DMs</a>]</span>' +
    '<span class="nav-pill">[<a onclick="switchView(\'stickers\')">Stickers</a>]</span>' +
    '<span class="nav-pill">[<a onclick="switchView(\'members\')">Members</a>]</span>' +
    '<span class="nav-pill">[<a onclick="switchView(\'polls\')">Polls</a>]</span>' +
    '<span class="nav-pill">[<a onclick="togglePropMenu()">Props [Q]</a>]</span>' +
    '<span class="nav-pill">[<a onclick="openCursorChat()">Cursor Chat</a>]</span> ' +
    '<span class="muted">&bull; Threads: ' + tCnt + '</span>';

  var rightNav = state.user
    ? ('User: <strong>' + esc(state.profile.nickname || state.user.username) + '</strong>' +
       (state.user.isAdmin ? ' <span class="admin-badge">ADMIN</span>' : '') +
       ' <span class="nav-pill">[<a onclick="openPublicProfile(\'' + esc(state.user.uid) + '\')">My Wall</a>]</span>' +
       '<span class="nav-pill">[<a onclick="switchView(\'profile\')">Edit Profile</a>]</span>' +
       '<span class="nav-pill">[<a onclick="logoutUser()">Logout</a>]</span>')
    : '<span class="nav-pill">[<a onclick="switchView(\'auth\')">Login / Register</a>]</span>';

  document.getElementById("topInfoBar").innerHTML = '<div class="top-bar-left">' + leftNav + '</div><div class="top-bar-right">' + rightNav + '</div>';

  var logo =
    '<a class="logo-link" href="' + esc(CONFIG.mainLogoRedirectUrl) + '" title="Go to Main Page">' +
      (isValidImageSrc(state.siteLogo) ? '<img class="site-logo-img" src="' + esc(state.siteLogo) + '">' : '<div class="default-logo">&#9752; FEMBOORU</div>') +
    '</a>' +
    '<div class="muted">Ukraine &amp; Pridnestrovie &bull; Tap logo for Home</div>';

  if (state.user && state.user.isAdmin) {
    logo +=
      '<div class="side-sep" style="margin-top:8px; text-align:left;">' +
        '<strong style="font-size:11px;">Admin Logo:</strong>' +
        '<input type="file" id="sideAdminLogoFile" accept="image/*" class="input-compact" style="margin-top:4px;">' +
        '<button type="button" onclick="uploadAdminSiteLogo(\'sideAdminLogoFile\')" class="btn-full">Upload Logo</button>' +
        (isValidImageSrc(state.siteLogo) ? '<div style="margin-top:4px; text-align:center;"><a class="link-danger" onclick="removeAdminSiteLogo()">Reset Default</a></div>' : '') +
      '</div>';
  }
  document.getElementById("leftLogoBox").innerHTML = logo;

  var bH = "";
  for (var i = 0; i < state.boards.length; i++) {
    var b = state.boards[i];
    var a = (state.view === "board" || state.view === "thread") && state.currentBoard === b.slug;
    bH += '<li><a class="' + (a ? 'active-board' : '') + '" onclick="switchView(\'board\',\'' + esc(b.slug) + '\')">/' + esc(b.slug) + '/ &mdash; ' + esc(b.title) + '</a></li>';
  }
  document.getElementById("leftBoardsList").innerHTML = bH;

  var stC = 0;
  for (var s in state.stickers) if (state.stickers.hasOwnProperty(s) && state.stickers[s]) stC++;

  document.getElementById("leftAccountLinks").innerHTML =
    '<ul class="board-list">' +
      (state.user ? '<li><a onclick="openPublicProfile(\'' + esc(state.user.uid) + '\')">My Public Page &amp; Stena</a></li><li><a onclick="switchView(\'profile\')">Edit Profile &amp; Favorites</a></li>' : '') +
      '<li><a onclick="switchView(\'groups\')">Groups &amp; Chats</a></li>' +
      '<li><a onclick="switchView(\'dms\')">Direct Messages (DMs)</a></li>' +
      '<li><a onclick="switchView(\'stickers\')">Public Stickers (' + stC + ')</a></li>' +
      '<li><a onclick="switchView(\'members\')">Members &amp; Walls</a></li>' +
      '<li><a onclick="switchView(\'polls\')">Board Polls &amp; Admin</a></li>' +
      (state.user ? '<li><a onclick="logoutUser()">Logout</a></li>' : '<li><a onclick="switchView(\'auth\')">Login / Register</a></li>') +
    '</ul>';
}

/* ==========================================================================
   BOARD, THREAD & COMMENT VIEWS
   ========================================================================== */
function renderBoardView() {
  var bo = { slug: state.currentBoard, title: state.currentBoard };
  for (var i = 0; i < state.boards.length; i++) {
    if (state.boards[i].slug === state.currentBoard) { bo = state.boards[i]; break; }
  }
  var h = '<div class="board-banner">/' + esc(bo.slug) + '/ &mdash; ' + esc(bo.title) + '</div><div class="box-panel"><h3>Start a New Thread</h3>';
  if (!state.user) {
    h += '<div>Please <a onclick="switchView(\'auth\')">Log In or Register</a> to post.</div>';
  } else {
    h +=
      '<table class="form-table">' +
        '<tr><td class="form-label">Subject</td><td><input type="text" id="newThreadSubject" maxlength="100"></td></tr>' +
        '<tr><td class="form-label">Comment</td><td><textarea id="newThreadText"></textarea></td></tr>' +
        '<tr><td class="form-label">Sticker</td><td>' + renderStickerPickerWidget("thread_new") + '</td></tr>' +
        '<tr><td class="form-label">Image</td><td><input type="file" id="newThreadImage" accept="image/*"></td></tr>' +
        '<tr><td class="form-label">Video / Audio Link</td><td><input type="text" id="newThreadVideo" placeholder="https://..."></td></tr>' +
        '<tr><td class="form-label">Submit</td><td><button onclick="createThread()">Post Thread</button></td></tr>' +
      '</table>';
  }
  return h + '</div><div id="boardFeedArea">' + renderBoardThreadsHtml(bo.slug) + '</div>';
}

function renderBoardThreadsHtml(slug) {
  var list = [];
  for (var id in state.threads) {
    if (state.threads.hasOwnProperty(id) && state.threads[id] && state.threads[id].board === slug) list.push(state.threads[id]);
  }
  list.sort(function(a, b) { return (b.bumpedAt || b.createdAt || 0) - (a.bumpedAt || a.createdAt || 0); });
  if (!list.length) return '<div style="text-align:center; padding:20px;">No threads on /' + esc(slug) + '/ yet.</div>';
  var h = "";
  for (var i = 0; i < list.length; i++) h += renderThreadBlock(list[i], false);
  return h;
}

function renderThreadBlock(t, single) {
  if (isUserBlockedByMe(t.uid)) return '<div class="blocked-notice">Thread by blocked user hidden.</div>';
  var cMap = state.comments[t.id] || {}, cList = [];
  for (var cid in cMap) if (cMap.hasOwnProperty(cid) && cMap[cid]) cList.push(cMap[cid]);
  cList.sort(function(a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });

  var liked = state.user && t.likes && t.likes[state.user.uid];
  var del = state.user && (state.user.uid === t.uid || state.user.isAdmin);
  var av = (t.uid && state.users[t.uid] && state.users[t.uid].avatarUrl) || t.authorAvatar;

  var h =
    '<div class="thread-item">' +
      '<div class="post-header">' +
        (isValidImageSrc(av) ? '<a onclick="openPublicProfile(\'' + esc(t.uid || "") + '\')"><img class="avatar-thumb" src="' + esc(av) + '"></a>' : '') +
        (t.subject ? '<span class="post-subject">' + esc(t.subject) + '</span> ' : '') +
        renderAuthorLink(t.uid, t.authorName) +
        (t.isAdminPost ? '<span class="admin-badge">ADMIN</span>' : '') +
        ' <span class="muted">' + formatTime(t.createdAt) + '</span> ' +
        (!single ? '[<a onclick="switchView(\'thread\',\'' + esc(t.id) + '\')">Reply (' + cList.length + ')</a>] ' : '') +
        '[<a onclick="toggleThreadLike(\'' + esc(t.id) + '\')">' + (liked ? 'Unlike' : 'Like') + ' (' + countLikes(t.likes) + ')</a>]' +
        (state.user ? ' [<a onclick="repostToMyWall(\'thread\',\'' + esc(t.id) + '\',\'\')">Repost</a>]' : '') +
        (del ? ' [<a class="link-danger" onclick="deleteThread(\'' + esc(t.id) + '\')">Delete</a>]' : '') +
      '</div>';

  if (t.stickerUrl && isValidImageSrc(t.stickerUrl)) h += '<div><img class="sticker-inline" src="' + esc(t.stickerUrl) + '"></div>';
  if (t.imageUrl && isValidImageSrc(t.imageUrl)) h += '<div class="post-media"><a href="' + esc(t.imageUrl) + '" target="_blank" rel="noopener"><img src="' + esc(t.imageUrl) + '"></a></div>';
  if (t.text) h += '<div class="post-body">' + esc(t.text) + '</div>';
  if (t.audioData && t.audioData.indexOf("data:audio/") === 0) h += '<div class="video-box"><audio controls preload="none" src="' + esc(t.audioData) + '"></audio></div>';
  if (t.videoUrl) h += renderVideoHtml(t.videoUrl);
  h += '<div class="post-actions"></div>';

  var start = single ? 0 : Math.max(0, cList.length - 3);
  if (!single && start > 0) {
    h += '<div class="muted" style="margin-left:20px;">' + start + ' earlier replies omitted. <a onclick="switchView(\'thread\',\'' + esc(t.id) + '\')">View all</a>.</div>';
  }
  for (var k = start; k < cList.length; k++) h += renderCommentBlock(t.id, cList[k]);
  return h + '</div>';
}

function renderCommentBlock(tid, c) {
  if (isUserBlockedByMe(c.uid)) return '<div class="blocked-notice" style="margin-left:20px;">Reply hidden.</div>';
  var liked = state.user && c.likes && c.likes[state.user.uid];
  var del = state.user && (state.user.uid === c.uid || state.user.isAdmin);
  var av = (c.uid && state.users[c.uid] && state.users[c.uid].avatarUrl) || c.authorAvatar;

  var h =
    '<div class="reply-box">' +
      '<div class="post-header">' +
        (isValidImageSrc(av) ? '<a onclick="openPublicProfile(\'' + esc(c.uid || "") + '\')"><img class="avatar-thumb" src="' + esc(av) + '"></a>' : '') +
        renderAuthorLink(c.uid, c.authorName) +
        (c.isAdminPost ? '<span class="admin-badge">ADMIN</span>' : '') +
        ' <span class="muted">' + formatTime(c.createdAt) + '</span> ' +
        '[<a onclick="toggleCommentLike(\'' + esc(tid) + '\',\'' + esc(c.id) + '\')">' + (liked ? 'Unlike' : 'Like') + ' (' + countLikes(c.likes) + ')</a>]' +
        (state.user ? ' [<a onclick="repostToMyWall(\'comment\',\'' + esc(c.id) + '\',\'' + esc(tid) + '\')">Repost</a>]' : '') +
        (del ? ' [<a class="link-danger" onclick="deleteComment(\'' + esc(tid) + '\',\'' + esc(c.id) + '\')">Delete</a>]' : '') +
      '</div>';

  if (c.stickerUrl && isValidImageSrc(c.stickerUrl)) h += '<div><img class="sticker-inline" src="' + esc(c.stickerUrl) + '"></div>';
  if (c.imageUrl && isValidImageSrc(c.imageUrl)) h += '<div class="post-media"><a href="' + esc(c.imageUrl) + '" target="_blank" rel="noopener"><img src="' + esc(c.imageUrl) + '"></a></div>';
  if (c.text) h += '<div class="post-body">' + esc(c.text) + '</div>';
  if (c.videoUrl) h += renderVideoHtml(c.videoUrl);
  return h + '</div>';
}

function renderSingleThreadView() {
  var t = state.threads[state.currentThreadId];
  if (!t) return '<div class="box-panel">Thread not found. <a onclick="switchView(\'board\',state.currentBoard)">Back</a>.</div>';
  var h = '<div style="margin-bottom:10px;">[<a onclick="switchView(\'board\',\'' + esc(t.board) + '\')">&larr; Return to /' + esc(t.board) + '/</a>]</div><div id="threadFeedArea">' + renderThreadBlock(t, true) + '</div><div class="box-panel"><h3>Post a Reply</h3>';
  if (!state.user) {
    h += '<div>Please <a onclick="switchView(\'auth\')">Log In</a> to reply.</div>';
  } else {
    h +=
      '<table class="form-table">' +
        '<tr><td class="form-label">Comment</td><td><textarea id="replyText"></textarea></td></tr>' +
        '<tr><td class="form-label">Sticker</td><td>' + renderStickerPickerWidget("reply_" + t.id) + '</td></tr>' +
        '<tr><td class="form-label">Image</td><td><input type="file" id="replyImage" accept="image/*"></td></tr>' +
        '<tr><td class="form-label">Video / Audio Link</td><td><input type="text" id="replyVideo" placeholder="https://..."></td></tr>' +
        '<tr><td class="form-label">Submit</td><td><button onclick="createComment(\'' + esc(t.id) + '\')">Post Reply</button></td></tr>' +
      '</table>';
  }
  return h + '</div>';
}

/* ==========================================================================
   PROFILE, DISCORD FAVORITE CARDS & STENA (WALL) VIEWS
   ========================================================================== */
function renderDiscordCard(cat, item, rem, idx) {
  return (
    '<div class="discord-fav-card">' +
      '<div class="discord-fav-art">' + (isValidImageSrc(item.imageUrl) ? '<img src="' + esc(item.imageUrl) + '">' : cat.icon) + '</div>' +
      '<div class="discord-fav-body">' +
        '<div class="discord-fav-badge">' + cat.badge + '</div>' +
        '<div class="discord-fav-title">' + esc(item.title) + '</div>' +
        (item.subtitle ? '<div class="discord-fav-sub">' + esc(item.subtitle) + '</div>' : '') +
        (rem ? '<div class="discord-fav-remove"><a onclick="removeFavoriteCardItem(\'' + esc(cat.key) + '\',' + idx + ')">Remove</a></div>' : '') +
      '</div>' +
    '</div>'
  );
}

function renderPublicProfileView() {
  var tUid = state.currentProfileUid || (state.user ? state.user.uid : "");
  var u = (tUid && state.users[tUid]) ? state.users[tUid] : null;
  if (!tUid || !u) return '<div class="box-panel">Profile not found.</div>';

  var isOwn = state.user && state.user.uid === tUid;
  var dName = u.nickname || u.username || "User";
  var h = '<div class="board-banner">' + esc(dName) + ' (@' + esc(u.username || "user") + ')</div>';
  if (u.status) h += '<div class="profile-status-banner"><strong>Status:</strong> &ldquo;' + esc(u.status) + '&rdquo;</div>';

  h +=
    '<div class="profile-card">' +
      '<div class="profile-card-left">' +
        (isValidImageSrc(u.avatarUrl) ? '<img class="avatar-large" src="' + esc(u.avatarUrl) + '" style="margin:0 auto 6px;">' : '<div class="default-logo" style="width:96px;height:96px;line-height:60px;margin:0 auto 6px;">&#9786;</div>') +
        '<div class="muted">Subscribers: <strong>' + getSubscriberCount(tUid) + '</strong><br>Following: <strong>' + getSubscriptionCount(tUid) + '</strong></div>' +
      '</div>' +
      '<div class="profile-card-right">' +
        '<div style="margin-bottom:6px;"><strong style="font-size:15px;color:#AF0A0F;">' + esc(dName) + '</strong></div>';

  var rows = [
    { k: "Pronouns:", v: u.pronouns },
    { k: "Relationship:", v: u.relationship },
    { k: "Registration date:", v: u.registeredAt },
    { k: "Hometown:", v: u.hometown },
    { k: "Political views:", v: u.politicalViews },
    { k: "Birth date:", v: u.birthDate }
  ];
  var rH = "";
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].v) rH += '<tr><td class="profile-info-key">' + esc(rows[i].k) + '</td><td>' + esc(rows[i].v) + '</td></tr>';
  }
  if (rH) h += '<table class="profile-info-table">' + rH + '</table>';

  var site = safeUrl(u.website);
  if (site || u.city) {
    h += '<div class="section-subhead">Information &bull; Contact information</div><table class="profile-info-table">' +
         (site ? '<tr><td class="profile-info-key">Personal website:</td><td><a href="' + esc(site) + '" target="_blank" rel="noopener">' + esc(site) + '</a></td></tr>' : '') +
         (u.city ? '<tr><td class="profile-info-key">City:</td><td>' + esc(u.city) + '</td></tr>' : '') +
         '</table>';
  }

  var cust = normalizeCustomFields(u.customFields);
  if (u.interests || u.bio || cust.length) {
    h += '<div class="section-subhead">Personal information</div><table class="profile-info-table">';
    if (u.interests) {
      var pts = String(u.interests).split(","), tgs = "";
      for (var p = 0; p < pts.length; p++) {
        var tg = pts[p].replace(/^\s+|\s+$/g, "");
        if (tg) tgs += '<span class="interest-tag">' + esc(tg) + '</span>';
      }
      h += '<tr><td class="profile-info-key">Interests:</td><td>' + tgs + '</td></tr>';
    }
    if (u.bio) h += '<tr><td class="profile-info-key">About:</td><td style="white-space:pre-wrap;">' + esc(u.bio) + '</td></tr>';
    for (var c = 0; c < cust.length; c++) {
      h += '<tr><td class="profile-info-key">' + esc(cust[c].label) + ':</td><td>' + esc(cust[c].value) + '</td></tr>';
    }
    h += '</table>';
  }

  var favs = normalizeFavorites(u.favorites);
  for (var fc = 0; fc < FAVORITE_CATEGORIES.length; fc++) {
    var cat = FAVORITE_CATEGORIES[fc], items = favs[cat.key] || [];
    if (items.length) {
      h += '<div class="section-subhead">' + esc(cat.label) + '</div><div>';
      for (var it = 0; it < items.length; it++) h += renderDiscordCard(cat, items[it], false, it);
      h += '</div>';
    }
  }

  h += '<div style="margin-top:10px; border-top:1px dotted #D9BFB7; padding-top:8px;">';
  if (isOwn) {
    h += '<button type="button" onclick="switchView(\'profile\')">Edit Profile &amp; Favorites</button>';
  } else if (state.user) {
    var sub = isSubscribedToUser(tUid), blk = isUserBlockedByMe(tUid);
    h += '<button type="button" onclick="openDmWithUser(\'' + esc(tUid) + '\')">Send DM</button> ' +
         '<button type="button" class="' + (sub ? 'btn-active' : '') + '" onclick="toggleSubscribeUser(\'' + esc(tUid) + '\')">' + (sub ? 'Subscribed' : '+ Subscribe') + '</button> ' +
         '<button type="button" class="' + (blk ? 'btn-danger' : '') + '" onclick="toggleBlockUser(\'' + esc(tUid) + '\')">' + (blk ? 'Unblock' : 'Block') + '</button>';
  }
  h += '</div></div></div>';

  h += '<div class="box-panel"><h3>Stena (Wall) &mdash; Write on ' + esc(dName) + '\'s Wall</h3>';
  if (!state.user) {
    h += '<div>Please <a onclick="switchView(\'auth\')">Log In</a> to write on wall.</div>';
  } else if (amIBlockedByUser(tUid)) {
    h += '<div style="color:#CC0000;">You are blocked by this user.</div>';
  } else {
    h +=
      '<table class="form-table">' +
        '<tr><td class="form-label">Wall Message</td><td><textarea id="newWallText" style="height:56px;"></textarea></td></tr>' +
        '<tr><td class="form-label">Sticker</td><td>' + renderStickerPickerWidget("wall_" + tUid) + '</td></tr>' +
        '<tr><td class="form-label">Image</td><td><input type="file" id="newWallImage" accept="image/*"></td></tr>' +
        '<tr><td class="form-label">Video / Audio Link</td><td><input type="text" id="newWallVideo" placeholder="https://..."></td></tr>' +
        '<tr><td class="form-label">Submit</td><td><button type="button" onclick="createWallPost(\'' + esc(tUid) + '\')">Post to Wall</button></td></tr>' +
      '</table>';
  }
  return h + '</div><div id="wallFeedArea">' + renderWallPostsHtml(tUid) + '</div>';
}

function renderWallPostsHtml(tUid) {
  var map = state.walls[tUid] || {}, list = [];
  for (var pid in map) if (map.hasOwnProperty(pid) && map[pid]) list.push(map[pid]);
  list.sort(function(a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
  if (!list.length) return '<div style="text-align:center; padding:16px;" class="muted">No wall posts yet.</div>';

  var h = "";
  for (var i = 0; i < list.length; i++) {
    var p = list[i];
    if (isUserBlockedByMe(p.authorUid)) continue;
    var liked = state.user && p.likes && p.likes[state.user.uid];
    var del = state.user && (state.user.uid === p.authorUid || state.user.uid === tUid || state.user.isAdmin);

    h +=
      '<div class="wall-post-card">' +
        '<div class="post-header">' +
          renderAuthorLink(p.authorUid, p.authorName) +
          (p.repostOf ? ' <span class="muted">reposted from ' + esc(p.repostOf.originLabel || "post") + '</span>' : '') +
          ' <span class="muted">' + formatTime(p.createdAt) + '</span> ' +
          '[<a onclick="toggleWallPostLike(\'' + esc(tUid) + '\',\'' + esc(p.id) + '\')">' + (liked ? 'Unlike' : 'Like') + ' (' + countLikes(p.likes) + ')</a>]' +
          (state.user ? ' [<a onclick="repostToMyWall(\'wall\',\'' + esc(p.id) + '\',\'' + esc(tUid) + '\')">Repost</a>]' : '') +
          (del ? ' [<a class="link-danger" onclick="deleteWallPost(\'' + esc(tUid) + '\',\'' + esc(p.id) + '\')">Delete</a>]' : '') +
        '</div>';

    if (p.text) h += '<div class="post-body">' + esc(p.text) + '</div>';
    if (p.stickerUrl && isValidImageSrc(p.stickerUrl)) h += '<div><img class="sticker-inline" src="' + esc(p.stickerUrl) + '"></div>';
    if (p.imageUrl && isValidImageSrc(p.imageUrl)) h += '<div class="post-media"><a href="' + esc(p.imageUrl) + '" target="_blank" rel="noopener"><img src="' + esc(p.imageUrl) + '"></a></div>';
    if (p.videoUrl) h += renderVideoHtml(p.videoUrl);

    if (p.repostOf) {
      var rp = p.repostOf;
      h +=
        '<div class="repost-embed">' +
          '<div class="post-header"><strong>&#8634; Original by </strong>' + renderAuthorLink(rp.sourceAuthorUid, rp.sourceAuthorName) + '</div>' +
          (rp.stickerUrl && isValidImageSrc(rp.stickerUrl) ? '<div><img class="sticker-inline" src="' + esc(rp.stickerUrl) + '"></div>' : '') +
          (rp.text ? '<div class="post-body">' + esc(rp.text) + '</div>' : '') +
          (rp.imageUrl && isValidImageSrc(rp.imageUrl) ? '<div class="post-media"><img src="' + esc(rp.imageUrl) + '"></div>' : '') +
          (rp.videoUrl ? renderVideoHtml(rp.videoUrl) : '') +
          '<div style="clear:both;"></div>' +
        '</div>';
    }
    h += '<div style="clear:both;"></div>';

    var wcM = (state.wallComments[tUid] && state.wallComments[tUid][p.id]) || {}, wcL = [];
    for (var wcid in wcM) if (wcM.hasOwnProperty(wcid) && wcM[wcid]) wcL.push(wcM[wcid]);
    wcL.sort(function(a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
    for (var c = 0; c < wcL.length; c++) {
      h += '<div class="wall-comment-item">' + renderAuthorLink(wcL[c].authorUid, wcL[c].authorName) + ': ' + esc(wcL[c].text) + ' <span class="muted">(' + formatTime(wcL[c].createdAt) + ')</span></div>';
    }
    if (state.user && !amIBlockedByUser(tUid)) {
      h += '<div style="margin-top:6px; margin-left:18px;"><input type="text" id="wcInput_' + esc(p.id) + '" placeholder="Comment..." style="width:72%; display:inline-block;"> <button type="button" onclick="createWallComment(\'' + esc(tUid) + '\',\'' + esc(p.id) + '\')">Comment</button></div>';
    }
    h += '</div>';
  }
  return h;
}

/* ==========================================================================
   GROUPS, DMs, STICKERS ARCHIVE, MEMBERS, POLLS & PROFILE EDITOR VIEWS
   ========================================================================== */
function renderGroupsView() {
  var h = '<div class="board-banner">Community Groups &amp; Group Chats</div>';
  if (state.currentGroupId && state.groups[state.currentGroupId]) {
    var g = state.groups[state.currentGroupId];
    var mem = state.user && g.members && g.members[state.user.uid];
    var del = state.user && (g.ownerUid === state.user.uid || state.user.isAdmin);
    h +=
      '<div style="margin-bottom:8px;">[<a onclick="state.currentGroupId=null;renderAll();">&larr; All Groups</a>]</div>' +
      '<div class="box-panel"><h3>Group: ' + esc(g.title) + '</h3>' +
        (g.description ? '<div style="margin-bottom:6px;">' + esc(g.description) + '</div>' : '') +
        (state.user ? '<button type="button" class="' + (mem ? 'btn-active' : '') + '" onclick="toggleJoinGroup(\'' + esc(g.id) + '\')">' + (mem ? 'Joined (Leave)' : '+ Join') + '</button> ' : '') +
        (del ? '<button type="button" class="btn-danger" onclick="deleteGroup(\'' + esc(g.id) + '\')">Delete Group</button>' : '') +
      '</div>' +
      '<div id="groupFeedArea" style="max-width:680px; margin:0 auto;">' + renderGroupMessagesHtml(g.id) + '</div>';

    if (state.user) {
      h +=
        '<div class="box-panel" style="margin-top:12px;"><h3>Send Message</h3>' +
          '<table class="form-table">' +
            '<tr><td class="form-label">Message</td><td><textarea id="grpMsgText" style="height:54px;"></textarea></td></tr>' +
            '<tr><td class="form-label">Sticker</td><td>' + renderStickerPickerWidget("group_" + g.id) + '</td></tr>' +
            '<tr><td class="form-label">Image</td><td><input type="file" id="grpMsgImage" accept="image/*"></td></tr>' +
            '<tr><td class="form-label">Video / Audio Link</td><td><input type="text" id="grpMsgVideo" placeholder="https://..."></td></tr>' +
            '<tr><td class="form-label">Send</td><td><button type="button" onclick="sendGroupMessage(\'' + esc(g.id) + '\')">Send</button></td></tr>' +
          '</table>' +
        '</div>';
    }
    return h;
  }

  h += '<div class="box-panel"><h3>Create a Group</h3>' +
    (!state.user ? '<div>Please <a onclick="switchView(\'auth\')">Log In</a>.</div>' :
      '<table class="form-table">' +
        '<tr><td class="form-label">Title</td><td><input type="text" id="newGroupTitle" maxlength="50"></td></tr>' +
        '<tr><td class="form-label">Description</td><td><input type="text" id="newGroupDesc" maxlength="140"></td></tr>' +
        '<tr><td class="form-label">Create</td><td><button type="button" onclick="createGroup()">Create Group</button></td></tr>' +
      '</table>') +
    '</div><div style="max-width:680px; margin:0 auto;">';

  var gL = [];
  for (var gid in state.groups) if (state.groups.hasOwnProperty(gid) && state.groups[gid]) gL.push(state.groups[gid]);
  if (!gL.length) h += '<div style="text-align:center;" class="muted">No groups yet.</div>';
  else {
    for (var i = 0; i < gL.length; i++) {
      h += '<div class="poll-card"><strong>' + esc(gL[i].title) + '</strong><br>' + esc(gL[i].description || "") + '<div style="margin-top:6px;"><button type="button" onclick="state.currentGroupId=\'' + esc(gL[i].id) + '\';renderAll();">Open Chat</button></div></div>';
    }
  }
  return h + '</div>';
}

function renderGroupMessagesHtml(gid) {
  var map = state.groupMessages[gid] || {}, list = [];
  for (var mid in map) if (map.hasOwnProperty(mid) && map[mid]) list.push(map[mid]);
  list.sort(function(a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
  if (!list.length) return '<div class="muted" style="text-align:center;">No messages yet.</div>';

  var grp = state.groups[gid] || {}, h = "";
  for (var i = 0; i < list.length; i++) {
    var m = list[i];
    if (isUserBlockedByMe(m.authorUid)) continue;
    var mine = state.user && m.authorUid === state.user.uid;
    var del = state.user && (mine || grp.ownerUid === state.user.uid || state.user.isAdmin);
    h +=
      '<div class="chat-msg-box ' + (mine ? 'chat-msg-mine' : '') + '">' +
        '<div class="post-header">' + renderAuthorLink(m.authorUid, m.authorName) + ' <span class="muted">' + formatTime(m.createdAt) + '</span>' +
          (del ? ' [<a class="link-danger" onclick="deleteGroupMessage(\'' + esc(gid) + '\',\'' + esc(m.id) + '\')">Delete</a>]' : '') +
        '</div>' +
        (m.stickerUrl && isValidImageSrc(m.stickerUrl) ? '<div><img class="sticker-inline" src="' + esc(m.stickerUrl) + '"></div>' : '') +
        (m.imageUrl && isValidImageSrc(m.imageUrl) ? '<div class="post-media"><img src="' + esc(m.imageUrl) + '"></div>' : '') +
        (m.text ? '<div class="post-body">' + esc(m.text) + '</div>' : '') +
        (m.videoUrl ? renderVideoHtml(m.videoUrl) : '') +
      '</div>';
  }
  return h;
}

function renderDmsView() {
  var h = '<div class="board-banner">Direct Messages (DMs)</div>';
  if (!state.user) return h + '<div class="box-panel">Please <a onclick="switchView(\'auth\')">Log In</a> to use DMs.</div>';

  h += '<div class="box-panel"><h3>Select User</h3><select onchange="state.currentDmPeerUid=this.value;renderAll();"><option value="">-- Choose User --</option>';
  for (var uid in state.users) {
    if (state.users.hasOwnProperty(uid) && state.users[uid] && uid !== state.user.uid) {
      var u = state.users[uid];
      h += '<option value="' + esc(uid) + '"' + (state.currentDmPeerUid === uid ? ' selected' : '') + '>' + esc(u.nickname || u.username || uid) + ' (@' + esc(u.username || "user") + ')</option>';
    }
  }
  h += '</select></div>';

  if (state.currentDmPeerUid && state.users[state.currentDmPeerUid]) {
    var peer = state.users[state.currentDmPeerUid];
    var ck = getDmKey(state.user.uid, state.currentDmPeerUid);
    h += '<div class="box-panel"><h3>Chat with ' + renderAuthorLink(state.currentDmPeerUid, peer.nickname || peer.username) + '</h3><div id="dmFeedArea">' + renderDmMessagesHtml(ck) + '</div>';
    if (!isUserBlockedByMe(state.currentDmPeerUid) && !amIBlockedByUser(state.currentDmPeerUid)) {
      h +=
        '<table class="form-table" style="margin-top:8px;">' +
          '<tr><td class="form-label">Message</td><td><textarea id="dmMsgText" style="height:54px;"></textarea></td></tr>' +
          '<tr><td class="form-label">Sticker</td><td>' + renderStickerPickerWidget("dm_" + state.currentDmPeerUid) + '</td></tr>' +
          '<tr><td class="form-label">Image</td><td><input type="file" id="dmMsgImage" accept="image/*"></td></tr>' +
          '<tr><td class="form-label">Video / Audio Link</td><td><input type="text" id="dmMsgVideo" placeholder="https://..."></td></tr>' +
          '<tr><td class="form-label">Send</td><td><button type="button" onclick="sendDirectMessage(\'' + esc(state.currentDmPeerUid) + '\')">Send DM</button></td></tr>' +
        '</table>';
    }
    h += '</div>';
  }
  return h;
}

function renderDmMessagesHtml(ck) {
  var map = state.dms[ck] || {}, list = [];
  for (var mid in map) if (map.hasOwnProperty(mid) && map[mid]) list.push(map[mid]);
  list.sort(function(a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
  if (!list.length) return '<div class="muted" style="padding:8px;">No DMs yet.</div>';

  var h = "";
  for (var i = 0; i < list.length; i++) {
    var m = list[i], mine = m.fromUid === state.user.uid;
    h +=
      '<div class="chat-msg-box ' + (mine ? 'chat-msg-mine' : '') + '">' +
        '<div class="post-header"><strong>' + esc(getUserDisplayNameByUid(m.fromUid, m.fromName)) + '</strong> <span class="muted">' + formatTime(m.createdAt) + '</span>' +
          ((mine || state.user.isAdmin) ? ' [<a class="link-danger" onclick="deleteDirectMessage(\'' + esc(ck) + '\',\'' + esc(m.id) + '\')">Delete</a>]' : '') +
        '</div>' +
        (m.stickerUrl && isValidImageSrc(m.stickerUrl) ? '<div><img class="sticker-inline" src="' + esc(m.stickerUrl) + '"></div>' : '') +
        (m.imageUrl && isValidImageSrc(m.imageUrl) ? '<div class="post-media"><img src="' + esc(m.imageUrl) + '"></div>' : '') +
        (m.text ? '<div class="post-body">' + esc(m.text) + '</div>' : '') +
        (m.videoUrl ? renderVideoHtml(m.videoUrl) : '') +
      '</div>';
  }
  return h;
}

function renderStickersArchiveView() {
  var h =
    '<div class="board-banner">Public Stickers Archive (Static &amp; Animated)</div>' +
    '<div class="box-panel"><h3>Upload Sticker (Max ' + (SERVICE_POLICY.stickerMaxBytes / 1048576).toFixed(1) + ' MB, &le; ' + SERVICE_POLICY.stickerMaxDim + 'px)</h3>' +
      (!state.user ? '<div>Please <a onclick="switchView(\'auth\')">Log In</a>.</div>' :
        '<table class="form-table">' +
          '<tr><td class="form-label">Name</td><td><input type="text" id="archStickerName" maxlength="24"></td></tr>' +
          '<tr><td class="form-label">File</td><td><input type="file" id="archStickerFile" accept="image/*"></td></tr>' +
          '<tr><td class="form-label">Upload</td><td><button type="button" onclick="uploadPublicStickerFromArchive()">Add Sticker</button></td></tr>' +
        '</table>') +
    '</div><div class="box-panel"><h3>All Public Stickers</h3>';

  var list = [];
  for (var id in state.stickers) if (state.stickers.hasOwnProperty(id) && state.stickers[id]) list.push(state.stickers[id]);
  if (!list.length) h += '<div class="muted">No stickers yet.</div>';
  else {
    for (var i = 0; i < list.length; i++) {
      var st = list[i], del = state.user && (state.user.uid === st.uploadedByUid || state.user.isAdmin);
      h +=
        '<div style="display:inline-block;width:120px;text-align:center;background:#FFFFEE;border:1px solid #D9BFB7;padding:6px;margin:4px;vertical-align:top;">' +
          '<img src="' + esc(st.url) + '" style="width:70px;height:70px;object-fit:contain;display:block;margin:0 auto 4px;">' +
          '<div style="font-weight:bold;font-size:11px;">' + esc(st.name || "Sticker") + '</div>' +
          (del ? '<a class="link-danger" onclick="deletePublicSticker(\'' + esc(st.id) + '\')">[Delete]</a>' : '') +
        '</div>';
    }
  }
  return h + '</div>';
}

function renderMembersView() {
  var h = '<div class="board-banner">Community Members &amp; Public Walls</div><div style="max-width:680px; margin:0 auto;">';
  for (var uid in state.users) {
    if (state.users.hasOwnProperty(uid) && state.users[uid]) {
      var u = state.users[uid];
      h +=
        '<div class="poll-card">' +
          '<a class="poster-link" style="font-size:14px;" onclick="openPublicProfile(\'' + esc(uid) + '\')">' + esc(u.nickname || u.username || "User") + '</a> ' +
          '<span class="muted">(@' + esc(u.username || "user") + ')</span>' +
          (u.status ? '<div style="font-style:italic;">&ldquo;' + esc(u.status) + '&rdquo;</div>' : '') +
          '<div style="margin-top:5px;">' +
            '<button type="button" onclick="openPublicProfile(\'' + esc(uid) + '\')">Open Wall</button>' +
            (state.user && state.user.uid !== uid ? ' <button type="button" onclick="openDmWithUser(\'' + esc(uid) + '\')">DM</button>' : '') +
          '</div>' +
        '</div>';
    }
  }
  return h + '</div>';
}

function renderPollsView() {
  var h = '<div class="board-banner">Community Board Polls &amp; Admin</div>';
  if (state.user && state.user.isAdmin) {
    h +=
      '<div class="box-panel"><h3>Admin Panel</h3>' +
        '<table class="form-table">' +
          '<tr><td class="form-label">Webpage Logo</td><td><input type="file" id="panelAdminLogoFile" accept="image/*" class="input-auto"> <button type="button" onclick="uploadAdminSiteLogo(\'panelAdminLogoFile\')">Upload</button></td></tr>' +
          '<tr><td class="form-label">Board Slug</td><td><input type="text" id="adminBoardSlug" maxlength="16"></td></tr>' +
          '<tr><td class="form-label">Board Title</td><td><input type="text" id="adminBoardTitle" maxlength="40"></td></tr>' +
          '<tr><td class="form-label">Create</td><td><button onclick="createBoardAdmin()">Create Board Now</button></td></tr>' +
        '</table>' +
        '<div style="margin-top:8px;"><strong>Users:</strong><br>';
    for (var uid in state.users) {
      if (state.users.hasOwnProperty(uid) && state.users[uid]) {
        h += esc(state.users[uid].username || uid) + (uid !== state.user.uid ? ' [<a class="link-danger" onclick="adminRemoveUserRecord(\'' + esc(uid) + '\')">Remove DB Record</a>]' : '') + '<br>';
      }
    }
    h += '</div></div>';
  }

  h += '<div class="box-panel"><h3>Propose New Board</h3>' +
    (!state.user ? '<div>Please <a onclick="switchView(\'auth\')">Log In</a>.</div>' :
      '<table class="form-table">' +
        '<tr><td class="form-label">Slug</td><td><input type="text" id="pollBoardSlug" maxlength="16"></td></tr>' +
        '<tr><td class="form-label">Title</td><td><input type="text" id="pollBoardTitle" maxlength="40"></td></tr>' +
        '<tr><td class="form-label">Description</td><td><input type="text" id="pollBoardDesc" maxlength="140"></td></tr>' +
        '<tr><td class="form-label">Start</td><td><button onclick="createBoardPoll()">Start Poll</button></td></tr>' +
      '</table>') +
    '</div><div style="max-width:680px; margin:0 auto;">';

  for (var s in state.polls) {
    if (state.polls.hasOwnProperty(s) && state.polls[s]) {
      var p = state.polls[s], y = 0, n = 0;
      if (p.votes) for (var u in p.votes) if (p.votes.hasOwnProperty(u)) { if (p.votes[u] === "yes") y++; else if (p.votes[u] === "no") n++; }
      var canC = state.user && (p.createdBy === state.user.uid || state.user.isAdmin);
      h +=
        '<div class="poll-card"><strong>/' + esc(p.slug) + '/ &mdash; ' + esc(p.title) + '</strong> (' + (p.status === "approved" ? "CREATED" : "OPEN") + ')<br>' + esc(p.description || "") +
          '<div style="margin-top:6px;">' +
            (p.status !== "approved"
              ? ('<button onclick="voteOnPoll(\'' + esc(p.slug) + '\',\'yes\')">Agree (' + y + ')</button> <button onclick="voteOnPoll(\'' + esc(p.slug) + '\',\'no\')">Disagree (' + n + ')</button>' +
                 (canC ? ' <button class="btn-danger" onclick="cancelBoardPoll(\'' + esc(p.slug) + '\')">Cancel Proposal</button>' : ''))
              : '<a onclick="switchView(\'board\',\'' + esc(p.slug) + '\')">Open /' + esc(p.slug) + '/</a>') +
          '</div>' +
        '</div>';
    }
  }
  return h + '</div>';
}

function renderProfileView() {
  if (!state.user) return '<div class="box-panel">Please <a onclick="switchView(\'auth\')">Log In</a>.</div>';
  var h =
    '<div class="board-banner">Edit Profile, Favorites &amp; Wall</div>' +
    '<div style="text-align:center; margin-bottom:10px;">[<a onclick="openPublicProfile(\'' + esc(state.user.uid) + '\')">View My Public Wall &rarr;</a>]</div>' +
    '<div class="box-panel"><h3>Basic Details</h3><table class="form-table">' +
      '<tr><td class="form-label">Status</td><td><input type="text" id="profStatus" maxlength="100" value="' + esc(state.profile.status) + '"></td></tr>' +
      '<tr><td class="form-label">Display Name</td><td><input type="text" id="profNickname" maxlength="32" value="' + esc(state.profile.nickname) + '"></td></tr>' +
      '<tr><td class="form-label">Avatar</td><td>' + (state.profile.avatarUrl ? '<img class="avatar-large" src="' + esc(state.profile.avatarUrl) + '">' : '') + '<input type="file" id="profAvatarFile" accept="image/*"></td></tr>' +
      '<tr><td class="form-label">Pronouns</td><td><input type="text" id="profPronouns" value="' + esc(state.profile.pronouns) + '"></td></tr>' +
      '<tr><td class="form-label">Relationship</td><td><input type="text" id="profRelationship" value="' + esc(state.profile.relationship) + '"></td></tr>' +
      '<tr><td class="form-label">Hometown</td><td><input type="text" id="profHometown" value="' + esc(state.profile.hometown) + '"></td></tr>' +
      '<tr><td class="form-label">Political views</td><td><input type="text" id="profPolitical" value="' + esc(state.profile.politicalViews) + '"></td></tr>' +
      '<tr><td class="form-label">Birth date</td><td><input type="text" id="profBirthDate" value="' + esc(state.profile.birthDate) + '"></td></tr>' +
      '<tr><td class="form-label">Personal website</td><td><input type="text" id="profWebsite" value="' + esc(state.profile.website) + '"></td></tr>' +
      '<tr><td class="form-label">City</td><td><input type="text" id="profCity" value="' + esc(state.profile.city) + '"></td></tr>' +
      '<tr><td class="form-label">Interests</td><td><input type="text" id="profInterests" value="' + esc(state.profile.interests) + '"></td></tr>' +
      '<tr><td class="form-label">About</td><td><textarea id="profBio">' + esc(state.profile.bio) + '</textarea></td></tr>';

  var cust = normalizeCustomFields(state.profile.customFields);
  for (var i = 0; i < cust.length; i++) {
    h += '<tr><td class="form-label"><input type="text" id="custLbl_' + i + '" value="' + esc(cust[i].label) + '"></td><td><input type="text" id="custVal_' + i + '" value="' + esc(cust[i].value) + '" style="width:74%;display:inline-block;"> <button type="button" class="btn-danger" onclick="removeCustomProfileField(' + i + ')">Remove</button></td></tr>';
  }
  h +=
    '<tr><td class="form-label"><input type="text" id="newCustomLabel" placeholder="Custom label"></td><td><input type="text" id="newCustomValue" placeholder="Custom value" style="width:74%;display:inline-block;"> <button type="button" onclick="addCustomProfileField()">+ Add</button></td></tr>' +
    '<tr><td class="form-label">Save</td><td><button type="button" onclick="saveUserProfile()">Save Profile Details</button></td></tr></table></div>' +
    '<div class="box-panel"><h3>Favorites (Discord Cards)</h3><table class="form-table">' +
      '<tr><td class="form-label">Category</td><td><select id="favCategory"><option value="films">Favorite films</option><option value="tv">Favorite TV-shows</option><option value="books">Favorite books</option><option value="games">Favorite games</option></select></td></tr>' +
      '<tr><td class="form-label">Title</td><td><input type="text" id="favTitle"></td></tr>' +
      '<tr><td class="form-label">Note</td><td><input type="text" id="favSubtitle"></td></tr>' +
      '<tr><td class="form-label">Picture</td><td><input type="file" id="favImageFile" accept="image/*"></td></tr>' +
      '<tr><td class="form-label">Or URL</td><td><input type="text" id="favImageUrl"></td></tr>' +
      '<tr><td class="form-label">Add</td><td><button type="button" onclick="addFavoriteCardItem()">+ Add Card</button></td></tr>' +
    '</table>';

  var favs = normalizeFavorites(state.profile.favorites);
  for (var fc = 0; fc < FAVORITE_CATEGORIES.length; fc++) {
    var cat = FAVORITE_CATEGORIES[fc], items = favs[cat.key] || [];
    if (items.length) {
      h += '<div class="section-subhead">' + esc(cat.label) + '</div><div>';
      for (var it = 0; it < items.length; it++) h += renderDiscordCard(cat, items[it], true, it);
      h += '</div>';
    }
  }
  return h + '</div>';
}

function renderAuthView() {
  return (
    '<div class="board-banner">Account Login &amp; Registration</div>' +
    '<div class="box-panel"><h3>Sign In or Register</h3>' +
      '<table class="form-table">' +
        '<tr><td class="form-label">Your Name</td><td><input type="text" id="authUsername" maxlength="30" placeholder="e.g. alex"></td></tr>' +
        '<tr><td class="form-label">Password</td><td><input type="password" id="authPassword"></td></tr>' +
        '<tr><td class="form-label">Action</td><td><button onclick="handleAuth(\'login\')">Login</button> &nbsp; <button onclick="handleAuth(\'register\')">Register New Account</button></td></tr>' +
      '</table>' +
      '<div class="muted" style="margin-top:8px;">Stored in Firebase as <strong>name@' + esc(CONFIG.emailDomain) + '</strong>.</div>' +
    '</div>'
  );
}

function updateDynamicFeed() {
  renderChrome();
  if (state.view === "board") {
    var bf = document.getElementById("boardFeedArea");
    if (bf) bf.innerHTML = renderBoardThreadsHtml(state.currentBoard);
  } else if (state.view === "thread") {
    var tf = document.getElementById("threadFeedArea"), t = state.threads[state.currentThreadId];
    if (tf && t) tf.innerHTML = renderThreadBlock(t, true);
  } else if (state.view === "public_profile") {
    var wf = document.getElementById("wallFeedArea");
    if (wf && state.currentProfileUid) wf.innerHTML = renderWallPostsHtml(state.currentProfileUid);
  } else if (state.view === "groups" && state.currentGroupId) {
    var gf = document.getElementById("groupFeedArea");
    if (gf) gf.innerHTML = renderGroupMessagesHtml(state.currentGroupId);
  } else if (state.view === "dms" && state.user && state.currentDmPeerUid) {
    var df = document.getElementById("dmFeedArea");
    if (df) df.innerHTML = renderDmMessagesHtml(getDmKey(state.user.uid, state.currentDmPeerUid));
  }
}

function renderAll() {
  renderChrome();
  var c = document.getElementById("mainContent");
  if (state.view === "thread") c.innerHTML = renderSingleThreadView();
  else if (state.view === "public_profile") c.innerHTML = renderPublicProfileView();
  else if (state.view === "groups") c.innerHTML = renderGroupsView();
  else if (state.view === "dms") c.innerHTML = renderDmsView();
  else if (state.view === "stickers") c.innerHTML = renderStickersArchiveView();
  else if (state.view === "members") c.innerHTML = renderMembersView();
  else if (state.view === "polls") c.innerHTML = renderPollsView();
  else if (state.view === "profile") c.innerHTML = renderProfileView();
  else if (state.view === "auth") c.innerHTML = renderAuthView();
  else c.innerHTML = renderBoardView();
}

window.onload = function() {
  probeServicePolicies();
  fetchGithubRepoVersion();
  initMusicPlayer();
  initPlaygroundControls();
  loadSession();
  ensureFreshSession(function() {
    loadUserProfile(function() {
      refreshAllData(function() {
        renderAll();
        startAutoRefresh();
        syncRealtimeWorld();
      });
    });
  });
};