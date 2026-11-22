window.FB = null;
if (typeof firebase !== 'undefined') {
  firebase.initializeApp({
    apiKey: "AIzaSyB2dRmsNzLoMrCpCp7k4RURFhEiRA9o7yE",
    authDomain: "fembooru-142a4.firebaseapp.com",
    databaseURL: "https://fembooru-142a4-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "fembooru-142a4",
    storageBucket: "fembooru-142a4.firebasestorage.app",
    messagingSenderId: "206195257844",
    appId: "1:206195257844:web:64507a7cbf3f33f26e09a1"
  });

  window.FB = (function() {
    var IMGBB = '120a27bcbb28d3ffd9f03bc4b32bb54f';
    var auth = firebase.auth();
    var db = firebase.database();
    var storage = firebase.storage();

    var LIMITS = {
      img: 32 * 1024 * 1024,
      sticker: 512 * 1024,
      audio: 5 * 1024 * 1024,
      avatar: 4 * 1024 * 1024,
      logo: 4 * 1024 * 1024
    };

    function checkLimit(type, size) {
      var max = LIMITS[type];
      if (max && size > max) throw new Error(type + ' max ' + Math.round(max / 1048576 * 10) / 10 + ' MB');
    }

    function uploadImg(file, onProgress) {
      return new Promise(function(res, rej) {
        try { checkLimit('img', file.size); } catch (e) { return rej(e); }
        var form = new FormData();
        form.append('image', file);
        var xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://api.imgbb.com/1/upload?key=' + IMGBB);
        xhr.upload.onprogress = function(e) {
          if (e.lengthComputable && onProgress) onProgress(Math.round(e.loaded / e.total * 100));
        };
        xhr.onload = function() {
          try {
            var r = JSON.parse(xhr.responseText);
            r.success ? res(r.data.url) : rej(new Error(r.error && r.error.message || 'imgBB failed'));
          } catch (e) { rej(e); }
        };
        xhr.onerror = function() { rej(new Error('Network error')); };
        xhr.send(form);
      });
    }

    function uploadStore(file, path, onProgress) {
      return new Promise(function(res, rej) {
        var r = storage.ref(path), t = r.put(file);
        t.on('state_changed',
          function(s) { if (onProgress) onProgress(Math.round(s.bytesTransferred / s.totalBytes * 100)); },
          rej,
          function() { r.getDownloadURL().then(res).catch(rej); }
        );
      });
    }

    function normName(n) { return String(n || '').toLowerCase().replace(/[^a-z0-9_]/g, ''); }

    function register(name, password) {
      name = normName(name);
      if (!name || name.length < 2) return Promise.reject(new Error('Name: 2+ chars (a-z 0-9 _)'));
      return db.ref('nameMap/' + name).get().then(function(snap) {
        if (snap.exists()) throw new Error('Name taken');
        var email = name + '.' + Date.now() + '@fembooru.ua';
        return auth.createUserWithEmailAndPassword(email, password).then(function(cred) {
          var role = name === 'admin' ? 'admin' : 'user';
          return db.ref('nameMap/' + name).set({ uid: cred.user.uid, email: email })
            .then(function() { return db.ref('users/' + cred.user.uid).set({ displayName: name, role: role, created: Date.now() }); })
            .then(function() { return cred.user; });
        });
      });
    }

    function login(name, password) {
      name = normName(name);
      return db.ref('nameMap/' + name).get().then(function(snap) {
        if (!snap.exists()) throw new Error('User not found');
        return auth.signInWithEmailAndPassword(snap.val().email, password);
      });
    }

    function removeUser(name) {
      name = normName(name);
      return db.ref('nameMap/' + name).get().then(function(snap) {
        if (!snap.exists()) throw new Error('Not found');
        var uid = snap.val().uid;
        return db.ref('users/' + uid).remove().then(function() { return db.ref('nameMap/' + name).remove(); });
      });
    }

    return {
      auth: auth, db: db, storage: storage,
      LIMITS: LIMITS, checkLimit: checkLimit,
      uploadImg: uploadImg, uploadStore: uploadStore,
      register: register, login: login, removeUser: removeUser
    };
  })();
}
