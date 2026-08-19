# Surekha Hospital — AI Chatbot & Admin Dashboard System

An intelligent AI Patient Engagement, Doctor Availability & Appointment Booking System for **Surekha Hospital**, featuring a dedicated Admin Dashboard.

---

## 📁 Repository Structure

```
ai bot/
├── backend/
│   ├── server.js              # Express API & MySQL Middleware (Port 3000)
│   ├── chatbot-server.js      # Express Chatbot & Admin Control Center (Port 4000)
│   ├── langgraph_agent.py     # Python LangGraph Patient Help Bot Agent (Port 8000)
│   ├── db.js                  # MySQL Database Pool & Schema Manager
│   ├── package.json           # Node.js dependencies & scripts
│   ├── requirements.txt       # Python dependencies
│   └── .env                   # Environment Configuration
│
├── frontend/
│   ├── admin.html             # Admin Control Center Dashboard UI
│   ├── admin.css              # Admin Dashboard Dark Glassmorphism Styling
│   ├── admin.js               # Admin Dashboard Controller & Real-Time Data Fetcher
│   ├── chatbot.html           # AI Patient Assistant UI Interface
│   ├── chatbot.css            # Chatbot Stylesheet
│   ├── index.html             # Clinic Website Landing Page
│   └── style.css              # Clinic Website Stylesheet
│
└── README.md                  # Project Root Documentation
```

---

## 🌐 Application URLs

- **Admin Dashboard**: **[http://localhost:4000/admin](http://localhost:4000/admin)**
- **AI Chatbot**: **[http://localhost:4000/chatbot](http://localhost:4000/chatbot)**
- **Hospital Website**: Open `frontend/index.html` in browser.

---

## ⚡ How to Run

### 1. Backend Setup (`/backend`)

```bash
cd backend
npm install
pip install -r requirements.txt
```

**Start Services**:
- **Start Chatbot & Admin Server**:
  ```bash
  npm start
  ```
- **Start Python Agent**:
  ```bash
  python langgraph_agent.py
  ```
- **Start API Middleware Server**:
  ```bash
  npm run api
  ```
