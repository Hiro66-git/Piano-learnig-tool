/* ============================================
   PIANO MASTER PRO - COMPLETE APPLICATION
   ============================================ */

// ============================================
// AUDIO CONTEXT & SOUND ENGINE
// ============================================
class AudioEngine {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.pianoSamples = {};
        this.soundType = 'grand';
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized) return;
        
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.audioContext.createGain();
        this.masterGain.connect(this.audioContext.destination);
        this.masterGain.gain.value = 0.8;
        
        await this.loadSamples();
        this.isInitialized = true;
    }

    async loadSamples() {
        // Generate piano samples using oscillators
        // In production, you'd load actual piano samples
        console.log('Audio engine initialized with synthesized sounds');
    }

    setVolume(value) {
        if (this.masterGain) {
            this.masterGain.gain.value = value / 100;
        }
    }

    playNote(note, velocity = 0.8, duration = 0.5) {
        if (!this.audioContext) return;

        const frequency = this.noteToFrequency(note);
        if (!frequency) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        const now = this.audioContext.currentTime;

        // Create rich piano-like sound with multiple oscillators
        const oscillators = [];
        
        // Fundamental
        const osc1 = this.audioContext.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.value = frequency;
        oscillators.push(osc1);

        // First harmonic
        const osc2 = this.audioContext.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.value = frequency * 2;
        oscillators.push(osc2);

        // Second harmonic
        const osc3 = this.audioContext.createOscillator();
        osc3.type = 'triangle';
        osc3.frequency.value = frequency * 3;
        oscillators.push(osc3);

        // Mix oscillators
        const merger = this.audioContext.createGain();
        merger.gain.value = 0.3;

        oscillators.forEach((osc, i) => {
            const oscGain = this.audioContext.createGain();
            oscGain.gain.value = 1 / (i + 1); // Decreasing harmonics
            osc.connect(oscGain);
            oscGain.connect(merger);
        });

        merger.connect(gainNode);
        gainNode.connect(this.masterGain);

        // ADSR envelope
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(velocity, now + 0.01); // Attack
        gainNode.gain.exponentialRampToValueAtTime(velocity * 0.7, now + 0.1); // Decay
        gainNode.gain.setValueAtTime(velocity * 0.7, now + 0.1); // Sustain
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration + 0.5); // Release

        oscillators.forEach(osc => {
            osc.start(now);
            osc.stop(now + duration + 0.6);
        });

        return { oscillators, gainNode };
    }

    noteToFrequency(note) {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const match = note.match(/^([A-G]#?)(\d+)$/);
        if (!match) return null;

        const noteName = match[1];
        const octave = parseInt(match[2]);
        const noteIndex = notes.indexOf(noteName);
        if (noteIndex === -1) return null;

        const midiNote = (octave + 1) * 12 + noteIndex;
        return 440 * Math.pow(2, (midiNote - 69) / 12);
    }

    playMetronomeClick(accent = false) {
        if (!this.audioContext) return;

        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        const now = this.audioContext.currentTime;

        osc.frequency.value = accent ? 1000 : 800;
        osc.type = 'sine';

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.1);
    }
}

// ============================================
// MIDI HANDLER
// ============================================
class MIDIHandler {
    constructor(onNoteOn, onNoteOff) {
        this.midiAccess = null;
        this.inputs = [];
        this.onNoteOn = onNoteOn;
        this.onNoteOff = onNoteOff;
    }

    async init() {
        if (!navigator.requestMIDIAccess) {
            console.log('WebMIDI not supported');
            return false;
        }

        try {
            this.midiAccess = await navigator.requestMIDIAccess();
            this.updateInputs();
            this.midiAccess.onstatechange = () => this.updateInputs();
            return true;
        } catch (error) {
            console.error('MIDI access denied:', error);
            return false;
        }
    }

    updateInputs() {
        this.inputs = [];
        const inputSelect = document.getElementById('midi-input');
        if (inputSelect) {
            inputSelect.innerHTML = '<option value="">Select MIDI device</option>';
        }

        if (this.midiAccess) {
            this.midiAccess.inputs.forEach((input, id) => {
                this.inputs.push({ id, name: input.name });
                if (inputSelect) {
                    const option = document.createElement('option');
                    option.value = id;
                    option.textContent = input.name;
                    inputSelect.appendChild(option);
                }

                input.onmidimessage = (event) => this.handleMIDIMessage(event);
            });
        }

        if (this.inputs.length === 0 && inputSelect) {
            inputSelect.innerHTML = '<option value="">No MIDI device detected</option>';
        }
    }

    handleMIDIMessage(event) {
        const [status, note, velocity] = event.data;
        const command = status >> 4;
        const channel = status & 0xf;

        if (command === 9 && velocity > 0) { // Note On
            this.onNoteOn(note, velocity / 127);
        } else if (command === 8 || (command === 9 && velocity === 0)) { // Note Off
            this.onNoteOff(note);
        }
    }

    midiToNoteName(midiNote) {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(midiNote / 12) - 1;
        const noteName = notes[midiNote % 12];
        return `${noteName}${octave}`;
    }
}

