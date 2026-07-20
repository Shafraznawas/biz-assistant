// This file runs on Vercel's side (the "kitchen").
// The secret key is NOT here — it lives in Vercel's Environment Variables.

const SUPABASE_URL = "https://tsyiwisklhdgijsoibxj.supabase.co";
const SUPABASE_KEY = "sb_publishable_s5PoS2a2H70WtLhriKDWMw_IiczfAUL";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  try {
    const { messages } = req.body; // full chat history from the page

    // 1. Get the business profile from Supabase
    const bizRes = await fetch(
      SUPABASE_URL + "/rest/v1/businesses?select=*&order=id.desc&limit=1",
      { headers: { apikey: SUPABASE_KEY } }
    );
    const rows = await bizRes.json();
    const biz = rows[0];

    if (!biz) {
      return res.status(200).json({ answer: "Sorry, this business has not set up its profile yet." });
    }

    // 2. Instructions for the AI
    const system = `You are a friendly customer assistant for this business:

Business name: ${biz.name}
Description: ${biz.description}
Services: ${biz.services}
Prices: ${biz.prices}
Opening hours: ${biz.opening_hours}

Rules:
- Answer ONLY using the business information above.
- If the answer is not in the information, say you are not sure and politely ask the customer to leave their name and phone number so the business can contact them.
- Keep answers short, warm and natural. 1-3 sentences.
- Never invent prices, services, or promises.`;

    // 3. Ask Claude (secret key comes from Vercel's locker)
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        system: system,
        messages: messages
      })
    });

    const data = await aiRes.json();

    if (data.error) {
      return res.status(200).json({ answer: "Sorry, I'm having trouble right now. Please try again.", debug: data.error.message });
    }

    const answer = data.content?.map(c => c.text || "").join("") || "Sorry, please try again.";
    return res.status(200).json({ answer });

  } catch (e) {
    return res.status(200).json({ answer: "Sorry, something went wrong. Please try again.", debug: e.message });
  }
}

