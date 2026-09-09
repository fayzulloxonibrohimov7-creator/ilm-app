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
function rGate() {
  return '<div class="top"><div><div class="kicker">' + esc(ILM.app.name) + '</div><h1>Xush kelibsiz</h1>' +
    '<div class="sub" style="color:var(--gold2)">' + esc(ILM.app.slogan || '') + '</div></div></div>' +
    '<div class="card blue"><div class="row"><div class="avatar">' + esc(user.name.charAt(0).toUpperCase()) + '</div>' +
    '<div class="grow"><div class="t">' + esc(user.name) + '</div><div class="d">@' + esc(user.username || '—') + ' · ID ' + (user.id || '—') + '</div></div></div></div>' +
    '<div class="card"><div class="t">Guruh kodi</div><div class="d">Kodni ustozingizdan yoki markazdan olasiz. Bir marta kiritiladi.</div>' +
    '<input id="code" class="inp" placeholder="Kodni kiriting" autocomplete="off" autocapitalize="characters">' +
    (st.gateErr ? '<div class="hint" style="color:var(--red);text-align:center;margin-bottom:10px">Kod noto\'g\'ri — qayta urinib ko\'ring</div>' : '') +
    '<button class="btn gold wide" data-act="gate">Kirish</button></div>' +
    '<div class="hint" style="text-align:center">Kod yo\'qmi? Markaz bilan bog\'laning' + (ILM.center.phone ? ': ' + esc(ILM.center.phone) : '.') + '</div>';
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
function groupById(id) { var gs = ILM.groups || []; for (var i = 0; i < gs.length; i++) if (gs[i].id === id || gs[i].code === id) return gs[i]; return null; }
function myGroup() {
  var id = (srv.me && srv.me.group) || progress.group;
  return id ? groupById(id) : null;
}
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
function top(title, sub, withBack) {
  return '<div class="top">' + (withBack ? '<button class="back" data-act="back">‹</button>' : '') +
    '<div><h1>' + title + '</h1>' + (sub ? '<div class="sub">' + sub + '</div>' : '') + '</div></div>';
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

  /* kirish imtihoni taklifi — yangi o'quvchiga */
  if (role() === 'oquvchi' && !progress.placement && done === 0)
    h += '<div class="card deep tap" data-act="kirish"><div class="row"><div class="cic">🎯</div><div class="grow"><div class="t">Avval o\'qiganmisiz?</div><div class="d">Kirish imtihoni qaysi darsdan boshlashni aniqlab beradi</div></div><span class="chev">›</span></div></div>';

  /* guruhim */
  if (g) {
    var ms = monthStats(g, t);
    h += '<div class="card"><div class="row"><div class="grow"><div class="kicker">Guruhim</div><div class="t">' + esc(g.name) + '</div>' +
      '<div class="d">' + esc(g.teacher) + ' · ' + esc(daysText(g)) + ' · ' + esc(g.time) + '</div></div><div class="cic">👥</div></div>' +
      '<div class="stats"><div><b>' + ms.total + '</b><span>' + cap(MONTHS[t.getMonth()]) + 'da dars</span></div><div><b>' + ms.past + '</b><span>o\'tdi</span></div><div><b>' + (ms.total - ms.past) + '</b><span>qoldi</span></div></div></div>';
    var np = nextPay(g);
    if (np) {
      var pc = np.late ? 'late' : (np.left <= 3 ? 'gold' : '');
      h += '<div class="card ' + pc + '"><div class="row"><div class="grow"><div class="kicker">To\'lov</div>' +
        '<div class="t">' + (np.late ? 'To\'lov kuni o\'tdi' : np.left === 0 ? 'Bugun to\'lov kuni' : 'Keyingi to\'lov: ' + fmt(np.date)) + '</div>' +
        '<div class="d">' + money(np.amount) + ' so\'m' + (np.late ? ' · ' + fmt(np.date) + ' edi' : np.left > 0 ? ' · ' + np.left + ' kun qoldi' : '') + '</div></div><div class="cic">💳</div></div></div>';
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
    h += '<div class="switch" style="display:block"><div class="k">Guruh (sinov uchun)</div><div class="v" style="margin-bottom:8px">Jadval va to\'lov kartalarini shu guruh bo\'yicha ko\'rsatadi</div>' +
      '<select class="sel" data-act="setgroup"><option value="">— guruh tanlanmagan —</option>' +
      (ILM.groups || []).map(function (gg) { return '<option value="' + esc(gg.id) + '"' + (progress.group === gg.id ? ' selected' : '') + '>' + esc(gg.name) + '</option>'; }).join('') + '</select></div>';
    h += link('🧑‍🎓', 'Foydalanuvchilar', srv.on ? 'Kim kirdi, kim online, guruhga qo\'shish' : 'Server ulanmagan', srv.on ? 'data-go="users"' : 'data-act="srvoff"');
    h += link('👥', 'Guruhlar ro\'yxati', (ILM.groups || []).length + ' guruh · kodlari va jadvali', 'data-go="groups"');
    h += '<div class="hint" style="margin-top:10px">Server: ' + (srv.on ? '✅ ulangan · ' + ago(srv.last) : (API ? '⚠️ ' + esc(srv.err || (inTG ? 'ulanmoqda…' : 'faqat Telegram ichida ishlaydi')) : 'sozlanmagan')) + '</div>';
    if (!st.viewAs) h += '<div class="switch"><div><div class="k">Progressni tozalash</div><div class="v">Hamma natija o\'chadi (guruh qoladi)</div></div><button class="btn sm red" data-act="reset">Tozalash</button></div>';
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
  var h = top(n + '-dars', sub || esc(blockOf(n).title), true);

  if (locked) h += '<div class="card"><div class="t">🔒 Bu dars hali yopiq</div><div class="d">Avval ' + (n - 1) + '-darsni tugating: darslik, video va test.</div></div>';
  if (p.placed) h += '<div class="card deep"><div class="t">✓ Kirish imtihoni bilan o\'tilgan</div><div class="d">Bu dars sizga tanish deb topildi. Takrorlash uchun ochiq.</div></div>';

  var dis = locked ? ' dis' : '';
  h += '<div class="part' + (p.book ? ' ok' : '') + dis + '" data-go="book" data-n="' + n + '"><div class="ic">📖</div>' +
    '<div class="grow"><div class="t">Darslik</div><div class="d">' + (l.pages.length ? l.pages.length + ' bet' : 'betlar keyin qo\'shiladi') + '</div></div>' +
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

/* ---- Darslik (betlar) ---- */
function rBook() {
  var n = +st.params.n, l = L(n);
  var h = top('Darslik', n + '-dars', true);
  if (!l.pages.length) {
    h += empty('📖', 'Betlar hali qo\'shilmagan', 'Kitob tayyor bo\'lgach shu yerda darsning betlari chiqadi — har betda suv belgisi (ism · ID) bilan.');
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
  h += '<div class="card">' +
    link('👥', 'Guruhim', g ? esc(g.name) + ' · ' + esc(daysText(g)) + ' ' + esc(g.time) : 'Hali biriktirilmagan', 'data-act="' + (g ? 'none' : 'none') + '"') +
    link('🎯', 'Kirish imtihoni', progress.placement && progress.placement.n ? (progress.placement.n > N ? 'Fonetika to\'liq' : progress.placement.n + '-darsdan') + ' · ' + esc(fmt(parseISO(progress.placement.date))) : 'Topshirilmagan', 'data-act="kirish"') + '</div>';
  h += '<div class="card">' +
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
  return h;
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
function rGroups() {
  var gs = ILM.groups || [], h = top('Guruhlar', gs.length + ' guruh · data.js', true), t = today();
  if (!gs.length) return h + empty('👥', 'Guruhlar hali yo\'q', 'Guruhlar ro\'yxati berilgach shu yerda chiqadi');
  gs.forEach(function (g) {
    var ms = monthStats(g, t), np = nextPay(g);
    h += '<div class="card"><div class="row"><div class="grow"><div class="t">' + esc(g.name) + '</div><div class="d">' + esc(g.teacher) + ' · ' + esc(daysText(g)) + ' · ' + esc(g.time) + '</div></div><span class="badge gold">' + esc(g.code) + '</span></div>' +
      '<div class="stats"><div><b>' + ms.total + '</b><span>bu oyda dars</span></div><div><b>' + ms.past + '</b><span>o\'tdi</span></div><div><b>' + (np ? fmt(np.date) : '—') + '</b><span>to\'lov' + (np ? ' · ' + money(np.amount) : '') + '</span></div></div>' +
      '<div class="hint" style="margin-top:10px">Boshlangan: ' + (g.start ? esc(fmt(parseISO(g.start))) : '—') + ' · kod: ' + esc(g.code) + '</div></div>';
  });
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

  var gs = ILM.groups || [];
  d.users.forEach(function (u) {
    var on = (d.now - u.last_seen) < 5 * 60 * 1000;
    var g = u.group_id ? groupById(u.group_id) : null;
    h += '<div class="card ustd"><div class="row">' +
      '<div class="dot ' + (on ? 'on' : '') + '"></div>' +
      '<div class="grow"><div class="t" style="font-size:17px">' + esc(u.name || '—') +
      (u.role !== 'oquvchi' ? ' <span class="pill ' + (u.role === 'ustozplus' ? 'gold' : 'blue') + '" style="margin:0">' + (u.role === 'ustozplus' ? '★ Ustoz+' : 'Ustoz') + '</span>' : '') + '</div>' +
      '<div class="d">@' + esc(u.username || '—') + ' · ID ' + u.id + '</div>' +
      '<div class="hint">Qo\'shildi: ' + dtx(u.first_seen) + ' · Oxirgi: ' + (on ? 'online' : ago(u.last_seen)) + '</div>' +
      (u.placement ? '<div class="hint">Kirish imtihoni: ' + u.placement + '-darsdan</div>' : '') +
      '</div></div>' +
      '<select class="sel" style="margin-top:10px" data-act="ugroup" data-user="' + u.id + '">' +
      '<option value="">— guruhga qo\'shilmagan —</option>' +
      gs.map(function (gg) { return '<option value="' + esc(gg.id) + '"' + (u.group_id === gg.id ? ' selected' : '') + '>' + esc(gg.name) + '</option>'; }).join('') +
      '</select>' +
      (g ? '<div class="hint" style="margin-top:6px">' + esc(g.teacher) + ' · ' + esc(daysText(g)) + ' · ' + esc(g.time) + '</div>' : '') +
      '</div>';
  });
  h += '<button class="btn ghost wide" data-act="reloadusers">Yangilash ↻</button>';
  return h;
}

/* ============================================================
   RENDER va HODISALAR
   ============================================================ */
var SCREENS = { home: rHome, lessons: rLessons, lesson: rLesson, book: rBook, video: rVideo, test: rTest, mashq: rMashq, mashqList: rMashqList, mashqBlocks: rMashqBlocks, imtihon: rImtihon,
  profile: rProfile, center: rCenter, guide: rGuide, faq: rFaq, help: rHelp, about: rAbout, groups: rGroups, users: rUsers };
var SIMPLE = { center: 1, guide: 1, faq: 1, help: 1, about: 1, groups: 1, users: 1 };
var ICONS = {
  home: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-6H9v6H5a2 2 0 0 1-2-2z"/></svg>',
  lessons: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
  mashq: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
  imtihon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M8.2 13.5L7 22l5-3 5 3-1.2-8.5"/></svg>',
  profile: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>'
};
function render() {
  if (!gateOK()) {
    document.getElementById('view').innerHTML = rGate();
    document.getElementById('nav').innerHTML = '';
    var inp = document.getElementById('code');
    if (inp) { inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') tryGate(); }); inp.focus(); }
    return;
  }
  var fn = SCREENS[st.screen] || rHome;
  document.getElementById('view').innerHTML = fn();
  var nav = [['home', 'Asosiy'], ['lessons', 'Darslar'], ['mashq', 'Mashq'], ['imtihon', 'Imtihon'], ['profile', 'Profil']];
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
