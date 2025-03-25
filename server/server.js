// server.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Configuration, OpenAIApi } = require('openai');

const app = express();
app.use(cors());
app.use(express.json());

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Validation middleware
const validateRequest = (req, res, next) => {
  const { userPreferences, location } = req.body;
  
  if (!location || typeof location !== 'string' || location.trim().length === 0) {
    return res.status(400).json({ 
      error: "Location is required and must be a non-empty string" 
    });
  }

  // Preferences can be empty, but if provided must be a string
  if (userPreferences && typeof userPreferences !== 'string') {
    return res.status(400).json({ 
      error: "Preferences must be a string if provided" 
    });
  }

  next();
};

// Validate OpenAI response data
const validateRecommendations = (data) => {
  if (!Array.isArray(data)) {
    throw new Error("Response data must be an array");
  }

  if (data.length === 0) {
    throw new Error("No recommendations found");
  }

  // Validate each recommendation
  data.forEach((item, index) => {
    if (!item.name || typeof item.name !== 'string') {
      throw new Error(`Invalid name in recommendation ${index + 1}`);
    }
    if (!item.description || typeof item.description !== 'string') {
      throw new Error(`Invalid description in recommendation ${index + 1}`);
    }
    if (!item.address || typeof item.address !== 'string') {
      throw new Error(`Invalid address in recommendation ${index + 1}`);
    }
    if (item.latitude && (typeof item.latitude !== 'number' || item.latitude < -90 || item.latitude > 90)) {
      throw new Error(`Invalid latitude in recommendation ${index + 1}`);
    }
    if (item.longitude && (typeof item.longitude !== 'number' || item.longitude < -180 || item.longitude > 180)) {
      throw new Error(`Invalid longitude in recommendation ${index + 1}`);
    }
  });

  return data;
};

app.post('/api/recommendations', validateRequest, async (req, res) => {
  try {
    const { userPreferences, location } = req.body;

    // Build the user's prompt content with more specific instructions
    const userPrompt = `
      You are LocaInsight, a helpful travel guide specializing in personalized navigation and itineraries.
      The user is located in or visiting ${location} and has the following preferences:
      ${userPreferences || 'No specific preferences provided - suggest popular and interesting locations'}

      Suggest 3-5 interesting locations in or near ${location}.
      Each location MUST include:
      1. A specific name (not generic terms like "downtown" or "city center")
      2. A detailed but concise description (1-2 sentences about what makes this place special)
      3. A complete street address
      4. Precise latitude and longitude coordinates

      Return ONLY valid JSON data with this exact structure:
      [
        {
          "name": "Specific Location Name",
          "description": "Detailed description of the location",
          "address": "Complete street address",
          "latitude": number between -90 and 90,
          "longitude": number between -180 and 180
        }
      ]
    `;

    // Use Chat Completion with more specific parameters
    const response = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a travel assistant that provides only valid JSON results. Never include explanatory text outside the JSON structure."
        },
        {
          role: "user",
          content: userPrompt
        }
      ],
      max_tokens: 500,  // Increased for more detailed responses
      temperature: 0.7,
      presence_penalty: 0.3,  // Slightly encourage novel recommendations
      frequency_penalty: 0.3,  // Reduce repetition in descriptions
    });

    // Extract and clean the response text
    let text = response.data.choices[0].message.content.trim();

    // Remove markdown code fences if present
    const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
    const match = text.match(codeBlockRegex);
    if (match) {
      text = match[1].trim();
    } else {
      // Extract JSON from first '[' to last ']'
      const firstBracket = text.indexOf('[');
      const lastBracket = text.lastIndexOf(']');
      if (firstBracket !== -1 && lastBracket !== -1) {
        text = text.substring(firstBracket, lastBracket + 1);
      }
    }

    // Parse and validate the response
    let parsedData;
    try {
      parsedData = JSON.parse(text);
      parsedData = validateRecommendations(parsedData);
    } catch (error) {
      console.error("Validation error:", error);
      return res.status(500).json({ 
        error: "Failed to generate valid recommendations. Please try again." 
      });
    }

    // Cache headers for better performance
    res.set('Cache-Control', 'private, max-age=300'); // Cache for 5 minutes
    return res.status(200).json(parsedData);

  } catch (error) {
    console.error("Server error:", error);
    
    // Provide more specific error messages
    if (error.response?.status === 429) {
      return res.status(429).json({ 
        error: "Too many requests. Please try again in a moment." 
      });
    }
    
    if (error.response?.status === 401) {
      return res.status(500).json({ 
        error: "Internal server configuration error. Please contact support." 
      });
    }

    return res.status(500).json({ 
      error: "Failed to fetch recommendations. Please try again later." 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
