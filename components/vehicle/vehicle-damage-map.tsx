import type { DamageDetection, VehiclePart } from "@/types/inspection";
import { partLabels } from "@/lib/inspection-labels";
import { VehicleIllustration } from "./vehicle-illustration";
// TODO: Replace this visualization with React Three Fiber / Three.js vehicle model.
// This MVP side-view marker maps left_front_door only. Add calibrated positions
// for other parts with the future model; never imply a wrong location.
export function VehicleDamageMap({
  vehicleParts,
  damageLocations,
  selectedDamage,
  onSelectDamage,
}: {
  vehicleParts: VehiclePart[];
  damageLocations: DamageDetection[];
  selectedDamage?: string;
  onSelectDamage?: (id: string) => void;
}) {
  const relevant = damageLocations.filter((d) => vehicleParts.includes(d.part));
  const marked = relevant.find((d) => d.part === "left_front_door");
  return (
    <figure className="vehicle-map">
      <div className="vehicle-map-canvas">
        <VehicleIllustration marked={!!marked && !onSelectDamage} />
        {marked && onSelectDamage && (
          <button
            type="button"
            className="damage-marker"
            aria-label={`查看${partLabels[marked.part].zh}疑似新增車損`}
            aria-pressed={selectedDamage === marked.id}
            onClick={() => onSelectDamage(marked.id)}
          >
            <span aria-hidden="true">!</span>
          </button>
        )}
      </div>
      <figcaption>
        {relevant.length
          ? `${partLabels[relevant[0].part].zh} · 疑似新增車損`
          : "車輛外觀檢查示意"}
      </figcaption>
    </figure>
  );
}
