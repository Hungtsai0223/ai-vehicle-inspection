import { Action } from "@/components/ui/primitives";
export default function NotFound() {
  return (
    <div className="page">
      <h1>找不到此頁面</h1>
      <Action href="/">回到首頁</Action>
    </div>
  );
}
