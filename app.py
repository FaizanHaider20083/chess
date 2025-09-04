from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
import chess
import chess.svg
import json
import time
from stockfish import Stockfish
import threading
from concurrent.futures import ThreadPoolExecutor, TimeoutError
import queue

app = Flask(__name__)
CORS(app)

# Thread pool for Stockfish operations
executor = ThreadPoolExecutor(max_workers=2)

# Initialize Stockfish
STOCKFISH_PATH = "/opt/homebrew/bin/stockfish"
STOCKFISH_AVAILABLE = False

try:
    # Test if Stockfish is available
    test_stockfish = Stockfish(path=STOCKFISH_PATH)
    test_stockfish.set_depth(4)
    test_stockfish.set_elo_rating(2000)
    STOCKFISH_AVAILABLE = True
    print("✓ Stockfish initialized successfully")
    del test_stockfish  # Clean up test instance
except Exception as e:
    print(f"⚠ Stockfish not available: {e}")
    STOCKFISH_AVAILABLE = False

def create_stockfish_instance():
    """Create a new Stockfish instance for thread-safe operations"""
    if not STOCKFISH_AVAILABLE:
        return None
    try:
        sf = Stockfish(path=STOCKFISH_PATH)
        sf.set_depth(4)
        sf.set_elo_rating(2000)
        return sf
    except Exception as e:
        print(f"❌ Error creating Stockfish instance: {e}")
        return None

# Global chess game state
game_board = chess.Board()
move_history = []
game_start_time = time.time()

# Computer opponent settings
computer_mode = False
computer_plays_as = 'black'  # Computer plays as black by default

# Game clock settings (in seconds)
INITIAL_CLOCK_TIME = 300  # 5 minutes
clock_settings = {
    'white_time': INITIAL_CLOCK_TIME,
    'black_time': INITIAL_CLOCK_TIME,
    'last_move_time': time.time(),
    'is_running': False,
    'current_player_start_time': time.time()
}

def get_piece_unicode(piece):
    """Convert chess.Piece to Unicode symbol"""
    pieces_unicode = {
        chess.PAWN: {'white': '♙', 'black': '♟'},
        chess.ROOK: {'white': '♖', 'black': '♜'},
        chess.KNIGHT: {'white': '♘', 'black': '♞'},
        chess.BISHOP: {'white': '♗', 'black': '♝'},
        chess.QUEEN: {'white': '♕', 'black': '♛'},
        chess.KING: {'white': '♔', 'black': '♚'}
    }
    color = 'white' if piece.color else 'black'
    return pieces_unicode[piece.piece_type][color]

def format_move_for_display(move):
    """Format chess move for display in moves list"""
    # Convert move to standard algebraic notation
    san_move = game_board.san(move)
    
    # Add piece symbols for better display
    piece = game_board.piece_at(move.from_square)
    if piece and piece.piece_type != chess.PAWN:
        unicode_piece = get_piece_unicode(piece)
        san_move = unicode_piece + san_move[1:] if san_move[0].isupper() else san_move
    
    return san_move

def _stockfish_evaluate_position(fen):
    """Internal function to evaluate position (runs in thread)"""
    stockfish = create_stockfish_instance()
    if not stockfish:
        return None
    
    try:
        stockfish.set_fen_position(fen)
        evaluation = stockfish.get_evaluation()
        return evaluation
    except Exception as e:
        print(f"❌ Error in stockfish evaluation thread: {e}")
        return None
    finally:
        # Clean up the instance
        try:
            del stockfish
        except:
            pass

def get_stockfish_evaluation():
    """Get position evaluation from Stockfish with timeout"""
    if not STOCKFISH_AVAILABLE:
        print("⚠ Stockfish not available for evaluation")
        return {"eval": 0, "type": "cp", "depth": 0}
    
    try:
        fen = game_board.fen()
        print(f"🔍 Evaluating position: {fen}")
        
        # Run evaluation in thread with timeout
        future = executor.submit(_stockfish_evaluate_position, fen)
        evaluation = future.result(timeout=2.0)  # 2 second timeout
        
        print(f"📊 Stockfish evaluation: {evaluation}")
        
        if evaluation:
            result = {
                "eval": evaluation.get("value", 0),
                "type": evaluation.get("type", "cp"),  # cp = centipawns, mate = mate in X
                "depth": 4  # We know our depth setting
            }
            print(f"✅ Returning evaluation: {result}")
            return result
    except TimeoutError:
        print("⏱️ Stockfish evaluation timeout")
    except Exception as e:
        print(f"❌ Error getting Stockfish evaluation: {e}")
    
    return {"eval": 0, "type": "cp", "depth": 0}

