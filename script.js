
(function () {
  "use strict";

  // =========================
  // DOM
  // =========================
  const progressContainer = document.getElementById("progress-container");
  const progressBar = document.getElementById("progress-bar");
  const container = document.getElementById("quiz-container");
  const themeGrid = document.getElementById("theme-grid");
  const homeBtn = document.getElementById("home-btn");
  const subtitle = document.getElementById("subtitle");

  // Mode switch (optional in HTML)
  const modeSwitch = document.getElementById("mode-switch");
  const modeAdultBtn = document.getElementById("mode-adult");
  const modeKidsBtn = document.getElementById("mode-kids");

  // Exit modal (optional)
  const exitModal = document.getElementById("exit-modal");
  const modalTitle = document.getElementById("modal-title");
  const modalText = document.getElementById("modal-text");
  const modalCancel = document.getElementById("modal-cancel");
  const modalConfirm = document.getElementById("modal-confirm");
  const modalBackdrop = exitModal ? exitModal.querySelector(".modal-backdrop") : null;

  const langDE = document.getElementById("lang-de");
  const langEN = document.getElementById("lang-en");

  if (!container) return;

  // =========================
  // HELPERS
  // =========================
  function escapeHTML(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function pickText(x) {
    if (x && typeof x === "object") return x[lang] || x.de || x.en || "";
    return x ?? "";
  }

  function shuffle(array) {
    const a = [...(array || [])];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Source rendering: supports string, {label,url}, or array of them
  function sourceToLinks(source) {
    if (!source) return "—";
    const items = Array.isArray(source) ? source : [source];

    const parts = items
      .map((s) => {
        if (!s) return null;

        // {label, url}
        if (typeof s === "object") {
          const label = escapeHTML(s.label || s.title || s.name || s.url || "Source");
          const url = typeof s.url === "string" ? s.url.trim() : "";
          if (url) return `<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
          return label;
        }

        // "Label — https://..." or just "https://..."
        const raw = String(s);
        const txt = raw.trim();
        if (!txt) return null;

        const urlMatch = txt.match(/https?:\/\/[^\s]+/);
        if (urlMatch) {
          const url = urlMatch[0];
          const label = escapeHTML(txt.replace(url, "").replace(/[-–—:]+\s*$/, "").trim() || url);
          return `<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
        }

        return escapeHTML(txt);
      })
      .filter(Boolean);

    return parts.length ? parts.join(" · ") : "—";
  }

  // Adults: avoid repeats across runs (works only if questions have string id)
  function storageKeyForTheme(themeId) {
    return `dc_seen_${lang}_mode_${mode}_theme_${themeId}`;
  }

  function getSeenSet(themeId) {
    try {
      const raw = localStorage.getItem(storageKeyForTheme(themeId));
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set();
    }
  }

  function saveSeenSet(themeId, seenSet) {
    try {
      localStorage.setItem(storageKeyForTheme(themeId), JSON.stringify([...seenSet]));
    } catch {
      // ignore
    }
  }

  function pickRandomQuestions(themeId, pool, n) {
    const safePool = Array.isArray(pool) ? pool : [];
    const hasIds = safePool.length && safePool.every((q) => typeof q.id === "string" && q.id.length);

    // Kids mode: use all questions (shuffled) to preserve your "15 total" structure
    if (mode === "kids") return shuffle(safePool);

    if (!hasIds) return shuffle(safePool).slice(0, Math.min(n, safePool.length));

    const seen = getSeenSet(themeId);
    const unseen = safePool.filter((q) => !seen.has(q.id));
    let picked = [];

    if (unseen.length >= n) {
      picked = shuffle(unseen).slice(0, n);
    } else {
      picked = [...unseen];
      const remaining = n - picked.length;
      const rest = safePool.filter((q) => !picked.includes(q));
      picked = picked.concat(shuffle(rest).slice(0, remaining));
    }

    picked.forEach((q) => seen.add(q.id));
    saveSeenSet(themeId, seen);

    return picked;
  }

  // =========================
  // STATE
  // =========================
  let mode = localStorage.getItem("dc_mode") || "adult"; // "adult" | "kids"
  let lang = localStorage.getItem("dc_lang") || "de";

  let currentTheme = null;
  let index = 0;
  let score = 0;

  // global totals (for final summary)
  let totalAnswered = 0;
  let totalCorrect = 0;
  const completedThemes = new Set();

  const ADULT_QUESTIONS_PER_THEME = 5;
  let selectedQuestions = [];

  // =========================
  // i18n UI STRINGS
  // =========================
  const UI = {
    de: {
      subtitle: "Wähle ein Thema",
      backHome: "⬅ Zurück zur Übersicht",
      next: "Weiter",
      resultTitle: "Ergebnis",
      overallTitle: "Gesamt-Ergebnis",
      source: "Quelle:",
      didYouKnow: "Wusstest du schon?",
      modalTitle: "Quiz verlassen?",
      modalText:
        "Dein Fortschritt in diesem Thema geht verloren. Willst du wirklich zurück zur Übersicht?",
      cancel: "Abbrechen",
      confirmLeave: "Ja, verlassen",
      questionCounter: (i, total) => `Frage ${i} von ${total}`,
      trueLabel: "Wahr",
      falseLabel: "Falsch",
      correct: "✅ Richtig",
      wrong: "❌ Falsch",
      nextTheme: "Nächstes Thema ➡",
      backOverview: "🏁 Zur Übersicht",
      scoreLine: (s, t) => `${s} / ${t} richtige Antworten`,
      emptyTheme: "Dieses Thema ist noch leer.",

      finalTextStrong:
        "Mega! Du hast alle Themen durchgespielt. Wenn du magst: Such dir ein Thema raus und lies heute 1 kurze Quelle dazu (offizielle Seite, seriöses Medium oder ein Guide).",
      finalTextMid:
        "Sehr gut! Du hast alle Themen geschafft. Nimm dir als nächsten Schritt 1 Thema und checke 1–2 seriöse Quellen — kleine Routine, großer Effekt.",
      finalTextLow:
        "Starker Start! Du hast alle Themen gemacht. Der wichtigste Skill ist dranbleiben: nimm dir 1 Thema und lies/prüfe heute 10 Minuten — das bringt richtig viel.",
      finalLearnTip: "Tipp: Quelle + Datum + Zweck prüfen, bevor du teilst.",
      finalButton: "🏁 Zur Übersicht",
    },
    en: {
      subtitle: "Choose a theme",
      backHome: "⬅ Back to overview",
      next: "Next",
      resultTitle: "Results",
      overallTitle: "Overall result",
      source: "Source:",
      didYouKnow: "Did you know?",
      modalTitle: "Leave the quiz?",
      modalText:
        "Your progress in this theme will be lost. Do you really want to go back to the overview?",
      cancel: "Cancel",
      confirmLeave: "Yes, leave",
      questionCounter: (i, total) => `Question ${i} of ${total}`,
      trueLabel: "True",
      falseLabel: "False",
      correct: "✅ Correct",
      wrong: "❌ Wrong",
      nextTheme: "Next theme ➡",
      backOverview: "🏁 Back to overview",
      scoreLine: (s, t) => `${s} / ${t} correct answers`,
      emptyTheme: "This theme is empty for now.",

      finalTextStrong:
        "Awesome! You completed all themes. Next step: pick one theme and read one short reliable source today (official site, reputable outlet, or a guide).",
      finalTextMid:
        "Great job! You finished all themes. Next: pick one theme and check 1–2 reliable sources — small habit, big effect.",
      finalTextLow:
        "Strong start! You finished all themes. The key skill is consistency: pick one theme and spend 10 minutes learning/checking today — it helps a lot.",
      finalLearnTip: "Tip: Check source + date + purpose before you share.",
      finalButton: "🏁 Back to overview",
    },
  };

  const t = (key, ...args) => {
    const v = UI[lang]?.[key];
    return typeof v === "function" ? v(...args) : (v ?? "");
  };

  // =========================
  // DATA (Adults + Kids)
  // =========================
  const questionBank = {
    1: {
      title: { de: "Datenschutz & Grundrechte", en: "Privacy & Data Rights" },
      summary: (ratio) => {
        if (ratio >= 0.8) {
          return {
            de: { title: "🛡️ Datenschutz-Profi!", text: "Du erkennst Datenrisiken schnell und triffst kluge Entscheidungen. Stark!" },
            en: { title: "🛡️ Privacy Pro!", text: "You spot data risks quickly and make smart choices. Great job!" },
          };
        }
        if (ratio >= 0.5) {
          return {
            de: { title: "✨ Gute Basis!", text: "Du hast die wichtigsten Ideen drauf — mit etwas Übung wirst du richtig sicher." },
            en: { title: "✨ Solid foundation!", text: "You’ve got the core ideas — a bit more practice and you’ll be very confident." },
          };
        }
        return {
          de: { title: "🌱 Guter Start!", text: "Datenschutz ist tricky — aber du bist dran. Jeder Schritt zählt!" },
          en: { title: "🌱 Great start!", text: "Privacy can be tricky — but you’re learning. Every step counts!" },
        };
      },
      questions: [
        {
          id: "p1_q01",
          type: "mc",
          q: { de: "Was sind personenbezogene Daten?", en: "What counts as personal data?" },
          choices: [
            { de: "Informationen über eine identifizierte oder identifizierbare Person", en: "Information about an identified or identifiable person" },
            { de: "Anonyme Statistiken", en: "Anonymous statistics" },
            { de: "Nur medizinische Daten", en: "Only medical data" },
          ],
          a: 0,
          explanation: {
            de: "Personenbezogene Daten sind alle Infos, mit denen man dich direkt oder indirekt identifizieren kann.",
            en: "Personal data is any information that can identify you directly or indirectly.",
          },
          wusstest: {
            de: "Auch Online-Kennungen (Cookies/IDs) können personenbezogen sein, wenn sie dich identifizierbar machen.",
            en: "Online identifiers (cookies/IDs) can also be personal data if they make you identifiable.",
          },
          source: {
            label: "GDPR Art. 4 – Definitions (personal data)",
            url: "https://gdpr-info.eu/art-4-gdpr/"
          },
          image: "",
          explanationImage: "",
        },

        {
          id: "p1_q02",
          type: "truefalse",
          q: { de: "Eine IP-Adresse kann personenbezogen sein.", en: "An IP address can be personal data." },
          a: true,
          explanation: {
            de: "Wenn eine IP einem Anschluss oder Nutzer zugeordnet werden kann, ist sie personenbezogen.",
            en: "If an IP can be linked to a subscriber/user, it can be personal data.",
          },
          wusstest: {
            de: "„IP = anonym“ ist ein Mythos. Provider-Logs können Zuordnung ermöglichen.",
            en: "“IP = anonymous” is a myth. ISP logs can enable linking.",
          },
          source: {
            label: "GDPR Art. 4 – Definitions (personal data)",
            url: "https://gdpr-info.eu/art-4-gdpr/"
          },
          image: "",
          explanationImage: "",
        },

        {
          id: "p1_q03",
          type: "mc",
          q: { de: "Welches Prinzip bedeutet: nur wirklich nötige Daten sammeln?", en: "Which principle means collecting only necessary data?" },
          choices: [
            { de: "Datenminimierung", en: "Data minimisation" },
            { de: "Datenhandel", en: "Data trading" },
            { de: "Vorratsdatenspeicherung", en: "Mass retention" },
          ],
          a: 0,
          explanation: {
            de: "Datenminimierung heißt: so wenig wie möglich, so viel wie nötig.",
            en: "Data minimisation means: as little as possible, as much as necessary.",
          },
          wusstest: {
            de: "Auch Formularfelder: Wenn’s nicht gebraucht wird, sollte es nicht Pflicht sein.",
            en: "Also forms: if it’s not needed, it shouldn’t be required.",
          },
          source: {
            label: "GDPR/DSGVO Art. 5(1)(c)",
            url: "https://gdpr-info.eu/art-5-gdpr/"
          },
          image: "",
          explanationImage: "",
        },

        {
          id: "p1_q04",
          type: "mc",
          q: { de: "Wann ist Datenverarbeitung erlaubt?", en: "When is data processing allowed?" },
          choices: [
            { de: "Wenn es eine Rechtsgrundlage gibt (z. B. Einwilligung, Vertrag)", en: "When there is a legal basis (e.g., consent, contract)" },
            { de: "Immer, wenn ein Dienst kostenlos ist", en: "Always if a service is free" },
            { de: "Nur bei Behörden", en: "Only for public authorities" },
          ],
          a: 0,
          explanation: {
            de: "Es braucht eine gültige Rechtsgrundlage – nicht nur „weil wir’s wollen“.",
            en: "A valid legal basis is required — not just “because we want to”.",
          },
          wusstest: {
            de: "Einwilligung muss freiwillig sein und darf nicht erzwungen werden.",
            en: "Consent must be freely given and not forced.",
          },
          source: {
            label: "GDPR/DSGVO Art. 6",
            url: "https://gdpr-info.eu/art-6-gdpr/"
          },
          image: "",
          explanationImage: "",
        },

        {
          id: "p1_q05",
          type: "mc",
          q: { de: "Welches Recht erlaubt dir Einblick in deine gespeicherten Daten?", en: "Which right lets you access your stored data?" },
          choices: [
            { de: "Recht auf Auskunft", en: "Right of access" },
            { de: "Urheberrecht", en: "Copyright" },
            { de: "Hausrecht", en: "Property rights" },
          ],
          a: 0,
          explanation: {
            de: "Du darfst wissen, welche Daten gespeichert sind, wofür und an wen sie gehen.",
            en: "You can ask what data is stored, why, and who it’s shared with.",
          },
          wusstest: {
            de: "Du kannst oft auch eine Kopie der Daten verlangen.",
            en: "You can often request a copy of your data as well.",
          },
          source: {
            label: "GDPR/DSGVO Art. 15",
            url: "https://gdpr-info.eu/art-15-gdpr/"
          },
          image: "",
          explanationImage: "",
        },

        {
          id: "p1_q06",
          type: "scenario",
          q: { de: "Eine Taschenlampen-App möchte Zugriff auf deine Kontakte. Was tust du?", en: "A flashlight app asks for access to your contacts. What do you do?" },
          choices: [
            { de: "Erlauben – wird schon nötig sein", en: "Allow — it must be necessary" },
            { de: "Ablehnen und prüfen, ob die App ohne funktioniert", en: "Deny and check if the app works without it" },
            { de: "Erlauben und später vergessen", en: "Allow and forget later" },
          ],
          a: 1,
          explanation: {
            de: "Kontakte sind sensibel. Eine Taschenlampe braucht sie normalerweise nicht. Erst prüfen, dann entscheiden.",
            en: "Contacts are sensitive. A flashlight app usually doesn’t need them. Verify before granting.",
          },
          wusstest: {
            de: "Berechtigungen kannst du jederzeit in den Einstellungen entziehen.",
            en: "You can revoke permissions anytime in settings.",
          },
          source: {
            label: "GDPR Principles (Data minimisation), app permissions best practice",
            url: "https://rm.coe.int/16809382f9"
          },
          image: "",
          explanationImage: "",
        },

        {
          id: "p1_q07",
          type: "scenario",
          q: { de: "Eine Website verlangt Geburtstag + Adresse „ohne Grund“. Was ist am sinnvollsten?", en: "A website asks for birthdate + address “for no reason”. What’s best?" },
          choices: [
            { de: "Alles eingeben, sonst klappt’s nicht", en: "Enter everything or it won’t work" },
            { de: "Nur nötige Felder / Alternative suchen", en: "Fill only necessary fields / find an alternative" },
            { de: "Fake-Daten eingeben, egal", en: "Enter fake data, whatever" },
          ],
          a: 1,
          explanation: {
            de: "Wenn Daten nicht nötig sind, gib sie nicht heraus. Nutze Alternativen oder lass optionale Felder leer.",
            en: "If data isn’t necessary, don’t provide it. Use alternatives or skip optional fields.",
          },
          wusstest: {
            de: "Fake-Daten können später Probleme machen (z. B. Konto-Wiederherstellung).",
            en: "Fake data can backfire later (e.g., account recovery).",
          },
          source: {
            label: "GDPR/DSGVO Art. 5(1)(c)",
            url: "https://gdpr-info.eu/art-5-gdpr/"
          },
          image: "",
          explanationImage: "",
        },

        {
          id: "p1_q08",
          type: "truefalse",
          q: { de: "Du kannst deine Einwilligung jederzeit widerrufen.", en: "You can withdraw consent at any time." },
          a: true,
          explanation: {
            de: "Einwilligung muss widerrufbar sein – und der Widerruf sollte einfach sein.",
            en: "Consent must be withdrawable — and withdrawal should be easy.",
          },
          wusstest: {
            de: "Widerruf stoppt Verarbeitung auf Einwilligungsbasis, aber nicht immer jede Speicherung (z. B. gesetzliche Pflicht).",
            en: "Withdrawal stops consent-based processing, but not always all storage (e.g., legal duties).",
          },
          source: {
            label: "GDPR/DSGVO Art. 7(3)",
            url: "https://gdpr-info.eu/art-7-gdpr/"
          },
          image: "",
          explanationImage: "",
        },

        {
          id: "p1_q09",
          type: "mc",
          q: { de: "Was bedeutet „Privacy by Design“?", en: "What does “Privacy by Design” mean?" },
          choices: [
            { de: "Datenschutz wird von Anfang an eingebaut", en: "Privacy is built in from the start" },
            { de: "Datenschutz ist optional", en: "Privacy is optional" },
            { de: "Datenschutz gilt nur für große Firmen", en: "Privacy applies only to big companies" },
          ],
          a: 0,
          explanation: {
            de: "Datenschutz soll nicht nachträglich geflickt werden, sondern von Beginn an mitgeplant sein.",
            en: "Privacy shouldn’t be patched later — it should be planned from the beginning.",
          },
          wusstest: {
            de: "„Privacy by Default“: sichere Standard-Einstellungen.",
            en: "“Privacy by Default”: safe default settings.",
          },
          source: {
            label: "GDPR/DSGVO Art. 25",
            url: "https://gdpr-info.eu/art-25-gdpr/"
          },
          image: "",
          explanationImage: "",
        },

        {
          id: "p1_q10",
          type: "mc",
          q: { de: "Welches Recht beschreibt: Daten löschen lassen, wenn kein Grund mehr besteht?", en: "Which right allows deletion when no longer needed?" },
          choices: [
            { de: "Recht auf Löschung", en: "Right to erasure" },
            { de: "Recht auf Werbung", en: "Right to advertising" },
            { de: "Recht auf Zensur", en: "Right to censorship" },
          ],
          a: 0,
          explanation: {
            de: "Unter bestimmten Bedingungen kannst du Löschung verlangen (z. B. wenn Daten nicht mehr nötig sind).",
            en: "Under certain conditions you can request deletion (e.g., data no longer necessary).",
          },
          wusstest: {
            de: "Es gibt Ausnahmen (z. B. gesetzliche Aufbewahrungspflichten).",
            en: "There are exceptions (e.g., legal retention obligations).",
          },
          source: {
            label: "GDPR/DSGVO Art. 17",
            url: "https://gdpr-info.eu/art-17-gdpr/"
          },
          image: "",
          explanationImage: "",
        },

        {
          id: "p1_q11",
          type: "scenario",
          q: { de: "Du willst ein Konto löschen, aber der Weg ist versteckt/kompliziert. Was ist das oft?", en: "You want to delete an account but it’s hidden/complicated. Often this is…" },
          choices: [
            { de: "Guter Service", en: "Good service" },
            { de: "Dark Pattern (manipulative Gestaltung)", en: "Dark pattern (manipulative design)" },
            { de: "Pflicht wegen Sicherheit", en: "Required for security" },
          ],
          a: 1,
          explanation: {
            de: "Wenn es absichtlich schwer gemacht wird, ist es oft ein Dark Pattern (Opt-out/Kündigung verstecken).",
            en: "If it’s intentionally hard, it’s often a dark pattern (hiding opt-out/cancel).",
          },
          wusstest: {
            de: "Fair: Opt-out sollte ähnlich leicht sein wie Opt-in.",
            en: "Fair: opting out should be as easy as opting in.",
          },
          source: {
            label: "UX ethics / dark patterns (general)",
            url: "https://www.edpb.europa.eu/system/files/2022-03/edpb_03-2022_guidelines_on_dark_patterns_in_social_media_platform_interfaces_en.pdf"
          },
          image: "",
          explanationImage: "",
        },

        {
          id: "p1_q12",
          type: "mc",
          q: { de: "Was bedeutet „Zweckbindung“?", en: "What does “purpose limitation” mean?" },
          choices: [
            { de: "Daten nur für den angegebenen Zweck verwenden", en: "Use data only for the stated purpose" },
            { de: "Daten für alles nutzen, wenn sie einmal da sind", en: "Use data for anything once collected" },
            { de: "Daten nur offline speichern", en: "Store data only offline" },
          ],
          a: 0,
          explanation: {
            de: "Daten dürfen nicht einfach zweckentfremdet werden, ohne passende Grundlage.",
            en: "Data shouldn’t be repurposed without an appropriate basis.",
          },
          wusstest: {
            de: "Wenn der Zweck sich ändert, braucht es oft neue Info/Einwilligung.",
            en: "If purpose changes, you often need new notice/consent.",
          },
          source: {
            label: "GDPR/DSGVO Art. 5(1)(b)",
            url: "https://gdpr-info.eu/art-5-gdpr/"
          },
          image: "",
          explanationImage: "",
        },

        {
          id: "p1_q13",
          type: "truefalse",
          q: { de: "Datenschutzinfos müssen klar und verständlich sein.", en: "Privacy information must be clear and understandable." },
          a: true,
          explanation: {
            de: "Transparenz: Infos sollen leicht zugänglich und in klarer Sprache sein.",
            en: "Transparency: information should be accessible and in clear language.",
          },
          wusstest: {
            de: "Absichtlich verwirrte Texte = Red Flag.",
            en: "Intentionally confusing texts are a red flag.",
          },
          source: {
            label: "GDPR/DSGVO Art. 12",
            url: "https://gdpr-info.eu/art-12-gdpr/"
          },
          image: "",
          explanationImage: "",
        },

        {
          id: "p1_q14",
          type: "mc",
          q: { de: "Was ist „Datenübertragbarkeit“?", en: "What is “data portability”?" },
          choices: [
            { de: "Daten in nutzbarem Format bekommen und mitnehmen", en: "Get data in a usable format and move it" },
            { de: "Daten öffentlich teilen müssen", en: "Having to share data publicly" },
            { de: "Daten nie exportieren dürfen", en: "Never being allowed to export data" },
          ],
          a: 0,
          explanation: {
            de: "Du kannst bestimmte Daten in einem gängigen Format erhalten (und ggf. übertragen).",
            en: "You can receive certain data in a common format (and possibly transfer it).",
          },
          wusstest: {
            de: "Hilft gegen Lock-in: Anbieterwechsel wird leichter.",
            en: "Reduces lock-in: switching providers becomes easier.",
          },
          source: {
            label: "GDPR/DSGVO Art. 20",
            url: "https://gdpr-info.eu/art-20-gdpr/"
          },
          image: "",
          explanationImage: "",
        },

        {
          id: "p1_q15",
          type: "scenario",
          q: { de: "Mail: „Wir hatten eine Datenpanne. Ändere sofort dein Passwort.“ Was ist sicher?", en: "Email: “We had a breach. Change your password now.” What’s safest?" },
          choices: [
            { de: "Link in der Mail klicken", en: "Click the email link" },
            { de: "Website/App direkt öffnen (nicht über Link)", en: "Open the site/app directly (not via link)" },
            { de: "Ignorieren", en: "Ignore it" },
          ],
          a: 1,
          explanation: {
            de: "Mails können gefälscht sein. Nutze direkten Weg (App/URL) statt Link.",
            en: "Emails can be spoofed. Use direct paths (app/typed URL) instead of links.",
          },
          wusstest: {
            de: "Wenn du Passwort wiederverwendest: überall ändern.",
            en: "If you reused the password: change it everywhere.",
          },
          source: {
            label: "Security best practice (anti-phishing)",
            url: "https://www.bsi.bund.de/DE/Themen/Verbraucherinnen-und-Verbraucher/Cyber-Sicherheitslage/Methoden-der-Cyber-Kriminalitaet/Spam-Phishing-Co/Passwortdiebstahl-durch-Phishing/Wie-erkenne-ich-Phishing-in-E-Mails-und-auf-Webseiten/wie-erkenne-ich-phishing-in-e-mails-und-auf-webseiten_node.html"
          },
          image: "",
          explanationImage: "",
        },

        {
          id: "p1_q16",
          type: "mc",
          q: { de: "Was bedeutet „Integrität & Vertraulichkeit“?", en: "What does “integrity & confidentiality” mean?" },
          choices: [
            { de: "Daten müssen angemessen geschützt werden", en: "Data must be protected appropriately" },
            { de: "Daten dürfen frei herumliegen", en: "Data can be left unprotected" },
            { de: "Daten sind nur Marketing-Sache", en: "Data is just marketing" },
          ],
          a: 0,
          explanation: {
            de: "Schutz vor unbefugtem Zugriff, Verlust oder Manipulation.",
            en: "Protection against unauthorized access, loss, or tampering.",
          },
          wusstest: {
            de: "Das umfasst technische UND organisatorische Maßnahmen.",
            en: "This includes technical AND organizational measures.",
          },
          source: {
            label: "GDPR/DSGVO Art. 5(1)(f), Art. 32",
            url: "https://gdpr-info.eu/art-5-gdpr/"
          },
          image: "",
          explanationImage: "",
        },

        {
          id: "p1_q17",
          type: "truefalse",
          q: { de: "Wenn du etwas öffentlich postest, ist es automatisch risikolos.", en: "If you post something publicly, it’s automatically risk-free." },
          a: false,
          explanation: {
            de: "Öffentliche Infos können für Profiling, Scams oder Doxxing missbraucht werden.",
            en: "Public data can be misused for profiling, scams, or doxxing.",
          },
          wusstest: {
            de: "Privatsphäre ist auch Kontext: Freunde ≠ Öffentlichkeit.",
            en: "Privacy is contextual: friends ≠ the whole internet.",
          },
          source: {
            label: "Privacy fundamentals (contextual privacy)",
            url: "https://commission.europa.eu/law/law-topic/data-protection/data-protection-explained_en"
          },
          image: "",
          explanationImage: "",
        },

        {
          id: "p1_q18",
          type: "scenario",
          q: { de: "Eine Freundin will ein Foto von dir posten. Du willst das nicht. Was ist fair?", en: "A friend wants to post a photo of you. You don’t want that. What’s fair?" },
          choices: [
            { de: "Nichts sagen", en: "Say nothing" },
            { de: "Sagen, dass du das nicht willst und um Nicht-Posten bitten", en: "Say you’re not okay with it and ask them not to post" },
            { de: "Sofort blockieren", en: "Block immediately" },
          ],
          a: 1,
          explanation: {
            de: "Einverständnis + Kommunikation ist der beste erste Schritt.",
            en: "Consent + communication is the best first step.",
          },
          wusstest: {
            de: "Gute digitale Kultur: erst fragen, dann posten.",
            en: "Good digital culture: ask before posting.",
          },
          source: {
            label: "Digital etiquette / consent basics",
            url: "https://rm.coe.int/16809382f9"
          },
          image: "",
          explanationImage: "",
        },

        {
          id: "p1_q19",
          type: "mc",
          q: { de: "Welche Info ist am riskantesten zu teilen?", en: "Which info is riskiest to share?" },
          choices: [
            { de: "Voller Name + Geburtsdatum + Adresse", en: "Full name + birthdate + address" },
            { de: "Lieblingsfilm", en: "Favorite movie" },
            { de: "Hobby", en: "Hobby" },
          ],
          a: 0,
          explanation: {
            de: "Kombis aus Identitätsdaten erleichtern Identitätsdiebstahl.",
            en: "Combining identity data makes identity theft easier.",
          },
          wusstest: {
            de: "Mosaik-Effekt: kleine Infos zusammen werden gefährlich.",
            en: "Mosaic effect: small bits combined become risky.",
          },
          source: {
            label: "Privacy/security awareness (general)",
            url: "https://commission.europa.eu/law/law-topic/data-protection/data-protection-explained_en"
          },
          image: "",
          explanationImage: "",
        },

        {
          id: "p1_q20",
          type: "truefalse",
          q: { de: "Standortdaten können Routinen sichtbar machen.", en: "Location data can reveal routines." },
          a: true,
          explanation: {
            de: "Standorte können Wohnort, Schule/Job, Zeiten und Gewohnheiten zeigen.",
            en: "Locations can reveal home, school/work, times, and habits.",
          },
          wusstest: {
            de: "Nutze ungefähren Standort oder teile nur mit vertrauten Personen.",
            en: "Use approximate location or share only with trusted people.",
          },
          source: {
            label: "Privacy awareness (location risks)",
            url: "https://commission.europa.eu/law/law-topic/data-protection/data-protection-explained_en"
          },
          image: "",
          explanationImage: "",
        },

        {
          id: "p1_q21",
          type: "mc",
          q: { de: "Was ist datenschutzfreundlicher?", en: "What is more privacy-friendly?" },
          choices: [
            { de: "Alles öffentlich, damit’s einfacher ist", en: "Everything public for convenience" },
            { de: "Private Defaults + gezielt freigeben", en: "Private defaults + share intentionally" },
            { de: "Passwort im Profil speichern", en: "Store password in profile" },
          ],
          a: 1,
          explanation: {
            de: "Sichere Standard-Einstellungen reduzieren Risiko; später kannst du bewusst teilen.",
            en: "Safe defaults reduce risk; you can intentionally share later.",
          },
          wusstest: {
            de: "„Privacy by Default“ ist ein Grundprinzip guter Produkte.",
            en: "“Privacy by Default” is a core principle of good products.",
          },
          source: {
            label: "GDPR/DSGVO Art. 25",
            url: "https://gdpr-info.eu/art-25-gdpr/"
          },
          image: "",
          explanationImage: "",
        },

        {
          id: "p1_q22",
          type: "scenario",
          q: { de: "Ein Gewinnspiel will viele Daten. Was ist klug?", en: "A giveaway asks for lots of data. What’s smart?" },
          choices: [
            { de: "Alles geben – sonst kein Gewinn", en: "Give everything — otherwise no win" },
            { de: "Anbieter/Impressum prüfen, Pflichtfelder hinterfragen, ggf. nicht teilnehmen", en: "Check provider/imprint, question required fields, maybe skip" },
            { de: "Daten in Kommentare posten", en: "Post data in comments" },
          ],
          a: 1,
          explanation: {
            de: "Viele Gewinnspiele sind Datensammler. Prüfe Seriosität und Notwendigkeit.",
            en: "Many giveaways are data harvesters. Check legitimacy and necessity.",
          },
          wusstest: {
            de: "Wenn du den Zweck nicht verstehst: lieber lassen.",
            en: "If you don’t understand the purpose: better skip it.",
          },
          source: {
            label: "Consumer privacy best practice (general)",
            url: "https://commission.europa.eu/law/law-topic/data-protection/data-protection-explained_en"
          },
          image: "",
          explanationImage: "",
        },

        {
          id: "p1_q23",
          type: "mc",
          q: { de: "Welche Cookie-Banner-Gestaltung ist eine Red Flag?", en: "Which cookie banner design is a red flag?" },
          choices: [
            { de: "„Alles akzeptieren“ riesig, „Ablehnen“ versteckt", en: "Huge “Accept all”, hidden “Reject”" },
            { de: "Gleichwertige Buttons (Akzeptieren/Ablehnen)", en: "Equal choices (Accept/Reject)" },
            { de: "Klare Zwecke/Details", en: "Clear purposes/details" },
          ],
          a: 0,
          explanation: {
            de: "Verstecktes Ablehnen ist manipulative Gestaltung (Dark Pattern).",
            en: "Hiding rejection is manipulative design (dark pattern).",
          },
          wusstest: {
            de: "Fair: Ablehnen sollte genauso leicht sein wie Akzeptieren.",
            en: "Fair: rejecting should be as easy as accepting.",
          },
          source: {
            label: "Consent UX / dark patterns (general)",
            url: "https://www.edpb.europa.eu/system/files/2022-03/edpb_03-2022_guidelines_on_dark_patterns_in_social_media_platform_interfaces_en.pdf"
          },
          image: "",
          explanationImage: "",
        },

        {
          id: "p1_q24",
          type: "truefalse",
          q: { de: "Ein Datenleck ist nur wichtig, wenn Passwörter betroffen sind.", en: "A breach only matters if passwords are leaked." },
          a: false,
          explanation: {
            de: "Auch E-Mail/Adresse/Telefon können für Scams oder Identitätsbetrug genutzt werden.",
            en: "Email/address/phone can also be used for scams or identity fraud.",
          },
          wusstest: {
            de: "Nach Leaks: Vorsicht bei „Support“-Anrufen/Mails (Social Engineering).",
            en: "After breaches: beware of fake “support” calls/emails (social engineering).",
          },
          source: {
            label: "Security awareness (post-breach threats)",
            url: "https://www.enisa.europa.eu/topics/cyber-hygiene"
          },
          image: "",
          explanationImage: "",
        },

        {
          id: "p1_q25",
          type: "mc",
          q: { de: "Was ist ein Beispiel für sensible Daten?", en: "Which is an example of sensitive data?" },
          choices: [
            { de: "Gesundheitsdaten", en: "Health data" },
            { de: "Lieblingsfarbe", en: "Favorite color" },
            { de: "Lieblingspizza", en: "Favorite pizza" },
          ],
          a: 0,
          explanation: {
            de: "Bestimmte Datenkategorien (z. B. Gesundheit) sind besonders schützenswert.",
            en: "Certain categories (e.g., health) are especially protected.",
          },
          wusstest: {
            de: "Sensible Daten brauchen meist strengere Bedingungen zur Verarbeitung.",
            en: "Sensitive data typically requires stricter processing conditions.",
          },
          source: {
            label: "GDPR/DSGVO Art. 9",
            url: "https://gdpr-info.eu/art-9-gdpr/"
          },
          image: "",
          explanationImage: "",
        },

        {
          id: "p1_q26",
          type: "mc",
          q: { de: "Du sollst ein Formular ausfüllen. Es fragt nach „Religion“. Ist das normal?", en: "A form asks for your “religion”. Is that normal?" },
          choices: [
            { de: "Ja, immer", en: "Yes, always" },
            { de: "Nur, wenn es wirklich nötig ist und klar begründet", en: "Only if truly necessary and clearly justified" },
            { de: "Egal, einfach ausfüllen", en: "Whatever, just fill it" },
          ],
          a: 1,
          explanation: {
            de: "Religion zählt zu sensiblen Daten. Abfrage braucht starke Begründung/Rechtsgrundlage.",
            en: "Religion is sensitive data. Collection needs strong justification/legal basis.",
          },
          wusstest: {
            de: "Wenn du den Zweck nicht verstehst: nachfragen oder Alternative wählen.",
            en: "If you don’t understand why: ask or choose an alternative.",
          },
          source: {
            label: "GDPR/DSGVO Art. 9",
            url: "https://gdpr-info.eu/art-9-gdpr/"
          },
          image: "",
          explanationImage: "",
        },

        {
          id: "p1_q27",
          type: "truefalse",
          q: { de: "Du hast ein Recht darauf, fehlerhafte Daten korrigieren zu lassen.", en: "You have the right to correct inaccurate data." },
          a: true,
          explanation: {
            de: "Wenn Daten über dich falsch sind, kannst du Berichtigung verlangen.",
            en: "If data about you is wrong, you can request correction.",
          },
          wusstest: {
            de: "Das ist wichtig z. B. bei Scoring/Profilen.",
            en: "Important for scoring/profiles, too.",
          },
          source: {
            label: "GDPR/DSGVO Art. 16",
            url: "https://gdpr-info.eu/art-16-gdpr/"
          },
          image: "",
          explanationImage: "",
        },

        {
          id: "p1_q28",
          type: "mc",
          q: { de: "Was ist „Profiling“?", en: "What is “profiling”?" },
          choices: [
            { de: "Automatisierte Auswertung, um Eigenschaften/Interessen vorherzusagen", en: "Automated analysis to predict traits/interests" },
            { de: "Ein Passwort ändern", en: "Changing a password" },
            { de: "Daten löschen", en: "Deleting data" },
          ],
          a: 0,
          explanation: {
            de: "Profiling nutzt Daten, um Muster zu erkennen und Verhalten/Interessen zu schätzen.",
            en: "Profiling uses data to detect patterns and infer behavior/interests.",
          },
          wusstest: {
            de: "Profiling ist oft Basis für personalisierte Werbung — oder Risiko bei unfairen Entscheidungen.",
            en: "Profiling powers personalization — and can risk unfair decisions.",
          },
          source: {
            label: "GDPR/DSGVO Art. 4 (Profiling), principles",
            url: "https://gdpr-info.eu/art-4-gdpr/"
          },
          image: "",
          explanationImage: "",
        },

        {
          id: "p1_q29",
          type: "scenario",
          q: { de: "Eine App will Zugriff auf Mikrofon „immer“. Du nutzt nur Sprachnachrichten. Was ist sinnvoll?", en: "An app wants microphone access “always”. You only use voice messages. Best?" },
          choices: [
            { de: "Immer erlauben", en: "Allow always" },
            { de: "Nur beim Verwenden erlauben", en: "Allow only while using" },
            { de: "Mikrofon aus, App löschen", en: "Disable mic, delete app immediately" },
          ],
          a: 1,
          explanation: {
            de: "„Nur beim Verwenden“ reduziert Risiko, wenn Dauerzugriff nicht nötig ist.",
            en: "“Only while using” reduces risk if constant access isn’t required.",
          },
          wusstest: {
            de: "Viele OS bieten granulare Rechte: nutzen!",
            en: "Modern OS permissions are granular — use them.",
          },
          source: {
            label: "Privacy best practice (permissions)",
            url: "https://commission.europa.eu/law/law-topic/data-protection/data-protection-explained_en"
          },
          image: "",
          explanationImage: "",
        },
      ],
    },

    2: {
      title: { de: "Sicherheit im Netz", en: "Online Security" },
      summary: (ratio) => {
        if (ratio >= 0.8) {
          return {
            de: { title: "🔐 Security-Instinkt: ON!", text: "Du erkennst Betrugsmuster super schnell. Mega!" },
            en: { title: "🔐 Security instincts: ON!", text: "You spot scam patterns super fast. Awesome!" },
          };
        }
        if (ratio >= 0.5) {
          return {
            de: { title: "🚦Gute Warnsignale!", text: "Du erkennst vieles — mit ein paar Routinen wirst du noch sicherer." },
            en: { title: "🚦Good warning signals!", text: "You catch many red flags — a few habits will make you even safer." },
          };
        }
        return {
          de: { title: "🧠 Lernmodus aktiv!", text: "Sicherheit ist Übungssache. Du baust gerade starke Schutzreflexe auf." },
          en: { title: "🧠 Learning mode on!", text: "Security is practice. You’re building strong protective reflexes." },
        };
      },
      questions: [
        {
          id: "s2_q01",
          type: "mc",
          q: { de: "Was ist Phishing?", en: "What is phishing?" },
          choices: [
            { de: "Betrugsversuche mit gefälschten Nachrichten", en: "Scams using fake messages" },
            { de: "Ein Verschlüsselungsverfahren", en: "An encryption method" },
            { de: "Ein Antivirus", en: "An antivirus" },
          ],
          a: 0,
          explanation: {
            de: "Phishing will dich auf Fake-Seiten locken oder zu Handlungen drängen, um Daten zu stehlen.",
            en: "Phishing tricks you into fake sites/actions to steal data.",
          },
          wusstest: {
            de: "Phishing gibt’s auch per SMS (Smishing) und Telefon (Vishing).",
            en: "Phishing also happens via SMS (smishing) and calls (vishing).",
          },
          source: {
            label: "BSI / ENISA (phishing guidance)",
            url: "https://www.bsi.bund.de/DE/Themen/Verbraucherinnen-und-Verbraucher/Cyber-Sicherheitslage/Methoden-der-Cyber-Kriminalitaet/Spam-Phishing-Co/Passwortdiebstahl-durch-Phishing/Wie-erkenne-ich-Phishing-in-E-Mails-und-auf-Webseiten/wie-erkenne-ich-phishing-in-e-mails-und-auf-webseiten_node.html"
          },
          image: "",
          explanationImage: "",
        },

        {
          id: "s2_q02",
          type: "scenario",
          q: { de: "Du erhältst diese E-Mail. Echt oder Phishing?", en: "You receive this email. Real or phishing?" },
          image: "../assets/images/paypal-phishing.png",
          choices: [{ de: "Echt", en: "Real" }, { de: "Phishing", en: "Phishing" }],
          a: 1,
          explanation: {
            de:
              "Sehr wahrscheinlich Phishing:\n• Druck/Angst\n• Unpersönliche Anrede\n• Verdächtiger Link\n• Unstimmiges Layout",
            en:
              "Very likely phishing:\n• Urgency/fear\n• Generic greeting\n• Suspicious link\n• Off layout",
          },
          wusstest: {
            de: "Sicher: App öffnen oder URL selbst tippen — nie über Mail-Button.",
            en: "Safer: open the app or type the URL — never via email button.",
          },
          source: {
            label: "BSI (phishing checklist)",
            url: "https://www.bsi.bund.de/DE/Themen/Verbraucherinnen-und-Verbraucher/Cyber-Sicherheitslage/Methoden-der-Cyber-Kriminalitaet/Spam-Phishing-Co/Passwortdiebstahl-durch-Phishing/Wie-erkenne-ich-Phishing-in-E-Mails-und-auf-Webseiten/wie-erkenne-ich-phishing-in-e-mails-und-auf-webseiten_node.html"
          },
          explanationImage: "../assets/images/paypal-phishing2.png",
        },

        // Alltag scenario: Fake login page
        {
          id: "s2_q03",
          type: "scenario",
          q: {
            de: "Du landest auf einer „Login“-Seite, die leicht komisch aussieht. Was tust du?",
            en: "You land on a login page that looks slightly off. What do you do?",
          },
          image: "", // optionally add a screenshot: "../assets/images/fake-login.png"
          choices: [
            { de: "Passwort eingeben – wird schon passen", en: "Enter password — probably fine" },
            { de: "URL prüfen / schließen / direkt über App oder Bookmark öffnen", en: "Check URL / close / open via app or bookmark" },
            { de: "Passwort an Support mailen", en: "Email password to support" },
          ],
          a: 1,
          explanation: {
            de: "Fake-Login-Seiten sehen oft fast echt aus. Entscheidend ist die Domain (nicht nur das Design).",
            en: "Fake login pages can look real. The domain is the key signal (not only design).",
          },
          wusstest: {
            de: "HTTPS/Schloss ≠ echte Seite. Auch Phishing kann HTTPS haben.",
            en: "HTTPS/padlock ≠ legitimate site. Phishing can also use HTTPS.",
          },
          source: {
            label: "OWASP / security awareness (general)",
            url: "https://www.enisa.europa.eu/topics/cyber-hygiene"
          },
          explanationImage: "",
        },

        {
          id: "s2_q04",
          type: "mc",
          q: { de: "Warum ist Passwort-Wiederverwendung riskant?", en: "Why is password reuse risky?" },
          choices: [
            { de: "Ein Leak bei Dienst A gefährdet auch Dienst B", en: "A leak on service A endangers service B" },
            { de: "Es ist schneller beim Einloggen", en: "It’s faster to log in" },
            { de: "Es spart Speicherplatz", en: "It saves storage" },
          ],
          a: 0,
          explanation: {
            de: "Angreifer testen geleakte Logins auf vielen Seiten (Credential Stuffing).",
            en: "Attackers try leaked logins across many sites (credential stuffing).",
          },
          wusstest: {
            de: "Passwort-Manager = 1 starkes Master-Passwort + einzigartige Passwörter überall.",
            en: "Password manager = one strong master password + unique passwords everywhere.",
          },
          source: {
            label: "NIST SP 800-63B (password guidance), general security",
            url: "https://www.enisa.europa.eu/topics/cyber-hygiene"
          },
          image: "",
          explanationImage: "",
        },

        {
          id: "s2_q05",
          type: "truefalse",
          q: { de: "2FA (Zwei-Faktor) erhöht die Kontosicherheit.", en: "2FA increases account security." },
          a: true,
          explanation: {
            de: "2FA fügt eine zweite Hürde hinzu. Selbst bei Passwort-Leak bleibt das Konto besser geschützt.",
            en: "2FA adds a second barrier. Even if a password leaks, the account is better protected.",
          },
          wusstest: {
            de: "Authenticator-Apps sind oft sicherer als SMS.",
            en: "Authenticator apps are often safer than SMS.",
          },
          source: {
            label: "ENISA / BSI (2FA advice)",
            url: "https://www.enisa.europa.eu/topics/cyber-hygiene"
          },
          image: "",
          explanationImage: "",
        },

        {
          id: "s2_q06",
          type: "mc",
          q: { de: "Was ist Smishing?", en: "What is smishing?" },
          choices: [
            { de: "Phishing per SMS/Chat", en: "Phishing via SMS/messages" },
            { de: "Ein WLAN-Standard", en: "A Wi-Fi standard" },
            { de: "Ein Backup", en: "A backup" },
          ],
          a: 0,
          explanation: {
            de: "Smishing nutzt SMS/Chats, um dich zu Links oder Preisgabe von Daten zu verleiten.",
            en: "Smishing uses SMS/messages to push you to links or data disclosure.",
          },
          wusstest: {
            de: "Typisch: Paket-Benachrichtigung oder „Konto gesperrt“.",
            en: "Typical: parcel alerts or “account locked”.",
          },
          source: {
            label: "ENISA (threat awareness)",
            url: "https://www.enisa.europa.eu/topics/cyber-hygiene"
          },
          image: "",
          explanationImage: "",
        },

        {
          id: "s2_q07",
          type: "truefalse",
          q: { de: "Das Schloss-Symbol (HTTPS) garantiert, dass eine Seite echt ist.", en: "The padlock (HTTPS) guarantees a site is legitimate." },
          a: false,
          explanation: {
            de: "HTTPS schützt die Verbindung, nicht die Identität der Website. Fake-Seiten können HTTPS haben.",
            en: "HTTPS secures the connection, not the site’s legitimacy. Phishing sites can have HTTPS.",
          },
          wusstest: {
            de: "Achte auf die Domain: paypaI.com (i) vs paypal.com (l) ist ein Klassiker.",
            en: "Watch the domain: paypaI.com (i) vs paypal.com (l) is classic.",
          },
          source: {
            label: "Security awareness (HTTPS misconception)",
            url: "https://www.enisa.europa.eu/topics/cyber-hygiene"
          },
          image: "",
          explanationImage: "",
        },

        {
          id: "s2_q08",
          type: "mc",
          q: { de: "Welche Passwort-Option ist am stärksten?", en: "Which password is strongest?" },
          choices: [
            { de: "Sommer2026!", en: "Summer2026!" },
            { de: "P@ssw0rd", en: "P@ssw0rd" },
            { de: "Eine lange Passphrase mit mehreren Wörtern", en: "A long multi-word passphrase" },
          ],
          a: 2,
          explanation: {
            de: "Lange Passphrases sind oft stärker und leichter zu merken als kurze „komplexe“ Passwörter.",
            en: "Long passphrases are often stronger and easier than short “complex” passwords.",
          },
          wusstest: {
            de: "Noch besser: Passwort-Manager + zufällige Passwörter.",
            en: "Even better: password manager + random passwords.",
          },
          source: {
            label: "Council of Europe – Digital literacy & online safety",
            url: "https://rm.coe.int/16809382f9"
          },
          image: "",
          explanationImage: "",
        },

        {
          id: "s2_q09",
          type: "scenario",
          q: { de: "Öffentliches WLAN im Café: Was ist am sichersten?", en: "Public café Wi-Fi: what’s safest?" },
          choices: [
            { de: "Online-Banking ohne extra Schutz", en: "Online banking without extra protection" },
            { de: "VPN nutzen oder Hotspot verwenden", en: "Use a VPN or your mobile hotspot" },
            { de: "Passwörter in Notizen kopieren", en: "Copy passwords into notes" },
          ],
          a: 1,
          explanation: {
            de: "Öffentliche WLANs können unsicher sein. VPN oder eigener Hotspot reduziert Risiken.",
            en: "Public Wi-Fi can be risky. VPN or hotspot reduces exposure.",
          },
          wusstest: {
            de: "Auto-Connect deaktivieren, sonst verbindet sich dein Handy später wieder automatisch.",
            en: "Disable auto-connect so your phone won’t rejoin automatically.",
          },
          source: {
            label: "BSI (public Wi-Fi advice), general security",
            url: "https://www.bsi.bund.de/DE/Themen/Verbraucherinnen-und-Verbraucher/Informationen-und-Empfehlungen/Cyber-Sicherheitsempfehlungen/Router-WLAN-VPN/Sicherheitstipps-fuer-privates-und-oeffentliches-WLAN/sicherheitstipps-fuer-privates-und-oeffentliches-wlan_node.html"
          },
          image: "",
          explanationImage: "",
        },

        {
          id: "s2_q10",
          type: "scenario",
          q: { de: "Mail von „Chef“: „Bitte sofort 2.000€ überweisen.“ Was tust du?", en: "Email from “boss”: “Transfer €2,000 now.” What do you do?" },
          choices: [
            { de: "Sofort zahlen", en: "Pay immediately" },
            { de: "Rückruf über bekannte Nummer / zweite Bestätigung", en: "Call back using a known number / verify" },
            { de: "An alle weiterleiten", en: "Forward to everyone" },
          ],
          a: 1,
          explanation: {
            de: "CEO-Fraud/BEC: immer über sicheren Kanal verifizieren (Rückruf, internes Verfahren).",
            en: "CEO fraud/BEC: always verify via a trusted channel (call back, internal process).",
          },
          wusstest: {
            de: "Druck + Geheimhaltung + schnelle Zahlung = starke Red Flags.",
            en: "Urgency + secrecy + fast payment = major red flags.",
          },
          source: {
            label: "BSI (social engineering), BEC awareness (general)",
            url: "https://www.bsi.bund.de/DE/Themen/Unternehmen-und-Organisationen/Informationen-und-Empfehlungen/Empfehlungen-nach-Gefaehrdungen/Social-Engineering/social-engineering_node.html"
          },
          image: "",
          explanationImage: "",
        },

        {
          id: "s2_q11",
          type: "mc",
          q: { de: "Was ist Social Engineering?", en: "What is social engineering?" },
          choices: [
            { de: "Menschen manipulieren, um an Infos/Zugänge zu kommen", en: "Manipulating people to obtain info/access" },
            { de: "Ein Programmierstil", en: "A programming style" },
            { de: "Ein Antivirus-Scan", en: "An antivirus scan" },
          ],
          a: 0,
          explanation: {
            de: "Angriffe zielen oft auf Menschen (Druck, Angst, Autorität), nicht auf Technik.",
            en: "Attacks often target people (pressure, fear, authority), not just tech.",
          },
          wusstest: {
            de: "„Können Sie kurz…?“ + Zeitdruck ist ein typisches Muster.",
            en: "“Can you quickly…?” + urgency is a common pattern.",
          },
          source: {
            label: "BSI (social engineering) / general security",
            url: "https://www.bsi.bund.de/DE/Themen/Unternehmen-und-Organisationen/Informationen-und-Empfehlungen/Empfehlungen-nach-Gefaehrdungen/Social-Engineering/social-engineering_node.html"
          },
          image: "",
          explanationImage: "",
        },

        {
          id: "s2_q12",
          type: "truefalse",
          q: { de: "Updates sind wichtig, weil sie oft Sicherheitslücken schließen.", en: "Updates are important because they often fix security vulnerabilities." },
          a: true,
          explanation: {
            de: "Updates patchen bekannte Schwachstellen, die sonst ausgenutzt werden können.",
            en: "Updates patch known weaknesses that could otherwise be exploited.",
          },
          wusstest: {
            de: "Automatische Updates sparen Zeit und erhöhen Sicherheit.",
            en: "Automatic updates save time and improve security.",
          },
          source: {
            label: "General security hygiene (patching)",
            url: "https://www.enisa.europa.eu/topics/cyber-hygiene"
          },
          image: "",
          explanationImage: "",
        },

        {
          id: "s2_q13",
          type: "mc",
          q: { de: "Was ist ein sicherer Umgang mit Links in Mails?", en: "What’s a safe way to handle links in emails?" },
          choices: [
            { de: "Links blind anklicken", en: "Click blindly" },
            { de: "URL prüfen / Service direkt öffnen statt klicken", en: "Check URL / open service directly instead of clicking" },
            { de: "Link an Freunde schicken", en: "Send link to friends" },
          ],
          a: 1,
          explanation: {
            de: "Direkt öffnen (App/Bookmark) reduziert das Risiko, auf Fake-Seiten zu landen.",
            en: "Opening directly (app/bookmark) reduces the risk of landing on fake sites.",
          },
          wusstest: {
            de: "Hover über Link zeigt oft die echte Zieladresse (Desktop).",
            en: "Hovering a link often reveals the real destination (desktop).",
          },
          source: {
            label: "Anti-phishing best practice",
            url: "https://www.bsi.bund.de/DE/Themen/Verbraucherinnen-und-Verbraucher/Cyber-Sicherheitslage/Methoden-der-Cyber-Kriminalitaet/Spam-Phishing-Co/Passwortdiebstahl-durch-Phishing/Wie-erkenne-ich-Phishing-in-E-Mails-und-auf-Webseiten/wie-erkenne-ich-phishing-in-e-mails-und-auf-webseiten_node.html"
          },
          image: "",
          explanationImage: "",
        },

        {
          id: "s2_q14",
          type: "scenario",
          q: { de: "Du bekommst einen SMS-Code, obwohl du dich nirgendwo eingeloggt hast. Was bedeutet das?", en: "You receive an SMS code although you didn’t log in. What does it mean?" },
          choices: [
            { de: "Alles okay", en: "All good" },
            { de: "Jemand versucht sich einzuloggen – sofort Passwort ändern", en: "Someone may be trying to log in — change password immediately" },
            { de: "Code posten, damit andere helfen", en: "Post the code so others can help" },
          ],
          a: 1,
          explanation: {
            de: "Das kann ein Login-Versuch sein. Passwort ändern und Security-Check machen.",
            en: "This can indicate a login attempt. Change password and review security.",
          },
          wusstest: {
            de: "Codes sind wie Schlüssel: niemals weitergeben.",
            en: "Codes are like keys: never share them.",
          },
          source: {
            label: "Account security best practice",
            url: "https://www.enisa.europa.eu/topics/cyber-hygiene"
          },
          image: "",
          explanationImage: "",
        },

        {
          id: "s2_q15",
          type: "truefalse",
          q: { de: "Ein Passwort-Manager kann Sicherheit erhöhen.", en: "A password manager can increase security." },
          a: true,
          explanation: {
            de: "Er hilft, einzigartige starke Passwörter zu nutzen, ohne sie zu merken.",
            en: "It helps you use unique strong passwords without memorizing them.",
          },
          wusstest: {
            de: "Aktiviere 2FA auch für den Passwort-Manager selbst.",
            en: "Enable 2FA for the password manager itself.",
          },
          source: {
            label: "NIST guidance (general), security best practice",
            url: "https://www.enisa.europa.eu/topics/cyber-hygiene"
          },
          image: "",
          explanationImage: "",
        },

        {
          id: "s2_q16",
          type: "mc",
          q: { de: "Was ist ein guter Hinweis auf eine Fake-Mail?", en: "What’s a common sign of a fake email?" },
          choices: [
            { de: "Druck („sofort handeln!“) + Drohungen", en: "Urgency (“act now!”) + threats" },
            { de: "Korrekte Ansprache mit vollem Namen", en: "Correct greeting with your full name" },
            { de: "Kein Link enthalten", en: "No link included" },
          ],
          a: 0,
          explanation: {
            de: "Phishing arbeitet oft mit Stress, Angst oder Zeitdruck, damit du nicht nachdenkst.",
            en: "Phishing often uses stress or urgency so you don’t think.",
          },
          wusstest: {
            de: "Auch echte Firmen setzen selten „24h sonst…“. Das ist verdächtig.",
            en: "Legit companies rarely do “24h or else…”. That’s suspicious.",
          },
          source: {
            label: "BSI (phishing indicators)",
            url: "https://www.bsi.bund.de/DE/Themen/Verbraucherinnen-und-Verbraucher/Cyber-Sicherheitslage/Methoden-der-Cyber-Kriminalitaet/Spam-Phishing-Co/Passwortdiebstahl-durch-Phishing/Wie-erkenne-ich-Phishing-in-E-Mails-und-auf-Webseiten/wie-erkenne-ich-phishing-in-e-mails-und-auf-webseiten_node.html"
          },
          image: "",
          explanationImage: "",
        },

        {
          id: "s2_q17",
          type: "scenario",
          q: { de: "Du nutzt dasselbe Passwort überall. Was ist die beste Verbesserung?", en: "You use the same password everywhere. Best improvement?" },
          choices: [
            { de: "Passwort nur minimal ändern (…1, …2)", en: "Slightly change it (…1, …2)" },
            { de: "Passwort-Manager + überall einzigartige Passwörter", en: "Password manager + unique passwords everywhere" },
            { de: "Passwort aufschreiben und posten", en: "Write it down and post it" },
          ],
          a: 1,
          explanation: {
            de: "Einzigartige Passwörter verhindern, dass ein Leak alles kompromittiert.",
            en: "Unique passwords prevent one leak from compromising everything.",
          },
          wusstest: {
            de: "„…1, …2“ ist für Angreifer leicht zu erraten.",
            en: "“…1, …2” patterns are easy for attackers to guess.",
          },
          source: {
            label: "NIST SP 800-63B (password guidance)",
            url: "https://www.enisa.europa.eu/topics/cyber-hygiene"
          },
          image: "",
          explanationImage: "",
        },

        {
          id: "s2_q18",
          type: "truefalse",
          q: { de: "Regelmäßige Backups helfen bei Ransomware.", en: "Regular backups help against ransomware." },
          a: true,
          explanation: {
            de: "Backups ermöglichen Wiederherstellung, auch wenn Daten verschlüsselt werden.",
            en: "Backups enable recovery even if data gets encrypted.",
          },
          wusstest: {
            de: "3-2-1 Regel: 3 Kopien, 2 Medien, 1 offline/offsite.",
            en: "3-2-1 rule: 3 copies, 2 media types, 1 offline/offsite.",
          },
          source: {
            label: "Council of Europe – Digital literacy & cyber hygiene",
            url: "https://rm.coe.int/16809382f9"
          },
          image: "",
          explanationImage: "",
        },

        {
          id: "s2_q19",
          type: "mc",
          q: { de: "Was ist eine gute Geräte-Sperre?", en: "What’s a good device lock?" },
          choices: [
            { de: "PIN/Passcode oder Biometrie", en: "PIN/passcode or biometrics" },
            { de: "Kein Sperrbildschirm", en: "No lock screen" },
            { de: "1234", en: "1234" },
          ],
          a: 0,
          explanation: {
            de: "Sperren verhindert unbefugten Zugriff, falls das Gerät verloren geht.",
            en: "A lock prevents unauthorized access if the device is lost.",
          },
          wusstest: {
            de: "Biometrie ist bequem, aber ein starker Passcode bleibt wichtig.",
            en: "Biometrics are convenient, but a strong passcode still matters.",
          },
          source: {
            label: "General device security",
            url: "https://www.enisa.europa.eu/topics/cyber-hygiene"
          },
          image: "",
          explanationImage: "",
        },

        {
          id: "s2_q20",
          type: "scenario",
          q: { de: "Du willst eine App installieren. Sie hat sehr viele negative Bewertungen zu „Betrug“. Was tust du?", en: "You want to install an app. Many reviews mention “scam”. What do you do?" },
          choices: [
            { de: "Trotzdem installieren", en: "Install anyway" },
            { de: "Alternative suchen / Quelle prüfen", en: "Look for alternatives / verify the source" },
            { de: "App kaufen, um sicher zu sein", en: "Buy it to be safe" },
          ],
          a: 1,
          explanation: {
            de: "Bewertungen sind nicht perfekt, aber viele Scam-Hinweise sind ein starkes Warnsignal.",
            en: "Reviews aren’t perfect, but repeated scam reports are a strong warning sign.",
          },
          wusstest: {
            de: "Achte auch auf Berechtigungen und Entwicklerinfos im Store.",
            en: "Also check permissions and developer details in the store.",
          },
          source: {
            label: "General app security hygiene",
            url: "https://www.enisa.europa.eu/topics/cyber-hygiene"
          },
          image: "",
          explanationImage: "",
        },
      ],
    },

    3: { title: { de: "Künstliche Intelligenz", en: "Artificial Intelligence" }, 
          summary: (ratio) => {
            if (ratio >= 0.8) {
              return {
                de: {
                  title: "🤖 KI-Kompass: sehr klar!",
                  text: "Du erkennst Chancen und Risiken — genau die Balance, die zählt.",
                },
                en: {
                  title: "🤖 AI compass: very clear!",
                  text: "You see both benefits and risks — that balance matters.",
                },
              };
            }
            if (ratio >= 0.5) {
              return {
                de: {
                  title: "🧭 Gute Orientierung!",
                  text: "Du bist kritisch, aber offen — mit mehr Beispielen wird’s noch besser.",
                },
                en: {
                  title: "🧭 Good orientation!",
                  text: "You’re critical yet open-minded — more examples will sharpen it.",
                },
              };
            }
            return {
              de: {
                title: "🌟 Neugierig bleiben!",
                text: "KI wirkt oft magisch — aber du lernst, richtig hinzuschauen. Stark.",
              },
              en: {
                title: "🌟 Stay curious!",
                text: "AI can feel magical — but you’re learning how to look deeper.",
              },
            };
          },
         questions: [
           {
              id: "ai_q01",
              type: "mc",
              q: { de: "Was ist Hochrisiko-KI?", en: "What is high-risk AI?" },
              choices: [
                { de: "KI in sensiblen Bereichen (Gesundheit, Bildung, Jobs)", en: "AI in sensitive areas (health, education, jobs)" },
                { de: "Alle Chatbots", en: "All chatbots" },
                { de: "Nur Spiele-KI", en: "Only game AI" },
              ],
              a: 0,
              explanation: {
                de: "Hochrisiko-KI kann wichtige Lebensentscheidungen beeinflussen und braucht stärkere Kontrollen.",
                en: "High-risk AI can affect key life decisions and needs stronger controls.",
              },
              wusstest: {
                de: "Wichtige Punkte: Tests, Dokumentation, menschliche Aufsicht.",
                en: "Key points: testing, documentation, human oversight.",
              },
              source: {
                label: "OECD AI Principles (general), EU AI governance concepts",
                url: "https://www.oecd.org/en/topics/sub-issues/ai-principles.html"
              },
              image: "",
              explanationImage: "",
            },

            // Alltag scenario: deepfake / no source
            {
              id: "ai_q02",
              type: "scenario",
              q: {
                de: "Ein Video zeigt eine bekannte Person mit einer krassen Aussage – ohne Quelle. Was tust du?",
                en: "A video shows a famous person saying something extreme — with no source. What do you do?",
              },
              choices: [
                { de: "Sofort teilen", en: "Share immediately" },
                { de: "Quelle prüfen / Original suchen / seriöse Bestätigungen", en: "Verify source / find original / reputable confirmations" },
                { de: "Kommentar: „echt??“", en: "Comment: “is it real??”" },
              ],
              a: 1,
              explanation: {
                de: "Deepfakes wirken real. Ohne Quelle: erst verifizieren, dann reagieren.",
                en: "Deepfakes can look real. Without a source: verify first, react later.",
              },
              wusstest: {
                de: "Reverse Image Search + Fact-Checks helfen schnell.",
                en: "Reverse image search + fact-checks can help quickly.",
              },
              source: {
                label: "Council of Europe – Digital citizenship & media literacy",
                url: "https://rm.coe.int/16809382f9"
              },
              image: "",
              explanationImage: "",
            },

            {
              id: "ai_q03",
              type: "truefalse",
              q: { de: "KI kann überzeugend klingen, obwohl Inhalte falsch sind.", en: "AI can sound convincing even when it’s wrong." },
              a: true,
              explanation: {
                de: "Modelle können Fehler halluzinieren. Deshalb: prüfen, nicht blind vertrauen.",
                en: "Models can hallucinate errors. Verify instead of trusting blindly.",
              },
              wusstest: {
                de: "Guter Trick: nach Quellen fragen und diese wirklich checken.",
                en: "Good trick: ask for sources and actually check them.",
              },
              source: {
                label: "AI reliability basics (general)",
                url: "https://www.oecd.org/en/topics/sub-issues/ai-principles.html"
              },
              image: "",
              explanationImage: "",
            },

            {
              id: "ai_q04",
              type: "mc",
              q: { de: "Was ist ein „Bias“ in KI-Systemen?", en: "What is “bias” in AI systems?" },
              choices: [
                { de: "Systematische Verzerrung in Daten/Modell, die unfairen Output erzeugt", en: "Systematic skew in data/model causing unfair output" },
                { de: "Ein Computervirus", en: "A computer virus" },
                { de: "Ein Update", en: "An update" },
              ],
              a: 0,
              explanation: {
                de: "Bias entsteht z. B. durch unausgewogene Trainingsdaten oder Problem-Design.",
                en: "Bias can come from imbalanced training data or problem design.",
              },
              wusstest: {
                de: "Bias heißt nicht „böse Absicht“ — oft ist es ein Daten-/Designproblem.",
                en: "Bias isn’t always malicious — often it’s a data/design issue.",
              },
              source: {
                label: "OECD AI Principles (fairness), general AI ethics",
                url: "https://www.oecd.org/en/topics/sub-issues/ai-principles.html"
              },
              image: "",
              explanationImage: "",
            },

            {
              id: "ai_q05",
              type: "scenario",
              q: { de: "Ein Bewerbungs-Tool sortiert automatisch Kandidaten. Was ist ein Risiko?", en: "A hiring tool automatically ranks candidates. What’s a risk?" },
              choices: [
                { de: "Es spart nur Zeit, sonst nichts", en: "It only saves time, nothing else" },
                { de: "Es kann unfair diskriminieren, wenn Daten/Bewertung verzerrt sind", en: "It can discriminate unfairly if data/scoring is biased" },
                { de: "Es macht Bewerbungen automatisch besser", en: "It automatically improves applications" },
              ],
              a: 1,
              explanation: {
                de: "Wenn Daten/Labels verzerrt sind, kann das Tool systematisch benachteiligen.",
                en: "If data/labels are biased, the tool can systematically disadvantage groups.",
              },
              wusstest: {
                de: "Wichtig: Audit, Transparenz, menschliche Kontrolle und Beschwerdemöglichkeiten.",
                en: "Key: audits, transparency, human oversight, and appeal mechanisms.",
              },
              source: {
                label: "AI ethics (fairness/oversight), governance concepts",
                url: "https://www.oecd.org/en/topics/sub-issues/ai-principles.html"
              },
              image: "",
              explanationImage: "",
            },

            {
              id: "ai_q06",
              type: "truefalse",
              q: { de: "Wenn ein KI-System etwas empfiehlt, ist es automatisch objektiv.", en: "If an AI recommends something, it’s automatically objective." },
              a: false,
              explanation: {
                de: "Empfehlungen hängen von Daten, Zielen und Trainingssignalen ab – das ist nie „neutral“. ",
                en: "Recommendations depend on data, objectives, and signals — never purely “neutral”.",
              },
              wusstest: {
                de: "Frage dich: Wer profitiert? Was ist das Ziel der Empfehlung?",
                en: "Ask: who benefits? what is the objective of the recommendation?",
              },
              source: {
                label: "Council of Europe – Digital citizenship & media literacy",
                url: "https://rm.coe.int/16809382f9"
              },
              image: "",
              explanationImage: "",
            },

            {
              id: "ai_q07",
              type: "mc",
              q: { de: "Was bedeutet „Transparenz“ bei KI im Alltag?", en: "What does AI transparency mean in everyday life?" },
              choices: [
                { de: "Du solltest wissen, ob du mit KI interagierst", en: "You should know when you’re interacting with AI" },
                { de: "KI darf nie eingesetzt werden", en: "AI must never be used" },
                { de: "KI soll immer perfekt sein", en: "AI must always be perfect" },
              ],
              a: 0,
              explanation: {
                de: "Menschen sollten verstehen, ob ein System automatisiert ist und welche Grenzen es hat.",
                en: "People should know when a system is automated and what its limits are.",
              },
              wusstest: {
                de: "Transparenz hilft, Vertrauen richtig zu dosieren.",
                en: "Transparency helps calibrate trust.",
              },
              source: {
                label: "OECD AI Principles (transparency), AI literacy (general)",
                url: "https://www.oecd.org/en/topics/sub-issues/ai-principles.html"
              },
              image: "",
              explanationImage: "",
            },

         ] },

    4: { title: { de: "Digitale Teilhabe & Medienkompetenz", en: "Digital Literacy & Participation" }, 
         summary: (ratio) => {
          if (ratio >= 0.8) {
            return {
              de: {
                title: "📰 Fakten-Filter: extrem stark!",
                text: "Du bleibst kritisch, checkst Quellen und lässt dich nicht triggern. Mega.",
              },
              en: {
                title: "📰 Fact filter: very strong!",
                text: "You stay critical, check sources, and don’t get baited. Excellent.",
              },
            };
          }
          if (ratio >= 0.5) {
            return {
              de: {
                title: "✅ Guter Reality-Check!",
                text: "Du erkennst viel — mit ein paar Checks wirst du richtig souverän.",
              },
              en: {
                title: "✅ Solid reality check!",
                text: "You catch a lot — a few routines will make you rock-solid.",
              },
            };
          }
          return {
            de: {
              title: "🔥 Du baust gerade Medien-Skills auf!",
              text: "Nicht alles online ist wahr — aber du lernst, besser zu prüfen. Weiter so!",
            },
            en: {
              title: "🔥 You’re building strong media skills!",
              text: "Not everything online is true — but you’re learning how to verify. Keep going!",
            },
          };
        },
         questions: [
          {
            id: "digT_q01",
            type: "mc",
            q: {
              de: "Was ist ein gutes Zeichen für eine vertrauenswürdige Quelle?",
              en: "What’s a good sign of a trustworthy source?",
            },
            choices: [
              { de: "Autor, Datum, Quellen und Kontakt/Impressum sind sichtbar", en: "Author, date, sources, and contact/imprint are visible" },
              { de: "Viele Emojis und CAPS LOCK", en: "Lots of emojis and ALL CAPS" },
              { de: "„Teile das sofort!!!“", en: "“Share this NOW!!!”" },
            ],
            a: 0,
            explanation: {
              de: "Seriöse Quellen sind transparent: Wer schreibt das? Wann? Mit welchen Belegen?",
              en: "Reliable sources are transparent: who wrote it, when, and what evidence supports it?",
            },
            wusstest: {
              de: "Ein Impressum/Kontakt allein reicht nicht — aber fehlende Infos sind eine Red Flag.",
              en: "An imprint/contact alone isn’t enough — but missing info is a red flag.",
            },
            source: {
              label: "Medienkompetenz-Grundlagen (Transparenz/Quellencheck)",
              url: "https://publications.jrc.ec.europa.eu/repository/bitstream/JRC128415/JRC128415_01.pdf"
            },
            image: "",
            explanationImage: "",
          },

          // Alltag scenario: TikTok/IG post without source (requested)
          {
            id: "digT_q02",
            type: "scenario",
            q: {
              de: "TikTok-Post: „Diese neue Regel gilt ab morgen für alle!“ — ohne Link/Quelle. Was tust du?",
              en: "TikTok post: “This new rule applies to everyone starting tomorrow!” — no link/source. What do you do?",
            },
            choices: [
              { de: "Speichern & teilen — klingt wichtig", en: "Save & share — sounds important" },
              { de: "Quelle suchen (offizielle Stellen/seriöse Medien) bevor du glaubst/teilst", en: "Look for a source (official info/reputable media) before believing/sharing" },
              { de: "Kommentieren: „stimmt safe“", en: "Comment: “definitely true”" },
            ],
            a: 1,
            explanation: {
              de: "Ohne Quelle ist es nur eine Behauptung. Erst verifizieren, dann reagieren.",
              en: "Without a source, it’s just a claim. Verify first, then react.",
            },
            wusstest: {
              de: "Schnellcheck: Suchbegriff + offizielle Website + 1–2 seriöse Medien. Keine Quelle = keine Sicherheit.",
              en: "Quick check: search term + official website + 1–2 reputable outlets. No source = no certainty.",
            },
            source: {
              label: "Medienkompetenz: Quellencheck / Verifikation",
              url: "https://publications.jrc.ec.europa.eu/repository/bitstream/JRC128415/JRC128415_01.pdf"
            },
            image: "",
            explanationImage: "",
          },

          {
            id: "digT_q03",
            type: "scenario",
            q: {
              de: "Schlagzeile: „Geheimes Mittel heilt alles in 24h!“ Was ist die beste Reaktion?",
              en: "Headline: “Secret remedy cures everything in 24h!” What’s the best reaction?",
            },
            choices: [
              { de: "Sofort teilen, damit alle es wissen", en: "Share immediately so everyone knows" },
              { de: "Quelle prüfen und nach seriösen Bestätigungen suchen", en: "Check the source and look for reputable confirmation" },
              { de: "Glauben, weil es viele Likes hat", en: "Believe it because it has lots of likes" },
            ],
            a: 1,
            explanation: {
              de: "Extreme Behauptungen brauchen starke Belege. Likes sind kein Beweis.",
              en: "Extraordinary claims require strong evidence. Likes are not proof.",
            },
            wusstest: {
              de: "Achte auf: Autor, Datum, Studie/Beleg, Gegenchecks, Kontext.",
              en: "Check: author, date, study/evidence, cross-checks, context.",
            },
            source: {
              label: "Medienkompetenz: Plausibilität & Evidenz",
              url: "https://publications.jrc.ec.europa.eu/repository/bitstream/JRC128415/JRC128415_01.pdf"
            },
            image: "",
            explanationImage: "",
          },

          {
            id: "digT_q04",
            type: "mc",
            q: {
              de: "Was bedeutet „Kontext“ bei Online-Inhalten?",
              en: "What does “context” mean for online content?",
            },
            choices: [
              { de: "Wer es sagt, wann, in welchem Zusammenhang und mit welcher Absicht", en: "Who says it, when, in what setting, and with what intent" },
              { de: "Nur die Anzahl der Likes", en: "Only the number of likes" },
              { de: "Nur die Überschrift", en: "Only the headline" },
            ],
            a: 0,
            explanation: {
              de: "Ohne Kontext wirken Aussagen oft dramatischer oder falscher. Kontext kann Bedeutung komplett ändern.",
              en: "Without context, claims can look more dramatic or misleading. Context can change meaning entirely.",
            },
            wusstest: {
              de: "Viele virale Clips sind „aus dem Zusammenhang gerissen“ (out of context).",
              en: "Many viral clips are “out of context.”",
            },
            source: {
              label: "Medienkompetenz: Kontextprüfung",
              url: "https://publications.jrc.ec.europa.eu/repository/bitstream/JRC128415/JRC128415_01.pdf"
            },
            image: "",
            explanationImage: "",
          },

          {
            id: "digT_q05",
            type: "truefalse",
            q: {
              de: "Viele Likes bedeuten automatisch, dass etwas wahr ist.",
              en: "Lots of likes automatically means something is true.",
            },
            a: false,
            explanation: {
              de: "Likes messen Aufmerksamkeit, nicht Wahrheit. Inhalte können viral gehen, weil sie emotional triggern.",
              en: "Likes measure attention, not truth. Content can go viral because it triggers emotions.",
            },
            wusstest: {
              de: "Algorithmen belohnen oft Engagement — auch bei kontroversen oder falschen Inhalten.",
              en: "Algorithms often reward engagement — even for misleading content.",
            },
            source: {
              label: "Medienkompetenz / Algorithmus-Grundlagen",
              url: "https://publications.jrc.ec.europa.eu/repository/bitstream/JRC128415/JRC128415_01.pdf"
            },
            image: "",
            explanationImage: "",
          },

          {
            id: "digT_q06",
            type: "mc",
            q: {
              de: "Was ist „Clickbait“?",
              en: "What is “clickbait”?",
            },
            choices: [
              { de: "Reißerische Überschriften, die Klicks statt Fakten priorisieren", en: "Sensational headlines that prioritize clicks over facts" },
              { de: "Ein seriöser Faktencheck", en: "A reliable fact-check" },
              { de: "Ein wissenschaftlicher Artikel", en: "A scientific paper" },
            ],
            a: 0,
            explanation: {
              de: "Clickbait nutzt Neugier/Schock, um Klicks zu erzeugen — oft ohne saubere Belege.",
              en: "Clickbait uses curiosity/shock to generate clicks — often without solid evidence.",
            },
            wusstest: {
              de: "Achte auf Formulierungen wie „Du wirst nicht glauben…“ oder „Das sagt dir niemand…“.",
              en: "Watch for phrases like “You won’t believe…” or “They don’t want you to know…”",
            },
            source: {
              label: "Medienkompetenz: Manipulationsmuster",
              url: "https://publications.jrc.ec.europa.eu/repository/bitstream/JRC128415/JRC128415_01.pdf"
            },
            image: "",
            explanationImage: "",
          },

          {
            id: "digT_q07",
            type: "scenario",
            q: {
              de: "Ein Post behauptet: „Studie beweist XYZ“ – aber verlinkt keine Studie. Was tust du?",
              en: "A post claims: “A study proves XYZ” — but links no study. What do you do?",
            },
            choices: [
              { de: "Glauben, weil „Studie“ seriös klingt", en: "Believe it because “study” sounds credible" },
              { de: "Nach der Originalstudie suchen und prüfen", en: "Search for the original study and verify" },
              { de: "Sofort kommentieren: „Fake!“", en: "Immediately comment: “Fake!”" },
            ],
            a: 1,
            explanation: {
              de: "Ohne Primärquelle ist es nur eine Behauptung. Suche nach der Originalquelle und prüfe Zusammenfassung/Methodik.",
              en: "Without a primary source it’s just a claim. Find the original and check summary/method.",
            },
            wusstest: {
              de: "Viele Posts zitieren Studien falsch oder lassen Einschränkungen weg.",
              en: "Many posts misquote studies or omit limitations.",
            },
            source: {
              label: "Medienkompetenz: Quellen/Primärquelle",
              url: "https://publications.jrc.ec.europa.eu/repository/bitstream/JRC128415/JRC128415_01.pdf"
            },
            image: "",
            explanationImage: "",
          },

          {
            id: "digT_q08",
            type: "mc",
            q: {
              de: "Was ist eine „Primärquelle“?",
              en: "What is a “primary source”?",
            },
            choices: [
              { de: "Das Originaldokument/Originalaussage (z. B. Studie, Gesetz, Rede)", en: "The original document/statement (e.g., study, law, speech)" },
              { de: "Ein Meme darüber", en: "A meme about it" },
              { de: "Ein Kommentar-Thread", en: "A comment thread" },
            ],
            a: 0,
            explanation: {
              de: "Primärquellen sind die Basis, bevor andere interpretieren oder zuspitzen.",
              en: "Primary sources are the base before others interpret or exaggerate.",
            },
            wusstest: {
              de: "Sekundärquellen können gut sein — aber prüfe: verlinken sie sauber?",
              en: "Secondary sources can be good — but check if they link properly.",
            },
            source: {
              label: "Wissenschafts-/Medienkompetenz Grundlagen",
              url: "https://publications.jrc.ec.europa.eu/repository/bitstream/JRC128415/JRC128415_01.pdf"
            },
            image: "",
            explanationImage: "",
          },

          {
            id: "digT_q09",
            type: "truefalse",
            q: {
              de: "Ein Screenshot ist ein verlässlicher Beweis.",
              en: "A screenshot is reliable proof.",
            },
            a: false,
            explanation: {
              de: "Screenshots sind leicht zu fälschen oder ohne Kontext irreführend. Besser: Originalquelle prüfen.",
              en: "Screenshots are easy to fake or misleading without context. Check the original source.",
            },
            wusstest: {
              de: "Wenn möglich: Link, Archiv-Version oder offizielles Statement suchen.",
              en: "If possible: find a link, an archived version, or an official statement.",
            },
            source: {
              label: "Medienkompetenz: Verifikation",
              url: "https://publications.jrc.ec.europa.eu/repository/bitstream/JRC128415/JRC128415_01.pdf"
            },
            image: "",
            explanationImage: "",
          },

          {
            id: "digT_q10",
            type: "mc",
            q: {
              de: "Was ist „Confirmation Bias“ (Bestätigungsfehler)?",
              en: "What is “confirmation bias”?",
            },
            choices: [
              { de: "Wir glauben eher Dinge, die unsere Meinung bestätigen", en: "We tend to believe things that confirm our beliefs" },
              { de: "Wir erinnern uns an alles perfekt", en: "We remember everything perfectly" },
              { de: "Wir sind immer objektiv", en: "We are always objective" },
            ],
            a: 0,
            explanation: {
              de: "Menschen suchen unbewusst Bestätigung. Dadurch wirken passende Infos „wahrer“ als sie sind.",
              en: "We unconsciously seek confirmation. This can make fitting info feel “truer” than it is.",
            },
            wusstest: {
              de: "Guter Trick: Suche aktiv nach Gegenargumenten aus seriösen Quellen.",
              en: "Good trick: actively look for reputable counter-evidence.",
            },
            source: {
              label: "Council of Europe – Digital citizenship & media literacy",
              url: "https://rm.coe.int/16809382f9"
            },
            image: "",
            explanationImage: "",
          },

          {
            id: "digT_q11",
            type: "scenario",
            q: {
              de: "Du siehst einen emotionalen Post („Empörung“). Was ist eine clevere Pause?",
              en: "You see an emotional outrage post. What’s a smart pause?",
            },
            choices: [
              { de: "Sofort reagieren und teilen", en: "React and share immediately" },
              { de: "Kurz warten, durchatmen, Quelle prüfen", en: "Pause, breathe, verify the source" },
              { de: "Nur die Kommentare lesen", en: "Only read the comments" },
            ],
            a: 1,
            explanation: {
              de: "Emotionen reduzieren kritisches Denken. Eine kurze Pause schützt vor impulsivem Teilen.",
              en: "Emotions reduce critical thinking. A short pause prevents impulsive sharing.",
            },
            wusstest: {
              de: "Manipulative Inhalte arbeiten oft mit Angst/Wut, weil das Engagement steigert.",
              en: "Manipulative content often uses anger/fear because it boosts engagement.",
            },
            source: {
              label: "Medienkompetenz: Emotion & Manipulation",
              url: "https://publications.jrc.ec.europa.eu/repository/bitstream/JRC128415/JRC128415_01.pdf"
            },
            image: "",
            explanationImage: "",
          },

          {
            id: "digT_q12",
            type: "mc",
            q: { de: "Woran erkennst du oft Werbung, die als Inhalt getarnt ist?", en: "How can you spot ads disguised as content?" },
            choices: [
              { de: "Markierungen wie „Anzeige“, „Sponsored“, „Partner“", en: "Labels like “Ad”, “Sponsored”, “Partner”" },
              { de: "Sie hat viele Likes", en: "It has many likes" },
              { de: "Sie ist sehr kurz", en: "It’s very short" },
            ],
            a: 0,
            explanation: {
              de: "Native Ads/Influencer-Posts können wie normale Inhalte wirken. Labels sind wichtige Hinweise.",
              en: "Native ads/influencer posts can look like normal content. Labels are key signals.",
            },
            wusstest: {
              de: "Auch Rabattcodes/„Link in Bio“ sind typische Werbesignale.",
              en: "Discount codes or “link in bio” are common ad signals.",
            },
            source: {
              label: "Werbekennzeichnung / Medienkompetenz (allgemein)",
              url: "https://publications.jrc.ec.europa.eu/repository/bitstream/JRC128415/JRC128415_01.pdf"
            },
            image: "",
            explanationImage: "",
          },

          {
            id: "digT_q13",
            type: "truefalse",
            q: { de: "Ein verifizierter Account (blauer Haken) garantiert Wahrheit.", en: "A verified account guarantees truth." },
            a: false,
            explanation: {
              de: "Verifizierung sagt oft nur: Identität/Account ist bestätigt — nicht, dass Inhalte korrekt sind.",
              en: "Verification often confirms identity — not that content is accurate.",
            },
            wusstest: {
              de: "Auch verifizierte Accounts können Fehler teilen oder gehackt werden.",
              en: "Verified accounts can still share errors or get hacked.",
            },
            source: {
              label: "Council of Europe – Digital citizenship & media literacy",
              url: "https://rm.coe.int/16809382f9"
            },
            image: "",
            explanationImage: "",
          },

          {
            id: "digT_q14",
            type: "mc",
            q: { de: "Was ist „Engagement Bait“?", en: "What is “engagement bait”?" },
            choices: [
              { de: "Posts, die dich zu Likes/Kommentaren drängen („LIKE wenn…“)", en: "Posts pushing you to like/comment (“LIKE if…”) " },
              { de: "Ein Faktencheck-Tool", en: "A fact-check tool" },
              { de: "Ein sicheres Passwort", en: "A secure password" },
            ],
            a: 0,
            explanation: {
              de: "Engagement Bait nutzt Aufforderungen, um Reichweite zu pushen — oft ohne echte Information.",
              en: "Engagement bait uses prompts to boost reach — often with little real info.",
            },
            wusstest: {
              de: "Je stärker der Post „bettelt“, desto skeptischer solltest du sein.",
              en: "The more a post begs for engagement, the more skeptical you should be.",
            },
            source: {
              label: "Council of Europe – Digital citizenship & media literacy",
              url: "https://rm.coe.int/16809382f9"
            },
            image: "",
            explanationImage: "",
          },

          {
            id: "digT_q15",
            type: "scenario",
            q: { de: "Ein Clip zeigt nur 5 Sekunden einer Rede. Wie gehst du damit um?", en: "A clip shows only 5 seconds of a speech. How do you handle it?" },
            choices: [
              { de: "Clip reicht, das ist die ganze Wahrheit", en: "The clip is enough — full truth" },
              { de: "Originalrede/ganzen Ausschnitt suchen", en: "Find the full speech/full clip" },
              { de: "Nur die Kommentare glauben", en: "Believe the comments" },
            ],
            a: 1,
            explanation: {
              de: "Kurze Clips können Kontext weglassen. Besser: Original und längeren Ausschnitt prüfen.",
              en: "Short clips can omit context. Better: check the original and a longer excerpt.",
            },
            wusstest: {
              de: "„Out of context“ ist eine der häufigsten Formen von Desinformation.",
              en: "“Out of context” is one of the most common forms of misinformation.",
            },
            source: {
              label: "Medienkompetenz: Kontext/Originalquelle",
              url: "https://publications.jrc.ec.europa.eu/repository/bitstream/JRC128415/JRC128415_01.pdf"
            },
            image: "",
            explanationImage: "",
          },

          {
            id: "digT_q16",
            type: "mc",
            q: { de: "Was ist „Desinformation“?", en: "What is “disinformation”?" },
            choices: [
              { de: "Absichtlich falsche oder irreführende Informationen", en: "Deliberately false or misleading information" },
              { de: "Ein Tippfehler", en: "A typo" },
              { de: "Eine harmlose Meinung", en: "A harmless opinion" },
            ],
            a: 0,
            explanation: {
              de: "Desinformation ist gezielt — nicht nur ein Irrtum. Ziel: manipulieren.",
              en: "Disinformation is intentional — not just a mistake. The goal is to manipulate.",
            },
            wusstest: {
              de: "„Misinformation“ = falsche Info ohne Absicht. „Desinformation“ = mit Absicht.",
              en: "Misinformation = false without intent. Disinformation = intentional.",
            },
            source: {
              label: "Medienkompetenz: Desinformation/Misinformation",
              url: "https://publications.jrc.ec.europa.eu/repository/bitstream/JRC128415/JRC128415_01.pdf"
            },
            image: "",
            explanationImage: "",
          },

          {
            id: "digT_q17",
            type: "truefalse",
            q: { de: "Satire ist immer klar erkennbar.", en: "Satire is always clearly recognizable." },
            a: false,
            explanation: {
              de: "Satire kann für echte Nachrichten gehalten werden, wenn sie geteilt wird ohne Kontext.",
              en: "Satire can be mistaken for real news when shared without context.",
            },
            wusstest: {
              de: "Wenn’s zu absurd klingt: Quelle checken, ob Satire/Parodie.",
              en: "If it sounds absurd: check if the source is satire/ parody.",
            },
            source: {
              label: "Medienkompetenz: Satire erkennen",
              url: "https://publications.jrc.ec.europa.eu/repository/bitstream/JRC128415/JRC128415_01.pdf"
            },
            image: "",
            explanationImage: "",
          },

          {
            id: "digT_q18",
            type: "scenario",
            q: {
              de: "Ein Post zeigt ein Bild mit Text („Zitat“). Keine Quelle. Was ist dein nächster Schritt?",
              en: "A post shows an image with a quote. No source. What’s your next step?",
            },
            choices: [
              { de: "Teilen, weil’s gut klingt", en: "Share because it sounds good" },
              { de: "Reverse Image Search / Originalquelle suchen", en: "Reverse image search / find the original source" },
              { de: "Nur liken", en: "Just like it" },
            ],
            a: 1,
            explanation: {
              de: "Bildzitate sind leicht zu fälschen. Reverse Image Search zeigt oft Ursprung und Kontext.",
              en: "Image quotes are easy to fake. Reverse image search often reveals origin and context.",
            },
            wusstest: {
              de: "Manchmal stammt das Bild aus einem völlig anderen Ereignis/Jahr.",
              en: "Sometimes the image is from a totally different event/year.",
            },
            source: {
              label: "Medienkompetenz: Verifikation/Reverse Search",
              url: "https://publications.jrc.ec.europa.eu/repository/bitstream/JRC128415/JRC128415_01.pdf"
            },
            image: "",
            explanationImage: "",
          },

          {
            id: "digT_q19",
            type: "mc",
            q: { de: "Was ist ein seriöser „Gegencheck“?", en: "What is a reliable cross-check?" },
            choices: [
              { de: "Mehrere unabhängige, seriöse Quellen bestätigen die Aussage", en: "Multiple independent reputable sources confirm the claim" },
              { de: "Viele Kommentare sagen es auch", en: "Many comments say it too" },
              { de: "Ein Influencer sagt es", en: "An influencer says it" },
            ],
            a: 0,
            explanation: {
              de: "Je wichtiger eine Behauptung, desto mehr brauchst du unabhängige Bestätigung.",
              en: "The more important a claim, the more you need independent confirmation.",
            },
            wusstest: {
              de: "Achte darauf, ob Medien nur voneinander abschreiben (gleiche Quelle) oder wirklich unabhängig sind.",
              en: "Check whether outlets copy the same source or are truly independent.",
            },
            source: {
              label: "Medienkompetenz: Cross-checking",
              url: "https://publications.jrc.ec.europa.eu/repository/bitstream/JRC128415/JRC128415_01.pdf"
            },
            image: "",
            explanationImage: "",
          },

          {
            id: "digT_q20",
            type: "truefalse",
            q: { de: "Algorithmen zeigen dir immer die objektiv besten Inhalte.", en: "Algorithms always show you the objectively best content." },
            a: false,
            explanation: {
              de: "Algorithmen optimieren oft auf Aufmerksamkeit/Engagement, nicht auf Qualität oder Wahrheit.",
              en: "Algorithms often optimize for attention/engagement, not quality or truth.",
            },
            wusstest: {
              de: "Dein Feed ist personalisiert. Zwei Personen sehen völlig unterschiedliche Realitäten.",
              en: "Your feed is personalized. Two people can see totally different realities.",
            },
            source: {
              label: "Algorithmus-/Medienkompetenz Grundlagen",
              url: "https://publications.jrc.ec.europa.eu/repository/bitstream/JRC128415/JRC128415_01.pdf"
            },
            image: "",
            explanationImage: "",
          },

          {
            id: "digT_q21",
            type: "mc",
            q: { de: "Was ist eine „Filterblase“?", en: "What is a “filter bubble”?" },
            choices: [
              { de: "Du bekommst vor allem Inhalte, die zu deinen Interessen/Meinungen passen", en: "You mostly see content matching your interests/beliefs" },
              { de: "Ein Schutz gegen Fake News", en: "A protection against fake news" },
              { de: "Ein sicheres WLAN", en: "Secure Wi-Fi" },
            ],
            a: 0,
            explanation: {
              de: "Personalisierung kann dazu führen, dass andere Perspektiven seltener werden.",
              en: "Personalization can reduce exposure to other perspectives.",
            },
            wusstest: {
              de: "Aktiv gegensteuern: unterschiedliche Quellen abonnieren, bewusst suchen.",
              en: "Counter it: follow diverse sources, search intentionally.",
            },
            source: {
              label: "Digital literacy (personalization effects)",
              url: "https://publications.jrc.ec.europa.eu/repository/bitstream/JRC128415/JRC128415_01.pdf"
            },
            image: "",
            explanationImage: "",
          },

          {
            id: "digT_q22",
            type: "scenario",
            q: { de: "Du bist unsicher, ob eine Info stimmt. Was ist ein guter „Mini-Faktencheck“?", en: "You’re unsure if a claim is true. What’s a good mini fact-check?" },
            choices: [
              { de: "Nur auf TikTok weiter schauen", en: "Keep watching TikTok" },
              { de: "Suchbegriff + offizielle Quelle + 1 seriöses Medium", en: "Search term + official source + 1 reputable outlet" },
              { de: "In den Kommentaren fragen", en: "Ask in the comments" },
            ],
            a: 1,
            explanation: {
              de: "Ein schneller Check bei offiziellen Stellen und seriösen Medien filtert viel Müll raus.",
              en: "A quick check with official sources and reputable outlets filters a lot of noise.",
            },
            wusstest: {
              de: "Wenn du’s nicht bestätigen kannst: lieber nicht teilen.",
              en: "If you can’t verify it: don’t share it.",
            },
            source: {
              label: "Medienkompetenz: Schnellcheck",
              url: "https://publications.jrc.ec.europa.eu/repository/bitstream/JRC128415/JRC128415_01.pdf"
            },
            image: "",
            explanationImage: "",
          },

          {
            id: "digT_q23",
            type: "mc",
            q: { de: "Was ist „Manipulation durch Bildwahl“?", en: "What is “manipulation through image choice”?" },
            choices: [
              { de: "Ein Bild wird gewählt, um Gefühle zu triggern, obwohl es den Inhalt verzerrt", en: "Choosing an image to trigger emotions while distorting the message" },
              { de: "Ein Bild wird immer neutral gewählt", en: "Images are always neutral" },
              { de: "Bilder sind unwichtig", en: "Images don’t matter" },
            ],
            a: 0,
            explanation: {
              de: "Bilder können Stimmung erzeugen und Interpretationen lenken, auch wenn Text neutral wirkt.",
              en: "Images can shape mood and interpretation even if text seems neutral.",
            },
            wusstest: {
              de: "Achte: passt das Bild wirklich zum Ereignis? Datum? Ort?",
              en: "Check: does the image truly match the event? date? place?",
            },
            source: {
              label: "Medienkompetenz: Framing/Visual literacy",
              url: "https://publications.jrc.ec.europa.eu/repository/bitstream/JRC128415/JRC128415_01.pdf"
            },
            image: "",
            explanationImage: "",
          },

          {
            id: "digT_q24",
            type: "truefalse",
            q: { de: "Eine Meinung und eine Tatsache sind dasselbe.", en: "An opinion and a fact are the same." },
            a: false,
            explanation: {
              de: "Fakten sind überprüfbar. Meinungen sind Bewertungen/Interpretationen.",
              en: "Facts are verifiable. Opinions are judgments/interpretations.",
            },
            wusstest: {
              de: "Viele Posts mischen beides: erst Gefühl, dann „Fakt“ behauptet.",
              en: "Many posts mix both: emotion first, then a “fact” claim.",
            },
            source: {
              label: "Medienkompetenz Grundlagen",
              url: "https://publications.jrc.ec.europa.eu/repository/bitstream/JRC128415/JRC128415_01.pdf"
            },
            image: "",
            explanationImage: "",
          },

          {
            id: "digT_q25",
            type: "mc",
            q: { de: "Was bedeutet „Framing“?", en: "What does “framing” mean?" },
            choices: [
              { de: "Ein Thema wird so dargestellt, dass es eine bestimmte Interpretation nahelegt", en: "Presenting a topic to suggest a particular interpretation" },
              { de: "Ein Passwort speichern", en: "Saving a password" },
              { de: "Eine App installieren", en: "Installing an app" },
            ],
            a: 0,
            explanation: {
              de: "Framing lenkt Wahrnehmung durch Wortwahl, Beispiele und Perspektive.",
              en: "Framing shapes perception through wording, examples, and perspective.",
            },
            wusstest: {
              de: "Framing ist nicht immer „böse“, aber du solltest es erkennen können.",
              en: "Framing isn’t always malicious — but it’s important to recognize.",
            },
            source: {
              label: "Medienkompetenz: Sprache/Framing (allgemein)",
              url: "https://publications.jrc.ec.europa.eu/repository/bitstream/JRC128415/JRC128415_01.pdf"
            },
            image: "",
            explanationImage: "",
          },

          {
            id: "digT_q26",
            type: "mc",
            q: { de: "Was ist ein „Scheinexperte“?", en: "What is a “fake expert”?" },
            choices: [
              { de: "Jemand wirkt kompetent, hat aber keine nachvollziehbare Expertise/Quelle", en: "Someone seems credible but lacks verifiable expertise/source" },
              { de: "Ein echter Wissenschaftler", en: "A real scientist" },
              { de: "Eine offizielle Behörde", en: "An official authority" },
            ],
            a: 0,
            explanation: {
              de: "Titel, Outfit oder Selbstbehauptung ersetzen keine überprüfbaren Belege.",
              en: "Titles, outfit, or self-claims don’t replace verifiable evidence.",
            },
            wusstest: {
              de: "Check: Publikationen, Institution, unabhängige Erwähnungen, Kontext.",
              en: "Check: publications, institution, independent mentions, context.",
            },
            source: {
              label: "Council of Europe – Digital citizenship & media literacy",
              url: "https://rm.coe.int/16809382f9"
            },
            image: "",
            explanationImage: "",
          },

         ] },
  };

  const questionBankKids = {
  1: {
    title: { de: "Meine Daten", en: "My Data" },
    summary: (ratio) => {
      if (ratio >= 0.8) return { de: { title: "🛡️ Daten-Checker!", text: "Super! Du passt gut auf deine Daten auf." }, en: { title: "🛡️ Data checker!", text: "Great! You protect your data well." } };
      if (ratio >= 0.5) return { de: { title: "✨ Guter Anfang!", text: "Nice! Mit ein paar Regeln wirst du noch sicherer." }, en: { title: "✨ Good start!", text: "Nice! A few rules will make you even safer." } };
      return { de: { title: "🌱 Übung macht’s!", text: "Kein Problem — du lernst gerade, was sicher ist." }, en: { title: "🌱 Practice helps!", text: "No worries — you’re learning what’s safe." } };
    },
    questions: [
      {
        id: "k_p1_q01",
        type: "mc",
        q: { de: "Welche Info solltest du online lieber NICHT öffentlich teilen?", en: "Which info should you usually NOT share publicly online?" },
        choices: [
          { de: "Deine Adresse", en: "Your home address" },
          { de: "Dein Lieblingstier", en: "Your favorite animal" },
          { de: "Dein Lieblingsspiel", en: "Your favorite game" }
        ],
        a: 0,
        explanation: { de: "Adresse ist privat. Teile sie nur mit Personen, denen du vertraust.", en: "An address is private. Share it only with people you trust." },
        wusstest: { de: "Wenn du unsicher bist: frag eine erwachsene Person.", en: "If you’re unsure: ask a trusted adult." },
        source: { label: "klicksafe / BSI – Kindersicherheit (Startseite)", url: "https://www.klicksafe.de/" }
      },
      {
        id: "k_p1_q02",
        type: "truefalse",
        q: { de: "Ein Spitzname ist oft besser als dein voller Name im Internet.", en: "A nickname is often better than your full name online." },
        a: true,
        explanation: { de: "Ein Spitzname schützt deine Identität besser.", en: "A nickname protects your identity better." },
        wusstest: { de: "Nutze Privatsphäre-Einstellungen in Apps.", en: "Use privacy settings in apps." },
        source: { label: "klicksafe – Privat im Netz", url: "https://www.klicksafe.de/" }
      },
      {
        id: "k_p1_q03",
        type: "scenario",
        q: { de: "Eine App fragt nach deinem Standort, obwohl sie das nicht braucht. Was machst du?", en: "An app asks for your location even though it doesn’t need it. What do you do?" },
        choices: [
          { de: "Erlauben (immer)", en: "Allow (always)" },
          { de: "Ablehnen oder nur „Beim Benutzen“ erlauben", en: "Deny or allow only “While using”" },
          { de: "Ignorieren", en: "Ignore it" }
        ],
        a: 1,
        explanation: { de: "Nur geben, was nötig ist. Standort kann viel verraten.", en: "Only share what’s needed. Location can reveal a lot." },
        wusstest: { de: "Du kannst Berechtigungen später ändern.", en: "You can change permissions later." },
        source: { label: "Apple – Standortdienste (Überblick)", url: "https://support.apple.com/" }
      },
      {
        id: "k_p1_q04",
        type: "mc",
        q: { de: "Was bedeutet „Privat“ in einer App?", en: "What does “Private” mean in an app?" },
        choices: [
          { de: "Nur ausgewählte Personen können es sehen", en: "Only selected people can see it" },
          { de: "Alle können es sehen", en: "Everyone can see it" },
          { de: "Niemand kann es sehen (auch du nicht)", en: "Nobody can see it (not even you)" }
        ],
        a: 0,
        explanation: { de: "Privat heißt: nicht für alle sichtbar.", en: "Private means: not visible to everyone." },
        wusstest: { de: "Checke manchmal deine Einstellungen.", en: "Check your settings sometimes." },
        source: { label: "klicksafe – Einstellungen", url: "https://www.klicksafe.de/" }
      }
    ]
  },

  2: {
    title: { de: "Sicher online", en: "Safe Online" },
    summary: (ratio) => {
      if (ratio >= 0.8) return { de: { title: "🔐 Sicherheits-Pro!", text: "Sehr gut! Du erkennst gefährliche Situationen." }, en: { title: "🔐 Safety pro!", text: "Great! You spot risky situations." } };
      if (ratio >= 0.5) return { de: { title: "🚦Gute Regeln!", text: "Nice! Mit Übung wirst du noch sicherer." }, en: { title: "🚦Good rules!", text: "Nice! Practice makes you safer." } };
      return { de: { title: "🧠 Lernmodus!", text: "Kein Stress — du baust gerade starke Sicherheits-Skills auf." }, en: { title: "🧠 Learning mode!", text: "No stress — you’re building strong safety skills." } };
    },
    questions: [
      {
        id: "k_s2_q01",
        type: "mc",
        q: { de: "Was ist ein gutes Passwort?", en: "What is a good password?" },
        choices: [
          { de: "1234", en: "1234" },
          { de: "Ein langes Passwort mit mehreren Wörtern", en: "A long password with several words" },
          { de: "Dein Vorname", en: "Your first name" }
        ],
        a: 1,
        explanation: { de: "Lange Passwörter sind schwerer zu erraten.", en: "Long passwords are harder to guess." },
        wusstest: { de: "Nutze nie dasselbe Passwort überall.", en: "Don’t use the same password everywhere." },
        source: { label: "NIST – Passwort-Richtlinien (Überblick)", url: "https://pages.nist.gov/800-63-3/" }
      },
      {
        id: "k_s2_q02",
        type: "scenario",
        q: { de: "Du bekommst eine Nachricht: „Schick mir ein Foto, sonst…“ Was machst du?", en: "You get a message: “Send me a photo or else…” What do you do?" },
        choices: [
          { de: "Sofort schicken", en: "Send it immediately" },
          { de: "Nicht antworten, blockieren und einer erwachsenen Person sagen", en: "Don’t reply, block, and tell a trusted adult" },
          { de: "Weiterleiten an Freunde", en: "Forward to friends" }
        ],
        a: 1,
        explanation: { de: "Das ist Druck/Erpressung. Hol dir Hilfe und antworte nicht.", en: "That’s pressure/blackmail. Get help and don’t reply." },
        wusstest: { de: "Du bist nicht schuld, wenn jemand dich unter Druck setzt.", en: "It’s not your fault if someone pressures you." },
        source: { label: "klicksafe – Hilfe", url: "https://www.klicksafe.de/" }
      },
      {
        id: "k_s2_q03",
        type: "truefalse",
        q: { de: "Du solltest Links in komischen Nachrichten lieber nicht anklicken.", en: "You should avoid clicking links in suspicious messages." },
        a: true,
        explanation: { de: "Links können auf Fake-Seiten führen.", en: "Links can lead to fake sites." },
        wusstest: { de: "Wenn du unsicher bist: frag eine erwachsene Person.", en: "If unsure: ask a trusted adult." },
        source: { label: "BSI – Phishing (Startseite)", url: "https://www.bsi.bund.de/" }
      },
      {
        id: "k_s2_q04",
        type: "mc",
        q: { de: "Was machst du, wenn dich jemand online beleidigt?", en: "What do you do if someone insults you online?" },
        choices: [
          { de: "Zurück beleidigen", en: "Insult back" },
          { de: "Screenshot machen, blockieren, melden, Hilfe holen", en: "Take a screenshot, block, report, get help" },
          { de: "Nichts sagen und alles glauben", en: "Say nothing and believe everything" }
        ],
        a: 1,
        explanation: { de: "Melden + blockieren + Hilfe holen ist am sichersten.", en: "Report + block + get help is safest." },
        wusstest: { de: "Du musst das nicht alleine lösen.", en: "You don’t have to handle it alone." },
        source: { label: "klicksafe – Cybermobbing", url: "https://www.klicksafe.de/" }
      }
    ]
  },

  3: {
    title: { de: "KI & Tricks", en: "AI & Tricks" },
    summary: (ratio) => {
      if (ratio >= 0.8) return { de: { title: "🤖 KI-Detektiv!", text: "Top! Du weißt: KI ist nicht immer perfekt." }, en: { title: "🤖 AI detective!", text: "Great! You know AI isn’t always perfect." } };
      if (ratio >= 0.5) return { de: { title: "🧭 Gute Orientierung!", text: "Nice! Du bleibst neugierig und vorsichtig." }, en: { title: "🧭 Good sense!", text: "Nice! You’re curious and careful." } };
      return { de: { title: "🌟 Weiter lernen!", text: "KI ist spannend — und du lernst, wie man sie richtig nutzt." }, en: { title: "🌟 Keep learning!", text: "AI is exciting — and you’re learning how to use it wisely." } };
    },
    questions: [
      {
        id: "k_ai_q01",
        type: "truefalse",
        q: { de: "KI kann manchmal Dinge erfinden, die nicht stimmen.", en: "AI can sometimes make up things that are not true." },
        a: true,
        explanation: { de: "Darum: immer prüfen!", en: "So: always verify!" },
        wusstest: { de: "Frag nach Quellen oder Beispielen.", en: "Ask for sources or examples." },
        source: { label: "OECD – AI (Startseite)", url: "https://oecd.ai/" }
      },
      {
        id: "k_ai_q02",
        type: "mc",
        q: { de: "Was ist ein Deepfake?", en: "What is a deepfake?" },
        choices: [
          { de: "Ein echtes Foto", en: "A real photo" },
          { de: "Ein Video/Bild, das mit KI verändert wurde", en: "A video/image changed with AI" },
          { de: "Ein Passwort", en: "A password" }
        ],
        a: 1,
        explanation: { de: "Deepfakes können sehr echt aussehen, sind aber manipuliert.", en: "Deepfakes can look real but are manipulated." },
        wusstest: { de: "Wenn etwas krass klingt: erst prüfen.", en: "If it sounds extreme: verify first." },
        source: { label: "ENISA – Cybersecurity (Startseite)", url: "https://www.enisa.europa.eu/" }
      },
      {
        id: "k_ai_q03",
        type: "scenario",
        q: { de: "Du siehst ein verrücktes Video ohne Quelle. Was machst du?", en: "You see a crazy video with no source. What do you do?" },
        choices: [
          { de: "Sofort teilen", en: "Share immediately" },
          { de: "Quelle suchen / Erwachsenen fragen / nicht sofort teilen", en: "Look for a source / ask an adult / don’t share yet" },
          { de: "Kommentare glauben", en: "Believe the comments" }
        ],
        a: 1,
        explanation: { de: "Ohne Quelle ist es unsicher. Erst checken, dann teilen.", en: "Without a source it’s uncertain. Check first, then share." },
        wusstest: { de: "Screenshots und Clips können aus dem Kontext sein.", en: "Screenshots/clips can be out of context." },
        source: { label: "klicksafe – Fakes erkennen", url: "https://www.klicksafe.de/" }
      },
      {
        id: "k_ai_q04",
        type: "mc",
        q: { de: "Was ist fair, wenn KI dir bei Hausaufgaben hilft?", en: "What’s fair if AI helps you with homework?" },
        choices: [
          { de: "Alles kopieren und behaupten, es ist von mir", en: "Copy everything and claim it’s mine" },
          { de: "KI als Hilfe nutzen, aber selbst verstehen und eigene Worte verwenden", en: "Use AI as help, but understand and use your own words" },
          { de: "Gar nichts mehr lernen", en: "Stop learning" }
        ],
        a: 1,
        explanation: { de: "KI kann helfen — aber du solltest es verstehen und ehrlich bleiben.", en: "AI can help — but you should understand it and be honest." },
        wusstest: { de: "Wenn du’s nicht verstehst: frag nach einer einfacheren Erklärung.", en: "If you don’t understand: ask for a simpler explanation." },
        source: { label: "UNICEF – Children & technology (Startseite)", url: "https://www.unicef.org/" }
      }
    ]
  },

  4: {
    title: { de: "Wahr oder Fake?", en: "True or Fake?" },
    summary: (ratio) => {
      if (ratio >= 0.8) return { de: { title: "📰 Super Fakten-Filter!", text: "Mega! Du prüfst, bevor du glaubst." }, en: { title: "📰 Great fact filter!", text: "Awesome! You check before you believe." } };
      if (ratio >= 0.5) return { de: { title: "✅ Gute Checks!", text: "Sehr gut! Mit Routine wirst du richtig stark." }, en: { title: "✅ Good checks!", text: "Very good! With routine you’ll be super strong." } };
      return { de: { title: "🔥 Dranbleiben!", text: "Du lernst gerade, wie man besser prüft. Weiter so!" }, en: { title: "🔥 Keep going!", text: "You’re learning how to verify. Keep going!" } };
    },
    questions: [
      {
        id: "k_med_q01",
        type: "mc",
        q: { de: "Was ist ein guter Mini-Check, bevor du etwas teilst?", en: "What’s a good mini-check before you share something?" },
        choices: [
          { de: "Nur die Überschrift lesen", en: "Only read the headline" },
          { de: "Quelle + Datum prüfen", en: "Check source + date" },
          { de: "Sofort weiterleiten", en: "Forward immediately" }
        ],
        a: 1,
        explanation: { de: "Quelle und Datum helfen zu sehen, ob es echt und aktuell ist.", en: "Source and date help you see if it’s real and current." },
        wusstest: { de: "Wenn du’s nicht prüfen kannst: lieber nicht teilen.", en: "If you can’t verify it: don’t share it." },
        source: { label: "klicksafe – Nachrichten prüfen", url: "https://www.klicksafe.de/" }
      },
      {
        id: "k_med_q02",
        type: "truefalse",
        q: { de: "Viele Likes bedeuten automatisch: stimmt!", en: "Lots of likes automatically means it’s true!" },
        a: false,
        explanation: { de: "Likes sind kein Beweis. Dinge gehen viral, weil sie spannend sind.", en: "Likes are not proof. Things go viral because they’re exciting." },
        wusstest: { de: "Wenn es dich sehr aufregt: Pause machen und prüfen.", en: "If it makes you upset: pause and verify." },
        source: { label: "EU Digital Strategy (Startseite)", url: "https://digital-strategy.ec.europa.eu/" }
      },
      {
        id: "k_med_q03",
        type: "scenario",
        q: { de: "Ein Screenshot zeigt „Beweis!“. Keine Quelle. Was machst du?", en: "A screenshot shows “proof!”. No source. What do you do?" },
        choices: [
          { de: "Glauben und teilen", en: "Believe and share" },
          { de: "Nach Original-Link suchen / Erwachsene fragen", en: "Look for the original link / ask an adult" },
          { de: "Nichts mehr glauben", en: "Believe nothing ever" }
        ],
        a: 1,
        explanation: { de: "Screenshots kann man fälschen oder aus dem Kontext reißen.", en: "Screenshots can be faked or taken out of context." },
        wusstest: { de: "Besser: Originalquelle suchen.", en: "Better: find the original source." },
        source: { label: "klicksafe – Bilder & Fakes", url: "https://www.klicksafe.de/" }
      }
    ]
  }
};

  function getActiveBank() {
    // In your current project, adults are in `questionBank` (from your existing file)
    return mode === "kids" ? questionBankKids : questionBank;
  }

  // =========================
  // MODAL
  // =========================
  function openExitModal() {
    if (!exitModal) return;
    exitModal.classList.remove("hidden");
  }
  function closeExitModal() {
    if (!exitModal) return;
    exitModal.classList.add("hidden");
  }
  function quizInProgress() {
    return currentTheme !== null;
  }

  // =========================
  // MODE
  // =========================
  function syncModeButtons() {
    if (modeAdultBtn) modeAdultBtn.classList.toggle("active", mode === "adult");
    if (modeKidsBtn) modeKidsBtn.classList.toggle("active", mode === "kids");
    if (modeSwitch) modeSwitch.style.display = quizInProgress() ? "none" : "flex";
  }

  function applyMode(newMode) {
    mode = newMode === "kids" ? "kids" : "adult";
    localStorage.setItem("dc_mode", mode);

    document.body.classList.toggle("mode-kids", mode === "kids");
    document.documentElement.style.setProperty("--brand", mode === "kids" ? "#ff9900" : "#004284");

    syncModeButtons();
    setHomeState();
    renderStaticUI();
  }

  if (modeAdultBtn) modeAdultBtn.addEventListener("click", () => applyMode("adult"));
  if (modeKidsBtn) modeKidsBtn.addEventListener("click", () => applyMode("kids"));

  // =========================
  // HOME STATE
  // =========================
  function setHomeState() {
    currentTheme = null;
    index = 0;
    score = 0;
    selectedQuestions = [];

    totalAnswered = 0;
    totalCorrect = 0;
    completedThemes.clear();

    if (themeGrid) themeGrid.style.display = "grid";
    if (subtitle) subtitle.style.display = "block";
    if (progressContainer) progressContainer.style.display = "none";
    if (progressBar) progressBar.style.width = "0%";
    if (homeBtn) homeBtn.style.display = "none";
    if (modeSwitch) modeSwitch.style.display = "flex";

    container.innerHTML = "";
  }

  function goHome() {
    setHomeState();
    closeExitModal();
  }

  // =========================
  // STATIC UI TEXTS + THEME LABELS
  // =========================
  function renderStaticUI() {
    if (subtitle) subtitle.textContent = t("subtitle");
    if (homeBtn) homeBtn.textContent = t("backHome");

    if (modalTitle) modalTitle.textContent = t("modalTitle");
    if (modalText) modalText.textContent = t("modalText");
    if (modalCancel) modalCancel.textContent = t("cancel");
    if (modalConfirm) modalConfirm.textContent = t("confirmLeave");

    const bank = getActiveBank();
    document.querySelectorAll(".theme-btn").forEach((b) => {
      const id = Number(b.dataset.theme);
      const theme = bank?.[id];
      b.textContent = theme ? pickText(theme.title) : "";
      b.disabled = !theme;
    });

    if (langDE) langDE.classList.toggle("active", lang === "de");
    if (langEN) langEN.classList.toggle("active", lang === "en");

    syncModeButtons();
  }

  // =========================
  // LANGUAGE SWITCH
  // =========================
  function setLanguage(newLang) {
    lang = newLang === "en" ? "en" : "de";
    localStorage.setItem("dc_lang", lang);
    document.documentElement.setAttribute("lang", lang);

    renderStaticUI();
    if (quizInProgress()) renderQuestion();
  }

  if (langDE) langDE.addEventListener("click", () => setLanguage("de"));
  if (langEN) langEN.addEventListener("click", () => setLanguage("en"));

  // =========================
  // EVENTS (Home + Modal)
  // =========================
  if (homeBtn) {
    homeBtn.addEventListener("click", () => {
      if (quizInProgress()) openExitModal();
      else goHome();
    });
  }
  if (modalCancel) modalCancel.addEventListener("click", closeExitModal);
  if (modalBackdrop) modalBackdrop.addEventListener("click", closeExitModal);
  if (modalConfirm) modalConfirm.addEventListener("click", goHome);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeExitModal();
  });

  // Theme click delegation
  if (themeGrid) {
    themeGrid.addEventListener("click", (e) => {
      const btn = e.target.closest(".theme-btn");
      if (!btn) return;
      const id = Number(btn.dataset.theme);
      startTheme(id);
    });
  }

  // =========================
  // START THEME
  // =========================
  function questionsPerTheme() {
    return mode === "kids" ? Infinity : ADULT_QUESTIONS_PER_THEME;
  }

  function startTheme(id) {
    const bank = getActiveBank();
    const theme = bank?.[id];
    if (!theme) return;

    if (themeGrid) themeGrid.style.display = "none";
    if (subtitle) subtitle.style.display = "none";
    if (homeBtn) homeBtn.style.display = "inline-flex";
    if (progressContainer) progressContainer.style.display = "none";
    if (modeSwitch) modeSwitch.style.display = "none";

    currentTheme = id;
    index = 0;
    score = 0;
    selectedQuestions = [];

    if (!theme.questions || theme.questions.length === 0) {
      container.innerHTML = `<p style="text-align:center;">${escapeHTML(t("emptyTheme"))}</p>`;
      return;
    }

    if (progressContainer) progressContainer.style.display = "block";

    selectedQuestions = pickRandomQuestions(id, theme.questions, questionsPerTheme());
    updateProgress();
    renderQuestion();
  }

  // =========================
  // RENDER QUESTION
  // =========================
  function renderHeader() {
    const bank = getActiveBank();
    const theme = bank?.[currentTheme];
    return `
      <h2>${escapeHTML(pickText(theme.title))}</h2>
      <p class="counter">${escapeHTML(t("questionCounter", index + 1, selectedQuestions.length))}</p>
    `;
  }

  function renderQuestion() {
    const bank = getActiveBank();
    const theme = bank?.[currentTheme];
    if (!theme) return;

    const q = selectedQuestions[index];
    if (!q) return;

    updateProgress();

    if (q.type === "truefalse") return renderTrueFalse(q);
    if (q.type === "scenario") return renderScenario(q);
    return renderChoices(q);
  }

  function renderChoices(q) {
    container.innerHTML = `
      ${renderHeader()}
      <p class="question">${escapeHTML(pickText(q.q))}</p>
      <div class="choices" id="choices"></div>
    `;

    const choicesEl = document.getElementById("choices");
    (q.choices || []).forEach((choiceObj, i) => {
      const btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.type = "button";
      btn.textContent = pickText(choiceObj);
      btn.onclick = () => handleAnswer(i, btn);
      choicesEl.appendChild(btn);
    });
  }

  function renderTrueFalse(q) {
    container.innerHTML = `
      ${renderHeader()}
      <p class="question">${escapeHTML(pickText(q.q))}</p>
      <div class="choices" id="choices"></div>
    `;

    const choicesEl = document.getElementById("choices");
    const labels = [
      { label: t("trueLabel"), value: true },
      { label: t("falseLabel"), value: false },
    ];

    labels.forEach((item) => {
      const btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.type = "button";
      btn.textContent = item.label;
      btn.onclick = () => handleAnswer(item.value, btn);
      choicesEl.appendChild(btn);
    });
  }

  function renderScenario(q) {
    container.innerHTML = `
      ${renderHeader()}
      <p class="question">${escapeHTML(pickText(q.q))}</p>

      ${
        q.image
          ? `<div class="scenario-image"><img src="${escapeHTML(q.image)}" alt="Scenario image"></div>`
          : ""
      }

      <div class="choices" id="choices"></div>
    `;

    const choicesEl = document.getElementById("choices");
    (q.choices || []).forEach((choiceObj, i) => {
      const btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.type = "button";
      btn.textContent = pickText(choiceObj);
      btn.onclick = () => handleAnswer(i, btn);
      choicesEl.appendChild(btn);
    });
  }

  // =========================
  // ANSWER FLOW
  // =========================
  function handleAnswer(selected, btn) {
    const q = selectedQuestions[index];
    const correct = selected === q.a;

    container.querySelectorAll("button").forEach((b) => (b.disabled = true));
    btn.classList.add(correct ? "correct" : "incorrect");

    totalAnswered++;
    if (correct) {
      score++;
      totalCorrect++;
    }

    setTimeout(() => renderExplanationScreen(q, correct), 250);
  }

  function renderExplanationScreen(q, correct) {
    const explanationText = pickText(q.explanation || "");
    const wusstestText = pickText(q.wusstest || "");

    container.innerHTML = `
      <p class="result ${correct ? "correct-text" : "incorrect-text"}">
        ${escapeHTML(correct ? t("correct") : t("wrong"))}
      </p>

      <p class="explanation-text">${escapeHTML(explanationText)}</p>

      ${
        q.explanationImage
          ? `<div class="explanation-image"><img src="${escapeHTML(q.explanationImage)}" alt="Explanation image"></div>`
          : ""
      }

      ${
        wusstestText
          ? `
            <button class="info-toggle" id="info-toggle" type="button">
              <img src="../assets/icons/information.png" alt="Info" class="quiz-info-icon">
              ${escapeHTML(t("didYouKnow"))}
            </button>

            <div class="info-card hidden" id="info-card">
              <strong>${escapeHTML(t("didYouKnow"))}</strong>
              <p>${escapeHTML(wusstestText)}</p>
            </div>
          `
          : ""
      }

      <p class="source">${escapeHTML(t("source"))} <span class="source-links">${sourceToLinks(q.source)}</span></p>

      <button id="next-btn" class="next-btn" type="button">${escapeHTML(t("next"))}</button>
    `;

    const toggleBtn = document.getElementById("info-toggle");
    const infoCard = document.getElementById("info-card");
    if (toggleBtn && infoCard) toggleBtn.onclick = () => infoCard.classList.toggle("hidden");

    const nextBtn = document.getElementById("next-btn");
    if (nextBtn) {
      nextBtn.onclick = () => {
        index++;
        if (index < selectedQuestions.length) renderQuestion();
        else showThemeSummary();
      };
    }
  }

  // =========================
  // THEME SUMMARY
  // =========================
  function getAllThemeIds() {
    const bank = getActiveBank();
    return Object.keys(bank)
      .map((k) => Number(k))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);
  }

  function showThemeSummary() {
    completedThemes.add(currentTheme);

    const bank = getActiveBank();
    const theme = bank[currentTheme];
    const total = selectedQuestions.length;
    const ratio = total ? score / total : 0;

    const pack = theme.summary(ratio);
    const msg = pack[lang];

    const ALL_THEMES = getAllThemeIds();
    const allDone = ALL_THEMES.every((id) => completedThemes.has(id));

    if (allDone) {
      showFinalSummary();
      return;
    }

    if (progressBar) progressBar.style.width = "100%";

    const idx = ALL_THEMES.indexOf(currentTheme);
    const next = idx >= 0 ? ALL_THEMES[idx + 1] : null;
    const hasNext = next != null && bank[next] && bank[next].questions && bank[next].questions.length;

    container.innerHTML = `
      <h2>${escapeHTML(t("resultTitle"))}</h2>

      <div class="section-summary">
        <h3>${escapeHTML(msg.title)}</h3>
        <p>${escapeHTML(msg.text)}</p>
      </div>

      <p class="score"><strong>${escapeHTML(t("scoreLine", score, total))}</strong></p>

      <button id="next-theme-btn" class="next-btn" type="button">
        ${escapeHTML(hasNext ? t("nextTheme") : t("backOverview"))}
      </button>
    `;

    const nextThemeBtn = document.getElementById("next-theme-btn");
    if (nextThemeBtn) {
      nextThemeBtn.onclick = () => {
        if (hasNext) startTheme(next);
        else goHome();
      };
    }
  }

  function showFinalSummary() {
    const ratio = totalAnswered ? totalCorrect / totalAnswered : 0;

    let title = "";
    let text = "";

    if (ratio >= 0.8) {
      title = lang === "de" ? "🚀 Stark! Du hast einen richtig guten Kompass." : "🚀 Strong! You’ve got a solid compass.";
      text = t("finalTextStrong");
    } else if (ratio >= 0.5) {
      title = lang === "de" ? "✨ Sehr gut! Du bist auf dem richtigen Weg." : "✨ Great job! You’re on the right track.";
      text = t("finalTextMid");
    } else {
      title = lang === "de" ? "🌱 Starker Start — weiter so!" : "🌱 Strong start — keep going!";
      text = t("finalTextLow");
    }

    container.innerHTML = `
      <h2>${escapeHTML(t("overallTitle"))}</h2>

      <div class="section-summary">
        <h3>${escapeHTML(title)}</h3>
        <p>${escapeHTML(text)}</p>

        <p style="margin-top:10px;">
          <strong>${escapeHTML(
            lang === "de"
              ? `Gesamt: ${totalCorrect} / ${totalAnswered} richtig`
              : `Overall: ${totalCorrect} / ${totalAnswered} correct`
          )}</strong>
        </p>

        <p style="margin-top:10px; color:#444;">
          ${escapeHTML(t("finalLearnTip"))}
        </p>
      </div>

      <button id="final-home-btn" class="next-btn" type="button">
        ${escapeHTML(t("finalButton"))}
      </button>
    `;

    const finalBtn = document.getElementById("final-home-btn");
    if (finalBtn) finalBtn.onclick = goHome;
  }

  // =========================
  // PROGRESS
  // =========================
  function updateProgress() {
    if (!progressBar) return;
    const total = selectedQuestions.length || 1;
    progressBar.style.width = `${(index / total) * 100}%`;
  }

  // =========================
  // INIT
  // =========================
  if (mode !== "kids" && mode !== "adult") mode = "adult";
  document.body.classList.toggle("mode-kids", mode === "kids");
  document.documentElement.style.setProperty("--brand", mode === "kids" ? "#ff9900" : "#004284");
  syncModeButtons();

  setLanguage(lang); // sets html lang + renders
  renderStaticUI();
  setHomeState();
})();
