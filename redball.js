// ============================================================
//  RED BALL GAME - 10 Levels, Crisp 2D, Tough Obstacles
//  Features: deadboxes, retro pixel-art Game Over screen
// ============================================================
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// ---- HiDPI crisp rendering ----
const dpr = window.devicePixelRatio || 1;
const CSS_W = 900, CSS_H = 550;
canvas.width = CSS_W * dpr;
canvas.height = CSS_H * dpr;
canvas.style.width = CSS_W + 'px';
canvas.style.height = CSS_H + 'px';
ctx.scale(dpr, dpr);
ctx.imageSmoothingEnabled = false;
const W = CSS_W, H = CSS_H;

let gameRunning = false, gamePaused = false, currentLevel = 0, score = 0, lives = 3;
let stars = 0, totalStars = 0, gameTime = 0;
let gameOverActive = false, gameOverTime = 0, levelCompleteActive = false, levelCompleteTime = 0;
let highScore = parseInt(localStorage.getItem('redBallHighScore') || '0', 10);

const GRAVITY = 1100;
const JUMP_VEL = -620;
const PLAYER_SPEED = 280;
const FRICTION = 0.88;

const keys = {};
window.addEventListener('keydown', e => {
    keys[e.key] = true;
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
    if (e.key === 'Enter') { e.preventDefault(); }
    if (e.key === 'Escape') { e.preventDefault(); togglePause(); }
    if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        soundManager.toggleMute();
    }
});
window.addEventListener('keyup', e => { keys[e.key] = false; });

// ============================================================
//  WEB AUDIO SOUND MANAGER - BGM & Synthesized Sound Effects
// ============================================================
class SoundManager {
    constructor() {
        this.ctx = null;
        this.muted = localStorage.getItem('redBallMuted') === 'true';
        this.masterGain = null;
        this.bgmGain = null;
        this.sfxGain = null;
        
        // BGM Sequencer state
        this.bgmPlaying = false;
        this.bgmTimer = null;
        this.bgmStep = 0;
        this.nextNoteTime = 0;
        this.bgmTempo = 134; // Upbeat tempo
        
        this.initEventListeners();
    }
    
    init() {
        if (this.ctx) {
            if (this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
            return;
        }
        
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            this.ctx = new AudioCtx();
            
            // Master gain
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.setValueAtTime(this.muted ? 0 : 1, this.ctx.currentTime);
            this.masterGain.connect(this.ctx.destination);
            
            // BGM Gain
            this.bgmGain = this.ctx.createGain();
            this.bgmGain.gain.setValueAtTime(0.32, this.ctx.currentTime);
            this.bgmGain.connect(this.masterGain);
            
            // SFX Gain
            this.sfxGain = this.ctx.createGain();
            this.sfxGain.gain.setValueAtTime(0.55, this.ctx.currentTime);
            this.sfxGain.connect(this.masterGain);
            
            this.updateMuteUI();
        } catch (e) {
            console.warn('Web Audio API not supported or blocked:', e);
        }
    }
    
    initEventListeners() {
        // Automatically unlock AudioContext and start intro BGM on first user interaction
        const unlock = () => {
            this.init();
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
            if (menuAnimRunning && !this.bgmPlaying) {
                this.startMenuBGM();
            }
        };
        ['click', 'keydown', 'touchstart', 'pointerdown'].forEach(evt => {
            window.addEventListener(evt, unlock, { once: false, passive: true });
        });
    }
    
    playStomp() {
        if (!this.ctx || this.muted) return;
        this.init();
        const now = this.ctx.currentTime;
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(350, now);
        osc.frequency.exponentialRampToValueAtTime(90, now + 0.12);
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, now);
        filter.frequency.exponentialRampToValueAtTime(200, now + 0.12);
        
        gain.gain.setValueAtTime(0.32, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);
        
        osc.start(now);
        osc.stop(now + 0.15);
    }
    
    playDeath() {
        if (!this.ctx || this.muted) return;
        this.init();
        const now = this.ctx.currentTime;
        
        // 1. Noise crunch
        const bufferSize = Math.floor(this.ctx.sampleRate * 0.16);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(950, now);
        noiseFilter.frequency.exponentialRampToValueAtTime(150, now + 0.16);
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.45, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.sfxGain);
        noise.start(now);
        
        // 2. Descending tone slide
        const osc = this.ctx.createOscillator();
        const oscFilter = this.ctx.createBiquadFilter();
        const oscGain = this.ctx.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(380, now);
        osc.frequency.exponentialRampToValueAtTime(58, now + 0.55);
        
        oscFilter.type = 'lowpass';
        oscFilter.frequency.setValueAtTime(1200, now);
        oscFilter.frequency.exponentialRampToValueAtTime(180, now + 0.55);
        
        oscGain.gain.setValueAtTime(0.42, now);
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.58);
        
        osc.connect(oscFilter);
        oscFilter.connect(oscGain);
        oscGain.connect(this.sfxGain);
        
        osc.start(now);
        osc.stop(now + 0.6);
        
        // 3. Sub boom
        const sub = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(90, now);
        sub.frequency.exponentialRampToValueAtTime(30, now + 0.4);
        subGain.gain.setValueAtTime(0.5, now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
        sub.connect(subGain);
        subGain.connect(this.sfxGain);
        sub.start(now);
        sub.stop(now + 0.45);
    }
    
    playStar() {
        if (!this.ctx || this.muted) return;
        this.init();
        const now = this.ctx.currentTime;
        
        // 2-tone bright bell chime
        const playTone = (freq, delay) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + delay);
            gain.gain.setValueAtTime(0.28, now + delay);
            gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.22);
            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.start(now + delay);
            osc.stop(now + delay + 0.24);
        };
        playTone(987.77, 0);     // B5
        playTone(1318.51, 0.08); // E6
    }
    
    playWin() {
        if (!this.ctx || this.muted) return;
        this.init();
        const now = this.ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + i * 0.11);
            gain.gain.setValueAtTime(0.3, now + i * 0.11);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.11 + (i === 3 ? 0.6 : 0.2));
            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.start(now + i * 0.11);
            osc.stop(now + i * 0.11 + (i === 3 ? 0.65 : 0.25));
        });
    }
    
    // ---- HOME SCREEN INTRO BGM ----
    startMenuBGM() {
        this.init();
        if (this.bgmPlaying || !this.ctx) return;
        this.bgmPlaying = true;
        this.bgmStep = 0;
        this.nextNoteTime = this.ctx.currentTime + 0.05;
        this.scheduleBGM();
    }
    
    stopMenuBGM() {
        this.bgmPlaying = false;
        if (this.bgmTimer) {
            clearTimeout(this.bgmTimer);
            this.bgmTimer = null;
        }
    }
    
    scheduleBGM() {
        if (!this.bgmPlaying || !this.ctx) return;
        
        const secondsPerStep = (60 / this.bgmTempo) / 2; // 8th notes
        
        // Notes in Hz
        const C4=261.63, D4=293.66, E4=329.63, F4=349.23, G4=392.00, A4=440.00, B4=493.88;
        const C5=523.25, D5=587.33, E5=659.25, F5=698.46, G5=783.99, A5=880.00, B5=987.77, C6=1046.50;
        const C3=130.81, D3=146.83, E3=164.81, F3=174.61, G3=196.00, A3=220.00, B3=246.94;
        
        const leadPattern = [
            C5, E5, G5, C6,  B5, G5, E5, G5,
            A5, 0,  F5, A5,  G5, E5, C5, 0,
            D5, E5, F5, A5,  G5, F5, E5, D5,
            C5, E5, G5, B5,  C6, 0,  0,  0
        ];
        
        const bassPattern = [
            C3, 0,  G3, 0,   E3, 0,  G3, 0,
            F3, 0,  C3, 0,   C3, 0,  E3, 0,
            D3, 0,  A3, 0,   G3, 0,  B3, 0,
            C3, 0,  G3, 0,   C3, G3, C4, 0
        ];
        
        const padPattern = [
            E4, G4, E4, G4,  D4, G4, D4, G4,
            C4, F4, C4, F4,  C4, E4, C4, E4,
            D4, F4, D4, F4,  D4, G4, D4, G4,
            E4, G4, E4, G4,  E4, G4, C5, 0
        ];
        
        while (this.nextNoteTime < this.ctx.currentTime + 0.25) {
            const step = this.bgmStep % 32;
            const time = this.nextNoteTime;
            
            // Lead melody
            const leadFreq = leadPattern[step];
            if (leadFreq > 0 && !this.muted) {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                const filter = this.ctx.createBiquadFilter();
                
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(leadFreq, time);
                
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(2200, time);
                filter.frequency.exponentialRampToValueAtTime(700, time + secondsPerStep * 0.9);
                
                gain.gain.setValueAtTime(0.22, time);
                gain.gain.exponentialRampToValueAtTime(0.001, time + secondsPerStep * 0.85);
                
                osc.connect(filter);
                filter.connect(gain);
                gain.connect(this.bgmGain);
                
                osc.start(time);
                osc.stop(time + secondsPerStep * 0.9);
            }
            
            // Bassline
            const bassFreq = bassPattern[step];
            if (bassFreq > 0 && !this.muted) {
                const bassOsc = this.ctx.createOscillator();
                const bassGain = this.ctx.createGain();
                bassOsc.type = 'sine';
                bassOsc.frequency.setValueAtTime(bassFreq, time);
                bassGain.gain.setValueAtTime(0.28, time);
                bassGain.gain.exponentialRampToValueAtTime(0.001, time + secondsPerStep * 0.9);
                bassOsc.connect(bassGain);
                bassGain.connect(this.bgmGain);
                bassOsc.start(time);
                bassOsc.stop(time + secondsPerStep * 0.95);
            }
            
            // Soft chord arp
            const padFreq = padPattern[step];
            if (padFreq > 0 && step % 2 === 1 && !this.muted) {
                const padOsc = this.ctx.createOscillator();
                const padGain = this.ctx.createGain();
                padOsc.type = 'sine';
                padOsc.frequency.setValueAtTime(padFreq, time);
                padGain.gain.setValueAtTime(0.08, time);
                padGain.gain.exponentialRampToValueAtTime(0.001, time + secondsPerStep * 0.8);
                padOsc.connect(padGain);
                padGain.connect(this.bgmGain);
                padOsc.start(time);
                padOsc.stop(time + secondsPerStep * 0.85);
            }
            
            // Subtle rhythmic shaker
            if (step % 2 === 0 && !this.muted) {
                const noiseBuf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * 0.04), this.ctx.sampleRate);
                const nd = noiseBuf.getChannelData(0);
                for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * 0.15;
                const pSource = this.ctx.createBufferSource();
                pSource.buffer = noiseBuf;
                const pFilter = this.ctx.createBiquadFilter();
                pFilter.type = 'highpass';
                pFilter.frequency.setValueAtTime(step % 4 === 2 ? 4000 : 7000, time);
                const pGain = this.ctx.createGain();
                pGain.gain.setValueAtTime(step % 4 === 2 ? 0.12 : 0.06, time);
                pGain.gain.exponentialRampToValueAtTime(0.001, time + 0.035);
                pSource.connect(pFilter);
                pFilter.connect(pGain);
                pGain.connect(this.bgmGain);
                pSource.start(time);
            }
            
            this.nextNoteTime += secondsPerStep;
            this.bgmStep++;
        }
        
        this.bgmTimer = setTimeout(() => this.scheduleBGM(), 100);
    }
    
    toggleMute() {
        this.init();
        this.muted = !this.muted;
        localStorage.setItem('redBallMuted', this.muted);
        if (this.masterGain && this.ctx) {
            this.masterGain.gain.setValueAtTime(this.muted ? 0 : 1, this.ctx.currentTime);
        }
        if (this.muted) {
            this.stopRoll();
        }
        this.updateMuteUI();
        return this.muted;
    }
    
    updateMuteUI() {
        const isMuted = this.muted;
        
        // HUD sound button
        const hudOn = document.getElementById('hudSoundIconOn');
        const hudOff = document.getElementById('hudSoundIconOff');
        const btnMute = document.getElementById('btnMute');
        if (hudOn && hudOff) {
            hudOn.classList.toggle('hidden-icon', isMuted);
            hudOff.classList.toggle('hidden-icon', !isMuted);
        }
        if (btnMute) {
            btnMute.classList.toggle('muted', isMuted);
        }
        
        // Menu sound button
        const menuOn = document.getElementById('menuSoundIconOn');
        const menuOff = document.getElementById('menuSoundIconOff');
        const menuLabel = document.getElementById('menuSoundLabel');
        const btnSoundMenu = document.getElementById('btnSoundMenu');
        if (menuOn && menuOff) {
            menuOn.classList.toggle('hidden-icon', isMuted);
            menuOff.classList.toggle('hidden-icon', !isMuted);
        }
        if (menuLabel) {
            menuLabel.textContent = isMuted ? 'Sound: OFF' : 'Sound: ON';
        }
        if (btnSoundMenu) {
            btnSoundMenu.classList.toggle('muted', isMuted);
        }
    }
}

