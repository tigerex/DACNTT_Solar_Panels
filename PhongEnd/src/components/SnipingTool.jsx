import React, { useState, useRef } from "react";
import html2canvas from "html2canvas";

function SnippingTool({ onClose }) {
  const [snipping, setSnipping] = useState(false);
  const [startPos, setStartPos] = useState(null);
  const [endPos, setEndPos] = useState(null);
  const overlayRef = useRef(null);

  const startSnip = (e) => {
    setStartPos({ x: e.clientX, y: e.clientY });
    setEndPos(null);
  };

  const dragSnip = (e) => {
    if (startPos) {
      setEndPos({ x: e.clientX, y: e.clientY });
    }
  };

  const finishSnip = async () => {
    if (!startPos || !endPos) {
      setSnipping(false);
      return;
    }

    setSnipping(false);
    onClose?.();

    // Capture entire screen
    const fullCanvas = await html2canvas(document.body);
    const ctx = fullCanvas.getContext("2d");

    const x = Math.min(startPos.x, endPos.x);
    const y = Math.min(startPos.y, endPos.y);
    const width = Math.abs(startPos.x - endPos.x);
    const height = Math.abs(startPos.y - endPos.y);

    // Create a new canvas for the cropped image
    const cropped = document.createElement("canvas");
    cropped.width = width;
    cropped.height = height;
    const croppedCtx = cropped.getContext("2d");
    croppedCtx.drawImage(fullCanvas, x, y, width, height, 0, 0, width, height);

    const base64 = cropped.toDataURL("image/png");

    // // 👉 Send to backend
    // await fetch("http://localhost:8000/upload-snipped", {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({ image: base64 }),
    // });

    // alert("Đã gửi ảnh thành công!");
    // 👉 Show the snipped image
    const img = document.createElement("img");
    img.src = base64;
    img.style.position = "fixed";
    img.style.top = "10px";
    img.style.right = "10px";
    img.style.zIndex = 10000;
    img.style.border = "2px solid #00f";
    img.style.boxShadow = "0 0 10px rgba(0,0,255,0.5)";
    img.style.maxWidth = "300px";
    img.style.maxHeight = "300px";
    img.onclick = () => {
      document.body.removeChild(img);
    };
    document.body.appendChild(img);
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

  return (
    <>
      <button onClick={() => setSnipping(true)}>Snip!</button>

      {snipping && (
        <div
          ref={overlayRef}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0,0,0,0.1)",
            zIndex: 9999,
            cursor: "crosshair",
          }}
          onMouseDown={startSnip}
          onMouseMove={dragSnip}
          onMouseUp={finishSnip}
        >
          <div style={snipBoxStyle()}></div>
        </div>
      )}
    </>
  );
}

export default SnippingTool;
// Note: Đống code này sử dụng html2canvas để snip ảnh từ toàn bộ trang.
// Cần cài đặt thư viện này: npm install html2canvas