// ============================================
// METRONOME
// ============================================
class Metronome {
    constructor(audioEngine) {
        this.audioEngine = audioEngine;
        this.tempo = 120;
        this.isPlaying = false;
        this.intervalId = null;
        this.beatCount = 0;
        this.beatsPerMeasure = 4;
    }

    start() {
        if (this.isPlaying) return;
        
        this.isPlaying = true;
        this.beatCount = 0;
        const interval = (60 / this.tempo) * 1000;

        this.tick();
        this.intervalId = setInterval(() => this.tick(), interval);
    }

    stop() {
        this.isPlaying = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    tick() {
        const accent = this.beatCount % this.beatsPerMeasure === 0;
        this.audioEngine.playMetronomeClick(accent);
        
        // Animate metronome arm
        const arm = document.getElementById('metronome-arm');
        if (arm) {
            const angle = this.beatCount % 2 === 0 ? 30 : -30;
            arm.style.transform = `translateX(-50%) rotate(${angle}deg)`;
        }

        this.beatCount++;
    }

    setTempo(tempo) {
        this.tempo = Math.max(40, Math.min(200, tempo));
        document.getElementById('tempo-display').textContent = `${this.tempo} BPM`;
        
        if (this.isPlaying) {
            this.stop();
            this.start();
        }
    }
}

// ============================================
// RECORDER
// ============================================
class Recorder {
    constructor() {
        this.isRecording = false;
        this.startTime = 0;
        this.recordedNotes = [];
    }

    start() {
        this.isRecording = true;
        this.startTime = Date.now();
        this.recordedNotes = [];
    }

    stop() {
        this.isRecording = false;
        return this.recordedNotes;
    }

    recordNote(note, velocity) {
        if (!this.isRecording) return;
        
        this.recordedNotes.push({
            note,
            velocity,
            time: Date.now() - this.startTime
        });
    }

    getRecording() {
        return this.recordedNotes;
    }
}

// ============================================
// DATA MANAGER (LocalStorage)
// ============================================
class DataManager {
    constructor() {
        this.storageKey = 'piano_master_pro_data';
    }

    getData() {
        const data = localStorage.getItem(this.storageKey);
        return data ? JSON.parse(data) : this.getDefaultData();
    }

    saveData(data) {
        localStorage.setItem(this.storageKey, JSON.stringify(data));
    }

    getDefaultData() {
        return {
            user: {
                name: 'Pianist',
                level: 'beginner',
                xp: 0,
                streak: 0,
                lastPractice: null
            },
            settings: {
                volume: 80,
                sound: 'grand',
                tempo: 120,
                darkMode: true,
                showLabels: true,
                showShortcuts: true,
                fallingNotes: true,
                animations: true
            },
            progress: {
                lessonsCompleted: [],
                songsLearned: [],
                totalPracticeTime: 0,
                averageAccuracy: 0
            },
            achievements: [],
            recentActivity: []
        };
    }

    updateUser(userData) {
        const data = this.getData();
        data.user = { ...data.user, ...userData };
        this.saveData(data);
    }

    updateSettings(settings) {
        const data = this.getData();
        data.settings = { ...data.settings, ...settings };
        this.saveData(data);
    }

    updateProgress(progress) {
        const data = this.getData();
        data.progress = { ...data.progress, ...progress };
        this.saveData(data);
    }

    addActivity(activity) {
        const data = this.getData();
        data.recentActivity.unshift({
            ...activity,
            timestamp: Date.now()
        });
        data.recentActivity = data.recentActivity.slice(0, 20);
        this.saveData(data);
    }

    unlockAchievement(achievementId) {
        const data = this.getData();
        if (!data.achievements.includes(achievementId)) {
            data.achievements.push(achievementId);
            this.saveData(data);
            return true;
        }
        return false;
    }

    resetProgress() {
        localStorage.removeItem(this.storageKey);
    }

    exportData() {
        return JSON.stringify(this.getData(), null, 2);
    }

    importData(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            this.saveData(data);
            return true;
        } catch (e) {
            return false;
        }
    }
}