const soundManager = new SoundManager();

// ---- Mobile Touch Controls ----
(function initMobileControls() {
    const btns = document.querySelectorAll('.touchBtn');
    if (!btns.length) return;

    btns.forEach(btn => {
        const key = btn.getAttribute('data-key');
        if (!key) return;

        btn.addEventListener('touchstart', function(e) {
            e.preventDefault();
            keys[key] = true;
            btn.classList.add('pressed');
        }, { passive: false });

        btn.addEventListener('touchend', function(e) {
            e.preventDefault();
            keys[key] = false;
            btn.classList.remove('pressed');
        }, { passive: false });

        btn.addEventListener('touchcancel', function(e) {
            keys[key] = false;
            btn.classList.remove('pressed');
        });

        // Also handle mouse for testing on desktop
        btn.addEventListener('mousedown', function(e) {
            e.preventDefault();
            keys[key] = true;
            btn.classList.add('pressed');
        });

        btn.addEventListener('mouseup', function(e) {
            keys[key] = false;
            btn.classList.remove('pressed');
        });

        btn.addEventListener('mouseleave', function(e) {
            keys[key] = false;
            btn.classList.remove('pressed');
        });
    });

    // Prevent canvas from scrolling on touch
    document.getElementById('game').addEventListener('touchmove', function(e) {
        e.preventDefault();
    }, { passive: false });
})();

let camX = 0, camY = 0, player = null;
let platforms = [], starObjects = [], enemyObjects = [], flagObj = null, levelWidth = 0;
let clouds = [], particles = [];
let spikeObjects = [], movingPlatforms = [], bouncePads = [], lavaPools = [], ceilings = [];

function createPlayer(x, y) {
    return { x, y, vx: 0, vy: 0, radius: 22, onGround: false, rotation: 0, dead: false, won: false, eyeBlink: 0 };
}

