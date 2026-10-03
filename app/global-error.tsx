"use client";
export default function GlobalError() {
  return (
    <html lang="zh-Hant">
      <body
        style={{
          margin: 0,
          background: "#edf0f3",
          color: "#222830",
          fontFamily: "system-ui,sans-serif",
        }}
      >
        <title>系統暫時發生問題 · AI Vehicle Inspection</title>
        <main
          style={{
            maxWidth: 430,
            margin: "0 auto",
            minHeight: "100dvh",
            padding:
              "max(32px, env(safe-area-inset-top)) 24px max(32px, env(safe-area-inset-bottom))",
            background: "white",
          }}
        >
          <h1 style={{ fontSize: 26 }}>系統暫時發生問題</h1>
          <p>請重新整理，或返回展示入口再試一次。</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              width: "100%",
              minHeight: 54,
              border: 0,
              borderRadius: 15,
              background: "#d52d3b",
              color: "white",
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            重新整理
          </button>
          <a
            href="/demo"
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              minHeight: 54,
              marginTop: 12,
              borderRadius: 15,
              background: "#f6f7f9",
              color: "#222830",
            }}
          >
            返回 Demo 首頁
          </a>
        </main>
      </body>
    </html>
  );
}
