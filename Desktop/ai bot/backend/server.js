const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jsforce = require('jsforce');
require('dotenv').config();

const db = require('./db.js');

const app = express();
const PORT = process.env.PORT || 3000;
const MOCK_MODE = process.env.MOCK_MODE === 'true';

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Log incoming requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

/**
 * Health Check (includes DB status)
 */
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    mockMode: MOCK_MODE,
    database: db.getDbStatus(),
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/leads - View saved leads
 */
app.get('/api/leads', async (req, res) => {
  try {
    const leads = await db.getLeads();
    res.json({ success: true, count: leads.length, leads });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/tasks - View saved tasks
 */
app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await db.getTasks();
    res.json({ success: true, count: tasks.length, tasks });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/existing-patient - View existing patient requests
 */
app.get('/api/existing-patient', async (req, res) => {
  try {
    const requests = await db.getExistingPatientRequests();
    res.json({ success: true, count: requests.length, requests });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

function analyzeLeadTemperature(transcript) {
  if (!transcript) return 'Warm';
  const text = transcript.toLowerCase();
  
  const hotKeywords = ['pain', 'hurt', 'bleeding', 'emergency', 'immediate', 'urgent', 'today', 'tomorrow', 'asap', 'swelling', 'broken', 'severe', 'toothache', 'accident', 'chest pain', 'breathing', 'acute'];
  const warmKeywords = ['book', 'appointment', 'schedule', 'consult', 'routine', 'checkup', 'clean', 'vaccine', 'next week', 'doctor', 'specialist'];
  const coldKeywords = ['price', 'cost', 'how much', 'insurance', 'parking', 'where', 'location', 'hours', 'cancel', 'reschedule'];

  let hotCount = 0, warmCount = 0, coldCount = 0;
  hotKeywords.forEach(kw => { if (text.includes(kw)) hotCount++; });
  warmKeywords.forEach(kw => { if (text.includes(kw)) warmCount++; });
  coldKeywords.forEach(kw => { if (text.includes(kw)) coldCount++; });

  if (hotCount > 0) return 'Hot';
  if (warmCount > coldCount) return 'Warm';
  if (coldCount > 0) return 'Cold';
  return 'Warm';
}

app.post('/api/leads', async (req, res) => {
  const { firstName, lastName, email, phone, department, preferredDate, notes, transcript } = req.body;
  if (!lastName || !phone) {
    return res.status(400).json({ success: false, error: 'LastName and Phone are required parameters.' });
  }

  const temperature = analyzeLeadTemperature(transcript || notes);
  let mockLeadId = '00Q8d000003h' + Math.random().toString(36).substring(2, 8).toUpperCase();
  let mockTaskId = '00T8d000002a' + Math.random().toString(36).substring(2, 8).toUpperCase();

  const dbLeadId = await db.saveLead({
    salesforceLeadId: mockLeadId,
    firstName, lastName, email, phone, department, preferredDate, notes, transcript, temperature
  });

  const dbTaskId = await db.saveTask({
    salesforceTaskId: mockTaskId,
    leadId: dbLeadId,
    subject: `[${temperature.toUpperCase()} LEAD] Appointment Request - ${department || 'General'}`,
    priority: temperature === 'Hot' ? 'High' : 'Normal',
    status: 'Completed',
    description: `Lead Temperature: ${temperature}\n\nTranscript:\n${transcript || 'No transcript provided'}`,
    transcript: transcript || notes || ''
  });

  return res.status(201).json({
    success: true,
    message: 'Lead and Task created successfully.',
    dbLeadId, dbTaskId, leadId: mockLeadId, taskId: mockTaskId, leadTemperature: temperature
  });
});

app.post('/api/existing-patient', async (req, res) => {
  const { patientName, email, phone, requestType, details, transcript } = req.body;
  if (!patientName || !phone) {
    return res.status(400).json({ success: false, error: 'PatientName and Phone are required.' });
  }

  let mockTaskId = '00T8d000002a' + Math.random().toString(36).substring(2, 8).toUpperCase();

  const dbRequestId = await db.saveExistingPatientRequest({
    salesforceTaskId: mockTaskId, patientName, phone, email, requestType, details, transcript, matchedExistingRecord: true
  });

  const dbTaskId = await db.saveTask({
    salesforceTaskId: mockTaskId,
    subject: `[EXISTING PATIENT] ${requestType || 'General Request'} - ${patientName}`,
    priority: 'High', status: 'Not Started',
    description: `Request Type: ${requestType || 'Not specified'}\nDetails: ${details || ''}\n\nTranscript:\n${transcript || ''}`,
    transcript: transcript || details || ''
  });

  return res.status(200).json({
    success: true, message: 'Request logged successfully.', dbRequestId, dbTaskId, taskId: mockTaskId, matchedExistingRecord: true
  });
});

if (require.main === module) {
  app.listen(PORT, async () => {
    console.log(`==================================================`);
    console.log(`Surekha Hospital AI Chatbot API Server`);
    console.log(`Server listening on port ${PORT}`);
    await db.initDatabase();
    console.log(`==================================================`);
  });
}

module.exports = app;
