
import { Snowflake, Anchor, Route, ArrowRight } from 'lucide-react';
import '../index.css';

interface LandingPageProps {
  onNavigate: (view: 'sic' | 'iceberg' | 'path') => void;
}

export function LandingPage({ onNavigate }: LandingPageProps) {
  return (
    <div className="landing-container">
      <div className="landing-hero">
        <div className="hero-logo">
          <Snowflake size={48} className="hero-icon" />
          <h1 className="hero-title">Polaris</h1>
        </div>
        <p className="hero-subtitle">
          An AI/ML-enabled decision support platform capable of forecasting Antarctic sea-ice concentration, predicting iceberg trajectories, and identifying safe and fuel-efficient navigation routes for research vessels using satellite, oceanographic, and meteorological datasets.
        </p>
      </div>

      <div className="landing-cards">
        <div className="feature-card" onClick={() => onNavigate('sic')}>
          <div className="card-icon-wrapper">
            <Snowflake size={32} color="#38bdf8" />
          </div>
          <h3>Sea-Ice Concentration</h3>
          <p>Real-time data and 3-day forecasting of Antarctic sea-ice coverage.</p>
          <div className="card-action">
            <span>Launch Tool</span>
            <ArrowRight size={16} />
          </div>
        </div>

        <div className="feature-card" onClick={() => onNavigate('iceberg')}>
          <div className="card-icon-wrapper">
            <Anchor size={32} color="#38bdf8" />
          </div>
          <h3>Iceberg Trajectory</h3>
          <p>Track and predict movements of significant icebergs in the Southern Ocean.</p>
          <div className="card-action">
            <span>Coming Soon</span>
            <ArrowRight size={16} />
          </div>
        </div>

        <div className="feature-card" onClick={() => onNavigate('path')}>
          <div className="card-icon-wrapper">
            <Route size={32} color="#38bdf8" />
          </div>
          <h3>Path Prediction</h3>
          <p>AI-driven route optimization for research vessels navigating polar waters.</p>
          <div className="card-action">
            <span>Coming Soon</span>
            <ArrowRight size={16} />
          </div>
        </div>
      </div>
    </div>
  );
}
