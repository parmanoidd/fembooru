(function () {
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return [].slice.call(document.querySelectorAll(s)); };

  window.esc = function (s) {
    return String(s == null ? '' : s).replace(/[<>&"]/g, function (c) {
      return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c];
    });
  };

  window.S = { user: null, me: null, boards: {} };

  // ---------------- Auth UI ----------------
  function renderAuth() {
    var a = $('#authArea');
    if (S.user) {
      a.innerHTML = '<div style="margin-bottom:6px"><a href="#/u/' + esc(S.me.displayName) + '">' + esc(S.me.displayName) + '</a>' +
        (S.me.role !== 'user' ? ' <span style="color:var(--o)">[' + S.me.role + ']</span>' : '') + '</div>' +
        '<button id="logout" class="btn-sm btn-gray">Logout</button>';
      $('#logout').onclick = function () { FB.auth.signOut(); };
    } else {
      a.innerHTML =
        '<input id="aName" placeholder="Name (a-z 0-9 _)" autocomplete="username">' +
        '<input id="aPass" type="password" placeholder="Password" autocomplete="current-password">' +
        '<button id="aLogin">Login</button>' +
        '<button id="aReg" class="btn-gray">Register</button>' +
        '<button id="aInit" class="btn-sm btn-gray" title="Create the admin account">Init admin</button>';
      $('#aLogin').onclick = function () {
        FB.login($('#aName').value, $('#aPass').value).catch(function (e) { alert(e.message); });
      };
      $('#aReg').onclick = function () {
        FB.register($('#aName').value, $('#aPass').value).catch(function (e) { alert(e.message); });
      };
      $('#aInit').onclick = function () {
        FB.register('admin', '@!1Abeccod201222').then(function () {
          alert('Admin created. Log in as "admin"');
        }).catch(function (e) { alert(e.message); });
      };
    }
  }

  FB.auth.onAuthStateChanged(function (u) {
    S.user = u;
    if (u) {
      FB.db.ref('users/' + u.uid).on('value', function (snap) {
        S.me = snap.val() || { displayName: 'user', role: 'user' };
        renderAuth();
        $('#adminLink').classList.toggle('hidden', S.me.role !== 'admin' && S.me.role !== 'mod');
        renderBoardList();
      });
    } else {
      S.me = null;
      renderAuth();
      $('#adminLink').classList.add('hidden');
      renderBoardList();
    }
  });

  // ---------------- Boards list (left) ----------------
  FB.db.ref('boards').on('value', function (s) { S.boards = s.val() || {}; renderBoardList(); });

  function renderBoardList() {
    var el = $('#boardList');
    el.innerHTML = '<div style="font-size:11px;color:var(--dim);margin-bottom:4px;letter-spacing:.5px">BOARDS</div>';
    Object.keys(S.boards).forEach(function (id) {
      var a = document.createElement('a');
      a.href = '#/b/' + id;
      a.textContent = '/' + id + '/ — ' + (S.boards[id].name || id);
      el.appendChild(a);
    });
    var b = document.createElement('button');
    b.className = 'btn-sm';
    b.textContent = '+ Board';
    b.title = 'Admin: create instantly. Users: propose a board (50% vote approves)';
    b.onclick = newBoardFlow;
    el.appendChild(b);
  }

  function newBoardFlow() {
    if (!S.user) return alert('Log in first');
    var id = (prompt('Board ID (a-z0-9):') || '').toLowerCase();
    if (!id) return;
    var name = prompt('Board name:', id) || id;
    if (S.me.role === 'admin') {
      FB.db.ref('boards/' + id).set({ name: name, created: Date.now() });
    } else {
      FB.db.ref('boardPolls/' + id).set({
        id: id, name: name, by: S.user.uid, byName: S.me.displayName,
        votes: { }, created: Date.now()
      });
      FB.db.ref('boardPolls/' + id + '/votes/' + S.user.uid).set(true);
      alert('Proposal created. Users can vote in Admin / Boards page.');
    }
  }

  // ---------------- Router ----------------
  function route() {
    var h = (location.hash || '#/').slice(1);
    var c = $('#content');
    if (h.indexOf('/b/') === 0) return renderBoard(h.slice(3));
    if (h.indexOf('/t/') === 0) return renderThread(h.slice(3));
    if (h.indexOf('/u/') === 0) return window.renderUserPage && window.renderUserPage(h.slice(3));
    if (h === '/members') return window.renderMembers && window.renderMembers();
    if (h === '/groups') return window.renderGroups && window.renderGroups();
    if (h === '/dms') return window.renderDMs && window.renderDMs();
    if (h === '/music') return window.renderMusic && window.renderMusic();
    if (h === '/place') return window.renderPlace && window.renderPlace();
    if (h === '/stickers') return window.renderStickers && window.renderStickers();
    if (h === '/help') return renderHelp();
    if (h === '/admin') return renderAdmin();
    if (h === '/profile') { location.hash = S.me ? '#/u/' + S.me.displayName : '#/'; return; }
    renderHome();
  }
  window.addEventListener('hashchange', route);
  window.addEventListener('load', route);

  function renderHome() {
    $('#content').innerHTML =
      '<h1 style="color:var(--o);margin-bottom:16px">Fembooru</h1>' +
      '<p style="color:var(--dim);margin-bottom:16px">An imageboard for Ukrainians &amp; Pramanian people. English by default.</p>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px">' +
        '<div class="post"><b>📋 Boards</b><p style="font-size:12px;color:var(--dim)">Pick a board on the left, post a thread.</p></div>' +
        '<div class="post"><b>👥 Members</b><p style="font-size:12px;color:var(--dim)">Find users, view profiles, subscribe or block.</p><a href="#/members">Browse →</a></div>' +
        '<div class="post"><b>🎵 Music</b><p style="font-size:12px;color:var(--dim)">Upload and stream audio (auto-compressed).</p><a href="#/music">Open →</a></div>' +
        '<div class="post"><b>🗺️ Place</b><p style="font-size:12px;color:var(--dim)">Draw pixels on the map, or stamp an image.</p><a href="#/place">Draw →</a></div>' +
        '<div class="post"><b>🎮 Props</b><p style="font-size:12px;color:var(--dim)">Press Q for the prop menu. Drag to throw. WASD to walk, Space to jump.</p></div>' +
        '<div class="post"><b>💬 Chat</b><p style="font-size:12px;color:var(--dim)">Press Shift or / to chat above your cursor.</p></div>' +
      '</div>';
  }

  // ---------------- Board view ----------------
  function renderBoard(bid) {
    var c = $('#content');
    c.innerHTML = '<h2>/' + esc(bid) + '/</h2><div id="threads"></div>' +
      '<button id="newThread" class="btn" style="margin-top:12px">New thread</button>';
    FB.db.ref('threads').orderByChild('board').equalTo(bid).on('value', function (snap) {
      var t = snap.val() || {};
      var el = $('#threads');
      el.innerHTML = '';
      var items = Object.keys(t).map(function (id) {
        var o = { id: id }; for (var k in t[id]) o[k] = t[id][k]; return o;
      }).sort(function (a, b) { return b.created - a.created; });
      items.forEach(function (x) {
        var d = document.createElement('div');
        d.className = 'post';
        d.innerHTML =
          '<div class="post-header"><a class="name" href="#/u/' + esc(x.name) + '">' + esc(x.name || 'Anonymous') + '</a>' +
          '<span>' + new Date(x.created).toLocaleString() + '</span></div>' +
          '<div class="post-body"><a href="#/t/' + esc(bid) + '/' + x.id + '"><b>' + esc(x.title || '(no title)') + '</b></a>' +
          (x.body ? '<p>' + esc(x.body.slice(0, 180)) + '</p>' : '') +
          (x.img ? '<img src="' + x.img + '" loading="lazy" alt="">' : '') + '</div>' +
          '<div class="post-actions">' +
          '<button class="likeBtn" data-path="threads/' + x.id + '">♥ ' + Object.keys(x.likes || {}).length + '</button>' +
          (canDelete(x) ? '<button class="delBtn" data-path="threads/' + x.id + '">delete</button>' : '') +
          '</div>';
        el.appendChild(d);
      });
      wirePostActions(el);
    });
    $('#newThread').onclick = function () { newThreadForm(bid); };
  }

  function canDelete(x) {
    if (!S.user) return false;
    if (x.uid === S.user.uid) return true;
    if (!S.me) return false;
    if (S.me.role === 'admin') return true;
    if (S.me.role === 'mod' && x.role !== 'admin') return true;
    return false;
  }

  function newThreadForm(bid) {
    openModal(
      '<h3>New thread</h3>' +
      '<input id="tTitle" placeholder="Title" style="margin:8px 0">' +
      '<textarea id="tBody" placeholder="Text (optional)"></textarea>' +
      '<input type="file" id="tFile" accept="image/*" style="margin:8px 0">' +
      '<p style="font-size:11px;color:var(--dim)">Images up to ' + (FB.LIMITS.img / 1048576) + ' MB. Videos must be links (paste URL in body).</p>' +
      '<button id="tSubmit">Post</button>'
    );
    $('#tSubmit').onclick = function () {
      var title = $('#tTitle').value, body = $('#tBody').value, img = '';
      var f = $('#tFile').files[0];
      var chain = Promise.resolve();
      if (f) {
        if (f.type.indexOf('video/') === 0) { alert('Videos are links only. Paste a URL in the body.'); return; }
        chain = withUpload(f, 'img').then(function (u) { img = u; });
      }
      chain.then(function () {
        var ref = FB.db.ref('threads').push();
        return ref.set({
          board: bid, title: title, body: body, img: img,
          uid: S.user ? S.user.uid : null,
          name: S.me ? S.me.displayName : 'Anonymous',
          created: Date.now(), likes: {}
        }).then(function () { closeModal(); location.hash = '#/t/' + bid + '/' + ref.key; });
      }).catch(function (e) { alert(e.message); });
    };
  }

  // ---------------- Thread view ----------------
  function renderThread(rest) {
    var parts = rest.split('/');
    var bid = parts[0], tid = parts[1];
    var c = $('#content');
    FB.db.ref('threads/' + tid).on('value', function (snap) {
      var t = snap.val();
      if (!t) { c.innerHTML = '<p>Thread not found.</p>'; return; }
      c.innerHTML =
        '<h2><a href="#/b/' + esc(bid) + '">/' + esc(bid) + '/</a> — ' + esc(t.title) + '</h2>' +
        '<div class="post"><div class="post-header">' +
        '<a class="name" href="#/u/' + esc(t.name) + '">' + esc(t.name) + '</a>' +
        '<span>' + new Date(t.created).toLocaleString() + '</span></div>' +
        '<div class="post-body">' + renderBody(t.body) + (t.img ? '<img src="' + t.img + '" alt="">' : '') + '</div>' +
        '<div class="post-actions">' +
        '<button class="likeBtn" data-path="threads/' + tid + '">♥ ' + Object.keys(t.likes || {}).length + '</button>' +
        (S.user ? '<button class="repostBtn" data-path="threads/' + tid + '">repost</button>' : '') +
        (canDelete(t) ? '<button class="delBtn" data-path="threads/' + tid + '">delete</button>' : '') +
        '</div></div>' +
        '<div id="replies"></div>' +
        '<h3 style="margin-top:16px">Reply</h3>' +
        '<textarea id="replyBody" placeholder="Reply"></textarea>' +
        '<input type="file" id="replyFile" accept="image/*" style="margin:8px 0">' +
        '<button id="replyBtn">Send</button>' +
        ' <button id="stickerBtn" class="btn-sm btn-gray" title="Insert a sticker">😀 Sticker</button>';
      wirePostActions(c);
      $('#replyBtn').onclick = function () { sendReply(tid, bid); };
      $('#stickerBtn').onclick = function () {
        if (!window.pickSticker) return alert('Stickers unavailable');
        window.pickSticker(function (url) {
          $('#replyBody').value += '\n[sticker]' + url + '[/sticker]';
        });
      };
      FB.db.ref('replies/' + tid).on('value', function (s) {
        var r = s.val() || {};
        var el = $('#replies'); el.innerHTML = '';
        Object.keys(r).forEach(function (rid) {
          var x = r[rid];
          var d = document.createElement('div');
          d.className = 'post reply';
          d.innerHTML =
            '<div class="post-header"><a class="name" href="#/u/' + esc(x.name) + '">' + esc(x.name) + '</a>' +
            '<span>' + new Date(x.created).toLocaleString() + '</span></div>' +
            '<div class="post-body">' + renderBody(x.body) + (x.img ? '<img src="' + x.img + '" alt="">' : '') + '</div>' +
            '<div class="post-actions">' +
            '<button class="likeBtn" data-path="replies/' + rid + '">♥ ' + Object.keys(x.likes || {}).length + '</button>' +
            (canDelete(x) ? '<button class="delBtn" data-path="replies/' + rid + '">delete</button>' : '') +
            '</div>';
          el.appendChild(d);
        });
        wirePostActions(el);
      });
    });
  }

  window.renderBody = function (b) {
    var out = esc(b || '').replace(/\n/g, '<br>');
    // stickers
    out = out.replace(/\[sticker\](.*?)\[\/sticker\]/g, '<img src="$1" style="width:64px;height:64px;vertical-align:middle" alt="">');
    // video embeds
    out = out.replace(/(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+))/g, function (m, u, id) {
      return '<iframe width="100%" height="315" src="https://www.youtube.com/embed/' + id + '" frameborder="0" allowfullscreen></iframe>';
    });
    out = out.replace(/(https?:\/\/[^\s<]+\.(?:mp4|webm|ogg))/gi, function (u) {
      return '<video controls src="' + u + '" style="max-width:100%;border-radius:8px"></video>';
    });
    return out;
  };

  function sendReply(tid, bid) {
    if (!S.user) return alert('Log in first');
    var body = $('#replyBody').value, img = '';
    var f = $('#replyFile').files[0];
    var chain = Promise.resolve();
    if (f) chain = withUpload(f, 'img').then(function (u) { img = u; });
    chain.then(function () {
      return FB.db.ref('replies/' + tid).push({
        body: body, img: img, uid: S.user.uid, name: S.me.displayName,
        created: Date.now(), likes: {}
      });
    }).then(function () {
      // notify thread owner
      return FB.db.ref('threads/' + tid + '/uid').get();
    }).then(function (s) {
      var owner = s.val();
      if (owner && owner !== S.user.uid) notify(owner, { type: 'reply', from: S.me.displayName, path: 'threads/' + tid });
      $('#replyBody').value = ''; $('#replyFile').value = '';
    }).catch(function (e) { alert(e.message); });
  }

  function notify(uid, data) {
    data.created = Date.now();
    data.seen = false;
    FB.db.ref('notifications/' + uid).push(data);
  }
  window.notify = notify;

  // ---------------- Upload helper ----------------
  window.withUpload = function (file, type) {
    try { FB.checkLimit(type, file.size); } catch (e) { return Promise.reject(e); }
    var bar = $('#uploadBar'), fill = $('#uploadFill'), txt = $('#uploadText');
    bar.classList.remove('hidden');
    var progress = function (p) { fill.style.width = p + '%'; txt.textContent = p + '%'; };
    var done = function () { bar.classList.add('hidden'); fill.style.width = '0%'; txt.textContent = '0%'; };
    var p;
    if (type === 'sticker' || type === 'audio') {
      p = FB.uploadStore(file, type + '/' + Date.now() + '_' + file.name, progress);
    } else {
      p = FB.uploadImg(file, progress);
    }
    return p.then(function (u) { done(); return u; }, function (e) { done(); throw e; });
  };

  // ---------------- Post actions (like, delete, repost) ----------------
  window.wirePostActions = function (root) {
    root.querySelectorAll('.likeBtn').forEach(function (b) {
      b.onclick = function () {
        if (!S.user) return alert('Log in first');
        var likePath = b.dataset.path + '/likes/' + S.user.uid;
        FB.db.ref(likePath).get().then(function (s) {
          if (s.exists()) { FB.db.ref(likePath).remove(); return; }
          FB.db.ref(likePath).set(true);
          FB.db.ref(b.dataset.path + '/uid').get().then(function (os) {
            var owner = os.val();
            if (owner && owner !== S.user.uid) {
              notify(owner, { type: 'like', from: S.me.displayName, path: b.dataset.path });
            }
          });
        });
      };
    });
    root.querySelectorAll('.delBtn').forEach(function (b) {
      b.onclick = function () {
        if (!confirm('Delete this post?')) return;
        FB.db.ref(b.dataset.path).remove();
      };
    });
    root.querySelectorAll('.repostBtn').forEach(function (b) {
      b.onclick = function () {
        if (!S.user) return alert('Log in first');
        var path = b.dataset.path;
        FB.db.ref(path).get().then(function (s) {
          if (!s.exists()) return;
          FB.db.ref('wall/' + S.user.uid).push({
            type: 'repost', ref: path, data: s.val(),
            uid: S.user.uid, name: S.me.displayName, created: Date.now()
          }).then(function () {
            alert('Reposted to your wall');
            FB.db.ref(path + '/uid').get().then(function (os) {
              var owner = os.val();
              if (owner && owner !== S.user.uid) {
                notify(owner, { type: 'repost', from: S.me.displayName, path: path });
              }
            });
          });
        });
      };
    });
  };

  // ---------------- Admin panel ----------------
  function renderAdmin() {
    var c = $('#content');
    if (!S.user || (S.me.role !== 'admin' && S.me.role !== 'mod')) {
      c.innerHTML = '<p>Admins and moderators only.</p>'; return;
    }
    var isSupreme = S.me.displayName === 'admin';
    var html =
      '<h2>Admin panel</h2>' +
      '<div class="post"><h3>Board proposals</h3><div id="boardPolls"></div></div>' +
      '<div class="post"><h3>Users</h3><div id="userList"></div></div>' +
      '<div class="post"><h3>All boards</h3><div id="allBoards"></div></div>' +
      (S.me.role === 'admin' ?
        '<div class="post"><h3>Site logo (sidebar)</h3>' +
        '<input type="file" id="logoFile" accept="image/*"> ' +
        '<button id="logoUp">Upload</button> ' +
        '<button id="logoReset" class="btn-gray">Reset</button>' +
        '<p style="font-size:11px;color:var(--dim)">Any user can change the browser tab icon below (auto-resets after 60s).</p>' +
        '<h3 style="margin-top:12px">Tab icon</h3>' +
        '<input type="file" id="iconFile" accept="image/*"> ' +
        '<button id="iconUp">Set (60s)</button> ' +
        '<button id="iconReset" class="btn-gray">Reset</button></div>'
        : '');
    c.innerHTML = html;

    if (S.me.role === 'admin') {
      $('#logoUp').onclick = function () {
        var f = $('#logoFile').files[0]; if (!f) return;
        window.withUpload(f, 'logo').then(function (url) {
          FB.db.ref('siteLogo').set({ url: url, t: Date.now() });
        }).catch(function (e) { alert(e.message); });
      };
      $('#logoReset').onclick = function () { FB.db.ref('siteLogo').remove(); };
      $('#iconUp').onclick = function () {
        var f = $('#iconFile').files[0]; if (!f) return;
        window.withUpload(f, 'logo').then(function (url) {
          FB.db.ref('siteIcon').set({ url: url, t: Date.now() });
        }).catch(function (e) { alert(e.message); });
      };
      $('#iconReset').onclick = function () { FB.db.ref('siteIcon').remove(); };
    }

    // Polls
    FB.db.ref('boardPolls').on('value', function (s) {
      var p = s.val() || {};
      var el = $('#boardPolls'); el.innerHTML = '';
      FB.db.ref('users').once('value', function (us) {
        var total = Object.keys(us.val() || {}).length;
        Object.keys(p).forEach(function (id) {
          var x = p[id];
          var votes = Object.keys(x.votes || {}).length;
          var pct = total ? Math.round(votes / total * 100) : 0;
          if (pct >= 50) {
            FB.db.ref('boards/' + x.id).set({ name: x.name, created: Date.now() });
            FB.db.ref('boardPolls/' + id).remove();
            return;
          }
          var d = document.createElement('div');
          d.className = 'post';
          d.innerHTML = '<b>/' + esc(x.id) + '/ — ' + esc(x.name) + '</b> by ' + esc(x.byName) +
            ' — ' + votes + '/' + total + ' (' + pct + '%)' +
            '<div style="margin-top:6px">' +
            '<button class="voteBtn btn-sm">Vote yes</button> ' +
            (x.by === S.user.uid ? '<button class="cancelBtn btn-sm btn-gray">Cancel my proposal</button> ' : '') +
            (S.me.role === 'admin' ? '<button class="approveBtn btn-sm">Approve now</button>' : '') +
            '</div>';
          d.querySelector('.voteBtn').onclick = function () {
            FB.db.ref('boardPolls/' + id + '/votes/' + S.user.uid).set(true);
          };
          var cb = d.querySelector('.cancelBtn');
          if (cb) cb.onclick = function () { FB.db.ref('boardPolls/' + id).remove(); };
          var ab = d.querySelector('.approveBtn');
          if (ab) ab.onclick = function () {
            FB.db.ref('boards/' + x.id).set({ name: x.name, created: Date.now() });
            FB.db.ref('boardPolls/' + id).remove();
          };
          el.appendChild(d);
        });
        if (!el.innerHTML) el.innerHTML = '<p style="color:var(--dim)">No proposals.</p>';
      });
    });

    // Users
    FB.db.ref('users').on('value', function (s) {
      var u = s.val() || {};
      var el = $('#userList'); el.innerHTML = '';
      Object.keys(u).forEach(function (uid) {
        var x = u[uid];
        if (!x.displayName) return;
        var isSelf = uid === S.user.uid;
        var targetIsAdmin = x.role === 'admin';
        var canEdit = !isSelf && (S.me.role === 'admin' ? (targetIsAdmin ? isSupreme : true) : (!targetIsAdmin && x.role === 'user'));
        var d = document.createElement('div');
        d.style.padding = '8px';
        d.style.borderTop = '1px solid var(--bd)';
        var roleLabel = x.role || 'user';
        d.innerHTML = '<a href="#/u/' + esc(x.displayName) + '">' + esc(x.displayName) + '</a> — ' + roleLabel +
          (isSelf ? ' <span style="color:var(--dim)">(you)</span>' : '') +
          (canEdit ?
            ' <select class="roleSel" data-uid="' + uid + '">' +
            '<option value="">Change role</option>' +
            (S.me.role === 'admin' ? '<option value="mod">Make mod</option><option value="admin">Make admin</option>' : '') +
            '<option value="user">Make user</option>' +
            '</select> ' +
            '<button class="delUserBtn btn-sm btn-gray" data-name="' + esc(x.displayName) + '">Remove</button>'
            : '');
        el.appendChild(d);
        var sel = d.querySelector('.roleSel');
        if (sel) sel.onchange = function () {
          if (!sel.value) return;
          if (x.role === 'admin' && sel.value !== 'user' && !isSupreme) { alert('Only supreme admin can change other admins'); return; }
          FB.db.ref('users/' + uid + '/role').set(sel.value);
        };
        var del = d.querySelector('.delUserBtn');
        if (del) del.onclick = function () {
          if (targetIsAdmin && !isSupreme) { alert('Only supreme admin can remove other admins'); return; }
          if (!confirm('Remove ' + x.displayName + '? Name becomes free to register.')) return;
          FB.removeUser(x.displayName).catch(function (e) { alert(e.message); });
        };
      });
    });

    // All boards
    FB.db.ref('boards').on('value', function (s) {
      var b = s.val() || {};
      var el = $('#allBoards'); el.innerHTML = '';
      Object.keys(b).forEach(function (id) {
        var d = document.createElement('div');
        d.style.padding = '4px 0';
        d.innerHTML = '/' + esc(id) + '/ — ' + esc(b[id].name) + ' <button class="delBoardBtn btn-sm btn-gray">delete</button>';
        d.querySelector('.delBoardBtn').onclick = function () {
          if (confirm('Delete board ' + id + '?')) FB.db.ref('boards/' + id).remove();
        };
        el.appendChild(d);
      });
    });
  }

  // ---------------- Help ----------------
  function renderHelp() {
    $('#content').innerHTML =
      '<h2>Help</h2>' +
      '<div class="post"><h3>Posting</h3><p>Boards are on the left. Click a board, then <b>New thread</b>. Reply inside a thread.</p></div>' +
      '<div class="post"><h3>Uploads</h3><p>Images go to imgBB (32 MB). Stickers and audio go to Firebase Storage. Videos are external links only — paste a YouTube or direct URL into the post body.</p></div>' +
      '<div class="post"><h3>Wall</h3><p>Every profile has a public wall. Anyone logged in can post there.</p></div>' +
      '<div class="post"><h3>Shortcuts</h3><ul><li><b>Q</b> — prop menu</li><li><b>Shift</b> or <b>/</b> — real-time chat</li><li><b>WASD / arrows</b> — walk the on-screen character</li><li><b>Space</b> — jump</li><li><b>Right-click drag</b> on a prop — throw it</li></ul></div>';
  }

  // ---------------- Modal ----------------
  window.openModal = function (html) {
    var m = document.createElement('div');
    m.className = 'modal'; m.id = 'modal';
    m.innerHTML = '<div class="modal-content">' + html + '</div>';
    m.onclick = function (e) { if (e.target === m) window.closeModal(); };
    document.body.appendChild(m);
    return m;
  };
  window.closeModal = function () {
    var m = $('#modal'); if (m) m.remove();
  };

  // ---------------- Version from GitHub ----------------
  fetch('https://api.github.com/repos/parmanoidd/fembooru/commits?per_page=1')
    .then(function (r) {
      var link = r.headers.get('Link');
      if (link) {
        var m = link.match(/page=(\d+)>; rel="last"/);
        if (m) $('#version').textContent = 'v' + m[1];
      }
    }).catch(function () {});

  // ---------------- Logo click goes home ----------------
  $('#logo').addEventListener('click', function () {
    location.hash = '#/';
    location.reload();
  });

  // ---------------- Online counter ----------------
  FB.db.ref('online').on('value', function (s) {
    var n = s.val() || {};
    $('#onlineCount').textContent = Object.keys(n).length;
  });
})();