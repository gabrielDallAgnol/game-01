# Hold Hollowmere: Apple HIG spacing and layout spec (phone)

Target: iPhone portrait, 390×844 CSS px, in the Claude app web view. In WKWebView at 1× zoom, **1 CSS px = 1 pt**, so HIG point values carry over 1:1.

Audit date: 2026-10-19. Sources: `index.html` (CSS) and `src/ui/app.js` (markup), read-only. Screenshots were taken at 390×844 with the touch flag on (`hig-*.png` in the session scratchpad).

---

## 0. The HIG rules that matter here

| Topic | HIG rule (quoted or condensed) | What it means for us |
|---|---|---|
| Text size | iOS default **17 pt**, minimum **11 pt** (Typography, Designing for games) | Nothing below 11px. Body copy is 15 to 17px. |
| Thin/custom fonts | "If you use a custom font with a thin weight, aim for larger than the recommended sizes" | Barlow and Plex Mono at 11px are too small for paragraphs |
| Leading | "If you need to display three or more lines of text, avoid tight leading" | `.opt .ds` at 1.25 and `.card h1` at .95 are too tight |
| Touch targets | Frequent controls **44×44 pt**. "Less important controls, such as menus" **28×28 pt** minimum (Game controls) | Build, Bell, Place, Continue and choices need 44. Close, zoom and menu need at least 28 visible and a 44 hit area. |
| Spacing between controls | About **12 pt** of padding around bezeled controls, about **24 pt** around unbezeled ones (Accessibility) | Gaps between buttons are at least 8, ideally 12 |
| Margins | UIKit root layout margins: **16 pt** on compact width, **20 pt** on regular width | Screen gutter is 16; cards get 16 to 20 inside |
| Hierarchy | Put the most important items top and leading. Align to scan, indent to subordinate, group related items. Use progressive disclosure (Layout). | One idea per row; hide breakdowns until tapped |
| Virtual controls | Place frequent buttons near the thumb. "Place secondary controls, like menus, at the top of the screen." "Hide controls when an action isn't available" (Game controls). | The ⋯ menu belongs at the top. Hide the Bell at night (already done). |
| Toolbars | "Aim for a maximum of three" groups. "Only specify one primary action, and put it on the trailing side." Titles under 15 characters. | The dock has 3 groups, with the Bell as the only prominent button, on the right |
| Buttons | Use one or two prominent buttons per view. "Use style, not size" to mark the preferred choice. | Cards have one amber button; the rest are ghost buttons |
| Modality | Give an obvious way to dismiss ("a button in the top toolbar or swipe down"). Keep tasks short. Show one modal at a time. | Status, Log, Crew and Chat get a top-trailing × |
| Sheets | Use the medium detent "to allow progressive disclosure". Include a grabber. Show only one sheet at a time. | The panel and build drawer behave like medium-detent bottom sheets |
| Alerts | Up to three buttons; titles of at most two lines; default button on the trailing side | Encounter choices stay in a stack (3+ options) |
| Time-boxed UI | "Minimize use of time-boxed interface elements … prefer dismissing views with an explicit action" | Long toasts become System windows |
| Contrast | 4.5:1 up to 17 pt; 3:1 at 18 pt or for bold text | Red text needs a lighter tint |
| Materials | "Thicker materials … provide better contrast for text" | Text-heavy panels use alpha .9 or more |
| Game menus | "Make sure your menus remain easy to open and read … modify the size of the tap targets" | Phone-specific sizes for everything in `body.compact` |

### What shipping strategy games do on phones

| Game | Pattern | Takeaway |
|---|---|---|
| Clash of Clans (UI revamp) | **Battle** sits bottom-left and **Build** bottom-right, "mirrored" so the two halves of the loop get "equal weight". Settings and Inbox are folded into the top-left Profile button. The shield sits next to resources because it "protects your resources". Each Build tab shows "only the currencies it can spend". | Group controls by function. Keep the two core verbs at the bottom corners. Show only the numbers that matter in context. |
| Bad North | "Minimalism is the thread that runs through just about everything"; systems "are hidden away so you can get into it a lot more easily" | Progressive disclosure over always-on numbers |
| General HUD practice | Keep 3 to 5 persistent elements. Status sits top-left, actions bottom. Keep the center clear. Keep mobile text at 14px or more, or switch to icons. | Our top HUD shows 9 to 12 values. Cut that to 5 visible ones. |

