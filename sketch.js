// p5.js sketch: GRID -> FLOAT -> CAT_FORMATION -> RATS_WALK -> DISPERSE
// AUDIO: Procedural Synth (Hum -> Bass -> Tension -> CLIMAX)
// PHYSICS: Sporadic chaotic movement on scatter

const cols = 60; // Back to original
const rows = 75; // Back to original

let cnv;
let circles = [];
let img; 
let circleSize;
let instructionDiv;

let state = 'GRID';
let tNoise = 0;

// Transition timing
let transitionTimer = 0;
const WANDER_BEFORE_CAT = 120;

// Assets
let catOutlineImg;
let catOutlinePoints = [];

// Rat walking frames
let ratFrameImages = [];
let ratFramePoints = [];
const TOTAL_RAT_FRAMES = 4;

// Image URLs (Raw GitHub Links)
const URL_MAIN = 'https://raw.githubusercontent.com/riyalalu/quiet-as-mice/2df4fea24174746cf3c88e297212260b32a7619d/poster.png';
const URL_CAT = 'https://raw.githubusercontent.com/riyalalu/quiet-as-mice/2df4fea24174746cf3c88e297212260b32a7619d/Artboard%209.png';
const URL_RATS = [
  'https://raw.githubusercontent.com/riyalalu/quiet-as-mice/2df4fea24174746cf3c88e297212260b32a7619d/1.png',
  'https://raw.githubusercontent.com/riyalalu/quiet-as-mice/2df4fea24174746cf3c88e297212260b32a7619d/2.png',
  'https://raw.githubusercontent.com/riyalalu/quiet-as-mice/2df4fea24174746cf3c88e297212260b32a7619d/3.png',
  'https://raw.githubusercontent.com/riyalalu/quiet-as-mice/2df4fea24174746cf3c88e297212260b32a7619d/4.png'
];

// Rat Logic
let rats = [];
let ratCircles = [];

// Spawning Logic Variables
const TOTAL_RATS_TO_SPAWN = 150; // Increased from 50!
const MAX_RATS_ON_SCREEN = 25; // Increased from 10!
let ratsSpawnedTotal = 0;
let nextSpawnTime = 0; 

// Flow params
const FLOW_SCALE = 0.0025;
const FLOW_STRENGTH = 0.6;

// --- AUDIO GLOBALS ---
let oscC4, oscE4, oscG4, oscB4, oscD5; // Musical oscillators
let reverb, delay;
let audioStarted = false;
let climaxTriggered = false;

function preload() {
  img = loadImage(URL_MAIN);
  catOutlineImg = loadImage(URL_CAT);
  for (let i = 0; i < TOTAL_RAT_FRAMES; i++) {
    ratFrameImages[i] = loadImage(URL_RATS[i]);
  }
}

function setup() {
  // 1. Create Canvas
  let cnv = createCanvas(1080, 1350);
  
  // 2. IMPORTANT: Put canvas inside the CSS container
  cnv.parent('canvas-container');
  
  pixelDensity(1);
  circleSize = width / cols;

  instructionDiv = select('#instruction-bar');

  // Process Images
  let imgRatio = img.width / img.height;
  let canvasRatio = width / height;
  if (imgRatio > canvasRatio) img.resize(0, height);
  else img.resize(width, 0);
  
  initializeCircles();
  extractCatOutlinePoints();
  for(let i=0; i<TOTAL_RAT_FRAMES; i++) {
    extractRatFramePoints(ratFrameImages[i], i);
  }

  // Init Audio System (Suspended until click)
  setupAudio();
}

