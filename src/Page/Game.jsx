import { useEffect, useRef, useState } from "react";
import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

export default function Game() {
  const [score, setScore] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);

  // Refs for elements and UI
  const canvasRef = useRef(null);
  const sliderRef = useRef(null);
  const cursorRef = useRef(null);
  
  // Button Refs
  const retryBtnRef = useRef(null);
  const retryFillRef = useRef(null);
  const mainMenuBtnRef = useRef(null);
  const mainMenuFillRef = useRef(null);

  // Physics & Interaction Refs
  const targetFinger = useRef({ x: 0, y: 0 });
  const smoothFinger = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const hoveredRef = useRef(null); 
  const holdStartRef = useRef(null);
  const holdDuration = 1500; 

  // Game Logic Refs
  const cubesRef = useRef([]);
  const bulletsRef = useRef([]);
  const lastShotTime = useRef(0);
  const animationRef = useRef(null);
  const gameRunning = useRef(true);

  // Shooting Logic
  const shootMeter = useRef(100);
  const isHolding = useRef(false);
  const isOverloaded = useRef(false);
  const overloadDir = useRef(-1);

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
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      video.srcObject = stream;
      await video.play();

      const lerp = (a, b, t) => a + (b - a) * t;

      const loop = () => {
        const now = performance.now();
        const res = handLandmarker.detectForVideo(video, now);

        if (res.landmarks?.length) {
          const hand = res.landmarks[0];
          const i = hand[8]; // Index
          const t = hand[4]; // Thumb

          targetFinger.current = {
            x: window.innerWidth - i.x * window.innerWidth,
            y: i.y * window.innerHeight,
          };

          if (gameRunning.current) {
            const dist = Math.hypot(i.x - t.x, i.y - t.y);
            isHolding.current = (dist < 0.05 && !isOverloaded.current);
            
            if (isHolding.current && now - lastShotTime.current > 120) {
              const rect = canvasRef.current.getBoundingClientRect();
              bulletsRef.current.push({
                x: ((smoothFinger.current.x - rect.left) / rect.width) * 1080,
                y: ((smoothFinger.current.y - rect.top) / rect.height) * 620,
                speed: 15,
              });
              lastShotTime.current = now;
            }
          }
        }

        // --- SMOOTHING ---
        smoothFinger.current.x = lerp(smoothFinger.current.x, targetFinger.current.x, 0.2);
        smoothFinger.current.y = lerp(smoothFinger.current.y, targetFinger.current.y, 0.2);

        if (cursorRef.current) {
          cursorRef.current.style.left = `${smoothFinger.current.x}px`;
          cursorRef.current.style.top = `${smoothFinger.current.y}px`;
        }

        if (gameRunning.current) {
            updateGameLogic();
        } else {
            handleMenuInteractions();
        }

        animationRef.current = requestAnimationFrame(loop);
      };

      const updateGameLogic = () => {
        // Meter Logic
        if (!isOverloaded.current) {
          isHolding.current ? (shootMeter.current -= 0.5) : (shootMeter.current += 0.15);
          if (shootMeter.current <= 0) { isOverloaded.current = true; overloadDir.current = -1; }
        } else {
          shootMeter.current += overloadDir.current * 0.5;
          if (shootMeter.current <= 0) overloadDir.current = 1;
          if (shootMeter.current >= 100) { shootMeter.current = 100; isOverloaded.current = false; }
        }
        shootMeter.current = Math.max(0, Math.min(100, shootMeter.current));

        if (sliderRef.current) {
          sliderRef.current.style.transform = `scaleX(${shootMeter.current / 100})`;
          sliderRef.current.style.background = isOverloaded.current ? "red" : "#00ffcc";
        }

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        const rect = canvas.getBoundingClientRect();
        canvas.width = 1080;
        canvas.height = 620;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Bullets
        bulletsRef.current.forEach((b, i) => {
          b.y -= b.speed;
          ctx.fillStyle = "#00ffcc";
          ctx.fillRect(b.x - 2, b.y, 4, 15);
          if (b.y < 0) bulletsRef.current.splice(i, 1);
        });

        // Cubes
        cubesRef.current.forEach((c, i) => {
          c.y += c.speed;
          ctx.fillStyle = "red";
          ctx.fillRect(c.x, c.y, c.size, c.size);

          const pX = ((smoothFinger.current.x - rect.left) / rect.width) * 1080;
          const pY = ((smoothFinger.current.y - rect.top) / rect.height) * 620;
          const dist = Math.hypot(pX - (c.x + c.size / 2), pY - (c.y + c.size / 2));

          if (dist < c.size / 2 + 18) {
            setIsGameOver(true);
            gameRunning.current = false;
          }

          bulletsRef.current.forEach((b, bi) => {
            if (b.x > c.x && b.x < c.x + c.size && b.y > c.y && b.y < c.y + c.size) {
              setScore((s) => s + 1);
              cubesRef.current.splice(i, 1);
              bulletsRef.current.splice(bi, 1);
            }
          });
        });

        // Finger indicator on canvas
        ctx.fillStyle = "cyan";
        ctx.beginPath();
        ctx.arc(((smoothFinger.current.x - rect.left) / rect.width) * 1080, ((smoothFinger.current.y - rect.top) / rect.height) * 620, 18, 0, Math.PI * 2);
        ctx.fill();
      };

      const handleMenuInteractions = () => {
        const buttons = [
          { ref: retryBtnRef, fill: retryFillRef, action: () => window.location.reload() },
          { ref: mainMenuBtnRef, fill: mainMenuFillRef, action: () => { window.location.href = "/"; } }
        ];

        let currentlyHovering = false;

        buttons.forEach((btn) => {
          if (!btn.ref.current) return;
          const rect = btn.ref.current.getBoundingClientRect();
          const isInside = (
            smoothFinger.current.x >= rect.left &&
            smoothFinger.current.x <= rect.right &&
            smoothFinger.current.y >= rect.top &&
            smoothFinger.current.y <= rect.bottom
          );

          if (isInside) {
            currentlyHovering = true;
            if (hoveredRef.current !== btn.ref) {
              hoveredRef.current = btn.ref;
              holdStartRef.current = Date.now();
            }

            const elapsed = Date.now() - holdStartRef.current;
            const progress = Math.min(elapsed / holdDuration, 1);
            if (btn.fill.current) btn.fill.current.style.width = `${progress * 100}%`;

            if (elapsed >= holdDuration) btn.action();
          } else {
            if (btn.fill.current) btn.fill.current.style.width = "0%";
          }
        });

        if (cursorRef.current) {
          // 🔥 Hide cursor if hovering ANY button, show if not
          cursorRef.current.style.opacity = currentlyHovering ? "0" : "1";
        }

        if (!currentlyHovering) {
          hoveredRef.current = null;
          holdStartRef.current = null;
        }
      };

      const cubeInterval = setInterval(() => {
        if (gameRunning.current) {
          cubesRef.current.push({ x: Math.random() * 1000, y: -50, size: 45, speed: 3 });
        }
      }, 1000);

      loop();
      return () => clearInterval(cubeInterval);
    };

    setup();
    return () => cancelAnimationFrame(animationRef.current);
  }, []);

  // --- STYLES ---
  const buttonStyle = {
    position: "relative",
    width: "220px",
    height: "70px",
    border: "2px solid white",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    fontSize: "22px",
    fontWeight: "bold",
    color: "white",
    transition: "transform 0.2s"
  };

  const fillStyle = {
    position: "absolute",
    left: 0,
    top: 0,
    height: "100%",
    width: "0%",
    background: "rgba(255, 255, 255, 0.3)",
    zIndex: -1
  };

  return (
    <div style={{ background: "#031021", height: "100vh", width: "100vw", color: "white", overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", fontFamily: "sans-serif" }}>
      
      {/* 🔥 SOLID WHITE CURSOR (No Glow) */}
      <div ref={cursorRef} style={{
          position: "fixed", 
          width: "20px", 
          height: "20px", 
          backgroundColor: "white", 
          borderRadius: "50%", 
          pointerEvents: "none", 
          zIndex: 1001,
          transform: "translate(-50%, -50%)",
          display: isGameOver ? "block" : "none",
          transition: "opacity 0.1s" 
      }} />

      <div style={{ width: "95%", maxWidth: "1080px", display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "20px" }}>
        <h2 style={{ margin: 0 }}>SCORE: {score}</h2>
        <div style={{ width: "200px", height: "12px", background: "#111", border: "1px solid #444" }}>
          <div ref={sliderRef} style={{ width: "100%", height: "100%", background: "#00ffcc", transformOrigin: "left" }} />
        </div>
      </div>

      <canvas ref={canvasRef} style={{ width: "95vw", maxWidth: "1080px", height: "auto", aspectRatio: "1080 / 620", border: "4px solid #272e38", marginTop: "20px" }} />

      {isGameOver && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(3,16,33,0.95)", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", zIndex: 999 }}>
          <h1 style={{ fontSize: "80px", marginBottom: "10px" }}>GAME OVER</h1>
          <h2 style={{ fontSize: "28px", marginBottom: "50px", opacity: 0.6 }}>SCORE: {score}</h2>

          <div style={{ display: "flex", gap: "25px" }}>
            <div ref={retryBtnRef} style={buttonStyle}>
              <div ref={retryFillRef} style={fillStyle} />
              RETRY
            </div>

            <div ref={mainMenuBtnRef} style={buttonStyle}>
              <div ref={mainMenuFillRef} style={fillStyle} />
              MENU
            </div>
          </div>
          
          <p style={{ marginTop: "40px", color: "#444", textTransform: "uppercase" }}>Hover to Confirm</p>
        </div>
      )}
    </div>
  );
}