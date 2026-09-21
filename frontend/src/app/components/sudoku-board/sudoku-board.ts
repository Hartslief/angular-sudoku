import { Component, inject, signal } from '@angular/core';
import { Sudoku, SudokuGame } from '../../services/sudoku';

// Represents the position of a cell on the Sudoku board.
interface Cell {
  row: number;
  col: number;
}

@Component({
  // HTML element used to display this component.
  selector: 'app-sudoku-board',

  // HTML template used by the component.
  templateUrl: './sudoku-board.html',

  // CSS file used by the component.
  styleUrl: './sudoku-board.css',
})
export class SudokuBoard {
  // Inject the Sudoku service so the component can communicate
  // with the backend API.
  private sudoku = inject(Sudoku);

  /*
    Stores the ID of the current Sudoku game.

    This does not need to be a signal because the template never
    reads it directly. It is only needed internally when sending
    validation requests to the backend.
  */
  gameId: string | null = null;

  /*
    Stores the current Sudoku board.

    A signal is used because the board is displayed in the template.
    When the signal changes, Angular updates the relevant parts
    of the UI.
  */
  board = signal<number[][]>(this.emptyBoard());

  /*
    Stores which cells were part of the original puzzle.

    True = original puzzle value / cannot be changed.
    False = empty cell or value entered by the player.
  */
  given = signal<boolean[][]>(this.emptyBoard().map((row) => row.map(() => false)));

  /*
    Stores the cell currently selected by the player.

    null means that no cell is currently selected.
  */
  selected = signal<Cell | null>(null);

  /*
    Stores the positions of cells that contain incorrect values.

    The position is stored as a string such as "2-5",
    representing row 2, column 5.
  */
  invalidCells = signal(new Set<string>());

  /*
    Stores the positions of cells that have been confirmed
    as correct by the backend.
  */
  correctCells = signal(new Set<string>());

  // Current player score.
  score = signal(0);

  // Number of incorrect moves made by the player.
  mistakes = signal(0);

  /*
    True while waiting for a backend request to finish.

    This is used to temporarily disable user interaction.
  */
  loading = signal(false);

  // Stores an error message that can be displayed to the player.
  errorMessage = signal<string | null>(null);

  /*
    Becomes true when the backend confirms that the puzzle
    has been completely solved.
  */
  solved = signal(false);

  /*
    Array containing the indexes of all 9 rows.

    Used by the @for loop in the HTML template.
  */
  readonly rows = Array.from({ length: 9 }, (_, i) => i);

  /*
    Array containing the indexes of all 9 columns.
  */
  readonly cols = Array.from({ length: 9 }, (_, i) => i);

  /*
    Numbers displayed on the Sudoku number pad.
  */
  readonly digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  /*
    Runs automatically when the component is created.

    Starting a new game here means the player immediately gets
    a Sudoku puzzle when the component loads.
  */
  constructor() {
    this.newGame();
  }

  /*
    Requests a new Sudoku puzzle from the backend.

    It also resets the state from the previous game.
  */
  newGame(): void {
    // Tell the UI that a request is currently in progress.
    this.loading.set(true);

    // Remove any previous error message.
    this.errorMessage.set(null);

    // A new game cannot be solved yet.
    this.solved.set(false);

    // Request a new game from the backend.
    this.sudoku.getNewGame().subscribe({
      /*
        Runs when the backend successfully returns a new game.
      */
      next: (game: SudokuGame) => {
        // Save the new game's ID for future validation requests.
        this.gameId = game.game_id;

        /*
          Copy the board returned by the backend.

          Creating new arrays prevents us from accidentally changing
          the original response data when modifying the board later.
        */
        this.board.set(game.board.map((row) => [...row]));

        /*
          Determine which cells are original puzzle values.

          A non-zero value means the backend provided that number
          as part of the starting puzzle.
        */
        this.given.set(game.board.map((row) => row.map((v) => v !== 0)));

        // Set the initial score returned by the backend.
        this.score.set(game.score);

        // Set the initial mistake count returned by the backend.
        this.mistakes.set(game.mistakes);

        // No cell should be selected when a new game starts.
        this.selected.set(null);

        // Remove all incorrect cell markings.
        this.invalidCells.set(new Set());

        // Remove all correct cell markings.
        this.correctCells.set(new Set());

        // The request has finished.
        this.loading.set(false);
      },

      /*
        Runs if the request fails.
      */
      error: (error) => {
        // Log the actual error to the browser console for debugging.
        console.error('Angular HTTP error:', error);

        // Allow the player to interact with the UI again.
        this.loading.set(false);

        // Show a user-friendly error message.
        this.errorMessage.set("Couldn't start a new game. Check that the backend is running.");
      },
    });
  }

