# Project Setup Instructions

## Prerequisites
Make sure you have the following installed:

- **Node.js** (v18 or higher)
- **npm** (Node Package Manager)
- **ngrok** (for tunneling your localhost)

---

## Installation
Follow these steps to set up the project:

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/DavidVique1998/speech-assistant-openai-twilio.git
   cd https://github.com/DavidVique1998/speech-assistant-openai-twilio.git
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Start the Development Server**:
   ```bash
   npm run dev
   ```

The project will be running on `http://localhost:3000` (or your specified port).

---

## Create Tokens
To integrate **Twilio** and **OpenAI** services, you need to create API tokens.

### 1. Twilio Token
1. Sign up or log in to [Twilio Console](https://www.twilio.com/console).
2. Go to the **Dashboard** and locate your **Account SID** and **Auth Token**.
3. Add them to your project's environment file `.env`:
   ```plaintext
   TWILIO_ACCOUNT_SID=your_account_sid
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_PHONE_NUMBER=your_twilio_phone_number
   ```

### 2. OpenAI Token
1. Sign up or log in to [OpenAI Platform](https://platform.openai.com/).
2. Generate an API key under **API Keys**.
3. Add it to your project's `.env` file:
   ```plaintext
   OPENAI_API_KEY=your_openai_api_key
   ```

---

## Expose Localhost Using ngrok
To expose your local development server to the internet, follow these steps:

1. Start your development server:
   ```bash
   npm run dev
   ```
2. Run ngrok to expose the server (e.g., port 3000):
   ```bash
   ngrok http 3000
   ```
3. Copy the **public URL** generated by ngrok (e.g., `https://randomstring.ngrok.io`) and use it for webhooks or testing.

---

## Environment File Example (.env)
Make sure you create a `.env` file in the root of your project:
```plaintext
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number

OPENAI_API_KEY=your_openai_api_key

PORT=3000
```

---

## Additional Notes
- Replace placeholder values like `your_account_sid` and `your_openai_api_key` with the actual tokens.
- Use `ngrok` for testing external integrations such as webhooks.
- Ensure you keep your tokens safe and **do not expose them** publicly.

---

### Happy Coding! ✨
