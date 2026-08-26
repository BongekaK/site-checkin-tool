import express from 'express';
import path from 'path';
import { initDb } from './database';
import visitsRouter from './routes/visits';

const app = express();

// Initialize the Database
initDb();

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static assets from the relative public folder (works in dist/ and src/ environments)
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(process.cwd(), 'src', 'public')));

// Mount the visits API router
app.use('/api/visits', visitsRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

// Start the server only if run directly (not imported as a module in tests)
if (require.main === module) {
  const PORT = process.env.PORT || 8080;
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

export default app;
