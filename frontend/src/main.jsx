import React, { StrictMode, Component } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

// Prevent pywebview JavascriptException: Cannot read properties of undefined in Python worker threads
if (typeof window !== 'undefined') {
  const installPywebviewSafety = () => {
    try {
      if (window.pywebview) {
        if (!window.pywebview._returnValuesCallbacks) {
          window.pywebview._returnValuesCallbacks = {};
        }
        if (!window.pywebview._returnValuesCallbacks.__safeProxy) {
          const dummyFn = () => {};
          const orig = window.pywebview._returnValuesCallbacks;
          window.pywebview._returnValuesCallbacks = new Proxy(orig, {
            get(target, prop) {
              if (prop === '__safeProxy') return true;
              if (!(prop in target) || !target[prop]) {
                target[prop] = new Proxy({}, {
                  get(fnTarget, valId) {
                    return fnTarget[valId] || dummyFn;
                  }
                });
              }
              return target[prop];
            }
          });
        }
      }
    } catch (e) {
      console.warn('Failed to install pywebview safety proxy:', e);
    }
  };

  installPywebviewSafety();
  window.addEventListener('pywebviewready', installPywebviewSafety);
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled React Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          height: '100vh',
          width: '100vw',
          backgroundColor: '#0c0c0f',
          color: '#eaeaf2',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: 'Inter, system-ui, sans-serif',
          textAlign: 'center'
        }}>
          <div style={{
            maxWidth: '480px',
            backgroundColor: '#18181d',
            padding: '28px',
            borderRadius: '16px',
            border: '1px solid #2c2c38',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px', color: '#f43f5e' }}>
              Something went wrong
            </h2>
            <p style={{ fontSize: '13px', color: '#8a8a9e', marginBottom: '20px', lineHeight: '1.5' }}>
              {this.state.error?.message || 'An unexpected rendering error occurred.'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              style={{
                backgroundColor: '#7c6dfa',
                color: '#ffffff',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
