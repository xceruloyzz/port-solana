// Deterministic screenshot scenes for ?shot=title|city|drive|chase&seed=1.
// Each stages the real game state (plus a little guaranteed company around the
// camera), then main.js freezes and flags __shotReady.
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
  } else if (name === 'chase') {
    // Wanted 4 on the waterfront road by the harbor: palms, cranes and boats
    // in frame, three police cars closing in, Final Job HUD.
    const car = W.cars.find((c) => c.traffic) || W.cars[0];
    car.x = 1500; car.y = 1942; car.angle = 0; car.speed = 170; car.traffic = false; car.parked = false;
    S.player.car = car; S.player.x = car.x; S.player.y = car.y;
    S.wanted = 4; S.money = 2600; S.armed = true; S.ammo = 18;
    S.missionIdx = 6; S.stage = 0; S.refreshMission();
    S.spawnPolice(3, true);
    crowd(1620, 1900);
  } else {
    S.player.x = 1180; S.player.y = 1030;
  }
}