function draw() {
  background('#006b59'); 
  tNoise += 0.003;

  updateInstructions();
  updateAudio(); // Manage sound levels based on state

  if (!img || circles.length === 0) return;

  if (state === 'CAT_FORMATION') {
    transitionTimer++;
  }

  // --- CAT CIRCLES ---
  for (let c of circles) {
    if (state === 'FLOAT') {
      c.wanderPerlin();
      c.checkBounds();
    } else if (state === 'CAT_FORMATION') {
      if (transitionTimer < WANDER_BEFORE_CAT) {
        c.wanderPerlin();
        c.checkBounds();
      } else {
        c.wanderTowardTarget(0.5);
        c.checkBounds();
      }
    } else if (state === 'RATS_WALK') {
      c.subtleStaticJitter(); 
    } else if (state === 'DISPERSE') {
      c.chaoticMove();
    } else {
      c.moveToGrid();
    }
    c.display();
  }

  // --- RATS LOGIC ---
  if (state === 'RATS_WALK') {
    if (ratsSpawnedTotal < TOTAL_RATS_TO_SPAWN) {
      if (rats.length <= MAX_RATS_ON_SCREEN - 3 && millis() > nextSpawnTime) {
        let remainingTotal = TOTAL_RATS_TO_SPAWN - ratsSpawnedTotal;
        let slotsOpen = MAX_RATS_ON_SCREEN - rats.length;
        let waveSize = floor(random(3, 8)); // Bigger waves now (was 2-5)
        if (waveSize > slotsOpen) waveSize = slotsOpen;
        if (waveSize > remainingTotal) waveSize = remainingTotal;
        
        if (waveSize > 0) {
            for (let i = 0; i < waveSize; i++) {
              spawnRat(i * 150); // Closer spacing (was 200)
              ratsSpawnedTotal++;
            }
            // Spawn faster as tension builds
            let spawnDelay = map(ratsSpawnedTotal, 0, TOTAL_RATS_TO_SPAWN, 1500, 400);
            nextSpawnTime = millis() + spawnDelay;
        }
      }
    }

    for (let i = rats.length - 1; i >= 0; i--) {
      rats[i].update();
      rats[i].display();
      if (rats[i].isOffScreen()) rats.splice(i, 1);
    }

    if (ratsSpawnedTotal >= TOTAL_RATS_TO_SPAWN && rats.length === 0 && ratCircles.length === 0) {
      enterDisperse();
    }
  }

  // --- RAT PARTICLES (EXPLODED) ---
  if (state === 'DISPERSE' || state === 'RATS_WALK') {
    for (let i = ratCircles.length - 1; i >= 0; i--) {
      if (state === 'DISPERSE') {
        ratCircles[i].chaoticMove(); 
      } else {
        ratCircles[i].update();
      }
      
      ratCircles[i].display();
      if (ratCircles[i].isOffScreen()) ratCircles.splice(i, 1);
    }
  }

  // --- RATS EXPLODING DURING DISPERSE ---
  if (state === 'DISPERSE') {
    for (let i = rats.length - 1; i >= 0; i--) {
      rats[i].update();
      rats[i].display();
      if (rats[i].isOffScreen()) rats.splice(i, 1);
    }
  }
}

// --- AUDIO SETUP & LOGIC ---
function setupAudio() {
  // C Major Chord - Constant melodic tones (NO envelopes, NO clicking)
  
  // Create oscillators that run continuously
  oscC4 = new p5.Oscillator('sine');
  oscC4.freq(261.63);
  oscC4.amp(0); // Start silent, fade in smoothly
  oscC4.start();

  oscE4 = new p5.Oscillator('sine');
  oscE4.freq(329.63);
  oscE4.amp(0);
  oscE4.start();

  oscG4 = new p5.Oscillator('sine');
  oscG4.freq(392.00);
  oscG4.amp(0);
  oscG4.start();

  oscB4 = new p5.Oscillator('sine');
  oscB4.freq(493.88);
  oscB4.amp(0);
  oscB4.start();

  oscD5 = new p5.Oscillator('sine');
  oscD5.freq(587.33);
  oscD5.amp(0);
  oscD5.start();

  // Lush reverb for cathedral sound
  reverb = new p5.Reverb();
  reverb.process(oscC4, 5, 3);
  reverb.process(oscE4, 5, 3);
  reverb.process(oscG4, 5, 3);
  reverb.process(oscB4, 4, 2.5);
  reverb.process(oscD5, 4, 2.5);
  
  // Delay for depth
  delay = new p5.Delay();
  delay.process(oscE4, 0.4, 0.6, 2300);
  delay.process(oscG4, 0.4, 0.6, 2300);
}

