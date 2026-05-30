import { useState, useEffect } from 'react'
import leadsDataFull from './leads.json'
import './App.css'

function App() {
  const [leadsData, setLeadsData] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSocial, setFilterSocial] = useState(false)
  const [filterNoWebsite, setFilterNoWebsite] = useState(false)
  const [priorityMode, setPriorityMode] = useState(false)
  
  // Scraper State
  const [scrapingStatus, setScrapingStatus] = useState('idle') 
  const [logs, setLogs] = useState([])
  
  // ... existing code ...

  // Load leads from external file and poll for updates
  useEffect(() => {
    const loadLeads = async () => {
      try {
        const response = await fetch('/src/leads.json');
        const data = await response.json();
        setLeadsData(data);
      } catch (e) {
        console.warn("Could not load leads.json from source, falling back to bundled data.");
        setLeadsData(leadsDataFull);
      }
    };
    
    // Initial load
    loadLeads();
    
    // Refresh every 5 seconds if scraping
    let interval;
    if (scrapingStatus !== 'idle') {
      interval = setInterval(loadLeads, 5000);
    }
    return () => clearInterval(interval);
  }, [scrapingStatus]);

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
  const [maxScrolls, setMaxScrolls] = useState(15)
  const [searchHistory, setSearchHistory] = useState([])
  const [activeSearchFilter, setActiveSearchFilter] = useState('All')
  
  // Advanced Filters
  const [minRating, setMinRating] = useState(0)
  const [minReviews, setMinReviews] = useState(0)
  const [filterEmail, setFilterEmail] = useState(false)
  const [filterPhone, setFilterPhone] = useState(false)
  const [viewMode, setViewMode] = useState('grid') // grid or grouped

  // Load leads and extract historical searches
  useEffect(() => {
    const queries = [...new Set(leadsData.map(l => l.SearchQuery || 'Unknown'))].filter(q => q !== 'Unknown');
    setSearchHistory(queries);
  }, [leadsData]);

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
          visual_mode: visualMode,
          max_scrolls: maxScrolls
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
    
    const website = lead.Website || "N/A";
    const isNA = website === "N/A" || website.trim() === "";
    const isSocial = !isNA && (
      website.toLowerCase().includes("facebook.com") ||
      website.toLowerCase().includes("instagram.com") ||
      website.toLowerCase().includes("linkedin.com") ||
      website.toLowerCase().includes("twitter.com") ||
      website.toLowerCase().includes("x.com") ||
      website.toLowerCase().includes("tiktok.com") ||
      website.toLowerCase().includes("youtube.com") ||
      website.toLowerCase().includes("yelp.com") ||
      website.toLowerCase().includes("pagesjaunes.fr") ||
      website.toLowerCase().includes("business.site")
    );
    const isReal = !isNA && !isSocial;

    return { 
      ...lead, 
      Rating: rating === "N/A" ? "0" : rating, 
      Reviews: parseInt(reviews) || 0,
      _websiteType: isReal ? 'real' : (isSocial ? 'social' : 'none')
    };
  });

  const filteredLeads = cleanData.filter(lead => {
    const matchesSearch = 
      lead.Name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.Address.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesHistory = activeSearchFilter === 'All' || lead.SearchQuery === activeSearchFilter;

    const rateVal = parseFloat(lead.Rating) || 0;
    const revVal = parseInt(lead.Reviews) || 0;
    
    const matchesAdvanced = 
      rateVal >= minRating && 
      revVal >= minReviews &&
      (!filterEmail || (lead.Email && lead.Email !== "N/A")) &&
      (!filterPhone || (lead.Phone && lead.Phone !== "N/A"));

    if (filterNoWebsite && lead._websiteType !== 'none') return false;
    if (filterSocial && lead._websiteType !== 'social') return false;

    return matchesSearch && matchesHistory && matchesAdvanced;
  });

  // Grouped Leads calculation
  const groupedLeads = filteredLeads.reduce((acc, lead) => {
    const key = lead.SearchQuery || 'Uncategorized';
    if (!acc[key]) acc[key] = [];
    acc[key].push(lead);
    return acc;
  }, {});

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

            <div className="config-item">
              <label>Search Depth (Optimization)</label>
              <select 
                value={maxScrolls} 
                onChange={e => setMaxScrolls(parseInt(e.target.value))}
                className="modern-select"
              >
                <option value={5}>Fast (5 scrolls)</option>
                <option value={15}>Balanced (15 scrolls)</option>
                <option value={30}>Thorough (30 scrolls)</option>
              </select>
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
              placeholder="Search by name or address..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="advanced-filters-bar">
            <div className="filter-item">
              <label>Min Rating: {minRating}</label>
              <input type="range" min="0" max="5" step="0.5" value={minRating} onChange={e => setMinRating(parseFloat(e.target.value))} />
            </div>
            <div className="filter-item">
              <label>Min Reviews: {minReviews}</label>
              <input type="number" placeholder="Reviews" value={minReviews} onChange={e => setMinReviews(parseInt(e.target.value) || 0)} className="small-input" />
            </div>
            <div className="filter-item">
              <select value={viewMode} onChange={e => setViewMode(e.target.value)} className="view-select">
                <option value="grid">Grid View</option>
                <option value="grouped">Group by Search</option>
              </select>
            </div>
          </div>

          <div className="filter-group">
            {searchHistory.length > 0 && (
              <select 
                className="history-filter"
                value={activeSearchFilter}
                onChange={e => setActiveSearchFilter(e.target.value)}
              >
                <option value="All">All Search Sessions</option>
                {searchHistory.map(q => <option key={q} value={q}>{q}</option>)}
              </select>
            )}
            <label className={`toggle-pill ${filterEmail ? 'active' : ''}`}>
              <input type="checkbox" checked={filterEmail} onChange={(e) => setFilterEmail(e.target.checked)} />
              Has Email
            </label>
            <label className={`toggle-pill ${filterPhone ? 'active' : ''}`}>
              <input type="checkbox" checked={filterPhone} onChange={(e) => setFilterPhone(e.target.checked)} />
              Has Phone
            </label>
            <label className={`toggle-pill ${filterSocial ? 'active' : ''}`}>
              <input type="checkbox" checked={filterSocial} onChange={(e) => setFilterSocial(e.target.checked)} />
              Social Only
            </label>
            <label className={`toggle-pill ${filterNoWebsite ? 'active' : ''}`}>
              <input type="checkbox" checked={filterNoWebsite} onChange={(e) => setFilterNoWebsite(e.target.checked)} />
              No Website
            </label>
            <label className={`toggle-pill accent ${priorityMode ? 'active' : ''}`}>
              <input type="checkbox" checked={priorityMode} onChange={(e) => setPriorityMode(e.target.checked)} />
              Most Popular
            </label>
          </div>
        </div>
      </header>

      <main className="leads-display">
        {viewMode === 'grid' ? (
          <div className="leads-grid">
            {filteredLeads.map((lead, index) => (
              <LeadCard key={index} lead={lead} />
            ))}
          </div>
        ) : (
          <div className="leads-grouped">
            {Object.keys(groupedLeads).map(query => (
              <section key={query} className="search-group">
                <h2 className="group-title">{query} <span className="count">({groupedLeads[query].length})</span></h2>
                <div className="leads-grid">
                  {groupedLeads[query].map((lead, index) => (
                    <LeadCard key={index} lead={lead} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function LeadCard({ lead }) {
  return (
    <div className="lead-card">
      <div className="card-header">
        <div className="title-area">
          <h3>{lead.Name}</h3>
          <span className="lead-category">{lead.Category}</span>
        </div>
        <div className="rating-box">
          <span className="rating">{lead.Rating !== "0" && lead.Rating !== "N/A" ? lead.Rating : "N/A"}</span>
          <span className="reviews">({lead.Reviews} rev.)</span>
        </div>
      </div>
      
      <div className="card-body">
        <div className="contact-island">
          <div className="info-row address">
            <span>{lead.Address}</span>
          </div>
          
          <div className="contact-grid">
            {lead.Phone && lead.Phone !== "N/A" && (
              <div className="info-row phone">
                <span className="label">Tel:</span>
                <span>{lead.Phone}</span>
              </div>
            )}
            
            {lead.Email && lead.Email !== "N/A" && (
              <div className="info-row email">
                <span className="label">Mail:</span>
                <span>{lead.Email}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card-footer">
        {lead._websiteType === 'real' && (
          <a href={lead.Website} target="_blank" rel="noreferrer" className="view-btn">
            Site
          </a>
        )}
        {lead._websiteType === 'social' && (
          <a href={lead.Website} target="_blank" rel="noreferrer" className="view-btn social">
            Social
          </a>
        )}
        <a href={lead["Google Maps Link"] || `https://www.google.com/maps/search/${encodeURIComponent(lead.Name + ' ' + lead.Address)}`} target="_blank" rel="noreferrer" className="map-btn">
          Maps
        </a>
      </div>

      <div className="card-meta">
        <span className="query-tag">{lead.SearchQuery}</span>
        <span className="date-tag">{lead.Timestamp?.split(' ')[0]}</span>
      </div>

      {lead._websiteType === 'social' && (
        <span className="social-pill">
          {lead.Website.includes('facebook') ? 'Facebook' : 
           lead.Website.includes('instagram') ? 'Instagram' : 
           lead.Website.includes('tiktok') ? 'TikTok' :
           lead.Website.includes('linkedin') ? 'LinkedIn' : 'Social Profile'}
        </span>
      )}
      {lead._websiteType === 'none' && (
        <span className="social-pill warning">No Website Found</span>
      )}
    </div>
  );
}

export default App;
