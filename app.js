/* ============================================================
   ILM ACADEMY — ilova mantig'i
   Ekranlar: Asosiy · Darslar · Dars · Darslik · Video · Test ·
             Mashq · Imtihon · Natija
   Mazmun data.js da. Bu faylga faqat xatti-harakat uchun tegiladi.
   ============================================================ */
(function () {
'use strict';

/* ---------- xato ko'rinsin ---------- */
window.addEventListener('error', function (ev) {
  var d = document.getElementById('err');
  d.style.display = 'block';
  d.textContent = 'XATO: ' + ev.message + '  (' + (ev.lineno || '?') + ':' + (ev.colno || '?') + ')';
});

/* ---------- Telegram ---------- */
var tg = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;
var inTG = !!(tg && tg.initDataUnsafe && tg.initDataUnsafe.user);
if (tg) { try { tg.ready(); tg.expand(); tg.setHeaderColor('#061527'); tg.setBackgroundColor('#061527'); } catch (e) {} }

var user = inTG ? {
  id: tg.initDataUnsafe.user.id,
  name: [tg.initDataUnsafe.user.first_name, tg.initDataUnsafe.user.last_name].filter(Boolean).join(' '),
  username: tg.initDataUnsafe.user.username || ''
} : { id: 0, name: 'Sinov foydalanuvchi', username: 'sinov' };

/* ---------- rol ---------- */
function baseRole() {
  if (ILM.roles.ustozplus.indexOf(user.id) >= 0) return 'ustozplus';
  if (ILM.roles.ustoz.indexOf(user.id) >= 0) return 'ustoz';
  if (!inTG) return 'ustozplus';          // oddiy brauzerda — ko'rish uchun hammasi ochiq
  return 'oquvchi';
}
var st = {
  role: baseRole(),
  viewAs: null,          // 'oquvchi' — ustoz+ o'quvchi ko'zi bilan ko'rmoqda
  testMode: false,       // sinov rejimi — qulflar o'chiq
  tab: 'home', screen: 'home', params: {}, stack: [],
  sub: { mashq: 'fon', imtihon: 'fon' },
  run: null
};
function role() { return st.viewAs || st.role; }
function isPlus() { return st.role === 'ustozplus'; }
/* «O'quvchi ko'zi bilan» yoqilganda hech qanday ruxsat ishlamaydi — qulflar talabadagidek */
function allOpen() { if (st.viewAs) return false; return st.testMode || role() === 'ustozplus' || role() === 'ustoz'; }

/* ---------- progress (saqlash) ---------- */
var PKEY = 'ilm-progress-' + user.id;
function fresh() { return { lessons: {}, exams: {}, mistakes: [], stat: { ans: 0, ok: 0 }, updated: 0 }; }
var progress = load();
function load() {
  try { var s = localStorage.getItem(PKEY); if (s) return merge(fresh(), JSON.parse(s)); } catch (e) {}
  return fresh();
}
function merge(a, b) { for (var k in b) a[k] = b[k]; return a; }
function save() {
  progress.updated = Date.now();
  try { localStorage.setItem(PKEY, JSON.stringify(progress)); } catch (e) {}
  if (tg && tg.CloudStorage) { try { tg.CloudStorage.setItem('progress', JSON.stringify(progress), function () {}); } catch (e) {} }
}
function loadCloud(cb) {
  if (!(tg && tg.CloudStorage)) return cb();
  try {
    tg.CloudStorage.getItem('progress', function (err, val) {
      if (!err && val) {
        try { var c = JSON.parse(val); if ((c.updated || 0) > (progress.updated || 0)) progress = merge(fresh(), c); } catch (e) {}
      }
      cb();
    });
  } catch (e) { cb(); }
}

/* ---------- dars holati ---------- */
var N = ILM.lessons.length;
function L(n) { return ILM.lessons[n - 1]; }
function P(n) { return progress.lessons[n] || {}; }
function PL(n) { return (progress.lessons[n] = progress.lessons[n] || {}); }
function lessonOk(n) {
  var p = P(n);
  return !!(p.passed && (!ILM.rules.needVideo || p.video) && (!ILM.rules.needBook || p.book));
}
function examsAfter(n) { return ILM.exams.filter(function (e) { return e.after === n; }); }
function examById(id) { for (var i = 0; i < ILM.exams.length; i++) if (ILM.exams[i].id === id) return ILM.exams[i]; return null; }
function examOk(id) { return !!(progress.exams[id] && progress.exams[id].passed); }
function unlocked(n) {
  if (allOpen()) return true;
  if (n === 1) return true;
  if (!lessonOk(n - 1)) return false;
  return examsAfter(n - 1).every(function (e) { return examOk(e.id); });
}
function currentLesson() { for (var i = 1; i <= N; i++) if (!P(i).passed) return i; return N; }
function lessonState(n) {
  if (P(n).passed) return 'done';
  if (!unlocked(n)) return 'locked';
  return n === currentLesson() ? 'current' : 'open';
}
function examUnlocked(e) {
  if (allOpen()) return true;
  for (var i = 1; i <= e.after; i++) if (!lessonOk(i)) return false;
  return true;
}
function examState(e) {
  if (examOk(e.id)) return 'done';
  return examUnlocked(e) ? 'open' : 'locked';
}
function blockOf(n) { for (var i = 0; i < ILM.blocks.length; i++) { var b = ILM.blocks[i]; if (n >= b.from && n <= b.to) return b; } return ILM.blocks[0]; }
function doneCount() { var c = 0; for (var i = 1; i <= N; i++) if (P(i).passed) c++; return c; }
function accuracy() { var s = progress.stat || { ans: 0, ok: 0 }; return s.ans ? Math.round(s.ok / s.ans * 100) : 0; }
function lt(n) { var l = L(n); return l.uz ? ' · ' + l.uz : ''; }

function markBook(n) { PL(n).book = true; save(); }
function markVideo(n) { PL(n).video = true; save(); }

/* ---------- navigatsiya ---------- */
function go(screen, params) {
  st.stack.push({ screen: st.screen, params: st.params });
  st.screen = screen; st.params = params || {};
  render(); window.scrollTo(0, 0);
}
function back() {
  if (st.screen === 'test' && st.run && st.run.i < st.run.qs.length) {
    if (!confirm('Test tugallanmadi. Chiqilsinmi?')) return;
  }
  var p = st.stack.pop();
  if (p) { st.screen = p.screen; st.params = p.params; } else { st.screen = st.tab; st.params = {}; }
  if (st.screen !== 'test') st.run = null;
  render(); window.scrollTo(0, 0);
}
function setTab(t) { st.tab = t; st.stack = []; st.screen = t; st.params = {}; st.run = null; render(); window.scrollTo(0, 0); }

/* ---------- yordamchilar ---------- */
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function toast(msg) {
  var t = document.getElementById('toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('on'); }, 1600);
}
function top(title, sub, withBack) {
  return '<div class="top">' + (withBack ? '<button class="back" data-act="back">‹</button>' : '') +
    '<div><h1>' + title + '</h1>' + (sub ? '<div class="sub">' + sub + '</div>' : '') + '</div></div>';
}
function rolePill() {
  var r = role();
  if (r === 'ustozplus') return '<span class="pill gold">★ Ustoz+</span>';
  if (r === 'ustoz') return '<span class="pill blue">Ustoz</span>';
  return '<span class="pill">Talaba</span>';
}
function tabs(key, items) {
  var h = '<div class="tabs">';
  items.forEach(function (it) { h += '<button class="' + (st.sub[key] === it[0] ? 'on' : '') + '" data-sub="' + key + ':' + it[0] + '">' + it[1] + '</button>'; });
  return h + '</div>';
}
function soon(what) { return '<div class="soon"><b>Tez kunda</b>' + what + ' bo\'limi tayyorlanmoqda</div>'; }
function ytId(u) {
  if (!u) return null;
  var m = u.match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

/* ============================================================
   EKRANLAR
   ============================================================ */

/* ---- Asosiy ---- */
function rHome() {
  var cur = currentLesson(), done = doneCount(), first = user.name.split(' ')[0];
  var h = top('<span class="ar">أَهْلًا</span> ' + esc(first), ILM.app.name, false);

  h += '<div class="card blue"><div class="row">' +
    '<div class="avatar">' + esc(first.charAt(0).toUpperCase()) + '</div>' +
    '<div class="grow"><div class="t">' + esc(user.name) + '</div>' +
    '<div class="d">@' + esc(user.username || '—') + ' · ID ' + (user.id || '—') + '</div>' +
    '<div>' + rolePill() + '<span class="pill">' + esc(ILM.app.course) + '</span></div></div></div>' +
    '<div class="stats"><div><b>' + done + '</b><span>o\'tilgan dars</span></div>' +
    '<div><b>' + accuracy() + '%</b><span>aniqlik</span></div>' +
    '<div><b>' + progress.mistakes.length + '</b><span>xato</span></div></div></div>';

  var b = blockOf(cur);
  h += '<div class="card gold tap" data-go="lesson" data-n="' + cur + '">' +
    '<div class="kicker">Siz hozir · ' + esc(b.title) + '</div>' +
    '<div class="t">' + cur + '-dars' + esc(lt(cur)) + '</div>' +
    '<div class="d">' + done + ' / ' + N + ' dars o\'tildi</div>' +
    '<div class="bar"><i style="width:' + (done / N * 100) + '%"></i></div>' +
    '<div style="margin-top:14px"><span class="btn sm" style="background:#2A2105;color:#F4DC8A">Davom etish ›</span></div></div>';

  var nx = nextExam();
  if (nx) {
    var es = examState(nx);
    h += '<div class="card deep tap" data-act="exam" data-id="' + nx.id + '"><div class="row"><div class="grow">' +
      '<div class="kicker">Yaqin imtihon</div><div class="t">' + esc(nx.title) + '</div>' +
      '<div class="d">' + nx.after + '-darsdan keyin · ' + (es === 'open' ? 'ochiq — topshirishingiz mumkin' : es === 'done' ? 'topshirilgan ✓' : 'hali yopiq') + '</div>' +
      '</div><span class="chev">›</span></div></div>';
  }

  if (isPlus()) {
    h += '<h2 class="sec">Ustoz+ paneli</h2><div class="card">';
    if (st.viewAs) {
      h += '<div class="switch"><div><div class="k">O\'quvchi ko\'zi bilan</div><div class="v">Hozir talaba ko\'rinishi — qulflar ishlaydi. O\'chirsangiz ustoz+ ga qaytasiz</div></div><button class="tog on" data-act="viewas"></button></div>';
    } else {
      h += '<div class="switch"><div><div class="k">Sinov rejimi</div><div class="v">Barcha dars va imtihonlar qulfsiz</div></div><button class="tog ' + (st.testMode ? 'on' : '') + '" data-act="testmode"></button></div>' +
        '<div class="switch"><div><div class="k">O\'quvchi ko\'zi bilan</div><div class="v">Talaba nimani ko\'rishini tekshirish</div></div><button class="tog" data-act="viewas"></button></div>' +
        '<div class="switch"><div><div class="k">Progressni tozalash</div><div class="v">Hamma natija o\'chadi</div></div><button class="btn sm red" data-act="reset">Tozalash</button></div>';
    }
    h += '</div>';
  }
  if (!inTG) h += '<div class="hint" style="text-align:center;margin-top:10px">Brauzerdagi sinov ko\'rinishi. Telegram ichida ochilganda haqiqiy ism va ID chiqadi.</div>';
  return h;
}
function nextExam() {
  for (var i = 0; i < ILM.exams.length; i++) if (!examOk(ILM.exams[i].id)) return ILM.exams[i];
  return null;
}

/* ---- Darslar ---- */
function rLessons() {
  var cur = currentLesson(), b = blockOf(cur);
  var h = top('Darslar', esc(ILM.app.course) + ' · ' + N + ' dars · ' + ILM.blocks.length + ' blok', false);
  h += '<div class="card blue tap" data-go="lesson" data-n="' + cur + '"><div class="row"><div class="grow">' +
    '<div class="kicker">Siz hozir · ' + esc(b.title) + '</div><div class="t">' + cur + '-dars' + esc(lt(cur)) + '</div>' +
    '<div class="d">Bosing — davom etasiz</div></div><span class="chev">›</span></div></div>';

  ILM.blocks.forEach(function (bk) {
    var dn = 0; for (var n = bk.from; n <= bk.to; n++) if (P(n).passed) dn++;
    h += '<div class="blockhead"><b>' + esc(bk.title) + '</b><span>' + bk.from + '–' + bk.to + ' · ' + dn + '/' + (bk.to - bk.from + 1) + '</span></div>';
    for (var k = bk.from; k <= bk.to; k++) h += lessonRow(k);
    examsAfter(bk.to).forEach(function (e) { h += examRow(e); });
  });
  return h;
}
function lessonRow(n) {
  var l = L(n), s = lessonState(n), p = P(n);
  var right = s === 'done' ? p.score + '/' + p.total + ' ✓' : s === 'current' ? 'Davom etish ›' : s === 'open' ? '›' : '🔒';
  var ar = l.ar ? '<div class="ar">' + esc(l.ar) + '</div>' : '<div class="ar empty">' + n + '-dars</div>';
  var uz = l.uz ? '<div class="uz">' + esc(l.uz) + '</div>' : (l.ar ? '' : '<div class="uz">nomi keyin kiritiladi</div>');
  return '<div class="lesson ' + s + '" data-go="lesson" data-n="' + n + '"><div class="num">' + n + '</div>' +
    '<div class="ttl">' + ar + uz + '</div><div class="st">' + right + '</div></div>';
}
function examRow(e) {
  var s = examState(e), r = progress.exams[e.id];
  var right = s === 'done' ? r.score + '/' + r.total + ' ✓' : s === 'open' ? 'Boshlash ›' : '🔒';
  return '<div class="lesson exam ' + s + '" data-act="exam" data-id="' + e.id + '"><div class="num">✓</div>' +
    '<div class="ttl"><div class="ar empty">' + esc(e.title) + '</div><div class="uz">' + ILM.examQ[e.id].length + ' savol · o\'tish ' + ILM.rules.examPassPct + '%</div></div>' +
    '<div class="st">' + right + '</div></div>';
}

/* ---- Dars ichi ---- */
function rLesson() {
  var n = +st.params.n, l = L(n), p = P(n), s = lessonState(n), locked = s === 'locked';
  var sub = (l.ar ? '<span class="ar">' + esc(l.ar) + '</span>' : '') + (l.uz ? (l.ar ? ' · ' : '') + esc(l.uz) : '');
  var h = top(n + '-dars', sub || esc(blockOf(n).title), true);

  if (locked) h += '<div class="card"><div class="t">🔒 Bu dars hali yopiq</div><div class="d">Avval ' + (n - 1) + '-darsni tugating: darslik, video va test.</div></div>';

  var dis = locked ? ' dis' : '';
  h += '<div class="part' + (p.book ? ' ok' : '') + dis + '" data-go="book" data-n="' + n + '"><div class="ic">📖</div>' +
    '<div class="grow"><div class="t">Darslik</div><div class="d">' + (l.pages.length ? l.pages.length + ' bet' : 'betlar keyin qo\'shiladi') + '</div></div>' +
    '<div class="mark">' + (p.book ? '✓' : '›') + '</div></div>';
  h += '<div class="part' + (p.video ? ' ok' : '') + dis + '" data-go="video" data-n="' + n + '"><div class="ic">🎬</div>' +
    '<div class="grow"><div class="t">Video darslik</div><div class="d">' + (p.video ? 'Ko\'rildi' : (l.video ? 'Oxirigacha ko\'ring' : 'video keyin qo\'shiladi')) + '</div></div>' +
    '<div class="mark">' + (p.video ? '✓' : '›') + '</div></div>';
  var tq = (ILM.tests[n] || []).length;
  h += '<div class="part' + (p.passed ? ' ok' : '') + dis + '" data-act="starttest" data-n="' + n + '"><div class="ic">✍️</div>' +
    '<div class="grow"><div class="t">Test</div><div class="d">' + (p.passed ? p.score + '/' + p.total + ' — o\'tildi' : tq + ' savol · o\'tish ' + ILM.rules.passPct + '%') + '</div></div>' +
    '<div class="mark">' + (p.passed ? '✓' : '›') + '</div></div>';

  if (!locked && !allOpen() && !lessonOk(n)) {
    var need = [];
    if (ILM.rules.needBook && !p.book) need.push('darslik');
    if (ILM.rules.needVideo && !p.video) need.push('video');
    if (!p.passed) need.push('test');
    h += '<div class="hint" style="text-align:center;margin:6px 0 14px">Keyingi dars ochilishi uchun: ' + need.join(' · ') + '</div>';
  }
  if (n < N && lessonOk(n) && unlocked(n + 1)) h += '<button class="btn gold wide" data-go="lesson" data-n="' + (n + 1) + '">' + (n + 1) + '-darsga o\'tish ›</button>';
  else if (n < N && allOpen()) h += '<button class="btn ghost wide" data-go="lesson" data-n="' + (n + 1) + '">' + (n + 1) + '-dars ›</button>';
  return h;
}

/* ---- Darslik (betlar) ---- */
function rBook() {
  var n = +st.params.n, l = L(n);
  var h = top('Darslik', n + '-dars', true);
  if (!l.pages.length) {
    h += '<div class="placeholder"><b>Betlar hali qo\'shilmagan</b>PDF berilgach shu yerda darsning 2–3 beti chiqadi — har betda suv belgisi (ism · ID) bilan.</div>';
  } else {
    l.pages.forEach(function (src) {
      h += '<div class="pagewrap"><img src="' + esc(src) + '" alt=""><div class="wm">' + wm() + '</div></div>';
    });
  }
  h += '<button class="btn gold wide" data-act="back">Darsga qaytish</button>';
  return h;
}
function wm() {
  var t = esc(user.name + ' · ' + (user.id || 'sinov')), s = '';
  for (var i = 0; i < 6; i++) for (var j = 0; j < 3; j++) s += '<span style="top:' + (i * 18 + 4) + '%;left:' + (j * 40 - 12) + '%">' + t + '</span>';
  return s;
}

/* ---- Video ---- */
function rVideo() {
  var n = +st.params.n, l = L(n), p = P(n), id = ytId(l.video);
  var h = top('Video darslik', n + '-dars', true);
  if (!l.video) {
    h += '<div class="placeholder"><b>Video hali qo\'shilmagan</b>Havola berilgach shu yerda ochiladi. Hozircha bu shart bajarilgan hisoblanadi.</div>';
  } else if (id) {
    h += '<div class="video"><div id="yt"></div></div>' +
      '<div class="hint" style="text-align:center">' + (p.video ? '✓ Oxirigacha ko\'rilgan' : 'Video oxirigacha ko\'rilganda o\'zi belgilanadi') + '</div>';
  } else {
    h += '<div class="card"><div class="t">Video tashqi manzilda</div><div class="d">Ochib ko\'ring, keyin «Ko\'rdim» ni bosing.</div></div>' +
      '<a class="btn blue wide" style="margin-bottom:10px;text-decoration:none" href="' + esc(l.video) + '" target="_blank">Videoni ochish ↗</a>' +
      (p.video ? '<div class="hint" style="text-align:center">✓ Ko\'rilgan deb belgilangan</div>' : '<button class="btn ghost wide" data-act="vidseen" data-n="' + n + '">Ko\'rdim ✓</button>');
  }
  h += '<div style="height:12px"></div><button class="btn gold wide" data-act="back">Darsga qaytish</button>';
  return h;
}
function loadYT(id, n) {
  var make = function () {
    new YT.Player('yt', {
      videoId: id, playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
      events: { onStateChange: function (e) { if (e.data === YT.PlayerState.ENDED) { markVideo(n); toast('Video ko\'rildi ✓'); } } }
    });
  };
  if (window.YT && window.YT.Player) return make();
  window.onYouTubeIframeAPIReady = make;
  if (!document.getElementById('ytapi')) { var s = document.createElement('script'); s.id = 'ytapi'; s.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(s); }
}

/* ---- Test / imtihon / mashq ---- */
function startRun(kind, key, replace) {
  var qs;
  if (kind === 'exam') qs = ILM.examQ[key] || [];
  else if (kind === 'mistakes') qs = progress.mistakes.map(function (m) { var q = ILM.tests[m.n][m.i]; return merge({ _n: m.n, _i: m.i }, q); });
  else if (kind === 'block') {
    var bk = ILM.blocks[key - 1]; qs = [];
    for (var bn = bk.from; bn <= bk.to; bn++) (ILM.tests[bn] || []).forEach(function (q, i) { qs.push(merge({ _n: bn, _i: i }, q)); });
  }
  else qs = (ILM.tests[key] || []).map(function (q, i) { return merge({ _n: key, _i: i }, q); });
  if (!qs.length) return toast('Savollar hali yo\'q');
  st.run = { kind: kind, key: key, qs: qs, i: 0, pick: null, shown: false, ok: 0, wrong: [], done: false };
  if (replace) { st.screen = 'test'; st.params = { kind: kind, key: key }; render(); window.scrollTo(0, 0); }
  else go('test', { kind: kind, key: key });
}
function correctIdx(q) { return q.t === 'truefalse' ? (q.c ? 0 : 1) : q.c; }
function options(q) { return q.t === 'truefalse' ? ['To\'g\'ri', 'Noto\'g\'ri'] : q.a; }
function runTitle(r) {
  if (r.kind === 'lesson') return r.key + '-dars testi';
  if (r.kind === 'practice') return 'Mashq · ' + r.key + '-dars';
  if (r.kind === 'exam') return examById(r.key).title;
  if (r.kind === 'block') return 'Blok testi · ' + ILM.blocks[r.key - 1].title;
  return 'Xatolar ustida ishlash';
}
function rTest() {
  var r = st.run; if (!r) return rHome();
  if (r.i >= r.qs.length) return rResult();
  var q = r.qs[r.i], opts = options(q), ci = correctIdx(q);
  var h = top(runTitle(r), '', true);
  h += '<div class="qhead"><span>' + (r.i + 1) + ' / ' + r.qs.length + '</span><span>' + r.ok + ' to\'g\'ri</span></div>' +
    '<div class="bar"><i style="width:' + (r.i / r.qs.length * 100) + '%"></i></div>' +
    '<div class="qtext">' + esc(q.q) + '</div>';
  if (q.t === 'audio') h += '<div class="audiobox"><button data-act="play">▶</button><div class="hint">' + (q.src ? 'Eshiting va javobni tanlang' : 'Audio keyin qo\'shiladi') + '</div></div>';
  opts.forEach(function (o, k) {
    var cls = r.shown ? (k === ci ? 'right' : (k === r.pick ? 'wrong' : '')) : (k === r.pick ? 'pick' : '');
    h += '<button class="opt ' + cls + '" data-act="pick" data-k="' + k + '"><span class="l">' + String.fromCharCode(65 + k) + '</span><span>' + esc(o) + '</span></button>';
  });
  h += '<div style="height:8px"></div>';
  if (!r.shown) h += '<button class="btn gold wide" data-act="check"' + (r.pick == null ? ' disabled' : '') + '>Tekshirish</button>';
  else h += '<button class="btn gold wide" data-act="next">' + (r.i + 1 >= r.qs.length ? 'Natijani ko\'rish' : 'Keyingi') + ' ›</button>';
  return h;
}
function check() {
  var r = st.run, q = r.qs[r.i], ci = correctIdx(q), right = r.pick === ci;
  if (right) r.ok++; else r.wrong.push(r.i);
  r.shown = true;
  if (r.kind === 'lesson' || r.kind === 'exam') { progress.stat.ans++; if (right) progress.stat.ok++; }
  if (q._n != null) {
    var idx = -1;
    for (var i = 0; i < progress.mistakes.length; i++) if (progress.mistakes[i].n === q._n && progress.mistakes[i].i === q._i) { idx = i; break; }
    if (!right && idx < 0) progress.mistakes.push({ n: q._n, i: q._i });
    if (right && idx >= 0 && r.kind === 'mistakes') progress.mistakes.splice(idx, 1);
  }
  save(); render();
}
function rResult() {
  var r = st.run, len = r.qs.length, pct = Math.round(r.ok / len * 100);
  var graded = r.kind === 'lesson' || r.kind === 'exam';
  var thr = r.kind === 'exam' ? ILM.rules.examPassPct : ILM.rules.passPct;
  var passed = graded && pct >= thr;
  if (graded && !r.done) {
    r.done = true;
    var rec = r.kind === 'lesson' ? PL(r.key) : (progress.exams[r.key] = progress.exams[r.key] || {});
    rec.attempts = (rec.attempts || 0) + 1;
    if (passed || !rec.passed) { rec.score = r.ok; rec.total = len; }
    rec.passed = rec.passed || passed;
    save();
  }
  var h = top(runTitle(r), '', true);
  var ring = 'conic-gradient(#D4AF37 ' + pct + '%, rgba(255,255,255,.12) 0)';
  h += '<div class="card ' + (graded ? (passed ? 'gold' : 'deep') : 'deep') + '" style="text-align:center">' +
    '<div class="ring" style="background:' + ring + '"><div style="width:122px;height:122px;border-radius:50%;background:' + (graded && passed ? '#B8921E' : '#0F2A4A') + ';display:grid;place-items:center"><b>' + pct + '%</b><small>' + r.ok + ' / ' + len + '</small></div></div>' +
    '<div class="t">' + (graded ? (passed ? 'O\'tdingiz 🎉' : 'O\'tmadingiz') : 'Mashq tugadi') + '</div>' +
    '<div class="d">' + (graded ? 'O\'tish chegarasi ' + thr + '%' : 'Natija balga ta\'sir qilmaydi') + (r.wrong.length ? ' · ' + r.wrong.length + ' ta xato' : '') + '</div></div>';
  if (r.kind === 'lesson' && passed && r.key < N && unlocked(r.key + 1))
    h += '<button class="btn gold wide" style="margin-bottom:10px" data-go="lesson" data-n="' + (r.key + 1) + '">' + (r.key + 1) + '-darsga o\'tish ›</button>';
  if (r.wrong.length) h += '<div class="card"><div class="row"><div class="grow"><div class="t">Xatolar ustida ishlash</div><div class="d">Xato qilingan savollar Mashq bo\'limida saqlandi</div></div><span class="badge gold">' + progress.mistakes.length + '</span></div></div>';
  h += '<button class="btn ghost wide" style="margin-bottom:10px" data-act="retry">Qayta yechish</button>' +
    '<button class="btn ghost wide" data-act="back">Qaytish</button>';
  return h;
}

/* ---- Mashq ---- */
function rMashq() {
  var h = top('Mashq', 'Mavzu tanlab mashq qiling', false);
  h += tabs('mashq', [['fon', 'Fonetika'], ['gram', 'Grammatika']]);
  if (st.sub.mashq === 'gram') return h + soon('Grammatika mashqlari');
  h += '<div class="card tap" data-act="mistakes"><div class="row"><div class="cic">↻</div>' +
    '<div class="grow"><div class="t">Xatolar ustida ishlash</div><div class="d">Xato qilingan savollarni qayta yeching</div></div><span class="badge gold">' + progress.mistakes.length + '</span></div></div>';
  h += '<div class="card tap" data-act="mashqlist"><div class="row"><div class="cic">✍</div>' +
    '<div class="grow"><div class="t">Dars testlari</div><div class="d">' + N + ' dars · har birida ' + (ILM.tests[1] || []).length + ' savol</div></div><span class="chev">›</span></div></div>';
  h += '<div class="card tap" data-act="mashqblocks"><div class="row"><div class="cic">▦</div>' +
    '<div class="grow"><div class="t">Blok testlari</div><div class="d">' + ILM.blocks.length + ' blok · 10 dars testi bittada</div></div><span class="chev">›</span></div></div>';
  return h;
}
function rMashqList() {
  var h = top('Dars testlari', esc(ILM.app.course) + ' · ' + N + ' dars', true);
  ILM.blocks.forEach(function (bk) {
    h += '<div class="blockhead"><b>' + esc(bk.title) + '</b><span>' + bk.from + '–' + bk.to + '</span></div>';
    for (var n = bk.from; n <= bk.to; n++) {
      var s = lessonState(n), open = s !== 'locked';
      h += '<div class="lesson ' + (open ? (s === 'done' ? 'done' : 'open') : 'locked') + '" data-act="practice" data-n="' + n + '"><div class="num">' + n + '</div>' +
        '<div class="ttl"><div class="ar empty">' + n + '-dars testi</div><div class="uz">' + (ILM.tests[n] || []).length + ' savol' + esc(lt(n)) + '</div></div>' +
        '<div class="st">' + (open ? '›' : '🔒') + '</div></div>';
    }
  });
  return h;
}
function rMashqBlocks() {
  var h = top('Blok testlari', ILM.blocks.length + ' blok · har biri 10 dars', true);
  ILM.blocks.forEach(function (bk) {
    var open = unlocked(bk.to), cnt = 0;
    for (var n = bk.from; n <= bk.to; n++) cnt += (ILM.tests[n] || []).length;
    h += '<div class="card tap ' + (open ? 'blue' : '') + '" data-act="blocktest" data-n="' + bk.n + '" style="' + (open ? '' : 'opacity:.55') + '"><div class="row"><div class="grow">' +
      '<div class="kicker">' + bk.from + '–' + bk.to + '-darslar</div><div class="t">' + esc(bk.title) + '</div><div class="d">' + cnt + ' savol · balga ta\'sir qilmaydi</div>' +
      '</div><div class="st" style="font-weight:600;color:var(--gold2)">' + (open ? 'Boshlash ›' : '🔒') + '</div></div></div>';
  });
  return h;
}

/* ---- Imtihon ---- */
function rImtihon() {
  var h = top('Imtihon', 'Mini · Oraliq · Yakuniy', false);
  h += tabs('imtihon', [['fon', 'Fonetika'], ['gram', 'Grammatika']]);
  if (st.sub.imtihon === 'gram') return h + soon('Grammatika imtihonlari');
  ILM.exams.forEach(function (e) {
    var s = examState(e), r = progress.exams[e.id] || {};
    var cls = e.type === 'yakuniy' ? 'gold' : e.type === 'oraliq' ? 'blue' : '';
    var right = s === 'done' ? r.score + '/' + r.total + ' ✓' : s === 'open' ? 'Boshlash ›' : '🔒';
    h += '<div class="card tap ' + cls + '" data-act="exam" data-id="' + e.id + '" style="' + (s === 'locked' ? 'opacity:.55' : '') + '"><div class="row"><div class="grow">' +
      '<div class="kicker">' + (e.type === 'mini' ? 'Mini' : e.type === 'oraliq' ? 'Oraliq' : 'Yakuniy') + ' imtihon</div>' +
      '<div class="t">' + esc(e.title) + '</div><div class="d">' + e.after + '-darsdan keyin · ' + ILM.examQ[e.id].length + ' nazariy' +
      (e.oral ? ' + ' + e.oral + ' amaliy (og\'zaki, ustoz baholaydi)' : '') + ' · o\'tish ' + ILM.rules.examPassPct + '%</div>' +
      '</div><div class="st" style="font-weight:600">' + right + '</div></div></div>';
  });
  return h;
}

/* ============================================================
   RENDER va HODISALAR
   ============================================================ */
var SCREENS = { home: rHome, lessons: rLessons, lesson: rLesson, book: rBook, video: rVideo, test: rTest, mashq: rMashq, mashqList: rMashqList, mashqBlocks: rMashqBlocks, imtihon: rImtihon };
var ICONS = {
  home: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-6H9v6H5a2 2 0 0 1-2-2z"/></svg>',
  lessons: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
  mashq: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
  imtihon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M8.2 13.5L7 22l5-3 5 3-1.2-8.5"/></svg>'
};
function render() {
  var fn = SCREENS[st.screen] || rHome;
  document.getElementById('view').innerHTML = fn();
  var nav = [['home', 'Asosiy'], ['lessons', 'Darslar'], ['mashq', 'Mashq'], ['imtihon', 'Imtihon']];
  document.getElementById('nav').innerHTML = nav.map(function (t) {
    return '<button class="' + (st.tab === t[0] ? 'on' : '') + '" data-tab="' + t[0] + '"><i>' + ICONS[t[0]] + '</i>' + t[1] + '</button>';
  }).join('');
  if (st.screen === 'video') { var l = L(+st.params.n), id = ytId(l.video); if (id) loadYT(id, +st.params.n); }
  if (tg && tg.BackButton) { try { if (st.stack.length) tg.BackButton.show(); else tg.BackButton.hide(); } catch (e) {} }
}
if (tg && tg.BackButton) { try { tg.BackButton.onClick(back); } catch (e) {} }

document.getElementById('app').addEventListener('click', function (e) {
  var t = e.target.closest('[data-go],[data-act],[data-tab],[data-sub]');
  if (!t) return;
  if (t.dataset.tab) return setTab(t.dataset.tab);
  if (t.dataset.sub) { var p = t.dataset.sub.split(':'); st.sub[p[0]] = p[1]; return render(); }
  if (t.dataset.go) {
    var g = t.dataset.go, n = +t.dataset.n;
    if (g === 'lesson') {
      if (n < 1 || n > N) return;
      if (st.screen === 'test') {           // natija ekranidan keyingi darsga — orqaga bosilsa ro'yxatga qaytsin
        st.run = null; st.stack = [{ screen: st.tab, params: {} }];
        st.screen = 'lesson'; st.params = { n: n }; render(); window.scrollTo(0, 0); return;
      }
      return go('lesson', { n: n });
    }
    if (!unlocked(n)) return toast('Bu dars hali yopiq');
    if (g === 'book') { markBook(n); return go('book', { n: n }); }
    if (g === 'video') { if (!L(n).video) markVideo(n); return go('video', { n: n }); }
    return;
  }
  var a = t.dataset.act;
  if (a === 'back') return back();
  if (a === 'testmode') { st.testMode = !st.testMode; toast(st.testMode ? 'Sinov rejimi yoqildi' : 'Sinov rejimi o\'chdi'); return render(); }
  if (a === 'viewas') { st.viewAs = st.viewAs ? null : 'oquvchi'; if (st.viewAs) st.testMode = false; setTab('home'); return; }
  if (a === 'mashqlist') return go('mashqList');
  if (a === 'mashqblocks') return go('mashqBlocks');
  if (a === 'blocktest') { var bb = ILM.blocks[+t.dataset.n - 1]; if (!bb) return; if (!unlocked(bb.to)) return toast('Avval shu blokning darslariga yeting'); return startRun('block', bb.n); }
  if (a === 'reset') { if (confirm('Barcha natijalar o\'chirilsinmi?')) { progress = fresh(); save(); toast('Tozalandi'); render(); } return; }
  if (a === 'starttest') { var n1 = +t.dataset.n; if (!unlocked(n1)) return toast('Bu dars hali yopiq'); return startRun('lesson', n1); }
  if (a === 'practice') { var n2 = +t.dataset.n; if (!unlocked(n2)) return toast('Avval shu darsga yeting'); return startRun('practice', n2); }
  if (a === 'mistakes') { if (!progress.mistakes.length) return toast('Xato yo\'q — ajoyib'); return startRun('mistakes'); }
  if (a === 'exam') { var ex = examById(t.dataset.id); if (!ex) return; if (!examUnlocked(ex)) return toast('Imtihon hali yopiq — avval ' + ex.after + '-darsgacha tugating'); return startRun('exam', ex.id); }
  if (a === 'pick') { if (st.run && !st.run.shown) { st.run.pick = +t.dataset.k; render(); } return; }
  if (a === 'check') { if (st.run && st.run.pick != null && !st.run.shown) check(); return; }
  if (a === 'next') { if (!st.run) return; st.run.i++; st.run.pick = null; st.run.shown = false; render(); window.scrollTo(0, 0); return; }
  if (a === 'retry') { if (!st.run) return; return startRun(st.run.kind, st.run.key, true); }
  if (a === 'vidseen') { markVideo(+t.dataset.n); toast('Belgilandi ✓'); return render(); }
  if (a === 'play') { var q = st.run && st.run.qs[st.run.i]; if (q && q.src) { try { new Audio(q.src).play(); } catch (e2) {} } else toast('Audio hali qo\'shilmagan'); return; }
});

/* ---------- ishga tushirish ---------- */
render();
loadCloud(function () { render(); });

})();