// ============================================================
//  10 UNIQUE LEVELS - Tough design, no easy bypass
//  ceilings = invisible barriers that block jumping over sections
// ============================================================
const LEVELS = [
  // ---- L1: Green Meadow ----
  { name:'Green Meadow',
    bgColor1:'#87CEEB',bgColor2:'#C8E6FF',
    grassC:['#66BB6A','#4CAF50','#388E3C'],dirtC:['#8B6914','#7A5B12','#5C4010'],hillC:['#6BBF59','#4CAF50'],
    playerStart:{x:60,y:380},
    platforms:[
      {x:0,y:460,w:350,h:90},{x:420,y:460,w:250,h:90},{x:740,y:440,w:220,h:110},
      {x:1030,y:460,w:350,h:90},{x:1450,y:460,w:500,h:90},
      {x:250,y:360,w:100,h:26},{x:550,y:330,w:90,h:26},{x:870,y:310,w:110,h:26},
      {x:1200,y:340,w:120,h:26},{x:1560,y:320,w:100,h:26},
    ],
    stars:[{x:290,y:320},{x:590,y:290},{x:920,y:270},{x:1250,y:300},{x:1600,y:280}],
    enemies:[{x:480,y:428,patrol:120,speed:80},{x:1100,y:428,patrol:150,speed:90}],
    spikes:[{x:380,y:445,w:35}],
    movingPlatforms:[],bouncePads:[],lavaPools:[],
    ceilings:[{x:200,y:200,w:600,h:20},{x:1000,y:190,w:500,h:20}],
    flag:{x:1850,y:410},width:2000,
  },
  // ---- L2: Sandy Desert ----
  { name:'Sandy Desert',
    bgColor1:'#F4A460',bgColor2:'#FFDEAD',
    grassC:['#D2B48C','#C4A882','#A08060'],dirtC:['#B8860B','#A07000','#8B6508'],hillC:['#DEB887','#D2B48C'],
    playerStart:{x:60,y:380},
    platforms:[
      {x:0,y:460,w:280,h:90},{x:340,y:440,w:160,h:110},{x:560,y:460,w:200,h:90},
      {x:820,y:430,w:200,h:120},{x:1080,y:460,w:300,h:90},{x:1440,y:440,w:400,h:110},
      {x:180,y:350,w:90,h:24},{x:440,y:310,w:80,h:24},{x:700,y:330,w:100,h:24},
      {x:970,y:300,w:80,h:24},{x:1250,y:340,w:110,h:24},{x:1580,y:310,w:90,h:24},
    ],
    stars:[{x:220,y:310},{x:470,y:270},{x:740,y:290},{x:1000,y:260},{x:1290,y:300},{x:1620,y:270}],
    enemies:[{x:300,y:428,patrol:100,speed:90},{x:600,y:428,patrol:130,speed:100},{x:1130,y:428,patrol:160,speed:90}],
    spikes:[{x:490,y:445,w:40},{x:770,y:445,w:35},{x:1020,y:445,w:40},{x:440,y:295,w:30}],
    movingPlatforms:[],bouncePads:[],lavaPools:[],
    ceilings:[{x:150,y:200,w:700,h:18},{x:950,y:190,w:600,h:18}],
    flag:{x:1760,y:390},width:1910,
  },
  // ---- L3: Frozen Tundra ----
  { name:'Frozen Tundra',
    bgColor1:'#B0C4DE',bgColor2:'#E8EEF4',
    grassC:['#A8D8EA','#89CFF0','#6CB4D9'],dirtC:['#6B8DAD','#5A7A9A','#4A6A8A'],hillC:['#C5DDE8','#A8CCE0'],
    playerStart:{x:60,y:380},
    platforms:[
      {x:0,y:460,w:260,h:90},{x:320,y:450,w:140,h:100},{x:520,y:460,w:180,h:90},
      {x:760,y:440,w:180,h:110},{x:1000,y:460,w:260,h:90},{x:1320,y:450,w:180,h:100},
      {x:1560,y:460,w:250,h:90},{x:1870,y:440,w:300,h:110},
      {x:170,y:350,w:80,h:24},{x:400,y:320,w:70,h:24},{x:620,y:290,w:90,h:24},
      {x:860,y:320,w:80,h:24},{x:1100,y:300,w:90,h:24},{x:1400,y:320,w:80,h:24},
      {x:1670,y:300,w:90,h:24},{x:1960,y:330,w:100,h:24},
    ],
    stars:[{x:210,y:310},{x:430,y:280},{x:660,y:250},{x:900,y:280},{x:1140,y:260},{x:1440,y:280},{x:1710,y:260}],
    enemies:[{x:560,y:428,patrol:90,speed:70},{x:1040,y:428,patrol:130,speed:80},{x:1600,y:428,patrol:140,speed:85},{x:1910,y:408,patrol:160,speed:90}],
    spikes:[{x:290,y:445,w:25},{x:710,y:445,w:30},{x:950,y:445,w:35},{x:1270,y:445,w:30},{x:1500,y:445,w:25},{x:400,y:305,w:25}],
    movingPlatforms:[{x:350,y:380,w:70,h:22,moveX:90,moveY:0,speed:45}],
    bouncePads:[],lavaPools:[],
    ceilings:[{x:100,y:180,w:800,h:18},{x:1000,y:175,w:700,h:18}],
    flag:{x:2100,y:390},width:2250,
  },
  // ---- L4: Volcanic Mountains ----
  { name:'Volcanic Mountains',
    bgColor1:'#2C1810',bgColor2:'#5C2E1A',
    grassC:['#555','#444','#333'],dirtC:['#3E2723','#33201A','#2A1A12'],hillC:['#4E342E','#3E2723'],
    playerStart:{x:60,y:380},
    platforms:[
      {x:0,y:460,w:240,h:90},{x:300,y:440,w:160,h:110},{x:520,y:460,w:180,h:90},
      {x:760,y:430,w:200,h:120},{x:1020,y:460,w:280,h:90},{x:1360,y:440,w:220,h:110},
      {x:1640,y:460,w:350,h:90},
      {x:140,y:350,w:80,h:24},{x:380,y:310,w:80,h:24},{x:610,y:330,w:90,h:24},
      {x:870,y:300,w:80,h:24},{x:1130,y:330,w:100,h:24},{x:1460,y:310,w:80,h:24},
      {x:1750,y:340,w:100,h:24},
    ],
    stars:[{x:180,y:310},{x:410,y:270},{x:650,y:290},{x:910,y:260},{x:1170,y:290},{x:1500,y:270},{x:1790,y:300}],
    enemies:[{x:340,y:408,patrol:80,speed:100},{x:560,y:428,patrol:100,speed:110},{x:1060,y:428,patrol:140,speed:110},{x:1680,y:428,patrol:180,speed:120}],
    spikes:[{x:250,y:445,w:40},{x:470,y:445,w:35},{x:710,y:445,w:40},{x:970,y:445,w:35},{x:1310,y:445,w:40},{x:1580,y:445,w:35},{x:380,y:295,w:25},{x:870,y:285,w:25}],
    movingPlatforms:[],bouncePads:[],
    lavaPools:[{x:260,y:470,w:35},{x:710,y:470,w:40},{x:1310,y:470,w:45}],
    ceilings:[{x:80,y:180,w:600,h:18},{x:800,y:170,w:600,h:18},{x:1500,y:185,w:400,h:18}],
    flag:{x:1920,y:410},width:2070,
  },
  // ---- L5: Ocean Shore ----
  { name:'Ocean Shore',
    bgColor1:'#1E90FF',bgColor2:'#87CEFA',
    grassC:['#20B2AA','#2E8B8B','#1A7A7A'],dirtC:['#5F9EA0','#4E8D8F','#3D7C7E'],hillC:['#48D1CC','#40C4B7'],
    playerStart:{x:60,y:380},
    platforms:[
      {x:0,y:460,w:280,h:90},{x:350,y:450,w:140,h:100},{x:550,y:460,w:170,h:90},
      {x:780,y:440,w:190,h:110},{x:1030,y:460,w:240,h:90},{x:1330,y:450,w:170,h:100},
      {x:1560,y:460,w:280,h:90},{x:1900,y:440,w:320,h:110},
      {x:200,y:350,w:80,h:24},{x:440,y:310,w:70,h:24},{x:650,y:290,w:90,h:24},
      {x:880,y:310,w:80,h:24},{x:1130,y:290,w:90,h:24},{x:1420,y:310,w:80,h:24},
      {x:1670,y:290,w:90,h:24},{x:2010,y:320,w:100,h:24},
    ],
    stars:[{x:240,y:310},{x:470,y:270},{x:690,y:250},{x:920,y:270},{x:1170,y:250},{x:1450,y:270},{x:1710,y:250},{x:2050,y:280}],
    enemies:[{x:590,y:428,patrol:90,speed:90},{x:1070,y:428,patrol:130,speed:100},{x:1600,y:428,patrol:150,speed:95},{x:1940,y:408,patrol:170,speed:110}],
    spikes:[{x:310,y:445,w:35},{x:510,y:445,w:30},{x:730,y:445,w:35},{x:980,y:445,w:30},{x:1290,y:445,w:30},{x:1500,y:445,w:30},{x:1850,y:445,w:35},{x:440,y:295,w:20},{x:880,y:295,w:20}],
    movingPlatforms:[{x:320,y:380,w:70,h:22,moveX:0,moveY:50,speed:30},{x:1290,y:370,w:70,h:22,moveX:70,moveY:0,speed:35}],
    bouncePads:[{x:860,y:445,w:36}],lavaPools:[],
    ceilings:[{x:100,y:170,w:700,h:18},{x:900,y:165,w:700,h:18},{x:1700,y:175,w:500,h:18}],
    flag:{x:2150,y:390},width:2300,
  },
  // ---- L6: Sunset Valley ----
  { name:'Sunset Valley',
    bgColor1:'#FF6347',bgColor2:'#FF8C69',
    grassC:['#CD853F','#B8732A','#A06020'],dirtC:['#8B4513','#7A3A10','#6B300D'],hillC:['#D2691E','#B8621A'],
    playerStart:{x:60,y:380},
    platforms:[
      {x:0,y:460,w:260,h:90},{x:340,y:440,w:150,h:110},{x:550,y:460,w:180,h:90},
      {x:790,y:430,w:200,h:120},{x:1050,y:460,w:260,h:90},{x:1370,y:440,w:190,h:110},
      {x:1620,y:460,w:280,h:90},{x:1960,y:430,w:320,h:120},
      {x:170,y:350,w:80,h:24},{x:430,y:300,w:70,h:24},{x:650,y:280,w:90,h:24},
      {x:900,y:310,w:80,h:24},{x:1160,y:290,w:90,h:24},{x:1460,y:310,w:80,h:24},
      {x:1720,y:290,w:90,h:24},{x:2060,y:310,w:100,h:24},
    ],
    stars:[{x:210,y:310},{x:460,y:260},{x:690,y:240},{x:940,y:270},{x:1200,y:250},{x:1500,y:270},{x:1760,y:250},{x:2100,y:270}],
    enemies:[{x:300,y:408,patrol:80,speed:100},{x:590,y:428,patrol:110,speed:110},{x:1090,y:428,patrol:140,speed:105},{x:1660,y:428,patrol:150,speed:115},{x:2000,y:398,patrol:170,speed:110}],
    spikes:[{x:500,y:445,w:40},{x:740,y:445,w:35},{x:1000,y:445,w:40},{x:1320,y:445,w:35},{x:1560,y:445,w:35},{x:1910,y:445,w:40},{x:430,y:285,w:20},{x:650,y:265,w:25},{x:1160,y:275,w:20}],
    movingPlatforms:[{x:310,y:380,w:70,h:22,moveX:0,moveY:60,speed:35}],
    bouncePads:[{x:1000,y:445,w:36}],lavaPools:[],
    ceilings:[{x:100,y:165,w:700,h:18},{x:900,y:160,w:700,h:18},{x:1700,y:170,w:600,h:18}],
    flag:{x:2210,y:380},width:2360,
  },
  // ---- L7: Dark Forest ----
  { name:'Dark Forest',
    bgColor1:'#1B3A20',bgColor2:'#2D5A38',
    grassC:['#2E7D32','#1B5E20','#124116'],dirtC:['#3E2723','#33201A','#2A1812'],hillC:['#2E5930','#1B4520'],
    playerStart:{x:60,y:380},
    platforms:[
      {x:0,y:460,w:240,h:90},{x:300,y:450,w:140,h:100},{x:500,y:460,w:170,h:90},
      {x:730,y:440,w:180,h:110},{x:970,y:460,w:250,h:90},{x:1280,y:440,w:170,h:110},
      {x:1510,y:460,w:260,h:90},{x:1830,y:440,w:220,h:110},{x:2110,y:460,w:300,h:90},
      {x:150,y:350,w:70,h:24},{x:380,y:310,w:80,h:24},{x:600,y:280,w:80,h:24},
      {x:830,y:310,w:70,h:24},{x:1070,y:290,w:90,h:24},{x:1370,y:300,w:70,h:24},
      {x:1610,y:280,w:80,h:24},{x:1930,y:300,w:80,h:24},{x:2210,y:320,w:100,h:24},
    ],
    stars:[{x:190,y:310},{x:410,y:270},{x:640,y:240},{x:860,y:270},{x:1110,y:250},{x:1400,y:260},{x:1650,y:240},{x:1970,y:260},{x:2250,y:280}],
    enemies:[{x:260,y:418,patrol:70,speed:95},{x:540,y:428,patrol:90,speed:105},{x:1010,y:428,patrol:130,speed:110},{x:1550,y:428,patrol:140,speed:115},{x:1870,y:408,patrol:120,speed:120},{x:2150,y:428,patrol:160,speed:110}],
    spikes:[{x:450,y:445,w:35},{x:680,y:445,w:30},{x:920,y:445,w:35},{x:1230,y:445,w:30},{x:1460,y:445,w:30},{x:1780,y:445,w:35},{x:2060,y:445,w:30},{x:380,y:295,w:20},{x:600,y:265,w:20},{x:1070,y:275,w:25},{x:1610,y:265,w:20}],
    movingPlatforms:[{x:270,y:380,w:65,h:22,moveX:70,moveY:0,speed:40},{x:1480,y:370,w:65,h:22,moveX:0,moveY:55,speed:35}],
    bouncePads:[{x:810,y:445,w:34}],lavaPools:[],
    ceilings:[{x:80,y:165,w:600,h:18},{x:750,y:160,w:600,h:18},{x:1450,y:155,w:500,h:18},{x:2050,y:165,w:400,h:18}],
    flag:{x:2350,y:410},width:2500,
  },
  // ---- L8: Candy Kingdom ----
  { name:'Candy Kingdom',
    bgColor1:'#FF69B4',bgColor2:'#FFB6C1',
    grassC:['#FF1493','#C71585','#AA1177'],dirtC:['#BA55D3','#9B30FF','#8B008B'],hillC:['#FF82AB','#FF6EB4'],
    playerStart:{x:60,y:380},
    platforms:[
      {x:0,y:460,w:270,h:90},{x:340,y:440,w:160,h:110},{x:560,y:460,w:190,h:90},
      {x:810,y:430,w:190,h:120},{x:1060,y:460,w:270,h:90},{x:1390,y:440,w:200,h:110},
      {x:1650,y:460,w:260,h:90},{x:1970,y:430,w:310,h:120},
      {x:170,y:350,w:80,h:24},{x:430,y:310,w:80,h:24},{x:660,y:280,w:90,h:24},
      {x:910,y:310,w:70,h:24},{x:1170,y:290,w:90,h:24},{x:1480,y:310,w:80,h:24},
      {x:1750,y:280,w:80,h:24},{x:2070,y:310,w:100,h:24},
    ],
    stars:[{x:210,y:310},{x:460,y:270},{x:700,y:240},{x:940,y:270},{x:1210,y:250},{x:1520,y:270},{x:1790,y:240},{x:2110,y:270}],
    enemies:[{x:300,y:408,patrol:80,speed:90},{x:600,y:428,patrol:110,speed:100},{x:1100,y:428,patrol:140,speed:105},{x:1690,y:428,patrol:140,speed:110},{x:2010,y:398,patrol:160,speed:115}],
    spikes:[{x:500,y:445,w:35},{x:760,y:445,w:30},{x:1010,y:445,w:35},{x:1340,y:445,w:30},{x:1600,y:445,w:30},{x:1920,y:445,w:35},{x:430,y:295,w:20},{x:910,y:295,w:20},{x:1480,y:295,w:20}],
    movingPlatforms:[{x:800,y:370,w:70,h:22,moveX:55,moveY:0,speed:30}],
    bouncePads:[{x:320,y:445,w:36},{x:1350,y:445,w:36},{x:1880,y:445,w:36}],
    lavaPools:[],
    ceilings:[{x:100,y:165,w:700,h:18},{x:900,y:160,w:700,h:18},{x:1700,y:165,w:600,h:18}],
    flag:{x:2210,y:380},width:2360,
  },
  // ---- L9: Stormy Peaks ----
  { name:'Stormy Peaks',
    bgColor1:'#36454F',bgColor2:'#5F6B7A',
    grassC:['#708090','#5F6B75','#4E5A64'],dirtC:['#4A4A4A','#3D3D3D','#303030'],hillC:['#546E7A','#455A64'],
    playerStart:{x:60,y:380},
    platforms:[
      {x:0,y:460,w:220,h:90},{x:280,y:440,w:130,h:110},{x:470,y:460,w:160,h:90},
      {x:690,y:430,w:170,h:120},{x:920,y:460,w:230,h:90},{x:1210,y:440,w:160,h:110},
      {x:1430,y:460,w:220,h:90},{x:1710,y:430,w:200,h:120},{x:1970,y:460,w:260,h:90},
      {x:2290,y:440,w:250,h:110},
      {x:130,y:350,w:70,h:22},{x:360,y:310,w:60,h:22},{x:560,y:280,w:80,h:22},
      {x:790,y:310,w:70,h:22},{x:1020,y:290,w:80,h:22},{x:1300,y:310,w:70,h:22},
      {x:1530,y:280,w:80,h:22},{x:1810,y:300,w:70,h:22},{x:2070,y:280,w:80,h:22},
      {x:2390,y:310,w:90,h:22},
    ],
    stars:[{x:170,y:310},{x:390,y:270},{x:600,y:240},{x:830,y:270},{x:1060,y:250},{x:1340,y:270},{x:1570,y:240},{x:1850,y:260},{x:2110,y:240},{x:2430,y:270}],
    enemies:[{x:250,y:408,patrol:60,speed:105},{x:510,y:428,patrol:80,speed:115},{x:960,y:428,patrol:110,speed:120},{x:1470,y:428,patrol:110,speed:125},{x:1750,y:398,patrol:120,speed:120},{x:2010,y:428,patrol:130,speed:115},{x:2330,y:408,patrol:130,speed:125}],
    spikes:[{x:240,y:445,w:30},{x:430,y:445,w:25},{x:640,y:445,w:30},{x:870,y:445,w:30},{x:1160,y:445,w:25},{x:1390,y:445,w:25},{x:1660,y:445,w:30},{x:1920,y:445,w:30},{x:2240,y:445,w:30},{x:360,y:295,w:18},{x:790,y:295,w:18},{x:1300,y:295,w:18},{x:1810,y:285,w:18}],
    movingPlatforms:[{x:250,y:380,w:60,h:20,moveX:60,moveY:0,speed:45},{x:1180,y:370,w:60,h:20,moveX:0,moveY:60,speed:35},{x:2250,y:375,w:65,h:20,moveX:55,moveY:0,speed:40}],
    bouncePads:[{x:780,y:445,w:32}],lavaPools:[],
    ceilings:[{x:50,y:160,w:500,h:18},{x:600,y:155,w:500,h:18},{x:1200,y:150,w:500,h:18},{x:1800,y:155,w:500,h:18},{x:2200,y:165,w:400,h:18}],
    flag:{x:2480,y:390},width:2630,
  },
  // ---- L10: Cosmic Finale ----
  { name:'Cosmic Finale',
    bgColor1:'#0D0221',bgColor2:'#1A0533',
    grassC:['#7B1FA2','#6A1B9A','#4A148C'],dirtC:['#311B92','#270F86','#1A0A6B'],hillC:['#4A0E78','#3A0A60'],
    playerStart:{x:60,y:380},
    platforms:[
      {x:0,y:460,w:220,h:90},{x:290,y:440,w:140,h:110},{x:490,y:460,w:170,h:90},
      {x:720,y:430,w:180,h:120},{x:960,y:460,w:240,h:90},{x:1260,y:440,w:170,h:110},
      {x:1490,y:460,w:230,h:90},{x:1780,y:430,w:210,h:120},{x:2050,y:460,w:270,h:90},
      {x:2380,y:440,w:230,h:110},{x:2670,y:460,w:320,h:90},
      {x:130,y:350,w:70,h:22},{x:370,y:310,w:70,h:22},{x:590,y:280,w:80,h:22},
      {x:820,y:300,w:70,h:22},{x:1060,y:280,w:80,h:22},{x:1350,y:310,w:70,h:22},
      {x:1590,y:280,w:80,h:22},{x:1880,y:300,w:70,h:22},{x:2150,y:280,w:80,h:22},
      {x:2480,y:310,w:80,h:22},{x:2780,y:290,w:90,h:22},
    ],
    stars:[{x:170,y:310},{x:400,y:270},{x:630,y:240},{x:860,y:260},{x:1100,y:240},{x:1390,y:270},{x:1630,y:240},{x:1920,y:260},{x:2190,y:240},{x:2520,y:270},{x:2820,y:250}],
    enemies:[{x:250,y:408,patrol:70,speed:115},{x:530,y:428,patrol:90,speed:125},{x:1000,y:428,patrol:120,speed:125},{x:1530,y:428,patrol:120,speed:130},{x:1820,y:398,patrol:120,speed:130},{x:2090,y:428,patrol:140,speed:125},{x:2420,y:408,patrol:120,speed:135},{x:2710,y:428,patrol:160,speed:130}],
    spikes:[{x:250,y:445,w:30},{x:450,y:445,w:30},{x:670,y:445,w:35},{x:910,y:445,w:30},{x:1210,y:445,w:30},{x:1440,y:445,w:30},{x:1730,y:445,w:30},{x:2000,y:445,w:35},{x:2330,y:445,w:30},{x:2620,y:445,w:30},{x:370,y:295,w:18},{x:820,y:285,w:18},{x:1350,y:295,w:18},{x:1880,y:285,w:18},{x:2480,y:295,w:18}],
    movingPlatforms:[{x:260,y:380,w:60,h:20,moveX:60,moveY:0,speed:50},{x:1220,y:370,w:60,h:20,moveX:0,moveY:60,speed:40},{x:1730,y:375,w:65,h:20,moveX:60,moveY:0,speed:45},{x:2330,y:370,w:60,h:20,moveX:0,moveY:55,speed:38}],
    bouncePads:[{x:780,y:445,w:34},{x:1850,y:445,w:34},{x:2570,y:445,w:34}],
    lavaPools:[{x:670,y:470,w:40},{x:1440,y:470,w:45},{x:2320,y:470,w:40}],
    ceilings:[{x:50,y:155,w:500,h:18},{x:600,y:150,w:500,h:18},{x:1200,y:145,w:500,h:18},{x:1800,y:150,w:500,h:18},{x:2350,y:155,w:500,h:18}],
    flag:{x:2920,y:410},width:3070,
  },
];
// ---- INIT ----
function generateClouds() {
    clouds = [];
    for (let i = 0; i < 12; i++) clouds.push({ x: Math.random() * (levelWidth + 400), y: 30 + Math.random() * 140,
        w: 80 + Math.random() * 120, h: 30 + Math.random() * 30, speed: 8 + Math.random() * 15, opacity: 0.6 + Math.random() * 0.4 });
}
function initLevel(idx) {
    if (idx >= LEVELS.length) idx = 0;
    currentLevel = idx; const lvl = LEVELS[idx];
    player = createPlayer(lvl.playerStart.x, lvl.playerStart.y);
    platforms = lvl.platforms.map(p => ({ ...p }));
    starObjects = lvl.stars.map(s => ({ x: s.x, y: s.y, collected: false, radius: 14, bobOffset: Math.random() * Math.PI * 2 }));
    enemyObjects = lvl.enemies.map(e => ({ x: e.x, y: e.y, startX: e.x, patrol: e.patrol, speed: e.speed, dir: 1, w: 36, h: 32 }));
    spikeObjects = (lvl.spikes || []).map(s => ({ ...s }));
    movingPlatforms = (lvl.movingPlatforms || []).map(m => ({ ...m, startX: m.x, startY: m.y, dir: 1, dirY: 1 }));
    bouncePads = (lvl.bouncePads || []).map(b => ({ ...b, anim: 0 }));
    ceilings = (lvl.ceilings || []).map(c => ({ ...c }));
    gameOverActive = false; gameOverTime = 0;
    lavaPools = (lvl.lavaPools || []).map(l => ({ ...l, time: Math.random() * 6 }));
    flagObj = { x: lvl.flag.x, y: lvl.flag.y, waveTime: 0 };
    levelWidth = lvl.width; stars = 0; totalStars = starObjects.length;
    camX = 0; camY = 0; particles = []; generateClouds();
}

