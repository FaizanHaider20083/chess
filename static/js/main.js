// Chess piece Unicode symbols
const PIECES = {
    'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
    'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
};

// Game state
let currentBoard = null;
let selectedSquare = null;
let legalMoves = [];
let lastMoveSquares = [];
let clockInterval = null;
let gameState = {
    turn: 'white',
    isCheck: false,
    isCheckmate: false,
    isStalemate: false
};

// Computer opponent state
let computerMode = false;
let computerPlaysAs = 'black';

// Visualize mode state
let visualizeMode = false;
let moveCounter = 0;
let piecesCurrentlyRevealed = false;

// Move navigation state
let gameHistory = [];
let currentMoveIndex = -1;
let isNavigating = false;
let currentViewingMove = null; // Track which move we're currently viewing (null = live game)

// Initialize the chess board
function initializeBoard() {
    const boardElement = document.getElementById('chessBoard');
    boardElement.innerHTML = '';
    
    // Create 64 squares
    for (let rank = 8; rank >= 1; rank--) {
        for (let file = 1; file <= 8; file++) {
            const square = document.createElement('div');
            square.className = 'chess-square';
            
            // Determine square color
            const isLight = (rank + file) % 2 === 0;
            square.classList.add(isLight ? 'light' : 'dark');
            
            // Set square ID for reference
            const squareId = String.fromCharCode(96 + file) + rank;
            square.setAttribute('data-square', squareId);
            
            // Add event listeners
            square.addEventListener('click', onSquareClick);
            square.addEventListener('mouseover', onSquareHover);
            
            boardElement.appendChild(square);
        }
    }
    
    // Load current position from server
    updateBoardPosition();
}

// Load a position from FEN notation
function loadPosition(fen) {
    const squares = document.querySelectorAll('.chess-square');
    
    // First pass: clear all squares completely
    squares.forEach(square => {
        square.textContent = '';
        square.classList.remove('white-piece', 'black-piece');
    });
    
    const position = fen.split(' ')[0]; // Get piece placement part
    const ranks = position.split('/');
    
    let squareIndex = 0;
    for (let rankIndex = 0; rankIndex < 8; rankIndex++) {
        const rank = ranks[rankIndex];
        for (let char of rank) {
            if (isNaN(char)) {
                // It's a piece
                const pieceUnicode = PIECES[char] || char;
                if (squares[squareIndex]) {
                    squares[squareIndex].textContent = pieceUnicode;
                    
                    // Add piece color class for enhanced contrast
                    if (isWhitePiece(pieceUnicode)) {
                        squares[squareIndex].classList.add('white-piece');
                    } else if (isBlackPiece(pieceUnicode)) {
                        squares[squareIndex].classList.add('black-piece');
                    }
                }
                squareIndex++;
            } else {
                // It's a number of empty squares
                const emptySquares = parseInt(char);
                for (let i = 0; i < emptySquares; i++) {
                    if (squares[squareIndex]) {
                        squares[squareIndex].textContent = '';
                        squares[squareIndex].classList.remove('white-piece', 'black-piece');
                    }
                    squareIndex++;
                }
            }
        }
    }
    
    currentBoard = fen;
    
    // Force a visual refresh to ensure all pieces are properly styled
    console.log('Position loaded, forcing visual refresh...');
    setTimeout(() => {
        squares.forEach(square => {
            if (square.textContent.trim()) {
                const piece = square.textContent;
                if (isWhitePiece(piece)) {
                    square.classList.add('white-piece');
                } else if (isBlackPiece(piece)) {
                    square.classList.add('black-piece');
                }
            }
        });
    }, 50);
}

// Helper functions to identify piece colors
function isWhitePiece(piece) {
    const whitePieces = ['♔', '♕', '♖', '♗', '♘', '♙'];
    return whitePieces.includes(piece);
}

function isBlackPiece(piece) {
    const blackPieces = ['♚', '♛', '♜', '♝', '♞', '♟'];
    return blackPieces.includes(piece);
}

