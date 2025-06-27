import React, { useState, useRef } from "react";

function SnippingTool({ onClose, mapCenter, zoom, polygonPath = [], mapType = "satellite" }) {
  const [snipping, setSnipping] = useState(true);
  const [startPos, setStartPos] = useState(null);
  const [endPos, setEndPos] = useState(null);
  const overlayRef = useRef(null);
  const [mousePos, setMousePos] = useState(null);

  const fetchImageAsFile = async (url, filename = "snip.png") => {
    const response = await fetch(url);
    const blob = await response.blob();
    return new File([blob], filename, { type: blob.type });
  };

  const sendToBackend = async (imageUrl) => {
    try {
      const file = await fetchImageAsFile(imageUrl);

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("http://localhost:8000/model/predict", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.mask_base64) {
        // Show result as overlay preview
        const img = document.createElement("img");
        img.src = "data:image/png;base64," + data.mask_base64;
        img.style.position = "fixed";
        img.style.bottom = "10px";
        img.style.right = "10px";
        img.style.zIndex = 10000;
        img.style.border = "1px solid #0f0";
        img.style.boxShadow = "0 0 10px rgba(0, 255, 0, 0.27)";
        img.style.maxWidth = "300px";
        img.style.maxHeight = "300px";
        img.title = "Click to close";
        img.onclick = () => document.body.removeChild(img);
        document.body.appendChild(img);

        console.log("Prediction time:", data.time_taken);
      } else {
        alert("No prediction result");
      }
    } catch (err) {
      console.error("Error sending image to backend:", err);
      alert("Prediction failed. Check console.");
    }
  };

  const startSnip = (e) => {
    setStartPos({ x: e.clientX, y: e.clientY });
    setEndPos(null);
  };

  const dragSnip = (e) => {
    if (startPos) {
      const dx = e.clientX - startPos.x;
      const dy = e.clientY - startPos.y;

      const limitedX = Math.min(Math.abs(dx), 640) * Math.sign(dx);
      const limitedY = Math.min(Math.abs(dy), 640) * Math.sign(dy);

      setEndPos({
        x: startPos.x + limitedX,
        y: startPos.y + limitedY,
      });

      const width = Math.min(Math.abs(dx), 640);
      const height = Math.min(Math.abs(dy), 640);
      setMousePos({
        x: e.clientX,
        y: e.clientY,
        width,
        height,
      });
    }
  };

  const snipBoxStyle = () => {
    if (!startPos || !endPos) return { display: "none" };
    const left = Math.min(startPos.x, endPos.x);
    const top = Math.min(startPos.y, endPos.y);
    const width = Math.abs(startPos.x - endPos.x);
    const height = Math.abs(startPos.y - endPos.y);
    return {
      position: "absolute",
      left,
      top,
      width,
      height,
      border: "2px dashed #00f",
      backgroundColor: "rgba(0,0,255,0.1)",
      zIndex: 99999,
    };
  };

  const getStaticMapUrl = () => {
    if (!startPos || !endPos) return "";

    const width = Math.abs(startPos.x - endPos.x);
    const height = Math.abs(startPos.y - endPos.y);

    // Google Static Maps API max size: 640x640 unless using premium
    const limitedWidth = Math.min(width, 640);
    const limitedHeight = Math.min(height, 640);
    const size = `${Math.round(limitedWidth)}x${Math.round(limitedHeight)}`;

    const base = "https://maps.googleapis.com/maps/api/staticmap";
    const key = import.meta.env.VITE_GG_API_KEY;

    let pathParam = "";
    if (polygonPath && polygonPath.length > 0) {
      const pathCoords = polygonPath.map(p => `${p.lat},${p.lng}`).join("|");
      pathParam = `&path=color:0xff0000ff|weight:3|${pathCoords}`;
    }

    const centerParam = `center=${mapCenter.lat},${mapCenter.lng}`;
    const zoomParam = `zoom=${zoom}`;
    const maptypeParam = `maptype=${mapType}`;

    return `${base}?${centerParam}&${zoomParam}&size=${size}&${maptypeParam}${pathParam}&key=${key}`;
  };


  const finishSnip = async () => {
    if (!startPos || !endPos) {
      setSnipping(false);
      onClose?.();
      return;
    }

    setSnipping(false);

    const staticMapUrl = getStaticMapUrl();

    sendToBackend(staticMapUrl);

    onClose?.();
  };

  return (
    <>
      {snipping && (
        <div
          ref={overlayRef}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(36, 0, 0, 0.14)",
            zIndex: 9999,
            cursor: "crosshair",
          }}
          onMouseDown={startSnip}
          onMouseMove={dragSnip}
          onMouseUp={finishSnip}
        >
          <div style={snipBoxStyle()}></div>

          {/* ✅ Max boundary box */}
          {startPos && (
            <div
              style={{
                position: "absolute",
                left: startPos.x,
                top: startPos.y,
                width: "640px",
                height: "640px",
                border: "2px dashed red",
                pointerEvents: "none",
                zIndex: 99998,
              }}
            />
          )}

          {/* ✅ Tooltip */}
          {mousePos && (
            <div
              style={{
                position: "absolute",
                top: mousePos.y - 30,
                left: mousePos.x + 10,
                padding: "4px 8px",
                backgroundColor: "black",
                color: "white",
                fontSize: "12px",
                borderRadius: "4px",
                pointerEvents: "none",
                zIndex: 99999,
                whiteSpace: "nowrap",
              }}
            >{mousePos.width >= 640 || mousePos.height >= 640 ? "Limit reach! 640×640" : `${mousePos.width} × ${mousePos.height} px`}
            </div>
          )}
        </div>
      )}

    </>
  );
}

export default SnippingTool;
