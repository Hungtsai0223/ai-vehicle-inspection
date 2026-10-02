import type { DamageType, VehiclePart } from "@/types/inspection";
export const partLabels: Record<VehiclePart, { zh: string; en: string }> = {
  front_bumper: { zh: "前保險桿", en: "Front Bumper" },
  rear_bumper: { zh: "後保險桿", en: "Rear Bumper" },
  hood: { zh: "引擎蓋", en: "Hood" },
  trunk: { zh: "行李廂", en: "Trunk" },
  left_front_door: { zh: "左前車門", en: "Left Front Door" },
  left_rear_door: { zh: "左後車門", en: "Left Rear Door" },
  right_front_door: { zh: "右前車門", en: "Right Front Door" },
  right_rear_door: { zh: "右後車門", en: "Right Rear Door" },
  fender: { zh: "葉子板", en: "Fender" },
  headlight: { zh: "頭燈", en: "Headlight" },
  taillight: { zh: "尾燈", en: "Taillight" },
  wheel: { zh: "車輪", en: "Wheel" },
};
export const damageLabels: Record<DamageType, { zh: string; en: string }> = {
  scratch: { zh: "疑似刮痕", en: "Scratch" },
  dent: { zh: "疑似凹陷", en: "Dent" },
  paint_damage: { zh: "疑似漆面損傷", en: "Paint Damage" },
  contamination: { zh: "疑似髒污", en: "Contamination" },
};
