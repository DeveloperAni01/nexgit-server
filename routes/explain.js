import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = express.Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

// All nexgit commands for AI context
const NEXGIT_COMMANDS = `
Available NexGit commands:
- nexgit status   → check what changed
- nexgit commit   → save your work
- nexgit push     → send to GitHub
- nexgit pull     → get latest changes
- nexgit branch   → create/list branches
- nexgit switch   → switch branches
- nexgit merge    → merge branches
- nexgit undo     → undo mistakes
- nexgit history  → see commit history
- nexgit diff     → see what changed
- nexgit ignore   → fix .gitignore
- nexgit explain  → explain errors
`;

// Language prompts
const LANGUAGE_PROMPTS = {
    english: `Respond in clear simple English suitable for beginner developers.`,
    hinglish: `Respond in Hinglish (natural mix of Hindi and English).
             Be friendly and casual like a helpful desi developer friend.
             Example tone: "Bhai yeh error tab aata hai jab..."
             STRICTLY mix Hindi and English — not full Hindi not full English.`,
    hindi: `Respond completely in Hindi only.
          Be friendly and helpful like a senior developer.
          STRICTLY use Hindi only — no English except technical terms.`
};

router.post('/', async (req, res) => {
    try {
        const { error: gitError, language = 'english' } = req.body;

        // Validate input
        if (!gitError || gitError.trim() === '') {
            return res.status(400).json({
                error: 'No error provided',
                message: 'Please provide a git error to explain'
            });
        }

        // Too long check
        if (gitError.length > 2000) {
            return res.status(400).json({
                error: 'Error too long',
                message: 'Please provide a shorter error message'
            });
        }

        const languagePrompt = LANGUAGE_PROMPTS[language] || LANGUAGE_PROMPTS.english;

        const prompt = `You are NexGit — a next-gen AI powered Git assistant for beginner developers.

A developer got this error:
"${gitError}"

${NEXGIT_COMMANDS}

STRICT RULES:
1. ALWAYS use nexgit commands in fixes NEVER raw git commands
2. Only use raw git commands if nexgit has no equivalent
3. If this is NOT a git error set explanation to "This doesn't look like a Git error. Please paste your exact git error."
4. If error is too vague ask for more details in explanation
5. Keep explanation to 1-2 sentences maximum
6. Keep fix to 1-3 clear steps maximum
7. Keep tip to 1 sentence maximum
8. Fix must be a single string not an array
9. Never leave any field empty

${languagePrompt}

Respond ONLY in this exact JSON format — no markdown no extra text:
{
  "explanation": "what happened in simple words",
  "fix": "step 1. do this\\nstep 2. do that\\nstep 3. done",
  "tip": "one helpful tip"
}`;

        // Call Gemini
        const result = await model.generateContent(prompt);
        const rawText = result.response.text();

        // Parse response
        let parsed;
        try {
            // Better JSON cleaning
            let cleaned = rawText
                .replace(/```json/g, '')
                .replace(/```/g, '')
                .trim();

            // Extract JSON if wrapped in extra text
            const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                cleaned = jsonMatch[0];
            }

            parsed = JSON.parse(cleaned);

            // Validate all fields exist
            if (!parsed.explanation) parsed.explanation = 'Could not analyze this error.';
            if (!parsed.fix) parsed.fix = 'Run nexgit status to see current state.';
            if (!parsed.tip) parsed.tip = 'Run nexgit explain and paste the full error message.';

            // If fix is array convert to string
            if (Array.isArray(parsed.fix)) {
                parsed.fix = parsed.fix.map((s, i) => `${i + 1}. ${s}`).join('\n');
            }

        } catch (e) {
            return res.json({
                explanation: 'Could not analyze this error.',
                fix: 'Run nexgit status to check current state.',
                tip: 'Copy the full error message and try nexgit explain again.'
            });
        }

        return res.json(parsed);

    } catch (err) {
        console.error('Gemini error:', err.message);

        if (err.message?.includes('API_KEY')) {
            return res.status(500).json({
                error: 'API key invalid',
                message: 'Server configuration error'
            });
        }

        if (err.message?.includes('quota') || err.message?.includes('429')) {
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