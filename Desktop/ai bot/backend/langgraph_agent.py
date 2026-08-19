"""
LangGraph AI Agent for Surekha Hospital
FastAPI server on port 8000
Provides intelligent patient engagement, appointment booking assistance, doctor availability, and hospital FAQ support.
"""

import os
import re
import time
import uuid
from typing import TypedDict, Annotated, Sequence
from dotenv import load_dotenv

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage
from langchain_core.callbacks import BaseCallbackHandler
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages

load_dotenv()

# ─────────────────────────────────────────────
# FastAPI App
# ─────────────────────────────────────────────
app = FastAPI(title="Hospital Management System AI Chatbot Agent", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
# In-memory Session Store {session_id: [messages]}
# ─────────────────────────────────────────────
sessions: dict[str, list[BaseMessage]] = {}

SYSTEM_PROMPT = """You are Aria, a friendly, warm, and highly empathetic front-desk receptionist at Hospital Management System.
Your role is to talk with patients naturally, help them schedule appointments with our resident physicians, explain services & transparent pricing, and answer clinic inquiries.

Tone & Conversation Guidelines (Talk Like a Real Human):
1. Talk warmly, kindly, and naturally, just like a caring hospital front desk staff member.
2. Use conversational transitions (e.g., "Hello! I'd be happy to help you with that.", "Oh, let's take good care of you.", "Sure thing, let me check the doctor's availability!").
3. Avoid sounding robotic, cold, or overly formal. Never say "As an AI model" or "Processing your query".
4. Multilingual Capability: If the user types in Telugu or asks in Telugu (e.g., 'నమస్కారం', 'డాక్టర్ అపాయింట్‌మెంట్', 'తెలుగు'), respond warmly and fluently in polite Telugu script (తెలుగు).

Key Hospital Information:
1. Doctors & Availability:
   - Dr. Sunita Sharma (Pediatrics & Child Health) — Mon, Wed, Fri 9:00 AM – 4:00 PM ($80)
   - Dr. Manoj Kumar (Dentistry & Oral Surgery) — Mon–Sat 10:00 AM – 6:00 PM ($250)
   - Dr. Shalini Iyer (Psychology & Mental Health) — Tue, Thu, Sat 11:00 AM – 5:00 PM ($120)
   - Dr. Tarun Verma (Cardiology & Heart Care) — Mon–Fri 8:00 AM – 3:00 PM ($190)
   - Dr. Ramesh Mehta (General Consultation & Family Medicine) — Mon–Fri 8:00 AM – 7:00 PM, Sat 9:00 AM – 4:00 PM ($50)

2. Services & Transparent Pricing:
   - General Consultation: $50
   - Pediatric Wellness Exam: $80
   - Mental Health Counseling Session: $120
   - Cardiology Screening & ECG: $190
   - Dental Care & Root Canal: $250
   - Diagnostic Lab Work & Blood Tests: $65

3. Hospital Operating Hours & Location:
   - Hours: Monday – Friday: 8:00 AM – 7:00 PM | Saturday: 9:00 AM – 4:00 PM | Sunday: Closed
   - Address: 742 Evergreen Terrace (Free patient parking in rear lot)

4. Booking & Cancellation Policy:
   - Advance booking recommended 24–48 hours prior.
   - Cancellations require 24 hours notice to avoid a $35 late cancellation fee.

5. Accepted Insurances:
   - BlueCross BlueShield, Aetna, Cigna, UnitedHealthcare, Medicare, Self-Pay.

For life-threatening medical emergencies (e.g. crushing chest pain, difficulty breathing), immediately advise the patient to call 911 or go to the nearest emergency room."""

# ─────────────────────────────────────────────
# Predefined Knowledge & Help Bot Answers
# ─────────────────────────────────────────────
PREDEFINED_KNOWLEDGE = {
  "doctors": (
    "👨‍⚕️ **Hospital Management System — Doctor Availability & Specialists**:\n\n"
    "• **Dr. Sunita Sharma** (Pediatrics & Child Health)\n"
    "  └ *Availability*: Mon, Wed, Fri (9:00 AM – 4:00 PM)\n\n"
    "• **Dr. Manoj Kumar** (Dentistry & Oral Surgery)\n"
    "  └ *Availability*: Mon – Sat (10:00 AM – 6:00 PM)\n\n"
    "• **Dr. Shalini Iyer** (Psychology & Mental Health)\n"
    "  └ *Availability*: Tue, Thu, Sat (11:00 AM – 5:00 PM)\n\n"
    "• **Dr. Tarun Verma** (Cardiology & Heart Care)\n"
    "  └ *Availability*: Mon – Fri (8:00 AM – 3:00 PM)\n\n"
    "Would you like to book an appointment with any of our specialists?"
  ),
  "booking": (
    "📅 **Appointment Booking & Cancellation Help**:\n\n"
    "• **New Patient Appointments**: You can book slots 24–48 hours in advance.\n"
    "• **Same-day Urgent Slots**: Available for acute symptoms.\n"
    "• **Cancellation Policy**: Please provide at least 24 hours notice for cancellations to avoid a **$35 late cancellation fee**.\n"
    "• **What to Bring**: Photo ID, insurance card, and any relevant medical records.\n\n"
    "Would you like me to help you submit an appointment booking request right now?"
  ),
  "pricing": (
    "🏥 **Hospital Management System — Services & Transparent Pricing**:\n\n"
    "• **General Consultation**: $50\n"
    "• **Pediatric Wellness Exam**: $80\n"
    "• **Mental Health Session**: $120\n"
    "• **Cardiology Screening**: $190\n"
    "• **Dental Care & Root Canal**: $250\n"
    "• **Diagnostic Lab Work**: $65\n\n"
    "We accept all major insurance plans (BlueCross, Aetna, Cigna, Medicare) and self-pay options."
  ),
  "hours": (
    "📍 **Hospital Management System — Location & Operating Hours**:\n\n"
    "• **Address**: 742 Evergreen Terrace (Free patient parking lot available in the rear)\n"
    "• **Monday – Friday**: 8:00 AM – 7:00 PM\n"
    "• **Saturday**: 9:00 AM – 4:00 PM\n"
    "• **Sunday**: Closed (Emergency ER referral)\n\n"
    "Emergency Care: For life-threatening emergencies, please call 911 immediately."
  ),
  "insurance": (
    "💳 **Accepted Insurance Providers**:\n\n"
    "We accept leading insurance plans:\n"
    "• BlueCross BlueShield\n"
    "• Aetna\n"
    "• Cigna\n"
    "• UnitedHealthcare\n"
    "• Medicare\n\n"
    "Self-pay options, debit cards, and all major credit cards are also accepted."
  ),
  "emergency": (
    "⚠️ **Emergency Protocol**: If you or someone around you is experiencing a medical emergency (such as severe chest pain, extreme breathing difficulty, or uncontrolled bleeding), please **call 911 or visit the nearest Emergency Room immediately**.\n\nFor non-emergency urgent appointments, our clinic is open Mon–Fri 8AM–7PM."
  )
}

def is_telugu(text: str) -> bool:
    if any('\u0C00' <= char <= '\u0C7F' for char in text):
        return True
    lower = text.lower()
    return any(w in lower for w in ['telugu', 'dhanyavadalu', 'namaskaram', 'kavali', 'ela', 'ekkadiki', 'jwaram', 'noppi', 'doctor garu', 'repu', 'eeroju', 'sare'])

def resolve_predefined_answer(user_input: str) -> str:
    text = user_input.lower().strip()
    telugu_mode = is_telugu(user_input)

    if any(k in text for k in ['emergency', 'chest pain', 'bleeding', '911', 'unconscious', 'అత్యవసర', 'గుండె నొప్పి']):
        return "⚠️ **అత్యవసర వైద్యం**: మీరు లేదా మీ కుటుంబ సభ్యులు తీవ్రమైన గుండె నొప్పి, శ్వాస తీసుకోవడంలో ఇబ్బంది ఎదుర్కొంటుంటే, దయచేసి **వెంటనే 911 కు కాల్ చేయండి లేదా సమీపంలోని ఎమర్జెన్సీ రూమ్‌కి వెళ్లండి**." if telugu_mode else PREDEFINED_KNOWLEDGE['emergency']

    if any(k in text for k in ['doctor', 'specialist', 'availability', 'schedule', 'lin', 'vance', 'ahmed', 'clark', 'pediatrician', 'dentist', 'డాక్టర్', 'సమయం', 'లభ్యత', 'వైద్యులు', 'శర్మ', 'కుమార్', 'వర్మ', 'మెహతా', 'అయ్యర్']):
        if telugu_mode:
            return ("👨‍⚕️ **సురేఖ హాస్పిటల్ — డాక్టర్లు మరియు సమయాలు**:\n\n"
                    "• **డాక్టర్ సునీత శర్మ** (పీడియాట్రిక్స్ & పిల్లల సంరక్షణ)\n"
                    "  └ *లభ్యత*: సోమ, బుధ, శుక్రవారాలు (ఉదయం 9:00 – సాయంత్రం 4:00)\n\n"
                    "• **డాక్టర్ మనోజ్ కుమార్** (దంత చికిత్స & సర్జరీ)\n"
                    "  └ *లభ్యత*: సోమ – శనివారాలు (ఉదయం 10:00 – సాయంత్రం 6:00)\n\n"
                    "• **డాక్టర్ శాలిని అయ్యర్** (సైకాలజీ & మానసిక ఆరోగ్యం)\n"
                    "  └ *లభ్యత*: మంగళ, గురు, శనివారాలు (ఉదయం 11:00 – సాయంత్రం 5:00)\n\n"
                    "• **డాక్టర్ తరుణ్ వర్మ** (కార్డియాలజీ & గుండె సంరక్షణ)\n"
                    "  └ *లభ్యత*: సోమ – శుక్రవారాలు (ఉదయం 8:00 – మధ్యాహ్నం 3:00)\n\n"
                    "• **డాక్టర్ రమేష్ మెహతా** (జనరల్ ఫిజీషియన్)\n"
                    "  └ *లభ్యత*: సోమ – శుక్రవారాలు (ఉదయం 8:00 – రాత్రి 7:00), శని (9:00 – 4:00)\n\n"
                    "మీకు ఏ డాక్టర్‌తో అపాయింట్‌మెంట్ బుక్ చేయమంటారు?")
        return PREDEFINED_KNOWLEDGE['doctors']

    if any(k in text for k in ['book', 'appointment', 'slot', 'cancel', 'reschedule', 'policy', 'late fee', 'బుకింగ్', 'అపాయింట్', 'స్లాట్', 'రద్దు']):
        if telugu_mode:
            return ("📅 **అపాయింట్‌మెంట్ బుకింగ్ వివరాలు**:\n\n"
                    "• **కొత్త అపాయింట్‌మెంట్**: 24–48 గంటల ముందు స్లాట్ బుక్ చేసుకోవచ్చు.\n"
                    "• **అత్యవసర స్లాట్లు**: తీవ్రమైన లక్షణాలు ఉన్న రోగులకు అదే రోజు లభిస్తాయి.\n"
                    "• **రద్దు విధానం**: ఫీజు లేకుండా రద్దు చేయడానికి కనీసం 24 గంటల ముందు తెలియజేయాలి.\n\n"
                    "మీరు ఇప్పుడు అపాయింట్‌మెంట్ బుక్ చేసుకోవాలనుకుంటున్నారా? మీ పేరు మరియు ఫోన్ నంబర్ తెలియజేయండి.")
        return PREDEFINED_KNOWLEDGE['booking']

    if any(k in text for k in ['price', 'cost', 'fee', 'charge', 'rate', 'how much', 'dental', 'consultation', 'lab', 'ధర', 'ఖర్చు', 'ఫీజు', 'ఎంత']):
        if telugu_mode:
            return ("🏥 **సురేఖ హాస్పిటల్ — చికిత్సలు మరియు ఫీజు వివరాలు**:\n\n"
                    "• **జనరల్ కన్సల్టేషన్**: $50\n"
                    "• **పిల్లల సంరక్షణ (పీడియాట్రిక్స్)**: $80\n"
                    "• **మానసిక కౌన్సెలింగ్**: $120\n"
                    "• **కార్డియాలజీ & ECG పరీక్షలు**: $190\n"
                    "• **దంత చికిత్స**: $250\n"
                    "• **ల్యాబ్ పరీక్షలు**: $65\n\n"
                    "మేము అన్ని ప్రముఖ ఇన్సూరెన్స్‌లను స్వీకరిస్తాము. నేను మీ కోసం స్లాట్ బుక్ చేయమంటారా?")
        return PREDEFINED_KNOWLEDGE['pricing']

    if any(k in text for k in ['hour', 'time', 'open', 'close', 'address', 'location', 'where', 'parking', 'చిరునామా', 'ఎక్కడ', 'వేళలు', 'పార్కింగ్']):
        if telugu_mode:
            return ("📍 **సురేఖ హాస్పిటల్ — చిరునామా & పని వేళలు**:\n\n"
                    "• **చిరునామా**: 742 ఎవర్‌గ్రీన్ టెర్రస్ (హాస్పిటల్ వెనుక ఉచిత పార్కింగ్ సదుపాయం ఉంది)\n"
                    "• **సోమవారం – శుక్రవారం**: ఉదయం 8:00 – రాత్రి 7:00\n"
                    "• **శనివారం**: ఉదయం 9:00 – సాయంత్రం 4:00\n"
                    "• **ఆదివారం**: సెలవు (ఎమర్జెన్సీ సేవలు మాత్రమే అందుబాటులో ఉంటాయి)\n\n"
                    "మీరు డాక్టర్‌తో అపాయింట్‌మెంట్ షెడ్యూల్ చేయాలనుకుంటున్నారా?")
        return PREDEFINED_KNOWLEDGE['hours']

    if any(k in text for k in ['insurance', 'coverage', 'bluecross', 'aetna', 'cigna', 'medicare', 'united', 'ఇన్సూరెన్స్', 'బీమా']):
        if telugu_mode:
            return ("💳 **స్వీకరించబడే ఇన్సూరెన్స్ ప్రొవైడర్లు**:\n\n"
                    "మేము బ్లూక్రాస్, ఎట్నా, సిగ్నా, యునైటెడ్ హెల్త్‌కేర్ మరియు మెడికేర్‌లను స్వీకరిస్తాము.\nక్రెడిట్ కార్డ్ మరియు నగదు చెల్లింపులు కూడా అందుబాటులో ఉన్నాయి.")
        return PREDEFINED_KNOWLEDGE['insurance']

    if telugu_mode:
        return ("నమస్కారం! హాస్పిటల్ మేనేజ్‌మెంట్ సిస్టమ్ (Hospital Management System) AI అసిస్టెంట్‌కి స్వాగతం.\n\n"
                "నేను మీకు క్రింది వివరాలలో సహాయపడగలను:\n"
                "1. 📅 **డాక్టర్ అపాయింట్‌మెంట్ బుకింగ్**\n"
                "2. 👨‍⚕️ **డాక్టర్ల లభ్యత & సమయాలు**\n"
                "3. 💰 **చికిత్సలు & ఫీజు వివరాలు**\n"
                "4. 📍 **హాస్పిటల్ చిరునామా & పని వేళలు**\n\n"
                "మీకు ఏ విధమైన సమాచారం కావాలి?")

    return ("👋 Welcome to **Hospital Management System AI Patient Help Bot**!\n\n"
            "I can help you with:\n"
            "1. 📅 **Booking & Managing Appointments**\n"
            "2. 👨‍⚕️ **Doctor Schedules & Availability**\n"
            "3. 💰 **Services & Pricing Details**\n"
            "4. 💳 **Accepted Insurance Providers**\n"
            "5. 📍 **Hospital Location & Hours**\n\n"
            "How can I help you today?")

# ─────────────────────────────────────────────
# Token Tracking Callback
# ─────────────────────────────────────────────
class TokenTracker(BaseCallbackHandler):
    def __init__(self):
        self.input_tokens = 0
        self.output_tokens = 0
        self.total_tokens = 0

    def on_llm_end(self, response, **kwargs):
        try:
            usage = response.llm_output.get("token_usage", {})
            self.input_tokens = usage.get("prompt_tokens", 0)
            self.output_tokens = usage.get("completion_tokens", 0)
            self.total_tokens = usage.get("total_tokens", 0)
        except Exception:
            for gen in getattr(response, "generations", []):
                for g in gen:
                    self.output_tokens += len(getattr(g, "text", "").split()) * 2

# ─────────────────────────────────────────────
# AI Model Selection Helper
# ─────────────────────────────────────────────
def get_llm(callbacks=None):
    gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    openai_key = os.getenv("OPENAI_API_KEY", "")

    key = gemini_key or (openai_key if (openai_key.startswith("AIza") or openai_key.startswith("AQ.")) else None)
    if key:
        for model in ["gemini-flash-latest", "gemini-2.0-flash", "gemini-2.5-flash", "gemini-1.5-flash"]:
            try:
                from langchain_google_genai import ChatGoogleGenerativeAI
                return ChatGoogleGenerativeAI(
                    model=model,
                    google_api_key=key,
                    temperature=0.7,
                    callbacks=callbacks or [],
                ), f"google-{model}"
            except Exception:
                pass

    if openai_key and not openai_key.startswith("AQ.") and not openai_key.startswith("AIza"):
        try:
            from langchain_openai import ChatOpenAI
            return ChatOpenAI(
                model="gpt-4o-mini",
                temperature=0.7,
                openai_api_key=openai_key,
                callbacks=callbacks or [],
                streaming=False,
            ), "openai-gpt-4o-mini"
        except Exception:
            pass

    return None, "predefined-help-bot"

# ─────────────────────────────────────────────
# LangGraph State
# ─────────────────────────────────────────────
class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], add_messages]
    session_id: str
    input_tokens: int
    output_tokens: int
    total_tokens: int
    latency_ms: float

