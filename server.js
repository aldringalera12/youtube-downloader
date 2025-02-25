const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
app.use(cors({ origin: '*' })); // Allow all origins

app.use(express.static(path.join(__dirname, 'public')));

app.get('/download', async (req, res) => {
    const videoUrl = req.query.url;
    const formatType = req.query.format || 'mp4';
    const quality = req.query.quality || 'best';

    if (!videoUrl) {
        return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    const ytDlpPath = 'yt-dlp'; // ✅ Use system-installed yt-dlp
    const cookiesPath = path.join(__dirname, 'cookies'); // ✅ Update cookies file path

    // Step 1: Get the Video Title
    const titleProcess = spawn(ytDlpPath, ['--get-title', videoUrl]);

    let videoTitle = '';

    titleProcess.stdout.on('data', (data) => {
        videoTitle += data.toString();
    });

    titleProcess.stderr.on('data', (data) => {
        console.error(`yt-dlp error: ${data.toString()}`);
    });

    titleProcess.on('close', (code) => {
        if (code !== 0) {
            console.error(`yt-dlp exited with code ${code}`);
            return res.status(500).json({ error: 'Failed to fetch video title' });
        }

        videoTitle = videoTitle.trim().replace(/[<>:"/\\|?*]+/g, ''); // Sanitize filename

        let format;
        let extension;
        let contentType;

        if (formatType === 'mp3') {
            format = 'bestaudio';
            extension = '.mp3';
            contentType = 'audio/mpeg';
        } else {
            switch (quality) {
                case '1080p': format = 'bestvideo[height<=1080]+bestaudio/best'; break;
                case '720p': format = 'bestvideo[height<=720]+bestaudio/best'; break;
                case '480p': format = 'bestvideo[height<=480]+bestaudio/best'; break;
                default: format = 'best';
            }
            extension = '.mp4';
            contentType = 'video/mp4';
        }

        const filename = `${videoTitle}${extension}`;
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', contentType);

        // Step 3: Download the Video/Audio
        const ytProcess = spawn(ytDlpPath, ['--cookies', cookiesPath, '-f', format, '-o', '-', videoUrl]);

        ytProcess.stdout.pipe(res);

        ytProcess.stderr.on('data', (data) => {
            console.error(`yt-dlp error: ${data.toString()}`);
        });

        ytProcess.on('error', (error) => {
            console.error('Failed to start yt-dlp:', error);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Download failed' });
            }
        });

        ytProcess.on('close', (code) => {
            if (code !== 0) {
                console.error(`yt-dlp exited with code ${code}`);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Download failed' });
                }
            }
        });
    });
});

// Serve index.html as the homepage
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
