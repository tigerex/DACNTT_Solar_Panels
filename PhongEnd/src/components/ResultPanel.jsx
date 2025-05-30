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
        
        {/* Map mái nhà nè */}
        <img src={image} alt="Static Map" className="result-image" style={{ width: "100%", height: "100%", display: "block" }} />

        {/* Xếp panel lên mái nhà nè mà không được chán đời ghê chứ */}
        {data.placed_panels.map((p, i) => (
          <img
            key={i}
            src={`/assets/panels/${data.panel_image}`} // Sử dụng ảnh panel từ public/assets/panels
            style={{
              position: "absolute",
              left: `${p.x}px`, // Căn chỉnh theo tọa độ x của panel
              top: `${p.y}px`, // Căn chỉnh theo tọa độ y của panel
              width: `${p.width}px`, // Căn chỉnh theo kích thước width của panel
              height: `${p.height}px`, // Căn chỉnh theo kích thước height của panel
              pointerEvents: "none", 
              transform: `rotate(-${p.angle}deg)`, // Xoay panel theo góc angle
              transformOrigin: "center center" // Đặt gốc xoay ở giữa panel
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
