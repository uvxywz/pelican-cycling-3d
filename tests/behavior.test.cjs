/* Logic and finite-number verification only. This is not browser visual QA. */
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const sourcePath = path.resolve(__dirname, '../src/main.js');
const source = fs.readFileSync(sourcePath, 'utf8');
const close = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
const angularClose = (actual, expected) => close(Math.atan2(Math.sin(actual - expected), Math.cos(actual - expected)), 0);

function harness() {
  const stats = { drawCalls: 0, models: [], projections: [], buffers: 0, mapOps: 0 };
  const finite = (values, where) => { for (const n of values) assert.ok(Number.isFinite(n), `Non-finite ${where}: ${n}`); };
  const gl = new Proxy({
    VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, DEPTH_TEST: 5,
    ARRAY_BUFFER: 6, ELEMENT_ARRAY_BUFFER: 7, STATIC_DRAW: 8, DYNAMIC_DRAW: 9,
    TRIANGLES: 10, UNSIGNED_SHORT: 11, FLOAT: 12, COLOR_BUFFER_BIT: 1, DEPTH_BUFFER_BIT: 2,
    createShader: () => ({}), createProgram: () => ({}), createBuffer: () => ({}),
    getShaderParameter: () => true, getProgramParameter: () => true,
    getUniformLocation: (_, name) => name, getAttribLocation: (_, name) => name,
    bufferData: (_, data) => { finite(data, 'buffer'); stats.buffers++; },
    uniformMatrix4fv: (loc, transpose, data) => {
      assert.equal(transpose, false); assert.equal(data.length, 16); finite(data, `matrix ${loc}`);
      (loc === 'model' ? stats.models : stats.projections).push(Array.from(data));
    },
    uniformMatrix3fv: (_, transpose, data) => { assert.equal(transpose, false); assert.equal(data.length, 9); finite(data, 'normal matrix'); },
    uniform3fv: (_, data) => finite(data, 'uniform color'), uniform1f: (_, n) => finite([n], 'uniform float'),
    drawElements: (_, count) => { assert.ok(count > 0); stats.drawCalls++; },
    viewport: (...args) => finite(args, 'viewport'), clearColor: (...args) => finite(args, 'clear color'),
  }, { get: (obj, key) => key in obj ? obj[key] : () => {} });
  const mapCtx = new Proxy({}, { get: (obj, key) => key in obj ? obj[key] : (...args) => { finite(args.filter(n => typeof n === 'number'), `2D ${key}`); stats.mapOps++; }, set: (obj, key, value) => (obj[key] = value, true) });
  class Target {
    constructor(tagName = 'DIV') { this.tagName = tagName; this.handlers = {}; this.attributes = {}; this.style = {}; this.hidden = false; this.textContent = ''; this.value = ''; this.classes = new Set(); this.classList = { toggle: (name, state) => { state ? this.classes.add(name) : this.classes.delete(name); } }; }
    addEventListener(name, fn) { (this.handlers[name] ||= []).push(fn); }
    setAttribute(name, value) { this.attributes[name] = value; }
    setPointerCapture() {}
    focus() { document.activeElement = this; }
    emit(type, overrides = {}) {
      const event = { type, target: this, repeat: false, key: '', code: '', prevented: false, preventDefault() { this.prevented = true; }, ...overrides };
      for (const fn of this.handlers[type] || []) fn(event);
      return event;
    }
  }
  const ids = Object.fromEntries(['view', 'error', 'direction', 'play', 'paused', 'speed', 'speed-value', 'uturn', 'reset', 'map', 'east', 'north', 'needle'].map(id => [id, new Target(['play', 'uturn', 'reset'].includes(id) ? 'BUTTON' : id === 'speed' ? 'INPUT' : ['view', 'map'].includes(id) ? 'CANVAS' : 'DIV')]));
  ids.speed.value = '1'; ids.speed.type = 'range'; ids.view.getContext = () => gl; ids.map.getContext = () => mapCtx;
  const buttons = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'].map(dir => { const button = new Target('BUTTON'); button.dataset = { dir }; return button; });
  const document = new Target(); document.hidden = false; document.getElementById = id => { assert.ok(ids[id], `Unknown id ${id}`); return ids[id]; }; document.querySelectorAll = () => buttons;
  const window = new Target(); const raf = [], timers = new Map(); let now = 0, timerId = 0;
  const setTimeout = (fn, delay) => { const id = ++timerId; timers.set(id, { fn, due: now + delay }); return id; };
  const clearTimeout = id => timers.delete(id);
  const advanceTimers = ms => {
    const end = now + ms;
    while (true) {
      const first = [...timers.entries()].sort((a, b) => a[1].due - b[1].due)[0];
      if (!first || first[1].due > end) break;
      timers.delete(first[0]); now = first[1].due; first[1].fn();
    }
    now = end;
  };
  const flushTimers = () => advanceTimers(1000);
  const context = vm.createContext({ document, window, setTimeout, clearTimeout, matchMedia: () => ({ matches: false }), requestAnimationFrame: fn => raf.push(fn), innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1, console });
  vm.runInContext(source, context, { filename: sourcePath });
  const read = code => vm.runInContext(code, context);
  const snapshot = () => JSON.parse(read('JSON.stringify(ride)'));
  const key = (type, name, extra = {}) => window.emit(type, { target: ids.view, key: name, code: name === 'r' ? 'KeyR' : name === ' ' ? 'Space' : name, ...extra });
  return { ids, buttons, document, window, read, snapshot, key, stats, raf, context, timers, advanceTimers, flushTimers };
}

