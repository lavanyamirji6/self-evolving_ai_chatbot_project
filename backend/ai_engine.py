"""
AI Engine — Self-Evolving AI
"""
import operator, re, time, queue, threading
from typing import Annotated, TypedDict, List, Optional, Generator
from dotenv import load_dotenv
load_dotenv()

from langchain_core.callbacks import BaseCallbackHandler
from langchain_community.tools import WikipediaQueryRun
from langchain_community.utilities import WikipediaAPIWrapper
from langchain_core.messages import SystemMessage, HumanMessage, BaseMessage
from langchain_ollama import ChatOllama
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from rag_memory import get_rag

LANGUAGE_NAMES = {
    "en": "English", "es": "Spanish", "fr": "French", "de": "German",
    "zh": "Chinese", "ar": "Arabic",  "hi": "Hindi",   "ta": "Tamil",
}

TOPIC_KEYWORDS = {
    "math":    ["calculate","math","equation","number","sum","multiply","divide","algebra"],
    "code":    ["code","program","function","python","javascript","bug","error","algorithm"],
    "science": ["science","physics","chemistry","biology","atom","energy","force"],
    "history": ["history","war","century","ancient","civilization","revolution"],
    "general": [],
}

CONTEXT_WINDOW = 4  # keep last N user/assistant messages per thread

# ── Helpers ────────────────────────────────────────────────────────────────

def detect_topic(text: str) -> str:
    lower = text.lower()
    for topic, kws in TOPIC_KEYWORDS.items():
        if any(k in lower for k in kws):
            return topic
    return "general"

def assess_task_completion(user_input: str, response: str) -> bool:
    refusals = ["i cannot", "i can't", "i don't know", "i'm not sure",
                "i am unable", "sorry, i", "error processing"]
    if any(p in response.lower() for p in refusals):
        return False
    return len(response.strip()) >= 30

def assess_confidence(user_input: str, response: str, response_time: float) -> float:
    if not response or response.lower().startswith("error:"):
        return 0.30
    score    = 0.70
    refusals = ["i cannot", "i don't know", "i'm not sure", "unable to", "error processing"]
    if any(r in response.lower() for r in refusals):
        score -= 0.25
    if len(response.split()) < 10 and not any(c.isdigit() for c in response):
        score -= 0.15
    q_words = set(re.findall(r'\b\w{4,}\b', user_input.lower()))
    r_words = set(re.findall(r'\b\w{4,}\b', response.lower()))
    overlap = len(q_words & r_words)
    if overlap >= 2: score += 0.06
    if overlap >= 4: score += 0.04
    return round(min(0.99, max(0.30, score)), 2)


# ── Callback handler for streaming ────────────────────────────────────────

class QueueCallbackHandler(BaseCallbackHandler):
    def __init__(self, q: queue.Queue):
        self.q = q
    def on_llm_start(self, serialized, prompts, **kwargs):
        self.q.put(("LLM_START", None))
    def on_llm_new_token(self, token: str, **kwargs):
        self.q.put(("TOKEN", token))


# ── LangGraph state ────────────────────────────────────────────────────────

class AgentState(TypedDict):
    messages: Annotated[List[BaseMessage], operator.add]
    user_id: str


# ── Main AI class ──────────────────────────────────────────────────────────

