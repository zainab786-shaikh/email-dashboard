import json
import os
import re

# Define rules for mapping
TAXONOMY = {
    "Programming & Software Engineering": {
        "Web Development & JavaScript": [
            "javascript", "js", "html", "css", "web development", "react", "angular", "vue", "typescript", "webapi", "web api", "jquery"
        ],
        "Systems Programming, Operating Systems & Linux": [
            "linux", "operating system", "kernel", "device driver", "bare metal", "stm32", "microcontroller",
            "rtos", "arm processor", "cortex", "virtual machine", "compiler", "parsing", "parser", "oscilloscope", "circuit", "hardware", "embedded", "firmware"
        ],
        "System Design, Cloud & Kubernetes": [
            "kubernetes", "docker", "cloud", "system design", "microservices", "aws", "gcp", "azure", "cloudskillsboost"
        ],
        "Data Structures & Algorithms": [
            "data structures", "algorithms", "functional programming", "concurrency"
        ],
        "C# & Concurrency": [
            "c#", "concurrency", "dotnet", ".net", "csharp"
        ],
        "Node.js & Backend": [
            "nodejs", "node.js", "backend", "express", "npm", "server"
        ],
        "General Programming & Developer Tools": [
            "programming", "coder", "coding", "git", "github", "visual studio", "python", "java", "c++", "android", "mobile", "developer", "code", "stackoverflow", "programming", "network", "networking", "tcp", "wireshark", "socket", "router", "switch", "routing", "c"
        ]
    },
    "Data Science, AI & Mathematics": {
        "Data Science, Machine Learning & AI": [
            "machine learning", "data science", "ai", "artificial intelligence", "pandas", "numpy", "tensorflow", "pytorch", "neural network", "deep learning"
        ],
        "Mathematics & Statistics": [
            "math", "mathematics", "statistics", "statistical", "algebra", "calculus", "geometry", "maths", "solving", "equation"
        ]
    },
    "Health, Insurance & Personal Finance": {
        "Mediclaim & Health Insurance": [
            "mediclaim", "tpa", "health card", "insurance policy", "mdindia", "health cards", "cashless", "insurance", "hospital", "ecard", "e-card"
        ],
        "Car Insurance": [
            "car insurance", "aveo", "vehicle insurance", "motor policy"
        ],
        "Tax, Rent & Financial Documents": [
            "tax return", "pan card", "aadhaar", "house property", "rent", "provident fund", "pan", "contribution", "priority", "consider", "pf"
        ]
    },
    "Education & Academics": {
        "Schools, Admissions & Marksheets": [
            "school", "high school", "admission", "marksheet", "ssc", "board", "hsc", "transfer certificate"
        ],
        "University & Prospectus": [
            "university", "prospectus", "college", "ycmou", "degree"
        ],
        "Books & General Reading": [
            "book", "reading", "read this book", "sapiens", "novel", "literature", "urdu"
        ]
    },
    "Personal & General Operations": {
        "Hardware Repairs & Technical Services": [
            "printer service", "repair", "service my printer", "hardware issue", "appointment"
        ],
        "Test / Uncategorized": [
            "test mail", "test email"
        ]
    }
}

def clean_and_tokenize(text):
    # Split CamelCase and numbers to make words readable, e.g. PythonBook1 -> Python Book 1
    text = re.sub(r'([a-z])([A-Z])', r'\1 \2', text)
    text = re.sub(r'([A-Za-z])([0-9])', r'\1 \2', text)
    text = re.sub(r'([0-9])([A-Za-z])', r'\1 \2', text)
    # Replace non-alphanumeric chars with spaces (but preserve characters like # and + for C# and C++)
    text = re.sub(r'[^a-zA-Z0-9#\+\s:/]', ' ', text)
    return text.lower()

def compile_pattern(pattern):
    # Escape regex special chars but keep # and +
    escaped = re.escape(pattern).replace('\\#', '#').replace('\\+', '+')
    
    start_anchor = r"\b"
    end_anchor = r"\b"
    
    if pattern.startswith(".") or pattern.startswith("\\."):
        start_anchor = r"(?<!\w)"
    if pattern.endswith("#") or pattern.endswith("+") or pattern.endswith("\\+"):
        end_anchor = r"(?!\w)"
        
    return re.compile(start_anchor + escaped + end_anchor, re.IGNORECASE)

def classify_email(email):
    subject = email.get("subject", "") or ""
    body = email.get("clean_body", "") or ""
    
    # Gather links
    links_text = []
    links = email.get("links", {}) or {}
    for key in ["youtube", "pdfs", "articles", "websites"]:
        links_text.extend(links.get(key, []) or [])
    
    # Filter out common standard Microsoft/W3 links that are boilerplate
    filtered_links = []
    for link in links_text:
        if "schemas.microsoft.com" not in link and "w3.org" not in link:
            filtered_links.append(link)
            
    links_str = " ".join(filtered_links)
    
    # Gather attachments
    attachments_str = " ".join([att.get("name", "") for att in email.get("attachments", []) or []])
    
    raw_text = f"{subject} {body} {links_str} {attachments_str}"
    tokenized_text = clean_and_tokenize(raw_text)
    
    best_cat = "Personal & General Operations"
    best_subcat = "General Notes & Conversations"
    max_score = 0
    
    # Scoring loop
    for cat, subcats in TAXONOMY.items():
        for subcat, patterns in subcats.items():
            score = 0
            for pattern in patterns:
                regex = compile_pattern(pattern)
                matches = len(regex.findall(tokenized_text))
                if matches > 0:
                    score += matches * 2
                    # Give extra weight if found in subject or attachment
                    if len(regex.findall(clean_and_tokenize(subject))) > 0:
                        score += 3
                    if len(regex.findall(clean_and_tokenize(attachments_str))) > 0:
                        score += 3
            
            if score > max_score:
                max_score = score
                best_cat = cat
                best_subcat = subcat
                
    # If no keywords matched, default based on presence of resources
    if max_score == 0:
        if "test" in subject.lower():
            best_cat = "Personal & General Operations"
            best_subcat = "Test / Uncategorized"
        elif filtered_links or email.get("attachments"):
            best_cat = "Personal & General Operations"
            best_subcat = "Uncategorized Resources"
        else:
            best_cat = "Personal & General Operations"
            best_subcat = "General Notes & Conversations"
            
    return best_cat, best_subcat

def main():
    input_file = '/Users/zainab/Documents/emails/email-json.json'
    output_file = '/Users/zainab/Documents/emails/categorized_emails.json'
    
    with open(input_file, 'r') as f:
        emails = json.load(f)
        
    stats = {}
    for email in emails:
        cat, subcat = classify_email(email)
        email["category"] = cat
        email["subcategory"] = subcat
        
        # Track stats
        stats[cat] = stats.get(cat, {})
        stats[cat][subcat] = stats[cat].get(subcat, 0) + 1
        
    with open(output_file, 'w') as f:
        json.dump(emails, f, indent=2)
        
    print("Email Categorization Done!")
    print("\nCategorization Breakdown:")
    for cat, subcats in stats.items():
        print(f"\n* {cat} ({sum(subcats.values())} emails)")
        for subcat, count in sorted(subcats.items(), key=lambda x: x[1], reverse=True):
            print(f"  - {subcat}: {count} emails")

if __name__ == "__main__":
    main()
