import { env } from "cloudflare:workers";

// In-memory fallback for local development or testing when D1 binding is not present
const memSeats = new Map<number, { seatNumber: number; studentName: string; status: string; stars: number; updatedAt: number }>();
const memEvents: Array<{ id: number; className: string; eventType: string; payload: string; createdAt: number }> = [];
let memEventSeq = 1;

let tablesChecked = false;
async function ensureTables() {
  if (tablesChecked) return;
  if (env && (env as any).DB) {
    try {
      await (env as any).DB.prepare(`
        CREATE TABLE IF NOT EXISTS classroom_seats (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          class_name TEXT NOT NULL DEFAULT 'default',
          seat_number INTEGER NOT NULL,
          student_name TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'neutral',
          stars INTEGER DEFAULT 0,
          updated_at INTEGER NOT NULL,
          UNIQUE(class_name, seat_number)
        )
      `).run();

      try {
        await (env as any).DB.prepare(`ALTER TABLE classroom_seats ADD COLUMN stars INTEGER DEFAULT 0`).run();
      } catch {}

      await (env as any).DB.prepare(`
        CREATE TABLE IF NOT EXISTS classroom_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          class_name TEXT NOT NULL DEFAULT 'default',
          event_type TEXT NOT NULL,
          payload TEXT NOT NULL,
          created_at INTEGER NOT NULL DEFAULT 0
        )
      `).run();

      tablesChecked = true;
    } catch (e) {
      console.warn("Table auto-creation error:", e);
    }
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const className = url.searchParams.get("className") || "default";
    const since = Number(url.searchParams.get("since") || 0);

    await ensureTables();

    // Check if D1 is available
    if (env && (env as any).DB) {
      try {
        const stmtSeats = await (env as any).DB.prepare(
          "SELECT seat_number, student_name, status, COALESCE(stars, 0) as stars, updated_at FROM classroom_seats WHERE class_name = ? ORDER BY seat_number ASC"
        ).bind(className).all();

        const seatMap = new Map<number, { seatNumber: number; studentName: string; status: string; stars: number; updatedAt: number }>();
        if (stmtSeats && stmtSeats.results) {
          for (const row of stmtSeats.results as any[]) {
            seatMap.set(row.seat_number, {
              seatNumber: row.seat_number,
              studentName: row.student_name || "",
              status: row.status || "neutral",
              stars: Number(row.stars || 0),
              updatedAt: row.updated_at || Date.now(),
            });
          }
        }

        const fullSeats = [];
        for (let i = 1; i <= 30; i++) {
          fullSeats.push(seatMap.get(i) || {
            seatNumber: i,
            studentName: "",
            status: "neutral",
            stars: 0,
            updatedAt: 0,
          });
        }

        const stmtEvents = await (env as any).DB.prepare(
          "SELECT id, event_type, payload, created_at FROM classroom_events WHERE class_name = ? AND created_at > ? ORDER BY id ASC LIMIT 100"
        ).bind(className, since).all();

        const events = (stmtEvents?.results || []).map((r: any) => ({
          id: r.id,
          eventType: r.event_type,
          payload: typeof r.payload === "string" ? JSON.parse(r.payload || "{}") : r.payload,
          createdAt: r.created_at || Date.now(),
        }));

        return Response.json({
          ok: true,
          seats: fullSeats,
          events,
          serverTime: Date.now(),
        });
      } catch (d1Err) {
        console.error("D1 GET error:", d1Err);
      }
    }

    // Fallback in-memory
    const fullSeats = [];
    for (let i = 1; i <= 30; i++) {
      fullSeats.push(memSeats.get(i) || {
        seatNumber: i,
        studentName: "",
        status: "neutral",
        stars: 0,
        updatedAt: 0,
      });
    }

    const events = memEvents.filter((e) => e.className === className && e.createdAt > since);
    return Response.json({
      ok: true,
      seats: fullSeats,
      events: events.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        payload: typeof e.payload === "string" ? JSON.parse(e.payload || "{}") : e.payload,
        createdAt: e.createdAt,
      })),
      serverTime: Date.now(),
    });
  } catch (err: any) {
    return Response.json({ ok: false, error: err.message || "Failed to load classroom" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body.action;
    const className = body.className || "default";
    const now = Date.now();

    await ensureTables();

    if (action === "claim_seat") {
      const seatNumber = Number(body.seatNumber);
      const studentName = String(body.studentName || "").trim().slice(0, 30);
      const status = String(body.status || "neutral");
      if (seatNumber < 1 || seatNumber > 30) {
        return Response.json({ ok: false, error: "座位号必须在 1-30 之间" }, { status: 400 });
      }

      if (env && (env as any).DB) {
        await (env as any).DB.prepare(`
          INSERT INTO classroom_seats (class_name, seat_number, student_name, status, stars, updated_at)
          VALUES (?, ?, ?, ?, 0, ?)
          ON CONFLICT(class_name, seat_number) DO UPDATE SET
            student_name = excluded.student_name,
            status = excluded.status,
            updated_at = excluded.updated_at
        `).bind(className, seatNumber, studentName, status, now).run();
      } else {
        const existing = memSeats.get(seatNumber) || { seatNumber, studentName: "", status: "neutral", stars: 0, updatedAt: 0 };
        existing.studentName = studentName;
        existing.status = status;
        existing.updatedAt = now;
        memSeats.set(seatNumber, existing);
      }
      return Response.json({ ok: true, seatNumber, studentName, status });
    }

    if (action === "set_status") {
      const seatNumber = Number(body.seatNumber);
      const status = String(body.status || "neutral");
      const studentName = body.studentName ? String(body.studentName).trim().slice(0, 30) : undefined;

      if (seatNumber < 1 || seatNumber > 30) {
        return Response.json({ ok: false, error: "座位号必须在 1-30 之间" }, { status: 400 });
      }

      if (env && (env as any).DB) {
        if (studentName) {
          await (env as any).DB.prepare(`
            INSERT INTO classroom_seats (class_name, seat_number, student_name, status, stars, updated_at)
            VALUES (?, ?, ?, ?, 0, ?)
            ON CONFLICT(class_name, seat_number) DO UPDATE SET
              student_name = excluded.student_name,
              status = excluded.status,
              updated_at = excluded.updated_at
          `).bind(className, seatNumber, studentName, status, now).run();
        } else {
          await (env as any).DB.prepare(`
            UPDATE classroom_seats SET status = ?, updated_at = ? WHERE class_name = ? AND seat_number = ?
          `).bind(status, now, className, seatNumber).run();
        }
      } else {
        const existing = memSeats.get(seatNumber) || { seatNumber, studentName: "", status: "neutral", stars: 0, updatedAt: 0 };
        existing.status = status;
        if (studentName) existing.studentName = studentName;
        existing.updatedAt = now;
        memSeats.set(seatNumber, existing);
      }
      return Response.json({ ok: true, seatNumber, status });
    }

    // Reward 1 student with star(s)
    if (action === "reward_star") {
      const seatNumber = Number(body.seatNumber);
      const delta = Number(body.delta || 1);
      if (seatNumber < 1 || seatNumber > 30) {
        return Response.json({ ok: false, error: "座位号必须在 1-30 之间" }, { status: 400 });
      }

      if (env && (env as any).DB) {
        await (env as any).DB.prepare(`
          UPDATE classroom_seats
          SET stars = MAX(0, COALESCE(stars, 0) + ?), updated_at = ?
          WHERE class_name = ? AND seat_number = ?
        `).bind(delta, now, className, seatNumber).run();

        const payload = JSON.stringify({ seatNumber, delta, time: now });
        await (env as any).DB.prepare(`
          INSERT INTO classroom_events (class_name, event_type, payload, created_at)
          VALUES (?, 'star_reward', ?, ?)
        `).bind(className, payload, now).run();
      } else {
        const existing = memSeats.get(seatNumber) || { seatNumber, studentName: "", status: "neutral", stars: 0, updatedAt: 0 };
        existing.stars = Math.max(0, (existing.stars || 0) + delta);
        existing.updatedAt = now;
        memSeats.set(seatNumber, existing);
        memEvents.push({ id: memEventSeq++, className, eventType: "star_reward", payload: JSON.stringify({ seatNumber, delta, time: now }), createdAt: now });
      }
      return Response.json({ ok: true, seatNumber, delta });
    }

    // Reward ALL seated students with star(s)
    if (action === "reward_all_stars") {
      const delta = Number(body.delta || 1);
      if (env && (env as any).DB) {
        await (env as any).DB.prepare(`
          UPDATE classroom_seats
          SET stars = MAX(0, COALESCE(stars, 0) + ?), updated_at = ?
          WHERE class_name = ? AND student_name != ''
        `).bind(delta, now, className).run();

        const payload = JSON.stringify({ delta, time: now });
        await (env as any).DB.prepare(`
          INSERT INTO classroom_events (class_name, event_type, payload, created_at)
          VALUES (?, 'all_stars_reward', ?, ?)
        `).bind(className, payload, now).run();
      } else {
        for (const [, seat] of memSeats.entries()) {
          if (seat.studentName) {
            seat.stars = Math.max(0, (seat.stars || 0) + delta);
            seat.updatedAt = now;
          }
        }
        memEvents.push({ id: memEventSeq++, className, eventType: "all_stars_reward", payload: JSON.stringify({ delta, time: now }), createdAt: now });
      }
      return Response.json({ ok: true, delta });
    }

    if (action === "danmaku") {
      const text = String(body.text || "").trim().slice(0, 80);
      const studentName = String(body.studentName || "同学").trim().slice(0, 20);
      const color = String(body.color || "#0284c7");
      const styleType = String(body.styleType || "cloud");
      if (!text) return Response.json({ ok: false, error: "弹幕内容不能为空" }, { status: 400 });

      const payload = JSON.stringify({ text, studentName, color, styleType, time: now });

      if (env && (env as any).DB) {
        await (env as any).DB.prepare(`
          INSERT INTO classroom_events (class_name, event_type, payload, created_at)
          VALUES (?, 'danmaku', ?, ?)
        `).bind(className, payload, now).run();
      } else {
        memEvents.push({ id: memEventSeq++, className, eventType: "danmaku", payload, createdAt: now });
      }
      return Response.json({ ok: true });
    }

    if (action === "buzzer_start") {
      const buzzId = "buzz_" + now;
      const title = String(body.title || "抢答开始！").trim().slice(0, 60);
      const countdown = Number(body.countdown || 3);
      const payload = JSON.stringify({ buzzId, title, countdown, startTime: now + countdown * 1000 });

      if (env && (env as any).DB) {
        await (env as any).DB.prepare(`
          INSERT INTO classroom_events (class_name, event_type, payload, created_at)
          VALUES (?, 'buzzer_start', ?, ?)
        `).bind(className, payload, now).run();
      } else {
        memEvents.push({ id: memEventSeq++, className, eventType: "buzzer_start", payload, createdAt: now });
      }
      return Response.json({ ok: true, buzzId });
    }

    if (action === "buzzer_hit") {
      const buzzId = String(body.buzzId || "");
      const studentName = String(body.studentName || "同学").trim().slice(0, 20);
      const seatNumber = Number(body.seatNumber || 0);
      const payload = JSON.stringify({ buzzId, studentName, seatNumber, hitTime: now });

      if (env && (env as any).DB) {
        await (env as any).DB.prepare(`
          INSERT INTO classroom_events (class_name, event_type, payload, created_at)
          VALUES (?, 'buzzer_hit', ?, ?)
        `).bind(className, payload, now).run();
      } else {
        memEvents.push({ id: memEventSeq++, className, eventType: "buzzer_hit", payload, createdAt: now });
      }
      return Response.json({ ok: true, winner: studentName });
    }

    if (action === "buzzer_reset") {
      const payload = JSON.stringify({ resetTime: now });
      if (env && (env as any).DB) {
        await (env as any).DB.prepare(`
          INSERT INTO classroom_events (class_name, event_type, payload, created_at)
          VALUES (?, 'buzzer_reset', ?, ?)
        `).bind(className, payload, now).run();
      } else {
        memEvents.push({ id: memEventSeq++, className, eventType: "buzzer_reset", payload, createdAt: now });
      }
      return Response.json({ ok: true });
    }

    if (action === "picker_roll") {
      const winnerSeat = Number(body.winnerSeat);
      const winnerName = String(body.winnerName || "").trim().slice(0, 30);
      const payload = JSON.stringify({ winnerSeat, winnerName, rollTime: now });

      if (env && (env as any).DB) {
        await (env as any).DB.prepare(`
          INSERT INTO classroom_events (class_name, event_type, payload, created_at)
          VALUES (?, 'picker_result', ?, ?)
        `).bind(className, payload, now).run();
      } else {
        memEvents.push({ id: memEventSeq++, className, eventType: "picker_result", payload, createdAt: now });
      }
      return Response.json({ ok: true, winnerSeat, winnerName });
    }

    if (action === "reset_seats") {
      if (env && (env as any).DB) {
        await (env as any).DB.prepare(`DELETE FROM classroom_seats WHERE class_name = ?`).bind(className).run();
        await (env as any).DB.prepare(`INSERT INTO classroom_events (class_name, event_type, payload, created_at) VALUES (?, 'seats_reset', '{}', ?)`).bind(className, now).run();
      } else {
        memSeats.clear();
        memEvents.push({ id: memEventSeq++, className, eventType: "seats_reset", payload: "{}", createdAt: now });
      }
      return Response.json({ ok: true });
    }

    // --- WORD CLOUD ACTIONS ---
    if (action === "wordcloud_start") {
      const topic = String(body.topic || "请提交你的关键词").trim().slice(0, 100);
      const cloudId = "cloud_" + now;
      const payload = JSON.stringify({ cloudId, topic, startTime: now });

      if (env && (env as any).DB) {
        await (env as any).DB.prepare(`
          INSERT INTO classroom_events (class_name, event_type, payload, created_at)
          VALUES (?, 'wordcloud_start', ?, ?)
        `).bind(className, payload, now).run();
      } else {
        memEvents.push({ id: memEventSeq++, className, eventType: "wordcloud_start", payload, createdAt: now });
      }
      return Response.json({ ok: true, cloudId, topic });
    }

    if (action === "wordcloud_submit") {
      const word = String(body.word || "").trim().slice(0, 40);
      const studentName = String(body.studentName || "同学").trim().slice(0, 20);
      const cloudId = String(body.cloudId || "");
      if (!word) {
        return Response.json({ ok: false, error: "词语不能为空" }, { status: 400 });
      }

      const payload = JSON.stringify({ cloudId, word, studentName, submitTime: now });

      if (env && (env as any).DB) {
        await (env as any).DB.prepare(`
          INSERT INTO classroom_events (class_name, event_type, payload, created_at)
          VALUES (?, 'wordcloud_item', ?, ?)
        `).bind(className, payload, now).run();
      } else {
        memEvents.push({ id: memEventSeq++, className, eventType: "wordcloud_item", payload, createdAt: now });
      }
      return Response.json({ ok: true, word });
    }

    if (action === "wordcloud_reset") {
      const payload = JSON.stringify({ resetTime: now });
      if (env && (env as any).DB) {
        await (env as any).DB.prepare(`
          INSERT INTO classroom_events (class_name, event_type, payload, created_at)
          VALUES (?, 'wordcloud_reset', ?, ?)
        `).bind(className, payload, now).run();
      } else {
        memEvents.push({ id: memEventSeq++, className, eventType: "wordcloud_reset", payload, createdAt: now });
      }
      return Response.json({ ok: true });
    }

    return Response.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    return Response.json({ ok: false, error: err.message || "Operation failed" }, { status: 500 });
  }
}
