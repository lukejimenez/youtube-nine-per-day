// YouTube Ten a Day
// Snapshots the first 9 videos YouTube serves on the home page each day
// (skipping any shown yesterday), then shows only that frozen list for the
// rest of the day.

const LIMIT = 9; // 3x3 grid
const MIN_ON_TIMEOUT = 5; // save fewer than LIMIT if the feed is slow/thin
const CAPTURE_TIMEOUT_MS = 20000;
const ROLLOVER_HOUR = 4; // the "day" starts at 4am local time
const ROOT_ID = "yt10-root";

let snapshot = null; // { day, videos: [{id, title, channel}], progress: {id: 0..1} }
let previous = null; // { day, ids: [videoId] } from the last snapshot before today's
let loaded = false;
let captureStart = 0;
let lastDebug = "no data yet";

function dayKey(daysAgo = 0) {
  const d = new Date(Date.now() - ROLLOVER_HOUR * 3600 * 1000 - daysAgo * 24 * 3600 * 1000);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// Videos shown yesterday can't be picked again today.
function excludedIds() {
  return previous && previous.day === dayKey(1) ? new Set(previous.ids) : new Set();
}

const isHome = () => location.pathname === "/";

async function load() {
  const stored = await browser.storage.local.get(["snapshot", "previous"]);
  snapshot = stored.snapshot || null;
  previous = stored.previous || null;
  await rotateIfStale();
  loaded = true;
}

// If the saved snapshot is from an earlier day, remember its video IDs (so
// they can be excluded) and clear it so a fresh one gets captured. Runs on
// load and again whenever the day changes while a page is left open.
async function rotateIfStale() {
  if (!snapshot || snapshot.day === dayKey()) return;
  previous = { day: snapshot.day, ids: snapshot.videos.map((v) => v.id) };
  snapshot = null;
  captureStart = 0;
  await browser.storage.local.set({ previous });
  await browser.storage.local.remove("snapshot");
}

function save() {
  return browser.storage.local.set({ snapshot });
}

// ---- capture -------------------------------------------------------------

function videoIdFromHref(href) {
  try {
    const u = new URL(href, location.origin);
    if (u.pathname !== "/watch" || u.searchParams.has("list")) return null;
    return u.searchParams.get("v");
  } catch {
    return null;
  }
}

function extractCard(card) {
  if (card.querySelector("ytd-ad-slot-renderer, ad-badge-view-model, [aria-label='Sponsored']")) return null;
  const link = card.querySelector('a[href^="/watch"]');
  if (!link) return null;
  const id = videoIdFromHref(link.getAttribute("href"));
  if (!id) return null;

  const titleEl = card.querySelector("#video-title, h3, [title]");
  const title =
    (titleEl && (titleEl.getAttribute("title") || titleEl.textContent)) ||
    link.getAttribute("title") ||
    link.getAttribute("aria-label") ||
    "";
  const channelEl = card.querySelector(
    "ytd-channel-name a, a[href^='/@'], .yt-content-metadata-view-model-wiz__metadata-text"
  );
  return {
    id,
    title: title.trim().replace(/\s+/g, " "),
    channel: channelEl ? channelEl.textContent.trim() : "",
  };
}

function collect() {
  const seen = excludedIds();
  const videos = [];
  for (const card of document.querySelectorAll("ytd-rich-item-renderer")) {
    const v = extractCard(card);
    if (!v || seen.has(v.id)) continue;
    seen.add(v.id);
    videos.push(v);
    if (videos.length === LIMIT) break;
  }
  return videos;
}

async function tryCapture() {
  await rotateIfStale();
  if (snapshot) return;
  if (!captureStart) captureStart = Date.now();
  const videos = collect();
  const timedOut = Date.now() - captureStart > CAPTURE_TIMEOUT_MS;
  lastDebug = `${document.querySelectorAll("ytd-rich-item-renderer").length} cards, ${
    document.querySelectorAll('ytd-rich-item-renderer a[href^="/watch"]').length
  } watch links, ${videos.length} valid`;
  if (videos.length >= LIMIT || (timedOut && videos.length >= MIN_ON_TIMEOUT)) {
    snapshot = { day: dayKey(), videos, progress: {} };
    await save();
  }
}

// ---- progress tracking ---------------------------------------------------

// Like YouTube's own red bar: remember how far into each listed video you got.
async function trackProgress() {
  if (!snapshot || location.pathname !== "/watch") return;
  const id = new URLSearchParams(location.search).get("v");
  if (!id || !snapshot.videos.some((v) => v.id === id)) return;
  if (document.querySelector("#movie_player.ad-showing")) return; // don't count ads
  const video = document.querySelector("video");
  if (!video || !isFinite(video.duration) || video.duration <= 0) return;

  let frac = video.currentTime / video.duration;
  if (frac > 0.95) frac = 1;
  snapshot.progress = snapshot.progress || {};
  if (frac > (snapshot.progress[id] || 0) + 0.01 || (frac === 1 && snapshot.progress[id] !== 1)) {
    snapshot.progress[id] = frac;
    await save();
  }
}

// ---- fill gaps -----------------------------------------------------------

// Some cards (e.g. collabs) don't expose a channel in the feed DOM. YouTube's
// same-origin oEmbed endpoint gives us the channel and title by video ID.
const oembedTried = new Set();

async function fillMissing() {
  if (!snapshot) return false;
  let changed = false;
  for (const v of snapshot.videos) {
    if ((v.channel && v.title) || oembedTried.has(v.id)) continue;
    oembedTried.add(v.id);
    try {
      const res = await fetch(
        `/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${v.id}`)}`
      );
      if (!res.ok) continue;
      const data = await res.json();
      if (!v.channel && data.author_name) { v.channel = data.author_name; changed = true; }
      if (!v.title && data.title) { v.title = data.title; changed = true; }
    } catch {}
  }
  if (changed) await save();
  return changed;
}

// ---- rendering -----------------------------------------------------------

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text != null) e.textContent = text;
  return e;
}

// One card: thumbnail, optional red progress bar, title, channel name.
function buildCard(v, frac) {
  const a = el("a", "yt10-card");
  a.href = `/watch?v=${encodeURIComponent(v.id)}`;
  const thumb = el("div", "yt10-thumb");
  const img = el("img");
  img.src = `https://i.ytimg.com/vi/${encodeURIComponent(v.id)}/hqdefault.jpg`;
  img.alt = "";
  thumb.append(img);
  if (frac > 0) {
    const bar = el("div", "yt10-progress");
    const fill = el("div", "yt10-progress-fill");
    fill.style.width = `${Math.round(Math.min(frac, 1) * 100)}%`;
    bar.append(fill);
    thumb.append(bar);
  }
  a.append(thumb, el("div", "yt10-title", v.title || v.id), el("div", "yt10-channel", v.channel));
  return a;
}

function buildRoot() {
  const root = el("div");
  root.id = ROOT_ID;
  if (!snapshot) {
    root.append(
      el("div", "yt10-header", "Capturing today's recommendations…"),
      el(
        "div",
        "yt10-sub",
        `Waiting for YouTube to load your feed. (debug: ${lastDebug})`
      )
    );
    return root;
  }
  const videos = snapshot.videos.slice(0, LIMIT); // trims older 10-item snapshots
  const grid = el("div", "yt10-grid");
  for (const v of videos) {
    grid.append(buildCard(v, (snapshot.progress && snapshot.progress[v.id]) || 0));
  }
  root.append(grid);
  return root;
}

function render() {
  const existing = document.getElementById(ROOT_ID);
  if (!isHome()) {
    if (existing) existing.remove();
    return;
  }
  const browseEl = document.querySelector('ytd-browse[page-subtype="home"]');
  if (!browseEl) return;
  const root = buildRoot();
  // Skip DOM churn if nothing changed.
  if (existing && existing.parentElement === browseEl && existing.isEqualNode(root)) return;
  if (existing) existing.remove();
  browseEl.prepend(root);
}

// ---- subscriptions page --------------------------------------------------

// YouTube's own cards on the subscriptions page show avatars, view counts and
// dates. Instead of hiding those one by one (class names keep changing), swap
// each card's contents for our own card, built from the title/channel we read
// off it. The native cards stay in the grid, so infinite scroll keeps working.
const isSubscriptions = () => location.pathname === "/feed/subscriptions";

function nativeProgress(card) {
  const bar = card.querySelector(
    '#progress, [class*="progress-bar"] [style*="width"], [class*="resume-playback"] [style*="width"]'
  );
  const pct = bar ? parseFloat(bar.style.width) : NaN;
  return isFinite(pct) ? pct / 100 : 0;
}

function restyleSubscriptions() {
  if (!isSubscriptions()) return;
  const cards = document.querySelectorAll(
    "ytd-browse[page-subtype='subscriptions'] ytd-rich-item-renderer:not(.yt10-done):not(.yt10-skip)"
  );
  for (const card of cards) {
    const v = extractCard(card);
    if (!v) {
      // Shorts, ads, playlists: drop. Cards with no links yet haven't rendered.
      if (card.querySelector("a[href]") || card.querySelector("ytd-ad-slot-renderer")) {
        card.classList.add("yt10-skip");
      }
      continue;
    }
    if (!v.title) continue; // not fully rendered yet; retry next pass
    const frac = nativeProgress(card);
    card.classList.add("yt10-done");
    card.append(buildCard(v, frac));
  }
}

// ---- wiring --------------------------------------------------------------

function syncHomeClass() {
  document.documentElement.classList.toggle("yt10-home", isHome());
}

let timer = null;
function schedule() {
  if (timer) return;
  timer = setTimeout(async () => {
    timer = null;
    syncHomeClass();
    if (!loaded) return;
    if (isHome()) await tryCapture();
    restyleSubscriptions();
    render();
    if (await fillMissing()) render();
  }, 200);
}

syncHomeClass(); // synchronously at document_start so the feed never flashes

load().then(schedule);

new MutationObserver(schedule).observe(document, { childList: true, subtree: true });
window.addEventListener("yt-navigate-finish", () => {
  captureStart = 0;
  schedule();
});
window.addEventListener("popstate", schedule);
// Re-check capture while the feed is still loading but nothing is mutating.
setInterval(schedule, 2000);
setInterval(trackProgress, 2000);
