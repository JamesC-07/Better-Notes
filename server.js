const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// In-memory storage (you can replace with a database later)
let notes = [];
let noteIdCounter = 1;

// Serve static files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Get all notes
app.get('/api/notes', (req, res) => {
  res.json(notes.sort((a, b) => b.timestamp - a.timestamp));
});

// Save a note
app.post('/api/notes', (req, res) => {
  const { content } = req.body;
  
  if (!content || content.trim() === '') {
    return res.status(400).json({ error: 'Content is required' });
  }

  const note = {
    id: noteIdCounter++,
    content: content.trim(),
    timestamp: Date.now()
  };

  notes.push(note);
  res.json(note);
});

// Delete a note
app.delete('/api/notes/:id', (req, res) => {
  const noteId = parseInt(req.params.id);
  const noteIndex = notes.findIndex(note => note.id === noteId);
  
  if (noteIndex === -1) {
    return res.status(404).json({ error: 'Note not found' });
  }

  notes.splice(noteIndex, 1);
  res.json({ message: 'Note deleted' });
});

// AI auto-completion endpoint
app.post('/api/ai/complete', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || text.length < 5) {
      return res.json({ suggestions: [] });
    }

    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama3-8b-8192',
      messages: [{
        role: 'user',
        content: `Given this text: "${text}"
        
Provide 3 short word completions or next words that would naturally follow. 
Respond with only the suggestions, one per line, no numbering or extra text.`
      }],
      max_tokens: 50,
      temperature: 0.3
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const suggestions = response.data.choices[0].message.content
      .split('\n')
      .filter(s => s.trim() !== '')
      .slice(0, 3);

    res.json({ suggestions });
  } catch (error) {
    console.error('AI completion error:', error.message);
    res.status(500).json({ error: 'Failed to get AI suggestions' });
  }
});

// AI text correction endpoint
app.post('/api/ai/correct', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || text.trim() === '') {
      return res.status(400).json({ error: 'Text is required' });
    }

    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama3-8b-8192',
      messages: [{
        role: 'user',
        content: `Please correct any spelling, grammar, and punctuation errors in this text while maintaining its original meaning and style:

"${text}"

Respond with only the corrected text, no explanations.`
      }],
      max_tokens: 500,
      temperature: 0.1
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const correctedText = response.data.choices[0].message.content.trim();
    res.json({ correctedText });
  } catch (error) {
    console.error('AI correction error:', error.message);
    res.status(500).json({ error: 'Failed to correct text' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
