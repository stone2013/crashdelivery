// A hollow, walkable van. No opaque cargo cube and no fake painted rear opening.
function makeVan(){
 const g=new MeshBuilder();
 g.box(3.14,.30,7.48,'#294b54',[0,.55,-.15]);
 g.box(3.05,.16,5.22,'#b9976b',[0,.73,.89]);
 for(let i=0;i<9;i++)g.box(.305,.025,5.15,i%2?'#c9ae7a':'#d3b885',[-1.34+i*.335,.824,.89]);
 g.box(3.08,.14,5.25,'#f1ecda',[0,3.68,.89]);
 for(const s of [-1,1]){
  g.box(.13,2.84,5.18,'#f3ecd8',[s*1.55,2.25,.86]);
  // Interior panels, ribs, timber rubbing rails and exterior orange stripe.
  g.box(.021,2.65,5.03,'#c2d1cc',[s*1.474,2.24,.86]);
  for(const z of [-1.5,-.35,.85,2.05,3.3])g.box(.065,2.73,.052,'#a2b8b8',[s*1.424,2.24,z]);
  g.box(.06,.17,4.92,'#96744f',[s*1.413,1.18,.88]);
  g.box(.06,.13,4.92,'#b79568',[s*1.413,1.9,.88]);
  g.box(.025,.5,5.10,'#eab04d',[s*1.63,1.62,.87]);
  g.box(.027,.58,.64,'#2f6170',[s*1.635,2.56,.7]);
  g.box(.031,.60,.13,'#c3dacb',[s*1.65,2.56,.7]);
  // Cab outer shell with actual see-through windows.
  g.box(.13,.83,1.94,'#e9e9d6',[s*1.5,1.24,-2.61]);
  g.box(.14,1.1,.10,'#eee9d6',[s*1.5,2.13,-3.56]);
  g.box(.14,1.1,.10,'#e5e7d5',[s*1.5,2.13,-1.69]);
  g.box(.12,.13,1.94,'#dcded0',[s*1.51,2.7,-2.63]);
  g.box(.24,.46,.22,'#2d505d',[s*1.75,2.04,-3.21]);
  g.box(.045,.38,1.67,'#e9ac48',[s*1.59,1.30,-2.55]);
 }
 // Cab dash and windshield: geometry at the windshield is intentionally solid blue.
 g.box(3.04,.15,1.97,'#f4ecda',[0,2.81,-2.64]);
 // Windshield is a separate transparent pane in Multiplayer V0.2.
 g.box(3.06,.56,.56,'#ede6cc',[0,1.38,-3.51]);
 g.box(3.03,.26,.22,'#2a4854',[0,.76,-3.92]);
 for(const x of [-1.08,1.08])g.box(.60,.23,.06,'#fff2bf',[x,1.34,-3.81]);
 g.box(.92,.14,.025,'#344d57',[0,1.27,-3.805]);
 g.box(2.83,.28,.40,'#3f626d',[0,1.92,-3.10]);
 for(const x of [-.79,.79]){
  g.box(.69,.27,.67,'#47737e',[x,1.12,-2.68]);g.box(.69,.95,.21,'#355d69',[x,1.58,-2.25],[.04,0,0]);
  g.box(.55,.28,.18,'#4d7780',[x,2.19,-2.22]);
 }
 g.cylinder(.23,.048,10,'#1f424e',[-.77,1.9,-2.94],[Math.PI*.32,0,0]);
 // Front bulkhead: open center aisle into the cab.
 for(const s of [-1,1])g.box(.93,2.67,.10,'#6c9298',[s*1.015,2.19,-1.73]);
 g.box(1.18,.22,.11,'#6b8d93',[0,3.39,-1.73]);
 g.box(1.12,.04,.35,'#edc66a',[0,.85,-1.72]);
 // Actual accelerator and brake, with the brick rendered separately.
 g.box(.27,.12,.52,'#263e45',[-.72,.91,-3.0],[.24,0,0]);
 g.box(.38,.09,.38,'#475e60',[-1.13,.94,-3.0],[.24,0,0]);
 // Rear threshold, reflectors and hazard marks.
 g.box(3.20,.20,.35,'#385762',[0,.57,3.53]);
 g.box(2.99,.06,.18,'#e9ba54',[0,.858,3.36]);
 for(let i=0;i<10;i++)g.box(.13,.063,.18,'#3f5555',[-1.4+i*.3,.86,3.36],[0,.2,0]);
 for(const s of [-1,1]){
  g.box(.20,.58,.14,'#ce6255',[s*1.55,1.17,3.53]);
  g.box(.25,2.74,.20,'#e4e4d2',[s*1.53,2.20,3.47]);
 }
 g.box(.72,.17,.08,'#f6ecc7',[0,.61,3.73]);
 for(const z of [-.6,1.9]){
  g.box(.17,.025,.9,'#547879',[0,3.60,z]);
  g.box(.12,.022,.70,'#fff7ce',[0,3.58,z]);
 }
 return renderer.mesh(g);
}
function makeRearDoor(side){
 const g=new MeshBuilder(),cx=-side*.725;
 g.box(1.44,2.65,.13,'#f0ead8',[cx,2.22,0]);
 g.box(1.28,2.41,.018,'#bdd0ce',[cx,2.22,-.077]);
 g.box(1.46,.45,.025,'#eeb34e',[cx,1.60,.081]);
 g.box(.11,2.43,.13,'#8ea5a5',[-side*.22,2.22,.087]);
 g.box(.25,.06,.13,'#2c5059',[-side*.22,1.91,.14]);
 g.box(.06,.28,.12,'#385b65',[-side*.23,1.94,-.13]);
 for(const y of [1.18,3.23])g.box(.13,.16,.20,'#768e94',[0,y,0]);
 return renderer.mesh(g);
}
function makePackage(kind){const g=new MeshBuilder(),t=parcelType(kind),s=t.r*2,c=['#cfa470','#b28355','#8bb0c5','#d8b98d','#9ca96e','#ad8ac0'][kind]||'#cfa470';g.box(s,s,s,c);g.box(s+.009,s+.012,.105,kind?'#ca7654':'#efdab0');g.box(.19,.14,.013,'#f4eed5',[s*.12,.025,s*.51]);g.box(.02,.10,.014,'#4d6970',[s*.12,.025,s*.523]);g.box(.14,.017,.014,'#4d6970',[s*.12,-.009,s*.524]);return renderer.mesh(g);}
function makeTraffic(color){const g=new MeshBuilder();g.box(1.95,.71,3.72,color,[0,.9,0]);g.box(1.73,.66,1.98,color,[0,1.55,.13]);g.box(1.59,.51,.055,'#345768',[0,1.59,-.85],[.23,0,0]);g.box(1.56,.49,.04,'#486d7b',[0,1.59,1.15],[-.22,0,0]);for(const s of [-1,1]){g.box(.02,.48,1.5,'#507b89',[s*.875,1.61,.10]);g.box(.055,.56,.10,color,[s*.89,1.59,.1]);g.box(.4,.17,.12,'#f3deb0',[s*.62,.95,-1.85]);g.box(.36,.17,.13,'#c2725b',[s*.70,.94,1.87]);for(const z of [-1.18,1.15])g.cylinder(.34,.21,9,'#304550',[s*.97,.46,z],[0,0,Math.PI/2]);}g.box(1.9,.12,.15,'#436370',[0,.64,-1.89]);return renderer.mesh(g);}
function scaled(m,scale){const s=Array.isArray(scale)?scale:[scale,scale,scale];const n=new Float32Array(m);for(let c=0;c<3;c++)for(let r=0;r<3;r++)n[c*4+r]*=s[c];return n;}
function makeMesh(b){return renderer.mesh(b);}
buildWorld();
const cityWorld=bakeCityWorld(worldBuilder),staticTriangles=cityWorld.total;worldBuilder=null;
const vanMesh=makeVan(), rearDoorMeshes=[makeRearDoor(-1),makeRearDoor(1)], packageMeshes=PACKAGE_TYPES.map((_,i)=>makePackage(i));
const wheelBuilder=new MeshBuilder();wheelBuilder.cylinder(.50,.31,12,'#233d46',[0,0,0],[0,0,Math.PI/2]);wheelBuilder.cylinder(.25,.32,8,'#b1c4bd',[0,0,0],[0,0,Math.PI/2]);const wheelMesh=makeMesh(wheelBuilder);
const vanShadow=makeMesh(new MeshBuilder().box(3.8,.007,8,'#557875',[0,.095,0]));
const glassBuilder=new MeshBuilder();glassBuilder.box(2.36,2.10,.09,'#76c5d4');glassBuilder.box(.18,1.5,.025,'#b8e2e2',[-.56,.1,.06],[0,0,-.32]);glassBuilder.box(.08,1.0,.029,'#c6ebdf',[-.25,.27,.061],[0,0,-.32]);const glassMesh=makeMesh(glassBuilder);
const doorBuilder=new MeshBuilder();doorBuilder.box(2,3.1,.15,'#b66952');for(const x of [-.46,.46])for(const y of [-.77,.62])doorBuilder.box(.7,1.04,.025,'#a15b4a',[x,y,.09]);doorBuilder.poly(.07,'#f4d48d',[.73,-.08,.16]);const doorMesh=makeMesh(doorBuilder);
const shardMesh=makeMesh(new MeshBuilder().poly(.20,'#b6e4e5',[0,0,0],[1,.4,.7]));
const woodMesh=makeMesh(new MeshBuilder().box(.20,.14,.11,'#e0b778'));
const dotMesh=makeMesh(new MeshBuilder().poly(.055,'#ffecad'));
const brickBuilder=new MeshBuilder();brickBuilder.box(.43,.18,.30,'#c87452');brickBuilder.box(.026,.02,.31,'#a75640',[-.07,.095,0]);const brickMesh=makeMesh(brickBuilder);
const beaconMesh=makeMesh(new MeshBuilder().cylinder(.46,.85,4,'#ffce69',[0,0,0],[0,Math.PI/4,0],0));
const ringMeshes={};for(const type of ['window','door']){const g=new MeshBuilder(),w=type==='window'?2.7:2.35,h=type==='window'?2.45:3.4;g.box(w,.042,.06,'#ffe68a',[0,-h/2,0]);g.box(w,.042,.06,'#ffe68a',[0,h/2,0]);g.box(.042,h,.06,'#ffe68a',[-w/2,0,0]);g.box(.042,h,.06,'#ffe68a',[w/2,0,0]);ringMeshes[type]=makeMesh(g);}
const signalMeshes=['#e2826d','#dbc474','#93cf9c'].map(c=>makeMesh(new MeshBuilder().cylinder(.18,.045,8,c,[0,0,0],[Math.PI/2,0,0])));
const smokeMesh=makeMesh(new MeshBuilder().poly(1,'#758689'));
const darkSmokeMesh=makeMesh(new MeshBuilder().poly(1,'#3f5259'));
const fireMeshes=['#e77739','#ffae40','#ffe59a'].map(c=>makeMesh(new MeshBuilder().poly(1,c)));
const metalMesh=makeMesh(new MeshBuilder().box(.47,.22,.37,'#64777c'));
const npcDoorMesh=makeMesh(new MeshBuilder().box(.1,.85,1.17,'#b89968'));
const wreckMesh=makeMesh(new MeshBuilder().box(1.87,.62,3.49,'#40545b',[0,.52,0]).box(1.53,.45,1.8,'#566568',[0,1.04,.05]).box(1.3,.25,.5,'#253d44',[0,1.26,-.6],[.2,0,.14]));
const armMesh=makeMesh(new MeshBuilder().box(.16,.16,.48,'#3d7181',[0,0,0]).box(.16,.15,.20,'#e4b282',[0,0,-.31]));
const deliverable=houses.filter(h=>h.deliverable),TOTAL=deliverable.length;
for(let i=0;i<14;i++)traffic.push({id:i,p:[190+i*4,.1,190],yaw:0,speed:0,hp:100,phase:'normal',burn:0,wreckAge:0,hitCooldown:0,drift:[0,0,0],spin:0,smokeClock:0,mesh:makeTraffic(['#db8765','#709a98','#bdae75','#8c9ba8','#c68e87','#8ab087'][i%6])});