  /*
    Selects a Sudoku cell.

    Original puzzle cells cannot be selected because they cannot
    be changed by the player.
  */
  selectCell(row: number, col: number): void {
    // Do nothing if this is an original puzzle cell.
    if (this.given()[row][col]) return;

    // Store the selected cell.
    this.selected.set({ row, col });
  }

  /*
    Returns true when the specified cell was part of the
    original Sudoku puzzle.
  */
  isGiven(row: number, col: number): boolean {
    return this.given()[row][col];
  }

  /*
    Returns true when the specified cell is currently selected.
  */
  isSelected(row: number, col: number): boolean {
    // Get the currently selected cell.
    const sel = this.selected();

    // Make sure a cell is selected and compare its coordinates.
    return !!sel && sel.row === row && sel.col === col;
  }

  /*
    Returns true when a cell shares a row, column, or 3x3 box
    with the currently selected cell.

    This allows the UI to highlight the relevant area of the board.
  */
  isInSelectedLine(row: number, col: number): boolean {
    // Get the currently selected cell.
    const sel = this.selected();

    // Nothing should be highlighted when no cell is selected.
    if (!sel) return false;

    /*
      Calculate whether the current cell and selected cell
      belong to the same 3x3 Sudoku box.
    */
    const sameBox =
      Math.floor(sel.row / 3) === Math.floor(row / 3) &&
      Math.floor(sel.col / 3) === Math.floor(col / 3);

    /*
      Return true when the cells share:
      - the same row
      - the same column
      - the same 3x3 box
    */
    return sel.row === row || sel.col === col || sameBox;
  }

  /*
    Checks whether a cell has been marked as invalid.
  */
  isInvalid(row: number, col: number): boolean {
    return this.invalidCells().has(this.cellKey(row, col));
  }

  /*
    Checks whether a cell has been confirmed as correct.
  */
  isCorrect(row: number, col: number): boolean {
    return this.correctCells().has(this.cellKey(row, col));
  }

  /*
    Enters a number into the selected cell.

    The value is first displayed immediately on the board,
    then the backend is asked whether the move is correct.
  */
  enterDigit(value: number): void {
    // Get the currently selected cell.
    const sel = this.selected();

    /*
      Stop if:
      - no cell is selected
      - a request is already running
      - the puzzle has already been solved
    */
    if (!sel || this.loading() || this.solved()) return;

    // Extract the row and column from the selected cell.
    const { row, col } = sel;

    // Original puzzle cells cannot be edited.
    if (this.given()[row][col]) return;

    // Create a unique key for this cell.
    const key = this.cellKey(row, col);

    /*
      Update the board immediately.

      The board is copied first so that we create a new array
      instead of modifying the existing signal value directly.
    */
    this.board.update((b) => {
      const next = b.map((r) => [...r]);
      next[row][col] = value;
      return next;
    });

    // Remove any previous correct/incorrect state for this cell.
    // The new value needs to be checked again.
    this.clearCellMarks(key);

    /*
      Make sure a game ID exists before attempting validation.

      Normally this will already exist because newGame() runs when
      the component starts.
    */
    if (!this.gameId) return;

    /*
      Send the player's move to the backend for validation.
    */
    this.sudoku.validate(this.gameId, row, col, value).subscribe({
      /*
        Runs when the backend successfully responds.
      */
      next: (res) => {
        /*
          If the backend reports an error, display it and stop.
        */
        if (res.error) {
          this.errorMessage.set(res.error);
          return;
        }

        /*
          Only update mistakes when the backend actually included
          a mistakes value in its response.
        */
        if (res.mistakes !== undefined) {
          this.mistakes.set(res.mistakes);
        }

        /*
          Only update score when the backend actually included
          a score value in its response.
        */
        if (res.score !== undefined) {
          this.score.set(res.score);
        }

        /*
          The backend confirmed that the entered number is correct.
        */
        if (res.valid) {
          // Mark the cell as correct.
          this.markCorrect(key);

          /*
            If the backend says the entire puzzle is complete,
            mark the game as solved.
          */
          if (res.complete) {
            this.solved.set(true);
          }
        } else {
          // The backend says the entered number is incorrect.
          this.markInvalid(key);
        }
      },

      /*
        Runs if the validation request itself fails.
      */
      error: () => {
        this.errorMessage.set("Couldn't reach the backend to check that move.");
      },
    });
  }

