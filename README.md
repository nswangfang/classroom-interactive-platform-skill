# 课堂互动台技能包 (Classroom Interactive Platform Skill)

> 专为教学场景打造的即插即用、开箱即用型课堂互动大屏工作台。
> 提供类似 ClassPoint 体验的座位表、学情灯、4款形态弹幕、高质感霓虹计时器、星星激励、点名、分组、抢答及师生权限分流体系。

---

## ✨ 核心特性

- 🧑‍🎓 **师生权限物理隔离**：默认学生端，防抢座、防改名、禁加星、工具箱隐藏；教师端通过全隐蔽黑点密码（`910325`）验证，支持一键免密自由双向秒切；
- 💬 **4款物理独立形态弹幕**：☁️云朵气泡、🌟金星勋章、🌈彩虹能量、🚀极速流星，全屏平稳滑过；
- ⏱️ **1:1 动态玻璃拟物霓虹计时器**：深蓝紫渐变、青蓝霓虹发光环、超大立体时间、双排按键与一键重置；
- ⭐ **游戏化激励体系**：全员加星（大三和弦）、个人加星（琵琶音）、飞星动效、撤回机制与星光榜；
- 🎲 **完整课堂工具箱**：大字随机选人点名（附礼花动效）、随机智能分组（剪贴板一键导出）、毫秒级防作弊抢答器；
- 📌 **独立运行与 Padlet 联动**：可单独全屏展示，也可作为透明互动层浮动在 Padlet 等任意第三方网页上方。

---

## 📁 目录结构

```text
classroom-interactive-platform/
├── SKILL.md                      # 技能操作规范与核心指南
├── README.md                     # 项目介绍与说明文档
├── components/
│   └── ClassroomSidebar.tsx      # 核心 React 互动台组件
├── styles/
│   └── classroom-interactive.css # 完整独立样式表
├── api/
│   └── route.ts                  # Cloudflare Workers / D1 后端路由处理
└── examples/
    └── standalone-page.tsx       # 独立运行与 Padlet 联动范例
```

---

## 🚀 快速使用

### 1. 引入组件与样式
```tsx
import ClassroomSidebar from "./components/ClassroomSidebar";
import "./styles/classroom-interactive.css";

export default function Page() {
  return (
    <div className="classroom-wrapper">
      <ClassroomSidebar />
    </div>
  );
}
```

### 2. 后端 API 路由
将 `api/route.ts` 部署在 Next.js 的 `app/api/classroom/route.ts` 或 Cloudflare Worker 路由下即可支持多端实时通信与数据持久化。

---

## 📄 授权与作者
Created with ❤️ by **nswangfang** for interactive classroom education.