---

## 1. Tokens

### 1a. Spacing scale (4-pt base, 8-pt rhythm, "soft grid": measure the gaps)

| Token | px | HIG / iOS mapping | Use |
|---|---|---|---|
| `--s1` | 4 | half step | icon to label, eyebrow to title |
| `--s2` | 8 | base unit | gap inside a group, between chips, toast stack |
| `--s3` | 12 | ~12 pt padding around bezeled controls | gap between buttons and tiles, padding inside options and tiles |
| `--s4` | 16 | compact layout margin | screen gutter, card side padding, panel padding |
| `--s5` | 20 | regular layout margin | card top padding; card padding at widths of 430 or more |
| `--s6` | 24 | ~24 pt around unbezeled elements | gap between card sections (h2 top margin) |
| `--s8` | 32 | double unit | separation between major blocks (start-screen sections) |

- Rule: every `gap`, `padding` and `margin` uses one of these 7 values. Today the CSS has **13 gap values** and **42 distinct padding strings** (odd values such as 5, 7, 9 and 11).
- Optical exceptions (1 to 2px tweaks for cap height) go on the text element only, never on containers.

### 1b. Type scale (CSS px, mapped to iOS Dynamic Type "Large (default)")

| Token | Size / line | Weight | HIG style | Use in game |
|---|---|---|---|---|
| `--t-large` | 34 / 41 | 700 display | Large Title | start screen h1, end screen h1 |
| `--t-title1` | 28 / 34 | 700 display | Title 1 | episode title card (`#episode b`) |
| `--t-title2` | 22 / 28 | 700 display | Title 2 | card titles (`.card h1.sm`) |
| `--t-title3` | 20 / 25 | 700 display | Title 3 | perk/pack names, panel title |
| `--t-headline` | 17 / 22 | 600 | Headline | buttons, option names, card h2, HUD numbers |
| `--t-body` | 17 / 24 | 400 | Body (leading loosened for 3+ lines) | story pages, System window lines, card paragraphs |
| `--t-sub` | 15 / 20 | 400 | Subheadline | option descriptions, choice blurbs, toasts |
| `--t-foot` | 13 / 18 | 400 | Footnote | dock status line, notes (replaces `.tiny` paragraphs), table cells |
| `--t-cap1` | 12 / 16 | 500 | Caption 1 | eyebrows, HUD labels, costs, chronicle dates |
| `--t-cap2` | 11 / 13 | 600 | Caption 2, **floor** | uppercase tags only: Lv, rarity, edge-arrow counts |

- Today there are **20 distinct font sizes**, including 10, 10.5, 11.5, 12.5 and 15.5. Collapse them into the 10 steps above.
- Mono (`--mono`) is only for `[System]` eyebrows and tags. **Never use it for paragraphs**: today `.tiny`, `#info` and `.toast.sys` set whole sentences in 11 to 12.5px mono.
- Weight: 600 or 700 for display and headline; never below 400.

### 1c. Radius and material

| Token | px | Use |
|---|---|---|
| `--r-chip` | 6 | tags, rating chip |
| `--r-ctl` | 10 | options, tiles, inputs |
| `--r-sheet` | 16 | cards, panel, drawer, toasts |
| `--r-cap` | 999 | pills and capsule buttons |

- Today there are 14 radius values (1, 2, 3, 4, 6, 7, 8, 9, 10, 14, 16, 50%, 999 and a 4-value form). Inner radius = outer radius minus padding (HIG: radii are "concentric").
- Panel material: `--panel` at `rgba(16,18,20,.82)` is fine for HUD pills. For text-heavy sheets (`#panel`, drawer), use **.90** (a thicker material for text).

---

## 2. Layout rules per surface (390×844)

```
 ┌──────────── 390 ────────────┐
 │ safe-top + 8                │
 │ [Day 1 · Lv1 ▬▬]  [●12 ◆6 ■3 ✋4] [⋯] │  ← top HUD, 44 high, 16 gutter
 │ (Power / Heat row, only once unlocked)  │
 │   toasts: 1 at a time, under HUD        │
 │                              │
 │        center stays clear    │
 │                              │
 │                      (ABILITY 64) │  ← 16 above dock, 16 from edge
 │ ┌ panel / drawer sheet ─────┐│  ← attaches above dock, max 44vh
 │ └───────────────────────────┘│
 │ [Build]  ☼ Tonight ~12 Easy [Ring bell +9] │ ← dock, 60 high
 │ safe-bottom + 8             │
 └─────────────────────────────┘
```

