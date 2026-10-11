# Nine a Day for YouTube

A Firefox extension that gives you **nine recommended videos a day** on YouTube, and that's it. No infinite scroll, no endless feed: once you've seen your nine, you find videos yourself by searching.

## What it does
- **Home page:** shows a frozen 3×3 grid of the first nine videos YouTube recommends to you each day. Reloading doesn't change it. New picks arrive at 4am.
- **No repeats:** a video that was in yesterday's nine can't come back today.
- **Progress bars:** a red bar on each thumbnail shows how far you got in it, like YouTube's own.
- **Subscriptions page:** same clean grid (thumbnail, title, channel) but with normal infinite scrolling.
- **Search:** videos only. Shorts, channels, playlists, shelves and ads are hidden.
- **Watch page:** player centered and a little smaller, with no suggestions, comments or live chat.
- **Cleaner top bar:** a slightly taller bar, centered search, and no voice-search, "Ask", or Shorts buttons.
- **Responsive:** the grid goes from 3 across to 2 to 1 as the window narrows.

## Install (Firefox on desktop, version 140 or newer)
1. Download the latest signed file: [nine-a-day-1.0.0.xpi](https://github.com/lukejimenez/youtube-nine-per-day/raw/main/releases/nine-a-day-1.0.0.xpi). If Firefox installs it straight away, great. If it downloads instead, go to step 2.
2. Drag the downloaded `.xpi` onto an open Firefox window and click **Add**.

That's it. It's signed by Mozilla, so it installs on regular Firefox with no special settings.

It does **not** work in Chrome, Safari, Edge, or Firefox on phones.

### Updating
Updates aren't automatic. When there's a new version, download the new `.xpi` from the `releases` folder and install it the same way. It installs over the old one and keeps your data.

## Privacy
Everything stays in your browser. The extension only runs on `www.youtube.com`, saves your daily list and watch progress in Firefox's local extension storage, and sends nothing anywhere. The one network request it makes is to YouTube itself (`/oembed`), to fill in a channel name or title that was missing from the page.

## Tweaking it
Everything is plain JavaScript and CSS, with no build step.

| What | Where |
|---|---|
| When the day rolls over (default 4am) | `ROLLOVER_HOUR` in `content.js` |
| How big the thumbnails get | `--yt10-card-max` in `content.css` |
| When it switches to 2 and 1 columns | `responsive.css` |
| Top bar height (default 68px) | `searchbar.css` |
| Watch page player size | `watch.css` |

## Running from source
1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…** and select `manifest.json`
3. Open youtube.com (the add-on is removed when Firefox restarts)

## Caveats
This works by reading and restyling YouTube's page, which YouTube changes without notice, so parts of it may break over time. It was built with [Claude Code](https://claude.com/claude-code).