// Handle square click events
async function onSquareClick(event) {
    const square = event.target;
    const squareId = square.getAttribute('data-square');
    
    // If we're viewing a historical position, return to live game first
    if (currentViewingMove !== null) {
        await returnToLiveGame();
        return;
    }
    
    // If clicking on a legal move square, make the move
    if (square.classList.contains('legal-move') && selectedSquare) {
        await makeMove(selectedSquare, squareId);
        return;
    }
    
    // Clear previous selection and legal moves
    clearSelection();
    
    // If square has a piece and it's the current player's turn
    const piece = square.textContent;
    if (piece && canSelectPiece(piece)) {
        selectedSquare = squareId;
        square.classList.add('selected');
        
        // Get and show legal moves for this piece
        await showLegalMoves(squareId);
    }
}

// Check if a piece can be selected (belongs to current player)
function canSelectPiece(piece) {
    const whitePieces = ['♔', '♕', '♖', '♗', '♘', '♙'];
    const blackPieces = ['♚', '♛', '♜', '♝', '♞', '♟'];
    
    if (gameState.turn === 'white') {
        return whitePieces.includes(piece);
    } else {
        return blackPieces.includes(piece);
    }
}

// Clear current selection and legal moves
function clearSelection() {
    selectedSquare = null;
    legalMoves = [];
    
    // More aggressively clear all selection-related classes
    document.querySelectorAll('.chess-square').forEach(sq => {
        sq.classList.remove('selected', 'legal-move', 'capture');
    });
}

// Show legal moves for selected piece
async function showLegalMoves(square) {
    try {
        const response = await fetch(`/api/legal_moves/${square}`);
        const data = await response.json();
        
        if (data.legal_moves) {
            legalMoves = data.legal_moves;
            
            // Highlight legal move squares
            legalMoves.forEach(move => {
                const targetSquare = document.querySelector(`[data-square="${move.to}"]`);
                if (targetSquare) {
                    targetSquare.classList.add('legal-move');
                    if (move.is_capture) {
                        targetSquare.classList.add('capture');
                    }
                }
            });
        }
    } catch (error) {
        console.error('Error fetching legal moves:', error);
    }
}

// Make a move
async function makeMove(fromSquare, toSquare) {
    try {
        // Find the move in legal moves
        const move = legalMoves.find(m => m.from === fromSquare && m.to === toSquare);
        if (!move) {
            console.error('Invalid move');
            return;
        }
        
        const response = await fetch('/api/make_move', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ move: move.move })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Play appropriate sound effect
            if (move.is_capture) {
                chessSounds.playCaptureSound();
            } else if (move.is_castling) {
                chessSounds.playCastleSound();
            } else {
                chessSounds.playMoveSound();
            }
            
            // Add move animation
            addMoveAnimation(fromSquare, toSquare);
            
            // Update last move squares for highlighting
            lastMoveSquares = [fromSquare, toSquare];
            
            // Update board position
            await updateBoardPosition();
            
            // Update game state
            gameState = data.board_state;
            updateTurnIndicator();
            
            // Force clear legal moves after board update
            document.querySelectorAll('.chess-square').forEach(sq => {
                sq.classList.remove('legal-move', 'capture');
            });
            
            // Update clocks
            if (data.clock_data) {
                updateClocks(data.clock_data);
            }
            
            // Check for special game states
            if (gameState.isCheckmate) {
                showGameStatusOverlay('Checkmate!', 'checkmate');
                chessSounds.playCheckmateSound();
                stopClock();
            } else if (gameState.isStalemate) {
                showGameStatusOverlay('Stalemate!', 'stalemate');
                stopClock();
            } else if (gameState.isCheck) {
                showGameStatusOverlay('Check!', 'check');
                chessSounds.playCheckSound();
                setTimeout(hideGameStatusOverlay, 2000);
            }
            
            // Update moves list and navigation
            await updateMovesList();
            await updateMoveNavigation();
            
            // Update evaluation and engine lines in parallel (non-blocking)
            updateEvaluation().catch(err => console.error('Evaluation error:', err));
            updateEngineLines().catch(err => console.error('Engine lines error:', err));
            
            console.log('Move made successfully:', data.move);
            
            // Clear selection and legal moves AFTER all updates
            clearSelection();
            
            // Increment move counter for visualize mode
            moveCounter++;
            
            // Handle visualize mode reveals (every 6 moves)
            if (visualizeMode) {
                if (moveCounter % 6 === 0) {
                    revealPiecesUntilNextMove();
                } else if (piecesCurrentlyRevealed) {
                    hidePieces();
                }
            }
            
            // If computer mode is on and it's now the computer's turn, make computer move
            if (computerMode && gameState.turn === computerPlaysAs && !gameState.isCheckmate && !gameState.isStalemate) {
                setTimeout(makeComputerMove, 800); // Small delay for better UX
            }
        } else {
            console.error('Move failed:', data.error);
        }
    } catch (error) {
        console.error('Error making move:', error);
    }
}

