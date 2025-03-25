import React, { useState, useCallback, useEffect, useMemo } from 'react';
import axios from 'axios';
import { GoogleMap, Marker, InfoWindow, useLoadScript } from '@react-google-maps/api';
import './App.css';

const mapContainerStyle = {
  width: '100%',
  height: '500px',
};

const defaultCenter = {
  lat: 40.7128, // Default center (e.g., NYC)
  lng: -74.0060,
};

const mapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: true,
  fullscreenControl: true,
  styles: [
    {
      featureType: 'poi',
      elementType: 'labels',
      stylers: [{ visibility: 'off' }]
    }
  ]
};

const Logo = () => (
  <div className="logo">
    <svg className="logo-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zM12 11.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="currentColor"/>
    </svg>
    <span className="logo-text">LocaInsight</span>
  </div>
);

const ShareButton = ({ location, preferences }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const handleShare = () => {
    const searchParams = new URLSearchParams();
    if (location) searchParams.set('location', location);
    if (preferences) searchParams.set('preferences', preferences);
    
    const url = `${window.location.origin}${window.location.pathname}?${searchParams.toString()}`;
    
    if (navigator.share) {
      navigator.share({
        title: 'LocaInsight Recommendations',
        text: `Check out these recommendations for ${location}${preferences ? ` (${preferences})` : ''}!`,
        url: url
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setShowTooltip(true);
        setTimeout(() => setShowTooltip(false), 2000);
      });
    }
  };

  return (
    <button onClick={handleShare} className="share-button">
      <svg className="share-icon" viewBox="0 0 20 20" fill="currentColor">
        <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
      </svg>
      Share
      {showTooltip && <span className="tooltip">Link copied!</span>}
    </button>
  );
};

