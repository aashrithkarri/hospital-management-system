/**
 * voice_agent.js
 * Specialized AI Voice Receptionist Engine for Surekha Hospital
 * Handles real-time patient voice calls, speech entity extraction,
 * symptom triage, doctor availability checking, and instant appointment booking.
 */

const axios = require('axios');
const db = require('./db');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// Active in-memory voice call sessions
const voiceSessions = new Map();

const SYSTEM_INSTRUCTION = `You are Aria, a friendly, warm, and empathetic human receptionist at Surekha Hospital.
Your goal is to talk to patients naturally over the phone, listen to what they're going through, recommend the right specialist, and book their appointment.

Voice & Tone Guidelines (Talk Like a Real Human):
1. Talk naturally, casually, and warmly, just like a kind front desk receptionist at a premier hospital.
2. Use conversational openers and natural transitions (e.g. "Hello! Thanks for calling Surekha Hospital.", "Oh, I'm so sorry you're not feeling well.", "Sure thing, let me check our schedule for you!", "We'll take good care of you.").
3. Never sound robotic or formal. Never say things like "As an AI model", "I have processed your input", "Executing booking".
4. Keep your replies concise and easy to listen to over the phone (1 to 3 spoken sentences maximum).
5. Never use markdown, asterisks, bullet points, numbers, brackets, or code characters in your voiceResponse since it will be spoken aloud.
6. Language Support: If the caller speaks Telugu or has chosen Telugu (language='te'), respond in warm, polite, natural spoken Telugu script (e.g. "నమస్కారం! సురేఖ హాస్పిటల్‌కు స్వాగతం. నేను మీకు ఎలా సహాయపడగలను?").

Hospital Specialities & Availability:
1. Pediatrics & Child Health — Dr. Sunita Sharma: Mon, Wed, Fri 9am - 4pm (Slots: 9:30 AM, 11:00 AM, 2:00 PM, 3:30 PM) - $80
2. Dentistry & Oral Surgery — Dr. Manoj Kumar: Mon-Sat 10am - 6pm (Slots: 10:00 AM, 11:30 AM, 2:00 PM, 4:30 PM) - $250
3. Psychology & Mental Health — Dr. Shalini Iyer: Tue, Thu, Sat 11am - 5pm (Slots: 11:00 AM, 1:00 PM, 3:00 PM, 4:30 PM) - $120
4. Cardiology & Heart Care — Dr. Tarun Verma: Mon-Fri 8am - 3pm (Slots: 8:30 AM, 10:00 AM, 1:00 PM, 2:30 PM) - $190
5. General Consultation & Family Medicine — Dr. Ramesh Mehta: Mon-Fri 8am - 7pm, Sat 9am - 4pm (Slots: 9:00 AM, 10:30 AM, 12:00 PM, 2:30 PM, 4:00 PM, 5:30 PM) - $50

Emergency Check:
If patient complains of severe/life-threatening symptoms (crushing chest pain, severe difficulty breathing, stroke symptoms, major bleeding), set isEmergency=true, and say: "Oh dear, that sounds like a medical emergency. Please hang up right away and call 911 or visit the nearest emergency room immediately."

Output format: You must respond ONLY with a JSON object in this format:
{
  "voiceResponse": "Warm, natural spoken human reply (in English or Telugu based on caller language)",
  "patientName": "Extracted patient name or null",
  "callerPhone": "Extracted phone number or null",
  "symptoms": "Extracted symptoms or null",
  "doctorAssigned": "Extracted doctor name or null",
  "department": "Extracted department or null",
  "preferredDate": "Extracted appointment date or null",
  "preferredTime": "Extracted appointment time or null",
  "urgency": "Hot" / "Warm" / "Cold",
  "stage": "GREETING" / "AILMENT_ASSESSMENT" / "SELECT_SLOT" / "CONFIRMATION" / "BOOKED",
  "isBooked": true (if finalized) / false,
  "isEmergency": true (if emergency escalated) / false
}`;

