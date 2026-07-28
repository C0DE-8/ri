const OpenAI = require("openai");
const { buildRiMessages } = require("../profiles/ri");

function createRiChatService({ memoryStore } = {}) {
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  return {
    model,

    async reply(message, options = {}) {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY is required");
      }

      const conversationId = options.conversationId || "default";
      const history = memoryStore ? await memoryStore.getMessages(conversationId) : [];
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const completion = await openai.chat.completions.create({
        model,
        messages: buildRiMessages(message, history)
      });

      const reply = completion.choices[0]?.message?.content?.trim() || "";

      if (memoryStore) {
        await memoryStore.appendMessage(conversationId, "user", message);
        await memoryStore.appendMessage(conversationId, "assistant", reply);
      }

      return reply;
    }
  };
}

module.exports = {
  createRiChatService
};