let passed = 0, failed = 0;
function test(name, fn) { try { fn(harness()); passed++; console.log(`PASS ${name}`); } catch (error) { failed++; console.error(`FAIL ${name}: ${error.stack}`); } }
const expected = [
  ['n', ['ArrowUp'], Math.PI / 2, 0, -1], ['ne', ['ArrowUp', 'ArrowRight'], Math.PI / 4, Math.SQRT1_2, -Math.SQRT1_2],
  ['e', ['ArrowRight'], 0, 1, 0], ['se', ['ArrowDown', 'ArrowRight'], -Math.PI / 4, Math.SQRT1_2, Math.SQRT1_2],
  ['s', ['ArrowDown'], -Math.PI / 2, 0, 1], ['sw', ['ArrowDown', 'ArrowLeft'], -3 * Math.PI / 4, -Math.SQRT1_2, Math.SQRT1_2],
  ['w', ['ArrowLeft'], Math.PI, -1, 0], ['nw', ['ArrowUp', 'ArrowLeft'], 3 * Math.PI / 4, -Math.SQRT1_2, -Math.SQRT1_2],
];
for (const [direction, keys, angle, dx, dz] of expected) {
  test(`keyboard ${direction}: adjacent step, highlight, and normalized travel`, h => {
    h.read(`selectDirection(${angle}-Math.PI/4);ride.heading=ride.target`);
    for (const key of keys) assert.equal(h.key('keydown', key).prevented, true);
    h.flushTimers();
    angularClose(h.read('ride.target'), angle);
    assert.deepEqual(h.buttons.filter(b => b.classes.has('active')).map(b => b.dataset.dir), [direction]);
    assert.equal(h.buttons.find(b => b.dataset.dir === direction).attributes['aria-pressed'], 'true');
    h.read('for(let i=0;i<800;i++)advance(.025)');
    const before = h.snapshot(); h.read('for(let i=0;i<40;i++)advance(.025)'); const after = h.snapshot();
    close(after.x - before.x, dx * 1.8, 1e-5); close(after.z - before.z, dz * 1.8, 1e-5); close(after.distance - before.distance, 1.8);
  });
}
const compass = ['e', 'ne', 'n', 'nw', 'w', 'sw', 's', 'se'];
// Explicit requested behavior fixtures; rows are current heading and columns are requested bearing.
const stepResults = [
  'e ne ne ne w se se se', 'e ne n n n sw e e',
  'ne ne n nw nw nw s ne', 'n n n nw w w w se',
  'e nw nw nw w sw sw sw', 's ne w w w sw s s',
  'se se n sw sw sw s se', 'e e e nw s s s se',
].map(row => row.split(' '));
const angleOf = direction => expected.find(row => row[0] === direction)[2];
test('all 64 current/input direction pairs produce the expected single step or reversal', h => {
  for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
    const current = compass[row], input = compass[col], result = stepResults[row][col];
    h.read(`selectDirection(${angleOf(current)});ride.heading=ride.target;ride.steer=.2;requestDirection(${angleOf(input)})`);
    angularClose(h.read('ride.target'), angleOf(result));
    assert.deepEqual(h.buttons.filter(b => b.classes.has('active')).map(b => b.dataset.dir), [result], `${current} + ${input}`);
    if (Math.abs(row - col) === 4) {
      angularClose(h.read('ride.heading'), angleOf(current)); close(h.read('ride.steer'), .2); close(h.read('ride.clockwiseRemaining'), -Math.PI);
    } else angularClose(h.read('ride.heading'), angleOf(current));
  }
});
test('quick diagonal chords in either key order count once; releasing keys never adds a turn', h => {
  for (const [, keys] of expected.filter(row => row[1].length === 2)) for (const order of [keys, keys.slice().reverse()]) {
    h.read('clearDirectionInput();selectDirection(0);ride.heading=0');
    h.key('keydown', order[0]); h.advanceTimers(25); h.key('keydown', order[1]);
    angularClose(h.read('ride.target'), 0);
    h.advanceTimers(59); angularClose(h.read('ride.target'), 0); h.advanceTimers(1);
    const target = order.includes('ArrowUp') ? Math.PI / 4 : -Math.PI / 4;
    angularClose(h.read('ride.target'), target);
    h.key('keyup', order[0]); h.key('keyup', order[1]); h.flushTimers();
    angularClose(h.read('ride.target'), target); assert.equal(h.read('held.size'), 0);
  }
  h.read('advance(.1)'); assert.ok(h.read('ride.distance') > 0);
});
test('short tap is preserved; held repeat is ignored; a new press advances one further step', h => {
  h.key('keydown', 'ArrowUp'); h.advanceTimers(10); h.key('keyup', 'ArrowUp');
  angularClose(h.read('ride.target'), Math.PI / 4); h.flushTimers(); angularClose(h.read('ride.target'), Math.PI / 4);
  h.key('keydown', 'ArrowUp'); h.flushTimers(); angularClose(h.read('ride.target'), Math.PI / 2);
  for (let i = 0; i < 8; i++) h.key('keydown', 'ArrowUp', { repeat: true });
  h.key('keydown', 'ArrowUp'); h.flushTimers(); angularClose(h.read('ride.target'), Math.PI / 2);
  h.key('keyup', 'ArrowUp'); h.key('keydown', 'ArrowRight'); h.flushTimers(); angularClose(h.read('ride.target'), Math.PI / 4);
});
test('opposing arrow keys cancel only their axis within a chord; releasing does not request movement', h => {
  h.key('keydown', 'ArrowUp'); h.key('keydown', 'ArrowDown'); h.flushTimers(); angularClose(h.read('ride.target'), 0);
  h.key('keyup', 'ArrowDown'); h.flushTimers(); angularClose(h.read('ride.target'), 0);
  h.key('keydown', 'ArrowLeft'); h.flushTimers(); angularClose(h.read('ride.target'), Math.PI / 4);
  h.read('clearDirectionInput();selectDirection(0)');
  for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) h.key('keydown', key);
  h.flushTimers(); angularClose(h.read('ride.target'), 0);
});
test('blur and visibility cancel pending gestures, timers, and held keys', h => {
  h.key('keydown', 'ArrowUp'); h.window.emit('blur'); h.flushTimers();
  assert.equal(h.read('held.size'), 0); assert.equal(h.timers.size, 0); angularClose(h.read('ride.target'), 0);
  h.key('keydown', 'ArrowUp'); h.read('previous=123'); h.document.emit('visibilitychange'); h.flushTimers();
  assert.equal(h.read('held.size'), 0); assert.equal(h.read('previous'), 0); assert.equal(h.timers.size, 0); angularClose(h.read('ride.target'), 0);
});
test('opposite input schedules a clockwise arc without snapping pose or advancing animation', h => {
  h.read('ride.x=17;ride.z=-12;ride.distance=8;ride.frontDistance=9;ride.time=7;ride.steer=.5;ride.turnRate=.2');
  const before = h.snapshot(); h.key('keydown', 'ArrowLeft'); h.flushTimers(); const after = h.snapshot();
  angularClose(after.target, Math.PI); angularClose(after.heading, before.heading); close(after.steer, before.steer); close(after.turnRate, before.turnRate); close(after.clockwiseRemaining, -Math.PI);
  for (const field of ['x', 'z', 'distance', 'frontDistance', 'time']) close(after[field], before[field]);
  h.key('keyup', 'ArrowLeft'); h.flushTimers(); angularClose(h.read('ride.target'), Math.PI);
});
test('R and button request clockwise U-turns, cancel pending chords, and ignore auto-repeat', h => {
  h.key('keydown', 'ArrowUp'); h.key('keydown', 'r'); h.flushTimers();
  angularClose(h.read('ride.target'), Math.PI); angularClose(h.read('ride.heading'), 0); close(h.read('ride.clockwiseRemaining'), -Math.PI); assert.equal(h.read('held.size'), 0);
  h.key('keydown', 'r', { repeat: true }); h.key('keydown', 'ArrowUp', { repeat: true });
  h.key('keyup', 'ArrowUp'); h.flushTimers(); angularClose(h.read('ride.target'), Math.PI);
  h.key('keydown', 'ArrowDown'); h.ids.uturn.emit('click'); h.flushTimers();
  angularClose(h.read('ride.target'), 0); angularClose(h.read('ride.heading'), 0); close(h.read('ride.steer'), 0);
});
test('all compass buttons use the same relative semantics and cancel pending keyboard chords', h => {
  for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
    h.read(`selectDirection(${angleOf(compass[row])});ride.heading=ride.target`);
    h.key('keydown', 'ArrowUp'); h.buttons.find(b => b.dataset.dir === compass[col]).emit('click'); h.flushTimers();
    angularClose(h.read('ride.target'), angleOf(stepResults[row][col])); assert.equal(h.read('held.size'), 0);
  }
});
test('new gesture during a turn uses the selected heading, not the partially rotated frame', h => {
  h.key('keydown', 'ArrowUp'); h.key('keyup', 'ArrowUp'); h.read('advance(.05)');
  assert.ok(h.read('ride.heading') > 0 && h.read('ride.heading') < Math.PI / 4);
  h.key('keydown', 'ArrowUp'); h.key('keyup', 'ArrowUp'); angularClose(h.read('ride.target'), Math.PI / 2);
  const before = h.snapshot(); h.key('keydown', 'ArrowDown'); h.flushTimers(); const after = h.snapshot();
  angularClose(after.heading, before.heading); angularClose(after.target, -Math.PI / 2); assert.ok(after.clockwiseRemaining < 0);
  close(after.x, before.x); close(after.z, before.z); close(after.steer, before.steer);
});
test('pause freezes motion, time, wheel progression, and rendered model matrices', h => {
  h.read('advance(.1)'); h.ids.play.emit('click'); assert.equal(h.read('running'), false); assert.equal(h.ids.paused.hidden, false);
  const before = h.snapshot(); h.read('render()'); const matrices = h.stats.models.slice(); h.stats.models.length = 0;
  h.read('advance(.8);render()'); assert.deepEqual(h.snapshot(), before); assert.deepEqual(h.stats.models, matrices);
  h.key('keydown', ' '); assert.equal(h.read('running'), true); h.key('keydown', ' ', { repeat: true }); assert.equal(h.read('running'), true);
  h.read('advance(.1)'); assert.ok(h.read('ride.distance') > before.distance);
});
test('speed scales distance and animation time and updates displayed value', h => {
  h.ids.speed.value = '0.5'; h.ids.speed.emit('input'); assert.equal(h.ids['speed-value'].textContent, '0.5×');
  const a = h.snapshot(); h.read('advance(.1)'); const b = h.snapshot(); h.ids.speed.value = '2'; h.read('advance(.1)'); const c = h.snapshot();
  close(c.distance - b.distance, 4 * (b.distance - a.distance)); close(c.time - b.time, 4 * (b.time - a.time));
});
test('camera orbit is independent of world directions; zoom and reset remain operational', h => {
  const heading = h.read('ride.heading'); h.ids.view.emit('pointerdown', { clientX: 10, clientY: 20, pointerId: 1 }); h.ids.view.emit('pointermove', { clientX: 510, clientY: 220 });
  assert.notEqual(h.read('yaw'), .35); close(h.read('ride.heading'), heading);
  h.key('keydown', 'ArrowUp'); h.flushTimers(); angularClose(h.read('ride.target'), Math.PI / 4);
  h.ids.view.emit('pointerup'); const yaw = h.read('yaw'); h.ids.view.emit('pointermove', { clientX: 0, clientY: 0 }); close(h.read('yaw'), yaw);
  const wheel = h.ids.view.emit('wheel', { deltaY: 100000 }); assert.equal(wheel.prevented, true); close(h.read('distance'), 22);
  h.ids.view.emit('wheel', { deltaY: -100000 }); close(h.read('distance'), 6);
  h.ids.reset.emit('click'); close(h.read('yaw'), .35); close(h.read('pitch'), .39); close(h.read('distance'), 11.5);
});
test('steering crosses the angle wrap by the shortest route in both directions', h => {
  for (const sign of [1, -1]) {
    h.read(`ride.heading=${sign * 179}*Math.PI/180;ride.target=${-sign * 179}*Math.PI/180;ride.steer=0`);
    const old = h.read('ride.heading'); h.read('advance(.05)');
    const delta = h.read(`wrap(ride.heading-(${old}))`);
    assert.ok(delta * sign > 0 && Math.abs(delta) < 2 * Math.PI / 180, 'Must steer toward the nearby heading across ±180°');
    h.read('for(let i=0;i<400;i++)advance(.025)');
    close(h.read('wrap(ride.heading-ride.target)'), 0, 1e-6);
  }
});
test('front steering leads body rotation and respects steering limits', h => {
  h.key('keydown', 'ArrowUp'); h.flushTimers();
  close(h.read('ride.heading'), 0); close(h.read('ride.steer'), 0);
  h.read('advance(.05)');
  assert.ok(h.read('ride.steer') > 0, 'Front wheel starts turning toward north');
  assert.ok(h.read('ride.heading') > 0 && h.read('ride.heading') < h.read('ride.steer'), 'Frame follows the steered wheel gradually');
  assert.ok(h.read('ride.heading') < Math.PI / 180, 'The entire bicycle must not pivot immediately');
  let previousSteer = h.read('ride.steer');
  for (let i = 0; i < 100; i++) {
    h.read('advance(.01)');
    const currentSteer = h.read('ride.steer');
    assert.ok(Math.abs(currentSteer) <= .820000001, 'Steering angle must remain physically bounded');
    assert.ok(Math.abs(currentSteer - previousSteer) <= .018000001, 'Steering angle must change smoothly');
    previousSteer = currentSteer;
  }
});
test('rear axle follows a rolling arc without lateral sliding', h => {
  h.read('ride.heading=.4;ride.target=1.8;ride.steer=.5');
  const before = h.snapshot(); h.read('advance(.001)'); const after = h.snapshot();
  const halfWheelbase = 1.55;
  const rear = state => [state.x - halfWheelbase * Math.cos(state.heading), state.z + halfWheelbase * Math.sin(state.heading)];
  const start = rear(before), end = rear(after), dx = end[0] - start[0], dz = end[1] - start[1];
  const turn = Math.atan2(Math.sin(after.heading - before.heading), Math.cos(after.heading - before.heading));
  const midpointHeading = before.heading + turn / 2;
  close(dx * Math.sin(midpointHeading) + dz * Math.cos(midpointHeading), 0, 1e-10);
  close(Math.hypot(dx, dz), 1.8 * .001 * Math.sin(turn / 2) / (turn / 2), 1e-10);
  close(turn / .001, 1.8 * Math.tan((before.steer + after.steer) / 2) / 3.1, 1e-9);
});
test('front wheel rolls farther than rear during an arc and equally when straight', h => {
  h.read('advance(.2)'); close(h.read('ride.frontDistance'), h.read('ride.distance'));
  h.read('ride.heading=.4;ride.target=1.8;ride.steer=.5');
  const before = h.snapshot(); h.read('advance(.001)'); const after = h.snapshot();
  const rearTravel = after.distance - before.distance, frontTravel = after.frontDistance - before.frontDistance;
  assert.ok(frontTravel > rearTravel);
  close(frontTravel, rearTravel / Math.cos((before.steer + after.steer) / 2), 1e-10);
});
test('steering keeps both fork-axis connections fixed and points the front wheel correctly', h => {
  for (const steer of [-.82, -.4, 0, .4, .82]) {
    const result = JSON.parse(h.read(`JSON.stringify((()=>{const m=frontSteeringMatrix(${steer});return {axle:transformPoint(m,[1.55,.77,0]),head:transformPoint(m,[1.15,1.94,0]),heading:Math.atan2(-m[2],m[0])}})())`));
    for (let axis = 0; axis < 3; axis++) {
      close(result.axle[axis], [1.55, .77, 0][axis]);
      close(result.head[axis], [1.15, 1.94, 0][axis]);
    }
    angularClose(result.heading, steer);
  }
});
test('front wheel changes its plane while rear wheel stays aligned to the frame', h => {
  h.read(`terrain=()=>0;ride.heading=.27;ride.steer=.6;
    globalThis.wheelPlanes=[];globalThis.savedDraw=draw;
    draw=function(m,mat,col,...rest){if(m===ring&&mat[13]<1)wheelPlanes.push(mul(parent,mat));return savedDraw(m,mat,col,...rest)};
    drawBike();draw=savedDraw;`);
  const rings = JSON.parse(h.read('JSON.stringify(wheelPlanes)'));
  assert.equal(rings.length, 4, 'Both wheels retain tire and rim');
  const rear = rings.filter(m => m[12] < 0), front = rings.filter(m => m[12] > 0);
  assert.equal(rear.length, 2); assert.equal(front.length, 2);
  for (const mat of rear) angularClose(Math.atan2(-mat[2], mat[0]), .27);
  for (const mat of front) angularClose(Math.atan2(-mat[2], mat[0]), .87);
});
test('both hands stay attached to their handlebar grips throughout steering', h => {
  h.read(`globalThis.savedRod=rod;
    rod=function(a,b,r,c,...rest){
      if(r===.075&&c===C.white)handEnds.push(transformPoint(parent,b));
      if(r===.05&&c[0]===.69&&c[1]===.48)barCenters.push(transformPoint(parent,a.map((v,i)=>(v+b[i])/2)));
      return savedRod(a,b,r,c,...rest);
    };`);
  for (const steer of [-.82, 0, .82]) {
    h.read(`globalThis.handEnds=[];globalThis.barCenters=[];ride.steer=${steer};drawBike()`);
    const hands = JSON.parse(h.read('JSON.stringify(handEnds)')), bars = JSON.parse(h.read('JSON.stringify(barCenters)'));
    assert.equal(hands.length, 2); assert.equal(bars.length, 2);
    for (let side = 0; side < 2; side++) for (let axis = 0; axis < 3; axis++) close(hands[side][axis], bars[side][axis]);
  }
  h.read('rod=savedRod');
});
test('turning is consistent across animation frame intervals', h => {
  const other = harness();
  h.key('keydown', 'ArrowUp'); other.key('keydown', 'ArrowUp'); h.flushTimers(); other.flushTimers();
  h.read('for(let i=0;i<100;i++)advance(.05)');
  other.read('for(let i=0;i<300;i++)advance(1/60)');
  const a = h.snapshot(), b = other.snapshot();
  for (const key of ['x', 'z', 'heading', 'steer', 'distance', 'frontDistance', 'time']) close(a[key], b[key], 1e-8);
});
test('typing targets retain keys and button Space avoids duplicate pause', h => {
  const before = h.read('ride.target'); const event = h.key('keydown', 'ArrowUp', { target: { tagName: 'INPUT', type: 'text' } });
  assert.equal(event.prevented, false); close(h.read('ride.target'), before);
  h.key('keydown', ' ', { target: h.ids.play }); assert.equal(h.read('running'), true);
});
test('animation loop clamps elapsed time and does not advance while hidden', h => {
  h.raf.shift()(1000); const start = h.read('ride.distance'); h.raf.shift()(6000); close(h.read('ride.distance') - start, .09);
  h.document.hidden = true; const before = h.snapshot(); h.raf.shift()(7000); assert.deepEqual(h.snapshot(), before); assert.equal(h.read('previous'), 0);
  h.document.hidden = false; h.raf.shift()(8000); assert.deepEqual(h.snapshot(), before);
});
test('finite render buffers/matrices at 8 headings and distant world positions', h => {
  for (const [x,z] of [[0,0],[-52.7,39.2],[124.25,-999.75],[1e6,-1e6]]) {
    for (const [, , angle] of expected) {
      h.stats.models.length = 0;
      h.read(`ride.x=${x};ride.z=${z};ride.heading=${angle};ride.target=${angle};ride.distance=1834.5;ride.time=36.25;render()`);
      assert.ok(h.stats.models.length > 100);
      for (const model of h.stats.models) assert.ok(Math.hypot(model[12], model[14]) < 100, 'Render coordinates must remain local to rider');
    }
  }
  assert.ok(h.stats.drawCalls > 1000); assert.ok(h.stats.mapOps > 100);
});
test('portrait layout render and WebGL loss handler remain finite and recoverable', h => {
  h.context.innerWidth = 360; h.context.innerHeight = 780; h.context.devicePixelRatio = 3; h.read('render()');
  assert.equal(h.ids.view.width, 630); assert.equal(h.ids.view.height, 1365);
  const event = h.ids.view.emit('webglcontextlost'); assert.equal(event.prevented, true); assert.equal(h.read('running'), false); assert.equal(h.ids.error.hidden, false);
});

