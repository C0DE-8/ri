const OpenAI = require("openai");
const { v2: cloudinary } = require("cloudinary");

function createImageService() {
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";

  return {
    model,

    async generate(prompt) {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY is required");
      }

      configureCloudinary();

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const image = await openai.images.generate({
        model,
        prompt,
        size: process.env.OPENAI_IMAGE_SIZE || "1024x1024"
      });

      const item = image.data?.[0];
      if (!item?.b64_json && !item?.url) {
        throw new Error("OpenAI did not return an image");
      }

      const uploadSource = item.b64_json ? `data:image/png;base64,${item.b64_json}` : item.url;
      const upload = await cloudinary.uploader.upload(uploadSource, {
        folder: process.env.CLOUDINARY_FOLDER || "ri/generated",
        resource_type: "image"
      });

      return {
        url: upload.secure_url,
        prompt,
        provider: "cloudinary"
      };
    },

    async buildPromptFromConversation({ conversationId, memoryStore, request }) {
      const history = memoryStore ? await memoryStore.getMessages(conversationId, 10) : [];
      const context = history
        .map((message) => `${message.role}: ${message.content}`)
        .join("\n")
        .slice(-3000);

      if (!context) return "";

      return [
        "Create an image based on this recent RI chat context.",
        "Focus on the user's current story/world idea and make it visually specific.",
        `Latest image request: ${request}`,
        "Recent context:",
        context
      ].join("\n");
    }
  };
}

function isImageRequest(message) {
  const text = String(message || "").trim().toLowerCase();
  return (
    text.startsWith("/image ") ||
    text === "/image" ||
    text.startsWith("image:") ||
    text.startsWith("draw ") ||
    text.startsWith("create image ") ||
    text.startsWith("create an image ") ||
    text.startsWith("generate image ") ||
    text.startsWith("generate a picture ") ||
    text.startsWith("make a picture ") ||
    text.includes("generate an image") ||
    text.includes("make an image") ||
    text.includes("create an image") ||
    text.includes("can i get image") ||
    text.includes("can i get an image") ||
    text.includes("can you make image") ||
    text.includes("can you make an image") ||
    text.includes("can you draw") ||
    text.includes("send me an image") ||
    text.includes("send image") ||
    text.includes("show me an image") ||
    text.includes("show image") ||
    text.includes("picture of") ||
    text.includes("image of")
  );
}

function extractImagePrompt(message) {
  const prompt = String(message || "")
    .replace(/^\/image\s+/i, "")
    .replace(/^\/image$/i, "")
    .replace(/^image:\s*/i, "")
    .replace(/^draw\s+/i, "")
    .replace(/^create image\s+/i, "")
    .replace(/^create an image\s+/i, "")
    .replace(/^generate image\s+/i, "")
    .replace(/^generate an image\s+/i, "")
    .replace(/^generate a picture\s+/i, "")
    .replace(/^make an image\s+/i, "")
    .replace(/^make a picture\s+/i, "")
    .replace(/^can i get an? image\s*/i, "")
    .replace(/^can you make an? image\s*/i, "")
    .replace(/^can you draw\s*/i, "")
    .replace(/^send me an image\s*/i, "")
    .replace(/^send image\s*/i, "")
    .replace(/^show me an image\s*/i, "")
    .replace(/^show image\s*/i, "")
    .trim();

  if (/^[\s.?!,:;-]*$/.test(prompt)) return "";
  if (/^(can i get|can you make|send me|show me)?\s*(an?\s*)?(image|picture|photo|drawing)[\s.?!,:;-]*$/i.test(prompt)) {
    return "";
  }

  return prompt;
}

function configureCloudinary() {
  const required = ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`${missing.join(", ")} required for image uploads`);
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

module.exports = {
  createImageService,
  extractImagePrompt,
  isImageRequest
};
