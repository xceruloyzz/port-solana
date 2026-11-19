// Story data for Port Solana: the 7-mission chain for fixer Mara Voss, her
// dialogue lines, and the checkpoint / drop-off / buyer layouts the flow uses.
export const MISSIONS = [
  { title: 'MISSION 1 — MEET MARA', obj: 'Go to the GARAGE and meet fixer Mara Voss.', pay: 100 },
  { title: 'MISSION 2 — GOLD COUPE', obj: 'Steal the marked gold coupe (★) and deliver it to the GARAGE.', pay: 400 },
  { title: 'MISSION 3 — LOSE THE HEAT', obj: 'Escape! Lose your wanted level completely.', pay: 300 },
  { title: 'MISSION 4 — HARBOR RUN', obj: 'Hit every checkpoint before the timer runs out!', pay: 500 },
  { title: 'MISSION 5 — RUSH HOUR', obj: 'Make all 3 drop-offs across the city before the timer runs out!', pay: 600 },
  { title: 'MISSION 6 — DOCKSIDE DEAL', obj: 'Pick up the goods at the HARBOR, then deliver them to the BUYER downtown.', pay: 700 },
  { title: 'MISSION 7 — THE FINAL JOB', obj: 'Pick up the package at the HARBOR, then deliver it to the GARAGE.', pay: 1000 },
];
export const DIALOGUE = [
  'Mara Voss: "Nico. You drive, I pay. First job is waiting."',
  'Mara Voss: "That gold coupe? Its owner owes me. Bring it home."',
  'Mara Voss: "Cops are all over you — vanish, then we talk."',
  'Mara Voss: "Four checkpoints, one timer. Show me speed, Nico."',
  'Mara Voss: "Rush hour, Nico — three drops, one clock. Move!"',
  'Mara Voss: "Dockside deal: goods at the harbor, buyer downtown. Quiet hands."',
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
// Mission 6 delivery point: Mara's buyer waits by the central-north crossing.
export const BUYER = { x: 1220, y: 670 };
