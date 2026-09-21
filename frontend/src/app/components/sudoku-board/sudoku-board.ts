import { Component, inject, signal } from '@angular/core';
import { Sudoku, SudokuGame } from '../../services/sudoku';

interface Cell {
  row: number;
  col: number;
}

@Component({
  selector: 'app-sudoku-board',
  templateUrl: './sudoku-board.html',
  styleUrl: './sudoku-board.css',
})
export class SudokuBoard {
  private sudoku = inject(Sudoku);

  // Not a signal: never read from the template, only used internally to
  // tag outgoing requests to the current game. No need for it to trigger
  // change detection.
  gameId: string | null = null;

  // Core board state. All of these are signals (rather than plain fields)
  // because Angular is zoneless — the view only re-renders when a signal
  // changes, an @Input updates, or an async pipe emits, so state that's
  // read in the template has to live in a signal.
  board = signal<number[][]>(this.emptyBoard());

  // Marks which cells came from the original puzzle vs. were entered by
  // the player, so given cells can be locked/styled differently.
  given = signal<boolean[][]>(this.emptyBoard().map((row) => row.map(() => false)));

  // Currently selected cell (null when nothing is selected). Cleared
  // whenever a new game loads.
  selected = signal<Cell | null>(null);

  // Cell coordinates (as "row-col" strings) currently flagged as wrong,
  // and separately as confirmed correct. Kept as two sets rather than one
  // enum-per-cell grid for cheap add/remove without touching the whole
  // grid, and because a cell can be in neither set (untouched/erased).
  invalidCells = signal(new Set<string>());
  correctCells = signal(new Set<string>());

  score = signal(0);
  mistakes = signal(0);

  // Disables input and dims the board while a request is in flight.
  loading = signal(false);
  errorMessage = signal<string | null>(null);

  // True once the backend reports the puzzle is fully and correctly filled.
  solved = signal(false);

  // Static lookup arrays for the template's @for loops — 0-8 for rows/cols
  // and 1-9 for the number pad. Computed once since the board size never
  // changes.
  readonly rows = Array.from({ length: 9 }, (_, i) => i);
  readonly cols = Array.from({ length: 9 }, (_, i) => i);
  readonly digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  // Kick off a game as soon as the component is created so the board
  // isn't empty on first render.
  constructor() {
    this.newGame();
  }

  // Fetches a fresh puzzle from the backend and resets all per-game state
  // (board, marks, score, mistakes, solved) to match it.
  newGame(): void {
    // Reset all per-game state before the request resolves, so the UI
    // immediately reflects "starting over" rather than showing stale
    // data from the previous game while waiting on the network.
    this.loading.set(true);
    this.errorMessage.set(null);
    this.solved.set(false);
    this.sudoku.getNewGame().subscribe({
      next: (game: SudokuGame) => {
        this.gameId = game.game_id;
        // Copy the board/given arrays (map + spread) rather than storing
        // the response arrays directly, so later in-place-looking updates
        // never accidentally mutate a reference shared with anything else.
        this.board.set(game.board.map((row) => [...row]));
        // A cell counts as "given" if the server sent a non-zero value for
        // it — those cells are part of the original puzzle and are locked.
        this.given.set(game.board.map((row) => row.map((v) => v !== 0)));
        this.score.set(game.score);
        this.mistakes.set(game.mistakes);
        this.selected.set(null);
        this.invalidCells.set(new Set());
        this.correctCells.set(new Set());
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Angular HTTP error:', error);
        this.loading.set(false);
        this.errorMessage.set("Couldn't start a new game. Check that the backend is running.");
      },
    });
  }

  // Selects a cell so the number pad / erase actions apply to it. Given
  // (puzzle) cells can't be selected since they can't be edited.
  selectCell(row: number, col: number): void {
    if (this.given()[row][col]) return;
    this.selected.set({ row, col });
  }

  // True if this cell was part of the original puzzle (locked, not
  // player-editable).
  isGiven(row: number, col: number): boolean {
    return this.given()[row][col];
  }

  // True if this cell is the currently selected one.
  isSelected(row: number, col: number): boolean {
    const sel = this.selected();
    return !!sel && sel.row === row && sel.col === col;
  }

  // True if this cell shares a row, column, or 3x3 box with the selected
  // cell — used to highlight the selected cell's row/column/box, a
  // standard Sudoku visual aid for spotting conflicts at a glance.
  isInSelectedLine(row: number, col: number): boolean {
    const sel = this.selected();
    if (!sel) return false;
    const sameBox =
      Math.floor(sel.row / 3) === Math.floor(row / 3) &&
      Math.floor(sel.col / 3) === Math.floor(col / 3);
    return sel.row === row || sel.col === col || sameBox;
  }

