import random


class SudokuGenerator:
    SIZE = 9
    BOX_SIZE = 3

    def generate(self, clues=40):
        """
        Generate a Sudoku puzzle.

        Returns:
            {
                "puzzle": 9x9 board with 0 representing empty cells,
                "solution": completed 9x9 board
            }
        """
        # Build a fully solved board first, then punch holes in a copy
        # of it to produce the playable puzzle while keeping the
        # original solution intact for reference/validation later.
        solution = self._empty_board()

        self._fill_board(solution)

        puzzle = [row[:] for row in solution]

        self._remove_numbers(puzzle, 81 - clues)

        return {
            "puzzle": puzzle,
            "solution": solution,
        }

    def _empty_board(self):
        # Creates a grid of SIZE x SIZE filled with 0 (representing empty cells).
        # This is a helper method to initialize the Sudoku board before filling it with numbers.
        return [
            [0 for _ in range(self.SIZE)]
            for _ in range(self.SIZE)
        ]

    def _fill_board(self, board):
        # Recursive backtracking solver: 
        # finds the next empty cell, tries shuffled candidate numbers 1-9, 
        # and recurses. Shuffling ensures a different valid solution is 
        # generated each time rather than always producing the same deterministic 
        # fill. Returns True once the whole board is filled, backtracking, 
        # resetting to 0, on dead ends.
        empty = self._find_empty(board)

        if empty is None:
            return True

        row, col = empty

        # Note: Python ranges are inclusive of the start and exclusive of the end, so range(1, 10) generates numbers from 1 to 9.
        numbers = list(range(1, 10))
        random.shuffle(numbers)

        for number in numbers:
            if self._is_valid(board, row, col, number):
                board[row][col] = number

                if self._fill_board(board):
                    return True

                board[row][col] = 0

        return False

    def _find_empty(self, board):
        # Scans the board row by row and returns the row, col of the
        # first empty cell (value 0), or None if the board is full.
        for row in range(self.SIZE):
            for col in range(self.SIZE):
                if board[row][col] == 0:
                    return row, col

        return None

    def _is_valid(self, board, row, col, number):
        # Sudoku has three constraints: the number must not already exist in the same row, column, or 3x3 box.
        # First, check the row to see if the number is already present. If it is, return False.
        # Second, check the column by iterating through each row at the specified column index 
        # (e.g. it checks board[0][col], board[1][col], etc.). If the number is found, return False.
        # Third, calculate the top-right corner of the 3x3 box that contains the cell at (row, col) using integer division.
        # (e.g. for row 4 --> 4 // 3 = 1, therefore it would be in the second band of boxes (bands are either 0,1, or 2),
        #       for col 7 --> 7 // 3 = 2, therefore it would be in the third box of that band).
        # Meaning that the box that contains the cell at (4,7) starts at (3, 6) and spans rows 3–5, columns 6–8.
        # Lastly, iterate through the 3x3 box and check if the number is present. If it is, return False.
        # If the number is not found in the row, column, or box, return True meaning that there are no duplicates.

        # Check if the number is already in the specified row
        if number in board[row]:
            return False

        # Check if the number is already in the specified column
        for r in range(self.SIZE):
            if board[r][col] == number:
                return False

        # Calculate the top-right corner of the 3x3 box that contains the cell at (row, col)
        box_row = (row // self.BOX_SIZE) * self.BOX_SIZE
        box_col = (col // self.BOX_SIZE) * self.BOX_SIZE

        # Iterate through 3x3 box to check for duplicates. 
        # The outer loop iterates through the rows of the box, 
        # and the inner loop iterates through the columns of the box.
        for r in range(box_row, box_row + self.BOX_SIZE):
            for c in range(box_col, box_col + self.BOX_SIZE):
                if board[r][c] == number:
                    return False

        return True

    def _remove_numbers(self, puzzle, amount):
        # Uses a list comprehension to generate a list of all cell positions (row, col)
        # in a 9x9 grid. Then shuffles those positions randomly (that's why the positions on every new board is different).
        # It then iterates over the first "amount" (calculated in generate()) of those now shuffled positions
        # and sets the corresponding cell in the puzzle to 0, effectively "removing" that number from the puzzle.
        positions = [
            (row, col)
            for row in range(self.SIZE)
            for col in range(self.SIZE)
        ]

        random.shuffle(positions)

        for row, col in positions[:amount]:
            puzzle[row][col] = 0

    # Note: Static because this only inspects the board argument and doesn't
    # need access to `self` or any instance/class state (e.g. SIZE, BOX_SIZE).
    # It's kept on the class since it's conceptually part of the
    # SudokuGenerator's public API, but it could just as easily be a
    # standalone function.
    @staticmethod
    def is_complete(board):
        # Checks through each row to see if there are any empty cells (0s). 
        # If any row contains a 0, the board is not complete.
        # This method does not check for the correctness of the Sudoku 
        # solution, only whether all cells are filled.
        for row in board:
            if 0 in row:
                return False

        return True