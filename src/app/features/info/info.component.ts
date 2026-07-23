import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

interface InfoPageData {
  eyebrow: string;
  title: string;
  intro: string;
  sections: Array<{ title: string; body: string }>;
}

@Component({
  selector: 'app-info',
  imports: [RouterLink],
  templateUrl: './info.component.html',
  styleUrl: './info.component.scss',
})
export class InfoComponent {
  private readonly route = inject(ActivatedRoute);
  protected readonly page = this.route.snapshot.data as InfoPageData;
}
