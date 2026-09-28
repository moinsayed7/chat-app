# Chat App — Backend

Express + MongoDB + Socket.io backend for a real-time chat application, with hand-rolled JWT authentication — no auth library, no Passport, no Auth.js.

**Frontend repo:** [chat-app-frontend](https://github.com/moinsayed7/chat-app-frontend)
**Live API:** add your Render URL here

---

## Why hand-rolled auth

This backend deliberately implements JWT issuance, verification, and WebSocket-handshake authentication manually rather than through a library, to understand the mechanics rather than just call them working: how a JWT signature actually gets checked, why a cookie needs specific flags to survive a cross-origin request, and how a Socket.io connection authenticates itself before `connection` even fires.

## Tech stack

- Node.js + Express
- MongoDB + Mongoose
- Socket.io
- `jsonwebtoken` — JWT signing/verification
- bcrypt — password hashing
- Zod — request validation
- cookie-parser, cors

## Architecture notes

- **JWT lives in an `httpOnly` cookie, not localStorage.** The app renders user-generated content constantly (chat messages), which is the largest realistic XSS surface a web app has. An `httpOnly` cookie can't be read or exfiltrated by injected JavaScript. The tradeoff: `SameSite=None; Secure` is required for the cookie to survive the cross-origin split with the frontend, and CORS has to be explicitly configured (`origin` locked to the real frontend URL, `credentials: true`) rather than left wide open.
- **The Socket.io handshake is authenticated separately from REST routes.** It arrives as an HTTP request under the hood, so the same cookie rides along — but Socket.io bypasses Express's middleware chain entirely, so the cookie has to be manually parsed out of `socket.handshake.headers.cookie` and verified in `io.use(...)` before a connection is accepted.
- **`Message` documents don't store `receiverId`.** A `Conversation` has exactly two participants; the receiver is always derivable as "whichever participant isn't the sender." Storing it redundantly on every message risked the two fields drifting out of sync with no structural guarantee they'd match.
- **Conversation and Message creation logic lives in one shared service** (`services/messageService.js`), called by both the REST `POST /messages` endpoint and the Socket.io `sendMessage` handler, so there's a single source of truth for what happens when a message is sent, regardless of transport.
- **Online users are tracked in an in-memory `userId → socket.id` map**, populated on connect and cleared on disconnect, so the server knows whether to push a message live or rely on the receiver fetching history on next login.

## Getting started

### Prerequisites
- Node.js
- A MongoDB Atlas cluster (or local MongoDB instance)

### Setup
```bash
npm install
```

Create a `.env` file:
```
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=a_long_random_string
FRONTEND_URL=http://localhost:3001
PORT=3000
```

```bash
node index.js
```

## API reference

| Method | Route | Auth required | Description |
|---|---|---|---|
| POST | `/auth/register` | No | Create a new account |
| POST | `/auth/login` | No | Log in; sets the `token` cookie |
| GET | `/conversations` | Yes | List the logged-in user's conversations, populated with participants and last message |
| GET | `/conversation/with/:receiverId` | Yes | Check for / return an existing conversation with a specific user |
| GET | `/message/:conversationId` | Yes | Fetch message history for a conversation |
| POST | `/messages` | Yes | Send a message over REST |
| GET | `/users?search=` | Yes | Search for users to start a conversation with |

## Socket.io events

| Event | Direction | Payload |
|---|---|---|
| `sendMessage` | client → server | `{ receiverId, text }` |
| `messageSent` | server → sender | the created message |
| `newMessage` | server → receiver | the created message |
| `messageError` | server → sender | `{ error: string }` |

## Deployment notes

- Deployed on Render, which requires reading `process.env.PORT` (Render assigns the port at runtime) rather than a hardcoded value, with a local fallback.
- MongoDB Atlas's IP access list needs `0.0.0.0/0` (or Render's IP range, if known and stable) since Render's outbound IP isn't fixed on the free tier.


