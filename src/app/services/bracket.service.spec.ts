import { TestBed } from '@angular/core/testing';

import { BracketService } from './bracket.service';

describe('BracketService', () => {
  let service: BracketService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BracketService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
