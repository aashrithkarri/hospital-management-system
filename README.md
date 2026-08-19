# Hospital Appointment System

> **Project**: Appointment Management System  
> An intelligent AI Patient Engagement, Doctor Availability & Appointment Booking Platform featuring conversational AI Voice & Chat Receptionists (English & Telugu), authentic specialist doctor schedules, and a role-based Staff Admin Dashboard.

---

## 🚀 Key Features

- 🏥 **Hospital Landing Page**: Modern Clinical Clarity design showcasing resident specialist physicians, transparent pricing, and 1-click booking routing.
- 💬 **AI Assistant Chatbot**: LangGraph-powered conversational agent with real-time token telemetry and session memory.
- 📞 **AI Voice Call Simulator**: High-fidelity Indian voice receptionist with instant unblocked speech loops and live SMS booking dispatch alerts.
- 🌐 **Telugu Multilingual Support**: Seamless English and Telugu conversational support with instant script translation.
- 📊 **Role-Based Admin Dashboard**: Operations Overview, Patient Leads CRM, Doctor Availability Schedules, Voice Bookings, Email Inbox, and SMS Dispatch logs.

---

## 📁 Repository Structure

```
hospital-management-system/
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
│   ├── index.html             # Hospital Landing Page
│   ├── chatbot.html           # AI Health Assistant Chat Interface
│   ├── chatbot.css            # Clinical Clarity Theme Stylesheet
│   ├── voice-call.html        # AI Voice Call Receptionist Simulator
│   ├── admin.html             # Staff Admin Control Center UI
│   ├── admin.css              # Admin Dashboard Dark Glassmorphism Styling
│   └── admin.js               # Admin Dashboard Controller & Real-Time Data Fetcher
│
└── README.md                  # Project Root Documentation
```

---

## 🌐 Application URLs

- 🏥 **Hospital Website**: **[http://localhost:4000](http://localhost:4000)**
- 💬 **AI Health Chatbot**: **[http://localhost:4000/chatbot](http://localhost:4000/chatbot)**
- 📞 **Voice Call Agent**: **[http://localhost:4000/voice-call](http://localhost:4000/voice-call)**
- 📊 **Staff Admin Portal**: **[http://localhost:4000/admin](http://localhost:4000/admin)**
  - *Admin credentials*: `admin` / `admin123`
  - *Staff credentials*: `user` / `user123`

---

## ⚡ How to Run

### 1. Install Dependencies

```bash
# Node.js dependencies
npm install

# Backend dependencies
cd backend
npm install
pip install -r requirements.txt
cd ..
```

### 2. Start Services

```bash
# Start Node.js Web & Chatbot Server (Port 4000)
npm start

# Start Python LangGraph AI Engine (Port 8000)
python3 backend/langgraph_agent.py
```