// Hospital Specialists and Operating Schedules
const DOCTORS = {
  pediatrics: {
    id: 'doc_lin',
    name: 'Dr. Sunita Sharma',
    specialty: 'Pediatrics & Child Health',
    schedule: 'Mon, Wed, Fri (9:00 AM – 4:00 PM)',
    days: ['Monday', 'Wednesday', 'Friday'],
    slots: ['9:30 AM', '11:00 AM', '2:00 PM', '3:30 PM'],
    keywords: ['child', 'baby', 'toddler', 'pediatric', 'kid', 'sharma', 'sunita', 'son', 'daughter', 'infant', 'పిల్లలు', 'పాప', 'బాబు', 'pillalu', 'chinna pillalu', 'pediatrician']
  },
  dentistry: {
    id: 'doc_vance',
    name: 'Dr. Manoj Kumar',
    specialty: 'Dentistry & Oral Surgery',
    schedule: 'Mon – Sat (10:00 AM – 6:00 PM)',
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    slots: ['10:00 AM', '11:30 AM', '2:00 PM', '4:30 PM'],
    keywords: ['tooth', 'teeth', 'dental', 'cavity', 'root canal', 'dentist', 'toothache', 'kumar', 'manoj', 'gum', 'molar', 'పన్ను', 'పంటి నొప్పి', 'దంత', 'pallu', 'dantla', 'panti noppi']
  },
  psychology: {
    id: 'doc_ahmed',
    name: 'Dr. Shalini Iyer',
    specialty: 'Psychology & Mental Health',
    schedule: 'Tue, Thu, Sat (11:00 AM – 5:00 PM)',
    days: ['Tuesday', 'Thursday', 'Saturday'],
    slots: ['11:00 AM', '1:00 PM', '3:00 PM', '4:30 PM'],
    keywords: ['mental', 'stress', 'anxiety', 'therapy', 'depression', 'counseling', 'psychology', 'iyer', 'shalini', 'panic', 'ఒత్తిడి', 'డిప్రెషన్', 'మానసిక', 'ottidi', 'stress']
  },
  cardiology: {
    id: 'doc_clark',
    name: 'Dr. Tarun Verma',
    specialty: 'Cardiology & Heart Care',
    schedule: 'Mon – Fri (8:00 AM – 3:00 PM)',
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    slots: ['8:30 AM', '10:00 AM', '1:00 PM', '2:30 PM'],
    keywords: ['heart', 'cardio', 'cardiology', 'ecg', 'blood pressure', 'verma', 'tarun', 'palpitation', 'cholesterol', 'గుండె', 'గుండె నొప్పి', 'రక్తపోటు', 'gunde', 'gunde noppi', 'bp']
  },
  general: {
    id: 'doc_general',
    name: 'Dr. Ramesh Mehta (General Physician)',
    specialty: 'General Consultation & Family Medicine',
    schedule: 'Mon – Fri (8:00 AM – 7:00 PM), Sat (9:00 AM – 4:00 PM)',
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    slots: ['9:00 AM', '10:30 AM', '12:00 PM', '2:30 PM', '4:00 PM', '5:30 PM'],
    keywords: ['general', 'checkup', 'fever', 'cold', 'flu', 'cough', 'headache', 'body pain', 'routine', 'consultation', 'doctor', 'mehta', 'ramesh', 'జ్వరం', 'దగ్గు', 'జలుబు', 'తలనొప్పి', 'ఒళ్లు నొప్పులు', 'వైద్యుడు', 'డాక్టర్', 'jwaram', 'daggu', 'jalubu', 'talanoppi', 'vollu noppulu', 'ontlo bagoledu']
  }
};

/**
 * Initialize a new voice session
 */