  // True if this cell's current value has been flagged as incorrect by
  // the backend.
  isInvalid(row: number, col: number): boolean {
    return this.invalidCells().has(this.cellKey(row, col));
  }

  // True if this cell's current value has been confirmed correct by the
  // backend.
  isCorrect(row: number, col: number): boolean {
    return this.correctCells().has(this.cellKey(row, col));
  }

  // Enters a digit into the selected cell, optimistically updates the
  // board locally, then asks the backend to validate the move and marks
  // the cell correct/invalid (and checks for a win) based on the response.
  enterDigit(value: number): void {
    const sel = this.selected();
    // Guard against entering digits with nothing selected, mid-request,
    // or after the puzzle is already solved.
    if (!sel || this.loading() || this.solved()) return;
    const { row, col } = sel;
    if (this.given()[row][col]) return;
    const key = this.cellKey(row, col);

    // Update the board optimistically so the digit appears immediately,
    // before the backend confirms whether it's correct.
    this.board.update((b) => {
      const next = b.map((r) => [...r]);
      next[row][col] = value;
      return next;
    });
    // Clear any previous correct/invalid marking on this cell — it's
    // about to be re-evaluated by the backend.
    this.clearCellMarks(key);

    // Without a game_id there's no game to validate against (shouldn't
    // normally happen once newGame() has resolved, but guards against a
    // race where the user interacts before the initial load finishes).
    if (!this.gameId) return;

    this.sudoku.validate(this.gameId, row, col, value).subscribe({
      next: (res) => {
        // Structural errors (bad game_id, out-of-bounds cell, locked
        // cell, etc.) come back with no score/mistakes/valid fields at
        // all — surface the message and stop rather than misreading
        // undefined values as valid state.
        if (res.error) {
          this.errorMessage.set(res.error);
          return;
        }
        // Only overwrite score/mistakes when the backend actually sent
        // them, so a partial response can't wipe out known-good state.
        if (res.mistakes !== undefined) this.mistakes.set(res.mistakes);
        if (res.score !== undefined) this.score.set(res.score);

        if (res.valid) {
          this.markCorrect(key);
          // "complete" is the backend's authoritative signal that every
          // cell is filled correctly — the win condition.
          if (res.complete) this.solved.set(true);
        } else {
          this.markInvalid(key);
        }
      },
      error: () => {
        this.errorMessage.set("Couldn't reach the backend to check that move.");
      },
    });
  }

  // Clears the selected cell's value and marks. Purely client-side (no
  // backend call), since there's nothing to validate about an empty cell.
  eraseSelected(): void {
    const sel = this.selected();
    if (!sel || this.loading()) return;
    const { row, col } = sel;
    if (this.given()[row][col]) return;
    this.board.update((b) => {
      const next = b.map((r) => [...r]);
      next[row][col] = 0;
      return next;
    });
    this.clearCellMarks(this.cellKey(row, col));
    // In case a previous move had triggered a (now stale) solved state,
    // erasing a cell means the board is no longer complete.
    this.solved.set(false);
  }

  // Flags a cell as invalid and removes it from the correct set, if
  // present. Only rebuilds correctCells when the key is actually in it,
  // to avoid triggering a signal change for a set that doesn't need one.
  private markInvalid(key: string): void {
    this.invalidCells.update((set) => new Set(set).add(key));
    this.correctCells.update((set) => {
      if (!set.has(key)) return set;
      const next = new Set(set);
      next.delete(key);
      return next;
    });
  }

  // Flags a cell as correct and removes it from the invalid set, if
  // present. Mirrors markInvalid but in the opposite direction.
  private markCorrect(key: string): void {
    this.correctCells.update((set) => new Set(set).add(key));
    this.invalidCells.update((set) => {
      if (!set.has(key)) return set;
      const next = new Set(set);
      next.delete(key);
      return next;
    });
  }

  // Removes a cell from both the invalid and correct sets — used before
  // re-evaluating a cell (new digit entered) or when it's erased.
  private clearCellMarks(key: string): void {
    this.invalidCells.update((set) => {
      if (!set.has(key)) return set;
      const next = new Set(set);
      next.delete(key);
      return next;
    });
    this.correctCells.update((set) => {
      if (!set.has(key)) return set;
      const next = new Set(set);
      next.delete(key);
      return next;
    });
  }

  // String key ("row-col") used to index into the invalid/correct sets,
  // since Set can't do structural equality on {row, col} objects.
  private cellKey(row: number, col: number): string {
    return `${row}-${col}`;
  }

  // Builds a fresh 9x9 grid of zeros, used both as the initial board/given
  // state and as a template for resetting per-game arrays.
  private emptyBoard(): number[][] {
    return Array.from({ length: 9 }, () => Array(9).fill(0));
  }
}
