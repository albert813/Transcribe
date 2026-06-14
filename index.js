/* ============================================================
   Voice Message Transcript Bot
   ------------------------------------------------------------
   Watches for Discord voice messages, transcribes them via
   Groq's free Whisper API, and posts the transcript as a
   direct reply to the original message.

   Required environment variables:
     DISCORD_TOKEN  - your bot's token from the Discord
                       Developer Portal
     GROQ_API_KEY   - free API key from console.groq.com
   ============================================================ */

import { Client, GatewayIntentBits, MessageFlags } from "discord.js";

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "whisper-large-v3-turbo";

const MAX_DISCORD_MESSAGE = 2000;

if (!DISCORD_TOKEN) {
  console.error("Missing DISCORD_TOKEN environment variable.");
  process.exit(1);
}
if (!GROQ_API_KEY) {
  console.error("Missing GROQ_API_KEY environment variable.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  presence: {
    status: "invisible",
  },
});

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}. Watching for voice messages...`);
});

client.on("messageCreate", async (message) => {
  try {
    // Ignore bots (including ourselves) and anything that isn't a voice message
    if (message.author.bot) return;
    if (!message.flags?.has(MessageFlags.IsVoiceMessage)) return;

    const attachment = message.attachments.first();
    if (!attachment) return;

    console.log(
      `Voice message from ${message.author.tag} in #${message.channel.name ?? "DM"} (${attachment.duration ?? "?"}s)`
    );

    let transcript;
    try {
      transcript = await transcribeAttachment(attachment.url);
    } catch (err) {
      console.error("Transcription failed:", err);
      await postReply(message, "_Transcription failed \u2014 the message could be too long, an unsupported format, or Groq is temporarily unavailable._");
      return;
    }

    await postReply(message, formatTranscript(transcript));
  } catch (err) {
    console.error("Unexpected error handling message:", err);
  }
});

/**
 * Downloads the voice message audio and sends it to Groq's
 * Whisper API for transcription. Returns the transcript text
 * (may be an empty string if no speech was detected).
 */
async function transcribeAttachment(url) {
  const audioRes = await fetch(url);
  if (!audioRes.ok) {
    throw new Error(`Failed to download audio: ${audioRes.status}`);
  }
  const buffer = await audioRes.arrayBuffer();

  const form = new FormData();
  form.append("file", new Blob([buffer], { type: "audio/ogg" }), "voice-message.ogg");
  form.append("model", GROQ_MODEL);
  form.append("response_format", "json");

  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: form,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return (data.text || "").trim();
}

function formatTranscript(transcript) {
  if (!transcript) {
    return "_Couldn't make out any speech in this voice message._";
  }
  return `**Transcript:**\n${transcript}`;
}

/**
 * Posts the transcript as a direct reply to the voice message.
 */
async function postReply(message, content) {
  await sendChunked(message, content);
}

/**
 * Sends content as a reply, splitting into multiple messages if it
 * exceeds Discord's character limit. Only the first chunk is sent
 * as a reply (with the reference back to the original message);
 * any additional chunks are sent as plain follow-ups in the channel.
 */
async function sendChunked(message, content) {
  let remaining = content;
  let first = true;

  while (remaining.length > 0) {
    const chunk = remaining.slice(0, MAX_DISCORD_MESSAGE);
    remaining = remaining.slice(MAX_DISCORD_MESSAGE);

    if (first) {
      await message.reply(chunk);
    } else {
      await message.channel.send(chunk);
    }
    first = false;
  }
}

client.login(DISCORD_TOKEN);
