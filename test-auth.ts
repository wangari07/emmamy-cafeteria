import express from 'express';
import { auth } from './backend/auth.js';
import { fromNodeHeaders } from 'better-auth/node';

const app = express();

app.get('/test', async (req, res) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers)
    });
    res.json({ session });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(3001, () => {
  console.log('Test server running on port 3001');
});