// ============================================
// LESSONS DATA
// ============================================
const LESSONS_DATA = [
    {
        id: 1,
        title: 'Introduction to Piano',
        description: 'Learn the basics of piano, hand position, and posture.',
        difficulty: 'beginner',
        category: 'theory',
        duration: 10,
        icon: '🎹',
        objectives: [
            'Understand piano key layout',
            'Learn proper hand position',
            'Practice correct posture'
        ],
        content: {
            type: 'introduction',
            notes: []
        }
    },
    {
        id: 2,
        title: 'Finding Middle C',
        description: 'Locate and play Middle C - the center of the piano.',
        difficulty: 'beginner',
        category: 'technique',
        duration: 8,
        icon: '🔍',
        objectives: [
            'Find Middle C on the keyboard',
            'Play Middle C with correct finger',
            'Understand note naming'
        ],
        content: {
            type: 'note_practice',
            notes: ['C4']
        }
    },
    {
        id: 3,
        title: 'C Major Scale',
        description: 'Learn and practice the C Major scale with both hands.',
        difficulty: 'beginner',
        category: 'scales',
        duration: 15,
        icon: '🎵',
        objectives: [
            'Play C Major scale ascending',
            'Play C Major scale descending',
            'Use correct fingering'
        ],
        content: {
            type: 'scale',
            notes: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5']
        }
    },
    {
        id: 4,
        title: 'Basic Chords',
        description: 'Introduction to major and minor chords.',
        difficulty: 'beginner',
        category: 'chords',
        duration: 20,
        icon: '🎶',
        objectives: [
            'Understand chord structure',
            'Play C Major chord',
            'Play A Minor chord'
        ],
        content: {
            type: 'chord',
            chords: [
                { name: 'C Major', notes: ['C4', 'E4', 'G4'] },
                { name: 'A Minor', notes: ['A3', 'C4', 'E4'] }
            ]
        }
    },
    {
        id: 5,
        title: 'Reading Sheet Music',
        description: 'Learn to read basic sheet music notation.',
        difficulty: 'beginner',
        category: 'theory',
        duration: 25,
        icon: '📖',
        objectives: [
            'Identify notes on the treble clef',
            'Understand note values',
            'Read simple melodies'
        ],
        content: {
            type: 'theory',
            notes: []
        }
    },
    {
        id: 6,
        title: 'G Major Scale',
        description: 'Master the G Major scale with sharps.',
        difficulty: 'intermediate',
        category: 'scales',
        duration: 15,
        icon: '🎵',
        objectives: [
            'Understand sharps and flats',
            'Play G Major scale correctly',
            'Practice with metronome'
        ],
        content: {
            type: 'scale',
            notes: ['G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F#4', 'G4']
        }
    },
    {
        id: 7,
        title: 'Chord Progressions',
        description: 'Learn common chord progressions in popular music.',
        difficulty: 'intermediate',
        category: 'chords',
        duration: 30,
        icon: '🎸',
        objectives: [
            'Play I-IV-V-I progression',
            'Play I-V-vi-IV progression',
            'Smooth chord transitions'
        ],
        content: {
            type: 'progression',
            chords: ['C', 'G', 'Am', 'F']
        }
    },
    {
        id: 8,
        title: 'Arpeggios',
        description: 'Learn to play broken chords and arpeggios.',
        difficulty: 'intermediate',
        category: 'technique',
        duration: 20,
        icon: '🌊',
        objectives: [
            'Understand arpeggio patterns',
            'Play C Major arpeggio',
            'Play with proper fingering'
        ],
        content: {
            type: 'arpeggio',
            notes: ['C4', 'E4', 'G4', 'C5', 'G4', 'E4', 'C4']
        }
    },
    {
        id: 9,
        title: 'Dynamics & Expression',
        description: 'Add emotion to your playing with dynamics.',
        difficulty: 'intermediate',
        category: 'technique',
        duration: 25,
        icon: '🎭',
        objectives: [
            'Understand piano and forte',
            'Practice crescendo and diminuendo',
            'Express emotion through dynamics'
        ],
        content: {
            type: 'dynamics',
            notes: []
        }
    },
    {
        id: 10,
        title: 'Advanced Scales',
        description: 'Master all major and minor scales.',
        difficulty: 'advanced',
        category: 'scales',
        duration: 45,
        icon: '🏆',
        objectives: [
            'Play all 12 major scales',
            'Play harmonic minor scales',
            'Increase speed and accuracy'
        ],
        content: {
            type: 'scale',
            notes: []
        }
    }
];

// ============================================
// SONGS DATA
// ============================================
const SONGS_DATA = [
    {
        id: 1,
        title: 'Twinkle Twinkle Little Star',
        artist: 'Traditional',
        category: 'kids',
        difficulty: 'beginner',
        duration: '1:30',
        icon: '⭐',
        notes: ['C4', 'C4', 'G4', 'G4', 'A4', 'A4', 'G4', 'F4', 'F4', 'E4', 'E4', 'D4', 'D4', 'C4']
    },
    {
        id: 2,
        title: 'Mary Had a Little Lamb',
        artist: 'Traditional',
        category: 'kids',
        difficulty: 'beginner',
        duration: '1:00',
        icon: '🐑',
        notes: ['E4', 'D4', 'C4', 'D4', 'E4', 'E4', 'E4', 'D4', 'D4', 'D4', 'E4', 'G4', 'G4']
    },
    {
        id: 3,
        title: 'Für Elise',
        artist: 'Beethoven',
        category: 'classical',
        difficulty: 'intermediate',
        duration: '3:00',
        icon: '🎼',
        notes: ['E5', 'D#5', 'E5', 'D#5', 'E5', 'B4', 'D5', 'C5', 'A4']
    },
    {
        id: 4,
        title: 'Clair de Lune',
        artist: 'Debussy',
        category: 'classical',
        difficulty: 'advanced',
        duration: '5:00',
        icon: '🌙',
        notes: []
    },
    {
        id: 5,
        title: 'River Flows in You',
        artist: 'Yiruma',
        category: 'pop',
        difficulty: 'intermediate',
        duration: '3:30',
        icon: '🌊',
        notes: []
    },
    {
        id: 6,
        title: 'Canon in D',
        artist: 'Pachelbel',
        category: 'classical',
        difficulty: 'intermediate',
        duration: '4:00',
        icon: '🎻',
        notes: []
    },
    {
        id: 7,
        title: 'All of Me',
        artist: 'John Legend',
        category: 'pop',
        difficulty: 'intermediate',
        duration: '4:30',
        icon: '❤️',
        notes: []
    },
    {
        id: 8,
        title: 'Autumn Leaves',
        artist: 'Jazz Standard',
        category: 'jazz',
        difficulty: 'intermediate',
        duration: '3:00',
        icon: '🍂',
        notes: []
    },
    {
        id: 9,
        title: 'Take Five',
        artist: 'Dave Brubeck',
        category: 'jazz',
        difficulty: 'advanced',
        duration: '5:00',
        icon: '🎷',
        notes: []
    },
    {
        id: 10,
        title: 'Happy Birthday',
        artist: 'Traditional',
        category: 'kids',
        difficulty: 'beginner',
        duration: '0:45',
        icon: '🎂',
        notes: ['C4', 'C4', 'D4', 'C4', 'F4', 'E4', 'C4', 'C4', 'D4', 'C4', 'G4', 'F4']
    }
];

