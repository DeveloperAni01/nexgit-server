import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = express.Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

router.post('/', async (req, res) => {
    try {
        const { projectType, folderContents = [], language = 'english' } = req.body;

        if (!projectType) {
            return res.status(400).json({
                error: 'Missing projectType',
                message: 'projectType is required'
            });
        }

        const languagePrompts = {
            english: 'Respond in clear simple English.',
            hinglish: 'Respond in Hinglish (mix of Hindi and English).',
            hindi: 'Respond in Hindi only.'
        };

        const languagePrompt = languagePrompts[language] || languagePrompts.english;

        // Build prompt based on projectType
        let stackContext = '';

        if (projectType === 'other') {
            // Scan folder contents
            if (folderContents.length > 0) {
                stackContext = `
Scan these files/folders and detect the tech stack:
${folderContents.join('\n')}

Based on what you detect, generate the appropriate .gitignore patterns.
If nothing specific is detected, generate a generic .gitignore.`;
            } else {
                stackContext = `
Folder is empty. Generate a generic .gitignore that covers:
- Common OS files
- Environment files
- Log files
- Common editor files`;
            }
        } else {
            stackContext = `Generate a .gitignore specifically for: ${projectType}`;
        }

        const prompt = `You are NexGit — an AI powered Git assistant.

${stackContext}

STRICT RULES:
1. Return ONLY the patterns — no comments except one header comment
2. Include all important patterns for the detected/selected stack
3. Always include these general patterns: .env, .env.*, *.log, .DS_Store, Thumbs.db, *.pem, *.key
4. If multiple stacks detected — combine all patterns
5. Remove duplicate patterns
6. Each pattern on its own line

${languagePrompt}

Respond ONLY in this exact JSON format — no markdown no extra text:
{
  "patterns": [
    "node_modules/",
    "dist/",
    ".env",
    ".env.*",
    "*.log"
  ],
  "detectedStack": "Node.js"
}`;

        const result = await model.generateContent(prompt);
        const rawText = result.response.text();

        let parsed;
        try {
            let cleaned = rawText
                .replace(/```json/g, '')
                .replace(/```/g, '')
                .trim();

            const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
            if (jsonMatch) cleaned = jsonMatch[0];

            parsed = JSON.parse(cleaned);

            if (!parsed.patterns || !Array.isArray(parsed.patterns)) {
                parsed.patterns = ['.env', '.env.*', '*.log', '.DS_Store', 'Thumbs.db'];
            }

            if (!parsed.detectedStack) {
                parsed.detectedStack = projectType === 'other' ? 'Generic' : projectType;
            }

        } catch (e) {
            return res.json({
                patterns: ['.env', '.env.*', '*.log', '.DS_Store', 'Thumbs.db', '*.pem', '*.key'],
                detectedStack: 'Generic'
            });
        }

        return res.json(parsed);

    } catch (err) {
        console.error('Gemini error:', err.message);

        if (err.message?.includes('quota') || err.message?.includes('429')) {
            return res.status(429).json({
                error: 'Rate limit reached',
                message: 'Too many requests. Please try again in a minute.'
            });
        }

        return res.status(500).json({
            error: 'Server error',
            message: 'Could not generate .gitignore'
        });
    }
});

export default router;