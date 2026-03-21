import { useEffect, useRef, useState } from "react";

import {
  HandLandmarker,
  FilesetResolver,
} from "@mediapipe/tasks-vision";

export default function MainMenu() {
  const buttonRefs = useRef([]);
  const cursorRef = useRef(null);

  const mouse = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 - 100 });

  const current = useRef({ left: 0, top: 0 });

  const [hovered, setHovered] = useState(null);
  const hoveredRef = useRef(null);

  const holdStartRef = useRef(null);
  const holdDuration = 1500;

  const buttons = [
    { text: "Options", action: () => window.location.href = "/options", id: "options" },
    { text: "Start Game", action: () => window.location.href = "/game", id: "start" },
    { text: "Skins", action: () => alert("Skins"), id: "skins" },
  ];

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

    if (hovered !== null) {
      holdStartRef.current = Date.now();
    } else {
      holdStartRef.current = null;
    }
  }, [hovered]);

  useEffect(() => {
    const lerp = (a, b, t) => a + (b - a) * t;

    const animate = () => {
      // smooth cursor
      current.current.left = lerp(current.current.left, mouse.current.x, 0.2);
      current.current.top = lerp(current.current.top, mouse.current.y, 0.2);

      const el = cursorRef.current;
      el.style.left = current.current.left + "px";
      el.style.top = current.current.top + "px";

      // detect hover
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

      // hide cursor on hover
      el.style.opacity = foundHover === null ? "1" : "0";

      // HOLD CLICK LOGIC
      if (hoveredRef.current !== null && holdStartRef.current) {
        const elapsed = Date.now() - holdStartRef.current;

        if (elapsed >= holdDuration) {
          buttons[hoveredRef.current].action();
          holdStartRef.current = null;
        }
      }

      requestAnimationFrame(animate);
    };

    animate();
  }, []);

  return (
  <div className="mainmenu-container">
    <h1 className="titleName">Motion Tracking Game</h1>

    <div className="mainmenu-btns">
      {buttons.map((btn, i) => {
        const isHovered = hovered === i;

        return (
          <div
            key={i}
            ref={(el) => (buttonRefs.current[i] = el)}
            className={`menu-btn btn-${btn.id} ${isHovered ? "hovered" : ""}`}
          >
            <span className="btn-text">
              {btn.text}
            </span>
          </div>
        );
      })}
    </div>

    <div ref={cursorRef} className="cursor" />
  </div>
);
}