// Handle square hover events
function onSquareHover(event) {
    const square = event.target;
    const squareId = square.getAttribute('data-square');
    
    // You can add hover effects here
}

// Update evaluation bar
function updateEvaluationBar(evaluation) {
    const evalBar = document.getElementById('evalIndicator');
    const evalValue = document.getElementById('evalValue');
    
    // Convert evaluation to percentage (0-100)
    // Positive values favor white, negative favor black
    let percentage = 50 + (evaluation * 10); // Simple scaling
    percentage = Math.max(0, Math.min(100, percentage));
    
    evalBar.style.top = `${100 - percentage}%`;
    evalValue.textContent = evaluation > 0 ? `+${evaluation.toFixed(2)}` : evaluation.toFixed(2);
    
    // Update color based on evaluation
    if (evaluation > 0) {
        evalValue.style.color = '#81b64c';
    } else if (evaluation < 0) {
        evalValue.style.color = '#ff6b6b';
    } else {
        evalValue.style.color = '#888';
    }
}

// Update board position from server
async function updateBoardPosition() {
    try {
        const response = await fetch('/api/board_position');
        const data = await response.json();
        
        if (data.fen) {
            loadPosition(data.fen);
            gameState = {
                turn: data.turn,
                isCheck: data.is_check,
                isCheckmate: data.is_checkmate,
                isStalemate: data.is_stalemate
            };
            updateTurnIndicator();
            
            // Update visual effects
            highlightCheckSquares();
            highlightLastMove();
        }
    } catch (error) {
        console.error('Error updating board position:', error);
    }
}

// Update turn indicator
function updateTurnIndicator() {
    const turnIndicator = document.getElementById('turnIndicator');
    const currentTurnElement = document.getElementById('currentTurn');
    
    if (currentTurnElement) {
        if (gameState.isCheckmate) {
            currentTurnElement.textContent = `Checkmate! ${gameState.turn === 'white' ? 'Black' : 'White'} wins`;
        } else if (gameState.isStalemate) {
            currentTurnElement.textContent = 'Stalemate!';
        } else if (gameState.isCheck) {
            currentTurnElement.textContent = `${gameState.turn === 'white' ? 'White' : 'Black'} in check`;
        } else {
            currentTurnElement.textContent = `${gameState.turn === 'white' ? 'White' : 'Black'} to move`;
        }
    }
    
    if (turnIndicator) {
        turnIndicator.className = `turn-indicator ${gameState.turn}`;
    }
}

// Reset game
async function resetGame() {
    try {
        const response = await fetch('/api/reset_game', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Clear selection and visual effects
            clearSelection();
            lastMoveSquares = [];
            hideGameStatusOverlay();
            
            // Reset move counter and revealed state for visualize mode
            moveCounter = 0;
            piecesCurrentlyRevealed = false;
            
            // Update board and game state
            await updateBoardPosition();
            
            // Force refresh piece visibility after reset
            setTimeout(() => {
                const squares = document.querySelectorAll('.chess-square');
                squares.forEach(square => {
                    if (square.textContent.trim()) {
                        const piece = square.textContent;
                        square.classList.remove('white-piece', 'black-piece');
                        if (isWhitePiece(piece)) {
                            square.classList.add('white-piece');
                        } else if (isBlackPiece(piece)) {
                            square.classList.add('black-piece');
                        }
                    }
                });
                console.log('Reset: Forced piece visibility refresh');
            }, 100);
            
            // Update clocks
            if (data.clock_data) {
                updateClocks(data.clock_data);
            }
            
            // Update moves list (should be empty)
            await updateMovesList();
            
            // Update evaluation
            await updateEvaluation();
            
            // Update engine lines
            await updateEngineLines();
            
            console.log('Game reset successfully');
        } else {
            console.error('Failed to reset game');
        }
    } catch (error) {
        console.error('Error resetting game:', error);
    }
}

