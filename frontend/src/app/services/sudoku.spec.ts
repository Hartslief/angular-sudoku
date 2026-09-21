import { TestBed } from '@angular/core/testing';

import { Sudoku } from './sudoku';

describe('Sudoku', () => {
  let service: Sudoku;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Sudoku);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
