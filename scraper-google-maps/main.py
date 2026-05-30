import asyncio
import random
import json
import os
import shutil
from datetime import datetime
from playwright.async_api import async_playwright
import pandas as pd

class ScrapeProgress:
    """Helper to store logs for the web interface"""
    def __init__(self):
        self.logs = []
        self.status = "idle" # idle, running, waiting_for_user, finished
        self.total_leads = 0

    def log(self, message):
        timestamp = datetime.now().strftime("%H:%M:%S")
        full_msg = f"[{timestamp}] {message}"
        self.logs.append(full_msg)
        print(message)

progress = ScrapeProgress()

async def scrape_google_maps(config=None, p_manager=None):
    global progress
    if p_manager:
        progress = p_manager
    
    progress.status = "running"
    progress.log("--- Google Maps Scraper Started ---")
    
    # Predefined categories for easier selection
    categories = {
        "Digital & Tech": ["Agence de marketing", "Agence Web", "Expert SEO", "Développeur Freelance"],
        "Home Services": ["Plombier", "Electricien", "Serrurier", "Menuisier", "Peintre"],
        "Health & Wellness": ["Cabinet médical", "Dentiste", "Salle de sport", "Spa"],
        "Business & Legal": ["Cabinet d'avocats", "Agence immobilière", "Comptable"],
        "Hospitality": ["Restaurant", "Hôtel", "Café", "Pâtisserie"]
    }
    
    if not config:
        # TTY Interaction (Manual run)
        print("\nSelect a business category:")
        flat_categories = []
        idx = 1
        for group, cats in categories.items():
            print(f"\n--- {group} ---")
            for cat in cats:
                print(f"{idx}. {cat}")
                flat_categories.append(cat)
                idx += 1
        
        print(f"\n{idx}. Other (Enter manually)")
        
        choice = input(f"\nEnter choice (1-{idx}): ")
        try:
            choice_idx = int(choice)
            if 1 <= choice_idx <= len(flat_categories):
                business_type = flat_categories[choice_idx - 1]
            else:
                business_type = input("Enter custom business type: ")
        except ValueError:
            business_type = choice if choice.strip() else "Business"

        print("\n--- Selection Mode ---")
        print("1. Text Search (City, Country, Zones)")
        print("2. Visual Map Selection (Choose area on a live map)")
        mode_choice = input("Select mode (1 or 2): ")

        search_queries = []
        visual_mode = False

        if mode_choice == "2":
            visual_mode = True
            print("\n[Visual Mode] Starting browser... Follow the instructions to select your area.")
        else:
            city = input("Enter city: ")
            state = input("Enter state/province (optional, press Enter to skip): ")
            country = input("Enter country: ")
            
            zones = input("Enter specific zones/neighborhoods (optional, separate with commas): ")
            
            location_base = f"{city}"
            if state: location_base += f", {state}"
            location_base += f", {country}"
            
            if zones:
                zone_list = [z.strip() for z in zones.split(',')]
                for zone in zone_list:
                    search_queries.append(f"{business_type} in {zone}, {location_base}")
            else:
                search_queries.append(f"{business_type} in {location_base}")
    else:
        # Web Interaction (Server triggered)
        business_type = config.get("business_type", "Business")
        visual_mode = config.get("visual_mode", False)
        search_queries = config.get("search_queries", [])
        
    if not visual_mode and not search_queries:
        # Reconstruct from direct fields if queries not pre-built
        city = config.get("city", "")
        country = config.get("country", "")
        location = f"{city}, {country}"
        search_queries = [f"{business_type} in {location}"]
    
    # Speed Optimization: Limit scrolls and timeout earlier
    max_scrolls = config.get("max_scrolls", 15) 
    search_timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    async with async_playwright() as p:
        user_agents = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        ]
        
        # In Visual Mode we MUST have headless=False to let the user interact
        browser = await p.chromium.launch(headless=False if visual_mode else True)
        context = await browser.new_context(user_agent=random.choice(user_agents))
        page = await context.new_page()

        results = []
        seen_names = set()

        if visual_mode:
            progress.log(">>> [Visual Mode] Browser opened. Zoom into your target area.")
            await page.goto("https://www.google.com/maps")
            
            # Consent
            try:
                consent_btn = page.locator('button[aria-label*="Accept"], button[aria-label*="Tout accepter"]')
                if await consent_btn.count() > 0:
                    await consent_btn.first.click()
            except: pass
            
            if not config:
                input("\n>>> [ACTION REQUIRED] Press ENTER here after you have zoomed into your target area...")
            else:
                progress.status = "waiting_for_user"
                progress.log(">>> [ACTION REQUIRED] Please look at the browser window, zoom into your target area, then click 'Confirm Zone' in the dashboard! ✅")
                # Wait for user confirmation from web app
                while progress.status == "waiting_for_user":
                    await asyncio.sleep(1)
            
            progress.status = "running"
            progress.log("Zone confirmed. Searching for businesses in current view...")
            
            # Now we trigger the search in the current view
            search_box_selector = 'input#searchboxinput'
            try:
                await page.wait_for_selector(search_box_selector, timeout=10000)
            except:
                search_box_selector = 'input[name="q"]'
            
            await page.fill(search_box_selector, business_type)
            await page.keyboard.press("Enter")
            await asyncio.sleep(5)

            # Extra check for the "Search this area" button which often appears in visual mode
            try:
                search_area_btn = page.locator('button:has-text("Search this area"), button:has-text("Rechercher dans cette zone")')
                if await search_area_btn.count() > 0:
                    await search_area_btn.first.click()
                    progress.log("Clicking 'Search this area' to refresh results...")
                    await asyncio.sleep(4)
            except: pass

            # Add to list for processing loop
            search_queries = ["VISUAL_CURRENT_VIEW"] 

        for search_query in search_queries:
            if not visual_mode:
                print(f"\nScanning: {search_query}")
                await page.goto("https://www.google.com/maps")
                # Consent again just in case for new queries
                try:
                    consent_btn = page.locator('button[aria-label*="Accept"], button[aria-label*="Tout accepter"]')
                    if await consent_btn.count() > 0:
                        await consent_btn.first.click()
                except: pass

                search_box_selector = 'input#searchboxinput'
                try:
                    await page.wait_for_selector(search_box_selector, timeout=10000)
                except: search_box_selector = 'input[name="q"]'
                
                await page.fill(search_box_selector, search_query)
                await page.keyboard.press("Enter")
            
            # Wait for results
            try:
                await page.wait_for_selector('[role="feed"]', timeout=20000)
            except:
                # Common in visual mode: Results appear but no "feed" container yet, or "Search this area" needed
                try:
                    search_area_btn = page.locator('button:has-text("Search this area"), button:has-text("Rechercher dans cette zone")')
                    if await search_area_btn.count() > 0:
                        await search_area_btn.click()
                        await asyncio.sleep(3)
                except: pass

            print(f"Scrolling results to find more leads...")
            last_count = 0
            for i in range(max_scrolls):
                try:
                    # Look for the search this area button during scrolling
                    search_area_btn = page.locator('button:has-text("Search this area"), button:has-text("Rechercher dans cette zone")')
                    if await search_area_btn.count() > 0:
                        await search_area_btn.first.click()
                        await asyncio.sleep(2)

                    feed = page.locator('[role="feed"]')
                    if await feed.count() > 0:
                        await feed.hover()
                        # Scroll down in chunks
                        for _ in range(4):
                            await page.mouse.wheel(0, 1500)
                            await asyncio.sleep(0.3)
                        # Slightly scroll up to trigger loading (sometimes works)
                        await page.mouse.wheel(0, -200)
                        await asyncio.sleep(0.2)
                        await page.mouse.wheel(0, 500)
                    else:
                        await page.mouse.wheel(0, 2000)
                except:
                    await page.mouse.wheel(0, 2000)
                
                await asyncio.sleep(random.uniform(1.5, 3)) # Slightly faster
                
                # Check for "You've reached the end of the list"
                end_of_list = page.locator('span:has-text("reached the end"), span:has-text("plus de résultats")')
                if await end_of_list.count() > 0:
                    print("Reached the end of the Google Maps list.")
                    break

                # Count how many articles we have now
                current_cards = await page.locator('div[role="article"]').count()
                print(f"Scroll {i+1}: {current_cards} items visible...")
                
                if current_cards == last_count and i > 5: # Stop earlier if no results
                    print("No new items found. stopping.")
                    break
                last_count = current_cards

            business_cards = await page.locator('div[role="article"]').all()
            print(f"Found {len(business_cards)} potential entries in this zone.")

            for index, card in enumerate(business_cards):
                try:
                    # Fix: Use a more specific class 'qBF1Pd' to avoid strict mode violations 
                    # with price labels that also use 'fontHeadlineSmall'
                    name_loc = card.locator('.qBF1Pd.fontHeadlineSmall')
                    if await name_loc.count() == 0:
                        continue
                    
                    name = await name_loc.first.inner_text()
                    if name in seen_names:
                        continue
                    seen_names.add(name)

                    # Extract basic data... (simulated here for clarity)
                    # Let's add Search Metadata
                    results.append({
                        "Name": name,
                        "SearchQuery": search_query,
                        "Category": business_type,
                        "Timestamp": search_timestamp,
                        "Rating": "N/A", # Will be updated if specific locators match
                        "Reviews": "N/A",
                        "Address": "N/A",
                        "Phone": "N/A",
                        "Website": "N/A",
                        "Google Maps Link": f"https://www.google.com/maps/search/{name.replace(' ', '+')}",
                        "Has Real Website": "No"
                    })
                except Exception as e:
                    print(f"Error parsing card: {e}")
            
        # Update leads.json safely
        # Note: In a real app, you'd append or merge.
        existing_data = []
        if os.path.exists("leads.json"):
            try:
                with open("leads.json", "r", encoding="utf-8") as f:
                    existing_data = json.load(f)
            except: pass
        
        # Merge new results at the beginning
        final_data = results + existing_data
        with open("leads.json", "w", encoding="utf-8") as f:
            json.dump(final_data, f, indent=4, ensure_ascii=False)
            
        progress.status = "finished"
        progress.log(f"Extraction complete! Found {len(results)} new leads.")
        
    return results
                        # Fallback to general but check count to avoid strict error
                        name_loc = card.locator('.fontHeadlineSmall')
                        if await name_loc.count() > 1:
                            name_loc = name_loc.first
                    
                    if await name_loc.count() == 0: continue
                    name = await name_loc.inner_text()
                    
                    if name in seen_names:
                        continue
                    seen_names.add(name)

                    # Detailed check - click the card
                    await card.click()
                    await asyncio.sleep(random.uniform(2, 4)) 

                    # Get current URL (Google Maps link for this business)
                    google_maps_link = page.url

                    # --- SIDE PANEL EXTRACTION ---
                    website = "N/A"
                    is_pure_website = False
                    
                    # Check for the website link (authority)
                    website_loc = page.locator('a[data-item-id="authority"]')
                    # Fallback to any link with globe icon or website text
                    website_fallback = page.locator('a[aria-label*="website"], a[aria-label*="site web"], a[data-tooltip*="website"], a[data-tooltip*="site web"]')
                    
                    if await website_loc.count() > 0:
                        website = await website_loc.first.get_attribute("href")
                    elif await website_fallback.count() > 0:
                        website = await website_fallback.first.get_attribute("href")

                    # Filter: Check if it's a real website or just social media/directory
                    if website != "N/A":
                        non_independent_patterns = [
                            "facebook.com", "instagram.com", "t.me", "twitter.com", "x.com",
                            "linkedin.com", "linktr.ee", "youtube.com", "tiktok.com", 
                            "pinterest.com", "yelp.com", "wa.me", "vimeo.com", "dailymotion.com",
                            "business.site", "negocio.site", "google.com", "google.fr",
                            "pagesjaunes.fr", "societe.com", "kompass.com", "mappy.com",
                            "manta.com", "zoominfo.com", "bark.com", "prontopro.fr",
                            "tripadvisor.", "booking.com", "hotels.com", "expedia.",
                            "yellowpages.", "zyro.com", "wixsite.com", "wordpress.com",
                            "sitew.fr", "jimdosite.com", "strikingly.com"
                        ]
                        # If it doesn't contain social media patterns, it's a "Pure Website"
                        if not any(pattern in website.lower() for pattern in non_independent_patterns):
                            is_pure_website = True
                    
                    address = "N/A"
                    address_loc = page.locator('button[data-item-id="address"]')
                    if await address_loc.count() > 0:
                        address = await address_loc.first.inner_text()
                        # Clean up Google's special characters and newlines
                        address = address.replace('\n', ' ').strip().replace('\ue0c8', '')
                    
                    phone = "N/A"
                    phone_loc = page.locator('button[data-item-id*="phone:tel"]')
                    if await phone_loc.count() > 0:
                        phone = await phone_loc.first.inner_text()
                        phone = phone.replace('\n', ' ').strip().replace('\ue0b0', '')

                    rating = "N/A"
                    reviews_count = "0"
                    
                    # 1. Rating & Reviews Extraction
                    # Try aria-label first (most accurate)
                    rating_row = page.locator('div.F7uece')
                    if await rating_row.count() > 0:
                        rating_aria = await rating_row.first.get_attribute("aria-label")
                        if rating_aria:
                            import re
                            r_match = re.search(r'(\d+[\.,]\d+)', rating_aria)
                            if r_match: rating = r_match.group(1).replace(',', '.')
                            rev_match = re.search(r'(\d+)\s*(?:reviews|avis)', rating_aria.lower())
                            if rev_match: reviews_count = rev_match.group(1)

                    # Fallback to text (handles formats like "4,4(139)")
                    reviews_loc = page.locator('span[aria-label*="reviews"], span[aria-label*="avis"]')
                    if await reviews_loc.count() > 0:
                        inner = await reviews_loc.first.inner_text()
                        import re
                        if rating == "N/A":
                            r_m = re.search(r'^(\d+[\.,]\d+)', inner)
                            if r_m: rating = r_m.group(1).replace(',', '.')
                        
                        rev_m = re.search(r'\((\d+)\)', inner) # Get (139)
                        if rev_m: reviews_count = rev_m.group(1)
                        elif reviews_count == "0":
                            rev_m2 = re.search(r'(\d+)', inner)
                            if rev_m2: reviews_count = rev_m2.group(1)
                
                    # 2. Email extraction attempt
                    email = "N/A"
                    # Looking for mailto: links in the whole panel
                    mail_links = page.locator('a[href^="mailto:"]')
                    if await mail_links.count() > 0:
                        email = await mail_links.first.get_attribute("href")
                        email = email.replace("mailto:", "")

                    # Review snippets (Comments)
                    comments = []
                    try:
                        snippet_locs = await page.locator('span.wiI7pd').all()
                        for loc in snippet_locs[:3]: # Top 3 comments
                            text = await loc.inner_text()
                            if text:
                                comments.append(text.replace('\n', ' ').strip())
                    except: pass

                    data = {
                        "Name": name,
                        "Address": address,
                        "Phone": phone,
                        "Email": email,
                        "Rating": rating,
                        "Reviews": reviews_count,
                        "Comments": comments,
                        "Website": website,
                        "Google Maps Link": google_maps_link,
                        "Has Real Website": "Yes" if is_pure_website else ("Social" if website != "N/A" else "No")
                    }

                    results.append(data)
                    status = "Lead (Real Website)" if is_pure_website else ("Lead (Social)" if website != "N/A" else "Lead (No Website)")
                    print(f"[{len(results)}] {status}: {name} ({website})")

                except Exception as e:
                    print(f"Error processing item: {e}")

        # Final cleanup for this area
        print(f"Finished area. current total leads: {len(results)}")

        await browser.close()
    
    if results:
        json_file = "leads.json"
        csv_file = "leads.csv"
        
        # Load existing leads if they exist to avoid overriding
        all_leads = []
        if os.path.exists(json_file):
            try:
                with open(json_file, "r", encoding="utf-8") as f:
                    all_leads = json.load(f)
            except:
                all_leads = []
        
        # Merge results, avoiding duplicates by Name and Google Maps Link
        seen_links = {lead.get("Google Maps Link") for lead in all_leads}
        new_count = 0
        for r in results:
            if r.get("Google Maps Link") not in seen_links:
                all_leads.append(r)
                seen_links.add(r.get("Google Maps Link"))
                new_count += 1
        
        # Save merged results
        with open(json_file, "w", encoding="utf-8") as f:
            json.dump(all_leads, f, indent=4, ensure_ascii=False)
        
        # Save unique CSV as well
        pd.DataFrame(all_leads).to_csv(csv_file, index=False, encoding="utf-8-sig")
        
        # Copy to the React App's source folder for the website
        try:
            react_data_path = os.path.join("..", "scrapper", "src", "leads.json")
            shutil.copy(json_file, react_data_path)
            progress.log(f"Updated React website data at {react_data_path}")
        except Exception as e:
            progress.log(f"Note: Could not sync to React app folder: {e}")

        progress.log(f"\nDone! Added {new_count} new leads.")
    else:
        progress.log("\nNo new leads found.")
    
    progress.status = "finished"

if __name__ == "__main__":
    try:
        asyncio.run(scrape_google_maps())
    except KeyboardInterrupt:
        print("\nShutdown.")
    except Exception as e:
        print(f"\nError: {e}")
