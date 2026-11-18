// Deterministic screenshot scenes for ?shot=title|city|drive|chase&seed=1.
// Each stages the real game state, then main.js freezes and flags __shotReady.
export function stageShot(name, S) {
  const W = S.world;
  if (name === 'title') {
    S.screen = 'title';
    S.player.x = 1220; S.player.y = 1060;
    return;
  }
  S.screen = 'play';
  if (name === 'city') {
    S.player.x = 1185; S.player.y = 1090; S.player.angle = 0.6;
    S.missionIdx = 0; S.refreshMission();
  } else if (name === 'drive') {
    const car = W.cars.find((c) => c.traffic) || W.cars[0];
    car.x = 1220; car.y = 1085; car.angle = 0; car.speed = 150; car.traffic = false; car.parked = false;
    S.player.car = car; S.player.x = car.x; S.player.y = car.y;
    S.missionIdx = 1; S.refreshMission();
    S.money = 250;
  } else if (name === 'chase') {
    const car = W.cars.find((c) => c.traffic) || W.cars[0];
    car.x = 1220; car.y = 1085; car.angle = 0; car.speed = 170; car.traffic = false; car.parked = false;
    S.player.car = car; S.player.x = car.x; S.player.y = car.y;
    S.wanted = 4; S.money = 750; S.armed = true; S.ammo = 18;
    S.missionIdx = 4; S.refreshMission();
    S.spawnPolice(3, true);
  } else {
    S.player.x = 1180; S.player.y = 1030;
  }
}
