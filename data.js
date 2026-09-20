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
    version: 4,
    /* Server (Cloudflare Worker + D1). Bo'sh qoldirilsa — ilova serversiz ishlaydi. */
    api: "https://ilm.ilm-akademiyasi.workers.dev",
    bot: "Ilmakademiyasi_bot",   // «Do'stlarga ulashish» uchun
    changelog: [
      "Kitob ilovada: 60 dars, har birining nomi va kitobdagi betlari",
      "Darslik — kitob matni, jadvallari va ranglari bilan (skan emas)",
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

  /* Markaz haqida — @Ilmakademiyasi kanali biosidan (2026-09-09). Bo'sh joylar «—» bo'lib chiqadi */
  center: {
    phone: "+998 55 517 90 70",
    telegram: "Ilmakademiyasi_operator",   // operator (yozish uchun), @ siz
    channel: "Ilmakademiyasi",             // Telegram kanal, @ siz
    hours: "Dushanba–Shanba · 9:00–18:00", // TAXMINIY — tasdiqlash kerak
    email: "",
    branches: [
      { name: "1-filial · Beruniy",  address: "Beruniy ko'chasi, 35 A",  mapUrl: "https://maps.google.com/maps?q=41.348537400641,69.1950881503&z=16" },
      { name: "2-filial · Tinchlik", address: "Farobiy ko'chasi, 393B",  mapUrl: "https://maps.google.com/maps?q=41.334638949604,69.215530411972&z=16" }
    ]
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

  /* Bayram / dam olish kunlari — bu kunlarda dars hisoblanmaydi (kanal e'lonlaridan) */
  holidays: ["2026-08-31", "2026-09-01", "2026-09-02"],

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

/* ---- 60 dars: nomlari va kitobdagi betlari (kitob\darslar.json dan) ----
   Darslik matni serverdan keladi (ILM.app.api), shuning uchun bu yerda faqat nom. */
const NOMLAR = [
  { n: 1, ar:"", uz:"Kirish", bet:"3-4" },
  { n: 2, ar:"", uz:"Fonetika nima?", bet:"4-5" },
  { n: 3, ar:"", uz:"Sifatlar", bet:"5-6" },
  { n: 4, ar:"ا", uz:"Alif harfi", bet:"6-9" },
  { n: 5, ar:"ر", uz:"Ro harfi", bet:"9-12" },
  { n: 6, ar:"ز", uz:"Za harfi", bet:"12-15" },
  { n: 7, ar:"م", uz:"Mim harfi", bet:"15-18" },
  { n: 8, ar:"ت", uz:"Ta harfi", bet:"18-22" },
  { n: 9, ar:"ن", uz:"Nun harfi", bet:"22-26" },
  { n:10, ar:"ي", uz:"Ya harfi", bet:"26-30" },
  { n:11, ar:"ب", uz:"Ba harfi", bet:"30-34" },
  { n:12, ar:"ك", uz:"Kaf harfi", bet:"34-38" },
  { n:13, ar:"ل", uz:"Lam harfi", bet:"38-42" },
  { n:14, ar:"و", uz:"Waw harfi", bet:"42-46" },
  { n:15, ar:"ه", uz:"Ḥa harfi", bet:"46-50" },
  { n:16, ar:"ف", uz:"Fa harfi", bet:"50-54" },
  { n:17, ar:"ق", uz:"Qof harfi", bet:"54-58" },
  { n:18, ar:"ش", uz:"Shin harfi", bet:"58-62" },
  { n:19, ar:"س", uz:"Sin harfi", bet:"62-66" },
  { n:20, ar:"ث", uz:"Sa̱ harfi", bet:"66-70" },
  { n:21, ar:"ص", uz:"Ṣod harfi", bet:"70-74" },
  { n:22, ar:"ط", uz:"Ṭo harfi", bet:"74-78" },
  { n:23, ar:"ج", uz:"Jim harfi", bet:"78-82" },
  { n:24, ar:"خ", uz:"Xo harfi", bet:"82-86" },
  { n:25, ar:"ح", uz:"Ha harfi", bet:"86-90" },
  { n:26, ar:"غ", uz:"G'oyn harfi", bet:"90-94" },
  { n:27, ar:"ع", uz:"'Ayn harfi", bet:"94-98" },
  { n:28, ar:"د", uz:"Dal harfi", bet:"98-102" },
  { n:29, ar:"ض", uz:"Ḍod harfi", bet:"102-106" },
  { n:30, ar:"ذ", uz:"Zal harfi", bet:"106-110" },
  { n:31, ar:"ظ", uz:"Ẓo harfi", bet:"110-114" },
  { n:32, ar:"", uz:"Mad harflari", bet:"114-119" },
  { n:33, ar:"", uz:"Tashdidli harflar", bet:"119-123" },
  { n:34, ar:"", uz:"Tanvinli harflar", bet:"123-125" },
  { n:35, ar:"", uz:"Tanvinli tashdid", bet:"125-127" },
  { n:36, ar:"", uz:"Hamza", bet:"127-129" },
  { n:37, ar:"", uz:"Qat'iy hamzaga kursi tanlash qoidasi", bet:"129-134" },
  { n:38, ar:"", uz:"Ta marbuta", bet:"134-135" },
  { n:39, ar:"", uz:"Muqaddara harflar", bet:"135-136" },
  { n:40, ar:"", uz:"Yozilsada o'qilmaydigan harflar", bet:"136-137" },
  { n:41, ar:"", uz:"Yozilganidek o'qilmaydigan harflar: 2ta", bet:"137-138" },
  { n:42, ar:"", uz:"Shamsiy qamariya harflar", bet:"138-140" },
  { n:43, ar:"", uz:"Vasl", bet:"140-142" },
  { n:44, ar:"", uz:"Vaqf", bet:"142-145" },
  { n:45, ar:"", uz:"Sukunli nun qoidalari: 4 ta", bet:"145-149" },
  { n:46, ar:"", uz:"Ligaturalar لا", bet:"149-153" },
  { n:47, ar:"", uz:"Mustaqil o'qish (1-qism)", bet:"153-156", kitobda:"Mustaqil o'qish [o'qilmadi]" },
  { n:48, ar:"", uz:"Mustaqil o'qish (2-qism)", bet:"157-160", kitobda:"Mustaqil o'qish (davomi)" },
  { n:49, ar:"الْمُثَنَّى وَالْجَمْع", uz:"Ikkilik va ko'plik", bet:"160-166", kitobda:"1-dars" },
  { n:50, ar:"الضَّمَائِرُ الْمُنْفَصِلَة", uz:"Munfasil zamirlar", bet:"166-169", kitobda:"2-dars" },
  { n:51, ar:"النَّعْتُ وَالْمَنْعُوت", uz:"Sifat — na't va man'ut", bet:"169-173", kitobda:"3-dars" },
  { n:52, ar:"الْفِعْلُ الْمَاضِي", uz:"Moziy fe'li", bet:"173-177", kitobda:"4-dars" },
  { n:53, ar:"حُرُوفُ الْجَرّ", uz:"Harfi jarlar va maf'ul", bet:"177-181", kitobda:"5-dars" },
  { n:54, ar:"الإِضَافَة", uz:"Izofa — muzof va muzofun ilayh", bet:"181-186", kitobda:"6-dars" },
  { n:55, ar:"الضَّمَائِرُ الْمُتَّصِلَة", uz:"Muttasil zamirlar", bet:"186-190", kitobda:"7-dars" },
  { n:56, ar:"الأَعْدَاد", uz:"Sonlar", bet:"190-194", kitobda:"8-dars" },
  { n:57, ar:"الْفِعْلُ الْمُضَارِع", uz:"Muzore' fe'li", bet:"194-198", kitobda:"9-dars" },
  { n:58, ar:"الاسْمُ الْمَوْصُول", uz:"Ismi mavsul va ranglar", bet:"198-204", kitobda:"10-dars" },
  { n:59, ar:"فِعْلُ الأَمْر", uz:"Amr fe'li", bet:"204-211", kitobda:"11-dars" },
  { n:60, ar:"أَبْوَابُ الْفِعْل", uz:"Fe'l boblari — 10 bob", bet:"211-213", kitobda:"12-dars" },
];
NOMLAR.forEach(function (d) {
  ILM.lessons.push({ n: d.n, ar: d.ar, uz: d.uz, bet: d.bet, kitobda: d.kitobda || '', pages: [], video: "" });
});

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