function updateAudio() {
  if (!audioStarted) return;

  // Gentle vibrato on root note (breathing, not pulsing)
  if (state === 'FLOAT' || state === 'CAT_FORMATION' || state === 'RATS_WALK') {
    let wobble = sin(frameCount * 0.015) * 1.5;
    oscC4.freq(261.63 + wobble);
  }

  if (state === 'FLOAT') {
    // Just root note - constant soft hum
    oscC4.amp(0.15, 0.5); // Smooth fade in over 0.5 seconds
    oscE4.amp(0, 0.5);
    oscG4.amp(0, 0.5);
    oscB4.amp(0, 0.5);
    oscD5.amp(0, 0.5);
  } 
  else if (state === 'CAT_FORMATION') {
    // Heavenly triad fades in SMOOTHLY (melodic overlap, no clicking)
    let progress = constrain(transitionTimer / 120, 0, 1);
    
    // Smooth continuous fade-ins (NOT triggered events)
    let volC4 = 0.2;
    let volE4 = progress * 0.22; // Fades in gradually
    let volG4 = progress * 0.2;   // Fades in gradually
    
    oscC4.amp(volC4, 1.0); // 1 second smooth ramp
    oscE4.amp(volE4, 1.5); // 1.5 second smooth ramp
    oscG4.amp(volG4, 2.0); // 2 second smooth ramp
    oscB4.amp(0, 0.5);
    oscD5.amp(0, 0.5);
  } 
  else if (state === 'RATS_WALK') {
    // CONSTANT melodic tones that get LOUDER and FASTER pulsing
    let tensionRatio = constrain(ratsSpawnedTotal / TOTAL_RATS_TO_SPAWN, 0, 1);
    let exponentialTension = pow(tensionRatio, 1.5);
    
    // Base volumes increase with tension (crescendo)
    let crescendo = 1.2 + (exponentialTension * 1.0); // 1.2x -> 2.2x
    
    let volC4 = 0.2 * crescendo;
    let volE4 = 0.22 * crescendo;
    let volG4 = 0.2 * crescendo;
    let volB4 = 0.25 * crescendo; // B4 always plays (immediate tension)
    let volD5 = (tensionRatio > 0.05 ? 0.23 : 0) * crescendo; // D5 after 8 rats
    
    // PULSING effect through amplitude modulation (NOT envelope triggers)
    // Pulse speed increases exponentially
    let pulseSpeed = 0.02 + (exponentialTension * 0.15); // Gets faster
    let pulse = (sin(millis() * pulseSpeed) * 0.5 + 0.5); // 0 to 1
    let sharpPulse = pow(pulse, 0.6); // More pronounced rhythm
    
    // Apply pulsing to volumes (smooth modulation, not clicks)
    oscC4.amp(volC4 * (0.7 + sharpPulse * 0.3), 0.05);
    oscE4.amp(volE4 * (0.7 + sharpPulse * 0.3), 0.05);
    oscG4.amp(volG4 * (0.7 + sharpPulse * 0.3), 0.05);
    oscB4.amp(volB4 * sharpPulse, 0.05); // Tension notes pulse more
    oscD5.amp(volD5 * sharpPulse, 0.05);
  } 
  else if (state === 'DISPERSE') {
    // CLIMAX - All notes at MAXIMUM sustained
    if (!climaxTriggered) {
      climaxTriggered = true;
      
      // Immediate spike to max volume
      oscC4.amp(0.5, 0.1);
      oscE4.amp(0.45, 0.1);
      oscG4.amp(0.42, 0.1);
      oscB4.amp(0.48, 0.1);
      oscD5.amp(0.4, 0.1);
      
      // Hold for 12 seconds, then fade
      setTimeout(() => {
        oscC4.amp(0, 3);
        oscE4.amp(0, 3);
        oscG4.amp(0, 3);
        oscB4.amp(0, 3);
        oscD5.amp(0, 3);
      }, 12000);
    }
  }
}

