/**
 * db.js
 * MySQL Database Module for Surekha Hospital
 * Uses mysql2/promise for connection pooling and query execution.
 * Provides fallback in-memory storage if MySQL is unreachable.
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '3306', 10);
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'surekha_db';
const USE_MYSQL = process.env.USE_MYSQL !== 'false';

let pool = null;
let isDbConnected = false;

// Fallback in-memory stores
const mockLeads = [];
const mockTasks = [];
const mockExistingPatients = [];
const mockEmailLeads = [];
const mockSmsLogs = [
  {
    id: 1,
    recipient_phone: '+1 (555) 234-8901',
    message_body: 'Your pediatric consultation with Dr. Sunita Sharma is confirmed for Tomorrow at 10:30 AM. Confirmation Code: APT-VOICE-8412.',
    status: 'Delivered',
    direction: 'Outgoing',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString()
  },
  {
    id: 2,
    recipient_phone: '+1 (555) 876-5432',
    message_body: 'Your dental checkup with Dr. Manoj Kumar is confirmed for Friday at 2:00 PM. Confirmation Code: APT-VOICE-7930.',
    status: 'Delivered',
    direction: 'Outgoing',
    created_at: new Date(Date.now() - 3600000 * 5).toISOString()
  }
];
const mockVoiceCalls = [
  {
    id: 1,
    call_reference: 'CALL-90412',
    appointment_id: 'APT-VOICE-8412',
    patient_name: 'Devendra Patel',
    phone: '+1 (555) 234-8901',
    email: 'devendra.patel@example.com',
    symptoms: 'High fever and dry cough for 3 days',
    doctor_assigned: 'Dr. Sunita Sharma (Pediatrics & General)',
    department: 'Pediatrics / General',
    appointment_date: 'Tomorrow, 10:30 AM',
    appointment_time: '10:30 AM',
    urgency: 'Hot',
    call_status: 'Completed & Booked',
    call_duration_seconds: 94,
    transcript: 'Patient: Hi, I need to see a doctor urgently for my son who has a 102 fever.\nAI Bot: Hello! Thank you for calling Surekha Hospital. I can immediately book a pediatric consultation with Dr. Sunita Sharma. What is the patient\'s name?\nPatient: Devendra Patel, phone is 555-234-8901.\nAI Bot: Thank you, Devendra. Dr. Sharma has an available urgent slot tomorrow morning at 10:30 AM. Would you like me to book that for you?\nPatient: Yes please, thank you so much.\nAI Bot: Done! Your appointment is confirmed with Reference APT-VOICE-8412. An SMS has been sent to your phone. Take care!',
    ai_summary: 'Child with 102F fever and cough. Scheduled urgent consultation with Dr. Sunita Sharma for tomorrow at 10:30 AM. High urgency flagged.',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString()
  },
  {
    id: 2,
    call_reference: 'CALL-90411',
    appointment_id: 'APT-VOICE-7930',
    patient_name: 'Ela Roy',
    phone: '+1 (555) 876-5432',
    email: 'ela.roy@example.com',
    symptoms: 'Severe toothache on lower molar with swelling',
    doctor_assigned: 'Dr. Manoj Kumar (Dentistry & Oral Surgery)',
    department: 'Dentistry',
    appointment_date: 'Friday, 2:00 PM',
    appointment_time: '2:00 PM',
    urgency: 'Hot',
    call_status: 'Completed & Booked',
    call_duration_seconds: 112,
    transcript: 'Patient: Hello, I have terrible throbbing tooth pain on my lower left side.\nAI Bot: Hello! Surekha Hospital AI Receptionist here. I\'m so sorry to hear about your tooth pain. Dr. Manoj Kumar specializes in dentistry and acute toothaches. Let\'s get you booked right away.\nPatient: My name is Ela Roy, 555-876-5432.\nAI Bot: Thank you, Ela. Dr. Kumar has an open slot this Friday at 2:00 PM. Shall I confirm this?\nPatient: Yes, Friday 2 PM works.\nAI Bot: Perfect. Your dental appointment is booked under Reference APT-VOICE-7930. Please arrive 10 minutes early.',
    ai_summary: 'Acute lower molar dental pain and swelling. Booked slot with Dr. Manoj Kumar for Friday at 2:00 PM.',
    created_at: new Date(Date.now() - 3600000 * 5).toISOString()
  },
  {
    id: 3,
    call_reference: 'CALL-90410',
    appointment_id: 'APT-VOICE-6521',
    patient_name: 'Mukesh Chandra',
    phone: '+1 (555) 432-1098',
    email: 'm.chandra@example.com',
    symptoms: 'Annual cardiac checkup & ECG screening',
    doctor_assigned: 'Dr. Tarun Verma (Cardiology & Heart Care)',
    department: 'Cardiology',
    appointment_date: 'Monday, 9:00 AM',
    appointment_time: '9:00 AM',
    urgency: 'Warm',
    call_status: 'Completed & Booked',
    call_duration_seconds: 85,
    transcript: 'Patient: Good afternoon, I\'d like to schedule a routine cardiology screening with Dr. Verma.\nAI Bot: Welcome to Surekha Hospital Voice Reception. I can certainly help you book a cardiology checkup with Dr. Tarun Verma. May I have your name and contact number?\nPatient: Mukesh Chandra, 555-432-1098.\nAI Bot: Thank you, Mukesh. Next Monday at 9:00 AM is available with Dr. Verma. Would that work for you?\nPatient: That sounds perfect.\nAI Bot: Your appointment has been booked. Reference ID is APT-VOICE-6521. See you Monday!',
    ai_summary: 'Routine preventative cardiac checkup with ECG scheduled with Dr. Tarun Verma on Monday at 9:00 AM.',
    created_at: new Date(Date.now() - 3600000 * 18).toISOString()
  }
];

/**
 * Initialize MySQL Database & Tables
 */
