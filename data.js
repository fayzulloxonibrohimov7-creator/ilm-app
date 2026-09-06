/* ============================================================
   ILM ACADEMY — MA'LUMOTLAR
   Bu fayl kod emas — mazmun. Dars nomlari, betlar, videolar,
   testlar, imtihonlar, rollar — hammasi shu yerda o'zgartiriladi.
   ============================================================ */

const ILM = {

  app: {
    name: "ILM AKADEMIYASI",
    slogan: "Qadrdon ta'lim markazingiz",
    course: "Fonetika",          // hozir faqat shu kurs; Grammatika keyin
    version: 1
  },

  /* Rollar — Telegram ID raqamlari (ilovaning Asosiy ekranida ko'rinadi) */
  roles: {
    ustozplus: [8558107235],     // egasi (Fayzulloh)
    ustoz: []
  },

  /* Kirish kodlari — o'quvchi birinchi kirganda so'raladi (bir marta).
     Har guruhga alohida kod berish mumkin: ["ILM-2026", "A-GURUH", ...]
     Ustoz va ustoz+ kodsiz kiradi. */
  access: {
    codes: ["ILM-2019"]
  },

  /* Qulf qoidalari */
  rules: {
    passPct: 70,                 // testdan o'tish foizi
    needVideo: true,             // keyingi dars uchun video oxirigacha ko'rilishi shart
    needBook: true,              // darslik ochilgan bo'lishi shart
    examPassPct: 70              // imtihondan o'tish foizi
  },

  /* 60 dars — 6 blok × 10. Nomlari keyin kiritiladi:
       ar    — arabcha nomi
       uz    — o'zbekcha nomi
       pages — darslik betlari (rasm fayllari), masalan ["rasm/f/07-1.jpg","rasm/f/07-2.jpg"]
       video — YouTube havolasi (ilova ichida ochiladi) yoki boshqa havola (tugma bo'ladi) */
  lessons: [],

  /* Bloklar — Darslar ro'yxatidagi sarlavhalar */
  blocks: [
    { n: 1, from: 1,  to: 10, title: "1-blok" },
    { n: 2, from: 11, to: 20, title: "2-blok" },
    { n: 3, from: 21, to: 30, title: "3-blok" },
    { n: 4, from: 31, to: 40, title: "4-blok" },
    { n: 5, from: 41, to: 50, title: "5-blok" },
    { n: 6, from: 51, to: 60, title: "6-blok" }
  ],

  /* Imtihonlar — `after` = nechanchi darsdan keyin ochiladi.
     Oraliq imtihon joyi (harflar tugagan dars) keyin aniqlanadi. */
  /*   1–10 mini · 11–20 mini · 21–30 ORALIQ · 31–40 mini · 41–50 mini · 51–60 YAKUNIY
       count — savollar soni. Oraliq: nazariy + amaliy. Yakuniy: nazariy + amaliy, oraliqdan qiyin. */
  exams: [
    { id: "mini1",   type: "mini",    title: "1-mini imtihon", after: 10, count: 30 },
    { id: "mini2",   type: "mini",    title: "2-mini imtihon", after: 20, count: 30 },
    { id: "oraliq",  type: "oraliq",  title: "Oraliq imtihon", after: 30, count: 50 },
    { id: "mini3",   type: "mini",    title: "3-mini imtihon", after: 40, count: 30 },
    { id: "mini4",   type: "mini",    title: "4-mini imtihon", after: 50, count: 30 },
    /* yakuniy: jami 100 — `count` nazariy (ilova tekshiradi) + `oral` amaliy (ustoz og'zaki oladi, bali keyin kiritiladi). Taxminiy — o'zgaradi. */
    { id: "yakuniy", type: "yakuniy", title: "Yakuniy imtihon", after: 60, count: 75, oral: 25 }
  ],

  /* Dars testlari — kalit: dars raqami. Savol turlari:
       { t:"choice",    q:"Savol", a:["A","B","C","D"], c:1 }       c — to'g'ri javob indeksi (0 dan)
       { t:"truefalse", q:"Tasdiq", c:true }
       { t:"audio",     q:"Eshiting va tanlang", src:"audio/x.mp3", a:["...","..."], c:0 }
     Hozir NAMUNA savollar turibdi — mazmun keyin almashtiriladi. */
  tests: {},

  /* Imtihon savollari — kalit: imtihon id */
  examQ: {}
};

/* ---- 60 ta bo'sh dars (nomlari keyin) ---- */
for (let i = 1; i <= 60; i++) {
  ILM.lessons.push({ n: i, ar: "", uz: "", pages: [], video: "" });
}

/* ---- NAMUNA testlar (skeletni ko'rish uchun; mazmun emas) ---- */
/* har darsda 10 ta savol */
function namunaTest(n) {
  var qs = [];
  for (var k = 1; k <= 10; k++) {
    if (k % 4 === 0)      qs.push({ t: "truefalse", q: n + "-dars · namuna tasdiq " + k + " — «to'g'ri» deb belgilang", c: true });
    else if (k % 5 === 0) qs.push({ t: "audio", q: n + "-dars · eshitib tanlang " + k + " (audio keyin qo'shiladi)", src: "", a: ["Birinchi", "Ikkinchi", "Uchinchi"], c: 2 });
    else                  qs.push({ t: "choice", q: n + "-dars · namuna savol " + k + " — keyin almashtiriladi", a: ["Birinchi variant", "Ikkinchi variant", "Uchinchi variant", "To'rtinchi variant"], c: k % 4 });
  }
  return qs;
}
for (let i = 1; i <= 60; i++) ILM.tests[i] = namunaTest(i);

/* imtihon savollari — soni `count` bo'yicha (mini 30 · oraliq 50 · yakuniy 50) */
ILM.exams.forEach(e => {
  ILM.examQ[e.id] = [];
  for (let k = 1; k <= e.count; k++) {
    ILM.examQ[e.id].push({ t: "choice", q: e.title + " · namuna savol " + k, a: ["Variant 1", "Variant 2", "Variant 3", "Variant 4"], c: k % 4 });
  }
});
