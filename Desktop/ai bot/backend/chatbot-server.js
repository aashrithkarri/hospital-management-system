/**
 * chatbot-server.js
 * Express bridge server — port 4000
 * Proxies chat requests to the Python LangGraph agent (port 8000)
 * Serves the Chatbot UI and Admin Dashboard from frontend directory
 * Stores patient data dynamically into MySQL / in-memory database
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const app = express();
const PORT = process.env.CHATBOT_PORT || 4000;
const PYTHON_AGENT_URL = process.env.PYTHON_AGENT_URL || 'http://localhost:8000';

// ─── Resolve Frontend Directory Path ──────────────────────────────────────────
let frontendDir = path.join(__dirname, '../frontend');
if (!fs.existsSync(path.join(frontendDir, 'chatbot.html'))) {
  if (fs.existsSync(path.join(__dirname, 'frontend', 'chatbot.html'))) {
    frontendDir = path.join(__dirname, 'frontend');
  } else if (fs.existsSync(path.join(__dirname, 'chatbot.html'))) {
    frontendDir = __dirname;
  }
}
console.log(`[Static] Serving Frontend Assets from: ${frontendDir}`);

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(frontendDir, { index: false }));

// ─── Logging ─────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${req.method} ${req.url}`);
  next();
});

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  let agentHealth = { status: 'unreachable' };
  try {
    const r = await axios.get(`${PYTHON_AGENT_URL}/health`, { timeout: 3000 });
    agentHealth = r.data;
  } catch (_) {}

  const db = require('./db');
  const dbStatus = db.getDbStatus();

  res.json({
    status: 'healthy',
    bridge: 'chatbot-server',
    port: PORT,
    pythonAgent: agentHealth,
    database: dbStatus,
    timestamp: new Date().toISOString(),
  });
});

// ─── Patient Storage API Endpoints ────────────────────────────────────────────

// GET /api/leads — Fetch all patient leads for Admin Dashboard
app.get('/api/leads', async (req, res) => {
  const db = require('./db');
  const leads = await db.getLeads();
  return res.json({ success: true, count: leads.length, leads });
});

// POST /api/leads — Store new patient lead directly from Admin Dashboard
app.post('/api/leads', async (req, res) => {
  const { firstName, lastName, phone, email, department, preferredDate, temperature, notes } = req.body;
  if (!phone || (!lastName && !firstName)) {
    return res.status(400).json({ success: false, error: 'Patient name and phone number are required.' });
  }

  try {
    const db = require('./db');
    const leadId = await db.saveLead({
      firstName: firstName || '',
      lastName: lastName || firstName || 'Patient',
      phone,
      email: email || '',
      department: department || 'General Consultation',
      preferredDate: preferredDate || 'Flexible',
      temperature: temperature || 'Warm',
      notes: notes || 'General Health Consultation'
    });

    return res.status(201).json({ success: true, message: 'Patient lead stored successfully.', leadId });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/tasks — Fetch all action items
app.get('/api/tasks', async (req, res) => {
  const db = require('./db');
  const tasks = await db.getTasks();
  return res.json({ success: true, count: tasks.length, tasks });
});

// GET /api/existing-patient — Fetch existing patient requests
app.get('/api/existing-patient', async (req, res) => {
  const db = require('./db');
  const requests = await db.getExistingPatientRequests();
  return res.json({ success: true, count: requests.length, requests });
});

// Helper: Auto-extract patient details, suffering/symptoms, appointment preferences from chat
const extractAndStoreChatPatient = async (message) => {
  try {
    const phoneMatch = message.match(/(\+?\d{1,4}?[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}|\b\d{10}\b/);
    const emailMatch = message.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const nameMatch = message.match(/(?:my name is|i am|name:?|this is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);

    const isPatientInquiry = phoneMatch || emailMatch || /book|appointment|suffering|doctor|pain|fever|symptom|checkup|consultation/i.test(message);

    if (isPatientInquiry) {
      const db = require('./db');
      const phone = phoneMatch ? phoneMatch[0] : 'N/A';
      const email = emailMatch ? emailMatch[0] : '';
      
      let fullName = nameMatch ? nameMatch[1] : 'Patient';
      let nameParts = fullName.split(' ');
      let firstName = nameParts[0] || 'Chat';
      let lastName = nameParts.slice(1).join(' ') || 'Patient';

      // Extract Suffering From / Medical Concern
      let sufferingFrom = 'General Health Concern';
      const sufferingMatch = message.match(/(?:suffering from|experiencing|having|complain of|problem with|issue with|feel|feeling|got|with)\s+([^.,\n]+)/i);
      if (sufferingMatch) {
        sufferingFrom = sufferingMatch[1].trim();
      } else if (/chest pain|heart/i.test(message)) sufferingFrom = 'Chest Pain / Cardiac Concern';
      else if (/fever|flu|cold|cough/i.test(message)) sufferingFrom = 'Fever & Flu Symptoms';
      else if (/tooth|teeth|dental|cavity|root canal/i.test(message)) sufferingFrom = 'Dental Pain / Cavity';
      else if (/child|baby|pediatric/i.test(message)) sufferingFrom = 'Pediatric Care / Child Illness';
      else if (/stress|anxiety|mental|counseling/i.test(message)) sufferingFrom = 'Mental Health / Anxiety';

      // Extract Requested Appointment Date / Time
      let prefDate = 'Flexible';
      const dateMatch = message.match(/(?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)?(?:\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?)/i);
      if (dateMatch) {
        prefDate = dateMatch[0];
      }

      // Determine Temperature
      let temp = 'Warm';
      if (/urgent|emergency|today|asap|now|severe|chest pain|heavy bleeding/i.test(message)) temp = 'Hot';

      // Determine Department & Doctor
      let dept = 'General Consultation';
      if (/child|pediatric|baby|kid|sharma|sunita/i.test(message)) dept = 'Pediatrics (Dr. Sunita Sharma)';
      else if (/teeth|dental|tooth|cavity|root canal|kumar|manoj/i.test(message)) dept = 'Dentistry (Dr. Manoj Kumar)';
      else if (/heart|cardio|chest|ecg|verma|tarun/i.test(message)) dept = 'Cardiology (Dr. Tarun Verma)';
      else if (/mental|therapy|counsel|psychology|stress|iyer|shalini/i.test(message)) dept = 'Psychology (Dr. Shalini Iyer)';

      await db.saveLead({
        firstName,
        lastName,
        phone,
        email,
        department: dept,
        preferredDate: prefDate,
        notes: sufferingFrom,
        temperature: temp,
        transcript: message
      });
      console.log(`[Patient DB] Stored Patient Record: Name=${fullName}, Phone=${phone}, SufferingFrom="${sufferingFrom}", Date=${prefDate}`);
    }
  } catch (err) {
    console.warn('[Patient DB Auto-Save Exception]', err.message);
  }
};

// ─── POST /chat — Main chat endpoint ─────────────────────────────────────────
app.post('/chat', async (req, res) => {
  const { message, session_id } = req.body;

  if (!message || typeof message !== 'string' || message.trim() === '') {
    return res.status(400).json({
      success: false,
      error: 'message field is required and must be a non-empty string.',
    });
  }

  // Trigger patient extraction asynchronously
  extractAndStoreChatPatient(message.trim());

  try {
    const response = await axios.post(
      `${PYTHON_AGENT_URL}/chat`,
      { message: message.trim(), session_id: session_id || '' },
      { timeout: 60000 }
    );

    return res.json({
      success: true,
      ...response.data,
    });
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
      return res.status(503).json({
        success: false,
        error: 'AI agent is not running. Please start the Python LangGraph agent first.',
        hint: 'Run: python langgraph_agent.py',
      });
    }

    if (err.response) {
      const detail = err.response.data?.detail || 'Unknown agent error';
      return res.status(err.response.status).json({
        success: false,
        error: detail,
      });
    }

    console.error('[Chat Error]', err.message);
    return res.status(500).json({
      success: false,
      error: 'Internal server error. Please try again.',
    });
  }
});

// ─── DELETE /chat/:session_id — Clear session memory ─────────────────────────
app.delete('/chat/:session_id', async (req, res) => {
  const { session_id } = req.params;
  try {
    const response = await axios.delete(
      `${PYTHON_AGENT_URL}/chat/${session_id}`,
      { timeout: 5000 }
    );
    return res.json({ success: true, ...response.data });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Could not clear session.' });
  }
});

// ─── Voice Call AI & Phone Booking Endpoints ──────────────────────────────
const voiceAgent = require('./voice_agent');

// POST /api/voice-call/process — Real-time turn processing
app.post('/api/voice-call/process', async (req, res) => {
  try {
    const { sessionId, userInput, callerPhone, language } = req.body;
    if (!userInput && userInput !== '') {
      return res.status(400).json({ success: false, error: 'userInput is required.' });
    }

    const result = await voiceAgent.processVoiceInput(sessionId, userInput, { phone: callerPhone, language });
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[Voice Process Error]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/voice-call/save — Save voice call & appointment
app.post('/api/voice-call/save', async (req, res) => {
  try {
    const db = require('./db');
    const saved = await db.saveVoiceCall(req.body);
    return res.status(201).json({ success: true, message: 'Voice call appointment saved successfully.', ...saved });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/voice-calls — Fetch all voice calls for Admin Dashboard
app.get('/api/voice-calls', async (req, res) => {
  try {
    const db = require('./db');
    const calls = await db.getVoiceCalls();
    return res.json({ success: true, count: calls.length, calls });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/voice-calls/:id — Fetch single call details
app.get('/api/voice-calls/:id', async (req, res) => {
  try {
    const db = require('./db');
    const call = await db.getVoiceCallById(req.params.id);
    if (!call) return res.status(404).json({ success: false, error: 'Voice call not found' });
    return res.json({ success: true, call });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/voice-call/simulate-incoming — Trigger a simulated incoming patient call
app.post('/api/voice-call/simulate-incoming', async (req, res) => {
  try {
    const presets = [
      {
        patient_name: 'Jyoti Maurya',
        phone: '+1 (555) 492-8172',
        symptoms: 'Child having high 103F fever, ear pain, and loss of appetite',
        doctor_assigned: 'Dr. Sunita Sharma (Pediatrics & Child Health)',
        department: 'Pediatrics',
        appointment_date: 'Tomorrow, 9:30 AM',
        appointment_time: '9:30 AM',
        urgency: 'Hot',
        call_status: 'Completed & Booked',
        call_duration_seconds: 104,
        transcript: 'Patient: Hi! My 4-year-old daughter woke up with a 103 fever and earache.\nAI Bot: Hello! This is Surekha Hospital Voice Reception. I can get you immediately booked with our pediatrician, Dr. Sunita Sharma. May I have your name?\nPatient: Jyoti Maurya, phone is 555-492-8172.\nAI Bot: Thank you, Jyoti. Dr. Sharma has an urgent morning slot tomorrow at 9:30 AM. Shall I book that?\nPatient: Yes please, thank you so much!\nAI Bot: All set! Your reference is APT-VOICE-3382. An SMS has been dispatched. See you tomorrow at 9:30 AM.',
        ai_summary: 'Pediatric urgent fever and otalgia. Booked morning slot with Dr. Sunita Sharma for tomorrow at 9:30 AM.'
      },
      {
        patient_name: 'Amit Sharma',
        phone: '+1 (555) 310-9844',
        symptoms: 'Acute dental pain, cracked tooth from lunch',
        doctor_assigned: 'Dr. Manoj Kumar (Dentistry & Oral Surgery)',
        department: 'Dentistry',
        appointment_date: 'Friday, 11:30 AM',
        appointment_time: '11:30 AM',
        urgency: 'Hot',
        call_status: 'Completed & Booked',
        call_duration_seconds: 88,
        transcript: 'Patient: I cracked a back molar while eating and it hurts constantly.\nAI Bot: Hello, Surekha Hospital AI Receptionist. Dr. Manoj Kumar is our dental specialist for acute tooth damage. Let\'s get you scheduled right away.\nPatient: Amit Sharma, 555-310-9844.\nAI Bot: Thank you Amit. Dr. Kumar has an opening Friday at 11:30 AM. Does that work?\nPatient: Perfect, please book it.\nAI Bot: Confirmed! Reference APT-VOICE-5192. Please take care until your appointment.',
        ai_summary: 'Cracked posterior molar and acute pain. Booked with Dr. Manoj Kumar for Friday at 11:30 AM.'
      }
    ];

    const chosen = req.body.preset ? req.body : presets[Math.floor(Math.random() * presets.length)];
    const db = require('./db');
    const result = await db.saveVoiceCall(chosen);
    return res.status(201).json({ success: true, message: 'Simulated patient voice call booked successfully.', ...result });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── AI Email Leads API Endpoints ───────────────────────────────────────────

// GET /api/email-leads — Fetch all patient email inquiries
app.get('/api/email-leads', async (req, res) => {
  try {
    const db = require('./db');
    const emails = await db.getEmailLeads();
    return res.json({ success: true, count: emails.length, emails });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/email-leads/:id — Fetch detailed information for single email
app.get('/api/email-leads/:id', async (req, res) => {
  try {
    const db = require('./db');
    const email = await db.getEmailLeadById(req.params.id);
    if (!email) return res.status(404).json({ success: false, error: 'Email lead not found' });
    return res.json({ success: true, email });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/email-leads/simulate-incoming — Trigger a simulated incoming patient email lead
app.post('/api/email-leads/simulate-incoming', async (req, res) => {
  try {
    const presets = [
      {
        sender_name: 'Kiran Rao',
        sender_email: 'kiran.rao@outlook.com',
        subject: 'Appointment Request: Dr. Sunita Sharma / Pediatric Department',
        body_preview: 'Hi, I need to schedule a routine wellness checkup for my 3-year-old son, Rohan, on next Wednesday morning. You can reach me at 555-891-0099.',
        full_body: 'Dear Surekha Hospital Team,\n\nI hope this email finds you well. I would like to schedule a pediatric appointment for my son Rohan Rao. He is 3 years old and due for his routine vaccination and developmental wellness exam.\n\nCould we request a slot with Dr. Sunita Sharma next Wednesday (August 26th) around 10:00 AM if available? Otherwise, any time that Wednesday morning works.\n\nMy contact details:\nName: Kiran Rao\nPhone: 555-891-0099\n\nThank you,\nKiran Rao',
        lead_type: 'appointment',
        priority: 'medium',
        extracted_phone: '555-891-0099',
        extracted_date: 'Next Wednesday, Aug 26 (10:00 AM)',
        ai_summary: 'Pediatric checkup and vaccination request for 3-year-old son Rohan. Requested Dr. Sunita Sharma on next Wednesday morning.',
        received_at: new Date(Date.now() - 1000 * 3600 * 4).toISOString()
      },
      {
        sender_name: 'Rajesh Verma',
        sender_email: 'rverma@vermarefrigeration.in',
        subject: 'URGENT: Severe toothache and swelling',
        body_preview: 'I have severe dental pain on my right molar and my cheek is swollen. Need a dental slot today if possible. Call me at 555-321-9988.',
        full_body: 'Hello,\n\nI need to see Dr. Manoj Kumar as soon as possible. I cracked a tooth yesterday and now I have severe throbbing pain that is keeping me awake, along with noticeable swelling on my cheek.\n\nDo you have any emergency openings today? Please call me on my cell at 555-321-9988 immediately to confirm.\n\nRajesh Verma\nVerma Refrigeration',
        lead_type: 'appointment',
        priority: 'high',
        extracted_phone: '555-321-9988',
        extracted_date: 'Today / Emergency Urgent',
        ai_summary: 'Severe right molar dental pain with swelling. High-urgency scheduling request for Dr. Manoj Kumar today.',
        received_at: new Date(Date.now() - 1000 * 3600 * 1).toISOString()
      },
      {
        sender_name: 'Gaurav Gupta',
        sender_email: 'ggupta@guptatech.in',
        subject: 'General Enquiry: Accepted Insurance plans',
        body_preview: 'Do you accept Cigna PPO and Blue Cross Blue Shield for standard health checkups?',
        full_body: 'Hello, \n\nI would like to check if your clinic accepts Cigna PPO and Anthem Blue Cross Blue Shield insurance plans for routine consultations with family physicians. Also, what is the co-pay amount for self-pay patients if out of network?\n\nGaurav Gupta',
        lead_type: 'inquiry',
        priority: 'low',
        extracted_phone: null,
        extracted_date: 'Flexible',
        ai_summary: 'Inquiry regarding accepted PPO insurance plans (Cigna, BCBS) and out-of-network self-pay details.',
        received_at: new Date(Date.now() - 1000 * 3600 * 18).toISOString()
      }
    ];

    const chosen = presets[Math.floor(Math.random() * presets.length)];
    const db = require('./db');
    const resultId = await db.saveEmailLead(chosen);
    return res.status(201).json({ success: true, message: 'Simulated email lead logged successfully.', emailId: resultId, email: chosen });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── SMS Logs API Endpoints ──────────────────────────────────────────────────

// GET /api/sms/logs — Fetch all sent SMS alerts
app.get('/api/sms/logs', async (req, res) => {
  try {
    const db = require('./db');
    const logs = await db.getSmsLogs();
    return res.json({ success: true, count: logs.length, logs });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/sms/send — Send custom SMS alert simulation
app.post('/api/sms/send', async (req, res) => {
  try {
    const { recipientPhone, messageBody } = req.body;
    if (!recipientPhone || !messageBody) {
      return res.status(400).json({ success: false, error: 'recipientPhone and messageBody are required.' });
    }
    const db = require('./db');
    const saved = await db.saveSmsLog({ recipient_phone: recipientPhone, message_body: messageBody });
    return res.status(201).json({ success: true, message: 'Simulated SMS alert dispatched successfully.', ...saved });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Telephony Integration Webhook (Twilio Voice XML compatible)
app.all('/api/twilio/voice-incoming', (req, res) => {
  res.type('text/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Thank you for calling Hospital Management System. I am Aria, your AI Voice Receptionist. Please tell me your name and what medical symptoms you are experiencing today.</Say>
  <Gather input="speech" action="/api/twilio/voice-gather" timeout="4" speechTimeout="auto" />
</Response>`);
});

// Telephony Integration Webhook - Process speech gathered from Twilio and generate voice responses
app.all('/api/twilio/voice-gather', async (req, res) => {
  const SpeechResult = req.body.SpeechResult || req.query.SpeechResult;
  const sessionId = req.body.CallSid || req.query.CallSid || `twilio_${Date.now()}`;
  const callerPhone = req.body.From || req.query.From || 'Caller';

  console.log(`[Twilio Webhook] Received speech: "${SpeechResult || ''}" from ${callerPhone} (CallSid: ${sessionId})`);

  let responseText = "";
  let isBooked = false;
  let isEmergency = false;

  try {
    if (SpeechResult && SpeechResult.trim() !== '') {
      const result = await voiceAgent.processVoiceInput(sessionId, SpeechResult, { phone: callerPhone });
      responseText = result.voiceResponse;
      isBooked = result.isBooked;
      isEmergency = result.isEmergency;
    } else {
      responseText = "I didn't quite catch that. Could you please state your name and what medical symptoms you are experiencing today?";
    }
  } catch (err) {
    console.error('[Twilio Webhook Gather Error]', err);
    responseText = "We are currently experiencing database issues. Please call back later or visit our hospital directly.";
    isEmergency = true;
  }

  res.type('text/xml');
  let twiml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n`;
  twiml += `  <Say voice="Polly.Joanna">${responseText}</Say>\n`;

  if (isBooked || isEmergency) {
    twiml += `  <Hangup/>\n`;
  } else {
    twiml += `  <Gather input="speech" action="/api/twilio/voice-gather" timeout="4" speechTimeout="auto" />\n`;
  }
  twiml += `</Response>`;

  res.send(twiml);
});

// ─── Serve Chatbot UI & Admin Dashboard & Voice Call UI ───────────────────────
const serveLandingPage = (req, res) => {
  const indexPath = path.join(frontendDir, 'index.html');
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  res.status(404).send('Error: index.html not found');
};

const serveChatbot = (req, res) => {
  const htmlPath = path.join(frontendDir, 'chatbot.html');
  if (fs.existsSync(htmlPath)) return res.sendFile(htmlPath);
  res.status(404).send('Error: chatbot.html not found');
};

const serveAdmin = (req, res) => {
  const adminPath = path.join(frontendDir, 'admin.html');
  if (fs.existsSync(adminPath)) return res.sendFile(adminPath);
  res.status(404).send('Error: admin.html not found');
};

const serveVoiceCall = (req, res) => {
  const voicePath = path.join(frontendDir, 'voice-call.html');
  if (fs.existsSync(voicePath)) return res.sendFile(voicePath);
  res.status(404).send('Error: voice-call.html not found');
};

app.get('/', serveLandingPage);
app.get('/index.html', serveLandingPage);
app.get('/home', serveLandingPage);
app.get('/chatbot', serveChatbot);
app.get('/chatbot.html', serveChatbot);
app.get('/admin', serveAdmin);
app.get('/admin.html', serveAdmin);
app.get('/voice-call', serveVoiceCall);
app.get('/voice-call.html', serveVoiceCall);
app.get('/call', serveVoiceCall);

// Catch-all — redirect unknown GETs to landing page
app.get('*', (req, res) => {
  if (req.accepts('html')) return res.redirect('/');
  res.status(404).json({ error: 'Not found' });
});

// ─── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  const db = require('./db');
  await db.initDatabase();

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   Hospital Management System Control Center & AI Services  ║');
  console.log(`║  📞 AI Voice Call Bot:  http://localhost:${PORT}/voice-call      ║`);
  console.log(`║  💬 AI Chatbot:         http://localhost:${PORT}/chatbot         ║`);
  console.log(`║  ⚙️  Admin Dashboard:    http://localhost:${PORT}/admin           ║`);
  console.log(`║  🧠 Python Agent:       ${PYTHON_AGENT_URL}     ║`);
  console.log('╚════════════════════════════════════════════════════════════╝');
});

module.exports = app;