### Top HUD (`#hud .top`)

| Rule | Value |
|---|---|
| Rows | 1 row (`flex-wrap:nowrap`). A 2nd row appears only when Power or Heat is unlocked. |
| Height | Pills 44 (they are tappable); the secondary row is 32 |
| Inset | top `calc(env(safe-area-inset-top) + 8px)`, sides 16 |
| Leading group | Day/Night + number, Lv tag, keep meter. One pill; tap opens Status. |
| Trailing group | scrap, food, people, hands: **icon + number only** (17px Headline) |
| Deltas (`+6`, `+0 −3`, `3 free`) | Hidden by default. Tap the resource pill to open a small popover with the dawn breakdown. When food will run short, show a `!` icon and red tint (not color alone). |
| ⋯ menu | Moves to the top-trailing corner (HIG: secondary controls go at the top), 44×44 |
| Night | Only Day, keep and dead-left show; resources hide (already done) |
| Empty pills | `#threatPill` is hidden while Power and Heat are both locked (today it renders as an empty 22×9 capsule) |
| Max persistent items | 5 (day, keep, scrap, food, people/hands) |

### Bottom dock (`#dock .bar`): the game's toolbar

| Rule | Value |
|---|---|
| Groups | Exactly 3: **Build** (leading), status (center), **Ring bell** (trailing, the only prominent button) |
| Height | 60 = 44 control + 2×8 padding; radius 30 (concentric with 22-radius buttons) |
| Inset | bottom `calc(env(safe-area-inset-bottom) + 8px)`, sides 16 (box-sizing fix, see P1-1) |
| Build | 44 high, icon 20 + "Build" in 17px semibold |
| Ring bell | 44 high, `white-space:nowrap`, label "Ring bell", bonus as a badge (`+9`, 12px chip) |
| Status line | **One line, 13px, max 3 tokens**: sun dial · `Tonight ~12` · rating chip. `text-overflow:ellipsis`. |
| Extra states (weather, siege target, hive burst, loose dead) | A chip row 8px above the dock, at most 2 chips, each 28 high, 12px |

### Floating controls

| Control | Size | Position |
|---|---|---|
| Ability (`#ability`) | 64 circle; name 13 semibold, cooldown or cost 15 | trailing 16, 16 above dock or open sheet |
| ⋯ menu stack | 44×44 items, gap 8 | drops down from the top-trailing ⋯ |
| Zoom +/− | hidden on touch (pinch exists; HIG says to prefer in-game gestures over extra virtual buttons) | — |
| Joystick | 88 ring (fine); fades in where the thumb lands (already done, matches HIG) | — |

### Build drawer (`#tray.open`)

| Rule | Value |
|---|---|
| Form | Bottom sheet attached above the dock, width = screen minus 2×16, radius 16, padding 12 |
| Header row | "Build" 17 semibold leading · "✋ 4 free hands" 13 trailing (replaces the 11px mono line) |
| Grid | 3 columns, gap 8; tiles min-height 72, radius 10 |
| Tile | icon 24 → name 15 semibold → cost 13 (icon + number) |
| Disabled | opacity .45 plus a reason on tap (already done via toast) |
| Tech row | after a 1px separator; locked tiles read "Keep 2" in 12px |
| Foreman | full-width segmented control, 4 segments, 36 visible / 44 hit area |
| Max rows | 2 visible; scroll beyond that |

### Selection panel (`#panel`): a medium-detent sheet

| Rule | Value |
|---|---|
| Height | `max-height:44vh` (keep); padding 16; radius 16 |
| Header | Eyebrow (12 caps, muted) **on its own line**; title 20 below; × 44×44 at top-trailing |
| Stats row | Max 2 facts, 13px, `·` separators at most once |
| Options | **1 column on phones** (today 2 columns, which squeezes descriptions to 11px) |
| Option row | min-height 56, padding 12. Name 17 semibold leading, cost 13 trailing. Description 15/20, max 2 lines (about 80 characters). |
| Destructive (Pull down) | Last row; red text tint; 2-tap confirm (keep) |

### Cards and sheets (`#overlay .card`): encounters, perks, packs, trader, log, end

