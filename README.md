# Smara — Recall, Refine, Repeat
> Offline spaced repetition PWA

## Files
```
smara/
├── index.html       ← Main app shell
├── style.css        ← All styles (dark minimal aesthetic)
├── app.js           ← SM-2 algorithm + all logic
├── sw.js            ← Service worker (offline cache)
├── manifest.json    ← PWA manifest (installable)
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

## Run locally
```bash
# Option 1 — Python
cd smara && python3 -m http.server 8080
# Open http://localhost:8080

# Option 2 — Node
npx serve smara

# Option 3 — VS Code
Install "Live Server" extension, right-click index.html → Open with Live Server
```

## Deploy (free)
- **Netlify**: drag the smara/ folder to netlify.com/drop
- **Vercel**: `npx vercel smara/`
- **GitHub Pages**: push to repo, enable Pages

## Install as app (Android)
1. Open in Chrome
2. Tap ⋮ menu → "Add to Home screen"
3. Tap "Install" — works fully offline

## Google Drive backup (production)
To implement real G Drive backup:
1. Create project at console.cloud.google.com
2. Enable Google Drive API
3. Create OAuth2 credentials (Web application)
4. Add this JS after connecting:
```js
const CLIENT_ID = 'YOUR_CLIENT_ID';
// Use gapi.client.drive.files.create() to upload smara_backup.json
// Use gapi.client.drive.files.list() to find and restore it
```

## SM-2 Algorithm
- Quality 0-2: Reset (interval = 1 day)
- Quality 3-5: Advance (interval × ease factor)
- Ease factor adjusts per review (min 1.3, starts 2.5)
- Mature card = interval ≥ 21 days
