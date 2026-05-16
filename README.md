# Malik & Sabrina Wedding Timeline

Private live wedding guestbook timeline for Malik & Sabrina 2026.

Guests scan a QR code, set a display name once per device, upload photos or short videos, write wishes, like posts, and comment on memories. The app is designed as a private wedding-only
social timeline and final memory book.

Useful preview routes:
- /?demo=1 for synthetic populated timeline
- /?projector=1 for projector mode

Local setup:
npm install
Copy-Item .env.example .env
npm run dev

Verification:
npm run build
npm test
npm run typecheck:worker

GitHub Pages build:
$env:VITE_BASE_PATH="/malik-sabrina-wedding-timeline/"
npm run build