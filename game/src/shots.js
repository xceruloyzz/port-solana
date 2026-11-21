// Deterministic screenshot scenes for ?shot=<scene>&seed=1.
// Each stages the real game state (plus a little guaranteed company around the
// camera), then main.js freezes and flags __shotReady. v3 scenes: downtown
// (day, on the motorbike by the SOLANA SPIRE), nightrain (a rainy night tail
// downtown), boat (harbor cargo run in the docklands), chase (the Final Job
// waterfront pursuit). The older city/drive scenes stay for the test harness.
export function stageShot(name, S) {
  const W = S.world;
  // Park a few extra peds and cars around a point so the frame is always busy.
  function crowd(x, y) {
    const spots = [[-70, -46], [52, -88], [96, 30], [-104, 44], [30, 96], [-38, 118]];
    W.peds.slice(0, spots.length).forEach((ped, i) => { ped.x = x + spots[i][0]; ped.y = y + spots[i][1]; ped.hp = 30; ped.boarded = false; });
  }
  function trafficNear(x, y) {
    const movers = W.cars.filter((c) => c.traffic);
    if (movers[0]) { movers[0].x = x + 190; movers[0].y = y - 22; movers[0].angle = 0; }
    if (movers[1]) { movers[1].x = x - 260; movers[1].y = y + 24; movers[1].angle = Math.PI; }
    if (movers[2]) { movers[2].x = x + 24; movers[2].y = y - 260; movers[2].angle = Math.PI / 2; }
  }
  if (name === 'title') {
    S.screen = 'title';
    S.player.x = 1220; S.player.y = 1030;
    crowd(1220, 1090); trafficNear(1220, 1090);
    return;
  }
  S.screen = 'play';
  if (name === 'city') {
    // On foot at the busy central crossing: palms, billboards, traffic, peds,
    // a neon chip down the avenue, and the Mission 1 HUD.
    S.player.x = 1185; S.player.y = 1090; S.player.angle = 0.6;
    S.missionIdx = 0; S.refreshMission();
    crowd(1220, 1100); trafficNear(1220, 1100);
  } else if (name === 'drive') {
    // Driving in traffic on the central avenue, Mission 2 target live.
    const car = W.cars.find((c) => c.traffic) || W.cars[0];
    car.x = 1220; car.y = 1085; car.angle = 0; car.speed = 150; car.traffic = false; car.parked = false;
    S.player.car = car; S.player.x = car.x; S.player.y = car.y;
    S.missionIdx = 1; S.refreshMission();
    S.money = 250;
    trafficNear(1220, 1100); crowd(1300, 1180);
  } else if (name === 'downtown') {
    // DAY over neon downtown: riding the cyan motorbike east along the
    // central avenue, SOLANA SPIRE towers in frame, Mission 6 tail live with
    // the informant's sedan up ahead in the pocket.
    S.time = 240; // DAY phase, dry weather block for seed 1
    const bike = W.bikes[1] || W.bikes[0];
    bike.x = 1560; bike.y = 1148; bike.angle = 0; bike.speed = 210; bike.parked = false;
    S.player.car = bike; S.player.x = bike.x; S.player.y = bike.y; S.player.angle = 0;
    S.money = 2450; S.chipsCollected = 5;
    S.missionIdx = 5; S.refreshMission();
    S.tail = { x: 1760, y: 1120, angle: 0, wpIdx: 2, spook: 0, lost: 0, arrived: false, engaged: true };
    S.target = { x: S.tail.x, y: S.tail.y };
    S.objective = 'TAIL: follow the violet sedan to the freight terminal — 50 m away (in the pocket).';
    trafficNear(1620, 1120); crowd(1500, 1030);
  } else if (name === 'nightrain') {
    // Rainy NIGHT downtown: the roadblock getaway in full swing — barricades
    // on the avenue, wanted 4, streetlight glow through the rain.
    S.time = 350; // dusk-into-night with a full rain block for seed 1
    const car = W.cars.find((c) => c.traffic) || W.cars[0];
    car.x = 1330; car.y = 690; car.angle = Math.PI; car.speed = 190; car.traffic = false; car.parked = false;
    S.player.car = car; S.player.x = car.x; S.player.y = car.y;
    S.wanted = 4; S.money = 3950; S.chipsCollected = 7;
    S.missionIdx = 7;
    S.roadblocks = [
      { x: 1220, y: 220, angle: Math.PI / 2, hp: 120 },
      { x: 720, y: 1120, angle: 0, hp: 120 },
      { x: 1100, y: 670, angle: Math.PI / 2, hp: 120 },
    ];
    S.refreshMission();
    S.objective = 'ROADBLOCK GETAWAY: 3 roadblocks up — reach the GARAGE!';
    S.target = { ...W.garage };
    S.spawnPolice(2, true);
    trafficNear(1220, 700); crowd(1420, 760);
  } else if (name === 'boat') {
    // GOLDEN HOUR on the water: piloting Mara's boat between floating cargo
    // crates in the docklands harbor, cranes and containers behind.
    const boat = W.boat;
    boat.x = 1780; boat.y = 2190; boat.angle = 0.5; boat.speed = 120; boat.parked = false;
    S.player.car = boat; S.player.x = boat.x; S.player.y = boat.y; S.player.angle = 0.5;
    S.money = 4750; S.chipsCollected = 9;
    S.missionIdx = 8; S.stage = 1;
    S.cargo = [
      { x: 950, y: 2210, taken: true }, { x: 1950, y: 2245, taken: false }, { x: 2080, y: 2200, taken: false },
    ];
    S.cargoIdx = 1;
    S.refreshMission();
    S.objective = 'HARBOR CARGO: recover floating crate 2/3 on the water.';
    S.target = { x: 1950, y: 2245 };
    crowd(1900, 2030);
  } else if (name === 'chase') {
    // Wanted 4 on the waterfront road by the harbor: palms, cranes and boats
    // in frame, three police cars closing in, Final Job HUD.
    const car = W.cars.find((c) => c.traffic) || W.cars[0];
    car.x = 1500; car.y = 1942; car.angle = 0; car.speed = 170; car.traffic = false; car.parked = false;
    S.player.car = car; S.player.x = car.x; S.player.y = car.y;
    S.wanted = 4; S.money = 4850; S.armed = true; S.ammo = 18;
    S.missionIdx = 9; S.stage = 0; S.refreshMission();
    S.spawnPolice(3, true);
    crowd(1620, 1900);
  } else {
    S.player.x = 1180; S.player.y = 1030;
  }
}