| Rule | Value |
|---|---|
| Anchor (compact) | **Bottom** (`place-items:end center`), not vertically centered. This keeps choices in thumb reach and leaves the map visible above. |
| Width | 100% minus 2×16 (needs box-sizing, see P1-1); max 460 (wide cards 560 on phones) |
| Padding | 20 top / 16 sides / 16 bottom |
| Rhythm | eyebrow → 4 → title → 12 → body → 16 → actions; section h2: 24 above, 8 below |
| Title | 22/28 (h1.sm); start/end h1 34/41 |
| Body | 17/24 story pages (already done); paragraphs 17/24; notes 13/18 in the body font |
| Actions | One prominent primary button **trailing** (or full width). Secondary actions use ghost style, leading. **2 buttons per row max**; 3+ choices stack full width (encounter choices already do). |
| Sticky actions | The action row is `position:sticky; bottom:0` inside the scrolling card, so the primary button never sits below the fold |
| Dismiss | Non-decision cards (Status, Log, Crew, Chat) get a × 44×44 at top-trailing; Back/Close stays at the bottom as secondary |
| One at a time | Keep the queue (already done) |
| Perk/pack cards | stacked; min-height 88; family line 12 caps; name 20; description 15 |

### System windows (`.win`, `.sysw`)

| Rule | Value |
|---|---|
| Lines | Max 4 bullets, each 2 lines or fewer (about 90 characters); 17/24 body font; gap 12 |
| Eyebrow | `[System]` mono 12, cyan |
| Button | One full-width primary: "Got it" or "Next · 2 more" |
| Long toasts | Any toast over 12 words becomes a System window (for example the Day 1 opener and the autopilot-on message) |

### Toasts (`#toasts`)

| Rule | Value |
|---|---|
| Count | **1 visible on compact** (today 2), 3 on desktop |
| Position | top = safe-top + 8 + 44 + 8 (under the HUD row), width = screen minus 32 |
| Box | padding 8/12, radius 16, 15/20 body font; System toasts get a 12px mono eyebrow and a 15px body-font message |
| Length | 12 words or fewer; tap to dismiss (already done) |

### Status window (`showStatus`)

| Rule | Value |
|---|---|
| Form | Full-height sheet (large detent), × at top-trailing |
| Stat grid | **2 columns** on phones (today 3, which leaves "Power" orphaned on its own row); label 12 caps, value 17 |
| Order | Stats → Your path → Companions → Titles → Chronicle (5 rows + "Show all") → Settings row |
| Path explainer | 13/18 body font (today 11px mono, 4 lines) |
| Chronicler toggle | A 44-high settings row (label 15 + switch), not an inline checkbox in 11px mono |

### Start screen (`showStart`)

| Rule | Value |
|---|---|
| Order | Title → 1-line pitch → **Continue** (if saved) → Difficulty → Land → sticky **Raise the town** |
| Progressive disclosure | "It starts small…", the "Your hero" paragraph and "What's new" fold into one `<details>` titled "How a run works" |
| Hint line | Device-aware: on touch "Drag to walk · pinch to zoom"; on desktop "WASD to walk · scroll to zoom" |
| Grids | Difficulty 2×2 and Land 2 columns (already fine), gap 12 |

---

## 3. Audit: what is wrong today (measured at 390×844)

