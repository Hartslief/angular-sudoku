import json
from .sudoku import SudokuGame

# Single shared instance of the game manager for the lifetime of the process.
# Holds all active games in memory (see SudokuGame.games), so every request
# handled by this module operates against the same in-memory store.
game_manager = SudokuGame()

# CORS headers applied to every response so the Angular dev server
# (running on localhost:4200) is allowed to call this API from the browser.
# Needed because the frontend and backend run on different origins/ports.
CORS_HEADERS = [
    [b"access-control-allow-origin", b"http://localhost:4200"],
    [b"access-control-allow-methods", b"GET, POST, OPTIONS"],
    [b"access-control-allow-headers", b"Content-Type"],
]

async def sudoku_routes(scope, receive, send):
    # Raw ASGI entrypoint: no framework routing here, just manual method +
    # path matching pulled straight off the ASGI `scope` dict.
    method = scope["method"]
    path = scope["path"]

    # Preflight requests sent by the browser before the real POST request
    # (triggered by non-simple headers like Content-Type: application/json).
    # Must be answered with 204 + CORS headers or the browser blocks the
    # actual request that follows.
    if method == "OPTIONS":
        await send_response(send, 204, {})
        return

    # GET /api/sudoku/new -> start a fresh game and return its puzzle.
    if method == "GET" and path == "/api/sudoku/new":
        await new_game(send)
        return

    # POST /api/sudoku/validate -> check a single cell entry against the
    # solution for an existing game.
    if method == "POST" and path == "/api/sudoku/validate":
        data = await read_json(receive)
        await validate_move(data, send)
        return

    # Anything else (typos, wrong method, unhandled OPTIONS) gets a real
    # response instead of an open connection with nothing coming back.
    await send_response(send, 404, {"error": "not found"})

async def new_game(send):
    """
    Generate a new Sudoku game with a specified number of clues (default is 40).
    """
    # Delegates puzzle/solution generation and game_id assignment to
    # SudokuGame; only the fields the frontend actually needs are sent back
    # (the solution is intentionally withheld from the response).
    game = game_manager.new_game(clues=40)

    await send_response(send, 200, {
        "game_id": game["id"],
        "board": game["puzzle"],
        "score": 0,
        "mistakes": 0
    })

async def validate_move(data, send):
    """
    Validate a player's move in the Sudoku game.
    """

    # Pull the move details out of the parsed request body. No validation
    # here on types/presence — SudokuGame.validate_move is responsible for
    # rejecting bad game_id/row/col/number values.
    game_id = data.get("game_id")
    row = data.get("row")
    col = data.get("col")
    number = data.get("number")

    result = game_manager.validate_move(
        game_id,
        row,
        col,
        number
    )

    # Whatever validate_move returns (valid/invalid, score, mistakes,
    # complete, or an error) is forwarded to the client as-is.
    await send_response(send, 200, result)


async def read_json(receive):
    # ASGI delivers the request body as a stream of "http.request" messages
    # rather than a single blob, so it has to be reassembled here by
    # concatenating chunks until `more_body` is False.
    body = b""

    while True:
        message = await receive()

        body += message.get("body", b"")

        if not message.get("more_body", False):
            break

    return json.loads(body)

async def send_response(send, status, data):
    # Serialize the response payload once so both ASGI messages below (the
    # header/status message and the body message) can be sent as a pair,
    # per the ASGI HTTP response protocol.
    body = json.dumps(data).encode("utf-8")

    await send({
        "type": "http.response.start",
        "status": status,
        "headers": [
            [b"content-type", b"application/json"],
            *CORS_HEADERS,
        ],
    })

    await send({
        "type": "http.response.body",
        "body": body,
    })