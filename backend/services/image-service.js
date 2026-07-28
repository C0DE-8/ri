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
    }
  };
}

function isImageRequest(message) {
  const text = String(message || "").trim().toLowerCase();
  return (
    text.startsWith("/image ") ||
    text.startsWith("image:") ||
    text.startsWith("draw ") ||
    text.startsWith("generate image ") ||
    text.includes("generate an image") ||
    text.includes("make an image")
  );
}

function extractImagePrompt(message) {
  return String(message || "")
    .replace(/^\/image\s+/i, "")
    .replace(/^image:\s*/i, "")
    .replace(/^draw\s+/i, "")
    .replace(/^generate image\s+/i, "")
    .replace(/^generate an image\s+/i, "")
    .replace(/^make an image\s+/i, "")
    .trim();
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
