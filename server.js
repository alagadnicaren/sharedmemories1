const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Create subdirectories for different file types
const imagesDir = path.join(uploadsDir, 'images');
const audioDir = path.join(uploadsDir, 'audio');
if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir);
if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, imagesDir);
    } else if (file.mimetype.startsWith('audio/')) {
      cb(null, audioDir);
    } else {
      cb(new Error('Invalid file type'), null);
    }
  },
  filename: (req, file, cb) => {
    const uniqueName = uuidv4() + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

// In-memory storage for simplicity (replace with database in production)
let albums = [];
let songs = [];
let users = [];

// Load data from files if they exist
const albumsFile = path.join(__dirname, 'data', 'albums.json');
const songsFile = path.join(__dirname, 'data', 'songs.json');
const usersFile = path.join(__dirname, 'data', 'users.json');

// Create data directory
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

// Helper functions to load/save data
function loadData() {
  try {
    if (fs.existsSync(albumsFile)) {
      albums = JSON.parse(fs.readFileSync(albumsFile, 'utf8'));
    }
    if (fs.existsSync(songsFile)) {
      songs = JSON.parse(fs.readFileSync(songsFile, 'utf8'));
    }
    if (fs.existsSync(usersFile)) {
      users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
    }
  } catch (error) {
    console.error('Error loading data:', error);
  }
}

function saveData() {
  try {
    fs.writeFileSync(albumsFile, JSON.stringify(albums, null, 2));
    fs.writeFileSync(songsFile, JSON.stringify(songs, null, 2));
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
  } catch (error) {
    console.error('Error saving data:', error);
  }
}

// Load initial data
loadData();

// API Routes

// Get all albums
app.get('/api/albums', (req, res) => {
  res.json(albums);
});

// Upload album image
app.post('/api/albums/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const { caption, uploader } = req.body;
  const newAlbum = {
    id: uuidv4(),
    src: `/uploads/images/${req.file.filename}`,
    caption: caption || 'New Memory',
    uploader: uploader || 'Anonymous',
    timestamp: new Date().toISOString(),
    likes: 0,
    likedBy: []
  };

  albums.push(newAlbum);
  saveData();

  res.json(newAlbum);
});

// Update album (like/unlike)
app.put('/api/albums/:id', (req, res) => {
  const { id } = req.params;
  const { action, user } = req.body;

  const album = albums.find(a => a.id === id);
  if (!album) {
    return res.status(404).json({ error: 'Album not found' });
  }

  if (action === 'like') {
    if (!album.likedBy.includes(user)) {
      album.likedBy.push(user);
      album.likes++;
    }
  } else if (action === 'unlike') {
    const index = album.likedBy.indexOf(user);
    if (index > -1) {
      album.likedBy.splice(index, 1);
      album.likes--;
    }
  }

  saveData();
  res.json(album);
});

// Delete album
app.delete('/api/albums/:id', (req, res) => {
  const { id } = req.params;
  const { user } = req.body;

  const index = albums.findIndex(a => a.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Album not found' });
  }

  const album = albums[index];
  if (album.uploader !== user) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  // Delete file
  const filePath = path.join(__dirname, album.src);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  albums.splice(index, 1);
  saveData();

  res.json({ message: 'Album deleted' });
});

// Get all songs
app.get('/api/songs', (req, res) => {
  res.json(songs);
});

// Upload song
app.post('/api/songs/upload', upload.single('audio'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const { title, uploader } = req.body;
  const newSong = {
    id: uuidv4(),
    title: title || req.file.originalname.replace(/\.(mp3|mpeg)$/i, ''),
    src: `/uploads/audio/${req.file.filename}`,
    fileName: req.file.originalname,
    uploader: uploader || 'Anonymous',
    duration: 'Unknown', // Will be calculated on client
    likes: 0,
    likedBy: []
  };

  songs.push(newSong);
  saveData();

  res.json(newSong);
});

// Delete song
app.delete('/api/songs/:id', (req, res) => {
  const { id } = req.params;
  const { user } = req.body;

  const index = songs.findIndex(s => s.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Song not found' });
  }

  const song = songs[index];
  if (song.uploader !== user) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  // Delete file
  const filePath = path.join(__dirname, song.src);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  songs.splice(index, 1);
  saveData();

  res.json({ message: 'Song deleted' });
});

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir));

// Serve the main HTML files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Uploads directory: ${uploadsDir}`);
});