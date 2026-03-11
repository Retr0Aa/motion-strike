import { useEffect, useRef, useState } from "react";
import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

export default function Game() {
  const [score, setScore] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);

  const canvasRef = useRef(null);
  const cursorRef = useRef(null);
  
  // Button Refs
  const tryAgainBtnRef = useRef(null);
  const menuBtnRef = useRef(null);
  const tryAgainFillRef = useRef(null);
  const menuFillRef = useRef(null);

  const mouse = useRef({ x: 0, y: 0 });
  const targetFinger = useRef({ x: 0, y: 0 });
  const smoothFinger = useRef({ x: 540, y: 310 });
  
  const currentCursor = useRef({ left: 0, top: 0, width: 24, height: 24, radius: 50 });
  const holdStartRef = useRef(null);
  const hoveredButton = useRef(null); // Tracks which button is being hovered
  const holdDuration = 1500;

  const cubesRef = useRef([]);
  const bulletsRef = useRef([]);
  const lastShotTime = useRef(0);
  const gameRunning = useRef(true);
  const animationRef = useRef(null);

  const restartGame = () => {
    cubesRef.current = [];
    bulletsRef.current = [];
    setScore(0);
    setIsGameOver(false);
    gameRunning.current = true;
    holdStartRef.current = null;
    hoveredButton.current = null;
  };

  useEffect(() => {
    let handLandmarker;
    let video;

    const setup = async () => {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );

      handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        },
        runningMode: "VIDEO",
        numHands: 1,
      });

      video = document.createElement("video");
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      video.srcObject = stream;
      await video.play();

      const lerp = (a, b, t) => a + (b - a) * t;

      const mainLoop = () => {
        const now = performance.now();
        const results = handLandmarker.detectForVideo(video, now);

        if (results.landmarks?.length) {
          const hand = results.landmarks[0];
          const indexTip = hand[8];
          const thumbTip = hand[4];

          mouse.current = {
            x: window.innerWidth - indexTip.x * window.innerWidth,
            y: indexTip.y * window.innerHeight,
          };

          targetFinger.current = {
            x: 1080 - indexTip.x * 1080,
            y: indexTip.y * 620,
          };

          if (gameRunning.current) {
            const dist = Math.sqrt(Math.pow(indexTip.x - thumbTip.x, 2) + Math.pow(indexTip.y - thumbTip.y, 2));
            if (dist < 0.05 && now - lastShotTime.current > 200) {
              bulletsRef.current.push({ x: smoothFinger.current.x, y: smoothFinger.current.y, speed: 15 });
              lastShotTime.current = now;
            }
          }
        }

        if (canvasRef.current && gameRunning.current) {
          const ctx = canvasRef.current.getContext("2d");
          ctx.clearRect(0, 0, 1080, 620);
          smoothFinger.current.x = lerp(smoothFinger.current.x, targetFinger.current.x, 0.2);
          smoothFinger.current.y = lerp(smoothFinger.current.y, targetFinger.current.y, 0.2);

          bulletsRef.current.forEach((b, i) => {
            b.y -= b.speed;
            ctx.fillStyle = "#00ffcc";
            ctx.fillRect(b.x - 2, b.y, 4, 15);
            if (b.y < 0) bulletsRef.current.splice(i, 1);
          });

          cubesRef.current.forEach((c, i) => {
            c.y += c.speed;
            ctx.fillStyle = "red";
            ctx.fillRect(c.x, c.y, c.size, c.size);

            bulletsRef.current.forEach((b, bi) => {
              if (b.x > c.x && b.x < c.x + c.size && b.y > c.y && b.y < c.y + c.size) {
                setScore(s => s + 1);
                cubesRef.current.splice(i, 1);
                bulletsRef.current.splice(bi, 1);
              }
            });

            const dx = Math.abs(smoothFinger.current.x - (c.x + c.size/2));
            const dy = Math.abs(smoothFinger.current.y - (c.y + c.size/2));
            if (dx < (c.size/2 + 15) && dy < (c.size/2 + 15)) {
              gameRunning.current = false;
              setIsGameOver(true);
            }
            if (c.y > 620) cubesRef.current.splice(i, 1);
          });

          ctx.fillStyle = "cyan";
          ctx.beginPath();
          ctx.arc(smoothFinger.current.x, smoothFinger.current.y, 18, 0, Math.PI * 2);
          ctx.fill();
        }

        if (isGameOver) handleMenuInteraction(lerp);

        animationRef.current = requestAnimationFrame(mainLoop);
      };

      const spawnInterval = setInterval(() => {
        if (gameRunning.current) {
          cubesRef.current.push({
            x: Math.random() * 1000 + 40,
            y: -50,
            size: 45,
            speed: 3 + Math.random() * 2
          });
        }
      }, 1000);

      mainLoop();
      return () => clearInterval(spawnInterval);
    };

    setup();
    return () => cancelAnimationFrame(animationRef.current);
  }, [isGameOver]);

  const handleMenuInteraction = (lerp) => {
    if (!cursorRef.current) return;

    const mx = mouse.current.x;
    const my = mouse.current.y;
    
    let targetStyle = { left: mx - 12, top: my - 12, width: 24, height: 24, radius: 50, color: "0, 255, 255" };
    let currentlyOver = null;

    // Check Try Again Button
    const tryRect = tryAgainBtnRef.current?.getBoundingClientRect();
    const menuRect = menuBtnRef.current?.getBoundingClientRect();

    if (tryRect && mx >= tryRect.left && mx <= tryRect.right && my >= tryRect.top && my <= tryRect.bottom) {
      targetStyle = { left: tryRect.left, top: tryRect.top, width: tryRect.width, height: tryRect.height, radius: 14, color: "0, 100, 255" };
      currentlyOver = "tryAgain";
    } else if (menuRect && mx >= menuRect.left && mx <= menuRect.right && my >= menuRect.top && my <= menuRect.bottom) {
      targetStyle = { left: menuRect.left, top: menuRect.top, width: menuRect.width, height: menuRect.height, radius: 14, color: "255, 100, 0" };
      currentlyOver = "menu";
    }

    // Progress Logic
    if (currentlyOver) {
      if (hoveredButton.current !== currentlyOver) {
        holdStartRef.current = Date.now();
        hoveredButton.current = currentlyOver;
      }
      
      const elapsed = Date.now() - holdStartRef.current;
      const progress = Math.min(elapsed / holdDuration, 1);

      if (currentlyOver === "tryAgain" && tryAgainFillRef.current) {
        tryAgainFillRef.current.style.width = `${progress * 100}%`;
        if (menuFillRef.current) menuFillRef.current.style.width = "0%";
      } else if (currentlyOver === "menu" && menuFillRef.current) {
        menuFillRef.current.style.width = `${progress * 100}%`;
        if (tryAgainFillRef.current) tryAgainFillRef.current.style.width = "0%";
      }

      if (elapsed >= holdDuration) {
        if (currentlyOver === "tryAgain") restartGame();
        else window.location.href = "/";
      }
    } else {
      hoveredButton.current = null;
      holdStartRef.current = null;
      if (tryAgainFillRef.current) tryAgainFillRef.current.style.width = "0%";
      if (menuFillRef.current) menuFillRef.current.style.width = "0%";
    }

    // Cursor Lerping
    currentCursor.current.left = lerp(currentCursor.current.left, targetStyle.left, 0.2);
    currentCursor.current.top = lerp(currentCursor.current.top, targetStyle.top, 0.2);
    currentCursor.current.width = lerp(currentCursor.current.width, targetStyle.width, 0.2);
    currentCursor.current.height = lerp(currentCursor.current.height, targetStyle.height, 0.2);
    currentCursor.current.radius = lerp(currentCursor.current.radius, targetStyle.radius, 0.2);

    const cur = cursorRef.current;
    cur.style.left = currentCursor.current.left - 10 + "px";
    cur.style.top = currentCursor.current.top - 10 + "px";
    cur.style.width = currentCursor.current.width + 12 + "px";
    cur.style.height = currentCursor.current.height + 12 + "px";
    cur.style.borderRadius = currentCursor.current.radius + 7 + "px";
    cur.style.border = `4px solid rgb(${targetStyle.color})`;
  };

  return (
    <div style={{ textAlign: "center", background: "#1a1a1a", minHeight: "100vh", color: "white", cursor: "none", overflow: "hidden", fontFamily: "Arial" }}>
      <h2 style={{ margin: 0, padding: "20px" }}>Score: {score}</h2>
      
      <div style={{ position: "relative", display: "inline-block" }}>
        <canvas ref={canvasRef} width="1080" height="620" style={{ background: "#000", borderRadius: 12, border: "2px solid #333", display: "block" }} />
        
        {isGameOver && (
          <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.85)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRadius: 12, zIndex: 10 }}>
            <h1 style={{ color: "#ff4444", fontSize: "4rem", marginBottom: "30px" }}>DIED</h1>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Try Again Button */}
              <div ref={tryAgainBtnRef} style={{ position: "relative", width: "240px", height: "70px", borderRadius: "14px", backgroundColor: "white", display: "flex", justifyContent: "center", alignItems: "center", fontSize: "22px", color: "black", overflow: "hidden", fontWeight: "bold" }}>
                <div ref={tryAgainFillRef} style={{ position: "absolute", top: 0, left: 0, height: "100%", width: "0%", backgroundColor: "rgba(0, 100, 255, 0.6)", zIndex: 0 }} />
                <span style={{ position: "relative", zIndex: 1 }}>Try Again</span>
              </div>

              {/* Main Menu Button */}
              <div ref={menuBtnRef} style={{ position: "relative", width: "240px", height: "70px", borderRadius: "14px", backgroundColor: "white", display: "flex", justifyContent: "center", alignItems: "center", fontSize: "22px", color: "black", overflow: "hidden", fontWeight: "bold" }}>
                <div ref={menuFillRef} style={{ position: "absolute", top: 0, left: 0, height: "100%", width: "0%", backgroundColor: "rgba(255, 68, 68, 0.4)", zIndex: 0 }} />
                <span style={{ position: "relative", zIndex: 1 }}>Main Menu</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {isGameOver && <div ref={cursorRef} style={{ position: "fixed", left: 0, top: 0, pointerEvents: "none", zIndex: 999 }} />}
    </div>
  );
}