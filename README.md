# Chef Sana's Restaurant — مطعم الشيف سنا

Static restaurant menu site with two interfaces:

- **Public viewer** (`index.html`) — browse meals, search by title or `#tag`, leave star ratings + reviews.
- **Admin** (`pages/admin.html`) — protected by a key. Lets you add / edit / delete meals.

Bilingual: English + Arabic (with full RTL layout).

## Local preview

Just open `public/index.html` in a browser, or serve the folder with any static server:

```powershell
npx serve public
```

## Admin access

- Login page: `/pages/admin.html` — enter the key.
- Direct unlock: `/pages/admin.html?key=YOUR_KEY` (the key is stripped from the URL after unlock).
- The key is set in [`public/js/auth.js`](public/js/auth.js).

> The admin gate is client-side only and is meant to hide the admin UI from casual visitors, not to provide real security.

## Deploy on Vercel

1. Push this folder to a GitHub repo.
2. On vercel.com → **Add New → Project** → import the repo.
3. `vercel.json` already configures it as a static site — just click **Deploy**.

Data (meals + reviews + view counts) is stored in each visitor's browser `localStorage`.