test('clockwise U-turns from all eight headings follow moving arcs and stop at the opposite direction', h => {
  for(const [, ,angle] of expected){
    h.read(`clearDirectionInput();selectDirection(${angle});ride.heading=ride.target;ride.steer=0;ride.x=0;ride.z=0;uturn()`);
    const start=h.snapshot(); let total=0,previous=start.heading;
    for(let i=0;i<1200;i++){
      h.read('advance(.025)');const now=h.snapshot();const delta=Math.atan2(Math.sin(now.heading-previous),Math.cos(now.heading-previous));
      assert.ok(delta<1e-7,'U-turn must remain clockwise');assert.ok(Math.abs(delta)<.03,'No pose snap');total+=delta;previous=now.heading;
    }
    close(total,-Math.PI,1e-5);close(h.read('wrap(ride.heading-ride.target)'),0,1e-5);assert.ok(h.read('ride.distance')>start.distance+10);assert.equal(h.read('ride.clockwiseRemaining'),null);
  }
});
test('pause freezes an ongoing U-turn and a new side command cancels the forced arc',h=>{
  h.read('uturn();advance(.4)');h.ids.play.emit('click');const before=h.snapshot();h.read('advance(2)');assert.deepEqual(h.snapshot(),before);
  h.read('requestDirection(ride.target+Math.PI/4)');assert.equal(h.read('ride.clockwiseRemaining'),null);
});


