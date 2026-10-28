"use client";

import React, { useState } from "react";
import ClassroomSidebar from "../components/ClassroomSidebar";
import "../styles/classroom-interactive.css";

/**
 * 课堂互动台独立全屏展示页面范例 (Standalone Page Example)
 * 
 * 使用场景：
 * 1. 作为教室大屏幕主控台独立投屏（支持教师端管控与学生端大屏联动）；
 * 2. 嵌入外部教学白板（如 Padlet / 课件网页），顶部自由输入 Padlet 网址，
 *    弹幕、计时器、点名与抢答浮动在 Padlet 页面上方全屏交互！
 */
export default function ClassroomInteractiveStandalonePage() {
  const [padletUrl, setPadletUrl] = useState("https://padlet.com");
  const [inputUrl, setInputUrl] = useState("https://padlet.com");
  const [showUrlBar, setShowUrlBar] = useState(false);

  const handleApplyUrl = (e: React.FormEvent) => {
    e.preventDefault();
    let target = inputUrl.trim();
    if (!target) return;
    if (!target.startsWith("http://") && !target.startsWith("https://")) {
      target = "https://" + target;
    }
    setPadletUrl(target);
    setShowUrlBar(false);
  };

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden", display: "flex" }}>
      {/* 外部教学看板/Padlet 嵌入背景层 (70% 或全屏展示) */}
      <div style={{ flex: 1, position: "relative", height: "100%", background: "#f8fafc" }}>
        {/* 顶部极简地址切换栏（可折叠） */}
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 16,
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(255, 255, 255, 0.92)",
            backdropFilter: "blur(8px)",
            padding: "6px 12px",
            borderRadius: "10px",
            boxShadow: "0 4px 14px rgba(0,0,0,0.08)",
            border: "1px solid #cbd5e1",
          }}
        >
          {showUrlBar ? (
            <form onSubmit={handleApplyUrl} style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="请输入 Padlet 或教学网页链接"
                style={{
                  padding: "4px 8px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.85rem",
                  width: "280px",
                }}
              />
              <button
                type="submit"
                style={{
                  padding: "4px 10px",
                  background: "#0284c7",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                }}
              >
                加载页面
              </button>
              <button
                type="button"
                onClick={() => setShowUrlBar(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#64748b",
                  cursor: "pointer",
                  fontSize: "0.82rem",
                }}
              >
                取消
              </button>
            </form>
          ) : (
            <>
              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#0f172a" }}>
                📌 正在展示：{padletUrl}
              </span>
              <button
                type="button"
                onClick={() => setShowUrlBar(true)}
                style={{
                  padding: "3px 8px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  background: "#f1f5f9",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                更换链接
              </button>
            </>
          )}
        </div>

        {/* 嵌入的网页主内容 (iframe) */}
        <iframe
          src={padletUrl}
          title="Classroom Material / Padlet"
          style={{ width: "100%", height: "100%", border: "none" }}
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        />
      </div>

      {/* 课堂互动台侧边栏 (30% 弹性工作区) */}
      <div style={{ width: "360px", height: "100%", borderLeft: "1px solid #cbd5e1", overflowY: "auto", background: "#ffffff", padding: "14px" }}>
        <ClassroomSidebar />
      </div>
    </div>
  );
}
