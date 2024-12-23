# Spotify-to-YouTube Playlist Converter  

An Express.js-based app to seamlessly transfer playlists from Spotify to YouTube. This app fetches tracks from a Spotify playlist, creates a corresponding playlist on YouTube, and populates it with matching songs.  

---

## Features  
- Transfer playlists from Spotify to YouTube.  
- Automatically searches for matching tracks on YouTube.  
- Creates private YouTube playlists for better privacy.  
- Easy-to-use endpoints for OAuth2-based authentication.  

---

## Prerequisites  

### Accounts Needed  
- Spotify account with access to playlists.  
- Google account with YouTube API enabled.  

### Environment Setup  
1. Enable the Spotify API and get your credentials:  
   - `SPOTIFY_ID`  
   - `SPOTIFY_SECRET`  
2. Enable the YouTube Data API and get your credentials:  
   - `GOOGLE_ID`  
   - `GOOGLE_SECRET`  
   - `YTB_API_KEY`  

---

## Installation  

1. Clone the repository:  
   ```bash
   git clone https://github.com/your-repo/playlist-converter.git
   cd playlist-converter
