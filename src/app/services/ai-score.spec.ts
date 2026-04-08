import { TestBed } from '@angular/core/testing';

import { AiScore } from './ai-score';

describe('AiScore', () => {
  let service: AiScore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AiScore);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
