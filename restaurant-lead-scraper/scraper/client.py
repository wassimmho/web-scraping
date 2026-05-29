# Login + session persistence
import os
import json
from instagrapi import Client

class InstagramClient:
    def __init__(self, username, password, session_id=None):
        self.username = username
        self.password = password
        self.session_id = session_id
        self.session_path = "sessions/instagram_session.json"
        self.cl = Client()

    def login(self):
        """Login using session ID, session cache, or fresh credentials"""
        # Set a realistic browser-like user agent
        self.cl.set_user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36")

        # Priority 1: Direct Session ID Bypass
        if self.session_id:
            try:
                self.cl.login_by_sessionid(self.session_id)
                # Verify session
                me = self.cl.account_info()
                print(f"Logged in & Verified via Session ID: @{me.username}")
                return self.cl
            except Exception as e:
                print(f"Session ID login failed (May be expired): {e}")

        # Priority 2: Session Cache File
        if os.path.exists(self.session_path):
            try:
                self.cl.load_settings(self.session_path)
                self.cl.login(self.username, self.password)
                print("Logged in using session cache")
                return self.cl
            except Exception as e:
                print(f"Session file login failed: {e}. Attempting fresh login.")
        
        # Priority 3: Fresh Login
        print(f"Attempting fresh login for {self.username}...")
        try:
            self.cl.login(self.username, self.password)
            # CRITICAL: Verify the login actually worked
            user_info = self.cl.account_info()
            print(f"Fresh login verified! Logged in as: @{user_info.username}")
            self.cl.dump_settings(self.session_path)
            return self.cl
        except Exception as e:
            print(f"Fresh login failed during verification: {e}")
            raise e

    def get_profile(self, username):
        """Fetch basic profile info"""
        try:
            return self.cl.user_info_by_username(username).dict()
        except Exception as e:
            print(f"Error fetching profile for {username}: {e}")
            return None
