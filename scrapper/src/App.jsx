import { useState, useEffect } from 'react'
import leadsDataFull from './leads.json'
import './App.css'

function App() {
  const [leadsData, setLeadsData] = useState(leadsDataFull)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSocial, setFilterSocial] = useState(false)
  const [priorityMode, setPriorityMode] = useState(false)
  
  // Scraper State
  const [scrapingStatus, setScrapingStatus] = useState('idle') 
  const [logs, setLogs] = useState([])
  const [availableCategories, setAvailableCategories] = useState([
    "Agence de marketing", "Agence Web", "Expert SEO", "Développeur Freelance",
    "Plombier", "Electricien", "Serrurier", "Menuisier", "Peintre",
    "Cabinet médical", "Dentiste", "Salle de sport", "Spa",
    "Cabinet d'avocats", "Agence immobilière", "Comptable",
    "Restaurant", "Hôtel", "Café", "Pâtisserie"
  ])
  const [availableCities, setAvailableCities] = useState([
    "Paris", "Marseille", "Lyon", "Toulouse", "Nice", "Nantes", 
    "Montpellier", "Strasbourg", "Bordeaux", "Lille", "Rennes", 
    "Reims", "Toulon", "Saint-Étienne", "Le Havre", "Grenoble", 
    "Dijon", "Angers", "Villeurbanne", "Saint-Denis",
    "Aix-en-Provence", "Brest", "Limoges", "Le Mans", "Clermont-Ferrand",
    "Amiens", "Tours", "Metz", "Besançon", "Orléans", "Perpignan", 
    "Boulogne-Billancourt", "Mulhouse", "Caen", "Nancy", "Saint-Paul"
  ])
  const [newCity, setNewCity] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('Agence Web')
  const [selectedCities, setSelectedCities] = useState([])
  const [visualMode, setVisualMode] = useState(false)

  // Load config on mount
  useEffect(() => {
    fetch('http://localhost:5000/api/config')
      .then(res => res.json())
      .then(data => {
        if (data.categories && Array.isArray(data.categories) && data.categories.length > 0) {
          setAvailableCategories(data.categories);
          // Set to first category if current selected is not in the new list
          if (!data.categories.includes(selectedCategory)) {
            setSelectedCategory(data.categories[0]);
          }
        }
        if (data.cities && Array.isArray(data.cities) && data.cities.length > 0) {
          setAvailableCities(data.cities);
        }
      })
      .catch(e => console.warn("Backend not detected. Using local fallback configuration."));
  }, []);

  const toggleCity = (city) => {
    setSelectedCities(prev => 
      prev.includes(city) ? prev.filter(c => c !== city) : [...prev, city]
    );
  };

  const addNewCity = (e) => {
    if (e.key === 'Enter' && newCity.trim()) {
      const city = newCity.trim();
      if (!availableCities.includes(city)) {
        setAvailableCities(prev => [...prev, city]);
      }
      if (!selectedCities.includes(city)) {
        setSelectedCities(prev => [...prev, city]);
      }
      setNewCity('');
    }
  };

  // Poll scraper status
  useEffect(() => {
    let interval;
    if (scrapingStatus === 'running' || scrapingStatus === 'waiting_for_user' || scrapingStatus === 'starting') {
      interval = setInterval(async () => {
        try {
          const res = await fetch('http://localhost:5000/api/status');
          const data = await res.json();
          setScrapingStatus(data.status);
          setLogs(data.logs);
        } catch (e) {
          console.error("Backend not reachable");
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [scrapingStatus]);

  const startScraper = async () => {
    if (selectedCities.length === 0 && !visualMode) {
      alert("Please select at least one city or use Visual Mode");
      return;
    }

    setScrapingStatus('starting');
    setLogs(['Starting connection to backend...']);
    try {
      await fetch('http://localhost:5000/api/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_type: selectedCategory,
          cities: selectedCities,
          visual_mode: visualMode
        })
      });
    } catch (e) {
      setScrapingStatus('idle');
      setLogs(['Error: Sidecar server is not running. Start server.py in the python folder.']);
    }
  };

  const confirmZone = async () => {
    await fetch('http://localhost:5000/api/confirm-zone', { method: 'POST' });
  };

  const cleanData = leadsData.map(lead => {
    // Handling Google's "4,4(139" or "(26)" formats
    let rating = lead.Rating;
    let reviews = lead.Reviews;

    if (reviews && reviews.includes('(')) {
      const parts = reviews.split('(');
      if (parts[0].trim() && rating === "N/A") {
        rating = parts[0].replace(',', '.').trim();
      }
      reviews = parts[parts.length - 1].replace(')', '').trim();
    }
    
    return { 
      ...lead, 
      Rating: rating === "N/A" ? "0" : rating, 
      Reviews: parseInt(reviews) || 0 
    };
  });

  const filteredLeads = cleanData.filter(lead => {
    const matchesSearch = 
      lead.Name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.Address.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filterSocial) {
      return matchesSearch && lead["Has Real Website"] === "No";
    }
    return matchesSearch;
  });

  // Priority Sort: Combine Rating and Reviews to find truly popular businesses
  if (priorityMode) {
    filteredLeads.sort((a, b) => {
      const rateA = parseFloat(a.Rating) || 0;
      const rateB = parseFloat(b.Rating) || 0;
      const revA = parseInt(a.Reviews) || 0;
      const revB = parseInt(b.Reviews) || 0;
      
      // Calculate a Popularity Score
      // A business with 4.5 rating and 100 reviews is often "better" than 5.0 and 1 review
      const scoreA = rateA * revA;
      const scoreB = rateB * revB;
      
      return scoreB - scoreA;
    });
  }

  return (
    <div className="dashboard">
      <header className="header">
        <div className="header-main">
          <h1>Lead Explorer <span className="version-badge">2.0</span></h1>
          <p className="stats">
            <strong>{leadsData.length}</strong> Total | 
            <strong> {filteredLeads.length}</strong> Results
          </p>
        </div>

        <section className="scraper-config-card">
          <div className="config-grid">
            <div className="config-item">
              <label>Business Category</label>
              <select 
                value={selectedCategory} 
                onChange={e => setSelectedCategory(e.target.value)}
                className="modern-select"
              >
                {availableCategories && Array.isArray(availableCategories) && availableCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="config-item full-width">
              <label>Target Cities (Select Multiple or Add New)</label>
              <div className="city-selector">
                {availableCities && Array.isArray(availableCities) && availableCities.map(city => (
                  <button 
                    key={city}
                    className={`city-pill ${selectedCities.includes(city) ? 'active' : ''}`}
                    onClick={() => toggleCity(city)}
                  >
                    {city}
                  </button>
                ))}
                <input 
                  type="text" 
                  className="city-add-input" 
                  placeholder="+ Add City..." 
                  value={newCity}
                  onChange={(e) => setNewCity(e.target.value)}
                  onKeyDown={addNewCity}
                />
              </div>
            </div>

            <div className="config-actions">
              <label className="visual-toggle-large">
                <input type="checkbox" checked={visualMode} onChange={e => setVisualMode(e.target.checked)} />
                <div className="toggle-content">
                  <span className="toggle-title">Interactive Map Mode</span>
                  <span className="toggle-desc">Manually choose areas in the browser</span>
                </div>
              </label>
              <button 
                className={`main-start-btn ${scrapingStatus !== 'idle' && scrapingStatus !== 'finished' ? 'busy' : ''}`}
                onClick={startScraper}
                disabled={scrapingStatus !== 'idle' && scrapingStatus !== 'finished'}
              >
                {scrapingStatus === 'idle' || scrapingStatus === 'finished' ? 'Start Extraction' : 'Scanning...'}
              </button>
            </div>
          </div>

          {(scrapingStatus !== 'idle') && (
            <div className="live-status-area">
              <div className="status-banner">
                <span className={`status-dot ${scrapingStatus}`}></span>
                <span className="status-text">{scrapingStatus.replace(/_/g, ' ')}</span>
                {scrapingStatus === 'waiting_for_user' && (
                  <button className="pulse-confirm-btn" onClick={confirmZone}>Confirm Position</button>
                )}
              </div>
              <div className="terminal-logs">
                {Array.isArray(logs) && logs.map((log, i) => <div key={i} className="log-entry">{log}</div>)}
              </div>
            </div>
          )}
        </section>
        
        <div className="search-and-filters">
          <div className="search-box">
            <input 
              type="text" 
              placeholder="Search leads..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label className={`toggle-pill ${filterSocial ? 'active' : ''}`}>
              <input type="checkbox" checked={filterSocial} onChange={(e) => setFilterSocial(e.target.checked)} />
              No Website
            </label>
            <label className={`toggle-pill accent ${priorityMode ? 'active' : ''}`}>
              <input type="checkbox" checked={priorityMode} onChange={(e) => setPriorityMode(e.target.checked)} />
              High Potential
            </label>
          </div>
        </div>
      </header>

      <main className="leads-display">
        {filteredLeads.map((lead, index) => (
          <div key={index} className="lead-card">
            <div className="card-header">
              <h3>{lead.Name}</h3>
              <div className="rating-box">
                <span className="rating">{lead.Rating !== "0" ? lead.Rating : "N/A"}</span>
                <span className="reviews">({lead.Reviews} reviews)</span>
              </div>
            </div>
            
            <div className="card-body">
              <div className="contact-island">
                <div className="info-row">
                  <span>{lead.Address}</span>
                </div>
                
                {lead.Phone !== "N/A" && (
                  <div className="info-row">
                    <span>{lead.Phone}</span>
                  </div>
                )}
                
                {lead.Email !== "N/A" && (
                  <div className="info-row">
                    <span>{lead.Email}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="card-footer">
              {lead.Website !== "N/A" && (
                <a href={lead.Website} target="_blank" rel="noreferrer" className="view-btn">
                  Visit Website
                </a>
              )}
              <a href={lead["Google Maps Link"] || `https://www.google.com/maps/search/${encodeURIComponent(lead.Name + ' ' + lead.Address)}`} target="_blank" rel="noreferrer" className="map-btn">
                Maps
              </a>
            </div>

            {lead["Has Real Website"] === "No" && (
              <span className="social-pill">Social Only</span>
            )}
          </div>
        ))}
      </main>
    </div>
  )
}

export default App
