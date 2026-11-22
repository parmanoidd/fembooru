window.addEventListener('DOMContentLoaded', function() {
  if (!window.FB) return;
  var $ = function(s) { return document.querySelector(s); };
  var cursorEls = {}, myRef = null, lastCursor = { x: 0, y: 0 };

  $('#snowBtn').onclick = function() { if (!S.user) return alert('Log in first'); FB.db.ref('snow').set({ t: Date.now(), by: S.me.displayName }); };
  FB.db.ref('siteLogo').on('value', function(s) {
    var l = s.val(), img = $('#logoImg'); if (!img) return;
    if (l && l.url) img.src = l.url; else img.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48'><rect width='48' height='48' rx='8' fill='%23ff6600'/><text x='24' y='33' font-size='26' text-anchor='middle' fill='%23fff' font-family='sans-serif'>F</text></svg>";
  });
  FB.db.ref('siteIcon').on('value', function(s) {
    var i = s.val(), link = $('#favicon'); if (!link) return;
    if (i && i.url && Date.now() - i.t < 60000) link.href = i.url; else link.href = 'data:,';
  });
  FB.db.ref('snow').on('value', function(s) {
    var v = s.val(); if (!v || Date.now() - v.t > 60000 || document.querySelector('.snow')) return;
    for (var i = 0; i < 60; i++) {
      var el = document.createElement('div'); el.className = 'snow';
      el.style.left = Math.random() * 100 + '%'; el.style.animationDuration = (2 + Math.random() * 3) + 's'; el.style.animationDelay = Math.random() * 3 + 's';
      document.body.appendChild(el);
    }
    setTimeout(function() { [].forEach.call(document.querySelectorAll('.snow'), function(e) { e.remove(); }); }, 60000);
  });

  function debounce(fn, ms) { var t = null; return function() { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function() { fn.apply(c, a); }, ms); }; }
  var sendCursor = debounce(function(x, y) { if (!myRef || !S.me) return; lastCursor.x = x; lastCursor.y = y; myRef.set({ x: x, y: y, name: S.me.displayName, t: Date.now() }); }, 80);
  var onPointer = function(x, y) { sendCursor(x + window.pageXOffset, y + window.pageYOffset); };
  document.addEventListener('mousemove', function(e) { onPointer(e.clientX, e.clientY); });
  document.addEventListener('touchmove', function(e) { if (e.touches[0]) onPointer(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });

  FB.auth.onAuthStateChanged(function(u) {
    if (!u) { if (myRef) { myRef.remove(); myRef = null; } return; }
    myRef = FB.db.ref('cursors/' + u.uid);
    FB.db.ref('cursors/' + u.uid).remove();
    window.addEventListener('beforeunload', function() { if (myRef) myRef.remove(); });
  });

  FB.db.ref('cursors').on('value', function(s) {
    var all = s.val() || {};
    Object.keys(cursorEls).forEach(function(id) { var c = all[id]; if (!c || Date.now() - c.t > 15000 || (S.user && id === S.user.uid)) { cursorEls[id].remove(); delete cursorEls[id]; } });
    Object.keys(all).forEach(function(id) {
      if (S.user && id === S.user.uid) return;
      var c = all[id]; if (Date.now() - c.t > 15000) return;
      if (!cursorEls[id]) {
        var el = document.createElement('div'); el.className = 'cursor-tag';
        el.innerHTML = '<svg width="12" height="12" viewBox="0 0 16 16" fill="#ff6600"><path d="M0 0 L0 12 L3 9 L6 15 L8 14 L5 8 L9 8 Z"/></svg><span>' + esc(c.name) + '</span>';
        $('#cursorLayer').appendChild(el); cursorEls[id] = el;
      }
      cursorEls[id].style.left = (c.x - window.pageXOffset) + 'px'; cursorEls[id].style.top = (c.y - window.pageYOffset) + 'px';
    });
  });

  window.addEventListener('scroll', function() {
    FB.db.ref('cursors').once('value').then(function(s) {
      var all = s.val() || {};
      Object.keys(cursorEls).forEach(function(id) { var c = all[id]; if (!c) return; cursorEls[id].style.left = (c.x - window.pageXOffset) + 'px'; cursorEls[id].style.top = (c.y - window.pageYOffset) + 'px'; });
    });
  }, { passive: true });

  var chatActive = false;
  document.addEventListener('keydown', function(e) {
    if (chatActive || (document.activeElement && document.activeElement.matches('input,textarea,select'))) return;
    if (e.key === 'Shift' || e.key === '/') { if (!S.user) return; e.preventDefault(); openChatInput(); }
  });
  function openChatInput() {
    chatActive = true;
    var input = document.createElement('input'); input.placeholder = 'Say something...';
    input.style.cssText = 'position:fixed;z-index:60;background:#000;color:#fff;border:2px solid #ff6600;padding:8px;border-radius:8px;width:220px;left:50%;top:40%;transform:translate(-50%,-50%)';
    document.body.appendChild(input); input.focus();
    var cleanup = function() { chatActive = false; input.remove(); };
    input.onkeydown = function(e) { if (e.key === 'Enter') { if (input.value.trim()) sendChat(input.value.trim()); cleanup(); } if (e.key === 'Escape') cleanup(); };
    input.onblur = cleanup;
  }
  function sendChat(msg) { if (!S.user) return; FB.db.ref('chat').push({ uid: S.user.uid, name: S.me.displayName, msg: msg, x: lastCursor.x || (window.pageXOffset + 500), y: lastCursor.y || (window.pageYOffset + 500), t: Date.now() }); }
  FB.db.ref('chat').on('value', function(s) {
    var all = s.val() || {}, el = $('#chatLayer'); if (!el) return; el.innerHTML = '';
    Object.keys(all).forEach(function(id) {
      var m = all[id]; if (Date.now() - m.t > 8000) return;
      var d = document.createElement('div'); d.className = 'chat-bubble'; d.textContent = m.name + ': ' + m.msg;
      d.style.left = (m.x - window.pageXOffset) + 'px'; d.style.top = (m.y - window.pageYOffset) + 'px';
      el.appendChild(d);
    });
  });

  var propEls = {}, PROP_SOURCES = [function(i) { return 'https://picsum.photos/seed/' + i + '/60'; }, function(i) { return 'https://loremflickr.com/60/60?lock=' + i; }];
  function togglePropMenu() {
    var m = $('#propMenu'); m.classList.toggle('hidden');
    if (!m.classList.contains('hidden') && !m.children.length) {
      for (var i = 0; i < 12; i++) {
        var src = PROP_SOURCES[i % 2](i + 1), img = document.createElement('img'); img.src = src;
        (function(s) { img.onclick = function() { spawnProp(s); $('#propMenu').classList.add('hidden'); }; })(src);
        m.appendChild(img);
      }
    }
  }
  $('#propMenuBtn').onclick = togglePropMenu;
  document.addEventListener('keydown', function(e) { if (e.key.toLowerCase() === 'q' && document.activeElement && !document.activeElement.matches('input,textarea,select')) { e.preventDefault(); togglePropMenu(); } });
  function spawnProp(img) { if (!S.user) return; FB.db.ref('props').push().set({ img: img, owner: S.user.uid, x: window.pageXOffset + (window.innerWidth / 2 - 30), y: window.pageYOffset + (window.innerHeight / 2 - 30), vx: 0, vy: 0, rot: 0, spin: (Math.random() - 0.5) * 20 }); }
  FB.db.ref('props').on('value', function(s) {
    var all = s.val() || {};
    Object.keys(propEls).forEach(function(id) { if (!all[id]) { propEls[id].remove(); delete propEls[id]; } });
    Object.keys(all).forEach(function(id) {
      var p = all[id], el = propEls[id];
      if (!el) {
        el = document.createElement('img'); el.className = 'prop'; el.style.width = '60px'; el.style.height = '60px'; el.style.objectFit = 'cover'; el.draggable = false; el.src = p.img;
        $('#overlay').appendChild(el); propEls[id] = el; bindPropInteraction(id, el);
      }
      el.style.left = (p.x - window.pageXOffset) + 'px'; el.style.top = (p.y - window.pageYOffset) + 'px'; el.style.transform = 'rotate(' + (p.rot || 0) + 'deg)';
    });
  });
  function bindPropInteraction(id, el) {
    el.addEventListener('mousedown', function(e) {
      if (e.button === 2) { e.preventDefault(); startThrow(id, el); return; }
      e.preventDefault(); var startX = e.clientX, startY = e.clientY;
      FB.db.ref('props/' + id).once('value').then(function(s) {
        var p = s.val(); if (!p) return; var ox = p.x, oy = p.y;
        var mm = function(ev) { FB.db.ref('props/' + id).update({ x: ox + (ev.clientX - startX), y: oy + (ev.clientY - startY), vx: 0, vy: 0 }); };
        var mu = function() { document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu); };
        document.addEventListener('mousemove', mm); document.addEventListener('mouseup', mu);
      });
    });
    el.addEventListener('contextmenu', function(e) { e.preventDefault(); });
  }
  function startThrow(id, el) {
    if (!S.user) return; var startX = 0, startY = 0, startT = Date.now();
    FB.db.ref('props/' + id).once('value').then(function(s) {
      var p = s.val(); if (!p) return; startX = p.x; startY = p.y; startT = Date.now(); var lastX = startX, lastY = startY;
      var mm = function(ev) { var nx = ev.pageX - 30, ny = ev.pageY - 30; lastX = nx; lastY = ny; FB.db.ref('props/' + id).update({ x: nx, y: ny }); };
      var mu = function() {
        document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu);
        var dt = Math.max(16, Date.now() - startT), vx = (lastX - startX) / dt * 20, vy = (lastY - startY) / dt * 20;
        vx = Math.max(-40, Math.min(40, vx)); vy = Math.max(-40, Math.min(40, vy));
        FB.db.ref('props/' + id).update({ vx: vx, vy: vy, spin: (Math.random() - 0.5) * 30 });
      };
      document.addEventListener('mousemove', mm); document.addEventListener('mouseup', mu);
    });
  }
  setInterval(function() {
    if (!S.user) return;
    FB.db.ref('props').once('value').then(function(s) {
      var all = s.val() || {};
      Object.keys(all).forEach(function(id) {
        var p = all[id]; if (p.owner !== S.user.uid) return;
        if (Math.abs(p.vx) < 0.1 && Math.abs(p.vy) < 0.1 && p.y < window.pageYOffset + window.innerHeight - 60) return;
        var ny = p.y + (p.vy || 0), nvy = (p.vy || 0) + 0.8, nx = p.x + (p.vx || 0), nvx = (p.vx || 0) * 0.98, floor = window.pageYOffset + window.innerHeight - 70;
        if (ny > floor) { ny = floor; nvy = -nvy * 0.5; if (Math.abs(nvy) < 1) nvy = 0; }
        if (nx < 0) { nx = 0; nvx = -nvx * 0.5; }
        if (nx > window.pageXOffset + window.innerWidth - 60) { nx = window.pageXOffset + window.innerWidth - 60; nvx = -nvx * 0.5; }
        FB.db.ref('props/' + id).update({ x: nx, y: ny, vx: nvx, vy: nvy, rot: ((p.rot || 0) + (p.spin || 0)) % 360 });
      });
    });
  }, 100);

  var P = { x: 100, y: 200, vy: 0, active: false }, playerEl = $('#player');
  $('#walkBtn').onclick = function() { P.active = !P.active; playerEl.style.display = P.active ? 'block' : 'none'; $('#walkBtn').style.background = P.active ? '#ff6600' : '#2e2e2e'; };
  document.addEventListener('keydown', function(e) {
    if (!P.active || (document.activeElement && document.activeElement.matches('input,textarea,select'))) return;
    if (e.key === 'w' || e.key === 'ArrowUp' || e.key === ' ') { e.preventDefault(); if (P.vy === 0) P.vy = -12; }
    if (e.key === 'a' || e.key === 'ArrowLeft') { e.preventDefault(); P.x -= 15; }
    if (e.key === 'd' || e.key === 'ArrowRight') { e.preventDefault(); P.x += 15; }
  });
  setInterval(function() {
    if (!P.active) return;
    P.vy += 0.8; P.y += P.vy; var ground = window.innerHeight - 26;
    [].forEach.call(document.querySelectorAll('.post, .member-row, #topbar, button'), function(el) {
      var r = el.getBoundingClientRect();
      if (P.x + 24 > r.left && P.x < r.right && P.y + 24 > r.top && P.y < r.top + 20 && P.vy > 0) ground = Math.min(ground, r.top - 24);
    });
    if (P.y >= ground) { P.y = ground; P.vy = 0; }
    if (P.x < 0) P.x = 0; if (P.x > window.innerWidth - 24) P.x = window.innerWidth - 24;
    playerEl.style.left = P.x + 'px'; playerEl.style.top = P.y + 'px';
  }, 30);

  document.addEventListener('keydown', function(e) {
    if (e.key.toLowerCase() === 'f' && S.user && document.activeElement && !document.activeElement.matches('input,textarea,select')) {
      e.preventDefault();
      FB.db.ref('fireworks').push({ x: lastCursor.x || (window.pageXOffset + 500), y: lastCursor.y || (window.pageYOffset + 500), by: S.user.uid, t: Date.now() });
    }
  });
  FB.db.ref('fireworks').on('value', function(s) {
    var all = s.val() || {};
    Object.keys(all).forEach(function(id) {
      var f = all[id]; if (Date.now() - f.t > 3000) { FB.db.ref('fireworks/' + id).remove(); return; }
      if (document.getElementById('fw-' + id)) return;
      var el = document.createElement('div'); el.id = 'fw-' + id;
      el.style.cssText = 'position:absolute;width:8px;height:8px;border-radius:50%;background:#fff;box-shadow:0 0 20px #ff6600;z-index:24;pointer-events:none;transition:all 1s';
      el.style.left = (f.x - window.pageXOffset) + 'px'; el.style.top = (f.y - window.pageYOffset) + 'px';
      $('#overlay').appendChild(el); setTimeout(function() { el.style.transform = 'scale(8)'; el.style.opacity = '0'; }, 500);
      setTimeout(function() { el.remove(); }, 1500);
      FB.db.ref('props').once('value').then(function(ps) {
        var p = ps.val() || {};
        Object.keys(p).forEach(function(pid) {
          var pr = p[pid], dx = pr.x - f.x, dy = pr.y - f.y, d = Math.sqrt(dx * dx + dy * dy);
          if (d < 300 && d > 1) FB.db.ref('props/' + pid).update({ vx: (pr.vx || 0) + (dx / d) * 20, vy: (pr.vy || 0) + (dy / d) * 20 - 10 });
        });
      });
    });
  });

  window.renderPlace = function() {
    $('#content').innerHTML = '<h2>Place</h2><p style="color:#888;font-size:12px;margin-bottom:8px">Click to place a pixel. Stamp an image (auto-fit to 32×32).</p><div id="placeWrap"><img src="https://tile.openstreetmap.org/2/2/1.png" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.35;pointer-events:none"><canvas id="placeCanvas"></canvas><div class="place-changes" id="placeChanges"></div><div style="position:absolute;bottom:8px;left:8px;display:flex;gap:6px;align-items:center"><input type="color" id="placeColor" value="#ff6600" style="width:36px;height:32px;border:none;padding:0;cursor:pointer;border-radius:4px"><label style="background:#ff6600;color:#fff;padding:6px 10px;border-radius:6px;cursor:pointer;font-size:12px">Stamp image<input type="file" id="placeImg" accept="image/*" style="display:none"></label></div></div>';
    var canvas = $('#placeCanvas'), ctx = canvas.getContext('2d'), W = 300, H = 200;
    canvas.width = W; canvas.height = H; ctx.fillStyle = '#111'; ctx.fillRect(0, 0, W, H);
    canvas.onclick = function(e) {
      if (!S.user) return alert('Log in first');
      var r = canvas.getBoundingClientRect(), x = Math.floor((e.clientX - r.left) / r.width * W), y = Math.floor((e.clientY - r.top) / r.height * H);
      FB.db.ref('pixels').push({ x: x, y: y, c: $('#placeColor').value, by: S.me.displayName, t: Date.now() });
    };
    $('#placeImg').onchange = function(e) {
      var f = e.target.files[0]; if (!f || !S.user) return;
      var img = new Image();
      img.onload = function() {
        var s = 32, cv = document.createElement('canvas'), cx = cv.getContext('2d');
        cv.width = s; cv.height = s; cx.drawImage(img, 0, 0, s, s);
        var data = cx.getImageData(0, 0, s, s);
        for (var y = 0; y < s; y++) for (var x = 0; x < s; x++) {
          var i = (y * s + x) * 4, a = data.data[i + 3];
          if (a < 30) continue;
          var c = '#' + [data.data[i], data.data[i + 1], data.data[i + 2]].map(function(v) { return ('0' + v.toString(16)).slice(-2); }).join('');
          FB.db.ref('pixels').push({ x: x + 50, y: y + 50, c: c, by: S.me.displayName, t: Date.now() });
        }
      };
      img.src = URL.createObjectURL(f);
    };
    FB.db.ref('pixels').on('value', function(s) {
      var p = s.val() || {}, list = Object.keys(p).map(function(k) { var o = { id: k }; for (var kk in p[k]) o[kk] = p[k][kk]; return o; }).sort(function(a, b) { return a.t - b.t; });
      ctx.fillStyle = '#111'; ctx.fillRect(0, 0, W, H);
      list.forEach(function(px) { ctx.fillStyle = px.c; ctx.fillRect(px.x, px.y, 1, 1); });
      var ch = $('#placeChanges'); if (!ch) return;
      ch.innerHTML = '<b style="color:#ff6600">Recent</b>';
      list.slice(-15).reverse().forEach(function(px) { ch.innerHTML += '<div>(' + px.x + ',' + px.y + ') ' + esc(px.by || '') + '</div>'; });
    });
  };
});
