# Pulseline

Live crowd voting for music. The admin creates a session and a song list,
sends a link to participants, and starts the session. Each song, everyone
slides their pfp between **Skip**, **Neutral**, and **Play** on a shared
live line — every avatar moves in real time on everyone's screen.

## Files

```
index.html          landing page, links to admin.html
admin.html / .js     the host/admin console (create session, control playback, see results)
join.html / .js      the participant page (join with name + photo, vote)
common.css           shared design system
common.js            shared helpers (ids, pfp resizing, avatar chips, animation)
firebase-config.js   <-- the only file you need to edit before deploying
```

## 1. One-time setup (about 3 minutes)

You need a free Firebase project to sync votes live between devices —
that's the only "backend" this uses, and there's no server to run.

1. Go to <https://console.firebase.google.com> and create a project (free "Spark" plan is enough).
2. In the left sidebar: **Build → Realtime Database → Create Database**. Choose any region, start in **test mode** for now.
3. Click the gear icon next to "Project Overview" → **Project settings**.
4. Under "Your apps", click the **</>** (web) icon and register an app (no need for Firebase Hosting).
5. Copy the `firebaseConfig` object it shows you.
6. Paste those values into `firebase-config.js` in this folder, replacing the placeholders.

That's the only file you edit. `admin.html` and `join.html` both load it, so the host and every participant automatically connect to the same database.

### Lock down the database rules (recommended before a real event)

Test mode allows anyone to read/write anything, which is fine for a quick demo but not for a public event. In the Firebase console, go to **Realtime Database → Rules** and use something like:

```json
{
  "rules": {
    "sessions": {
      "$sessionId": {
        ".read": true,
        ".write": "!data.exists() || newData.exists()",
        "participants": { "$pid": { ".write": true } },
        "votes": { "$songIndex": { "$pid": { ".write": true } } },
        "currentIndex": { ".write": true },
        "status": { ".write": true }
      }
    }
  }
}
```

This still keeps things open enough for anonymous participants to join and vote (there's no login step in this app), but at least scopes writes to specific fields rather than the whole database.

## 2. Run it locally

Any static file server works, e.g.:

```bash
npx serve .
```

Then open `http://localhost:3000/admin.html` for the host view.

## 3. Deploy it

Since it's just static files, any of these work — drag-and-drop the whole folder:

- **Netlify**: drag the folder onto <https://app.netlify.com/drop>
- **Vercel**: `vercel deploy` from this folder
- **GitHub Pages**: push this folder to a repo, enable Pages on it
- **Firebase Hosting**: `firebase init hosting` then `firebase deploy` (nice since it's the same project as your database)

## 4. Using it

1. Open `admin.html`, name the session, add your songs, click **Create session & get link**.
2. Copy the generated link (or QR code) and send it to participants.
3. Participants open the link, enter a name, optionally upload a photo, and land in a waiting room.
4. Once everyone's in, click **Start session** on the admin screen.
5. Each song, participants tap **Skip / Neutral / Play** — their pfp slides to that zone on every connected screen, including the admin's.
6. **Next / Previous** move through the song list; **End session** shows a results summary with the skip/neutral/play breakdown per song.

## Notes on the interaction

I built the vote mechanic as **tap a zone to move your pfp there**, with a smooth
slide animation (not free dragging) — Skip on the left, Neutral fixed in the
center, Play on the right, matching what you described. If the video you
referenced uses free-dragging instead of tap-to-zone, let me know and I can
change the interaction — I wasn't able to load the video itself (X blocks
automated fetching of posts), so this is built from your written description
rather than a frame-by-frame copy.

## Known limitations to be upfront about

- There's no authentication — anyone with the join link can vote, and could
  in theory vote multiple times by clearing their browser storage. Fine for
  a casual hackathon demo; say the word if you want basic anti-abuse (e.g.
  one vote per browser enforced more strictly, or a simple passcode).
- Session codes are short (5 characters) for easy sharing; collisions are
  very unlikely but not mathematically impossible at huge scale.
- Photos are resized client-side to keep the database small and fast — don't
  expect full-resolution avatars, they're compressed thumbnails by design.
