# Deployment Handoff

## Repository

Recommended repository:

```text
malik-sabrina-wedding-timeline
```

Use source folder as read-only:

```text
D:\00_ARH\_scratch\wedding-guestbook-ash2026
```

Recommended repo working folder:

```text
D:\00_ARH\01_homelab\01_github-repo\malik-sabrina-wedding-timeline
```

Do not commit `.env`, `service-account.json`, `node_modules`, `dist`, `test-media`, `qa-*.png`, or local logs.

## GitHub Pages Preview

The Pages workflow uses:

```text
VITE_BASE_PATH=/malik-sabrina-wedding-timeline/
```

Expected URL:

```text
https://<github-user>.github.io/malik-sabrina-wedding-timeline/?demo=1
```

## Local Verification

```powershell
npm install
npm run build
npm test
npm run typecheck:worker
$env:VITE_BASE_PATH="/malik-sabrina-wedding-timeline/"
npm run build
```

## Infra Profile

Dedicated ARH infra profile:

```text
D:\00_ARH\.ARH-AGENT-ENV\_agent-mgmt\_cli-tools\cli-tools\cli\arh_infra\profiles\malik-sabrina-wedding-timeline
```

Run diagnostics:

```powershell
D:\00_ARH\.ARH-AGENT-ENV\_agent-mgmt\_cli-tools\cli-tools\cli\arh_infra\.venv\Scripts\arh-infra.exe backend-diagnostics malik-sabrina-wedding-timeline --pretty
```

Deploy selected targets after reviewing diagnostics:

```powershell
D:\00_ARH\.ARH-AGENT-ENV\_agent-mgmt\_cli-tools\cli-tools\cli\arh_infra\.venv\Scripts\arh-infra.exe deploy-infra malik-sabrina-wedding-timeline D:\00_ARH\_scratch\wedding-guestbook-ash2026 --targets firestore,worker,pages --pretty
```

## Remaining Before Production

- Confirm final Pages/Cloudflare domain.
- Set Worker `ALLOWED_ORIGIN` to the final frontend origin.
- Fill `FIREBASE_PROJECT_NUMBER` and `FIREBASE_APP_ID_ALLOWLIST`.
- Switch `APPCHECK_ENFORCEMENT` to `true`.
- Deploy Firestore rules/indexes.
- Deploy Worker.
- Deploy Pages.
- Set Firebase admin custom claim for `arh.homelab@gmail.com`.
- Replace/remove demo assets when real media/design review assets are available.
