require('dotenv').config();
const express = require('express');
const axios = require('axios');
const querystring = require('querystring');
const bodyParser = require('body-parser');
const cors = require('cors');


const app = express();
const PORT = 3001;

app.use(cors());
const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/api/token';
const YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3';

const { SPOTIFY_ID, SPOTIFY_SECRET, YTB_API_KEY, GOOGLE_ID, GOOGLE_SECRET } = process.env;
let YTB_ACCESS_TOKEN = null;

let spotifyAccessToken = '';

app.use(bodyParser.json());

const refreshYoutubeToken = async () => {
    try {
        const response = await axios.post('https://oauth2.googleapis.com/token', {
            client_id: process.env.GOOGLE_ID,
            client_secret: process.env.GOOGLE_SECRET,
            grant_type: 'refresh_token',
            refresh_token: process.env.YTB_REFRESH_TOKEN,
        });

        YTB_ACCESS_TOKEN = response.data.access_token;
        console.log('Access Token Renovado:', YTB_ACCESS_TOKEN);
    } catch (error) {
        console.error('Erro ao renovar token do YouTube:', error.response?.data || error.message);
    }
};

// Exemplo de como usar o token atualizado
setInterval(refreshYoutubeToken, 50 * 60 * 1000); // Renova o token a cada 50 minutos


// Endpoint para iniciar o fluxo OAuth
app.get('/login', (req, res) => {
    const authUrl = `https://accounts.google.com/o/oauth2/auth?${querystring.stringify({
        client_id: process.env.GOOGLE_ID,
        redirect_uri: 'http://localhost:3001/callback',
        response_type: 'code',
        scope: 'https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/youtube.force-ssl',
        access_type: 'offline',
        prompt: 'consent',
    })}`;
    res.redirect(authUrl);
});

// Callback para gerenciar o retorno da autenticação
app.get('/callback', async (req, res) => {
    const authCode = req.query.code;

    try {
        const response = await axios.post('https://oauth2.googleapis.com/token', {
            client_id: process.env.GOOGLE_ID,
            client_secret: process.env.GOOGLE_SECRET,
            redirect_uri: 'http://localhost:3001/callback',
            grant_type: 'authorization_code',
            code: authCode,
        });

        const { access_token, refresh_token } = response.data;

        console.log('Access Token:', access_token);
        console.log('Refresh Token:', refresh_token);

        // Salve o `access_token` para uso posterior
        YTB_ACCESS_TOKEN = access_token;

        res.send('Autenticação concluída. Use o token no terminal para suas requisições.');
    } catch (error) {
        console.error('Erro ao obter token OAuth:', error.response?.data || error.message);
        res.status(500).send('Erro ao autenticar com OAuth.');
    }
});



