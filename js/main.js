// main.js (replace your current file with this)
console.log("✅ main.js (robust) loaded");

(function () {
  // Ensure global player UI + audio exist
  function ensureGlobalPlayerExists() {
    let gp = document.getElementById("globalPlayer");
    if (!gp) {
      gp = document.createElement("div");
      gp.id = "globalPlayer";
      document.body.appendChild(gp);
    }
    gp.style.cssText = "position:fixed;bottom:0;left:0;right:0;background:#754c21;color:#fff;padding:10px;display:flex;align-items:center;z-index:9999;border-top:2px solid #754c21;transition:transform 0.3s ease;";
    gp.innerHTML = `
      <style>
        .play-btn::before {
          content: "";
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 20px;
          height: 20px;
          background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' fill='white' viewBox='0 0 24 24'%3E%3Cpath d='M8 5v14l11-7z'/%3E%3C/svg%3E") no-repeat center;
          background-size: 20px;
        }
        .play-btn.pause::before {
          background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' fill='white' viewBox='0 0 24 24'%3E%3Crect x='6' y='4' width='4' height='16'/%3E%3Crect x='14' y='4' width='4' height='16'/%3E%3C/svg%3E") no-repeat center;
          background-size: 20px;
        }
      </style>
      <button id="prevBtn" style="background:#754c21;color:#fff;border:none;border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;margin:0 5px;cursor:pointer;">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="white" viewBox="0 0 24 24"><path d="M6 19V5h2v14H6zm3.5-7L20 19V5l-10.5 7z"/></svg>
      </button>
      <button id="playPauseBtn" class="play-btn play" style="background:#754c21;color:#fff;border:none;border-radius:50%;width:50px;height:50px;display:flex;align-items:center;justify-content:center;margin:0 5px;position:relative;cursor:pointer;"></button>
      <button id="nextBtn" style="background:#754c21;color:#fff;border:none;border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;margin:0 5px;cursor:pointer;">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="white" viewBox="0 0 24 24"><path d="M18 5v14h-2V5h2zM5 19l10.5-7L5 5v14z"/></svg>
      </button>
      <span id="currentTime" style="margin-left:10px;">0:00</span>
      <input type="range" id="progress" value="0" min="0" step="1" style="flex:1;margin:0 10px;accent-color:#754c21;cursor:pointer;">
      <span id="duration">0:00</span>
      <span id="nowPlaying" style="margin-left:10px;font-weight:bold;">No song</span>
    `;

    if (!document.getElementById("audio")) {
      const a = document.createElement("audio");
      a.id = "audio";
      // do not set autoplay here; we will try to restore and handle promise
      document.body.appendChild(a);
    }
  }

  ensureGlobalPlayerExists();

  // DOM elements (guaranteed after ensureGlobalPlayerExists)
  const audio = document.getElementById("audio");
  const playPauseBtn = document.getElementById("playPauseBtn");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const progress = document.getElementById("progress");
  const nowPlaying = document.getElementById("nowPlaying");
  const currentTimeEl = document.getElementById("currentTime");
  const durationEl = document.getElementById("duration");

  // Playlist - can be set by pages
  let playlist = [];
  let currentTrack = 0;
  let isPlaying = false;

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  }

  // Save/restore state
  function saveState() {
    try {
      localStorage.setItem("playerState", JSON.stringify({
        track: currentTrack,
        time: audio.currentTime || 0,
        playing: !audio.paused
      }));
    } catch (e) {
      console.warn("Could not save player state:", e);
    }
  }

  function loadTrack(index, autoplay = false) {
    if (!playlist[index]) return;
    currentTrack = index;
    audio.src = playlist[currentTrack].src;
    nowPlaying.textContent = "Now Playing: " + playlist[currentTrack].title;
    if (autoplay) {
      const p = audio.play();
      if (p && p.catch) p.catch(err => console.warn("Autoplay blocked or failed:", err));
      isPlaying = !audio.paused;
      updatePlayIcon(isPlaying);
    } else {
      updatePlayIcon(false);
      isPlaying = false;
    }
    saveState();
  }

  function updatePlayIcon(playing) {
    if (!playPauseBtn) return;
    if (playing) {
      playPauseBtn.classList.add("pause");
      playPauseBtn.classList.remove("play");
    } else {
      playPauseBtn.classList.remove("pause");
      playPauseBtn.classList.add("play");
    }
  }

  // Buttons (guard in case DOM changed)
  if (playPauseBtn) {
    playPauseBtn.addEventListener("click", () => {
      if (audio.paused) {
        audio.play().catch(err => console.warn("Play failed:", err));
        isPlaying = true;
      } else {
        audio.pause();
        isPlaying = false;
      }
      updatePlayIcon(isPlaying);
      saveState();
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      if (playlist.length > 0) {
        currentTrack = (currentTrack - 1 + playlist.length) % playlist.length;
        loadTrack(currentTrack, true);
      }
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      if (playlist.length > 0) {
        currentTrack = (currentTrack + 1) % playlist.length;
        loadTrack(currentTrack, true);
      }
    });
  }

  // Progress updates
  audio.addEventListener("timeupdate", () => {
    if (!isNaN(audio.duration) && progress) {
      progress.max = Math.floor(audio.duration) || 0;
      progress.value = Math.floor(audio.currentTime) || 0;
      if (currentTimeEl) currentTimeEl.textContent = formatTime(audio.currentTime);
      if (durationEl) durationEl.textContent = formatTime(audio.duration);
    }
    saveState();
  });

  if (progress) {
    progress.addEventListener("input", () => {
      audio.currentTime = progress.value;
      saveState();
    });
  }

  audio.addEventListener("ended", () => {
    if (playlist.length > 0) {
      currentTrack = (currentTrack + 1) % playlist.length;
      loadTrack(currentTrack, true);
    }
  });

  // Public functions: allow pages to control the player
  window.playSong = (src, title) => {
    // Try to find in playlist
    const idx = playlist.findIndex(p => p.src === src);
    if (idx !== -1) {
      loadTrack(idx, true);
    } else {
      // Not in playlist — play directly
      audio.src = src;
      nowPlaying.textContent = "Now Playing: " + (title || src);
      audio.play().catch(err => console.warn("Play failed:", err));
      isPlaying = true;
      updatePlayIcon(true);
      saveState();
    }
  };

  window.setPlaylist = (newPlaylist) => {
    playlist = newPlaylist || [];
    currentTrack = 0;
    window._GLOBAL_PLAYLIST = playlist;
    // Playlist is now managed by the server, no need for localStorage
  };

  // Restore previously saved state (if any)
  function restoreState() {
    try {
      const state = JSON.parse(localStorage.getItem("playerState"));
      if (state && typeof state.track === "number" && playlist.length > 0 && playlist[state.track]) {
        currentTrack = state.track;
        audio.src = playlist[currentTrack].src;
        nowPlaying.textContent = "Now Playing: " + playlist[currentTrack].title;
        if (state.time) audio.currentTime = state.time;
        if (state.playing) {
          audio.play().then(() => {
            isPlaying = true;
            updatePlayIcon(true);
          }).catch(err => {
            // autoplay blocked — leave paused but reflect UI
            console.warn("Autoplay during restore was blocked:", err);
            isPlaying = false;
            updatePlayIcon(false);
          });
        } else {
          isPlaying = false;
          updatePlayIcon(false);
        }
      } else {
        // No valid state or empty playlist — just set initial state
        isPlaying = false;
        updatePlayIcon(false);
        nowPlaying.textContent = "No song";
      }
    } catch (e) {
      console.warn("Failed to restore state:", e);
      isPlaying = false;
      updatePlayIcon(false);
      nowPlaying.textContent = "No song";
    }
  }

  // expose playlist for debugging
  window._GLOBAL_PLAYLIST = playlist;

  // Hide player on scroll to bottom
  let playerHidden = false;
  window.addEventListener("scroll", () => {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const windowHeight = window.innerHeight;
    const fullHeight = document.documentElement.scrollHeight;
    const gp = document.getElementById("globalPlayer");
    if (gp) {
      if (!playerHidden && scrollTop + windowHeight >= fullHeight - 10) {
        gp.style.transform = "translateY(100%)";
        playerHidden = true;
      } else if (playerHidden && scrollTop + windowHeight < fullHeight - 10) {
        gp.style.transform = "translateY(0)";
        playerHidden = false;
      }
    }
  });

  // Run restore on load
  restoreState();

  console.log("Global audio player ready. Use window.playSong(src, title) to play tracks. Use window.setPlaylist(playlistArray) to set a playlist.");
})();