// Update moves list
async function updateMovesList() {
    try {
        const response = await fetch('/api/game_moves');
        const movesData = await response.json();
        populateGameMoves(movesData);
    } catch (error) {
        console.error('Error updating moves list:', error);
    }
}

// Update evaluation
async function updateEvaluation() {
    try {
        const response = await fetch('/api/evaluation');
        const evalData = await response.json();
        updateEvaluationBar(evalData.position_eval);
    } catch (error) {
        console.error('Error updating evaluation:', error);
    }
}

// Add move animation effect
function addMoveAnimation(fromSquare, toSquare) {
    const fromElement = document.querySelector(`[data-square="${fromSquare}"]`);
    const toElement = document.querySelector(`[data-square="${toSquare}"]`);
    
    if (fromElement) {
        fromElement.classList.add('just-moved');
        setTimeout(() => {
            fromElement.classList.remove('just-moved');
        }, 1000);
    }
    
    if (toElement) {
        toElement.classList.add('just-moved');
        setTimeout(() => {
            toElement.classList.remove('just-moved');
        }, 1000);
    }
}

// Show game status overlay
function showGameStatusOverlay(message, type) {
    const overlay = document.getElementById('gameStatusOverlay');
    const messageElement = document.getElementById('statusMessage');
    
    if (overlay && messageElement) {
        messageElement.textContent = message;
        overlay.className = `game-status-overlay show ${type}`;
    }
}

// Hide game status overlay
function hideGameStatusOverlay() {
    const overlay = document.getElementById('gameStatusOverlay');
    if (overlay) {
        overlay.classList.remove('show', 'check', 'checkmate', 'stalemate');
    }
}

// Update clocks display and state
function updateClocks(clockData) {
    const whiteClock = document.getElementById('whiteClock');
    const blackClock = document.getElementById('blackClock');
    
    if (whiteClock && blackClock) {
        whiteClock.textContent = clockData.white_formatted;
        blackClock.textContent = clockData.black_formatted;
        
        // Update active clock styling
        whiteClock.classList.toggle('active', clockData.current_player === 'white' && clockData.is_running);
        blackClock.classList.toggle('active', clockData.current_player === 'black' && clockData.is_running);
        
        // Add low time warning
        whiteClock.classList.toggle('low-time', clockData.white_time < 30);
        blackClock.classList.toggle('low-time', clockData.black_time < 30);
    }
}

// Start clock updates
function startClock() {
    if (clockInterval) clearInterval(clockInterval);
    
    clockInterval = setInterval(async () => {
        try {
            const response = await fetch('/api/clock');
            const clockData = await response.json();
            updateClocks(clockData);
            
            // Play tick sound for low time
            if ((clockData.white_time < 10 && clockData.current_player === 'white') ||
                (clockData.black_time < 10 && clockData.current_player === 'black')) {
                chessSounds.playClockTickSound();
            }
        } catch (error) {
            console.error('Error updating clock:', error);
        }
    }, 100);
}

// Stop clock updates
function stopClock() {
    if (clockInterval) {
        clearInterval(clockInterval);
        clockInterval = null;
    }
}

// Highlight check squares
function highlightCheckSquares() {
    const board = document.getElementById('chessBoard');
    const squares = document.querySelectorAll('.chess-square');
    
    // Remove existing check highlights
    squares.forEach(sq => sq.classList.remove('in-check'));
    
    if (gameState.isCheck) {
        // Add check animation to board
        board.classList.add('in-check');
        
        // Find and highlight the king in check
        const kingSquare = findKingSquare(gameState.turn);
        if (kingSquare) {
            kingSquare.classList.add('in-check');
        }
    } else {
        board.classList.remove('in-check');
    }
    
    if (gameState.isCheckmate) {
        board.classList.add('checkmate');
    } else {
        board.classList.remove('checkmate');
    }
}

// Find the king square for the current player
function findKingSquare(turn) {
    const kingSymbol = turn === 'white' ? '♔' : '♚';
    const squares = document.querySelectorAll('.chess-square');
    
    for (let square of squares) {
        if (square.textContent === kingSymbol) {
            return square;
        }
    }
    return null;
}

