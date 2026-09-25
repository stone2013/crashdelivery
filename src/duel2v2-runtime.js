/* V0.8.0 2v2 runtime adapter. Kept separate so the V0.7 co-op path is untouched. */
(() => {
  'use strict';
  if (!window.DeliveryDuel2v2) return;
  const Duel = window.DeliveryDuel2v2;
  const MODE_KEY = 'crashdelivery.roomMode.v080';
  const originalRoomId = roomId;
  const originalHostRoom = hostRoom;
  const originalJoinRoom = joinRoom;
  const originalCopyRoom = copyRoom;
  const originalBeginConnection = beginConnection;
  const originalStep = step;
  const originalNetSnapshot = netSnapshot;
  const originalApplyHostSnapshot = applyHostSnapshot;
  const originalOnNetData = onNetData;
  const originalNetTick = netTick;
  const originalTickGuest = tickGuest;
  const originalStepCar = stepCar;
  const originalDraw3D = draw3D;
  const originalFrame = frame;
  const originalOtherAvatars = otherAvatars;
  const originalStopNetwork = stopNetwork;
  let localEventSeq = 0, hostDriverSeq = 0, duelLastStep = performance.now();
  let duelCanvas = null, duelHud = null, duelButtons = null, duelToast = null, duelResult = null, duelFlash = null, pred = null;
  let rememberedCoopSize = selectedMaxPlayers();

  function currentMode() {
    try { return localStorage.getItem(MODE_KEY) === 'duel2v2' ? 'duel2v2' : 'coop'; }
    catch { return 'coop'; }
  }
  net.duelMode = currentMode();
  net.duelMatch = null;
  net.duelSnapshot = null;
  net.duelSeq = 0;
  net.duelActionSeq = 0;
  net.duelError = '';

  const style = document.createElement('style');
  style.textContent = `
    .duelModePicker{display:flex;gap:8px;margin:0 0 12px}
    .duelModePicker button{flex:1;border:1px solid #ffffff22;background:#ffffff0a;border-radius:9px;padding:11px 8px;min-height:46px;font-size:12px}
    .duelModePicker button.active{background:#ffd05b;color:#16343a;border-color:#ffe6a6;font-weight:800}
    #duelHud{position:absolute;z-index:5;top:calc(10px + var(--safeT));left:50%;transform:translateX(-50%);display:none;width:min(620px,calc(100% - 170px));grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:7px;padding:9px 10px 7px;border:1px solid #ffffff37;border-radius:16px;background:linear-gradient(135deg,#102a32f5,#173943f0 52%,#102a32f5);box-shadow:0 8px 26px #071a20a8,inset 0 1px #ffffff12;backdrop-filter:blur(12px);pointer-events:auto;white-space:nowrap;font-size:11px}
    #duelHud[data-active=true]{display:grid}#duelHud .duelScore{min-width:0;display:flex;align-items:center;gap:8px;padding:5px 9px;border:1px solid #ffffff14;border-radius:11px;background:#ffffff08}
    #duelHud .duelScore.amber{grid-column:1;color:#ffcf58;border-color:#ffc94c36;background:linear-gradient(100deg,#ffbe3d19,#ffffff06)}#duelHud .duelScore.teal{grid-column:3;flex-direction:row-reverse;text-align:right;color:#80d8e1;border-color:#70d2dd36;background:linear-gradient(260deg,#58c7d41b,#ffffff06)}
    #duelHud .duelScore .duelTeamDot{font-size:17px;filter:drop-shadow(0 0 5px currentColor)}#duelHud .duelScoreCopy{display:grid;gap:2px;min-width:0}#duelHud .duelScoreCopy b{font-size:10px;letter-spacing:.06em}#duelHud .duelScoreCopy small{font-size:9px;color:#d1ded4a8}
    #duelHud .duelScore>strong{font-size:23px;line-height:1;font-variant-numeric:tabular-nums;color:#fff5d9;text-shadow:0 2px 8px #0008;margin-left:auto}#duelHud .teal>strong{margin-left:0;margin-right:auto}
    #duelHud .duelClockWrap{grid-column:2;display:grid;justify-items:center;gap:2px;min-width:70px;padding:0 5px}#duelHud .duelClockWrap small{font-size:7px;letter-spacing:.18em;color:#91b2b5;font-weight:800}#duelHud .duelTime{font:800 17px/1 ui-monospace,monospace;font-variant-numeric:tabular-nums;color:#fff4d7}
    #duelHud .duelBottom{grid-column:1/-1;display:flex;justify-content:space-between;align-items:center;gap:8px;padding-top:6px;border-top:1px solid #ffffff12}#duelHud .duelStatus{min-width:0;display:flex;align-items:center;gap:6px;color:#c5d5d0;font-size:9px}#duelHud .duelStatus i{width:7px;height:7px;flex:none;border-radius:50%;background:#75c79c;box-shadow:0 0 8px #75c79c99}#duelHud .duelDamage{overflow:hidden;text-overflow:ellipsis;color:#c5d5d0;font-size:9px}
    #duelHud button{min-width:68px;min-height:36px;display:flex;align-items:center;justify-content:center;gap:5px;padding:4px 8px;border-radius:9px;background:linear-gradient(180deg,#31545b,#23444c);border:1px solid #ffffff2b;color:#f8efd2;font-size:13px;box-shadow:inset 0 1px #ffffff0c;transition:transform .12s,border-color .12s,background .12s}
    #duelHud button:not(:disabled):hover{transform:translateY(-1px);border-color:#ffd05b99;background:linear-gradient(180deg,#426b70,#294f56)}#duelHud button:not(:disabled):active{transform:translateY(1px) scale(.98)}#duelHud button small{font-size:9px;font-weight:700}
    #duelHud[data-danger=burning] .duelStatus i,#duelHud[data-danger=disabled] .duelStatus i{background:#ff6758;box-shadow:0 0 10px #ff5149;animation:duelPulse .8s ease-in-out infinite alternate}#duelHud[data-danger=warning] .duelStatus i{background:#ffbf54;box-shadow:0 0 8px #ffbf54}
    #duelWait:empty{display:none}#duelWait:not(:empty){grid-column:1/-1;text-align:center;padding:2px 4px;color:#d9e6dc;font-size:10px;font-weight:700;letter-spacing:.04em}
    #duelHud[data-urgent=true] .duelTime{color:#ff8c70;animation:duelPulse .65s ease-in-out infinite alternate}
    @keyframes duelPulse{to{opacity:.62;filter:brightness(1.45)}}
    #duelImpactFlash{position:absolute;z-index:4;inset:0;pointer-events:none;opacity:0;background:radial-gradient(ellipse at center,#ffb24a00 22%,#ff3e2f00 60%)}#duelImpactFlash.hit{animation:duelHitFlash .42s ease-out}@keyframes duelHitFlash{0%{opacity:0;background:radial-gradient(ellipse at center,#ffb24a00 18%,#ff3e2f00 65%)}20%{opacity:1;background:radial-gradient(ellipse at center,#ffb24a32 18%,#ff3e2f85 100%)}100%{opacity:0;background:radial-gradient(ellipse at center,#ffb24a00 18%,#ff3e2f00 65%)}}
    #game[data-duel=true] #ordersBtn,#game[data-duel=true] #manifest,#game[data-duel=true] #routeGuide,#game[data-duel=true] #assistAimBtn,#game[data-duel=true] #interactBtn,#game[data-duel=true] #dropBtn,#game[data-duel=true] #throwBtn,#game[data-duel=true] #powerTrack,#game[data-duel=true] #rearControls,#game[data-duel=true] #boardBtn,#game[data-duel=true] #brickBtn,#game[data-duel=true] #serviceBtn,#game[data-duel=true] #restartBtn{display:none!important}
    #game[data-duel=true] .statuschips,#game[data-duel=true] #clock,#game[data-duel=true] .statusbar .money{display:none!important}
    #duelHud button:disabled{opacity:.38;filter:saturate(.5)}#duelHud .duelTools{display:flex;gap:5px}
    #duelHud[data-live=false] .duelBottom{display:none}
    #duelToast{position:absolute;z-index:6;top:70px;left:50%;transform:translateX(-50%);padding:7px 12px;border-radius:8px;background:#843f31ef;color:#fff4d7;font-size:11px;display:none;pointer-events:none}
    #duelToast.show{display:block}
    #duelResult{position:absolute;z-index:20;inset:0;display:none;align-items:center;justify-content:center;padding:20px;background:#0c2229c9;backdrop-filter:blur(5px);pointer-events:auto}
    #duelResult[data-active=true]{display:flex}#duelResult>section{width:min(410px,100%);padding:28px;border-radius:18px;background:#1a3940;border:1px solid #ffffff2a;text-align:center}
    #duelResult h2{margin:0 0 12px;color:#ffd05b;font-size:30px}#duelResult p{font-size:13px;line-height:1.7;color:#d4e2dd}#duelResult button{width:100%;margin-top:15px;border-radius:10px;padding:14px;background:#ffd05b;color:#16343a;font-weight:800;min-height:48px}
    @media(pointer:coarse),(max-width:760px){#duelHud{top:calc(57px + var(--safeT));width:calc(100% - 18px);gap:5px;padding:6px 7px;border-radius:13px;font-size:10px}#duelHud .duelScore{gap:5px;padding:5px 6px}#duelHud .duelScore>strong{font-size:20px}#duelHud .duelClockWrap{min-width:62px}#duelHud .duelTime{font-size:15px}#duelHud button{min-width:58px;min-height:40px}#duelHud .duelTools{gap:4px}}
    @media(max-width:420px){#duelHud{grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);gap:3px;padding:5px}#duelHud .duelScoreCopy b{font-size:9px}#duelHud .duelScoreCopy small{font-size:8px}#duelHud .duelScore>strong{font-size:18px}#duelHud .duelTeamDot{font-size:14px!important}#duelHud .duelClockWrap{min-width:56px;padding:0 2px}#duelHud .duelClockWrap small{font-size:6px}#duelHud .duelTime{font-size:13px}#duelHud .duelBottom{gap:4px}#duelHud .duelTools{gap:3px}#duelHud button{min-width:43px;min-height:39px;padding:3px 5px}#duelHud button small{font-size:8px}#duelHud .duelStatus{max-width:95px}#duelHud .duelDamage{max-width:78px}}
  `;
  document.head.appendChild(style);
  const duelGearBuilder = new MeshBuilder();
  duelGearBuilder.box(.42, .10, .34, '#536c70', [0, .91, 2.72]);
  duelGearBuilder.cylinder(.065, .48, 8, '#dbb34f', [0, 1.18, 2.72], [.30, 0, 0]);
  duelGearBuilder.box(.24, .12, .13, '#ffdc71', [0, 1.43, 2.69]);
  duelGearBuilder.cylinder(.18, .58, 10, '#bf5147', [1.16, 1.24, 2.20]);
  duelGearBuilder.cylinder(.09, .10, 8, '#d6bc75', [1.16, 1.58, 2.20]);
  duelGearBuilder.box(.10, .60, .10, '#879a91', [-1.12, 1.16, 2.18]);
  duelGearBuilder.box(.28, .11, .12, '#879a91', [-1.12, 1.47, 2.18]);
  duelGearBuilder.box(.28, .11, .12, '#879a91', [-1.12, .85, 2.18]);
  const duelGearMesh = renderer.mesh(duelGearBuilder);
  function buildTeamMarker(color) {
    const builder = new MeshBuilder();
    builder.cylinder(.045, .55, 8, '#e7e1cb', [0, -.22, 0]);
    builder.box(.76, .38, .10, color, [.15, .22, 0]);
    builder.box(.56, .045, .115, '#fff4d2', [.15, .22, .06]);
    builder.box(.12, .12, .12, color, [-.09, .22, 0]);
    return renderer.mesh(builder);
  }
  const duelTeamMarkers = { amber: buildTeamMarker('#f3aa37'), teal: buildTeamMarker('#45bbc9') };
  function buildDuelAmmo(color) {
    const builder = new MeshBuilder();
    builder.box(.52, .38, .52, '#f2e7c9');
    builder.box(.54, .075, .54, color, [0, .02, 0]);
    builder.box(.085, .40, .55, color);
    builder.box(.54, .40, .085, '#f7f0d9');
    return renderer.mesh(builder);
  }
  const duelAmmoMeshes = { amber: buildDuelAmmo('#eda834'), teal: buildDuelAmmo('#42b7c6') };

  const createCard = document.querySelector('.mpCard.mpCreate');
  if (createCard) {
    const title = createCard.querySelector('.capacityLabel');
    const picker = document.createElement('div');
    picker.className = 'duelModePicker';
    picker.setAttribute('role', 'group');
    picker.setAttribute('aria-label', '选择多人游戏模式');
    picker.innerHTML = '<button type="button" data-game-mode="coop">🚚 车队合作</button><button type="button" data-game-mode="duel2v2">🏁 2v2 对抗</button>';
    createCard.insertBefore(picker, title);
  }
  const helpRows = document.querySelector('#helpScreen .helpRows');
  if (helpRows) {
    const duelHelp = document.createElement('div');
    duelHelp.innerHTML = '<b>V0.8.0 / 2v2 快递对抗</b><p>四人分两队：1、2 号橙队，3、4 号蓝队；1、3 号驾驶，2、4 号在车厢拉炮和维修。五分钟内比送达数，平局加时 60 秒。拉杆消耗一件普通快递；三次命中后车辆起火瘫痪。副手先用灭火器，再用扳手；燃烧累计 30 秒爆炸判负。</p>';
    helpRows.prepend(duelHelp);
  }

  function ensureHud() {
    if (duelHud) return;
    duelHud = document.createElement('div'); duelHud.id = 'duelHud';
    duelHud.innerHTML = '<span id="duelWait" class="duelWait"></span><div class="duelScore amber"><span class="duelTeamDot">●</span><span class="duelScoreCopy"><b>橙队</b><small id="duelAmberTarget">目标 #1</small></span><strong id="duelAmberScore">0</strong></div><div class="duelClockWrap"><small id="duelPhase">5 MIN RACE</small><b class="duelTime" id="duelClock">05:00</b></div><div class="duelScore teal"><span class="duelTeamDot">●</span><span class="duelScoreCopy"><b>蓝队</b><small id="duelTealTarget">目标 #10</small></span><strong id="duelTealScore">0</strong></div><div class="duelBottom"><span class="duelStatus"><i></i><b class="duelDamage" id="duelDamage">车辆状态正常</b></span><span class="duelTools"><button type="button" data-duel-action="fire" aria-label="拉下快递大炮拉杆" title="拉杆：发射普通快递"><span>🕹️</span><small>发射</small></button><button type="button" data-duel-action="extinguisher" aria-label="使用灭火器" title="灭火器"><span>🧯</span><small>灭火</small></button><button type="button" data-duel-action="wrench" aria-label="使用扳手维修" title="扳手维修"><span>🔧</span><small>修车</small></button></span></div>';
    duelToast = document.createElement('div'); duelToast.id = 'duelToast'; duelToast.setAttribute('role', 'status');
    const hud = $('hud'); hud.append(duelHud, duelToast);
    duelFlash = document.createElement('div'); duelFlash.id = 'duelImpactFlash'; $('game').append(duelFlash);
    duelResult = document.createElement('div'); duelResult.id = 'duelResult';
    duelResult.innerHTML = '<section><div class="eyebrow">2V2 DELIVERY DUEL</div><h2>比赛结束</h2><p></p><button type="button">返回多人大厅</button></section>';
    $('game').append(duelResult);
    duelResult.querySelector('button').addEventListener('click', () => { stopNetwork(true); openMultiplayerMenu(); });
    duelButtons = [...duelHud.querySelectorAll('[data-duel-action]')];
    for (const button of duelButtons) button.addEventListener('click', () => requestDuelAction(button.dataset.duelAction));
  }

  function selectMode(mode) {
    mode = mode === 'duel2v2' ? 'duel2v2' : 'coop';
    const previous = net.duelMode;
    try { localStorage.setItem(MODE_KEY, mode); } catch {}
    net.duelMode = mode;
    document.querySelectorAll('[data-game-mode]').forEach((button) => button.classList.toggle('active', button.dataset.gameMode === mode));
    const options = [...document.querySelectorAll('[data-room-size]')];
    if (mode === 'duel2v2') {
      if (previous !== 'duel2v2') rememberedCoopSize = selectedMaxPlayers();
      setMaxPlayers(4);
      options.forEach((button) => { button.disabled = button.dataset.roomSize !== '4'; button.classList.toggle('active', button.dataset.roomSize === '4'); });
      const sizeLabel = createCard?.querySelector('.capacityLabel');
      if (sizeLabel) sizeLabel.innerHTML = '对抗赛人数 <span>固定 2 队 × 2 人</span>';
    } else {
      options.forEach((button) => button.disabled = false);
      const sizeLabel = createCard?.querySelector('.capacityLabel');
      if (sizeLabel) sizeLabel.innerHTML = '人数上限 <span>包含房主</span>';
      if (previous === 'duel2v2') setMaxPlayers(rememberedCoopSize);
    }
  }
  window.setCrashDeliveryRoomMode = selectMode;
  otherAvatars = function () {
    const actors = originalOtherAvatars();
    return net.duelMode === 'duel2v2' && networked() ? actors.filter((actor) => Duel.teamForPlayer(actor.id) === localTeam()) : actors;
  };
  const originalRenderPlayersPanel = renderPlayersPanel;
  renderPlayersPanel = function () {
    originalRenderPlayersPanel();
    if (net.duelMode !== 'duel2v2') return;
    const rows = $('playersList')?.children || [];
    for (let id = 0; id < rows.length; id++) {
      const row = rows[id], name = row.querySelector('.playerName'), role = row.querySelector('.playerRole');
      const team = id < 2 ? '橙队' : '蓝队';
      if (name && name.dataset.duelTeam !== team) { name.textContent = (id < 2 ? '🟠 ' : '🔵 ') + name.textContent; name.dataset.duelTeam = team; }
      if (role) role.textContent = ((id % 2 === 0) ? team + '司机 · ' : team + '副手 · ') + role.textContent.replace(/^(橙队|蓝队)(司机|副手) · /, '');
    }
  };
  stopNetwork = function (toMenu = true) {
    net.duelMatch = null; net.duelSnapshot = null; net.duelEndNotified = false; net.duelHudHits = {}; pred = null;
    duelFlash?.classList.remove('hit');
    return originalStopNetwork(toMenu);
  };
  const inDuel = () => net.duelMode === 'duel2v2' && networked();
  const blockedAction = (original) => function (...args) {
    if (inDuel()) { showHint('2v2 对抗赛岗位固定：司机驾驶，副手操作炮台与维修。', 2.5); return; }
    return original(...args);
  };
  setView = blockedAction(setView); mobility = blockedAction(mobility); interact = blockedAction(interact);
  throwPackage = blockedAction(throwPackage); dropPackage = blockedAction(dropPackage);
  toggleDoor = blockedAction(toggleDoor); toggleBothDoors = blockedAction(toggleBothDoors);
  lockTarget = blockedAction(lockTarget); startCharge = blockedAction(startCharge); finishCharge = blockedAction(finishCharge);
  selectOrder = blockedAction(selectOrder); service = blockedAction(service);
  document.querySelectorAll('[data-game-mode]').forEach((button) => button.addEventListener('click', () => selectMode(button.dataset.gameMode)));
  selectMode(currentMode());
  if (new URLSearchParams(location.search).get('mode') === 'duel2v2') selectMode('duel2v2');

  roomId = (code) => net.duelMode === 'duel2v2' ? 'crash-delivery-duel2v2-' + code : originalRoomId(code);
  copyRoom = async function () {
    if (net.duelMode !== 'duel2v2' || !net.room) return originalCopyRoom();
    const url = new URL(location.href); url.search = ''; url.hash = '';
    url.searchParams.set('room', net.room); url.searchParams.set('mode', 'duel2v2');
    try { await navigator.clipboard.writeText(url.href); netText('2v2 邀请链接已复制 · 房间码 ' + net.room); }
    catch { netText('2v2 房间码 ' + net.room + ' · 请将房间码和“2v2 对抗”发给好友。'); }
  };
  hostRoom = async function () {
    if (net.duelMode === 'duel2v2') net.maxPlayers = 4;
    else net.maxPlayers = selectedMaxPlayers();
    net.duelMatch = null; net.duelSnapshot = null; net.duelError = '';
    return originalHostRoom();
  };
  joinRoom = async function () {
    net.duelMatch = null; net.duelSnapshot = null; net.duelError = '';
    return originalJoinRoom();
  };

  function ensureMatch() {
    if (net.mode !== 'host' || net.duelMode !== 'duel2v2' || net.duelMatch) return;
    if (connectedPlayers().length < 3) { net.duelWaitingPlayers = connectedPlayers().length + 1; return; }
    net.maxPlayers = 4;
    net.duelMatch = Duel.createMatch({ timeLimit: 300, cargoPerTeam: 18 });
    for (const record of connectedPlayers()) record.state.view = record.id % 2 === 0 ? 'drive' : 'cargo';
    net.duelActionSeq = 0; net.duelSeq = 0;
    net.duelEndNotified = false;
    if (duelResult) duelResult.dataset.active = 'false';
    for (const team of ['amber', 'teal']) {
      const truck = net.duelMatch.trucks[team], road = closestCityRoad(truck.vehicle.p);
      truck.vehicle.p = roadPoint(road.edge.a, road.edge.b, road.t);
      const dir = edgeDirection(road.edge.a, road.edge.b);
      truck.vehicle.yaw = Math.atan2(-dir[0], -dir[2]);
    }
    state.mode = 'playing'; state.view = 'drive'; player.id = 0; player.name = nickname;
    car.p = net.duelMatch.trucks.amber.vehicle.p.slice(); car.yaw = 0; car.speed = 0; car.velocity = [0, 0, 0];
    showHint('2v2 派送对抗开始！橙队 1/2 号，蓝队 3/4 号；副手负责炮台与维修。', 7);
    updateNetHUD();
  }

  beginConnection = function () {
    const result = originalBeginConnection();
    if (net.duelMode === 'duel2v2') {
      net.maxPlayers = 4;
      state.view = net.mode === 'host' || net.playerId === 2 ? 'drive' : 'cargo';
      if (net.mode === 'guest') { player.p = [0, 2.38, -.9]; player.repair = null; }
      ensureHud(); syncButtons(); updateNetHUD();
    }
    return result;
  };

  function controlsFrom(input) {
    const keys = new Set(input?.keys || []);
    const x = Number(input?.stickX) || 0, y = Number(input?.stickY) || 0;
    const left = keys.has('KeyA') || keys.has('ArrowLeft') || inputs.left?.size || inputs.walkLeft?.size;
    const right = keys.has('KeyD') || keys.has('ArrowRight') || inputs.right?.size || inputs.walkRight?.size;
    const gas = keys.has('KeyW') || keys.has('ArrowUp') || inputs.gas?.size || inputs.forward?.size;
    const brake = keys.has('KeyS') || keys.has('ArrowDown') || inputs.brake?.size || inputs.back?.size;
    const steer = clamp((left ? -1 : 0) + (right ? 1 : 0) + x, -1, 1);
    const throttle = clamp((gas ? 1 : 0) - (brake ? 1 : 0) - y, -1, 1);
    return { throttle, steer, brake: !!brake };
  }

  function deliverAtTargets() {
    const targets = deliverable;
    for (const team of ['amber', 'teal']) {
      const truck = net.duelMatch.trucks[team], house = targets[truck.targetIndex % targets.length];
      if (!house || !truck.cargo.length || truck.exploded) continue;
      const road = closestCityRoad([house.x, 0, house.z]);
      if (Math.hypot(truck.vehicle.p[0] - road.q[0], truck.vehicle.p[2] - road.q[2]) < 8) {
        const box = truck.cargo[0];
        Duel.deliver(net.duelMatch, team, box, 'delivery-' + team + '-' + truck.delivered + '-' + Math.floor(net.duelMatch.elapsed * 10));
      }
    }
  }

  function advanceProjectiles(dt) {
    const match = net.duelMatch;
    for (const projectile of match.projectiles) {
      if (!projectile.active || !projectile.p || !projectile.v) continue;
      projectile.age += dt;
      projectile.p[0] += projectile.v[0] * dt;
      projectile.p[1] += projectile.v[1] * dt;
      projectile.p[2] += projectile.v[2] * dt;
      projectile.v[1] -= 9.8 * dt;
      const targetTeam = projectile.team === 'amber' ? 'teal' : 'amber';
      const target = match.trucks[targetTeam];
      const d = Math.hypot(projectile.p[0] - target.vehicle.p[0], projectile.p[2] - target.vehicle.p[2]);
      if (d < 3.1 && projectile.p[1] < 4.5 && projectile.p[1] > 0) {
        Duel.hitTruck(match, projectile.id, 'impact-' + projectile.id);
        projectile.active = false;
      } else if (projectile.age > 4.5 || projectile.p[1] < 0) projectile.active = false;
    }
  }

  function publishHostActions(message, peer) {
    if (!net.duelMatch || !peer || ![1, 3].includes(Number(peer.id))
        || !Number.isSafeInteger(message.seq) || message.seq <= (peer.duelLastAction || 0)) return true;
    peer.duelLastAction = message.seq;
    const id = 'player-' + peer.id + '-' + message.seq;
    if (message.action === 'fire') {
      const shot = Duel.fireCannon(net.duelMatch, peer.id, id);
      if (shot) {
        const source = net.duelMatch.trucks[shot.team], target = net.duelMatch.trucks[shot.team === 'amber' ? 'teal' : 'amber'];
        let dx = target.vehicle.p[0] - source.vehicle.p[0], dz = target.vehicle.p[2] - source.vehicle.p[2];
        let flight = clamp(Math.hypot(dx, dz) / 34, .3, 4.25);
        for (let i = 0; i < 2; i++) {
          const futureX = target.vehicle.p[0] - Math.sin(target.vehicle.yaw) * target.vehicle.speed * flight;
          const futureZ = target.vehicle.p[2] - Math.cos(target.vehicle.yaw) * target.vehicle.speed * flight;
          dx = futureX - (source.vehicle.p[0] - Math.sin(source.vehicle.yaw) * source.vehicle.speed * .12);
          dz = futureZ - (source.vehicle.p[2] - Math.cos(source.vehicle.yaw) * source.vehicle.speed * .12);
          flight = clamp(Math.hypot(dx, dz) / 34, .3, 4.25);
        }
        const len = Math.max(.01, Math.hypot(dx, dz));
        const projectile = net.duelMatch.projectiles.find((item) => item.id === shot.id);
        projectile.p = [source.vehicle.p[0] + dx / len * 4, 1.8, source.vehicle.p[2] + dz / len * 4];
        const horizontalSpeed = len / flight;
        projectile.v = [dx / len * horizontalSpeed, (.5 + 4.9 * flight * flight) / flight, dz / len * horizontalSpeed]; projectile.age = 0;
      }
    } else if (message.action === 'extinguisher' || message.action === 'wrench') {
      Duel.startRepair(net.duelMatch, peer.id, message.action === 'extinguisher' ? 'extinguisher' : 'wrench', id);
    } else if (message.action === 'stop-repair') Duel.stopRepair(net.duelMatch, peer.id, id);
    return true;
  }

  onNetData = function (message, peer) {
    if (net.mode === 'host' && message?.t === 'duel-action') { publishHostActions(message, peer); return; }
    return originalOnNetData(message, peer);
  };

  netSnapshot = function (target = null) {
    const snapshot = originalNetSnapshot(target);
    if (net.duelMode === 'duel2v2' && net.mode === 'host' && net.duelMatch) {
      snapshot.duel = Duel.publicState(net.duelMatch);
      snapshot.actors.forEach((actor, id) => { if (actor) actor.view = id % 2 === 0 ? 'drive' : 'cargo'; });
    }
    return snapshot;
  };
  applyHostSnapshot = function (message) {
    const result = originalApplyHostSnapshot(message);
    if (net.duelMode === 'duel2v2' && message?.duel) {
      const previous = net.duelSnapshot?.trucks?.[localTeam()];
      const next = message.duel.trucks?.[localTeam()];
      net.duelSnapshot = message.duel;
      net.duelReceivedAt = performance.now();
      if (next && (!previous || next.hitCount > previous.hitCount || next.disabled !== previous.disabled
          || next.burning !== previous.burning || next.exploded !== previous.exploded)) net.duelHardCorrect = true;
    }
    return result;
  };

  step = function (dt) {
    if (net.duelMode !== 'duel2v2' || !networked()) return originalStep(dt);
    ensureHud(); ensureMatch();
    if (net.mode !== 'host' || !net.duelMatch || state.mode !== 'playing') return;
    const match = net.duelMatch;
    Duel.drive(match, 0, ++hostDriverSeq, controlsFrom(inputs));
    const rivalDriver = net.players.find((record) => record.id === 2 && record.connected);
    if (rivalDriver && rivalDriver.lastInputSeq > match.trucks.teal.vehicle.inputSeq) {
      Duel.drive(match, 2, rivalDriver.lastInputSeq, controlsFrom(rivalDriver.input));
    }
    Duel.tick(match, dt);
    for (const team of ['amber', 'teal']) {
      const vehicle = match.trucks[team].vehicle, road = closestCityRoad(vehicle.p);
      if (road.d > CITY.halfRoad + 1.5) {
        vehicle.speed *= .90;
        const lane = roadPoint(road.edge.a, road.edge.b, road.t);
        vehicle.p[0] = mix(vehicle.p[0], lane[0], .09); vehicle.p[2] = mix(vehicle.p[2], lane[2], .09);
      }
    }
    advanceProjectiles(dt);
    deliverAtTargets();
    syncLocalTruck();
    if (!match.active && !net.duelEndNotified) { net.duelEndNotified = true; duelFinish(match.winner, match.endReason); }
  };

  function localId() { return net.mode === 'host' ? 0 : Number(net.playerId); }
  function localTeam() { return Duel.teamForPlayer(localId()); }
  const originalNextHouse = nextHouse;
  nextHouse = function () {
    if (inDuel()) {
      const snapshot = net.mode === 'host' && net.duelMatch ? net.duelMatch.trucks[localTeam()] : net.duelSnapshot?.trucks?.[localTeam()];
      if (snapshot) return deliverable[snapshot.targetIndex % deliverable.length] || null;
    }
    return originalNextHouse();
  };
  function localTruckState() {
    if (net.mode === 'host') {
      const truck = net.duelMatch?.trucks[localTeam()];
      return truck ? { ...truck, cargoCount: truck.cargo.length } : null;
    }
    return net.duelSnapshot?.trucks?.[localTeam()] || null;
  }
  function syncVisibleCargo(count) {
    count = Math.max(0, Math.floor(Number(count) || 0));
    while (cargo.length > count) cargo.pop();
    while (cargo.length < count) {
      const i = cargo.length, side = i % 2 ? 1 : -1, row = Math.floor(i / 2);
      cargo.push(makeCargo(0, [side * .96, CAB.floor + .28 + (row >= 12 ? .82 : 0), -1.04 + (row % 12) * .36]));
    }
  }
  function syncLocalTruck() {
    const truck = localTruckState(); if (!truck?.vehicle) return;
    const vehicle = truck.vehicle;
    car.p = vehicle.p.slice(); car.yaw = vehicle.yaw; car.speed = vehicle.speed;
    car.velocity = [-Math.sin(car.yaw) * car.speed, 0, -Math.cos(car.yaw) * car.speed];
    car.hp = truck.hp ?? 100; car.fault = truck.exploded ? 'wreck' : truck.disabled ? 'disabled' : '';
    syncVisibleCargo(truck.cargoCount);
  }
  function requestDuelAction(action) {
    if (!net.connected || net.duelMode !== 'duel2v2') return;
    const id = localId(); if (![1, 3].includes(id)) { duelMessage('司机由副手负责拉炮和修车。'); return; }
    const seq = ++net.duelActionSeq;
    if (net.mode === 'host') publishHostActions({ action, seq }, { id });
    else netSend({ t: 'duel-action', action, seq });
    syncDuelHud();
  }

  function duelMessage(text) {
    if (!duelToast) return;
    duelToast.textContent = text; duelToast.classList.add('show');
    clearTimeout(duelToast.timer); duelToast.timer = setTimeout(() => duelToast.classList.remove('show'), 2200);
  }
  function duelFinish(winner, reason) {
    if (!duelResult) return;
    const snapshot = Duel.publicState(net.duelMatch), a = snapshot.trucks.amber.delivered, b = snapshot.trucks.teal.delivered;
    duelResult.querySelector('h2').textContent = winner === 'draw' ? '平局！' : winner === localTeam() ? '本队获胜！' : '对方获胜！';
    duelResult.querySelector('p').textContent = `橙队 ${a} 件 · 蓝队 ${b} 件 · ${reason === 'truck-explosion' ? '车辆爆炸判负' : reason.includes('overtime') ? '加时结束' : '时间结束'}`;
    duelResult.dataset.active = 'true';
  }

  function syncDuelHud() {
    if (!duelHud) return;
    const snapshot = net.mode === 'host' && net.duelMatch ? Duel.publicState(net.duelMatch) : net.duelSnapshot;
    const live = net.duelMode === 'duel2v2' && !!snapshot;
    const waiting = net.duelMode === 'duel2v2' && net.mode !== 'solo' && !live;
    duelHud.dataset.active = live || waiting ? 'true' : 'false';
    duelHud.dataset.live = live ? 'true' : 'false';
    $('duelWait').textContent = waiting ? `等待四名玩家 · ${net.mode === 'host' ? (net.duelWaitingPlayers || 1) : net.roster.filter((person) => person.online).length}/4` : '';
    if (!live) { if (duelButtons) duelButtons.forEach((button) => { button.disabled = true; }); return; }
    $('duelAmberScore').textContent = snapshot.trucks.amber.delivered;
    $('duelTealScore').textContent = snapshot.trucks.teal.delivered;
    const amberHouse = deliverable[snapshot.trucks.amber.targetIndex % deliverable.length];
    const tealHouse = deliverable[snapshot.trucks.teal.targetIndex % deliverable.length];
    $('duelAmberTarget').textContent = amberHouse ? '目标 #' + amberHouse.num : '派送完成';
    $('duelTealTarget').textContent = tealHouse ? '目标 #' + tealHouse.num : '派送完成';
    const seconds = Math.ceil(snapshot.remaining); $('duelClock').textContent = String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
    $('duelPhase').textContent = snapshot.overtime ? '突然死亡加时' : '5 MIN RACE';
    duelHud.dataset.urgent = seconds <= 30 ? 'true' : 'false';
    const mine = snapshot.trucks[localTeam()];
    $('duelDamage').textContent = mine.burning ? `🔥 ${Math.floor(mine.burnTotal)}/30s · 车况 ${Math.ceil(mine.hp)}%` : mine.disabled ? '车辆瘫痪 · 等待维修' : mine.hitCount ? `受击 ${mine.hitCount}/3` : '';
    duelHud.dataset.danger = mine.burning ? 'burning' : mine.disabled ? 'disabled' : mine.hitCount ? 'warning' : 'safe';
    net.duelHudHits ||= {};
    for (const team of ['amber', 'teal']) {
      const hits = snapshot.trucks[team].hitCount;
      if (net.duelHudHits[team] != null && hits > net.duelHudHits[team] && duelFlash) {
        duelFlash.classList.remove('hit'); void duelFlash.offsetWidth; duelFlash.classList.add('hit');
      }
      net.duelHudHits[team] = hits;
    }
    const roleAllowed = [1, 3].includes(localId());
    const fire = duelButtons.find((button) => button.dataset.duelAction === 'fire');
    const extinguisher = duelButtons.find((button) => button.dataset.duelAction === 'extinguisher');
    const wrench = duelButtons.find((button) => button.dataset.duelAction === 'wrench');
    const hostTruck = net.mode === 'host' ? net.duelMatch.trucks[localTeam()] : mine;
    const cooling = net.mode === 'host' && net.duelMatch ? net.duelMatch.elapsed < hostTruck.cannonReadyAt : false;
    fire.disabled = !snapshot.active || !roleAllowed || mine.cargoCount <= 0 || mine.disabled || cooling || !!mine.repair;
    extinguisher.disabled = !snapshot.active || !roleAllowed || !mine.burning || !!mine.exploded || !!mine.repair;
    wrench.disabled = !snapshot.active || !roleAllowed || mine.burning || !mine.disabled || !!mine.exploded || !!mine.repair;
    fire.title = `拉杆发射 · 剩余普通快递 ${mine.cargoCount} 件`;
    extinguisher.title = mine.burning ? `按住灭火器完成灭火 · 累计 ${mine.burnTotal.toFixed(1)}/30 秒` : '灭火器';
    wrench.title = mine.repair?.tool === 'wrench' ? `维修中 ${Math.floor(mine.repair.progress / mine.repair.required * 100)}%` : '扳手维修';
  }

  function installDuelHud() { ensureHud(); syncDuelHud(); }
  const originalUpdateHUD = updateHUD;
  updateHUD = function () {
    originalUpdateHUD();
    const active = inDuel(); $('game').dataset.duel = active ? 'true' : 'false';
    if (active) {
      const snapshot = net.mode === 'host' && net.duelMatch ? Duel.publicState(net.duelMatch) : net.duelSnapshot;
      const mine = snapshot?.trucks?.[localTeam()];
      if (mine) {
        const house = deliverable[mine.targetIndex % deliverable.length], road = house && closestCityRoad([house.x, 0, house.z]);
        $('count').textContent = mine.delivered; $('score').textContent = mine.delivered;
        $('address').textContent = house ? '本队目标 #' + house.num : '派送完成';
        $('distance').textContent = road ? Math.round(Math.hypot(car.p[0] - road.q[0], car.p[2] - road.q[2])) + ' m' : '';
        $('stockChip').textContent = '炮弹 ' + mine.cargoCount;
        $('nextNum').textContent = house ? house.num : '—';
      }
    }
    syncDuelHud();
  };

  const originalNetTickWrapper = netTick;
  netTick = function () { originalNetTickWrapper(); if (net.duelMode === 'duel2v2') { ensureHud(); ensureMatch(); syncDuelHud(); } };

  tickGuest = function (dt) {
    const result = originalTickGuest(dt);
    if (net.duelMode === 'duel2v2') {
      if (net.mode === 'guest' && pred && localId() % 2 === 0) {
        const truck = localTruckState(), seq = truck?.vehicle?.inputSeq ?? -1;
        if (truck?.vehicle && seq !== net.duelPredSeq) {
          const authoritative = truck.vehicle;
          const error = Math.hypot(pred.p[0] - authoritative.p[0], pred.p[2] - authoritative.p[2]);
          const hardLimit = clamp(4 + Math.abs(authoritative.speed) * (net.rtt || 0) / 1000 * 1.8, 5, 13);
          if (net.duelHardCorrect || error > hardLimit) {
            pred.p = authoritative.p.slice(); pred.yaw = authoritative.yaw; pred.speed = authoritative.speed;
          } else {
            const correction = error < 1.1 ? .22 : .12;
            pred.p[0] = mix(pred.p[0], authoritative.p[0], correction);
            pred.p[2] = mix(pred.p[2], authoritative.p[2], correction);
            pred.yaw = wrapAngle(pred.yaw + wrapAngle(authoritative.yaw - pred.yaw) * correction);
            pred.speed = mix(pred.speed, authoritative.speed, correction * .75);
          }
          net.duelPredSeq = seq; net.duelHardCorrect = false;
        }
        car.p = pred.p.slice(); car.yaw = pred.yaw; car.speed = pred.speed;
        car.velocity = [-Math.sin(car.yaw) * car.speed, 0, -Math.cos(car.yaw) * car.speed];
      } else syncLocalTruck();
    }
    return result;
  };
  stepCar = function (dt, predictionOnly = false) {
    if (net.duelMode === 'duel2v2' && networked()) return;
    return originalStepCar(dt, predictionOnly);
  };

  function drawRivalTruck() {
    const snapshot = net.mode === 'host' && net.duelMatch ? Duel.publicState(net.duelMatch) : net.duelSnapshot;
    if (net.duelMode !== 'duel2v2' || !networked() || !snapshot) return;
    const rivalTeam = localTeam() === 'amber' ? 'teal' : 'amber';
    const rival = snapshot.trucks[rivalTeam], p = rival.vehicle.p, yaw = rival.vehicle.yaw;
    const model = M.model(p, [0, yaw, 0]);
    renderer.draw(rival.exploded ? wreckMesh : vanMesh, model);
    renderer.draw(duelGearMesh, model);
    renderer.draw(duelTeamMarkers[rivalTeam], M.model([p[0], 4.25 + Math.sin(snapshot.elapsed * 2.1) * .07, p[2]], [0, yaw, 0]));
    for (let i = 0; i < Math.min(18, rival.cargoCount); i++) {
      const side = i % 2 ? .96 : -.96, row = Math.floor(i / 2);
      renderer.draw(packageMeshes[0], M.multiply(model, M.model([side, .28 + (row >= 12 ? .82 : 0), -1.04 + (row % 12) * .36])));
    }
    renderer.draw(vanShadow, M.model([p[0], 0, p[2]], [0, yaw, 0]), .4);
    for (const x of [-1.58, 1.58]) for (const z of [-2.60, 2.38]) renderer.draw(wheelMesh, M.multiply(model, M.model([x, .5, z], [0, 0, 0])));
    if (rival.burning) {
      const t = snapshot.elapsed;
      for (let i = 0; i < 3; i++) { const s = .65 + .2 * Math.sin(t * 10 + i * 2); renderer.draw(fireMeshes[i], scaled(M.model([p[0] + (i - 1) * .45, 1.25 + i * .23, p[2] - .5], [0, t * 2, 0]), [s, s * 1.7, s])); }
      renderer.draw(smokeMesh, M.model([p[0], 3.4 + Math.sin(t * 3) * .2, p[2]], [0, 0, 0]));
    }
    const mine = snapshot.trucks[localTeam()], own = net.mode === 'guest' && localId() % 2 === 0 ? car.p : mine.vehicle.p;
    renderer.draw(duelGearMesh, M.model(own, [0, mine.vehicle.yaw, 0]));
    renderer.draw(duelTeamMarkers[localTeam()], M.model([own[0], 4.25 + Math.sin(snapshot.elapsed * 2.1 + 1) * .07, own[2]], [0, mine.vehicle.yaw, 0]));
    if (mine.exploded) renderer.draw(wreckMesh, M.model(mine.vehicle.p, [0, mine.vehicle.yaw, 0]));
    if (mine.burning) {
      for (let i = 0; i < 3; i++) { const s = .65 + .2 * Math.sin(snapshot.elapsed * 10 + i * 2); renderer.draw(fireMeshes[i], scaled(M.model([own[0] + (i - 1) * .45, 1.25 + i * .23, own[2] - .5], [0, snapshot.elapsed * 2, 0]), [s, s * 1.7, s])); }
      renderer.draw(smokeMesh, M.model([own[0], 3.4 + Math.sin(snapshot.elapsed * 3) * .2, own[2]], [0, 0, 0]));
    }
    for (const shot of snapshot.projectiles || []) if (shot.p) renderer.draw(duelAmmoMeshes[shot.team] || packageMeshes[0], M.model(shot.p, [snapshot.elapsed * 3, snapshot.elapsed * 4, snapshot.elapsed * 2]));
  }
  draw3D = function () { originalDraw3D(); drawRivalTruck(); };

  frame = function (now) {
    const dt = Math.min(.05, Math.max(0, (now - duelLastStep) / 1000)); duelLastStep = now;
    if (net.duelMode === 'duel2v2' && networked() && net.mode === 'guest' && net.duelSnapshot?.active && state.mode === 'playing') {
      // Immediate local visual response while the room host remains authoritative.
      const truck = localTruckState();
      if (truck?.vehicle && localId() % 2 === 0) {
        const c = controlsFrom(inputs), v = pred || (pred = { p: truck.vehicle.p.slice(), yaw: truck.vehicle.yaw, speed: truck.vehicle.speed });
        const throttle = c.throttle * (truck.slowRemaining > 0 ? .7 : 1);
        if (c.brake) v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), 13 * dt);
        else if (Math.abs(throttle) > .01) v.speed += throttle * (v.speed < 0 ? 13 : 8.6) * dt;
        else v.speed *= Math.max(0, 1 - 1.8 * dt);
        v.speed = clamp(v.speed, -5, 18); v.yaw += c.steer * v.speed * .032 * dt;
        v.p[0] = clamp(v.p[0] - Math.sin(v.yaw) * v.speed * dt, -225, 225); v.p[2] = clamp(v.p[2] - Math.cos(v.yaw) * v.speed * dt, -225, 225);
        car.p = v.p.slice(); car.yaw = v.yaw; car.speed = v.speed;
      }
    }
    return originalFrame(now);
  };

  ensureHud();
  // The host creates the match after the fourth player is admitted; the menu and room flow stay shared.
})();
