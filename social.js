(function () {
  var $ = function (s) { return document.querySelector(s); };

  // ---------------- Profile page ----------------
  window.renderUserPage = function (name) {
    name = decodeURIComponent(name || '').toLowerCase();
    FB.db.ref('nameMap/' + name).get().then(function (s) {
      if (!s.exists()) { $('#content').innerHTML = '<p>User not found.</p>'; return; }
      var uid = s.val().uid;
      FB.db.ref('users/' + uid).on('value', function (snap) {
        var p = snap.val() || { displayName: name };
        renderProfile(uid, p);
      });
    });
  };

  function renderProfile(uid, p) {
    var c = $('#content');
    var isMe = S.user && S.user.uid === uid;
    var html =
      '<div class="profile-header">' +
      '<img src="' + (p.avatar || '') + '" alt="" id="profAvatar" style="background:var(--bd)">' +
      '<div style="flex:1;min-width:200px">' +
      '<h2>' + esc(p.displayName) + (p.pronouns ? ' <span style="font-size:14px;color:var(--dim)">(' + esc(p.pronouns) + ')</span>' : '') + '</h2>' +
      '<p style="color:var(--dim);margin:4px 0">' + esc(p.status || '') + '</p>' +
      '<div id="profActions"></div>' +
      '</div></div>' +
      '<div class="profile-grid" id="profFields"></div>' +
      '<h3 style="margin:16px 0 8px">Favorites</h3>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px" id="favCards"></div>' +
      '<h3 style="margin:16px 0 8px">Wall</h3>' +
      '<div id="wallForm" class="hidden" style="margin-bottom:12px">' +
      '<textarea id="wallText" placeholder="Write on ' + esc(p.displayName) + '\'s wall..."></textarea>' +
      '<input type="file" id="wallFile" accept="image/*" style="margin:8px 0">' +
      '<button id="wallPost">Post</button> ' +
      '<button id="wallSticker" class="btn-sm btn-gray">😀 Sticker</button>' +
      '</div>' +
      '<div id="wallPosts"></div>';
    c.innerHTML = html;

    // actions
    var actions = $('#profActions');
    if (isMe) {
      actions.innerHTML = '<button id="editProf" class="btn-sm">Edit profile</button>';
      $('#editProf').onclick = function () { editProfile(p); };
    } else if (S.user) {
      actions.innerHTML = '<button id="subBtn" class="btn-sm">Subscribe</button> ' +
        '<button id="blockBtn" class="btn-sm btn-gray">Block</button>';
      FB.db.ref('subscriptions/' + S.user.uid + '/' + uid).on('value', function (s) {
        $('#subBtn').textContent = s.exists() ? 'Unsubscribe' : 'Subscribe';
      });
      FB.db.ref('blocks/' + S.user.uid + '/' + uid).on('value', function (s) {
        $('#blockBtn').textContent = s.exists() ? 'Unblock' : 'Block';
      });
      $('#subBtn').onclick = function () {
        FB.db.ref('subscriptions/' + S.user.uid + '/' + uid).get().then(function (s) {
          if (s.exists()) {
            FB.db.ref('subscriptions/' + S.user.uid + '/' + uid).remove();
            FB.db.ref('subscribers/' + uid + '/' + S.user.uid).remove();
          } else {
            FB.db.ref('subscriptions/' + S.user.uid + '/' + uid).set(true);
            FB.db.ref('subscribers/' + uid + '/' + S.user.uid).set(true);
            window.notify(uid, { type: 'subscribe', from: S.me.displayName });
          }
        });
      };
      $('#blockBtn').onclick = function () {
        FB.db.ref('blocks/' + S.user.uid + '/' + uid).get().then(function (s) {
          if (s.exists()) FB.db.ref('blocks/' + S.user.uid + '/' + uid).remove();
          else FB.db.ref('blocks/' + S.user.uid + '/' + uid).set(true);
        });
      };
    } else {
      actions.innerHTML = '<p style="font-size:12px;color:var(--dim)">Log in to interact.</p>';
    }

    // fields
    var fields = {
      'Pronouns': p.pronouns,
      'Relationship': p.relationship,
      'Registration': p.created ? new Date(p.created).toLocaleDateString() : '',
      'Hometown': p.hometown,
      'Political views': p.politics,
      'Birth date': p.birthDate,
      'Website': p.website,
      'City': p.city,
      'Interests': p.interests,
      'About': p.about
    };
    var fEl = $('#profFields'); fEl.innerHTML = '';
    Object.keys(fields).forEach(function (k) {
      if (!fields[k]) return;
      var d = document.createElement('div');
      d.className = 'profile-field';
      d.innerHTML = '<div class="lbl">' + k + '</div><div>' + esc(fields[k]) + '</div>';
      fEl.appendChild(d);
    });
    if (p.custom && typeof p.custom === 'object') {
      Object.keys(p.custom).forEach(function (k) {
        if (!p.custom[k]) return;
        var d = document.createElement('div');
        d.className = 'profile-field';
        d.innerHTML = '<div class="lbl">' + esc(k) + '</div><div>' + esc(p.custom[k]) + '</div>';
        fEl.appendChild(d);
      });
    }

    // favorites as Discord-style cards
    var favEl = $('#favCards'); favEl.innerHTML = '';
    var favGroups = [
      ['films', 'Favorite films'],
      ['tv', 'Favorite TV shows'],
      ['books', 'Favorite books'],
      ['games', 'Favorite games']
    ];
    favGroups.forEach(function (g) {
      var val = p[g[0]];
      if (!val) return;
      val.split(',').forEach(function (t) {
        t = t.trim(); if (!t) return;
        var card = document.createElement('div');
        card.className = 'fav-card';
        card.innerHTML = '<img alt="" src="" loading="lazy"><div class="t">' + esc(t) + '</div>';
        favEl.appendChild(card);
        fetchFavImage(t).then(function (url) { if (url) card.querySelector('img').src = url; });
        card.onclick = function () {
          window.openModal('<img src="' + (card.querySelector('img').src || '') + '" style="max-width:100%;max-height:70vh;display:block;margin:0 auto">' +
            '<p style="text-align:center;margin-top:8px">' + esc(t) + '</p>');
        };
      });
    });
    if (!favEl.children.length) favEl.innerHTML = '<p style="color:var(--dim);font-size:12px">No favorites yet.</p>';

    // wall
    if (S.user) $('#wallForm').classList.remove('hidden');
    $('#wallPost').onclick = function () { postWall(uid, p.displayName); };
    if ($('#wallSticker')) $('#wallSticker').onclick = function () {
      if (!window.pickSticker) return;
      window.pickSticker(function (url) { $('#wallText').value += '\n[sticker]' + url + '[/sticker]'; });
    };
    loadWall(uid);

    // blocked?
    if (S.user && !isMe) {
      FB.db.ref('blocks/' + S.user.uid + '/' + uid).get().then(function (s) {
        if (s.exists()) $('#wallForm').classList.add('hidden');
      });
    }
  }

  // fetch Wikipedia thumbnail, cached in DB
  var favCache = {};
  function fetchFavImage(title) {
    var key = title.toLowerCase().slice(0, 60);
    if (favCache[key] !== undefined) return Promise.resolve(favCache[key]);
    return FB.db.ref('favCache/' + encodeURIComponent(key)).get().then(function (s) {
      if (s.exists()) { favCache[key] = s.val(); return s.val(); }
      return fetch('https://en.wikipedia.org/w/api.php?action=query&titles=' +
        encodeURIComponent(title) + '&prop=pageimages&format=json&pithumbsize=300&origin=*')
        .then(function (r) { return r.json(); })
        .then(function (d) {
          var pages = d.query && d.query.pages;
          if (!pages) return '';
          var page = Object.keys(pages).map(function (k) { return pages[k]; })[0];
          var url = (page && page.thumbnail && page.thumbnail.source) || '';
          favCache[key] = url;
          if (url) FB.db.ref('favCache/' + encodeURIComponent(key)).set(url);
          return url;
        }).catch(function () { return ''; });
    });
  }

  // edit profile
  function editProfile(p) {
    var fields = ['displayName', 'status', 'pronouns', 'relationship', 'hometown', 'politics', 'birthDate', 'website', 'city', 'interests', 'films', 'tv', 'books', 'games', 'about'];
    var labels = ['Display name', 'Status', 'Pronouns', 'Relationship', 'Hometown', 'Political views', 'Birth date', 'Website', 'City', 'Interests', 'Favorite films', 'Favorite TV shows', 'Favorite books', 'Favorite games', 'About'];
    var html = '<h3>Edit profile</h3>';
    fields.forEach(function (f, i) {
      var v = p[f] || '';
      if (f === 'about' || f === 'interests') {
        html += '<div class="form-row"><label>' + labels[i] + '</label><textarea id="pf_' + f + '" style="min-height:60px">' + esc(v) + '</textarea></div>';
      } else {
        html += '<div class="form-row"><label>' + labels[i] + '</label><input id="pf_' + f + '" value="' + esc(v) + '"></div>';
      }
    });
    html += '<div class="form-row"><label>Custom fields (one per line: key = value)</label><textarea id="pf_custom" style="min-height:60px">' +
      Object.keys(p.custom || {}).map(function (k) { return k + ' = ' + p.custom[k]; }).join('\n') + '</textarea></div>';
    html += '<div class="form-row"><label>Avatar</label><input type="file" id="pf_avatar" accept="image/*"></div>';
    html += '<button id="pfSave">Save</button>';

    var m = window.openModal(html);
    $('#pfSave').onclick = function () {
      var data = {};
      fields.forEach(function (f) { data[f] = $('#pf_' + f).value; });
      data.custom = {};
      ($('#pf_custom').value || '').split('\n').forEach(function (line) {
        var idx = line.indexOf('=');
        if (idx > 0) data.custom[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
      });
      var f = $('#pf_avatar').files[0];
      var chain = f ? window.withUpload(f, 'avatar').then(function (u) { data.avatar = u; }) : Promise.resolve();
      chain.then(function () {
        return FB.db.ref('users/' + S.user.uid).update(data);
      }).then(function () {
        // update nameMap if name changed
        if (data.displayName && data.displayName !== p.displayName) {
          var newN = data.displayName.toLowerCase().replace(/[^a-z0-9_]/g, '');
          if (newN && newN !== p.displayName.toLowerCase()) {
            return FB.db.ref('nameMap/' + p.displayName.toLowerCase()).get().then(function (s) {
              if (s.exists()) return FB.db.ref('nameMap/' + newN).set(s.val()).then(function () {
                return FB.db.ref('nameMap/' + p.displayName.toLowerCase()).remove();
              });
            });
          }
        }
      }).then(function () {
        window.closeModal();
        if (data.displayName) location.hash = '#/u/' + data.displayName.toLowerCase();
      }).catch(function (e) { alert(e.message); });
    };
  }

  // ---------------- Wall ----------------
  function loadWall(uid) {
    FB.db.ref('wall/' + uid).on('value', function (s) {
      var w = s.val() || {};
      var el = $('#wallPosts'); if (!el) return;
      el.innerHTML = '';
      var items = Object.keys(w).map(function (id) { var o = { id: id }; for (var k in w[id]) o[k] = w[id][k]; return o; })
        .sort(function (a, b) { return b.created - a.created; });
      items.forEach(function (x) {
        var d = document.createElement('div');
        d.className = 'post';
        var body = '';
        if (x.type === 'repost' && x.data) {
          body = '<div style="border-left:3px solid var(--o);padding-left:10px;margin:4px 0">' +
            '<small style="color:var(--dim)">Reposted from ' + esc(x.data.name || 'Anonymous') + '</small>' +
            '<div>' + (x.data.title ? '<b>' + esc(x.data.title) + '</b>' : '') +
            (x.data.body ? '<p>' + window.renderBody(x.data.body.slice(0, 300)) + '</p>' : '') +
            (x.data.img ? '<img src="' + x.data.img + '" style="max-height:200px">' : '') +
            '</div></div>';
        } else {
          body = window.renderBody(x.text) + (x.img ? '<img src="' + x.img + '" style="max-height:300px">' : '');
        }
        d.innerHTML =
          '<div class="post-header"><a class="name" href="#/u/' + esc(x.name) + '">' + esc(x.name || 'Anonymous') + '</a>' +
          '<span>' + new Date(x.created).toLocaleString() + '</span></div>' +
          '<div class="post-body">' + body + '</div>';
        el.appendChild(d);
      });
      if (!el.children.length) el.innerHTML = '<p style="color:var(--dim);font-size:12px">No wall posts yet.</p>';
    });
  }

  function postWall(uid, targetName) {
    var text = $('#wallText').value;
    var f = $('#wallFile').files[0];
    var chain = Promise.resolve();
    var img = '';
    if (f) chain = window.withUpload(f, 'img').then(function (u) { img = u; });
    chain.then(function () {
      return FB.db.ref('wall/' + uid).push({
        text: text, img: img, uid: S.user.uid, name: S.me.displayName, created: Date.now()
      });
    }).then(function () {
      if (uid !== S.user.uid) {
        window.notify(uid, { type: 'wall', from: S.me.displayName });
      }
      $('#wallText').value = ''; $('#wallFile').value = '';
    }).catch(function (e) { alert(e.message); });
  }

  // ---------------- Members ----------------
  window.renderMembers = function () {
    $('#content').innerHTML =
      '<h2>Members</h2>' +
      '<div style="margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap">' +
      '<input id="memSearch" placeholder="Search name..." style="flex:1;min-width:150px">' +
      '<select id="memPronoun" style="width:auto"><option value="">Any pronouns</option><option>he/him</option><option>she/her</option><option>they/them</option><option>any</option></select>' +
      '</div>' +
      '<div id="membersList" class="members-list"></div>';
    var render = function () {
      var q = ($('#memSearch').value || '').toLowerCase();
      var pr = $('#memPronoun').value;
      FB.db.ref('users').once('value', function (s) {
        var u = s.val() || {};
        var el = $('#membersList'); el.innerHTML = '';
        Object.keys(u).forEach(function (uid) {
          var p = u[uid];
          if (!p.displayName) return;
          if (q && p.displayName.toLowerCase().indexOf(q) === -1) return;
          if (pr && p.pronouns !== pr) return;
          var d = document.createElement('div');
          d.className = 'member-row';
          d.innerHTML = '<img src="' + (p.avatar || '') + '" alt="">' +
            '<a href="#/u/' + esc(p.displayName) + '">' + esc(p.displayName) + '</a>' +
            (p.pronouns ? '<span style="color:var(--dim);font-size:11px">' + esc(p.pronouns) + '</span>' : '') +
            (p.status ? '<span style="color:var(--dim);font-size:11px;flex:1;text-align:right">' + esc(p.status) + '</span>' : '');
          el.appendChild(d);
        });
      });
    };
    $('#memSearch').oninput = render;
    $('#memPronoun').onchange = render;
    render();
  };

  // ---------------- DMs ----------------
  window.renderDMs = function () {
    if (!S.user) { $('#content').innerHTML = '<p>Log in to view messages.</p>'; return; }
    $('#content').innerHTML =
      '<h2>Messages</h2>' +
      '<p style="color:var(--dim);font-size:12px;margin-bottom:8px">Pick a user to chat with.</p>' +
      '<div id="dmList" class="members-list"></div>' +
      '<div id="dmConvo" style="margin-top:16px"></div>';
    FB.db.ref('users').once('value', function (s) {
      var u = s.val() || {};
      var el = $('#dmList'); el.innerHTML = '';
      Object.keys(u).forEach(function (uid) {
        if (uid === S.user.uid || !u[uid].displayName) return;
        var d = document.createElement('div');
        d.className = 'member-row';
        d.style.cursor = 'pointer';
        d.innerHTML = '<img src="' + (u[uid].avatar || '') + '" alt=""><b>' + esc(u[uid].displayName) + '</b>';
        d.onclick = function () { openDM(uid, u[uid].displayName); };
        el.appendChild(d);
      });
    });
  };

  function openDM(uid, name) {
    var convo = [S.user.uid, uid].sort().join('_');
    var el = $('#dmConvo');
    el.innerHTML =
      '<h3>Chat with ' + esc(name) + '</h3>' +
      '<div id="dmMessages" style="max-height:400px;overflow-y:auto;background:var(--pnl);border:1px solid var(--bd);border-radius:8px;padding:8px;margin-bottom:8px"></div>' +
      '<div style="display:flex;gap:6px">' +
      '<input id="dmInput" placeholder="Message..." style="flex:1">' +
      '<button id="dmSend">Send</button>' +
      '<button id="dmSticker" class="btn-sm btn-gray" title="Sticker">😀</button>' +
      '</div>';
    FB.db.ref('dms/' + convo).on('value', function (s) {
      var m = s.val() || {};
      var box = $('#dmMessages'); if (!box) return;
      box.innerHTML = '';
      Object.keys(m).sort(function (a, b) { return m[a].t - m[b].t; }).forEach(function (id) {
        var x = m[id];
        var d = document.createElement('div');
        d.style.marginBottom = '6px';
        d.style.textAlign = x.uid === S.user.uid ? 'right' : 'left';
        d.innerHTML = '<small style="color:var(--dim)">' + esc(x.name) + '</small><br>' +
          '<span style="background:' + (x.uid === S.user.uid ? 'var(--o)' : 'var(--bd)') + ';padding:6px 10px;border-radius:12px;display:inline-block;max-width:80%">' +
          window.renderBody(x.text) + '</span>';
        box.appendChild(d);
      });
      box.scrollTop = box.scrollHeight;
    });
    var send = function () {
      var v = $('#dmInput').value.trim();
      if (!v) return;
      FB.db.ref('dms/' + convo).push({ uid: S.user.uid, name: S.me.displayName, text: v, t: Date.now() });
      FB.db.ref('notifications/' + uid).push({ type: 'dm', from: S.me.displayName, created: Date.now(), seen: false });
      $('#dmInput').value = '';
    };
    $('#dmSend').onclick = send;
    $('#dmInput').onkeydown = function (e) { if (e.key === 'Enter') send(); };
    $('#dmSticker').onclick = function () {
      if (!window.pickSticker) return;
      window.pickSticker(function (url) {
        FB.db.ref('dms/' + convo).push({ uid: S.user.uid, name: S.me.displayName, text: '[sticker]' + url + '[/sticker]', t: Date.now() });
      });
    };
  }

  // ---------------- Groups ----------------
  window.renderGroups = function () {
    var html = '<h2>Groups</h2>';
    if (S.user) html += '<div class="post"><h3>Create group</h3><input id="gName" placeholder="Group name"><textarea id="gDesc" placeholder="Description" style="margin:8px 0"></textarea><button id="gCreate">Create</button></div>';
    html += '<div id="groupList"></div>';
    $('#content').innerHTML = html;
    if (S.user) {
      $('#gCreate').onclick = function () {
        var n = $('#gName').value.trim(); if (!n) return;
        FB.db.ref('groups').push({
          name: n, desc: $('#gDesc').value, by: S.user.uid, byName: S.me.displayName, created: Date.now(), members: {}
        });
        $('#gName').value = ''; $('#gDesc').value = '';
      };
    }
    FB.db.ref('groups').on('value', function (s) {
      var g = s.val() || {};
      var el = $('#groupList'); el.innerHTML = '';
      Object.keys(g).forEach(function (id) {
        var x = g[id];
        var d = document.createElement('div');
        d.className = 'post';
        d.innerHTML = '<h3>' + esc(x.name) + '</h3><p style="color:var(--dim)">' + esc(x.desc || '') + '</p>' +
          '<small style="color:var(--dim)">By ' + esc(x.byName) + ' · ' + Object.keys(x.members || {}).length + ' members</small> ' +
          (S.user ? '<button class="joinBtn btn-sm" data-id="' + id + '">Join/Leave</button>' : '');
        el.appendChild(d);
      });
      el.querySelectorAll('.joinBtn').forEach(function (b) {
        b.onclick = function () {
          var p = 'groups/' + b.dataset.id + '/members/' + S.user.uid;
          FB.db.ref(p).get().then(function (s) {
            if (s.exists()) FB.db.ref(p).remove();
            else FB.db.ref(p).set(true);
          });
        };
      });
    });
  };

  // ---------------- Stickers ----------------
  window.renderStickers = function () {
    var html = '<h2>Stickers</h2><p style="color:var(--dim);font-size:12px;margin-bottom:12px">Public archive. Max ' + (FB.LIMITS.sticker / 1024) + ' KB each. GIF and APNG are supported.</p>';
    if (S.user) {
      html += '<div class="post"><input type="file" id="stickerUpload" accept="image/*"><button id="stickerUp" style="margin-left:8px">Upload sticker</button></div>';
    }
    html += '<div id="stickerArchive" class="sticker-grid"></div>';
    $('#content').innerHTML = html;
    if (S.user) {
      $('#stickerUp').onclick = function () {
        var f = $('#stickerUpload').files[0]; if (!f) return;
        window.withUpload(f, 'sticker').then(function (url) {
          FB.db.ref('stickers').push({ url: url, by: S.me.displayName, uid: S.user.uid, created: Date.now() });
          $('#stickerUpload').value = '';
        }).catch(function (e) { alert(e.message); });
      };
    }
    FB.db.ref('stickers').on('value', function (s) {
      var st = s.val() || {};
      var el = $('#stickerArchive'); el.innerHTML = '';
      Object.keys(st).forEach(function (id) {
        var x = st[id];
        var img = document.createElement('img');
        img.src = x.url;
        img.title = 'By ' + (x.by || '?');
        img.onclick = function () {
          if (window._stickerCb) { window._stickerCb(x.url); window.closeModal(); window._stickerCb = null; }
          else navigator.clipboard && navigator.clipboard.writeText(x.url);
        };
        el.appendChild(img);
      });
    });
  };

  window.pickSticker = function (cb) {
    FB.db.ref('stickers').once('value', function (s) {
      var st = s.val() || {};
      var html = '<h3>Pick a sticker</h3><div class="sticker-grid" id="pickGrid"></div>' +
        '<p style="color:var(--dim);font-size:11px;margin-top:8px">Manage in <a href="#/stickers">Stickers</a></p>';
      var m = window.openModal(html);
      window._stickerCb = cb;
      var el = m.querySelector('#pickGrid');
      Object.keys(st).forEach(function (id) {
        var img = document.createElement('img');
        img.src = st[id].url;
        img.onclick = function () { cb(st[id].url); window.closeModal(); window._stickerCb = null; };
        el.appendChild(img);
      });
      if (!el.children.length) el.innerHTML = '<p style="color:var(--dim)">No stickers yet.</p>';
    });
  };

  // ---------------- Music ----------------
  window.renderMusic = function () {
    $('#content').innerHTML =
      '<h2>Music</h2>' +
      (S.user ?
        '<div class="post"><input type="file" id="musicFile" accept="audio/*"> ' +
        '<button id="musicUp">Upload audio</button>' +
        '<p style="font-size:11px;color:var(--dim);margin-top:6px">Auto-compressed to ~64 kbps before upload. Max ' + (FB.LIMITS.audio / 1048576) + ' MB final size.</p></div>'
        : '<p style="color:var(--dim)">Log in to upload.</p>') +
      '<div id="musicList"></div>';
    if (S.user) {
      $('#musicUp').onclick = function () {
        var f = $('#musicFile').files[0]; if (!f) return;
        compressAudio(f).then(function (blob) {
          var file = new File([blob], f.name.replace(/\.[^.]+$/, '') + '.webm', { type: blob.type });
          return window.withUpload(file, 'audio');
        }).then(function (url) {
          FB.db.ref('music').push({ name: f.name, url: url, by: S.me.displayName, uid: S.user.uid, created: Date.now() });
        }).catch(function (e) { alert(e.message); });
      };
    }
    FB.db.ref('music').on('value', function (s) {
      var m = s.val() || {};
      var el = $('#musicList'); el.innerHTML = '';
      Object.keys(m).sort(function (a, b) { return m[b].created - m[a].created; }).forEach(function (id) {
        var x = m[id];
        var d = document.createElement('div');
        d.className = 'music-widget';
        d.innerHTML = '<div class="music-bars"><span></span><span></span><span></span></div>' +
          '<span style="flex:0 0 auto;font-size:12px">' + esc(x.name) + '</span>' +
          '<audio controls preload="none" src="' + x.url + '" style="flex:1;min-width:100px;height:32px"></audio>';
        el.appendChild(d);
      });
    });
  };

  function compressAudio(file) {
    if (file.size < 800 * 1024) return Promise.resolve(file);
    return new Promise(function (res) {
      var reader = new FileReader();
      reader.onload = function () {
        var Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return res(file);
        var ctx = new Ctx();
        ctx.decodeAudioData(reader.result, function (buf) {
          try {
            var dest = ctx.createMediaStreamDestination();
            var src = ctx.createBufferSource();
            src.buffer = buf; src.connect(dest);
            var rec = new MediaRecorder(dest.stream, { audioBitsPerSecond: 64000 });
            var chunks = [];
            rec.ondataavailable = function (e) { chunks.push(e.data); };
            rec.onstop = function () {
              var blob = new Blob(chunks, { type: 'audio/webm' });
              if (blob.size < file.size) res(blob); else res(file);
            };
            rec.start(); src.start();
            setTimeout(function () { try { src.stop(); rec.stop(); } catch (e) { res(file); } }, buf.duration * 1000);
          } catch (e) { res(file); }
        }, function () { res(file); });
      };
      reader.readAsArrayBuffer(file);
    });
  }

  // ---------------- Notifications bell ----------------
  if (window.S) {
    // bind when logged in
    FB.auth.onAuthStateChanged(function (u) {
      if (!u) { var c = $('#notifCount'); if (c) c.textContent = '0'; return; }
      FB.db.ref('notifications/' + u.uid).on('value', function (s) {
        var n = s.val() || {};
        var unseen = Object.keys(n).filter(function (k) { return !n[k].seen; });
        var c = $('#notifCount');
        if (c) { c.textContent = unseen.length; c.style.color = unseen.length ? 'var(--o)' : ''; }
      });
      var bell = $('#notifBell');
      if (bell && !bell._bound) {
        bell._bound = true;
        bell.onclick = function () {
          FB.db.ref('notifications/' + u.uid).once('value').then(function (s) {
            var n = s.val() || {};
            var html = '<h3>Notifications</h3>';
            var items = Object.keys(n).sort(function (a, b) { return n[b].created - n[a].created; }).slice(0, 30);
            if (!items.length) html += '<p style="color:var(--dim)">Nothing yet.</p>';
            items.forEach(function (id) {
              var x = n[id];
              html += '<div class="notif"><b>' + esc(x.from || '?') + '</b> ' + x.type + 'd you ' +
                '<small style="color:var(--dim)">(' + new Date(x.created).toLocaleString() + ')</small></div>';
            });
            html += '<button id="clearNotif" class="btn-sm btn-gray">Mark all as read</button>';
            window.openModal(html);
            $('#clearNotif').onclick = function () {
              Object.keys(n).forEach(function (id) { FB.db.ref('notifications/' + u.uid + '/' + id + '/seen').set(true); });
              window.closeModal();
            };
          });
        };
      }
    });
  }
})();