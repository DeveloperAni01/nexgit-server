import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const gemini = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

async function generateContent(prompt) {
    // Try Anthropic first
    try {
        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1000,
            messages: [{ role: 'user', content: prompt }]
        });

        const text = response.content
            .map(block => block.type === 'text' ? block.text : '')
            .join('');

        return text;

    } catch (err) {
        console.log('⚠️  Anthropic failed, falling back to Gemini...', err.message);

        // Fallback to Gemini
        const result = await gemini.generateContent(prompt);
        return result.response.text();
    }
}

export default generateContent;
