export function PerformanceBar({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="performance-bar">
      <div className="row">
        <span>{label}</span>
        <strong>{value}%</strong>
      </div>
      <div
        className="progress-track"
        role="img"
        aria-label={`${label} 模擬辨識率 ${value}%`}
      >
        <span style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
