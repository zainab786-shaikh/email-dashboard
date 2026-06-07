import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export interface EmailLink {
  youtube: string[];
  pdfs: string[];
  articles: string[];
  websites: string[];
}

export interface Attachment {
  name: string;
  type: string;
  size: number;
}

export interface Email {
  subject: string;
  from: string;
  to: string;
  date: string;
  clean_body: string;
  links: EmailLink;
  attachments: Attachment[];
  category: string;
  subcategory: string;
}

@Injectable({
  providedIn: 'root'
})
export class EmailService {
  private http = inject(HttpClient);

  getEmails(): Observable<Email[]> {
    return this.http.get<Email[]>('categorized_emails.json');
  }

  getCategoriesAndSubcategories(emails: Email[]): { [key: string]: string[] } {
    const categories: { [key: string]: Set<string> } = {};
    for (const email of emails) {
      const cat = email.category || 'Uncategorized';
      const subcat = email.subcategory || 'General';
      if (!categories[cat]) {
        categories[cat] = new Set<string>();
      }
      categories[cat].add(subcat);
    }

    const result: { [key: string]: string[] } = {};
    for (const cat of Object.keys(categories)) {
      result[cat] = Array.from(categories[cat]).sort();
    }
    return result;
  }
}
