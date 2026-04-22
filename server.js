const express = require('express');
const UAParser = require('ua-parser-js');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

// 信任反向代理
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize SQLite database
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        // Create table if it doesn't exist
        db.run(`CREATE TABLE IF NOT EXISTS links (
            id TEXT PRIMARY KEY,
            urlA TEXT NOT NULL,
            urlC TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) {
                console.error('Error creating table', err.message);
            }
        });
    }
});

// API to generate URL B
app.post('/api/generate', (req, res) => {
    const { urlA, urlC } = req.body;
    
    if (!urlA || !urlC) {
        return res.status(400).json({ error: 'urlA and urlC are required' });
    }

    // Generate a unique ID for URL B
    const id = crypto.randomBytes(4).toString('hex');
    
    // Insert into SQLite database
    const stmt = db.prepare('INSERT INTO links (id, urlA, urlC) VALUES (?, ?, ?)');
    stmt.run([id, urlA, urlC], function(err) {
        if (err) {
            console.error('Error inserting data', err.message);
            return res.status(500).json({ error: 'Database error' });
        }
        
        // Construct the URL B based on the host of the incoming request
        const protocol = req.protocol;
        const host = req.get('host');
        const urlB = `${protocol}://${host}/b/${id}`;
        
        res.json({ urlB, id, urlA, urlC, created_at: new Date().toISOString() });
    });
    stmt.finalize();
});

// API to get recent links history
app.get('/api/history', (req, res) => {
    db.all('SELECT * FROM links ORDER BY created_at DESC LIMIT 50', [], (err, rows) => {
        if (err) {
            console.error('Error fetching history', err.message);
            return res.status(500).json({ error: 'Database error' });
        }
        
        const protocol = req.protocol;
        const host = req.get('host');
        
        // Add full URL B to each row for the frontend
        const history = rows.map(row => ({
            ...row,
            urlB: `${protocol}://${host}/b/${row.id}`
        }));
        
        res.json(history);
    });
});

// Endpoint for URL B to handle redirection
app.get('/b/:id', (req, res) => {
    const id = req.params.id;
    
    db.get('SELECT urlA, urlC FROM links WHERE id = ?', [id], (err, row) => {
        if (err) {
            console.error('Error fetching link', err.message);
            return res.status(500).send('<h2>500 - 内部服务器错误</h2>');
        }
        
        if (!row) {
            return res.status(404).send('<h2>404 - 链接不存在或已过期</h2>');
        }

        const data = row;
        const uaString = req.headers['user-agent'];
        const parser = new UAParser(uaString);
        const browser = parser.getBrowser();
        
        // Log the detection for debugging
        console.log(`[Redirect] ID: ${id} | Browser: ${browser.name} | User-Agent: ${uaString}`);
        
        // Check if the browser is Google Chrome
        if (browser.name === 'Chrome' || browser.name === 'Chrome WebView') {
            console.log(`Redirecting to URL C: ${data.urlC}`);
            res.redirect(data.urlC);
        } else {
            console.log(`Redirecting to URL A: ${data.urlA}`);
            res.redirect(data.urlA);
        }
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