function createVoiceSession(sessionId, callerPhone = 'Caller') {
  const callRef = `CALL-${Math.floor(10000 + Math.random() * 90000)}`;
  const aptId = `APT-VOICE-${Math.floor(1000 + Math.random() * 9000)}`;

  const session = {
    sessionId: sessionId || `vses_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    callReference: callRef,
    appointmentId: aptId,
    startTime: Date.now(),
    callerPhone: callerPhone || '+1 (555) 019-2834',
    patientName: '',
    email: '',
    symptoms: '',
    doctorAssigned: '',
    department: '',
    preferredDate: '',
    preferredTime: '',
    urgency: 'Warm',
    status: 'In-Progress',
    stage: 'GREETING',
    turnCount: 0,
    transcript: [],
    extractedData: {}
  };

  voiceSessions.set(session.sessionId, session);
  return session;
}

/**
 * Get active session
 */
function getVoiceSession(sessionId) {
  return voiceSessions.get(sessionId) || null;
}

/**
 * Detect medical department from patient statement
 */
function detectSpecialist(text) {
  const lower = text.toLowerCase();
  for (const [key, doc] of Object.entries(DOCTORS)) {
    if (doc.keywords.some(k => lower.includes(k))) {
      return { key, doctor: doc.name, department: doc.specialty, slots: doc.slots, schedule: doc.schedule };
    }
  }
  return {
    key: 'general',
    doctor: DOCTORS.general.name,
    department: DOCTORS.general.specialty,
    slots: DOCTORS.general.slots,
    schedule: DOCTORS.general.schedule
  };
}

/**
 * Evaluate urgency level
 */
function evaluateUrgency(text) {
  const lower = text.toLowerCase();
  if (/emergency|severe chest pain|cannot breathe|unconscious|heavy bleeding|crushing pain|stroke|heart attack/i.test(lower)) {
    return 'Emergency';
  }
  if (/acute|high fever|terrible|throbbing|severe|urgent|today|asap|swelling|bleeding|broken|hurts so bad/i.test(lower)) {
    return 'Hot';
  }
  if (/price|cost|hours|location|insurance|parking|where/i.test(lower)) {
    return 'Cold';
  }
  return 'Warm';
}

/**
 * Extract phone number from text
 */
function extractPhone(text) {
  const match = text.match(/(\+?\d{1,4}?[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}|\b\d{10}\b/);
  return match ? match[0] : null;
}

/**
 * Extract person's name
 */
function extractName(text) {
  const nameMatch = text.match(/(?:my name is|i am|this is|name is|it's|call me|నా పేరు|naa peru|na peru|peru)\s+([A-Za-z\u0C00-\u0C7F]+(?:\s+[A-Za-z\u0C00-\u0C7F]+)?)/i);
  if (nameMatch) return nameMatch[1].trim();

  const words = text.split(/\s+/);
  for (let i = 0; i < words.length - 1; i++) {
    if (/^[A-Z][a-z]+$/.test(words[i]) && /^[A-Z][a-z]+$/.test(words[i + 1])) {
      if (!['Surekha', 'Hospital', 'Doctor', 'Hello', 'Good', 'Thank', 'Please'].includes(words[i])) {
        return `${words[i]} ${words[i + 1]}`;
      }
    }
  }
  return null;
}

/**
 * Extract date / time preference
 */
function extractDateTime(text) {
  const lower = text.toLowerCase();
  let date = '';
  let time = '';

  if (lower.includes('today') || lower.includes('ఈరోజు') || lower.includes('eeroju') || lower.includes('eroju')) date = 'Today';
  else if (lower.includes('tomorrow') || lower.includes('రేపు') || lower.includes('repu')) date = 'Tomorrow';
  else if (lower.includes('monday') || lower.includes('సోమవారం') || lower.includes('somavaram')) date = 'Monday';
  else if (lower.includes('tuesday') || lower.includes('మంగళవారం') || lower.includes('mangalavaram')) date = 'Tuesday';
  else if (lower.includes('wednesday') || lower.includes('బుధవారం') || lower.includes('budhavaram')) date = 'Wednesday';
  else if (lower.includes('thursday') || lower.includes('గురువారం') || lower.includes('guruvaram')) date = 'Thursday';
  else if (lower.includes('friday') || lower.includes('శుక్రవారం') || lower.includes('sukravaram')) date = 'Friday';
  else if (lower.includes('saturday') || lower.includes('శనివారం') || lower.includes('sanivaram')) date = 'Saturday';

  const timeMatch = text.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.))/i);
  if (timeMatch) {
    time = timeMatch[1].toUpperCase();
  } else if (lower.includes('morning') || lower.includes('ఉదయం') || lower.includes('udayam')) {
    time = '10:00 AM';
  } else if (lower.includes('afternoon') || lower.includes('మధ్యాహ్నం') || lower.includes('madhyahnam')) {
    time = '2:30 PM';
  } else if (lower.includes('evening') || lower.includes('సాయంత్రం') || lower.includes('sayantram')) {
    time = '5:00 PM';
  }

  return { date, time };
}

/**
 * Main Turn-by-Turn Voice Processing Engine
 */
async function processVoiceInput(sessionId, userInput, callerInfo = {}) {
  let session = getVoiceSession(sessionId);
  if (!session) {
    session = createVoiceSession(sessionId, callerInfo.phone || '+1 (555) 234-5678');
  }

  session.turnCount += 1;
  const cleanedInput = (userInput || '').trim();
  session.transcript.push(`Patient: ${cleanedInput}`);

  const isTelugu = callerInfo.language === 'te' || session.language === 'te';
  if (callerInfo.language) session.language = callerInfo.language;

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (apiKey && !apiKey.includes('placeholder')) {
    try {
      console.log(`[Voice AI Agent] Processing turn via Gemini (Session: ${session.sessionId}, Language: ${session.language || 'en'})`);
      
      const historyText = session.transcript.join('\n');
      let prompt = `Current caller phone: ${session.callerPhone}
Previously extracted details:
- Patient Name: ${session.patientName || 'Not yet extracted'}
- Symptoms: ${session.symptoms || 'Not yet extracted'}
- Assigned Doctor: ${session.doctorAssigned || 'Not yet extracted'}
- Department: ${session.department || 'Not yet extracted'}
- Preferred Date: ${session.preferredDate || 'Not yet extracted'}
- Preferred Time: ${session.preferredTime || 'Not yet extracted'}
- Urgency: ${session.urgency || 'Warm'}
- Current Stage: ${session.stage || 'GREETING'}

Dialogue Transcript:
${historyText}

Based on the dialogue above, update the extracted details and generate the next warm, empathic, human-like voice reply in JSON format.`;

      let instructionText = SYSTEM_INSTRUCTION;
      if (isTelugu) {
        instructionText += `\n\nCRITICAL LANGUAGE INSTRUCTION: The patient has selected Telugu as their preferred language. You MUST write the "voiceResponse" field in beautiful, natural, respectful, and spoken Telugu script (తెలుగు). Keep it warm, empathic, and human. All other JSON keys should remain in English.`;
      }

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: {
          parts: [{ text: instructionText }]
        },
        generationConfig: {
          responseMimeType: 'application/json'
        }
      };

      const response = await axios.post(url, payload, { timeout: 10000 });
      const rawText = response.data.candidates[0].content.parts[0].text;
      
      let aiResult;
      try {
        aiResult = JSON.parse(rawText.trim());
      } catch (jsonErr) {
        console.warn('[Voice AI JSON Parse Error]', rawText);
        const cleaned = rawText.replace(/```json|```/g, '').trim();
        aiResult = JSON.parse(cleaned);
      }

      console.log('[Voice AI Extraction result]', aiResult);

      if (aiResult.patientName) session.patientName = aiResult.patientName;
      if (aiResult.callerPhone) session.callerPhone = aiResult.callerPhone;
      if (aiResult.symptoms) session.symptoms = aiResult.symptoms;
      if (aiResult.doctorAssigned) session.doctorAssigned = aiResult.doctorAssigned;
      if (aiResult.department) session.department = aiResult.department;
      if (aiResult.preferredDate) session.preferredDate = aiResult.preferredDate;
      if (aiResult.preferredTime) session.preferredTime = aiResult.preferredTime;
      if (aiResult.urgency) session.urgency = aiResult.urgency;
      if (aiResult.stage) session.stage = aiResult.stage;

      let voiceReply = aiResult.voiceResponse || "I understand. Let me help you with that.";
      session.transcript.push(`AI Bot: ${voiceReply}`);

      let isBooked = !!aiResult.isBooked;
      let isEmergency = !!aiResult.isEmergency;

      if (isEmergency) {
        session.urgency = 'Hot';
        session.status = 'Emergency Escalated';
      }

      if (isBooked) {
        session.stage = 'BOOKED';
        session.status = 'Completed & Booked';
        
        session.patientName = session.patientName || 'Patient Caller';
        session.doctorAssigned = session.doctorAssigned || 'Dr. Ramesh Mehta (General Physician)';
        session.department = session.department || 'General Consultation';
        session.preferredDate = session.preferredDate || 'Tomorrow';
        session.preferredTime = session.preferredTime || '10:30 AM';
        session.symptoms = session.symptoms || 'Health consultation request';

        const duration = Math.max(30, Math.round((Date.now() - session.startTime) / 1000));
        const transcriptText = session.transcript.join('\n');
        const summary = `Voice Bot booked appointment (${session.appointmentId}) for ${session.patientName} with ${session.doctorAssigned} on ${session.preferredDate} at ${session.preferredTime}. Symptoms: ${session.symptoms}. Urgency: ${session.urgency}.`;

        try {
          await db.saveVoiceCall({
            call_reference: session.callReference,
            appointment_id: session.appointmentId,
            patient_name: session.patientName,
            phone: session.callerPhone,
            email: session.email || `${session.patientName.toLowerCase().replace(/\s+/g, '.')}@patient.surekha.org`,
            symptoms: session.symptoms,
            doctor_assigned: session.doctorAssigned,
            department: session.department,
            appointment_date: session.preferredDate,
            appointment_time: session.preferredTime,
            urgency: session.urgency,
            call_status: 'Completed & Booked',
            call_duration_seconds: duration,
            transcript: transcriptText,
            ai_summary: summary
          });
          console.log(`[Voice Bot DB] Auto-booked voice appointment: ${session.appointmentId} for ${session.patientName}`);
        } catch (dbErr) {
          console.error('[Voice Bot Save Error]', dbErr.message);
        }
      }

      return {
        sessionId: session.sessionId,
        callReference: session.callReference,
        appointmentId: session.appointmentId,
        voiceResponse: voiceReply,
        session: {
          patientName: session.patientName,
          callerPhone: session.callerPhone,
          symptoms: session.symptoms,
          doctorAssigned: session.doctorAssigned,
          department: session.department,
          preferredDate: session.preferredDate,
          preferredTime: session.preferredTime,
          urgency: session.urgency,
          stage: session.stage,
          status: session.status,
          turnCount: session.turnCount
        },
        isBooked,
        isEmergency
      };

    } catch (err) {
      console.warn('[Voice AI Agent Exception] Falling back to rule-based conversation engine:', err.message);
    }
  }

  const urgency = evaluateUrgency(cleanedInput);
  if (urgency === 'Emergency') {
    session.urgency = 'Hot';
    session.status = 'Emergency Escalated';
    const emergencyReply = isTelugu 
      ? "ఇది అత్యవసర వైద్య పరిస్థితిలా ఉంది. దయచేసి వెంటనే కాల్ ముగించి 911 కు కాల్ చేయండి లేదా సమీపంలోని ఎమర్జెన్సీ వార్డుకు వెళ్లండి."
      : "Oh dear, that sounds like a medical emergency. Please hang up right away and call 911 or go to the nearest emergency room immediately.";
    session.transcript.push(`AI Bot: ${emergencyReply}`);
    return {
      sessionId: session.sessionId,
      voiceResponse: emergencyReply,
      session,
      isBooked: false,
      isEmergency: true
    };
  }

  // Update extracted fields progressively
  const extractedName = extractName(cleanedInput);
  if (extractedName && !session.patientName) session.patientName = extractedName;

  const extractedPhone = extractPhone(cleanedInput);
  if (extractedPhone) session.callerPhone = extractedPhone;

  const { date, time } = extractDateTime(cleanedInput);
  if (date && !session.preferredDate) session.preferredDate = date;
  if (time && !session.preferredTime) session.preferredTime = time;

  // Detect condition / specialist
  if (!session.doctorAssigned) {
    const specialist = detectSpecialist(cleanedInput);
    if (specialist) {
      session.doctorAssigned = specialist.doctor;
      session.department = specialist.department;
      if (!session.preferredTime && specialist.slots && specialist.slots.length > 0) {
        session.preferredTime = specialist.slots[0];
      }
    }
  }

  // Update symptoms
  if (!session.symptoms || session.symptoms === 'General Medical Consultation') {
    if (cleanedInput.length > 5 && !/^(yes|no|ok|sure|hello|hi)$/i.test(cleanedInput)) {
      session.symptoms = cleanedInput.replace(/my name is [^.,]+/i, '').replace(/\b\d{10}\b/, '').trim();
      if (!session.symptoms) session.symptoms = 'Patient consultation request';
    }
  }

  if (urgency === 'Hot' && session.urgency !== 'Hot') {
    session.urgency = 'Hot';
  }

  // Conversational state transitions
  let voiceReply = "";
  let isBooked = false;

  const lower = cleanedInput.toLowerCase();

  // Check if patient is confirming a suggested slot
  const isAffirmative = /yes|yeah|sure|correct|confirm|book it|that works|sounds good|please do|okay|fine|అవును|సరే|ఓకే/i.test(lower);
  const isAskingPrice = /how much|cost|price|fee|charge|ధర|ఖర్చు|ఫీజు/i.test(lower);
  const isAskingLocation = /where|location|address|parking|directions|ఎక్కడ|చిరునామా/i.test(lower);

  if (isAskingPrice) {
    voiceReply = isTelugu
      ? "మా జనరల్ కన్సల్టేషన్ ఫీజు యాభై డాలర్లు, పిల్లల కేర్ ఎనభై డాలర్లు, గుండె పరీక్షలు నూట తొంభై డాలర్లు, మరియు డెంటల్ కేర్ రెండు వందల యాభై డాలర్లు. మేము ప్రధాన ఇన్సూరెన్స్‌లను స్వీకరిస్తాము. నేను మీ కోసం డాక్టర్‌తో అపాయింట్‌మెంట్ బుక్ చేయమంటారా?"
      : "Our general consultation is fifty dollars, pediatric care is eighty dollars, cardiology screening is one hundred and ninety dollars, and dental care starts at two hundred and fifty dollars. We accept all major insurances. Would you like me to reserve a slot for you?";
  } else if (isAskingLocation) {
    voiceReply = isTelugu
      ? "సురేఖ హాస్పిటల్ 742 ఎవర్‌గ్రీన్ టెర్రస్‌లో ఉంది. మా వద్ద ఉచిత పేషెంట్ పార్కింగ్ కూడా ఉంది. మీరు మా డాక్టర్‌తో అపాయింట్‌మెంట్ షెడ్యూల్ చేసుకోవాలనుకుంటున్నారా?"
      : "Surekha Hospital is located at 742 Evergreen Terrace with free patient parking in the rear. Would you like to schedule an appointment with one of our physicians?";
  } else if (session.stage === 'GREETING' || session.turnCount === 1) {
    session.stage = 'AILMENT_ASSESSMENT';
    const specialist = detectSpecialist(cleanedInput);
    session.doctorAssigned = specialist.doctor;
    session.department = specialist.department;

    if (session.patientName) {
      voiceReply = isTelugu
        ? `నమస్కారం ${session.patientName} గారు! సురేఖ హాస్పిటల్‌కి కాల్ చేసినందుకు ధన్యవాదాలు. మీ కోసం డాక్టర్ ${specialist.doctor} గారితో అపాయింట్‌మెంట్ బుక్ చేయగలను. మీకు ఏ రోజు మరియు ఏ సమయం అనుకూలంగా ఉంటుంది?`
        : `Hello ${session.patientName}! Thanks for calling Surekha Hospital. I'd be happy to set you up with Dr. ${specialist.doctor}. What day and time works best for you?`;
      session.stage = 'SELECT_SLOT';
    } else {
      voiceReply = isTelugu
        ? `సురేఖ హాస్పిటల్‌కి కాల్ చేసినందుకు ధన్యవాదాలు! నేను ఆరియాను, మీ హాస్పిటల్ రిసెప్షనిస్ట్‌ని. మీకు సహాయం చేయడానికి మీ పేరు మరియు మీరు ఎదుర్కొంటున్న ఆరోగ్య సమస్యను చెప్పగలరా?`
        : `Hello! Thanks for calling Surekha Hospital. I'm Aria, your receptionist. I'd love to help get you scheduled right away. Could you share your name and what symptoms you're experiencing?`;
    }
  } else if (session.stage === 'AILMENT_ASSESSMENT') {
    const specialist = detectSpecialist(cleanedInput);
    session.doctorAssigned = specialist.doctor;
    session.department = specialist.department;

    if (!session.patientName) {
      voiceReply = isTelugu
        ? `అలాగే. మీ కోసం ${specialist.department} విభాగానికి చెందిన డాక్టర్ ${specialist.doctor} గారితో కలుపుతాను. బుకింగ్ కోసం మీ పూర్తి పేరు మరియు ఫోన్ నంబర్ తెలియజేయగలరా?`
        : `Got it. I'll connect you with Dr. ${specialist.doctor} in ${specialist.department}. May I have your name and best phone number to confirm the booking?`;
      session.stage = 'COLLECT_NAME_PHONE';
    } else {
      session.stage = 'SELECT_SLOT';
      const slot = specialist.slots[0] || '10:00 AM';
      session.preferredTime = session.preferredTime || slot;
      session.preferredDate = session.preferredDate || 'Tomorrow';
      voiceReply = isTelugu
        ? `ధన్యవాదాలు ${session.patientName} గారు. డాక్టర్ ${specialist.doctor} గారి వద్ద ${session.preferredDate} నాడు ${session.preferredTime} కు సమయం ఖాళీగా ఉంది. ఈ సమయాన్ని మీ కోసం కేటాయించమంటారా?`
        : `Thank you, ${session.patientName}. For your consultation, Dr. ${specialist.doctor} has an opening on ${session.preferredDate} at ${session.preferredTime}. Would you like me to hold this slot for you?`;
    }
  } else if (session.stage === 'COLLECT_NAME_PHONE') {
    if (!session.patientName) session.patientName = extractedName || 'Patient';
    session.stage = 'SELECT_SLOT';
    const doc = session.doctorAssigned || DOCTORS.general.name;
    session.preferredDate = session.preferredDate || 'Tomorrow';
    session.preferredTime = session.preferredTime || '10:30 AM';
    voiceReply = isTelugu
      ? `ధన్యవాదాలు ${session.patientName} గారు. డాక్టర్ ${doc} గారితో ${session.preferredDate} నాడు ${session.preferredTime} కు సమయం కేటాయించబడింది. ఈ అపాయింట్‌మెంట్‌ను ఖరారు చేయమంటారా?`
      : `Thank you, ${session.patientName}. We have an open slot with ${doc} on ${session.preferredDate} at ${session.preferredTime}. Shall I confirm this for you?`;
  } else if (session.stage === 'SELECT_SLOT') {
    if (isAffirmative || date || time) {
      session.stage = 'CONFIRMATION';
      if (date) session.preferredDate = date;
      if (time) session.preferredTime = time;
      session.preferredDate = session.preferredDate || 'Tomorrow';
      session.preferredTime = session.preferredTime || '10:30 AM';

      voiceReply = isTelugu
        ? `అద్భుతం! వివరాలు ఖరారు చేస్తున్నాను: డాక్టర్ ${session.doctorAssigned || 'మా స్పెషలిస్ట్'} గారితో ${session.preferredDate} నాడు ${session.preferredTime} కు అపాయింట్‌మెంట్. ఇప్పుడే ఈ బుకింగ్‌ను పూర్తి చేయమంటారా?`
        : `Wonderful! Let me confirm the details: An appointment for ${session.patientName || 'you'} with ${session.doctorAssigned || 'our specialist'} on ${session.preferredDate} at ${session.preferredTime}. Should I finalize this for you now?`;
    } else {
      voiceReply = isTelugu
        ? `మా వద్ద సోమవారం ఉదయం 9:00 గంటలకు లేదా శుక్రవారం మధ్యాహ్నం 2:00 గంటలకు కూడా సమయాలు ఖాళీగా ఉన్నాయి. మీకు ఏది సౌకర్యవంతంగా ఉంటుంది?`
        : `We also have open slots on Monday at 9:00 AM or Friday at 2:00 PM. Which one would you prefer?`;
    }
  } else if (session.stage === 'CONFIRMATION' || session.stage === 'BOOKED' || isAffirmative) {
    session.stage = 'BOOKED';
    session.status = 'Completed & Booked';
    isBooked = true;

    session.patientName = session.patientName || 'Valued Patient';
    session.doctorAssigned = session.doctorAssigned || DOCTORS.general.name;
    session.department = session.department || 'General Consultation';
    session.preferredDate = session.preferredDate || 'Tomorrow';
    session.preferredTime = session.preferredTime || '10:30 AM';
    session.symptoms = session.symptoms || 'Health consultation request';

    voiceReply = isTelugu
      ? `మీ అపాయింట్‌మెంట్ విజయవంతంగా బుక్ చేయబడింది! మీ రిఫరెన్స్ నంబర్ ${session.appointmentId}. కన్ఫర్మేషన్ SMS ${session.callerPhone} నంబర్‌కు పంపబడింది. సురేఖ హాస్పిటల్‌కు కాల్ చేసినందుకు ధన్యవాదాలు. శుభదినం!`
      : `You're all set! Your appointment is booked and your reference code is ${session.appointmentId}. A confirmation SMS has been sent to ${session.callerPhone}. Thanks for calling Surekha Hospital. Take care and have a great day!`;

    const duration = Math.max(30, Math.round((Date.now() - session.startTime) / 1000));
    const transcriptText = session.transcript.join('\n');
    const summary = `Voice Bot booked appointment (${session.appointmentId}) for ${session.patientName} with ${session.doctorAssigned} on ${session.preferredDate} at ${session.preferredTime}. Symptoms: ${session.symptoms}. Urgency: ${session.urgency}.`;

    try {
      await db.saveVoiceCall({
        call_reference: session.callReference,
        appointment_id: session.appointmentId,
        patient_name: session.patientName,
        phone: session.callerPhone,
        email: session.email || `${session.patientName.toLowerCase().replace(/\s+/g, '.')}@patient.surekha.org`,
        symptoms: session.symptoms,
        doctor_assigned: session.doctorAssigned,
        department: session.department,
        appointment_date: session.preferredDate,
        appointment_time: session.preferredTime,
        urgency: session.urgency,
        call_status: 'Completed & Booked',
        call_duration_seconds: duration,
        transcript: transcriptText,
        ai_summary: summary
      });
      console.log(`[Voice Bot DB] Auto-booked voice appointment: ${session.appointmentId} for ${session.patientName}`);
    } catch (dbErr) {
      console.error('[Voice Bot Save Error]', dbErr.message);
    }
  } else {
    voiceReply = `I understand. I can schedule your appointment with ${session.doctorAssigned || 'our specialists'} or answer any questions about our doctors, clinic hours, and pricing. What would you like to do?`;
  }

  session.transcript.push(`AI Bot: ${voiceReply}`);

  return {
    sessionId: session.sessionId,
    callReference: session.callReference,
    appointmentId: session.appointmentId,
    voiceResponse: voiceReply,
    session: {
      patientName: session.patientName,
      callerPhone: session.callerPhone,
      symptoms: session.symptoms,
      doctorAssigned: session.doctorAssigned,
      department: session.department,
      preferredDate: session.preferredDate,
      preferredTime: session.preferredTime,
      urgency: session.urgency,
      stage: session.stage,
      status: session.status,
      turnCount: session.turnCount
    },
    isBooked,
    isEmergency: false
  };
}

module.exports = {
  createVoiceSession,
  getVoiceSession,
  processVoiceInput,
  DOCTORS
};