# ─────────────────────────────────────────────
# Graph Nodes
# ─────────────────────────────────────────────
def process_input(state: AgentState) -> AgentState:
    messages = list(state["messages"])
    if not any(isinstance(m, SystemMessage) for m in messages):
        messages = [SystemMessage(content=SYSTEM_PROMPT)] + messages
        return {**state, "messages": messages}
    return state

def call_llm(state: AgentState) -> AgentState:
    tracker = TokenTracker()
    start = time.perf_counter()

    user_message = ""
    for m in reversed(state["messages"]):
        if isinstance(m, HumanMessage):
            user_message = str(m.content)
            break
    if not user_message and state["messages"]:
        user_message = str(state["messages"][-1].content)

    llm, model_name = get_llm(callbacks=[tracker])

    if llm is not None:
        try:
            response = llm.invoke(state["messages"])
            latency_ms = round((time.perf_counter() - start) * 1000, 1)

            response_content = response.content if hasattr(response, "content") else str(response)
            ai_msg = AIMessage(content=response_content)

            input_t = tracker.input_tokens or sum(len(str(m.content).split()) * 2 for m in state["messages"])
            output_t = tracker.output_tokens or len(str(response_content).split()) * 2

            return {
                **state,
                "messages": list(state["messages"]) + [ai_msg],
                "input_tokens": input_t,
                "output_tokens": output_t,
                "total_tokens": input_t + output_t,
                "latency_ms": latency_ms,
            }
        except Exception as err:
            print(f"[LLM Log] Using Predefined Hospital Knowledge Base for message: '{user_message}' ({err})")

    # Predefined Answer Resolution
    latency_ms = round((time.perf_counter() - start) * 1000, 1)
    predefined_text = resolve_predefined_answer(user_message)
    reply_msg = AIMessage(content=predefined_text)

    input_t = len(user_message.split()) * 2
    output_t = len(predefined_text.split()) * 2

    return {
        **state,
        "messages": list(state["messages"]) + [reply_msg],
        "input_tokens": input_t,
        "output_tokens": output_t,
        "total_tokens": input_t + output_t,
        "latency_ms": latency_ms,
    }

