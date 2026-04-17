const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET || 'keyboard cat',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'lax'
    }
}));
app.use(express.static('public'));

// PostgreSQL connection
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
});

const initializeDatabase = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(200) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS contacts (
                id SERIAL PRIMARY KEY,
                user_id INTEGER,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100) NOT NULL,
                phone VARCHAR(20) NOT NULL,
                nickname VARCHAR(100),
                company VARCHAR(100),
                address TEXT,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS nickname VARCHAR(100)`);
        await pool.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS company VARCHAR(100)`);
        await pool.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS address TEXT`);
        await pool.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS notes TEXT`);
        await pool.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS user_id INTEGER`);
        await pool.query(`ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_email_key`);
        await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS contacts_user_email_unique ON contacts (user_id, email)`);
        await pool.query(`DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'contacts_user_id_fkey'
                ) THEN
                    ALTER TABLE contacts ADD CONSTRAINT contacts_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
                END IF;
            END
        $$;`);
    } catch (err) {
        console.error('Database initialization failed:', err);
    }
};

const requireAuth = (req, res, next) => {
    if (req.session && req.session.userId) {
        return next();
    }
    res.status(401).json({ error: 'Unauthorized' });
};

app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email',
            [name, email, hashedPassword]
        );

        req.session.userId = result.rows[0].id;
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        if (err.code === '23505') {
            return res.status(400).json({ error: 'Email is already registered' });
        }
        res.status(500).json({ error: 'Registration failed' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const result = await pool.query('SELECT id, name, email, password FROM users WHERE email = $1', [email]);
        const user = result.rows[0];
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        req.session.userId = user.id;
        res.json({ id: user.id, name: user.name, email: user.email });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Login failed' });
    }
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Logout failed' });
        }
        res.json({ message: 'Logged out' });
    });
});

app.get('/api/auth/me', async (req, res) => {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const result = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [req.session.userId]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/contacts', requireAuth, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM contacts WHERE user_id = $1 ORDER BY created_at DESC', [req.session.userId]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/contacts/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM contacts WHERE id = $1 AND user_id = $2', [id, req.session.userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Contact not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/contacts', requireAuth, async (req, res) => {
    try {
        const { name, nickname, email, phone, company, address, notes } = req.body;
        const result = await pool.query(
            'INSERT INTO contacts (user_id, name, nickname, email, phone, company, address, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
            [req.session.userId, name, nickname || null, email, phone, company || null, address || null, notes || null]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(400).json({ error: 'Contact already exists or invalid data' });
    }
});

app.put('/api/contacts/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, nickname, email, phone, company, address, notes } = req.body;
        const result = await pool.query(
            'UPDATE contacts SET name = $1, nickname = $2, email = $3, phone = $4, company = $5, address = $6, notes = $7 WHERE id = $8 AND user_id = $9 RETURNING *',
            [name, nickname || null, email, phone, company || null, address || null, notes || null, id, req.session.userId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Contact not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(400).json({ error: 'Update failed' });
    }
});

app.delete('/api/contacts/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM contacts WHERE id = $1 AND user_id = $2 RETURNING *', [id, req.session.userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Contact not found' });
        }
        res.json({ message: 'Contact deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Delete failed' });
    }
});

initializeDatabase().then(() => {
    app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });
}).catch((err) => {
    console.error('Failed to initialize database before starting server:', err);
    app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });
});