# Claude House

A personal calendar plus a Duolingo-style adaptive practice system. Plain HTML, CSS and
JavaScript, with Supabase for login and data. No build step, no npm install.

Made by Bird Productions.

## Files

| File | What it is |
| --- | --- |
| `index.html` | Page shell and the studio splash screen |
| `styles.css` | All styling |
| `app.js` | The whole app: auth, onboarding, calendar, exercises, streak |
| `config.js` | Your Supabase URL and anon key (you fill this in) |
| `schema.sql` | Tables, indexes and row level security |
| `seed-exercises.sql` | 63 starter questions across 7 subjects |

## Setup

**1. Create the database.**
In your Supabase dashboard go to SQL Editor, paste the whole of `schema.sql`, run it.
Then do the same with `seed-exercises.sql`.

**2. Turn off email confirmation while you test.**
Authentication > Sign In / Providers > Email, switch off "Confirm email". Otherwise every
test account has to click a link in an inbox before it can log in. Turn it back on before
you share the app with anyone.

**3. Fill in `config.js`.**
Project Settings > API. Copy the Project URL and the `anon` `public` key into `config.js`.

The anon key sits in public JavaScript on purpose. It is safe *only* because row level
security is on for every table, which is what step 1 set up. Never put the `service_role`
key in this file: it bypasses RLS entirely.

**4. Run it.**
`index.html` uses ES modules, so opening the file directly with `file://` will fail on
CORS. Serve it over HTTP instead:

```
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

**5. Deploy.**
Push the folder to a GitHub repo, then Settings > Pages > Source: "Deploy from a branch",
branch `main`, folder `/ (root)`. The site appears at
`https://<your-username>.github.io/<repo-name>/`.

## How the adaptive difficulty works

Every user has a `difficulty` from 1 to 10 per subject, stored in `skills`.

- 1 to 3 draws `easy` questions
- 4 to 7 draws `medium`
- 8 to 10 draws `hard`

A correct answer adds 1, a wrong answer subtracts 1, clamped to the 1 to 10 range. Your
onboarding self-rating of 1 to 5 sets the starting point (`rating * 2 - 1`, so a 3 starts
you at 5).

Every attempt is written to `attempts` with the difficulty at the time, so you can chart
progress later or debug the algorithm if it feels wrong.

## How the streak works

Any completed exercise, right or wrong, marks today as active. If your last active day was
yesterday the streak goes up by one. If a full day was missed it resets to 1. The home
screen shows 0 if the stored streak is stale.

## Adding your own questions

Insert rows into `exercises`. A multiple-choice row needs `options`; a typed row must leave
it null (the schema enforces this). Typed answers are matched after trimming, lowercasing
and collapsing repeated spaces, so casing does not matter, but accents and punctuation do.
If an answer needs an accent, write the question as multiple choice instead.

## Known limits (deliberate, for v1)

- No way to change your subjects after onboarding. You would need a settings screen.
- No recurring calendar events. Every event is a single date.
- No diagnostic quiz. The starting level comes from self-rating, which people are bad at.
- Events can be added and deleted but not edited.
- Exercises do not appear on the calendar.
