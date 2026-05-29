# JSON + CSV export
import json
import csv
from typing import List
from .models import RestaurantLead

class Exporter:
    @staticmethod
    def to_json(leads: List[RestaurantLead], filename: str):
        with open(filename, 'w') as f:
            # Model.model_dump() handles computed fields in Pydantic v2
            json.dump([lead.model_dump() for lead in leads], f, indent=4, default=str)

    @staticmethod
    def to_csv(leads: List[RestaurantLead], filename: str):
        if not leads:
            return
        
        # Get data with computed fields
        data = [lead.model_dump() for lead in leads]
            
        keys = data[0].keys()
        with open(filename, 'w', newline='') as f:
            dict_writer = csv.DictWriter(f, fieldnames=keys)
            dict_writer.writeheader()
            dict_writer.writerows(data)
