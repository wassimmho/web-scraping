import json
import os
import pandas as pd
from datetime import datetime

# Configuration
JSON_FILE = "leads.json"
EXCEL_FILE = "leads_tracker.xlsx"

# Columns matching the provided image
TRACKER_COLUMNS = [
    "Client", 
    "service", 
    "Contact", 
    "message sent?", 
    "Response", 
    "Working phase", 
    "starting date", 
    "comment"
]

def sync():
    if not os.path.exists(JSON_FILE):
        print(f"Error: {JSON_FILE} not found.")
        return

    # Load leads from JSON
    with open(JSON_FILE, "r", encoding="utf-8") as f:
        leads = json.load(f)

    # Load existing Excel data if it exists
    if os.path.exists(EXCEL_FILE):
        df_existing = pd.read_excel(EXCEL_FILE)
    else:
        df_existing = pd.DataFrame(columns=TRACKER_COLUMNS)

    new_rows = []
    
    # Process each lead from JSON
    for lead in leads:
        client_name = lead.get("Name", "N/A")
        
        # Check if already in tracker (avoid duplicates)
        if client_name in df_existing["Client"].values:
            continue
            
        # Format contact info
        phone = lead.get("Phone", "N/A")
        email = lead.get("Email", "N/A")
        contact = f"Phone: {phone}"
        if email != "N/A":
            contact += f" | Email: {email}"
            
        # Get first comment if available
        comments = lead.get("Comments", [])
        comment_preview = comments[0] if comments else ""

        # Pre-fill data for the tracker
        new_row = {
            "Client": client_name,
            "service": "Web/App Dev", # Default placeholder
            "Contact": contact,
            "message sent?": "Not sent", # Start status
            "Response": "",
            "Working phase": "Discovery",
            "starting date": datetime.now().strftime("%Y-%m-%d"),
            "comment": comment_preview
        }
        new_rows.append(new_row)

    # Combine existing and new if any
    if new_rows:
        df_new = pd.DataFrame(new_rows)
        df_final = pd.concat([df_existing, df_new], ignore_index=True)
        print(f"Adding {len(new_rows)} new leads...")
    else:
        df_final = df_existing
        print("No new leads, updating formatting...")

    # Save to Excel with custom column widths using openpyxl engine
    with pd.ExcelWriter(EXCEL_FILE, engine='openpyxl') as writer:
        df_final.to_excel(writer, index=False)
        worksheet = writer.book.active # Get the active sheet
        
        # Map column letters to width values
        # A=Client, B=service, C=Contact, D=message sent?, E=Response, F=Working phase, G=starting date, H=comment
        column_widths = {
            'A': 35, # Client
            'B': 20, # service
            'C': 50, # Contact
            'D': 15, # message sent?
            'E': 30, # Response
            'F': 20, # Working phase
            'G': 15, # starting date
            'H': 60  # comment
        }
        
        for col, width in column_widths.items():
            worksheet.column_dimensions[col].width = width

    print(f"Success! {EXCEL_FILE} has been updated and formatted.")

if __name__ == "__main__":
    sync()
