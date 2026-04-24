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

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    barcode TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    category TEXT
  );

  CREATE TABLE IF NOT EXISTS product_inventory (
    product_id INTEGER NOT NULL,
    posto_id INTEGER NOT NULL,
    internal_qty INTEGER DEFAULT 0,
    external_qty INTEGER DEFAULT 0,
    PRIMARY KEY (product_id, posto_id),
    FOREIGN KEY (product_id) REFERENCES products (id),
    FOREIGN KEY (posto_id) REFERENCES postos (id)
  );

  CREATE TABLE IF NOT EXISTS product_sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    posto_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    qty INTEGER NOT NULL,
    price_at_sale REAL NOT NULL,
    timestamp INTEGER NOT NULL,
    FOREIGN KEY (product_id) REFERENCES products (id),
    FOREIGN KEY (posto_id) REFERENCES postos (id),
    FOREIGN KEY (user_id) REFERENCES users (id)
  );

  CREATE TABLE IF NOT EXISTS system_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    posto_id INTEGER,
    timestamp INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (posto_id) REFERENCES postos (id)
  );
`);

// Migration: Add min_stock if it doesn't exist
try {
  db.prepare('ALTER TABLE tanks ADD COLUMN min_stock REAL DEFAULT 0').run();
} catch (e) {
  // Column already exists
}

// ... rest of migrations or triggers if needed ...

// Create default Superadmin if not exists
const superadmin = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
const hashedAdminPassword = bcrypt.hashSync('admin', 10);
if (!superadmin) {
  db.prepare('INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)').run(
    'admin',
    hashedAdminPassword,
    'SUPERADMIN',
    'Super Administrador'
  );
  console.log('Default Superadmin created: admin / admin');
} else {
  // Ensure password is 'admin' as requested
  db.prepare('UPDATE users SET password = ?, role = ? WHERE username = ?').run(hashedAdminPassword, 'SUPERADMIN', 'admin');
  console.log('Default Superadmin password updated to: admin');
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

  const logAction = (userId: number, action: string, details: any, postoId?: number) => {
    try {
        db.prepare(`
            INSERT INTO system_logs (user_id, action, details, posto_id, timestamp)
            VALUES (?, ?, ?, ?, ?)
        `).run(userId, action, JSON.stringify(details), postoId || null, Date.now());
    } catch (e) {
        console.error('Error logging action:', e);
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
    try {
      let users;
      if (req.user.role === 'SUPERADMIN') {
        users = db.prepare('SELECT id, username, role, name, posto_id FROM users').all();
      } else if (req.user.role === 'GERENTE') {
        if (!req.user.posto_id) {
            // Se o gerente não tem posto, ele só vê a si mesmo ou nada. 
            // Para não quebrar o frontend, retornamos apenas o próprio usuário caso ele queira.
            users = db.prepare('SELECT id, username, role, name, posto_id FROM users WHERE id = ?').all(req.user.id);
        } else {
            users = db.prepare('SELECT id, username, role, name, posto_id FROM users WHERE posto_id = ?').all(req.user.posto_id);
        }
      } else {
        return res.status(403).json({ error: 'Usuário não tem permissão para listar usuários' });
      }
      res.json(users);
    } catch (e) {
      console.error('Error fetching users:', e);
      res.status(500).json({ error: 'Erro interno ao buscar usuários' });
    }
  });

  app.post('/api/users', authenticate, (req: any, res) => {
    const { username, password, role, name, posto_id } = req.body;
    
    // Hierarchy check
    if (req.user.role === 'SUPERADMIN') {
      if (role !== 'GERENTE') return res.status(400).json({ error: 'Superadmin só pode criar Gerentes' });
      if (!posto_id) return res.status(400).json({ error: 'Gerente deve estar vinculado a um posto' });
    } else if (req.user.role === 'GERENTE') {
      if (role !== 'CAIXA' && role !== 'FRENTISTA' && role !== 'OPERADOR') {
        return res.status(400).json({ error: 'Gerente só pode criar Caixas, Frentistas ou Operadores' });
      }
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
    if (req.user.role === 'FRENTISTA') return res.status(403).json({ error: 'Frentistas não podem lançar volumes' });
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
    logAction(req.user.id, 'CREATE_MEASUREMENT', { tank_code, fuel_id, height, volume }, posto_id);
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
    logAction(req.user.id, 'UPDATE_MEASUREMENT', { id, height, volume, old_height: meas.height }, meas.posto_id);
    
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
    logAction(req.user.id, 'DELETE_MEASUREMENT', { id, tank_code: meas.tank_code }, meas.posto_id);
    
    // Recalculate tank state from previous measurement
    const prev: any = db.prepare('SELECT * FROM measurements WHERE tank_code = ? AND posto_id = ? ORDER BY timestamp DESC LIMIT 1').get(meas.tank_code, meas.posto_id);
    if (prev) {
      db.prepare('UPDATE tanks SET last_height = ?, last_volume = ? WHERE code = ? AND posto_id = ?').run(prev.height, prev.volume, meas.tank_code, meas.posto_id);
    } else {
      db.prepare('UPDATE tanks SET last_height = 0, last_volume = 0 WHERE code = ? AND posto_id = ?').run(meas.tank_code, meas.posto_id);
    }

    res.json({ success: true });
  });

  // --- PRODUCT API ROUTES ---

  app.get('/api/products', authenticate, (req: any, res) => {
    const postoId = req.user.posto_id || req.query.posto_id;
    if (!postoId) return res.json([]);
    
    const products = db.prepare(`
      SELECT p.*, pi.internal_qty, pi.external_qty 
      FROM products p
      LEFT JOIN product_inventory pi ON p.id = pi.product_id AND pi.posto_id = ?
    `).all(postoId);
    res.json(products);
  });

  app.get('/api/products/search/:barcode', authenticate, (req: any, res) => {
    const { barcode } = req.params;
    const postoId = req.user.posto_id || req.query.posto_id;
    
    const product = db.prepare(`
      SELECT p.*, pi.internal_qty, pi.external_qty 
      FROM products p
      LEFT JOIN product_inventory pi ON p.id = pi.product_id AND pi.posto_id = ?
      WHERE p.barcode = ?
    `).get(postoId, barcode);
    
    if (!product) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json(product);
  });

  app.post('/api/products', authenticate, (req: any, res) => {
    if (req.user.role === 'OPERADOR' || req.user.role === 'FRENTISTA' || req.user.role === 'CAIXA') return res.status(403).json({ error: 'Forbidden' });
    const { barcode, name, price, category, internal_qty } = req.body;
    const postoId = req.user.posto_id || req.body.posto_id;

    if (!postoId) return res.status(400).json({ error: 'Posto ID obrigatório' });

    try {
      const transaction = db.transaction(() => {
        // 1. Upsert product
        const existingProduct: any = db.prepare('SELECT id FROM products WHERE barcode = ?').get(barcode);
        let productId;
        
        if (existingProduct) {
          db.prepare('UPDATE products SET name = ?, price = ?, category = ? WHERE id = ?')
            .run(name, price, category, existingProduct.id);
          productId = existingProduct.id;
        } else {
          const result = db.prepare('INSERT INTO products (barcode, name, price, category) VALUES (?, ?, ?, ?)')
            .run(barcode, name, price, category);
          productId = result.lastInsertRowid;
        }

        // 2. Initialize/Update inventory for this posto
        const inv: any = db.prepare('SELECT * FROM product_inventory WHERE product_id = ? AND posto_id = ?')
          .get(productId, postoId);
        
        if (inv) {
          if (internal_qty !== undefined) {
             db.prepare('UPDATE product_inventory SET internal_qty = internal_qty + ? WHERE product_id = ? AND posto_id = ?')
               .run(internal_qty, productId, postoId);
          }
        } else {
          db.prepare('INSERT INTO product_inventory (product_id, posto_id, internal_qty, external_qty) VALUES (?, ?, ?, 0)')
            .run(productId, postoId, internal_qty || 0);
        }
        return productId;
      });

      const id = transaction();
      logAction(req.user.id, 'PRODUCT_MODIFIED', { barcode, name, price, internal_qty }, postoId);
      res.json({ success: true, id });
    } catch (e: any) {
      console.error(e);
      res.status(400).json({ error: e.message });
    }
  });

  // Transfer Internal -> External
  app.post('/api/inventory/transfer', authenticate, (req: any, res) => {
    if (req.user.role === 'OPERADOR' || req.user.role === 'FRENTISTA') return res.status(403).json({ error: 'Forbidden' });
    const { barcode, qty } = req.body;
    const postoId = req.user.posto_id;

    try {
      const transaction = db.transaction(() => {
        const product: any = db.prepare('SELECT id FROM products WHERE barcode = ?').get(barcode);
        if (!product) throw new Error('Produto não encontrado');

        const inv: any = db.prepare('SELECT * FROM product_inventory WHERE product_id = ? AND posto_id = ?')
          .get(product.id, postoId);
        
        if (!inv || inv.internal_qty < qty) throw new Error('Estoque interno insuficiente');

        db.prepare(`
          UPDATE product_inventory 
          SET internal_qty = internal_qty - ?, external_qty = external_qty + ? 
          WHERE product_id = ? AND posto_id = ?
        `).run(qty, qty, product.id, postoId);
      });

      transaction();
      logAction(req.user.id, 'INVENTORY_TRANSFER', { barcode, qty }, postoId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Sales (Operator)
  app.post('/api/sales', authenticate, (req: any, res) => {
    const { barcode, qty } = req.body;
    const postoId = req.user.posto_id;
    const userId = req.user.id;
    let saleTotal = 0;

    try {
      const transaction = db.transaction(() => {
        const product: any = db.prepare('SELECT id, price FROM products WHERE barcode = ?').get(barcode);
        if (!product) throw new Error('Produto não encontrado');

        const inv: any = db.prepare('SELECT * FROM product_inventory WHERE product_id = ? AND posto_id = ?')
          .get(product.id, postoId);
        
        if (!inv || inv.external_qty < qty) throw new Error('Estoque de pista insuficiente');

        // 1. Deduct from external qty
        db.prepare('UPDATE product_inventory SET external_qty = external_qty - ? WHERE product_id = ? AND posto_id = ?')
          .run(qty, product.id, postoId);

        // 2. Record sale
        db.prepare('INSERT INTO product_sales (product_id, posto_id, user_id, qty, price_at_sale, timestamp) VALUES (?, ?, ?, ?, ?, ?)')
          .run(product.id, postoId, userId, qty, product.price, Date.now());
        
        saleTotal = product.price * qty;
      });

      transaction();
      logAction(req.user.id, 'SALE', { barcode, qty, total: saleTotal }, postoId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get('/api/sales', authenticate, (req: any, res) => {
    let sales;
    if (req.user.role === 'SUPERADMIN') {
      sales = db.prepare(`
        SELECT ps.*, p.name as product_name, u.name as user_name, po.name as posto_name
        FROM product_sales ps
        JOIN products p ON ps.product_id = p.id
        JOIN users u ON ps.user_id = u.id
        JOIN postos po ON ps.posto_id = po.id
        ORDER BY ps.timestamp DESC
      `).all();
    } else if (req.user.role === 'GERENTE' || req.user.role === 'CAIXA') {
      sales = db.prepare(`
        SELECT ps.*, p.name as product_name, u.name as user_name, po.name as posto_name
        FROM product_sales ps
        JOIN products p ON ps.product_id = p.id
        JOIN users u ON ps.user_id = u.id
        JOIN postos po ON ps.posto_id = po.id
        WHERE ps.posto_id = ?
        ORDER BY ps.timestamp DESC
      `).all(req.user.posto_id);
    } else if (req.user.role === 'FRENTISTA' || req.user.role === 'OPERADOR') {
      sales = db.prepare(`
        SELECT ps.*, p.name as product_name, u.name as user_name, po.name as posto_name
        FROM product_sales ps
        JOIN products p ON ps.product_id = p.id
        JOIN users u ON ps.user_id = u.id
        JOIN postos po ON ps.posto_id = po.id
        WHERE ps.user_id = ?
        ORDER BY ps.timestamp DESC
      `).all(req.user.id);
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json(sales);
  });

  app.get('/api/dashboard/stats', authenticate, (req: any, res) => {
    const postoId = req.user.posto_id || req.query.posto_id;
    if (!postoId) return res.status(400).json({ error: 'Posto ID obrigatório' });

    const days = 7;
    const stats: any = {};

    // 1. Total revenue (last 7 days)
    const totalRevenue = db.prepare(`
      SELECT SUM(qty * price_at_sale) as total 
      FROM product_sales 
      WHERE posto_id = ? AND timestamp > ?
    `).get(postoId, Date.now() - days * 24 * 60 * 60 * 1000);

    // 2. Sales by product
    const salesByProduct = db.prepare(`
      SELECT p.name, SUM(ps.qty) as total_qty, SUM(ps.qty * ps.price_at_sale) as total_revenue
      FROM product_sales ps
      JOIN products p ON ps.product_id = p.id
      WHERE ps.posto_id = ?
      GROUP BY ps.product_id
      ORDER BY total_revenue DESC
    `).all(postoId);

    // 3. Daily sales trend
    const dailySales = db.prepare(`
      SELECT date(timestamp / 1000, 'unixepoch') as sale_date, SUM(qty * price_at_sale) as total
      FROM product_sales
      WHERE posto_id = ? AND timestamp > ?
      GROUP BY sale_date
      ORDER BY sale_date ASC
    `).all(postoId, Date.now() - 30 * 24 * 60 * 60 * 1000);

    res.json({
        totalRevenue: totalRevenue ? (totalRevenue as any).total || 0 : 0,
        salesByProduct,
        dailySales
    });
  });

  app.get('/api/system-logs', authenticate, (req: any, res) => {
    if (req.user.role !== 'SUPERADMIN' && req.user.role !== 'GERENTE') {
        return res.status(403).json({ error: 'Forbidden' });
    }

    let logs;
    if (req.user.role === 'SUPERADMIN') {
        logs = db.prepare(`
            SELECT sl.*, u.name as user_name, p.name as posto_name
            FROM system_logs sl
            JOIN users u ON sl.user_id = u.id
            LEFT JOIN postos p ON sl.posto_id = p.id
            ORDER BY sl.timestamp DESC LIMIT 200
        `).all();
    } else {
        logs = db.prepare(`
            SELECT sl.*, u.name as user_name, p.name as posto_name
            FROM system_logs sl
            JOIN users u ON sl.user_id = u.id
            LEFT JOIN postos p ON sl.posto_id = p.id
            WHERE sl.posto_id = ?
            ORDER BY sl.timestamp DESC LIMIT 200
        `).all(req.user.posto_id);
    }
    res.json(logs);
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