// Highlight last move
function highlightLastMove() {
    // Remove previous highlights
    document.querySelectorAll('.chess-square').forEach(sq => {
        sq.classList.remove('last-move');
    });
    
    // Highlight current last move
    lastMoveSquares.forEach(squareId => {
        const square = document.querySelector(`[data-square="${squareId}"]`);
        if (square) {
            square.classList.add('last-move');
        }
    });
}

// Toggle computer opponent mode
async function toggleComputerMode() {
    computerMode = !computerMode;
    
    try {
        const response = await fetch('/api/toggle_computer', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                enabled: computerMode,
                plays_as: computerPlaysAs
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            updateComputerToggleButton();
            console.log(`Computer mode: ${computerMode ? 'ON' : 'OFF'} (plays as ${computerPlaysAs})`);
            
            // If computer mode is enabled and it's computer's turn, make a move
            if (computerMode && gameState.turn === computerPlaysAs && !gameState.isCheckmate && !gameState.isStalemate) {
                setTimeout(makeComputerMove, 1000);
            }
        } else {
            console.error('Failed to toggle computer mode');
            computerMode = !computerMode; // Revert on failure
        }
    } catch (error) {
        console.error('Error toggling computer mode:', error);
        computerMode = !computerMode; // Revert on failure
    }
}

// Update computer toggle button appearance
function updateComputerToggleButton() {
    const button = document.getElementById('computerToggleBtn');
    const text = document.getElementById('computerToggleText');
    
    if (button && text) {
        if (computerMode) {
            button.classList.add('active');
            text.textContent = 'Computer: ON';
        } else {
            button.classList.remove('active');
            text.textContent = 'Play vs Computer';
        }
    }
}

// Toggle visualize mode
function toggleVisualizeMode() {
    visualizeMode = !visualizeMode;
    updateVisualizeToggleButton();
    updateVisualizeMode();
    
    console.log(`Visualize mode: ${visualizeMode ? 'ON' : 'OFF'}`);
}

// Update visualize toggle button appearance
function updateVisualizeToggleButton() {
    const button = document.getElementById('visualizeToggleBtn');
    const text = document.getElementById('visualizeToggleText');
    
    if (button && text) {
        if (visualizeMode) {
            button.classList.add('active');
            text.textContent = 'Visualize: ON';
            // Add class to body to hide engine analysis
            document.body.classList.add('visualize-mode-active');
        } else {
            button.classList.remove('active');
            text.textContent = 'Visualize Mode';
            // Remove class from body to show engine analysis
            document.body.classList.remove('visualize-mode-active');
        }
    }
}

// Update visualize mode display
function updateVisualizeMode() {
    const board = document.getElementById('chessBoard');
    
    if (visualizeMode) {
        board.classList.add('visualize-mode');
        // Check if we should reveal pieces (every 6 moves)
        if (moveCounter % 6 === 0) {
            revealPiecesUntilNextMove();
        }
    } else {
        board.classList.remove('visualize-mode');
        // Remove any reveal classes
        document.querySelectorAll('.chess-square').forEach(square => {
            square.classList.remove('reveal-piece');
        });
        piecesCurrentlyRevealed = false;
    }
}

// Reveal pieces until next move
function revealPiecesUntilNextMove() {
    const squares = document.querySelectorAll('.chess-square');
    
    // Add reveal class to all squares with pieces
    squares.forEach(square => {
        if (square.textContent.trim()) {
            square.classList.add('reveal-piece');
        }
    });
    
    piecesCurrentlyRevealed = true;
    console.log('🔍 Pieces revealed (will hide on next move)');
}

// Hide pieces in visualize mode
function hidePieces() {
    const squares = document.querySelectorAll('.chess-square');
    
    squares.forEach(square => {
        square.classList.remove('reveal-piece');
    });
    
    piecesCurrentlyRevealed = false;
    console.log('👻 Pieces hidden');
}

