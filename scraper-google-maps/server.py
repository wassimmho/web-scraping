from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import threading
import asyncio
import json
import os
from main import scrape_google_maps, progress

app = Flask(__name__)
CORS(app)

# Global thread for scraping
scrape_thread = None

@app.route('/api/config', methods=['GET'])
def get_config():
    """Initial categories and common cities for the frontend"""
    return jsonify({
        "categories": [
            "Agence de marketing", "Agence Web", "Expert SEO", "Développeur Freelance",
            "Plombier", "Electricien", "Serrurier", "Menuisier", "Peintre",
            "Cabinet médical", "Dentiste", "Salle de sport", "Spa",
            "Cabinet d'avocats", "Agence immobilière", "Comptable",
            "Restaurant", "Hôtel", "Café", "Pâtisserie"
        ],
        "cities": [
            "Paris", "Marseille", "Lyon", "Toulouse", "Nice", "Nantes", 
            "Montpellier", "Strasbourg", "Bordeaux", "Lille", "Rennes", 
            "Reims", "Toulon", "Saint-Étienne", "Le Havre", "Grenoble", 
            "Dijon", "Angers", "Villeurbanne", "Saint-Denis"
        ]
    })

@app.route('/api/start', methods=['POST'])
def start_scrape():
    global scrape_thread
    if progress.status == "running" or progress.status == "waiting_for_user":
        return jsonify({"error": "Scraper is already running"}), 400

    data = request.json
    # Build list of queries if multiple cities provided
    business_type = data.get("business_type", "Business")
    cities = data.get("cities", [data.get("city", "Paris")])
    visual_mode = data.get("visual_mode", False)
    
    config = {
        "business_type": business_type,
        "visual_mode": visual_mode,
        "search_queries": [f"{business_type} in {city}" for city in cities] if not visual_mode else []
    }

    # Reset progress
    progress.logs = []
    progress.status = "starting"
    
    def run_worker(cfg):
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(scrape_google_maps(cfg))

    scrape_thread = threading.Thread(target=run_worker, args=(config,))
    scrape_thread.start()
    
    return jsonify({"message": "Scraper started"})

@app.route('/api/confirm-zone', methods=['POST'])
def confirm_zone():
    if progress.status == "waiting_for_user":
        progress.status = "running"
        return jsonify({"message": "Zone confirmed"})
    return jsonify({"error": "Not waiting for user"}), 400

@app.route('/api/status', methods=['GET'])
def get_status():
    return jsonify({
        "status": progress.status,
        "logs": progress.logs[-20:], # Send last 20 logs
        "total_leads": len(progress.logs) # Placeholder
    })

if __name__ == '__main__':
    app.run(port=5000, debug=True, use_reloader=False)
