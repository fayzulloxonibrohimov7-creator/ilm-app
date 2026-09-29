/* ============================================================
   ILM AKADEMIYASI — ilova mantig'i
   Ekranlar: Asosiy · Darslar · Dars · Darslik · Video · Test ·
             Mashq · Imtihon (Imtihonlar | Kirish) · Natija · Profil ·
             Markaz · Yo'riqnoma · Savol-javob · Yordam · Ilova haqida · Guruhlar
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
  sub: { mashq: 'fon', imtihon: 'fon', imt: 'exams' },
  run: null, acc: {}
};
function role() { return st.viewAs || st.role; }
function isPlus() { return st.role === 'ustozplus'; }
function isStaff() { return st.role === 'ustozplus' || st.role === 'ustoz'; }
/* «O'quvchi ko'zi bilan» yoqilganda hech qanday ruxsat ishlamaydi — qulflar talabadagidek */
function allOpen() { if (st.viewAs) return false; return st.testMode || role() === 'ustozplus' || role() === 'ustoz'; }

/* ---------- progress (saqlash) ---------- */
var PKEY = 'ilm-progress-' + user.id;
function fresh() { return { lessons: {}, exams: {}, mistakes: [], stat: { ans: 0, ok: 0 }, updated: 0, group: null, placement: null }; }
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
    tg.CloudStorage.getItems(['progress', 'access'], function (err, val) {
      if (!err && val) {
        if (val.progress) { try { var c = JSON.parse(val.progress); if ((c.updated || 0) > (progress.updated || 0)) progress = merge(fresh(), c); } catch (e) {} }
        if (val.access && !access) { access = val.access; try { localStorage.setItem(AKEY, access); } catch (e) {} }
      }
      cb();
    });
  } catch (e) { cb(); }
}

