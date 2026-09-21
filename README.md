# Angular Sudoku

A Sudoku game built with **Angular** and a custom **Python ASGI backend**.

The Angular application handles the user interface and reactive game state, while the Python backend provides the Sudoku game API, puzzle generation, move validation, scoring, and game state management.

## Features

* Generate a new Sudoku puzzle
* 9x9 Sudoku board
* Select editable cells
* Lock original puzzle cells
* Enter numbers from 1–9
* Erase cell values
* Highlight the selected cell
* Highlight the selected cell's row, column, and 3x3 box
* Correct cell highlighting
* Incorrect cell highlighting
* Score tracking
* Mistake tracking
* Loading state
* Error messages
* Solved game detection
* Responsive board layout
* Randomly generated Sudoku puzzles
* Backend move validation

## Technologies

### Frontend

* Angular
* TypeScript
* Angular Signals
* RxJS
* Angular HttpClient
* HTML
* CSS

### Backend

* Python
* ASGI
* Python `json`
* Python `uuid`
* Python `random`
* Custom Sudoku game logic
* Custom Sudoku puzzle generator

No Tina4 framework is used in this project.

## Project Architecture

The project consists of an Angular frontend communicating with a custom Python ASGI backend.

```text
┌─────────────────────────┐
│     Angular Frontend    │
│                         │
│  SudokuBoard Component  │
│  Angular Signals        │
│  Sudoku Service         │
└────────────┬────────────┘
             │
             │ HTTP
             ▼
┌─────────────────────────┐
│    Python ASGI API      │
│                         │
│    sudoku_routes()      │
│          │              │
│          ▼              │
│      SudokuGame         │
│          │              │
│          ▼              │
│    SudokuGenerator      │
└─────────────────────────┘
```

## Project Structure

A simplified structure is:

```text
angular-sudoku/
├── frontend/
│   └── src/
│       └── app/
│           ├── components/
│           │   └── sudoku-board/
│           │       ├── sudoku-board.ts
│           │       ├── sudoku-board.html
│           │       ├── sudoku-board.css
│           │       └── sudoku-board.spec.ts
│           │
│           ├── services/
│           │   └── sudoku.ts
│           │
│           ├── app.ts
│           ├── app.html
│           ├── app.css
│           └── app.config.ts
│
└── backend/
    └── src/
        └── backend/
            ├── routes/
            │   └── sudoku.py
            │
            ├── game.py
            └── generator.py
```

The exact directory names may differ depending on how the project was scaffolded.

# Angular Frontend

## SudokuBoard Component

The main game functionality is contained in the `SudokuBoard` component.

It manages:

* The current board
* Original puzzle cells
* Selected cell
* Correct cells
* Incorrect cells
* Score
* Mistakes
* Loading state
* Error messages
* Completion state

## Angular Signals

The application uses Angular Signals for state that is displayed or interacted with by the template.

For example:

```ts
board = signal<number[][]>(this.emptyBoard());

score = signal(0);

mistakes = signal(0);

solved = signal(false);
```

When a signal changes, Angular automatically updates the parts of the template that depend on it.

## Given Cells

The original Sudoku puzzle is stored separately from the current board:

```ts
given = signal<boolean[][]>(
  this.emptyBoard().map((row) => row.map(() => false))
);
```

A cell is considered a given when the original puzzle contains a non-zero value:

```ts
this.given.set(
  game.board.map((row) => row.map((v) => v !== 0))
);
```

Given cells cannot be edited by the player.

## Cell Selection

The currently selected cell is stored using:

```ts
selected = signal<Cell | null>(null);
```

The application also highlights cells that share a:

* Row
* Column
* 3x3 box

with the selected cell.

This is implemented using:

```ts
isInSelectedLine(row, col)
```

## Correct and Incorrect Cells

The application keeps two sets of cell coordinates:

```ts
invalidCells = signal(new Set<string>());

correctCells = signal(new Set<string>());
```

A cell is represented by a string such as:

```text
2-5
```

which means:

```text
row 2
column 5
```

This allows individual cells to be marked as correct or incorrect without maintaining a separate state object for every cell.

# Angular Service

The `Sudoku` service is responsible for communicating with the Python backend.

