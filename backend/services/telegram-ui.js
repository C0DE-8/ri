function homeMessage() {
  return [
    "RI is working.",
    "",
    "Send a message to chat.",
    "Use /image plus a prompt to generate an image.",
    "Tap Clear chat when you want RI to forget this conversation."
  ].join("\n");
}

function homeKeyboard() {
  return {
    keyboard: [["Home", "Clear chat"]],
    resize_keyboard: true,
    one_time_keyboard: false,
    input_field_placeholder: "Message RI..."
  };
}

module.exports = {
  homeKeyboard,
  homeMessage
};