test('scarf cloth stays outside torso, head, wings and neck throughout its flutter',h=>{
const result=JSON.parse(h.read(`JSON.stringify((()=>{
  const bodies=[[-.69,2.67,0,.83,.59,.53],[-.37,2.73,0,.49,.43,.45],[.19,3.61,0,.45,.44,.41],[-.83,2.70,.468,.50,.32,.13],[-.83,2.70,-.468,.50,.32,.13]];
  let min=Infinity,minNeck=Infinity,where='';
  function check(p,label){for(const b of bodies){const d=p.reduce((s,v,i)=>s+((v-b[i])/b[i+3])**2,0);if(d<min){min=d;where=label+':'+b.slice(0,3)}}const a=[-.1,2.77,0],v=[.25,.6,0],q=sub(p,a),t=Math.max(0,Math.min(1,dot(q,v)/dot(v,v))),dist=Math.hypot(...q.map((x,i)=>x-t*v[i]));minNeck=Math.min(minNeck,dist)}
  const m=scarfCollarMatrix();for(let i=0;i<128;i++)for(let j=0;j<64;j++){const a=i*Math.PI/64,b=j*Math.PI/32,r=1+.065*Math.cos(b);check(transformPoint(m,[r*Math.cos(a),r*Math.sin(a),.065*Math.sin(b)]),'collar')}
  for(let t=0;t<Math.PI;t+=.04){const p=scarfRibbonData(t).positions;for(let i=0;i<p.length;i+=3)check(p.slice(i,i+3),'tail')}
  for(let i=0;i<64;i++)for(let j=0;j<32;j++){const a=i*Math.PI/32,b=j*Math.PI/16;check([SCARF_CENTER[0]+.085*Math.sin(b)*Math.cos(a),3.14+.075*Math.cos(b),.29+.060*Math.sin(b)*Math.sin(a)],'knot')}
  return {min,minNeck,where};})())`));
assert.ok(result.min>1,JSON.stringify(result));assert.ok(result.minNeck>.22,JSON.stringify(result));
});

console.log(`\n${passed} test groups passed; ${failed} failed. DOM/WebGL mocks verify logic and finite math only; no actual browser pixels were inspected.`);
process.exitCode = failed ? 1 : 0;
