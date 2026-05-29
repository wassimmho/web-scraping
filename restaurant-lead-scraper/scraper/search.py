import traceback
from typing import Set

class Searcher:
    def __init__(self, client):
        self.client = client.cl  # Use the instagrapi Client instance

    def search_by_hashtag(self, hashtag: str, amount: int = 50) -> Set[str]:
        """Search by hashtag and return unique usernames"""
        print(f"Searching hashtag: #{hashtag}")
        try:
            # Check if we are still logged in
            self.client.get_timeline_feed() 
            medias = self.client.hashtag_medias_recent(hashtag, amount=amount)
            return {m.user.username for m in medias}
        except Exception as e:
            print(f"Error searching hashtag {hashtag}: {traceback.format_exc() if 'login_required' in str(e) else e}")
            return set()

    def search_by_location(self, query: str, amount: int = 50) -> Set[str]:
        """Search by place name and return unique usernames from recent posts"""
        print(f"Searching location: {query}")
        try:
            # Try primary search method
            locations = self.cl_search(query)
            if not locations:
                print(f"No locations found for {query}")
                return set()
            
            top_location = locations[0]
            # Use 'pk' if it's an object, or 'id' if it's a dict (depends on endpoint)
            loc_id = getattr(top_location, 'pk', None) or getattr(top_location, 'external_id', None)
            
            print(f"Found location: {getattr(top_location, 'name', query)} ({loc_id})")
            
            # Get recent media from that location
            # location_medias_recent is the most stable for business discovery
            medias = self.client.location_medias_recent(loc_id, amount=amount)
            return {m.user.username for m in medias}
        except Exception as e:
            print(f"Error searching location {query}: {e}")
            return set()

    def cl_search(self, query):
        """Helper to try multiple location discovery endpoints"""
        try:
            return self.client.fbsearch_places(query)
        except:
            try:
                return self.client.search_places(query)
            except:
                return []
