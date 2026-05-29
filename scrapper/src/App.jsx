import { useState } from 'react'
import leadsData from './leads.json'
import './App.css'

function App() {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSocial, setFilterSocial] = useState(false)
  const [priorityMode, setPriorityMode] = useState(false)

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
        <h1>Lead Explorer</h1>
        <p>Total Leads: {leadsData.length} | Currently Viewing: {filteredLeads.length}</p>
        
        <div className="controls">
          <input 
            type="text" 
            placeholder="Search leads by name or city..." 
            className="search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <label className="filter-checkbox">
            <input 
              type="checkbox" 
              checked={filterSocial}
              onChange={(e) => setFilterSocial(e.target.checked)}
            />
            Only Social Leads (No Independent Website)
          </label>
          <label className="filter-checkbox priority-badge">
            <input 
              type="checkbox" 
              checked={priorityMode}
              onChange={(e) => setPriorityMode(e.target.checked)}
            />
            🔥 Priority Mode (Best Rated First)
          </label>
        </div>
      </header>

      <main className="leads-grid">
        {filteredLeads.map((lead, index) => (
          <div key={index} className="lead-card">
            <div className="card-header">
              <h3>{lead.Name}</h3>
              <div className="rating-box">
                <span className="rating">⭐ {lead.Rating !== "0" ? lead.Rating : "N/A"}</span>
                <span className="reviews">({lead.Reviews} reviews)</span>
              </div>
            </div>
            
            <p className="address">{lead.Address}</p>
            
            <div className="contact-info">
              {lead.Phone !== "N/A" && (
                <div className="info-item">
                  <strong>📞 Phone:</strong> {lead.Phone}
                </div>
              )}
              {lead.Email !== "N/A" && (
                <div className="info-item">
                  <strong>📧 Email:</strong> {lead.Email}
                </div>
              )}
              {lead.Website !== "N/A" && (
                <div className="info-item">
                  <strong>🔗 Website:</strong> <a href={lead.Website} target="_blank" rel="noreferrer">Open Link</a>
                  {lead["Has Real Website"] === "No" && <span className="social-badge">Social Media Only</span>}
                </div>
              )}
            </div>

            {lead.Comments && lead.Comments.length > 0 && (
              <div className="comments-section">
                <h4>Recent Feedback:</h4>
                <ul>
                  {lead.Comments.map((comment, i) => (
                    <li key={i}>"{comment}"</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="card-footer">
              <a href={lead["Google Maps Link"] || `https://www.google.com/maps/search/${encodeURIComponent(lead.Name + ' ' + lead.Address)}`} target="_blank" rel="noreferrer" className="btn-maps">
                View on Google Maps
              </a>
            </div>
          </div>
        ))}
      </main>
    </div>
  )
}

export default App
