# Filter accounts likely to be restaurants

class LeadFilter:
    def is_restaurant(self, account_info: dict) -> bool:
        """
        Filter to skip obvious non-restaurants:
        - Low post count
        - Private account
        - No bio
        """
        # Basic sanity checks
        if account_info.get('is_private'):
            return False
            
        if account_info.get('media_count', 0) < 5:
            return False
            
        if not account_info.get('biography'):
            return False
            
        # Add more logic here (e.g., keyword matching in bio)
        return True
