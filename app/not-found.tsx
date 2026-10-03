import { Action } from "@/components/ui/primitives";
export default function NotFound() {
  return (
    <div className="page">
      <h1>找不到此頁面</h1>
      <p className="lead">此連結可能已變更，請返回車況檢查。</p>
      <Action href="/return">返回車況檢查</Action>
    </div>
  );
}
