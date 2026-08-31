
import { Route } from 'lucide-react';
import '../index.css';

export function PathPredictionSection() {
  return (
    <div className="section-container">
      <div className="coming-soon-card">
        <Route size={48} color="#38bdf8" />
        <h2>Path Prediction</h2>
        <p>Identifying safe and fuel-efficient navigation routes for research vessels using satellite, oceanographic, and meteorological datasets.</p>
        <div className="badge">Coming Soon</div>
      </div>
    </div>
  );
}