  /*
    Removes the value from the currently selected cell.

    Erasing is handled entirely on the frontend because there is
    no number that needs to be validated by the backend.
  */
  eraseSelected(): void {
    // Get the currently selected cell.
    const sel = this.selected();

    // Do nothing if no cell is selected or a request is running.
    if (!sel || this.loading()) return;

    // Extract the selected cell's coordinates.
    const { row, col } = sel;

    // Original puzzle cells cannot be erased.
    if (this.given()[row][col]) return;

    /*
      Replace the selected cell with 0.

      In this application, 0 represents an empty cell.
    */
    this.board.update((b) => {
      const next = b.map((r) => [...r]);
      next[row][col] = 0;
      return next;
    });

    // Remove any previous correct/incorrect marking.
    this.clearCellMarks(this.cellKey(row, col));

    /*
      If the puzzle had somehow been marked as solved,
      erasing a cell means it is no longer solved.
    */
    this.solved.set(false);
  }

  /*
    Marks a cell as incorrect.

    It also removes the cell from the correct set if it was
    previously marked as correct.
  */
  private markInvalid(key: string): void {
    // Add the cell to the invalid set.
    this.invalidCells.update((set) => new Set(set).add(key));

    /*
      Remove the cell from the correct set.

      If it isn't there, return the existing set rather than
      creating a new one unnecessarily.
    */
    this.correctCells.update((set) => {
      if (!set.has(key)) return set;

      const next = new Set(set);
      next.delete(key);
      return next;
    });
  }

  /*
    Marks a cell as correct.

    It also removes the cell from the invalid set if necessary.
  */
  private markCorrect(key: string): void {
    // Add the cell to the correct set.
    this.correctCells.update((set) => new Set(set).add(key));

    // Remove the cell from the invalid set.
    this.invalidCells.update((set) => {
      if (!set.has(key)) return set;

      const next = new Set(set);
      next.delete(key);
      return next;
    });
  }

  /*
    Removes a cell from both the correct and invalid sets.

    This is used when a player enters a new value or erases a value.
  */
  private clearCellMarks(key: string): void {
    // Remove the cell from the invalid set if it exists.
    this.invalidCells.update((set) => {
      if (!set.has(key)) return set;

      const next = new Set(set);
      next.delete(key);
      return next;
    });

    // Remove the cell from the correct set if it exists.
    this.correctCells.update((set) => {
      if (!set.has(key)) return set;

      const next = new Set(set);
      next.delete(key);
      return next;
    });
  }

  /*
    Creates a unique string for a cell using its row and column.

    Example:
    row = 2, col = 5
    key = "2-5"

    This is useful because JavaScript Sets compare objects by
    reference rather than by their contents.
  */
  private cellKey(row: number, col: number): string {
    return `${row}-${col}`;
  }

  /*
    Creates a completely empty 9x9 Sudoku board.

    Each cell starts with 0, which represents an empty cell.
  */
  private emptyBoard(): number[][] {
    return Array.from({ length: 9 }, () => Array(9).fill(0));
  }
}
