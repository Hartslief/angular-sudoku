from ast import If
import uuid

from .generator import SudokuGenerator


class SudokuGame:
    # Class-level dictionary acting as an in-memory store for all active
    # games, keyed by game_id. Shared across all instances of SudokuGame
    # since it's a class attribute rather than set in __init__.
    games = {}

    def __init__(self):
        # Each SudokuGame instance gets its own generator to produce
        # puzzles/solutions when starting new games.
        self.generator = SudokuGenerator()

    def new_game(self, clues=40):
        # Generates a new Sudoku puzzle with the specified number of clues (default is 40).
        # Creates a unique game_id, then stores the game_id, puzzle, solution, moves, mistakes, 
        # score, completion status, and difficulty level in the games dictionary.
        # Then returns the game object containing all this information.
        generated = self.generator.generate(clues)

        game_id = str(uuid.uuid4())

        game = {
            "id": game_id,
            "puzzle": generated["puzzle"],
            "solution": generated["solution"],
            "moves": [],
            "mistakes": 0,
            "score": 0,
            "completed": False,
            "difficulty": "Easy",
        }

        self.games[game_id] = game

        return game

    def get_game(self, game_id):
        # Helper method to retrieve a game by its ID from the games dictionary.
        # Returns the game object if found, or None if the game_id does not exist.
        return self.games.get(game_id)

    def validate_move(self, game_id, row, col, number):
        # Gets the game by ID, then checks the following:
        # 1. Checks if the game exists; if it doesn't, then fail fast with an error message.
        # 2. Checks for out-of-bounds board coordinates (row and col must be between 0 and 8 inclusive); if invalid, return an error.
        # 3. Checks if the number if within the valid sudoku range (1-9); if not, return an error.
        # 4. Checks if a cell that was apart of the original puzzle (i.e. has a non-zero value that was generated) 
        #    is being changed; if so, return an error.
        # Then looks up what the correct value for the cell should be. Then checks the following:
        # 5. If the number is incorrect, increment the mistake counter and return an error with the current mistake count. 
        # 6. If the number is correct, add the move to the moves list
        # 7. Check if the game is complete (i.e. all cells filled correctly). If so, mark the game as completed.
        # Calculate the score based on the number of correct moves and mistakes, then 
        # return a success response with the current score and completion status.
        
        # Get game by ID
        game = self.get_game(game_id)

        # Check if game exists
        if game is None:
            return {
                "valid": False,
                "error": "Game not found"
            }

        # Check for out-of-bounds row/col
        if not 0 <= row < 9 or not 0 <= col < 9:
            return {
                "valid": False,
                "error": "Invalid cell"
            }

        # Check if number is within valid range
        if not 1 <= number <= 9:
            return {
                "valid": False,
                "error": "Number must be between 1 and 9"
            }

        # Check if the cell is part of the original puzzle (i.e. has a non-zero value that was generated)
        if game["puzzle"][row][col] != 0:
            return {
                "valid": False,
                "error": "This cell is locked"
            }

        # Find correct number for the cell from the solution.
        correct_number = game["solution"][row][col]

        # Check if the player's number is correct. If not, increment the mistake counter and return an error with the current mistake count.
        # If the number is correct, add the move to the moves list.
        if number != correct_number:
            game["mistakes"] += 1

            return {
                "valid": False,
                "mistakes": game["mistakes"],
                "score": self._calculate_score(game),
            }

        game["moves"].append({
            "row": row,
            "col": col,
            "number": number
        })

        # If the number is correct, check if the game is complete (i.e. all cells filled correctly). If so, mark the game as completed.
        return {
            "valid": True,
            "complete": self._is_game_complete(game),
            "score": self._calculate_score(game),
            "mistakes": game["mistakes"],
        }
    
    def _is_game_complete(self, game):
        # Create a copy of the current board.
        # Then apply all the moves made by the player to this board.
        # Then check if there are any empty cells (0s) left in the board. 
        # Every move is validated by validate_move() so if there are no empty cells that means every cell contains a valid number.
        # If there are no empty cells, mark the game as completed and return True. Otherwise, return False.
        board = [row[:] for row in game["puzzle"]]

        for move in game["moves"]:
            board[move["row"]][move["col"]] = move["number"]

        for row in board:
            if 0 in row:
                return False

        game["completed"] = True

        return True

    def _calculate_score(self, game):
        # Get the number of correct moves and mistakes made by the player.
        # Then calculate the score.
        # Return the score, ensuring it is not negative (i.e. return 0 if the calculated score is negative).
        correct_moves = len(game["moves"])
        mistakes = game["mistakes"]

        
        score = (correct_moves * 10) - (mistakes * 5)

        return max(score, 0)

    def _build_board(self, game):
    # Reconstructs the current playable board by layering applied moves
    # on top of the original puzzle. Used by undo() so the frontend can
    # re-sync without needing to track board state itself.
        board = [row[:] for row in game["puzzle"]]
        for move in game["moves"]:
            board[move["row"]][move["col"]] = move["number"]

        return board