| # | Selector | Measured / current | Problem (HIG rule) |
|---|---|---|---|
| A1 | `.card` | **404px wide at x = −7** on a 390 screen | Card is clipped at both edges. Root cause: no `box-sizing:border-box`, so `width:100%` plus 22px padding overflows. |
| A2 | `.bar`, `#panel`, `#tray` | 372 / 376px inside a 358px dock (x = 9 or 7, not 16) | Same root cause; panels break the 16px margin |
| A3 | `.opt .ds` | 11px, line-height 1.25, up to 3 lines | At the legibility floor with tight leading. This is the main "convoluted" text in panels. |
| A4 | `.tiny` used as paragraphs (start, status, crew) | 11px **mono**, 4 to 5 lines | Too small for body text; mono hurts reading |
| A5 | `.who span`, `.chron li span`, `.enc .chr` | 10.5px | Below the 11pt minimum |
| A6 | `.heat .lbl`, `.perk .rar`, `.opt .rarity` | 10px | Below the 11pt minimum |
| A7 | `#buildBtn` | 85×32 | Frequent action under 44 |
| A8 | `#pClose` / `.x` | 26×26 | Under even the 28 minimum for secondary controls |
| A9 | `#dayPill` (button) | 175×28 | Opens Status; meets only the 28 minimum |
| A10 | `.side button` (menu, zoom, log, speed, …) | 36×36 | Under 44 hit area |
| A11 | `.btn` / `.btn.sm` | ~30px / ~26px tall | Card actions (Skip, Talk, Back, Reroll) under 44 |
| A12 | `#bell` | 118×47, wraps to 2 lines ("Ring the bell · +9") | Primary label breaks; the bonus reads as part of the name |
| A13 | `#info` | 12px mono, 2 lines, up to 7 tokens (`☼ · ~1 · Tonight ~1 from 1 hive · Easy · siege at … · Fog`) | Too many items in one line, unclear hierarchy |
| A14 | `#resPill` | 9 values in one 25px pill (`12 +6 ◆6 +0 −3 ■3 ✋4/4`) at 11 to 16px | Crowded; deltas are cryptic with no label |
| A15 | `.top` | Two stacked pills, left-aligned; right side empty except `#threatPill` (22×9 empty capsule) | Unbalanced; empty element rendered |
| A16 | `#overlay` | `place-items:center`: encounter card floats mid-screen | Choices sit outside thumb reach; the card covers the middle of the map |
| A17 | Status card | Exit is only a "Back" at the bottom after scrolling | No obvious top dismiss (Modality) |
| A18 | Start card | "Raise the town" sits below about 2 screens of scroll | Primary action not visible |
| A19 | `.phead` | eyebrow and title on one line ("TOWN CENTRE KEEP · LEVEL 1") | Two hierarchy levels read as one |
| A20 | `.opts` in the panel | 2 columns on phones | Descriptions squeezed into 11px, 3-line blocks |
| A21 | `.statgrid` | 3 columns, 7 items, so "Power" sits alone | Ragged grid |
| A22 | `.side` (⋯) | Bottom-right above the ability button | HIG: menus go at the top; the thumb zone is for actions |
| A23 | `.bad`, `.tiny.warn`, `#hands.none` | `#d5513d` text on `#16181b` = **4.30:1** | Below 4.5:1 for text under 18pt |
| A24 | CSS values | 20 font sizes, 13 gaps, 42 paddings, 14 radii | No system, which makes spacing look uneven |
| A25 | Toasts | 2 at once on compact, mono 12.5px, some over 25 words, auto-dismissed | Time-boxed text the player has to read |
| A26 | Test harness only | `·` renders as `Â·`, `✦` as `âœ¦` in file:// shots | No `<meta charset>`. The artifact host adds one; **verify on device** before acting. |

---

## 4. Prioritized fix list (selector → new value)

### P1: breaks layout or HIG minimums

| # | Selector | New value |
|---|---|---|
| 1 | `*,*::before,*::after` | `box-sizing:border-box` (fixes A1 and A2) |
| 2 | `.opt .ds` | `font-size:15px; line-height:20px` |
| 3 | `.encopts .opt .ds` | `font-size:15px; line-height:20px` (was 12.5) |
| 4 | new `.note` replacing paragraph `.tiny` (`style="white-space:normal"` uses in app.js) | `font:13px/18px var(--body); color:var(--muted); white-space:normal` |
| 5 | `.who span`, `.chron li span`, `.enc .chr` | `font-size:12px` |
| 6 | `.heat .lbl`, `.perk .rar`, `.opt .rarity` | `font-size:11px` (floor) |
| 7 | `#buildBtn`, `#bell`, `.place .btn` | `min-height:44px` |
| 8 | `#bell` | `white-space:nowrap; max-width:none`; label "Ring bell" + `<span class="badge">+9</span>` |
| 9 | `.x`, `#pClose`, `#pCancel` | `width:44px; height:44px; font-size:22px` |
| 10 | `.side button` | `width:44px; height:44px` |
| 11 | `body.compact .btn` | `min-height:44px; padding:0 16px` |
| 12 | `.btn.sm` | `min-height:36px`, plus `position:relative` and a `::after{inset:-4px}` hit area to 44 |
| 13 | `#dayPill`, `#resPill` (compact) | `min-height:44px; padding:0 12px` |
| 14 | `#goldNote`, `#foodNote`, `#popNote` (compact) | `display:none`; show `!` only when `.warn`; tap `#resPill` for the breakdown |
| 15 | `#info` (compact) | `font:13px/18px var(--body); white-space:nowrap; overflow:hidden; text-overflow:ellipsis`; max 3 tokens |
| 16 | `body.compact #overlay` | `place-items:end center` |
| 17 | `.card` | `padding:20px 16px 16px; border-radius:16px` |
| 18 | card action row (`.card .cardrow:last-child`) | `position:sticky; bottom:-16px; padding-top:12px; background:linear-gradient(transparent,var(--panel-solid) 30%)` |
| 19 | Status, Log, Crew, Chat headers (`.sysline`, `.eyebrow`) | add a × 44×44 at top-trailing that does the same as Back |
| 20 | `.bad`, `.tiny.warn`, `#hands.none`, `.crewrow .bad` | `color:#e8705c` (5.85:1); keep `--blood` for fills and borders |

