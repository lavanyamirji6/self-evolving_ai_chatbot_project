from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, Text, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime

DATABASE_URL = "sqlite:///./evolveai.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String)
    role = Column(String, default="user")
    language = Column(String, default="en")
    preferences = Column(Text, default="{}")
    created_at = Column(DateTime, default=datetime.utcnow)


class Conversation(Base):
    __tablename__ = "conversations"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer)
    user_message = Column(Text)
    bot_response = Column(Text)
    response_time = Column(Float)
    accuracy = Column(Float, default=0.9)
    completed = Column(Boolean, default=True)
    version = Column(String, default="1.0")
    timestamp = Column(DateTime, default=datetime.utcnow)


class Feedback(Base):
    __tablename__ = "feedback"
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer)
    user_id = Column(Integer)
    rating = Column(String)  # up / down / star / 1-5
    timestamp = Column(DateTime, default=datetime.utcnow)


class AIVersion(Base):
    __tablename__ = "ai_versions"
    id = Column(Integer, primary_key=True, index=True)
    version = Column(String, unique=True)
    prompt_template = Column(Text)
    performance_score = Column(Float, default=0.0)
    status = Column(String, default="active")  # active / testing / rolled_back
    created_at = Column(DateTime, default=datetime.utcnow)
    notes = Column(Text, default="")


class Improvement(Base):
    __tablename__ = "improvements"
    id = Column(Integer, primary_key=True, index=True)
    improvement_type = Column(String)
    description = Column(Text)
    status = Column(String, default="pending")
    before_score = Column(Float, default=0.0)
    after_score = Column(Float, default=0.0)
    prompt_template = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class PerformanceMetric(Base):
    __tablename__ = "performance_metrics"
    id = Column(Integer, primary_key=True, index=True)
    version = Column(String)
    accuracy = Column(Float)
    response_time = Column(Float)
    user_satisfaction = Column(Float)
    task_completion = Column(Float)
    topic = Column(String, default="general")
    timestamp = Column(DateTime, default=datetime.utcnow)


class FeedbackSignal(Base):
    """Reasoned feedback used by weakness detection without changing legacy feedback rows."""
    __tablename__ = "feedback_signals"
    id = Column(Integer, primary_key=True, index=True)
    feedback_id = Column(Integer, index=True)
    conversation_id = Column(Integer, index=True, nullable=True)
    user_id = Column(Integer, index=True)
    rating = Column(String)
    reason = Column(String, default="")
    timestamp = Column(DateTime, default=datetime.utcnow)


class SafetyEvent(Base):
    """Auditable heuristic safety signal for live conversations and admin review."""
    __tablename__ = "safety_events"
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, index=True, nullable=True)
    user_id = Column(Integer, index=True, nullable=True)
    category = Column(String)
    severity = Column(String, default="low")
    status = Column(String, default="review")
    details = Column(Text)
    timestamp = Column(DateTime, default=datetime.utcnow)


class EvolutionRun(Base):
    """Immutable record of an automated candidate evaluation and rollout decision."""
    __tablename__ = "evolution_runs"
    id = Column(Integer, primary_key=True, index=True)
    improvement_id = Column(Integer, index=True, nullable=True)
    baseline_version = Column(String)
    candidate_prompt = Column(Text)
    baseline_score = Column(Float, default=0.0)
    candidate_score = Column(Float, default=0.0)
    safety_score = Column(Float, default=0.0)
    passed = Column(Boolean, default=False)
    decision = Column(String, default="rejected")  # rejected / canary / promoted / rolled_back
    rationale = Column(Text, default="")
    evaluation_json = Column(Text, default="[]")
    created_at = Column(DateTime, default=datetime.utcnow)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
