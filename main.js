import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/* ============================================================
   CONFIG — fill these in (see README.md)
   ============================================================ */
const CONFIG = {
  // Google Form "viewform" URL (opens in a new tab)
  FORM_URL: "https://docs.google.com/forms/d/e/1FAIpQLSdGqDlw8Phbb0_5BNhbkKzMoU0_V0eGoD3V32AIU4XPLfSgnA/viewform",
  // Same form with ?embedded=true (used in the in-page modal). Leave "" to open FORM_URL in a new tab instead.
  FORM_EMBED_URL: "https://docs.google.com/forms/d/e/1FAIpQLSdGqDlw8Phbb0_5BNhbkKzMoU0_V0eGoD3V32AIU4XPLfSgnA/viewform?embedded=true",
  // Apps Script web-app URL that returns {"count": N}. See apps-script/Code.gs
  COUNT_ENDPOINT: "https://script.google.com/macros/s/AKfycbzEla6AWu_1nQa7Na2a-g0RrtM6e-RyOnnzkF0BZtcb97puK2Eu2GLhnab5XTbwxnoC3A/exec",
  // Number of team slots (drawn as dots). Set 0 to hide the dots.
  CAPACITY: 500,
  // How many pages/sections your Google Form has (1 if it has no "Next" button).
  FORM_PAGES: 1,
  // Refresh the live count every N ms
  POLL_MS: 60000,
};

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------------- scroll storytelling ---------------- */
function splitWords(el) {
  if (el.dataset.split) return;
  const text = el.textContent.trim();
  el.setAttribute("aria-label", text);
  el.textContent = "";
  text.split(/\s+/).forEach((w, i, arr) => {
    const mask = document.createElement("span");
    mask.className = "word-mask";
    mask.setAttribute("aria-hidden", "true");
    const word = document.createElement("span");
    word.className = "word";
    word.textContent = w;
    mask.appendChild(word);
    el.appendChild(mask);
    if (i < arr.length - 1) el.appendChild(document.createTextNode(" "));
  });
  el.dataset.split = "1";
  el.classList.add("is-split");
}

function initStory() {
  gsap.registerPlugin(ScrollTrigger);

  gsap.to("#progressBar", { scaleX: 1, ease: "none",
    scrollTrigger: { trigger: document.body, start: "top top", end: "bottom bottom", scrub: 0.2 } });

  // masked word reveals
  document.querySelectorAll("[data-masked-reveal]").forEach((el) => {
    splitWords(el);
    const isHero = el.closest(".hero");
    gsap.fromTo(el.querySelectorAll(".word"), { yPercent: 110 }, {
      yPercent: 0, duration: 0.9, ease: "power3.out", stagger: 0.06, delay: isHero ? 0.5 : 0,
      scrollTrigger: isHero ? null : { trigger: el, start: "top 82%", once: true },
    });
  });

  // fade-ups
  gsap.utils.toArray("[data-fade]").forEach((el) => {
    const isHero = el.closest(".hero");
    gsap.from(el, { autoAlpha: 0, y: 28, duration: 0.8, ease: "power2.out", delay: isHero ? 0.9 : 0,
      scrollTrigger: isHero ? null : { trigger: el, start: "top 88%", once: true } });
  });

  // hero neon shapes draw in one after another
  document.querySelectorAll(".hero__shapes .draw").forEach((s, i) => {
    const len = s.getTotalLength();
    gsap.set(s, { strokeDasharray: len, strokeDashoffset: len });
    gsap.to(s, { strokeDashoffset: 0, duration: 1.4, ease: "power2.inOut", delay: 0.2 + i * 0.35 });
  });
  gsap.to(".hero__shapes", { yPercent: -18, ease: "none",
    scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });

  // invitation card: tilted & small -> flat & full
  gsap.fromTo(".invite__card", { rotateZ: -8, rotateY: 25, scale: 0.78, opacity: 0.4 },
    { rotateZ: 0, rotateY: 0, scale: 1, opacity: 1, ease: "none",
      scrollTrigger: { trigger: ".invite__card-wrap", start: "top 90%", end: "center 50%", scrub: true } });

  // mask parallax (transform only)
  gsap.to(".mask__media img", { yPercent: -8, ease: "none",
    scrollTrigger: { trigger: ".mask", start: "top bottom", end: "bottom top", scrub: true } });

  // games: horizontal pinned scroll on desktop, grid elsewhere
  const mm = gsap.matchMedia();
  mm.add("(min-width: 900px)", () => {
    const section = document.querySelector(".games");
    const track = section.querySelector(".games__track");
    section.classList.add("is-horizontal");
    const dist = () => Math.max(0, track.scrollWidth - window.innerWidth + 120);
    gsap.to(track, { x: () => -dist(), ease: "none",
      scrollTrigger: { trigger: ".games__pin", start: "top top", end: () => "+=" + dist(),
        pin: true, scrub: 0.6, anticipatePin: 1, invalidateOnRefresh: true, refreshPriority: 1 } });
    return () => section.classList.remove("is-horizontal");
  });

  // re-measure once images/fonts settle so later sections sit after the pin spacer
  window.addEventListener("load", () => ScrollTrigger.refresh());
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
}

if (!reduceMotion) {
  initStory();
} else {
  document.documentElement.classList.remove("js");
  document.querySelectorAll("[data-masked-reveal]").forEach((el) => { splitWords(el); });
  document.querySelectorAll(".word").forEach((w) => (w.style.transform = "none"));
}

