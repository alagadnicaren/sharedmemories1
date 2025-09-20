// music.js
document.addEventListener('DOMContentLoaded', function() {
    const playlistEl = document.getElementById('playlist');
    const addMusicBtn = document.getElementById('add-music-btn');
    let songs = [];

    // Load songs from server
    async function loadSongs() {
        try {
            const response = await fetch('http://localhost:3001/api/songs');
            if (response.ok) {
                songs = await response.json();
                window.setPlaylist(songs);
            } else {
                console.error('Failed to load songs from server, using empty state');
                songs = [];
                window.setPlaylist([]);
            }
        } catch (error) {
            console.error('Error loading songs from server, using empty state:', error);
            songs = [];
            window.setPlaylist([]);
        }
        // Always render, even if server request failed
        renderPlaylist();
    }

    // Render playlist
    function renderPlaylist() {
        playlistEl.innerHTML = '';

        if (songs.length === 0) {
            playlistEl.innerHTML = '<li class="empty-playlist">No songs yet. Add your first song!</li>';
            return;
        }

        songs.forEach((song, index) => {
            const li = document.createElement('li');
            li.className = 'playlist-item';

            const currentUser = localStorage.getItem('currentUser');
            const isOwner = song.uploader === currentUser;
            const hasLiked = song.likedBy && song.likedBy.includes(currentUser);

            // Check if this song is currently playing
            const audio = document.getElementById('audio');
            const isPlaying = audio && !audio.paused;
            const isCurrentSong = window._GLOBAL_PLAYLIST &&
                window._GLOBAL_PLAYLIST.some(s => s.src === song.src);

            li.innerHTML = `
                <button class="play-btn ${isCurrentSong && isPlaying ? 'playing' : ''}" data-index="${index}"></button>
                <div class="song-info">
                    <div class="song-title">${song.title}</div>
                    <div class="song-meta">
                        <span class="uploader">By: ${song.uploader}</span>
                    </div>
                    <div class="song-duration">${song.duration || 'Unknown'}</div>
                </div>
                <div class="song-controls">
                    ${isOwner ? `<button class="delete-song-btn" data-index="${index}"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="white" viewBox="0 0 24 24"><path d="M3 6v18h18v-18h-18zm5 14c0 .552-.448 1-1 1s-1-.448-1-1v-10c0-.552.448-1 1-1s1 .448 1 1v10zm5 0c0 .552-.448 1-1 1s-1-.448-1-1v-10c0-.552.448-1 1-1s1 .448 1 1v10zm5 0c0 .552-.448 1-1 1s-1-.448-1-1v-10c0-.552.448-1 1-1s1 .448 1 1v10zm4-18v2h-20v-2h5.711c.9 0 1.631-1.099 1.631-2.449h5.315c0 1.351.73 2.449 1.631 2.449h5.712z"/></svg> Delete</button>` : ''}
                </div>
            `;

            playlistEl.appendChild(li);
        });

        // Add event listeners
        document.querySelectorAll('.play-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const index = parseInt(this.dataset.index);
                const song = songs[index];
                const audio = document.getElementById('audio');

                // Check if this song is currently playing
                const isCurrentSong = window._GLOBAL_PLAYLIST &&
                    window._GLOBAL_PLAYLIST.some(s => s.src === song.src);

                if (isCurrentSong && audio && !audio.paused) {
                    // If this song is playing, pause it
                    const playPauseBtn = document.getElementById('playPauseBtn');
                    if (playPauseBtn) {
                        playPauseBtn.click();
                    }
                } else {
                    // Start playing this song
                    window.playSong(song.src, song.title);
                }

                // Update visual state
                renderPlaylist();
            });
        });

        // Delete buttons
        document.querySelectorAll('.delete-song-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const index = parseInt(this.dataset.index);
                deleteSong(index);
            });
        });
    }

    // Upload trigger
    addMusicBtn.addEventListener('click', function() {
        document.getElementById('music-upload').click();
    });

    // File input change
    document.getElementById('music-upload').addEventListener('change', handleFileUpload);

    // Loading indicator
    let uploadProgress = {};

    function showLoading(fileCount) {
        addMusicBtn.textContent = `Uploading... (0/${fileCount})`;
        addMusicBtn.disabled = true;
    }

    function updateProgress(index, percent) {
        uploadProgress[index] = percent;
        const total = Object.values(uploadProgress).reduce((a, b) => a + b, 0) / Object.keys(uploadProgress).length;
        addMusicBtn.textContent = `Uploading... (${Math.round(total)}%)`;
    }

    function hideLoading() {
        addMusicBtn.textContent = 'Add Music';
        addMusicBtn.disabled = false;
        uploadProgress = {};
    }

    // Handle file upload
    async function handleFileUpload(event) {
        const files = Array.from(event.target.files).filter(file =>
            file.type.startsWith('audio/') ||
            file.name.toLowerCase().endsWith('.mp3') ||
            file.name.toLowerCase().endsWith('.mpeg')
        );
        if (files.length === 0) return;

        const currentUser = localStorage.getItem('currentUser');
        if (!currentUser) {
            alert('Please log in to upload music');
            return;
        }

        showLoading(files.length);
        let processed = 0;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const formData = new FormData();
            formData.append('audio', file);
            formData.append('uploader', currentUser);
            formData.append('title', file.name.replace(/\.(mp3|mpeg)$/i, ''));

            try {
                const response = await fetch('http://localhost:3001/api/songs/upload', {
                    method: 'POST',
                    body: formData
                });

                if (response.ok) {
                    const newSong = await response.json();
                    songs.push(newSong);
                    window.setPlaylist(songs);
                } else {
                    console.error('Failed to upload song');
                }
            } catch (error) {
                console.error('Error uploading song:', error);
            }

            processed++;
            updateProgress(i, Math.round((processed / files.length) * 100));

            if (processed === files.length) {
                hideLoading();
                renderPlaylist();
                // Reset input
                event.target.value = '';
            }
        }
    }

    // Format duration
    function formatDuration(seconds) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }

    // Delete song
    async function deleteSong(index) {
        const currentUser = localStorage.getItem('currentUser');
        if (!currentUser) return;

        const song = songs[index];

        if (song.uploader === currentUser && confirm('Are you sure you want to delete this song?')) {
            try {
                const response = await fetch(`http://localhost:3001/api/songs/${song.id}`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ user: currentUser })
                });

                if (response.ok) {
                    songs.splice(index, 1);
                    window.setPlaylist(songs);
                    renderPlaylist();
                } else {
                    console.error('Failed to delete song');
                    alert('Failed to delete song. Please try again.');
                }
            } catch (error) {
                console.error('Error deleting song:', error);
                alert('Error deleting song. Please try again.');
            }
        }
    }

    // Spacebar play/pause functionality
    document.addEventListener('keydown', function(e) {
        // Only trigger if spacebar is pressed and not in an input field
        if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault(); // Prevent page scroll

            // Use global player pause/play instead of playlist buttons
            const globalPlayer = document.getElementById('globalPlayer');
            if (globalPlayer) {
                const playPauseBtn = document.getElementById('playPauseBtn');
                if (playPauseBtn) {
                    playPauseBtn.click();
                }
            }
        }
    });

    // Initial load
    loadSongs();
});