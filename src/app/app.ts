import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ReactiveFormsModule } from '@angular/forms';
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet,ReactiveFormsModule,
MatCardModule,
MatInputModule,
MatIconModule,
MatButtonModule],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class App {

  protected readonly title = signal('supervisor-app-frontend');

}