// ============================================
// ACHIEVEMENTS DATA
// ============================================
const ACHIEVEMENTS_DATA = [
    { id: 'first_note', icon: '🎵', title: 'First Note', description: 'Play your first note' },
    { id: 'practice_1h', icon: '⏰', title: 'Dedicated', description: 'Practice for 1 hour total' },
    { id: 'streak_7', icon: '🔥', title: 'On Fire', description: 'Maintain a 7-day streak' },
    { id: 'lesson_5', icon: '📚', title: 'Quick Learner', description: 'Complete 5 lessons' },
    { id: 'song_1', icon: '🎶', title: 'First Song', description: 'Learn your first song' },
    { id: 'accuracy_90', icon: '🎯', title: 'Sharp Shooter', description: 'Achieve 90% accuracy' },
    { id: 'scale_master', icon: '🏅', title: 'Scale Master', description: 'Learn all major scales' },
    { id: 'chord_king', icon: '👑', title: 'Chord King', description: 'Master all basic chords' }
];

// ============================================
// MAIN APPLICATION
// ============================================
const PianoApp = {
    audioEngine: null,
    midiHandler: null,
    metronome: null,
    recorder: null,
    dataManager: null,
    
    currentOctave: 4,
    activeKeys: new Set(),
    currentLesson: null,
    currentPage: 'dashboard',
    
    // Keyboard mapping
    keyMap: {
        'a': 'C', 'w': 'C#', 's': 'D', 'e': 'D#', 'd': 'E',
        'f': 'F', 't': 'F#', 'g': 'G', 'y': 'G#', 'h': 'A',
        'u': 'A#', 'j': 'B', 'k': 'C5'
    },

    async init() {
        console.log('Initializing Piano Master Pro...');
        
        // Initialize components
        this.audioEngine = new AudioEngine();
        this.dataManager = new DataManager();
        this.recorder = new Recorder();
        
        // Initialize audio on first interaction
        document.addEventListener('click', async () => {
            if (!this.audioEngine.isInitialized) {
                await this.audioEngine.init();
                this.metronome = new Metronome(this.audioEngine);
            }
        }, { once: true });
        
        // Initialize MIDI
        this.midiHandler = new MIDIHandler(
            (note, velocity) => this.handleMIDINoteOn(note, velocity),
            (note) => this.handleMIDINoteOff(note)
        );
        await this.midiHandler.init();
        
        // Build UI
        this.buildKeyboard();
        this.loadLessons();
        this.loadSongs();
        this.loadAchievements();
        this.loadSettings();
        this.loadDashboard();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Hide loading screen
        setTimeout(() => {
            document.getElementById('loading-screen').classList.add('hidden');
            document.getElementById('app').classList.remove('hidden');
        }, 1500);
        
        // Show keyboard shortcuts on first visit
        const data = this.dataManager.getData();
        if (data.progress.totalPracticeTime === 0) {
            setTimeout(() => {
                document.getElementById('shortcut-overlay').classList.add('active');
            }, 2000);
        }
        
        console.log('Piano Master Pro initialized!');
    },

    buildKeyboard() {
        const keyboard = document.getElementById('keyboard');
        keyboard.innerHTML = '';
        
        const notes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
        const blackNotes = ['C#', 'D#', null, 'F#', 'G#', 'A#'];
        const shortcuts = ['A', 'S', 'D', 'F', 'G', 'H', 'J'];
        const blackShortcuts = ['W', 'E', null, 'T', 'Y', 'U'];
        
        let totalWhiteKeys = 0;
        
        // Build 2 octaves
        for (let octave = 3; octave <= 5; octave++) {
            notes.forEach((note, index) => {
                const fullNote = `${note}${octave}`;
                
                // White key
                const whiteKey = document.createElement('div');
                whiteKey.className = 'key key-white';
                whiteKey.dataset.note = fullNote;
                
                const label = document.createElement('span');
                label.className = 'key-label';
                label.textContent = note;
                whiteKey.appendChild(label);
                
                if (octave === 4) {
                    const shortcut = document.createElement('span');
                    shortcut.className = 'key-shortcut';
                    shortcut.textContent = shortcuts[index];
                    whiteKey.appendChild(shortcut);
                }
                
                whiteKey.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    this.playNote(fullNote);
                });
                whiteKey.addEventListener('mouseup', () => this.stopNote(fullNote));
                whiteKey.addEventListener('mouseleave', () => this.stopNote(fullNote));
                whiteKey.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    this.playNote(fullNote);
                });
                whiteKey.addEventListener('touchend', () => this.stopNote(fullNote));
                
                keyboard.appendChild(whiteKey);
                
                // Black key
                if (blackNotes[index]) {
                    const blackNote = `${blackNotes[index]}${octave}`;
                    const blackKey = document.createElement('div');
                    blackKey.className = 'key key-black';
                    blackKey.dataset.note = blackNote;
                    blackKey.style.left = `${(totalWhiteKeys * 60) + 42}px`;
                    
                    const blackLabel = document.createElement('span');
                    blackLabel.className = 'key-label';
                    blackLabel.textContent = blackNotes[index];
                    blackKey.appendChild(blackLabel);
                    
                    if (octave === 4 && blackShortcuts[index]) {
                        const shortcut = document.createElement('span');
                        shortcut.className = 'key-shortcut';
                        shortcut.textContent = blackShortcuts[index];
                        blackKey.appendChild(shortcut);
                    }
                    
                    blackKey.addEventListener('mousedown', (e) => {
                        e.preventDefault();
                        this.playNote(blackNote);
                    });
                    blackKey.addEventListener('mouseup', () => this.stopNote(blackNote));
                    blackKey.addEventListener('mouseleave', () => this.stopNote(blackNote));
                    blackKey.addEventListener('touchstart', (e) => {
                        e.preventDefault();
                        this.playNote(blackNote);
                    });
                    blackKey.addEventListener('touchend', () => this.stopNote(blackNote));
                    
                    keyboard.appendChild(blackKey);
                }
                
                totalWhiteKeys++;
            });
        }
    },

    playNote(note, velocity = 0.8) {
        if (!this.audioEngine.isInitialized) return;
        
        this.audioEngine.playNote(note, velocity);
        this.activeKeys.add(note);
        
        // Visual feedback
        const key = document.querySelector(`[data-note="${note}"]`);
        if (key) {
            key.classList.add('active');
        }
        
        // Record if recording
        if (this.recorder.isRecording) {
            this.recorder.recordNote(note, velocity);
        }
        
        // Update sheet music display
        this.displayNote(note);
        
        // Check for first note achievement
        const data = this.dataManager.getData();
        if (!data.achievements.includes('first_note')) {
            this.unlockAchievement('first_note');
        }
    },

    stopNote(note) {
        this.activeKeys.delete(note);
        
        const key = document.querySelector(`[data-note="${note}"]`);
        if (key) {
            key.classList.remove('active');
        }
    },

    displayNote(note) {
        const display = document.getElementById('notes-display');
        const noteEl = document.createElement('div');
        noteEl.className = 'sheet-note active';
        noteEl.textContent = note;
        display.appendChild(noteEl);
        
        setTimeout(() => {
            noteEl.classList.remove('active');
        }, 300);
        
        // Keep only last 10 notes
        while (display.children.length > 10) {
            display.removeChild(display.firstChild);
        }
    },

    handleMIDINoteOn(midiNote, velocity) {
        const note = this.midiHandler.midiToNoteName(midiNote);
        this.playNote(note, velocity);
    },

    handleMIDINoteOff(midiNote) {
        const note = this.midiHandler.midiToNoteName(midiNote);
        this.stopNote(note);
    },

    setupEventListeners() {
        // Keyboard events
        document.addEventListener('keydown', async (e) => {
            if (e.repeat) return;
            
            const key = e.key.toLowerCase();
            
            // Octave change
            if (key === 'z') {
                this.currentOctave = Math.max(2, this.currentOctave - 1);
                this.showNotification('Octave: ' + this.currentOctave, 'info');
                return;
            }
            if (key === 'x') {
                this.currentOctave = Math.min(6, this.currentOctave + 1);
                this.showNotification('Octave: ' + this.currentOctave, 'info');
                return;
            }
            
            // Metronome toggle
            if (key === ' ') {
                e.preventDefault();
                this.toggleMetronome();
                return;
            }
            
            // Recording toggle
            if (key === 'r' && this.currentPage === 'practice') {
                this.toggleRecording();
                return;
            }
            
            // Play notes
            if (this.keyMap[key]) {
                // Initialize audio engine if not already done
                if (!this.audioEngine.isInitialized) {
                    await this.audioEngine.init();
                    this.metronome = new Metronome(this.audioEngine);
                }
                
                let noteName = this.keyMap[key];
                let octave = this.currentOctave;
                
                if (noteName === 'C5') {
                    noteName = 'C';
                    octave = this.currentOctave + 1;
                }
                
                const fullNote = `${noteName}${octave}`;
                if (!this.activeKeys.has(fullNote)) {
                    this.playNote(fullNote);
                }
            }
        });

        document.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            
            if (this.keyMap[key]) {
                let noteName = this.keyMap[key];
                let octave = this.currentOctave;
                
                if (noteName === 'C5') {
                    noteName = 'C';
                    octave = this.currentOctave + 1;
                }
                
                this.stopNote(`${noteName}${octave}`);
            }
        });

        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = e.target.dataset.page;
                this.navigateTo(page);
            });
        });

        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.filterLessons(e.target.dataset.filter);
            });
        });

        // Category buttons
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.filterSongs(e.target.dataset.category);
            });
        });

        // Song search
        const searchInput = document.getElementById('song-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchSongs(e.target.value);
            });
        }

        // Volume slider
        const volumeSlider = document.getElementById('setting-volume');
        if (volumeSlider) {
            volumeSlider.addEventListener('input', (e) => {
                const value = e.target.value;
                document.getElementById('volume-display').textContent = `${value}%`;
                if (this.audioEngine) {
                    this.audioEngine.setVolume(value);
                }
            });
        }
    },

    navigateTo(page) {
        // Update navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.toggle('active', link.dataset.page === page);
        });
        
        // Update pages
        document.querySelectorAll('.page').forEach(p => {
            p.classList.toggle('active', p.id === `page-${page}`);
        });
        
        this.currentPage = page;
        
        // Page-specific actions
        if (page === 'dashboard') {
            this.loadDashboard();
        }
    },

    loadDashboard() {
        const data = this.dataManager.getData();
        
        // Update user info
        document.getElementById('user-name').textContent = data.user.name;
        document.getElementById('streak-count').textContent = data.user.streak;
        document.getElementById('xp-count').textContent = data.user.xp;
        
        // Update progress circle
        const progress = (data.progress.lessonsCompleted.length / LESSONS_DATA.length) * 100;
        document.getElementById('progress-percent').textContent = Math.round(progress);
        const circle = document.getElementById('progress-circle');
        if (circle) {
            const circumference = 408;
            const offset = circumference - (progress / 100) * circumference;
            circle.style.strokeDashoffset = offset;
        }
        
        // Update stats
        const hours = Math.floor(data.progress.totalPracticeTime / 3600);
        document.getElementById('total-practice-time').textContent = `${hours}h`;
        document.getElementById('lessons-completed').textContent = data.progress.lessonsCompleted.length;
        document.getElementById('songs-learned').textContent = data.progress.songsLearned.length;
        document.getElementById('accuracy-avg').textContent = `${data.progress.averageAccuracy}%`;
        
        // Load recent activity
        const activityList = document.getElementById('activity-list');
        if (data.recentActivity.length > 0) {
            activityList.innerHTML = data.recentActivity.slice(0, 5).map(activity => `
                <div class="activity-item">
                    <div class="activity-icon">${activity.icon || '🎵'}</div>
                    <div class="activity-info">
                        <h4>${activity.title}</h4>
                        <p>${this.formatTimeAgo(activity.timestamp)}</p>
                    </div>
                </div>
            `).join('');
        }
    },

    loadLessons() {
        const grid = document.getElementById('lessons-grid');
        const data = this.dataManager.getData();
        
        grid.innerHTML = LESSONS_DATA.map(lesson => {
            const isCompleted = data.progress.lessonsCompleted.includes(lesson.id);
            const progress = isCompleted ? 100 : 0;
            
            return `
                <div class="lesson-card" onclick="PianoApp.openLesson(${lesson.id})">
                    <div class="lesson-thumbnail">
                        ${lesson.icon}
                        <div class="lesson-progress-bar" style="width: ${progress}%"></div>
                    </div>
                    <div class="lesson-content">
                        <h4>${lesson.title}</h4>
                        <p>${lesson.description}</p>
                        <div class="lesson-meta">
                            <span class="difficulty-badge ${lesson.difficulty}">${lesson.difficulty}</span>
                            <span class="lesson-duration">${lesson.duration} min</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

    filterLessons(filter) {
        const cards = document.querySelectorAll('.lesson-card');
        cards.forEach((card, index) => {
            const lesson = LESSONS_DATA[index];
            if (filter === 'all' || lesson.difficulty === filter) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    },

    openLesson(id) {
        const lesson = LESSONS_DATA.find(l => l.id === id);
        if (!lesson) return;
        
        this.currentLesson = lesson;
        
        document.getElementById('modal-lesson-title').textContent = lesson.title;
        document.getElementById('modal-lesson-difficulty').textContent = lesson.difficulty;
        document.getElementById('modal-lesson-difficulty').className = `difficulty-badge ${lesson.difficulty}`;
        document.getElementById('modal-lesson-duration').textContent = `${lesson.duration} min`;
        document.getElementById('modal-lesson-description').textContent = lesson.description;
        
        const objectives = document.getElementById('modal-lesson-objectives');
        objectives.innerHTML = lesson.objectives.map(obj => `<li>${obj}</li>`).join('');
        
        document.getElementById('lesson-modal').classList.add('active');
    },

    startLesson() {
        this.closeModal('lesson-modal');
        this.navigateTo('practice');
        
        document.getElementById('practice-title').textContent = this.currentLesson.title;
        document.getElementById('practice-description').textContent = this.currentLesson.description;
        
        // Add to recent activity
        this.dataManager.addActivity({
            title: `Started: ${this.currentLesson.title}`,
            icon: '📚'
        });
        
        this.showNotification(`Starting lesson: ${this.currentLesson.title}`, 'info');
    },

    loadSongs() {
        const grid = document.getElementById('songs-grid');
        
        grid.innerHTML = SONGS_DATA.map(song => `
            <div class="song-card" onclick="PianoApp.playSong(${song.id})">
                <div class="song-cover">${song.icon}</div>
                <div class="song-info">
                    <h4>${song.title}</h4>
                    <p class="artist">${song.artist}</p>
                    <div class="song-meta">
                        <span class="difficulty-badge ${song.difficulty}">${song.difficulty}</span>
                        <span>${song.duration}</span>
                    </div>
                </div>
            </div>
        `).join('');
    },

    filterSongs(category) {
        const cards = document.querySelectorAll('.song-card');
        cards.forEach((card, index) => {
            const song = SONGS_DATA[index];
            if (category === 'all' || song.category === category) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    },

    searchSongs(query) {
        const cards = document.querySelectorAll('.song-card');
        const lowerQuery = query.toLowerCase();
        
        cards.forEach((card, index) => {
            const song = SONGS_DATA[index];
            const matches = song.title.toLowerCase().includes(lowerQuery) ||
                           song.artist.toLowerCase().includes(lowerQuery);
            card.style.display = matches ? 'block' : 'none';
        });
    },

    playSong(id) {
        const song = SONGS_DATA.find(s => s.id === id);
        if (!song) return;
        
        this.navigateTo('practice');
        document.getElementById('practice-title').textContent = song.title;
        document.getElementById('practice-description').textContent = `by ${song.artist}`;
        
        // Play song notes
        if (song.notes && song.notes.length > 0) {
            this.playSongNotes(song.notes);
        }
        
        this.showNotification(`Now playing: ${song.title}`, 'info');
    },

    async playSongNotes(notes) {
        for (let i = 0; i < notes.length; i++) {
            this.playNote(notes[i], 0.7);
            await this.sleep(500);
            this.stopNote(notes[i]);
            await this.sleep(100);
        }
    },

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    loadAchievements() {
        const grid = document.getElementById('achievements-grid');
        const data = this.dataManager.getData();
        
        grid.innerHTML = ACHIEVEMENTS_DATA.map(achievement => {
            const unlocked = data.achievements.includes(achievement.id);
            return `
                <div class="achievement ${unlocked ? 'unlocked' : 'locked'}" 
                     title="${achievement.title}: ${achievement.description}">
                    ${achievement.icon}
                </div>
            `;
        }).join('');
    },

    unlockAchievement(id) {
        const achievement = ACHIEVEMENTS_DATA.find(a => a.id === id);
        if (!achievement) return;
        
        if (this.dataManager.unlockAchievement(id)) {
            this.showNotification(`🏆 Achievement Unlocked: ${achievement.title}`, 'success');
            this.loadAchievements();
            
            // Add XP
            const data = this.dataManager.getData();
            this.dataManager.updateUser({ xp: data.user.xp + 50 });
            document.getElementById('xp-count').textContent = data.user.xp + 50;
        }
    },

    toggleMetronome() {
        if (!this.metronome) return;
        
        const container = document.getElementById('metronome-container');
        const btn = document.getElementById('btn-metronome');
        
        if (this.metronome.isPlaying) {
            this.metronome.stop();
            container.classList.add('hidden');
            btn.classList.remove('active');
        } else {
            this.metronome.start();
            container.classList.remove('hidden');
            btn.classList.add('active');
        }
    },

    adjustTempo(delta) {
        if (this.metronome) {
            this.metronome.setTempo(this.metronome.tempo + delta);
        }
    },

    toggleRecording() {
        const btn = document.getElementById('btn-record');
        const playBtn = document.getElementById('btn-playback');
        
        if (this.recorder.isRecording) {
            const recording = this.recorder.stop();
            btn.classList.remove('active', 'recording');
            btn.innerHTML = '<span class="icon">⏺️</span>Record';
            playBtn.disabled = recording.length === 0;
            
            if (recording.length > 0) {
                this.showNotification(`Recorded ${recording.length} notes`, 'success');
            }
        } else {
            this.recorder.start();
            btn.classList.add('active', 'recording');
            btn.innerHTML = '<span class="icon">⏹️</span>Stop';
            this.showNotification('Recording started...', 'info');
        }
    },

    async playRecording() {
        const recording = this.recorder.getRecording();
        if (recording.length === 0) return;
        
        const btn = document.getElementById('btn-playback');
        btn.disabled = true;
        btn.innerHTML = '<span class="icon">⏸️</span>Playing';
        
        for (const note of recording) {
            this.playNote(note.note, note.velocity);
            await this.sleep(200);
            this.stopNote(note.note);
        }
        
        btn.disabled = false;
        btn.innerHTML = '<span class="icon">▶️</span>Play';
    },

    startQuickPractice(type) {
        this.navigateTo('practice');
        
        switch (type) {
            case 'scales':
                document.getElementById('practice-title').textContent = 'Scale Practice';
                document.getElementById('practice-description').textContent = 'Practice your scales';
                break;
            case 'chords':
                document.getElementById('practice-title').textContent = 'Chord Practice';
                document.getElementById('practice-description').textContent = 'Practice common chords';
                break;
            case 'freestyle':
                document.getElementById('practice-title').textContent = 'Free Play';
                document.getElementById('practice-description').textContent = 'Play freely and explore';
                break;
        }
    },

    toggleLabels() {
        const show = document.getElementById('show-labels').checked;
        document.querySelectorAll('.key-label').forEach(label => {
            label.style.display = show ? 'block' : 'none';
        });
    },

    toggleShortcuts() {
        const show = document.getElementById('show-shortcuts').checked;
        document.querySelectorAll('.key-shortcut').forEach(shortcut => {
            shortcut.style.display = show ? 'block' : 'none';
        });
    },

    closeFeedback() {
        document.getElementById('feedback-container').classList.add('hidden');
    },

    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
    },

    closeShortcutOverlay() {
        document.getElementById('shortcut-overlay').classList.remove('active');
    },

    loadSettings() {
        const data = this.dataManager.getData();
        
        document.getElementById('setting-name').value = data.user.name;
        document.getElementById('setting-level').value = data.user.level;
        document.getElementById('setting-volume').value = data.settings.volume;
        document.getElementById('volume-display').textContent = `${data.settings.volume}%`;
        document.getElementById('setting-sound').value = data.settings.sound;
        document.getElementById('setting-tempo').value = data.settings.tempo;
        document.getElementById('setting-dark-mode').checked = data.settings.darkMode;
        document.getElementById('setting-falling-notes').checked = data.settings.fallingNotes;
        document.getElementById('setting-animations').checked = data.settings.animations;
    },

    saveSettings() {
        const settings = {
            volume: parseInt(document.getElementById('setting-volume').value),
            sound: document.getElementById('setting-sound').value,
            tempo: parseInt(document.getElementById('setting-tempo').value),
            darkMode: document.getElementById('setting-dark-mode').checked,
            fallingNotes: document.getElementById('setting-falling-notes').checked,
            animations: document.getElementById('setting-animations').checked
        };
        
        const user = {
            name: document.getElementById('setting-name').value,
            level: document.getElementById('setting-level').value
        };
        
        this.dataManager.updateSettings(settings);
        this.dataManager.updateUser(user);
        
        // Apply settings
        if (this.audioEngine) {
            this.audioEngine.setVolume(settings.volume);
        }
        if (this.metronome) {
            this.metronome.setTempo(settings.tempo);
        }
        
        // Update UI
        document.getElementById('user-name').textContent = user.name;
        
        // Toggle dark mode
        document.body.classList.toggle('light-mode', !settings.darkMode);
        
        this.showNotification('Settings saved!', 'success');
    },

    resetProgress() {
        if (confirm('Are you sure you want to reset all progress? This cannot be undone.')) {
            this.dataManager.resetProgress();
            this.loadDashboard();
            this.loadLessons();
            this.loadAchievements();
            this.loadSettings();
            this.showNotification('Progress reset', 'warning');
        }
    },

    exportData() {
        const data = this.dataManager.exportData();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'piano-master-pro-data.json';
        a.click();
        URL.revokeObjectURL(url);
        this.showNotification('Data exported!', 'success');
    },

    importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                if (this.dataManager.importData(event.target.result)) {
                    this.loadDashboard();
                    this.loadLessons();
                    this.loadAchievements();
                    this.loadSettings();
                    this.showNotification('Data imported!', 'success');
                } else {
                    this.showNotification('Invalid data file', 'error');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    },

    refreshMIDI() {
        this.midiHandler.updateInputs();
        this.showNotification('MIDI devices refreshed', 'info');
    },

    showNotification(message, type = 'info') {
        const container = document.getElementById('notification-container');
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };
        
        notification.innerHTML = `
            <span class="notification-icon">${icons[type]}</span>
            <span>${message}</span>
            <button class="notification-close" onclick="this.parentElement.remove()">×</button>
        `;
        
        container.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 4000);
    },

    formatTimeAgo(timestamp) {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        
        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
        return `${Math.floor(seconds / 86400)} days ago`;
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    PianoApp.init();
});

// Make PianoApp globally accessible
window.PianoApp = PianoApp;