### P2: hierarchy and consistency

| # | Selector | New value |
|---|---|---|
| 1 | `:root` | add the `--s1…--s8`, `--t-*` and `--r-*` tokens from section 1; replace raw values |
| 2 | `.top` | `flex-wrap:nowrap; justify-content:space-between; align-items:center`; day pill leading, resources trailing |
| 3 | `#threatPill` | `hidden` when `#pwr` and `.heat` are both hidden (app.js `updateHud`) |
| 4 | `#menuBtn` | move into `.top`, trailing; `.side` opens downward from the top |
| 5 | `.phead` | `flex-wrap:wrap`; `#pEyebrow{flex-basis:100%}`; `.phead b{font-size:20px}` |
| 6 | `body.compact .opts`, `.opts.two` | `grid-template-columns:1fr; gap:8px` |
| 7 | `.opt` | `padding:12px; min-height:56px; border-radius:10px; gap:4px` |
| 8 | `.opt .nm`, `.encopts .opt .nm` | `font-size:17px` |
| 9 | `.card h1.sm` | `font-size:22px; line-height:28px` |
| 10 | `.card h1` | `font-size:34px; line-height:41px` (drop the clamp) |
| 11 | `.card h2` | `margin:24px 0 8px` |
| 12 | `.card p` | `font-size:17px; line-height:24px` |
| 13 | `.eyebrow` | `font-size:12px; letter-spacing:.08em` |
| 14 | `.btn` / `.btn.big` | `font-size:17px` / `font-size:17px; min-height:50px` |
| 15 | `.choice span`, `.pd` | `font-size:15px; line-height:20px` |
| 16 | `.perk b` | `font-size:20px` |
| 17 | `.winl` | `font-size:17px; line-height:24px; gap:12px` |
| 18 | `.statgrid` (compact) | `grid-template-columns:1fr 1fr; gap:12px` |
| 19 | `.toast` | `font:15px/20px var(--body); padding:8px 12px; border-radius:16px` |
| 20 | `.toast.sys` | `font:15px/20px var(--body)`; only `.sh` stays mono 12px |
| 21 | toast cap (app.js `toast()`) | `compact ? 1 : 3` (was 2 : 3) |
| 22 | toast length (app.js) | over 12 words → `kind:'win'` (System window) |
| 23 | `body.compact .tray` | `padding:12px; gap:8px; border-radius:16px` |
| 24 | `body.compact .tb` | `min-height:72px; border-radius:10px`; `.tn` 15px semibold; `.cost` 13px |
| 25 | `.tray .hands` | becomes a header row: "Build" 17 semibold + hands 13 trailing, body font |
| 26 | `body.compact .bar` | `padding:8px; border-radius:30px; gap:12px` |
| 27 | `#hud` padding-block | top `calc(8px + env(safe-area-inset-top))`, bottom `calc(8px + env(safe-area-inset-bottom))` |
| 28 | `#panel` / `#tray` background | `rgba(16,18,20,.9)` (thicker material for text) |
| 29 | Start screen (app.js `showStart`) | wrap "It starts small", "Your hero" and "What's new" into one `<details>` titled "How a run works" |
| 30 | `.ar span` | `font-size:12px` |

### P3: polish

