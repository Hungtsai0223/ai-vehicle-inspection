export function VehicleIllustration({
  marked = false,
  dark = false,
}: {
  marked?: boolean;
  dark?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 420 210"
      role="img"
      aria-label={
        marked ? "車輛左側，左前車門標示疑似車損" : "共享汽車側面示意圖"
      }
      className="vehicle-svg"
    >
      <defs>
        <linearGradient id={dark ? "body-dark" : "body-light"} x2="0" y2="1">
          <stop stopColor="#f3f5f7" />
          <stop offset="1" stopColor="#aeb7c0" />
        </linearGradient>
      </defs>
      <ellipse
        cx="210"
        cy="179"
        rx="178"
        ry="12"
        fill={dark ? "#19252e" : "#e4e7eb"}
      />
      <path
        d="M35 143 43 114 83 101 119 60 Q129 47 154 47 H271 Q289 48 307 73 L339 101 376 116 386 145 379 163 H38Z"
        fill={`url(#${dark ? "body-dark" : "body-light"})`}
        stroke="#7a8591"
        strokeWidth="2"
      />
      <path
        d="m105 99 29-38h50v38zm91 0V61h73q12 0 20 13l19 25z"
        fill="#263644"
      />
      <path
        d="M190 105v53m126-51 4 48M103 111l-8 35m19-40h190"
        stroke="#909ba6"
        fill="none"
      />
      <rect x="199" y="113" width="15" height="4" rx="2" fill="#73808b" />
      <rect x="120" y="113" width="15" height="4" rx="2" fill="#73808b" />
      <path d="M39 123h28l-5 12H37m334-11h10v17h-14" fill="#fff8d4" />
      <path d="M39 153h337" stroke="#344452" strokeWidth="9" />
      <circle cx="94" cy="157" r="29" fill="#1d2730" />
      <circle cx="94" cy="157" r="17" fill="#a6b1bb" />
      <circle cx="94" cy="157" r="7" fill="#536372" />
      <circle cx="325" cy="157" r="29" fill="#1d2730" />
      <circle cx="325" cy="157" r="17" fill="#a6b1bb" />
      <circle cx="325" cy="157" r="7" fill="#536372" />
      {marked && (
        <g>
          <circle cx="153" cy="131" r="25" fill="#e5313f" opacity=".16" />
          <circle
            cx="153"
            cy="131"
            r="12"
            fill="#e5313f"
            stroke="white"
            strokeWidth="3"
          />
          <path d="m149 135 8-8" stroke="white" strokeWidth="2" />
        </g>
      )}
    </svg>
  );
}
export { VehicleCard } from "./vehicle-card";