// ---- DRAWING ----
function drawSky() {
    const lvl = LEVELS[currentLevel];
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, lvl.bgColor1); grad.addColorStop(1, lvl.bgColor2);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
    if (currentLevel === 9 || currentLevel === 3) {
        ctx.fillStyle = '#fff';
        for (let i = 0; i < 60; i++) {
            const sx = (i * 137.5 + camX * 0.05) % W, sy = (i * 91.3) % (H * 0.7);
            const sz = 0.5 + Math.sin(gameTime * 2 + i) * 0.5;
            ctx.globalAlpha = 0.3 + sz * 0.5;
            ctx.beginPath(); ctx.arc(sx, sy, sz + 0.5, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
    }
}
function drawSun() {
    if (currentLevel === 3 || currentLevel === 6 || currentLevel === 8 || currentLevel === 9) return;
    const sx = W - 120, sy = 80;
    const glow = ctx.createRadialGradient(sx, sy, 20, sx, sy, 120);
    glow.addColorStop(0, 'rgba(255,255,200,0.8)'); glow.addColorStop(0.4, 'rgba(255,255,150,0.3)'); glow.addColorStop(1, 'rgba(255,255,150,0)');
    ctx.fillStyle = glow; ctx.fillRect(sx - 120, sy - 120, 240, 240);
    ctx.fillStyle = '#FFF176'; ctx.beginPath(); ctx.arc(sx, sy, 40, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFEE58'; ctx.beginPath(); ctx.arc(sx, sy, 34, 0, Math.PI * 2); ctx.fill();
}
function drawClouds(dt) {
    if (currentLevel === 9) return;
    clouds.forEach(c => {
        c.x -= c.speed * dt * 0.3;
        if (c.x + c.w < -camX * 0.2 - 200) c.x = -camX * 0.2 + W + 100;
        const cx = c.x + camX * 0.2;
        ctx.globalAlpha = c.opacity * (currentLevel === 3 || currentLevel === 6 ? 0.3 : currentLevel === 8 ? 0.5 : 1);
        ctx.fillStyle = currentLevel === 8 ? '#555' : '#fff';
        const r = c.h * 0.6;
        ctx.beginPath(); ctx.arc(cx + c.w * 0.3, c.y + c.h * 0.5, r, 0, Math.PI * 2);
        ctx.arc(cx + c.w * 0.55, c.y + c.h * 0.3, r * 1.2, 0, Math.PI * 2);
        ctx.arc(cx + c.w * 0.75, c.y + c.h * 0.5, r * 0.9, 0, Math.PI * 2);
        ctx.fill(); ctx.globalAlpha = 1;
    });
}
function drawHills() {
    const lvl = LEVELS[currentLevel], offset = camX * 0.15;
    ctx.fillStyle = lvl.hillC[0]; ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 5) ctx.lineTo(x, 380 + Math.sin((x + offset) * 0.006) * 40 + Math.sin((x + offset) * 0.015) * 15);
    ctx.lineTo(W, H); ctx.fill();
    const o2 = camX * 0.3;
    ctx.fillStyle = lvl.hillC[1]; ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 5) ctx.lineTo(x, 420 + Math.sin((x + o2) * 0.008) * 30 + Math.sin((x + o2) * 0.02) * 12);
    ctx.lineTo(W, H); ctx.fill();
}
function drawPlatform(p) {
    const lvl = LEVELS[currentLevel], px = p.x + camX, py = p.y + camY;
    if (px + p.w < -10 || px > W + 10) return;
    const dg = ctx.createLinearGradient(px, py + 16, px, py + p.h);
    dg.addColorStop(0, lvl.dirtC[0]); dg.addColorStop(0.5, lvl.dirtC[1]); dg.addColorStop(1, lvl.dirtC[2]);
    ctx.fillStyle = dg; ctx.fillRect(px, py + 14, p.w, p.h - 14);
    ctx.fillStyle = lvl.dirtC[2];
    for (let wx = p.x + 15; wx < p.x + p.w - 15; wx += 40 + Math.sin(wx) * 10) {
        const rx = wx + camX;
        const ry = py + 30 + Math.abs(Math.sin(wx * 0.7)) * Math.max(0, p.h - 50);
        ctx.beginPath(); ctx.ellipse(rx, ry, 6, 4, 0, 0, Math.PI * 2); ctx.fill();
    }
    const gg = ctx.createLinearGradient(px, py, px, py + 18);
    gg.addColorStop(0, lvl.grassC[0]); gg.addColorStop(0.5, lvl.grassC[1]); gg.addColorStop(1, lvl.grassC[2]);
    ctx.fillStyle = gg; ctx.beginPath();
    ctx.moveTo(px, py + 18); ctx.lineTo(px, py + 4);
    ctx.quadraticCurveTo(px, py, px + 4, py); ctx.lineTo(px + p.w - 4, py);
    ctx.quadraticCurveTo(px + p.w, py, px + p.w, py + 4); ctx.lineTo(px + p.w, py + 18); ctx.fill();
    ctx.strokeStyle = lvl.grassC[0]; ctx.lineWidth = 2;
    for (let wx = p.x + 8; wx < p.x + p.w - 5; wx += 14) {
        const gx = wx + camX;
        const gh = 6 + Math.sin(wx * 0.3 + gameTime * 2) * 3;
        ctx.beginPath(); ctx.moveTo(gx, py); ctx.lineTo(gx + Math.sin(gameTime * 3 + wx) * 2, py - gh); ctx.stroke();
    }
    ctx.lineWidth = 1; ctx.fillStyle = lvl.grassC[2]; ctx.fillRect(px, py + 15, p.w, 3);
}
function drawPlayer() {
    if (player.dead) return;
    const px = player.x + camX, py = player.y + camY, r = player.radius;
    ctx.save(); ctx.translate(px, py);
    // Rotate for the ball body
    ctx.rotate(player.rotation);
    const bg = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    bg.addColorStop(0, '#FF6B6B'); bg.addColorStop(0.6, '#E63946'); bg.addColorStop(1, '#B71C1C');
    ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath(); ctx.ellipse(-r * 0.25, -r * 0.3, r * 0.35, r * 0.2, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(-player.rotation);
    const bl = player.eyeBlink > 0;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(-6, -5, 7, bl ? 1 : 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(8, -5, 7, bl ? 1 : 8, 0, 0, Math.PI * 2); ctx.fill();
    if (!bl) {
        const lx = player.vx > 20 ? 2 : player.vx < -20 ? -2 : 0;
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(-6 + lx, -4, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(8 + lx, -4, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(-5 + lx, -6, 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(9 + lx, -6, 1.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = '#8B0000'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(1, 2, 6, 0.2, Math.PI - 0.2); ctx.stroke();
    ctx.restore();
}
function drawStar(s) {
    if (s.collected) return;
    const sx = s.x + camX, sy = s.y + camY + Math.sin(gameTime * 3 + s.bobOffset) * 5;
    if (sx < -30 || sx > W + 30) return;
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(gameTime * 1.5);
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, s.radius * 1.8);
    glow.addColorStop(0, 'rgba(255,215,0,0.4)'); glow.addColorStop(1, 'rgba(255,215,0,0)');
    ctx.fillStyle = glow; ctx.fillRect(-s.radius * 2, -s.radius * 2, s.radius * 4, s.radius * 4);
    ctx.fillStyle = '#FFD700'; ctx.strokeStyle = '#FFA000'; ctx.lineWidth = 1.5; ctx.beginPath();
    for (let i = 0; i < 5; i++) {
        const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
        const ox = Math.cos(a) * s.radius, oy = Math.sin(a) * s.radius;
        const ia = a + Math.PI / 5, ix = Math.cos(ia) * s.radius * 0.45, iy = Math.sin(ia) * s.radius * 0.45;
        if (i === 0) ctx.moveTo(ox, oy); else ctx.lineTo(ox, oy); ctx.lineTo(ix, iy);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
}
function drawEnemy(e) {
    const ex = e.x + camX, ey = e.y + camY;
    if (ex + e.w < -10 || ex > W + 10) return;
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.ellipse(ex + e.w / 2, ey + e.h + 3, e.w * 0.4, 4, 0, 0, Math.PI * 2); ctx.fill();
    const eg = ctx.createLinearGradient(ex, ey, ex, ey + e.h);
    eg.addColorStop(0, '#7B7B7B'); eg.addColorStop(1, '#4A4A4A');
    ctx.fillStyle = eg; ctx.beginPath(); ctx.roundRect(ex, ey, e.w, e.h, 4); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(ex + e.w * 0.35, ey + e.h * 0.35, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ex + e.w * 0.65, ey + e.h * 0.35, 5, 0, Math.PI * 2); ctx.fill();
    const ld = player.x < e.x + e.w / 2 ? -1 : 1;
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(ex + e.w * 0.35 + ld * 1.5, ey + e.h * 0.35 + 1, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ex + e.w * 0.65 + ld * 1.5, ey + e.h * 0.35 + 1, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#333'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(ex + e.w * 0.2, ey + e.h * 0.18); ctx.lineTo(ex + e.w * 0.42, ey + e.h * 0.25); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ex + e.w * 0.8, ey + e.h * 0.18); ctx.lineTo(ex + e.w * 0.58, ey + e.h * 0.25); ctx.stroke();
    ctx.lineWidth = 1;
}
function drawFlag() {
    const fx = flagObj.x + camX, fy = flagObj.y + camY;
    if (fx < -60 || fx > W + 60) return;
    ctx.fillStyle = '#FFD700'; ctx.fillRect(fx, fy - 60, 4, 60);
    ctx.beginPath(); ctx.arc(fx + 2, fy - 62, 5, 0, Math.PI * 2); ctx.fill();
    flagObj.waveTime += 0.05; const wave = Math.sin(flagObj.waveTime * 3) * 4;
    ctx.fillStyle = '#E63946'; ctx.beginPath(); ctx.moveTo(fx + 4, fy - 58);
    ctx.quadraticCurveTo(fx + 22, fy - 52 + wave, fx + 38, fy - 48 + wave * 0.5);
    ctx.lineTo(fx + 38, fy - 28 + wave * 0.5);
    ctx.quadraticCurveTo(fx + 22, fy - 32 + wave, fx + 4, fy - 34);
    ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#B71C1C'; ctx.lineWidth = 1; ctx.stroke();
}
function drawSpikes() {
    spikeObjects.forEach(s => {
        const sx = s.x + camX, sy = s.y + camY;
        if (sx + s.w < -10 || sx > W + 10) return;
        const count = Math.floor(s.w / 12);
        for (let i = 0; i < count; i++) {
            const bx = sx + i * 12;
            ctx.fillStyle = '#999'; ctx.strokeStyle = '#666'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(bx, sy + 15); ctx.lineTo(bx + 6, sy - 5); ctx.lineTo(bx + 12, sy + 15);
            ctx.closePath(); ctx.fill(); ctx.stroke();
        }
    });
}
function drawMovingPlatforms() { movingPlatforms.forEach(m => drawPlatform(m)); }

function drawBouncePads() {
    bouncePads.forEach(b => {
        const bx = b.x + camX, by = b.y + camY;
        if (bx + b.w < -10 || bx > W + 10) return;
        const sq = Math.max(0, 1 - b.anim * 2);
        ctx.fillStyle = '#4CAF50'; ctx.fillRect(bx + 4, by + 10, b.w - 8, 6);
        ctx.fillStyle = '#FF5722'; const sh = 10 * sq;
        ctx.beginPath(); ctx.moveTo(bx + 6, by + 10); ctx.lineTo(bx + b.w / 2, by + 10 - sh - 4);
        ctx.lineTo(bx + b.w - 6, by + 10); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#FF7043';
        ctx.beginPath(); ctx.arc(bx + b.w / 2, by + 10 - sh - 6, b.w / 3, Math.PI, 0); ctx.fill();
    });
}
function drawLavaPools() {
    lavaPools.forEach(l => {
        const lx = l.x + camX, ly = l.y + camY; if (lx + l.w < -10 || lx > W + 10) return;
        l.time += 0.03; ctx.fillStyle = '#FF4500'; ctx.fillRect(lx, ly - 5, l.w, 15);
        ctx.fillStyle = '#FF6600';
        for (let i = 0; i < 3; i++) { const bx = lx + 5 + i * (l.w / 3), by = ly - 5 - Math.abs(Math.sin(l.time * 3 + i * 2)) * 6;
            ctx.beginPath(); ctx.arc(bx, by, 4, 0, Math.PI * 2); ctx.fill(); }
        const glow = ctx.createRadialGradient(lx + l.w / 2, ly, 5, lx + l.w / 2, ly, l.w);
        glow.addColorStop(0, 'rgba(255,100,0,0.3)'); glow.addColorStop(1, 'rgba(255,100,0,0)');
        ctx.fillStyle = glow; ctx.fillRect(lx - l.w / 2, ly - l.w / 2, l.w * 2, l.w);
    });
}
function drawHeart(x, y, filled) {
    ctx.save(); ctx.translate(x, y); ctx.scale(0.9, 0.9); ctx.beginPath(); ctx.moveTo(0, 5);
    ctx.bezierCurveTo(-2, -2, -14, -6, -14, 4); ctx.bezierCurveTo(-14, 12, 0, 18, 0, 22);
    ctx.bezierCurveTo(0, 18, 14, 12, 14, 4); ctx.bezierCurveTo(14, -6, 2, -2, 0, 5); ctx.closePath();
    if (filled) { ctx.fillStyle = '#E63946'; ctx.fill(); ctx.strokeStyle = '#B71C1C'; }
    else { ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.3)'; }
    ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
}
function drawHUD() {
    // Row 1: Hearts + lives count (top-left)
    for (let i = 0; i < 3; i++) drawHeart(22 + i * 38, 28, i < lives);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 18px Outfit'; ctx.textAlign = 'left';
    ctx.fillText('x' + lives, 22 + 3 * 38 + 2, 34);

    // Row 2: Stars + Score (left side, below hearts — avoids pause/home buttons on right)
    ctx.fillStyle = '#FFD700'; ctx.font = 'bold 16px Outfit'; ctx.textAlign = 'left';
    ctx.fillText('\u2B50 ' + stars + '/' + totalStars, 24, 60);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 16px Outfit';
    ctx.fillText('Score: ' + score, 130, 60);
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.font = '13px Outfit';
    ctx.fillText('Best: ' + highScore, 130, 78);

    // Level name (centered, slightly lower to avoid button overlap)
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '14px Outfit'; ctx.textAlign = 'center';
    ctx.fillText(LEVELS[currentLevel].name + '  Lv ' + (currentLevel + 1) + '/10', W / 2, 18);
}
// ---- PARTICLES ----
function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) particles.push({ x, y, vx: (Math.random() - 0.5) * 200, vy: -(Math.random() * 200 + 50), life: 0.5 + Math.random() * 0.5, color, radius: 2 + Math.random() * 3 });
}
function updateParticles(dt) { particles = particles.filter(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 400 * dt; p.life -= dt; return p.life > 0; }); }
function drawParticles() { particles.forEach(p => { ctx.globalAlpha = p.life; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x + camX, p.y + camY, p.radius, 0, Math.PI * 2); ctx.fill(); }); ctx.globalAlpha = 1; }

function circleRectCollision(cx, cy, cr, rx, ry, rw, rh) {
    const closestX = Math.max(rx, Math.min(cx, rx + rw)), closestY = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - closestX, dy = cy - closestY;
    return (dx * dx + dy * dy) < (cr * cr);
}

function updateMovingPlatforms(dt) {
    movingPlatforms.forEach(m => {
        if (m.moveX > 0) { m.x += m.dir * m.speed * dt; if (Math.abs(m.x - m.startX) >= m.moveX) m.dir *= -1; }
        if (m.moveY > 0) { m.y += m.dirY * m.speed * dt; if (Math.abs(m.y - m.startY) >= m.moveY) m.dirY *= -1; }
    });
}
function updateBouncePads(dt) { bouncePads.forEach(b => { if (b.anim > 0) b.anim -= dt * 4; if (b.anim < 0) b.anim = 0; }); }

function updatePlayer(dt) {
    if (player.dead || player.won) return;
    if (keys['ArrowLeft'] || keys['a']) player.vx -= PLAYER_SPEED * 4 * dt;
    else if (keys['ArrowRight'] || keys['d']) player.vx += PLAYER_SPEED * 4 * dt;
    else player.vx *= FRICTION;
    player.vx = Math.max(-PLAYER_SPEED, Math.min(PLAYER_SPEED, player.vx));
    if ((keys['ArrowUp'] || keys['w'] || keys[' ']) && player.onGround) {
        player.vy = JUMP_VEL;
        player.onGround = false;
    }
    player.vy += GRAVITY * dt;
    player.x += player.vx * dt; player.y += player.vy * dt;
    player.rotation += (player.vx * dt) / player.radius;
    player.eyeBlink -= dt;
    if (player.eyeBlink <= -3 - Math.random() * 4) player.eyeBlink = 0.12;

    // Ceiling collisions - block jumping too high to skip sections
    ceilings.forEach(c => {
        if (circleRectCollision(player.x, player.y, player.radius, c.x, c.y, c.w, c.h)) {
            if (player.vy < 0) { player.y = c.y + c.h + player.radius; player.vy = 0; }
        }
    });

    const allPlats = platforms.concat(movingPlatforms);
    player.onGround = false;
    allPlats.forEach(p => {
        if (circleRectCollision(player.x, player.y, player.radius, p.x, p.y, p.w, p.h)) {
            const oL = (player.x + player.radius) - p.x, oR = (p.x + p.w) - (player.x - player.radius);
            const oT = (player.y + player.radius) - p.y, oB = (p.y + p.h) - (player.y - player.radius);
            const m = Math.min(oL, oR, oT, oB);
            if (m === oT && player.vy >= 0) { player.y = p.y - player.radius; player.vy = 0; player.onGround = true; }
            else if (m === oB && player.vy < 0) { player.y = p.y + p.h + player.radius; player.vy = 0; }
            else if (m === oL) { player.x = p.x - player.radius; player.vx = 0; }
            else if (m === oR) { player.x = p.x + p.w + player.radius; player.vx = 0; }
        }
    });

    starObjects.forEach(s => {
        if (!s.collected && Math.hypot(player.x - s.x, player.y - s.y) < player.radius + s.radius) {
            s.collected = true; stars++; score += 100; spawnParticles(s.x, s.y, '#FFD700', 10);
            soundManager.playStar();
            if (score > highScore) { highScore = score; localStorage.setItem('redBallHighScore', highScore); }
            localStorage.setItem('redBallScore', score);
        }
    });

    enemyObjects.forEach(e => {
        if (circleRectCollision(player.x, player.y, player.radius, e.x, e.y, e.w, e.h)) {
            if (player.vy > 0 && player.y < e.y) {
                player.vy = JUMP_VEL * 0.6;
                e.dead = true;
                score += 200;
                spawnParticles(e.x + e.w / 2, e.y + e.h / 2, '#888', 8);
                soundManager.playStomp();
            }
            else if (!e.dead) playerDie();
        }
    });

    spikeObjects.forEach(s => { if (circleRectCollision(player.x, player.y, player.radius, s.x, s.y - 5, s.w, 20)) playerDie(); });
    lavaPools.forEach(l => { if (circleRectCollision(player.x, player.y, player.radius, l.x, l.y - 8, l.w, 18)) playerDie(); });
    bouncePads.forEach(b => {
        if (circleRectCollision(player.x, player.y, player.radius, b.x, b.y - 2, b.w, 18) && player.vy > 0) {
            player.vy = JUMP_VEL * 1.3; player.onGround = false; b.anim = 1; spawnParticles(b.x + b.w / 2, b.y, '#FF5722', 5);
        }
    });

    if (flagObj && Math.hypot(player.x - flagObj.x, player.y - flagObj.y) < 40) {
        player.won = true; score += 500;
        soundManager.playWin();
        if (score > highScore) { highScore = score; localStorage.setItem('redBallHighScore', highScore); }
        localStorage.setItem('redBallScore', score); setTimeout(showLevelComplete, 800);
    }
    if (player.y > H + 100) playerDie();
    if (player.x < player.radius) { player.x = player.radius; player.vx = 0; }
}

function playerDie() {
    if (player.dead) return; player.dead = true; lives--;
    soundManager.playDeath();
    spawnParticles(player.x, player.y, '#E63946', 15);
    if (lives <= 0) setTimeout(showGameOver, 600);
    else setTimeout(function() { initLevel(currentLevel); }, 1000);
}
function updateEnemies(dt) {
    enemyObjects = enemyObjects.filter(function(e) { return !e.dead; });
    enemyObjects.forEach(function(e) { e.x += e.dir * e.speed * dt; if (Math.abs(e.x - e.startX) >= e.patrol) e.dir *= -1; });
}
function updateCamera() {
    const tx = -(player.x - W * 0.35), ty = -(player.y - H * 0.55);
    camX += (tx - camX) * 0.08; camY += (ty - camY) * 0.04;
    camX = Math.min(0, Math.max(-(levelWidth - W), camX)); camY = Math.min(0, camY);
}

function showLevelComplete() {
    document.getElementById('overlayTitle').textContent = 'Level Complete!';
    document.getElementById('overlayText').textContent = 'Stars: ' + stars + '/' + totalStars + '  |  Score: ' + score;
    document.getElementById('overlayBtn').textContent = currentLevel + 1 < LEVELS.length ? 'Next Level' : 'You Win! Play Again';
    document.getElementById('overlay').classList.add('show'); gameRunning = false;
    document.getElementById('overlayBtn').blur();
}

function showGameOver() {
    gameOverActive = true;
    gameOverTime = 0;
    
    // Update score displays on the pixel-art Game Over overlay
    const scoreValEl = document.getElementById('gameOverScoreVal');
    const bestValEl = document.getElementById('gameOverBestVal');
    if (scoreValEl) scoreValEl.textContent = score;
    if (bestValEl) bestValEl.textContent = highScore;
    
    // Show the pixel-art Game Over overlay
    const goOverlay = document.getElementById('gameOverOverlay');
    if (goOverlay) goOverlay.classList.add('show');
    
    // Keep gameRunning true so the animated background continues to render
    gameRunning = true;
}

function hideGameOverOverlay() {
    gameOverActive = false;
    const goOverlay = document.getElementById('gameOverOverlay');
    if (goOverlay) goOverlay.classList.remove('show');
}

// ---- GAME OVER RESTART & MENU HANDLERS ----
function restartFromGameOver() {
    hideGameOverOverlay();
    lives = 3;
    score = 0;
    currentLevel = 0;
    initLevel(0);
    gameRunning = true;
    gamePaused = false;
    document.getElementById('hudButtons').classList.add('active');
    lastFrameTime = performance.now();
    requestAnimationFrame(gameLoop);
}

// Button Listeners for Game Over Screen
const btnGoRestart = document.getElementById('btnGameOverRestart');
if (btnGoRestart) {
    btnGoRestart.addEventListener('click', function(e) {
        e.stopPropagation();
        restartFromGameOver();
    });
}

const btnGoMenu = document.getElementById('btnGameOverMenu');
if (btnGoMenu) {
    btnGoMenu.addEventListener('click', function(e) {
        e.stopPropagation();
        goToMainMenu();
    });
}

// Enter Key triggers restart when Game Over is active
window.addEventListener('keydown', function(e) {
    if (gameOverActive && e.key === 'Enter') {
        e.preventDefault();
        restartFromGameOver();
    }
});

document.getElementById('overlayBtn').addEventListener('click', function() {
    document.getElementById('overlay').classList.remove('show');
    if (lives <= 0) { lives = 3; score = 0; currentLevel = 0; }
    else if (currentLevel + 1 < LEVELS.length) currentLevel++;
    else { lives = 3; score = 0; currentLevel = 0; }
    initLevel(currentLevel); gameRunning = true; gamePaused = false;
    document.getElementById('hudButtons').classList.add('active');
    lastFrameTime = performance.now(); requestAnimationFrame(gameLoop);
});

let lastFrameTime = 0;
function gameLoop(timestamp) {
    if (!gameRunning) return;
    if (gamePaused) { lastFrameTime = timestamp; requestAnimationFrame(gameLoop); return; }
    let dt = (timestamp - lastFrameTime) / 1000; lastFrameTime = timestamp;
    if (dt > 0.05) dt = 0.05; gameTime += dt;

    if (gameOverActive) {
        gameOverTime += dt;
        // Keep drawing live animated game background behind semi-transparent overlay
        updateParticles(dt); updateMovingPlatforms(dt); updateBouncePads(dt);
        drawSky(); drawSun(); drawClouds(dt); drawHills();
        platforms.forEach(drawPlatform); drawMovingPlatforms();
        drawSpikes(); drawLavaPools(); drawBouncePads();
        starObjects.forEach(drawStar); enemyObjects.forEach(drawEnemy);
        drawFlag(); drawParticles(); drawHUD();
        requestAnimationFrame(gameLoop);
        return;
    }

    updatePlayer(dt); updateEnemies(dt); updateMovingPlatforms(dt);
    updateBouncePads(dt); updateCamera(); updateParticles(dt);
    drawSky(); drawSun(); drawClouds(dt); drawHills();
    platforms.forEach(drawPlatform); drawMovingPlatforms();
    drawSpikes(); drawLavaPools(); drawBouncePads();
    starObjects.forEach(drawStar); enemyObjects.forEach(drawEnemy);
    drawFlag(); drawPlayer(); drawParticles(); drawHUD();
    requestAnimationFrame(gameLoop);
}

// ---- PAUSE SYSTEM ----
function togglePause() {
    if (!gameRunning) return;
    // Don't allow pause when overlays or game over are showing
    if (document.getElementById('overlay').classList.contains('show')) return;
    if (gameOverActive) return;
    gamePaused = !gamePaused;
    const pauseOverlay = document.getElementById('pauseOverlay');
    if (gamePaused) {
        document.getElementById('pauseLevelInfo').textContent =
            LEVELS[currentLevel].name + ' (Lv ' + (currentLevel + 1) + '/10)  •  Score: ' + score;
        pauseOverlay.classList.add('show');
    } else {
        pauseOverlay.classList.remove('show');
        lastFrameTime = performance.now();
    }
}

// Mute button in HUD
const btnMute = document.getElementById('btnMute');
if (btnMute) {
    btnMute.addEventListener('click', function(e) {
        e.stopPropagation();
        soundManager.toggleMute();
    });
    btnMute.addEventListener('touchend', function(e) {
        e.preventDefault(); e.stopPropagation();
        soundManager.toggleMute();
    });
}

// Sound toggle button on Main Menu
const btnSoundMenu = document.getElementById('btnSoundMenu');
if (btnSoundMenu) {
    btnSoundMenu.addEventListener('click', function(e) {
        e.stopPropagation();
        soundManager.toggleMute();
    });
}

// Pause button
document.getElementById('btnPause').addEventListener('click', function(e) {
    e.stopPropagation();
    togglePause();
});
// Prevent touch events from propagating to game
document.getElementById('btnPause').addEventListener('touchend', function(e) {
    e.preventDefault(); e.stopPropagation();
    togglePause();
});

// Home button → go back to main menu
document.getElementById('btnHome').addEventListener('click', function(e) {
    e.stopPropagation();
    goToMainMenu();
});
document.getElementById('btnHome').addEventListener('touchend', function(e) {
    e.preventDefault(); e.stopPropagation();
    goToMainMenu();
});

// Resume
document.getElementById('btnResume').addEventListener('click', function() {
    gamePaused = false;
    document.getElementById('pauseOverlay').classList.remove('show');
    lastFrameTime = performance.now();
});

// Restart Level
document.getElementById('btnRestart').addEventListener('click', function() {
    gamePaused = false;
    document.getElementById('pauseOverlay').classList.remove('show');
    initLevel(currentLevel);
    lastFrameTime = performance.now();
});

// Main Menu from pause
document.getElementById('btnHomeMenu').addEventListener('click', function() {
    goToMainMenu();
});

function goToMainMenu() {
    hideGameOverOverlay();
    gamePaused = false; gameRunning = false; gameOverActive = false;
    document.getElementById('pauseOverlay').classList.remove('show');
    document.getElementById('overlay').classList.remove('show');
    document.getElementById('hudButtons').classList.remove('active');
    document.getElementById('mainMenu').classList.remove('hidden');
    // Reset game state
    lives = 3; score = 0; currentLevel = 0;
    startMenuAnimation();
}

// ============================================================
//  ANIMATED MAIN MENU BACKGROUND
// ============================================================
let menuAnimRunning = false;
let menuBall = { x: 200, y: 300, vx: 120, vy: 0, radius: 26, rotation: 0, eyeBlink: 0 };
let menuTime = 0;
let menuEnvIndex = 0;
let menuEnvTimer = 0;
let menuTransition = 0; // 0..1 interpolation between environments
let menuClouds = [];
let menuParticles = [];

const MENU_GRAVITY = 900;
const MENU_BOUNCE = -0.7;
const MENU_ENV_INTERVAL = 2.0; // seconds per environment
const MENU_TRANSITION_SPEED = 1.8; // how fast the blend happens

// Ground platforms for the menu ball to bounce on
const MENU_PLATFORMS = [
    { x: 0, y: 470, w: 300, h: 80 },
    { x: 350, y: 450, w: 180, h: 100 },
    { x: 580, y: 470, w: 320, h: 80 },
];

function initMenuClouds() {
    menuClouds = [];
    for (let i = 0; i < 8; i++) {
        menuClouds.push({
            x: Math.random() * W * 1.5,
            y: 25 + Math.random() * 120,
            w: 70 + Math.random() * 110,
            h: 25 + Math.random() * 25,
            speed: 10 + Math.random() * 18,
            opacity: 0.4 + Math.random() * 0.4
        });
    }
}

function lerpColor(a, b, t) {
    // Parse hex color and interpolate
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ra = (pa >> 16) & 0xFF, ga = (pa >> 8) & 0xFF, ba2 = pa & 0xFF;
    const rb = (pb >> 16) & 0xFF, gb = (pb >> 8) & 0xFF, bb = pb & 0xFF;
    const r = Math.round(ra + (rb - ra) * t);
    const g = Math.round(ga + (gb - ga) * t);
    const b2 = Math.round(ba2 + (bb - ba2) * t);
    return '#' + ((r << 16) | (g << 8) | b2).toString(16).padStart(6, '0');
}

function getMenuEnv(t) {
    // Smoothly interpolated environment between two levels
    const idxA = menuEnvIndex % LEVELS.length;
    const idxB = (menuEnvIndex + 1) % LEVELS.length;
    const a = LEVELS[idxA], b = LEVELS[idxB];
    return {
        bgColor1: lerpColor(a.bgColor1, b.bgColor1, t),
        bgColor2: lerpColor(a.bgColor2, b.bgColor2, t),
        grassC: a.grassC.map((c, i) => lerpColor(c, b.grassC[i], t)),
        dirtC: a.dirtC.map((c, i) => lerpColor(c, b.dirtC[i], t)),
        hillC: a.hillC.map((c, i) => lerpColor(c, b.hillC[i], t)),
        nameA: a.name,
        nameB: b.name,
    };
}

function drawMenuSky(env) {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, env.bgColor1);
    grad.addColorStop(1, env.bgColor2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
}

function drawMenuHills(env) {
    const offset = menuTime * 15;
    ctx.fillStyle = env.hillC[0];
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 5) {
        ctx.lineTo(x, 380 + Math.sin((x + offset) * 0.006) * 40 + Math.sin((x + offset) * 0.015) * 15);
    }
    ctx.lineTo(W, H); ctx.fill();

    const o2 = menuTime * 25;
    ctx.fillStyle = env.hillC[1];
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 5) {
        ctx.lineTo(x, 420 + Math.sin((x + o2) * 0.008) * 30 + Math.sin((x + o2) * 0.02) * 12);
    }
    ctx.lineTo(W, H); ctx.fill();
}

function drawMenuPlatform(p, env) {
    const px = p.x, py = p.y;
    // Dirt
    const dg = ctx.createLinearGradient(px, py + 16, px, py + p.h);
    dg.addColorStop(0, env.dirtC[0]); dg.addColorStop(0.5, env.dirtC[1]); dg.addColorStop(1, env.dirtC[2]);
    ctx.fillStyle = dg; ctx.fillRect(px, py + 14, p.w, p.h - 14);
    // Grass top
    const gg = ctx.createLinearGradient(px, py, px, py + 18);
    gg.addColorStop(0, env.grassC[0]); gg.addColorStop(0.5, env.grassC[1]); gg.addColorStop(1, env.grassC[2]);
    ctx.fillStyle = gg; ctx.beginPath();
    ctx.moveTo(px, py + 18); ctx.lineTo(px, py + 4);
    ctx.quadraticCurveTo(px, py, px + 4, py); ctx.lineTo(px + p.w - 4, py);
    ctx.quadraticCurveTo(px + p.w, py, px + p.w, py + 4); ctx.lineTo(px + p.w, py + 18); ctx.fill();
    // Grass blades
    ctx.strokeStyle = env.grassC[0]; ctx.lineWidth = 2;
    for (let wx = p.x + 8; wx < p.x + p.w - 5; wx += 14) {
        const gh = 6 + Math.sin(wx * 0.3 + menuTime * 2) * 3;
        ctx.beginPath(); ctx.moveTo(wx, py);
        ctx.lineTo(wx + Math.sin(menuTime * 3 + wx) * 2, py - gh); ctx.stroke();
    }
    ctx.lineWidth = 1;
    ctx.fillStyle = env.grassC[2]; ctx.fillRect(px, py + 15, p.w, 3);
}

function drawMenuClouds(dt) {
    menuClouds.forEach(c => {
        c.x -= c.speed * dt * 0.3;
        if (c.x + c.w < -100) c.x = W + 80;
        ctx.globalAlpha = c.opacity;
        ctx.fillStyle = '#fff';
        const r = c.h * 0.6;
        ctx.beginPath();
        ctx.arc(c.x + c.w * 0.3, c.y + c.h * 0.5, r, 0, Math.PI * 2);
        ctx.arc(c.x + c.w * 0.55, c.y + c.h * 0.3, r * 1.2, 0, Math.PI * 2);
        ctx.arc(c.x + c.w * 0.75, c.y + c.h * 0.5, r * 0.9, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    });
}

function drawMenuBall() {
    const b = menuBall;
    const px = b.x, py = b.y, r = b.radius;
    ctx.save(); ctx.translate(px, py);
    // Rotate for ball body
    ctx.rotate(b.rotation);
    // Ball body
    const bg = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    bg.addColorStop(0, '#FF6B6B'); bg.addColorStop(0.6, '#E63946'); bg.addColorStop(1, '#B71C1C');
    ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    // Shine
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath(); ctx.ellipse(-r * 0.25, -r * 0.3, r * 0.35, r * 0.2, -0.5, 0, Math.PI * 2); ctx.fill();
    // Eyes (un-rotate for eyes)
    ctx.rotate(-b.rotation);
    const bl = b.eyeBlink > 0;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(-7, -6, 8, bl ? 1 : 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(9, -6, 8, bl ? 1 : 9, 0, 0, Math.PI * 2); ctx.fill();
    if (!bl) {
        const lx = b.vx > 20 ? 2 : b.vx < -20 ? -2 : 0;
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(-7 + lx, -5, 4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(9 + lx, -5, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(-6 + lx, -7, 1.8, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(10 + lx, -7, 1.8, 0, Math.PI * 2); ctx.fill();
    }
    // Smile
    ctx.strokeStyle = '#8B0000'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(1, 2, 7, 0.2, Math.PI - 0.2); ctx.stroke();
    ctx.restore();
}

function spawnMenuParticle(x, y) {
    for (let i = 0; i < 4; i++) {
        menuParticles.push({
            x, y,
            vx: (Math.random() - 0.5) * 100,
            vy: -(Math.random() * 120 + 30),
            life: 0.4 + Math.random() * 0.3,
            color: ['#FFD700', '#FF6B6B', '#4CAF50', '#64B5F6'][Math.floor(Math.random() * 4)],
            radius: 2 + Math.random() * 3
        });
    }
}

function updateMenuParticles(dt) {
    menuParticles = menuParticles.filter(p => {
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vy += 300 * dt; p.life -= dt;
        return p.life > 0;
    });
}

function drawMenuParticles() {
    menuParticles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
}

function drawMenuEnvName(env) {
    // Show current environment name at bottom
    const name = menuTransition < 0.5 ? env.nameA : env.nameB;
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px Outfit';
    ctx.textAlign = 'center';
    ctx.fillText(name, W / 2, H - 16);
    ctx.restore();
}

let menuLastFrame = 0;
function menuAnimationLoop(timestamp) {
    if (!menuAnimRunning) return;
    let dt = (timestamp - menuLastFrame) / 1000;
    menuLastFrame = timestamp;
    if (dt > 0.05) dt = 0.05;
    menuTime += dt;

    // ---- Cycle environment ----
    menuEnvTimer += dt;
    if (menuEnvTimer >= MENU_ENV_INTERVAL) {
        menuEnvTimer = 0;
        menuEnvIndex = (menuEnvIndex + 1) % LEVELS.length;
        menuTransition = 0;
    }
    menuTransition = Math.min(1, menuEnvTimer / (MENU_ENV_INTERVAL * 0.5));
    // Ease the transition (smooth step)
    const t = menuTransition < 1 ? menuTransition * menuTransition * (3 - 2 * menuTransition) : 1;
    const env = getMenuEnv(t > 1 ? 1 : t);

    // ---- Update menu ball physics ----
    const b = menuBall;
    b.vy += MENU_GRAVITY * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.rotation += (b.vx * dt) / b.radius;
    b.eyeBlink -= dt;
    if (b.eyeBlink <= -2 - Math.random() * 3) b.eyeBlink = 0.1;

    // Bounce off walls
    if (b.x - b.radius < 0) { b.x = b.radius; b.vx = Math.abs(b.vx); }
    if (b.x + b.radius > W) { b.x = W - b.radius; b.vx = -Math.abs(b.vx); }

    // Bounce off platforms
    let onPlatform = false;
    MENU_PLATFORMS.forEach(p => {
        if (b.x + b.radius > p.x && b.x - b.radius < p.x + p.w) {
            if (b.y + b.radius > p.y && b.y + b.radius < p.y + 20 && b.vy > 0) {
                b.y = p.y - b.radius;
                b.vy *= MENU_BOUNCE;
                if (Math.abs(b.vy) < 50) b.vy = -250; // Keep it bouncing
                onPlatform = true;
                spawnMenuParticle(b.x, p.y);
            }
        }
    });

    // Fall off bottom → reset
    if (b.y > H + 50) {
        b.x = 100 + Math.random() * (W - 200);
        b.y = 100;
        b.vy = 0;
        b.vx = (Math.random() > 0.5 ? 1 : -1) * (80 + Math.random() * 100);
    }

    // Slight random horizontal push for variety
    if (Math.random() < 0.005) {
        b.vx += (Math.random() - 0.5) * 80;
    }

    updateMenuParticles(dt);

    // ---- Draw everything ----
    drawMenuSky(env);

    // Stars/sparkles in dark themes
    const darkness = parseInt(env.bgColor1.slice(1, 3), 16);
    if (darkness < 80) {
        ctx.fillStyle = '#fff';
        for (let i = 0; i < 40; i++) {
            const sx = (i * 137.5 + menuTime * 3) % W;
            const sy = (i * 91.3) % (H * 0.65);
            const sz = 0.5 + Math.sin(menuTime * 2 + i) * 0.5;
            ctx.globalAlpha = 0.2 + sz * 0.4;
            ctx.beginPath(); ctx.arc(sx, sy, sz + 0.5, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    // Sun for bright themes
    if (darkness >= 80) {
        const sx = W - 100, sy = 70;
        const glow = ctx.createRadialGradient(sx, sy, 15, sx, sy, 100);
        glow.addColorStop(0, 'rgba(255,255,200,0.6)'); glow.addColorStop(0.4, 'rgba(255,255,150,0.2)'); glow.addColorStop(1, 'rgba(255,255,150,0)');
        ctx.fillStyle = glow; ctx.fillRect(sx - 100, sy - 100, 200, 200);
        ctx.fillStyle = '#FFF176'; ctx.beginPath(); ctx.arc(sx, sy, 30, 0, Math.PI * 2); ctx.fill();
    }

    drawMenuClouds(dt);
    drawMenuHills(env);
    MENU_PLATFORMS.forEach(p => drawMenuPlatform(p, env));
    drawMenuParticles();
    drawMenuBall();
    drawMenuEnvName(env);

    requestAnimationFrame(menuAnimationLoop);
}

function startMenuAnimation() {
    if (menuAnimRunning) return;
    menuAnimRunning = true;
    soundManager.startMenuBGM();
    menuBall = { x: 200, y: 300, vx: 120, vy: 0, radius: 26, rotation: 0, eyeBlink: 0 };
    menuTime = 0; menuEnvTimer = 0; menuEnvIndex = 0; menuTransition = 0;
    menuParticles = [];
    initMenuClouds();
    menuLastFrame = performance.now();
    requestAnimationFrame(menuAnimationLoop);
}

function stopMenuAnimation() {
    menuAnimRunning = false;
    soundManager.stopMenuBGM();
}

// Start menu animation on page load
startMenuAnimation();

document.getElementById('playBtn').addEventListener('click', function() {
    soundManager.init();
    hideGameOverOverlay();
    stopMenuAnimation();
    document.getElementById('mainMenu').classList.add('hidden');
    lives = 3; score = 0; currentLevel = 0; initLevel(0);
    gameRunning = true; gamePaused = false;
    document.getElementById('hudButtons').classList.add('active');
    lastFrameTime = performance.now(); requestAnimationFrame(gameLoop);
});