let audio=null,audioMaster=null,engineVoice=null,windVoice=null,noiseBuffer=null;
function initAudio(){try{
 if(!audio){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;audio=new AC();audioMaster=audio.createGain();audioMaster.gain.value=soundOn?.16:0;audioMaster.connect(audio.destination);
 const o=audio.createOscillator(),g=audio.createGain();o.type='triangle';o.frequency.value=40;g.gain.value=0;o.connect(g);g.connect(audioMaster);o.start();engineVoice={o,g};
 noiseBuffer=audio.createBuffer(1,audio.sampleRate,audio.sampleRate);const n=noiseBuffer.getChannelData(0);for(let i=0;i<n.length;i++)n[i]=Math.random()*2-1;
 const src=audio.createBufferSource(),f=audio.createBiquadFilter(),wg=audio.createGain();src.buffer=noiseBuffer;src.loop=true;f.type='lowpass';f.frequency.value=450;wg.gain.value=0;src.connect(f);f.connect(wg);wg.connect(audioMaster);src.start();windVoice={src,f,g:wg};
 }if(audio.state==='suspended')audio.resume().catch(()=>{});
}catch(e){soundOn=false;}}
function tone(freq,dur=.12,type='sine',gain=.22,delay=0){if(!audio||!soundOn)return;try{const t=audio.currentTime+delay,o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(Math.max(25,freq*.6),t+dur);g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);o.connect(g);g.connect(audioMaster);o.start(t);o.stop(t+dur+.02);o.onended=()=>{o.disconnect();g.disconnect();};}catch(e){}}
function noiseSound(dur=.25,frequency=1800,gain=.3,filter='highpass'){if(!audio||!soundOn||!noiseBuffer)return;try{const src=audio.createBufferSource(),f=audio.createBiquadFilter(),g=audio.createGain(),t=audio.currentTime;src.buffer=noiseBuffer;f.type=filter;f.frequency.value=frequency;g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);src.connect(f);f.connect(g);g.connect(audioMaster);src.start(t);src.stop(t+dur);src.onended=()=>{src.disconnect();f.disconnect();g.disconnect();};}catch(e){}}
function glassSound(){noiseSound(.27,1700,.42);}
function nextHouse(){return deliverable.find(h=>!h.done)||null;}
function formatTime(t){t=Math.max(0,Math.floor(t));return String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0');}
function showToast(title,sub='',duration=2.8){$('toastTitle').textContent=title;$('toastSub').textContent=sub;$('toast').classList.add('show');state.toastUntil=state.time+duration;}
function showHint(s,t=5){$('hint').textContent=s;state.hintUntil=state.time+t;$('hint').classList.remove('hidden');}
function cancelCharge(){state.charging=false;state.charge=0;state.chargeSource=null;$('throwBtn').classList.remove('charging');}
function clearInputs(){inputs.keys.clear();for(const k of ['left','right','gas','brake','forward','back','walkLeft','walkRight'])inputs[k].clear();inputs.stickX=inputs.stickY=0;document.querySelectorAll('.pressed').forEach(el=>el.classList.remove('pressed'));$('stickThumb').style.transform='';cancelCharge();}
function loadCargo(){cargo.length=0;player.held=null;
 const kinds=[0,2,3,0,1,4,0,5,2,3,0,1,4,0,5,2,3,0];
 for(let i=0;i<kinds.length;i++){const side=i%2?1:-1,row=Math.floor(i/2),kind=kinds[i],r=parcelType(kind).r,z=-.99+(row%6)*.78,y=CAB.floor+r+.01+(row>=6?r*2+.08:0);cargo.push(makeCargo(kind,[side*1.01,y,z]));}
}
function makeCargo(kind,p){const t=parcelType(kind),mystery=kind===5?(rnd()<.34?'bonus':rnd()<.5?'light':'heavy'):null;return{id:state.nextId++,kind,r:t.r,mass:t.mass,p:p.slice(),v:[0,0,0],rot:[0,(rnd()-.5)*.13,0],spin:[0,0,0],thrown:false,age:0,lastHit:-1,vehicleSpeed:0,dist:0,integrity:100,bounces:0,blastBoosted:false,mystery};}
function parcelLabel(p){const t=parcelType(p.kind);return t.icon+' '+t.name+(p.kind===3?' · '+Math.round(p.integrity??100)+'%':'');}
function hurtParcel(p,impact){const t=parcelType(p.kind);if(!t.fragile)return;const loss=Math.max(0,impact-2.4)*t.fragile*2.4;if(loss>.35)p.integrity=clamp((p.integrity??100)-loss,0,100);}
