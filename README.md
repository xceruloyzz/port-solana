# port-solana

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/xceruloyzz/port-solana/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/xceruloyzz/port-solana/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

PORT SOLANA: Neon Harbor — an original open-world crime game that plays in a desktop browser from static files, no network needed. Explore a sun-soaked neon harbor city at golden hour, on foot and by car: traffic and pedestrians, cars you can steal, a wanted level with police chases, a seven-mission story, combat, repeatable taxi fares, hidden collectible chips, a HUD with a minimap, and a save system. Every city, character, vehicle, name and sound in it is original.

## Run it

```sh
node serve.ts
# then open http://localhost:8080 in desktop Chrome
# or build the entry output: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## How to play

You play as Nico, newly arrived in Port Solana and working for fixer Mara Voss. The game runs entirely with keyboard and mouse — there is no gamepad support and no touch controls, so use a desktop browser.

**Getting started**

- **Enter** or **click** on the title screen — starts the game. If a saved game exists, this continues it.
- **N** on the title screen — starts a brand-new game (and clears the old save).
- **Enter** or **click** after being wasted or busted — starts over with a fresh game.
- **Enter** or **click** on the win screen — drops you back into the city in free roam.

**On foot**

- **W A S D** or the **arrow keys** — walk in eight directions.
- **Shift** (either one, held) — sprint. Walking speed is 145 units/s, sprinting is 235 units/s.
- **E** — get into the nearest car when you are standing close to one; press **E** again while driving to get out. You step out to the side of the car.
- **F** or **mouse click** — attack, aimed at your mouse cursor. Unarmed, this is a punch that hits whatever is directly in front of you. Once you have the pistol (see below), it fires instead — one bullet per press, and it only works on foot, never from inside a car.
- Walk over the pistol pickup in the alley by the central crossing to arm yourself. It comes with 24 rounds; when they are gone, clicks just produce an empty click and an "Out of ammo!" message — there are no refills, so make the shots count.

**Driving**

- **W / ↑** — accelerate (top speed 330 units/s). **S / ↓** — brake, then reverse (up to 110 units/s backwards).
- **A D** or **← →** — steer. Steering only bites while the car is moving, and turns harder as speed builds.
- Letting go of the pedals lets drag slow the car down gradually rather than stopping it dead.
- Turning hard above roughly 130 units/s leaves fading skid marks on the road.
- **E** — get out (the car stays where you left it, parked).

**Any time**

- **P** or **Esc** — pause; press either again to resume.
- **M** — mute / unmute all sound.

While you play, the HUD shows your cash, health, wanted stars, the current mission and objective (with the distance to your target), Mara's latest line of dialogue, and a minimap with your position, the current target, the garage, the harbor, and any neon chips still uncollected. A marker in the world points you at the mission target — the garage, a car, a checkpoint, or the harbor — and an arrow at the edge of the screen points the way when the target is off-screen. When a mission starts or completes, a banner card at the top of the screen announces it.

## The city and systems

**The world.** Port Solana is a 3000 × 2300 top-down city generated from a seed (7 by default; add `?seed=` to the URL for a different one). Six vertical and five horizontal avenues form the road grid, with zebra crosswalks at every intersection. The blocks between them are filled with two to four buildings each — warm dusk-stone, terracotta and plum towers of three to nine floors lit by the sunset, about 40% of them carrying a neon sign in pink, cyan, gold, violet, green or orange, and some carrying a billboard for an original local business (SOLANA MOTORS, NEON NOODLE BAR, HOTEL MARINA, VOSS LOGISTICS, PALM COURT and more). Palm trees line the waterfront promenade and the central avenues. Street lights line the avenues. The southern edge of the map is the harbor: open water that neither you nor any car can enter, with boats bobbing at anchor, dock cranes silhouetted against the sunset, and the harbor pickup point on the waterfront. The whole place is drawn in a permanent golden-hour look — warm sunset light washing over sun-soaked streets, with the neon identity kept in the signs, cars and markers. Buildings are solid: you, pedestrians, cars and bullets all collide with them, and a hard crash into one (above about 130 units/s) costs you health and bounces the car back. Hard crashes throw sparks and shake the camera, damaged cars trail smoke, and a car beaten to zero hit points stops for good as a burnt, smoking wreck.

Two locations anchor the story: the **GARAGE** in the north-west (around x 290, y 220), where every delivery ends, and the **HARBOR** in the south-centre (around x 1500, y 2010), where the final package waits.

**Traffic.** Twenty-six cars drive themselves around the grid, each following one avenue at 55–95 units/s. They slow down for the car ahead of them, stop entirely if you are standing in front of them on foot, sometimes turn onto a crossing avenue at an intersection, and turn around at the edge of the map. Another 36 cars sit parked along the roads. The fleet is mixed: mostly sedans in an eight-colour palette, but also yellow TAXI cabs with roof signs and longer vans and trucks. Every car has 100 hit points and can be damaged by collisions and gunfire; wreck one and it stays where it died, smoking.

**Pedestrians.** Fifty-six pedestrians wander the streets at a stroll, in a varied mix of neon brights and everyday clothing colours. They keep to the roadsides, change direction every few seconds, and flee at more than double their walking speed from anything dangerous nearby: you in a car, gunfire, or a police car. A pedestrian who is punched or shot also flees for a few seconds — if they survive.

**Stealing cars.** Any car you can reach, you can take: walk up and press **E**. Climbing into a parked car is a theft and immediately raises your wanted level by one star — the game flashes "Car stolen!". Taking a car that is already moving in traffic does not add a star, but its driver-less husk becomes yours all the same, and traffic AI no longer drives it. The gold coupe in Mission 2 is a parked car placed on the east side of the city (x 2220, y 640) and marked with a ★.

**Wanted stars and police.** Crimes raise your wanted level, up to five stars: stealing a parked car, punching or shooting a pedestrian, firing the pistol at all, running someone over, ramming a police car, or wrecking one. The police response scales with the stars — the number of patrol cars hunting you is one plus your wanted level, so two cars at one star and six at five stars. New units spawn on roads near you and drive straight at you; they are faster when you are in a car (top speed 305 units/s) than when you are on foot (235 units/s), slow down to pinning range when they get close, and ram you for damage on contact. Police cars have 120 hit points and can be wrecked, but wrecking one raises your wanted level again.

Getting caught works differently on foot and in a car. In a car you can always try to outrun them. On foot, if a police car pins you — stays within about 58 units while you are moving slower than 40 units/s — a busted meter fills over roughly two seconds; let it fill and you are **BUSTED**. Keep moving and the meter drains again.

To lose the heat, break line of sight: if no police car is within about 460 units of you, a hide timer runs, and every seven unseen seconds drops your wanted level by one star ("Heat is cooling…"). Hit zero and the police give up and leave the map — "You lost the police!"

**Combat.** The punch hits pedestrians (30 damage) and police cars (10 damage) in a short arc in front of you. The pistol pickup sits in the alley by the central crossing (x 1220, y 1120). Armed, each shot fires a fast bullet toward your mouse cursor that deals 30 damage to a pedestrian or 22 to a car, stops at the first building it hits, and — fired anywhere — raises your wanted level. Health regenerates slowly on its own (about 1.2 points per second) as long as you are alive; at zero health, from crashes, rammings or running yourself over with trouble, you are **WASTED** and the run ends.

**Sound.** There is no audio file in the game — every sound is synthesised live with WebAudio. Square-wave beeps mark pickups, checkpoints and mission completions (with a little two-note jingle), noise bursts stand in for punches, gunshots and crashes, a low sawtooth buzz sounds when you start a car, and police nearby produce an alternating two-tone siren (660/880 Hz) that only plays while a patrol car is within about 420 units. **M** mutes everything.

## Missions

The story is a seven-mission chain for fixer **Mara Voss**, who briefs you by dialogue line at the start of each job. Missions run in order, each one pays cash on completion, and together they are worth **$3,600**. The current objective and target marker are always on the HUD.

1. **MISSION 1 — MEET MARA** · **$100**
   *"Go to the GARAGE and meet fixer Mara Voss."* A walk (or drive) to the garage in the north-west corner. Step inside the marked zone and the job is done — Mara's first line sets up everything that follows: "You drive, I pay."

2. **MISSION 2 — GOLD COUPE** · **$400**
   *"Steal the marked gold coupe (★) and deliver it to the GARAGE."* The gold coupe is parked on the east side of the city. Steal it with **E** (expect a wanted star for the theft), then drive it into the garage zone yourself — the delivery only counts with you at the wheel of that specific car. The moment you deliver it, the owner calls the police: you finish the mission already carrying **three wanted stars**, which leads straight into…

3. **MISSION 3 — LOSE THE HEAT** · **$300**
   *"Escape! Lose your wanted level completely."* No target marker for this one — just survive and vanish. Break police line of sight and stay unseen, seven seconds per star, until your wanted level reaches zero. Getting busted or wasted fails the run, so keep moving, use the blocks between avenues to break sight lines, and do not commit fresh crimes on the way — each one resets your hide timer.

4. **MISSION 4 — HARBOR RUN** · **$500**
   *"Hit every checkpoint before the timer runs out!"* Four checkpoints in **75 seconds**: the north-east corner, the south-east corner, the south-west by the harbor, and back to the garage. Reaching each checkpoint (within about 64 units) chimes and advances the counter on the objective line; run the timer dry and the run simply restarts with a fresh 75 seconds and the same four checkpoints — no other penalty. A fast car is strongly recommended; you will want to steal one before or during the run.

5. **MISSION 5 — RUSH HOUR** · **$600**
   *"Make all 3 drop-offs across the city before the timer runs out!"* Three timed drop-offs in **150 seconds**: the east avenue, the south-west, and the north-east. Roll into each gold marker to make the drop; the counter on the objective line tracks your progress. Run the clock dry and the job restarts with a fresh 150 seconds and the same three drops — no other penalty.

6. **MISSION 6 — DOCKSIDE DEAL** · **$700**
   *"Pick up the goods at the HARBOR, then deliver them to the BUYER downtown."* Drive south to the harbor pickup point and roll into the marker to load the goods. Picking them up sets your wanted level to **at least two stars**, and you must then deliver them to Mara's buyer, who waits by the central-north crossing (x 1220, y 670).

7. **MISSION 7 — THE FINAL JOB** · **$1000**
   *"Pick up the package at the HARBOR, then deliver it to the GARAGE."* Drive south to the harbor pickup point and roll into the marker to collect the package. Picking it up sets your wanted level to **at least three stars** — "heavy heat", as Mara puts it — and you must then cross the whole city back to the garage with the police on you. Deliver the package and the chain is complete.

**Winning and free roam.** Finishing Mission 7 shows the win screen — Mara's verdict: "You own this harbor now, Nico. Stay golden." Press **Enter** or click and you are back in the city in **FREE ROAM**: no more missions, just the open city — steal cars, run from the police, explore — with all the cash you earned still in your pocket, plus two repeatable ways to keep earning:

- **Taxi fares.** In free roam, a pedestrian near you hails a cab with a gold **!** over their head (they are also marked on the HUD and minimap). Drive any car to them to pick them up; a gold destination marker appears. Deliver them to earn a **$60 base fare plus a speed tip** of up to $90 — the faster the trip, the bigger the tip. Getting out of the car mid-fare cancels it. Your fare count and total taxi earnings show on the HUD and are saved.
- **Neon chips.** Twelve glowing gold chips are hidden around the road grid (the uncollected ones show as gold dots on the minimap, and the HUD counts them). Roll over one on foot or by car to collect it for **+$25** each — $300 in total. Chips can be collected at any time, even during the story.

**Saving and Continue.** Progress is saved to your browser's `localStorage` (key `portsolana-save-v1`) every time you complete a mission, and again when you return from the win screen to free roam, collect a neon chip, or complete a taxi fare. The save records your cash, which mission you are on, where you are standing, which neon chips you have collected, and your taxi fare count and earnings. On the title screen, **Enter** or a click **continues** that save — you resume with your money and mission at the saved spot — while **N** starts a new game and deletes it. Saves written by the earlier five-mission version still load: the old Mission 4 (The Final Job) continues as Mission 7, and an old finished game continues in free roam. A couple of honest quirks: continuing at Mission 3 restarts you at three wanted stars (that is how the mission begins), and continuing at Mission 4 or 5 restarts that timed run with a fresh timer. Health, ammo, wanted level beyond those mission setups, and the state of individual cars are not saved — you always resume at full health, and if you had the pistol you will need to pick it up again.

## Screenshots

The four screenshots in this repo (`shots.json`) are staged scenes rendered by the game itself, not artwork: the title screen, a city view, a driving scene, and a police chase, all generated with `?shot=<scene>&seed=1` URLs that set up the scene, freeze the game, and flag the frame as ready to capture.

---

<sub>Entered on [make.fun](https://make.fun/?ref=ztsmgxnm&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