// Função para renovar o token do Spotify
const refreshSpotifyToken = async () => {
    try {
        const params = querystring.stringify({
            grant_type: 'client_credentials',
        });

        const response = await axios.post(SPOTIFY_AUTH_URL, params, {
            headers: {
                Authorization: `Basic ${Buffer.from(`${SPOTIFY_ID}:${SPOTIFY_SECRET}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        spotifyAccessToken = response.data.access_token;
        console.log(`Novo token do Spotify obtido: ${spotifyAccessToken}`);
        console.log('GOOGLE_ID:', process.env.GOOGLE_ID);
        console.log('GOOGLE_SECRET:', process.env.GOOGLE_SECRET);

    } catch (error) {
        console.error('Erro ao renovar token do Spotify:', error.response?.data || error.message);
    }
};

setInterval(refreshSpotifyToken, 3600 * 1000);
refreshSpotifyToken();

// Endpoint para buscar músicas de uma playlist do Spotify
app.get('/playlist/:id', async (req, res) => {
    const playlistId = req.params.id;

    try {
        // Buscar músicas da playlist no Spotify
        const response = await axios.get(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
            headers: {
                Authorization: `Bearer ${spotifyAccessToken}`,
            },
        });

        const tracks = response.data.items.slice(0, 10).map(item => ({
            name: item.track.name,
            artist: item.track.artists.map(artist => artist.name).join(', '),
            album: item.track.album.name,
        }));

        // Criar a playlist no YouTube
        const payload = {
            snippet: {
                title: `Playlist baseada no Spotify: ${playlistId}`,
                description: 'Criada automaticamente a partir de uma playlist do Spotify.',
            },
            status: {
                privacyStatus: 'private',
            },
        };

        const youtubePlaylistResponse = await axios.post(
            'https://www.googleapis.com/youtube/v3/playlists',
            payload,
            {
                headers: {
                    Authorization: `Bearer ${YTB_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json',
                },
                params: {
                    part: 'snippet,status',
                },
            }
        );

        const youtubePlaylistId = youtubePlaylistResponse.data.id;

        console.log(`Playlist criada no YouTube com ID: ${youtubePlaylistId}`);

        // Adicionar vídeos à playlist
        const trackLinks = [];
        for (const track of tracks) {
            try {
                const youtubeResponse = await axios.get(`${YOUTUBE_API_URL}/search`, {
                    params: {
                        key: YTB_API_KEY,
                        part: 'snippet',
                        q: `${track.name} ${track.artist} ${track.album}`,
                        maxResults: 1,
                    },
                });

                const video = youtubeResponse.data.items[0];

                if (video && video.id && video.id.videoId) {
                    try {
                        await axios.post(`${YOUTUBE_API_URL}/playlistItems`, {
                            snippet: {
                                playlistId: youtubePlaylistId,
                                resourceId: {
                                    kind: 'youtube#video',
                                    videoId: video.id.videoId,
                                },
                            },
                        }, {
                            headers: {
                                Authorization: `Bearer ${YTB_ACCESS_TOKEN}`,
                                'Content-Type': 'application/json',
                            },
                            params: {
                                part: 'snippet',
                            },
                        });

                        console.log(`Vídeo ${video.id.videoId} adicionado com sucesso à playlist ${youtubePlaylistId}`);
                        trackLinks.push({
                            name: track.name,
                            artist: track.artist,
                            url: `https://www.youtube.com/watch?v=${video.id.videoId}`,
                        });
                    } catch (error) {
                        console.error(`Erro ao adicionar vídeo ${track.name} à playlist:`, error.response?.data || error.message);
                    }
                } else {
                    console.warn(`Nenhum vídeo encontrado para ${track.name}`);
                    trackLinks.push({ name: track.name, artist: track.artist, url: null });
                }
            } catch (error) {
                console.error(`Erro ao buscar no YouTube para ${track.name}:`, error.message);
                trackLinks.push({ name: track.name, artist: track.artist, url: null });
            }
        }

        // Enviar a resposta final após adicionar todos os vídeos
        res.json({
            message: 'Playlist criada com sucesso no YouTube!',
            youtubePlaylistUrl: `https://www.youtube.com/playlist?list=${youtubePlaylistId}`,
            tracks: trackLinks,
        });
    } catch (error) {
        console.error('Erro geral:', error.response?.data || error.message);

        if (error.response?.status === 404) {
            res.status(404).send('Playlist não encontrada. Verifique o ID ou se a playlist é pública.');
        } else if (error.response?.status === 401) {
            res.status(401).send('Token do Spotify inválido ou expirado.');
        } else {
            res.status(500).send('Erro ao buscar playlist.');
        }
    }
});


app.get('/youtube/playlists', async (req, res) => {
    if (!YTB_ACCESS_TOKEN) {
        return res.status(401).send('Token de acesso não está disponível. Faça login novamente.');
    }

    try {
        const response = await axios.get('https://www.googleapis.com/youtube/v3/playlists', {
            headers: {
                Authorization: `Bearer ${YTB_ACCESS_TOKEN}`,
            },
            params: {
                part: 'snippet,contentDetails',
                mine: true,
            },
        });

        res.status(200).json(response.data);
    } catch (error) {
        if (error.response && error.response.status === 401) {
            // Token expirado, tenta renovar
            console.log('Access Token expirado. Tentando renovar...');
            await refreshAccessToken();

            // Tenta novamente após renovar
            return res.redirect('/youtube/playlists');
        }

        console.error('Erro ao buscar playlists:', error.response?.data || error.message);
        res.status(500).send('Erro ao buscar playlists do YouTube.');
    }
});


app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});

app.get('/api', (req, res) => {
    res.json({ message: 'Backend is working with CORS enabled for all origins!' });
  });