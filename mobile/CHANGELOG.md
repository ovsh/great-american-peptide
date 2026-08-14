# Poke release notes

What changed in Poke, written for the person holding the phone. The newest version
is first.

This file is the source. When a version ships, its section becomes the "What's New"
text in `store.config.json` under `releaseNotes`, and `npx eas metadata:push` sends
that text to the App Store. The same sections feed the support site.

## How to write an entry

The voice is plain, because Poke keeps a medical record and a calm record earns more
trust than a cheerful one. These are tests, not preferences.

- Write what changed on the user's screen. Do not write what changed in the code.
- Never name a feature Poke does not have. Read the code before you write the line.
  A line that describes an unbuilt feature is worse than no line at all.
- Poke is the actor, by name. Never "we", and never a bare "it" that could point at
  two things.
- Active voice. "Poke saved your shot", not "your shot has been saved".
- No contractions.
- No em-dashes. One comma per sentence. An enumerated list keeps its commas.
- One idea per line.
- The common word, not the clever one. "How often" beats "Frequency".
- No filler openers. Cut "Simply", "Just", "Easily" and "Seamlessly".
- No hedging, with one exception. A hedge over something Poke does not do is
  load-bearing, and stripping it invents a feature.
- Medical and subscription lines get clearer, never weaker. Show the owner the
  before and the after, apart from the rest.
- Name no dose and no drug brand as an example. Poke never proposes a number.
- A version appears below after it reaches the App Store. Work that is built and not
  shipped sits under Unreleased.
- The App Store holds 4000 characters of release notes. An entry that does not fit
  there is too long for this file too.

---

## 1.5.0

Released 14 August 2026.

- Poke tracks a cycle. Set the weeks on and the weeks off, and Poke counts the week
  you are in. On the last planned day Poke offers the break, and a reminder names
  the day the break ends. Poke proposes no length and starts no cycle on its own.
- Two new schedules. Take a shot every few days, or on the same days each week.
- A plan can carry a different dose for each shot day. The reminder, the Today
  screen and History all name the dose that day carries.
- You can delete a logged shot. The shot's own screen holds the delete, so a shot
  filed on the wrong day comes out from where you see it.
- The weekly pace accepts zero. A goal at your current weight reads as Maintain.
- A day without side effects can say so. Mark the day clear, and the record and the
  export both carry the answer.
- Setup accepts more than one custom medication. Type a name Poke does not list, and
  Poke offers to add it.
- Pills sort the medication list by category, from GLP-1 to Hormones to Blends.
- The library adds testosterone in four esters, estradiol in two forms, and the
  popular blends.
- A blend can draw a level curve. Enter the composition from your vial label, and
  Poke draws each part at its own rate.
- Search works on the Add medication screen.
- Poke reads your weight from Apple Health. Setup offers the connection, and Profile
  holds a row for it. Poke reads body mass only, and Poke sends nothing back.
- You can edit a shot you already logged. Open the shot in History and change the
  medication, the dose, the site, the day, the time or the note.
- The body diagram offers every site, both glutes included. Poke accepts a glute as
  a shot under the skin, not only as a shot into the muscle.
- The site dots are larger, and Poke takes the site nearest your finger.
- The diagram names the side you are looking at. A site on the front reads as "on the
  front" while you look at the back.
- Poke names the route in plain words. "Under the skin" and "into the muscle" replace
  SC and IM everywhere you read them.
- The paywall draws your own estimated level curve instead of describing it.
- An app update leaves your records alone. If the database cannot open after an
  update, Poke offers to export everything before Poke tries again.
- The yearly plan carries a 3 day free trial for new subscribers.

## 1.4.0

Released 12 August 2026.

- Setup is shorter. Every question fits in one look.
- The dose is a wheel, not a keyboard.
- The schedule strip shows both shot days.
- Poke sends three kinds of reminder. Poke asks on shot day, checks in the day after,
  and catches a missed day the next morning.
- Each reminder has its own switch in Profile. Poke sends at most one a day for each
  medication.
- The plan reads in three glances: the date, the distance and the curve.

Fixed:

- Poke uses the reminder time you pick.
- The free level chart draws the true shape of your curve.
- Text no longer hides behind buttons.

## 1.3.0

Released 11 August 2026.

- Today shows one medication at a time, with your other medications in a rail above
  it.
- A free account holds two medications.
- History shows one month at a time.
- Progress opens on the day you started, the shots you have logged, and the weeks you
  have kept the run.
- Setup ends on a plan Poke works out from your answers. The pace slider moves the
  target date while you watch.
- The peptide library grew by 14 presets, and a search finds them.
- Every half-life names its source. Where Poke has no source, Poke draws no curve and
  says so.
- Brand names have their own rows in the medication picker. A brand you pick keeps
  the name you picked.

## 1.1.0

Released 7 August 2026.

- Poke is rebuilt around four tabs: Today, History, Progress and Profile.
- One screen logs a shot. A body diagram takes the site.
- Poke records side effects, and Poke counts the weeks you keep the run.
- Poke Pro arrives. Pro opens the exact level chart, the progress charts, unlimited
  medications and a CSV export of your history.

## 1.0

Released 30 April 2026.

- The first release. Poke records your medications, your shots and your weight.
- Poke needs no account and no sign-in. Your records stay on this phone.
