'use strict';
const $=id=>document.getElementById(id),canvas=$('view');
const gl=canvas.getContext('webgl',{antialias:true,alpha:false});
if(!gl){$('error').hidden=false;$('error').textContent='浏览器未能启动 3D 画面，请开启硬件加速后重新打开。';throw Error('WebGL unavailable')}
const vs=`attribute vec3 p;attribute vec3 n;uniform mat4 model,vp;uniform mat3 normalMatrix;varying vec3 normal;varying vec3 world;void main(){vec4 w=model*vec4(p,1.);world=w.xyz;normal=normalize(normalMatrix*n);gl_Position=vp*w;}`;
const fs=`precision mediump float;uniform vec3 color;uniform float unlit;varying vec3 normal;varying vec3 world;void main(){vec3 N=normalize(normal);float diffuse=max(dot(N,normalize(vec3(-.35,1.,.65))),0.);float light=mix(.66+.34*diffuse,1.,unlit);vec3 c=color*light;float fog=smoothstep(16.,28.,length(world.xz));gl_FragColor=vec4(mix(c,vec3(.827,.902,.867),fog),1.);}`;
function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s}
const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vs));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);gl.enable(gl.DEPTH_TEST);
const loc={};for(const name of ['model','vp','color','normalMatrix','unlit'])loc[name]=gl.getUniformLocation(program,name);for(const name of ['p','n']){loc[name]=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(loc[name])}
const I=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
function mul(a,b){const o=Array(16).fill(0);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o}
function transform(x,y,z,sx=1,sy=1,sz=1){return [sx,0,0,0,0,sy,0,0,0,0,sz,0,x,y,z,1]}
function rz(a){const c=Math.cos(a),s=Math.sin(a);return [c,s,0,0,-s,c,0,0,0,0,1,0,0,0,0,1]}
function ry(a){const c=Math.cos(a),s=Math.sin(a);return [c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1]}
const sub=(a,b)=>a.map((v,i)=>v-b[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),norm=a=>{const l=Math.hypot(...a)||1;return a.map(v=>v/l)};
function normalMatrix(m){const a=[m[0],m[1],m[2]],b=[m[4],m[5],m[6]],c=[m[8],m[9],m[10]],bc=cross(b,c),det=dot(a,bc)||1e-12;return [...bc,...cross(c,a),...cross(a,b)].map(v=>v/det)}
function camera(eye,target){const z=norm(sub(eye,target)),x=norm(cross([0,1,0],z)),y=cross(z,x);return [x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]}
function mesh(positions,normals,indices){function buffer(data,type){const b=gl.createBuffer();gl.bindBuffer(type,b);gl.bufferData(type,data,gl.STATIC_DRAW);return b}return {p:buffer(new Float32Array(positions),gl.ARRAY_BUFFER),n:buffer(new Float32Array(normals),gl.ARRAY_BUFFER),i:buffer(new Uint16Array(indices),gl.ELEMENT_ARRAY_BUFFER),count:indices.length}}
function sphere(){const p=[],n=[],idx=[],w=24,h=16;for(let j=0;j<=h;j++)for(let i=0;i<=w;i++){const a=i/w*Math.PI*2,b=j/h*Math.PI,v=[Math.sin(b)*Math.cos(a),Math.cos(b),Math.sin(b)*Math.sin(a)];p.push(...v);n.push(...v)}for(let j=0;j<h;j++)for(let i=0;i<w;i++){const k=j*(w+1)+i;idx.push(k,k+w+1,k+1,k+1,k+w+1,k+w+2)}return mesh(p,n,idx)}
function cylinder(){const p=[],n=[],ix=[],w=12;for(let j=0;j<2;j++)for(let i=0;i<=w;i++){const a=i/w*2*Math.PI;p.push(Math.cos(a),j,Math.sin(a));n.push(Math.cos(a),0,Math.sin(a))}for(let i=0;i<w;i++)ix.push(i,i+w+1,i+1,i+1,i+w+1,i+w+2);return mesh(p,n,ix)}
function torus(){const p=[],n=[],ix=[],w=48,h=8;for(let j=0;j<=w;j++)for(let i=0;i<=h;i++){const a=j/w*Math.PI*2,b=i/h*Math.PI*2,r=1+.065*Math.cos(b);p.push(r*Math.cos(a),r*Math.sin(a),.065*Math.sin(b));n.push(Math.cos(b)*Math.cos(a),Math.cos(b)*Math.sin(a),Math.sin(b))}for(let j=0;j<w;j++)for(let i=0;i<h;i++){const k=j*(h+1)+i;ix.push(k,k+1,k+h+1,k+1,k+h+2,k+h+1)}return mesh(p,n,ix)}
const ball=sphere(),tube=cylinder(),ring=torus();
const C={white:[1,.981,.91],wing:[.89,.91,.79],gold:[1,.71,.32],pouch:[.98,.61,.26],dark:[.18,.30,.29],red:[.88,.43,.32],green:[.30,.58,.45],metal:[.69,.77,.67],sand:[.91,.86,.66],rose:[.96,.64,.55],cream:[1,.94,.77]};let parent=I();
function draw(m,mat,col,unlit=0){const model=mul(parent,mat);gl.bindBuffer(gl.ARRAY_BUFFER,m.p);gl.vertexAttribPointer(loc.p,3,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ARRAY_BUFFER,m.n);gl.vertexAttribPointer(loc.n,3,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,m.i);gl.uniformMatrix4fv(loc.model,false,model);gl.uniformMatrix3fv(loc.normalMatrix,false,normalMatrix(model));gl.uniform3fv(loc.color,col);gl.uniform1f(loc.unlit,unlit);gl.drawElements(gl.TRIANGLES,m.count,gl.UNSIGNED_SHORT,0)}
function ell(x,y,z,sx,sy,sz,c){draw(ball,transform(x,y,z,sx,sy,sz),c)}
function rod(a,b,r,c,caps=true){let y=sub(b,a),len=Math.hypot(...y);if(len<1e-7)return;y=norm(y);const x=norm(cross(Math.abs(y[2])<.9?[0,0,1]:[1,0,0],y)),z=cross(x,y);draw(tube,[...x.map(v=>v*r),0,...y.map(v=>v*len),0,...z.map(v=>v*r),0,...a,1],c);if(caps){ell(...a,r,r,r,c);ell(...b,r,r,r,c)}}
// World coordinates: +X east, -Z north. Ground is fixed in this world.
function terrain(x,z){return .075*Math.sin(x*.83)*Math.cos(z*.64)+.035*Math.sin(x*1.8+z*1.25)+.13*Math.pow(.5+.5*Math.sin(x*.47-z*.38),8)}
const directions={n:{angle:Math.PI/2,name:'北'},ne:{angle:Math.PI/4,name:'东北'},e:{angle:0,name:'东'},se:{angle:-Math.PI/4,name:'东南'},s:{angle:-Math.PI/2,name:'南'},sw:{angle:-3*Math.PI/4,name:'西南'},w:{angle:Math.PI,name:'西'},nw:{angle:3*Math.PI/4,name:'西北'}};
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const WHEELBASE=3.1,MAX_STEER=.82,STEER_RATE=1.8;
const ride={x:0,z:0,heading:0,target:0,steer:0,turnRate:0,distance:0,frontDistance:0,time:0,clockwiseRemaining:null};
let running=!matchMedia('(prefers-reduced-motion: reduce)').matches;
const held=new Set(),arrowKeys=new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight']);
let chordTimer=null,pendingChord=null;
const dirButtons=Array.from(document.querySelectorAll('[data-dir]'));
function nearestDirection(angle){return Object.keys(directions).reduce((best,key)=>Math.abs(wrap(angle-directions[key].angle))<Math.abs(wrap(angle-directions[best].angle))?key:best,'e')}
function selectDirection(angle){ride.clockwiseRemaining=null;ride.target=wrap(angle);const key=nearestDirection(ride.target);for(const b of dirButtons){const active=b.dataset.dir===key,difference=wrap(directions[b.dataset.dir].angle-ride.target);b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));b.setAttribute('title',active?'保持方向':Math.abs(Math.abs(difference)-Math.PI)<1e-7?'顺时针调头 180°':'转向'+directions[nearestDirection(ride.target+Math.sign(difference)*Math.PI/4)].name+'（45°）')}$('direction').textContent='目标 '+directions[key].name}
function clearDirectionInput(){if(chordTimer!==null)clearTimeout(chordTimer);chordTimer=null;pendingChord=null;held.clear()}
function reverseClockwise(base=ride.target){clearDirectionInput();selectDirection(base+Math.PI);const difference=wrap(ride.target-ride.heading);ride.clockwiseRemaining=difference>0?difference-2*Math.PI:difference}
function requestDirection(angle,base=ride.target){
  const current=directions[nearestDirection(base)].angle,difference=wrap(angle-current);
  if(Math.abs(difference)<1e-7)return;
  if(Math.abs(Math.abs(difference)-Math.PI)<1e-7){reverseClockwise(current);return}
  // One press advances exactly one compass sector, even if the input is 90° or 135° away.
  selectDirection(current+Math.sign(difference)*Math.PI/4);
}
function flushDirectionInput(){
  if(chordTimer!==null)clearTimeout(chordTimer);chordTimer=null;
  const chord=pendingChord;pendingChord=null;if(!chord)return;
  const east=Number(chord.keys.has('ArrowRight'))-Number(chord.keys.has('ArrowLeft')),north=Number(chord.keys.has('ArrowUp'))-Number(chord.keys.has('ArrowDown'));
  if(east||north)requestDirection(Math.atan2(north,east),chord.base);
}
function queueDirectionInput(){
  // Coalesce simultaneous arrow keys into one gesture instead of two successive turns.
  if(!pendingChord)pendingChord={base:ride.target,keys:new Set(held)};else pendingChord.keys=new Set(held);
  if(chordTimer!==null)clearTimeout(chordTimer);chordTimer=setTimeout(flushDirectionInput,60);
}
function uturn(){reverseClockwise()}
function updatePlay(){$('play').textContent=running?'暂停':'播放';$('play').setAttribute('aria-pressed',String(!running));$('paused').hidden=running}
function togglePlay(){running=!running;updatePlay()}
function isTyping(e){return e.target?.isContentEditable||['TEXTAREA','SELECT'].includes(e.target?.tagName)||e.target?.tagName==='INPUT'&&e.target?.type!=='range'}
window.addEventListener('keydown',e=>{if(isTyping(e))return;if(arrowKeys.has(e.key)){e.preventDefault();if(!e.repeat&&!held.has(e.key)){held.add(e.key);queueDirectionInput()}}else if(e.code==='KeyR'){e.preventDefault();if(!e.repeat)uturn()}else if(e.code==='Space'&&e.target?.tagName!=='BUTTON'){e.preventDefault();if(!e.repeat)togglePlay()}});
window.addEventListener('keyup',e=>{if(arrowKeys.has(e.key)){e.preventDefault();if(held.has(e.key))flushDirectionInput();held.delete(e.key)}});
window.addEventListener('blur',clearDirectionInput);document.addEventListener('visibilitychange',()=>{clearDirectionInput();previous=0});
for(const b of dirButtons)b.addEventListener('click',()=>{clearDirectionInput();requestDirection(directions[b.dataset.dir].angle)});
$('uturn').addEventListener('click',uturn);$('play').addEventListener('click',togglePlay);$('speed').addEventListener('input',()=>{$('speed-value').textContent=Number($('speed').value).toFixed(1)+'×'});updatePlay();selectDirection(0);
// Orbiting the camera never changes the world-space direction mapping.
const defaultView={yaw:.35,pitch:.39,distance:11.5};let yaw=defaultView.yaw,pitch=defaultView.pitch,distance=defaultView.distance,down=false,px=0,py=0;
canvas.addEventListener('pointerdown',e=>{down=true;px=e.clientX;py=e.clientY;canvas.setPointerCapture(e.pointerId);canvas.focus({preventScroll:true})});
canvas.addEventListener('pointermove',e=>{if(down){yaw-=(e.clientX-px)*.008;pitch=Math.max(.12,Math.min(1.2,pitch+(e.clientY-py)*.005));px=e.clientX;py=e.clientY}});
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>down=false);
canvas.addEventListener('wheel',e=>{e.preventDefault();distance=Math.max(6,Math.min(22,distance+e.deltaY*.008))},{passive:false});
$('reset').addEventListener('click',()=>{({yaw,pitch,distance}=defaultView)});
const trail=[{x:0,z:0}],track=[];
function rearAxle(){return {x:ride.x-WHEELBASE/2*Math.cos(ride.heading),z:ride.z+WHEELBASE/2*Math.sin(ride.heading)}}
function advance(dt){
  if(!running||dt<=0)return;
  const speedScale=Number($('speed').value),speed=1.8*speedScale,steps=Math.ceil(dt*120),step=dt/steps;
  for(let i=0;i<steps;i++){
    // The chosen compass heading controls the handlebar, never the frame yaw directly.
    const error=ride.clockwiseRemaining===null?wrap(ride.target-ride.heading):ride.clockwiseRemaining,desired=Math.max(-MAX_STEER,Math.min(MAX_STEER,Math.atan(WHEELBASE*2.6*error/Math.max(speed,.01))));
    const oldSteer=ride.steer,difference=desired-oldSteer;
    ride.steer+=Math.sign(difference)*Math.min(Math.abs(difference),STEER_RATE*step);
    const steering=(oldSteer+ride.steer)/2,rate=speed/WHEELBASE*Math.tan(steering),turn=rate*step,oldHeading=ride.heading,nextHeading=oldHeading+turn,rear=rearAxle();
    // Integrate the rear contact along its rolling direction. The front wheel takes a wider arc.
    if(Math.abs(rate)>1e-8){rear.x+=speed/rate*(Math.sin(nextHeading)-Math.sin(oldHeading));rear.z+=speed/rate*(Math.cos(nextHeading)-Math.cos(oldHeading))}
    else{rear.x+=speed*step*Math.cos(oldHeading+turn/2);rear.z-=speed*step*Math.sin(oldHeading+turn/2)}
    if(ride.clockwiseRemaining!==null){ride.clockwiseRemaining-=turn;if(Math.abs(ride.clockwiseRemaining)<1e-6&&Math.abs(ride.steer)<1e-5)ride.clockwiseRemaining=null}
    ride.heading=wrap(nextHeading);ride.x=rear.x+WHEELBASE/2*Math.cos(nextHeading);ride.z=rear.z-WHEELBASE/2*Math.sin(nextHeading);
    ride.distance+=speed*step;ride.frontDistance+=speed*step/Math.cos(steering);
  }
  ride.turnRate=speed/WHEELBASE*Math.tan(ride.steer);ride.time+=dt*speedScale;
  const last=trail[trail.length-1];if(Math.hypot(ride.x-last.x,ride.z-last.z)>.2){trail.push({x:ride.x,z:ride.z});if(trail.length>360)trail.shift()}
  const rear=rearAxle(),end=track[track.length-1];if(!end||Math.hypot(rear.x-end.x,rear.z-end.z)>.15){track.push(rear);if(track.length>160)track.shift()}
}
const mapContext=$('map').getContext('2d');
function drawMap(){if(!mapContext)return;const ctx=mapContext;ctx.clearRect(0,0,288,248);ctx.save();ctx.translate(144,124);const scale=5;ctx.strokeStyle='#d9e1ce';ctx.lineWidth=1;for(let i=-36;i<=36;i+=6){const x=(i-(ride.x%6))*scale,z=(i-(ride.z%6))*scale;ctx.beginPath();ctx.moveTo(x,-124);ctx.lineTo(x,124);ctx.stroke();ctx.beginPath();ctx.moveTo(-144,z);ctx.lineTo(144,z);ctx.stroke()}ctx.strokeStyle='#a6b998';ctx.lineWidth=3;ctx.lineJoin='round';ctx.beginPath();trail.forEach((p,i)=>{const x=(p.x-ride.x)*scale,y=(p.z-ride.z)*scale;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke();ctx.rotate(Math.PI/2-ride.heading);ctx.fillStyle='#d77c58';ctx.beginPath();ctx.moveTo(0,-13);ctx.lineTo(8,9);ctx.lineTo(0,5);ctx.lineTo(-8,9);ctx.closePath();ctx.fill();ctx.restore();$('east').textContent=(ride.x<0?'西 ':'东 ')+Math.abs(ride.x).toFixed(1)+' m';$('north').textContent=(ride.z>0?'南 ':'北 ')+Math.abs(ride.z).toFixed(1)+' m';$('needle').style.transform=`rotate(${90-ride.heading*180/Math.PI}deg)`}
// A moving rendering window samples a stationary, endless two-dimensional ground.
const gridSize=80,gridStep=.75,groundPositions=new Float32Array((gridSize+1)**2*3),groundNormals=new Float32Array(groundPositions.length),groundIndices=[];
for(let z=0;z<gridSize;z++)for(let x=0;x<gridSize;x++){const k=z*(gridSize+1)+x;groundIndices.push(k,k+gridSize+1,k+1,k+1,k+gridSize+1,k+gridSize+2)}
const groundMesh=mesh(groundPositions,groundNormals,groundIndices);let groundTileX=NaN,groundTileZ=NaN;
function drawGround(){const tileX=Math.floor(ride.x/gridStep)*gridStep,tileZ=Math.floor(ride.z/gridStep)*gridStep;if(tileX!==groundTileX||tileZ!==groundTileZ){groundTileX=tileX;groundTileZ=tileZ;for(let z=0;z<=gridSize;z++)for(let x=0;x<=gridSize;x++){const rx=(x-gridSize/2)*gridStep,rz=(z-gridSize/2)*gridStep,wx=tileX+rx,wz=tileZ+rz,k=(z*(gridSize+1)+x)*3;groundPositions[k]=rx;groundPositions[k+1]=terrain(wx,wz);groundPositions[k+2]=rz;const n=norm([-(terrain(wx+.02,wz)-terrain(wx-.02,wz))/.04,1,-(terrain(wx,wz+.02)-terrain(wx,wz-.02))/.04]);groundNormals.set(n,k)}for(const [buffer,data] of [[groundMesh.p,groundPositions],[groundMesh.n,groundNormals]]){gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.DYNAMIC_DRAW)}}draw(groundMesh,transform(tileX-ride.x,0,tileZ-ride.z),C.sand)}
function hash(x,z){const n=Math.sin(x*127.1+z*311.7)*43758.5453;return n-Math.floor(n)}
function drawLandscape(){const tx=Math.floor(ride.x/4),tz=Math.floor(ride.z/4);for(let iz=tz-5;iz<=tz+5;iz++)for(let ix=tx-5;ix<=tx+5;ix++){const seed=hash(ix,iz),wx=ix*4+seed*2.8,wz=iz*4+hash(iz,ix+9)*2.8,x=wx-ride.x,z=wz-ride.z;if(Math.hypot(x,z)>22)continue;const y=terrain(wx,wz);if(seed<.35){ell(x,y+.045,z,.25,.05,.19,[.80,.81,.61]);if(seed<.12){rod([x,y,z],[x+.04,y+.34,z],.018,C.green,false);ell(x+.04,y+.35,z,.075,.075,.075,C.cream);ell(x+.04,y+.39,z,.031,.025,.031,C.gold)}}else if(seed<.7){rod([x,y,z],[x-.07,y+.18,z+.04],.02,[.55,.64,.43],false);rod([x+.06,y,z],[x+.1,y+.26,z-.04],.018,[.55,.64,.43],false)}else{ell(x,y+.035,z,.10,.035,.08,[.76,.72,.55])}}
// Clouds are distant, with slow independent drift.
for(let i=0;i<6;i++){const x=((i*11-ride.x*.06-ride.time*.04+110)%66+66)%66-33,z=-22+(i%3)*5;for(let j=0;j<3;j++)ell(x+j*.75,7+(i%2)*.8,z,1,.32+(j%2)*.2,.6,C.white)}
// A faint tire trail makes the travelled path visible from every camera angle.
for(let i=1;i<track.length;i+=3){const p=track[i],x=p.x-ride.x,z=p.z-ride.z;if(Math.hypot(x,z)<18)ell(x,terrain(p.x,p.z)+.01,z,.075,.012,.075,[.81,.77,.59])}}
function drawShadow(heading){const saved=parent;parent=mul(transform(0,terrain(ride.x,ride.z)+.02,0),ry(heading));for(let i=0;i<3;i++)ell(-.12,.004+i*.003,0,1.6-i*.19,.012,.43-i*.075,[.79-i*.025,.76-i*.025,.57-i*.015]);parent=saved}
// A hollow collar follows the neck axis; the cloth tail stays outside the shoulder.
const SCARF_CENTER=[-.10+.25*((3.14-2.77)/.60),3.14,0];
function scarfCollarMatrix(){const axis=norm([.25,.6,0]),u=[axis[1],-axis[0],0],v=cross(axis,u);return [...u.map(x=>x*.263),0,...v.map(x=>x*.263),0,...axis.map(x=>x*.55),0,...SCARF_CENTER,1]}
function scarfPoint(u,t){return [SCARF_CENTER[0]-1.15*u,3.14+.16*Math.sin(u*Math.PI/2)+.035*u*Math.sin(t*8-u*4),.31+.42*(1-Math.exp(-7*u))+.025*u*Math.sin(t*6-u*3)]}
function scarfRibbonData(t){
  const sections=[],positions=[],normals=[],indices=[],segments=20;
  for(let i=0;i<=segments;i++){
    const u=i/segments,p=scarfPoint(u,t),tangent=norm(sub(scarfPoint(Math.min(1,u+.001),t),scarfPoint(Math.max(0,u-.001),t))),width=norm(sub([0,1,0],tangent.map(x=>x*tangent[1]))),face=norm(cross(tangent,width)),halfWidth=.072+.023*u;
    sections.push([[-1,-1],[1,-1],[1,1],[-1,1]].map(([w,s])=>p.map((x,j)=>x+w*halfWidth*width[j]+s*.008*face[j])));
  }
  function quad(points){const start=positions.length/3,n=norm(cross(sub(points[1],points[0]),sub(points[2],points[0])));for(const p of points){positions.push(...p);normals.push(...n)}indices.push(start,start+1,start+2,start,start+2,start+3)}
  for(let i=0;i<segments;i++)for(let side=0;side<4;side++){const next=(side+1)%4;quad([sections[i][side],sections[i][next],sections[i+1][next],sections[i+1][side]])}
  quad([...sections[0]].reverse());quad(sections[segments]);return {positions,normals,indices};
}
const scarfInitial=scarfRibbonData(0),scarfMesh=mesh(scarfInitial.positions,scarfInitial.normals,scarfInitial.indices);
function drawScarf(){
  draw(ring,scarfCollarMatrix(),C.red);ell(SCARF_CENTER[0],3.14,.29,.085,.075,.060,C.red);
  const data=scarfRibbonData(ride.time);for(const [buffer,values] of [[scarfMesh.p,data.positions],[scarfMesh.n,data.normals]]){gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(values),gl.DYNAMIC_DRAW)}draw(scarfMesh,I(),C.red);
}
// The fork rotates around its inclined head-tube axis, retaining its connection to the frame.
function axisRotation(axis,a){const [x,y,z]=axis,c=Math.cos(a),s=Math.sin(a),t=1-c;return [t*x*x+c,t*x*y+s*z,t*x*z-s*y,0,t*x*y-s*z,t*y*y+c,t*y*z+s*x,0,t*x*z+s*y,t*y*z-s*x,t*z*z+c,0,0,0,0,1]}
function frontSteeringMatrix(delta){
  const axis=norm([-.4,1.17,0]),tan=Math.tan(delta),a=axis[0]*axis[0],b=axis[1],gamma=Math.asin(tan*a/Math.hypot(b,tan*b*b))+Math.atan(tan*b);
  return mul(mul(transform(1.55,.77,0),axisRotation(axis,gamma)),transform(-1.55,-.77,0));
}
function transformPoint(m,p){return [m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]]}
function drawBike(){const h=ride.heading,dx=Math.cos(h),dz=-Math.sin(h),rear=terrain(ride.x-1.55*dx,ride.z-1.55*dz),front=terrain(ride.x+1.55*dx,ride.z+1.55*dz),tilt=Math.atan2(front-rear,3.1);drawShadow(h);parent=mul(mul(transform(0,(rear+front)/2+.006,0),ry(h)),rz(tilt));const a=-ride.distance/.72,bikeParent=parent,steering=frontSteeringMatrix(ride.steer);
for(const x of [-1.55,1.55]){parent=x>0?mul(bikeParent,steering):bikeParent;const wheelAngle=-(x>0?ride.frontDistance:ride.distance)/.72;draw(ring,transform(x,.77,0,.72,.72,1.22),C.dark);draw(ring,transform(x,.77,0,.638,.638,.52),C.cream);for(let i=0;i<10;i++){const q=wheelAngle+i*Math.PI/5;rod([x,.77,0],[x+.62*Math.cos(q),.77+.62*Math.sin(q),0],.009,C.metal,false)}rod([x,.77,-.13],[x,.77,.13],.066,C.metal)}
parent=bikeParent;
const A=[-1.55,.77,0],B=[-.12,.8,0],D=[-.6,1.83,0],E=[1.15,1.94,0],F=[1.55,.77,0];for(const [u,v] of [[A,B],[A,D],[B,D],[D,E],[B,E]])rod(u,v,.047,C.red);rod(D,[-.69,2.08,0],.038,C.metal);ell(-.72,2.1,0,.30,.075,.24,C.dark);
parent=mul(bikeParent,steering);
for(const z of [-.10,.10])rod([E[0],E[1],z],[F[0],F[1],z],.032,C.red);rod(E,[1.06,2.41,0],.035,C.metal);rod([1.06,2.41,-.43],[1.06,2.41,.43],.036,C.dark);for(const z of [-.43,.43])rod([1.06,2.41,z],[1.28,2.35,z],.05,[.69,.48,.3]);ell(1.08,2.46,.24,.075,.07,.075,C.gold);
parent=bikeParent;
ell(-.13,.8,0,.19,.19,.067,C.metal);rod([-.12,.8,-.40],[-.12,.8,.40],.04,C.dark);
// Two real sides of the bicycle, two opposite pedal phases.
for(const side of [-1,1]){const q=a+(side<0?Math.PI:0),z=side*.4,foot=[-.12+.29*Math.cos(q),.8+.29*Math.sin(q),z],hip=[-.64,2.18,side*.29];rod([-.12,.8,z],foot,.034,C.dark);ell(foot[0]+.03,foot[1]-.046,z,.18,.036,.13,C.dark);const dx=foot[0]-hip[0],dy=foot[1]-hip[1],len=Math.hypot(dx,dy),off=Math.sqrt(Math.max(0,.92*.92-len*len/4)),knee=[(hip[0]+foot[0])/2-dy/len*off,(hip[1]+foot[1])/2+dx/len*off,z];rod(hip,knee,.057,C.gold);rod(knee,foot,.05,C.gold);ell(foot[0]+.075,foot[1]+.025,z,.18,.065,.14,C.gold);for(let toe=-1;toe<=1;toe++)ell(foot[0]+.19,foot[1]+.02,z+toe*.074,.07,.038,.036,C.gold)}
// Soft pear-shaped body, layered feathers and a larger expressive head.
ell(-.69,2.67,0,.83,.59,.53,C.white);ell(-.37,2.73,0,.49,.43,.45,C.white);
for(let i=-1;i<=1;i++){const saved=parent;parent=mul(parent,rz(-.12+i*.1));ell(-1.37,2.56,i*.12,.36,.14,.13,C.wing);parent=saved}
rod([-.10,2.77,0],[.15,3.37,0],.22,C.white);ell(.19,3.61,0,.45,.44,.41,C.white);
// Long flattened bill and round throat pouch keep the silhouette recognizably pelican.
ell(.79,3.43,0,.67,.125,.26,C.gold);ell(.63,3.28,0,.44,.22,.235,C.pouch);ell(1.38,3.43,0,.11,.075,.095,C.gold);
for(const side of [-1,1]){const blink=Math.pow(Math.max(0,Math.cos(ride.time*.9)),70),eyeHeight=.104*(1-.88*blink),z=side*.358;ell(.32,3.70,z,.103,.123,.049,C.cream);ell(.342,3.701,side*.393,.063,eyeHeight,.034,C.dark);ell(.36,3.738,side*.419,.020,Math.max(.006,eyeHeight*.28),.009,[1,1,1]);ell(.33,3.677,side*.422,.009,Math.max(.004,eyeHeight*.12),.006,C.white);ell(.10,3.49,side*.381,.103,.055,.022,C.rose);rod([.55,3.41,side*.249],[1.14,3.425,side*.20],.008,[.76,.43,.19],false);
ell(-.83,2.70,side*.468,.50,.32,.13,C.wing);for(let i=0;i<3;i++)ell(-1.03+i*.13,2.53-i*.015,side*.494,.22,.105,.07,C.white);const grip=transformPoint(steering,[1.17,2.38,side*.43]),elbow=[.30+(grip[0]-1.17)*.4,2.42+(grip[1]-2.38)*.45,side*.49+(grip[2]-side*.43)*.55];rod([-.44,2.76,side*.46],elbow,.105,C.white);rod(elbow,grip,.075,C.white)}
// Small sage cap, stitched brim, cream badge and a coral scarf.
ell(.13,3.98,0,.36,.19,.34,C.green);ell(.29,3.94,0,.47,.033,.37,C.green);ell(.16,4.145,0,.044,.032,.044,C.gold);ell(.45,4.013,.04,.020,.065,.065,C.cream);
drawScarf();
parent=I();}
function render(){const ratio=Math.min(devicePixelRatio||1,1.75),w=Math.round(innerWidth*ratio),h=Math.round(innerHeight*ratio);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}gl.viewport(0,0,w,h);gl.clearColor(.827,.902,.867,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);const f=1/Math.tan(.65/2),aspect=w/h,projection=[f/aspect,0,0,0,0,f,0,0,innerWidth>700?.18:0,innerWidth>700?0:-.15,-1.002,-1,0,0,-.2002,0],d=distance*(aspect<1?1.45:1),groundY=terrain(ride.x,ride.z),eye=[Math.sin(yaw)*Math.cos(pitch)*d,1.7+groundY+Math.sin(pitch)*d,Math.cos(yaw)*Math.cos(pitch)*d];gl.uniformMatrix4fv(loc.vp,false,mul(projection,camera(eye,[0,1.75+groundY,0])));parent=I();drawGround();drawLandscape();drawBike();drawMap()}
let previous=0;function tick(now){if(document.hidden){previous=0;requestAnimationFrame(tick);return}const dt=previous?Math.min((now-previous)/1000,.05):0;previous=now;advance(dt);render();requestAnimationFrame(tick)}requestAnimationFrame(tick);
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();running=false;updatePlay();$('error').hidden=false;$('error').textContent='3D 画面已中断，请刷新页面恢复。'});
