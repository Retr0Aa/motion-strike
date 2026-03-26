import { useEffect, useRef, useState } from "react";
import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

const skins = [
  "/skins/skin1.png",
  "/skins/skin2.png"
];

export default function SkinsMenu() {
  const [soundLevel, setSoundLevel] = useState(6);
  const [hovered, setHovered] = useState(null); // Keep for UI logic

  const buttonRefs = useRef([]); // 0: sound, 1: credits, 2: back
  const blockRefs = useRef([]);
  const fillRefs = useRef([]); // For the specific fill elements
  const cursorRef = useRef(null);

  const [selectedSkin, setSelectedSkin] = useState(
    localStorage.getItem("selectedSkin") || skins[0]
  );

  const mouse = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 - 100 });
  const current = useRef({ left: 0, top: 0 });

  const hoveredRef = useRef(null);
  const holdStartRef = useRef(null);
  const holdDuration = 1500;

  useEffect(() => {
    let handLandmarker;
    let video;
    let animationId;

    const setup = async () => {
      const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
      handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task" },
        runningMode: "VIDEO",
        numHands: 1,
      });

      video = document.createElement("video");
      video.autoplay = video.playsInline = video.muted = true;
      video.style.display = "none";
      document.body.appendChild(video);

      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      video.srcObject = stream;
      await video.play();

      const detect = async () => {
        const results = handLandmarker.detectForVideo(video, performance.now());
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
      if (video?.srcObject) video.srcObject.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    const lerp = (a, b, t) => a + (b - a) * t;

    const animate = () => {
      // 1. Smooth Cursor Physics (Match Main Menu)
      current.current.left = lerp(current.current.left, mouse.current.x, 0.2);
      current.current.top = lerp(current.current.top, mouse.current.y, 0.2);

      const el = cursorRef.current;
      if (el) {
        el.style.left = current.current.left + "px";
        el.style.top = current.current.top + "px";
      }

      // 2. Manual Hover Detection
      let foundHover = null;
      let hoverType = null; // 'block', 'credits', or 'back'

      // Check Back Button
      if (buttonRefs.current[2]) {
        const rect = buttonRefs.current[2].getBoundingClientRect();
        if (mouse.current.x >= rect.left && mouse.current.x <= rect.right && mouse.current.y >= rect.top && mouse.current.y <= rect.bottom) {
          foundHover = 2; hoverType = 'back';
        }
      }
      // Check Credits
      if (buttonRefs.current[1]) {
        const rect = buttonRefs.current[1].getBoundingClientRect();
        if (mouse.current.x >= rect.left && mouse.current.x <= rect.right && mouse.current.y >= rect.top && mouse.current.y <= rect.bottom) {
          foundHover = 1; hoverType = 'credits';
        }
      }
      // Check Sound Blocks
      blockRefs.current.forEach((block, i) => {
        if (!block) return;
        const rect = block.getBoundingClientRect();
        if (mouse.current.x >= rect.left && mouse.current.x <= rect.right && mouse.current.y >= rect.top && mouse.current.y <= rect.bottom) {
          foundHover = `sound-${i}`; hoverType = 'block';
        }
      });

      if (foundHover !== hoveredRef.current) {
        hoveredRef.current = foundHover;
        setHovered(foundHover); // For visual state
        holdStartRef.current = foundHover !== null ? Date.now() : null;
      }

      // 3. Handle Fill Animations and Hide Cursor
      if (el) el.style.opacity = foundHover !== null ? "0" : "1";

      if (hoveredRef.current !== null && holdStartRef.current) {
        const elapsed = Date.now() - holdStartRef.current;
        const progress = Math.min(elapsed / holdDuration, 1);

        // Update correct fill element
        if (hoverType === 'credits' && fillRefs.current[1]) {
          fillRefs.current[1].style.width = `${progress * 100}%`;
        } else if (hoverType === 'back' && fillRefs.current[2]) {
          fillRefs.current[2].style.opacity = progress;
        } else if (hoverType === 'block') {
          const index = parseInt(hoveredRef.current.split('-')[1]);
          if (fillRefs.current[`block-${index}`]) {
            fillRefs.current[`block-${index}`].style.height = `${progress * 100}%`;
          }
        }

        if (elapsed >= holdDuration) {
          if (hoverType === 'back') window.location.href = "/";
          if (hoverType === 'credits') window.location.href = "/credits";
          if (hoverType === 'block') {
            const index = parseInt(hoveredRef.current.split('-')[1]);
            const skin = skins[index];

            setSelectedSkin(skin);
            localStorage.setItem("selectedSkin", skin);
          }
          holdStartRef.current = null;
        }
      } else {
        // Reset all fills
        if (fillRefs.current[1]) fillRefs.current[1].style.width = "0%";
        if (fillRefs.current[2]) fillRefs.current[2].style.opacity = "0";
        Object.keys(fillRefs.current).forEach(key => {
          if (key.includes('block')) fillRefs.current[key].style.height = "0%";
        });
      }

      requestAnimationFrame(animate);
    };

    animate();
  }, []);

  return (
    <div className="skins-container">
      <h1 className="options-title">SKINS</h1>

      <div className="options-content">
        <div className="sound-row">
          <div className="skin-blocks sound-blocks">
            {skins.map((skin, i) => (
              <div
                key={i}
                ref={el => blockRefs.current[i] = el}
                className={`skin-block sound-block ${selectedSkin === skin ? "active" : ""}`}
              >
                {/* IMAGE */}
                <img
                  src={skin}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    pointerEvents: "none"
                  }}
                />

                {/* HOLD FILL */}
                <div
                  ref={el => fillRefs.current[`block-${i}`] = el}
                  className="block-fill"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        ref={el => buttonRefs.current[2] = el}
        className={`back-btn ${hovered === 2 ? "hovered" : ""}`}
      >
        <div ref={el => fillRefs.current[2] = el} className="back-fill" />
        <span className="back-text">BACK</span>
      </div>

      <div ref={cursorRef} className="cursor" />
    </div>
  );
}