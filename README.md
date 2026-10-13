# Lineup: split planner

Plan a lifting split on a body that turns red where you train, then track what you lift.
Sibling to Draftboard: same dark glass, same tiles-into-rows way of working, exercises instead of monsters.
The name comes from surfing: the lineup is where you wait for the next set. Here it's your lineup of exercises.
(It was called Liftboard at first; saved data and share codes from then still work.)

The app is one file, **`Lineup.html`**. Open it in Chrome on your computer or copy it to your phone.
It needs no server and no account; everything you enter is saved in the browser you open it in.

## Run it

**PyCharm:** open this folder, right-click `app.py` → Run.
**Terminal:** `python app.py`

That rebuilds `Lineup.html` from the files under `web/` and `data/` and opens it. Python 3.9+, standard library only.
You only need to run it after changing the code or the catalog; otherwise just open `Lineup.html`.

| | |
|---|---|
| `python app.py` | build and open |
| `python app.py --no-open` | build only |
| `python app.py --catalog` | rebuild `data/exercises.json` first (after editing `tools/build_catalog.py`) |
| `python app.py --serve` | serve the unbuilt app at `http://127.0.0.1:8770/web/` while editing code. That address keeps its own saved data, separate from `Lineup.html`. |

## Pages

**Split** · **Favorites** · **Track** · **Trends** · **Table** · **Science**. The usual flow: collect your Favorites once, build the Split from them, then log on Track.

### Split

- **Eight day slots**, Day 1 to Day 8, with no weekdays attached. Fill the ones you train, leave the rest empty, name them if you like (Push, Upper A).
- **+** on a day opens the picker with that day chosen. **Click a muscle** on the model (or a row in *By muscle*) and the picker opens for that muscle: your favorites that train it first, then the rest of the catalog. The picker sits beside the model so you can watch it change. In its muscle dropdown the group names (**Chest**, **Arms**, **Legs**, …) can be clicked as well as the muscles under them: a group lists everything that trains any muscle in it and sums up how each of those muscles stands in your split. The dropdown works from the keyboard too (arrows, Home/End, a letter to jump, Enter).
- The copy button beside **Day N** copies the whole day to another day (every exercise with its sets, and the name), so Push, Pull, Legs, rest, Push, Pull, Legs takes three clicks after the first three days. A target day that already has exercises keeps them and gains the ones it's missing. The same menu clears a day.
- Click a tile for its menu: planned sets, move or copy to another day, details, remove. On a computer you can also drag tiles between days (hold **Ctrl** to copy) and onto another tile to place it before that one.
- Hover a tile and the model outlines what it trains; hover a muscle and the tiles that don't train it fade.
- **Show only some days on the model.** The **Show** chips above the model pick the days it covers: click **2** to see what Day 2 hits, click **5** as well to see two pull days together, and **Whole split** to go back. Clicking the empty space of a day row does the same thing, and the copy menu beside **Day N** has *Show only this day*. The days shown are outlined and the rest fade; *By muscle* and the hover notes follow along, while the line under the title always describes the whole split. It's only a way of looking: nothing about it is saved, and the page opens on the whole split.

**Saved splits.** The **Splits** card under the model holds every split you've saved; one is loaded at a time, and it's the one this page shows and edits. Changes save to the loaded split as you make them, so there's no Save button.

