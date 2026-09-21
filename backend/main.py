from src.backend.routes.sudoku import sudoku_routes

async def app(scope, receive, send):
    await sudoku_routes(scope, receive, send)