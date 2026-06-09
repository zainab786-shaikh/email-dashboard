import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EmailService, Email } from './email.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  private emailService = inject(EmailService);

  // Raw email list
  emails = signal<Email[]>([]);
  
  // Categorization structure
  categories = signal<{ [key: string]: string[] }>({});
  
  // State for selections
  selectedCategory = signal<string>('');
  selectedSubcategory = signal<string>('');
  
  // Sidebar accordion expansion states
  expandedCategories = signal<{ [key: string]: boolean }>({});
  
  // Search & Filter state
  searchTerm = signal<string>('');
  resourceFilter = signal<string>('all'); // 'all', 'youtube', 'pdfs', 'websites', 'attachments'
  
  // Hidden/Removed emails state
  hiddenEmailKeys = signal<Set<string>>(new Set());
  showHidden = signal<boolean>(false);
  
  // Modal for Email Details
  activeEmail = signal<Email | null>(null);
  
  // Dark mode
  isDarkMode = signal<boolean>(true);

  // Mobile sidebar visibility
  isSidebarOpen = signal<boolean>(false);

  // Computed: get subcategory list for current category
  currentSubcategories = computed(() => {
    const cat = this.selectedCategory();
    return cat ? this.categories()[cat] || [] : [];
  });

  // Computed: filtered email list based on category, subcategory, search, and filters
  filteredEmails = computed(() => {
    let list = this.emails();
    const cat = this.selectedCategory();
    const sub = this.selectedSubcategory();
    const search = this.searchTerm().toLowerCase();
    const filter = this.resourceFilter();
    const hiddenSet = this.hiddenEmailKeys();
    const showHid = this.showHidden();

    // Filter by Hidden status
    list = list.filter(e => {
      const key = this.getEmailKey(e);
      const isHidden = hiddenSet.has(key);
      return showHid ? isHidden : !isHidden;
    });

    // Filter by Category
    if (cat) {
      list = list.filter(e => e.category === cat);
    }
    
    // Filter by Subcategory
    if (sub) {
      list = list.filter(e => e.subcategory === sub);
    }

    // Filter by Resource Type
    if (filter === 'youtube') {
      list = list.filter(e => e.links?.youtube && e.links.youtube.length > 0);
    } else if (filter === 'pdfs') {
      list = list.filter(e => (e.links?.pdfs && e.links.pdfs.length > 0) || e.attachments?.some(a => a.name.toLowerCase().endsWith('.pdf')));
    } else if (filter === 'websites') {
      list = list.filter(e => {
        const sites = e.links?.websites || [];
        // Filter out boilerplate Microsoft & W3 links
        const cleanSites = sites.filter(s => !s.includes('schemas.microsoft.com') && !s.includes('w3.org'));
        return cleanSites.length > 0;
      });
    } else if (filter === 'attachments') {
      list = list.filter(e => e.attachments && e.attachments.length > 0);
    }

    // Filter by Search Query
    if (search) {
      list = list.filter(e => 
        (e.subject && e.subject.toLowerCase().includes(search)) ||
        (e.clean_body && e.clean_body.toLowerCase().includes(search)) ||
        (e.from && e.from.toLowerCase().includes(search))
      );
    }

    return list;
  });

  ngOnInit() {
    this.emailService.getEmails().subscribe({
      next: (data) => {
        this.emails.set(data);
        
        // Group categories/subcategories
        const structure = this.emailService.getCategoriesAndSubcategories(data);
        this.categories.set(structure);

        // Pre-select first category and subcategory
        const firstCat = Object.keys(structure)[0] || '';
        if (firstCat) {
          this.selectCategory(firstCat);
          const firstSub = structure[firstCat][0] || '';
          if (firstSub) {
            this.selectSubcategory(firstSub);
          }
        }
      },
      error: (err) => console.error('Error loading emails:', err)
    });
  }

  selectCategory(category: string) {
    this.selectedCategory.set(category);
    // Expand category in sidebar
    this.expandedCategories.update(prev => ({
      ...prev,
      [category]: true
    }));
    // Default select first subcategory in this category
    const subs = this.categories()[category] || [];
    if (subs.length > 0) {
      this.selectedSubcategory.set(subs[0]);
    } else {
      this.selectedSubcategory.set('');
    }
    // Close sidebar on mobile selection
    this.isSidebarOpen.set(false);
  }

  toggleCategoryAccordion(category: string, event: Event) {
    event.stopPropagation();
    this.expandedCategories.update(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  }

  selectSubcategory(subcategory: string) {
    this.selectedSubcategory.set(subcategory);
    // Close sidebar on mobile selection
    this.isSidebarOpen.set(false);
  }

  toggleSidebar() {
    this.isSidebarOpen.update(open => !open);
  }

  closeSidebar() {
    this.isSidebarOpen.set(false);
  }

  openEmail(email: Email) {
    this.activeEmail.set(email);
  }

  closeEmail() {
    this.activeEmail.set(null);
  }

  toggleTheme() {
    this.isDarkMode.update(dark => !dark);
  }

  // Helper to extract clean websites (excluding boilerplate MS/W3 namespaces)
  getCleanWebsites(email: Email): string[] {
    const sites = email.links?.websites || [];
    return sites.filter(s => !s.includes('schemas.microsoft.com') && !s.includes('w3.org'));
  }

  // Dynamic resource parsing from link arrays and body text
  getParsedResources(email: Email): { url: string; type: string; label: string }[] {
    const urls = new Set<string>();
    const resources: { url: string; type: string; label: string }[] = [];

    const addResource = (url: string) => {
      const trimmed = url.trim();
      if (!trimmed || urls.has(trimmed)) return;
      if (trimmed.includes('schemas.microsoft.com') || trimmed.includes('w3.org')) return;
      
      urls.add(trimmed);
      
      let type = 'web';
      
      const lower = trimmed.toLowerCase();
      if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
        type = 'youtube';
      } else if (lower.endsWith('.pdf') || lower.includes('.pdf') || lower.includes('/pdf/')) {
        type = 'pdf';
      } else if (lower.includes('github.com')) {
        type = 'github';
      } else if (lower.includes('udemy.com') || lower.includes('pluralsight.com') || lower.includes('course')) {
        type = 'course';
      }
      
      resources.push({ url: trimmed, type, label: trimmed });
    };

    // 1. Add links from json object arrays
    if (email.links) {
      const linkArrays = [
        ...(email.links.youtube || []),
        ...(email.links.pdfs || []),
        ...(email.links.articles || []),
        ...(email.links.websites || [])
      ];
      for (const u of linkArrays) {
        addResource(u);
      }
    }

    // 2. Extract links from clean_body via regex
    if (email.clean_body) {
      const urlRegex = /(https?:\/\/[^\s"']+\b)/g;
      const matches = email.clean_body.match(urlRegex) || [];
      for (const m of matches) {
        // Strip trailing punctuation often caught in regex from body text
        const cleanUrl = m.replace(/[\)\.,;>]+$/, '');
        addResource(cleanUrl);
      }
    }

    return resources;
  }

  // Redirect helper to open links
  redirectToLink(url: string) {
    window.open(url, '_blank');
  }

  // Get human readable file size
  formatBytes(bytes: number, decimals = 2) {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  // Hidden email helpers
  getEmailKey(email: Email): string {
    return `${email.subject}_${email.date}`;
  }

  toggleHideEmail(email: Email, event: Event) {
    event.stopPropagation();
    const key = this.getEmailKey(email);
    this.hiddenEmailKeys.update(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  isHidden(email: Email): boolean {
    return this.hiddenEmailKeys().has(this.getEmailKey(email));
  }

  restoreAllEmails() {
    this.hiddenEmailKeys.set(new Set());
  }
}