def log_observability(state: AgentState) -> AgentState:
    sid = state.get("session_id", "unknown")
    print(
        f"[OBS] session={sid} | "
        f"in={state['input_tokens']} out={state['output_tokens']} total={state['total_tokens']} | "
        f"latency={state['latency_ms']}ms"
    )
    return state

# ─────────────────────────────────────────────
# Build LangGraph
# ─────────────────────────────────────────────
def build_graph() -> object:
    graph = StateGraph(AgentState)
    graph.add_node("process_input", process_input)
    graph.add_node("call_llm", call_llm)
    graph.add_node("log_observability", log_observability)

    graph.set_entry_point("process_input")
    graph.add_edge("process_input", "call_llm")
    graph.add_edge("call_llm", "log_observability")
    graph.add_edge("log_observability", END)

    return graph.compile()

compiled_graph = build_graph()

# ─────────────────────────────────────────────
# API Models & Endpoints
# ─────────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str
    session_id: str = ""

class ChatResponse(BaseModel):
    response: str
    session_id: str
    input_tokens: int
    output_tokens: int
    total_tokens: int
    latency_ms: float
    turn_number: int

@app.get("/health")
def health():
    return {"status": "healthy", "service": "surekha-hospital-ai-agent"}

@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    session_id = req.session_id or str(uuid.uuid4())
    if session_id not in sessions:
        sessions[session_id] = []

    sessions[session_id].append(HumanMessage(content=req.message))

    initial_state: AgentState = {
        "messages": sessions[session_id].copy(),
        "session_id": session_id,
        "input_tokens": 0,
        "output_tokens": 0,
        "total_tokens": 0,
        "latency_ms": 0.0,
    }

    try:
        result = compiled_graph.invoke(initial_state)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent Error: {str(e)}")

    ai_message = result["messages"][-1]
    response_text = ai_message.content if hasattr(ai_message, "content") else str(ai_message)

    sessions[session_id].append(AIMessage(content=response_text))
    turn_number = len([m for m in sessions[session_id] if isinstance(m, HumanMessage)])

    return ChatResponse(
        response=response_text,
        session_id=session_id,
        input_tokens=result["input_tokens"],
        output_tokens=result["output_tokens"],
        total_tokens=result["total_tokens"],
        latency_ms=result["latency_ms"],
        turn_number=turn_number,
    )

@app.delete("/chat/{session_id}")
def clear_session(session_id: str):
    if session_id in sessions:
        del sessions[session_id]
        return {"message": f"Session {session_id} cleared."}
    return {"message": "Session not found."}

@app.get("/sessions")
def list_sessions():
    return {
        "active_sessions": len(sessions),
        "session_ids": list(sessions.keys()),
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PYTHON_AGENT_PORT", 8000))
    print(f"╔══════════════════════════════════════════╗")
    print(f"║  Surekha Hospital AI Patient Help Bot    ║")
    print(f"║  Listening on http://0.0.0.0:{port}       ║")
    print(f"╚══════════════════════════════════════════╝")
    uvicorn.run("langgraph_agent:app", host="0.0.0.0", port=port, reload=False)
