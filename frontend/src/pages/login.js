import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowRight, BrainCircuit, ShieldCheck, Sparkles } from 'lucide-react';
import '../styles/login.css';

const API = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';

function Login() {
  const [mode, setMode] = useState('signin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const completeAuthentication = (data) => {
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('role', data.role);
    localStorage.setItem('username', data.username);
    navigate(data.role === 'admin' ? '/admin' : '/chat');
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (mode === 'create' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const endpoint = mode === 'signin' ? '/api/login' : '/api/register';
      const response = await axios.post(`${API}${endpoint}`, { username, password });
      completeAuthentication(response.data);
    } catch (err) {
      if (err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
        setError('Cannot connect to the server. Start the backend on port 5000.');
      } else {
        setError(err.response?.data?.detail || (mode === 'signin'
          ? 'Incorrect username or password.' : 'We could not create your account.'));
      }
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError('');
    setConfirmPassword('');
  };

  return (
    <main className="auth-page">
      <div className="auth-orb auth-orb-one" /><div className="auth-orb auth-orb-two" />
      <section className="auth-intro">
        <div className="brand-mark"><BrainCircuit size={25} /></div>
        <p className="eyebrow">EVOLVEAI</p>
        <h1>AI that learns<br />with intention.</h1>
        <p className="intro-copy">A controlled evolution system that measures, evaluates, and improves every version with evidence.</p>
        <div className="intro-points">
          <span><Sparkles size={16} /> Evidence-led improvements</span>
          <span><ShieldCheck size={16} /> Safety-gated releases</span>
        </div>
      </section>

      <section className="auth-card" aria-label="Account access">
        <div className="auth-tabs" role="tablist">
          <button className={mode === 'signin' ? 'active' : ''} onClick={() => switchMode('signin')} type="button">Sign in</button>
          <button className={mode === 'create' ? 'active' : ''} onClick={() => switchMode('create')} type="button">Create account</button>
        </div>
        <div className="auth-heading">
          <p className="eyebrow">{mode === 'signin' ? 'WELCOME BACK' : 'GET STARTED'}</p>
          <h2>{mode === 'signin' ? 'Sign in to EvolveAI' : 'Create your account'}</h2>
          <p>{mode === 'signin' ? 'Continue your work with the evolution engine.' : 'Your new account is ready in a few seconds.'}</p>
        </div>
        <form onSubmit={submit}>
          <label>Username<input type="text" placeholder="Choose a username" value={username} onChange={(e) => setUsername(e.target.value)} minLength="3" maxLength="50" required autoFocus /></label>
          <label>Password<input type="password" placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} minLength="8" required /></label>
          {mode === 'create' && <label>Confirm password<input type="password" placeholder="Repeat your password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength="8" required /></label>}
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'} <ArrowRight size={17} />
          </button>
        </form>
        <p className="auth-switch">{mode === 'signin' ? 'New to EvolveAI?' : 'Already have an account?'} <button type="button" onClick={() => switchMode(mode === 'signin' ? 'create' : 'signin')}>{mode === 'signin' ? 'Create account' : 'Sign in'}</button></p>
      </section>
    </main>
  );
}

export default Login;
