import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import {
  Send, ThumbsUp, ThumbsDown, Star, Activity, Cpu,
  Mic, MicOff, Volume2, Upload, User, LogOut,
  Moon, Sun, History, X, MessageSquare, Plus, ChevronRight,
  GitCompare, Zap
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  AreaChart, Area, ScatterChart, Scatter, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ComposedChart, FunnelChart, Funnel, LabelList,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import '../styles/chat.css';

const API = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
const COLORS = ['#007aff','#6e5cff','#f59e0b','#22c55e','#ef4444','#38bdf8','#a78bfa','#14b8a6','#f97316','#8b5cf6'];

axios.interceptors.response.use(res => res, err => {
  if (err.response?.status === 401) { localStorage.clear(); window.location.href = '/login'; }
  return Promise.reject(err);
});

const LANGUAGES = [
  {code:'en',label:'English'},{code:'es',label:'Español'},
  {code:'fr',label:'Français'},{code:'de',label:'Deutsch'},
  {code:'zh',label:'中文'},{code:'ar',label:'العربية'},
  {code:'hi',label:'हिन्दी'},{code:'ta',label:'தமிழ்'},
];

// ── Chart detection ───────────────────────────────────────────────────────────
function detectChartRequest(text) {
  const t = text.toLowerCase();
  if (/bar\s*(chart|graph)/i.test(t))      return 'bar';
  if (/line\s*(chart|graph)|trend/i.test(t)) return 'line';
  if (/pie\s*(chart|graph)|donut|proportion/i.test(t)) return 'pie';
  if (/area\s*(chart|graph)/i.test(t))     return 'area';
  if (/scatter\s*(plot|chart|graph)/i.test(t)) return 'scatter';
  if (/radar\s*(chart|graph)/i.test(t))    return 'radar';
  if (/funnel\s*(chart|graph)/i.test(t))   return 'funnel';
  if (/composed\s*(chart|graph)/i.test(t)) return 'composed';
  if (/(graph|chart|plot|visuali[sz]e|diagram)/i.test(t)) return 'bar';
  return null;
}

function parseChartData(text) {
  const lines = text.split('\n');
  const data  = [];
  for (const line of lines) {
    let m = line.match(/^[\-\*\s#]*([A-Za-z][^\:\|\-\d][^\:\|\-]*?)[\:\|\-]\s*([\d.]+)/);
    if (m) { data.push({ name: m[1].trim(), value: parseFloat(m[2]) }); continue; }
    m = line.match(/^[\-\*\s]*(\w[\w\s\-\/]*?)\s{2,}([\d.]+)\s*$/);
    if (m && !isNaN(parseFloat(m[2]))) data.push({ name: m[1].trim(), value: parseFloat(m[2]) });
  }
  return data.length >= 2 ? data : null;
}

// ── All chart types ───────────────────────────────────────────────────────────
function ChartBlock({ chartType, data, darkMode }) {
  const axis  = { fill: darkMode ? '#b0b0c8' : '#555', fontSize: 11 };
  const grid  = darkMode ? '#2d2050' : '#e5e7eb';
  const props = { data, margin: { top:10, right:20, left:0, bottom:5 } };

  if (chartType === 'pie') return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%"
          outerRadius={90} label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
          {data.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
        </Pie>
        <Tooltip formatter={v=>v.toLocaleString()}/><Legend/>
      </PieChart>
    </ResponsiveContainer>
  );

  if (chartType === 'line') return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart {...props}>
        <CartesianGrid strokeDasharray="3 3" stroke={grid}/>
        <XAxis dataKey="name" tick={axis}/><YAxis tick={axis}/>
        <Tooltip/><Legend/>
        <Line type="monotone" dataKey="value" stroke={COLORS[0]} strokeWidth={2} dot={{r:4}}/>
      </LineChart>
    </ResponsiveContainer>
  );

  if (chartType === 'area') return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart {...props}>
        <defs>
          <linearGradient id="areaG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={COLORS[0]} stopOpacity={0.5}/>
            <stop offset="95%" stopColor={COLORS[0]} stopOpacity={0.05}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={grid}/>
        <XAxis dataKey="name" tick={axis}/><YAxis tick={axis}/>
        <Tooltip/>
        <Area type="monotone" dataKey="value" stroke={COLORS[0]} fill="url(#areaG)" strokeWidth={2}/>
      </AreaChart>
    </ResponsiveContainer>
  );

  if (chartType === 'scatter') {
    const sd = data.map((d,i)=>({x:i+1,y:d.value,name:d.name}));
    return (
      <ResponsiveContainer width="100%" height={240}>
        <ScatterChart margin={{top:10,right:20,left:0,bottom:5}}>
          <CartesianGrid strokeDasharray="3 3" stroke={grid}/>
          <XAxis dataKey="x" tick={axis}/><YAxis dataKey="y" tick={axis}/>
          <Tooltip cursor={{strokeDasharray:'3 3'}}/>
          <Scatter data={sd} fill={COLORS[0]}/>
        </ScatterChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === 'radar') return (
    <ResponsiveContainer width="100%" height={260}>
      <RadarChart data={data}>
        <PolarGrid stroke={grid}/>
        <PolarAngleAxis dataKey="name" tick={axis}/>
        <PolarRadiusAxis tick={axis}/>
        <Radar dataKey="value" stroke={COLORS[0]} fill={COLORS[0]} fillOpacity={0.4}/>
        <Tooltip/>
      </RadarChart>
    </ResponsiveContainer>
  );

  if (chartType === 'funnel') return (
    <ResponsiveContainer width="100%" height={260}>
      <FunnelChart>
        <Tooltip/>
        <Funnel dataKey="value" data={data.map((d,i)=>({...d,fill:COLORS[i%COLORS.length]}))}>
          <LabelList position="center" fill="#fff" stroke="none" dataKey="name" style={{fontSize:11}}/>
        </Funnel>
      </FunnelChart>
    </ResponsiveContainer>
  );

  if (chartType === 'composed') return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart {...props}>
        <CartesianGrid strokeDasharray="3 3" stroke={grid}/>
        <XAxis dataKey="name" tick={axis}/><YAxis tick={axis}/>
        <Tooltip/><Legend/>
        <Bar dataKey="value" fill={COLORS[0]} radius={[4,4,0,0]} opacity={0.85}/>
        <Line type="monotone" dataKey="value" stroke={COLORS[1]} strokeWidth={2} dot={false}/>
      </ComposedChart>
    </ResponsiveContainer>
  );

  // default bar
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart {...props}>
        <CartesianGrid strokeDasharray="3 3" stroke={grid}/>
        <XAxis dataKey="name" tick={axis}/><YAxis tick={axis}/>
        <Tooltip/>
        <Bar dataKey="value" radius={[6,6,0,0]}>
          {data.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── History grouping ───────────────────────────────────────────────────────────
function relDate(ds) {
  if (!ds) return 'Unknown';
  const diff = Math.floor((new Date()-new Date(ds))/86400000);
  if (diff===0) return 'Today';
  if (diff===1) return 'Yesterday';
  if (diff<=7)  return 'Previous 7 Days';
  if (diff<=30) return 'Previous 30 Days';
  return new Date(ds).toLocaleString('default',{month:'long',year:'numeric'});
}
function groupHistory(convs) {
  const order=['Today','Yesterday','Previous 7 Days','Previous 30 Days'];
  const g={};
  convs.forEach(c=>{ const l=relDate(c.timestamp); if(!g[l]) g[l]=[]; g[l].push(c); });
  const s={};
  order.forEach(k=>{ if(g[k]) s[k]=g[k]; });
  Object.keys(g).forEach(k=>{ if(!order.includes(k)) s[k]=g[k]; });
  return s;
}

// ── Feature 11: Version Comparison Panel ─────────────────────────────────────
function ComparePanel({ versions, onClose, darkMode }) {
  const [query,   setQuery]   = useState('');
  const [vA,      setVA]      = useState('');
  const [vB,      setVB]      = useState('');
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    if (!query || !vA || !vB) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API}/api/evolution/compare`,
        { query, version_a: vA, version_b: vB },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      setResult(res.data);
    } catch (e) {
      setResult({ error: e.response?.data?.detail || 'Error' });
    } finally { setLoading(false); }
  };

  return (
    <div className="compare-panel">
      <div className="compare-header">
        <h3><GitCompare size={16}/> Version Comparison</h3>
        <button className="icon-btn" onClick={onClose}><X size={16}/></button>
      </div>
      <div className="compare-form">
        <input placeholder="Ask the same question to both versions..."
          value={query} onChange={e=>setQuery(e.target.value)}/>
        <div className="compare-selects">
          <select value={vA} onChange={e=>setVA(e.target.value)}>
            <option value="">Version A</option>
            {versions.map(v=><option key={v.version} value={v.version}>v{v.version}</option>)}
          </select>
          <span>vs</span>
          <select value={vB} onChange={e=>setVB(e.target.value)}>
            <option value="">Version B</option>
            {versions.map(v=><option key={v.version} value={v.version}>v{v.version}</option>)}
          </select>
          <button className="send-btn" onClick={run} disabled={loading||!query||!vA||!vB}>
            {loading ? '...' : <Zap size={14}/>}
          </button>
        </div>
      </div>
      {result && !result.error && (
        <div className="compare-results">
          <div className={`compare-col ${result.winner===`v${vA}`?'winner':''}`}>
            <div className="compare-ver-label">v{vA} {result.winner===`v${vA}`?' 🏆':''}</div>
            <div className="compare-confidence">Confidence: {(result.response_a.confidence*100).toFixed(0)}% · {result.response_a.time}s</div>
            <div className="compare-text">{result.response_a.response}</div>
          </div>
          <div className={`compare-col ${result.winner===`v${vB}`?'winner':''}`}>
            <div className="compare-ver-label">v{vB} {result.winner===`v${vB}`?' 🏆':''}</div>
            <div className="compare-confidence">Confidence: {(result.response_b.confidence*100).toFixed(0)}% · {result.response_b.time}s</div>
            <div className="compare-text">{result.response_b.response}</div>
          </div>
        </div>
      )}
      {result?.error && <p className="compare-error">{result.error}</p>}
    </div>
  );
}

// ── Main Chat Component ────────────────────────────────────────────────────────
export default function Chat() {
  const [messages,      setMessages]      = useState([]);
  const [input,         setInput]         = useState('');
  const [loading,       setLoading]       = useState(false);
  const [streaming,     setStreaming]     = useState(false);
  const [version,       setVersion]       = useState('1.0');
  const [language,      setLanguage]      = useState('en');
  const [listening,     setListening]     = useState(false);
  const [showProfile,   setShowProfile]   = useState(false);
  const [file,          setFile]          = useState(null);
  const [fileQuestion,  setFileQuestion]  = useState('');
  const [showUpload,    setShowUpload]    = useState(false);
  const [darkMode,      setDarkMode]      = useState(()=>localStorage.getItem('darkMode')==='true');
  const [sidebarOpen,   setSidebarOpen]   = useState(false);
  const [historyConvs,  setHistoryConvs]  = useState([]);
  const [historyLoading,setHistoryLoading]= useState(false);
  const [activeConvId,  setActiveConvId]  = useState(null);
  const [showCompare,   setShowCompare]   = useState(false);
  const [allVersions,   setAllVersions]   = useState([]);
  const [pendingChart,  setPendingChart]  = useState(null);
  const [feedbackTarget,setFeedbackTarget]= useState(null);
  const [speakingId,    setSpeakingId]    = useState(null);
  const [speakState,    setSpeakState]    = useState('idle');

  const endRef       = useRef(null);
  const recRef       = useRef(null);
  const fileRef      = useRef(null);
  const utteranceRef = useRef(null);

  const token    = ()=>localStorage.getItem('token');
  const hdrs     = ()=>({Authorization:`Bearer ${token()}`});
  const username = localStorage.getItem('username')||'User';

  useEffect(()=>{
    localStorage.setItem('darkMode',darkMode);
    document.documentElement.setAttribute('data-theme',darkMode?'dark':'light');
  },[darkMode]);

  // Cancel speech synthesis when the component unmounts
  useEffect(()=>{
    return ()=>{ window.speechSynthesis.cancel(); };
  },[]);

  useEffect(()=>{ endRef.current?.scrollIntoView({behavior:'smooth'}); },[messages]);

  const fetchHistory = useCallback(()=>{
    setHistoryLoading(true);
    axios.get(`${API}/api/chat/history`,{headers:hdrs()})
      .then(r=>setHistoryConvs(r.data)).catch(()=>{}).finally(()=>setHistoryLoading(false));
  },[]);

  const fetchVersions = useCallback(()=>{
    axios.get(`${API}/api/evolution/versions`,{headers:hdrs()})
      .then(r=>setAllVersions(r.data)).catch(()=>{});
  },[]);

  useEffect(()=>{ fetchHistory(); },[fetchHistory]);

  const loadThread = (conv)=>{
    setActiveConvId(conv.id);
    setMessages([
      {text:conv.user_message, sender:'user', timestamp:conv.timestamp},
      {text:conv.bot_response, sender:'bot', version:conv.version,
       confidence:0.9, conversationId:conv.id, timestamp:conv.timestamp,
       chartType:detectChartRequest(conv.user_message),
       chartData:parseChartData(conv.bot_response)}
    ]);
    setSidebarOpen(false);
  };

  const startNewChat=()=>{ setMessages([]); setActiveConvId(null); setSidebarOpen(false); setInput(''); };

  // ── Voice ─────────────────────────────────────────────────────────────────
  const startListening=()=>{
    if(!('webkitSpeechRecognition' in window||'SpeechRecognition' in window)){alert('Speech not supported');return;}
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    const rec=new SR(); rec.lang=language; rec.interimResults=false;
    rec.onresult=e=>{setInput(e.results[0][0].transcript);setListening(false);};
    rec.onerror=()=>setListening(false); rec.onend=()=>setListening(false);
    rec.start(); recRef.current=rec; setListening(true);
  };
  const stopListening=()=>{recRef.current?.stop();setListening(false);};

  const handleSpeak=(msgId,text)=>{
    if(speakingId===msgId){
      if(speakState==='playing'){
        window.speechSynthesis.pause();
        setSpeakState('paused');
      }else if(speakState==='paused'){
        window.speechSynthesis.resume();
        setSpeakState('playing');
      }
    }else{
      window.speechSynthesis.cancel();
      setSpeakingId(msgId);
      setSpeakState('playing');
      const u=new SpeechSynthesisUtterance(text);
      u.lang=language;
      u.onend=()=>{setSpeakState('idle');setSpeakingId(null);};
      u.onerror=()=>{setSpeakState('idle');setSpeakingId(null);};
      utteranceRef.current=u;
      window.speechSynthesis.speak(u);
    }
  };

  // ── Feature 7: Streaming send ─────────────────────────────────────────────
  const sendMessage = async ()=>{
    if (!input.trim()) return;
    const chartType = detectChartRequest(input);
    if (chartType) setPendingChart(chartType);

    const userMsg = {text:input,sender:'user',timestamp:new Date().toISOString()};
    setMessages(prev=>[...prev,userMsg]);
    const currentInput = input;
    setInput('');
    setLoading(true); setStreaming(true);

    // botId is a local UI key only — never sent to the backend
    const botId = Date.now();
    setMessages(prev=>[...prev,{
      _botId: botId,          // stable UI key throughout streaming
      conversationId: null,   // real DB id, set when done event arrives
      text:'', sender:'bot', streaming:true,
      timestamp:new Date().toISOString()
    }]);

    try {
      const url = `${API}/api/chat/stream?message=${encodeURIComponent(currentInput)}&language=${language}`;
      const res  = await fetch(url, {headers:hdrs()});
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.clear();
          window.location.href = '/login';
          return;
        }
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || `Server error (${res.status})`);
      }
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText='', meta=null, sseBuffer='';

      while (true) {
        const {done,value} = await reader.read();
        if (done) break;
        sseBuffer += decoder.decode(value, {stream:true});
        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop(); // keep partial last line
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          try {
            const d = JSON.parse(line.slice(5).trim());
            if (d.done) {
              meta = d;
            } else if (d.token !== undefined) {
              fullText += d.token;
              setMessages(prev=>prev.map(m=>
                m._botId===botId ? {...m, text:fullText} : m
              ));
            }
          } catch(_) {}
        }
      }
      // flush leftover
      if (sseBuffer.startsWith('data:')) {
        try {
          const d = JSON.parse(sseBuffer.slice(5).trim());
          if (d.done) meta = d;
        } catch(_) {}
      }

      const resolvedChart = chartType || pendingChart;
      const chartData     = resolvedChart ? parseChartData(fullText) : null;
      // conversationId is the real DB integer — only set when backend confirms it
      const realConvId = (meta?.conversation_id && Number.isInteger(meta.conversation_id))
        ? meta.conversation_id : null;

      setMessages(prev=>prev.map(m=>
        m._botId===botId ? {
          ...m,
          streaming:      false,
          conversationId: realConvId,   // used by feedback — null if backend didn't confirm
          version:        meta?.version || version,
          confidence:     meta?.confidence || 0.9,
          response_time:  meta?.response_time,
          chartType:      chartData ? resolvedChart : null,
          chartData,
        } : m
      ));

      if (meta?.version) setVersion(meta.version);
      if (chartData) setPendingChart(null);

      if (realConvId) {
        setActiveConvId(realConvId);
        setHistoryConvs(prev=>[{
          id: realConvId,
          user_message: currentInput,
          bot_response: fullText,
          version: meta?.version || version,
          timestamp: new Date().toISOString(),
        },...prev]);
      }

    } catch(err) {
      setMessages(prev=>prev.map(m=>
        m._botId===botId ? {...m, text:`Error: ${err.message}`, streaming:false} : m
      ));
    } finally {
      setLoading(false); setStreaming(false);
    }
  };

  // feedback uses conversationId (real DB int), falling back to activeConvId or latest
  const handleFeedback=async(convId,rating,reason=null)=>{
    const targetId = convId || activeConvId;
    try {
      const res = await axios.post(
        `${API}/api/feedback`,
        {rating, conversation_id: targetId, reason},
        {headers:hdrs()}
      );
      const confirmedId = res.data?.conversation_id || targetId;
      if (confirmedId) setActiveConvId(confirmedId);
      setMessages(prev=>prev.map(m=>
        (m.conversationId===confirmedId || m.conversationId===targetId || !m.conversationId)
          ? {...m, userFeedback:rating, conversationId: confirmedId || m.conversationId} : m
      ));
    } catch(_){} finally {
      if(reason) setFeedbackTarget(null);
    }
  };

  const uploadDocument=async()=>{
    if(!file) return;
    const fd=new FormData();
    fd.append('file',file); fd.append('question',fileQuestion||'Summarize this document');
    setLoading(true); setShowUpload(false);
    setMessages(prev=>[...prev,{text:`📄 ${file.name} — "${fileQuestion||'Summarize'}"`,sender:'user',timestamp:new Date().toISOString()}]);
    try {
      const res=await axios.post(`${API}/api/upload`,fd,{headers:hdrs()});
      setMessages(prev=>[...prev,{text:res.data.answer,sender:'bot',confidence:0.9,citations:res.data.citations||[],timestamp:new Date().toISOString()}]);
    } catch {
      setMessages(prev=>[...prev,{text:'Could not process document.',sender:'bot',confidence:0,timestamp:new Date().toISOString()}]);
    } finally {setLoading(false);setFile(null);setFileQuestion('');}
  };

  const logout=()=>{localStorage.clear();window.location.href='/login';};
  const grouped=groupHistory(historyConvs);

  return (
    <div className="chat-wrapper">
      {/* Sidebar */}
      <aside className={`history-sidebar${sidebarOpen?' open':''}`}>
        <div className="sidebar-header">
          <span className="sidebar-title"><History size={15}/> History</span>
          <div className="sidebar-header-btns">
            <button className="sidebar-new-btn" onClick={startNewChat}><Plus size={14}/> New</button>
            <button className="icon-btn" onClick={()=>setSidebarOpen(false)}><X size={15}/></button>
          </div>
        </div>
        <div className="sidebar-body">
          {historyLoading && <p className="sidebar-empty">Loading...</p>}
          {!historyLoading && historyConvs.length===0 && <p className="sidebar-empty">No conversations yet.</p>}
          {Object.entries(grouped).map(([label,convs])=>(
            <div key={label} className="history-group">
              <div className="history-date-label">{label}</div>
              {convs.map((c,i)=>(
                <button key={c.id||i} className={`history-item${activeConvId===c.id?' active':''}`} onClick={()=>loadThread(c)}>
                  <MessageSquare size={12} className="history-icon"/>
                  <div className="history-item-text">
                    <span className="history-q">{c.user_message?.substring(0,45)||'...'}</span>
                    <span className="history-a">{c.bot_response?.substring(0,55)||'...'}</span>
                  </div>
                  <ChevronRight size={12} className="history-chevron"/>
                </button>
              ))}
            </div>
          ))}
        </div>
      </aside>
      {sidebarOpen && <div className="sidebar-overlay" onClick={()=>setSidebarOpen(false)}/>}

      {/* Main */}
      <div className="chat-container">
        {/* Header */}
        <div className="chat-header">
          <div className="header-left">
            <button className="icon-btn" onClick={()=>{setSidebarOpen(v=>!v);if(!sidebarOpen)fetchHistory();}}><History size={19}/></button>
            <Cpu size={19}/><h1>Self-Evolving AI</h1>
            <span className="version-badge">v{version}</span>
          </div>
          <div className="header-center">
            <select className="lang-select" value={language} onChange={e=>setLanguage(e.target.value)}>
              {LANGUAGES.map(l=><option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </div>
          <div className="header-right">
            <span className="evolution-pill"><Activity size={12}/> Active</span>
            {localStorage.getItem('role')==='admin' && (
              <button className="icon-btn" title="Compare versions"
                onClick={()=>{setShowCompare(v=>!v);fetchVersions();}}>
                <GitCompare size={17}/>
              </button>
            )}
            <button className="icon-btn" onClick={()=>setDarkMode(d=>!d)}>{darkMode?<Sun size={17}/>:<Moon size={17}/>}</button>
            <button className="icon-btn" onClick={()=>setShowProfile(p=>!p)}><User size={17}/></button>
            <button className="icon-btn" onClick={logout}><LogOut size={17}/></button>
          </div>
        </div>

        {/* Profile */}
        {showProfile && (
          <div className="profile-panel">
            <h3>👤 {username}</h3>
            <p>Role: {localStorage.getItem('role')}</p>
            <p>Language: {LANGUAGES.find(l=>l.code===language)?.label}</p>
            {localStorage.getItem('role')==='admin' && <a href="/admin" className="admin-link">🧬 Admin Dashboard</a>}
            <button onClick={()=>setShowProfile(false)}>Close</button>
          </div>
        )}

        {/* Feature 11: Compare panel */}
        {showCompare && <ComparePanel versions={allVersions} onClose={()=>setShowCompare(false)} darkMode={darkMode}/>}

        {/* Messages */}
        <div className="messages-container">
          {messages.length===0 && (
            <div className="welcome-msg">
              <Cpu size={44}/><h2>Self-Evolving AI</h2>
              <p>Ask me anything — I stream responses, learn from feedback, and evolve.</p>
              <div className="suggestion-chips">
                {['Show a bar chart of planet sizes','Write a Python quicksort','Explain neural networks','Show a radar chart of skills'].map(s=>(
                  <button key={s} className="chip" onClick={()=>setInput(s)}>{s}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg,idx)=>(
            <div key={idx} className={`message ${msg.sender}`}>
              <div className="msg-avatar">
                {msg.sender==='user'
                  ? <span className="avatar-user">{username[0]?.toUpperCase()||'U'}</span>
                  : <Cpu size={15} className="avatar-bot"/>}
              </div>
              <div className="message-content">
                <div className="message-text" style={{whiteSpace:'pre-wrap'}}>
                  {msg.text}
                  {msg.streaming && <span className="stream-cursor">▋</span>}
                </div>

                {msg.sender==='bot' && msg.chartData && msg.chartType && !msg.streaming && (
                  <div className="chart-block">
                    <ChartBlock chartType={msg.chartType} data={msg.chartData} darkMode={darkMode}/>
                  </div>
                )}
                {msg.sender==='bot' && msg.citations?.length > 0 && (
                  <div className="document-citations">
                    <span>Sources</span>
                    {msg.citations.map((citation,i)=>(
                      <button key={i} title={citation.excerpt}>Page {citation.page}</button>
                    ))}
                  </div>
                )}

                <div className="message-footer">
                  <span className="msg-time">
                    {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : ''}
                  </span>
                  {msg.sender==='bot' && !msg.streaming && (
                    <div className="message-meta">
                      {msg.confidence ? <span className="confidence">{(msg.confidence*100).toFixed(0)}%</span> : null}
                      {msg.response_time ? <span className="confidence">{msg.response_time}s</span> : null}
                      <div className="feedback-buttons">
                        <button className={msg.userFeedback==='up'?'active':''} onClick={()=>handleFeedback(msg.conversationId||activeConvId,'up')} title="Good response"><ThumbsUp size={12}/></button>
                        <button className={msg.userFeedback==='down'?'active':''} onClick={()=>{
                          const tid = msg.conversationId || activeConvId;
                          if (tid) { handleFeedback(tid, 'down'); setFeedbackTarget(tid); }
                        }} title="Bad response"><ThumbsDown size={12}/></button>
                        <button className={msg.userFeedback==='star'?'active':''} onClick={()=>handleFeedback(msg.conversationId||activeConvId,'star')} title="Favourite"><Star size={12}/></button>
                        <button
                          className={speakingId===msg.id ? `speaking-btn ${speakState}` : ''}
                          onClick={()=>handleSpeak(msg.id,msg.text)}
                          title={speakingId===msg.id ? (speakState==='playing'?'Pause':'Resume') : 'Read aloud'}
                        >
                          {speakingId===msg.id && speakState==='playing'
                            ? <Mic size={12}/>
                            : speakingId===msg.id && speakState==='paused'
                            ? <MicOff size={12}/>
                            : <Volume2 size={12}/>}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {loading && !streaming && (
            <div className="message bot">
              <div className="msg-avatar"><Cpu size={15} className="avatar-bot"/></div>
              <div className="message-content">
                <div className="typing-indicator"><span/><span/><span/></div>
              </div>
            </div>
          )}
          <div ref={endRef}/>
        </div>

        {feedbackTarget && (
          <div className="feedback-reason-popover">
            <span>What could be better?</span>
            {['Incorrect','Too vague','Too long','Unsafe','Slow','Did not follow instructions'].map(reason=>(
              <button key={reason} onClick={()=>handleFeedback(feedbackTarget,'down',reason)}>{reason}</button>
            ))}
            <button className="feedback-cancel" onClick={()=>setFeedbackTarget(null)}>Cancel</button>
          </div>
        )}

        {/* Upload */}
        {showUpload && (
          <div className="upload-panel">
            <h4>📄 Upload Document (PDF or TXT)</h4>
            <input type="file" ref={fileRef} accept=".pdf,.txt" onChange={e=>setFile(e.target.files[0])}/>
            <input type="text" placeholder="Question about the document..."
              value={fileQuestion} onChange={e=>setFileQuestion(e.target.value)}/>
            <div className="upload-actions">
              <button onClick={uploadDocument} disabled={!file}>Ask</button>
              <button onClick={()=>setShowUpload(false)}>Cancel</button>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="input-container">
          <div className="input-box">
            <button className="icon-btn" onClick={()=>setShowUpload(v=>!v)} title="Upload"><Upload size={16}/></button>
            <input type="text" value={input}
              onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&sendMessage()}
              placeholder="Ask anything, or try 'show me a pie chart of...'"
              disabled={loading}/>
            <button className={`icon-btn mic-btn${listening?' listening':''}`}
              onClick={listening?stopListening:startListening}>
              {listening?<MicOff size={16}/>:<Mic size={16}/>}
            </button>
            <button className="send-btn" onClick={sendMessage} disabled={loading||!input.trim()}>
              <Send size={16}/>
            </button>
          </div>
          <p className="disclaimer">AI v{version} · Streaming · RAG Memory · Self-Evolving</p>
        </div>
      </div>
    </div>
  );
}
