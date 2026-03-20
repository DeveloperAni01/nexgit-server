import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = express.Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

router.post('/', async (req, res) => {
    try {
        const { projectType, detectedStacks = [], language = 'english' } = req.body;

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

        // Build stack context
        let stackContext = '';

        if (projectType === 'detected' && detectedStacks.length > 0) {
            stackContext = `Generate a combined .gitignore for these tech stacks: ${detectedStacks.join(', ')}
            
For each stack include ALL specific patterns:
- Node.js: node_modules/, dist/, npm-debug.log*, .npm
- .NET: bin/, obj/, *.user, *.suo, .vs/, packages/
- Angular: dist/, .angular/, .angular/cache/
- Python: __pycache__/, *.pyc, venv/, .venv/, env/, *.egg-info/
- Java: target/, .gradle/, build/, *.class
- Flutter: .dart_tool/, build/, *.g.dart
- Ruby: vendor/bundle/, .bundle/
- PHP: vendor/
- Rust: target/
- Go: vendor/, *.exe`;

        } else if (projectType === 'generic' || detectedStacks.length === 0) {
            stackContext = `Generate a generic .gitignore that covers common patterns for any project:
- OS files (.DS_Store, Thumbs.db)
- Environment files (.env, .env.*)
- Log files (*.log)
- Editor files (.vscode/, .idea/)
- Security files (*.pem, *.key)`;

        } else {
            // Specific stack selected by user
            const stackInstructions = {
                nodejs: 'Node.js — include: node_modules/, dist/, npm-debug.log*, .npm, .env, .env.*',
                react: 'React — include: node_modules/, dist/, build/, .env, .env.*, npm-debug.log*',
                dotnet: '.NET — include: bin/, obj/, *.user, *.suo, .vs/, packages/, .env',
                python: 'Python — include: __pycache__/, *.pyc, venv/, .venv/, env/, *.egg-info/, .env',
                other: 'Generic project — include common OS, env, log, editor patterns',
            };

            stackContext = `Generate a .gitignore for: ${stackInstructions[projectType] || projectType}`;
        }

        const prompt = `You are NexGit — an AI powered Git assistant.

${stackContext}

STRICT RULES:
1. Return ONLY the exact patterns needed
2. Always include: .env, .env.*, *.log, .DS_Store, Thumbs.db, *.pem, *.key
3. If multiple stacks — combine ALL patterns from each stack
4. No duplicate patterns
5. Each pattern on its own line
6. Be SPECIFIC — don't add patterns for stacks not mentioned

${languagePrompt}

Respond ONLY in this exact JSON format — no markdown no extra text:
{
  "patterns": [
    "node_modules/",
    "bin/",
    "__pycache__/",
    ".env",
    "*.log"
  ],
  "detectedStack": "Node.js, .NET, Python"
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
                parsed.detectedStack = detectedStacks.length > 0
                    ? detectedStacks.join(', ')
                    : projectType;
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