// --- TEXT ---
function updateInstructions() {
  if (state === 'GRID') {
    instructionDiv.html("CLICK TO SHRINK");
    instructionDiv.addClass('pulsing');
  } else if (state === 'FLOAT') {
    instructionDiv.html("PRESS 'C' FOR CAT");
  } else if (state === 'CAT_FORMATION') {
    if (transitionTimer < WANDER_BEFORE_CAT) instructionDiv.html("FORMING...");
    else instructionDiv.html("PRESS 'R' FOR RATS");
  } else if (state === 'RATS_WALK') {
    if(ratsSpawnedTotal < 60) instructionDiv.html("WATCH..."); // Changed from 5 to 60
    else instructionDiv.html("PRESS 'S' TO SCATTER");
  } else if (state === 'DISPERSE') {
    instructionDiv.html("PRESS 'G' TO RESET");
  }
}

function spawnRat(delayOffset) {
  let y = random(height * 0.10, height * 0.90);
  rats.push(new Rat(y, delayOffset));
}

// --- CONTROLS ---
function mousePressed() {
  // Start Audio Context on first click
  if (!audioStarted) {
    userStartAudio();
    audioStarted = true;
  }
  
  if (state === 'GRID') enterFloat();
  else if (state === 'DISPERSE') enterGrid();
}

function keyPressed() {
  if (!audioStarted) { userStartAudio(); audioStarted = true; }

  if (key === 'c' || key === 'C') { if(state === 'FLOAT') enterCatFormation(); }
  if (key === 'r' || key === 'R') { if (state === 'CAT_FORMATION') enterRatsWalk(); }
  if (key === 's' || key === 'S') { enterDisperse(); }
  if (key === 'g' || key === 'G') { enterGrid(); }
}

/* ============== STATE TRANSITIONS ============== */
function enterFloat() {
  state = 'FLOAT';
  for (let c of circles) { c.vx += random(-0.5, 0.5); c.vy += random(-0.5, 0.5); }
}

function enterCatFormation() {
  state = 'CAT_FORMATION';
  transitionTimer = 0;
  const shuffled = [...circles];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = floor(random(i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  for (let i = 0; i < circles.length; i++) {
    if (i < catOutlinePoints.length) {
      shuffled[i].setTarget(catOutlinePoints[i].x, catOutlinePoints[i].y);
      shuffled[i].isActive = true; 
    } else {
      shuffled[i].isActive = false; 
      shuffled[i].setTarget(shuffled[i].x, shuffled[i].y); 
    }
  }
}

function enterRatsWalk() {
  state = 'RATS_WALK';
  rats = [];
  ratCircles = [];
  ratsSpawnedTotal = 0;
  nextSpawnTime = millis();
  for (let c of circles) {
    if (c.isActive) { c.vx = 0; c.vy = 0; c.x = c.tx; c.y = c.ty; }
  }
}

function enterDisperse() {
  state = 'DISPERSE';
  climaxTriggered = false; // Reset for audio climax
  
  // Explode Cat
  for (let c of circles) {
    c.isActive = true; 
    c.vx = random(-8, 8);
    c.vy = random(-8, 8);
  }
  // Explode all active Rats
  for (let rat of rats) rat.explodeIntoCircles();
  
  // Assign chaotic velocity to existing rat particles
  for (let rc of ratCircles) {
    rc.vx = random(-10, 10);
    rc.vy = random(-10, 10);
  }
  
  rats = [];
}

function enterGrid() {
  state = 'GRID';
  rats = [];
  ratCircles = [];
  ratsSpawnedTotal = 0;
  transitionTimer = 0;
  climaxTriggered = false;
  
  for (let c of circles) {
    c.isActive = true; 
    c.vx = 0; c.vy = 0;
    c.setTarget(c.gridX, c.gridY);
  }
}

/* ============== PROCESSING & CLASSES ============== */
function extractCatOutlinePoints() {
  if (!catOutlineImg) return;
  catOutlinePoints = [];
  catOutlineImg.loadPixels();
  const yOffset = height - catOutlineImg.height;
  const sampleRate = 2; 
  for (let y = 0; y < catOutlineImg.height; y += sampleRate) {
    for (let x = 0; x < catOutlineImg.width; x += sampleRate) {
      const index = (y * catOutlineImg.width + x) * 4;
      const a = catOutlineImg.pixels[index + 3];
      const b = (catOutlineImg.pixels[index] + catOutlineImg.pixels[index+1] + catOutlineImg.pixels[index+2]) / 3;
      if (a > 200 && b < 180) catOutlinePoints.push({ x: x, y: y + yOffset });
    }
  }
  if (catOutlinePoints.length > circles.length) {
     const sampled = [];
     const step = catOutlinePoints.length / circles.length;
     for(let i=0; i<circles.length; i++) sampled.push(catOutlinePoints[floor(i*step)]);
     catOutlinePoints = sampled;
  }
}

function extractRatFramePoints(frameImg, frameIndex) {
  const points = [];
  frameImg.loadPixels();
  for (let y = 0; y < frameImg.height; y += 8) {
    for (let x = 0; x < frameImg.width; x += 8) {
      if (frameImg.pixels[(y * frameImg.width + x) * 4 + 3] > 200) points.push({ x: x, y: y });
    }
  }
  ratFramePoints[frameIndex] = points;
}

function initializeCircles() {
  circles = [];
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      circles.push(new Circle(i * circleSize + circleSize / 2, j * circleSize + circleSize / 2, circleSize, i, j));
    }
  }
  state = 'GRID';
}

