
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
  const langFR = document.getElementById("lang-fr");


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
    if (x && typeof x === "object") return x[lang] || x.de || x.en || x.fr || "";
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
    fr: {
      subtitle: "Choisissez un thème",
      backHome: "⬅ Retour à la vue d'ensemble",
      next: "Suivant",
      resultTitle: "Résultats",
      overallTitle: "Résultat global",
      source: "Source:",
      didYouKnow: "Le saviez-vous?",
      modalTitle: "Quitter le quiz?",
      modalText:
        "Vos progrès dans ce thème seront perdus. Voulez-vous vraiment revenir à la vue d'ensemble ?",
      cancel: "Annuler",
      confirmLeave: "Oui, quitter",
      questionCounter: (i, total) => `Question ${i} sur ${total}`,
      trueLabel: "Vrai",
      falseLabel: "Faux",
      correct: "✅ Correct",
      wrong: "❌ Incorrect",
      nextTheme: "Thème suivant ➡",
      backOverview: "🏁 Retour à la vue d'ensemble",
      scoreLine: (s, t) => `${s} / ${t} réponses correctes`,
      emptyTheme: "Ce thème est vide pour le moment.",

      finalTextStrong:
        "Super ! Vous avez terminé tous les thèmes. Prochaine étape : choisissez un thème et lisez une source fiable courte aujourd'hui (site officiel, média réputé ou guide).",
      finalTextMid:
        "Bravo ! Vous avez terminé tous les thèmes. Ensuite : choisissez un thème et vérifiez 1 à 2 sources fiables — petite habitude, grand effet.",
      finalTextLow:
        "Bon début ! Vous avez terminé tous les thèmes. La compétence clé est la constance : choisissez un thème et passez 10 minutes à apprendre/vérifier aujourd'hui — cela aide beaucoup.",
      finalLearnTip: "Astuce : Vérifiez la source + la date + l'objectif avant de partager.",
      finalButton: "🏁 Retour à la vue d'ensemble",
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
      title: { de: "Datenschutz & Grundrechte", en: "Privacy & Data Rights", fr : "Confidentialité et droits relatifs aux données" },
      summary: (ratio) => {
        if (ratio >= 0.8) {
          return {
            de: { title: "🛡️ Datenschutz-Profi!", text: "Du erkennst Datenrisiken schnell und triffst kluge Entscheidungen. Stark!" },
            en: { title: "🛡️ Privacy Pro!", text: "You spot data risks quickly and make smart choices. Great job!" },
            fr: { title: "🛡️ Expert en confidentialité !", text: "Vous repérez rapidement les risques liés aux données et prenez des décisions intelligentes. Bravo !" },
          };
        }
        if (ratio >= 0.5) {
          return {
            de: { title: "✨ Gute Basis!", text: "Du hast die wichtigsten Ideen drauf — mit etwas Übung wirst du richtig sicher." },
            en: { title: "✨ Solid foundation!", text: "You’ve got the core ideas — a bit more practice and you’ll be very confident." },
            fr: { title: "✨ Bonne base !", text: "Vous avez les idées de base — un peu plus de pratique et vous serez très confiant." },
          };
        }
        return {
          de: { title: "🌱 Guter Start!", text: "Datenschutz ist tricky — aber du bist dran. Jeder Schritt zählt!" },
          en: { title: "🌱 Great start!", text: "Privacy can be tricky — but you’re learning. Every step counts!" },
          fr: { title: "🌱 Bon début !", text: "La confidentialité peut être délicate — mais vous apprenez. Chaque étape compte !" },
        };
      },
      questions: [
        {
          id: "p1_q01",
          type: "mc",
          q: { de: "Was sind personenbezogene Daten?", en: "What counts as personal data?", fr: "Qu'est-ce qui est considéré comme des données personnelles ?" },
          choices: [
            { de: "Informationen über eine identifizierte oder identifizierbare Person", en: "Information about an identified or identifiable person", fr: "Informations sur une personne identifiée ou identifiable" },
            { de: "Anonyme Statistiken", en: "Anonymous statistics", fr: "Statistiques anonymes" },
            { de: "Nur medizinische Daten", en: "Only medical data", fr: "Seulement les données médicales" },
          ],
          a: 0,
          explanation: {
            de: "Personenbezogene Daten sind alle Infos, mit denen man dich direkt oder indirekt identifizieren kann.",
            en: "Personal data is any information that can identify you directly or indirectly.",
            fr: "Les données personnelles sont toutes les informations permettant de vous identifier directement ou indirectement.",
          },
          wusstest: {
            de: "Auch Online-Kennungen (Cookies/IDs) können personenbezogen sein, wenn sie dich identifizierbar machen.",
            en: "Online identifiers (cookies/IDs) can also be personal data if they make you identifiable.",
            fr: "Les identifiants en ligne (cookies/IDs) peuvent également être des données personnelles s'ils permettent de vous identifier.",
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
          q: { de: "Eine IP-Adresse kann personenbezogen sein.", en: "An IP address can be personal data.", fr: "Une adresse IP peut-elle être considérée comme des données personnelles ?" },
          a: true,
          explanation: {
            de: "Wenn eine IP einem Anschluss oder Nutzer zugeordnet werden kann, ist sie personenbezogen.",
            en: "If an IP can be linked to a subscriber/user, it can be personal data.",
            fr: "Si une adresse IP peut être liée à un abonné/utilisateur, elle peut être considérée comme des données personnelles.",
          },
          wusstest: {
            de: "„IP = anonym“ ist ein Mythos. Provider-Logs können Zuordnung ermöglichen.",
            en: "“IP = anonymous” is a myth. ISP logs can enable linking.",
            fr: "“IP = anonyme” est un mythe. Les journaux des FAI peuvent permettre une identification.",
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
          q: { de: "Welches Prinzip bedeutet: nur wirklich nötige Daten sammeln?", en: "Which principle means collecting only necessary data?", fr: "Quel principe signifie collecter uniquement les données nécessaires ?" },
          choices: [
            { de: "Datenminimierung", en: "Data minimisation", fr: "Minimisation des données" },
            { de: "Datenhandel", en: "Data trading", fr: "Commerce des données" },
            { de: "Vorratsdatenspeicherung", en: "Mass retention", fr: "Conservation massive" },
          ],
          a: 0,
          explanation: {
            de: "Datenminimierung heißt: so wenig wie möglich, so viel wie nötig.",
            en: "Data minimisation means: as little as possible, as much as necessary.",
            fr: "La minimisation des données signifie : aussi peu que possible, autant que nécessaire.",
          },
          wusstest: {
            de: "Auch Formularfelder: Wenn’s nicht gebraucht wird, sollte es nicht Pflicht sein.",
            en: "Also forms: if it’s not needed, it shouldn’t be required.",
            fr: "Aussi les champs de formulaire : s'ils ne sont pas nécessaires, ils ne devraient pas être obligatoires.",
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
          q: { de: "Wann ist Datenverarbeitung erlaubt?", en: "When is data processing allowed?", fr: "Quand le traitement des données est-il autorisé ?" },
          choices: [
            { de: "Wenn es eine Rechtsgrundlage gibt (z. B. Einwilligung, Vertrag)", en: "When there is a legal basis (e.g., consent, contract)", fr: "Lorsqu'il existe une base légale (ex. consentement, contrat)" },
            { de: "Immer, wenn ein Dienst kostenlos ist", en: "Always if a service is free", fr: "Toujours si un service est gratuit" },
            { de: "Nur bei Behörden", en: "Only for public authorities", fr: "Seulement pour les autorités publiques" },
          ],
          a: 0,
          explanation: {
            de: "Es braucht eine gültige Rechtsgrundlage – nicht nur „weil wir’s wollen“.",
            en: "A valid legal basis is required — not just “because we want to”.",
            fr: "Une base légale valide est nécessaire — pas seulement « parce que nous le voulons ».",
          },
          wusstest: {
            de: "Einwilligung muss freiwillig sein und darf nicht erzwungen werden.",
            en: "Consent must be freely given and not forced.",
            fr: "Le consentement doit être donné librement et ne doit pas être forcé.",
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
          q: { de: "Welches Recht erlaubt dir Einblick in deine gespeicherten Daten?", en: "Which right lets you access your stored data?", fr: "Quel droit vous permet d'accéder à vos données stockées ?" },
          choices: [
            { de: "Recht auf Auskunft", en: "Right of access", fr: "Droit d'accès" },
            { de: "Urheberrecht", en: "Copyright", fr: "Droit d'auteur" },
            { de: "Hausrecht", en: "Property rights", fr: "Droit de propriété" },
          ],
          a: 0,
          explanation: {
            de: "Du darfst wissen, welche Daten gespeichert sind, wofür und an wen sie gehen.",
            en: "You can ask what data is stored, why, and who it’s shared with.",
            fr: "Vous pouvez demander quelles données sont stockées, pourquoi et avec qui elles sont partagées.",
          },
          wusstest: {
            de: "Du kannst oft auch eine Kopie der Daten verlangen.",
            en: "You can often request a copy of your data as well.",
            fr: "Vous pouvez souvent demander une copie de vos données également.",
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
          q: { de: "Eine Taschenlampen-App möchte Zugriff auf deine Kontakte. Was tust du?", en: "A flashlight app asks for access to your contacts. What do you do?", fr: "Une application de lampe de poche demande l'accès à vos contacts. Que faites-vous ?" },
          choices: [
            { de: "Erlauben – wird schon nötig sein", en: "Allow — it must be necessary", fr: "Autoriser — cela doit être nécessaire" },
            { de: "Ablehnen und prüfen, ob die App ohne funktioniert", en: "Deny and check if the app works without it", fr: "Refuser et vérifier si l'application fonctionne sans" },
            { de: "Erlauben und später vergessen", en: "Allow and forget later", fr: "Autoriser et oublier plus tard" },
          ],
          a: 1,
          explanation: {
            de: "Kontakte sind sensibel. Eine Taschenlampe braucht sie normalerweise nicht. Erst prüfen, dann entscheiden.",
            en: "Contacts are sensitive. A flashlight app usually doesn’t need them. Verify before granting.",
            fr: "Les contacts sont sensibles. Une application de lampe de poche n'en a généralement pas besoin. Vérifiez avant d'accorder l'accès.",
          },
          wusstest: {
            de: "Berechtigungen kannst du jederzeit in den Einstellungen entziehen.",
            en: "You can revoke permissions anytime in settings.",
            fr: "Vous pouvez révoquer les autorisations à tout moment dans les paramètres.",
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
          q: { de: "Eine Website verlangt Geburtstag + Adresse „ohne Grund“. Was ist am sinnvollsten?", en: "A website asks for birthdate + address “for no reason”. What’s best?", fr: "Un site web demande la date de naissance + l'adresse « sans raison ». Quelle est la meilleure option ?" },
          choices: [
            { de: "Alles eingeben, sonst klappt’s nicht", en: "Enter everything or it won’t work", fr: "Tout saisir, sinon ça ne fonctionnera pas" },
            { de: "Nur nötige Felder / Alternative suchen", en: "Fill only necessary fields / find an alternative", fr: "Remplir uniquement les champs nécessaires / trouver une alternative" },
            { de: "Fake-Daten eingeben, egal", en: "Enter fake data, whatever", fr: "Saisir de fausses données, peu importe" },
          ],
          a: 1,
          explanation: {
            de: "Wenn Daten nicht nötig sind, gib sie nicht heraus. Nutze Alternativen oder lass optionale Felder leer.",
            en: "If data isn’t necessary, don’t provide it. Use alternatives or skip optional fields.",
            fr: "Si les données ne sont pas nécessaires, ne les fournissez pas. Utilisez des alternatives ou laissez les champs optionnels vides.",
          },
          wusstest: {
            de: "Fake-Daten können später Probleme machen (z. B. Konto-Wiederherstellung).",
            en: "Fake data can backfire later (e.g., account recovery).",
            fr: "Les fausses données peuvent causer des problèmes plus tard (ex. récupération de compte).",
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
          q: { de: "Du kannst deine Einwilligung jederzeit widerrufen.", en: "You can withdraw consent at any time.", fr: "Vous pouvez retirer votre consentement à tout moment." },
          a: true,
          explanation: {
            de: "Einwilligung muss widerrufbar sein – und der Widerruf sollte einfach sein.",
            en: "Consent must be withdrawable — and withdrawal should be easy.",
            fr: "Le consentement doit être rétractable — et la rétractation doit être facile.",
          },
          wusstest: {
            de: "Widerruf stoppt Verarbeitung auf Einwilligungsbasis, aber nicht immer jede Speicherung (z. B. gesetzliche Pflicht).",
            en: "Withdrawal stops consent-based processing, but not always all storage (e.g., legal duties).",
            fr: "La rétractation arrête le traitement basé sur le consentement, mais pas toujours le stockage (ex. obligations légales).",
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
          q: { de: "Was bedeutet „Privacy by Design“?", en: "What does “Privacy by Design” mean?", fr: "Que signifie « Privacy by Design » ?" },
          choices: [
            { de: "Datenschutz wird von Anfang an eingebaut", en: "Privacy is built in from the start", fr: "La confidentialité est intégrée dès le départ" },
            { de: "Datenschutz ist optional", en: "Privacy is optional", fr: "La confidentialité est optionnelle" },
            { de: "Datenschutz gilt nur für große Firmen", en: "Privacy applies only to big companies", fr: "La confidentialité ne s'applique qu'aux grandes entreprises" },
          ],
          a: 0,
          explanation: {
            de: "Datenschutz soll nicht nachträglich geflickt werden, sondern von Beginn an mitgeplant sein.",
            en: "Privacy shouldn’t be patched later — it should be planned from the beginning.",
            fr: "La confidentialité ne doit pas être corrigée plus tard — elle doit être planifiée dès le début.",
          },
          wusstest: {
            de: "„Privacy by Default“: sichere Standard-Einstellungen.",
            en: "“Privacy by Default”: safe default settings.",
            fr: "« Privacy by Default » : des paramètres par défaut sécurisés.",
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
          q: { de: "Welches Recht beschreibt: Daten löschen lassen, wenn kein Grund mehr besteht?", en: "Which right allows deletion when no longer needed?", fr: "Quel droit permet la suppression des données lorsqu'elles ne sont plus nécessaires ?" },
          choices: [
            { de: "Recht auf Löschung", en: "Right to erasure", fr: "Droit à l'effacement" },
            { de: "Recht auf Werbung", en: "Right to advertising", fr: "Droit à la publicité" },
            { de: "Recht auf Zensur", en: "Right to censorship", fr: "Droit à la censure" },
          ],
          a: 0,
          explanation: {
            de: "Unter bestimmten Bedingungen kannst du Löschung verlangen (z. B. wenn Daten nicht mehr nötig sind).",
            en: "Under certain conditions you can request deletion (e.g., data no longer necessary).",
            fr: "Dans certaines conditions, vous pouvez demander la suppression (par exemple, lorsque les données ne sont plus nécessaires).",
          },
          wusstest: {
            de: "Es gibt Ausnahmen (z. B. gesetzliche Aufbewahrungspflichten).",
            en: "There are exceptions (e.g., legal retention obligations).",
            fr: "Il existe des exceptions (par exemple, obligations légales de conservation).",
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
          q: { de: "Du willst ein Konto löschen, aber der Weg ist versteckt/kompliziert. Was ist das oft?", en: "You want to delete an account but it’s hidden/complicated. Often this is…", fr: "Vous voulez supprimer un compte, mais le chemin est caché/complexe. Souvent, c'est…" },
          choices: [
            { de: "Guter Service", en: "Good service", fr: "Bon service" },
            { de: "Dark Pattern (manipulative Gestaltung)", en: "Dark pattern (manipulative design)", fr: "Dark pattern (conception manipulatrice)" },
            { de: "Pflicht wegen Sicherheit", en: "Required for security", fr: "Obligatoire pour des raisons de sécurité" },
          ],
          a: 1,
          explanation: {
            de: "Wenn es absichtlich schwer gemacht wird, ist es oft ein Dark Pattern (Opt-out/Kündigung verstecken).",
            en: "If it’s intentionally hard, it’s often a dark pattern (hiding opt-out/cancel).",
            fr: "S'il est intentionnellement difficile, c'est souvent un dark pattern (cacher l'option de désinscription/annulation).",
          },
          wusstest: {
            de: "Fair: Opt-out sollte ähnlich leicht sein wie Opt-in.",
            en: "Fair: opting out should be as easy as opting in.",
            fr: "Équitable : se désinscrire devrait être aussi facile que de s'inscrire.",
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
          q: { de: "Was bedeutet „Zweckbindung“?", en: "What does “purpose limitation” mean?", fr: "Que signifie « limitation de la finalité » ?" },
          choices: [
            { de: "Daten nur für den angegebenen Zweck verwenden", en: "Use data only for the stated purpose", fr: "Utiliser les données uniquement à des fins spécifiées" },
            { de: "Daten für alles nutzen, wenn sie einmal da sind", en: "Use data for anything once collected", fr: "Utiliser les données pour n'importe quoi une fois collectées" },
            { de: "Daten nur offline speichern", en: "Store data only offline", fr: "Stocker les données uniquement hors ligne" },
          ],
          a: 0,
          explanation: {
            de: "Daten dürfen nicht einfach zweckentfremdet werden, ohne passende Grundlage.",
            en: "Data shouldn’t be repurposed without an appropriate basis.",
            fr: "Les données ne doivent pas être utilisées à d'autres fins sans base appropriée.",
          },
          wusstest: {
            de: "Wenn der Zweck sich ändert, braucht es oft neue Info/Einwilligung.",
            en: "If purpose changes, you often need new notice/consent.",
            fr: "Si le but change, il faut souvent un nouvel avis/consentement.",
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
          q: { de: "Datenschutzinfos müssen klar und verständlich sein.", en: "Privacy information must be clear and understandable.", fr: "Les informations sur la confidentialité doivent être claires et compréhensibles." },
          a: true,
          explanation: {
            de: "Transparenz: Infos sollen leicht zugänglich und in klarer Sprache sein.",
            en: "Transparency: information should be accessible and in clear language.",
            fr: "Transparence : les informations doivent être accessibles et rédigées dans un langage clair.",
          },
          wusstest: {
            de: "Absichtlich verwirrte Texte = Red Flag.",
            en: "Intentionally confusing texts are a red flag.",
            fr: "Les textes intentionnellement confus sont un signal d'alarme.",
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
          q: { de: "Was ist „Datenübertragbarkeit“?", en: "What is “data portability”?", fr: "Qu'est-ce que la « portabilité des données » ?" },
          choices: [
            { de: "Daten in nutzbarem Format bekommen und mitnehmen", en: "Get data in a usable format and move it", fr: "Obtenir les données dans un format utilisable et les transférer" },
            { de: "Daten öffentlich teilen müssen", en: "Having to share data publicly", fr: "Devoir partager les données publiquement" },
            { de: "Daten nie exportieren dürfen", en: "Never being allowed to export data", fr: "Ne jamais être autorisé à exporter des données" },
          ],
          a: 0,
          explanation: {
            de: "Du kannst bestimmte Daten in einem gängigen Format erhalten (und ggf. übertragen).",
            en: "You can receive certain data in a common format (and possibly transfer it).",
            fr: "Vous pouvez recevoir certaines données dans un format courant (et éventuellement les transférer).",
          },
          wusstest: {
            de: "Hilft gegen Lock-in: Anbieterwechsel wird leichter.",
            en: "Reduces lock-in: switching providers becomes easier.",
            fr: "Réduit le verrouillage : changer de fournisseur devient plus facile.",
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
          q: { de: "Mail: „Wir hatten eine Datenpanne. Ändere sofort dein Passwort.“ Was ist sicher?", en: "Email: “We had a breach. Change your password now.” What’s safest?", fr: "Email : « Nous avons eu une violation de données. Changez immédiatement votre mot de passe. » Quelle est la solution la plus sûre ?" },
          choices: [
            { de: "Link in der Mail klicken", en: "Click the email link", fr: "Cliquer sur le lien dans l'email" },
            { de: "Website/App direkt öffnen (nicht über Link)", en: "Open the site/app directly (not via link)", fr: "Ouvrir le site/l'application directement (pas via le lien)" },
            { de: "Ignorieren", en: "Ignore it", fr: "Ignorer" },
          ],
          a: 1,
          explanation: {
            de: "Mails können gefälscht sein. Nutze direkten Weg (App/URL) statt Link.",
            en: "Emails can be spoofed. Use direct paths (app/typed URL) instead of links.",
            fr: "Les emails peuvent être falsifiés. Utilisez des chemins directs (application/URL saisie) au lieu des liens.",
          },
          wusstest: {
            de: "Wenn du Passwort wiederverwendest: überall ändern.",
            en: "If you reused the password: change it everywhere.",
            fr: "Si vous avez réutilisé le mot de passe : changez-le partout.",
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
          q: { de: "Was bedeutet „Integrität & Vertraulichkeit“?", en: "What does “integrity & confidentiality” mean?", fr: "Que signifie « intégrité et confidentialité » ?" },
          choices: [
            { de: "Daten müssen angemessen geschützt werden", en: "Data must be protected appropriately", fr: "Les données doivent être protégées de manière appropriée" },
            { de: "Daten dürfen frei herumliegen", en: "Data can be left unprotected", fr: "Les données peuvent être laissées sans protection" },
            { de: "Daten sind nur Marketing-Sache", en: "Data is just marketing", fr: "Les données ne sont qu'une question de marketing" },
          ],
          a: 0,
          explanation: {
            de: "Schutz vor unbefugtem Zugriff, Verlust oder Manipulation.",
            en: "Protection against unauthorized access, loss, or tampering.",
            fr: "Protection contre l'accès non autorisé, la perte ou la falsification.",
          },
          wusstest: {
            de: "Das umfasst technische UND organisatorische Maßnahmen.",
            en: "This includes technical AND organizational measures.",
            fr: "Cela inclut des mesures techniques ET organisationnelles.",
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
          q: { de: "Wenn du etwas öffentlich postest, ist es automatisch risikolos.", en: "If you post something publicly, it’s automatically risk-free.", fr: "Si vous publiez quelque chose publiquement, est-ce automatiquement sans risque ?" },
          a: false,
          explanation: {
            de: "Öffentliche Infos können für Profiling, Scams oder Doxxing missbraucht werden.",
            en: "Public data can be misused for profiling, scams, or doxxing.",
            fr: "Les informations publiques peuvent être utilisées à des fins de profilage, d'escroqueries ou de doxxing.",
          },
          wusstest: {
            de: "Privatsphäre ist auch Kontext: Freunde ≠ Öffentlichkeit.",
            en: "Privacy is contextual: friends ≠ the whole internet.",
            fr: "La vie privée est contextuelle : amis ≠ le grand public.",
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
          q: { de: "Eine Freundin will ein Foto von dir posten. Du willst das nicht. Was ist fair?", en: "A friend wants to post a photo of you. You don’t want that. What’s fair?", fr: "Une amie veut publier une photo de vous. Vous ne voulez pas. Qu'est-ce qui est juste ?" },
          choices: [
            { de: "Nichts sagen", en: "Say nothing", fr: "Ne rien dire" },
            { de: "Sagen, dass du das nicht willst und um Nicht-Posten bitten", en: "Say you’re not okay with it and ask them not to post", fr: "Dire que vous n'êtes pas d'accord et demander de ne pas publier" },
            { de: "Sofort blockieren", en: "Block immediately", fr: "Bloquer immédiatement" },
          ],
          a: 1,
          explanation: {
            de: "Einverständnis + Kommunikation ist der beste erste Schritt.",
            en: "Consent + communication is the best first step.",
            fr: "Le consentement + la communication sont la meilleure première étape.",
          },
          wusstest: {
            de: "Gute digitale Kultur: erst fragen, dann posten.",
            en: "Good digital culture: ask before posting.",
            fr: "Bonne culture numérique : demander avant de publier.",
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
          q: { de: "Welche Info ist am riskantesten zu teilen?", en: "Which info is riskiest to share?", fr: "Quelle information est la plus risquée à partager ?" },
          choices: [
            { de: "Voller Name + Geburtsdatum + Adresse", en: "Full name + birthdate + address", fr: "Nom complet + date de naissance + adresse" },
            { de: "Lieblingsfilm", en: "Favorite movie", fr: "Film préféré" },
            { de: "Hobby", en: "Hobby", fr: "Passe-temps" },
          ],
          a: 0,
          explanation: {
            de: "Kombis aus Identitätsdaten erleichtern Identitätsdiebstahl.",
            en: "Combining identity data makes identity theft easier.",
            fr: "La combinaison de données d'identité facilite le vol d'identité.",
          },
          wusstest: {
            de: "Mosaik-Effekt: kleine Infos zusammen werden gefährlich.",
            en: "Mosaic effect: small bits combined become risky.",
            fr: "Effet mosaïque : de petites informations combinées deviennent risquées.",
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
          q: { de: "Standortdaten können Routinen sichtbar machen.", en: "Location data can reveal routines.", fr: "Les données de localisation peuvent révéler des routines." },
          a: true,
          explanation: {
            de: "Standorte können Wohnort, Schule/Job, Zeiten und Gewohnheiten zeigen.",
            en: "Locations can reveal home, school/work, times, and habits.",
            fr: "Les emplacements peuvent révéler le domicile, l'école/le travail, les horaires et les habitudes.",
          },
          wusstest: {
            de: "Nutze ungefähren Standort oder teile nur mit vertrauten Personen.",
            en: "Use approximate location or share only with trusted people.",
            fr: "Utilisez un emplacement approximatif ou partagez uniquement avec des personnes de confiance.",
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
          q: { de: "Was ist datenschutzfreundlicher?", en: "What is more privacy-friendly?", fr: "Qu'est-ce qui est plus respectueux de la vie privée ?" },
          choices: [
            { de: "Alles öffentlich, damit’s einfacher ist", en: "Everything public for convenience", fr: "Tout public pour plus de commodité" },
            { de: "Private Defaults + gezielt freigeben", en: "Private defaults + share intentionally", fr: "Paramètres privés par défaut + partage intentionnel" },
            { de: "Passwort im Profil speichern", en: "Store password in profile", fr: "Stocker le mot de passe dans le profil" },
          ],
          a: 1,
          explanation: {
            de: "Sichere Standard-Einstellungen reduzieren Risiko; später kannst du bewusst teilen.",
            en: "Safe defaults reduce risk; you can intentionally share later.",
            fr: "Des paramètres par défaut sécurisés réduisent le risque ; vous pouvez partager intentionnellement plus tard.",
          },
          wusstest: {
            de: "„Privacy by Default“ ist ein Grundprinzip guter Produkte.",
            en: "“Privacy by Default” is a core principle of good products.",
            fr: "« Privacy by Default » est un principe fondamental des bons produits.",
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
          q: { de: "Ein Gewinnspiel will viele Daten. Was ist klug?", en: "A giveaway asks for lots of data. What’s smart?", fr: "Un concours demande beaucoup de données. Qu'est-ce qui est intelligent ?" },
          choices: [
            { de: "Alles geben – sonst kein Gewinn", en: "Give everything — otherwise no win", fr: "Tout donner — sinon pas de gain" },
            { de: "Anbieter/Impressum prüfen, Pflichtfelder hinterfragen, ggf. nicht teilnehmen", en: "Check provider/imprint, question required fields, maybe skip", fr: "Vérifier le fournisseur/mentions légales, remettre en question les champs obligatoires, éventuellement ne pas participer" },
            { de: "Daten in Kommentare posten", en: "Post data in comments", fr: "Publier des données dans les commentaires" },
          ],
          a: 1,
          explanation: {
            de: "Viele Gewinnspiele sind Datensammler. Prüfe Seriosität und Notwendigkeit.",
            en: "Many giveaways are data harvesters. Check legitimacy and necessity.",
            fr: "De nombreux concours sont des collecteurs de données. Vérifiez la légitimité et la nécessité.",
          },
          wusstest: {
            de: "Wenn du den Zweck nicht verstehst: lieber lassen.",
            en: "If you don’t understand the purpose: better skip it.",
            fr: "Si vous ne comprenez pas le but : mieux vaut passer.",
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
          q: { de: "Welche Cookie-Banner-Gestaltung ist eine Red Flag?", en: "Which cookie banner design is a red flag?", fr: "Quelle conception de bannière de cookies est un signal d'alerte ?" },
          choices: [
            { de: "„Alles akzeptieren“ riesig, „Ablehnen“ versteckt", en: "Huge “Accept all”, hidden “Reject”", fr: "Gros “Tout accepter”, “Refuser” caché" },
            { de: "Gleichwertige Buttons (Akzeptieren/Ablehnen)", en: "Equal choices (Accept/Reject)", fr: "Boutons équivalents (Accepter/Refuser)" },
            { de: "Klare Zwecke/Details", en: "Clear purposes/details", fr: "Objectifs/détails clairs" },
          ],
          a: 0,
          explanation: {
            de: "Verstecktes Ablehnen ist manipulative Gestaltung (Dark Pattern).",
            en: "Hiding rejection is manipulative design (dark pattern).",
            fr: "Cacher le refus est une conception manipulatrice (dark pattern).",
          },
          wusstest: {
            de: "Fair: Ablehnen sollte genauso leicht sein wie Akzeptieren.",
            en: "Fair: rejecting should be as easy as accepting.",
            fr: "Équitable : refuser devrait être aussi facile qu'accepter.",
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
          q: { de: "Ein Datenleck ist nur wichtig, wenn Passwörter betroffen sind.", en: "A breach only matters if passwords are leaked.", fr: "Une violation de données n'est importante que si des mots de passe sont divulgués." },
          a: false,
          explanation: {
            de: "Auch E-Mail/Adresse/Telefon können für Scams oder Identitätsbetrug genutzt werden.",
            en: "Email/address/phone can also be used for scams or identity fraud.",
            fr: "L'email/l'adresse/le téléphone peuvent également être utilisés pour des escroqueries ou des fraudes d'identité.",
          },
          wusstest: {
            de: "Nach Leaks: Vorsicht bei „Support“-Anrufen/Mails (Social Engineering).",
            en: "After breaches: beware of fake “support” calls/emails (social engineering).",
            fr: "Après des fuites : méfiez-vous des appels/emails de « support » frauduleux (ingénierie sociale).",
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
          q: { de: "Was ist ein Beispiel für sensible Daten?", en: "Which is an example of sensitive data?", fr: "Quel est un exemple de données sensibles ?" },
          choices: [
            { de: "Gesundheitsdaten", en: "Health data", fr: "Données de santé" },
            { de: "Lieblingsfarbe", en: "Favorite color", fr: "Couleur préférée" },
            { de: "Lieblingspizza", en: "Favorite pizza", fr: "Pizza préférée" },
          ],
          a: 0,
          explanation: {
            de: "Bestimmte Datenkategorien (z. B. Gesundheit) sind besonders schützenswert.",
            en: "Certain categories (e.g., health) are especially protected.",
            fr: "Certaines catégories (par ex. santé) sont particulièrement protégées.",
          },
          wusstest: {
            de: "Sensible Daten brauchen meist strengere Bedingungen zur Verarbeitung.",
            en: "Sensitive data typically requires stricter processing conditions.",
            fr: "Les données sensibles nécessitent généralement des conditions de traitement plus strictes.",
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
          q: { de: "Du sollst ein Formular ausfüllen. Es fragt nach „Religion“. Ist das normal?", en: "A form asks for your “religion”. Is that normal?", fr: "Un formulaire demande votre « religion ». Est-ce normal ?" },
          choices: [
            { de: "Ja, immer", en: "Yes, always", fr: "Oui, toujours" },
            { de: "Nur, wenn es wirklich nötig ist und klar begründet", en: "Only if truly necessary and clearly justified", fr: "Seulement si vraiment nécessaire et clairement justifié" },
            { de: "Egal, einfach ausfüllen", en: "Whatever, just fill it", fr: "Peu importe, remplissez simplement" },
          ],
          a: 1,
          explanation: {
            de: "Religion zählt zu sensiblen Daten. Abfrage braucht starke Begründung/Rechtsgrundlage.",
            en: "Religion is sensitive data. Collection needs strong justification/legal basis.",
            fr: "La religion est une donnée sensible. La collecte nécessite une justification solide/base légale.",
          },
          wusstest: {
            de: "Wenn du den Zweck nicht verstehst: nachfragen oder Alternative wählen.",
            en: "If you don’t understand why: ask or choose an alternative.",
            fr: "Si vous ne comprenez pas pourquoi : demandez ou choisissez une alternative.",
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
          q: { de: "Du hast ein Recht darauf, fehlerhafte Daten korrigieren zu lassen.", en: "You have the right to correct inaccurate data.", fr: "Vous avez le droit de faire corriger des données inexactes." },
          a: true,
          explanation: {
            de: "Wenn Daten über dich falsch sind, kannst du Berichtigung verlangen.",
            en: "If data about you is wrong, you can request correction.",
            fr: "Si les données vous concernant sont incorrectes, vous pouvez demander leur correction.",
          },
          wusstest: {
            de: "Das ist wichtig z. B. bei Scoring/Profilen.",
            en: "Important for scoring/profiles, too.",
            fr: "C'est important, par exemple, pour le scoring/les profils.",
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
          q: { de: "Was ist „Profiling“?", en: "What is “profiling”?", fr: "Qu'est-ce que le « profiling » ?" },
          choices: [
            { de: "Automatisierte Auswertung, um Eigenschaften/Interessen vorherzusagen", en: "Automated analysis to predict traits/interests", fr: "Analyse automatisée pour prédire des traits/intérêts" },
            { de: "Ein Passwort ändern", en: "Changing a password", fr: "Changer un mot de passe" },
            { de: "Daten löschen", en: "Deleting data", fr: "Supprimer des données" },
          ],
          a: 0,
          explanation: {
            de: "Profiling nutzt Daten, um Muster zu erkennen und Verhalten/Interessen zu schätzen.",
            en: "Profiling uses data to detect patterns and infer behavior/interests.",
            fr: "Le profiling utilise des données pour détecter des motifs et inférer des comportements/intérêts.",
          },
          wusstest: {
            de: "Profiling ist oft Basis für personalisierte Werbung — oder Risiko bei unfairen Entscheidungen.",
            en: "Profiling powers personalization — and can risk unfair decisions.",
            fr: "Le profiling est souvent à la base de la publicité personnalisée — ou d'un risque de décisions injustes.",
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
          q: { de: "Eine App will Zugriff auf Mikrofon „immer“. Du nutzt nur Sprachnachrichten. Was ist sinnvoll?", en: "An app wants microphone access “always”. You only use voice messages. Best?", fr: "Une application veut accéder au microphone « toujours ». Vous n'utilisez que des messages vocaux. Que faire ?" },
          choices: [
            { de: "Immer erlauben", en: "Allow always", fr: "Toujours autoriser" },
            { de: "Nur beim Verwenden erlauben", en: "Allow only while using", fr: "Autoriser uniquement lors de l'utilisation" },
            { de: "Mikrofon aus, App löschen", en: "Disable mic, delete app immediately", fr: "Désactiver le micro, supprimer l'application immédiatement" },
          ],
          a: 1,
          explanation: {
            de: "„Nur beim Verwenden“ reduziert Risiko, wenn Dauerzugriff nicht nötig ist.",
            en: "“Only while using” reduces risk if constant access isn’t required.",
            fr: "« Seulement lors de l'utilisation » réduit le risque si l'accès constant n'est pas nécessaire.",
          },
          wusstest: {
            de: "Viele OS bieten granulare Rechte: nutzen!",
            en: "Modern OS permissions are granular — use them.",
            fr: "Les systèmes d'exploitation modernes offrent des permissions granulaires — utilisez-les.",
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
      title: { de: "Sicherheit im Netz", en: "Online Security", fr: "Sécurité en ligne" },
      summary: (ratio) => {
        if (ratio >= 0.8) {
          return {
            de: { title: "🔐 Security-Instinkt: ON!", text: "Du erkennst Betrugsmuster super schnell. Mega!" },
            en: { title: "🔐 Security instincts: ON!", text: "You spot scam patterns super fast. Awesome!" },
            fr: { title: "🔐 Instincts de sécurité : ACTIVÉS !", text: "Vous repérez les schémas de fraude très rapidement. Génial !" },
          };
        }
        if (ratio >= 0.5) {
          return {
            de: { title: "🚦Gute Warnsignale!", text: "Du erkennst vieles — mit ein paar Routinen wirst du noch sicherer." },
            en: { title: "🚦Good warning signals!", text: "You catch many red flags — a few habits will make you even safer." },
            fr: { title: "🚦 Bons signaux d'alerte !", text: "Vous repérez de nombreux drapeaux rouges — quelques habitudes vous rendront encore plus sûr." },
          };
        }
        return {
          de: { title: "🧠 Lernmodus aktiv!", text: "Sicherheit ist Übungssache. Du baust gerade starke Schutzreflexe auf." },
          en: { title: "🧠 Learning mode on!", text: "Security is practice. You’re building strong protective reflexes." },
          fr: { title: "🧠 Mode apprentissage activé !", text: "La sécurité est une question de pratique. Vous êtes en train de développer de forts réflexes de protection." },
        };
      },
      questions: [
        {
          id: "s2_q01",
          type: "mc",
          q: { de: "Was ist Phishing?", en: "What is phishing?", fr: "Qu'est-ce que le phishing ?" },
          choices: [
            { de: "Betrugsversuche mit gefälschten Nachrichten", en: "Scams using fake messages", fr: "Arnaques utilisant de faux messages" },
            { de: "Ein Verschlüsselungsverfahren", en: "An encryption method", fr: "Une méthode de chiffrement" },
            { de: "Ein Antivirus", en: "An antivirus", fr: "Un antivirus" },
          ],
          a: 0,
          explanation: {
            de: "Phishing will dich auf Fake-Seiten locken oder zu Handlungen drängen, um Daten zu stehlen.",
            en: "Phishing tricks you into fake sites/actions to steal data.",
            fr: "Le phishing vous incite à visiter de faux sites ou à effectuer des actions pour voler des données.",
          },
          wusstest: {
            de: "Phishing gibt’s auch per SMS (Smishing) und Telefon (Vishing).",
            en: "Phishing also happens via SMS (smishing) and calls (vishing).",
            fr: "Le phishing existe également par SMS (smishing) et par téléphone (vishing).",
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
          q: { de: "Du erhältst diese E-Mail. Echt oder Phishing?", en: "You receive this email. Real or phishing?", fr: "Vous recevez cet e-mail. Vrai ou phishing ?" },
          image: "../assets/images/paypal-phishing.png",
          choices: [{ de: "Echt", en: "Real", fr: "Vrai" }, { de: "Phishing", en: "Phishing", fr: "Phishing" }],
          a: 1,
          explanation: {
            de:
              "Sehr wahrscheinlich Phishing:\n• Druck/Angst\n• Unpersönliche Anrede\n• Verdächtiger Link\n• Unstimmiges Layout",
            en:
              "Very likely phishing:\n• Urgency/fear\n• Generic greeting\n• Suspicious link\n• Off layout",
            fr:
              "Très probablement du phishing :\n• Urgence/peur\n• Salutation générique\n• Lien suspect\n• Mise en page incorrecte",
          },
          wusstest: {
            de: "Sicher: App öffnen oder URL selbst tippen — nie über Mail-Button.",
            en: "Safer: open the app or type the URL — never via email button.",
            fr: "Plus sûr : ouvrez l'application ou tapez l'URL — jamais via le bouton de l'e-mail.",
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
            fr: "Vous arrivez sur une page de connexion qui semble légèrement étrange. Que faites-vous ?"
          },
          image: "", // optionally add a screenshot: "../assets/images/fake-login.png"
          choices: [
            { de: "Passwort eingeben – wird schon passen", en: "Enter password — probably fine", fr: "Entrer le mot de passe — probablement correct" },
            { de: "URL prüfen / schließen / direkt über App oder Bookmark öffnen", en: "Check URL / close / open via app or bookmark", fr: "Vérifier l'URL / fermer / ouvrir via l'application ou le favori" },
            { de: "Passwort an Support mailen", en: "Email password to support", fr: "Envoyer le mot de passe au support" },
          ],
          a: 1,
          explanation: {
            de: "Fake-Login-Seiten sehen oft fast echt aus. Entscheidend ist die Domain (nicht nur das Design).",
            en: "Fake login pages can look real. The domain is the key signal (not only design).",
            fr: "Les pages de connexion factices peuvent sembler réelles. Le domaine est le signal clé (pas seulement le design)."
          },
          wusstest: {
            de: "HTTPS/Schloss ≠ echte Seite. Auch Phishing kann HTTPS haben.",
            en: "HTTPS/padlock ≠ legitimate site. Phishing can also use HTTPS.",
            fr: "HTTPS/cadenas ≠ site légitime. Le phishing peut également utiliser HTTPS."
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
          q: { de: "Warum ist Passwort-Wiederverwendung riskant?", en: "Why is password reuse risky?", fr: "Pourquoi la réutilisation des mots de passe est-elle risquée ?" },
          choices: [
            { de: "Ein Leak bei Dienst A gefährdet auch Dienst B", en: "A leak on service A endangers service B", fr: "Une fuite sur le service A met également en danger le service B" },
            { de: "Es ist schneller beim Einloggen", en: "It’s faster to log in", fr: "C'est plus rapide pour se connecter" },
            { de: "Es spart Speicherplatz", en: "It saves storage", fr: "Cela économise de l'espace de stockage" },
          ],
          a: 0,
          explanation: {
            de: "Angreifer testen geleakte Logins auf vielen Seiten (Credential Stuffing).",
            en: "Attackers try leaked logins across many sites (credential stuffing).",
            fr: "Les attaquants testent les identifiants divulgués sur de nombreux sites (remplissage d'identifiants)."
          },
          wusstest: {
            de: "Passwort-Manager = 1 starkes Master-Passwort + einzigartige Passwörter überall.",
            en: "Password manager = one strong master password + unique passwords everywhere.",
            fr: "Gestionnaire de mots de passe = un mot de passe maître fort + des mots de passe uniques partout."
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
          q: { de: "2FA (Zwei-Faktor) erhöht die Kontosicherheit.", en: "2FA increases account security.", fr: "La 2FA augmente la sécurité du compte." },
          a: true,
          explanation: {
            de: "2FA fügt eine zweite Hürde hinzu. Selbst bei Passwort-Leak bleibt das Konto besser geschützt.",
            en: "2FA adds a second barrier. Even if a password leaks, the account is better protected.",
            fr: "La 2FA ajoute une deuxième barrière. Même si un mot de passe fuit, le compte est mieux protégé."
          },
          wusstest: {
            de: "Authenticator-Apps sind oft sicherer als SMS.",
            en: "Authenticator apps are often safer than SMS.",
            fr: "Les applications d'authentification sont souvent plus sûres que les SMS."
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
          q: { de: "Was ist Smishing?", en: "What is smishing?", fr: "Qu'est-ce que le smishing ?" },
          choices: [
            { de: "Phishing per SMS/Chat", en: "Phishing via SMS/messages", fr: "Hameçonnage via SMS/messages" },
            { de: "Ein WLAN-Standard", en: "A Wi-Fi standard", fr: "Une norme Wi-Fi" },
            { de: "Ein Backup", en: "A backup", fr: "Une sauvegarde" },
          ],
          a: 0,
          explanation: {
            de: "Smishing nutzt SMS/Chats, um dich zu Links oder Preisgabe von Daten zu verleiten.",
            en: "Smishing uses SMS/messages to push you to links or data disclosure.",
            fr: "Le smishing utilise des SMS/messages pour vous inciter à cliquer sur des liens ou à divulguer des informations."
          },
          wusstest: {
            de: "Typisch: Paket-Benachrichtigung oder „Konto gesperrt“.",
            en: "Typical: parcel alerts or “account locked”.",
            fr: "Typique : alertes de colis ou « compte verrouillé »."
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
          q: { de: "Das Schloss-Symbol (HTTPS) garantiert, dass eine Seite echt ist.", en: "The padlock (HTTPS) guarantees a site is legitimate.", fr: "Le symbole de cadenas (HTTPS) garantit que le site est légitime." },
          a: false,
          explanation: {
            de: "HTTPS schützt die Verbindung, nicht die Identität der Website. Fake-Seiten können HTTPS haben.",
            en: "HTTPS secures the connection, not the site’s legitimacy. Phishing sites can have HTTPS.",
            fr: "HTTPS sécurise la connexion, pas la légitimité du site. Les sites de phishing peuvent avoir HTTPS."
          },
          wusstest: {
            de: "Achte auf die Domain: paypaI.com (i) vs paypal.com (l) ist ein Klassiker.",
            en: "Watch the domain: paypaI.com (i) vs paypal.com (l) is classic.",
            fr: "Faites attention au domaine : paypaI.com (i) vs paypal.com (l) est un classique."
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
          q: { de: "Welche Passwort-Option ist am stärksten?", en: "Which password is strongest?", fr: "Quel mot de passe est le plus fort ?" },
          choices: [
            { de: "Sommer2026!", en: "Summer2026!", fr: "Été2026 !" },
            { de: "P@ssw0rd", en: "P@ssw0rd", fr: "P@ssw0rd" },
            { de: "Eine lange Passphrase mit mehreren Wörtern", en: "A long multi-word passphrase", fr: "Une longue phrase de passe avec plusieurs mots" },
          ],
          a: 2,
          explanation: {
            de: "Lange Passphrases sind oft stärker und leichter zu merken als kurze „komplexe“ Passwörter.",
            en: "Long passphrases are often stronger and easier than short “complex” passwords.",
            fr: "Les longues phrases de passe sont souvent plus fortes et plus faciles à retenir que les mots de passe courts « complexes »."
          },
          wusstest: {
            de: "Noch besser: Passwort-Manager + zufällige Passwörter.",
            en: "Even better: password manager + random passwords.",
            fr: "Encore mieux : gestionnaire de mots de passe + mots de passe aléatoires."
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
          q: { de: "Öffentliches WLAN im Café: Was ist am sichersten?", en: "Public café Wi-Fi: what’s safest?", fr: "Wi-Fi public dans un café : quelle est la solution la plus sûre ?" },
          choices: [
            { de: "Online-Banking ohne extra Schutz", en: "Online banking without extra protection", fr: "Banque en ligne sans protection supplémentaire" },
            { de: "VPN nutzen oder Hotspot verwenden", en: "Use a VPN or your mobile hotspot", fr: "Utiliser un VPN ou votre point d'accès mobile" },
            { de: "Passwörter in Notizen kopieren", en: "Copy passwords into notes", fr: "Copier les mots de passe dans des notes" },
          ],
          a: 1,
          explanation: {
            de: "Öffentliche WLANs können unsicher sein. VPN oder eigener Hotspot reduziert Risiken.",
            en: "Public Wi-Fi can be risky. VPN or hotspot reduces exposure.",
            fr: "Les Wi-Fi publics peuvent être risqués. Un VPN ou un point d'accès réduit l'exposition.",
          },
          wusstest: {
            de: "Auto-Connect deaktivieren, sonst verbindet sich dein Handy später wieder automatisch.",
            en: "Disable auto-connect so your phone won’t rejoin automatically.",
            fr: "Désactivez la connexion automatique pour que votre téléphone ne se reconnecte pas automatiquement.",
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
          q: { de: "Mail von „Chef“: „Bitte sofort 2.000€ überweisen.“ Was tust du?", en: "Email from “boss”: “Transfer €2,000 now.” What do you do?", fr: "Email du « patron » : « Transférez 2 000 € maintenant. » Que faites-vous ?" },
          choices: [
            { de: "Sofort zahlen", en: "Pay immediately", fr: "Payer immédiatement" },
            { de: "Rückruf über bekannte Nummer / zweite Bestätigung", en: "Call back using a known number / verify", fr: "Rappeler en utilisant un numéro connu / vérifier" },
            { de: "An alle weiterleiten", en: "Forward to everyone", fr: "Transférer à tout le monde" },
          ],
          a: 1,
          explanation: {
            de: "CEO-Fraud/BEC: immer über sicheren Kanal verifizieren (Rückruf, internes Verfahren).",
            en: "CEO fraud/BEC: always verify via a trusted channel (call back, internal process).",
            fr: "Fraude au PDG/BEC : toujours vérifier via un canal de confiance (rappel, processus interne).",
          },
          wusstest: {
            de: "Druck + Geheimhaltung + schnelle Zahlung = starke Red Flags.",
            en: "Urgency + secrecy + fast payment = major red flags.",
            fr: "Urgence + secret + paiement rapide = signaux d'alerte majeurs.",
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
          q: { de: "Was ist Social Engineering?", en: "What is social engineering?", fr: "Qu'est-ce que l'ingénierie sociale ?" },
          choices: [
            { de: "Menschen manipulieren, um an Infos/Zugänge zu kommen", en: "Manipulating people to obtain info/access", fr: "Manipuler les gens pour obtenir des informations/accès" },
            { de: "Ein Programmierstil", en: "A programming style", fr: "Un style de programmation" },
            { de: "Ein Antivirus-Scan", en: "An antivirus scan", fr: "Un scan antivirus" },
          ],
          a: 0,
          explanation: {
            de: "Angriffe zielen oft auf Menschen (Druck, Angst, Autorität), nicht auf Technik.",
            en: "Attacks often target people (pressure, fear, authority), not just tech.",
            fr: "Les attaques ciblent souvent les personnes (pression, peur, autorité), pas seulement la technologie.",
          },
          wusstest: {
            de: "„Können Sie kurz…?“ + Zeitdruck ist ein typisches Muster.",
            en: "“Can you quickly…?” + urgency is a common pattern.",
            fr: "« Pouvez-vous rapidement… ? » + urgence est un schéma courant.",
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
          q: { de: "Updates sind wichtig, weil sie oft Sicherheitslücken schließen.", en: "Updates are important because they often fix security vulnerabilities.", fr: "Les mises à jour sont importantes car elles corrigent souvent des vulnérabilités de sécurité." },
          a: true,
          explanation: {
            de: "Updates patchen bekannte Schwachstellen, die sonst ausgenutzt werden können.",
            en: "Updates patch known weaknesses that could otherwise be exploited.",
            fr: "Les mises à jour corrigent les faiblesses connues qui pourraient autrement être exploitées.",
          },
          wusstest: {
            de: "Automatische Updates sparen Zeit und erhöhen Sicherheit.",
            en: "Automatic updates save time and improve security.",
            fr: "Les mises à jour automatiques font gagner du temps et améliorent la sécurité.",
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
          q: { de: "Was ist ein sicherer Umgang mit Links in Mails?", en: "What’s a safe way to handle links in emails?", fr: "Quelle est une manière sûre de gérer les liens dans les e-mails ?" },
          choices: [
            { de: "Links blind anklicken", en: "Click blindly", fr: "Cliquer aveuglément" },
            { de: "URL prüfen / Service direkt öffnen statt klicken", en: "Check URL / open service directly instead of clicking", fr: "Vérifier l'URL / ouvrir le service directement au lieu de cliquer" },
            { de: "Link an Freunde schicken", en: "Send link to friends", fr: "Envoyer le lien à des amis" },
          ],
          a: 1,
          explanation: {
            de: "Direkt öffnen (App/Bookmark) reduziert das Risiko, auf Fake-Seiten zu landen.",
            en: "Opening directly (app/bookmark) reduces the risk of landing on fake sites.",
            fr: "Ouvrir directement (application/marque-page) réduit le risque d'atterrir sur des sites faux.",
          },
          wusstest: {
            de: "Hover über Link zeigt oft die echte Zieladresse (Desktop).",
            en: "Hovering a link often reveals the real destination (desktop).",
            fr: "Survoler un lien révèle souvent la vraie destination (bureau)."
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
          q: { de: "Du bekommst einen SMS-Code, obwohl du dich nirgendwo eingeloggt hast. Was bedeutet das?", en: "You receive an SMS code although you didn’t log in. What does it mean?", fr: "Vous recevez un code SMS alors que vous ne vous êtes connecté nulle part. Que signifie cela ?" },
          choices: [
            { de: "Alles okay", en: "All good", fr: "Tout va bien" },
            { de: "Jemand versucht sich einzuloggen – sofort Passwort ändern", en: "Someone may be trying to log in — change password immediately", fr: "Quelqu'un essaie peut-être de se connecter — changez immédiatement le mot de passe" },
            { de: "Code posten, damit andere helfen", en: "Post the code so others can help", fr: "Publiez le code pour que d'autres puissent aider" },
          ],
          a: 1,
          explanation: {
            de: "Das kann ein Login-Versuch sein. Passwort ändern und Security-Check machen.",
            en: "This can indicate a login attempt. Change password and review security.",
            fr: "Cela peut indiquer une tentative de connexion. Changez le mot de passe et vérifiez la sécurité.",
          },
          wusstest: {
            de: "Codes sind wie Schlüssel: niemals weitergeben.",
            en: "Codes are like keys: never share them.",
            fr: "Les codes sont comme des clés : ne les partagez jamais.",
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
          q: { de: "Ein Passwort-Manager kann Sicherheit erhöhen.", en: "A password manager can increase security.", fr: "Un gestionnaire de mots de passe peut augmenter la sécurité." },
          a: true,
          explanation: {
            de: "Er hilft, einzigartige starke Passwörter zu nutzen, ohne sie zu merken.",
            en: "It helps you use unique strong passwords without memorizing them.",
            fr: "Il vous aide à utiliser des mots de passe uniques et forts sans les mémoriser.",
          },
          wusstest: {
            de: "Aktiviere 2FA auch für den Passwort-Manager selbst.",
            en: "Enable 2FA for the password manager itself.",
            fr: "Activez également la 2FA pour le gestionnaire de mots de passe lui-même.",
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
          q: { de: "Was ist ein guter Hinweis auf eine Fake-Mail?", en: "What’s a common sign of a fake email?", fr: "Quel est un signe courant d'un e-mail frauduleux ?" },
          choices: [
            { de: "Druck („sofort handeln!“) + Drohungen", en: "Urgency (“act now!”) + threats", fr: "Urgence (« agissez maintenant ! ») + menaces" },
            { de: "Korrekte Ansprache mit vollem Namen", en: "Correct greeting with your full name", fr: "Salutation correcte avec votre nom complet" },
            { de: "Kein Link enthalten", en: "No link included", fr: "Aucun lien inclus" },
          ],
          a: 0,
          explanation: {
            de: "Phishing arbeitet oft mit Stress, Angst oder Zeitdruck, damit du nicht nachdenkst.",
            en: "Phishing often uses stress or urgency so you don’t think.",
            fr: "Le phishing utilise souvent le stress ou l'urgence pour que vous ne réfléchissiez pas.",
          },
          wusstest: {
            de: "Auch echte Firmen setzen selten „24h sonst…“. Das ist verdächtig.",
            en: "Legit companies rarely do “24h or else…”. That’s suspicious.",
            fr: "Même les entreprises légitimes utilisent rarement « 24h sinon… ». C'est suspect.",
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
          q: { de: "Du nutzt dasselbe Passwort überall. Was ist die beste Verbesserung?", en: "You use the same password everywhere. Best improvement?", fr: "Vous utilisez le même mot de passe partout. Quelle est la meilleure amélioration ?" },
          choices: [
            { de: "Passwort nur minimal ändern (…1, …2)", en: "Slightly change it (…1, …2)", fr: "Le changer légèrement (…1, …2)" },
            { de: "Passwort-Manager + überall einzigartige Passwörter", en: "Password manager + unique passwords everywhere", fr: "Gestionnaire de mots de passe + mots de passe uniques partout" },
            { de: "Passwort aufschreiben und posten", en: "Write it down and post it", fr: "Écrire le mot de passe et le publier" },
          ],
          a: 1,
          explanation: {
            de: "Einzigartige Passwörter verhindern, dass ein Leak alles kompromittiert.",
            en: "Unique passwords prevent one leak from compromising everything.",
            fr: "Des mots de passe uniques empêchent qu'une fuite compromette tout.",
          },
          wusstest: {
            de: "„…1, …2“ ist für Angreifer leicht zu erraten.",
            en: "“…1, …2” patterns are easy for attackers to guess.",
            fr: "Les modèles « …1, …2 » sont faciles à deviner pour les attaquants.",
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
          q: { de: "Regelmäßige Backups helfen bei Ransomware.", en: "Regular backups help against ransomware.", fr: "Des sauvegardes régulières aident contre les ransomwares." },
          a: true,
          explanation: {
            de: "Backups ermöglichen Wiederherstellung, auch wenn Daten verschlüsselt werden.",
            en: "Backups enable recovery even if data gets encrypted.",
            fr: "Les sauvegardes permettent la récupération même si les données sont chiffrées.",
          },
          wusstest: {
            de: "3-2-1 Regel: 3 Kopien, 2 Medien, 1 offline/offsite.",
            en: "3-2-1 rule: 3 copies, 2 media types, 1 offline/offsite.",
            fr: "Règle 3-2-1 : 3 copies, 2 types de supports, 1 hors ligne/hors site.",
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
          q: { de: "Was ist eine gute Geräte-Sperre?", en: "What’s a good device lock?", fr: "Quel est un bon verrouillage d'appareil ?" },
          choices: [
            { de: "PIN/Passcode oder Biometrie", en: "PIN/passcode or biometrics", fr: "PIN/code ou biométrie" },
            { de: "Kein Sperrbildschirm", en: "No lock screen", fr: "Pas d'écran de verrouillage" },
            { de: "1234", en: "1234", fr: "1234" },
          ],
          a: 0,
          explanation: {
            de: "Sperren verhindert unbefugten Zugriff, falls das Gerät verloren geht.",
            en: "A lock prevents unauthorized access if the device is lost.",
            fr: "Un verrouillage empêche l'accès non autorisé si l'appareil est perdu.",
          },
          wusstest: {
            de: "Biometrie ist bequem, aber ein starker Passcode bleibt wichtig.",
            en: "Biometrics are convenient, but a strong passcode still matters.",
            fr: "La biométrie est pratique, mais un code fort reste important.",
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
          q: { de: "Du willst eine App installieren. Sie hat sehr viele negative Bewertungen zu „Betrug“. Was tust du?", en: "You want to install an app. Many reviews mention “scam”. What do you do?", fr: "Vous voulez installer une application. De nombreux avis mentionnent « arnaque ». Que faites-vous ?" },
          choices: [
            { de: "Trotzdem installieren", en: "Install anyway", fr: "Installer quand même" },
            { de: "Alternative suchen / Quelle prüfen", en: "Look for alternatives / verify the source", fr: "Chercher des alternatives / vérifier la source" },
            { de: "App kaufen, um sicher zu sein", en: "Buy it to be safe", fr: "Acheter l'application pour être sûr" },
          ],
          a: 1,
          explanation: {
            de: "Bewertungen sind nicht perfekt, aber viele Scam-Hinweise sind ein starkes Warnsignal.",
            en: "Reviews aren’t perfect, but repeated scam reports are a strong warning sign.",
            fr: "Les avis ne sont pas parfaits, mais de nombreux signalements d'arnaque sont un fort signal d'alerte.",
          },
          wusstest: {
            de: "Achte auch auf Berechtigungen und Entwicklerinfos im Store.",
            en: "Also check permissions and developer details in the store.",
            fr: "Vérifiez également les autorisations et les informations sur le développeur dans le magasin.",
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

    3: { title: { de: "Künstliche Intelligenz", en: "Artificial Intelligence", fr: "Intelligence Artificielle" }, 
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
                fr: {
                  title: "🤖 Compas IA : très clair !",
                  text: "Vous voyez à la fois les avantages et les risques — cet équilibre est important.",
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
                fr: {
                  title: "🧭 Bonne orientation !",
                  text: "Vous êtes critique mais ouvert d'esprit — plus d'exemples affineront cela.",
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
              fr: {
                title: "🌟 Restez curieux !",
                text: "L'IA peut sembler magique — mais vous apprenez à regarder plus profondément.",
              },
            };
          },
         questions: [
           {
              id: "ai_q01",
              type: "mc",
              q: { de: "Was ist Hochrisiko-KI?", en: "What is high-risk AI?", fr: "Qu'est-ce que l'IA à haut risque ?" },
              choices: [
                { de: "KI in sensiblen Bereichen (Gesundheit, Bildung, Jobs)", en: "AI in sensitive areas (health, education, jobs)", fr: "IA dans des domaines sensibles (santé, éducation, emploi)" },
                { de: "Alle Chatbots", en: "All chatbots", fr: "Tous les chatbots" },
                { de: "Nur Spiele-KI", en: "Only game AI", fr: "Seulement l'IA de jeu" },
              ],
              a: 0,
              explanation: {
                de: "Hochrisiko-KI kann wichtige Lebensentscheidungen beeinflussen und braucht stärkere Kontrollen.",
                en: "High-risk AI can affect key life decisions and needs stronger controls.",
                fr: "L'IA à haut risque peut influencer des décisions de vie importantes et nécessite des contrôles plus stricts.",
              },
              wusstest: {
                de: "Wichtige Punkte: Tests, Dokumentation, menschliche Aufsicht.",
                en: "Key points: testing, documentation, human oversight.",
                fr: "Points clés : tests, documentation, supervision humaine.",
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
                fr: "Une vidéo montre une personne célèbre disant quelque chose d'extrême — sans source. Que faites-vous ?",
              },
              choices: [
                { de: "Sofort teilen", en: "Share immediately", fr: "Partager immédiatement" },
                { de: "Quelle prüfen / Original suchen / seriöse Bestätigungen", en: "Verify source / find original / reputable confirmations", fr: "Vérifier la source / trouver l'original / confirmations fiables" },
                { de: "Kommentar: „echt??“", en: "Comment: “is it real??”", fr: "Commentaire : « c'est réel ?? »" },
              ],
              a: 1,
              explanation: {
                de: "Deepfakes wirken real. Ohne Quelle: erst verifizieren, dann reagieren.",
                en: "Deepfakes can look real. Without a source: verify first, react later.",
                fr: "Les deepfakes peuvent sembler réels. Sans source : vérifiez d'abord, réagissez ensuite.",
              },
              wusstest: {
                de: "Reverse Image Search + Fact-Checks helfen schnell.",
                en: "Reverse image search + fact-checks can help quickly.",
                fr: "La recherche d'images inversée + les vérifications des faits peuvent aider rapidement.",
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
              q: { de: "KI kann überzeugend klingen, obwohl Inhalte falsch sind.", en: "AI can sound convincing even when it’s wrong.", fr: "L'IA peut sembler convaincante même lorsque son contenu est incorrect." },
              a: true,
              explanation: {
                de: "Modelle können Fehler halluzinieren. Deshalb: prüfen, nicht blind vertrauen.",
                en: "Models can hallucinate errors. Verify instead of trusting blindly.",
                fr: "Les modèles peuvent halluciner des erreurs. Vérifiez au lieu de faire confiance aveuglément.",
              },
              wusstest: {
                de: "Guter Trick: nach Quellen fragen und diese wirklich checken.",
                en: "Good trick: ask for sources and actually check them.",
                fr: "Astuce : demandez des sources et vérifiez-les réellement.",
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
              q: { de: "Was ist ein „Bias“ in KI-Systemen?", en: "What is “bias” in AI systems?", fr: "Qu'est-ce qu'un « biais » dans les systèmes d'IA ?" },
              choices: [
                { de: "Systematische Verzerrung in Daten/Modell, die unfairen Output erzeugt", en: "Systematic skew in data/model causing unfair output", fr: "Biais systématique dans les données/le modèle entraînant un résultat injuste" },
                { de: "Ein Computervirus", en: "A computer virus", fr: "Un virus informatique" },
                { de: "Ein Update", en: "An update", fr: "Une mise à jour" },
              ],
              a: 0,
              explanation: {
                de: "Bias entsteht z. B. durch unausgewogene Trainingsdaten oder Problem-Design.",
                en: "Bias can come from imbalanced training data or problem design.",
                fr: "Le biais peut provenir de données d'entraînement déséquilibrées ou de la conception du problème.",
              },
              wusstest: {
                de: "Bias heißt nicht „böse Absicht“ — oft ist es ein Daten-/Designproblem.",
                en: "Bias isn’t always malicious — often it’s a data/design issue.",
                fr: "Le biais n'est pas toujours malveillant — souvent, c'est un problème de données/conception.",
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
              q: { de: "Ein Bewerbungs-Tool sortiert automatisch Kandidaten. Was ist ein Risiko?", en: "A hiring tool automatically ranks candidates. What’s a risk?", fr: "Un outil de recrutement classe automatiquement les candidats. Quel est le risque ?" },
              choices: [
                { de: "Es spart nur Zeit, sonst nichts", en: "It only saves time, nothing else", fr: "Il ne fait que gagner du temps, rien d'autre" },
                { de: "Es kann unfair diskriminieren, wenn Daten/Bewertung verzerrt sind", en: "It can discriminate unfairly if data/scoring is biased", fr: "Il peut discriminer injustement si les données/l'évaluation sont biaisées" },
                { de: "Es macht Bewerbungen automatisch besser", en: "It automatically improves applications", fr: "Il améliore automatiquement les candidatures" },
              ],
              a: 1,
              explanation: {
                de: "Wenn Daten/Labels verzerrt sind, kann das Tool systematisch benachteiligen.",
                en: "If data/labels are biased, the tool can systematically disadvantage groups.",
                fr: "Si les données/étiquettes sont biaisées, l'outil peut désavantager systématiquement certains groupes.",
              },
              wusstest: {
                de: "Wichtig: Audit, Transparenz, menschliche Kontrolle und Beschwerdemöglichkeiten.",
                en: "Key: audits, transparency, human oversight, and appeal mechanisms.",
                fr: "Important : audits, transparence, supervision humaine et mécanismes de recours.",
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
              q: { de: "Wenn ein KI-System etwas empfiehlt, ist es automatisch objektiv.", en: "If an AI recommends something, it’s automatically objective.", fr: "Si une IA recommande quelque chose, c'est automatiquement objectif." },
              a: false,
              explanation: {
                de: "Empfehlungen hängen von Daten, Zielen und Trainingssignalen ab – das ist nie „neutral“. ",
                en: "Recommendations depend on data, objectives, and signals — never purely “neutral”.",
                fr: "Les recommandations dépendent des données, des objectifs et des signaux — jamais purement « neutres ».",
              },
              wusstest: {
                de: "Frage dich: Wer profitiert? Was ist das Ziel der Empfehlung?",
                en: "Ask: who benefits? what is the objective of the recommendation?",
                fr: "Demande-toi : qui en bénéficie ? quel est l'objectif de la recommandation ?",
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
              q: { de: "Was bedeutet „Transparenz“ bei KI im Alltag?", en: "What does AI transparency mean in everyday life?", fr: "Que signifie la transparence de l'IA dans la vie quotidienne ?" },
              choices: [
                { de: "Du solltest wissen, ob du mit KI interagierst", en: "You should know when you’re interacting with AI", fr: "Vous devriez savoir quand vous interagissez avec une IA" },
                { de: "KI darf nie eingesetzt werden", en: "AI must never be used", fr: "L'IA ne doit jamais être utilisée" },
                { de: "KI soll immer perfekt sein", en: "AI must always be perfect", fr: "L'IA doit toujours être parfaite" },
              ],
              a: 0,
              explanation: {
                de: "Menschen sollten verstehen, ob ein System automatisiert ist und welche Grenzen es hat.",
                en: "People should know when a system is automated and what its limits are.",
                fr: "Les gens devraient savoir quand un système est automatisé et quelles sont ses limites.",
              },
              wusstest: {
                de: "Transparenz hilft, Vertrauen richtig zu dosieren.",
                en: "Transparency helps calibrate trust.",
                fr: "La transparence aide à calibrer la confiance.",
              },
              source: {
                label: "OECD AI Principles (transparency), AI literacy (general)",
                url: "https://www.oecd.org/en/topics/sub-issues/ai-principles.html"
              },
              image: "",
              explanationImage: "",
            },

         ] },

    4: { title: { de: "Digitale Teilhabe & Medienkompetenz", en: "Digital Literacy & Participation", fr: "Compétences numériques et participation" }, 
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
              fr: {
                title: "📰 Filtre à faits : très fort !",
                text: "Vous restez critique, vérifiez les sources et ne vous laissez pas appâter. Excellent.",
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
              fr: {
                title: "✅ Bon contrôle de la réalité !",
                text: "Vous attrapez beaucoup — quelques routines vous rendront inébranlable.",
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
            fr: {
              title: "🔥 Vous développez vos compétences médiatiques !",
              text: "Tout n'est pas vrai en ligne — mais vous apprenez à vérifier. Continuez comme ça !",
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
              fr: "Quel est un bon signe d'une source fiable ?",
            },
            choices: [
              { de: "Autor, Datum, Quellen und Kontakt/Impressum sind sichtbar", en: "Author, date, sources, and contact/imprint are visible", fr: "Auteur, date, sources et contact/mentions légales visibles" },
              { de: "Viele Emojis und CAPS LOCK", en: "Lots of emojis and ALL CAPS", fr: "Beaucoup d'émojis et de MAJUSCULES" },
              { de: "„Teile das sofort!!!“", en: "“Share this NOW!!!”", fr: "“Partagez ça MAINTENANT !!!”" },
            ],
            a: 0,
            explanation: {
              de: "Seriöse Quellen sind transparent: Wer schreibt das? Wann? Mit welchen Belegen?",
              en: "Reliable sources are transparent: who wrote it, when, and what evidence supports it?",
              fr: "Les sources fiables sont transparentes : qui l'a écrit, quand et quelles preuves le soutiennent ?",
            },
            wusstest: {
              de: "Ein Impressum/Kontakt allein reicht nicht — aber fehlende Infos sind eine Red Flag.",
              en: "An imprint/contact alone isn’t enough — but missing info is a red flag.",
              fr: "Un simple imprimé/contact ne suffit pas — mais l'absence d'informations est un signal d'alerte.",
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
              fr: "Publication TikTok : « Cette nouvelle règle s'applique à tout le monde à partir de demain ! » — pas de lien/source. Que fais-tu ?",
            },
            choices: [
              { de: "Speichern & teilen — klingt wichtig", en: "Save & share — sounds important", fr: "Enregistrer et partager — ça semble important" },
              { de: "Quelle suchen (offizielle Stellen/seriöse Medien) bevor du glaubst/teilst", en: "Look for a source (official info/reputable media) before believing/sharing", fr: "Chercher une source (informations officielles/médias réputés) avant de croire/partager" },
              { de: "Kommentieren: „stimmt safe“", en: "Comment: “definitely true”", fr: "Commenter : « c'est sûrement vrai »" },
            ],
            a: 1,
            explanation: {
              de: "Ohne Quelle ist es nur eine Behauptung. Erst verifizieren, dann reagieren.",
              en: "Without a source, it’s just a claim. Verify first, then react.",
              fr: "Sans source, ce n'est qu'une affirmation. Vérifiez d'abord, puis réagissez.",
            },
            wusstest: {
              de: "Schnellcheck: Suchbegriff + offizielle Website + 1–2 seriöse Medien. Keine Quelle = keine Sicherheit.",
              en: "Quick check: search term + official website + 1–2 reputable outlets. No source = no certainty.",
              fr: "Vérification rapide : terme de recherche + site officiel + 1 à 2 médias réputés. Pas de source = pas de certitude.",
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
              fr: "Titre : « Remède secret guérit tout en 24h ! » Quelle est la meilleure réaction ?",
            },
            choices: [
              { de: "Sofort teilen, damit alle es wissen", en: "Share immediately so everyone knows", fr: "Partager immédiatement pour que tout le monde sache" },
              { de: "Quelle prüfen und nach seriösen Bestätigungen suchen", en: "Check the source and look for reputable confirmation", fr: "Vérifier la source et rechercher des confirmations fiables" },
              { de: "Glauben, weil es viele Likes hat", en: "Believe it because it has lots of likes", fr: "Croire parce que ça a beaucoup de likes" },
            ],
            a: 1,
            explanation: {
              de: "Extreme Behauptungen brauchen starke Belege. Likes sind kein Beweis.",
              en: "Extraordinary claims require strong evidence. Likes are not proof.",
              fr: "Les affirmations extraordinaires nécessitent des preuves solides. Les likes ne sont pas une preuve.",
            },
            wusstest: {
              de: "Achte auf: Autor, Datum, Studie/Beleg, Gegenchecks, Kontext.",
              en: "Check: author, date, study/evidence, cross-checks, context.",
              fr: "Faites attention : auteur, date, étude/preuve, vérifications croisées, contexte.",
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
              fr: "Que signifie « contexte » pour le contenu en ligne ?",
            },
            choices: [
              { de: "Wer es sagt, wann, in welchem Zusammenhang und mit welcher Absicht", en: "Who says it, when, in what setting, and with what intent", fr: "Qui le dit, quand, dans quel contexte et avec quelle intention" },
              { de: "Nur die Anzahl der Likes", en: "Only the number of likes", fr: "Seulement le nombre de likes" },
              { de: "Nur die Überschrift", en: "Only the headline", fr: "Seulement le titre" },
            ],
            a: 0,
            explanation: {
              de: "Ohne Kontext wirken Aussagen oft dramatischer oder falscher. Kontext kann Bedeutung komplett ändern.",
              en: "Without context, claims can look more dramatic or misleading. Context can change meaning entirely.",
              fr: "Sans contexte, les affirmations peuvent sembler plus dramatiques ou trompeuses. Le contexte peut changer complètement le sens.",

            },
            wusstest: {
              de: "Viele virale Clips sind „aus dem Zusammenhang gerissen“ (out of context).",
              en: "Many viral clips are “out of context.”",
              fr: "Beaucoup de clips viraux sont « sortis de leur contexte ».",
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
              fr: "Beaucoup de likes signifie automatiquement que quelque chose est vrai.",
            },
            a: false,
            explanation: {
              de: "Likes messen Aufmerksamkeit, nicht Wahrheit. Inhalte können viral gehen, weil sie emotional triggern.",
              en: "Likes measure attention, not truth. Content can go viral because it triggers emotions.",
              fr: "Les likes mesurent l'attention, pas la vérité. Le contenu peut devenir viral parce qu'il déclenche des émotions.",
            },
            wusstest: {
              de: "Algorithmen belohnen oft Engagement — auch bei kontroversen oder falschen Inhalten.",
              en: "Algorithms often reward engagement — even for misleading content.",
              fr: "Les algorithmes récompensent souvent l'engagement — même pour des contenus trompeurs.",
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
              fr: "Qu'est-ce que le « clickbait » ?",
            },
            choices: [
              { de: "Reißerische Überschriften, die Klicks statt Fakten priorisieren", en: "Sensational headlines that prioritize clicks over facts", fr: "Titres sensationnalistes qui privilégient les clics aux faits" },
              { de: "Ein seriöser Faktencheck", en: "A reliable fact-check", fr: "Une vérification des faits fiable" },
              { de: "Ein wissenschaftlicher Artikel", en: "A scientific paper", fr: "Un article scientifique" },
            ],
            a: 0,
            explanation: {
              de: "Clickbait nutzt Neugier/Schock, um Klicks zu erzeugen — oft ohne saubere Belege.",
              en: "Clickbait uses curiosity/shock to generate clicks — often without solid evidence.",
              fr: "Le clickbait utilise la curiosité/le choc pour générer des clics — souvent sans preuves solides.",
            },
            wusstest: {
              de: "Achte auf Formulierungen wie „Du wirst nicht glauben…“ oder „Das sagt dir niemand…“.",
              en: "Watch for phrases like “You won’t believe…” or “They don’t want you to know…”",
              fr: "Faites attention aux formulations comme « Vous ne croirez pas… » ou « Ils ne veulent pas que vous sachiez… »",
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
              fr: "Un post affirme : « Une étude prouve XYZ » — mais ne cite aucune étude. Que fais-tu ?",
            },
            choices: [
              { de: "Glauben, weil „Studie“ seriös klingt", en: "Believe it because “study” sounds credible", fr: "Croire parce que « étude » semble crédible" },
              { de: "Nach der Originalstudie suchen und prüfen", en: "Search for the original study and verify", fr: "Rechercher l'étude originale et vérifier" },
              { de: "Sofort kommentieren: „Fake!“", en: "Immediately comment: “Fake!”", fr: "Commenter immédiatement : « Faux ! »" },
            ],
            a: 1,
            explanation: {
              de: "Ohne Primärquelle ist es nur eine Behauptung. Suche nach der Originalquelle und prüfe Zusammenfassung/Methodik.",
              en: "Without a primary source it’s just a claim. Find the original and check summary/method.",
              fr: "Sans source primaire, ce n'est qu'une affirmation. Trouvez l'original et vérifiez le résumé/la méthode.",
            },
            wusstest: {
              de: "Viele Posts zitieren Studien falsch oder lassen Einschränkungen weg.",
              en: "Many posts misquote studies or omit limitations.",
              fr: "Beaucoup de posts citent mal les études ou omettent des limitations.",
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
              fr: "Qu'est-ce qu'une « source primaire » ?",
            },
            choices: [
              { de: "Das Originaldokument/Originalaussage (z. B. Studie, Gesetz, Rede)", en: "The original document/statement (e.g., study, law, speech)", fr: "Le document/la déclaration originale (par ex. étude, loi, discours)" },
              { de: "Ein Meme darüber", en: "A meme about it", fr: "Un mème à ce sujet" },
              { de: "Ein Kommentar-Thread", en: "A comment thread", fr: "Un fil de commentaires" },
            ],
            a: 0,
            explanation: {
              de: "Primärquellen sind die Basis, bevor andere interpretieren oder zuspitzen.",
              en: "Primary sources are the base before others interpret or exaggerate.",
              fr: "Les sources primaires sont la base avant que d'autres n'interprètent ou n'exagèrent.",
            },
            wusstest: {
              de: "Sekundärquellen können gut sein — aber prüfe: verlinken sie sauber?",
              en: "Secondary sources can be good — but check if they link properly.",
              fr: "Les sources secondaires peuvent être bonnes — mais vérifiez si elles sont correctement liées.",
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
              fr: "Une capture d'écran est une preuve fiable.",
            },
            a: false,
            explanation: {
              de: "Screenshots sind leicht zu fälschen oder ohne Kontext irreführend. Besser: Originalquelle prüfen.",
              en: "Screenshots are easy to fake or misleading without context. Check the original source.",
              fr: "Les captures d'écran sont faciles à falsifier ou trompeuses sans contexte. Vérifiez la source originale.",
            },
            wusstest: {
              de: "Wenn möglich: Link, Archiv-Version oder offizielles Statement suchen.",
              en: "If possible: find a link, an archived version, or an official statement.",
              fr: "Si possible : trouvez un lien, une version archivée ou une déclaration officielle.",
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
              fr: "Qu'est-ce que le « biais de confirmation » ?",
            },
            choices: [
              { de: "Wir glauben eher Dinge, die unsere Meinung bestätigen", en: "We tend to believe things that confirm our beliefs", fr: "Nous avons tendance à croire les choses qui confirment nos croyances" },
              { de: "Wir erinnern uns an alles perfekt", en: "We remember everything perfectly", fr: "Nous nous souvenons de tout parfaitement" },
              { de: "Wir sind immer objektiv", en: "We are always objective", fr: "Nous sommes toujours objectifs" },
            ],
            a: 0,
            explanation: {
              de: "Menschen suchen unbewusst Bestätigung. Dadurch wirken passende Infos „wahrer“ als sie sind.",
              en: "We unconsciously seek confirmation. This can make fitting info feel “truer” than it is.",
              fr: "Nous cherchons inconsciemment la confirmation. Cela peut rendre les informations correspondantes « plus vraies » qu'elles ne le sont.",
            },
            wusstest: {
              de: "Guter Trick: Suche aktiv nach Gegenargumenten aus seriösen Quellen.",
              en: "Good trick: actively look for reputable counter-evidence.",
              fr: "Bonne astuce : recherchez activement des contre-preuves fiables.",
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
              fr: "Vous voyez un post émotionnel provoquant l'indignation. Quelle est une pause intelligente ?",
            },
            choices: [
              { de: "Sofort reagieren und teilen", en: "React and share immediately", fr: "Réagir et partager immédiatement" },
              { de: "Kurz warten, durchatmen, Quelle prüfen", en: "Pause, breathe, verify the source", fr: "Faire une pause, respirer, vérifier la source" },
              { de: "Nur die Kommentare lesen", en: "Only read the comments", fr: "Lire seulement les commentaires" },
            ],
            a: 1,
            explanation: {
              de: "Emotionen reduzieren kritisches Denken. Eine kurze Pause schützt vor impulsivem Teilen.",
              en: "Emotions reduce critical thinking. A short pause prevents impulsive sharing.",
              fr: "Les émotions réduisent la pensée critique. Une courte pause empêche le partage impulsif.",
            },
            wusstest: {
              de: "Manipulative Inhalte arbeiten oft mit Angst/Wut, weil das Engagement steigert.",
              en: "Manipulative content often uses anger/fear because it boosts engagement.",
              fr: "Les contenus manipulateurs utilisent souvent la colère/la peur car cela augmente l'engagement.",
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
            q: { de: "Woran erkennst du oft Werbung, die als Inhalt getarnt ist?", en: "How can you spot ads disguised as content?", fr: "Comment repérer les publicités déguisées en contenu ?" },
            choices: [
              { de: "Markierungen wie „Anzeige“, „Sponsored“, „Partner“", en: "Labels like “Ad”, “Sponsored”, “Partner”", fr: "Étiquettes comme « Publicité », « Sponsorisé », « Partenaire »" },
              { de: "Sie hat viele Likes", en: "It has many likes", fr: "Elle a beaucoup de likes" },
              { de: "Sie ist sehr kurz", en: "It’s very short", fr: "Elle est très courte" },
            ],
            a: 0,
            explanation: {
              de: "Native Ads/Influencer-Posts können wie normale Inhalte wirken. Labels sind wichtige Hinweise.",
              en: "Native ads/influencer posts can look like normal content. Labels are key signals.",
              fr: "Les publicités natives/les posts d'influenceurs peuvent ressembler à du contenu normal. Les étiquettes sont des indices clés.",
            },
            wusstest: {
              de: "Auch Rabattcodes/„Link in Bio“ sind typische Werbesignale.",
              en: "Discount codes or “link in bio” are common ad signals.",
              fr: "Les codes de réduction ou « lien dans la bio » sont des signaux publicitaires courants.",
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
            q: { de: "Ein verifizierter Account (blauer Haken) garantiert Wahrheit.", en: "A verified account guarantees truth.", fr: "Un compte vérifié (coche bleue) garantit-il la vérité ?" },
            a: false,
            explanation: {
              de: "Verifizierung sagt oft nur: Identität/Account ist bestätigt — nicht, dass Inhalte korrekt sind.",
              en: "Verification often confirms identity — not that content is accurate.",
              fr: "La vérification confirme souvent l'identité — pas que le contenu est exact.",
            },
            wusstest: {
              de: "Auch verifizierte Accounts können Fehler teilen oder gehackt werden.",
              en: "Verified accounts can still share errors or get hacked.",
              fr: "Même les comptes vérifiés peuvent partager des erreurs ou être piratés.",
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
            q: { de: "Was ist „Engagement Bait“?", en: "What is “engagement bait”?", fr: "Qu'est-ce que le « piège à engagement » ?" },
            choices: [
              { de: "Posts, die dich zu Likes/Kommentaren drängen („LIKE wenn…“)", en: "Posts pushing you to like/comment (“LIKE if…”) ", fr: "Des posts qui vous incitent à aimer/commenter (« LIKE si… »)" },
              { de: "Ein Faktencheck-Tool", en: "A fact-check tool", fr: "Un outil de vérification des faits" },
              { de: "Ein sicheres Passwort", en: "A secure password", fr: "Un mot de passe sécurisé" },
            ],
            a: 0,
            explanation: {
              de: "Engagement Bait nutzt Aufforderungen, um Reichweite zu pushen — oft ohne echte Information.",
              en: "Engagement bait uses prompts to boost reach — often with little real info.",
              fr: "Le piège à engagement utilise des incitations pour augmenter la portée — souvent avec peu d'informations réelles.",
            },
            wusstest: {
              de: "Je stärker der Post „bettelt“, desto skeptischer solltest du sein.",
              en: "The more a post begs for engagement, the more skeptical you should be.",
              fr: "Plus un post sollicite l'engagement, plus vous devez être sceptique.",
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
            q: { de: "Ein Clip zeigt nur 5 Sekunden einer Rede. Wie gehst du damit um?", en: "A clip shows only 5 seconds of a speech. How do you handle it?", fr: "Un clip ne montre que 5 secondes d'un discours. Comment réagis-tu ?" },
            choices: [
              { de: "Clip reicht, das ist die ganze Wahrheit", en: "The clip is enough — full truth", fr: "Le clip suffit — c'est toute la vérité" },
              { de: "Originalrede/ganzen Ausschnitt suchen", en: "Find the full speech/full clip", fr: "Trouver le discours complet/le clip complet" },
              { de: "Nur die Kommentare glauben", en: "Believe the comments", fr: "Croire uniquement les commentaires" },
            ],
            a: 1,
            explanation: {
              de: "Kurze Clips können Kontext weglassen. Besser: Original und längeren Ausschnitt prüfen.",
              en: "Short clips can omit context. Better: check the original and a longer excerpt.",
              fr: "Les courts extraits peuvent omettre le contexte. Mieux vaut vérifier l'original et un extrait plus long.",
            },
            wusstest: {
              de: "„Out of context“ ist eine der häufigsten Formen von Desinformation.",
              en: "“Out of context” is one of the most common forms of misinformation.",
              fr: "« Hors contexte » est l'une des formes les plus courantes de désinformation.",
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
            q: { de: "Was ist „Desinformation“?", en: "What is “disinformation”?", fr: "Qu'est-ce que la « désinformation » ?" },
            choices: [
              { de: "Absichtlich falsche oder irreführende Informationen", en: "Deliberately false or misleading information", fr: "Des informations délibérément fausses ou trompeuses" },
              { de: "Ein Tippfehler", en: "A typo", fr: "Une faute de frappe" },
              { de: "Eine harmlose Meinung", en: "A harmless opinion", fr: "Une opinion inoffensive" },
            ],
            a: 0,
            explanation: {
              de: "Desinformation ist gezielt — nicht nur ein Irrtum. Ziel: manipulieren.",
              en: "Disinformation is intentional — not just a mistake. The goal is to manipulate.",
              fr: "La désinformation est intentionnelle — pas seulement une erreur. L'objectif est de manipuler.",
            },
            wusstest: {
              de: "„Misinformation“ = falsche Info ohne Absicht. „Desinformation“ = mit Absicht.",
              en: "Misinformation = false without intent. Disinformation = intentional.",
              fr: "La désinformation = fausse information avec intention. La mésinformation = fausse information sans intention.",
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
            q: { de: "Satire ist immer klar erkennbar.", en: "Satire is always clearly recognizable.", fr: "La satire est toujours clairement reconnaissable." },
            a: false,
            explanation: {
              de: "Satire kann für echte Nachrichten gehalten werden, wenn sie geteilt wird ohne Kontext.",
              en: "Satire can be mistaken for real news when shared without context.",
              fr: "La satire peut être prise pour de vraies nouvelles lorsqu'elle est partagée sans contexte.",
            },
            wusstest: {
              de: "Wenn’s zu absurd klingt: Quelle checken, ob Satire/Parodie.",
              en: "If it sounds absurd: check if the source is satire/ parody.",
              fr: "Si cela semble absurde : vérifiez si la source est une satire/ parodie.",
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
              fr: "Un post montre une image avec une citation. Pas de source. Quelle est votre prochaine étape ?",
            },
            choices: [
              { de: "Teilen, weil’s gut klingt", en: "Share because it sounds good", fr: "Partager parce que ça sonne bien" },
              { de: "Reverse Image Search / Originalquelle suchen", en: "Reverse image search / find the original source", fr: "Recherche d'image inversée / trouver la source originale" },
              { de: "Nur liken", en: "Just like it", fr: "Juste aimer" },
            ],
            a: 1,
            explanation: {
              de: "Bildzitate sind leicht zu fälschen. Reverse Image Search zeigt oft Ursprung und Kontext.",
              en: "Image quotes are easy to fake. Reverse image search often reveals origin and context.",
              fr: "Les citations d'images sont faciles à falsifier. La recherche d'image inversée révèle souvent l'origine et le contexte.",
            },
            wusstest: {
              de: "Manchmal stammt das Bild aus einem völlig anderen Ereignis/Jahr.",
              en: "Sometimes the image is from a totally different event/year.",
              fr: "Parfois, l'image provient d'un événement/année totalement différent(e).",
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
            q: { de: "Was ist ein seriöser „Gegencheck“?", en: "What is a reliable cross-check?", fr: "Qu'est-ce qu'une vérification fiable ?" },
            choices: [
              { de: "Mehrere unabhängige, seriöse Quellen bestätigen die Aussage", en: "Multiple independent reputable sources confirm the claim", fr: "Plusieurs sources indépendantes et réputées confirment la déclaration" },
              { de: "Viele Kommentare sagen es auch", en: "Many comments say it too", fr: "Beaucoup de commentaires le disent aussi" },
              { de: "Ein Influencer sagt es", en: "An influencer says it", fr: "Un influenceur le dit" },
            ],
            a: 0,
            explanation: {
              de: "Je wichtiger eine Behauptung, desto mehr brauchst du unabhängige Bestätigung.",
              en: "The more important a claim, the more you need independent confirmation.",
              fr: "Plus une affirmation est importante, plus vous avez besoin d'une confirmation indépendante.",
            },
            wusstest: {
              de: "Achte darauf, ob Medien nur voneinander abschreiben (gleiche Quelle) oder wirklich unabhängig sind.",
              en: "Check whether outlets copy the same source or are truly independent.",
              fr: "Vérifiez si les médias se copient les uns les autres (même source) ou s'ils sont vraiment indépendants.",
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
            q: { de: "Algorithmen zeigen dir immer die objektiv besten Inhalte.", en: "Algorithms always show you the objectively best content.", fr: "Les algorithmes montrent toujours le contenu objectivement meilleur." },
            a: false,
            explanation: {
              de: "Algorithmen optimieren oft auf Aufmerksamkeit/Engagement, nicht auf Qualität oder Wahrheit.",
              en: "Algorithms often optimize for attention/engagement, not quality or truth.",
              fr: "Les algorithmes optimisent souvent l'attention/l'engagement, pas la qualité ou la vérité.",
            },
            wusstest: {
              de: "Dein Feed ist personalisiert. Zwei Personen sehen völlig unterschiedliche Realitäten.",
              en: "Your feed is personalized. Two people can see totally different realities.",
              fr: "Votre fil est personnalisé. Deux personnes peuvent voir des réalités totalement différentes.",
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
            q: { de: "Was ist eine „Filterblase“?", en: "What is a “filter bubble”?", fr: "Qu'est-ce qu'une « bulle de filtre » ?" },
            choices: [
              { de: "Du bekommst vor allem Inhalte, die zu deinen Interessen/Meinungen passen", en: "You mostly see content matching your interests/beliefs", fr: "Vous voyez principalement du contenu correspondant à vos intérêts/croyances" },
              { de: "Ein Schutz gegen Fake News", en: "A protection against fake news", fr: "Une protection contre les fausses informations" },
              { de: "Ein sicheres WLAN", en: "Secure Wi-Fi", fr: "Un Wi-Fi sécurisé" },
            ],
            a: 0,
            explanation: {
              de: "Personalisierung kann dazu führen, dass andere Perspektiven seltener werden.",
              en: "Personalization can reduce exposure to other perspectives.",
              fr: "La personnalisation peut réduire l'exposition à d'autres perspectives.",
            },
            wusstest: {
              de: "Aktiv gegensteuern: unterschiedliche Quellen abonnieren, bewusst suchen.",
              en: "Counter it: follow diverse sources, search intentionally.",
              fr: "Contrez-le : suivez des sources diverses, recherchez intentionnellement.",
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
            q: { de: "Du bist unsicher, ob eine Info stimmt. Was ist ein guter „Mini-Faktencheck“?", en: "You’re unsure if a claim is true. What’s a good mini fact-check?", fr: "Vous n'êtes pas sûr qu'une information soit vraie. Quel est un bon mini-vérification des faits ?" },
            choices: [
              { de: "Nur auf TikTok weiter schauen", en: "Keep watching TikTok", fr: "Continuez à regarder TikTok" },
              { de: "Suchbegriff + offizielle Quelle + 1 seriöses Medium", en: "Search term + official source + 1 reputable outlet", fr: "Terme de recherche + source officielle + 1 média réputé" },
              { de: "In den Kommentaren fragen", en: "Ask in the comments", fr: "Demandez dans les commentaires" },
            ],
            a: 1,
            explanation: {
              de: "Ein schneller Check bei offiziellen Stellen und seriösen Medien filtert viel Müll raus.",
              en: "A quick check with official sources and reputable outlets filters a lot of noise.",
              fr: "Une vérification rapide auprès de sources officielles et de médias réputés filtre beaucoup de bruit.",
            },
            wusstest: {
              de: "Wenn du’s nicht bestätigen kannst: lieber nicht teilen.",
              en: "If you can’t verify it: don’t share it.",
              fr: "Si vous ne pouvez pas le vérifier : ne le partagez pas.",
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
            q: { de: "Was ist „Manipulation durch Bildwahl“?", en: "What is “manipulation through image choice”?", fr: "Qu'est-ce que la « manipulation par le choix de l'image » ?" },
            choices: [
              { de: "Ein Bild wird gewählt, um Gefühle zu triggern, obwohl es den Inhalt verzerrt", en: "Choosing an image to trigger emotions while distorting the message", fr: "Choisir une image pour déclencher des émotions tout en déformant le message" },
              { de: "Ein Bild wird immer neutral gewählt", en: "Images are always neutral", fr: "Les images sont toujours neutres" },
              { de: "Bilder sind unwichtig", en: "Images don’t matter", fr: "Les images n'ont pas d'importance" },
            ],
            a: 0,
            explanation: {
              de: "Bilder können Stimmung erzeugen und Interpretationen lenken, auch wenn Text neutral wirkt.",
              en: "Images can shape mood and interpretation even if text seems neutral.",
              fr: "Les images peuvent influencer l'humeur et l'interprétation même si le texte semble neutre.",
            },
            wusstest: {
              de: "Achte: passt das Bild wirklich zum Ereignis? Datum? Ort?",
              en: "Check: does the image truly match the event? date? place?",
              fr: "Vérifiez : l'image correspond-elle vraiment à l'événement ? date ? lieu ?",
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
            q: { de: "Eine Meinung und eine Tatsache sind dasselbe.", en: "An opinion and a fact are the same.", fr: "Une opinion et un fait sont-ils la même chose ?" },
            a: false,
            explanation: {
              de: "Fakten sind überprüfbar. Meinungen sind Bewertungen/Interpretationen.",
              en: "Facts are verifiable. Opinions are judgments/interpretations.",
              fr: "Les faits sont vérifiables. Les opinions sont des jugements/interprétations.",
            },
            wusstest: {
              de: "Viele Posts mischen beides: erst Gefühl, dann „Fakt“ behauptet.",
              en: "Many posts mix both: emotion first, then a “fact” claim.",
              fr: "Beaucoup de publications mélangent les deux : d'abord l'émotion, puis une prétendue « fait ».",
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
            q: { de: "Was bedeutet „Framing“?", en: "What does “framing” mean?", fr: "Que signifie « framing » ?" },
            choices: [
              { de: "Ein Thema wird so dargestellt, dass es eine bestimmte Interpretation nahelegt", en: "Presenting a topic to suggest a particular interpretation", fr: "Présenter un sujet pour suggérer une interprétation particulière" },
              { de: "Ein Passwort speichern", en: "Saving a password", fr: "Enregistrer un mot de passe" },
              { de: "Eine App installieren", en: "Installing an app", fr: "Installer une application" },
            ],
            a: 0,
            explanation: {
              de: "Framing lenkt Wahrnehmung durch Wortwahl, Beispiele und Perspektive.",
              en: "Framing shapes perception through wording, examples, and perspective.",
              fr: "Le cadrage influence la perception par le choix des mots, des exemples et de la perspective.",
            },
            wusstest: {
              de: "Framing ist nicht immer „böse“, aber du solltest es erkennen können.",
              en: "Framing isn’t always malicious — but it’s important to recognize.",
              fr: "Le cadrage n'est pas toujours malveillant, mais il est important de le reconnaître.",
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
            q: { de: "Was ist ein „Scheinexperte“?", en: "What is a “fake expert”?", fr: "Qu'est-ce qu'un « faux expert » ?" },
            choices: [
              { de: "Jemand wirkt kompetent, hat aber keine nachvollziehbare Expertise/Quelle", en: "Someone seems credible but lacks verifiable expertise/source", fr: "Quelqu'un semble crédible mais n'a pas d'expertise/source vérifiable" },
              { de: "Ein echter Wissenschaftler", en: "A real scientist", fr: "Un vrai scientifique" },
              { de: "Eine offizielle Behörde", en: "An official authority", fr: "Une autorité officielle" },
            ],
            a: 0,
            explanation: {
              de: "Titel, Outfit oder Selbstbehauptung ersetzen keine überprüfbaren Belege.",
              en: "Titles, outfit, or self-claims don’t replace verifiable evidence.",
              fr: "Les titres, les tenues ou les affirmations personnelles ne remplacent pas des preuves vérifiables.",
            },
            wusstest: {
              de: "Check: Publikationen, Institution, unabhängige Erwähnungen, Kontext.",
              en: "Check: publications, institution, independent mentions, context.",
              fr: "Vérifiez : publications, institution, mentions indépendantes, contexte.",
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
    title: { de: "Meine Daten", en: "My Data", fr: "Mes données" },
    summary: (ratio) => {
      if (ratio >= 0.8) return { de: { title: "🛡️ Daten-Checker!", text: "Super! Du passt gut auf deine Daten auf." }, en: { title: "🛡️ Data checker!", text: "Great! You protect your data well." }, fr: { title: "🛡️ Vérificateur de données!", text: "Super! Vous protégez bien vos données." } };
      if (ratio >= 0.5) return { de: { title: "✨ Guter Anfang!", text: "Nice! Mit ein paar Regeln wirst du noch sicherer." }, en: { title: "✨ Good start!", text: "Nice! A few rules will make you even safer." }, fr: { title: "✨ Bon début!", text: "Bien! Quelques règles vous rendront encore plus sûr." } };
      return { de: { title: "🌱 Übung macht’s!", text: "Kein Problem — du lernst gerade, was sicher ist." }, en: { title: "🌱 Practice helps!", text: "No worries — you’re learning what’s safe." }, fr: { title: "🌱 La pratique aide!", text: "Pas de souci — vous apprenez ce qui est sûr." } };
    },
    questions: [
      {
        id: "k_p1_q01",
        type: "mc",
        q: { de: "Welche Info solltest du online lieber NICHT öffentlich teilen?", en: "Which info should you usually NOT share publicly online?", fr: "Quelle information devriez-vous généralement NE PAS partager publiquement en ligne ?" },
        choices: [
          { de: "Deine Adresse", en: "Your home address", fr: "Votre adresse" },
          { de: "Dein Lieblingstier", en: "Your favorite animal", fr: "Votre animal préféré" },
          { de: "Dein Lieblingsspiel", en: "Your favorite game", fr: "Votre jeu préféré" }
        ],
        a: 0,
        explanation: { de: "Adresse ist privat. Teile sie nur mit Personen, denen du vertraust.", en: "An address is private. Share it only with people you trust.", fr: "Une adresse est privée. Ne la partagez qu'avec des personnes de confiance." },
        wusstest: { de: "Wenn du unsicher bist: frag eine erwachsene Person.", en: "If you’re unsure: ask a trusted adult.", fr: "Si vous n'êtes pas sûr : demandez à un adulte de confiance." },
        source: { label: "klicksafe / BSI – Kindersicherheit (Startseite)", url: "https://www.klicksafe.de/" }
      },
      {
        id: "k_p1_q02",
        type: "truefalse",
        q: { de: "Ein Spitzname ist oft besser als dein voller Name im Internet.", en: "A nickname is often better than your full name online.", fr: "Un pseudonyme est souvent mieux que votre nom complet en ligne." },
        a: true,
        explanation: { de: "Ein Spitzname schützt deine Identität besser.", en: "A nickname protects your identity better.", fr: "Un pseudonyme protège mieux votre identité." },
        wusstest: { de: "Nutze Privatsphäre-Einstellungen in Apps.", en: "Use privacy settings in apps.", fr: "Utilisez les paramètres de confidentialité dans les applications." },
        source: { label: "klicksafe – Privat im Netz", url: "https://www.klicksafe.de/" }
      },
      {
        id: "k_p1_q03",
        type: "scenario",
        q: { de: "Eine App fragt nach deinem Standort, obwohl sie das nicht braucht. Was machst du?", en: "An app asks for your location even though it doesn’t need it. What do you do?", fr: "Une application demande votre localisation alors qu'elle n'en a pas besoin. Que faites-vous ?" },
        choices: [
          { de: "Erlauben (immer)", en: "Allow (always)", fr: "Autoriser (toujours)" },
          { de: "Ablehnen oder nur „Beim Benutzen“ erlauben", en: "Deny or allow only “While using”", fr: "Refuser ou autoriser uniquement « Lors de l'utilisation »" },
          { de: "Ignorieren", en: "Ignore it", fr: "Ignorer" }
        ],
        a: 1,
        explanation: { de: "Nur geben, was nötig ist. Standort kann viel verraten.", en: "Only share what’s needed. Location can reveal a lot.", fr: "Ne partagez que ce qui est nécessaire. La localisation peut révéler beaucoup." },
        wusstest: { de: "Du kannst Berechtigungen später ändern.", en: "You can change permissions later.", fr: "Vous pouvez modifier les autorisations plus tard." },
        source: { label: "Apple – Standortdienste (Überblick)", url: "https://support.apple.com/" }
      },
      {
        id: "k_p1_q04",
        type: "mc",
        q: { de: "Was bedeutet „Privat“ in einer App?", en: "What does “Private” mean in an app?", fr: "Que signifie « Privé » dans une application ?" },
        choices: [
          { de: "Nur ausgewählte Personen können es sehen", en: "Only selected people can see it", fr: "Seules les personnes sélectionnées peuvent le voir" },
          { de: "Alle können es sehen", en: "Everyone can see it", fr: "Tout le monde peut le voir" },
          { de: "Niemand kann es sehen (auch du nicht)", en: "Nobody can see it (not even you)", fr: "Personne ne peut le voir (pas même vous)" }
        ],
        a: 0,
        explanation: { de: "Privat heißt: nicht für alle sichtbar.", en: "Private means: not visible to everyone.", fr: "Privé signifie : non visible par tout le monde." },
        wusstest: { de: "Checke manchmal deine Einstellungen.", en: "Check your settings sometimes.", fr: "Vérifiez parfois vos paramètres." },
        source: { label: "klicksafe – Einstellungen", url: "https://www.klicksafe.de/" }
      }
    ]
  },

  2: {
    title: { de: "Sicher online", en: "Safe Online", fr: "En ligne en sécurité" },
    summary: (ratio) => {
      if (ratio >= 0.8) return { de: { title: "🔐 Sicherheits-Pro!", text: "Sehr gut! Du erkennst gefährliche Situationen." }, en: { title: "🔐 Safety pro!", text: "Great! You spot risky situations." }, fr: { title: "🔐 Pro de la sécurité!", text: "Super! Vous repérez les situations à risque." } };
      if (ratio >= 0.5) return { de: { title: "🚦Gute Regeln!", text: "Nice! Mit Übung wirst du noch sicherer." }, en: { title: "🚦Good rules!", text: "Nice! Practice makes you safer." }, fr: { title: "🚦Bonnes règles!", text: "Bien! Avec de la pratique, vous serez encore plus en sécurité." } };
      return { de: { title: "🧠 Lernmodus!", text: "Kein Stress — du baust gerade starke Sicherheits-Skills auf." }, en: { title: "🧠 Learning mode!", text: "No stress — you’re building strong safety skills." }, fr: { title: "🧠 Mode apprentissage!", text: "Pas de stress — vous développez de solides compétences en matière de sécurité." } };
    },
    questions: [
      {
        id: "k_s2_q01",
        type: "mc",
        q: { de: "Was ist ein gutes Passwort?", en: "What is a good password?", fr: "Quel est un bon mot de passe ?" },
        choices: [
          { de: "1234", en: "1234", fr: "1234" },
          { de: "Ein langes Passwort mit mehreren Wörtern", en: "A long password with several words", fr: "Un long mot de passe avec plusieurs mots" },
          { de: "Dein Vorname", en: "Your first name", fr: "Votre prénom" }
        ],
        a: 1,
        explanation: { de: "Lange Passwörter sind schwerer zu erraten.", en: "Long passwords are harder to guess.", fr: "Les mots de passe longs sont plus difficiles à deviner." },
        wusstest: { de: "Nutze nie dasselbe Passwort überall.", en: "Don’t use the same password everywhere.", fr: "N’utilisez jamais le même mot de passe partout." },
        source: { label: "NIST – Passwort-Richtlinien (Überblick)", url: "https://pages.nist.gov/800-63-3/" }
      },
      {
        id: "k_s2_q02",
        type: "scenario",
        q: { de: "Du bekommst eine Nachricht: „Schick mir ein Foto, sonst…“ Was machst du?", en: "You get a message: “Send me a photo or else…” What do you do?", fr: "Vous recevez un message : « Envoie-moi une photo ou sinon… » Que fais-tu ?" },
        choices: [
          { de: "Sofort schicken", en: "Send it immediately", fr: "Envoyer immédiatement" },
          { de: "Nicht antworten, blockieren und einer erwachsenen Person sagen", en: "Don’t reply, block, and tell a trusted adult", fr: "Ne pas répondre, bloquer et en parler à un adulte de confiance" },
          { de: "Weiterleiten an Freunde", en: "Forward to friends", fr: "Transférer à des amis" }
        ],
        a: 1,
        explanation: { de: "Das ist Druck/Erpressung. Hol dir Hilfe und antworte nicht.", en: "That’s pressure/blackmail. Get help and don’t reply.", fr: "C’est de la pression/chantage. Obtenez de l’aide et ne répondez pas." },
        wusstest: { de: "Du bist nicht schuld, wenn jemand dich unter Druck setzt.", en: "It’s not your fault if someone pressures you.", fr: "Ce n’est pas de votre faute si quelqu’un vous met la pression." },
        source: { label: "klicksafe – Hilfe", url: "https://www.klicksafe.de/" }
      },
      {
        id: "k_s2_q03",
        type: "truefalse",
        q: { de: "Du solltest Links in komischen Nachrichten lieber nicht anklicken.", en: "You should avoid clicking links in suspicious messages.", fr: "Vous devriez éviter de cliquer sur des liens dans des messages suspects." },
        a: true,
        explanation: { de: "Links können auf Fake-Seiten führen.", en: "Links can lead to fake sites.", fr: "Les liens peuvent mener à de faux sites." },
        wusstest: { de: "Wenn du unsicher bist: frag eine erwachsene Person.", en: "If unsure: ask a trusted adult.", fr: "Si vous n’êtes pas sûr : demandez à un adulte de confiance." },
        source: { label: "BSI – Phishing (Startseite)", url: "https://www.bsi.bund.de/" }
      },
      {
        id: "k_s2_q04",
        type: "mc",
        q: { de: "Was machst du, wenn dich jemand online beleidigt?", en: "What do you do if someone insults you online?", fr: "Que fais-tu si quelqu’un t’insulte en ligne ?" },
        choices: [
          { de: "Zurück beleidigen", en: "Insult back", fr: "Répondre par une insulte" },
          { de: "Screenshot machen, blockieren, melden, Hilfe holen", en: "Take a screenshot, block, report, get help", fr: "Prendre une capture d’écran, bloquer, signaler, demander de l’aide" },
          { de: "Nichts sagen und alles glauben", en: "Say nothing and believe everything", fr: "Ne rien dire et tout croire" }
        ],
        a: 1,
        explanation: { de: "Melden + blockieren + Hilfe holen ist am sichersten.", en: "Report + block + get help is safest.", fr: "Signaler + bloquer + demander de l’aide est le plus sûr." },
        wusstest: { de: "Du musst das nicht alleine lösen.", en: "You don’t have to handle it alone.", fr: "Vous n’êtes pas obligé de le gérer seul." },
        source: { label: "klicksafe – Cybermobbing", url: "https://www.klicksafe.de/" }
      }
    ]
  },

  3: {
    title: { de: "KI & Tricks", en: "AI & Tricks", fr: "IA & Astuces" },
    summary: (ratio) => {
      if (ratio >= 0.8) return { de: { title: "🤖 KI-Detektiv!", text: "Top! Du weißt: KI ist nicht immer perfekt." }, en: { title: "🤖 AI detective!", text: "Great! You know AI isn’t always perfect." }, fr: { title: "🤖 Détective IA!", text: "Super! Vous savez que l’IA n’est pas toujours parfaite." } };
      if (ratio >= 0.5) return { de: { title: "🧭 Gute Orientierung!", text: "Nice! Du bleibst neugierig und vorsichtig." }, en: { title: "🧭 Good sense!", text: "Nice! You’re curious and careful." }, fr: { title: "🧭 Bon sens!", text: "Bien! Vous restez curieux et prudent." } };
      return { de: { title: "🌟 Weiter lernen!", text: "KI ist spannend — und du lernst, wie man sie richtig nutzt." }, en: { title: "🌟 Keep learning!", text: "AI is exciting — and you’re learning how to use it wisely." }, fr: { title: "🌟 Continuez à apprendre!", text: "L’IA est passionnante — et vous apprenez à l’utiliser judicieusement." } };
    },
    questions: [
      {
        id: "k_ai_q01",
        type: "truefalse",
        q: { de: "KI kann manchmal Dinge erfinden, die nicht stimmen.", en: "AI can sometimes make up things that are not true.", fr: "L'IA peut parfois inventer des choses qui ne sont pas vraies." },
        a: true,
        explanation: { de: "Darum: immer prüfen!", en: "So: always verify!", fr: "Donc : toujours vérifier !" },
        wusstest: { de: "Frag nach Quellen oder Beispielen.", en: "Ask for sources or examples.", fr: "Demandez des sources ou des exemples." },
        source: { label: "OECD – AI (Startseite)", url: "https://oecd.ai/" }
      },
      {
        id: "k_ai_q02",
        type: "mc",
        q: { de: "Was ist ein Deepfake?", en: "What is a deepfake?", fr: "Qu'est-ce qu'un deepfake ?" },
        choices: [
          { de: "Ein echtes Foto", en: "A real photo", fr: "Une vraie photo" },
          { de: "Ein Video/Bild, das mit KI verändert wurde", en: "A video/image changed with AI", fr: "Une vidéo/image modifiée par l'IA" },
          { de: "Ein Passwort", en: "A password", fr: "Un mot de passe" }
        ],
        a: 1,
        explanation: { de: "Deepfakes können sehr echt aussehen, sind aber manipuliert.", en: "Deepfakes can look real but are manipulated.", fr: "Les deepfakes peuvent sembler réels mais sont manipulés." },
        wusstest: { de: "Wenn etwas krass klingt: erst prüfen.", en: "If it sounds extreme: verify first.", fr: "Si quelque chose semble extrême : vérifiez d'abord." },
        source: { label: "ENISA – Cybersecurity (Startseite)", url: "https://www.enisa.europa.eu/" }
      },
      {
        id: "k_ai_q03",
        type: "scenario",
        q: { de: "Du siehst ein verrücktes Video ohne Quelle. Was machst du?", en: "You see a crazy video with no source. What do you do?", fr: "Vous voyez une vidéo folle sans source. Que faites-vous ?" },
        choices: [
          { de: "Sofort teilen", en: "Share immediately", fr: "Partager immédiatement" },
          { de: "Quelle suchen / Erwachsenen fragen / nicht sofort teilen", en: "Look for a source / ask an adult / don’t share yet", fr: "Chercher une source / demander à un adulte / ne pas partager tout de suite" },
          { de: "Kommentare glauben", en: "Believe the comments", fr: "Croire les commentaires" }
        ],
        a: 1,
        explanation: { de: "Ohne Quelle ist es unsicher. Erst checken, dann teilen.", en: "Without a source it’s uncertain. Check first, then share.", fr: "Sans source, c'est incertain. Vérifiez d'abord, puis partagez." },
        wusstest: { de: "Screenshots und Clips können aus dem Kontext sein.", en: "Screenshots/clips can be out of context.", fr: "Les captures d'écran et les clips peuvent être hors contexte." },
        source: { label: "klicksafe – Fakes erkennen", url: "https://www.klicksafe.de/" }
      },
      {
        id: "k_ai_q04",
        type: "mc",
        q: { de: "Was ist fair, wenn KI dir bei Hausaufgaben hilft?", en: "What’s fair if AI helps you with homework?", fr: "Qu'est-ce qui est juste si l'IA vous aide avec vos devoirs ?" },
        choices: [
          { de: "Alles kopieren und behaupten, es ist von mir", en: "Copy everything and claim it’s mine", fr: "Tout copier et prétendre que c'est à moi" },
          { de: "KI als Hilfe nutzen, aber selbst verstehen und eigene Worte verwenden", en: "Use AI as help, but understand and use your own words", fr: "Utiliser l'IA comme aide, mais comprendre et utiliser ses propres mots" },
          { de: "Gar nichts mehr lernen", en: "Stop learning", fr: "Ne plus rien apprendre" }
        ],
        a: 1,
        explanation: { de: "KI kann helfen — aber du solltest es verstehen und ehrlich bleiben.", en: "AI can help — but you should understand it and be honest.", fr: "L'IA peut aider — mais vous devez comprendre et être honnête." },
        wusstest: { de: "Wenn du’s nicht verstehst: frag nach einer einfacheren Erklärung.", en: "If you don’t understand: ask for a simpler explanation.", fr: "Si vous ne comprenez pas : demandez une explication plus simple." },
        source: { label: "UNICEF – Children & technology (Startseite)", url: "https://www.unicef.org/" }
      }
    ]
  },

  4: {
    title: { de: "Wahr oder Fake?", en: "True or Fake?", fr: "Vrai ou faux?" },
    summary: (ratio) => {
      if (ratio >= 0.8) return { de: { title: "📰 Super Fakten-Filter!", text: "Mega! Du prüfst, bevor du glaubst." }, en: { title: "📰 Great fact filter!", text: "Awesome! You check before you believe." }, fr: { title: "📰 Super filtre à faits!", text: "Génial ! Vous vérifiez avant de croire." } };
      if (ratio >= 0.5) return { de: { title: "✅ Gute Checks!", text: "Sehr gut! Mit Routine wirst du richtig stark." }, en: { title: "✅ Good checks!", text: "Very good! With routine you’ll be super strong." }, fr: { title: "✅ Bonnes vérifications!", text: "Très bien ! Avec de la routine, vous deviendrez super fort." } };
      return { de: { title: "🔥 Dranbleiben!", text: "Du lernst gerade, wie man besser prüft. Weiter so!" }, en: { title: "🔥 Keep going!", text: "You’re learning how to verify. Keep going!" }, fr: { title: "🔥 Continuez!", text: "Vous apprenez à vérifier. Continuez !" } };
    },
    questions: [
      {
        id: "k_med_q01",
        type: "mc",
        q: { de: "Was ist ein guter Mini-Check, bevor du etwas teilst?", en: "What’s a good mini-check before you share something?", fr: "Quel est un bon mini-vérification avant de partager quelque chose ?" },
        choices: [
          { de: "Nur die Überschrift lesen", en: "Only read the headline", fr: "Lire seulement le titre" },
          { de: "Quelle + Datum prüfen", en: "Check source + date", fr: "Vérifier la source et la date" },
          { de: "Sofort weiterleiten", en: "Forward immediately", fr: "Transférer immédiatement" }
        ],
        a: 1,
        explanation: { de: "Quelle und Datum helfen zu sehen, ob es echt und aktuell ist.", en: "Source and date help you see if it’s real and current.", fr: "La source et la date aident à voir si c'est réel et actuel." },
        wusstest: { de: "Wenn du’s nicht prüfen kannst: lieber nicht teilen.", en: "If you can’t verify it: don’t share it.", fr: "Si vous ne pouvez pas le vérifier : ne le partagez pas." },
        source: { label: "klicksafe – Nachrichten prüfen", url: "https://www.klicksafe.de/" }
      },
      {
        id: "k_med_q02",
        type: "truefalse",
        q: { de: "Viele Likes bedeuten automatisch: stimmt!", en: "Lots of likes automatically means it’s true!", fr: "Beaucoup de likes signifient automatiquement que c'est vrai !" },
        a: false,
        explanation: { de: "Likes sind kein Beweis. Dinge gehen viral, weil sie spannend sind.", en: "Likes are not proof. Things go viral because they’re exciting.", fr: "Les likes ne sont pas une preuve. Les choses deviennent virales parce qu'elles sont excitantes." },
        wusstest: { de: "Wenn es dich sehr aufregt: Pause machen und prüfen.", en: "If it makes you upset: pause and verify.", fr: "Si cela vous énerve beaucoup : faites une pause et vérifiez." },
        source: { label: "EU Digital Strategy (Startseite)", url: "https://digital-strategy.ec.europa.eu/" }
      },
      {
        id: "k_med_q03",
        type: "scenario",
        q: { de: "Ein Screenshot zeigt „Beweis!“. Keine Quelle. Was machst du?", en: "A screenshot shows “proof!”. No source. What do you do?", fr: "Une capture d'écran montre « preuve ! ». Pas de source. Que faites-vous ?" },
        choices: [
          { de: "Glauben und teilen", en: "Believe and share", fr: "Croire et partager" },
          { de: "Nach Original-Link suchen / Erwachsene fragen", en: "Look for the original link / ask an adult", fr: "Chercher le lien original / demander à un adulte" },
          { de: "Nichts mehr glauben", en: "Believe nothing ever", fr: "Ne plus jamais croire" }
        ],
        a: 1,
        explanation: { de: "Screenshots kann man fälschen oder aus dem Kontext reißen.", en: "Screenshots can be faked or taken out of context.", fr: "Les captures d'écran peuvent être falsifiées ou sorties de leur contexte." },
        wusstest: { de: "Besser: Originalquelle suchen.", en: "Better: find the original source.", fr: "Mieux : trouver la source originale." },
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
    if (langFR) langFR.classList.toggle("active", lang === "fr");
    syncModeButtons();
  }

  // =========================
  // LANGUAGE SWITCH
  // =========================
  function setLanguage(newLang) {
    const supported = ["de", "en", "fr"];
    lang = supported.includes(newLang) ? newLang : "de";

    localStorage.setItem("dc_lang", lang);
    document.documentElement.setAttribute("lang", lang);

    renderStaticUI();

    if (quizInProgress()) renderQuestion();
  }


  if (langDE) langDE.addEventListener("click", () => setLanguage("de"));
  if (langEN) langEN.addEventListener("click", () => setLanguage("en"));
  if (langFR) langFR.addEventListener("click", () => setLanguage("fr"));

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
              <img src="assets/icons/information.png" alt="Info" class="quiz-info-icon">
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

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js");
  });
}