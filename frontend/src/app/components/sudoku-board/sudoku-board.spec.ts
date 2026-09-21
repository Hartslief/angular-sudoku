import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SudokuBoard } from './sudoku-board';

describe('SudokuBoard', () => {
  // Holds the actual component instance.
  let component: SudokuBoard;

  // Holds the component together with its Angular test environment.
  let fixture: ComponentFixture<SudokuBoard>;

  // Runs before each test.
  // This creates a fresh SudokuBoard component for every test.
  beforeEach(async () => {
    // Configure Angular's testing environment with the component.
    await TestBed.configureTestingModule({
      imports: [SudokuBoard],
    }).compileComponents();

    // Create an instance of the component.
    fixture = TestBed.createComponent(SudokuBoard);

    // Get the actual SudokuBoard instance from the fixture.
    component = fixture.componentInstance;

    // Wait until Angular has finished processing asynchronous work.
    await fixture.whenStable();
  });

  // Basic test to make sure the component can be created successfully.
  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
