import Fastify from "fastify";
import WebSocket from "ws";
import dotenv from "dotenv";
import fastifyFormBody from "@fastify/formbody";
import fastifyWs from "@fastify/websocket";
import twilio from "twilio";

// Load environment variables from .env file
dotenv.config();
// Retrieve the OpenAI API key from environment variables. You must have OpenAI Realtime API access.
const {
  OPENAI_API_KEY,
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER,
} = process.env;
if (
  !OPENAI_API_KEY ||
  !TWILIO_ACCOUNT_SID ||
  !TWILIO_AUTH_TOKEN ||
  !TWILIO_PHONE_NUMBER
) {
  console.error(
    "Missing OpenAI API key, Twilio Account SID, Twilio Auth Token, or Twilio Phone Number. Please set them in the .env file."
  );
  process.exit(1);
}

// Initialize Fastify
const fastify = Fastify();
fastify.register(fastifyFormBody);
fastify.register(fastifyWs);

//Temp Memory 
const callParams = new Map(); // Memoria temporal para almacenar parámetros

callParams.set("+593992520223", {name: "David"});
callParams.set("+593992722256", {name: "Emilio Rosado"});
callParams.set("+593995772424", {name: "Kevin Rojas"});

// Twilio Client
const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// Constants
const SYSTEM_MESSAGE =
  "Eres un asistente de ventas ecuatoriano servicial, al que le encanta charlar sobre algun producto electronico en específico que le interese al usuario y está dispuesto a ofrecerle datos. Debes saludamre por mi nombre.";
//Base voices: alloy, echo, shimmer.
//Expresive voices: ash, ballad, coral, sage, verse.
const VOICE = "coral";
const PORT = process.env.PORT || 5050; // Allow dynamic port assignment
// List of Event Types to log to the console. See OpenAI Realtime API Documentation. (session.updated is handled separately.)
const LOG_EVENT_TYPES = [
  "response.content.done",
  "rate_limits.updated",
  "response.done",
  "input_audio_buffer.committed",
  "input_audio_buffer.speech_stopped",
  "input_audio_buffer.speech_started",
  "session.created",
  "response.function_call_arguments.done",
  "response.function_call.done",
  "response.function_call.failed",
  "session.updated",
];

