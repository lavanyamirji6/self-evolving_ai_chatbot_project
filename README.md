# 🧬 Self-Evolving AI

A full-stack AI chatbot that evaluates itself, detects weaknesses, and autonomously improves.

## Architecture

```
evolveAI/
├── backend/          ← FastAPI + LangGraph + SQLite
│   ├── main.py       ← All API routes
│   ├── ai_engine.py  ← LangGraph + Ollama agent
│   ├── evolution_engine.py  ← Self-eval, weakness detection, versioning
│   ├── auth.py       ← JWT auth
│   ├── database.py   ← SQLAlchemy models
│   └── requirements.txt
└── frontend/         ← React app
    ├── src/pages/    ← login.js, chat.js, admin.js, app.js
    └── src/styles/   ← CSS files
```

## Prerequisites

1. **Python 3.10+** with pip
2. **Node.js 18+** with npm
3. **Ollama** running locally with `qwen2.5:1.5b` pulled:
   ```
   ollama pull qwen2.5:1.5b
   ```

## Quick Start

### 1. Start the Backend
Double-click `start_backend.bat` or run:
```cmd
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 5000 --reload
```

### 2. Start the Frontend
Double-click `start_frontend.bat` or run:
```cmd
cd frontend
npm install
npm start
```

### 3. Open the App
- **Chat**: http://localhost:3000/login
- **API Docs**: http://localhost:5000/docs

## Default Credentials
| Username | Password | Role  |
|----------|----------|-------|
| admin    | admin123 | Admin |
| user     | user123  | User  |

## Features

### Chat (All Users)
- 💬 Conversational AI powered by Ollama (qwen2.5:1.5b)
- 🔍 Web search via Wikipedia when needed
- 📄 Document Q&A — upload PDF or TXT files
- 🗣️ Voice input (browser speech recognition) + text-to-speech
- 🌍 Multilingual support (8 languages)
- 👍👎⭐ Per-message feedback
- 👤 User profile & session memory
- 📜 Chat history

### Admin Dashboard
- 📊 Self-Evaluation Engine — accuracy, speed, satisfaction metrics
- 🔍 Weakness Detection — auto-detects patterns from real data
- 🔄 Evolution Engine — 6 improvement types with sandbox testing
- 🧪 Safe Testing — every improvement is tested before applying
- 📦 Version Management — history, rollback support
- 📈 Performance Charts — accuracy & response time trends
- 🗄️ Learning Database — tracks all improvements & feedback

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/login | Get JWT token |
| POST | /api/register | Create account |
| GET  | /api/me | Current user info |
| POST | /api/chat | Send message |
| GET  | /api/chat/history | Chat history |
| POST | /api/feedback | Submit feedback |
| POST | /api/upload | Upload document |
| GET  | /api/evolution/dashboard | Admin dashboard data |
| GET  | /api/evolution/versions | All AI versions |
| GET  | /api/evolution/weaknesses | Detected weaknesses |
| POST | /api/evolution/propose | Propose improvement |
| POST | /api/evolution/rollback/{v} | Rollback version |
| GET  | /api/evolution/improvements | Improvement history |
| GET  | /api/evolution/metrics | Performance metrics |
