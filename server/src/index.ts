import express from 'express';
import cors from 'cors';
import { initDb } from './db/schema.js';
import authRoutes from './routes/auth.js';
import interventionRoutes from './routes/interventions.js';
import clientRoutes from './routes/clients.js';
import aiRoutes from './routes/ai.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3001');

app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }));
app.use(express.json({ limit: '5mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/interventions', interventionRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/ai', aiRoutes);

// Health check
app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Init DB then start
try {
  initDb();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Serveur IntervenIA démarré sur le port ${PORT}`);
  });
} catch (err) {
  console.error('ERREUR DÉMARRAGE:', err);
  process.exit(1);
}

export default app;