| # | Selector | New value |
|---|---|---|
| 1 | `#zIn`, `#zOut` | hidden on `(pointer:coarse)` |
| 2 | `#episode` | `padding:16px 24px`; `b{font-size:28px; line-height:34px}` |
| 3 | `.ability .an` / `.ability .ac` | `13px semibold` / `15px` |
| 4 | `table.log` | `font-size:13px`; cell padding `8px 12px 8px 0` |
| 5 | `.ar.big`, `#crewBtn.alert`, `.heat.hot .hm`, `#blackout` | add to the `prefers-reduced-motion` block (no pulse) |
| 6 | Start hint (app.js) | device-aware text (touch vs keyboard) |
| 7 | `.pill`, `.bar`, `.tb`, `.place`, `#panel`, `.toast` | one shared blur: `backdrop-filter:blur(12px)` |
| 8 | Radii | replace 2, 3, 4, 7, 9 and 14 with `--r-chip` (6), `--r-ctl` (10) and `--r-sheet` (16) |
| 9 | `.chron` | show the latest 5 + a "Show all" disclosure |
| 10 | `<head>` | confirm the host injects `<meta charset="utf-8">`; if not, add it (A26) |

---

## 5. Acceptance checks (quick, measurable)

| Check | Pass |
|---|---|
| No visible text under 11px; no paragraph text under 13px | script: every text node `getComputedStyle().fontSize >= 11` |
| Every frequent control 44×44 or larger; secondary controls 28 or larger visible with a 44 hit area | script over `button, [role=button]` |
| `.card`, `#panel`, `#tray` and `.bar` fit within x 16 to 374 at 390 width | `getBoundingClientRect()` |
| Dock status fits one line at 390 | `#info.scrollWidth <= #info.clientWidth` |
| At most 1 toast on compact | `#toasts.children.length <= 1` |
| Spacing values ⊂ {4, 8, 12, 16, 20, 24, 32} | grep CSS |
| Text contrast 4.5:1 or more (small) | checked: muted 7.0:1, bone 10.8:1, amber 6.1:1, cyan 10.5:1; red needs `#e8705c` |

---

## 6. Sources

| Topic | URL |
|---|---|
| HIG: Designing for games (text and button size tables) | https://developer.apple.com/design/human-interface-guidelines/designing-for-games |
| HIG: Typography (Dynamic Type tables, leading, minimums) | https://developer.apple.com/design/human-interface-guidelines/typography |
| HIG: Layout (hierarchy, grouping, progressive disclosure, safe areas) | https://developer.apple.com/design/human-interface-guidelines/layout |
| HIG: Game controls (touch control placement, 44/28 pt, hide controls) | https://developer.apple.com/design/human-interface-guidelines/game-controls |
| HIG: Accessibility (contrast table, control spacing 12/24 pt, time-boxed UI) | https://developer.apple.com/design/human-interface-guidelines/accessibility |
| HIG: Buttons (44×44 hit region, one or two prominent buttons) | https://developer.apple.com/design/human-interface-guidelines/buttons |
| HIG: Toolbars (max 3 groups, one primary action trailing, title under 15 characters) | https://developer.apple.com/design/human-interface-guidelines/toolbars |
| HIG: Tab bars (navigation vs actions, badges) | https://developer.apple.com/design/human-interface-guidelines/tab-bars |
| HIG: Modality (dismiss, one modal at a time) | https://developer.apple.com/design/human-interface-guidelines/modality |
| HIG: Sheets (detents, grabber, one sheet) | https://developer.apple.com/design/human-interface-guidelines/sheets |
| HIG: Alerts (up to 3 buttons, title of 2 lines or fewer, button placement) | https://developer.apple.com/design/human-interface-guidelines/alerts |
| HIG: Menus (in-game menus, menu length) | https://developer.apple.com/design/human-interface-guidelines/menus |
| HIG: Materials (thicker materials for text, vibrancy) | https://developer.apple.com/design/human-interface-guidelines/materials |
| Apple: Adapting your game interface for smaller screens | https://developer.apple.com/documentation/metal/adapting-your-game-interface-for-smaller-screens |
| UIKit root layout margins: 16 pt compact, 20 pt regular | https://useyourloaf.com/blog/changing-root-view-layout-margins/ |
| 8-pt grid / soft grid for iOS | https://spec.fm/specifics/8-pt-grid |
| Supercell: Clash of Clans UI revamp | https://supercell.com/en/games/clashofclans/blog/news/weve-revamped-the-clash-of-clans-user-interface/ |
| Bad North minimalism (Plausible Concept interview) | https://www.pocketgamer.biz/interview/68638/indie-spotlight-plausible-concept-on-bad-north/ |
| HUD design: persistent items, corners, mobile text | https://www.abratabia.com/game-ui-design/hud-design.php |