// Undo last move
async function undoMove() {
    if (isNavigating) {
        console.log('Cannot undo while navigating');
        return;
    }
    
    try {
        const response = await fetch('/api/undo_move', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            console.log(`🔙 Undid move: ${data.undone_move}`);
            
            // Update board position
            await updateBoardPosition();
            
            // Update game state
            gameState = data.board_state;
            updateTurnIndicator();
            
            // Update clocks
            if (data.clock_data) {
                updateClocks(data.clock_data);
            }
            
            // Update moves list and navigation
            await updateMovesList();
            await updateMoveNavigation();
            
            // Decrement move counter for visualize mode
            moveCounter = Math.max(0, moveCounter - 1);
            
            // Update evaluation and engine lines
            updateEvaluation().catch(err => console.error('Evaluation error:', err));
            updateEngineLines().catch(err => console.error('Engine lines error:', err));
            
        } else {
            console.error('Undo failed:', data.error);
        }
    } catch (error) {
        console.error('Error undoing move:', error);
    }
}

// Update move navigation controls
async function updateMoveNavigation() {
    try {
        const response = await fetch('/api/get_move_history');
        const data = await response.json();
        
        if (data.success) {
            gameHistory = data.moves;
            currentMoveIndex = data.current_move - 1;
            
            // Update navigation buttons
            const firstBtn = document.getElementById('firstMoveBtn');
            const prevBtn = document.getElementById('prevMoveBtn');
            const nextBtn = document.getElementById('nextMoveBtn');
            const lastBtn = document.getElementById('lastMoveBtn');
            const undoBtn = document.getElementById('undoBtn');
            const counter = document.getElementById('moveCounter');
            
            const canGoBack = currentMoveIndex >= 0;
            const canGoForward = false; // For now, we're always at the latest position
            const canUndo = gameHistory.length > 0 && !isNavigating;
            
            if (firstBtn) firstBtn.disabled = !canGoBack;
            if (prevBtn) prevBtn.disabled = !canGoBack;
            if (nextBtn) nextBtn.disabled = !canGoForward;
            if (lastBtn) lastBtn.disabled = !canGoForward;
            if (undoBtn) undoBtn.disabled = !canUndo;
            if (counter) counter.textContent = `Move ${currentMoveIndex + 1}/${gameHistory.length}`;
        }
    } catch (error) {
        console.error('Error updating move navigation:', error);
    }
}

// Navigate to specific move (for future implementation)
function navigateToMove(moveIndex) {
    // This would be implemented to show historical positions
    // For now, we'll focus on undo functionality
    console.log(`Navigate to move ${moveIndex} - Feature coming soon!`);
}

// Make a computer move
async function makeComputerMove() {
    if (!computerMode || gameState.turn !== computerPlaysAs) {
        return;
    }
    
    try {
        console.log('🤖 Computer is thinking...');
        
        const response = await fetch('/api/computer_move', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            console.log(`🤖 Computer played: ${data.move}`);
            
            // Play move sound
            chessSounds.playMoveSound();
            
            // Update board position
            await updateBoardPosition();
            
            // Update game state
            gameState = data.board_state;
            updateTurnIndicator();
            
            // Update clocks
            if (data.clock_data) {
                updateClocks(data.clock_data);
            }
            
            // Check for special game states
            if (gameState.isCheckmate) {
                showGameStatusOverlay('Checkmate!', 'checkmate');
                chessSounds.playCheckmateSound();
                stopClock();
            } else if (gameState.isStalemate) {
                showGameStatusOverlay('Stalemate!', 'stalemate');
                stopClock();
            } else if (gameState.isCheck) {
                showGameStatusOverlay('Check!', 'check');
                chessSounds.playCheckSound();
                setTimeout(hideGameStatusOverlay, 2000);
            }
            
            // Update moves list, navigation, and evaluation
            await updateMovesList();
            await updateMoveNavigation();
            updateEvaluation().catch(err => console.error('Evaluation error:', err));
            updateEngineLines().catch(err => console.error('Engine lines error:', err));
            
            // Increment move counter for visualize mode
            moveCounter++;
            
            // Handle visualize mode reveals (every 6 moves)
            if (visualizeMode) {
                if (moveCounter % 6 === 0) {
                    revealPiecesUntilNextMove();
                } else if (piecesCurrentlyRevealed) {
                    hidePieces();
                }
            }
            
        } else {
            console.error('Computer move failed:', data.error);
        }
    } catch (error) {
        console.error('Error making computer move:', error);
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeBoard();
    
    // Set up reset button
    const resetBtn = document.getElementById('resetGameBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetGame);
    }
    
    // Set up computer toggle button
    const computerToggleBtn = document.getElementById('computerToggleBtn');
    if (computerToggleBtn) {
        computerToggleBtn.addEventListener('click', toggleComputerMode);
    }
    
    // Set up visualize toggle button
    const visualizeToggleBtn = document.getElementById('visualizeToggleBtn');
    if (visualizeToggleBtn) {
        visualizeToggleBtn.addEventListener('click', toggleVisualizeMode);
    }
    
    // Set up undo button
    const undoBtn = document.getElementById('undoBtn');
    if (undoBtn) {
        undoBtn.addEventListener('click', undoMove);
    }
    
    // Set up navigation buttons
    const firstMoveBtn = document.getElementById('firstMoveBtn');
    const prevMoveBtn = document.getElementById('prevMoveBtn');
    const nextMoveBtn = document.getElementById('nextMoveBtn');
    const lastMoveBtn = document.getElementById('lastMoveBtn');
    const returnToGameBtn = document.getElementById('returnToGameBtn');
    
    if (firstMoveBtn) firstMoveBtn.addEventListener('click', () => navigateToMove(0));
    if (prevMoveBtn) prevMoveBtn.addEventListener('click', () => navigateToMove(currentMoveIndex - 1));
    if (nextMoveBtn) nextMoveBtn.addEventListener('click', () => navigateToMove(currentMoveIndex + 1));
    if (lastMoveBtn) lastMoveBtn.addEventListener('click', () => navigateToMove(gameHistory.length - 1));
    if (returnToGameBtn) returnToGameBtn.addEventListener('click', returnToLiveGame);
    
    // Load initial data
    updateMovesList();
    updateEvaluation();
    updateEngineLines(); // Load real engine lines
    
    // Start clock updates
    startClock();
    
    // Set up mode tab switching
    setupModeTabs();
});

