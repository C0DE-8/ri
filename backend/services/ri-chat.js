const OpenAI = require("openai");
const { buildRiMessages } = require("../profiles/ri");

function createRiChatService() {
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  return {
    model,

    async reply(message) {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY is required");
      }

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const completion = await openai.chat.completions.create({
        model,
        messages: buildRiMessages(message)
      });

      return completion.choices[0]?.message?.content?.trim() || "";
    }
  };
}

module.exports = {
  createRiChatService
};
