import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

/*
  Represents the data returned when a new Sudoku game is created.
*/
export interface SudokuGame {
  game_id: string;
  board: number[][];
  score: number;
  mistakes: number;
}

/*
  Represents the response returned when validating a move.
*/
export interface ValidateResponse {
  valid: boolean;
  score?: number;
  mistakes?: number;
  complete?: boolean;
  error?: string;
}

/*
  Represents the response that would be returned by an undo operation.

  This interface is currently defined for future undo functionality.
*/
export interface UndoResponse {
  success: boolean;
  board?: number[][];
  score?: number;
  mistakes?: number;
  row?: number;
  col?: number;
  error?: string;
}

/*
  Makes this service available throughout the Angular application.
*/
@Injectable({
  providedIn: 'root',
})
export class Sudoku {
  // Inject Angular's HttpClient for making API requests.
  private http = inject(HttpClient);

  /*
    Base URL for the Sudoku backend API.

    Individual methods add endpoints such as /new and /validate.
  */
  private apiUrl = 'http://127.0.0.1:7146/api/sudoku';

  /*
    Requests a new Sudoku game from the backend.
  */
  getNewGame(): Observable<SudokuGame> {
    // Helpful message for debugging in the browser console.
    console.log('New board is running...');

    // Display the exact URL being requested.
    console.log('Request URL:', `${this.apiUrl}/new`);

    // Send a GET request to create a new game.
    return this.http.get<SudokuGame>(`${this.apiUrl}/new`);
  }

  /*
    Sends a player's Sudoku move to the backend for validation.

    The backend receives:
    - game ID
    - row
    - column
    - number entered by the player
  */
  validate(gameId: string, row: number, col: number, value: number): Observable<ValidateResponse> {
    // Display the endpoint being called for debugging.
    console.log('Request URL:', `${this.apiUrl}/validate`);

    // Send the move to the backend as a POST request.
    return this.http.post<ValidateResponse>(`${this.apiUrl}/validate`, {
      game_id: gameId,
      row,
      col,
      number: value,
    });
  }
}
