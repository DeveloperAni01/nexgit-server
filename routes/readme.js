import express from 'express';
import generateContent from '../utils/ai.js';

const router = express.Router();


router.post('/', async (req, res) => {
    try {
        const { projectName, projectType, visibility = 'public', language = 'english' } = req.body;

        if (!projectName || !projectType) {
            return res.status(400).json({
                error: 'Missing fields',
                message: 'projectName and projectType are required'
            });
        }

        const projectTypeNames = {
            nodejs: 'Node.js',
            react: 'React',
            dotnet: '.NET',
            python: 'Python',
            other: 'General'
        };

        const prompt = `You are NexGit — an AI powered Git assistant for developers.

Generate a professional and detailed README.md for this project:

Project Name: ${projectName}
Project Type: ${projectTypeNames[projectType] || projectType}
Visibility: ${visibility}

STRICT RULES:
1. Use proper markdown formatting
2. Include these sections in order:
   - Title with emoji
   - Short description (2-3 sentences)
   - Features section (4-6 bullet points)
   - Tech Stack section
   - Getting Started (Prerequisites + Installation steps)
   - Usage section with code examples
   - Contributing section
   - License section
3. Make it specific to the project type — Node.js projects get npm install steps, .NET gets dotnet restore etc.
4. Keep it professional but friendly
5. Add relevant emojis to section headers
6. Never use placeholder text like "Your description here"
7. Make it sound like a real project README
8. Return ONLY the raw markdown — no extra text no explanations

Generate the README now:`;

        const readme = await generateContent(prompt);

        return res.json({ readme });

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
            message: 'Could not generate README'
        });
    }
});

export default router;