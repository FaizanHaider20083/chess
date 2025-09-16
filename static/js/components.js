// Component-specific JavaScript functionality

// Engine Settings Component
class EngineSettings {
    constructor() {
        this.setupEngineToggles();
    }
    
    setupEngineToggles() {
        const toggles = document.querySelectorAll('.engine-settings span');
        
        toggles.forEach(toggle => {
            toggle.addEventListener('click', () => {
                toggle.classList.toggle('active');
                this.handleToggleChange(toggle);
            });
        });
    }
    
    handleToggleChange(toggle) {
        const toggleType = toggle.textContent.toLowerCase();
        console.log(`Toggle ${toggleType} is now ${toggle.classList.contains('active') ? 'enabled' : 'disabled'}`);
        
        // Here you can add logic for different toggles
        switch(toggleType) {
            case 'evaluation':
                this.toggleEvaluation(toggle.classList.contains('active'));
                break;
            case 'lines':
                this.toggleLines(toggle.classList.contains('active'));
                break;
            case 'explorer':
                this.toggleExplorer(toggle.classList.contains('active'));
                break;
        }
    }
    
    toggleEvaluation(isEnabled) {
        const evalBar = document.querySelector('.evaluation-component');
        if (!isEnabled) {
            evalBar.style.opacity = '0.5';
        } else {
            evalBar.style.opacity = '1';
        }
    }
    
    toggleLines(isEnabled) {
        const linesContainer = document.getElementById('engineLines');
        if (!isEnabled) {
            linesContainer.style.display = 'none';
        } else {
            linesContainer.style.display = 'block';
        }
    }
    
    toggleExplorer(isEnabled) {
        console.log('Explorer functionality would be implemented here');
    }
}

// Game Analysis Component
class GameAnalysis {
    constructor() {
        this.currentMoveIndex = 0;
        this.setupGameControls();
    }
    
    setupGameControls() {
        // Setup game review button
        const reviewBtn = document.querySelector('.game-review-btn');
        if (reviewBtn) {
            reviewBtn.addEventListener('click', () => this.startGameReview());
        }
        
        // Setup action buttons
        const newGameBtn = document.querySelector('.action-btn:first-child');
        const rematchBtn = document.querySelector('.action-btn:last-child');
        
        if (newGameBtn) {
            newGameBtn.addEventListener('click', () => this.startNewGame());
        }
        
        if (rematchBtn) {
            rematchBtn.addEventListener('click', () => this.requestRematch());
        }
    }
    
    startGameReview() {
        console.log('Starting game review...');
        // Here you would implement game review functionality
        // Could show move-by-move analysis, highlight mistakes, etc.
        
        // For now, just show a visual indication
        const reviewBtn = document.querySelector('.game-review-btn');
        const originalText = reviewBtn.innerHTML;
        reviewBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading Review...';
        
        setTimeout(() => {
            reviewBtn.innerHTML = originalText;
            alert('Game review would open here!');
        }, 2000);
    }
    
    startNewGame() {
        console.log('Starting new 5-minute game...');
        // Here you would implement new game functionality
        alert('New 5-minute game would start here!');
    }
    
    requestRematch() {
        console.log('Requesting rematch...');
        // Here you would implement rematch functionality
        alert('Rematch request would be sent here!');
    }
    
    goToMove(moveIndex) {
        this.currentMoveIndex = moveIndex;
        console.log(`Navigating to move ${moveIndex}`);
        
        // Update board position based on move
        // This would require game history and position calculation
        
        // Highlight the current move in the moves list
        const moveRows = document.querySelectorAll('.move-row');
        moveRows.forEach((row, index) => {
            if (index === moveIndex) {
                row.classList.add('selected');
            } else {
                row.classList.remove('selected');
            }
        });
    }
}

// Board Interaction Component
class BoardInteraction {
    constructor() {
        this.selectedSquare = null;
        this.possibleMoves = [];
        this.setupBoardInteractions();
    }
    
    setupBoardInteractions() {
        // Enhanced board interaction beyond basic clicking
        const squares = document.querySelectorAll('.chess-square');
        
        squares.forEach(square => {
            square.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.handleRightClick(square);
            });
            
            square.addEventListener('dblclick', () => {
                this.handleDoubleClick(square);
            });
        });
        
        // Add keyboard navigation
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardNavigation(e);
        });
    }
    
    handleRightClick(square) {
        // Right-click functionality (e.g., drawing arrows, highlighting squares)
        console.log('Right-clicked square:', square.getAttribute('data-square'));
        
        // Toggle square highlighting
        square.classList.toggle('highlighted');
    }
    
    handleDoubleClick(square) {
        // Double-click functionality
        console.log('Double-clicked square:', square.getAttribute('data-square'));
        
        // Could implement: show piece move history, analyze square, etc.
    }
    
    handleKeyboardNavigation(event) {
        // Keyboard shortcuts for board navigation
        switch(event.key) {
            case 'ArrowLeft':
                event.preventDefault();
                this.previousMove();
                break;
            case 'ArrowRight':
                event.preventDefault();
                this.nextMove();
                break;
            case 'Home':
                event.preventDefault();
                this.goToStart();
                break;
            case 'End':
                event.preventDefault();
                this.goToEnd();
                break;
        }
    }
    
    previousMove() {
        console.log('Previous move');
        // Navigate to previous move in game
    }
    
    nextMove() {
        console.log('Next move');
        // Navigate to next move in game
    }
    
    goToStart() {
        console.log('Go to start');
        // Go to starting position
    }
    
    goToEnd() {
        console.log('Go to end');
        // Go to final position
    }
}

// Evaluation Component
class EvaluationComponent {
    constructor() {
        this.currentEvaluation = 0;
        this.setupEvaluationControls();
    }
    
    setupEvaluationControls() {
        const evalBar = document.getElementById('evaluationBar');
        if (evalBar) {
            evalBar.addEventListener('click', (e) => {
                this.handleEvalBarClick(e);
            });
        }
    }
    
    handleEvalBarClick(event) {
        // Calculate evaluation based on click position
        const rect = event.target.getBoundingClientRect();
        const clickY = event.clientY - rect.top;
        const percentage = clickY / rect.height;
        
        // Convert to evaluation (rough estimate)
        const evaluation = (0.5 - percentage) * 10;
        
        console.log(`Clicked evaluation: ${evaluation.toFixed(2)}`);
        
        // Update evaluation display
        updateEvaluationBar(evaluation);
    }
    
    animateEvaluationChange(fromEval, toEval, duration = 1000) {
        const startTime = Date.now();
        const evalDiff = toEval - fromEval;
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const currentEval = fromEval + (evalDiff * this.easeInOut(progress));
            updateEvaluationBar(currentEval);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        animate();
    }
    
    easeInOut(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }
}

// Initialize all components when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize components
    const engineSettings = new EngineSettings();
    const gameAnalysis = new GameAnalysis();
    const boardInteraction = new BoardInteraction();
    const evaluationComponent = new EvaluationComponent();
    
    // Store component instances globally for access from other scripts
    window.chessComponents = {
        engineSettings,
        gameAnalysis,
        boardInteraction,
        evaluationComponent
    };
    
    console.log('Chess training app components initialized');
}); 