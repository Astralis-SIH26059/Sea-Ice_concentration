import { useState } from 'react';
import { LandingPage } from './components/LandingPage';
import { SICSection } from './components/SICSection';
import { IcebergSection } from './components/IcebergSection';
import { PathPredictionSection } from './components/PathPredictionSection';
import { Snowflake, Anchor, Route } from 'lucide-react';
import './index.css';

type ViewState = 'landing' | 'sic' | 'iceberg' | 'path';

function App() {
  const [currentView, setCurrentView] = useState<ViewState>('landing');

  return (
    <>
      {currentView !== 'landing' && (
        <nav className="top-nav">
          <div className="nav-brand" onClick={() => setCurrentView('landing')}>
            <Snowflake size={24} color="#38bdf8" />
            <span>Polaris</span>
          </div>
          <div className="nav-links">
            <button 
              className={`nav-btn ${currentView === 'sic' ? 'active' : ''}`}
              onClick={() => setCurrentView('sic')}
            >
              <Snowflake size={16} />
              <span>SIC Forecast</span>
            </button>
            <button 
              className={`nav-btn ${currentView === 'iceberg' ? 'active' : ''}`}
              onClick={() => setCurrentView('iceberg')}
            >
              <Anchor size={16} />
              <span>Icebergs</span>
            </button>
            <button 
              className={`nav-btn ${currentView === 'path' ? 'active' : ''}`}
              onClick={() => setCurrentView('path')}
            >
              <Route size={16} />
              <span>Path Prediction</span>
            </button>
          </div>
        </nav>
      )}

      <main className="main-content">
        {currentView === 'landing' && <LandingPage onNavigate={setCurrentView} />}
        {currentView === 'sic' && <SICSection />}
        {currentView === 'iceberg' && <IcebergSection />}
        {currentView === 'path' && <PathPredictionSection />}
      </main>
    </>
  );
}

export default App;