async function initDatabase() {
  if (!USE_MYSQL) {
    console.log('[MySQL] Disabled via USE_MYSQL=false. Operating in-memory.');
    return false;
  }

  try {
    const tempConn = await mysql.createConnection({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD
    });

    await tempConn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`;`);
    await tempConn.end();

    pool = mysql.createPool({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    const createLeadsTable = `
      CREATE TABLE IF NOT EXISTS leads (
        id INT AUTO_INCREMENT PRIMARY KEY,
        salesforce_lead_id VARCHAR(50) NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(50) NOT NULL,
        department VARCHAR(100),
        preferred_date VARCHAR(50),
        notes TEXT,
        transcript TEXT,
        temperature ENUM('Hot', 'Warm', 'Cold') DEFAULT 'Warm',
        status VARCHAR(50) DEFAULT 'Open - Not Contacted',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;

    const createTasksTable = `
      CREATE TABLE IF NOT EXISTS tasks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        salesforce_task_id VARCHAR(50) NULL,
        lead_id INT NULL,
        subject VARCHAR(255) NOT NULL,
        priority VARCHAR(50) DEFAULT 'Normal',
        status VARCHAR(50) DEFAULT 'Completed',
        description TEXT,
        transcript TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;

    const createExistingPatientsTable = `
      CREATE TABLE IF NOT EXISTS existing_patient_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        salesforce_task_id VARCHAR(50) NULL,
        patient_name VARCHAR(150) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        email VARCHAR(255),
        request_type VARCHAR(100),
        details TEXT,
        transcript TEXT,
        matched_existing_record TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;

    const createEmailLeadsTable = `
      CREATE TABLE IF NOT EXISTS email_leads (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sender_name VARCHAR(150),
        sender_email VARCHAR(255) NOT NULL,
        subject VARCHAR(500),
        body_preview TEXT,
        full_body LONGTEXT,
        lead_type ENUM('appointment','inquiry','complaint','feedback','other') DEFAULT 'inquiry',
        priority ENUM('high','medium','low') DEFAULT 'medium',
        extracted_phone VARCHAR(50),
        extracted_date VARCHAR(100),
        ai_summary TEXT,
        received_at DATETIME,
        processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;

    const createVoiceCallsTable = `
      CREATE TABLE IF NOT EXISTS voice_calls (
        id INT AUTO_INCREMENT PRIMARY KEY,
        call_reference VARCHAR(50) NOT NULL,
        appointment_id VARCHAR(50) NULL,
        patient_name VARCHAR(150) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        email VARCHAR(255),
        symptoms TEXT,
        doctor_assigned VARCHAR(150),
        department VARCHAR(100),
        appointment_date VARCHAR(100),
        appointment_time VARCHAR(50),
        urgency ENUM('Hot', 'Warm', 'Cold') DEFAULT 'Warm',
        call_status VARCHAR(50) DEFAULT 'Completed & Booked',
        call_duration_seconds INT DEFAULT 0,
        transcript LONGTEXT,
        ai_summary TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;

    const createSmsLogsTable = `
      CREATE TABLE IF NOT EXISTS sms_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        recipient_phone VARCHAR(50) NOT NULL,
        message_body TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'Sent',
        direction VARCHAR(20) DEFAULT 'Outgoing',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;

    await pool.query(createLeadsTable);
    await pool.query(createTasksTable);
    await pool.query(createExistingPatientsTable);
    await pool.query(createEmailLeadsTable);
    await pool.query(createVoiceCallsTable);
    await pool.query(createSmsLogsTable);

    isDbConnected = true;
    console.log(`[MySQL] Connected to database '${DB_NAME}' on ${DB_HOST}:${DB_PORT}`);
    return true;
  } catch (err) {
    isDbConnected = false;
    console.warn(`[MySQL Warning] Could not connect to MySQL (${err.message}). Running in-memory fallback.`);
    return false;
  }
}

async function saveLead(data) {
  if (isDbConnected && pool) {
    try {
      const [result] = await pool.query(
        `INSERT INTO leads (salesforce_lead_id, first_name, last_name, email, phone, department, preferred_date, notes, transcript, temperature)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.salesforceLeadId || null,
          data.firstName || '',
          data.lastName,
          data.email || '',
          data.phone,
          data.department || '',
          data.preferredDate || '',
          data.notes || '',
          data.transcript || '',
          data.temperature || 'Warm'
        ]
      );
      return result.insertId;
    } catch (err) {
      console.error('[MySQL Lead Save Error]', err.message);
    }
  }

  const record = { id: mockLeads.length + 1, ...data, created_at: new Date().toISOString() };
  mockLeads.push(record);
  return record.id;
}

async function saveTask(data) {
  if (isDbConnected && pool) {
    try {
      const [result] = await pool.query(
        `INSERT INTO tasks (salesforce_task_id, lead_id, subject, priority, status, description, transcript)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          data.salesforceTaskId || null,
          data.leadId || null,
          data.subject,
          data.priority || 'Normal',
          data.status || 'Completed',
          data.description || '',
          data.transcript || ''
        ]
      );
      return result.insertId;
    } catch (err) {
      console.error('[MySQL Task Save Error]', err.message);
    }
  }

  const record = { id: mockTasks.length + 1, ...data, created_at: new Date().toISOString() };
  mockTasks.push(record);
  return record.id;
}

async function saveExistingPatientRequest(data) {
  if (isDbConnected && pool) {
    try {
      const [result] = await pool.query(
        `INSERT INTO existing_patient_requests (salesforce_task_id, patient_name, phone, email, request_type, details, transcript, matched_existing_record)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.salesforceTaskId || null,
          data.patientName,
          data.phone,
          data.email || '',
          data.requestType || '',
          data.details || '',
          data.transcript || '',
          data.matchedExistingRecord ? 1 : 0
        ]
      );
      return result.insertId;
    } catch (err) {
      console.error('[MySQL Patient Request Save Error]', err.message);
    }
  }

  const record = { id: mockExistingPatients.length + 1, ...data, created_at: new Date().toISOString() };
  mockExistingPatients.push(record);
  return record.id;
}

async function getLeads() {
  if (isDbConnected && pool) {
    try {
      const [rows] = await pool.query(`SELECT * FROM leads ORDER BY id DESC`);
      return rows;
    } catch (err) {
      console.error('[MySQL Fetch Leads Error]', err.message);
    }
  }
  return mockLeads;
}

async function getTasks() {
  if (isDbConnected && pool) {
    try {
      const [rows] = await pool.query(`SELECT * FROM tasks ORDER BY id DESC`);
      return rows;
    } catch (err) {
      console.error('[MySQL Fetch Tasks Error]', err.message);
    }
  }
  return mockTasks;
}

async function getExistingPatientRequests() {
  if (isDbConnected && pool) {
    try {
      const [rows] = await pool.query(`SELECT * FROM existing_patient_requests ORDER BY id DESC`);
      return rows;
    } catch (err) {
      console.error('[MySQL Fetch Patient Requests Error]', err.message);
    }
  }
  return mockExistingPatients;
}

// ─── Email Leads ───────────────────────────────────────────────────────────────
async function saveEmailLead(data) {
  if (isDbConnected && pool) {
    try {
      const [result] = await pool.query(
        `INSERT INTO email_leads
         (sender_name, sender_email, subject, body_preview, full_body, lead_type, priority, extracted_phone, extracted_date, ai_summary, received_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.senderName || '',
          data.senderEmail,
          data.subject || '(no subject)',
          data.bodyPreview || '',
          data.fullBody || '',
          data.leadType || 'inquiry',
          data.priority || 'medium',
          data.extractedPhone || null,
          data.extractedDate || null,
          data.aiSummary || '',
          data.receivedAt ? new Date(data.receivedAt) : new Date()
        ]
      );
      return result.insertId;
    } catch (err) {
      console.error('[MySQL Email Lead Save Error]', err.message);
    }
  }

  const record = { id: mockEmailLeads.length + 1, ...data, processed_at: new Date().toISOString() };
  mockEmailLeads.push(record);
  return record.id;
}

async function getEmailLeads() {
  if (isDbConnected && pool) {
    try {
      const [rows] = await pool.query(`SELECT * FROM email_leads ORDER BY id DESC`);
      return rows;
    } catch (err) {
      console.error('[MySQL Fetch Email Leads Error]', err.message);
    }
  }
  return [...mockEmailLeads].reverse();
}

async function getEmailLeadById(id) {
  if (isDbConnected && pool) {
    try {
      const [rows] = await pool.query(`SELECT * FROM email_leads WHERE id = ?`, [id]);
      return rows[0] || null;
    } catch (err) {
      console.error('[MySQL Fetch Email Lead By ID Error]', err.message);
    }
  }
  return mockEmailLeads.find(e => e.id === parseInt(id)) || null;
}

// ─── Voice Calls & Automated Bookings ─────────────────────────────────────────
async function saveVoiceCall(data) {
  const callRef = data.call_reference || data.callReference || `CALL-${Math.floor(10000 + Math.random() * 90000)}`;
  const aptId = data.appointment_id || data.appointmentId || `APT-VOICE-${Math.floor(1000 + Math.random() * 9000)}`;
  const patientName = data.patient_name || data.patientName || 'Patient Caller';
  const phone = data.phone || 'N/A';
  const email = data.email || '';
  const symptoms = data.symptoms || 'General Medical Consultation';
  const doctor = data.doctor_assigned || data.doctorAssigned || 'General Consultation';
  const dept = data.department || 'General Consultation';
  const aptDate = data.appointment_date || data.appointmentDate || 'Flexible / Next Available';
  const aptTime = data.appointment_time || data.appointmentTime || '10:00 AM';
  const urgency = data.urgency || 'Warm';
  const status = data.call_status || data.callStatus || 'Completed & Booked';
  const duration = parseInt(data.call_duration_seconds || data.callDurationSeconds || 60, 10);
  const transcript = data.transcript || '';
  const aiSummary = data.ai_summary || data.aiSummary || `Voice consultation booked with ${doctor} for ${aptDate} at ${aptTime}.`;

  let insertedId = null;

  if (isDbConnected && pool) {
    try {
      const [result] = await pool.query(
        `INSERT INTO voice_calls
         (call_reference, appointment_id, patient_name, phone, email, symptoms, doctor_assigned, department, appointment_date, appointment_time, urgency, call_status, call_duration_seconds, transcript, ai_summary)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          callRef, aptId, patientName, phone, email,
          symptoms, doctor, dept, aptDate, aptTime,
          urgency, status, duration, transcript, aiSummary
        ]
      );
      insertedId = result.insertId;
    } catch (err) {
      console.error('[MySQL Voice Call Save Error]', err.message);
    }
  }

  if (!insertedId) {
    insertedId = mockVoiceCalls.length + 1;
    const record = {
      id: insertedId,
      call_reference: callRef,
      appointment_id: aptId,
      patient_name: patientName,
      phone,
      email,
      symptoms,
      doctor_assigned: doctor,
      department: dept,
      appointment_date: aptDate,
      appointment_time: aptTime,
      urgency,
      call_status: status,
      call_duration_seconds: duration,
      transcript,
      ai_summary: aiSummary,
      created_at: new Date().toISOString()
    };
    mockVoiceCalls.unshift(record);
  }

  // Unified sync: Also save into Leads & Tasks for comprehensive hospital CRM visibility
  try {
    // Send simulated SMS text message confirmation to patient
    await saveSmsLog({
      recipient_phone: phone,
      message_body: `Your appointment with ${doctor} is confirmed for ${aptDate} at ${aptTime}. Reference Code: ${aptId}. Thank you for choosing Surekha Hospital!`
    });

    const nameParts = patientName.trim().split(' ');
    const firstName = nameParts[0] || 'Patient';
    const lastName = nameParts.slice(1).join(' ') || (firstName !== 'Patient' ? '' : 'Caller');

    const leadId = await saveLead({
      firstName,
      lastName: lastName || firstName,
      phone,
      email,
      department: dept,
      preferredDate: `${aptDate} (${aptTime})`,
      notes: `[VOICE CALL BOOKING ${aptId}] Symptoms: ${symptoms} | Doctor: ${doctor}`,
      transcript: transcript || `Automated Call Reference ${callRef}`,
      temperature: urgency
    });

    await saveTask({
      leadId,
      subject: `[VOICE BOT BOOKING] ${patientName} - ${doctor}`,
      priority: urgency === 'Hot' ? 'High' : 'Normal',
      status: 'Completed',
      description: `Automated Voice Call Reference: ${callRef}\nAppointment Code: ${aptId}\nDoctor: ${doctor}\nSlot: ${aptDate} at ${aptTime}\nSymptoms: ${symptoms}\nSummary: ${aiSummary}`,
      transcript
    });
  } catch (syncErr) {
    console.warn('[Voice Call CRM Sync Notice]', syncErr.message);
  }

  return {
    id: insertedId,
    callReference: callRef,
    appointmentId: aptId,
    patientName,
    doctorAssigned: doctor,
    appointmentDate: aptDate,
    appointmentTime: aptTime,
    urgency,
    status
  };
}

async function getVoiceCalls() {
  if (isDbConnected && pool) {
    try {
      const [rows] = await pool.query(`SELECT * FROM voice_calls ORDER BY id DESC`);
      return rows;
    } catch (err) {
      console.error('[MySQL Fetch Voice Calls Error]', err.message);
    }
  }
  return mockVoiceCalls;
}

async function getVoiceCallById(id) {
  if (isDbConnected && pool) {
    try {
      const [rows] = await pool.query(`SELECT * FROM voice_calls WHERE id = ?`, [id]);
      return rows[0] || null;
    } catch (err) {
      console.error('[MySQL Fetch Voice Call By ID Error]', err.message);
    }
  }
  return mockVoiceCalls.find(c => c.id === parseInt(id, 10)) || null;
}

// ─── SMS Logs ─────────────────────────────────────────────────────────────────
async function saveSmsLog(data) {
  const recipient = data.recipient_phone || data.recipientPhone || 'N/A';
  const body = data.message_body || data.messageBody || '';
  const status = data.status || 'Sent';
  const direction = data.direction || 'Outgoing';

  let insertedId = null;

  if (isDbConnected && pool) {
    try {
      const [result] = await pool.query(
        `INSERT INTO sms_logs (recipient_phone, message_body, status, direction)
         VALUES (?, ?, ?, ?)`,
        [recipient, body, status, direction]
      );
      insertedId = result.insertId;
    } catch (err) {
      console.error('[MySQL SMS Log Save Error]', err.message);
    }
  }

  if (!insertedId) {
    insertedId = mockSmsLogs.length + 1;
    const record = {
      id: insertedId,
      recipient_phone: recipient,
      message_body: body,
      status,
      direction,
      created_at: new Date().toISOString()
    };
    mockSmsLogs.unshift(record);
  }

  return {
    id: insertedId,
    recipientPhone: recipient,
    messageBody: body,
    status,
    direction
  };
}

async function getSmsLogs() {
  if (isDbConnected && pool) {
    try {
      const [rows] = await pool.query(`SELECT * FROM sms_logs ORDER BY id DESC`);
      return rows;
    } catch (err) {
      console.error('[MySQL Fetch SMS Logs Error]', err.message);
    }
  }
  return mockSmsLogs;
}

function getDbStatus() {
  return {
    connected: isDbConnected,
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    database: DB_NAME
  };
}

module.exports = {
  initDatabase,
  saveLead,
  saveTask,
  saveExistingPatientRequest,
  getLeads,
  getTasks,
  getExistingPatientRequests,
  saveEmailLead,
  getEmailLeads,
  getEmailLeadById,
  saveVoiceCall,
  getVoiceCalls,
  getVoiceCallById,
  saveSmsLog,
  getSmsLogs,
  getDbStatus
};
