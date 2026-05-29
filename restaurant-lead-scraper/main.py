import os
from datetime import datetime
from dotenv import load_dotenv
from scraper.client import InstagramClient
from scraper.search import Searcher
from scraper.filter import LeadFilter
from scraper.exporter import Exporter

import os
import time
import random
from datetime import datetime
from dotenv import load_dotenv
from scraper.client import InstagramClient
from scraper.search import Searcher
from scraper.filter import LeadFilter
from scraper.exporter import Exporter
from scraper.models import RestaurantLead

def main():
    print("--- Starting Scraper ---")
    load_dotenv()
    
    username = os.getenv("IG_USERNAME")
    password = os.getenv("IG_PASSWORD")
    session_id = os.getenv("IG_SESSIONID")
    
    print(f"Attempting to login as: {username}")
    
    if not username or not password:
        print("Error: IG_USERNAME or IG_PASSWORD not found in .env file.")
        return

    # 1. Login with session cache
    client = InstagramClient(username, password, session_id=session_id)
    try:
        print("Logging in to Instagram (this may take a minute)...")
        client.login()
        print("Login Successful!")
    except Exception as e:
        print(f"Login failed: {e}")
        return
    
    # 2. Search Strategy
    searcher = Searcher(client)
    filter_tool = LeadFilter()
    
    # We will use both Hashtags (more stable) and Locations
    target_hashtags = ["restaurantalger", "foodalgerie", "algeriafood", "dzfood"]
    target_locations = ["Algiers", "Oran"]
    
    all_usernames = set()
    
    # Try Hashtags first
    for tag in target_hashtags:
        usernames = searcher.search_by_hashtag(tag, amount=20)
        all_usernames.update(usernames)
        time.sleep(random.uniform(3, 5))

    # Try Locations as backup
    for loc in target_locations:
        usernames = searcher.search_by_location(loc, amount=20)
        all_usernames.update(usernames)
        time.sleep(random.uniform(3, 5))

    print(f"Total unique usernames found: {len(all_usernames)}")
    
    # 4. For each username -> fetch profile info
    leads = []
    
    for idx, user in enumerate(all_usernames):
        profile = client.get_profile(user)
        if not profile:
            continue
            
        # 5. Filter: skip obvious non-restaurants
        if filter_tool.is_restaurant(profile):
            # 6. Build RestaurantLead
            lead = RestaurantLead(
                username=profile['username'],
                full_name=profile.get('full_name', ''),
                bio=profile.get('biography', ''),
                followers=profile.get('follower_count', 0),
                following=profile.get('following_count', 0),
                post_count=profile.get('media_count', 0),
                website=profile.get('external_url'),
                profile_url=f"https://instagram.com/{profile['username']}",
                scraped_at=datetime.now()
            )
            leads.append(lead)
            print(f"[{idx+1}/{len(all_usernames)}] Found Restaurant: {user}")
        else:
            print(f"[{idx+1}/{len(all_usernames)}] Skipped: {user}")

        # CRITICAL: Sleep between profile fetches to avoid rate limits
        time.sleep(random.uniform(3, 7))

    # 7. Export leads
    if leads:
        Exporter.to_json(leads, "outputs/leads.json")
        Exporter.to_csv(leads, "outputs/leads.csv")
        print(f"Successfully exported {len(leads)} leads.")
    else:
        print("No restaurant leads found.")

if __name__ == "__main__":
    main()
