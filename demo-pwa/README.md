# MedAnchor Study — demo build

This is the **static demo**, not the full app. It is plain HTML, CSS and
JavaScript with no server and no database, so you can drag-and-drop the whole
folder onto Netlify and get a working installable web app.

The full app is in `../web` and is not changed by anything in this folder.

## Upload it

1. Go to <https://app.netlify.com/drop>
2. Drag this whole `demo-pwa` folder onto the page.
3. Wait for the green "Website published" message and copy the address.

Drag the **folder**, not the files inside it — the icons live in `icons/`.

## Then build the Android APK

1. Open your Netlify address in Chrome.
2. Go to <https://www.pwabuilder.com>
3. Paste the address in the URL box and press **Start**.
4. On **Package For Stores**, choose **Android**, enter any package name such
   as `com.medanchor.study`, then **Download Package**.
5. You get a zip containing an APK. That is the file to install or submit.

To test on your own phone first, open the address in Chrome and use
**Menu → Add to Home screen**. It installs and opens like a normal app.

## What works and what does not

Works in this demo:

- Welcome and sign-in screens
- Dashboard, navigation, study plan and progress screens
- Your real logo
- Works offline after the first visit

Needs the full app (shows a friendly notice instead of breaking):

- Real sign-in and accounts
- AI tutor answers
- Uploading and reading lecture notes
- Live literature search
- Real progress tracking

## Files

| File | What it is |
|---|---|
| `index.html` | The one page that holds every screen |
| `styles.css` | All the styling, phone-first |
| `app.js` | Screen switching and the service worker registration |
| `manifest.json` | Name, icons and colours Android reads when installing |
| `sw.js` | Saves the files so the app opens with no connection |
| `icons/` | Your logo at 192px, 512px and full size |

## Notes

- `sw.js` caches by a version number, `medanchor-demo-v1`. If you change any
  file, bump that to `v2` so phones pick up the new copy instead of the old.
- The service worker only works over `https://` or `localhost`, which Netlify
  gives you automatically.
- No secret keys are in this folder, which is why it is safe to upload.
