import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DATABASE_PATH || 'tanque_certo.db';
const db = new Database(dbPath);
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-this';

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS postos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL, -- SUPERADMIN, GERENTE, OPERADOR
    name TEXT NOT NULL,
    posto_id INTEGER,
    FOREIGN KEY (posto_id) REFERENCES postos (id)
  );

  CREATE TABLE IF NOT EXISTS measurements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tank_code TEXT NOT NULL,
    fuel_id TEXT NOT NULL,
    height REAL NOT NULL,
    volume REAL NOT NULL,
    timestamp INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    posto_id INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (posto_id) REFERENCES postos (id)
  );

  CREATE TABLE IF NOT EXISTS tanks (
    code TEXT NOT NULL,
    posto_id INTEGER NOT NULL,
    fuel_id TEXT NOT NULL,
    last_height REAL DEFAULT 0,
    last_volume REAL DEFAULT 0,
    last_update INTEGER,
    capacity REAL NOT NULL,
    min_stock REAL DEFAULT 0,
    PRIMARY KEY (code, posto_id),
    FOREIGN KEY (posto_id) REFERENCES postos (id)
  );
`);

// Migration: Add min_stock if it doesn't exist
try {
  db.prepare('ALTER TABLE tanks ADD COLUMN min_stock REAL DEFAULT 0').run();
} catch (e) {
  // Column already exists
}

// Create default Superadmin if not exists
const superadmin = db.prepare('SELECT * FROM users WHERE role = ?').get('SUPERADMIN');
if (!superadmin) {
  const hashedPassword = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)').run(
    'admin',
    hashedPassword,
    'SUPERADMIN',
    'Super Administrador'
  );
  console.log('Default Superadmin created: admin / admin123');
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // Request logging
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

  // --- AUTH MIDDLEWARE ---
  const authenticate = (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      next();
    } catch (err) {
      res.status(401).json({ error: 'Invalid token' });
    }
  };

  // --- API ROUTES ---

  // Login
  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const user: any = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role, posto_id: user.posto_id, name: user.name }, JWT_SECRET);
    res.json({ token, user: { id: user.id, username: user.username, role: user.role, posto_id: user.posto_id, name: user.name } });
  });

  // Get current user profile
  app.get('/api/auth/me', authenticate, (req: any, res) => {
    res.json(req.user);
  });

  // Postos (Superadmin only)
  app.get('/api/postos', authenticate, (req: any, res) => {
    const postos = db.prepare('SELECT * FROM postos').all();
    res.json(postos);
  });

  app.post('/api/postos', authenticate, (req: any, res) => {
    if (req.user.role !== 'SUPERADMIN') return res.status(403).json({ error: 'Forbidden' });
    const { name } = req.body;
    try {
      const result = db.prepare('INSERT INTO postos (name) VALUES (?)').run(name);
      res.json({ id: result.lastInsertRowid, name });
    } catch (e) {
      res.status(400).json({ error: 'Posto já existe' });
    }
  });

  // Users (Hierarchical)
  app.get('/api/users', authenticate, (req: any, res) => {
    let users;
    if (req.user.role === 'SUPERADMIN') {
      users = db.prepare('SELECT id, username, role, name, posto_id FROM users').all();
    } else if (req.user.role === 'GERENTE') {
      users = db.prepare('SELECT id, username, role, name, posto_id FROM users WHERE posto_id = ?').all(req.user.posto_id);
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json(users);
  });

  app.post('/api/users', authenticate, (req: any, res) => {
    const { username, password, role, name, posto_id } = req.body;
    
    // Hierarchy check
    if (req.user.role === 'SUPERADMIN') {
      if (role !== 'GERENTE') return res.status(400).json({ error: 'Superadmin só pode criar Gerentes' });
    } else if (req.user.role === 'GERENTE') {
      if (role !== 'OPERADOR') return res.status(400).json({ error: 'Gerente só pode criar Operadores' });
      if (posto_id !== req.user.posto_id) return res.status(403).json({ error: 'Gerente só pode criar usuários para seu próprio posto' });
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    try {
      db.prepare('INSERT INTO users (username, password, role, name, posto_id) VALUES (?, ?, ?, ?, ?)').run(
        username, hashedPassword, role, name, posto_id
      );
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ error: 'Usuário já existe' });
    }
  });

  // Tanks
  app.get('/api/tanks', authenticate, (req: any, res) => {
    const postoId = req.user.posto_id || req.query.posto_id;
    if (!postoId) return res.json([]);
    const tanks = db.prepare('SELECT * FROM tanks WHERE posto_id = ?').all(postoId);
    res.json(tanks);
  });

  app.put('/api/tanks/:code', authenticate, (req: any, res) => {
    if (req.user.role !== 'SUPERADMIN') return res.status(403).json({ error: 'Forbidden' });
    const { code } = req.params;
    const { capacity, min_stock, posto_id } = req.body;

    if (!posto_id) return res.status(400).json({ error: 'Posto ID é obrigatório' });

    db.prepare(`
      UPDATE tanks 
      SET capacity = ?, min_stock = ? 
      WHERE code = ? AND posto_id = ?
    `).run(capacity, min_stock, code, posto_id);

    res.json({ success: true });
  });

  app.post('/api/measurements', authenticate, (req: any, res) => {
    const { tank_code, fuel_id, height, volume, capacity } = req.body;
    const posto_id = req.user.posto_id;
    if (!posto_id) return res.status(400).json({ error: 'Usuário sem posto vinculado' });

    const timestamp = Date.now();
    
    const transaction = db.transaction(() => {
      // 1. Insert measurement
      db.prepare(`
        INSERT INTO measurements (tank_code, fuel_id, height, volume, timestamp, user_id, posto_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(tank_code, fuel_id, height, volume, timestamp, req.user.id, posto_id);

      // 2. Update or Insert tank state
      db.prepare(`
        INSERT INTO tanks (code, posto_id, fuel_id, last_height, last_volume, last_update, capacity)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(code, posto_id) DO UPDATE SET
          last_height = excluded.last_height,
          last_volume = excluded.last_volume,
          last_update = excluded.last_update
      `).run(tank_code, posto_id, fuel_id, height, volume, timestamp, capacity);
    });

    transaction();
    res.json({ success: true });
  });

  app.get('/api/measurements', authenticate, (req: any, res) => {
    let measurements;
    if (req.user.role === 'SUPERADMIN') {
      measurements = db.prepare('SELECT * FROM measurements ORDER BY timestamp DESC LIMIT 100').all();
    } else {
      measurements = db.prepare('SELECT * FROM measurements WHERE posto_id = ? ORDER BY timestamp DESC LIMIT 100').all(req.user.posto_id);
    }
    res.json(measurements);
  });

  app.put('/api/measurements/:id', authenticate, (req: any, res) => {
    if (req.user.role === 'OPERADOR') return res.status(403).json({ error: 'Forbidden' });
    const { height, volume } = req.body;
    const { id } = req.params;

    const meas: any = db.prepare('SELECT * FROM measurements WHERE id = ?').get(id);
    if (!meas) return res.status(404).json({ error: 'Medição não encontrada' });

    if (req.user.role === 'GERENTE' && meas.posto_id !== req.user.posto_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    db.prepare('UPDATE measurements SET height = ?, volume = ? WHERE id = ?').run(height, volume, id);
    
    // Update tank state if it was the latest measurement
    const latest: any = db.prepare('SELECT * FROM measurements WHERE tank_code = ? AND posto_id = ? ORDER BY timestamp DESC LIMIT 1').get(meas.tank_code, meas.posto_id);
    if (latest && latest.id === parseInt(id)) {
      db.prepare('UPDATE tanks SET last_height = ?, last_volume = ? WHERE code = ? AND posto_id = ?').run(height, volume, meas.tank_code, meas.posto_id);
    }

    res.json({ success: true });
  });

  app.delete('/api/measurements/:id', authenticate, (req: any, res) => {
    if (req.user.role === 'OPERADOR') return res.status(403).json({ error: 'Forbidden' });
    const { id } = req.params;

    const meas: any = db.prepare('SELECT * FROM measurements WHERE id = ?').get(id);
    if (!meas) return res.status(404).json({ error: 'Medição não encontrada' });

    if (req.user.role === 'GERENTE' && meas.posto_id !== req.user.posto_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    db.prepare('DELETE FROM measurements WHERE id = ?').run(id);
    
    // Recalculate tank state from previous measurement
    const prev: any = db.prepare('SELECT * FROM measurements WHERE tank_code = ? AND posto_id = ? ORDER BY timestamp DESC LIMIT 1').get(meas.tank_code, meas.posto_id);
    if (prev) {
      db.prepare('UPDATE tanks SET last_height = ?, last_volume = ? WHERE code = ? AND posto_id = ?').run(prev.height, prev.volume, meas.tank_code, meas.posto_id);
    } else {
      db.prepare('UPDATE tanks SET last_height = 0, last_volume = 0 WHERE code = ? AND posto_id = ?').run(meas.tank_code, meas.posto_id);
    }

    res.json({ success: true });
  });

  // Catch-all for API routes that don't exist
  app.all('/api/*all', (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
  });

  // --- VITE MIDDLEWARE ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = process.env.PORT || 3000;
  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
