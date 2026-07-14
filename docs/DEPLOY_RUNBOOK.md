# Deploy Runbook

## Backend (Google)
1. Create a new Google Sheet. Extensions → Apps Script. Paste `apps-script/Code.gs`.
2. Project Settings → set **Time zone: Asia/Kolkata**.
3. Project Settings → Script Properties → add `PASSCODE` = a 16+ char random string.
4. Run `installBackupTrigger_` once (authorize Drive). Run `backupToDrive_` once to confirm.
5. Deploy → New deployment → Web app: "Execute as me", "Anyone with the link". Copy the `/exec` URL.

## Frontend (GitHub Pages)
6. Push the repo; Settings → Pages → deploy from branch, `/web` folder (or move `web/*` to root).
7. Open the Pages URL. First-run screen: paste the `/exec` URL + the passcode. (Stored on-device only.)
8. Repeat step 7 on your phone.

## Recovery
- Bad edit: check the `log` tab for the pre-image; restore the field.
- Lost data: Sheet File → Version history, or a copy in Drive → `Task Manager Backups`.
- Leaked URL/passcode: change `PASSCODE`, redeploy as a New version (new URL), re-enter in-app.
