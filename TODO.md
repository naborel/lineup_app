# TODO

Open UX and quality-of-life decisions. Nothing here gets in the way of using the app; each one should be settled at some point. Remove an item in the commit that settles it.

## Where the "As logged / Set for set" switch lives

- **Now:** only on the Volume chart in an exercise's details (`web/js/views/exerciseSheet.js`). It's one setting for the whole app (`prefs.volumeView`, every exercise, Track and Trends), but it sits inside a single exercise, so it can read as a per-exercise choice. The Trends page doesn't say which mode is on.
- **Options:**
  - Keep it on the Volume chart, and add a small line on Trends saying which mode is on ("Volume as logged"), clickable to change it.
  - Move it to the Trends page, where volume across all exercises is read.
  - Put it with the other settings (lb/kg in the status menu, or a future Settings page).
  - Make it per exercise instead of app-wide.
- **Related:** with Set for set on, the total reps line in the Weight and reps chart and the rep chips in History still count every set. Decide whether they should follow the switch.

## Track: empty set box left after clearing a set

If a session had more sets than planned and you clear the extra one, its empty box stays on the card until you leave the page (so a set cleared by mistake can be retyped). Decide whether it should collapse right away instead.

## Track: volume trend dips while a workout is half-logged

With volume as logged (the default), the card's trend reads lower after the first set of today's session, until the rest are logged. Set for set handles this; the default doesn't. Options: leave it; leave today's session out of the trend until it reaches the planned sets; or leave today out until the card is marked done.

## Optimize sets: how strict to be about helpers

Helpers count half (the best fit in the research) and every muscle keeps at least 3 direct sets. Possible controls: count helpers half or not at all; raise the direct-set floor to 4. Decide whether either is worth a control or the panel stays as it is.

## Table page: keep or drop

The Table page started as an experiment. Decide whether it keeps its place in the page tabs, or is reached only from an exercise's History ("Edit in the table").

## Phone layout

At phone width the status pill is cut to "Saved in this br…" and the page tabs run off the edge ("Scienc…"). Decide on a phone header (shorter status, an icon, fewer tabs, or a menu). Matters most if Lineup goes to the App Store.
