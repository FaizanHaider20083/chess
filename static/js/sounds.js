// Sound Effects for Chess Game
class ChessSounds {
    constructor() {
        this.audioContext = null;
        this.enabled = true;
        this.volume = 0.3;
        this.initializeAudioContext();
    }

    initializeAudioContext() {
        try {
            // Create audio context (handle browser prefixes)
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (error) {
            console.warn('Web Audio API not supported:', error);
            this.enabled = false;
        }
    }

    // Generate a tone with specified frequency and duration
    generateTone(frequency, duration, type = 'sine', volume = this.volume) {
        if (!this.enabled || !this.audioContext) return;

        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
            oscillator.type = type;

            // Envelope for smooth sound
            gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);

            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + duration);
        } catch (error) {
            console.warn('Error generating tone:', error);
        }
    }

    // Play move sound - gentle click
    playMoveSound() {
        if (!this.enabled) return;
        
        // Two-tone click sound
        this.generateTone(800, 0.05, 'square', 0.2);
        setTimeout(() => {
            this.generateTone(600, 0.03, 'square', 0.15);
        }, 20);
    }

    // Play capture sound - sharper, more dramatic
    playCaptureSound() {
        if (!this.enabled) return;
        
        // Dramatic capture sound with multiple frequencies
        this.generateTone(400, 0.1, 'sawtooth', 0.25);
        setTimeout(() => {
            this.generateTone(300, 0.08, 'square', 0.2);
        }, 50);
        setTimeout(() => {
            this.generateTone(200, 0.06, 'triangle', 0.15);
        }, 100);
    }

    // Play check sound - warning tone
    playCheckSound() {
        if (!this.enabled) return;
        
        // Rising warning tone
        const baseTime = this.audioContext.currentTime;
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                this.generateTone(800 + (i * 200), 0.15, 'sine', 0.3);
            }, i * 100);
        }
    }

    // Play checkmate sound - victory/defeat fanfare
    playCheckmateSound() {
        if (!this.enabled) return;
        
        // Victory/defeat fanfare
        const notes = [523, 659, 784, 1047]; // C, E, G, C octave
        notes.forEach((freq, index) => {
            setTimeout(() => {
                this.generateTone(freq, 0.4, 'triangle', 0.35);
            }, index * 150);
        });
        
        // Add dramatic low note
        setTimeout(() => {
            this.generateTone(131, 0.8, 'sawtooth', 0.25);
        }, 600);
    }

    // Play clock tick sound
    playClockTickSound() {
        if (!this.enabled) return;
        
        this.generateTone(1200, 0.02, 'square', 0.1);
    }

    // Play castle sound - special move
    playCastleSound() {
        if (!this.enabled) return;
        
        // Two quick move sounds in succession
        this.playMoveSound();
        setTimeout(() => {
            this.playMoveSound();
        }, 80);
    }

    // Play promotion sound
    playPromotionSound() {
        if (!this.enabled) return;
        
        // Ascending scale
        const frequencies = [523, 587, 659, 698, 784];
        frequencies.forEach((freq, index) => {
            setTimeout(() => {
                this.generateTone(freq, 0.2, 'sine', 0.25);
            }, index * 80);
        });
    }

    // Toggle sound on/off
    toggleSound() {
        this.enabled = !this.enabled;
        return this.enabled;
    }

    // Set volume (0.0 to 1.0)
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
    }

    // Resume audio context (required for some browsers)
    resumeAudioContext() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }
}

// Global sound manager instance
const chessSounds = new ChessSounds();

// Resume audio context on first user interaction
document.addEventListener('click', () => {
    chessSounds.resumeAudioContext();
}, { once: true });

// Export for use in other scripts
window.chessSounds = chessSounds; 