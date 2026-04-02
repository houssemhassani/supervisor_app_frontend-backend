import { TestBed } from '@angular/core/testing';

import { Manager } from './manager';

describe('Manager', () => {
  let service: Manager;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Manager);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