It uses Angular's `HttpClient`:

```ts
private http = inject(HttpClient);
```

The API base URL is:

```ts
private apiUrl = 'http://127.0.0.1:7146/api/sudoku';
```

## Create New Game

The frontend calls:

```ts
getNewGame()
```

which performs:

```http
GET /api/sudoku/new
```

The backend returns:

```json
{
  "game_id": "example-game-id",
  "board": [
    [5, 3, 0, 0, 7, 0, 0, 0, 0],
    [6, 0, 0, 1, 9, 5, 0, 0, 0],
    [0, 9, 8, 0, 0, 0, 0, 6, 0]
  ],
  "score": 0,
  "mistakes": 0
}
```

The Angular component then uses this response to initialise the game.

## Validate Move

When the player enters a number, Angular sends:

```http
POST /api/sudoku/validate
```

with:

```json
{
  "game_id": "example-game-id",
  "row": 0,
  "col": 2,
  "number": 4
}
```

The backend validates the move and returns information such as:

```json
{
  "valid": true,
  "score": 10,
  "mistakes": 0,
  "complete": false
}
```

The Angular component then updates its signals based on the response.

# Python Backend

The backend is a custom ASGI application.

It does not use a web framework for routing.

The application's entry point forwards requests to the Sudoku route handler:

```python
async def app(scope, receive, send):
    await sudoku_routes(scope, receive, send)
```

## ASGI Routing

The `sudoku_routes()` function examines the HTTP method and request path:

```python
method = scope["method"]
path = scope["path"]
```

It manually handles:

```text
GET  /api/sudoku/new
POST /api/sudoku/validate
OPTIONS
```

Unknown routes return:

```json
{
  "error": "not found"
}
```

with HTTP status `404`.

## CORS

Because the Angular development server and Python backend run on different origins, the backend provides CORS headers:

```python
CORS_HEADERS = [
    [b"access-control-allow-origin", b"http://localhost:4200"],
    [b"access-control-allow-methods", b"GET, POST, OPTIONS"],
    [b"access-control-allow-headers", b"Content-Type"],
]
```

This allows the Angular application running on:

```text
http://localhost:4200
```

to communicate with the backend.

The backend also handles `OPTIONS` requests for browser CORS preflight requests.

# SudokuGame

`SudokuGame` manages the state and rules of active Sudoku games.

A shared instance is created by the routes module:

```python
game_manager = SudokuGame()
```

Games are stored in memory using a class-level dictionary:

```python
games = {}
```

Each game is identified by a UUID.

A game contains:

```python
{
    "id": game_id,
    "puzzle": generated["puzzle"],
    "solution": generated["solution"],
    "moves": [],
    "mistakes": 0,
    "score": 0,
    "completed": False,
    "difficulty": "Easy",
}
```

## Game Validation

`validate_move()` performs several checks.

### 1. Game Exists

The backend first checks whether the supplied game ID exists.

### 2. Valid Cell

The row and column must be between `0` and `8`.

### 3. Valid Number

The entered number must be between `1` and `9`.

### 4. Locked Cell

The backend prevents the player from changing cells that were part of the original puzzle.

### 5. Correct Number

The entered number is compared against the stored solution.

If it is incorrect:

```python
game["mistakes"] += 1
```

The response includes the updated mistake count and score.

### 6. Correct Move

Correct moves are stored in the game's `moves` list.

### 7. Completion

After a correct move, the backend reconstructs the current board and checks whether every cell has been filled.

If no empty cells remain, the game is marked as completed.

# Scoring

The backend calculates the score using:

```python
correct_moves = len(game["moves"])
mistakes = game["mistakes"]

score = (correct_moves * 10) - (mistakes * 5)
```

The score cannot become negative:

```python
return max(score, 0)
```

Therefore:

* Correct move = `+10`
* Mistake = `-5`
* Minimum score = `0`

# Sudoku Generator

`SudokuGenerator` is responsible for creating Sudoku puzzles.

The generator:

1. Creates an empty 9x9 board.
2. Generates a complete valid Sudoku solution.
3. Copies the solution.
4. Removes numbers from the copy.
5. Returns both the puzzle and solution.

```python
return {
    "puzzle": puzzle,
    "solution": solution,
}
```

