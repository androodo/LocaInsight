import React, { useState } from 'react';
import axios from 'axios';
import { GoogleMap, Marker, useLoadScript } from '@react-google-maps/api';

const mapContainerStyle = {
  width: '100%',
  height: '500px',
};

const defaultCenter = {
  lat: 40.7128, // Default center (e.g., NYC)
  lng: -74.0060,
};

function App() {
  // Load Google Maps
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: "INSERT_YOUR_GOOGLE_MAPS_API_KEY" // Replace with your real key!
  });

  // Component states
  const [location, setLocation] = useState("");
  const [preferences, setPreferences] = useState("");
  const [recommendations, setRecommendations] = useState([]);
  const [mapCenter, setMapCenter] = useState(defaultCenter);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!location) return;

    try {
      // Request recommendations from the server
      const response = await axios.post("http://localhost:5000/api/recommendations", {
        userPreferences: preferences,
        location: location,
      });
      const data = response.data;

      if (Array.isArray(data)) {
        setRecommendations(data);

        // Optionally re-center the map on the first recommendation
        if (data.length && data[0].latitude && data[0].longitude) {
          setMapCenter({
            lat: data[0].latitude,
            lng: data[0].longitude,
          });
        }
      }
    } catch (err) {
      console.error("Error fetching recommendations:", err);
      alert("Unable to fetch recommendations. Please try again later.");
    }
  };

  if (!isLoaded) {
    return <div>Loading Map...</div>;
  }

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "1rem" }}>
      <h1>LocaInsight</h1>
      <p>Revolutionize your travel with AI-assisted recommendations.</p>

      <form onSubmit={handleSubmit} style={{ marginBottom: "1rem" }}>
        <div style={{ marginBottom: "0.5rem" }}>
          <label>Location: </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Enter city or region"
            required
          />
        </div>
        <div style={{ marginBottom: "0.5rem" }}>
          <label>Preferences: </label>
          <input
            type="text"
            value={preferences}
            onChange={(e) => setPreferences(e.target.value)}
            placeholder="e.g., museums, outdoors, local cuisine"
          />
        </div>
        <button type="submit">Get Recommendations</button>
      </form>

      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        zoom={12}
        center={mapCenter}
      >
        {recommendations.map((place, idx) => {
          if (!place.latitude || !place.longitude) return null;
          return (
            <Marker
              key={idx}
              position={{ lat: place.latitude, lng: place.longitude }}
              label={`${idx + 1}`}
            />
          );
        })}
      </GoogleMap>

      {recommendations.length > 0 && (
        <div style={{ marginTop: "1rem" }}>
          <h2>Recommended Places</h2>
          <ul>
            {recommendations.map((place, idx) => (
              <li key={idx} style={{ marginBottom: "0.5rem" }}>
                <strong>{place.name}</strong>: {place.description}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default App;