/* ---------------- team counter ---------------- */
const countEl = document.getElementById("teamCount");
const tokensEl = document.getElementById("tokens");
const capLabel = document.getElementById("capacityLabel");
const demo = new URLSearchParams(location.search).has("demo");
let shown = 0;

function buildTokens() {
  if (!CONFIG.CAPACITY) { tokensEl.hidden = true; return; }
  tokensEl.classList.toggle("tokens--dense", CONFIG.CAPACITY > 100);
  for (let i = 0; i < CONFIG.CAPACITY; i++) tokensEl.appendChild(document.createElement("li"));
  capLabel.textContent = "de " + CONFIG.CAPACITY;
}

function renderCount(n) {
  countEl.dataset.state = "ready";
  const pad = (v) => String(v).padStart(3, "0");
  const from = shown;
  shown = n;
  if (reduceMotion) countEl.textContent = pad(n);
  else {
    const o = { v: from };
    gsap.to(o, { v: n, duration: 1.4, ease: "power2.out", onUpdate: () => (countEl.textContent = pad(Math.round(o.v))) });
  }
  [...tokensEl.children].forEach((li, i) => li.classList.toggle("on", i < n));
}

async function loadCount() {
  if (demo) return renderCount(17); // preview only: add ?demo to the URL
  if (!CONFIG.COUNT_ENDPOINT) return;
  try {
    const res = await fetch(CONFIG.COUNT_ENDPOINT, { cache: "no-store" });
    const data = await res.json();
    if (typeof data.count === "number" && data.count !== shown) renderCount(data.count);
  } catch (e) { /* keep the last value */ }
}

buildTokens();
let polling = false;
new IntersectionObserver((entries, obs) => {
  if (entries[0].isIntersecting && !polling) {
    polling = true;
    loadCount();
    setInterval(() => { if (!document.hidden) loadCount(); }, CONFIG.POLL_MS);
    obs.disconnect();
  }
}, { rootMargin: "200px" }).observe(document.getElementById("registro"));

/* ---------------- registration modal ---------------- */
const modal = document.getElementById("formModal");
const frame = document.getElementById("formFrame");
const link = document.getElementById("formLink");

link.href = CONFIG.FORM_URL || "#";
if (!CONFIG.FORM_URL) link.setAttribute("aria-disabled", "true");

const done = document.getElementById("formDone");
const playerNo = document.getElementById("playerNo");
let frameLoads = 0;
let submitted = false;

function resetForm() {
  submitted = false;
  frameLoads = 0;
  done.hidden = true;
  frame.hidden = false;
  frame.src = CONFIG.FORM_EMBED_URL;
}

// A cross-origin iframe can't be inspected, so a page load alone can't tell "Next"
// from "Submit". Extra loads only trigger a check: a submit counts when the live
// team count (Apps Script) goes above the count recorded when the modal opened.
let baseline = 0;

async function fetchCount() {
  if (!CONFIG.COUNT_ENDPOINT) return null;
  try {
    const res = await fetch(CONFIG.COUNT_ENDPOINT, { cache: "no-store" });
    const data = await res.json();
    return typeof data.count === "number" ? data.count : null;
  } catch (e) { return null; }
}

function showSubmitted(n) {
  submitted = true;
  renderCount(n);
  playerNo.textContent = "Jugador " + String(n).padStart(3, "0") + " ha sido inscrito";
  frame.hidden = true;
  done.hidden = false;
  playerNo.focus();
}

async function checkSubmitted() {
  if (!CONFIG.COUNT_ENDPOINT) { // no way to verify: fall back to page-load counting
    if (frameLoads > CONFIG.FORM_PAGES) showSubmitted(shown + 1);
    return;
  }
  for (let i = 0; i < 4 && !submitted; i++) {
    const n = await fetchCount();
    if (submitted) return;
    if (n !== null && n > baseline) return showSubmitted(n);
    await new Promise((r) => setTimeout(r, 2000));
  }
}

frame.addEventListener("load", () => {
  if (!frame.getAttribute("src") || submitted) return;
  frameLoads++;
  if (frameLoads > 1) checkSubmitted(); // load 1 is the form itself
});

document.getElementById("openForm").addEventListener("click", () => {
  if (CONFIG.FORM_EMBED_URL) {
    if (!frame.getAttribute("src") || submitted) resetForm();
    fetchCount().then((n) => { if (n !== null) baseline = n; });
    modal.showModal();
  } else if (CONFIG.FORM_URL) {
    window.open(CONFIG.FORM_URL, "_blank", "noopener");
  }
});
document.getElementById("closeForm").addEventListener("click", () => modal.close());
document.getElementById("doneClose").addEventListener("click", () => modal.close());
modal.addEventListener("click", (e) => { if (e.target === modal) modal.close(); });

/* ---------------- anchor links ---------------- */
// Native anchor jumps/smooth scroll get confused by the pinned games section
// (its spacer is added after layout), landing on an empty gap. Scroll manually.
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  const id = a.getAttribute("href");
  if (id.length < 2) return;
  a.addEventListener("click", (e) => {
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    if (!reduceMotion) ScrollTrigger.refresh(true);
    const go = () => {
      const top = target.getBoundingClientRect().top + window.scrollY;
      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo(0, top);
      document.documentElement.style.scrollBehavior = "";
    };
    go();
    requestAnimationFrame(() => requestAnimationFrame(go)); // correct after layout settles
    history.replaceState(null, "", id);
  });
});

document.getElementById("year").textContent = new Date().getFullYear();