class SelfEvolvingAI:
    def __init__(self, model: str = "qwen2.5:1.5b", version: str = "1.0"):
        self.model   = model
        self.version = version
        self.llm     = ChatOllama(model=model, temperature=0, streaming=True)
        self.wiki    = WikipediaQueryRun(api_wrapper=WikipediaAPIWrapper())
        self.memory  = MemorySaver()
        self._prompt_template: Optional[str] = None
        self._language: str = "en"
        self._ab_candidate: Optional[str] = None
        self._ab_results: list = []
        self.app = self._build_graph()

    # ── Offline detection ──────────────────────────────────────────────────
    @property
    def is_offline(self) -> bool:
        import os, socket
        val = os.getenv("EVOLVEAI_OFFLINE")
        if val is not None:
            return val.lower() in ("true", "1", "yes")
        try:
            socket.setdefaulttimeout(0.3)
            socket.socket(socket.AF_INET, socket.SOCK_STREAM).connect(("8.8.8.8", 53))
            return False
        except Exception:
            return True

    # ── Graph ──────────────────────────────────────────────────────────────
    def _build_graph(self):
        wf = StateGraph(AgentState)
        wf.add_node("agent", self._call_model)
        wf.add_node("tool",  self._run_tool)
        wf.set_entry_point("agent")
        wf.add_conditional_edges("agent", self._router,
                                 {"continue": "tool", "end": END})
        wf.add_edge("tool", "agent")
        return wf.compile(checkpointer=self.memory)

    def _clean_search_instructions(self, prompt: str) -> str:
        return "\n".join(
            line for line in prompt.split("\n")
            if "SEARCH:" not in line and "search:" not in line.lower()
        )

    def _make_system_prompt(self, rag_context: str = "") -> str:
        lang_name  = LANGUAGE_NAMES.get(self._language, "English")
        lang_instr = f"\nAlways respond in {lang_name}." if self._language != "en" else ""

        template = self._prompt_template or (
            f"You are a helpful, accurate AI assistant (Version {self.version}).\n"
            "Answer questions directly and correctly based on your training knowledge.\n"
            "Rules:\n"
            "- Be precise. Never guess or make up facts.\n"
            "- For math: compute and give the exact answer.\n"
            "- For code: provide working, correct code.\n"
            "- For AI frameworks and developer tools (e.g., LangGraph, LangChain, React, PyTorch, FastAPI): explain them accurately as software libraries/frameworks for building applications (e.g., LangGraph is a framework created by LangChain for orchestrating stateful, multi-actor LLM applications using graphs).\n"
            "- For factual questions: answer from your training data.\n"
            "- Only output 'SEARCH: <query>' when you genuinely need real-time data "
            "(live prices, today's news, current weather).\n"
            "- If you are not sure about something, say so explicitly."
        )

        if self.is_offline:
            template = self._clean_search_instructions(template)
            template += (
                "\n[OFFLINE MODE] No internet access. "
                "Never output 'SEARCH: <query>'. Answer from your training knowledge only."
            )

        rag_section = f"\n\n{rag_context}" if rag_context else ""
        return template + lang_instr + rag_section

    def _call_model(self, state, config=None):
        messages  = state["messages"]
        last_user = next(
            (m.content for m in reversed(messages) if isinstance(m, HumanMessage)), ""
        )
        rag_ctx    = get_rag().build_context(last_user, user_id=state.get("user_id", "anonymous"))
        sys_prompt = SystemMessage(content=self._make_system_prompt(rag_ctx))

        non_sys = [m for m in messages if not isinstance(m, SystemMessage)]
        response = self.llm.invoke([sys_prompt] + non_sys[-CONTEXT_WINDOW:], config=config)
        return {"messages": [response]}

    def _run_tool(self, state):
        content = state["messages"][-1].content
        if "SEARCH:" not in content:
            return {"messages": [HumanMessage(content="TOOL RESULT: No search needed.")]}
        if self.is_offline:
            return {"messages": [HumanMessage(
                content="TOOL RESULT: Search unavailable (offline). Answer from training data.")]}
        query = content.split("SEARCH:")[-1].strip()
        try:
            result = self.wiki.run(query)
            return {"messages": [HumanMessage(content=f"TOOL RESULT: {result[:2000]}")]}
        except Exception:
            return {"messages": [HumanMessage(content="TOOL RESULT: No results found.")]}

    def _router(self, state):
        return "continue" if "SEARCH:" in state["messages"][-1].content else "end"

    # ── Streaming ──────────────────────────────────────────────────────────
    def stream_chat(self, user_input: str, thread_id: str = "default",
                    language: str = "en", user_id: str = "anonymous") -> Generator[str, None, None]:
        """Yields response tokens. RAG is stored by main.py after streaming completes."""
        self._language = language
        q       = queue.Queue()
        handler = QueueCallbackHandler(q)
        config  = {"configurable": {"thread_id": thread_id}, "callbacks": [handler]}
        inputs  = {"messages": [HumanMessage(content=user_input)], "user_id": str(user_id)}

        def run_graph():
            try:
                self.app.invoke(inputs, config=config)
            except Exception as e:
                q.put(("ERROR", e))
            finally:
                q.put(None)

        threading.Thread(target=run_graph, daemon=True).start()

        buffer    = ""
        is_search = False

        while True:
            item = q.get()
            if item is None:
                break

            if isinstance(item, Exception):
                yield f"Error: {item}"
                break

            if not isinstance(item, tuple):
                token = item
            else:
                evt, payload = item
                if evt == "LLM_START":
                    is_search = False
                    buffer    = ""
                    continue
                elif evt == "ERROR":
                    yield f"Error: {payload}"
                    break
                elif evt == "TOKEN":
                    token = payload
                else:
                    continue

            if is_search:
                continue

            # Buffer tokens to detect and suppress "SEARCH: ..." output
            buffer      += token
            stripped     = buffer.strip()
            if not stripped:
                continue

            upper = stripped.upper()
            if upper.startswith("SEARCH:"):
                is_search = True
                buffer    = ""
                continue
            if "SEARCH:".startswith(upper):
                # partial match — keep buffering
                continue

            yield buffer
            buffer = ""

        if buffer and not is_search:
            yield buffer

    # ── Non-streaming chat ─────────────────────────────────────────────────
    def chat(self, user_input: str, thread_id: str = "default",
             language: str = "en", user_id: str = "anonymous") -> dict:
        """
        Used by /api/chat, document upload, and version compare.
        NOTE: callers that go through _save_and_evaluate (i.e. /api/chat) will
        store the result in RAG themselves. Internal callers (doc upload, compare)
        get RAG stored here.
        """
        self._language = language
        start  = time.time()
        config = {"configurable": {"thread_id": thread_id}}
        inputs = {"messages": [HumanMessage(content=user_input)], "user_id": str(user_id)}

        try:
            output = None
            for chunk in self.app.stream(inputs, config=config):
                output = chunk
            response_text = (
                output["agent"]["messages"][-1].content
                if output and "agent" in output
                else "I couldn't process that request."
            )
        except Exception as e:
            response_text = f"Error: {e}"

        elapsed    = time.time() - start
        confidence = assess_confidence(user_input, response_text, elapsed)
        completed  = assess_task_completion(user_input, response_text)
        topic      = detect_topic(user_input)

        return {
            "response":      response_text,
            "version":       self.version,
            "confidence":    confidence,
            "response_time": round(elapsed, 2),
            "completed":     completed,
            "topic":         topic,
        }

    # ── A/B Testing ────────────────────────────────────────────────────────
    def run_ab_test(self, query: str, candidate_prompt: str) -> dict:
        self._ab_candidate = candidate_prompt

        start_a  = time.time()
        config_a = {"configurable": {"thread_id": f"ab_ctrl_{int(start_a)}"}}
        try:
            out_a = None
            for chunk in self.app.stream(
                    {"messages": [HumanMessage(content=query)]}, config=config_a):
                out_a = chunk
            resp_a = out_a["agent"]["messages"][-1].content if out_a and "agent" in out_a else ""
        except Exception as e:
            resp_a = f"Error: {e}"
        time_a = time.time() - start_a
        conf_a = assess_confidence(query, resp_a, time_a)

        old_prompt            = self._prompt_template
        self._prompt_template = candidate_prompt
        self.app              = self._build_graph()
        start_b  = time.time()
        config_b = {"configurable": {"thread_id": f"ab_cand_{int(start_b)}"}}
        try:
            out_b = None
            for chunk in self.app.stream(
                    {"messages": [HumanMessage(content=query)]}, config=config_b):
                out_b = chunk
            resp_b = out_b["agent"]["messages"][-1].content if out_b and "agent" in out_b else ""
        except Exception as e:
            resp_b = f"Error: {e}"
        time_b = time.time() - start_b
        conf_b = assess_confidence(query, resp_b, time_b)

        self._prompt_template = old_prompt
        self._ab_candidate    = None
        self.app              = self._build_graph()

        winner = "candidate" if conf_b > conf_a else "control"
        result = {
            "query":       query,
            "control":     {"response": resp_a, "confidence": conf_a, "time": round(time_a, 2)},
            "candidate":   {"response": resp_b, "confidence": conf_b, "time": round(time_b, 2)},
            "winner":      winner,
            "improvement": round((conf_b - conf_a) * 100, 1),
        }
        self._ab_results.append(result)
        return result

    def update_prompt(self, new_prompt: str):
        self._prompt_template = new_prompt
        self.app = self._build_graph()

    def update_version(self, version: str):
        self.version = version

    def answer_with_prompt(self, user_input: str, prompt: str) -> dict:
        """Isolated eval — does not mutate live user state."""
        start = time.time()
        try:
            response = self.llm.invoke(
                [SystemMessage(content=prompt), HumanMessage(content=user_input)]
            ).content
        except Exception as exc:
            response = f"Error: {exc}"
        return {"response": response, "response_time": time.time() - start}


_ai_instance: Optional[SelfEvolvingAI] = None

def get_ai() -> SelfEvolvingAI:
    global _ai_instance
    if _ai_instance is None:
        _ai_instance = SelfEvolvingAI()
    return _ai_instance