class Circle {
  constructor(x, y, size, col, row) {
    this.gridX = x; this.gridY = y;
    this.x = x; this.y = y;
    this.size = size;
    this.col = col; this.row = row;
    this.vx = 0; this.vy = 0;
    this.wanderSpeed = random(0.9, 1.9);
    this.tx = this.gridX; this.ty = this.gridY;
    this.isActive = true; 
  }

  wanderPerlin() {
    const ang = noise(this.x * FLOW_SCALE, this.y * FLOW_SCALE, tNoise) * TWO_PI * 2.0;
    this.vx += cos(ang) * FLOW_STRENGTH * 0.12;
    this.vy += sin(ang) * FLOW_STRENGTH * 0.12;
    this.applyPhysics();
  }

  wanderTowardTarget(pullStrength) {
    if (!this.isActive) return; 
    const ang = noise(this.x * FLOW_SCALE, this.y * FLOW_SCALE, tNoise) * TWO_PI * 2.0;
    this.vx += cos(ang) * FLOW_STRENGTH * 0.12;
    this.vy += sin(ang) * FLOW_STRENGTH * 0.12;
    const dx = this.tx - this.x, dy = this.ty - this.y;
    const dist = sqrt(dx*dx + dy*dy);
    if (dist > 1) { this.vx += (dx/dist)*pullStrength; this.vy += (dy/dist)*pullStrength; }
    this.applyPhysics();
  }

  subtleStaticJitter() {
    if (!this.isActive) return;
    this.vx += (this.tx - this.x) * 0.2 + random(-0.2, 0.2);
    this.vy += (this.ty - this.y) * 0.2 + random(-0.2, 0.2);
    this.vx *= 0.6; this.vy *= 0.6;
    this.x += this.vx; this.y += this.vy;
  }

  chaoticMove() {
    this.vx += random(-2, 2);
    this.vy += random(-2, 2);
    
    this.vx = constrain(this.vx, -15, 15);
    this.vy = constrain(this.vy, -15, 15);

    this.x += this.vx;
    this.y += this.vy;
    
    if (this.x < 0 || this.x > width) this.vx *= -0.8;
    if (this.y < 0 || this.y > height) this.vy *= -0.8;
  }

  moveToGrid() {
    this.x = lerp(this.x, this.gridX, 0.12);
    this.y = lerp(this.y, this.gridY, 0.12);
    this.vx *= 0.9; this.vy *= 0.9;
  }

  applyPhysics() {
    this.vx *= 0.96; this.vy *= 0.96;
    this.x += this.vx * this.wanderSpeed;
    this.y += this.vy * this.wanderSpeed;
  }