The backend currently generates games with:

```python
game_manager.new_game(clues=40)
```

This creates a puzzle starting with 40 clues.

## Puzzle Generation Algorithm

The solution is generated using recursive backtracking.

The generator:

1. Finds an empty cell.
2. Creates the numbers 1–9.
3. Randomly shuffles the numbers.
4. Tries each number.
5. Checks whether the number is valid.
6. Recursively fills the next empty cell.
7. Backtracks when a dead end is reached.

This produces a valid completed Sudoku board.

## Sudoku Validation

A number is considered valid when it does not already exist in:

* The same row
* The same column
* The same 3x3 box

For example, the generator checks the relevant 3x3 box using:

```python
box_row = (row // self.BOX_SIZE) * self.BOX_SIZE
box_col = (col // self.BOX_SIZE) * self.BOX_SIZE
```

# API Endpoints

| Method  | Endpoint               | Purpose                    |
| ------- | ---------------------- | -------------------------- |
| GET     | `/api/sudoku/new`      | Generate a new Sudoku game |
| POST    | `/api/sudoku/validate` | Validate a player's move   |
| OPTIONS | `/api/sudoku/new`      | CORS preflight             |
| OPTIONS | `/api/sudoku/validate` | CORS preflight             |

## `GET /api/sudoku/new`

Creates a new game.

Example response:

```json
{
  "game_id": "51f6216d-6a11-4b44-94c5-5e8b1a4eb836",
  "board": [
    [5, 3, 0, 0, 7, 0, 0, 0, 0],
    [6, 0, 0, 1, 9, 5, 0, 0, 0],
    [0, 9, 8, 0, 0, 0, 0, 6, 0]
  ],
  "score": 0,
  "mistakes": 0
}
```

The solution is intentionally not returned to the frontend.

## `POST /api/sudoku/validate`

Validates a move.

Request:

```json
{
  "game_id": "51f6216d-6a11-4b44-94c5-5e8b1a4eb836",
  "row": 0,
  "col": 2,
  "number": 4
}
```

Successful move:

```json
{
  "valid": true,
  "complete": false,
  "score": 10,
  "mistakes": 0
}
```

Incorrect move:

```json
{
  "valid": false,
  "mistakes": 1,
  "score": 0
}
```

Invalid game:

```json
{
  "valid": false,
  "error": "Game not found"
}
```

# Running the Backend

Start the Python ASGI backend using the project's configured ASGI server.

The backend must be available on:

```text
http://127.0.0.1:7146
```

The Angular service expects the API at:

```text
http://127.0.0.1:7146/api/sudoku
```

# Running the Angular Application

Install the frontend dependencies:

```bash
npm install
```

Start the Angular development server:

```bash
ng serve
```

The Angular application should be available at:

```text
http://localhost:4200
```

The Python backend should be running at the same time.

# Gameplay

1. Start the Python backend.
2. Start the Angular development server.
3. Angular requests a new Sudoku game.
4. The backend generates a puzzle and game ID.
5. The puzzle is displayed in the browser.
6. Select an empty cell.
7. Enter a number using the number pad.
8. Angular sends the move to the backend.
9. The backend checks the number against the solution.
10. The frontend marks the cell as correct or incorrect.
11. Score and mistakes are updated from the backend response.
12. When every cell has been correctly filled, the game displays `Solved!`.

# Testing

The project includes an Angular unit test for the `SudokuBoard` component.

The basic test verifies that the component can be created:

```ts
it('should create', () => {
  expect(component).toBeTruthy();
});
```

The test environment uses Angular's `TestBed`:

```ts
await TestBed.configureTestingModule({
  imports: [SudokuBoard],
}).compileComponents();
```

# Future Improvements

Potential future improvements include:

* Undo functionality
* Difficulty selection
* More advanced difficulty generation
* Persistent game storage
* Timer
* Additional Sudoku validation
* More comprehensive unit tests
* Backend tests
* Improved API error handling
* Production CORS configuration
* Authentication and user accounts

## Purpose

This project demonstrates building a complete Sudoku application using **Angular Signals and components on the frontend** and a **custom Python ASGI backend** for game generation, validation, scoring, and game state management.