/* ---------- server (Cloudflare Worker + D1) ---------- */
var API = String((ILM.app && ILM.app.api) || '').replace(/\/+$/, '');
var srv = { on: false, me: null, err: null, last: 0 };
function apiCall(route, body, cb) {
  if (!API || !inTG || !tg.initData) { if (cb) setTimeout(function () { cb(null); }, 0); return; }
  var d = merge({ initData: tg.initData }, body || {});
  fetch(API + '/api/' + route, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(d) })
    .then(function (r) { return r.json(); })
    .then(function (j) { if (j && j.ok) { srv.on = true; srv.err = null; } else if (j) srv.err = j.error; if (cb) cb(j); })
    .catch(function (e) { srv.err = 'ulanmadi'; if (cb) cb(null); });
}
function syncNow(first) {
  apiCall('sync', { progress: progress, placement: (progress.placement && progress.placement.n) || null }, function (j) {
    if (!j || !j.ok) { if (first) render(); return; }
    srv.me = j.me; srv.last = Date.now();
    srv.grp = j.group || null;                                // guruh ma'lumoti serverdan
    srv.openTo = j.openTo | 0;                                // ustoz shu darsgacha ochgan
    srv.attend = j.attend || null;                            // { dars: 1/0 } — o'z davomati
    if (j.center) ILM.center = j.center;                      // markaz ma'lumotlari serverdan (ustoz+ tahrirlagan)
    if (j.me.role) st.role = j.me.role;                       // rol serverdan
    if (j.me.group) progress.group = j.me.group;              // guruhni ustoz biriktiradi
    if (j.progress && (j.updated || 0) > (progress.updated || 0)) { progress = merge(fresh(), j.progress); }
    render();
  });
}
function sendEvent(kind, ref, score, total, passed) {
  apiCall('event', { kind: kind, ref: String(ref), score: score, total: total, passed: !!passed });
}
function ago(ms) {
  if (!ms) return '—';
  var s = Math.round((Date.now() - ms) / 1000);
  if (s < 90) return 'hozir';
  if (s < 3600) return Math.round(s / 60) + ' daqiqa oldin';
  if (s < 86400) return Math.round(s / 3600) + ' soat oldin';
  return Math.round(s / 86400) + ' kun oldin';
}
function dtx(ms) { if (!ms) return '—'; var d = new Date(ms); return fmt(d) + ', ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }

/* ---------- kirish kodi (guruh kodi yoki umumiy kod) ---------- */
var AKEY = 'ilm-access-' + user.id;
var access = null;
try { access = localStorage.getItem(AKEY); } catch (e) {}
function gateOK() { return st.role !== 'oquvchi' || !!access; }
function norm(c) { return String(c || '').trim().toUpperCase().replace(/\s+/g, ''); }
function codeValid(c) {
  c = norm(c);
  var gs = ILM.groups || [];
  for (var i = 0; i < gs.length; i++) if (gs[i].code && norm(gs[i].code) === c) return { code: gs[i].code, group: gs[i].id };
  var list = (ILM.access && ILM.access.codes) || [];
  for (var k = 0; k < list.length; k++) if (norm(list[k]) === c) return { code: list[k], group: null };
  return null;
}
function grantAccess(r) {
  access = r.code;
  try { localStorage.setItem(AKEY, r.code); } catch (e) {}
  if (tg && tg.CloudStorage) { try { tg.CloudStorage.setItem('access', r.code, function () {}); } catch (e) {} }
  progress.group = r.group || r.code; save();
}

/* ---------- ota-ona rejimi: alohida, tabsiz ko'rinish ---------- */
var PARENTKEY = 'ilm-parent-' + user.id;
var parentMode = false;
try { parentMode = localStorage.getItem(PARENTKEY) === '1'; } catch (e) {}
function tryPGate() {
  var inp = document.getElementById('pcode'); if (!inp) return;
  var code = inp.value.trim(); if (!code) return;
  apiCall('parentlink', { code: code }, function (j) {
    if (j && j.ok) {
      parentMode = true;
      try { localStorage.setItem(PARENTKEY, '1'); } catch (e) {}
      st.pv = null; toast('Bog\'landi: ' + j.name); render();
    } else { st.pgateErr = true; render(); }
  });
}
function tryPGate2() {
  var inp = document.getElementById('pcode2'); if (!inp) return;
  var code = inp.value.trim(); if (!code) return;
  apiCall('parentlink', { code: code }, function (j) {
    if (j && j.ok) { toast('Qo\'shildi: ' + j.name); st.pv = null; st.pvAdd = false; render(); }
    else toast('Kod noto\'g\'ri');
  });
}
function renderParent() {
  document.getElementById('nav').innerHTML = '';
  var h = '<div class="top"><div><div class="kicker">' + esc(ILM.app.name) + '</div><h1>Ota-ona kuzatuvi</h1></div></div>';
  var d = st.pv;
  if (d == null) {
    st.pv = 'loading';
    apiCall('parentview', null, function (j) { st.pv = (j && j.ok) ? j.children : []; render(); });
    document.getElementById('view').innerHTML = h + empty('⏳', 'Yuklanmoqda…', '');
    return;
  }
  if (d === 'loading') { document.getElementById('view').innerHTML = h + empty('⏳', 'Yuklanmoqda…', ''); return; }
  if (st.pvAdd) {
    document.getElementById('view').innerHTML = h + '<div class="card"><div class="t">Yana bitta farzand kodi</div>' +
      '<input id="pcode2" class="inp" placeholder="OTA-XXXXX" autocomplete="off" autocapitalize="characters">' +
      '<button class="btn gold wide" data-act="pgate2">Qo\'shish</button></div>' +
      '<button class="btn ghost wide" data-act="pvaddx">Bekor qilish</button>';
    var p2 = document.getElementById('pcode2');
    if (p2) { p2.focus(); p2.addEventListener('keydown', function (e) { if (e.key === 'Enter') tryPGate2(); }); }
    return;
  }
  if (!d.length) {
    h += empty('👤', 'Farzand topilmadi', 'Kod noto\'g\'ri kiritilgan bo\'lishi mumkin') +
      '<button class="btn ghost wide" data-act="punlink">Boshqa kod kiritish</button>';
  } else {
    d.forEach(function (c) {
      var g = c.group;
      h += '<div class="card blue"><div class="t">' + esc(c.name) + '</div>' +
        (g ? '<div class="d">' + esc(g.name) + ' · ' + esc(String(g.days || '').split(',').join('/')) + (g.time ? ' · soat ' + esc(g.time) : '') + '</div>' : '<div class="d">Guruhga hali biriktirilmagan</div>') + '</div>';
      h += '<div class="card"><div class="stats" style="margin:0;padding:0;border:none">' +
        '<div><b>' + c.done + '</b><span>o\'tilgan dars</span></div>' +
        '<div><b>' + c.acc + '%</b><span>aniqlik</span></div></div></div>';
      if (c.attendance && c.attendance.length) {
        h += '<div class="card"><div class="kicker">Davomat</div><div class="dgrid" style="margin-top:10px">';
        c.attendance.forEach(function (a) { h += '<span class="dc ' + (a.present ? 'bor' : 'yoq') + '">' + a.n + '</span>'; });
        h += '</div></div>';
      }
      h += '<div class="card"><div class="kicker">To\'lov</div><div class="t">' +
        (c.paid_until ? '✓ ' + esc(fmt(parseISO(c.paid_until))) + 'gacha to\'langan' : 'Ma\'lumot yo\'q') + '</div></div>';
    });
    h += '<button class="btn ghost wide" data-act="pvadd">+ Yana farzand qo\'shish</button>' +
      '<button class="btn ghost wide" style="margin-top:8px" data-act="punlink">Chiqish</button>';
  }
  document.getElementById('view').innerHTML = h;
}
function rGate() {
  if (st.gateMode === 'parent') return rGateParent();
  return '<div class="top"><div><div class="kicker">' + esc(ILM.app.name) + '</div><h1>Xush kelibsiz</h1>' +
    '<div class="sub" style="color:var(--gold2)">' + esc(ILM.app.slogan || '') + '</div></div></div>' +
    '<div class="card blue"><div class="row"><div class="avatar">' + esc(user.name.charAt(0).toUpperCase()) + '</div>' +
    '<div class="grow"><div class="t">' + esc(user.name) + '</div><div class="d">@' + esc(user.username || '—') + ' · ID ' + (user.id || '—') + '</div></div></div></div>' +
    '<div class="card"><div class="t">Guruh kodi</div><div class="d">Kodni ustozingizdan yoki markazdan olasiz. Bir marta kiritiladi.</div>' +
    '<input id="code" class="inp" placeholder="Kodni kiriting" autocomplete="off" autocapitalize="characters">' +
    (st.gateErr ? '<div class="hint" style="color:var(--red);text-align:center;margin-bottom:10px">Kod noto\'g\'ri — qayta urinib ko\'ring</div>' : '') +
    '<button class="btn gold wide" data-act="gate">Kirish</button></div>' +
    '<div class="hint" style="text-align:center">Kod yo\'qmi? Markaz bilan bog\'laning' + (ILM.center.phone ? ': ' + esc(ILM.center.phone) : '.') + '</div>' +
    '<div class="hint" style="text-align:center;margin-top:14px"><span data-act="gatemode" data-m="parent" style="color:var(--gold2);text-decoration:underline">Farzandim o\'qiydi — ota-ona sifatida kuzatmoqchiman</span></div>';
}
function rGateParent() {
  return '<div class="top"><div><div class="kicker">' + esc(ILM.app.name) + '</div><h1>Ota-ona kuzatuvi</h1>' +
    '<div class="sub" style="color:var(--gold2)">Farzandingiz o\'qishini shu yerdan kuzatasiz</div></div></div>' +
    '<div class="card"><div class="t">Farzand kodi</div><div class="d">Ustozdan yoki farzandingiz ilovasidan (Profil → Ota-onam uchun kod) olinadi.</div>' +
    '<input id="pcode" class="inp" placeholder="OTA-XXXXX" autocomplete="off" autocapitalize="characters">' +
    (st.pgateErr ? '<div class="hint" style="color:var(--red);text-align:center;margin-bottom:10px">Kod noto\'g\'ri</div>' : '') +
    '<button class="btn gold wide" data-act="pgate">Kirish</button></div>' +
    '<div class="hint" style="text-align:center"><span data-act="gatemode" data-m="student" style="color:var(--gold2);text-decoration:underline">← O\'quvchi sifatida kirish</span></div>';
}

/* ---------- sana yordamchilari ---------- */
var DAYS = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];                // getDay() tartibida
var DAYSF = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
var DAYN = { Du: 1, Se: 2, Ch: 3, Pa: 4, Ju: 5, Sh: 6, Ya: 0 };
var MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
function pad(n) { return (n < 10 ? '0' : '') + n; }
function today() { var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function parseISO(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
function fmt(d) { return d.getDate() + '-' + MONTHS[d.getMonth()]; }
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function money(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }

/* ---------- guruh ---------- */
function groupById(id) {
  var sg = srv.glist || [];
  for (var k = 0; k < sg.length; k++) if (sg[k].id === id) return srvGroup(sg[k]);
  var gs = ILM.groups || [];
  for (var i = 0; i < gs.length; i++) if (gs[i].id === id || gs[i].code === id) return gs[i];
  return null;
}
function myGroup() {
  if (srv.grp) return srvGroup(srv.grp);                      // serverdagi guruh ustun
  var id = (srv.me && srv.me.group) || progress.group;
  return id ? groupById(id) : null;
}
/* server yozuvini ilova ko'rinishiga keltiradi */
function srvGroup(g) {
  return {
    id: g.id, code: g.code, name: g.name, teacher: g.teacher, room: g.room,
    days: String(g.days || '').split(',').filter(Boolean), time: g.time, start: g.start,
    pay: g.pay_amount ? { amount: g.pay_amount, day: g.pay_day } : null,
    open_to: g.open_to | 0
  };
}
/* ustoz shu darsgacha ochgan bo'lsa — o'quvchi undan oldinga o'ta olmaydi */
function openLimit() { return (srv.openTo | 0) > 0 ? (srv.openTo | 0) : 0; }
function isLessonDay(d, g) {
  if (!g || !g.days) return false;
  if (g.start && d < parseISO(g.start)) return false;
  if ((ILM.holidays || []).indexOf(iso(d)) >= 0) return false;
  for (var i = 0; i < g.days.length; i++) if (DAYN[g.days[i]] === d.getDay()) return true;
  return false;
}
function monthStats(g, ref) {
  var y = ref.getFullYear(), m = ref.getMonth(), total = 0, past = 0, t = today();
  for (var d = new Date(y, m, 1); d.getMonth() === m; d = addDays(d, 1)) if (isLessonDay(d, g)) { total++; if (d <= t) past++; }
  return { total: total, past: past };
}
function nextLessonDay(g, from) { var t = today(); for (var i = from || 0; i < 31; i++) { var d = addDays(t, i); if (isLessonDay(d, g)) return d; } return null; }
function timeParts(s) { var m = String(s || '').match(/(\d{1,2}:\d{2})\D+(\d{1,2}:\d{2})/); return m ? { a: m[1], b: m[2] } : { a: String(s || '').trim(), b: '' }; }
/* «Ertaga soat 18:30 da darsingiz» — bugungi dars tugagan bo'lsa keyingisini ko'rsatadi */
function lessonReminder(g) {
  if (!g) return null;
  var t = today(), tp = timeParts(g.time), from = 0;
  if (tp.b) { var now = new Date(), hm = now.getHours() * 60 + now.getMinutes(), e = tp.b.split(':'); if (hm > (+e[0]) * 60 + (+e[1])) from = 1; }
  var nd = nextLessonDay(g, from); if (!nd) return null;
  var diff = Math.round((nd - t) / 86400000);
  var when = diff === 0 ? 'Bugun' : diff === 1 ? 'Ertaga' : DAYSF[nd.getDay()] + ', ' + fmt(nd);
  return { cls: diff <= 1 ? 'on' : '', text: when + ' soat ' + esc(tp.a) + ' da darsingiz' + (diff === 0 ? ' bor' : '') };
}
function nextPay(g) {
  if (!g || !g.pay) return null;
  var t = today(), p = g.pay, d, late = false;
  if (p.date) { d = parseISO(p.date); late = d < t; }
  else {
    d = new Date(t.getFullYear(), t.getMonth(), p.day);
    if (d < t) {
      if (t.getDate() - p.day <= 5) late = true;                   // to'lov kuni o'tgan, 5 kungacha eslatiladi
      else d = new Date(t.getFullYear(), t.getMonth() + 1, p.day);
    }
  }
  return { date: d, left: Math.round((d - t) / 86400000), amount: p.amount, late: late };
}
function daysText(g) { return (g.days || []).join(' · '); }

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
  var lim = openLimit();
  if (lim && n > lim) return false;                 // ustoz hali bu darsni ochmagan
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
function blockOf(n) { for (var i = 0; i < ILM.blocks.length; i++) { var b = ILM.blocks[i]; if (n >= b.from && n <= b.to) return b; } return ILM.blocks[ILM.blocks.length - 1]; }
function doneCount() { var c = 0; for (var i = 1; i <= N; i++) if (P(i).passed) c++; return c; }
function accuracy() { var s = progress.stat || { ans: 0, ok: 0 }; return s.ans ? Math.round(s.ok / s.ans * 100) : 0; }
function lt(n) { var l = L(n); return l && l.uz ? ' · ' + l.uz : ''; }
function scoreText(p) { return p.placed ? '✓ kirish' : (p.score != null ? p.score + '/' + p.total + ' ✓' : '✓'); }

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
function top(title, sub, withBack, search) {
  return '<div class="top">' + (withBack ? '<button class="back" data-act="back">‹</button>' : '') +
    '<div class="grow"><h1>' + title + '</h1>' + (sub ? '<div class="sub">' + sub + '</div>' : '') + '</div>' +
    (search ? '<button class="back" data-go="search" title="Kitobdan qidirish">🔍</button>' : '') +
    '</div>';
}
function rolePill() {
  var r = role();
  if (r === 'ustozplus') return '<span class="pill gold">★ Ustoz+</span>';
  if (r === 'ustoz') return '<span class="pill blue">Ustoz</span>';
  return '<span class="pill">O\'quvchi</span>';
}
function tabs(key, items, big) {
  var h = '<div class="tabs' + (big ? ' big' : '') + '">';
  items.forEach(function (it) { h += '<button class="' + (st.sub[key] === it[0] ? 'on' : '') + '" data-sub="' + key + ':' + it[0] + '">' + it[1] + '</button>'; });
  return h + '</div>';
}
function soon(what) { return '<div class="soon"><b>Tez kunda</b>' + what + ' bo\'limi tayyorlanmoqda</div>'; }
function empty(ic, t, d) { return '<div class="empty"><div class="eic">' + ic + '</div><b>' + t + '</b>' + (d ? '<span>' + d + '</span>' : '') + '</div>'; }
function link(ic, t, d, attrs) { return '<div class="link" ' + attrs + '><div class="lic">' + ic + '</div><div class="grow"><div class="t">' + t + '</div>' + (d ? '<div class="d">' + d + '</div>' : '') + '</div><span class="chev">›</span></div>'; }
function accordion(key, items) {
  var h = '<div class="card acclist">';
  items.forEach(function (it, i) {
    var open = !!st.acc[key + i];
    h += '<div class="acc' + (open ? ' open' : '') + '" data-act="acc" data-k="' + key + i + '"><div class="q"><span>' + esc(it.t || it.q) + '</span><i>' + (open ? '−' : '+') + '</i></div>' +
      (open ? '<div class="a">' + esc(it.d || it.a) + '</div>' : '') + '</div>';
  });
  return h + '</div>';
}
function ytId(u) {
  if (!u) return null;
  var m = u.match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}
function openLink(u) { if (tg && tg.openLink && /^https?:/.test(u)) { try { tg.openLink(u); return; } catch (e) {} } window.open(u, '_blank'); }
function openTg(u) { if (tg && tg.openTelegramLink) { try { tg.openTelegramLink(u); return; } catch (e) {} } window.open(u, '_blank'); }

/* ============================================================
   EKRANLAR
   ============================================================ */

/* ---- Asosiy ---- */
function rHome() {
  var cur = currentLesson(), done = doneCount(), first = user.name.split(' ')[0], g = myGroup(), t = today();
  var h = '<div class="top"><div><div class="kicker">' + esc(ILM.app.name) + '</div>' +
    '<h1><span class="ar">أَهْلًا</span> ' + esc(first) + '</h1>' +
    '<div class="sub" style="color:var(--gold2)">' + esc(ILM.app.slogan || '') + '</div></div></div>';

  /* dars eslatmasi — bitta qator */
  var rm = lessonReminder(g);
  if (rm) h += '<div class="remind ' + rm.cls + '"><i>🔔</i><span>' + rm.text + '</span></div>';
  else if (!g) h += '<div class="remind"><i>👥</i><span>' + (isPlus() && !st.viewAs ? 'Guruh tanlanmagan — pastdagi Ustoz+ panelidan tanlang, dars eslatmasi shu yerda chiqadi' : 'Guruh hali biriktirilmagan — ustozingizga ayting') + '</span></div>';

  /* joriy daraja */
  var b = blockOf(cur), l = L(cur), left = N - done;
  h += '<div class="card gold tap" data-tab="lessons">' +
    '<div class="kicker">Joriy daraja · ' + esc(ILM.app.course) + '</div>' +
    '<div class="row"><div class="grow"><div class="big">' + cur + '<small>-dars</small></div>' +
    '<div class="d" style="margin-top:4px">' + esc(b.title) + (l.uz ? ' · ' + esc(l.uz) : '') + (l.ar ? ' · <span class="ar">' + esc(l.ar) + '</span>' : '') + '</div></div>' +
    '<div class="lvl">' + done + '<small>/ ' + N + '</small></div></div>' +
    '<div class="bar"><i style="width:' + (done / N * 100) + '%"></i></div>' +
    '<div class="d" style="margin-top:8px">' + (done >= N ? 'Kurs tugallandi 🎉' : 'Keyingi: ' + (cur < N ? (cur + 1) + '-dars' + esc(lt(cur + 1)) : '—') + ' · oxirigacha ' + left + ' dars') + '</div>' +
    '<div class="path">' + (ILM.path || []).map(function (p, i) { return '<span class="' + (i === 0 ? 'on' : '') + '">' + esc(p) + '</span>'; }).join('<i>›</i>') + '</div></div>';

  /* davomat va o'zlashtirish */
  h += rDavomat();

  /* uy vazifa — o'quvchida */
  if (role() === 'oquvchi') h += rUyVazifaCard();

  /* kirish imtihoni taklifi — yangi o'quvchiga */
  if (role() === 'oquvchi' && !progress.placement && done === 0)
    h += '<div class="card deep tap" data-act="kirish"><div class="row"><div class="cic">🎯</div><div class="grow"><div class="t">Avval o\'qiganmisiz?</div><div class="d">Kirish imtihoni qaysi darsdan boshlashni aniqlab beradi</div></div><span class="chev">›</span></div></div>';

  /* guruhim */
  if (g) {
    var ms = monthStats(g, t);
    h += '<div class="card"><div class="row"><div class="grow"><div class="kicker">Guruhim</div><div class="t">' + esc(g.name) + '</div>' +
      '<div class="d">' + esc(g.teacher) + ' · ' + esc(daysText(g)) + ' · ' + esc(g.time) + '</div></div><div class="cic">👥</div></div>' +
      '<div class="stats"><div><b>' + ms.total + '</b><span>' + cap(MONTHS[t.getMonth()]) + 'da dars</span></div><div><b>' + ms.past + '</b><span>o\'tdi</span></div><div><b>' + (ms.total - ms.past) + '</b><span>qoldi</span></div></div></div>';
    var pu = srv.me && srv.me.paid_until;
    if (pu && pu >= iso(t)) {
      h += '<div class="card" style="border-color:rgba(61,220,132,.45);background:rgba(61,220,132,.08)"><div class="row"><div class="grow"><div class="kicker">To\'lov</div>' +
        '<div class="t">✓ To\'langan</div><div class="d">' + esc(fmt(parseISO(pu))) + 'gacha</div></div><div class="cic">💳</div></div></div>';
    } else {
      var np = nextPay(g);
      if (np) {
        var pc = np.late ? 'late' : (np.left <= 3 ? 'gold' : '');
        h += '<div class="card ' + pc + '"><div class="row"><div class="grow"><div class="kicker">To\'lov</div>' +
          '<div class="t">' + (np.late ? 'To\'lov kuni o\'tdi' : np.left === 0 ? 'Bugun to\'lov kuni' : 'Keyingi to\'lov: ' + fmt(np.date)) + '</div>' +
          '<div class="d">' + money(np.amount) + ' so\'m' + (np.late ? ' · ' + fmt(np.date) + ' edi' : np.left > 0 ? ' · ' + np.left + ' kun qoldi' : '') + '</div></div><div class="cic">💳</div></div></div>';
      }
    }
  }

  /* yaqin imtihon */
  var nx = nextExam();
  if (nx) {
    var es = examState(nx);
    h += '<div class="card deep tap" data-act="exam" data-id="' + nx.id + '"><div class="row"><div class="grow">' +
      '<div class="kicker">Yaqin imtihon</div><div class="t">' + esc(nx.title) + '</div>' +
      '<div class="d">' + nx.after + '-darsdan keyin · ' + (es === 'open' ? 'ochiq — topshirishingiz mumkin' : es === 'done' ? 'topshirilgan ✓' : 'hali yopiq') + '</div>' +
      '</div><span class="chev">›</span></div></div>';
  }

  /* ustoz+ paneli */
  if (isPlus()) {
    h += '<h2 class="sec">Ustoz+ paneli</h2><div class="card">';
    if (st.viewAs) {
      h += '<div class="switch"><div><div class="k">O\'quvchi ko\'zi bilan</div><div class="v">Hozir o\'quvchi ko\'rinishi — qulflar ishlaydi. O\'chirsangiz ustoz+ ga qaytasiz</div></div><button class="tog on" data-act="viewas"></button></div>';
    } else {
      h += '<div class="switch"><div><div class="k">Sinov rejimi</div><div class="v">Barcha dars va imtihonlar qulfsiz</div></div><button class="tog ' + (st.testMode ? 'on' : '') + '" data-act="testmode"></button></div>' +
        '<div class="switch"><div><div class="k">O\'quvchi ko\'zi bilan</div><div class="v">O\'quvchi nimani ko\'rishini tekshirish</div></div><button class="tog" data-act="viewas"></button></div>';
    }
    if (st.groups == null) {                                 // haqiqiy guruhlar — bir marta yuklanadi, keshlanadi
      st.groups = 'loading';
      apiCall('mygroups', null, function (j) { st.groups = (j && j.ok) ? j : { err: (j && j.error) || 'ulanmadi' }; render(); });
    }
    var realGs = (st.groups && st.groups.groups) || null;
    h += '<div class="switch" style="display:block"><div class="k">Guruh (sinov uchun)</div><div class="v" style="margin-bottom:8px">Jadval va to\'lov kartalarini, Uy vazifa va Reytingni shu guruh bo\'yicha ko\'rsatadi</div>' +
      '<select class="sel" data-act="setgroup"><option value="">— guruh tanlanmagan —</option>' +
      (realGs || []).map(function (gg) { return '<option value="' + esc(gg.id) + '"' + (progress.group === gg.id ? ' selected' : '') + '>' + esc(gg.name) + '</option>'; }).join('') + '</select>' +
      (realGs == null ? '<div class="hint" style="margin-top:6px">Yuklanmoqda…</div>' : (!realGs.length ? '<div class="hint" style="margin-top:6px">Hali guruh yaratilmagan</div>' : '')) +
      '</div>';
    h += link('🧑‍🎓', 'Foydalanuvchilar', srv.on ? 'Kim kirdi, kim online, guruhga qo\'shish' : 'Server ulanmagan', srv.on ? 'data-go="users"' : 'data-act="srvoff"');
    h += link('👥', 'Guruhlar ro\'yxati', (realGs ? realGs.length + ' guruh' : 'Yuklanmoqda…') + ' · kodlari va jadvali', 'data-go="groups"');
    h += link('💬', 'Izohlar', 'O\'quvchilardan kelgan izoh va takliflar', 'data-go="feedback"');
    h += link('📊', 'Oylik hisobot', 'Davomat va o\'zlashtirish — guruhlar bo\'yicha', 'data-go="report"');
    h += '<button class="btn ghost wide" style="margin:10px 0" data-act="sendrem">🔔 Eslatmalarni hozir yubor</button>';
    h += '<div class="hint" style="margin-top:2px">Server: ' + (srv.on ? '✅ ulangan · ' + ago(srv.last) : (API ? '⚠️ ' + esc(srv.err || (inTG ? 'ulanmoqda…' : 'faqat Telegram ichida ishlaydi')) : 'sozlanmagan')) + '</div>';
    if (!st.viewAs) h += '<div class="switch"><div><div class="k">Progressni tozalash</div><div class="v">Hamma natija o\'chadi (guruh qoladi)</div></div><button class="btn sm red" data-act="reset">Tozalash</button></div>';
    h += '</div>';
  }
  if (!inTG) h += '<div class="hint" style="text-align:center;margin-top:10px">Brauzerdagi sinov ko\'rinishi. Telegram ichida ochilganda haqiqiy ism va ID chiqadi.</div>';
  return h;
}
/* ---- Asosiy: davomat va o'zlashtirish ---- */
function rDavomat() {
  var lim = openLimit(), att = srv.attend;
  if (!lim && !att) return '';                       // guruh yo'q — ko'rsatiladigan narsa yo'q
  var oxiri = lim || currentLesson();
  var kelgan = 0, kelmagan = [], xom = [];
  for (var i = 1; i <= oxiri; i++) {
    if (att && att[i] === 1) kelgan++;
    if (att && att[i] === 0) kelmagan.push(i);
    if (!lessonOk(i)) xom.push(i);                   // video ko'rilmagan yoki test o'tilmagan
  }
  var h = '<div class="card"><div class="row"><div class="grow">' +
    '<div class="kicker">Davomat va o\'zlashtirish</div>' +
    '<div class="t">' + oxiri + '-dars' + esc(lt(oxiri)) + '</div>' +
    '<div class="d">' + (att ? kelgan + ' darsga kelgan' : 'Davomat hali belgilanmagan') + '</div>' +
    '</div><div class="cic">📋</div></div><div class="dgrid">';
  for (var k = 1; k <= oxiri; k++) {
    var cls = 'dc';
    if (att && att[k] === 0) cls += ' yoq';
    else if (att && att[k] === 1) cls += ' bor';
    if (!lessonOk(k)) cls += ' xom';
    h += '<span class="' + cls + '">' + k + '</span>';
  }
  h += '</div>';
  if (kelmagan.length) h += '<div class="dleg"><i class="yoq"></i>Kelmagan: <b>' + kelmagan.join(', ') + '</b>-dars</div>';
  if (xom.length) h += '<div class="dleg"><i class="xom"></i>To\'liq o\'zlashtirilmagan (video yoki test qolgan): <b>' + xom.join(', ') + '</b>-dars</div>';
  if (!kelmagan.length && !xom.length) h += '<div class="dleg"><i class="bor"></i>Hammasi joyida — qoldirilgan dars yo\'q</div>';
  return h + '</div>';
}
function nextExam() {
  for (var i = 0; i < ILM.exams.length; i++) if (!examOk(ILM.exams[i].id)) return ILM.exams[i];
  return null;
}

/* ---- Uy vazifa (o'quvchi) ---- */
function rUyVazifaCard() {
  if (st.hw == null) {
    st.hw = 'loading';
    apiCall('homework_list', null, function (j) { st.hw = (j && j.ok) ? j.items : []; render(); });
    return '';
  }
  if (st.hw === 'loading' || !st.hw.length) return '';
  var open = st.hw.filter(function (x) { return !x.done; }).length;
  return '<div class="card tap" data-go="homework"><div class="row"><div class="grow"><div class="kicker">Uy vazifa</div>' +
    '<div class="t">' + (open ? open + ' ta bajarilmagan' : 'Hammasi bajarilgan ✓') + '</div>' +
    '<div class="d">' + st.hw.length + ' ta topshiriq</div></div><div class="cic">📝</div></div></div>';
}
function rHomework() {
  var g = myGroup(), h = top('Uy vazifalar', g ? esc(g.name) : '', true);
  if (isStaff() && !st.viewAs) {                     // ustoz/ustoz+ — guruhga oid boshqaruv ko'rinishi
    if (!g) return h + empty('👥', 'Guruh tanlanmagan', 'Asosiy ekrandagi Ustoz+ panelidan «Guruh (sinov uchun)» ni tanlang, keyin shu yerga qayting');
    return h + rGrpHomework(g.id);
  }
  if (st.hw == null) { st.hw = 'loading'; apiCall('homework_list', null, function (j) { st.hw = (j && j.ok) ? j.items : []; render(); }); }
  if (st.hw === 'loading' || st.hw == null) return h + empty('⏳', 'Yuklanmoqda…', '');
  if (!st.hw.length) return h + empty('📝', 'Vazifa yo\'q', 'Ustoz topshiriq berganda shu yerda chiqadi');
  st.hw.forEach(function (x) {
    h += '<div class="att' + (x.done ? ' on' : '') + '" data-act="hwdone" data-id="' + x.id + '" data-undo="' + (x.done ? 1 : 0) + '">' +
      '<span class="box">' + (x.done ? '✓' : '') + '</span>' +
      '<div class="grow"><div class="nm" style="white-space:normal">' + esc(x.text) + '</div>' +
      (x.n ? '<span class="hint">' + x.n + '-darsga oid' + esc(lt(x.n)) + '</span>' : '') +
      (x.due ? '<span class="hint">Muddat: ' + esc(fmt(parseISO(x.due))) + '</span>' : '') + '</div></div>';
  });
  return h;
}

/* ---- Uy vazifa (ustoz — guruh ichida) ---- */
function rGrpHomework(gid) {
  var d = st.ghw;
  if (d == null || d.gid !== gid) {
    st.ghw = { gid: gid, loading: true };
    apiCall('homework_list', { group: gid }, function (j) { st.ghw = { gid: gid, items: (j && j.ok) ? j.items : [] }; render(); });
    return '<div class="card"><div class="kicker">Uy vazifa</div>' + empty('⏳', 'Yuklanmoqda…', '') + '</div>';
  }
  var h = '<div class="card"><div class="kicker">Uy vazifa</div>';
  if (d.loading) h += empty('⏳', 'Yuklanmoqda…', '');
  else if (!d.items.length) h += '<div class="d" style="margin:8px 0">Hali vazifa berilmagan</div>';
  else d.items.forEach(function (x) {
    h += '<div class="row" style="padding:8px 0;border-bottom:1px solid var(--line)"><div class="grow">' +
      '<div class="t" style="font-size:14.5px">' + esc(x.text) + '</div>' +
      '<div class="hint">' + (x.n ? x.n + '-dars · ' : '') + x.done + '/' + x.total + ' bajardi' + (x.due ? ' · muddat ' + esc(fmt(parseISO(x.due))) : '') + '</div></div>' +
      '<button class="wbtn" data-act="hwdel" data-id="' + x.id + '">🗑️</button></div>';
  });
  h += '<div class="fld" style="margin-top:10px"><textarea class="inp2 ta" data-f="hwtext" rows="2" placeholder="Yangi vazifa matni…">' + esc((st.form && st.form.hwtext) || '') + '</textarea></div>' +
    '<button class="btn sm gold" data-act="hwadd" data-gid="' + esc(gid) + '">+ Vazifa qo\'shish</button>' +
    '</div>';
  return h;
}

/* ---- Izoh va taklif ---- */
var FB_KINDS = [['taklif', '💡 Taklif'], ['muammo', '⚠️ Muammo']];
function fbCard(f, admin) {
  var pill = f.status === 'yangi' ? '<span class="pill">Yangi</span>' : f.status === 'korildi' ? '<span class="pill blue">Ko\'rildi</span>' : '<span class="pill gold">Hal qilindi</span>';
  var h = '<div class="card"><div class="row"><div class="grow">' +
    (admin ? '<div class="kicker">' + esc(f.uname || '—') + ' · @' + esc(f.uusername || '—') + '</div>' : '') +
    '<div class="d" style="white-space:pre-wrap">' + esc(f.text) + '</div>' +
    '<div class="hint" style="margin-top:6px">' + dtx(f.at) + '</div>' +
    (f.reply ? '<div class="hint" style="margin-top:6px;color:var(--gold2)">Javob: ' + esc(f.reply) + '</div>' : '') +
    '</div>' + pill + '</div>';
  if (admin && f.status !== 'hal') {
    h += '<div class="fld" style="margin-top:10px"><textarea class="inp2 ta" data-f="fbreply' + f.id + '" rows="2" placeholder="Javob (ixtiyoriy)">' + esc((st.form && st.form['fbreply' + f.id]) || '') + '</textarea></div>' +
      '<div class="row" style="gap:8px"><button class="btn sm" data-act="fbstatus" data-id="' + f.id + '" data-s="korildi">Ko\'rildi</button>' +
      '<button class="btn sm gold" data-act="fbstatus" data-id="' + f.id + '" data-s="hal">Hal qilindi</button></div>';
  }
  return h + '</div>';
}
function rFeedback() {
  if (isStaff() && !st.viewAs) return rFeedbackAdmin();
  var h = top('Izoh va taklif', 'Fikringiz muhim', true);
  h += '<div class="card"><div class="fld"><label>Turi</label><div class="dsel">' +
    FB_KINDS.map(function (k) { return '<button class="' + ((st.fbKind || 'taklif') === k[0] ? 'on' : '') + '" data-act="fbkind" data-k="' + k[0] + '">' + k[1] + '</button>'; }).join('') +
    '</div></div>' +
    '<div class="fld"><label>Xabar</label><textarea class="inp2 ta" data-f="fbtext" rows="4" placeholder="Fikringizni yozing…">' + esc((st.form && st.form.fbtext) || '') + '</textarea></div>' +
    '<button class="btn gold wide" data-act="fbsend">Yuborish</button></div>';
  if (st.fbmine == null) { st.fbmine = 'loading'; apiCall('feedback_mine', null, function (j) { st.fbmine = (j && j.ok) ? j.items : []; render(); }); }
  if (st.fbmine && st.fbmine !== 'loading' && st.fbmine.length) {
    h += '<h2 class="sec">Yuborganlarim</h2>';
    st.fbmine.forEach(function (f) { h += fbCard(f, false); });
  }
  return h;
}
function rFeedbackAdmin() {
  var h = top('Izohlar', 'O\'quvchilardan kelgan', true);
  if (st.fb == null) { st.fb = 'loading'; apiCall('feedback_list', null, function (j) { st.fb = (j && j.ok) ? j.items : []; render(); }); }
  if (st.fb === 'loading' || st.fb == null) return h + empty('⏳', 'Yuklanmoqda…', '');
  if (!st.fb.length) return h + empty('💬', 'Izoh yo\'q', '');
  st.fb.forEach(function (f) { h += fbCard(f, true); });
  return h;
}

/* ---- Kitobdan qidirish ---- */
function rSearch() {
  var h = top('Kitobdan qidirish', 'So\'z yoki harf yozing', true);
  h += '<div class="card"><input class="inp2" data-f="q" value="' + esc((st.form && st.form.q) || '') + '" placeholder="masalan: fatha, tanvin, ر harfi…" autocomplete="off"></div>';
  var q = ((st.form && st.form.q) || '').trim();
  if (q.length < 2) return h + empty('🔍', 'Qidirish uchun kamida 2 ta harf yozing', '');
  if (st.search == null || st.search.q !== q) {
    st.search = { q: q, loading: true };
    apiCall('search', { q: q }, function (j) {
      if (((st.form && st.form.q) || '').trim() === q) { st.search = { q: q, items: (j && j.ok) ? j.items : [] }; render(); }
    });
    return h + empty('⏳', 'Qidirilmoqda…', '');
  }
  if (st.search.loading) return h + empty('⏳', 'Qidirilmoqda…', '');
  if (!st.search.items.length) return h + empty('🔍', 'Hech narsa topilmadi', '');
  st.search.items.forEach(function (r) {
    h += '<div class="card tap" data-go="lesson" data-n="' + r.n + '"><div class="row"><div class="grow">' +
      '<div class="t">' + r.n + '-dars' + (r.uz ? ' · ' + esc(r.uz) : '') + (r.ar ? ' · <span class="ar">' + esc(r.ar) + '</span>' : '') + '</div>' +
      '<div class="d">' + esc(r.snippet) + '</div></div><span class="chev">›</span></div></div>';
  });
  return h;
}

/* ---- Reyting ---- */
function rRating() {
  var g = myGroup(), useId = st.params.gid || (g && g.id);
  var h = top('Reyting', g && !st.params.gid ? esc(g.name) : '', true);
  if (!useId) return h + empty('👥', 'Guruh yo\'q', 'Reyting guruh ichida hisoblanadi');
  if (st.rating == null || st.rating.gid !== useId) {
    st.rating = { gid: useId, loading: true };
    apiCall('rating', { group: useId }, function (j) { st.rating = { gid: useId, items: (j && j.ok) ? j.items : [] }; render(); });
    return h + empty('⏳', 'Yuklanmoqda…', '');
  }
  if (st.rating.loading) return h + empty('⏳', 'Yuklanmoqda…', '');
  if (!st.rating.items.length) return h + empty('🏆', 'Ro\'yxat bo\'sh', '');
  st.rating.items.forEach(function (r, i) {
    var mine = role() === 'oquvchi' && r.name === user.name;
    h += '<div class="card' + (mine ? ' blue' : '') + '"><div class="row"><div class="cic" style="font-weight:800">' + (i + 1) + '</div>' +
      '<div class="grow"><div class="t">' + esc(r.name) + '</div><div class="d">' + r.done + ' dars · ' + r.acc + '% aniqlik' + (r.linked ? '' : ' · ilovaga kirmagan') + '</div></div></div></div>';
  });
  return h;
}

/* ---- Oylik hisobot (ustoz / ustoz+) ---- */
function rReport() {
  var h = top('Oylik hisobot', 'Joriy oy', true);
  if (st.report == null) { st.report = 'loading'; apiCall('report', null, function (j) { st.report = (j && j.ok) ? j : { err: (j && j.error) || 'ulanmadi' }; render(); }); }
  if (st.report === 'loading' || st.report == null) return h + empty('⏳', 'Yuklanmoqda…', '');
  if (st.report.err) return h + empty('⚠️', 'Olinmadi', esc(st.report.err));
  if (!st.report.groups.length) return h + empty('📊', 'Guruh yo\'q', '');
  st.report.groups.forEach(function (g) {
    h += '<div class="card"><div class="t">' + esc(g.group) + '</div>' +
      '<div class="stats"><div><b>' + g.students + '</b><span>o\'quvchi</span></div>' +
      '<div><b>' + (g.attendancePct == null ? '—' : g.attendancePct + '%') + '</b><span>davomat</span></div>' +
      '<div><b>' + (g.avgAcc == null ? '—' : g.avgAcc + '%') + '</b><span>aniqlik</span></div></div>';
    if (g.zaif.length) h += '<div class="hint" style="margin-top:8px;color:var(--red)">E\'tibor talab qiladi: ' + g.zaif.map(function (z) { return esc(z.name) + ' (' + z.kelmagan + ' marta kelmagan)'; }).join(', ') + '</div>';
    h += '</div>';
  });
  return h;
}

/* ---- O'quvchi kartasi (ustoz / ustoz+) ---- */
function rStudentCard() {
  var id = st.params.id, h = top('Yuklanmoqda…', '', true);
  if (st.scard == null || st.scard.id !== id) {
    st.scard = { id: id, loading: true };
    apiCall('student', { student: id }, function (j) {
      st.scard = (j && j.ok) ? merge({ id: id }, j) : { id: id, err: (j && j.error) || 'ulanmadi' };
      render();
    });
    return h + empty('⏳', 'Yuklanmoqda…', '');
  }
  if (st.scard.loading) return h + empty('⏳', 'Yuklanmoqda…', '');
  if (st.scard.err) return h + empty('⚠️', 'Ochilmadi', esc(st.scard.err));
  var s = st.scard.student, u = st.scard.user, p = st.scard.progress || {};
  var done = p.lessons ? Object.keys(p.lessons).filter(function (k) { return p.lessons[k].passed; }).length : 0;
  var acc = (p.stat && p.stat.ans) ? Math.round(p.stat.ok / p.stat.ans * 100) : 0;
  h = top(esc(s.name), s.phone ? esc(s.phone) : '', true);
  h += '<div class="card blue"><div class="stats" style="margin:0;padding:0;border:none">' +
    '<div><b>' + done + '</b><span>o\'tilgan dars</span></div>' +
    '<div><b>' + acc + '%</b><span>aniqlik</span></div>' +
    '<div><b>' + (p.mistakes ? p.mistakes.length : 0) + '</b><span>xato</span></div></div></div>';

  h += '<div class="card">' + (st.stedit
    ? '<div class="fld"><label>Ism-familya</label><input class="inp2" data-f="editname" value="' + esc((st.form && st.form.editname != null) ? st.form.editname : s.name) + '"></div>' +
      '<div class="fld"><label>Telefon</label><input class="inp2" data-f="editphone" value="' + esc(((st.form && st.form.editphone != null) ? st.form.editphone : (s.phone || ''))) + '"></div>' +
      '<div class="fld"><label>Telegram ID (bog\'lash uchun, ixtiyoriy)</label><input class="inp2" data-f="edituid" value="' + esc(((st.form && st.form.edituid != null) ? st.form.edituid : (s.user_id || ''))) + '" inputmode="numeric"></div>' +
      '<div class="row" style="gap:8px"><button class="btn sm gold" data-act="stsave" data-id="' + s.id + '">Saqlash</button><button class="btn sm ghost" data-act="steditx">Bekor qilish</button></div>'
    : '<div class="row" style="gap:8px"><button class="btn sm ghost" data-act="stedit">✏️ Tahrirlash</button><button class="btn sm red" data-act="stdel" data-id="' + s.id + '">🗑️ O\'chirish</button></div>') + '</div>';

  if (st.scard.attendance && st.scard.attendance.length) {
    h += '<div class="card"><div class="kicker">Davomat</div><div class="dgrid" style="margin-top:10px">';
    st.scard.attendance.forEach(function (a) { h += '<span class="dc ' + (a.present ? 'bor' : 'yoq') + '">' + a.n + '</span>'; });
    h += '</div></div>';
  } else h += '<div class="card"><div class="d">Davomat hali yo\'q</div></div>';

  h += '<div class="card"><div class="kicker">To\'lov holati</div>' +
    '<div class="t">' + (u && u.paid_until ? '✓ ' + esc(fmt(parseISO(u.paid_until))) + 'gacha to\'langan' : 'To\'lov belgilanmagan') + '</div>' +
    (u ? '<div class="fld" style="margin-top:10px"><label>Yangi sana (to\'langan hisoblanadi)</label>' +
      '<input class="inp2" type="date" data-f="paiduntil' + s.id + '" value="' + esc((st.form && st.form['paiduntil' + s.id]) || '') + '"></div>' +
      '<button class="btn sm gold" data-act="setpaid" data-uid="' + u.id + '" data-sid="' + s.id + '">Belgilash</button>' :
      '<div class="hint">O\'quvchi hali ilovaga kirmagan — to\'lov Telegram hisobiga bog\'liq</div>') +
    '</div>';

  h += '<div class="card"><div class="kicker">Ota-ona kodi</div>' +
    (s.parent_code ? '<div class="t" style="font-family:monospace">' + esc(s.parent_code) + '</div><div class="d">Ota-onasiga shu kodni bering — ilovada "Ota-onaman" havolasidan kiritadi</div>' :
      '<div class="d">Hali yaratilmagan</div>') +
    '<button class="btn sm ghost" style="margin-top:10px" data-act="gencode" data-id="' + s.id + '">' + (s.parent_code ? 'Qayta ko\'rish' : 'Kod yaratish') + '</button></div>';

  if (st.scard.events && st.scard.events.length) {
    h += '<div class="card"><div class="kicker">Oxirgi natijalar</div>';
    st.scard.events.slice(0, 10).forEach(function (e) {
      h += '<div class="row" style="padding:6px 0"><div class="grow"><div class="t" style="font-size:14.5px">' + esc(e.kind) + ' · ' + esc(e.ref) + '</div>' +
        '<div class="hint">' + dtx(e.at) + '</div></div><div>' + (e.passed ? '✓ ' : '') + e.score + '/' + e.total + '</div></div>';
    });
    h += '</div>';
  }
  return h;
}

/* ---- Darslar ---- */
function rLessons() {
  var cur = currentLesson(), b = blockOf(cur);
  var h = top('Darslar', esc(ILM.app.course) + ' · ' + N + ' dars · ' + ILM.blocks.length + ' blok', false, true);
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
  var right = s === 'done' ? scoreText(p) : s === 'current' ? 'Davom etish ›' : s === 'open' ? '›' : '🔒';
  var ar = l.ar ? '<div class="ar">' + esc(l.ar) + '</div>' : '<div class="ar empty">' + n + '-dars</div>';
  var uz = l.uz ? '<div class="uz">' + esc(l.uz) + '</div>' : (l.ar ? '' : '<div class="uz">nomi keyin kiritiladi</div>');
  return '<div class="lesson ' + s + '" data-go="lesson" data-n="' + n + '"><div class="num">' + n + '</div>' +
    '<div class="ttl">' + ar + uz + '</div><div class="st">' + right + '</div></div>';
}
function examRow(e) {
  var s = examState(e), r = progress.exams[e.id] || {};
  var right = s === 'done' ? scoreText(r) : s === 'open' ? 'Boshlash ›' : '🔒';
  return '<div class="lesson exam ' + s + '" data-act="exam" data-id="' + e.id + '"><div class="num">✓</div>' +
    '<div class="ttl"><div class="ar empty">' + esc(e.title) + '</div><div class="uz">' + ILM.examQ[e.id].length + ' savol · o\'tish ' + ILM.rules.examPassPct + '%</div></div>' +
    '<div class="st">' + right + '</div></div>';
}

/* ---- Dars ichi ---- */
function rLesson() {
  var n = +st.params.n, l = L(n), p = P(n), s = lessonState(n), locked = s === 'locked';
  var sub = (l.ar ? '<span class="ar">' + esc(l.ar) + '</span>' : '') + (l.uz ? (l.ar ? ' · ' : '') + esc(l.uz) : '');
  var h = top(n + '-dars', sub || esc(blockOf(n).title), true, true);

  if (locked) h += '<div class="card"><div class="t">🔒 Bu dars hali yopiq</div><div class="d">Avval ' + (n - 1) + '-darsni tugating: darslik, video va test.</div></div>';
  if (p.placed) h += '<div class="card deep"><div class="t">✓ Kirish imtihoni bilan o\'tilgan</div><div class="d">Bu dars sizga tanish deb topildi. Takrorlash uchun ochiq.</div></div>';

  var dis = locked ? ' dis' : '';
  h += '<div class="part' + (p.book ? ' ok' : '') + dis + '" data-go="book" data-n="' + n + '"><div class="ic">📖</div>' +
    '<div class="grow"><div class="t">Darslik</div><div class="d">Kitob matni' + (l.bet ? ' · ' + esc(l.bet) + '-bet' : '') + '</div></div>' +
    '<div class="mark">' + (p.book ? '✓' : '›') + '</div></div>';
  h += '<div class="part' + (p.video ? ' ok' : '') + dis + '" data-go="video" data-n="' + n + '"><div class="ic">🎬</div>' +
    '<div class="grow"><div class="t">Video darslik</div><div class="d">' + (p.video ? 'Ko\'rildi' : (l.video ? 'Oxirigacha ko\'ring' : 'video keyin qo\'shiladi')) + '</div></div>' +
    '<div class="mark">' + (p.video ? '✓' : '›') + '</div></div>';
  var tq = (ILM.tests[n] || []).length;
  h += '<div class="part' + (p.passed ? ' ok' : '') + dis + '" data-act="starttest" data-n="' + n + '"><div class="ic">✍️</div>' +
    '<div class="grow"><div class="t">Test</div><div class="d">' + (p.passed ? (p.score != null ? p.score + '/' + p.total + ' — o\'tildi' : 'o\'tildi') : tq + ' savol · o\'tish ' + ILM.rules.passPct + '%') + '</div></div>' +
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

/* ---- matn ichidagi videolar (kitobdagi QR kod turgan joylarda) ---- */
st.vids = {};                                   // shu safar ochilganlari
function seenVid(key) {
  progress.vids = progress.vids || {};
  if (progress.vids[key]) return;
  progress.vids[key] = Date.now(); save();
  toast('Video ko\'rildi ✓'); paintVids();
}
function paintVids() {
  var list = document.querySelectorAll('#view .vidbox');
  for (var i = 0; i < list.length; i++) {
    var b = list[i], id = b.getAttribute('data-yt') || '', url = b.getAttribute('data-url') || '';
    var label = b.getAttribute('data-label') || 'Videoni ko\'rish';
    var seen = (progress.vids || {})[id || url];
    if (id && st.vids[id]) {
      if (b.classList.contains('on')) continue;          // allaqachon ochilgan — tegmaymiz
      b.classList.add('on');
      b.innerHTML = '<span class="slot"><span id="ytp-' + esc(id) + '"></span></span>' +
        '<span class="vfoot"><span>' + esc(label) + (seen ? ' ✓' : '') + '</span>' +
        '<a href="https://youtu.be/' + esc(id) + '" target="_blank" rel="noopener">YouTube ↗</a></span>';
    } else if (!b.classList.contains('on')) {
      b.innerHTML = '<button class="play" data-act="playvid" data-id="' + esc(id) + '" data-url="' + esc(url) + '">' +
        '<i>' + (url ? '✈' : '▶') + '</i><span>' + esc(label) + (seen ? ' ✓' : '') + '</span></button>' +
        (id ? '<a class="ext" href="https://youtu.be/' + esc(id) + '" target="_blank" rel="noopener">YouTube ↗</a>' : '');
    }
  }
  mountVids();
}
function mountVids() {
  var boxes = document.querySelectorAll('#view .vidbox.on[data-yt]'), need = [];
  for (var i = 0; i < boxes.length; i++) if (!boxes[i]._on) need.push(boxes[i]);
  if (!need.length) return;
  var make = function () {
    need.forEach(function (b) {
      if (b._on) return;
      var id = b.getAttribute('data-yt'), slot = document.getElementById('ytp-' + id);
      if (!slot) return;
      b._on = true;
      try {
        new YT.Player(slot, {
          videoId: id, playerVars: { rel: 0, modestbranding: 1, playsinline: 1, autoplay: 1 },
          events: { onStateChange: function (e) { if (e.data === YT.PlayerState.ENDED) seenVid(id); } }
        });
      } catch (e) { b._on = false; }
    });
  };
  if (window.YT && window.YT.Player) return make();
  window.onYouTubeIframeAPIReady = make;
  if (!document.getElementById('ytapi')) {
    var s = document.createElement('script'); s.id = 'ytapi'; s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
  }
}

/* ---- shrift kattaligi (o'quvchi o'zi tanlaydi, eslab qolinadi) ---- */
var FSKEY = 'ilm-fs', FS = [0.85, 1, 1.15, 1.3, 1.5, 1.75];
try { var _fs = parseFloat(localStorage.getItem(FSKEY)); if (FS.indexOf(_fs) >= 0) st.fs = _fs; } catch (e) {}
if (!st.fs) st.fs = 1;
function setFS(d) {
  var i = FS.indexOf(st.fs); if (i < 0) i = 1;
  i = Math.max(0, Math.min(FS.length - 1, i + d));
  if (FS[i] === st.fs) return;
  st.fs = FS[i];
  try { localStorage.setItem(FSKEY, st.fs); } catch (e) {}
  toast('Shrift ' + Math.round(st.fs * 100) + '%');
  render();
}
function fsctl() {
  var i = FS.indexOf(st.fs); if (i < 0) i = 1;
  return '<div class="fsctl">' +
    '<button class="s" data-act="fs" data-d="-1"' + (i === 0 ? ' disabled' : '') + '>A</button>' +
    '<b>' + Math.round(st.fs * 100) + '%</b>' +
    '<button class="l" data-act="fs" data-d="1"' + (i === FS.length - 1 ? ' disabled' : '') + '>A</button></div>';
}

/* ---- Darslik (kitob matni serverdan) ---- */
function lessonHead(n) {
  var l = L(n), b = blockOf(n);
  return '<div class="lhead">' +
    (l.ar ? '<div class="lar">' + esc(l.ar) + '</div>' : '') +
    '<div class="lno">' + n + '-dars</div>' +
    (l.uz ? '<div class="luz">' + esc(l.uz) + '</div>' : '') +
    '<div class="lmeta">' + esc(b.title) +
      (l.bet ? ' · kitob ' + esc(l.bet) + '-bet' : '') +
      (l.kitobda ? ' · kitobda ' + esc(l.kitobda) : '') + '</div></div>';
}
function rBook() {
  var n = +st.params.n;
  var h = top('Darslik', n + '-dars', true, true) + lessonHead(n);
  var d = st.book;
  if (!d || d.n !== n) {
    st.book = { n: n, loading: true };
    apiCall('lesson', { n: n }, function (j) {
      st.book = { n: n, html: (j && j.ok) ? j.lesson.html : null, err: (j && j.error) || 'serverga ulanmadi' };
      render();
    });
    return h + empty('⏳', 'Yuklanmoqda…', '');
  }
  if (d.loading) return h + empty('⏳', 'Yuklanmoqda…', '');
  if (!d.html) {
    return h + empty('📖', 'Darslik matni hali tayyor emas', esc(d.err || '')) +
      '<button class="btn ghost wide" style="margin-bottom:10px" data-act="rebook">Qayta urinish</button>' +
      '<button class="btn gold wide" data-act="back">Darsga qaytish</button>';
  }
  h += '<div class="book" style="--fs:' + st.fs + '">' + d.html + '</div>';
  h += '<button class="btn gold wide" data-act="back">Darsga qaytish</button>';
  h += fsctl();
  return h;
}

/* ---- Video ---- */
function rVideo() {
  var n = +st.params.n, l = L(n), p = P(n), id = ytId(l.video);
  var h = top('Video darslik', n + '-dars', true);
  if (!l.video) {
    h += empty('🎬', 'Video hali qo\'shilmagan', 'Havola berilgach shu yerda ochiladi. Hozircha bu shart bajarilgan hisoblanadi.');
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
  else if (kind === 'placement') qs = placementStage1();
  else qs = (ILM.tests[key] || []).map(function (q, i) { return merge({ _n: key, _i: i }, q); });
  if (!qs.length) return toast('Savollar hali yo\'q');
  st.run = { kind: kind, key: key, qs: qs, i: 0, pick: null, shown: false, ok: 0, wrong: [], done: false, stage: 1, res: {}, bres: {}, weak: null, soft: null, rec: null };
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
  if (r.kind === 'placement') return 'Kirish imtihoni';
  return 'Xatolar ustida ishlash';
}
function rTest() {
  var r = st.run; if (!r) return rHome();
  if (r.i >= r.qs.length) return rResult();
  var q = r.qs[r.i], opts = options(q), ci = correctIdx(q);
  var h = top(runTitle(r), r.kind === 'placement' ? (r.stage === 1 ? '1-bosqich · bloklar' : '2-bosqich · ' + esc(r.weak.title) + ' ichida') : '', true);
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
  else h += '<button class="btn gold wide" data-act="next">' + (r.i + 1 >= r.qs.length && r.kind !== 'placement' ? 'Natijani ko\'rish' : 'Keyingi') + ' ›</button>';
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
  if (r.kind === 'placement') {
    var pk = q._stage + ':' + q._pn, pr = r.res[pk] = r.res[pk] || { ok: 0, n: 0 }; pr.n++; if (right) pr.ok++;   // bosqichlar alohida hisoblanadi
    var br = r.bres[q._pb] = r.bres[q._pb] || { ok: 0, n: 0 }; br.n++; if (right) br.ok++;
  }
  save(); render();
}
function rResult() {
  var r = st.run, len = r.qs.length, pct = len ? Math.round(r.ok / len * 100) : 0;
  if (r.kind === 'placement') return rPlaceResult(r, pct);
  var graded = r.kind === 'lesson' || r.kind === 'exam';
  var thr = r.kind === 'exam' ? ILM.rules.examPassPct : ILM.rules.passPct;
  var passed = graded && pct >= thr;
  if (graded && !r.done) {
    r.done = true;
    var rec = r.kind === 'lesson' ? PL(r.key) : (progress.exams[r.key] = progress.exams[r.key] || {});
    rec.attempts = (rec.attempts || 0) + 1;
    if (passed || !rec.passed) { rec.score = r.ok; rec.total = len; }
    rec.passed = rec.passed || passed;
    save(); sendEvent(r.kind, r.key, r.ok, len, passed);      // rasmiy natija serverga
  }
  var h = top(runTitle(r), '', true);
  h += ring(pct, r.ok + ' / ' + len, graded && passed) +
    '<div class="card ' + (graded ? (passed ? 'gold' : 'deep') : 'deep') + '" style="text-align:center">' +
    '<div class="t">' + (graded ? (passed ? 'O\'tdingiz 🎉' : 'O\'tmadingiz') : 'Mashq tugadi') + '</div>' +
    '<div class="d">' + (graded ? 'O\'tish chegarasi ' + thr + '%' : 'Natija balga ta\'sir qilmaydi') + (r.wrong.length ? ' · ' + r.wrong.length + ' ta xato' : '') + '</div></div>';
  if (r.kind === 'lesson' && passed && r.key < N && unlocked(r.key + 1))
    h += '<button class="btn gold wide" style="margin-bottom:10px" data-go="lesson" data-n="' + (r.key + 1) + '">' + (r.key + 1) + '-darsga o\'tish ›</button>';
  if (r.wrong.length) h += '<div class="card"><div class="row"><div class="grow"><div class="t">Xatolar ustida ishlash</div><div class="d">Xato qilingan savollar Mashq bo\'limida saqlandi</div></div><span class="badge gold">' + progress.mistakes.length + '</span></div></div>';
  h += '<button class="btn ghost wide" style="margin-bottom:10px" data-act="retry">Qayta yechish</button>' +
    '<button class="btn ghost wide" data-act="back">Qaytish</button>';
  return h;
}
function ring(pct, small, gold) {
  var bg = 'conic-gradient(#D4AF37 ' + pct + '%, rgba(255,255,255,.12) 0)';
  return '<div class="ring" style="background:' + bg + '"><div class="rin" style="background:' + (gold ? '#B8921E' : '#0F2A4A') + '"><b>' + pct + '%</b><small>' + small + '</small></div></div>';
}

/* ---- Kirish (placement) imtihoni ---- */
function pickQs(n, count, avoid) {
  var list = ILM.tests[n] || [], out = [], used = {};
  if (!list.length) return out;
  (avoid || []).forEach(function (i) { used[i] = true; });
  var tries = 0;
  while (out.length < Math.min(count, list.length) && tries < 50) {
    var i = Math.floor(Math.random() * list.length); tries++;
    if (used[i]) continue; used[i] = true;
    out.push(merge({ _pn: n, _pi: i }, list[i]));
  }
  return out;
}
function placementStage1() {
  var qs = [], per = (ILM.placement && ILM.placement.perBlock) || 3;
  ILM.blocks.forEach(function (bk) {
    var span = bk.to - bk.from, picks = [];
    for (var k = 0; k < per; k++) picks.push(bk.from + Math.round(span * k / Math.max(per - 1, 1)));
    picks.forEach(function (n) { pickQs(n, 1).forEach(function (q) { q._pb = bk.n; q._stage = 1; qs.push(q); }); });
  });
  return qs;
}
/* Qoida: 1-bosqichda bitta ham xato bo'lgan blok — «nomzod». Nomzod bloklar tartib bilan dars-dars tekshiriladi:
   birinchi 0/2 dars → boshlanish; blok oxirida 1/2 dars bo'lsa → o'sha; hammasi 2/2 → keyingi nomzod blok;
   nomzod qolmasa → kurs to'liq ma'lum. */
function placementStep(r) {
  if (r.kind !== 'placement') return;
  if (r.stage === 1) {
    if (r.i < r.qs.length) return;
    r.cands = ILM.blocks.filter(function (bk) { var s = r.bres[bk.n] || { ok: 0, n: 0 }; return s.ok < s.n; });
    r.stage = 2; nextCandidate(r); return;
  }
  var prev = r.qs[r.i - 1]; if (!prev || prev._stage !== 2) return;
  var nq = r.qs[r.i]; if (nq && nq._pn === prev._pn) return;          // shu darsning savollari hali tugamadi
  var ps = r.res['2:' + prev._pn] || { ok: 0, n: 0 };
  if (ps.ok === 0) { r.rec = prev._pn; r.qs.length = r.i; return; }   // to'liq zaif dars — shu yerda to'xtaymiz
  if (ps.ok < ps.n && r.soft == null) r.soft = prev._pn;
  if (r.i >= r.qs.length) {                                            // blok tugadi
    if (r.soft != null) { r.rec = r.soft; return; }
    nextCandidate(r);
  }
}
function nextCandidate(r) {
  var per = (ILM.placement && ILM.placement.perLesson) || 2, bk = r.cands.shift();
  if (!bk) { r.rec = N + 1; return; }
  r.weak = bk; r.soft = null;
  for (var n = bk.from; n <= bk.to; n++) pickQs(n, per).forEach(function (q) { q._pb = bk.n; q._stage = 2; r.qs.push(q); });
  if (r.i >= r.qs.length) nextCandidate(r);                            // savolsiz blok — o'tkazib yuboriladi
}
function rPlaceResult(r, pct) {
  var n = r.rec || 1, len = r.qs.length;
  if (!r.done) {
    r.done = true;
    var pl = progress.placement = progress.placement || { attempts: [] };
    pl.attempts = pl.attempts || [];
    pl.attempts.push({ n: n, date: iso(today()), ok: r.ok, total: len });
    pl.n = n; pl.date = iso(today());
    save(); sendEvent('placement', n, r.ok, len, true);
  }
  var full = n > N, b = full ? null : blockOf(n), l = full ? null : L(n);
  var h = top('Kirish imtihoni', 'Natija', true);
  h += ring(pct, r.ok + ' / ' + len, true) +
    '<div class="card gold" style="text-align:center"><div class="kicker">Tavsiya</div>' +
    '<div class="t">' + (full ? 'Fonetikani to\'liq bilasiz' : n + '-darsdan boshlang') + '</div>' +
    '<div class="d">' + (full ? 'Ustoz bilan gaplashing — keyingi bosqich Grammatika' : esc(b.title) + (l.uz ? ' · ' + esc(l.uz) : '') + (l.ar ? ' · <span class="ar">' + esc(l.ar) + '</span>' : '') + (r.weak ? ' · zaif blok: ' + esc(r.weak.title) : '')) + '</div>' +
    (l && !l.uz ? '<div class="hint" style="margin-top:6px">Kitobdagi mavzu nomi darslar nomlangach ko\'rinadi</div>' : '') + '</div>';
  h += '<div class="hint" style="text-align:center;margin:0 0 14px">Talaffuzni ustoz og\'zaki tekshiradi. Guruhga qo\'shishda shu natija hisobga olinadi.</div>';
  if (n > 1 && progress.placement.applied !== n) h += '<button class="btn gold wide" style="margin-bottom:10px" data-act="applyplace" data-n="' + n + '">' + (full ? 'Barcha darslarni ochish' : n + '-darsdan boshlash ✓') + '</button>';
  else if (progress.placement.applied === n) h += '<div class="hint" style="text-align:center;margin-bottom:10px">✓ Qo\'llanilgan — Darslar bo\'limida ' + (full ? 'hammasi' : n + '-dars') + ' ochiq</div>';
  h += '<button class="btn ghost wide" style="margin-bottom:10px" data-act="retry">Qayta topshirish</button>' +
    '<button class="btn ghost wide" data-act="back">Qaytish</button>';
  return h;
}
function applyPlacement(n) {
  for (var i = 1; i < n && i <= N; i++) { var p = PL(i); if (!p.passed) { p.passed = true; p.book = true; p.video = true; p.placed = true; } }
  ILM.exams.forEach(function (e) { if (e.after < n && !examOk(e.id)) progress.exams[e.id] = { passed: true, placed: true }; });
  progress.placement = progress.placement || {}; progress.placement.applied = n;
  save();
}
function rKirish() {
  var pl = progress.placement, h = '';
  h += '<div class="card blue"><div class="kicker">Kirish imtihoni · ' + esc(ILM.app.course) + '</div><div class="t">Qaysi darsdan boshlaysiz?</div>' +
    '<div class="d">Avval ozgina o\'qigan bo\'lsangiz, bu test sizga mos darsni aniqlaydi. 1-bosqich — har blokdan ' + ((ILM.placement && ILM.placement.perBlock) || 4) + ' savol. 2-bosqich — xatosi bo\'lgan blok ichida har darsdan ' + ((ILM.placement && ILM.placement.perLesson) || 2) + ' savol, ketma-ket. Taxminan 25–45 savol, 10–15 daqiqa.</div></div>';
  if (pl && pl.n) {
    var full = pl.n > N;
    h += '<div class="card"><div class="row"><div class="grow"><div class="kicker">Oxirgi natija · ' + esc(fmt(parseISO(pl.date))) + '</div>' +
      '<div class="t">' + (full ? 'Fonetika to\'liq' : pl.n + '-darsdan') + '</div><div class="d">' + (pl.attempts || []).length + ' urinish' + (pl.applied === pl.n ? ' · qo\'llanilgan ✓' : '') + '</div></div>' +
      (pl.applied !== pl.n && pl.n > 1 ? '<button class="btn sm gold" data-act="applyplace" data-n="' + pl.n + '">Qo\'llash</button>' : '') + '</div></div>';
  }
  h += '<button class="btn gold wide" data-act="placement">' + (pl && pl.n ? 'Qayta topshirish' : 'Boshlash') + ' ›</button>' +
    '<div class="hint" style="text-align:center;margin-top:12px">Talaffuzni ustoz og\'zaki tekshiradi. Natija guruhga qo\'shishda hisobga olinadi.</div>';
  return h;
}

/* ---- Mashq ---- */
function rMashq() {
  var h = top('Mashq', 'Mavzu tanlab mashq qiling', false);
  h += tabs('mashq', [['fon', 'Fonetika'], ['gram', 'Grammatika']]);
  if (st.sub.mashq === 'gram') return h + soon('Grammatika mashqlari');
  h += '<div class="card tap" data-act="mistakes"><div class="row"><div class="cic">↻</div>' +
    '<div class="grow"><div class="t">Xatolar ustida ishlash</div><div class="d">' + (progress.mistakes.length ? 'Xato qilingan savollarni qayta yeching' : 'Hozircha xato yo\'q') + '</div></div><span class="badge gold">' + progress.mistakes.length + '</span></div></div>';
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
  var h = top('Imtihon', st.sub.imt === 'kirish' ? 'Qaysi darsdan boshlashni aniqlang' : 'Mini · Oraliq · Yakuniy', false);
  h += tabs('imt', [['exams', 'Imtihonlar'], ['kirish', 'Kirish imtihoni']], true);
  h += tabs('imtihon', [['fon', 'Fonetika'], ['gram', 'Grammatika']]);
  if (st.sub.imtihon === 'gram') return h + soon(st.sub.imt === 'kirish' ? 'Grammatika kirish imtihoni' : 'Grammatika imtihonlari');
  if (st.sub.imt === 'kirish') return h + rKirish();
  ILM.exams.forEach(function (e) {
    var s = examState(e), r = progress.exams[e.id] || {};
    var cls = e.type === 'yakuniy' ? 'gold' : e.type === 'oraliq' ? 'blue' : '';
    var right = s === 'done' ? scoreText(r) : s === 'open' ? 'Boshlash ›' : '🔒';
    h += '<div class="card tap ' + cls + '" data-act="exam" data-id="' + e.id + '" style="' + (s === 'locked' ? 'opacity:.55' : '') + '"><div class="row"><div class="grow">' +
      '<div class="kicker">' + (e.type === 'mini' ? 'Mini' : e.type === 'oraliq' ? 'Oraliq' : 'Yakuniy') + ' imtihon</div>' +
      '<div class="t">' + esc(e.title) + '</div><div class="d">' + e.after + '-darsdan keyin · ' + ILM.examQ[e.id].length + ' nazariy' +
      (e.oral ? ' + ' + e.oral + ' amaliy (og\'zaki, ustoz baholaydi)' : '') + ' · o\'tish ' + ILM.rules.examPassPct + '%</div>' +
      '</div><div class="st" style="font-weight:600">' + right + '</div></div></div>';
  });
  return h;
}

/* ---- Profil ---- */
function rProfile() {
  var g = myGroup(), parts = user.name.split(' '), ini = (parts[0].charAt(0) + (parts[1] ? parts[1].charAt(0) : '')).toUpperCase();
  var h = top('Profil', '', false);
  h += '<div class="card blue"><div class="row"><div class="avatar">' + esc(ini) + '</div>' +
    '<div class="grow"><div class="t">' + esc(user.name) + '</div>' +
    '<div class="d">@' + esc(user.username || '—') + ' · ID ' + (user.id || '—') + '</div>' +
    '<div>' + rolePill() + '<span class="pill">' + esc(ILM.app.course) + '</span></div></div></div>' +
    '<div class="stats"><div><b>' + doneCount() + '</b><span>o\'tilgan dars</span></div>' +
    '<div><b>' + accuracy() + '%</b><span>aniqlik</span></div>' +
    '<div><b>' + progress.mistakes.length + '</b><span>xato</span></div></div></div>';
  if (st.mycode) h += '<div class="card gold" style="text-align:center"><div class="kicker">Ota-ona kodi</div>' +
    '<div class="t" style="font-family:monospace;font-size:22px;letter-spacing:.04em">' + esc(st.mycode) + '</div>' +
    '<div class="d">Ota-onangizga shu kodni yuboring — ular "Farzandim o\'qiydi" havolasidan kiritadi</div></div>';
  h += '<div class="card">' +
    (isStaff() && !st.viewAs
      ? link('👥', 'Guruhlarim', 'Davomat · dars ochish · o\'quvchilar', 'data-go="groups"')
      : link('👥', 'Guruhim', g ? esc(g.name) + ' · ' + esc(daysText(g)) + ' ' + esc(g.time) + (g.room ? ' · ' + esc(g.room) : '') : 'Hali biriktirilmagan', 'data-act="none"')) +
    link('🎯', 'Kirish imtihoni', progress.placement && progress.placement.n ? (progress.placement.n > N ? 'Fonetika to\'liq' : progress.placement.n + '-darsdan') + ' · ' + esc(fmt(parseISO(progress.placement.date))) : 'Topshirilmagan', 'data-act="kirish"') +
    ((role() === 'oquvchi' || isPlus()) && !st.viewAs ? link('📝', 'Uy vazifalar', isPlus() ? "Tanlangan guruh vazifalari" : "Ustoz bergan topshiriqlar", 'data-go="homework"') : '') +
    ((role() === 'oquvchi' || isPlus()) && !st.viewAs ? link('🏆', 'Reyting', isPlus() ? 'Tanlangan guruh reytingi' : 'Guruhim ichida o\'rningiz', 'data-go="rating"') : '') +
    ((role() === 'oquvchi' || isPlus()) && !st.viewAs ? link('👪', 'Ota-onam uchun kod', isPlus() ? 'Faqat o\'quvchi hisobida ishlaydi' : 'Ular ilovadan kuzata oladi', 'data-act="mycode"') : '') +
    '</div>';
  h += '<div class="card">' +
    link('💬', 'Izoh va taklif', isStaff() && !st.viewAs ? "O'quvchilardan kelgan xabarlar" : 'Fikr va takliflaringizni yozing', 'data-go="feedback"') +
    (isStaff() && !st.viewAs ? link('📊', 'Oylik hisobot', "Davomat va o'zlashtirish", 'data-go="report"') : '') +
    link('🔍', 'Kitobdan qidirish', "So'z yoki harf bo'yicha", 'data-go="search"') +
    link('🏫', 'Markaz haqida', '', 'data-go="center"') +
    link('📘', 'Yo\'riqnoma', 'Ilova qanday ishlaydi', 'data-go="guide"') +
    link('❔', 'Savol-javob', '', 'data-go="faq"') +
    link('💬', 'Yordam', '', 'data-go="help"') + '</div>';
  h += '<div class="card">' +
    link('📲', 'Do\'stlarga ulashish', '@' + esc(ILM.app.bot || ''), 'data-act="share"') +
    link('ℹ️', 'Ilova haqida', 'v' + ILM.app.version, 'data-go="about"') + '</div>';
  if (!inTG) h += '<div class="hint" style="text-align:center;margin-top:10px">Brauzerdagi sinov ko\'rinishi.</div>';
  return h;
}

/* ---- Markaz haqida / Yo'riqnoma / Savol-javob / Yordam / Ilova haqida ---- */
function rCenter() {
  var c = ILM.center || {}, h = top('Markaz haqida', esc(ILM.app.name), true);
  if (isPlus() && st.centerEdit) return h + rCenterEdit(c);
  var br = c.branches || (c.address ? [{ name: 'Manzil', address: c.address, mapUrl: c.mapUrl }] : []);
  if (br.length) {
    h += '<div class="card">';
    br.forEach(function (b) { h += link('📍', esc(b.name), esc(b.address) + (b.mapUrl ? ' · xaritada ochish' : ''), b.mapUrl ? 'data-act="open" data-url="' + esc(b.mapUrl) + '"' : 'data-act="none"'); });
    h += '</div>';
  }
  h += '<div class="card">' +
    link('📞', 'Telefon', c.phone ? esc(c.phone) : '—', c.phone ? 'data-act="open" data-url="tel:' + esc(c.phone.replace(/[^\d+]/g, '')) + '"' : 'data-act="none"') +
    link('✈️', 'Operator', c.telegram ? '@' + esc(c.telegram) : '—', c.telegram ? 'data-act="tg" data-url="https://t.me/' + esc(c.telegram) + '"' : 'data-act="none"') +
    (c.channel ? link('📣', 'Telegram kanal', '@' + esc(c.channel), 'data-act="tg" data-url="https://t.me/' + esc(c.channel) + '"') : '') +
    link('🕘', 'Ish vaqti', c.hours ? esc(c.hours) : '—', 'data-act="none"') +
    (c.email ? link('✉️', 'Email', esc(c.email), 'data-act="open" data-url="mailto:' + esc(c.email) + '"') : '') + '</div>';
  if (!br.length && !c.phone) h += '<div class="hint" style="text-align:center">Ma\'lumotlar tez orada to\'ldiriladi</div>';
  if (isPlus()) h += '<div class="row" style="gap:8px"><button class="btn sm ghost" data-act="centeredit">✏️ Tahrirlash</button></div>';
  return h;
}
function rCenterEdit(c) {
  var f = st.form || {};
  var brText = f.centerbr != null ? f.centerbr : (c.branches || []).map(function (b) {
    return [b.name || '', b.address || '', b.mapUrl || ''].join(' | ');
  }).join('\n');
  return '<div class="card">' +
    '<div class="fld"><label>Telefon</label><input class="inp2" data-f="centerphone" value="' + esc(f.centerphone != null ? f.centerphone : (c.phone || '')) + '"></div>' +
    '<div class="fld"><label>Operator (Telegram username, @ siz)</label><input class="inp2" data-f="centertg" value="' + esc(f.centertg != null ? f.centertg : (c.telegram || '')) + '"></div>' +
    '<div class="fld"><label>Telegram kanal (@ siz)</label><input class="inp2" data-f="centerch" value="' + esc(f.centerch != null ? f.centerch : (c.channel || '')) + '"></div>' +
    '<div class="fld"><label>Ish vaqti</label><input class="inp2" data-f="centerhours" value="' + esc(f.centerhours != null ? f.centerhours : (c.hours || '')) + '"></div>' +
    '<div class="fld"><label>Email</label><input class="inp2" data-f="centeremail" value="' + esc(f.centeremail != null ? f.centeremail : (c.email || '')) + '"></div>' +
    '<div class="fld"><label>Filiallar — har biri alohida qatorda: Nomi | Manzil | Xarita havolasi (ixtiyoriy)</label>' +
    '<textarea class="inp2 ta" data-f="centerbr" rows="4" placeholder="1-filial · Beruniy | Beruniy ko\'chasi, 35 A | https://maps.google.com/...">' + esc(brText) + '</textarea></div>' +
    '<div class="row" style="gap:8px"><button class="btn sm gold" data-act="centersave">Saqlash</button><button class="btn sm ghost" data-act="centereditx">Bekor qilish</button></div>' +
    '</div>';
}
function rGuide() { return top('Yo\'riqnoma', 'Ilova qanday ishlaydi', true) + accordion('g', ILM.guide || []); }
function rFaq() { return top('Savol-javob', 'Ko\'p beriladigan savollar', true) + accordion('f', ILM.faq || []); }
function rHelp() {
  var c = ILM.center || {}, h = top('Yordam', '', true);
  h += '<div class="card gold" style="text-align:center"><div class="t">Savol bormi?</div><div class="d">Yozing yoki qo\'ng\'iroq qiling — yordam beramiz</div></div>';
  h += '<div class="card">' +
    link('✈️', 'Telegram orqali yozish', c.telegram ? '@' + esc(c.telegram) : 'admin keyin qo\'shiladi', c.telegram ? 'data-act="tg" data-url="https://t.me/' + esc(c.telegram) + '"' : 'data-act="soon"') +
    link('📞', 'Qo\'ng\'iroq', c.phone ? esc(c.phone) + ' · ' + esc(c.hours || '') : 'raqam keyin qo\'shiladi', c.phone ? 'data-act="open" data-url="tel:' + esc(c.phone.replace(/[^\d+]/g, '')) + '"' : 'data-act="soon"') +
    (c.channel ? link('📣', 'Telegram kanal', 'Yangiliklar va e\'lonlar · @' + esc(c.channel), 'data-act="tg" data-url="https://t.me/' + esc(c.channel) + '"') : '') +
    link('📘', 'Yo\'riqnoma', 'Avval shu yerga qarang', 'data-go="guide"') + '</div>';
  return h;
}
function rAbout() {
  var h = top('Ilova haqida', '', true);
  h += '<div class="card deep" style="text-align:center"><div class="logo">📖</div><div class="t">' + esc(ILM.app.name) + '</div><div class="d">' + esc(ILM.app.slogan) + '</div><div class="hint" style="margin-top:8px">v' + ILM.app.version + ' · Telegram Mini App</div></div>';
  h += '<div class="card"><div class="t" style="font-size:17px">Nimalar yangilandi</div>' + (ILM.app.changelog || []).map(function (c) { return '<div class="chg">✓ ' + esc(c) + '</div>'; }).join('') + '</div>';
  h += '<button class="btn ghost wide" data-act="share">Do\'stlarga ulashish</button>';
  return h;
}
/* ---- Guruhlarim (ustoz · ustoz+) ---- */
function rGroups() {
  var h = top('Guruhlarim', 'Davomat va dars ochish', true);
  var d = st.groups;
  if (!d) {
    st.groups = 'loading';
    apiCall('mygroups', null, function (j) { st.groups = (j && j.ok) ? j : { err: (j && j.error) || 'serverga ulanmadi' }; render(); });
    return h + empty('⏳', 'Yuklanmoqda…', '');
  }
  if (d === 'loading') return h + empty('⏳', 'Yuklanmoqda…', '');
  if (d.err) return h + empty('⚠️', 'Ro\'yxat olinmadi', esc(d.err)) + '<button class="btn ghost wide" data-act="regroups">Qayta urinish</button>';
  if (!d.groups.length) return h + empty('👥', 'Guruh yo\'q', isPlus() ? 'Pastdagi tugma bilan guruh qo\'shing' : 'Sizga hali guruh biriktirilmagan') +
    (isPlus() ? '<button class="btn gold wide" data-go="grpnew">+ Guruh qo\'shish</button>' : '');

  /* uzoq bosilganda — o'chirish va tahrirlash (faqat ustoz+) */
  if (st.gsel && isPlus()) {
    var sg = null;
    d.groups.forEach(function (x) { if (x.id === st.gsel) sg = x; });
    if (sg) h += '<div class="selbar"><div class="grow"><div class="kicker">Tanlandi</div><div class="t">' + esc(sg.name) + '</div></div>' +
      '<button class="sb" data-act="gedit" data-id="' + esc(sg.id) + '" title="Tahrirlash">✏️</button>' +
      '<button class="sb red" data-act="gdel" data-id="' + esc(sg.id) + '" title="O\'chirish">🗑️</button>' +
      '<button class="sb" data-act="gselx" title="Bekor qilish">✕</button></div>';
  }

  d.groups.forEach(function (g) {
    var days = String(g.days || '').split(',').filter(Boolean).join('/');
    h += '<div class="card blue tap' + (st.gsel === g.id ? ' sel' : '') + '" data-go="grp" data-id="' + esc(g.id) + '"><div class="row"><div class="grow">' +
      '<div class="t">' + esc(g.name) + '</div>' +
      '<div class="d">' + esc(days) + (g.time ? ' · soat ' + esc(g.time) : '') + (g.room ? ' · ' + esc(g.room) : '') + '</div>' +
      '<div><span class="pill">' + (g.soni | 0) + ' o\'quvchi</span>' +
      '<span class="pill gold">' + ((g.open_to | 0) ? '1–' + g.open_to + '-dars ochiq' : 'dars ochilmagan') + '</span></div>' +
      '</div><span class="chev">›</span></div></div>';
  });
  if (isPlus()) h += '<button class="btn ghost wide" data-go="grpnew">+ Guruh qo\'shish</button>' +
    '<div class="hint" style="text-align:center;margin-top:10px">Guruhni uzoq bosib turing — tahrirlash va o\'chirish chiqadi</div>';
  return h;
}

/* ---- Guruh ichi: davomat + dars ochish ---- */
function rGrp() {
  var id = st.params.id, h = top('Guruh', '', true);
  var d = st.grp;
  if (!d || d.id !== id || d.n !== st.grpN) {
    st.grp = { id: id, n: st.grpN, loading: true };
    apiCall('group', { group: id, n: st.grpN || 0 }, function (j) {
      st.grp = (j && j.ok) ? merge({ id: id, n: st.grpN }, j) : { id: id, n: st.grpN, err: (j && j.error) || 'serverga ulanmadi' };
      if (j && j.ok && !st.grpN) { st.grpN = (j.group.open_to | 0) + 1; st.grp.n = st.grpN; st.grp.mark = {}; st.grp.saved = false; }
      st.att = null; render();
    });
    return h + empty('⏳', 'Yuklanmoqda…', '');
  }
  if (d.loading) return h + empty('⏳', 'Yuklanmoqda…', '');
  if (d.err) return h + empty('⚠️', 'Ochilmadi', esc(d.err)) + '<button class="btn ghost wide" data-act="regrp">Qayta urinish</button>';

  var g = d.group, days = String(g.days || '').split(',').filter(Boolean).join('/');
  var n = st.grpN, ochiq = g.open_to | 0;
  h = top(esc(g.name), esc(days) + (g.time ? ' · soat ' + esc(g.time) : '') + (g.room ? ' · ' + esc(g.room) : ''), true);

  /* davomat */
  var qulf = d.saved && !isPlus();
  var mark = st.att || d.mark || {};
  h += '<div class="card"><div class="row" style="margin-bottom:12px"><div class="grow">' +
    '<div class="kicker">Davomat</div><div class="t">' + n + '-dars' + esc(lt(n)) + '</div></div>' +
    '<button class="wbtn" data-act="grpn" data-d="-1">‹</button><button class="wbtn" data-act="grpn" data-d="1">›</button></div>';
  if (!d.students.length) h += empty('👤', 'Ro\'yxat bo\'sh', 'Bu guruhga hali o\'quvchi qo\'shilmagan');
  else {
    d.students.forEach(function (s) {
      var on = !!mark[s.id];
      h += '<div class="att' + (on ? ' on' : '') + (qulf ? ' lock' : '') + '"' + (qulf ? '' : ' data-act="att" data-id="' + s.id + '"') + '>' +
        '<span class="box">' + (on ? '✓' : '') + '</span><span class="nm">' + esc(s.name) + '</span>' +
        (s.user_id ? '' : '<span class="hint" style="font-size:11.5px">ilovaga kirmagan</span>') +
        '<button class="wbtn" data-go="student" data-id="' + s.id + '" title="Kartasi">ℹ️</button></div>';
    });
    if (qulf) h += '<div class="hint" style="text-align:center;margin-top:12px">✓ Saqlangan — o\'zgartirishni Ustoz+ qiladi</div>';
    else h += '<button class="btn gold wide" style="margin-top:12px" data-act="attsave">' + (d.saved ? 'Qayta saqlash' : 'Saqlash') + '</button>' +
      '<div class="hint" style="text-align:center;margin-top:8px">Faqat kelganlar belgilanadi. Saqlangach o\'zgartirib bo\'lmaydi.</div>';
  }
  h += '</div>';

  /* dars ochish */
  h += '<div class="card"><div class="kicker">Ochiq darslar</div>' +
    '<div class="t">' + (ochiq ? '1–' + ochiq + '-dars' : 'Hali ochilmagan') + '</div>' +
    '<div class="d">Raqamni bosing — shu darsgacha o\'quvchilarga ochiladi. Yana bossangiz yopiladi.</div><div class="lgrid">';
  for (var k = 1; k <= N; k++)
    h += '<button class="lc' + (k <= ochiq ? ' on' : '') + (k === ochiq ? ' edge' : '') + '" data-act="setopen" data-n="' + k + '">' + k + '</button>';
  h += '</div></div>';

  h += rGrpRoster(g.id, d.students);
  h += rGrpHomework(g.id);
  h += '<button class="btn ghost wide" data-go="rating" data-gid="' + esc(g.id) + '">🏆 Guruh reytingi</button>';
  return h;
}

/* ---- O'quvchilar ro'yxati: qo'shish (guruh ichida) ---- */
function rGrpRoster(gid, students) {
  var h = '<div class="card"><div class="kicker">O\'quvchilar ro\'yxati</div><div class="t">' + students.length + ' o\'quvchi</div>' +
    '<div class="d">Tahrirlash yoki o\'chirish uchun ism ustidagi ℹ️ ni bosing</div>';
  if (st.stadd && st.stadd.gid === gid) {
    h += '<div class="fld" style="margin-top:12px"><label>Ism-familya</label><input class="inp2" data-f="stname" value="' + esc((st.form && st.form.stname) || '') + '" placeholder="Ali Valiyev"></div>' +
      '<div class="fld"><label>Telefon (ixtiyoriy)</label><input class="inp2" data-f="stphone" value="' + esc((st.form && st.form.stphone) || '') + '" placeholder="+998 90 123 45 67"></div>' +
      '<div class="row" style="gap:8px"><button class="btn sm gold" data-act="stadd" data-gid="' + esc(gid) + '">Qo\'shish</button>' +
      '<button class="btn sm ghost" data-act="staddx">Bekor qilish</button></div>';
  } else {
    h += '<button class="btn ghost wide" style="margin-top:12px" data-act="staddopen" data-gid="' + esc(gid) + '">+ O\'quvchi qo\'shish</button>';
  }
  return h + '</div>';
}

/* ---- Guruh qo'shish (ustoz+) ---- */
var DAYS7 = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
function rGrpNew() {
  var f = st.form || (st.form = { days: [] });
  var h = top(f.id ? 'Guruhni tahrirlash' : 'Guruh qo\'shish', f.id ? esc(f.name || '') : 'Ustoz+ · yangi guruh', true);
  function fld(k, nom, ph, tur) {
    return '<div class="fld"><label>' + nom + '</label><input class="inp2" data-f="' + k + '" value="' + esc(f[k] || '') + '" placeholder="' + esc(ph || '') + '"' + (tur ? ' type="' + tur + '"' : '') + '></div>';
  }
  h += '<div class="card">' +
    fld('name', 'Guruh nomi', 'A0 Fonetika · kechki') +
    fld('teacher', 'Ustoz (ism-familya)', 'Muhammad Aliyev') +
    fld('teacher_id', 'Ustozning Telegram ID', '8558107235') +
    '<div class="fld"><label>Dars kunlari</label><div class="dsel">' +
    DAYS7.map(function (d) { return '<button class="' + (f.days.indexOf(d) >= 0 ? 'on' : '') + '" data-act="fday" data-d="' + d + '">' + d + '</button>'; }).join('') +
    '</div></div>' +
    fld('time', 'Vaqti', '18:30') + fld('room', 'Xona', '7-xona') +
    fld('branch', 'Filial', 'Beruniy') + fld('start', 'Boshlangan sana', '2026-09-01') +
    fld('pay_amount', 'To\'lov (so\'m)', '400000') + fld('pay_day', 'To\'lov kuni', '5') +
    fld('code', 'Kirish kodi', 'ILM-A0-1') +
    '</div><button class="btn gold wide" data-act="grpsave">Saqlash</button>';
  return h;
}

/* ---- Foydalanuvchilar (ustoz / ustoz+) ---- */
function rUsers() {
  var h = top('Foydalanuvchilar', 'Ilovaga kirganlar', true);
  var d = st.users;
  if (!d) {
    st.users = 'loading';
    apiCall('users', null, function (j) { st.users = (j && j.ok) ? j : { err: (j && j.error) || 'ulanmadi' }; render(); });
    return h + empty('⏳', 'Yuklanmoqda…', '');
  }
  if (d === 'loading') return h + empty('⏳', 'Yuklanmoqda…', '');
  if (d.err) return h + empty('⚠️', 'Ro\'yxat olinmadi', esc(d.err)) + '<button class="btn ghost wide" data-act="reloadusers">Qayta urinish</button>';

  h += '<div class="card blue"><div class="stats" style="margin:0;padding:0;border:none">' +
    '<div><b>' + d.total + '</b><span>jami</span></div>' +
    '<div><b>' + d.today + '</b><span>bugun</span></div>' +
    '<div><b>' + d.online + '</b><span>hozir online</span></div></div></div>';

  var gs = (d.groups && d.groups.length) ? d.groups : (ILM.groups || []);   // serverdagi guruhlar
  srv.glist = d.groups || null;

  if (isPlus()) {
    h += st.uadd
      ? '<div class="card"><div class="kicker">Qo\'lda qo\'shish</div><div class="d" style="margin-bottom:10px">Botga hali yozmagan bo\'lsa ham, Telegram ID va ismini bilsangiz oldindan qo\'shib qo\'yishingiz mumkin.</div>' +
        '<div class="fld"><label>Telegram ID</label><input class="inp2" data-f="newuid" value="' + esc((st.form && st.form.newuid) || '') + '" placeholder="8558107235" inputmode="numeric"></div>' +
        '<div class="fld"><label>Ism</label><input class="inp2" data-f="newuname" value="' + esc((st.form && st.form.newuname) || '') + '" placeholder="Ism Familiya"></div>' +
        '<div class="fld"><label>Username (ixtiyoriy)</label><input class="inp2" data-f="newuuser" value="' + esc((st.form && st.form.newuuser) || '') + '" placeholder="username"></div>' +
        '<div class="row" style="gap:8px"><button class="btn sm gold" data-act="uadd">Qo\'shish</button><button class="btn sm ghost" data-act="uaddx">Bekor qilish</button></div></div>'
      : '<button class="btn ghost wide" style="margin-bottom:12px" data-act="uaddopen">+ Foydalanuvchini qo\'lda qo\'shish</button>';
  }

  d.users.forEach(function (u) {
    var on = (d.now - u.last_seen) < 5 * 60 * 1000;
    var g = u.group_id ? groupById(u.group_id) : null;
    h += '<div class="card ustd"><div class="row">' +
      '<div class="dot ' + (on ? 'on' : '') + '"></div>' +
      '<div class="grow"><div class="t" style="font-size:17px">' + esc(u.name || '—') +
      (u.role !== 'oquvchi' ? ' <span class="pill ' + (u.role === 'ustozplus' ? 'gold' : 'blue') + '" style="margin:0">' + (u.role === 'ustozplus' ? '★ Ustoz+' : 'Ustoz') + '</span>' : '') + '</div>' +
      '<div class="d">@' + esc(u.username || '—') + ' · ID ' + u.id + '</div>' +
      '<div class="hint">Qo\'shildi: ' + dtx(u.first_seen) + ' · ' + (!u.last_seen ? 'Ilovani hali ochmagan' : 'Oxirgi: ' + (on ? 'online' : ago(u.last_seen))) + '</div>' +
      (u.placement ? '<div class="hint">Kirish imtihoni: ' + u.placement + '-darsdan</div>' : '') +
      '</div>' +
      (isPlus() && u.id !== user.id ? '<button class="wbtn" data-act="udel" data-id="' + u.id + '" title="Ro\'yxatdan o\'chirish">🗑️</button>' : '') +
      '</div>' +
      '<select class="sel" style="margin-top:10px" data-act="ugroup" data-user="' + u.id + '">' +
      '<option value="">— guruhga qo\'shilmagan —</option>' +
      gs.map(function (gg) { return '<option value="' + esc(gg.id) + '"' + (u.group_id === gg.id ? ' selected' : '') + '>' + esc(gg.name) + '</option>'; }).join('') +
      '</select>' +
      (g ? '<div class="hint" style="margin-top:6px">' + esc(g.teacher) + ' · ' + esc(daysText(g)) + ' · ' + esc(g.time) + '</div>' : '') +
      (isPlus() && u.id !== user.id
        ? '<div class="dsel" style="margin-top:10px">' +
          ['oquvchi', 'ustoz', 'ustozplus'].map(function (r) {
            var nom = r === 'oquvchi' ? 'O\'quvchi' : r === 'ustoz' ? 'Ustoz' : 'Ustoz+';
            return '<button class="' + (u.role === r ? 'on' : '') + '" data-act="urole" data-user="' + u.id + '" data-r="' + r + '">' + nom + '</button>';
          }).join('') + '</div>' : '') +
      '</div>';
  });
  h += '<button class="btn ghost wide" data-act="reloadusers">Yangilash ↻</button>';
  return h;
}

/* ============================================================
   RENDER va HODISALAR
   ============================================================ */
var SCREENS = { home: rHome, lessons: rLessons, lesson: rLesson, book: rBook, video: rVideo, test: rTest, mashq: rMashq, mashqList: rMashqList, mashqBlocks: rMashqBlocks, imtihon: rImtihon,
  profile: rProfile, center: rCenter, guide: rGuide, faq: rFaq, help: rHelp, about: rAbout, groups: rGroups, users: rUsers,
  grp: rGrp, grpnew: rGrpNew, homework: rHomework, feedback: rFeedback, search: rSearch, rating: rRating, report: rReport, student: rStudentCard };
var SIMPLE = { center: 1, guide: 1, faq: 1, help: 1, about: 1, groups: 1, users: 1, grpnew: 1, homework: 1, feedback: 1, search: 1, report: 1 };
var ICONS = {
  home: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-6H9v6H5a2 2 0 0 1-2-2z"/></svg>',
  lessons: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
  mashq: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
  imtihon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M8.2 13.5L7 22l5-3 5 3-1.2-8.5"/></svg>',
  profile: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>'
};
function render() {
  if (parentMode) return renderParent();
  if (!gateOK()) {
    document.getElementById('view').innerHTML = rGate();
    document.getElementById('nav').innerHTML = '';
    var inp = document.getElementById('code');
    if (inp) { inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') tryGate(); }); inp.focus(); }
    var pinp = document.getElementById('pcode');
    if (pinp) { pinp.addEventListener('keydown', function (e) { if (e.key === 'Enter') tryPGate(); }); pinp.focus(); }
    return;
  }
  var fn = SCREENS[st.screen] || rHome;
  document.getElementById('view').innerHTML = fn();
  var nav = [['home', 'Asosiy'], ['lessons', 'Darslar'], ['mashq', 'Mashq'], ['imtihon', 'Imtihon'], ['profile', 'Profil']];
  document.getElementById('nav').innerHTML = nav.map(function (t) {
    return '<button class="' + (st.tab === t[0] ? 'on' : '') + '" data-tab="' + t[0] + '"><i>' + ICONS[t[0]] + '</i>' + t[1] + '</button>';
  }).join('');
  if (st.screen === 'video') { var l = L(+st.params.n), id = ytId(l.video); if (id) loadYT(id, +st.params.n); }
  if (st.screen === 'book') paintVids();
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
    if (g === 'grp') {
      if (st.lp) { st.lp = 0; return; }                   // uzoq bosishdan keyingi bosish hisoblanmasin
      st.gsel = null; st.grpN = 0; st.grp = null; st.att = null;
      return go('grp', { id: t.dataset.id });
    }
    if (g === 'grpnew') { st.form = { days: [] }; return go('grpnew'); }
    if (g === 'student') { st.scard = null; return go('student', { id: t.dataset.id }); }
    if (g === 'rating') { st.rating = null; return go('rating', { gid: t.dataset.gid || '' }); }
    if (SIMPLE[g]) return go(g);
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
  if (a === 'none') return;
  if (a === 'gate') return tryGate();
  if (a === 'back') return back();
  if (a === 'soon') return toast('Tez orada qo\'shiladi');
  if (a === 'srvoff') return toast(inTG ? 'Server ulanmadi — biroz kuting' : 'Faqat Telegram ichida ishlaydi');
  if (a === 'reloadusers') { st.users = null; return render(); }
  if (a === 'uaddopen') { st.uadd = true; return render(); }
  if (a === 'uaddx') { st.uadd = false; return render(); }
  if (a === 'uadd') {
    var nid = +((st.form && st.form.newuid) || 0), nname = ((st.form && st.form.newuname) || '').trim();
    if (!nid || nid < 1) return toast('Telegram ID ni to\'g\'ri kiriting');
    if (!nname) return toast('Ismni kiriting');
    return apiCall('adduser', { id: nid, name: nname, username: (st.form && st.form.newuuser) || '' }, function (j) {
      if (j && j.ok) {
        toast('Qo\'shildi ✓'); st.uadd = false;
        if (st.form) { st.form.newuid = ''; st.form.newuname = ''; st.form.newuuser = ''; }
        st.users = null; render();
      } else toast('Bo\'lmadi: ' + ((j && j.error) || 'ulanmadi'));
    });
  }
  if (a === 'udel') {
    if (!confirm('Bu foydalanuvchi ro\'yxatdan butunlay o\'chirilsinmi? Bu amalni qaytarib bo\'lmaydi.')) return;
    return apiCall('deluser', { id: +t.dataset.id }, function (j) {
      if (j && j.ok) { toast('O\'chirildi'); st.users = null; render(); }
      else toast('Bo\'lmadi: ' + ((j && j.error) || 'ulanmadi'));
    });
  }
  if (a === 'regroups') { st.groups = null; return render(); }
  if (a === 'regrp') { st.grp = null; return render(); }
  if (a === 'grpn') {                                     // davomat uchun dars raqamini almashtirish
    var nn = (st.grpN || 1) + (+t.dataset.d);
    if (nn < 1 || nn > N) return;
    st.grpN = nn; st.grp = null; st.att = null; return render();
  }
  if (a === 'att') {                                      // «keldi» belgisini qo'yish/olib tashlash
    var sid = +t.dataset.id;
    if (!st.att) { st.att = {}; var m0 = (st.grp && st.grp.mark) || {}; for (var k0 in m0) st.att[k0] = m0[k0]; }
    st.att[sid] = st.att[sid] ? 0 : 1; return render();
  }
  if (a === 'attsave') {
    var mm = st.att || (st.grp && st.grp.mark) || {}, kel = [];
    for (var k1 in mm) if (mm[k1]) kel.push(+k1);
    return apiCall('attend', { group: st.grp.id, n: st.grpN, present: kel }, function (j) {
      if (j && j.ok) { toast('Davomat saqlandi ✓ · 1–' + j.open_to + '-dars ochiq'); st.grp = null; st.groups = null; st.att = null; render(); }
      else toast('Bo\'lmadi: ' + ((j && j.error) || 'ulanmadi'));
    });
  }
  if (a === 'setopen') {
    var kk = +t.dataset.n, cur = (st.grp && st.grp.group.open_to | 0);
    return apiCall('setopen', { group: st.grp.id, to: kk === cur ? kk - 1 : kk }, function (j) {
      if (j && j.ok) { toast(j.open_to ? '1–' + j.open_to + '-dars ochiq' : 'Darslar yopildi'); st.grp = null; st.groups = null; render(); }
      else toast('Bo\'lmadi: ' + ((j && j.error) || 'ulanmadi'));
    });
  }
  if (a === 'fday') {
    var dd = t.dataset.d, arr = st.form.days, ix = arr.indexOf(dd);
    if (ix >= 0) arr.splice(ix, 1); else arr.push(dd);
    return render();
  }
  if (a === 'gselx') { st.gsel = null; return render(); }
  if (a === 'gedit') {                                    // tanlangan guruhni tahrirlashga ochish
    var gd = null, lst = (st.groups && st.groups.groups) || [];
    lst.forEach(function (x) { if (x.id === t.dataset.id) gd = x; });
    if (!gd) return;
    st.form = {
      id: gd.id, name: gd.name || '', teacher: gd.teacher || '', teacher_id: gd.teacher_id || '',
      days: String(gd.days || '').split(',').filter(Boolean), time: gd.time || '', room: gd.room || '',
      branch: gd.branch || '', start: gd.start || '', pay_amount: gd.pay_amount || '',
      pay_day: gd.pay_day || '', code: gd.code || ''
    };
    st.gsel = null; return go('grpnew');
  }
  if (a === 'gdel') {
    var gid2 = t.dataset.id;
    if (!confirm('Guruh o\'chirilsinmi? O\'quvchilar va davomat saqlanib qoladi, guruh ro\'yxatdan yo\'qoladi.')) return;
    return apiCall('delgroup', { group: gid2 }, function (j) {
      if (j && j.ok) { toast('Guruh o\'chirildi'); st.gsel = null; st.groups = null; render(); }
      else toast('Bo\'lmadi: ' + ((j && j.error) || 'ulanmadi'));
    });
  }
  if (a === 'grpsave') {
    var f = st.form;
    if (!f.name) return toast('Guruh nomini yozing');
    return apiCall('savegroup2', { group: {
      id: f.id || '', name: f.name, teacher: f.teacher || '', teacher_id: +(f.teacher_id || 0), days: f.days,
      time: f.time || '', room: f.room || '', branch: f.branch || '', start: f.start || '',
      pay_amount: +(f.pay_amount || 0), pay_day: +(f.pay_day || 0), code: f.code || ''
    } }, function (j) {
      if (j && j.ok) { toast(f.id ? 'Saqlandi ✓' : 'Guruh qo\'shildi ✓'); st.groups = null; st.form = { days: [] }; back(); }
      else toast('Bo\'lmadi: ' + ((j && j.error) || 'ulanmadi'));
    });
  }
  /* ---- uy vazifa ---- */
  if (a === 'hwdone') {
    var hid = +t.dataset.id, undo = t.dataset.undo === '1';
    return apiCall('homework_done', { id: hid, undo: undo }, function (j) {
      if (j && j.ok) { st.hw = null; toast(undo ? 'Bekor qilindi' : 'Bajarildi ✓'); render(); }
      else toast('Bo\'lmadi: ' + ((j && j.error) || 'ulanmadi'));
    });
  }
  if (a === 'hwadd') {
    var gid3 = t.dataset.gid, txt2 = ((st.form && st.form.hwtext) || '').trim();
    if (!txt2) return toast('Matn yozing');
    return apiCall('homework_add', { group: gid3, text: txt2, n: st.grpN || 0 }, function (j) {
      if (j && j.ok) { toast('Qo\'shildi ✓'); st.form.hwtext = ''; st.ghw = null; render(); }
      else toast('Bo\'lmadi: ' + ((j && j.error) || 'ulanmadi'));
    });
  }
  if (a === 'hwdel') {
    if (!confirm('Vazifa o\'chirilsinmi?')) return;
    return apiCall('homework_del', { id: +t.dataset.id }, function (j) {
      if (j && j.ok) { st.ghw = null; render(); }
      else toast('Bo\'lmadi: ' + ((j && j.error) || 'ulanmadi'));
    });
  }

  /* ---- izoh va taklif ---- */
  if (a === 'fbkind') { st.fbKind = t.dataset.k; return render(); }
  if (a === 'fbsend') {
    var ftxt = ((st.form && st.form.fbtext) || '').trim();
    if (!ftxt) return toast('Xabar yozing');
    return apiCall('feedback_add', { kind: st.fbKind || 'taklif', text: ftxt }, function (j) {
      if (j && j.ok) { toast('Yuborildi ✓'); if (st.form) st.form.fbtext = ''; st.fbmine = null; render(); }
      else toast('Bo\'lmadi: ' + ((j && j.error) || 'ulanmadi'));
    });
  }
  if (a === 'fbstatus') {
    var fid = +t.dataset.id, fs = t.dataset.s, freply = (st.form && st.form['fbreply' + fid]) || '';
    return apiCall('feedback_reply', { id: fid, status: fs, reply: freply }, function (j) {
      if (j && j.ok) { toast('Saqlandi ✓'); st.fb = null; render(); }
      else toast('Bo\'lmadi: ' + ((j && j.error) || 'ulanmadi'));
    });
  }

  /* ---- o'quvchi kartasi: to'lov va ota-ona kodi ---- */
  if (a === 'setpaid') {
    var uid2 = +t.dataset.uid, dt = (st.form && st.form['paiduntil' + t.dataset.sid]) || '';
    if (!dt) return toast('Sanani tanlang');
    return apiCall('setpaid', { user: uid2, until: dt }, function (j) {
      if (j && j.ok) { toast('Belgilandi ✓'); st.scard = null; render(); }
      else toast('Bo\'lmadi: ' + ((j && j.error) || 'ulanmadi'));
    });
  }
  if (a === 'gencode') {
    return apiCall('parentcode', { student: +t.dataset.id }, function (j) {
      if (j && j.ok) { toast('Kod tayyor'); st.scard = null; render(); }
      else toast('Bo\'lmadi: ' + ((j && j.error) || 'ulanmadi'));
    });
  }
  if (a === 'mycode') {
    return apiCall('parentcode', {}, function (j) {
      if (j && j.ok) { st.mycode = j.code; toast('Kod tayyor'); render(); }
      else toast('Bo\'lmadi: ' + ((j && j.error) || 'ulanmadi — avval guruhga qo\'shilishingiz kerak'));
    });
  }

  /* ---- ota-ona rejimi ---- */
  if (a === 'gatemode') { st.gateMode = t.dataset.m; st.gateErr = false; st.pgateErr = false; return render(); }
  if (a === 'pgate') return tryPGate();
  if (a === 'pgate2') return tryPGate2();
  if (a === 'pvadd') { st.pvAdd = true; return render(); }
  if (a === 'pvaddx') { st.pvAdd = false; return render(); }
  if (a === 'punlink') {
    parentMode = false; try { localStorage.removeItem(PARENTKEY); } catch (e) {}
    st.pv = null; st.pvAdd = false; return render();
  }

  /* ---- eslatmalarni qo'lda yuborish (ustoz+) ---- */
  if (a === 'sendrem') {
    return apiCall('sendreminders', { force: false }, function (j) {
      if (j && j.ok) toast(j.sent + ' ta eslatma yuborildi');
      else toast('Bo\'lmadi: ' + ((j && j.error) || 'ulanmadi'));
    });
  }

  /* ---- guruh ro'yxatiga o'quvchi qo'shish ---- */
  if (a === 'staddopen') { st.stadd = { gid: t.dataset.gid }; return render(); }
  if (a === 'staddx') { st.stadd = null; return render(); }
  if (a === 'stadd') {
    var gid5 = t.dataset.gid, nm5 = ((st.form && st.form.stname) || '').trim(), ph5 = (st.form && st.form.stphone) || '';
    if (!nm5) return toast('Ism kiriting');
    return apiCall('savestudent', { student: { group_id: gid5, name: nm5, phone: ph5 } }, function (j) {
      if (j && j.ok) {
        toast('Qo\'shildi ✓'); st.stadd = null;
        if (st.form) { st.form.stname = ''; st.form.stphone = ''; }
        st.grp = null; render();
      } else toast('Bo\'lmadi: ' + ((j && j.error) || 'ulanmadi'));
    });
  }

  /* ---- o'quvchi kartasi: tahrirlash / o'chirish ---- */
  if (a === 'stedit') { st.stedit = true; return render(); }
  if (a === 'steditx') { st.stedit = false; return render(); }
  if (a === 'stsave') {
    var sc = st.scard.student, sid5 = sc.id;
    var nm6 = (((st.form && st.form.editname != null) ? st.form.editname : sc.name) || '').trim();
    var ph6 = (st.form && st.form.editphone != null) ? st.form.editphone : (sc.phone || '');
    var uid6 = (st.form && st.form.edituid != null) ? st.form.edituid : (sc.user_id || '');
    if (!nm6) return toast('Ism kiriting');
    return apiCall('savestudent', { student: { id: sid5, name: nm6, phone: ph6, group_id: sc.group_id, user_id: uid6 ? +uid6 : null } }, function (j) {
      if (j && j.ok) { toast('Saqlandi ✓'); st.stedit = false; st.scard = null; st.grp = null; render(); }
      else toast('Bo\'lmadi: ' + ((j && j.error) || 'ulanmadi'));
    });
  }
  if (a === 'stdel') {
    if (!confirm('Bu o\'quvchi ro\'yxatdan o\'chirilsinmi? Davomat va natijalari saqlanib qoladi, faqat ro\'yxatdan chiqadi.')) return;
    return apiCall('delstudent', { id: +t.dataset.id }, function (j) {
      if (j && j.ok) { toast('O\'chirildi'); st.grp = null; back(); }
      else toast('Bo\'lmadi: ' + ((j && j.error) || 'ulanmadi'));
    });
  }

  /* ---- markaz ma'lumotlari (faqat ustoz+) ---- */
  if (a === 'centeredit') { st.centerEdit = true; return render(); }
  if (a === 'centereditx') { st.centerEdit = false; return render(); }
  if (a === 'centersave') {
    var f9 = st.form || {};
    var brLines = ((f9.centerbr != null ? f9.centerbr : '') || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    var branches9 = brLines.map(function (l) {
      var parts = l.split('|').map(function (p) { return p.trim(); });
      return { name: parts[0] || '', address: parts[1] || '', mapUrl: parts[2] || '' };
    });
    var center9 = {
      phone: (f9.centerphone || '').trim(), telegram: (f9.centertg || '').trim(), channel: (f9.centerch || '').trim(),
      hours: (f9.centerhours || '').trim(), email: (f9.centeremail || '').trim(), branches: branches9
    };
    return apiCall('savecenter', { center: center9 }, function (j) {
      if (j && j.ok) {
        toast('Saqlandi ✓'); ILM.center = j.center; st.centerEdit = false;
        ['centerphone', 'centertg', 'centerch', 'centerhours', 'centeremail', 'centerbr'].forEach(function (k) { if (st.form) delete st.form[k]; });
        render();
      } else toast('Bo\'lmadi: ' + ((j && j.error) || 'ulanmadi'));
    });
  }

  /* ---- rol berish (faqat ustoz+) ---- */
  if (a === 'urole') {
    var uid7 = +t.dataset.user, r7 = t.dataset.r;
    if (r7 === 'ustozplus' && !confirm('Bu odamga Ustoz+ huquqi berilsinmi? U hamma guruh, o\'quvchi va sozlamalarni boshqara oladigan bo\'ladi.')) return;
    return apiCall('setrole', { user: uid7, role: r7 }, function (j) {
      if (j && j.ok) { toast('Rol yangilandi ✓'); st.users = null; render(); }
      else toast('Bo\'lmadi: ' + ((j && j.error) || 'ulanmadi'));
    });
  }

  if (a === 'rebook') { st.book = null; return render(); }
  if (a === 'fs') return setFS(+t.dataset.d);
  if (a === 'playvid') {
    var vu = t.dataset.url, vi = t.dataset.id;
    if (vu) { seenVid(vu); return /^https:\/\/t\.me\//.test(vu) ? openTg(vu) : openLink(vu); }
    if (vi) { st.vids[vi] = 1; paintVids(); }
    return;
  }
  if (a === 'open') return openLink(t.dataset.url);
  if (a === 'tg') return openTg(t.dataset.url);
  if (a === 'share') { var u = 'https://t.me/' + (ILM.app.bot || ''); return openTg('https://t.me/share/url?url=' + encodeURIComponent(u) + '&text=' + encodeURIComponent(ILM.app.name + ' — ' + ILM.app.slogan)); }
  if (a === 'acc') { st.acc[t.dataset.k] = !st.acc[t.dataset.k]; return render(); }
  if (a === 'kirish') { st.sub.imt = 'kirish'; st.sub.imtihon = 'fon'; return setTab('imtihon'); }
  if (a === 'placement') return startRun('placement', 0);
  if (a === 'applyplace') { var pn = +t.dataset.n; applyPlacement(pn); toast(pn > N ? 'Barcha darslar ochildi' : pn + '-darsdan boshlaysiz ✓'); st.run = null; st.stack = []; st.tab = 'lessons'; st.screen = 'lessons'; st.params = {}; render(); window.scrollTo(0, 0); return; }
  if (a === 'testmode') { st.testMode = !st.testMode; toast(st.testMode ? 'Sinov rejimi yoqildi' : 'Sinov rejimi o\'chdi'); return render(); }
  if (a === 'viewas') { st.viewAs = st.viewAs ? null : 'oquvchi'; if (st.viewAs) st.testMode = false; setTab('home'); return; }
  if (a === 'mashqlist') return go('mashqList');
  if (a === 'mashqblocks') return go('mashqBlocks');
  if (a === 'blocktest') { var bb = ILM.blocks[+t.dataset.n - 1]; if (!bb) return; if (!unlocked(bb.to)) return toast('Avval shu blokning darslariga yeting'); return startRun('block', bb.n); }
  if (a === 'reset') { if (confirm('Barcha natijalar o\'chirilsinmi?')) { var gk = progress.group; progress = fresh(); progress.group = gk; save(); toast('Tozalandi'); render(); } return; }
  if (a === 'starttest') { var n1 = +t.dataset.n; if (!unlocked(n1)) return toast('Bu dars hali yopiq'); return startRun('lesson', n1); }
  if (a === 'practice') { var n2 = +t.dataset.n; if (!unlocked(n2)) return toast('Avval shu darsga yeting'); return startRun('practice', n2); }
  if (a === 'mistakes') { if (!progress.mistakes.length) return toast('Xato yo\'q — ajoyib'); return startRun('mistakes'); }
  if (a === 'exam') { var ex = examById(t.dataset.id); if (!ex) return; if (!examUnlocked(ex)) return toast('Imtihon hali yopiq — avval ' + ex.after + '-darsgacha tugating'); return startRun('exam', ex.id); }
  if (a === 'pick') { if (st.run && !st.run.shown) { st.run.pick = +t.dataset.k; render(); } return; }
  if (a === 'check') { if (st.run && st.run.pick != null && !st.run.shown) check(); return; }
  if (a === 'next') { if (!st.run) return; st.run.i++; st.run.pick = null; st.run.shown = false; placementStep(st.run); render(); window.scrollTo(0, 0); return; }
  if (a === 'retry') { if (!st.run) return; return startRun(st.run.kind, st.run.key, true); }
  if (a === 'vidseen') { markVideo(+t.dataset.n); toast('Belgilandi ✓'); return render(); }
  if (a === 'play') { var q = st.run && st.run.qs[st.run.i]; if (q && q.src) { try { new Audio(q.src).play(); } catch (e2) {} } else toast('Audio hali qo\'shilmagan'); return; }
});
document.getElementById('app').addEventListener('input', function (e) {
  var t = e.target.closest('[data-f]'); if (!t) return;
  (st.form = st.form || { days: [] })[t.dataset.f] = t.value;          // guruh shakli maydonlari
  if (t.dataset.f === 'q' && st.screen === 'search') {                 // kitobdan qidirish — jonli
    clearTimeout(st._searchT);
    st._searchT = setTimeout(function () {
      render();
      var el = document.querySelector('[data-f="q"]');
      if (el) { el.focus(); var v = el.value; el.value = ''; el.value = v; }
    }, 350);
  }
});
document.getElementById('app').addEventListener('change', function (e) {
  var t = e.target.closest('[data-act="setgroup"],[data-act="ugroup"]');
  if (!t) return;
  if (t.dataset.act === 'ugroup') {                       // ustoz o'quvchini guruhga qo'shadi
    var uid = +t.dataset.user, gid = t.value || null;
    apiCall('setgroup', { user: uid, group: gid }, function (j) {
      if (j && j.ok) { toast(gid ? 'Guruhga qo\'shildi ✓' : 'Guruhdan chiqarildi'); st.users = null; render(); }
      else toast('Bo\'lmadi: ' + ((j && j.error) || 'ulanmadi'));
    });
    return;
  }
  progress.group = t.value || null; save(); toast(t.value ? 'Guruh tanlandi' : 'Guruh olib tashlandi'); render();
});

/* uzoq bosish: guruh kartasini tanlash (ustoz+ — tahrirlash/o'chirish uchun) */
var lpT = null;
function lpBoshla(el) {
  if (!isPlus() || !el) return;
  lpT = setTimeout(function () {
    lpT = null; st.lp = 1; st.gsel = el.getAttribute('data-id');
    try { if (navigator.vibrate) navigator.vibrate(25); } catch (e) {}
    render();
  }, 480);
}
function lpBekor() { if (lpT) { clearTimeout(lpT); lpT = null; } }
['touchstart', 'mousedown'].forEach(function (ev) {
  document.getElementById('view').addEventListener(ev, function (e) {
    if (st.screen !== 'groups') return;
    lpBoshla(e.target.closest('[data-go="grp"]'));
  }, { passive: true });
});
['touchend', 'touchmove', 'touchcancel', 'mouseup', 'mouseleave', 'scroll'].forEach(function (ev) {
  document.getElementById('view').addEventListener(ev, lpBekor, { passive: true });
});
document.getElementById('view').addEventListener('contextmenu', function (e) {
  var c = e.target.closest('[data-go="grp"]');
  if (c && isPlus() && st.screen === 'groups') { e.preventDefault(); st.gsel = c.getAttribute('data-id'); render(); }
});

/* surish: Imtihon sahifasida Imtihonlar ⇄ Kirish imtihoni */
var sw = null;
document.getElementById('view').addEventListener('touchstart', function (e) {
  var p = e.touches[0]; sw = { x: p.clientX, y: p.clientY };
}, { passive: true });
document.getElementById('view').addEventListener('touchend', function (e) {
  if (!sw) return; var p = e.changedTouches[0], dx = p.clientX - sw.x, dy = p.clientY - sw.y; sw = null;
  if (Math.abs(dx) < 70 || Math.abs(dy) > 60) return;
  if (st.screen === 'imtihon') { st.sub.imt = dx < 0 ? 'kirish' : 'exams'; return render(); }
}, { passive: true });

function tryGate() {
  var inp = document.getElementById('code'); if (!inp) return;
  var ok = codeValid(inp.value);
  if (ok) { st.gateErr = false; grantAccess(ok); toast('Xush kelibsiz!'); render(); }
  else { st.gateErr = true; render(); }
}

/* ---------- ishga tushirish ---------- */
render();
loadCloud(function () { render(); syncNow(true); });
setInterval(function () { if (!document.hidden) syncNow(false); }, 120000);   // har 2 daqiqada «shu yerdaman»

})();
