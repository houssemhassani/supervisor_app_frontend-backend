import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AttendanceManagementComponent } from './attendancemanagement';

describe('AttendanceManagementComponent', () => {
  let component: AttendanceManagementComponent;
  let fixture: ComponentFixture<AttendanceManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AttendanceManagementComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AttendanceManagementComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
