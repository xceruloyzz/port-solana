// Story data for Port Solana v3: the 10-mission chain for fixer Mara Voss,
// her dialogue lines, and the checkpoint / drop-off / tail-route / roadblock /
// boat-cargo layouts the flow uses. The original seven jobs keep their order
// and payouts; three new jobs (tailing, roadblock getaway, boat cargo) tour
// the v3 districts and landmarks.
export const MISSIONS = [
  { title: 'MISSION 1 — MEET MARA', obj: 'Go to the GARAGE and meet fixer Mara Voss.', pay: 100 },
  { title: 'MISSION 2 — GOLD COUPE', obj: 'Steal the marked gold coupe (★) and deliver it to the GARAGE.', pay: 400 },
  { title: 'MISSION 3 — LOSE THE HEAT', obj: 'Escape! Lose your wanted level completely.', pay: 300 },
  { title: 'MISSION 4 — HARBOR RUN', obj: 'Hit every checkpoint before the timer runs out!', pay: 500 },
  { title: 'MISSION 5 — RUSH HOUR', obj: 'Make all 3 drop-offs across the city before the timer runs out!', pay: 600 },
  { title: 'MISSION 6 — TAIL THE INFORMANT', obj: 'Tail the informant\'s violet sedan — stay close, but not too close — to the VOSS FREIGHT TERMINAL.', pay: 550 },
  { title: 'MISSION 7 — DOCKSIDE DEAL', obj: 'Pick up the goods at the HARBOR, then deliver them to the BUYER downtown.', pay: 700 },
  { title: 'MISSION 8 — ROADBLOCK GETAWAY', obj: 'The deal went loud! Police roadblocks are up — get to the GARAGE, any way you can.', pay: 800 },
  { title: 'MISSION 9 — HARBOR CARGO', obj: 'Take the boat from the HARBOR, recover 3 floating cargo crates, then dock at the EAST PIER.', pay: 900 },
  { title: 'MISSION 10 — THE FINAL JOB', obj: 'Pick up the package at the HARBOR, then deliver it to the GARAGE.', pay: 1000 },
];
export const DIALOGUE = [
  'Mara Voss: "Nico. You drive, I pay. First job is waiting."',
  'Mara Voss: "That gold coupe? Its owner owes me. Bring it home."',
  'Mara Voss: "Cops are all over you — vanish, then we talk."',
  'Mara Voss: "Four checkpoints, one timer. Show me speed, Nico."',
  'Mara Voss: "Rush hour, Nico — three drops, one clock. Move!"',
  'Mara Voss: "An informant is running to my freight terminal in the docklands. Tail him — unseen."',
  'Mara Voss: "Dockside deal: goods at the harbor, buyer downtown. Quiet hands."',
  'Mara Voss: "The buyer talked! Roadblocks everywhere — punch through to the garage!"',
  'Mara Voss: "Cargo overboard in the harbor. Take my boat, fish it out, dock east."',
  'Mara Voss: "Last job. Harbor package, heavy heat. Do not fail me."',
  'Mara Voss: "You own this harbor now, Nico. Stay golden."',
];
// Mission 4 checkpoint run, in order.
export const HARBOR_CHECKPOINTS = [
  { x: 2720, y: 220 }, { x: 2720, y: 1570 }, { x: 720, y: 1950 }, { x: 290, y: 220 },
];
// Mission 5 timed drop-offs, in order, and its generous clock.
export const RUSH_DROPS = [
  { x: 2720, y: 670 }, { x: 720, y: 1570 }, { x: 2220, y: 220 },
];
export const RUSH_TIME = 150;
// Mission 7 delivery point: Mara's buyer waits by the central-north crossing.
export const BUYER = { x: 1220, y: 670 };
// Mission 6 tailing: the informant drives the south avenues from the beach
// quarter (PALM COURT side) east into the docklands, ending by the freight
// terminal. Waypoints sit on road centres so the target never leaves a road.
export const TAIL_ROUTE = [
  { x: 720, y: 1570 }, { x: 1220, y: 1570 }, { x: 2220, y: 1570 }, { x: 2220, y: 1950 },
];
export const TAIL_SPEED = 104;
export const TAIL_MIN = 88; // closer than this for too long spooks the target
export const TAIL_MAX = 330; // farther than this for too long loses the target
// Mission 8 roadblocks: barricades on the obvious routes between the buyer
// (downtown) and the garage (north-west), plus one decoy block east.
export const ROADBLOCKS = [
  { x: 720, y: 670, angle: Math.PI / 2 },
  { x: 1220, y: 220, angle: Math.PI / 2 },
  { x: 720, y: 1120, angle: 0 },
  { x: 1720, y: 670, angle: Math.PI / 2 },
];
// Mission 9 boat cargo: floating crates on the harbor water, west to east,
// and the east pier the player must dock at to finish.
export const CARGO = [
  { x: 950, y: 2210 }, { x: 1520, y: 2250 }, { x: 2080, y: 2200 },
];
export const PIER = { x: 2420, y: 2130 };
