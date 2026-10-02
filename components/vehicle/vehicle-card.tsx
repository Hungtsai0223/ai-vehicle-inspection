"use client";
import { useInspection } from "@/components/inspection/inspection-context";
export function VehicleCard() {
  const { vehicle } = useInspection();
  return (
    <div className="vehicle-card">
      <div>
        <strong>{vehicle.model}</strong>
        <p>{vehicle.plate}</p>
      </div>
      <span className="plate">共享汽車</span>
    </div>
  );
}
