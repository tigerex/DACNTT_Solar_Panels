import React from "react";
import "./ResultPanel.css";

export default function ResultPanel({ image, data, onClose }) {
  if (!image) return null; // Ẩn nếu chưa có ảnh

  return (
    <div className="result-panel">
      <div className="close-div">
        <button className="close-btn" onClick={onClose}>Đóng</button>
      </div>


      {/* Đoạn này bắt đầu hiện ảnh tĩnh mái nhà, panel và thông tin diện tích đồ nè mà chưa làm cũng chưa chỉnh */}
      <div className="panel-content" style={{ position: "relative", width: 400, height: 400 }}>

        {/* Ảnh tĩnh mái nhà */}
        <img src={image} alt="Static Map" className="result-image" style={{ width: "100%", height: "100%", display: "block" }} />

        {/* Hiển thị polygon mái nhà */}
        <svg
          width="400"
          height="400"
          style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
        >
          <polygon
            points={data.shrunken_polygon_pixels.map(p => `${p.x},${p.y}`).join(" ")}
            fill="rgba(0, 128, 255, 0.2)"
            stroke="blue"
            strokeWidth="2"
          />
        </svg>

        <div className="info">
          <h3>Thông tin mái nhà</h3>
          <p>Diện tích: <b>{data.area_m2?.toFixed(2)} m²</b></p>
        </div>
      </div>

    </div>
  );
}
