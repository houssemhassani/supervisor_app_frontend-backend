// src/app/components/manager/leave-request-form/leave-request-form.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LeaveRequestFormComponent } from './leave-request-form';

describe('LeaveRequestFormComponent', () => {
  let component: LeaveRequestFormComponent;
  let fixture: ComponentFixture<LeaveRequestFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LeaveRequestFormComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(LeaveRequestFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});