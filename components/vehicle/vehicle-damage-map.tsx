import type { DamageDetection, VehiclePart } from "@/types/inspection";
import { VehicleIllustration } from "./vehicle-illustration";
// TODO: Replace VehicleDamageMap with React Three Fiber / Three.js 3D vehicle model.
export function VehicleDamageMap({
  vehicleParts,
  damageLocations,
  selectedDamage,
}: {
  vehicleParts: VehiclePart[];
  damageLocations: DamageDetection[];
  selectedDamage?: string;
}) {
  const relevant = damageLocations.filter((d) => vehicleParts.includes(d.part));
  return (
    <figure className="vehicle-map">
      <VehicleIllustration marked={relevant.length > 0} />
      <figcaption>
        {relevant.length ? "左前車門 · 疑似新增車損" : "車輛外觀檢查示意"}
        {selectedDamage && (
          <span className="sr-only">選取車損 {selectedDamage}</span>
        )}
      </figcaption>
    </figure>
  );
}
