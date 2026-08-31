
import { Anchor } from 'lucide-react';
import '../index.css';

export function IcebergSection() {
  return (
    <div className="section-container">
      <div className="coming-soon-card">
        <Anchor size={48} color="#38bdf8" />
        <h2>Iceberg Trajectory</h2>
        <p>Advanced tracking and prediction of iceberg movements using satellite imagery and ocean current data.</p>
        <div className="badge">Coming Soon</div>
      </div>
    </div>
  );
}
