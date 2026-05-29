# RestaurantLead Pydantic model
from pydantic import BaseModel, computed_field
from typing import Optional
from datetime import datetime

class RestaurantLead(BaseModel):
    username: str
    full_name: str
    bio: Optional[str] = None
    followers: int
    following: int
    post_count: int
    website: Optional[str] = None
    profile_url: str
    scraped_at: datetime

    @computed_field
    @property
    def has_website(self) -> bool:
        return self.website is not None
