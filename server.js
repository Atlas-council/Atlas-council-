import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();
const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const members = [
  { id: 'chronos', name: 'Chronos', role: 'Chief Strategist & Moderator', provider: 'openai' },
  { id: 'claude', name: 'Claude', role: 'Critical Analyst', provider: 'anthropic' },
  { id: 'gemini', name: 'Gemini', role: 'Researcher & Explainer', provider: 'gemini' },
  { id: 'deepseek', name: 'DeepSeek', role: 'Logic & Problem Solver', provider: 'deepseek' },
  { id: 'grok', name: 'Grok', role: 'Challenger & Alternative Perspectives', provider: 'xai' }
];

function config(provider) {
  const map = {
    openai: ['OPENAI_API_KEY', process.env.OPENAI_MODEL],
    anthropic: ['ANTHROPIC_API_KEY', process.env.ANTHROPIC_MODEL],
    gemini: ['GEMINI_API_KEY', process.env.GEMINI_MODEL],
    deepseek: ['DEEPSEEK_API_KEY', process.env.DEEPSEEK_MODEL],
    xai: ['XAI_API_KEY', process.env.XAI_MODEL]
  };
  const [keyName, model] = map[provider];
  return { key: process.env[keyName], model, keyName, modelName: `${provider.toUpperCase()}_MODEL` };
}

async function postJson(url, headers, body) {
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || data?.message || `Provider returned HTTP ${response.status}`);
  return data;
}

async function ask(member, system, prompt) {
  const { key, model, keyName } = config(member.provider);
  if (!key || !model) throw new Error(`${member.name} is not connected yet. Set both ${keyName} and ${config(member.provider).modelName} in the hosting service's environment settings.`);
  if (member.provider === 'anthropic') {
    const d = await postJson('https://api.anthropic.com/v1/messages', {
      'x-api-key': key, 'anthropic-version': '2023-06-01'
    }, { model, max_tokens: 1100, system, messages: [{ role: 'user', content: prompt }] });
    return (d.content || []).filter(x => x.type === 'text').map(x => x.text).join('\n');
  }
  if (member.provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
    const d = await postJson(url, {}, { systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 1100 } });
    return (d.candidates?.[0]?.content?.parts || []).map(x => x.text || '').join('\n') || 'No text response returned.';
  }
  const base = member.provider === 'openai' ? 'https://api.openai.com/v1' : member.provider === 'deepseek' ? 'https://api.deepseek.com' : 'https://api.x.ai/v1';
  const d = await postJson(`${base}/chat/completions`, { authorization: `Bearer ${key}` }, {
    model, temperature: 0.6, max_tokens: 1100,
    messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }]
  });
  return d.choices?.[0]?.message?.content || 'No text response returned.';
}

const baseRules = 'You are a member of the Atlas Council, a learning-focused panel. Give clear, accurate, age-appropriate answers. Distinguish facts from uncertainty. Do not invent sources. Do not reveal private chain-of-thought; provide concise conclusions and reasons instead.';

app.get('/api/status', (_req, res) => {
  res.json({ members: members.map(m => ({ id: m.id, name: m.name, role: m.role, connected: Boolean(config(m.provider).key && config(m.provider).model) })) });
});

app.post('/api/debate', async (req, res) => {
  const question = String(req.body?.question || '').trim();
  if (!question || question.length > 3000) return res.status(400).json({ error: 'Enter a question up to 3,000 characters.' });
  const active = members.filter(m => config(m.provider).key && config(m.provider).model);
  if (active.length < 2) return res.status(400).json({ error: 'Connect at least two model providers in your server .env file before starting a debate.' });

  const firstRound = await Promise.all(active.map(async m => {
    try {
      const prompt = `Question from Atlas: ${question}\n\nGive your independent answer in 3 parts: (1) your position, (2) key supporting reasons or explanation, (3) important uncertainty or caveat. Keep it useful for learning.`;
      return { id: m.id, name: m.name, role: m.role, answer: await ask(m, baseRules + ` Your council role is ${m.role}.`, prompt), ok: true };
    } catch (e) { return { id: m.id, name: m.name, role: m.role, error: e.message, ok: false }; }
  }));
  const successful = firstRound.filter(x => x.ok);
  if (successful.length < 2) return res.json({ question, firstRound, critiques: [], verdict: 'Not enough models responded for a debate. Check the provider settings and try again.' });

  const debateText = successful.map(x => `${x.name} (${x.role}):\n${x.answer}`).join('\n\n---\n\n');
  const critiques = await Promise.all(successful.map(async member => {
    const original = members.find(m => m.id === member.id);
    try {
      const prompt = `Original question: ${question}\n\nThe council's independent answers are below:\n${debateText}\n\nNow debate them. Identify the strongest point, challenge at least one weakness or unsupported claim where appropriate, and say what evidence or clarification would resolve disagreements. Be fair: do not manufacture disagreement. Keep it concise.`;
      return { id: member.id, name: member.name, critique: await ask(original, baseRules + ' You are now in the debate round. Be rigorous but respectful.', prompt), ok: true };
    } catch (e) { return { id: member.id, name: member.name, error: e.message, ok: false }; }
  }));

  const debateSummary = critiques.filter(x => x.ok).map(x => `${x.name}:\n${x.critique}`).join('\n\n---\n\n');
  let verdict = 'The moderator could not produce a final synthesis. Review the individual answers and debate notes.';
  const chronos = members[0];
  if (config('openai').key && config('openai').model) {
    try {
      verdict = await ask(chronos, baseRules + ' You are Chronos, the Atlas Council moderator. Be balanced, transparent and educational.',
        `Question: ${question}\n\nIndependent answers:\n${debateText}\n\nDebate round:\n${debateSummary}\n\nWrite the final council report with these headings: Best-supported answer; What the council agrees on; What remains disputed or uncertain; A simple explanation for a learner; Three useful follow-up questions. Do not claim consensus if there is none. Flag anything that needs checking against current primary sources.`);
    } catch (e) { verdict += `\n\nChronos moderator error: ${e.message}`; }
  } else {
    verdict = 'OpenAI is not connected, so the automatic Chronos synthesis is unavailable. Read the independent answers and critiques above; connect OpenAI to enable the final moderator report.';
  }
  res.json({ question, firstRound, critiques, verdict });
});

app.listen(process.env.PORT || 3000, () => console.log(`Atlas Council running at http://localhost:${process.env.PORT || 3000}`));
