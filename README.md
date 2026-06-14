# Voice Message Transcript Bot

Automatically transcribes Discord voice messages and posts the transcript
in a thread on the original message, so people who can't listen at the
time can read instead.

Runs entirely on free tiers: **Groq's Whisper API** (free, no card
required) for transcription, hosted alongside your existing `/catchup`
bot on Railway.

---

## 1. Create the Discord bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. **New Application** → name it something like "Transcript Bot"
3. Go to the **Bot** tab:
   - Click **Reset Token** (or **Add Bot**) and copy the token \u2014 this is
     your `DISCORD_TOKEN`. Keep it secret.
   - Under **Privileged Gateway Intents**, enable **Message Content Intent**.
     This is required to read voice message attachments.
4. Go to **OAuth2 \u2192 URL Generator**:
   - Scopes: check **bot**
   - Bot Permissions: check
     - **View Channels**
     - **Send Messages**
     - **Create Public Threads**
     - **Send Messages in Threads**
     - **Read Message History**
   - Copy the generated URL, open it, and add the bot to your server.

---

## 2. Get a Groq API key (free)

1. Go to [console.groq.com](https://console.groq.com)
2. Sign up (email or Google \u2014 no credit card needed)
3. **API Keys** \u2192 **Create API Key** \u2192 copy it. This is your `GROQ_API_KEY`.

The free tier includes 2,000 audio transcription requests per day \u2014 far
more than a community's voice message volume.

---

## 3. Run it locally (optional, to test)

```bash
npm install
cp .env.example .env
# edit .env and paste in your DISCORD_TOKEN and GROQ_API_KEY
npm start
```

Send a voice message in a channel the bot can see \u2014 within a few
seconds it should create a thread on your message titled "Transcript"
with the text.

---

## 4. Deploy to Railway

Since you're already running `/catchup` on Railway, add this as a
**second service in the same project** \u2014 it's idle except when
processing a voice message, so it should fit inside your existing
Hobby plan usage credit.

1. Push this folder to a new GitHub repo (same flow as the catchup bot)
2. In your Railway project, click **+ New** \u2192 **GitHub Repo** \u2192 select
   the new repo
3. In the new service's **Variables** tab, add:
   - `DISCORD_TOKEN`
   - `GROQ_API_KEY`
4. Railway will detect the Node project and deploy automatically. Check
   the **Deploy Logs** for `Logged in as ...` to confirm it's running.

---

## How it works

- Listens for `messageCreate` events and checks the Discord
  `IsVoiceMessage` flag (this is how Discord marks the waveform voice
  clips, separate from regular file attachments)
- Downloads the audio and sends it to Groq's `whisper-large-v3-turbo`
  model
- Creates a thread on the original message and posts the transcript
  there (falls back to a direct reply if thread creation isn't possible,
  e.g. in a DM)
- If no speech is detected, or transcription fails, it posts a short
  note instead of staying silent

## Notes / things to keep an eye on

- **Long voice messages**: transcripts longer than 2000 characters are
  automatically split across multiple messages in the thread.
- **Rate limits**: Groq's free tier is 2,000 requests/day. If the
  community ever approaches that (unlikely), the bot will start logging
  Groq errors \u2014 worth keeping an eye on Railway logs occasionally.
- **Privacy**: voice message audio is sent to Groq for processing.
  Groq does not use API data to train models, but it's worth being aware
  the audio leaves Discord's infrastructure briefly.