def _stockfish_get_top_moves(fen, num_lines):
    """Internal function to get top moves (runs in thread)"""
    stockfish = create_stockfish_instance()
    if not stockfish:
        return []
    
    try:
        stockfish.set_fen_position(fen)
        top_moves = stockfish.get_top_moves(num_lines)
        return top_moves
    except Exception as e:
        print(f"❌ Error in stockfish top moves thread: {e}")
        return []
    finally:
        # Clean up the instance
        try:
            del stockfish
        except:
            pass

def get_stockfish_top_lines(num_lines=3):
    """Get top engine lines from Stockfish with timeout"""
    if not STOCKFISH_AVAILABLE:
        print("⚠ Stockfish not available for engine lines")
        return []
    
    try:
        fen = game_board.fen()
        print(f"🔍 Getting top lines for position: {fen}")
        
        # Run top moves in thread with timeout
        future = executor.submit(_stockfish_get_top_moves, fen, num_lines)
        top_moves = future.result(timeout=3.0)  # 3 second timeout
        
        print(f"🎯 Stockfish top moves: {top_moves}")
        
        lines = []
        for i, move_data in enumerate(top_moves):
            # Get the move
            move_uci = move_data.get('Move', '')
            centipawn = move_data.get('Centipawn', 0)
            mate = move_data.get('Mate')
            
            # Format evaluation
            if mate is not None:
                if mate > 0:
                    eval_str = f"M{mate}"
                else:
                    eval_str = f"M{abs(mate)}"
            else:
                eval_val = centipawn / 100.0  # Convert centipawns to pawns
                eval_str = f"+{eval_val:.2f}" if eval_val >= 0 else f"{eval_val:.2f}"
            
            # Get the line by making the move and getting a few more
            line_moves = []
            temp_board = game_board.copy()
            
            try:
                # Add the main move
                move = chess.Move.from_uci(move_uci)
                line_moves.append(temp_board.san(move))
                temp_board.push(move)
                
                # Get a few more moves from the position
                # For now, just show the main move to avoid complexity
                # We can enhance this later if needed
                        
            except Exception as move_error:
                print(f"Error processing move line: {move_error}")
                line_moves = [move_uci] if move_uci else []
            
            lines.append({
                "eval": eval_str,
                "line": " ".join(line_moves),
                "depth": 4,  # We know our depth setting
                "uci": move_uci
            })
            
        return lines
        
    except TimeoutError:
        print("⏱️ Stockfish top lines timeout")
        return []
    except Exception as e:
        print(f"❌ Error getting Stockfish top lines: {e}")
        return []

def format_evaluation_for_display(eval_data):
    """Format evaluation for the evaluation bar"""
    if eval_data["type"] == "mate":
        mate_value = eval_data["eval"]
        if mate_value > 0:
            return 5.0  # White is winning
        else:
            return -5.0  # Black is winning
    else:
        # Convert centipawns to approximate pawn value, capped at +/-5
        pawn_value = eval_data["eval"] / 100.0
        return max(-5.0, min(5.0, pawn_value))

def _stockfish_get_best_move(fen):
    """Internal function to get best move (runs in thread)"""
    stockfish = create_stockfish_instance()
    if not stockfish:
        return None
    
    try:
        stockfish.set_fen_position(fen)
        best_move = stockfish.get_best_move()
        return best_move
    except Exception as e:
        print(f"❌ Error in stockfish best move thread: {e}")
        return None
    finally:
        # Clean up the instance
        try:
            del stockfish
        except:
            pass

def get_computer_move():
    """Get the best move from Stockfish for computer opponent"""
    if not STOCKFISH_AVAILABLE:
        print("⚠ Stockfish not available for computer move")
        return None
    
    try:
        fen = game_board.fen()
        print(f"🤖 Getting computer move for position: {fen}")
        
        # Run best move in thread with timeout
        future = executor.submit(_stockfish_get_best_move, fen)
        best_move_uci = future.result(timeout=5.0)  # 5 second timeout for computer moves
        
        if best_move_uci:
            try:
                move = chess.Move.from_uci(best_move_uci)
                if move in game_board.legal_moves:
                    print(f"🎯 Computer chooses: {best_move_uci}")
                    return move
                else:
                    print(f"❌ Computer move {best_move_uci} is not legal")
            except Exception as e:
                print(f"❌ Error parsing computer move: {e}")
        
        return None
        
    except TimeoutError:
        print("⏱️ Computer move timeout")
        return None
    except Exception as e:
        print(f"❌ Error getting computer move: {e}")
        return None