const DirectionsButton = ({ place }) => {
  const handleGetDirections = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(place.address)}`;
    window.open(url, '_blank');
  };

  return (
    <button onClick={handleGetDirections} className="directions-button">
      <svg className="directions-icon" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
      </svg>
      Get Directions
    </button>
  );
};

const RefreshButton = ({ onClick, isLoading }) => {
  return (
    <button 
      onClick={onClick} 
      className="refresh-button"
      disabled={isLoading}
    >
      <svg 
        className={`refresh-icon ${isLoading ? 'spinning' : ''}`} 
        viewBox="0 0 20 20" 
        fill="currentColor"
      >
        <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
      </svg>
      {isLoading ? 'Refreshing...' : 'Get New Suggestions'}
    </button>
  );
};

const FavoriteButton = ({ place, isFavorite, onToggle }) => {
  return (
    <button 
      onClick={(e) => {
        e.stopPropagation();
        onToggle(place);
      }} 
      className={`favorite-button ${isFavorite ? 'is-favorite' : ''}`}
      title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
    >
      <svg className="favorite-icon" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
      </svg>
    </button>
  );
};

const FavoritesList = ({ favorites, onPlaceClick, onRemove }) => {
  if (favorites.length === 0) return null;

  return (
    <div className="favorites-list">
      <div className="favorites-header">
        <h3>
          <svg className="favorite-icon" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
          </svg>
          Saved Places
        </h3>
      </div>
      <div className="favorites-scroll">
        {favorites.map((place, idx) => (
          <div 
            key={idx} 
            className="favorite-item"
            onClick={() => onPlaceClick(place)}
          >
            <div className="favorite-content">
              <h4>{place.name}</h4>
              <p className="favorite-address">{place.address}</p>
            </div>
            <button 
              className="remove-favorite"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(place);
              }}
            >
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

const ThemeToggle = ({ isDark, onToggle }) => {
  return (
    <button 
      onClick={onToggle}
      className="theme-toggle"
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? (
        <svg className="theme-icon" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
        </svg>
      ) : (
        <svg className="theme-icon" viewBox="0 0 20 20" fill="currentColor">
          <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
        </svg>
      )}
    </button>
  );
};

const CategoryTag = ({ category }) => (
  <span className="category-tag">
    {category}
  </span>
);

const SimilarPlaces = ({ place, recommendations, onPlaceClick }) => {
  const getSimilarPlaces = () => {
    if (!place || !recommendations) return [];
    
    // Calculate similarity based on categories and location
    return recommendations
      .filter(p => p.name !== place.name)
      .map(p => ({
        ...p,
        similarity: calculateSimilarity(place, p)
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3);
  };

  const calculateSimilarity = (place1, place2) => {
    // Simple similarity score based on categories and distance
    let score = 0;
    
    // Category match
    const commonCategories = place1.categories?.filter(
      cat => place2.categories?.includes(cat)
    ).length || 0;
    score += commonCategories * 2;
    
    // Distance similarity (inverse of distance)
    const distance = calculateDistance(
      place1.latitude,
      place1.longitude,
      place2.latitude,
      place2.longitude
    );
    score += 5 / (1 + distance); // Normalize distance factor
    
    return score;
  };

  const similarPlaces = getSimilarPlaces();
  
  if (similarPlaces.length === 0) return null;

  return (
    <div className="similar-places">
      <h4>Similar Places</h4>
      <div className="similar-places-list">
        {similarPlaces.map((similarPlace, idx) => (
          <button
            key={idx}
            className="similar-place-item"
            onClick={() => onPlaceClick(similarPlace)}
          >
            <h5>{similarPlace.name}</h5>
            <p>{similarPlace.categories?.join(', ')}</p>
          </button>
        ))}
      </div>
    </div>
  );
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const UserMenu = ({ user, onSignOut }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="user-menu">
      <button 
        className="user-button"
        onClick={() => setIsOpen(!isOpen)}
      >
        {user.photoURL ? (
          <img src={user.photoURL} alt={user.displayName} className="user-avatar" />
        ) : (
          <div className="user-avatar-placeholder">
            {user.displayName?.[0] || user.email?.[0]}
          </div>
        )}
        <span className="user-name">{user.displayName || user.email}</span>
        <svg className={`menu-arrow ${isOpen ? 'open' : ''}`} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
      
      {isOpen && (
        <div className="user-dropdown">
          <div className="user-info">
            <strong>{user.displayName || user.email}</strong>
            <span>{user.email}</span>
          </div>
          <div className="dropdown-divider" />
          <button className="dropdown-item" onClick={() => window.location.href = '/profile'}>
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
            Profile
          </button>
          <button className="dropdown-item" onClick={() => window.location.href = '/settings'}>
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
            Settings
          </button>
          <div className="dropdown-divider" />
          <button className="dropdown-item logout" onClick={onSignOut}>
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V7.414l-5.293 5.293a1 1 0 01-1.414-1.414L14.586 6H3V4h11.586l-4.293-4.293a1 1 0 011.414-1.414l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 8H3V3z" clipRule="evenodd" />
            </svg>
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
};

const AuthButtons = ({ onSignIn }) => (
  <div className="auth-buttons">
    <button className="sign-in-button" onClick={onSignIn}>
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M3 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1zm7.707 3.293a1 1 0 010 1.414L9.414 9H17a1 1 0 110 2H9.414l1.293 1.293a1 1 0 01-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0z" clipRule="evenodd" />
      </svg>
      Sign In
    </button>
  </div>
);

const Footer = () => (
  <footer className="site-footer">
    <div className="footer-content">
      <div className="footer-section">
        <h4>About LocaInsight</h4>
        <p>Discover personalized travel recommendations powered by AI. Find the perfect places that match your interests and preferences.</p>
      </div>
      
      <div className="footer-section">
        <h4>Quick Links</h4>
        <ul>
          <li><a href="/about">About Us</a></li>
          <li><a href="/contact">Contact</a></li>
          <li><a href="/privacy">Privacy Policy</a></li>
          <li><a href="/terms">Terms of Service</a></li>
        </ul>
      </div>
      
      <div className="footer-section">
        <h4>Connect With Us</h4>
        <div className="social-links">
          <a href="https://twitter.com/locainsight" target="_blank" rel="noopener noreferrer">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
            </svg>
          </a>
          <a href="https://linkedin.com/company/locainsight" target="_blank" rel="noopener noreferrer">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
          </a>
          <a href="https://github.com/locainsight" target="_blank" rel="noopener noreferrer">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
            </svg>
          </a>
        </div>
      </div>
    </div>
    
    <div className="footer-bottom">
      <div className="copyright">
        © {new Date().getFullYear()} LocaInsight by Andrew Do. All rights reserved.
      </div>
      <div className="footer-info">
        Made with ❤️ in Los Angeles • Powered by AI
      </div>
    </div>
  </footer>
);

function App() {
  // Load Google Maps
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: "AIzaSyBHOUeco4b0u7hCvEb3evOR-Zadpn5OlFI" // Replace with your real key!
  });

  // Component states
  const [location, setLocation] = useState("");
  const [preferences, setPreferences] = useState("");
  const [recommendations, setRecommendations] = useState([]);
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [activeMarker, setActiveMarker] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('default');
  const [recentSearches, setRecentSearches] = useState([]);
  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem('favorites');
    return saved ? JSON.parse(saved) : [];
  });
  const [showFavorites, setShowFavorites] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });
  const [userLocation, setUserLocation] = useState(null);
  const [user, setUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [collections, setCollections] = useState(() => {
    const saved = localStorage.getItem('collections');
    return saved ? JSON.parse(saved) : [];
  });
  const [filters, setFilters] = useState({
    priceRange: 'all',
    openNow: false,
    accessibility: false,
    distance: 'all'
  });
  const [activeCollection, setActiveCollection] = useState(null);

  // Apply dark mode class to body
  useEffect(() => {
    document.body.classList.toggle('dark-mode', isDarkMode);
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  const toggleDarkMode = useCallback(() => {
    setIsDarkMode(prev => !prev);
  }, []);

  // Update map styles based on theme
  const mapStyles = useMemo(() => ({
    ...mapOptions,
    styles: isDarkMode ? [
      { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
      { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
      { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
      {
        featureType: "administrative.locality",
        elementType: "labels.text.fill",
        stylers: [{ color: "#d59563" }],
      },
      {
        featureType: "poi",
        elementType: "labels.text.fill",
        stylers: [{ color: "#d59563" }],
      },
      {
        featureType: "poi.park",
        elementType: "geometry",
        stylers: [{ color: "#263c3f" }],
      },
      {
        featureType: "poi.park",
        elementType: "labels.text.fill",
        stylers: [{ color: "#6b9a76" }],
      },
      {
        featureType: "road",
        elementType: "geometry",
        stylers: [{ color: "#38414e" }],
      },
      {
        featureType: "road",
        elementType: "geometry.stroke",
        stylers: [{ color: "#212a37" }],
      },
      {
        featureType: "road",
        elementType: "labels.text.fill",
        stylers: [{ color: "#9ca5b3" }],
      },
      {
        featureType: "road.highway",
        elementType: "geometry",
        stylers: [{ color: "#746855" }],
      },
      {
        featureType: "road.highway",
        elementType: "geometry.stroke",
        stylers: [{ color: "#1f2835" }],
      },
      {
        featureType: "road.highway",
        elementType: "labels.text.fill",
        stylers: [{ color: "#f3d19c" }],
      },
      {
        featureType: "transit",
        elementType: "geometry",
        stylers: [{ color: "#2f3948" }],
      },
      {
        featureType: "transit.station",
        elementType: "labels.text.fill",
        stylers: [{ color: "#d59563" }],
      },
      {
        featureType: "water",
        elementType: "geometry",
        stylers: [{ color: "#17263c" }],
      },
      {
        featureType: "water",
        elementType: "labels.text.fill",
        stylers: [{ color: "#515c6d" }],
      },
      {
        featureType: "water",
        elementType: "labels.text.stroke",
        stylers: [{ color: "#17263c" }],
      },
    ] : mapOptions.styles
  }), [isDarkMode]);

  useEffect(() => {
    // Load search parameters from URL
    const searchParams = new URLSearchParams(window.location.search);
    const locationParam = searchParams.get('location');
    const preferencesParam = searchParams.get('preferences');
    
    if (locationParam) {
      setLocation(locationParam);
      if (preferencesParam) {
        setPreferences(preferencesParam);
      }
      // Automatically search if parameters are present
      handleSubmit(new Event('submit'));
    }

    // Load recent searches from localStorage
    const savedSearches = localStorage.getItem('recentSearches');
    if (savedSearches) {
      setRecentSearches(JSON.parse(savedSearches));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('favorites', JSON.stringify(favorites));
  }, [favorites]);

  const saveRecentSearch = useCallback((location, preferences) => {
    const newSearch = { location, preferences, timestamp: Date.now() };
    const updatedSearches = [newSearch, ...recentSearches.slice(0, 4)];
    setRecentSearches(updatedSearches);
    localStorage.setItem('recentSearches', JSON.stringify(updatedSearches));
  }, [recentSearches]);

  // Debounce the location and preferences input
  const handleLocationChange = useCallback((e) => {
    setLocation(e.target.value);
    setError(null);
  }, []);

  const handlePreferencesChange = useCallback((e) => {
    setPreferences(e.target.value);
    setError(null);
  }, []);

  const validateInput = () => {
    if (!location.trim()) {
      setError("Please enter a location");
      return false;
    }
    
    if (preferences.trim().length > 200) {
      setError("Preferences must be less than 200 characters");
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateInput()) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setRecommendations([]);

    try {
      // Request recommendations from the server
      const response = await axios.post("http://localhost:5000/api/recommendations", {
        userPreferences: preferences.trim(),
        location: location.trim(),
        timestamp: Date.now(), // Add timestamp to ensure different results
      });
      const data = response.data;

      if (Array.isArray(data) && data.length > 0) {
        setRecommendations(data);
        
        // Update map center if valid coordinates exist
        if (data[0].latitude && data[0].longitude) {
          setMapCenter({
            lat: data[0].latitude,
            lng: data[0].longitude,
          });
        }
      } else {
        setError("No recommendations found. Try adjusting your search criteria.");
      }
    } catch (err) {
      console.error("Error fetching recommendations:", err);
      setError(
        err.response?.data?.error || 
        "Unable to fetch recommendations. Please try again later."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkerClick = useCallback((place) => {
    setActiveMarker(place);
    setSelectedPlace(place);
    setMapCenter({
      lat: place.latitude,
      lng: place.longitude,
    });
  }, []);

  const sortRecommendations = useCallback((recommendations) => {
    if (!recommendations) return [];
    
    switch (sortBy) {
      case 'name':
        return [...recommendations].sort((a, b) => a.name.localeCompare(b.name));
      case 'distance':
        if (!userLocation) return recommendations;
        return [...recommendations].sort((a, b) => {
          const distA = calculateDistance(userLocation.lat, userLocation.lng, a.latitude, a.longitude);
          const distB = calculateDistance(userLocation.lat, userLocation.lng, b.latitude, b.longitude);
          return distA - distB;
        });
      default:
        return recommendations;
    }
  }, [sortBy, userLocation]);

  const toggleFavorite = useCallback((place) => {
    setFavorites(prevFavorites => {
      const exists = prevFavorites.some(p => p.name === place.name && p.address === place.address);
      if (exists) {
        return prevFavorites.filter(p => p.name !== place.name || p.address !== place.address);
      } else {
        return [...prevFavorites, place];
      }
    });
  }, []);

  const isPlaceFavorite = useCallback((place) => {
    return favorites.some(p => p.name === place.name && p.address === place.address);
  }, [favorites]);

  // Add geolocation effect
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.log('Geolocation error:', error);
        }
      );
    }
  }, []);

  // Mock sign in function (replace with real authentication)
  const handleSignIn = () => {
    // Simulate authentication
    setUser({
      displayName: "Demo User",
      email: "demo@example.com",
      photoURL: null
    });
  };

  const handleSignOut = () => {
    setUser(null);
  };

  if (loadError) {
    return <div className="container">
      <div className="error-message">
        Error loading Google Maps. Please check your internet connection and try again.
      </div>
    </div>;
  }

  if (!isLoaded) {
    return <div className="container">
      <div className="loading">
        <div className="loading-spinner"></div>
        Loading Map...
      </div>
    </div>;
  }

  return (
    <div className={`container ${isDarkMode ? 'dark-mode' : ''}`}>
      <header className="header">
        <div className="header-top">
          <div className="header-content">
            <Logo />
            {user ? (
              <UserMenu user={user} onSignOut={handleSignOut} />
            ) : (
              <AuthButtons onSignIn={handleSignIn} />
            )}
          </div>
          <ThemeToggle isDark={isDarkMode} onToggle={toggleDarkMode} />
        </div>
        <p>Revolutionize your travel with AI-assisted recommendations!</p>
      </header>

      {recentSearches.length > 0 && (
        <div className="recent-searches">
          <h3>Recent Searches</h3>
          <div className="recent-searches-list">
            {recentSearches.map((search, idx) => (
              <button
                key={idx}
                className="recent-search-item"
                onClick={() => {
                  setLocation(search.location);
                  setPreferences(search.preferences);
                }}
              >
                <svg className="history-icon" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
                {search.location}
                {search.preferences && <span className="search-preferences"> • {search.preferences}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="search-form">
        <div className="form-group">
          <label htmlFor="location">Location</label>
          <input
            id="location"
            type="text"
            value={location}
            onChange={handleLocationChange}
            placeholder="Enter city or region (e.g., New York, Paris, Tokyo)"
            required
            maxLength={100}
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="preferences">Preferences</label>
          <input
            id="preferences"
            type="text"
            value={preferences}
            onChange={handlePreferencesChange}
            placeholder="e.g., family-friendly museums, local restaurants, outdoor activities"
            maxLength={200}
            required
          />
          {preferences.length > 0 && (
            <div className="char-count">
              {preferences.length}/200 characters
            </div>
          )}
        </div>

        <div className="form-actions">
          <button 
            type="submit" 
            className="submit-button"
            disabled={isLoading || !location.trim()}
          >
            {isLoading ? (
              <>
                <span className="loading-spinner"></span>
                Finding recommendations...
              </>
            ) : (
              'Get Recommendations'
            )}
          </button>
          
          <ShareButton location={location} preferences={preferences} />
        </div>
      </form>

      {recommendations.length > 0 && (
        <div className="filters">
          <button 
            className="filter-toggle"
            onClick={() => setShowFilters(!showFilters)}
          >
            <svg className="filter-icon" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
            </svg>
            Filters & Collections
          </button>
          
          {showFilters && (
            <div className="filter-options">
              <PriceFilter
                value={filters.priceRange}
                onChange={value => setFilters(prev => ({ ...prev, priceRange: value }))}
              />
              <DistanceFilter
                value={filters.distance}
                onChange={value => setFilters(prev => ({ ...prev, distance: value }))}
              />
              <div className="filter-toggles">
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={filters.openNow}
                    onChange={e => setFilters(prev => ({ ...prev, openNow: e.target.checked }))}
                  />
                  Open Now
                </label>
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={filters.accessibility}
                    onChange={e => setFilters(prev => ({ ...prev, accessibility: e.target.checked }))}
                  />
                  Wheelchair Accessible
                </label>
              </div>
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value)}
                className="sort-select"
              >
                <option value="default">Default Order</option>
                <option value="name">Sort by Name</option>
                <option value="distance">Sort by Distance</option>
                <option value="price">Sort by Price</option>
              </select>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="error-message">
          <svg xmlns="http://www.w3.org/2000/svg" className="error-icon" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}

      <div className="main-content">
        <div className="content-wrapper">
          <div className="map-container">
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              zoom={12}
              center={mapCenter}
              options={mapStyles}
            >
              {recommendations.map((place, idx) => {
                if (!place.latitude || !place.longitude) return null;
                return (
                  <Marker
                    key={idx}
                    position={{ lat: place.latitude, lng: place.longitude }}
                    label={{
                      text: `${idx + 1}`,
                      color: 'white',
                      className: 'place-number'
                    }}
                    onClick={() => handleMarkerClick(place)}
                    animation={selectedPlace === place ? window.google.maps.Animation.BOUNCE : null}
                  />
                );
              })}
              
              {activeMarker && (
                <InfoWindow
                  position={{ lat: activeMarker.latitude, lng: activeMarker.longitude }}
                  onCloseClick={() => setActiveMarker(null)}
                >
                  <div className="info-window">
                    <h3>{activeMarker.name}</h3>
                    <p>{activeMarker.description}</p>
                    <p className="info-address">{activeMarker.address}</p>
                    <DirectionsButton place={activeMarker} />
                  </div>
                </InfoWindow>
              )}
            </GoogleMap>
          </div>

          {recommendations.length > 0 && (
            <div className="recommendations">
              <div className="recommendations-header">
                <h2>Recommended Places</h2>
                <div className="recommendations-actions">
                  <RefreshButton 
                    onClick={() => handleSubmit(new Event('submit'))} 
                    isLoading={isLoading} 
                  />
                  <ShareButton location={location} preferences={preferences} />
                </div>
              </div>
              <ul className="place-list">
                {sortRecommendations(recommendations).map((place, idx) => (
                  <li 
                    key={idx} 
                    className={`place-item ${selectedPlace === place ? 'selected' : ''}`}
                    onClick={() => handleMarkerClick(place)}
                  >
                    <div className="place-number">{idx + 1}</div>
                    <div className="place-content">
                      <div className="place-header">
                        <h3>{place.name}</h3>
                      </div>
                      <p className="place-description">{place.description}</p>
                      <p className="place-address">
                        <svg className="address-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                        </svg>
                        {place.address}
                      </p>
                      <div className="place-categories">
                        {place.categories?.map((category, idx) => (
                          <span key={idx} className="category-tag">{category}</span>
                        ))}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="sidebar">
          <FavoritesList 
            favorites={favorites}
            onPlaceClick={handleMarkerClick}
            onRemove={toggleFavorite}
          />
          
          <div className="collections-section">
            <h3>My Collections</h3>
            <CollectionManager
              collections={collections}
              onCreateCollection={name => {
                const newCollection = {
                  id: Date.now(),
                  name,
                  places: []
                };
                setCollections(prev => [...prev, newCollection]);
              }}
              onAddToCollection={(collectionId, place) => {
                setCollections(prev => prev.map(c => 
                  c.id === collectionId
                    ? { ...c, places: [...c.places, place] }
                    : c
                ));
              }}
              activePlace={selectedPlace}
            />
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

const PriceFilter = ({ value, onChange }) => (
  <div className="filter-group">
    <label>Price Range</label>
    <select value={value} onChange={e => onChange(e.target.value)}>
      <option value="all">All Prices</option>
      <option value="1">$</option>
      <option value="2">$$</option>
      <option value="3">$$$</option>
      <option value="4">$$$$</option>
    </select>
  </div>
);

const DistanceFilter = ({ value, onChange }) => (
  <div className="filter-group">
    <label>Distance</label>
    <select value={value} onChange={e => onChange(e.target.value)}>
      <option value="all">Any Distance</option>
      <option value="1">Within 1 mile</option>
      <option value="5">Within 5 miles</option>
      <option value="10">Within 10 miles</option>
      <option value="20">Within 20 miles</option>
    </select>
  </div>
);

const CollectionManager = ({ collections, onCreateCollection, onAddToCollection, activePlace }) => {
  const [newCollectionName, setNewCollectionName] = useState('');
  
  const handleCreate = (e) => {
    e.preventDefault();
    if (newCollectionName.trim()) {
      onCreateCollection(newCollectionName.trim());
      setNewCollectionName('');
    }
  };

  const handleAddToCollection = (collectionId, place) => {
    onAddToCollection(collectionId, place);
    // Show a success message or animation
  };

  return (
    <div className="collections-manager">
      <form onSubmit={handleCreate} className="create-collection">
        <input
          type="text"
          value={newCollectionName}
          onChange={e => setNewCollectionName(e.target.value)}
          placeholder="New Collection Name"
          required
        />
        <button type="submit">Create</button>
      </form>
      
      {activePlace && (
        <div className="collection-list">
          <h4>Add to Collection</h4>
          {collections.map((collection) => (
            <button
              key={collection.id}
              className="collection-item"
              onClick={() => handleAddToCollection(collection.id, activePlace)}
            >
              <span>{collection.name}</span>
              <span className="place-count">{collection.places.length}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default App;