// Update engine analysis lines from Stockfish
async function updateEngineLines() {
    try {
        const response = await fetch('/api/engine_lines');
        const lines = await response.json();
        populateEngineLines(lines);
    } catch (error) {
        console.error('Error fetching engine lines:', error);
        populateEngineLines([]); // Show empty state on error
    }
}

// Populate engine analysis lines
function populateEngineLines(lines = []) {
    const container = document.getElementById('engineLines');
    container.innerHTML = '';
    
    if (lines.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: #888; font-size: 14px;">Engine analysis will appear here during gameplay</div>';
        return;
    }
    
    lines.forEach((line, index) => {
        const lineElement = document.createElement('div');
        lineElement.className = 'engine-line';
        if (index === 0) lineElement.classList.add('selected');
        
        // Determine if evaluation is negative for styling
        const isNegative = line.eval && (line.eval.startsWith('-') || line.eval.includes('M-'));
        
        lineElement.innerHTML = `
            <div class="line-header">
                <span class="line-eval ${isNegative ? 'negative' : ''}">${line.eval}</span>
                <span class="line-depth">depth ${line.depth || 4}</span>
            </div>
            <div class="line-moves">${line.line}</div>
        `;
        
        lineElement.addEventListener('click', () => {
            document.querySelectorAll('.engine-line').forEach(el => el.classList.remove('selected'));
            lineElement.classList.add('selected');
        });
        
        container.appendChild(lineElement);
    });
}

