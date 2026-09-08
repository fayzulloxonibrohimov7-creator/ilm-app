/* ============================================================
   ILM AKADEMIYASI — MA'LUMOTLAR
   Bu fayl kod emas — mazmun. Dars nomlari, betlar, videolar,
   testlar, imtihonlar, guruhlar, markaz — hammasi shu yerda o'zgartiriladi.
   ============================================================ */

const ILM = {

  app: {
    name: "ILM AKADEMIYASI",
    slogan: "Qadrdon ta'lim markazingiz",
    course: "Fonetika",          // hozir faqat shu kurs; Grammatika keyin
    version: 2,
    bot: "Ilmakademiyasi_bot",   // «Do'stlarga ulashish» uchun
    changelog: [
      "Asosiy ekran: joriy daraja, hafta jadvali, guruh va to'lov kartalari",
      "Kirish imtihoni — qaysi darsdan boshlashni aniqlaydi",
      "Profil, Markaz haqida, Yo'riqnoma, Savol-javob, Yordam bo'limlari",
      "Guruh kodi bilan kirish"
    ]
  },

  /* O'quv yo'li — Asosiy ekrandagi daraja zanjiri (birinchisi joriy) */
  path: ["Fonetika", "Grammatika", "A1", "A2", "B1", "B2", "C1", "C2"],

  /* Rollar — Telegram ID raqamlari (Profil ekranida ko'rinadi) */
  roles: {
    ustozplus: [8558107235],     // egasi (Fayzulloh)
    ustoz: []
  },

  /* Markaz haqida — bo'sh qoldirilgan joylar «—» bo'lib chiqadi */
  center: {
    address: "",                 // masalan: "Toshkent sh., Yunusobod t., 4-mavze"
    mapUrl: "",                  // Google/Yandex xarita havolasi
    phone: "",                   // masalan: "+998 90 123 45 67"
    telegram: "",                // admin username, @ siz: "ilm_admin"
    hours: "Dushanba–Shanba · 9:00–18:00",
    email: ""
  },

  /* Guruhlar — o'quvchi shu guruh KODI bilan kiradi (server kelguncha).
       days  — dars kunlari: Du Se Ch Pa Ju Sh Ya
       start — guruh boshlangan sana (undan oldingi kunlar hisoblanmaydi)
       pay   — { amount, day }  oylik: har oyning `day`-kuni
               { amount, date } bir martalik: aniq sana
     NAMUNA — haqiqiy guruhlar berilgach almashtiriladi */
  groups: [
    { id: "g1", code: "ILM-ERTALAB", name: "Fonetika · ertalabki guruh", teacher: "Ustoz (nomi keyin)",
      days: ["Se", "Pa", "Sh"], time: "08:00–09:30", start: "2026-09-01", pay: { amount: 400000, day: 5 } },
    { id: "g2", code: "ILM-KECHKI", name: "Fonetika · kechki guruh", teacher: "Ustoz (nomi keyin)",
      days: ["Du", "Ch", "Ju"], time: "18:30–20:00", start: "2026-09-01", pay: { amount: 400000, day: 10 } }
  ],

  /* Bayram / dam olish kunlari — bu kunlarda dars hisoblanmaydi: ["2026-09-01", "2026-10-01"] */
  holidays: [],

  /* Umumiy kirish kodi — guruhsiz kirish (darvoza). Ustoz va ustoz+ kodsiz kiradi. */
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

  /* Kirish imtihoni: 1-bosqich — har blokdan `perBlock` savol (blok ichida teng taqsimlangan darslardan);
     2-bosqich — xatosi bo'lgan blok ichida har darsdan `perLesson` savol, ketma-ket.
     perBlock: 4 → ~25–45 savol. perBlock: 10 → har dars tekshiriladi (60 + savol), eng aniq, lekin uzun. */
  placement: { perBlock: 4, perLesson: 2 },

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
       1–10 mini · 11–20 mini · 21–30 ORALIQ · 31–40 mini · 41–50 mini · 51–60 YAKUNIY
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

  /* Yo'riqnoma — ilova qanday ishlaydi (akkordeon) */
  guide: [
    { t: "Darslar qanday ochiladi",
      d: "Har dars uch qismdan iborat: darslik, video darslik va test. Keyingi dars ochilishi uchun uchalasi bajarilgan bo'lishi kerak — darslik ochilgan, video oxirigacha ko'rilgan, testdan 70% olingan. Avvalgi darslarga istalgan vaqt qaytish mumkin, lekin joriy darsdan oldinga o'tib bo'lmaydi." },
    { t: "Test va o'tish bali",
      d: "Har darsda 10 ta savol. 70% va undan yuqori — o'tildi. O'tmasangiz qayta topshirasiz, urinishlar soni cheklanmagan. Xato qilingan savollar Mashq → «Xatolar ustida ishlash» bo'limida to'planadi." },
    { t: "Imtihonlar",
      d: "Har 10 darsdan keyin imtihon: 1–10 mini (30 savol), 11–20 mini, 21–30 oraliq (50 savol, nazariy + amaliy), 31–40 mini, 41–50 mini, 51–60 yakuniy (100 ball: nazariy qismi ilovada, amaliy qismini ustoz og'zaki oladi). O'tish bali 70%. Imtihon topshirilmaguncha keyingi blok ochilmaydi. Natijalar rasmiy — ustoz qo'lda o'zgartira olmaydi." },
    { t: "Kirish imtihoni",
      d: "Avval ozgina o'qigan bo'lsangiz, kirish imtihoni qaysi darsdan boshlashni aniqlaydi. 1-bosqich: har blokdan turli darslarga oid 4 savol. 2-bosqich: xatosi bo'lgan blok ichida har darsdan 2 savol, ketma-ket. Ikkalasi ham xato bo'lgan birinchi dars — boshlanish nuqtangiz. Undan oldingi darslar ochiq qoladi, takrorlash mumkin. Talaffuzni ustoz og'zaki tekshiradi." },
    { t: "Mashq",
      d: "Dars testlarini istalgancha qayta yechish, blok testlari (10 darsning savollari bittada) va xatolar ustida ishlash. Mashq natijalari balga ta'sir qilmaydi." },
    { t: "Guruh, jadval va to'lov",
      d: "Guruh kodi bilan kirganingizda ilova dars kunlari, vaqti, ustozingiz va to'lov kunini ko'rsatadi. Bu oyda nechta dars borligi kalendar bo'yicha hisoblanadi. To'lov kuniga 3 kun qolganda karta tilla rangga o'tadi." },
    { t: "Rollar",
      d: "O'quvchi — o'z darslari va natijalari. Ustoz — o'quvchilarni ko'radi, guruhga qo'shadi. Ustoz+ — barcha huquqlar." }
  ],

  /* Savol-javob (akkordeon) */
  faq: [
    { q: "Keyingi dars nega ochilmayapti?",
      a: "Uchta shart bajarilishi kerak: darslik ochilgan, video oxirigacha ko'rilgan, test 70% bilan o'tilgan. Dars ichida qaysi shart qolgani yozilgan bo'ladi. Blok oxirida esa imtihon ham topshirilishi kerak." },
    { q: "Testdan o'ta olmadim, nima qilay?",
      a: "Xato savollarni Mashq → «Xatolar ustida ishlash» da qayta yeching, darslikni ko'rib chiqing va testni qayta topshiring. Cheklov yo'q." },
    { q: "Videoni ko'rdim, lekin belgilanmadi?",
      a: "Video oxirigacha, o'tkazib yubormasdan ko'rilganda o'zi belgilanadi. Video tashqi havolada bo'lsa, ko'rib bo'lgach «Ko'rdim» tugmasini bosing." },
    { q: "Avval arab tilini ozgina o'qiganman. 1-darsdan boshlashim shartmi?",
      a: "Yo'q. Imtihon → «Kirish imtihoni» ni topshiring — ilova qaysi darsdan boshlashni aniqlab beradi, undan oldingi darslar ochiq qoladi." },
    { q: "Imtihon natijasini ustoz o'zgartira oladimi?",
      a: "Yo'q. Imtihon natijalari rasmiy, ilova o'zi hisoblaydi. Faqat yakuniy imtihonning amaliy (og'zaki) qismini ustoz baholaydi." },
    { q: "Natijalarim boshqa telefonda chiqadimi?",
      a: "Ha. Natijalar Telegram hisobingizga bog'lab saqlanadi — o'sha Telegram bilan kirsangiz, boshqa telefonda ham ko'rinadi." },
    { q: "Guruh kodini qayerdan olaman?",
      a: "Ustozingizdan yoki markaz adminidan. Kod bir marta kiritiladi." },
    { q: "Darslik betlarini saqlab olsam bo'ladimi?",
      a: "Betlar faqat ilova ichida ochiladi. Har betda ismingiz va ID raqamingiz yozilgan — tarqatilgan nusxa kimniki ekani ma'lum bo'ladi." }
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

/* imtihon savollari — soni `count` bo'yicha */
ILM.exams.forEach(e => {
  ILM.examQ[e.id] = [];
  for (let k = 1; k <= e.count; k++) {
    ILM.examQ[e.id].push({ t: "choice", q: e.title + " · namuna savol " + k, a: ["Variant 1", "Variant 2", "Variant 3", "Variant 4"], c: k % 4 });
  }
});
