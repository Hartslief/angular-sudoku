import { Component } from '@angular/core';
import { SudokuBoard } from './components/sudoku-board/sudoku-board';

@Component({
  selector: 'app-root',
  imports: [SudokuBoard],
  templateUrl: 'app.html',
  styleUrl: 'app.css',
})
export class App {}
