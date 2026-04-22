import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Attendancemanagement } from './attendancemanagement';

describe('Attendancemanagement', () => {
  let component: Attendancemanagement;
  let fixture: ComponentFixture<Attendancemanagement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Attendancemanagement],
    }).compileComponents();

    fixture = TestBed.createComponent(Attendancemanagement);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
