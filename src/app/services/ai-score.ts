// src/app/services/ai-score.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AiScoreService {
  private iaApiUrl = 'http://localhost:5001/api';

  constructor(private http: HttpClient) {}

  calculateScore(employeeData: any): Observable<any> {
    return this.http.post(`${this.iaApiUrl}/calculate-score`, employeeData);
  }

  checkHealth(): Observable<any> {
    return this.http.get(`${this.iaApiUrl}/health`);
  }
}