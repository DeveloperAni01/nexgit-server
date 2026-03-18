import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = express.Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

router.post('/', async (req, res) => {
    try {
        const { files, diff, language = 'english' } = req.body;

        // Validate
        if (!files || files.length === 0) {
            return res.status(400).json({
                error: 'No files provided',
                message: 'Please provide staged files'
            });
        }

        const languagePrompts = {
            english: `Respond in clear simple English.`,
            hinglish: `Respond in Hinglish (natural mix of Hindi and English). Be casual and friendly like a desi developer.`,
            hindi: `Respond completely in Hindi only. Use English only for technical terms.`
        };

        const languagePrompt = languagePrompts[language] || languagePrompts.english;

        const prompt = `You are NexGit — an AI powered Git assistant for beginner developers.

A developer has staged these files for commit:
${files.join('\n')}

${diff ? `Here is the diff of changes:\n${diff.slice(0, 3000)}` : ''}

Your job is to suggest a perfect conventional commit message.

STRICT RULES:
1. Use conventional commit format: type: short description
2. Types allowed: feat, fix, docs, style, refactor, test, chore
3. Keep message under 72 characters
4. Use present tense ("add feature" not "added feature")
5. Be specific based on actual files changed
6. Never use generic messages like "update files" or "make changes"
7. Suggest 3 different options from best to least specific

${languagePrompt}

Respond ONLY in this exact JSON format — no markdown no extra text:
{
  "messages": [
    "feat: add user authentication with JWT tokens",
    "feat: implement login and signup functionality",
    "chore: update auth related files"
  ]
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

            if (!parsed.messages || !Array.isArray(parsed.messages) || parsed.messages.length === 0) {
                parsed.messages = ['feat: update project files'];
            }

        } catch (e) {
            return res.json({
                messages: ['feat: update project files']
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
            message: 'Could not generate commit message'
        });
    }
});

export default router;