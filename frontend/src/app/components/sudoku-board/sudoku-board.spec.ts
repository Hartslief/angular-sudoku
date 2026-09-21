import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SudokuBoard } from './sudoku-board';

describe('SudokuBoard', () => {
  let component: SudokuBoard;
  let fixture: ComponentFixture<SudokuBoard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SudokuBoard],
    }).compileComponents();

    fixture = TestBed.createComponent(SudokuBoard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