def update_clock():
    """Update the clock after a move"""
    current_time = time.time()
    
    if clock_settings['is_running']:
        # Subtract elapsed time from current player
        elapsed = current_time - clock_settings['current_player_start_time']
        
        if game_board.turn:  # White's turn (before move was made)
            clock_settings['black_time'] -= elapsed
        else:  # Black's turn (before move was made)
            clock_settings['white_time'] -= elapsed
    
    # Switch to the other player and start their clock
    clock_settings['current_player_start_time'] = current_time
    clock_settings['is_running'] = True
    
    # Ensure times don't go negative
    clock_settings['white_time'] = max(0, clock_settings['white_time'])
    clock_settings['black_time'] = max(0, clock_settings['black_time'])

def format_clock_time(seconds):
    """Format seconds into MM:SS format"""
    minutes = int(seconds // 60)
    seconds = int(seconds % 60)
    return f"{minutes}:{seconds:02d}"

def get_clock_data():
    """Get current clock state"""
    current_time = time.time()
    white_time = clock_settings['white_time']
    black_time = clock_settings['black_time']
    
    # If game is running, subtract elapsed time from current player
    if clock_settings['is_running']:
        elapsed = current_time - clock_settings['current_player_start_time']
        if game_board.turn:  # White's turn
            white_time -= elapsed
        else:  # Black's turn
            black_time -= elapsed
    
    return {
        'white_time': max(0, white_time),
        'black_time': max(0, black_time),
        'white_formatted': format_clock_time(max(0, white_time)),
        'black_formatted': format_clock_time(max(0, black_time)),
        'is_running': clock_settings['is_running'],
        'current_player': 'white' if game_board.turn else 'black'
    }

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/board_position')
def get_board_position():
    """Get current board position"""
    return jsonify({
        "fen": game_board.fen(),
        "turn": "white" if game_board.turn else "black",
        "is_check": game_board.is_check(),
        "is_checkmate": game_board.is_checkmate(),
        "is_stalemate": game_board.is_stalemate()
    })

@app.route('/api/legal_moves/<square>')
def get_legal_moves(square):
    """Get legal moves for a piece on given square"""
    try:
        square_index = chess.parse_square(square)
        piece = game_board.piece_at(square_index)
        
        if piece is None:
            return jsonify({"legal_moves": []})
        
        # Only show moves for the current player's pieces
        if piece.color != game_board.turn:
            return jsonify({"legal_moves": []})
        
        legal_moves = []
        for move in game_board.legal_moves:
            if move.from_square == square_index:
                to_square = chess.square_name(move.to_square)
                legal_moves.append({
                    "to": to_square,
                    "from": square,
                    "move": move.uci(),
                    "is_capture": game_board.is_capture(move),
                    "is_castling": game_board.is_castling(move),
                    "is_en_passant": game_board.is_en_passant(move)
                })
        
        return jsonify({"legal_moves": legal_moves})
    
    except ValueError:
        return jsonify({"error": "Invalid square"}, 400)

@app.route('/api/make_move', methods=['POST'])
def make_move():
    """Make a move on the board"""
    try:
        data = request.get_json()
        move_uci = data.get('move')
        
        if not move_uci:
            return jsonify({"error": "Move required"}), 400
        
        move = chess.Move.from_uci(move_uci)
        
        if move not in game_board.legal_moves:
            return jsonify({"error": "Illegal move"}), 400
        
        # Store move info before making the move
        move_san = game_board.san(move)
        move_time = time.time()
        
        # Update clock before making the move
        update_clock()
        
        # Make the move
        game_board.push(move)
        
        # Add to move history
        move_data = {
            "move": move,  # Store the actual chess.Move object
            "move_num": len(move_history) // 2 + 1,
            "san": move_san,
            "uci": move_uci,
            "time": move_time,
            "fen_after": game_board.fen()
        }
        move_history.append(move_data)
        
        return jsonify({
            "success": True,
            "move": move_data,
            "board_state": {
                "fen": game_board.fen(),
                "turn": "white" if game_board.turn else "black",
                "is_check": game_board.is_check(),
                "is_checkmate": game_board.is_checkmate(),
                "is_stalemate": game_board.is_stalemate()
            },
            "clock_data": get_clock_data()
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/api/reset_game', methods=['POST'])
def reset_game():
    """Reset the game to starting position"""
    global game_board, move_history, game_start_time, clock_settings
    
    game_board = chess.Board()
    move_history = []
    game_start_time = time.time()
    
    # Reset clocks
    clock_settings = {
        'white_time': INITIAL_CLOCK_TIME,
        'black_time': INITIAL_CLOCK_TIME,
        'last_move_time': time.time(),
        'is_running': False,
        'current_player_start_time': time.time()
    }
    
    return jsonify({
        "success": True,
        "message": "Game reset successfully",
        "board_state": {
            "fen": game_board.fen(),
            "turn": "white",
            "is_check": False,
            "is_checkmate": False,
            "is_stalemate": False
        },
        "clock_data": get_clock_data()
    })

@app.route('/api/game_moves')
def get_game_moves():
    """Get the current game's move history"""
    formatted_moves = []
    
    for i in range(0, len(move_history), 2):
        move_num = i // 2 + 1
        white_move = move_history[i] if i < len(move_history) else None
        black_move = move_history[i + 1] if i + 1 < len(move_history) else None
        
        move_data = {
            "move_num": move_num,
            "white": white_move['san'] if white_move else "",
            "black": black_move['san'] if black_move else "",
            "white_time": "0.1s" if white_move else "",  # Simplified for now
            "black_time": "0.1s" if black_move else ""   # Simplified for now
        }
        formatted_moves.append(move_data)
    
    return jsonify(formatted_moves)

@app.route('/api/clock')
def get_clock():
    """Get current clock state"""
    return jsonify(get_clock_data())

@app.route('/api/evaluation')
def get_evaluation():
    """Get current position evaluation using Stockfish"""
    if STOCKFISH_AVAILABLE:
        eval_data = get_stockfish_evaluation()
        display_eval = format_evaluation_for_display(eval_data)
        
        # Format evaluation text
        if eval_data["type"] == "mate":
            mate_value = eval_data["eval"]
            if mate_value > 0:
                eval_text = f"Mate in {mate_value}"
            else:
                eval_text = f"Mate in {abs(mate_value)}"
        else:
            pawn_value = eval_data["eval"] / 100.0
            eval_text = f"+{pawn_value:.2f}" if pawn_value >= 0 else f"{pawn_value:.2f}"
        
        return jsonify({
            "position_eval": display_eval,
            "eval_text": eval_text,
            "depth": eval_data["depth"],
            "engine": "Stockfish 17.1",
            "turn": "white" if game_board.turn else "black"
        })
    else:
        # Fallback to simple material evaluation
        piece_values = {
            chess.PAWN: 1,
            chess.KNIGHT: 3,
            chess.BISHOP: 3,
            chess.ROOK: 5,
            chess.QUEEN: 9
        }
        
        white_material = 0
        black_material = 0
        
        for square in chess.SQUARES:
            piece = game_board.piece_at(square)
            if piece:
                value = piece_values.get(piece.piece_type, 0)
                if piece.color:
                    white_material += value
                else:
                    black_material += value
        
        evaluation = white_material - black_material
        
        return jsonify({
            "position_eval": evaluation,
            "eval_text": f"+{evaluation:.1f}" if evaluation >= 0 else f"{evaluation:.1f}",
            "depth": 0,
            "engine": "Material Count",
            "turn": "white" if game_board.turn else "black"
        })

@app.route('/api/engine_lines')
def get_engine_lines():
    """Get top engine analysis lines"""
    if STOCKFISH_AVAILABLE:
        lines = get_stockfish_top_lines(3)  # Get top 3 lines
        return jsonify(lines)
    else:
        # Return empty lines if Stockfish not available
        return jsonify([])

@app.route('/api/toggle_computer', methods=['POST'])
def toggle_computer():
    """Toggle computer opponent mode"""
    global computer_mode, computer_plays_as
    
    data = request.get_json()
    computer_mode = data.get('enabled', False)
    computer_plays_as = data.get('plays_as', 'black')
    
    print(f"🤖 Computer mode: {'ON' if computer_mode else 'OFF'} (plays as {computer_plays_as})")
    
    return jsonify({
        "success": True,
        "computer_mode": computer_mode,
        "computer_plays_as": computer_plays_as
    })

@app.route('/api/computer_move', methods=['POST'])
def make_computer_move():
    """Make a computer move"""
    global game_board, move_history
    
    if not computer_mode:
        return jsonify({"success": False, "error": "Computer mode not enabled"})
    
    # Check if it's the computer's turn
    current_turn = 'white' if game_board.turn else 'black'
    if current_turn != computer_plays_as:
        return jsonify({"success": False, "error": "Not computer's turn"})
    
    # Get computer move
    computer_move = get_computer_move()
    if not computer_move:
        return jsonify({"success": False, "error": "Computer could not find a move"})
    
    try:
        # Make the move
        san_move = game_board.san(computer_move)
        game_board.push(computer_move)
        
        # Update move history
        move_history.append({
            'move': computer_move,
            'san': san_move,
            'timestamp': time.time()
        })
        
        # Update clock
        update_clock()
        
        # Get board state
        board_state = {
            'turn': 'white' if game_board.turn else 'black',
            'is_check': game_board.is_check(),
            'is_checkmate': game_board.is_checkmate(),
            'is_stalemate': game_board.is_stalemate()
        }
        
        print(f"🤖 Computer played: {san_move}")
        
        return jsonify({
            "success": True,
            "move": san_move,
            "board_state": board_state,
            "clock_data": get_clock_data()
        })
        
    except Exception as e:
        print(f"❌ Error making computer move: {e}")
        return jsonify({"success": False, "error": str(e)})

@app.route('/api/undo_move', methods=['POST'])
def undo_move():
    """Undo the last move"""
    global game_board, move_history
    
    try:
        if len(move_history) == 0:
            return jsonify({"success": False, "error": "No moves to undo"})
        
        # Pop the last move from history
        last_move = move_history.pop()
        
        # Undo the move on the board
        game_board.pop()
        
        # Get board state
        board_state = {
            'turn': 'white' if game_board.turn else 'black',
            'is_check': game_board.is_check(),
            'is_checkmate': game_board.is_checkmate(),
            'is_stalemate': game_board.is_stalemate()
        }
        
        print(f"🔙 Undid move: {last_move['san']}")
        
        return jsonify({
            "success": True,
            "undone_move": last_move['san'],
            "board_state": board_state,
            "clock_data": get_clock_data()
        })
        
    except Exception as e:
        print(f"❌ Error undoing move: {e}")
        return jsonify({"success": False, "error": str(e)})

@app.route('/api/get_move_history')
def get_move_history():
    """Get the complete move history for navigation"""
    try:
        return jsonify({
            "success": True,
            "moves": move_history,
            "current_move": len(move_history)
        })
    except Exception as e:
        print(f"❌ Error getting move history: {e}")
        return jsonify({"success": False, "error": str(e)})

@app.route('/api/get_position/<int:move_number>')
def get_position_at_move(move_number):
    """Get the board position after a specific move number (0 = starting position)"""
    try:
        print(f"🎯 Getting position at move {move_number}, total moves: {len(move_history)}")
        
        # Create a temporary board to replay moves
        temp_board = chess.Board()
        
        # Convert 1-based move number to 0-based index
        moves_to_replay = min(move_number, len(move_history))
        print(f"📝 Replaying {moves_to_replay} moves (1-based input: {move_number})")
        
        for i in range(moves_to_replay):
            move_data = move_history[i]
            
            # Try to get the move object, with fallback to UCI notation
            if 'move' in move_data:
                move_obj = move_data['move']
            elif 'uci' in move_data:
                # Fallback: create move from UCI notation
                move_obj = chess.Move.from_uci(move_data['uci'])
            else:
                raise ValueError(f"Move {i} has no move object or UCI notation")
            
            temp_board.push(move_obj)
            print(f"  Move {i+1}: {move_obj} (from {move_data.get('san', 'N/A')})")
        
        # Get board state at this position
        board_state = {
            'fen': temp_board.fen(),
            'turn': 'white' if temp_board.turn else 'black',
            'is_check': temp_board.is_check(),
            'is_checkmate': temp_board.is_checkmate(),
            'is_stalemate': temp_board.is_stalemate(),
            'move_number': move_number,
            'total_moves': len(move_history)
        }
        
        print(f"📍 Position at move {move_number}: {temp_board.fen()}")
        
        return jsonify({
            "success": True,
            "position": board_state
        })
        
    except Exception as e:
        print(f"❌ Error getting position at move {move_number}: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)})

@app.route('/api/debug_moves')
def debug_moves():
    """Debug endpoint to see move history structure"""
    debug_info = {
        'total_moves': len(move_history),
        'moves': []
    }
    
    for i, move in enumerate(move_history):
        debug_info['moves'].append({
            'index': i,
            'san': move.get('san', 'N/A'),
            'move_obj': str(move.get('move', 'N/A'))
        })
    
    return jsonify(debug_info)

if __name__ == '__main__':
    try:
        app.run(debug=True, port=5000)
    finally:
        # Clean up thread pool on shutdown
        print("🧹 Cleaning up thread pool...")
        executor.shutdown(wait=True) 