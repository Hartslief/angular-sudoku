import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface SudokuGame {
  game_id: string;
  board: number[][];
  score: number;
  mistakes: number;
}

export interface ValidateResponse {
  valid: boolean;
  score?: number;
  mistakes?: number;
  complete?: boolean;
  error?: string;
}

export interface UndoResponse {
  success: boolean;
  board?: number[][];
  score?: number;
  mistakes?: number;
  row?: number;
  col?: number;
  error?: string;
}

@Injectable({
  providedIn: 'root',
})
export class Sudoku {
  private http = inject(HttpClient);
  private apiUrl = 'http://127.0.0.1:7146/api/sudoku';

  getNewGame(): Observable<SudokuGame> {
    console.log('New board is running...');
    console.log('Request URL:', `${this.apiUrl}/new`);

    return this.http.get<SudokuGame>(`${this.apiUrl}/new`);
  }

  validate(gameId: string, row: number, col: number, value: number): Observable<ValidateResponse> {
    console.log('Request URL:', `${this.apiUrl}/validate`);
    return this.http.post<ValidateResponse>(`${this.apiUrl}/validate`, {
      game_id: gameId,
      row,
      col,
      number: value,
    });
  }
}