// Populate game moves list with clickable individual moves
function populateGameMoves(moves) {
    const container = document.getElementById('movesList');
    container.innerHTML = '';
    
    if (moves.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">Game moves will appear here</div>';
        return;
    }
    
    moves.forEach((move, index) => {
        const moveElement = document.createElement('div');
        moveElement.className = 'move-row';
        
        // Create clickable spans for each move
        const moveNumberSpan = document.createElement('span');
        moveNumberSpan.className = 'move-number';
        moveNumberSpan.textContent = `${move.move_num}.`;
        
        const whiteSpan = document.createElement('span');
        whiteSpan.className = 'move-white clickable-move';
        whiteSpan.textContent = move.white;
        // White move is the first move of the pair
        const whiteMoveNumber = (move.move_num - 1) * 2 + 1; // 1-based move number for white
        whiteSpan.setAttribute('data-move-number', whiteMoveNumber);
        whiteSpan.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log(`🔍 White move clicked: ${move.white}, move number: ${whiteMoveNumber}`);
            viewPositionAtMove(whiteMoveNumber);
        });
        
        const blackSpan = document.createElement('span');
        blackSpan.className = 'move-black clickable-move';
        blackSpan.textContent = move.black || '';
        if (move.black) {
            // Black move is the second move of the pair
            const blackMoveNumber = (move.move_num - 1) * 2 + 2; // 1-based move number for black
            blackSpan.setAttribute('data-move-number', blackMoveNumber);
            blackSpan.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log(`🔍 Black move clicked: ${move.black}, move number: ${blackMoveNumber}`);
                viewPositionAtMove(blackMoveNumber);
            });
        }
        
        const whiteTimeSpan = document.createElement('span');
        whiteTimeSpan.className = 'move-time white-time';
        whiteTimeSpan.textContent = move.white_time || '';
        
        const blackTimeSpan = document.createElement('span');
        blackTimeSpan.className = 'move-time black-time';
        blackTimeSpan.textContent = move.black_time || '';
        
        moveElement.appendChild(moveNumberSpan);
        moveElement.appendChild(whiteSpan);
        moveElement.appendChild(blackSpan);
        moveElement.appendChild(whiteTimeSpan);
        moveElement.appendChild(blackTimeSpan);
        
        container.appendChild(moveElement);
    });
}

// View the board position after a specific move
async function viewPositionAtMove(moveNumber) {
    try {
        console.log(`🎯 Viewing position after move ${moveNumber}`);
        
        // Clear selection when viewing historical positions
        clearSelection();
        
        const response = await fetch(`/api/get_position/${moveNumber}`);
        const data = await response.json();
        
        if (data.success) {
            currentViewingMove = moveNumber;
            
            // Load the historical position
            loadPosition(data.position.fen);
            
            // Update game state display
            gameState = {
                turn: data.position.turn,
                isCheck: data.position.is_check,
                isCheckmate: data.position.is_checkmate,
                isStalemate: data.position.is_stalemate
            };
            
            // Update turn indicator
            updateTurnIndicator();
            
            // Highlight the selected move in the moves list
            document.querySelectorAll('.clickable-move').forEach(el => el.classList.remove('viewing'));
            const selectedMoves = document.querySelectorAll(`[data-move-number="${moveNumber}"]`);
            console.log(`🎨 Found ${selectedMoves.length} moves to highlight for move number ${moveNumber}`);
            selectedMoves.forEach(el => {
                el.classList.add('viewing');
                console.log(`🎨 Added viewing class to:`, el.textContent);
            });
            
            // Show indicator that we're viewing a historical position
            if (moveNumber < data.position.total_moves) {
                showGameStatusOverlay(`Viewing position after move ${moveNumber}`, 'info');
                setTimeout(hideGameStatusOverlay, 2000);
                
                // Show return to game button
                const returnBtn = document.getElementById('returnToGameBtn');
                if (returnBtn) {
                    returnBtn.style.display = 'flex';
                }
            } else {
                // We're back at the current position
                currentViewingMove = null;
                hideGameStatusOverlay();
                
                // Hide return to game button
                const returnBtn = document.getElementById('returnToGameBtn');
                if (returnBtn) {
                    returnBtn.style.display = 'none';
                }
            }
            
        } else {
            console.error('Failed to get position:', data.error);
        }
    } catch (error) {
        console.error('Error viewing position:', error);
    }
}

// Return to live game view
async function returnToLiveGame() {
    if (currentViewingMove === null) return; // Already at live game
    
    currentViewingMove = null;
    
    // Remove viewing highlights
    document.querySelectorAll('.clickable-move').forEach(el => el.classList.remove('viewing'));
    
    // Hide return to game button
    const returnBtn = document.getElementById('returnToGameBtn');
    if (returnBtn) {
        returnBtn.style.display = 'none';
    }
    
    // Reload current position
    await updateBoardPosition();
    hideGameStatusOverlay();
}

// Setup mode tab switching
function setupModeTabs() {
    const tabs = document.querySelectorAll('.mode-tab');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs
            tabs.forEach(t => t.classList.remove('active'));
            
            // Add active class to clicked tab
            tab.classList.add('active');
            
            const mode = tab.getAttribute('data-mode');
            console.log(`Switched to mode: ${mode}`);
            
            // Here you can add logic to switch between different modes
            // For now, we'll just log the mode change
        });
    });
} 