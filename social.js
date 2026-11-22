window.addEventListener('DOMContentLoaded', function() {
  if (!window.FB) return;
  var $ = function(s) { return document.querySelector(s); };

  window.notify = function(uid, data) { data.created = Date.now(); data.seen = false; FB.db.ref('notifications/' + uid).push(data); };

  window.renderUserPage = function(name) {
    name = decodeURIComponent(name || '').toLowerCase();
    FB.db.ref('nameMap/' + name).get().then(function(s) {
      if (!s.exists()) { $('#content').innerHTML = '<p>User not found.</p>'; return; }
      var uid = s.val().uid;
      FB.db.ref('users/' + uid).on('value', function(snap) { renderProfile(uid, snap.val() || { displayName: name }); });
    });
  };

  function renderProfile(uid, p) {
    var c = $('#content'), isMe = S.user && S.user.uid === uid;
    c.innerHTML = '<div class="profile-header"><img src="' + (p.avatar || '') + '" id="profAvatar">' +
      '<div style="flex:1;min-width:200px"><h2>' + esc(p.displayName) + (p.pronouns ? ' <span style="font-size:14px;color:#888">(' + esc(p.pronouns) + ')</span>' : '') + '</h2>' +
      '<p style="color:#888;margin:4px 0">' + esc(p.status || '') + '</p><div id="profActions"></div></div></div>' +
      '<div class="profile-grid" id="profFields"></div>' +
      '<h3 style="margin:16px 0 8px">Favorites</h3><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px" id="favCards"></div>' +
      '<h3 style="margin:16px 0 8px">Wall</h3>' +
      '<div id="wallForm" style="display:none;margin-bottom:12px"><textarea id="wallText" placeholder="Write on ' + esc(p.displayName) + '\'s wall..."></textarea>' +
      '<input type="file" id="wallFile" accept="image/*" style="margin:8px 0"><button id="wallPost">Post</button> <button id="wallSticker" class="btn-sm btn-gray">😀 Sticker</button></div>' +
      '<div id="wallPosts"></div>';

    if (isMe) {
      $('#profActions').innerHTML = '<button id="editProf" class="btn-sm">Edit profile</button>';
      $('#editProf').onclick = function() { editProfile(p); };
    } else if (S.user) {
      $('#profActions').innerHTML = '<button id="subBtn" class="btn-sm">Subscribe</button> <button id="blockBtn" class="btn-sm btn-gray">Block</button>';
      FB.db.ref('subscriptions/' + S.user.uid + '/' + uid).on('value', function(s) { $('#subBtn').textContent = s.exists() ? 'Unsubscribe' : 'Subscribe'; });
      FB.db.ref('blocks/' + S.user.uid + '/' + uid).on('value', function(s) { $('#blockBtn').textContent = s.exists() ? 'Unblock' : 'Block'; });
      $('#subBtn').onclick = function() {
        FB.db.ref('subscriptions/' + S.user.uid + '/' + uid).get().then(function(s) {
          if (s.exists()) { FB.db.ref('subscriptions/' + S.user.uid + '/' + uid).remove(); FB.db.ref('subscribers/' + uid + '/' + S.user.uid).remove(); }
          else { FB.db.ref('subscriptions/' + S.user.uid + '/' + uid).set(true); FB.db.ref('subscribers/' + uid + '/' + S.user.uid).set(true); notify(uid, { type: 'subscribe', from: S.me.displayName }); }
        });
      };
      $('#blockBtn').onclick = function() {
        FB.db.ref('blocks/' + S.user.uid + '/' + uid).get().then(function(s) {
          if (s.exists()) FB.db.ref('blocks/' + S.user.uid + '/' + uid).remove();
          else FB.db.ref('blocks/' + S.user.uid + '/' + uid).set(true);
        });
      };
    } else {
      $('#profActions').innerHTML = '<p style="font-size:12px;color:#888">Log in to interact.</p>';
    }

    var fields = { 'Pronouns': p.pronouns, 'Relationship': p.relationship, 'Registration': p.created ? new Date(p.created).toLocaleDateString() : '', 'Hometown': p.hometown, 'Political views': p.politics, 'Birth date': p.birthDate, 'Website': p.website, 'City': p.city, 'Interests': p.interests, 'About': p.about };
    var fEl = $('#profFields'); fEl.innerHTML = '';
    Object.keys(fields).forEach(function(k) {
      if (!fields[k]) return;
      var d = document.createElement('div'); d.className = 'profile-field';
      d.innerHTML = '<div class="lbl">' + k + '</div><div>' + esc(fields[k]) + '</div>';
      fEl.appendChild(d);
    });
    if (p.custom) Object.keys(p.custom).forEach(function(k) {
      if (!p.custom[k]) return;
      var d = document.createElement('div'); d.className = 'profile-field';
      d.innerHTML = '<div class="lbl">' + esc(k) + '</div><div>' + esc(p.custom[k]) + '</div>'; fEl.appendChild(d);
    });

    var favEl = $('#favCards'); favEl.innerHTML = '';
    [['films', 'Favorite films'], ['tv', 'Favorite TV shows'], ['books', 'Favorite books'], ['games', 'Favorite games']].forEach(function(g) {
      var val = p[g[0]]; if (!val) return;
      val.split(',').forEach(function(t) {
        t = t.trim(); if (!t) return;
        var card = document.createElement('div'); card.className = 'fav-card';
        card.innerHTML = '<img src="" loading="lazy"><div class="t">' + esc(t) + '</div>';
        favEl.appendChild(card);
        fetchFavImage(t).then(function(url) { if (url) card.querySelector('img').src = url; });
        card.onclick = function() { window.openModal('<img src="' + (card.querySelector('img').src || '') + '" style="max-width:100%;max-height:70vh;display:block;margin:0 auto">'); };
      });
    });
    if (!favEl.children.length) favEl.innerHTML = '<p style="color:#888;font-size:12px">No favorites yet.</p>';

    if (S.user) $('#wallForm').style.display = 'block';
    $('#wallPost').onclick = function() { postWall(uid); };
    if ($('#wallSticker')) $('#wallSticker').onclick = function() { if (window.pickSticker) window.pickSticker(function(url) { $('#wallText').value += '\n[sticker]' + url + '[/sticker]'; }); };
    loadWall(uid);

    if (S.user && !isMe) FB.db.ref('blocks/' + S.user.uid + '/' + uid).get().then(function(s) { if (s.exists()) $('#wallForm').style.display = 'none'; });
  }

  function fetchFavImage(title) {
    return FB.db.ref('favCache/' + encodeURIComponent(title.toLowerCase().slice(0, 60))).get().then(function(s) {
      if (s.exists()) return s.val();
      return fetch('https://en.wikipedia.org/w/api.php?action=query&titles=' + encodeURIComponent(title) + '&prop=pageimages&format=json&pithumbsize=300&origin=*')
        .then(function(r) { return r.json(); }).then(function(d) {
          var pages = d.query && d.query.pages; if (!pages) return '';
          var page = Object.keys(pages).map(function(k) { return pages[k]; })[0];
          var url = (page && page.thumbnail && page.thumbnail.source) || '';
          if (url) FB.db.ref('favCache/' + encodeURIComponent(title.toLowerCase().slice(0, 60))).set(url);
          return url;
        }).catch(function() { return ''; });
    });
  }

  function editProfile(p) {
    var fields = ['displayName', 'status', 'pronouns', 'relationship', 'hometown', 'politics', 'birthDate', 'website', 'city', 'interests', 'films', 'tv', 'books', 'games', 'about'];
    var labels = ['Display name', 'Status', 'Pronouns', 'Relationship', 'Hometown', 'Political views', 'Birth date', 'Website', 'City', 'Interests', 'Favorite films', 'Favorite TV shows', 'Favorite books', 'Favorite games', 'About'];
    var html = '<h3>Edit profile</h3>';
    fields.forEach(function(f, i) { html += '<div style="margin-bottom:6px"><label style="font-size:12px;color:#888">' + labels[i] + '</label><input id="pf_' + f + '" value="' + esc(p[f] || '') + '"></div>'; });
    html += '<div style="margin-bottom:6px"><label style="font-size:12px;color:#888">Custom fields (key = value per line)</label><textarea id="pf_custom">' + Object.keys(p.custom || {}).map(function(k) { return k + ' = ' + p.custom[k]; }).join('\n') + '</textarea></div>';
    html += '<div style="margin-bottom:6px"><label style="font-size:12px;color:#888">Avatar</label><input type="file" id="pf_avatar" accept="image/*"></div><button id="pfSave">Save</button>';
    window.openModal(html);
    $('#pfSave').onclick = function() {
      var data = {};
      fields.forEach(function(f) { data[f] = $('#pf_' + f).value; });
      data.custom = {};
      ($('#pf_custom').value || '').split('\n').forEach(function(l) { var i = l.indexOf('='); if (i > 0) data.custom[l.slice(0, i).trim()] = l.slice(i + 1).trim(); });
      var f = $('#pf_avatar').files[0];
      var chain = f ? window.withUpload(f, 'avatar').then(function(u) { data.avatar = u; }) : Promise.resolve();
      chain.then(function() { return FB.db.ref('users/' + S.user.uid).update(data); })
        .then(function() { window.closeModal(); if (data.displayName) location.hash = '#/u/' + data.displayName.toLowerCase(); })
        .catch(function(e) { alert(e.message); });
    };
  }

  function loadWall(uid) {
    FB.db.ref('wall/' + uid).on('value', function(s) {
      var w = s.val() || {}, el = $('#wallPosts'); if (!el) return;
      el.innerHTML = '';
      Object.keys(w).map(function(id) { var o = { id: id }; for (var k in w[id]) o[k] = w[id][k]; return o; })
        .sort(function(a, b) { return b.created - a.created; }).forEach(function(x) {
          var d = document.createElement('div'); d.className = 'post';
          var body = '';
          if (x.type === 'repost' && x.data) {
            body = '<div style="border-left:3px solid #ff6600;padding-left:10px;margin:4px 0"><small style="color:#888">Reposted from ' + esc(x.data.name) + '</small>' +
              '<div>' + (x.data.title ? '<b>' + esc(x.data.title) + '</b>' : '') + (x.data.body ? '<p>' + window.renderBody(x.data.body.slice(0, 300)) + '</p>' : '') + (x.data.img ? '<img src="' + x.data.img + '" style="max-height:200px">' : '') + '</div></div>';
          } else {
            body = window.renderBody(x.text) + (x.img ? '<img src="' + x.img + '" style="max-height:300px">' : '');
          }
          d.innerHTML = '<div class="post-header"><a class="name" href="#/u/' + esc(x.name) + '">' + esc(x.name) + '</a><span>' + new Date(x.created).toLocaleString() + '</span></div>' +
            '<div class="post-body">' + body + '</div>';
          el.appendChild(d);
        });
      if (!el.children.length) el.innerHTML = '<p style="color:#888;font-size:12px">No wall posts yet.</p>';
    });
  }

  function postWall(uid) {
    var text = $('#wallText').value, f = $('#wallFile').files[0], img = '';
    var chain = f ? window.withUpload(f, 'img').then(function(u) { img = u; }) : Promise.resolve();
    chain.then(function() { return FB.db.ref('wall/' + uid).push({ text: text, img: img, uid: S.user.uid, name: S.me.displayName, created: Date.now() }); })
      .then(function() { if (uid !== S.user.uid) notify(uid, { type: 'wall', from: S.me.displayName }); $('#wallText').value = ''; $('#wallFile').value = ''; })
      .catch(function(e) { alert(e.message); });
  }

  window.renderMembers = function() {
    $('#content').innerHTML = '<h2>Members</h2><div style="margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap">' +
      '<input id="memSearch" placeholder="Search..." style="flex:1;min-width:150px">' +
      '<select id="memPronoun" style="width:auto"><option value="">Any pronouns</option><option>he/him</option><option>she/her</option><option>they/them</option><option>any</option></select></div>' +
      '<div id="membersList" class="members-list"></div>';
    var render = function() {
      var q = ($('#memSearch').value || '').toLowerCase(), pr = $('#memPronoun').value;
      FB.db.ref('users').once('value', function(s) {
        var u = s.val() || {}, el = $('#membersList'); el.innerHTML = '';
        Object.keys(u).forEach(function(uid) {
          var p = u[uid];
          if (!p.displayName || (q && p.displayName.toLowerCase().indexOf(q) === -1) || (pr && p.pronouns !== pr)) return;
          var d = document.createElement('div'); d.className = 'member-row';
          d.innerHTML = '<img src="' + (p.avatar || '') + '"><a href="#/u/' + esc(p.displayName) + '">' + esc(p.displayName) + '</a>' +
            (p.pronouns ? '<span style="color:#888;font-size:11px">' + esc(p.pronouns) + '</span>' : '') +
            (p.status ? '<span style="color:#888;font-size:11px;flex:1;text-align:right">' + esc(p.status) + '</span>' : '');
          el.appendChild(d);
        });
      });
    };
    $('#memSearch').oninput = render; $('#memPronoun').onchange = render; render();
  };

  window.renderDMs = function() {
    if (!S.user) { $('#content').innerHTML = '<p>Log in to view messages.</p>'; return; }
    $('#content').innerHTML = '<h2>Messages</h2><p style="color:#888;font-size:12px;margin-bottom:8px">Pick a user to chat with.</p><div id="dmList" class="members-list"></div><div id="dmConvo" style="margin-top:16px"></div>';
    FB.db.ref('users').once('value', function(s) {
      var u = s.val() || {}, el = $('#dmList'); el.innerHTML = '';
      Object.keys(u).forEach(function(uid) {
        if (uid === S.user.uid || !u[uid].displayName) return;
        var d = document.createElement('div'); d.className = 'member-row'; d.style.cursor = 'pointer';
        d.innerHTML = '<img src="' + (u[uid].avatar || '') + '"><b>' + esc(u[uid].displayName) + '</b>';
        d.onclick = function() { openDM(uid, u[uid].displayName); };
        el.appendChild(d);
      });
    });
  };

  function openDM(uid, name) {
    var convo = [S.user.uid, uid].sort().join('_'), el = $('#dmConvo');
    el.innerHTML = '<h3>Chat with ' + esc(name) + '</h3><div id="dmMessages" style="max-height:400px;overflow-y:auto;background:#1e1e1e;border:1px solid #2e2e2e;border-radius:8px;padding:8px;margin-bottom:8px"></div>' +
      '<div style="display:flex;gap:6px"><input id="dmInput" placeholder="Message..." style="flex:1"><button id="dmSend">Send</button><button id="dmSticker" class="btn-sm btn-gray">😀</button></div>';
    FB.db.ref('dms/' + convo).on('value', function(s) {
      var m = s.val() || {}, box = $('#dmMessages'); if (!box) return; box.innerHTML = '';
      Object.keys(m).sort(function(a, b) { return m[a].t - m[b].t; }).forEach(function(id) {
        var x = m[id], d = document.createElement('div');
        d.style.marginBottom = '6px'; d.style.textAlign = x.uid === S.user.uid ? 'right' : 'left';
        d.innerHTML = '<small style="color:#888">' + esc(x.name) + '</small><br><span style="background:' + (x.uid === S.user.uid ? '#ff6600' : '#2e2e2e') + ';padding:6px 10px;border-radius:12px;display:inline-block;max-width:80%">' + window.renderBody(x.text) + '</span>';
        box.appendChild(d);
      });
      box.scrollTop = box.scrollHeight;
    });
    var send = function() {
      var v = $('#dmInput').value.trim(); if (!v) return;
      FB.db.ref('dms/' + convo).push({ uid: S.user.uid, name: S.me.displayName, text: v, t: Date.now() });
      notify(uid, { type: 'dm', from: S.me.displayName }); $('#dmInput').value = '';
    };
    $('#dmSend').onclick = send;
    $('#dmInput').onkeydown = function(e) { if (e.key === 'Enter') send(); };
    $('#dmSticker').onclick = function() { if (window.pickSticker) window.pickSticker(function(url) { FB.db.ref('dms/' + convo).push({ uid: S.user.uid, name: S.me.displayName, text: '[sticker]' + url + '[/sticker]', t: Date.now() }); }); };
  }

  window.renderGroups = function() {
    var html = '<h2>Groups</h2>';
    if (S.user) html += '<div class="post"><h3>Create group</h3><input id="gName" placeholder="Name"><textarea id="gDesc" placeholder="Description" style="margin:8px 0"></textarea><button id="gCreate">Create</button></div>';
    html += '<div id="groupList"></div>';
    $('#content').innerHTML = html;
    if (S.user) $('#gCreate').onclick = function() {
      var n = $('#gName').value.trim(); if (!n) return;
      FB.db.ref('groups').push({ name: n, desc: $('#gDesc').value, by: S.user.uid, byName: S.me.displayName, created: Date.now(), members: {} });
      $('#gName').value = ''; $('#gDesc').value = '';
    };
    FB.db.ref('groups').on('value', function(s) {
      var g = s.val() || {}, el = $('#groupList'); el.innerHTML = '';
      Object.keys(g).forEach(function(id) {
        var x = g[id], d = document.createElement('div'); d.className = 'post';
        d.innerHTML = '<h3>' + esc(x.name) + '</h3><p style="color:#888">' + esc(x.desc || '') + '</p>' +
          '<small style="color:#888">By ' + esc(x.byName) + ' · ' + Object.keys(x.members || {}).length + ' members</small> ' +
          (S.user ? '<button class="joinBtn btn-sm" data-id="' + id + '">Join/Leave</button>' : '');
        el.appendChild(d);
      });
      Array.prototype.forEach.call(el.querySelectorAll('.joinBtn'), function(b) {
        b.onclick = function() {
          var p = 'groups/' + b.dataset.id + '/members/' + S.user.uid;
          FB.db.ref(p).get().then(function(s) { if (s.exists()) FB.db.ref(p).remove(); else FB.db.ref(p).set(true); });
        };
      });
    });
  };

  window.renderStickers = function() {
    var html = '<h2>Stickers</h2><p style="color:#888;font-size:12px;margin-bottom:12px">Public archive. Max ' + (FB.LIMITS.sticker / 1024) + ' KB each.</p>';
    if (S.user) html += '<div class="post"><input type="file" id="stickerUpload" accept="image/*"> <button id="stickerUp">Upload sticker</button></div>';
    html += '<div id="stickerArchive" class="sticker-grid"></div>';
    $('#content').innerHTML = html;
    if (S.user) $('#stickerUp').onclick = function() {
      var f = $('#stickerUpload').files[0]; if (!f) return;
      window.withUpload(f, 'sticker').then(function(url) { FB.db.ref('stickers').push({ url: url, by: S.me.displayName, uid: S.user.uid, created: Date.now() }); $('#stickerUpload').value = ''; }).catch(function(e) { alert(e.message); });
    };
    FB.db.ref('stickers').on('value', function(s) {
      var st = s.val() || {}, el = $('#stickerArchive'); el.innerHTML = '';
      Object.keys(st).forEach(function(id) {
        var x = st[id], img = document.createElement('img');
        img.src = x.url; img.title = 'By ' + (x.by || '?');
        img.onclick = function() { if (window._stickerCb) { window._stickerCb(x.url); window.closeModal(); window._stickerCb = null; } };
        el.appendChild(img);
      });
    });
  };

  window.pickSticker = function(cb) {
    FB.db.ref('stickers').once('value', function(s) {
      var st = s.val() || {}, html = '<h3>Pick a sticker</h3><div class="sticker-grid" id="pickGrid"></div>';
      window.openModal(html); window._stickerCb = cb;
      var el = $('#pickGrid');
      Object.keys(st).forEach(function(id) {
        var img = document.createElement('img'); img.src = st[id].url;
        img.onclick = function() { cb(st[id].url); window.closeModal(); window._stickerCb = null; };
        el.appendChild(img);
      });
      if (!el.children.length) el.innerHTML = '<p style="color:#888">No stickers yet.</p>';
    });
  };

  window.renderMusic = function() {
    $('#content').innerHTML = '<h2>Music</h2>' + (S.user ? '<div class="post"><input type="file" id="musicFile" accept="audio/*"> <button id="musicUp">Upload audio</button><p style="font-size:11px;color:#888;margin-top:6px">Max ' + (FB.LIMITS.audio / 1048576) + ' MB.</p></div>' : '<p style="color:#888">Log in to upload.</p>') + '<div id="musicList"></div>';
    if (S.user) $('#musicUp').onclick = function() {
      var f = $('#musicFile').files[0]; if (!f) return;
      window.withUpload(f, 'audio').then(function(url) { FB.db.ref('music').push({ name: f.name, url: url, by: S.me.displayName, uid: S.user.uid, created: Date.now() }); }).catch(function(e) { alert(e.message); });
    };
    FB.db.ref('music').on('value', function(s) {
      var m = s.val() || {}, el = $('#musicList'); el.innerHTML = '';
      Object.keys(m).sort(function(a, b) { return m[b].created - m[a].created; }).forEach(function(id) {
        var x = m[id], d = document.createElement('div'); d.className = 'music-widget';
        d.innerHTML = '<div style="width:20px;height:20px;background:#ff6600;border-radius:4px"></div><span style="flex:0 0 auto;font-size:12px">' + esc(x.name) + '</span><audio controls preload="none" src="' + x.url + '" style="flex:1;min-width:100px;height:32px"></audio>';
        el.appendChild(d);
      });
    });
  };

  FB.auth.onAuthStateChanged(function(u) {
    if (!u) { var c = $('#notifCount'); if (c) c.textContent = '0'; return; }
    FB.db.ref('notifications/' + u.uid).on('value', function(s) {
      var n = s.val() || {}, unseen = Object.keys(n).filter(function(k) { return !n[k].seen; }), c = $('#notifCount');
      if (c) { c.textContent = unseen.length; c.style.color = unseen.length ? '#ff6600' : ''; }
    });
    var bell = $('#notifBell');
    if (bell && !bell._bound) {
      bell._bound = true;
      bell.onclick = function() {
        FB.db.ref('notifications/' + u.uid).once('value').then(function(s) {
          var n = s.val() || {}, html = '<h3>Notifications</h3>';
          var items = Object.keys(n).sort(function(a, b) { return n[b].created - n[a].created; }).slice(0, 30);
          if (!items.length) html += '<p style="color:#888">Nothing yet.</p>';
          items.forEach(function(id) { var x = n[id]; html += '<div style="background:#141414;padding:8px;margin-bottom:6px;border-radius:6px"><b>' + esc(x.from) + '</b> ' + x.type + 'd you <small style="color:#888">(' + new Date(x.created).toLocaleString() + ')</small></div>'; });
          html += '<button id="clearNotif" class="btn-sm btn-gray">Mark all as read</button>';
          window.openModal(html);
          $('#clearNotif').onclick = function() { Object.keys(n).forEach(function(id) { FB.db.ref('notifications/' + u.uid + '/' + id + '/seen').set(true); }); window.closeModal(); };
        });
      };
    }
  });
});
