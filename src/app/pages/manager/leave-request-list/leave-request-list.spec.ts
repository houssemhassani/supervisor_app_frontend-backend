import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LeaveRequestList } from './leave-request-list';

describe('LeaveRequestList', () => {
  let component: LeaveRequestList;
  let fixture: ComponentFixture<LeaveRequestList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LeaveRequestList],
    }).compileComponents();

    fixture = TestBed.createComponent(LeaveRequestList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
