import { config } from 'dotenv';
config();


import express from 'express';
import cors from 'cors';
import explainRoute from './routes/explain.js';
import commitRoute from './routes/commit.js';
import readmeRoute from './routes/readme.js';
import gitignoreRoute from './routes/gitignore.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Nexgit Server is running! 🤖',
        version: '1.0.0'
    });
});

// Routes
app.use('/explain', explainRoute);
app.use('/commit', commitRoute);
app.use('/readme', readmeRoute);
app.use('/gitignore', gitignoreRoute);

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Route not found',
        message: 'Check Nexgit docs for available endpoints'
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Something went wrong!',
        message: err.message
    });
});

app.listen(PORT, () => {
    console.log(`🤖 Nexgit Server running on port ${PORT}`);
});