# YouTube Ten a Day

A Firefox extension that freezes your YouTube home feed to a fixed set of recommended videos per day (a 3×3 grid). No infinite scroll: after that, you find videos yourself.

## How it works
- On your first home-page visit of the day, it snapshots the first 9 real videos YouTube serves (skipping ads, Shorts, and playlists).
- For the rest of the day, the home page shows only that frozen list. Reloading doesn't change it.
- New picks start at 4am local time (`ROLLOVER_HOUR` in `content.js`).
- Missing channel names/titles are filled in from YouTube's same-origin oEmbed endpoint.

## Install (temporary)
1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…** and select `manifest.json`
3. Open youtube.com
