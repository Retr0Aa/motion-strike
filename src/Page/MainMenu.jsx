import { useEffect, useRef, useState } from "react";

import {
  HandLandmarker,
  FilesetResolver,
} from "@mediapipe/tasks-vision";

export default function MainMenu() {
  const buttonRefs = useRef([]);
  const cursorRef = useRef(null);

  const mouse = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 - 100 });
  const frozenRect = useRef(null);

  const current = useRef({ left: 0, top: 0, width: 24, height: 24, radius: 50 });
  const target = useRef({ left: 0, top: 0, width: 24, height: 24, radius: 50 });

  const [hovered, setHovered] = useState(null);

  const hoveredRef = useRef(null);
  const holdStartRef = useRef(null);
  const holdDuration = 1500;
  const fillRefs = useRef([]); // same length as buttons

  const buttons = [
    { text: "Start Game", type: "primary", action: () => window.location.href = "/game" },
    { text: "Options", type: "primary", action: () => window.location.href = "/options" },
    { text: "Skins", type: "danger", action: () => alert("Skins") },
  ];

  /*useEffect(() => {
    const move = (e) => {
      mouse.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, []);*/

  useEffect(() => {
    let handLandmarker;
    let video;
    let animationId;

    const setup = async () => {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );

      handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        },
        runningMode: "VIDEO",
        numHands: 1,
      });

      video = document.createElement("video");
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      video.style.display = "none";
      document.body.appendChild(video);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });

      video.srcObject = stream;
      await video.play();

      const detect = async () => {
        const now = performance.now();

        const results = handLandmarker.detectForVideo(video, now);

        if (results.landmarks?.length) {
          const tip = results.landmarks[0][8];

          mouse.current = {
            x: window.innerWidth - tip.x * window.innerWidth,
            y: tip.y * window.innerHeight,
          };
        }

        animationId = requestAnimationFrame(detect);
      };

      detect();
    };

    setup();

    return () => {
      cancelAnimationFrame(animationId);
      if (video?.srcObject) {
        video.srcObject.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    hoveredRef.current = hovered;
    if (hovered !== null && buttonRefs.current[hovered]) {
      holdStartRef.current = Date.now();
    } else {
      holdStartRef.current = null;
    }
  }, [hovered]);

  // Freeze rect on hover start
  useEffect(() => {
    if (hovered !== null && buttonRefs.current[hovered]) {
      const rect = buttonRefs.current[hovered].getBoundingClientRect();
      frozenRect.current = rect;
    } else {
      frozenRect.current = null;
    }
  }, [hovered]);

  useEffect(() => {
    const lerp = (a, b, t) => a + (b - a) * t;

    const currentColor = { r: 0, g: 255, b: 255 }; // start cyan
    const targetColor = { r: 0, g: 100, b: 255 };

    const animate = () => {
      if (hoveredRef.current !== null && holdStartRef.current) {
        const elapsed = Date.now() - holdStartRef.current;
        const progress = Math.min(elapsed / holdDuration, 1);

        // update the fill width directly
        const fillEl = fillRefs.current[hoveredRef.current];
        if (fillEl) {
          fillEl.style.width = `${progress * 100}%`;
          fillEl.style.opacity = `${progress * 100}%`;
          fillEl.style.backgroundColor = "rgba(0, 102, 255, 0.5)"; // optional fade effect
        }

        if (elapsed >= holdDuration) {
          buttons[hoveredRef.current].action();
          holdStartRef.current = null;
          if (fillEl) fillEl.style.width = "0%"; // reset
        }
      } else {
        // reset all fills when not hovering
        fillRefs.current.forEach((el) => {
          if (el) el.style.width = "0%";
        });
      }

      if (frozenRect.current) {
        const rect = frozenRect.current;

        target.current = {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          radius: 14,
        };

        targetColor.r = 0;
        targetColor.g = 100;
        targetColor.b = 255;
      } else {
        target.current = {
          left: mouse.current.x - 12,
          top: mouse.current.y - 12,
          width: 24,
          height: 24,
          radius: 50,
        };

        targetColor.r = 0;
        targetColor.g = 255;
        targetColor.b = 255;
      }

      current.current.left = lerp(current.current.left, target.current.left, 0.2);
      current.current.top = lerp(current.current.top, target.current.top, 0.2);
      current.current.width = lerp(current.current.width, target.current.width, 0.2);
      current.current.height = lerp(current.current.height, target.current.height, 0.2);
      current.current.radius = lerp(current.current.radius, target.current.radius, 0.2);

      currentColor.r = lerp(currentColor.r, targetColor.r, 0.2);
      currentColor.g = lerp(currentColor.g, targetColor.g, 0.2);
      currentColor.b = lerp(currentColor.b, targetColor.b, 0.2);

      const el = cursorRef.current;

      el.style.left = current.current.left - 10 + "px";
      el.style.top = current.current.top - 10 + "px";
      el.style.width = current.current.width + 12 + "px";
      el.style.height = current.current.height + 12 + "px";
      el.style.borderRadius = current.current.radius + 7 + "px";

      el.style.border = `4px solid rgb(${currentColor.r}, ${currentColor.g}, ${currentColor.b})`;

      // Manual hover detection using finger position
      let foundHover = null;

      buttonRefs.current.forEach((btn, i) => {
        if (!btn) return;

        const rect = btn.getBoundingClientRect();

        if (
          mouse.current.x >= rect.left &&
          mouse.current.x <= rect.right &&
          mouse.current.y >= rect.top &&
          mouse.current.y <= rect.bottom
        ) {
          foundHover = i;
        }
      });

      if (foundHover !== hoveredRef.current) {
        setHovered(foundHover);
      }
      requestAnimationFrame(animate);
    };

    animate();
  }, []);

  return (
    <div
      style={{
        height: "100vh",
        background: "#242424",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        gap: "40px",
        cursor: "none",
      }}
    >
      <h1>Untitled Prototype</h1>

      {buttons.map((btn, i) => (
        <div
          key={i}
          ref={(el) => (buttonRefs.current[i] = el)}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
          style={{
            position: "relative",
            width: "220px",
            height: "60px",
            borderRadius: "14px",
            border: "none",
            backgroundColor: "white",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            fontSize: "20px",
            fontFamily: "Arial",
            color: "black",
            overflow: "hidden",
          }}
        >
          {/* Fill slider */}
          <div
            ref={(el) => (fillRefs.current[i] = el)}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              height: "100%",
              width: "0%",
              backgroundColor: "rgb(0, 100, 255)",
              borderRadius: "14px",
              zIndex: 0,
              pointerEvents: "none",
              transition: "width 0.05s linear",
            }}
          />

          <span style={{ position: "relative", zIndex: 1 }}>{btn.text}</span>
        </div>
      ))}

      <div
        ref={cursorRef}
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          width: 24,
          height: 24,
          border: "4px solid #00ffff",
          borderRadius: "50%",
          pointerEvents: "none",
          zIndex: 999,
        }}
      />
    </div>
  );
}