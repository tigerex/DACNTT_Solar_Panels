import React from "react";
import "./ResultPanel.css";

export default function ResultPanel({ image, data, onClose }) {
  if (!image) return null; // Ẩn nếu chưa có ảnh

  return (
    <div className="result-panel">
      <div className="close-div">
        <button className="close-btn" onClick={onClose}>Đóng</button>
      </div>


      <div className="panel-content" style={{ position: "relative", width: 400, height: 400 }}>
        <img src={image} alt="Static Map" className="result-image" style={{ width: "100%", height: "100%", display: "block" }} />

        {data.placed_panels.map((p, i) => (
          <img
            key={i}
            src={`/assets/panels/${data.panel_image}`}
            style={{
              position: "absolute",
              left: `${p.x}px`,
              top: `${p.y}px`,
              width: `${p.width}px`,
              height: `${p.height}px`,
              pointerEvents: "none",
              transform: `rotate(-${p.angle}deg)`,
              transformOrigin: "center center"
            }}
          />
        ))}



        <div className="info">
          <h3>Thông tin mái nhà</h3>
          {/* <p>Hình dạng: <b>{shape}</b></p> */}
          <p>Diện tích: <b>{data.area_m2?.toFixed(2)} m²</b></p>

        </div>
      </div>
    </div>
  );
}
