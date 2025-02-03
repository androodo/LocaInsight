// server.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Configuration, OpenAIApi } = require('openai');

const app = express();
app.use(cors());
app.use(express.json());

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY, // This is your project-based key sk-proj-...
});
const openai = new OpenAIApi(configuration);

app.post('/api/recommendations', async (req, res) => {
  try {
    const { userPreferences, location } = req.body;

    // Build the user's prompt content
    const userPrompt = `
      You are LocaInsight, a helpful travel guide specializing in personalized itineraries.
      The user is located in or visiting ${location} and has the following preferences:
      ${userPreferences}

      Suggest 3-5 interesting locations in or near ${location}.
      Include each location's name, a brief description,
      and approximate latitude/longitude if possible.
      Return the data in JSON format with the structure:
      [
        {
          "name": "...",
          "description": "...",
          "latitude": ...,
          "longitude": ...
        },
        ...
      ]
    `;

    // Use Chat Completion (gpt-3.5-turbo)
    const response = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        // System instructions for how the AI should behave
        {
          role: "system",
          content: "You are a travel assistant that provides only JSON results when requested."
        },
        // Actual user request or message
        {
          role: "user",
          content: userPrompt
        }
      ],
      max_tokens: 300,
      temperature: 0.7,
    });

    // The text is in response.data.choices[0].message.content
    const text = response.data.choices[0].message.content.trim();

    // Try parsing the text as JSON
    let parsedData;
    try {
      parsedData = JSON.parse(text);
    } catch (jsonErr) {
      console.error("JSON parsing error:", jsonErr);
      return res.status(500).json({ error: "Failed to parse GPT response as JSON." });
    }

    return res.status(200).json(parsedData);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to fetch recommendations." });
  }
});

app.listen(process.env.PORT || 5000, () => {
  console.log(`Server running on http://localhost:${process.env.PORT || 5000}`);
});
