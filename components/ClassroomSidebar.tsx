"use client";
import { useEffect, useRef, useState } from "react";

export type SeatStatus = "neutral" | "green" | "yellow" | "red";

export interface SeatInfo {
  seatNumber: number;
  studentName: string;
  status: SeatStatus;
  stars?: number;
  updatedAt: number;
}

export interface DanmakuItem {
  id: string;
  text: string;
  studentName: string;
  color: string;
  top: number; // in pixels from top
  duration: number;
}

export interface GroupItem {
  groupIndex: number;
  members: SeatInfo[];
}

export default function ClassroomSidebar({
  currentStudentName = "",
}: {
  currentStudentName?: string;
}) {
  const [seats, setSeats] = useState<SeatInfo[]>(() =>
    Array.from({ length: 30 }, (_, i) => ({
      seatNumber: i + 1,
      studentName: "",
      status: "neutral" as SeatStatus,
      stars: 0,
      updatedAt: 0,
    }))
  );

  const [mySeat, setMySeat] = useState<number | null>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("hcl_my_seat");
      return saved ? Number(saved) : null;
    }
    return null;
  });

  const [myName, setMyName] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const savedName = localStorage.getItem("hcl_my_name");
      if (savedName) return savedName;
    }
    return currentStudentName || "";
  });

  const [myStatus, setMyStatus] = useState<SeatStatus>("neutral");
  const [editingSeat, setEditingSeat] = useState<number | null>(null);
  const [studentActionSeat, setStudentActionSeat] = useState<SeatInfo | null>(null);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [animatingSeat, setAnimatingSeat] = useState<number | null>(null);
  const [inputName, setInputName] = useState("");
  const [danmakuEnabled, setDanmakuEnabled] = useState(false);
  const [danmakuList, setDanmakuList] = useState<DanmakuItem[]>([]);
  const [danmakuInput, setDanmakuInput] = useState("");
  const [danmakuSelectedStyle, setDanmakuSelectedStyle] = useState<'cloud' | 'badge' | 'gradient' | 'meteor'>('cloud');

  // Capacity selection: 1-10 by default, can be 1-20 or 1-30
  const [displayLimit, setDisplayLimit] = useState<10 | 20 | 30>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("hcl_classroom_capacity");
      if (saved === "10" || saved === "20" || saved === "30") return Number(saved) as 10 | 20 | 30;
    }
    return 10;
  });

  const handleSetDisplayLimit = (limit: 10 | 20 | 30) => {
    setDisplayLimit(limit);
    if (typeof window !== "undefined") {
      localStorage.setItem("hcl_classroom_capacity", String(limit));
    }
  };

  // Sidebar collapse toggle
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Teacher authorization & View Mode state (一次授权，免密自由双向切换)
  const [showTeacherAuthModal, setShowTeacherAuthModal] = useState(false);
  const [teacherInputPassword, setTeacherInputPassword] = useState("");
  const [teacherAuthError, setTeacherAuthError] = useState("");
  // Teacher authorization & View Mode state (一次授权，免密自由双向切换)
  const [hasTeacherAuth, setHasTeacherAuth] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("teacher") === "1" || urlParams.get("role") === "teacher") {
        sessionStorage.setItem("hcl_teacher_authorized", "1");
        return true;
      }
      return sessionStorage.getItem("hcl_teacher_authorized") === "1";
    }
    return false;
  });

  // Current active view: 'teacher' (管控模式) or 'student' (学生视角)
  const [activeRole, setActiveRole] = useState<'teacher' | 'student'>(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("teacher") === "1" || urlParams.get("role") === "teacher") {
        return 'teacher';
      }
      const savedAuth = sessionStorage.getItem("hcl_teacher_authorized") === "1";
      if (savedAuth) {
        const savedView = sessionStorage.getItem("hcl_classroom_view_mode");
        return savedView === 'student' ? 'student' : 'teacher';
      }
    }
    return 'student';
  });

  const isTeacher = hasTeacherAuth && activeRole === 'teacher';

  // Toggle between Teacher Mode and Student View freely (免密秒切)
  const handleToggleViewRole = () => {
    if (!hasTeacherAuth) {
      // Open stealthy masked password modal
      setTeacherInputPassword("");
      setTeacherAuthError("");
      setShowTeacherAuthModal(true);
      return;
    }

    // Already authorized: switch back and forth immediately
    if (activeRole === 'teacher') {
      setActiveRole('student');
      sessionStorage.setItem("hcl_classroom_view_mode", "student");
    } else {
      setActiveRole('teacher');
      sessionStorage.setItem("hcl_classroom_view_mode", "teacher");
    }
  };

  // Submit masked password from stealth modal
  const handleConfirmTeacherAuth = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (teacherInputPassword.trim() === "910325") {
      setHasTeacherAuth(true);
      setActiveRole('teacher');
      sessionStorage.setItem("hcl_teacher_authorized", "1");
      sessionStorage.setItem("hcl_classroom_view_mode", "teacher");
      setShowTeacherAuthModal(false);
      setTeacherInputPassword("");
      setTeacherAuthError("");
    } else {
      setTeacherAuthError("访问码不正确");
    }
  };

  // Completely log out of teacher authorization
  const handleLogoutTeacher = () => {
    if (window.confirm("确定要完全退出教师身份授权吗？退出后重新进入需要再次输入访问码。")) {
      setHasTeacherAuth(false);
      setActiveRole('student');
      sessionStorage.removeItem("hcl_teacher_authorized");
      sessionStorage.removeItem("hcl_classroom_view_mode");
    }
  };

  // Buzzer state
  const [activeBuzzer, setActiveBuzzer] = useState<{
    buzzId: string;
    title: string;
    countdown: number;
    startTime: number;
    winner?: string;
    winnerSeat?: number;
  } | null>(null);
  const [buzzerCountdownLeft, setBuzzerCountdownLeft] = useState<number>(0);
  const [buzzerCanHit, setBuzzerCanHit] = useState(false);
  const [hasBuzzed, setHasBuzzed] = useState(false);

  // Random Name Picker (🎲 随机选人)
  const [pickerModal, setPickerModal] = useState(false);
  const [rollingName, setRollingName] = useState("");
  const [isRolling, setIsRolling] = useState(false);
  const [pickerWinner, setPickerWinner] = useState<{ name: string; seat: number } | null>(null);

  // Random Group Maker (👥 随机分组)
  const [groupModal, setGroupModal] = useState(false);
  const [groupSize, setGroupSize] = useState<number>(2);
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [copiedHint, setCopiedHint] = useState(false);

  // Classroom Timer (⏱️ 计时器，可拖拽钟表样式)
  const [timerModal, setTimerModal] = useState(false);
  const [timerTotalSeconds, setTimerTotalSeconds] = useState(180); // Default 3 min
  const [timerSecondsLeft, setTimerSecondsLeft] = useState(180);
  const [timerIsRunning, setTimerIsRunning] = useState(false);
  const [timerTimeUp, setTimerTimeUp] = useState(false);
  const [timerPos, setTimerPos] = useState({ x: 100, y: 100 });
  const [isDraggingTimer, setIsDraggingTimer] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initX: number; initY: number }>({
    startX: 0,
    startY: 0,
    initX: 100,
    initY: 100,
  });

  // Leaderboard Modal (⭐ 课堂星光榜)
  const [leaderboardModal, setLeaderboardModal] = useState(false);
  const [rewardToast, setRewardToast] = useState<string | null>(null);

  const lastEventTimeRef = useRef<number>(Date.now() - 5000);
  const lastLocalActionTimeRef = useRef<number>(0);
  const pollingTimerRef = useRef<any>(null);

  // Sync initial name if passed
  useEffect(() => {
    if (currentStudentName && !myName) {
      setMyName(currentStudentName);
      localStorage.setItem("hcl_my_name", currentStudentName);
    }
  }, [currentStudentName, myName]);

  // If user already had a seat, restore status & ensure displayLimit encompasses their seat
  useEffect(() => {
    if (mySeat) {
      const found = seats.find((s) => s.seatNumber === mySeat);
      if (found && found.studentName.trim().length > 0) {
        setMyStatus(found.status);
      }
      if (mySeat > 20 && displayLimit < 30) {
        setDisplayLimit(30);
      } else if (mySeat > 10 && displayLimit < 20) {
        setDisplayLimit(20);
      }
    }
  }, [mySeat, seats, displayLimit]);

  // Sync initial window placement for timer
  useEffect(() => {
    if (typeof window !== "undefined") {
      const defaultX = Math.max(20, Math.floor((window.innerWidth - 320) / 2));
      const defaultY = Math.max(60, Math.floor((window.innerHeight - 380) / 3));
      setTimerPos({ x: defaultX, y: defaultY });
    }
  }, []);

  // Dragging event listeners for timer
  useEffect(() => {
    if (!isDraggingTimer) return;
    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartRef.current.startX;
      const dy = e.clientY - dragStartRef.current.startY;
      setTimerPos({
        x: Math.max(10, Math.min(window.innerWidth - 330, dragStartRef.current.initX + dx)),
        y: Math.max(10, Math.min(window.innerHeight - 390, dragStartRef.current.initY + dy)),
      });
    };
    const handleMouseUp = () => setIsDraggingTimer(false);
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 0) return;
      const t = e.touches[0];
      const dx = t.clientX - dragStartRef.current.startX;
      const dy = t.clientY - dragStartRef.current.startY;
      setTimerPos({
        x: Math.max(10, Math.min(window.innerWidth - 330, dragStartRef.current.initX + dx)),
        y: Math.max(10, Math.min(window.innerHeight - 390, dragStartRef.current.initY + dy)),
      });
    };
    const handleTouchEnd = () => setIsDraggingTimer(false);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isDraggingTimer]);

  const handleStartDrag = (clientX: number, clientY: number) => {
    setIsDraggingTimer(true);
    dragStartRef.current = {
      startX: clientX,
      startY: clientY,
      initX: timerPos.x,
      initY: timerPos.y,
    };
  };

  // Web Audio chime for individual star reward: Crisp crystal ding (Single, 0.32s)
  const playSingleStarChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      
      // Note 1: E6 (1318.51 Hz) -> Note 2: A6 (1760 Hz) light arpeggio
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "triangle";
      osc1.frequency.setValueAtTime(1318.51, now);
      gain1.gain.setValueAtTime(0.35, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.22);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(1760, now + 0.1);
      gain2.gain.setValueAtTime(0.4, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.35);
    } catch {}
  };

  // Web Audio chime for ALL students reward: Grand celebratory major chord (Single, 0.6s)
  const playAllStarsChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      // Grand celebratory C major triad (C5, E5, G5, C6)
      const freqs = [523.25, 659.25, 783.99, 1046.50];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.04);
        gain.gain.setValueAtTime(0.28, now + idx * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.58);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.04);
        osc.stop(now + 0.58);
      });
    } catch {}
  };

  // Web Audio chime for revoke star (soft lower 'pop' sound)
  const playRevokeChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.18);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.18);
    } catch {}
  };

  // Web Audio chime for timer finish: exactly 1 single crisp chime note
  const playTimerChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // Single crisp chime (880Hz, rings exactly once and fades out)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.9);
    } catch {}
  };

  // Timer countdown effect
  useEffect(() => {
    if (!timerIsRunning) return;
    const interval = setInterval(() => {
      setTimerSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setTimerIsRunning(false);
          setTimerTimeUp(true);
          playTimerChime();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerIsRunning]);

  // Polling server for seats and events
  const fetchClassroomState = async () => {
    try {
      const res = await fetch(`/api/classroom?since=${lastEventTimeRef.current}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.ok) {
        if (Array.isArray(data.seats)) {
          setSeats(data.seats);
          if (mySeat) {
            const current = data.seats.find((s: SeatInfo) => s.seatNumber === mySeat);
            if (current) setMyStatus(current.status);
          }
        }

        if (Array.isArray(data.events) && data.events.length > 0) {
          for (const ev of data.events) {
            if (ev.createdAt > lastEventTimeRef.current) {
              lastEventTimeRef.current = ev.createdAt;
            }

            // Handle Danmaku event (Run TWICE with longer interval, STRICT TOP TRACKS ONLY)
            if (ev.eventType === "danmaku") {
              const payload = ev.payload;
              if (danmakuEnabled && payload?.text) {
                const addDanmaku = (delayMs: number, subId: string) => {
                  setTimeout(() => {
                    const topTracks = [12, 44, 76]; // Strict top tracks in px
                    const chosenTop = topTracks[Math.floor(Math.random() * topTracks.length)];
                    const sType = payload.styleType || 'cloud';
                    const newItem: DanmakuItem = {
                      id: "dm_" + Math.random().toString(36).slice(2) + subId,
                      text: payload.text,
                      studentName: payload.studentName || "同学",
                      color: payload.color || "#0284c7",
                      top: chosenTop,
                      duration: sType === 'meteor' ? 5.5 : sType === 'cloud' ? 6.8 : sType === 'badge' ? 8.0 : 7.2,
                      styleType: sType,
                    };
                    setDanmakuList((prev) => [...prev.slice(-20), newItem]);
                  }, delayMs);
                };
                addDanmaku(0, "_1");
                addDanmaku(4500, "_2");
              }
            }

            // Handle Buzzer Start
            if (ev.eventType === "buzzer_start") {
              const p = ev.payload;
              setActiveBuzzer({
                buzzId: p.buzzId,
                title: "",
                countdown: p.countdown || 3,
                startTime: p.startTime,
              });
              setHasBuzzed(false);
            }

            // Handle Buzzer Hit (Winner)
            if (ev.eventType === "buzzer_hit") {
              const p = ev.payload;
              setActiveBuzzer((prev) => {
                if (!prev) return null;
                return {
                  ...prev,
                  winner: p.studentName,
                  winnerSeat: p.seatNumber,
                };
              });
            }

            // Handle Buzzer Reset
            if (ev.eventType === "buzzer_reset") {
              setActiveBuzzer(null);
              setHasBuzzed(false);
            }

            // Handle Picker Result
            if (ev.eventType === "picker_result") {
              const p = ev.payload;
              setPickerWinner({ name: p.winnerName, seat: p.winnerSeat });
            }

            // Handle Star Reward (Only play chime if not triggered locally in the last 1500ms)
            if (ev.eventType === "star_reward" && ev.payload) {
              const delta = ev.payload.delta !== undefined ? ev.payload.delta : 1;
              if (delta > 0) {
                setRewardToast(`⭐ 为 ${ev.payload.studentName || ""} 同学加了 1 颗星！`);
                if (Date.now() - lastLocalActionTimeRef.current > 1500) {
                  playSingleStarChime();
                }
              } else {
                setRewardToast(`↩️ 已撤回 ${ev.payload.studentName || ""} 同学的 1 颗星`);
                if (Date.now() - lastLocalActionTimeRef.current > 1500) {
                  playRevokeChime();
                }
              }
              setTimeout(() => setRewardToast(null), 3000);
            }

            // Handle All Stars Reward (Only play chime if not triggered locally in the last 1500ms)
            if (ev.eventType === "all_stars_reward" && ev.payload) {
              setRewardToast("🌟 全员加星！所有在座同学各加 1 颗星！");
              setTimeout(() => setRewardToast(null), 3000);
              if (Date.now() - lastLocalActionTimeRef.current > 1500) {
                playAllStarsChime();
              }
            }

            // Handle Seats Reset by Teacher
            if (ev.eventType === "seats_reset") {
              setSeats(
                Array.from({ length: 30 }, (_, i) => ({
                  seatNumber: i + 1,
                  studentName: "",
                  status: "neutral",
                  updatedAt: 0,
                }))
              );
              setMySeat(null);
              setMyName("");
              setMyStatus("neutral");
              localStorage.removeItem("hcl_my_seat");
              localStorage.removeItem("hcl_my_name");
            }
          }
        }
      }
    } catch {}
  };

  useEffect(() => {
    fetchClassroomState();
    const interval = activeBuzzer && !activeBuzzer.winner ? 1200 : 2500;
    pollingTimerRef.current = setInterval(fetchClassroomState, interval);
    return () => clearInterval(pollingTimerRef.current);
  }, [activeBuzzer, danmakuEnabled, mySeat]);

  // Buzzer countdown timer logic
  useEffect(() => {
    if (!activeBuzzer || activeBuzzer.winner) {
      setBuzzerCountdownLeft(0);
      setBuzzerCanHit(false);
      return;
    }
    const timer = setInterval(() => {
      const remainingMs = activeBuzzer.startTime - Date.now();
      if (remainingMs <= 0) {
        setBuzzerCountdownLeft(0);
        setBuzzerCanHit(true);
      } else {
        setBuzzerCountdownLeft(Math.ceil(remainingMs / 1000));
        setBuzzerCanHit(false);
      }
    }, 200);
    return () => clearInterval(timer);
  }, [activeBuzzer]);

  // Clean up completed danmaku
  useEffect(() => {
    if (danmakuList.length === 0) return;
    const timer = setTimeout(() => {
      setDanmakuList((prev) => prev.slice(1));
    }, 9000);
    return () => clearTimeout(timer);
  }, [danmakuList]);

  // Select seat and bind name (STRICTLY ISOLATED: Default is ALWAYS neutral, status buttons untouched until explicitly clicked)
  const handleClaimSeat = async (seatNum: number, nameToSet: string) => {
    const finalName = nameToSet.trim() || myName || `学生${seatNum}`;
    const defaultStatus: SeatStatus = "neutral";
    setMySeat(seatNum);
    setMyName(finalName);
    setMyStatus("neutral"); // Reset local status indicator so traffic buttons stay unselected
    localStorage.setItem("hcl_my_seat", String(seatNum));
    localStorage.setItem("hcl_my_name", finalName);
    setEditingSeat(null);

    setSeats((prev) =>
      prev.map((s) =>
        s.seatNumber === seatNum ? { ...s, studentName: finalName, status: defaultStatus } : s
      )
    );

    try {
      await fetch("/api/classroom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "claim_seat",
          seatNumber: seatNum,
          studentName: finalName,
          status: defaultStatus,
        }),
      });
    } catch {}
  };

  // Change status (🟢 绿灯 / 🟡 黄灯 / 🔴 红灯)
  const handleChangeStatus = async (newStatus: SeatStatus) => {
    setMyStatus(newStatus);
    if (!mySeat) {
      alert("请先在上方座位表中选择您的号码并输入华文名！");
      return;
    }

    setSeats((prev) =>
      prev.map((s) =>
        s.seatNumber === mySeat ? { ...s, status: newStatus, studentName: myName } : s
      )
    );

    try {
      await fetch("/api/classroom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_status",
          seatNumber: mySeat,
          status: newStatus,
          studentName: myName,
        }),
      });
    } catch {}
  };

  // Teacher Reset Seats
  const handleResetClassroomSeats = async () => {
    const confirmed = window.confirm("确定要清空全班已占用的座位与姓名，重新开始一轮选座吗？");
    if (!confirmed) return;

    try {
      await fetch("/api/classroom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_seats" }),
      });
      setSeats(
        Array.from({ length: 30 }, (_, i) => ({
          seatNumber: i + 1,
          studentName: "",
          status: "neutral",
          updatedAt: 0,
        }))
      );
      setMySeat(null);
      setMyName("");
      setMyStatus("neutral");
      localStorage.removeItem("hcl_my_seat");
      localStorage.removeItem("hcl_my_name");
      alert("全班座位已全部清空，可以重新开始选座！");
    } catch {
      alert("清空操作失败，请重试");
    }
  };

  // Handle single star reward or revoke (delta: +1 or -1)
  const handleRewardStar = async (seatNumber: number, studentName: string, delta: number = 1) => {
    if (!studentName.trim()) return;
    lastLocalActionTimeRef.current = Date.now();

    if (delta > 0) {
      setAnimatingSeat(seatNumber);
      setTimeout(() => setAnimatingSeat(null), 1200);
      playSingleStarChime();
    } else {
      playRevokeChime();
    }

    setSeats((prev) =>
      prev.map((s) =>
        s.seatNumber === seatNumber
          ? { ...s, stars: Math.max(0, (s.stars || 0) + delta) }
          : s
      )
    );
    if (studentActionSeat && studentActionSeat.seatNumber === seatNumber) {
      setStudentActionSeat((prev) =>
        prev ? { ...prev, stars: Math.max(0, (prev.stars || 0) + delta) } : null
      );
    }

    try {
      await fetch("/api/classroom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reward_star",
          seatNumber,
          studentName,
          delta,
        }),
      });
    } catch {
      // Optimistic update retained
    }
  };

  // Handle all students star reward (ClassPoint style: silent background sync, chimes, stars updated)
  const handleRewardAllStars = async () => {
    const seatedCount = seats.filter((s) => s.studentName.trim().length > 0).length;
    if (seatedCount === 0) {
      alert("目前暂无就座的学生，请先让学生选择座位并输入姓名。");
      return;
    }

    setSeats((prev) =>
      prev.map((s) =>
        s.studentName.trim().length > 0
          ? { ...s, stars: (s.stars || 0) + 1 }
          : s
      )
    );
    if (studentActionSeat && studentActionSeat.studentName.trim().length > 0) {
      setStudentActionSeat((prev) =>
        prev ? { ...prev, stars: (prev.stars || 0) + 1 } : null
      );
    }
    lastLocalActionTimeRef.current = Date.now();
    playAllStarsChime();

    try {
      await fetch("/api/classroom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reward_all_stars" }),
      });
    } catch {
      // Optimistic
    }
  };

  // Send Danmaku (Shown twice, top area only, with selected style)
  const handleSendDanmaku = async () => {
    const text = danmakuInput.trim();
    if (!text) return;
    setDanmakuInput("");

    const topTracks = [12, 44, 76];
    const chosenTop = topTracks[Math.floor(Math.random() * topTracks.length)];
    const chosenStyle = danmakuSelectedStyle;

    const addLocalDanmaku = (delayMs: number, subId: string) => {
      setTimeout(() => {
        const newItem: DanmakuItem = {
          id: "dm_local_" + Date.now() + subId,
          text,
          studentName: myName || (mySeat ? `${mySeat}号` : "同学"),
          color: myStatus === "green" ? "#16a34a" : myStatus === "yellow" ? "#d97706" : myStatus === "red" ? "#dc2626" : "#475569",
          top: chosenTop,
          duration: chosenStyle === 'meteor' ? 5.5 : chosenStyle === 'cloud' ? 6.8 : chosenStyle === 'badge' ? 8.0 : 7.2,
          styleType: chosenStyle as any,
        };
        setDanmakuList((prev) => [...prev.slice(-20), newItem]);
      }, delayMs);
    };

    addLocalDanmaku(0, "_1");
    addLocalDanmaku(4500, "_2");

    try {
      await fetch("/api/classroom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "danmaku",
          text,
          studentName: myName || (mySeat ? `${mySeat}号` : "同学"),
          color: myStatus === "green" ? "#16a34a" : myStatus === "yellow" ? "#d97706" : myStatus === "red" ? "#dc2626" : "#475569",
          styleType: chosenStyle,
        }),
      });
    } catch {}
  };

  // Buzzer: Trigger new round
  const handleStartBuzzer = async () => {
    try {
      await fetch("/api/classroom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "buzzer_start",
          title: "",
          countdown: 3,
        }),
      });
      fetchClassroomState();
    } catch {}
  };

  // Buzzer: Hit
  const handleHitBuzzer = async () => {
    if (!buzzerCanHit || hasBuzzed || !activeBuzzer) return;
    setHasBuzzed(true);
    try {
      await fetch("/api/classroom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "buzzer_hit",
          buzzId: activeBuzzer.buzzId,
          studentName: myName || (mySeat ? `${mySeat}号` : "同学"),
          seatNumber: mySeat || 0,
        }),
      });
      fetchClassroomState();
    } catch {}
  };

  // Buzzer: Close / Reset
  const handleResetBuzzer = async () => {
    try {
      await fetch("/api/classroom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "buzzer_reset" }),
      });
      setActiveBuzzer(null);
    } catch {}
  };

  // Random Name Picker (🎲 随机选人)
  const handleRollPicker = () => {
    setPickerModal(true);
    setPickerWinner(null);
    setIsRolling(true);

    const candidates = seats.filter(
      (s) => s.seatNumber <= displayLimit && s.studentName.trim().length > 0
    );
    const pool =
      candidates.length > 0
        ? candidates
        : seats
            .filter((s) => s.seatNumber <= displayLimit)
            .map((s) => ({
              ...s,
              studentName: s.studentName || `${s.seatNumber}号`,
            }));

    let rollCount = 0;
    const maxRolls = 25;
    const interval = setInterval(() => {
      const rand = pool[Math.floor(Math.random() * pool.length)];
      setRollingName(`${rand.seatNumber}号 ${rand.studentName}`);
      rollCount++;
      if (rollCount >= maxRolls) {
        clearInterval(interval);
        setIsRolling(false);
        const winner = pool[Math.floor(Math.random() * pool.length)];
        setRollingName(`${winner.seatNumber}号 ${winner.studentName}`);
        setPickerWinner({ name: winner.studentName, seat: winner.seatNumber });

        fetch("/api/classroom", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "picker_roll",
            winnerSeat: winner.seatNumber,
            winnerName: winner.studentName,
          }),
        }).catch(() => {});
      }
    }, 90);
  };

  // Random Group Maker (👥 随机分组)
  const handleGenerateGroups = (targetSize: number) => {
    setGroupSize(targetSize);
    const active = seats.filter(
      (s) => s.seatNumber <= displayLimit && s.studentName.trim().length > 0
    );
    const sourcePool =
      active.length > 0
        ? [...active]
        : seats
            .filter((s) => s.seatNumber <= displayLimit)
            .map((s) => ({ ...s, studentName: s.studentName || `${s.seatNumber}号` }));

    // Fisher-Yates shuffle
    for (let i = sourcePool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [sourcePool[i], sourcePool[j]] = [sourcePool[j], sourcePool[i]];
    }

    const result: GroupItem[] = [];
    let groupIdx = 1;
    for (let i = 0; i < sourcePool.length; i += targetSize) {
      result.push({
        groupIndex: groupIdx++,
        members: sourcePool.slice(i, i + targetSize),
      });
    }
    setGroups(result);
  };

  // Copy Group List to clipboard
  const handleCopyGroups = () => {
    if (groups.length === 0) return;
    const text =
      `【课堂随机分组（每组${groupSize}人）】\n` +
      groups
        .map(
          (g) =>
            `第${g.groupIndex}组：` +
            g.members.map((m) => `${m.seatNumber}号 ${m.studentName}`).join("、")
        )
        .join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopiedHint(true);
      setTimeout(() => setCopiedHint(false), 2000);
    });
  };

  // Timer controls
  const handleSetTimerPreset = (secs: number) => {
    setTimerIsRunning(false);
    setTimerTimeUp(false);
    setTimerTotalSeconds(secs);
    setTimerSecondsLeft(secs);
  };

  const handleStartTimer = () => {
    if (timerSecondsLeft <= 0) {
      setTimerSecondsLeft(timerTotalSeconds);
    }
    setTimerTimeUp(false);
    setTimerIsRunning(true);
  };

  const handlePauseTimer = () => {
    setTimerIsRunning(false);
  };

  const handleResetTimer = () => {
    setTimerIsRunning(false);
    setTimerTimeUp(false);
    setTimerSecondsLeft(timerTotalSeconds);
  };

  const handleAdd30s = () => {
    setTimerSecondsLeft((prev) => prev + 30);
    setTimerTotalSeconds((prev) => prev + 30);
    setTimerTimeUp(false);
  };

  const displayedSeats = seats.filter((s) => s.seatNumber <= displayLimit);

  // Format MM:SS for timer
  const formatTimerDigits = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Calculate SVG circular arc progress
  const clockRadius = 88;
  const clockCircumference = 2 * Math.PI * clockRadius;
  const progressRatio = timerTotalSeconds > 0 ? timerSecondsLeft / timerTotalSeconds : 0;
  const strokeDashoffset = clockCircumference * (1 - progressRatio);

  // Sorted list for Leaderboard (⭐ 课堂星光榜)
  const rankedStudents = [...seats]
    .filter((s) => s.studentName.trim().length > 0)
    .sort((a, b) => (b.stars || 0) - (a.stars || 0));

  return (
    <>
      {/* Toast Notification for Star Rewards & System Events */}
      {rewardToast && (
        <div className="classroom-toast-banner" role="status">
          {rewardToast}
        </div>
      )}

      {/* Floating Danmaku Canvas: STRICTLY TOP BANNER TRACKS ONLY (top: 0 to 112px) */}
      {danmakuEnabled && (
        <div className="classroom-danmaku-container" aria-hidden="true">
          {danmakuList.map((dm) => {
            const st = dm.styleType || 'cloud';
            const flightStyle: React.CSSProperties = {
              top: `${dm.top}px`,
              animation: `danmaku-move ${dm.duration || 7}s linear forwards`,
            };

            return (
              <div
                key={dm.id}
                className={`danmaku-flight-wrapper danmaku-${st}`}
                style={flightStyle}
              >
                {st === 'cloud' && (
                  <div className="bubble-cloud-shape">
                    <span className="bubble-icon">💬</span>
                    <span className="bubble-name">{dm.studentName}:</span>
                    <span className="bubble-text">{dm.text}</span>
                  </div>
                )}

                {st === 'badge' && (
                  <div className="bubble-badge-shape">
                    <span className="bubble-icon">🌟</span>
                    <span className="bubble-name">{dm.studentName}:</span>
                    <span className="bubble-text">{dm.text}</span>
                  </div>
                )}

                {st === 'gradient' && (
                  <div className="bubble-gradient-shape">
                    <span className="bubble-icon">🌈</span>
                    <span className="bubble-name">{dm.studentName}:</span>
                    <span className="bubble-text">{dm.text}</span>
                  </div>
                )}

                {st === 'meteor' && (
                  <div className="bubble-meteor-shape">
                    <span className="bubble-icon">🚀</span>
                    <span className="bubble-name">{dm.studentName}:</span>
                    <span className="bubble-text">{dm.text}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Classroom Interactive Sidebar (占版面30%，可隐藏/折叠) */}
      <aside className={`classroom-sidebar ${isCollapsed ? "collapsed" : ""}`}>
        {/* Header with Title and Toggle */}
        <div className="sidebar-top-bar">
          <div className="sidebar-title">
            <span className="sidebar-main-heading">课堂互动台</span>
            <span className={`classroom-role-badge ${isTeacher ? "teacher" : "student"}`}>
              {isTeacher ? "👨‍🏫 教师端" : "🧑‍🎓 学生端"}
            </span>
          </div>

          <div className="sidebar-actions-right">
            {hasTeacherAuth ? (
              <div className="teacher-view-switch-group">
                <button
                  type="button"
                  className={`btn-view-switch ${isTeacher ? "is-teacher-btn" : "is-student-btn"}`}
                  onClick={handleToggleViewRole}
                  title={isTeacher ? "切换至学生端视图" : "切换至教师端视图"}
                >
                  {isTeacher ? "🧑‍🎓 学生端" : "👨‍🏫 教师端"}
                </button>
                <button
                  type="button"
                  className="btn-view-logout"
                  onClick={handleLogoutTeacher}
                  title="退出教师授权"
                >
                  🚪
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="sidebar-teacher-toggle-btn"
                onClick={handleToggleViewRole}
                title="教师身份认证"
              >
                🔑 教师端
              </button>
            )}
            <button
              type="button"
              className="sidebar-toggle-btn"
              onClick={() => setIsCollapsed(!isCollapsed)}
              title={isCollapsed ? "展开互动台" : "隐藏互动台"}
            >
              {isCollapsed ? "展开 ▾" : "隐藏 ▴"}
            </button>
          </div>
        </div>

        {/* Collapsed State Prompt */}
        {isCollapsed && (
          <div
            className="sidebar-collapsed-prompt"
            onClick={() => setIsCollapsed(false)}
          >
            <span>点击展开功能 ▾</span>
          </div>
        )}

        {/* Expanded Functions in Exact User Requested Order */}
        {!isCollapsed && (
          <div className="classroom-sidebar-inner">
            {/* =========================================
                第一部分：座位表（请选择号码并输入华文名）
               ========================================= */}
            <div className="classroom-section-box seats-section-box">
              <div className="section-header-row">
                <div className="section-title-wrap">
                  <span className="section-title"><b>座位表</b></span>
                  <span className="seats-guide-hint">（请选择号码并输入华文名）</span>
                </div>
                <div className="header-right-controls">
                  <div className="seat-range-tabs">
                    <button
                      type="button"
                      className={`range-tab-btn ${displayLimit === 10 ? "active" : ""}`}
                      onClick={() => handleSetDisplayLimit(10)}
                    >
                      1-10号
                    </button>
                    <button
                      type="button"
                      className={`range-tab-btn ${displayLimit === 20 ? "active" : ""}`}
                      onClick={() => handleSetDisplayLimit(20)}
                    >
                      1-20号
                    </button>
                    <button
                      type="button"
                      className={`range-tab-btn ${displayLimit === 30 ? "active" : ""}`}
                      onClick={() => handleSetDisplayLimit(30)}
                    >
                      1-30号
                    </button>
                  </div>
                  {isTeacher && (
                    <button
                      type="button"
                      className="btn-reset-seats-inline"
                      onClick={handleResetClassroomSeats}
                      title="清空全班座位并重新开始选座"
                    >
                      🔄 清空座位
                    </button>
                  )}
                </div>
              </div>

              {/* Row 2: [ 全员加星⭐ ] and [ 个人加星⭐ ] on the same row (Only teacher has star-granting rights) */}
              {isTeacher && (
                <div className="seats-star-action-row">
                  <button
                    type="button"
                    className="btn-star-row-action btn-star-all"
                    onClick={handleRewardAllStars}
                    title="为全班所有在座同学各加 1 颗星"
                  >
                    全员加星⭐
                  </button>
                  <button
                    type="button"
                    className="btn-star-row-action btn-star-single"
                    onClick={() => {
                      const seated = seats.filter((s) => s.studentName.trim().length > 0 && s.seatNumber <= displayLimit);
                      if (seated.length === 0) {
                        alert("目前暂无就座的学生，请先让学生点击号码入座。");
                        return;
                      }
                      if (studentActionSeat) {
                        handleRewardStar(studentActionSeat.seatNumber, studentActionSeat.studentName);
                      } else {
                        setStudentActionSeat(seated[0]);
                      }
                    }}
                    title="为个人加 1 颗星（或直接点击学生卡片）"
                  >
                    个人加星⭐
                  </button>
                </div>
              )}

              {/* Displayed Seats Grid */}
              <div
                className={`seats-grid ${
                  displayLimit === 10 ? "grid-10" : displayLimit === 20 ? "grid-20" : "grid-30"
                }`}
              >
                {displayedSeats.map((seat) => {
                  const isMine = mySeat === seat.seatNumber;
                  const hasName = seat.studentName.trim().length > 0;
                  const isAnimating = animatingSeat === seat.seatNumber;

                  return (
                    <div
                      key={seat.seatNumber}
                      className={`seat-cell status-${seat.status} ${isMine ? "is-mine" : ""} ${
                        isAnimating ? "star-pulse-anim" : ""
                      }`}
                      onClick={() => {
                        if (hasName) {
                          // Seated student: opens student card
                          setStudentActionSeat(seat);
                        } else {
                          // Unseated empty seat:
                          if (!isTeacher && mySeat !== null) {
                            alert(`您已经选择了 ${mySeat} 号座位，不可更换或抢占其他同学的座位。`);
                            return;
                          }
                          setEditingSeat(seat.seatNumber);
                          setInputName(myName);
                        }
                      }}
                      title={hasName ? `点击查看/为 ${seat.studentName} 同学加星星` : `点击输入姓名 ${seat.seatNumber}号`}
                    >
                      {/* Back-of-card star burst indicator */}
                      {isAnimating && (
                        <div className="card-star-floating-burst" aria-hidden="true">
                          +1⭐
                        </div>
                      )}

                      <div className="seat-card-inner">
                        <div className="seat-face-front">
                          <div className="seat-num-center">{seat.seatNumber}</div>
                          <div className="seat-name">
                            {hasName ? seat.studentName : ""}
                          </div>
                          <span className={`status-indicator ${seat.status}`} />
                        </div>
                        {hasName && (seat.stars || 0) > 0 && (
                          <div className="seat-face-back" title={`${seat.studentName} 同学共获得 ${seat.stars} 颗星`}>
                            <div className="seat-num-back">{seat.seatNumber}</div>
                            <div className="seat-stars-count">⭐×{seat.stars}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* =========================================
                第二部分：我的学情（请点选）
               ========================================= */}
            <div className="classroom-section-box status-section-box">
              <div className="section-header-row">
                <span className="section-title"><b>我的学情（请点选）</b></span>
                <div className="my-seat-badge">
                  {mySeat ? (
                    <span className="seated-tag">
                      当前：<b>{mySeat}号</b>（{myName || "未命名"}）
                    </span>
                  ) : (
                    <span className="unseated-tag">未入座（请在上方点击号码）</span>
                  )}
                </div>
              </div>

              {/* 3色学情按钮 */}
              <div className="traffic-button-group">
                <button
                  type="button"
                  className={`traffic-btn green ${myStatus === "green" ? "active" : ""}`}
                  onClick={() => handleChangeStatus("green")}
                >
                  <span className="traffic-text">🟢 绿灯（我可以做）</span>
                </button>

                <button
                  type="button"
                  className={`traffic-btn yellow ${myStatus === "yellow" ? "active" : ""}`}
                  onClick={() => handleChangeStatus("yellow")}
                >
                  <span className="traffic-text">🟡 黄灯（需要AI帮忙）</span>
                </button>

                <button
                  type="button"
                  className={`traffic-btn red ${myStatus === "red" ? "active" : ""}`}
                  onClick={() => handleChangeStatus("red")}
                >
                  <span className="traffic-text">🔴 红灯（请老师指点）</span>
                </button>
              </div>
            </div>

            {/* =========================================
                第三部分：互动工具（字体颜色一律纯黑，杜绝颜色纷杂）
                1. 随机选人 2. 随机分组 3. 计时器 4. 抢答 5. 弹幕
               ========================================= */}
            <div className="classroom-section-box tools-section-box">
              <div className="tools-grid-bar">
                {isTeacher ? (
                  <>
                    <button
                      type="button"
                      className="tool-action-btn neutral-clean"
                      onClick={handleRollPicker}
                      title="随机选人"
                    >
                      🎲 随机选人
                    </button>

                    <button
                      type="button"
                      className="tool-action-btn neutral-clean"
                      onClick={() => {
                        setGroupModal(true);
                        if (groups.length === 0) handleGenerateGroups(groupSize);
                      }}
                      title="随机分组"
                    >
                      👥 随机分组
                    </button>

                    <button
                      type="button"
                      className="tool-action-btn neutral-clean"
                      onClick={() => setLeaderboardModal(true)}
                      title="课堂星光榜（查看全班同学星星排行榜）"
                    >
                      ⭐ 课堂星光榜
                    </button>

                    <button
                      type="button"
                      className="tool-action-btn neutral-clean"
                      onClick={() => setTimerModal(true)}
                      title="课堂计时器"
                    >
                      ⏱️ 计时器
                    </button>

                    <button
                      type="button"
                      className="tool-action-btn neutral-clean"
                      onClick={handleStartBuzzer}
                      title="发起抢答"
                    >
                      ⚡ 抢答
                    </button>

                    <button
                      type="button"
                      className={`tool-action-btn neutral-clean ${danmakuEnabled ? "active-danmaku-btn" : ""}`}
                      onClick={() => setDanmakuEnabled(!danmakuEnabled)}
                      title="开启/关闭弹幕"
                    >
                      💬 弹幕{danmakuEnabled ? "开" : "关"}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="tool-action-btn neutral-clean"
                      onClick={() => setLeaderboardModal(true)}
                      title="课堂星光榜（查看全班同学星星排行榜）"
                      style={{ gridColumn: 'span 3' }}
                    >
                      ⭐ 课堂星光榜（查看我的荣誉与全班排行）
                    </button>
                  </>
                )}
              </div>

              {/* Danmaku Input: 仅当老师开启弹幕时展示发送框 */}
              {danmakuEnabled && (
                <div className="danmaku-sender-box">
                  <div className="danmaku-style-selector">
                    <span className="style-selector-label">弹幕形式：</span>
                    {[
                      { id: 'cloud', label: '☁️ 云朵' },
                      { id: 'badge', label: '🌟 勋章' },
                      { id: 'gradient', label: '🌈 彩虹' },
                      { id: 'meteor', label: '🚀 流星' },
                    ].map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        className={`danmaku-style-btn ${danmakuSelectedStyle === st.id ? 'active' : ''}`}
                        onClick={() => setDanmakuSelectedStyle(st.id as any)}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                  <form
                    className="danmaku-input-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendDanmaku();
                    }}
                  >
                    <input
                      type="text"
                      placeholder="发一条弹幕和全班互动..."
                      value={danmakuInput}
                      onChange={(e) => setDanmakuInput(e.target.value)}
                      maxLength={35}
                    />
                    <button type="submit" disabled={!danmakuInput.trim()}>
                      发送
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        )}
      </aside>

      {/* =========================================
          MODALS
         ========================================= */}

      {/* Modal 1A: Student Card & Star Reward (ClassPoint style: 点按学生卡片，加1颗星或修改姓名) */}
      {studentActionSeat && (
        <div className="classroom-modal-backdrop" onClick={() => setStudentActionSeat(null)}>
          <div
            className="student-card-modal-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close-btn"
              onClick={() => setStudentActionSeat(null)}
            >
              ✕
            </button>

            <div className="student-modal-header-zone">
              <span className="student-modal-seat-num">#{studentActionSeat.seatNumber}号座位</span>
              <h2 className="student-modal-student-name">{studentActionSeat.studentName}</h2>
              <div className="student-modal-star-count">
                当前已获：<b>⭐ × {studentActionSeat.stars || 0}</b>
              </div>
            </div>

            {/* Action Buttons: Only teacher can grant/revoke stars or rename */}
            {isTeacher ? (
              <>
                <div className="student-modal-star-action-bar">
                  <button
                    type="button"
                    className="btn-add-single-star-prominent"
                    onClick={() => {
                      handleRewardStar(studentActionSeat.seatNumber, studentActionSeat.studentName, 1);
                    }}
                  >
                    这位同学 加1 颗星⭐
                  </button>
                  {(studentActionSeat.stars || 0) > 0 && (
                    <button
                      type="button"
                      className="btn-revoke-single-star"
                      onClick={() => {
                        handleRewardStar(studentActionSeat.seatNumber, studentActionSeat.studentName, -1);
                      }}
                      title="撤回误加的 1 颗星星"
                    >
                      ↩️ 撤回1颗星
                    </button>
                  )}
                </div>

                <div className="student-modal-subactions">
                  <button
                    type="button"
                    className="btn-rename-student-link"
                    onClick={() => {
                      setEditingSeat(studentActionSeat.seatNumber);
                      setInputName(studentActionSeat.studentName);
                      setStudentActionSeat(null);
                    }}
                  >
                    ✏️ 修改姓名
                  </button>
                  <button
                    type="button"
                    className="btn-cancel"
                    onClick={() => setStudentActionSeat(null)}
                  >
                    关闭
                  </button>
                </div>
              </>
            ) : (
              <div className="student-modal-subactions" style={{ justifyContent: 'center' }}>
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setStudentActionSeat(null)}
                >
                  关闭
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal 1B: Claim Empty Seat / Enter Name */}
      {editingSeat && (
        <div className="classroom-modal-backdrop" onClick={() => setEditingSeat(null)}>
          <div
            className="classroom-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>选择座位并输入华文名</h3>
            <p className="modal-sub">
              正在选择：<b>第 {editingSeat} 号</b>
            </p>
            <div className="modal-input-group">
              <label htmlFor="seat-student-name">请输入您的华文姓名：</label>
              <input
                id="seat-student-name"
                type="text"
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                placeholder="例如：陈小华"
                autoFocus
                maxLength={20}
              />
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-cancel"
                onClick={() => setEditingSeat(null)}
              >
                取消
              </button>
              <button
                type="button"
                className="btn-confirm"
                onClick={() => handleClaimSeat(editingSeat, inputName)}
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Random Name Picker (🎲 随机选人：只保留居中大字姓名 + 周围绽放礼花) */}
      {pickerModal && (
        <div className="picker-modal-backdrop" onClick={() => setPickerModal(false)}>
          <div
            className="picker-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="picker-close-btn"
              onClick={() => setPickerModal(false)}
            >
              ✕
            </button>
            <h2 className="modal-main-title">🎲 随机选人</h2>
            
            <div className="picker-pure-stage">
              {/* Only winner name or rolling name */}
              <div className="picker-winner-name-display">
                {rollingName || "准备就绪"}
              </div>

              {/* Pure fireworks particles around the name */}
              {pickerWinner && (
                <div className="pure-confetti-fireworks" aria-hidden="true">
                  <div className="firework-particle p1" />
                  <div className="firework-particle p2" />
                  <div className="firework-particle p3" />
                  <div className="firework-particle p4" />
                  <div className="firework-particle p5" />
                  <div className="firework-particle p6" />
                  <div className="firework-particle p7" />
                  <div className="firework-particle p8" />
                  <div className="firework-particle p9" />
                  <div className="firework-particle p10" />
                  <div className="firework-particle p11" />
                  <div className="firework-particle p12" />
                </div>
              )}
            </div>

            <div className="picker-actions">
              <button
                type="button"
                className="btn-confirm"
                onClick={handleRollPicker}
                disabled={isRolling}
              >
                {isRolling ? "正在选人..." : "🎲 再选一位"}
              </button>
              {pickerWinner && (
                <button
                  type="button"
                  className="btn-picker-reward-star"
                  onClick={() => {
                    handleRewardStar(pickerWinner.seat, pickerWinner.name);
                  }}
                >
                  加 1 颗星⭐
                </button>
              )}
              <button
                type="button"
                className="btn-cancel"
                onClick={() => setPickerModal(false)}
              >
                完成
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Random Grouping (👥 随机分组) */}
      {groupModal && (
        <div className="group-modal-backdrop" onClick={() => setGroupModal(false)}>
          <div
            className="group-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close-btn"
              onClick={() => setGroupModal(false)}
            >
              ✕
            </button>
            <h2 className="modal-main-title">👥 课堂随机分组</h2>
            <p className="modal-sub">
              当前统计范围：<b>1-{displayLimit}号</b>（共分组 {groups.length} 组）
            </p>

            {/* Group size selector */}
            <div className="group-size-bar">
              <span className="group-size-label">每组人数：</span>
              {[2, 3, 4, 5].map((size) => (
                <button
                  key={size}
                  type="button"
                  className={`group-size-pill ${groupSize === size ? "active" : ""}`}
                  onClick={() => handleGenerateGroups(size)}
                >
                  {size}人一组
                </button>
              ))}
            </div>

            {/* Groups Grid Display */}
            <div className="groups-container">
              {groups.map((group) => (
                <div key={group.groupIndex} className="group-card">
                  <div className="group-card-header">
                    <b>第 {group.groupIndex} 组</b>
                    <span className="group-member-count">({group.members.length}人)</span>
                  </div>
                  <div className="group-members-list">
                    {group.members.map((m) => (
                      <span key={m.seatNumber} className={`group-member-tag status-${m.status}`}>
                        {m.seatNumber}号 {m.studentName}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="group-modal-actions">
              <button
                type="button"
                className="btn-confirm"
                onClick={() => handleGenerateGroups(groupSize)}
              >
                🔄 重新分组
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleCopyGroups}
              >
                {copiedHint ? "✅ 已复制到剪贴板！" : "📋 复制分组名单"}
              </button>
              <button
                type="button"
                className="btn-cancel"
                onClick={() => setGroupModal(false)}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: High-Contrast Glassmorphism Minimalist Timer (动态玻璃拟物炫彩版 - 1:1 精确还原) */}
      {timerModal && (
        <div
          className="glass-timer-window"
          style={{
            left: `${timerPos.x}px`,
            top: `${timerPos.y}px`,
          }}
        >
          {/* Draggable Title Header */}
          <div
            className="glass-timer-header"
            onMouseDown={(e) => handleStartDrag(e.clientX, e.clientY)}
            onTouchStart={(e) => {
              if (e.touches.length > 0) {
                handleStartDrag(e.touches[0].clientX, e.touches[0].clientY);
              }
            }}
          >
            <div className="glass-timer-title">
              <span className="drag-icon">⋮⋮</span>
              <span>⏱️ 计时器</span>
            </div>
            <button
              type="button"
              className="glass-timer-close-btn"
              onClick={() => setTimerModal(false)}
              title="关闭计时器"
            >
              ✕
            </button>
          </div>

          <div className="glass-timer-body">
            {/* SVG Circular Progress Ring with Glowing Neon Cyan Arc */}
            <div className="glass-progress-container">
              <svg className="glass-progress-svg" width="220" height="220" viewBox="0 0 220 220">
                <circle
                  cx="110"
                  cy="110"
                  r="94"
                  className="glass-ring-bg"
                />
                <circle
                  cx="110"
                  cy="110"
                  r="94"
                  className={`glass-ring-progress ${timerSecondsLeft <= 30 && timerSecondsLeft > 0 ? "urgent" : ""} ${timerTimeUp ? "timeup" : ""}`}
                  style={{
                    strokeDasharray: 2 * Math.PI * 94,
                    strokeDashoffset: (2 * Math.PI * 94) * (1 - (timerTotalSeconds > 0 ? timerSecondsLeft / timerTotalSeconds : 0)),
                  }}
                  transform="rotate(-90 110 110)"
                />
              </svg>

              {/* Big High-Contrast Time Display */}
              <div
                className={`glass-time-text ${timerTimeUp ? "pulse-timeup" : ""}`}
                onClick={() => {
                  const input = window.prompt("请设定倒计时（输入分钟，如 3 或 5；或 mm:ss 如 02:30）：", "3");
                  if (!input) return;
                  const clean = input.replace("：", ":").trim();
                  let secs = 0;
                  if (clean.includes(":")) {
                    const [m, s] = clean.split(":");
                    secs = (parseInt(m, 10) || 0) * 60 + (parseInt(s, 10) || 0);
                  } else {
                    secs = (parseFloat(clean) || 0) * 60;
                  }
                  if (secs > 0) {
                    handleSetTimerPreset(secs);
                  }
                }}
                title="点击可直接自定义倒计时间"
              >
                {formatTimerDigits(timerSecondsLeft)}
              </div>
            </div>

            {/* Controls: Row 1 [- 1 分钟] [开始 / 暂停] [+ 1 分钟] */}
            <div className="glass-ctrl-row">
              <button
                type="button"
                className="glass-pill-btn"
                onClick={() => {
                  setTimerSecondsLeft((prev) => Math.max(0, prev - 60));
                  setTimerTimeUp(false);
                }}
                title="减少1分钟"
              >
                - 1 分钟
              </button>

              {timerIsRunning ? (
                <button
                  type="button"
                  className="glass-main-cyan-btn pause"
                  onClick={handlePauseTimer}
                >
                  暂停
                </button>
              ) : (
                <button
                  type="button"
                  className="glass-main-cyan-btn"
                  onClick={handleStartTimer}
                >
                  开始
                </button>
              )}

              <button
                type="button"
                className="glass-pill-btn"
                onClick={() => {
                  setTimerSecondsLeft((prev) => prev + 60);
                  setTimerTotalSeconds((prev) => Math.max(prev, timerSecondsLeft + 60));
                  setTimerTimeUp(false);
                }}
                title="增加1分钟"
              >
                + 1 分钟
              </button>
            </div>

            {/* Controls: Row 2 [1 分钟] [5 分钟] [10 分钟] [🔄 重置] */}
            <div className="glass-ctrl-row presets-row">
              <button
                type="button"
                className={`glass-pill-btn ${timerTotalSeconds === 60 ? "active" : ""}`}
                onClick={() => handleSetTimerPreset(60)}
              >
                1 分钟
              </button>
              <button
                type="button"
                className={`glass-pill-btn ${timerTotalSeconds === 300 ? "active" : ""}`}
                onClick={() => handleSetTimerPreset(300)}
              >
                5 分钟
              </button>
              <button
                type="button"
                className={`glass-pill-btn ${timerTotalSeconds === 600 ? "active" : ""}`}
                onClick={() => handleSetTimerPreset(600)}
              >
                10 分钟
              </button>
              <button
                type="button"
                className="glass-pill-btn reset-btn"
                onClick={handleResetTimer}
                title="重置为初始时间"
              >
                🔄 重置
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 5: Buzzer Modal */}
      {activeBuzzer && (
        <div className="buzzer-modal-backdrop">
          <div className="buzzer-modal-card">
            <button
              type="button"
              className="buzzer-close-btn"
              onClick={handleResetBuzzer}
              title="关闭抢答"
            >
              ✕
            </button>
            <h2 className="modal-main-title">⚡ 课堂抢答</h2>

            {activeBuzzer.winner ? (
              <div className="buzzer-winner-display">
                <div className="winner-crown">👑</div>
                <h3>抢答成功！</h3>
                <p className="winner-name">
                  {activeBuzzer.winnerSeat ? `${activeBuzzer.winnerSeat}号 ` : ""}
                  <b>{activeBuzzer.winner}</b>
                </p>
                <div style={{ marginBottom: "16px" }}>
                  <button
                    type="button"
                    className="btn-picker-reward-star"
                    onClick={() => {
                      if (activeBuzzer.winnerSeat && activeBuzzer.winner) {
                        handleRewardStar(activeBuzzer.winnerSeat, activeBuzzer.winner);
                      }
                    }}
                  >
                    加 1 颗星⭐
                  </button>
                </div>
                <div className="buzzer-reset-actions">
                  <button
                    type="button"
                    className="btn-confirm"
                    onClick={handleStartBuzzer}
                  >
                    下一轮抢答
                  </button>
                  <button
                    type="button"
                    className="btn-cancel"
                    onClick={handleResetBuzzer}
                  >
                    结束抢答
                  </button>
                </div>
              </div>
            ) : buzzerCountdownLeft > 0 ? (
              <div className="buzzer-countdown-display">
                <div className="countdown-number">{buzzerCountdownLeft}</div>
                <p>准备抢答...</p>
              </div>
            ) : (
              <div className="buzzer-ready-display">
                <button
                  type="button"
                  className={`buzzer-big-button ${hasBuzzed ? "buzzed" : ""}`}
                  onClick={handleHitBuzzer}
                  disabled={hasBuzzed}
                >
                  {hasBuzzed ? "已按下！等待结果" : "⚡ 立即抢答！"}
                </button>
                <p className="buzzer-hint">一人一设备，看谁手速最快！</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal 0: 隐蔽教师密码验证弹窗 (黑点遮掩，绝不在公屏泄露明文) */}
      {showTeacherAuthModal && (
        <div className="classroom-modal-backdrop" onClick={() => setShowTeacherAuthModal(false)}>
          <div className="teacher-stealth-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="stealth-modal-header">
              <span className="stealth-modal-title">🔐 教师身份验证</span>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowTeacherAuthModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleConfirmTeacherAuth} className="stealth-modal-form">
              <input
                type="password"
                className="stealth-password-input"
                value={teacherInputPassword}
                onChange={(e) => {
                  setTeacherInputPassword(e.target.value);
                  setTeacherAuthError("");
                }}
                placeholder="请输入教师访问码"
                autoFocus
                maxLength={20}
              />
              {teacherAuthError && (
                <div className="stealth-error-text">{teacherAuthError}</div>
              )}
              <div className="stealth-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowTeacherAuthModal(false)}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="btn-confirm"
                  disabled={!teacherInputPassword.trim()}
                >
                  进入
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 6: ⭐ 课堂星光榜 (Leaderboard Modal) */}
      {leaderboardModal && (
        <div className="leaderboard-modal-backdrop" onClick={() => setLeaderboardModal(false)}>
          <div
            className="leaderboard-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close-btn"
              onClick={() => setLeaderboardModal(false)}
            >
              ✕
            </button>
            <h2 className="modal-main-title">⭐ 课堂星光榜</h2>

            <div className="leaderboard-list-wrap">
              {rankedStudents.length === 0 ? (
                <div className="leaderboard-empty-hint">
                  暂无学生获星记录，课堂互动中可为积极表现的同学点星奖励！
                </div>
              ) : (
                <div className="leaderboard-table">
                  <div className="leaderboard-thead">
                    <span className="col-rank">排名</span>
                    <span className="col-seat">座位</span>
                    <span className="col-name">华文姓名</span>
                    <span className="col-action">奖励</span>
                    <span className="col-stars">星星总数</span>
                  </div>
                  <div className="leaderboard-tbody">
                    {rankedStudents.map((st, idx) => {
                      const starCount = st.stars || 0;
                      return (
                        <div key={st.seatNumber} className={`leaderboard-row ${idx < 3 ? `top-${idx + 1}` : ""}`}>
                          <span className="col-rank">
                            {idx === 0 ? "🥇 1" : idx === 1 ? "🥈 2" : idx === 2 ? "🥉 3" : `第 ${idx + 1} 名`}
                          </span>
                          <span className="col-seat">#{st.seatNumber}号</span>
                          <span className="col-name"><b>{st.studentName}</b></span>
                          <span className="col-action">
                            {isTeacher ? (
                              <div className="leaderboard-action-btns">
                                <button
                                  type="button"
                                  className="btn-mini-add-star"
                                  onClick={() => handleRewardStar(st.seatNumber, st.studentName, 1)}
                                  title="加1颗星"
                                >
                                  +1⭐
                                </button>
                                {starCount > 0 && (
                                  <button
                                    type="button"
                                    className="btn-mini-revoke-star"
                                    onClick={() => handleRewardStar(st.seatNumber, st.studentName, -1)}
                                    title="撤回1颗星"
                                  >
                                    ↩️
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>-</span>
                            )}
                          </span>
                          <span className="col-stars">
                            <span className="stars-display">
                              ⭐ × {starCount}
                            </span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="leaderboard-footer-bar">
              <button
                type="button"
                className="btn-star-all-reward-footer"
                onClick={handleRewardAllStars}
              >
                所有同学 加1 颗星⭐
              </button>
              <button
                type="button"
                className="btn-cancel"
                onClick={() => setLeaderboardModal(false)}
              >
                完成
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