- **Click** a split to load it. Everything follows: the days and model here, *in your split* on Favorites, the cards and Archive on Track (a lift with history that isn't in the loaded split sits in the Archive), and the Table's exercise list. The message that follows has an **Undo**.
- **Hover** a split to preview it on the model without loading it.
- **New** starts an empty split and asks for its name. The **⋯** menu on each split renames, duplicates (a copy, loaded), shares or deletes it (Undo again; your last split can't be deleted).
- Your log is one log across all splits: bench press history is the same whichever split has bench in it.

**Sharing a split.** **⋯ → Share…** gives a share code (text starting `LB1-`, a few hundred characters) to paste into a text or DM, and **Save as file** gives the same thing as a small `.json` file. It carries the days, their names, the exercises and planned sets, and any custom exercises in it; never your log or notes. Whoever gets it clicks **Import** on the Splits card and pastes the code or chooses the file: the split is added to their saved splits as if they'd made it, without replacing theirs, and the message offers to load it. Importing someone's split doesn't add its exercises to their favorites; they star the ones they like. Because Lineup is a file on your computer there's no web link to send; if it's ever put on a web address, **Copy link** appears too, and opening that link starts the import.

**How the colour works.** The model is silver until a muscle is trained. For each muscle, each day adds to a score:

- a lift that trains it directly is worth 1, a lift that only helps is worth 0.5
- the first full lift-worth of work in a day counts in full; anything beyond that the same day counts 40%
- a muscle with no direct lift anywhere in the split is held at 0.6, a pale "helped only" tint, however many helping lifts stack up
- once a muscle has a direct lift, helpers count 30% of their value on top of it, and never add more than 0.6 in total

So one direct lift is 1 (light red), two on different days is 2 (red), two on the same day is 1.4, three days is 3 (deep red), and so on up to 4. Three helpers and nothing direct is 0.6, paler than any directly trained muscle, so a missing direct exercise always shows. One direct lift with three helpers on other days is 1.45: more than one direct lift, clearly less than two. The 30% comes from the one study that added a helper to a direct exercise; the Science page has the detail. Sets don't change the colour; they're reported under *By muscle*, where a helping lift counts half a set. The numbers live at the top of `web/js/metrics.js` if you want to tune them.

### Favorites

The exercises you like, whether or not they're in the current split. **My favorites** shows yours, under every muscle group (Chest, Shoulders, Back, Arms, Core, Legs) even when a group is empty: the **+** on a group opens the catalog for that whole group, your favorites first, and a click stars or unstars an exercise. **Catalog** shows everything, with a star to add or remove. Anything you put in a split becomes a favorite automatically and stays one when it leaves the split. You never have to add something to your favorites first: the picker on the Split page lists your favorites and then the whole catalog. Filter by name, muscle or equipment.

**Share** (top right) gives a share code or file for your favorites list, and **Import** takes one someone sent you: it shows the list first, greys out the ones you already have, and **Add** puts the rest in your favorites (with Undo). The same Import button on the Splits card takes either kind of code.

The catalog has 684 lifts:

- **148 mapped by hand** onto the 23 muscle zones.
- **536 auto-mapped**: every other strength, powerlifting, Olympic and strongman lift in the source database, with its description and photos. Their muscles are worked out by rule from the database's 17 broad groups and the lift's name, so treat them as a first guess. They are captioned "auto-mapped" wherever they appear.

Two ways to add what isn't there or isn't right:

- **Make a variation** (in any exercise's details, or its menu on this page): a copy under a new name that starts with the same type and muscles, keeps the original's description and photos, and is tracked on its own. Use it for single-arm versions, another grip, a particular machine, or to correct an auto-mapped lift's muscles. It's captioned "variation" and its details say what it's a variation of.
- **Custom exercise**: from scratch, for a lift with no close relative. Name it and click the muscles (once for direct, twice for helps). It gets a tile and shades the model like any other, with no description or photos.

### Track

Every exercise in the split, with a row of weight × reps boxes per planned set. Pick the date at the top right (today by default); filter to one day of the split to use it as your gym sheet. The grey numbers in empty boxes are last time's; **Same as last** fills them in so you only change what moved. Entries save as you type.

Each card shows three things: Best set, Volume trend and Est. 1RM.

- **Best set**: the heaviest weight you've lifted on it and the most reps you've done with that weight, written the way you'd say it: `225 × 12`. Heavier always wins; at the same weight, more reps wins. It shows the date it was set, or **New best** (and what it replaced) when the latest session beat it.
- **Volume trend**: which way your work is going, as a percentage. It compares the average volume (weight × reps, all sets) of your last 3 sessions with the 3 before them, so one off day doesn't swing it; with 4 or 5 sessions it's the last 2 against the 2 before, and with 2 or 3 it's last time against the time before (the small label says which: *last 3*, *last 2*, *vs last time*). Green and **+6%** going up, amber going down, **steady** within 1%. The line beside it is volume averaged over three sessions. Right after you move up in weight it can read lower for a session or two, because the new weight costs reps; Best set and Est. 1RM show the step forward.
- **Est. 1RM**: the session's strongest set as an estimated one-rep max (Epley: weight × (1 + reps ÷ 30)), against the session before. It puts sets at different weights on one line, so 110 × 10 plots above 100 × 12.

**Cue.** A card can carry a one-line cue above its sets (*Close-grip MAG handle · elbows to hips*): the thing to remember as you set up. Click it to change it right on the card (Enter keeps it, Escape leaves it); point at a card without one and a **Cue** button appears beside its name. A cue is one line of up to 80 characters; if it's longer than the card is wide it's cut short with … and shows in full when you point at it. Longer notes stay in the exercise's details.

Going from 11, 10, 6 to 12, 11, 8 at the same weight raises all three. Sessions with no weight are treated as bodyweight: the reps are all of them and the best set is the one with the most reps. The volume itself (4,275 lb) isn't shown on the card, because nobody knows whether that's good; the trend is. It has its own chart in the details.

**Archive**, at the bottom, holds exercises that have history but aren't in the split. Put one back in a day and it carries on from where it stopped.

### Trends

How every muscle group is progressing, across all of its exercises: with 40 exercises nobody can read 40 sets of charts, so this page answers one question per muscle, *am I getting stronger here?*

- Each exercise is measured against itself, as a percentage: **strength** is its Est. 1RM (most reps for bodyweight work) and **volume** is weight × reps, the average of its last few sessions in the window against its first few (up to 3 and 3, as on the Track card). An exercise needs two sessions; the last session before the window counts as one, so a lift trained once in the window still compares with where it was.
- A muscle's trend is the average of the exercises that train it **directly** (its main muscle). Exercises that only help are left out, unlike on the Split page: helping lifts do grow a muscle, which is why they count half for coverage, but a row is limited by the back rather than the biceps, so its progress says little about the biceps. A muscle trained only by helpers says *no direct exercise · N help* instead of borrowing their numbers. A group (Chest, Shoulders, Back, Arms, Core, Legs) is the same over every exercise whose main muscle is in it. Archived lifts and lifts in other saved splits count too, as long as they have sessions in the window.
- **The body** turns green where you're getting stronger and amber where you're getting weaker, more so the bigger the change (full colour at 10%); grey is steady (within 1%), silver is no direct work in the window. Point at (or tap) a colour in the key under the body for what it means. Point at a muscle for its numbers; click it for its group.
- **Six group cards**: strength (the big number, with its line), volume, and how many exercises. Click one for the group's details: its strength over time, each muscle in it (how many exercises train it directly), and each exercise with its own strength and volume trend (click through to the exercise).
- **Window**: 4 weeks, 3 months (to start with), 6 months or All. It's remembered.

### Exercise details

Click any tile → *View details*, or the name on a Track card. The sheet shows where the lift sits in your split, your progress (best set, volume trend, reps at the working weight and est. 1RM, a **Weight and reps** chart, a chart of estimated 1RM, the full session history with deletes), what it trains on a small model, start and finish photos (these load from GitHub, so they need a connection), and the how-to. **Weight and reps** is one chart with two axes, splitting each session's work into its two halves: the **average weight** per rep on the left (in the chart's blue; each set's weight counted once for every rep in it, so 215 × 12, 225 × 8, 225 × 6 averages 220.4) and the **total reps** on the right (near-white). Average weight × total reps is the volume. Each is a smooth line with a soft fade under it. For straight sets the average is simply the weight (225 × 9, 5, 5 is 225 lb and 19 reps). Both lines are centred and share one scale of change, so the same percentage rise looks the same on either, and their rises add up to the volume's rise: 215 → 225 (+4.7%) climbs about as far as 17 → 18 reps (+5.9%). Whichever changed most fills the chart; if the weight never changed it's a flat line through the middle and the reps fill the chart. What you read is the trend: weight flat while the reps climb, then the weight goes up and the reps come down at the same moment, and climb again from there. Point at it for that session's sets. **Volume** (weight × reps, all sets) follows as its own chart, the simplest "am I doing more" line while the weight stays put, then **Est. 1RM**. All the lines are smooth curves that pass through every session and never bulge past one. Near the top are two boxes: **Cue**, one line (80 characters, counted as you type) that shows on the Track card, and **Notes**, as long as you like, for seat settings, setup and what to try next, which stay here. Cues and notes are yours: they go into backup files but not into shared splits or favorites.

### Table

Every logged set as a row. Sort by any column, filter to one exercise, edit date, weight or reps in place, add or delete rows, export CSV.

**Clear log** (top right) empties the log so you can start again, for instance after looking around with the example data. It asks for a second click, and the message that follows has an **Undo**. Your split, favorites and notes stay. With the table filtered to one exercise the button reads **Clear this exercise** and removes only that exercise's sets. Lifts that were only in the Archive because of their history disappear from it once their sets are gone.

### Science

What the app assumes, where each assumption comes from, how far to trust it, and where in the code to change it: helpers counting half, the helper cap, helpers counting less on top of direct work, twice per split, the same-day discount, colour ignoring sets, the muscle zones, and what the Track numbers mean. Each has links to the studies. The worked examples at the top are computed by the same code that colours the model.

## Your data

- Saved in the browser's local storage, per browser. `Lineup.html` opened in Chrome on your computer and on your phone are two separate stores.
- **Status pill (top right) → Save a backup file** writes everything to one `.json`; **Load a backup file** reads it back. That's how you move data between devices and how you keep a copy.
- Clearing the browser's site data clears it ("cookies and other site data" in browser settings, a private window, or a setting that clears data on close).
- It isn't a cookie and never leaves the computer: the only thing the app fetches from the internet is exercise photos.
- **Updating to a new version of the file:**
  - **Chrome and Edge** share one store across every local file, so a new `Lineup.html` sees your data wherever you save it. (It also means any other local HTML file opened in that browser could read it.)
  - **Firefox** gives each file path its own store. Save the new file over the old one (same name, same folder), or it opens empty. The data isn't gone; it's still with the old path.
  - **Safari** is unreliable with local files. Use Chrome or Edge.
  - It must be the same browser and the same browser profile. Double-clicking a file opens your *default* browser, which may not be the one you used before.
  - If a new copy ever opens empty, open the old copy the same way you did before, save a backup file there, and load it into the new one.
- **Saving takes nothing from you.** Every change is saved as you make it (a set on Track as you type it). Behind the scenes:
  - **Several tabs**: a tab only saves when something changed in it, open tabs follow each other's changes, and a tab checks for anything another tab saved before it saves. A tab left open from yesterday can't put back its old data when you switch to it or close it.
  - **Older copies**: every build of `Lineup.html` is stamped with when it was built (shown small at the bottom of the status menu), and saved data remembers which build saved it. An older copy opened after a newer one says so and doesn't save, so it can't overwrite newer data. That note is the only one the app ever shows about your data; *Use this copy anyway* is there if you meant to go back.
  - In Firefox and Safari, the status menu has one quiet line about how they handle files opened from your computer.
  - Backups stay optional: the status menu's *Save a backup file* is for moving data to another browser or keeping a copy, never something you're asked to do.
- Favorites were called Options in earlier builds. Data saved back then, and backup files made back then, load as they are.
- Data from before saved splits loads as one split called *My split*. A backup file holds all your saved splits.

## What's in the folder

```
app.py                  build Lineup.html (and the dev server)
Lineup.html             the app (built)
web/index.html          page shell
web/css/app.css         styles: Draftboard's foundations + Lineup's components
web/js/app.js           pages, top bar, status menu
web/js/store.js         your data and every change to it
web/js/metrics.js       coverage score, heat colours, volume and best-set maths
web/js/body.js          the model and the tile crops
web/js/picker.js        the exercise picker
web/js/splits.js        the Splits card (saved splits)
web/js/share.js         share codes and files, Import
web/js/trends.js        progress by muscle: each exercise's change, combined per muscle and group
web/js/views/           split, favorites, track, trends, table, science, exerciseSheet
web/runtime.js          starts the app inside the single file
data/exercises.json     the catalog (built)
data/body.json          the model's shapes, by muscle zone (built)
tools/build_catalog.py  the hand-made exercise → muscle mapping; edit this to add lifts
tools/build_body.mjs    one-off: cuts the source body map into Lineup's zones (needs node, playwright, paper)
tools/check*.mjs        end-to-end checks of the built file (need node + playwright)
```

## Where the content comes from

- **Exercises** (names, instructions, photos): [free-exercise-db](https://github.com/yuhonas/free-exercise-db), public domain. It only knows 17 broad muscle groups, so 142 of its lifts were re-mapped by hand onto 23 zones in `tools/build_catalog.py` and six more (Bayesian curl, pendulum squat, …) were added by hand; its other 536 strength lifts are mapped by the rules in the same file. Its stretching, cardio and plyometric entries are left out.
- **Body map**: [react-muscle-highlighter](https://www.npmjs.com/package/react-muscle-highlighter) 1.2.0, MIT. Its chest, deltoid and trapezius shapes were cut into finer zones.
- **Fonts**: Geist, Geist Mono, Instrument Serif (SIL Open Font License), same files as Draftboard.

See `THIRD_PARTY.md`.

## Not there yet

- The model is a flat front/back map, not 3D.
- Quads and hamstrings are one zone each (no rectus femoris or knee-flexion/hip-extension split); calves don't separate gastrocnemius from soleus.
- No planned rep ranges, only planned sets.
- Phone and computer don't sync; moving data is a backup file.