  checkBounds() {
    if (this.x < 0) { this.x = 0; this.vx *= -0.8; }
    if (this.x > width) { this.x = width; this.vx *= -0.8; }
    if (this.y < 0) { this.y = 0; this.vy *= -0.8; }
    if (this.y > height) { this.y = height; this.vy *= -0.8; }
  }

  display() {
    if (!img) return;
    if ((state === 'CAT_FORMATION' || state === 'RATS_WALK') && !this.isActive) return; 
    push();
    const imgX = map(this.col, 0, cols, 0, img.width);
    const imgY = map(this.row, 0, rows, 0, img.height);
    translate(this.x, this.y);
    drawingContext.save();
    drawingContext.beginPath();
    drawingContext.arc(0, 0, this.size * 0.45, 0, TWO_PI);
    drawingContext.closePath();
    drawingContext.clip();
    imageMode(CENTER);
    image(img, 0, 0, this.size, this.size, imgX, imgY, img.width/cols, img.height/rows);
    drawingContext.restore();
    pop();
    noFill(); stroke(255, 80); strokeWeight(1); circle(this.x, this.y, this.size * 0.9);
  }

  setTarget(tx, ty) { this.tx = tx; this.ty = ty; }
}

class Rat {
  constructor(startY, delayOffset = 0) {
    this.x = -200 - delayOffset; 
    this.y = startY;
    this.baseY = startY;
    this.speed = random(60, 90);
    this.scale = random(0.3, 0.5);
    this.currentFrame = floor(random(TOTAL_RAT_FRAMES));
    this.frameTimer = 0;
    this.wavePhase = random(TWO_PI);
    this.circles = [];
    this.updateCircles();
  }

  updateCircles() {
    if (ratFramePoints[this.currentFrame]) {
      this.circles = ratFramePoints[this.currentFrame].map(pt => ({
        offsetX: pt.x * this.scale,
        offsetY: pt.y * this.scale
      }));
    }
  }

  update() {
    this.x += this.speed;
    this.y = this.baseY + sin(this.wavePhase += 0.3) * 12;
    this.frameTimer++;
    if (this.frameTimer >= 3) {
      this.currentFrame = (this.currentFrame + 1) % TOTAL_RAT_FRAMES;
      this.updateCircles();
      this.frameTimer = 0;
    }
  }

  explodeIntoCircles() {
    for (let c of this.circles) {
      let rc = new RatCircle(this.x + c.offsetX, this.y + c.offsetY);
      rc.vx = random(-10, 10);
      rc.vy = random(-10, 10);
      ratCircles.push(rc);
    }
  }

  display() {
    if (this.x > -200) {
        for (let c of this.circles) {
          const x = this.x + c.offsetX;
          const y = this.y + c.offsetY;
          fill(20); noStroke(); circle(x, y, 12);
          noFill(); stroke(60, 120); strokeWeight(0.5); circle(x, y, 12);
        }
    }
  }
  isOffScreen() { return this.x > width + 600; }
}

class RatCircle {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.vx = random(-2, 2);
    this.vy = random(-2, 2);
  }

  update() {
    this.x += this.vx; this.y += this.vy;
    this.vx *= 0.97; this.vy *= 0.97;
  }

  chaoticMove() {
    this.vx += random(-2, 2);
    this.vy += random(-2, 2);
    
    // Cap speed
    this.vx = constrain(this.vx, -15, 15);
    this.vy = constrain(this.vy, -15, 15);

    // Apply friction to slow down gradually (40% slower)
    this.vx *= 0.985; // Was no friction, now 1.5% friction
    this.vy *= 0.985;

    this.x += this.vx;
    this.y += this.vy;

    // Bounce off walls
    if (this.x < 0 || this.x > width) this.vx *= -0.8;
    if (this.y < 0 || this.y > height) this.vy *= -0.8;
  }

  display() {
    fill(20); noStroke(); circle(this.x, this.y, 12);
    noFill(); stroke(60, 120); circle(this.x, this.y, 12);
  }
  isOffScreen() { return this.x < -100 || this.x > width + 100 || this.y < -100 || this.y > height + 100; }
}