// Root Route
fastify.get("/", async (request, reply) => {
  reply.send({ message: "Twilio Media Stream Server is running!" });
});
// Route for Twilio to handle incoming and outgoing calls
// <Say> punctuation to improve text-to-speech translation
fastify.all("/incoming-call", async (request, reply) => {
  //Get caller info
  const phone = request.body.To || "desconocido"; // Número del remitente
  const { name } = callParams.get(request.body.To) || callParams.get(request.body.From) || "desconocido"; // Nombre del remitente, si existe
  console.log(`Data from ${phone}: ${name}`);

  // Construir la URL del WebSocket con parámetros
  const url = new URL("wss://" + request.headers.host + "/media-stream");

  //TwiML response
  const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
                          <Response>
                              <Connect>
                                  <Stream url="${url.toString()}">
                                      <Parameter name="name" value="${name}" />
                                      <Parameter name="phone" value="${phone}" />
                                  </Stream>
                              </Connect>
                          </Response>`;
  reply.type("text/xml").send(twimlResponse);
});

//Primary handler fails
fastify.post("/incoming-error", async (request, reply) => {
  console.log("Incoming error", request.body);
});

// Route for make call
fastify.post("/make-call", async (request, reply) => {
  const { name, phone } = request.body;
  if (!name || !phone) {
    return reply.status(400).send("Missing name or phone number");
  }
  //URL with params
  const url = new URL("https://" + request.headers.host + "/incoming-call");
  //Add a new call to the memory
  callParams.set(phone, { name });
  console.log(callParams);
  try {
    const call = await client.calls.create({
      from: TWILIO_PHONE_NUMBER,
      to: phone,
      url: url.toString(),
    });
    console.log(`Call created to ${name} (${phone}). SID: ${call.sid}`);
    return reply.send({
      message: `Call created to ${name} (${phone}). SID: ${call.sid}`,
      callSid: call.sid,
    });
  } catch (e) {
    console.log(e);
    return reply.status(500).send("Error creating call: " + e.message);
  }
});

// WebSocket route for media-stream
fastify.register(async (fastify) => {
  fastify.get("/media-stream", { websocket: true }, (connection, req) => {
    console.log("Client connected");

    const openAiWs = new WebSocket(
      "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01",
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "OpenAI-Beta": "realtime=v1",
        },
      }
    );

    let streamSid = null;

    const sendSessionUpdate = (name="usuario", phone="desconocido") => {    
      const sessionUpdate = {
        type: "session.update",
        session: {
          modalities: ["text", "audio"],
          instructions:
            SYSTEM_MESSAGE + ` Me llamo ${name} y mi número es ${phone}.`,
          voice: VOICE,
          input_audio_format: "g711_ulaw",
          output_audio_format: "g711_ulaw",
          input_audio_transcription: {
            model: "whisper-1",
          },
          turn_detection: {
            type: "server_vad",
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 500,
          },
          //Important
          tools: [
            {
              type: "function",
              name: "get_weather",
              description: "Get the current weather...",
              parameters: {
                type: "object",
                properties: {
                  location: { type: "string" },
                },
                required: ["location"],
              },
            },
            {
              type: "function",
              name: "search_products",
              description: "Search for products...",
              parameters: {
                type: "object",
                properties: {
                  query: { type: "string" },
                },
                required: ["query"],
              },
            },
            {
              type: "function",
              name: "validate_purchase",
              description: "Validate purchase...",
              parameters: {
                type: "object",
                properties: {
                  buyer_name: { type: "string" },
                  amount: { type: "number" },
                  product_id: { type: "string" },
                  payment_status: {
                    type: "string",
                    enum: ["pending", "completed"],
                  },
                },
                required: [
                  "buyer_name",
                  "amount",
                  "product_id",
                  "payment_status",
                ],
              },
            },
          ],
          tool_choice: "auto",
          temperature: 0.7,
          max_response_output_tokens: "inf",
        },
      };
      openAiWs.send(JSON.stringify(sessionUpdate));
    };

    // Open event for OpenAI WebSocket
    openAiWs.on("open", () => {
      console.log("Connected to the OpenAI Realtime API");
      //setTimeout(sendSessionUpdate, 250); // Ensure connection stability, send after .25 seconds
    });

    // Listen for messages from the OpenAI WebSocket (and send to Twilio if necessary)
    openAiWs.on("message", (data) => {
      try {
        const response = JSON.parse(data);
        //Print received events
        if (LOG_EVENT_TYPES.includes(response.type)) {
          console.log(
            `Received event: ${response.type}`,
            JSON.stringify(response, null, 4)
          );
        }

        //Session updated
        if (response.type === "session.updated") {
          console.log("Session updated successfully:", response);
        }

        //When the function call is complete, the server will send a response.function_call_arguments.done event.
        if (response.type === "response.function_call_arguments.done") {
          console.log(
            "Function call arguments received:",
            JSON.stringify(response, null, 4)
          );

          if (response.name === "get_weather") {
            const { location } = response.arguments;
            const weather = "18°C";
            const toolResponse = {
              type: "conversation.item.create",
              item: {
                type: "function_call_output",
                call_id: response.call_id,
                output: JSON.stringify({ result: weather }),
              },
            };
            openAiWs.send(JSON.stringify(toolResponse));
          }
        }

        // Handle audio delta
        if (response.type === "response.audio.delta" && response.delta) {
          const audioDelta = {
            event: "media",
            streamSid: streamSid,
            media: {
              payload: Buffer.from(response.delta, "base64").toString("base64"),
            },
          };
          connection.send(JSON.stringify(audioDelta));
        }
      } catch (error) {
        console.error(
          "Error processing OpenAI message:",
          error,
          "Raw message:",
          data
        );
      }
    });

    // Handle incoming messages from Twilio
    connection.on("message", (message) => {
      try {
        const data = JSON.parse(message);
        switch (data.event) {
          case "media":
            if (openAiWs.readyState === WebSocket.OPEN) {
              const audioAppend = {
                type: "input_audio_buffer.append",
                audio: data.media.payload,
              };
              openAiWs.send(JSON.stringify(audioAppend));
            }
            break;
          case "start":
            streamSid = data.start.streamSid;
            const { name, phone } = data.start.customParameters;
            openAiWs.once("open", () => {
                console.log("WebSocket is now open, sending session update.");
                sendSessionUpdate(name, phone);
            });
            console.log(`Incoming stream has started ${streamSid}, name: ${name}, phone: ${phone}`);
            break;
          default:
            console.log("Received non-media event:", data.event);
            break;
        }
      } catch (error) {
        console.error("Error parsing message:", error, "Message:", message);
      }
    });

    // Handle connection close
    connection.on("close", () => {
      if (openAiWs.readyState === WebSocket.OPEN) openAiWs.close();
      console.log("Client disconnected.");
    });
    // Handle WebSocket close and errors
    openAiWs.on("close", () => {
      console.log("Disconnected from the OpenAI Realtime API");
    });
    openAiWs.on("error", (error) => {
      console.error("Error in the OpenAI WebSocket:", error);
    });
  });
});

// Start the server
fastify.listen({ port: PORT }, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Server is listening on port ${PORT}`);
});
