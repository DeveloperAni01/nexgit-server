import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = express.Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

// Language prompts
const LANGUAGE_PROMPTS = {
    english: 'Respond in clear, simple English.',
    hinglish: 'Respond in Hinglish (mix of Hindi and English). Be friendly and casual like a desi developer friend.',
    hindi: 'Respond completely in Hindi. Be friendly and helpful.'
};

router.post('/', async (req, res) => {
    try {
        const { error, language = 'english' } = req.body;

        // Validate input
        if (!error || error.trim() === '') {
            return res.status(400).json({
                error: 'No error provided',
                message: 'Please provide a git error to explain'
            });
        }

        // Too long check
        if (error.length > 2000) {
            return res.status(400).json({
                error: 'Error too long',
                message: 'Please provide a shorter error message'
            });
        }

        const languagePrompt = LANGUAGE_PROMPTS[language] || LANGUAGE_PROMPTS.english;

        const prompt = `You are NexGit — a next-gen AI powered Git assistant for developers.

A developer got this Git error:
"${error}"

${languagePrompt}

Respond ONLY in this exact JSON format, nothing else, no markdown:
{
  "explanation": "what happened in simple words (1-2 sentences)",
  "fix": "exact steps to fix this (1-3 steps)",
  "tip": "one helpful tip to avoid this in future"
}`;

        // Call Gemini
        const result = await model.generateContent(prompt);
        const rawText = result.response.text();

        // Parse response
        let parsed;
        try {
            const cleaned = rawText.replace(/```json|```/g, '').trim();
            parsed = JSON.parse(cleaned);
        } catch (e) {
            return res.json({
                explanation: rawText,
                fix: 'Please check the error carefully.',
                tip: 'Run nexgit status to see current state.'
            });
        }

        return res.json(parsed);

    } catch (error) {
        console.error('Gemini error:', error.message);

        if (error.message.includes('API_KEY')) {
            return res.status(500).json({
                error: 'API key invalid',
                message: 'Server configuration error'
            });
        }

        if (error.message.includes('quota')) {
            return res.status(429).json({
                error: 'Rate limit reached',
                message: 'Too many requests. Please try again in a minute.'
            });
        }

        return res.status(500).json({
            error: 'Server error',
            message: 'Could not process your request'
        });
    }
});

export default router;