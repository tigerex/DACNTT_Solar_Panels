import React, { useState, useRef } from "react";

function SnippingTool({ onClose, mapCenter, zoom, polygonPath = [], mapType = "satellite" }) {
  const [snipping, setSnipping] = useState(true); // Đặt trạng thái snipping ban đầu là true
  const [startPos, setStartPos] = useState(null); // Vị trí bắt đầu của snip
  const [endPos, setEndPos] = useState(null);     // Vị trí kết thúc của snip
  const overlayRef = useRef(null);                // Tham chiếu đến overlay để có thể thao tác sau này
  const [mousePos, setMousePos] = useState(null); // Vị trí chuột để hiển thị tooltip

  // Hàm để lấy ảnh từ URL và chuyển đổi thành File
  const fetchImageAsFile = async (url, filename = "snip.png") => {
    const response = await fetch(url);  // Gửi yêu cầu GET đến GoogleMap Static API
    const blob = await response.blob(); // Lấy blob từ response
    return new File([blob], filename, { type: blob.type }); // Chuyển đổi blob thành File
  };

  // Hàm gửi ảnh đến backend để dự đoán
  const sendToBackend = async (imageUrl) => {
    try {
      const file = await fetchImageAsFile(imageUrl); // Lấy ảnh từ URL và chuyển đổi thành File

      const formData = new FormData(); 
      formData.append("file", file); // Thêm file vào formData

      const res = await fetch("http://localhost:8000/model/predict", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.mask_base64) {
        // Tạo một thẻ img để hiển thị kết quả dự đoán
        const img = document.createElement("img");
        img.src = "data:image/png;base64," + data.mask_base64; // Chuyển đổi base64 thành URL hình ảnh
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

        console.log("Thời gian xử lý:", data.time_taken);
      } else {
        alert("Không có kết quả dự đoán!");
      }
    } catch (err) {
      console.error("Lỗi gửi backEnd:", err);
      alert("LỖI LỖI LỖI LỖI LỖI LỖIIIIIIIIIIIIIIIIIIIIII");
    }
  };

  // Hàm bắt đầu snipping khi người dùng nhấn chuột
  const startSnip = (e) => {
    setStartPos({ x: e.clientX, y: e.clientY });  // Lưu vị trí bắt đầu theo tọa độ chuột
    setEndPos(null);                              // Đặt vị trí kết thúc là null
  };

  // Hàm kéo chuột để tạo vùng snip
  const dragSnip = (e) => {
    if (startPos) {
      const dx = e.clientX - startPos.x;  // Tính khoảng cách di chuyển theo trục X
      const dy = e.clientY - startPos.y;  // Tính khoảng cách di chuyển theo trục Y

      // Do Google Static Maps API giới hạn kích thước ảnh tối đa là 640x640px cho đám dân đen dùng miễn phí như mình,
      const limitedX = Math.min(Math.abs(dx), 640) * Math.sign(dx); // Giới hạn khoảng cách di chuyển theo trục X không vượt quá 640px
      const limitedY = Math.min(Math.abs(dy), 640) * Math.sign(dy); // Giới hạn khoảng cách di chuyển theo trục Y không vượt quá 640px
 
      // Cập nhật vị trí kết thúc của snip
      setEndPos({
        x: startPos.x + limitedX, // Tính vị trí tối đa theo tọa độ chuột
        y: startPos.y + limitedY, // Tính vị trí tối đa theo tọa độ chuột
      });

      // Giới hạn kích thước hiển thị tooltip không vượt quá 640px
      const width = Math.min(Math.abs(dx), 640); // Giới hạn chiều rộng không vượt quá 640px
      const height = Math.min(Math.abs(dy), 640);// Giới hạn chiều cao không vượt quá 640px
      setMousePos({
        x: e.clientX, // Lưu vị trí chuột để hiển thị tooltip
        y: e.clientY, // Lưu vị trí chuột để hiển thị tooltip
        width,        // Lưu chiều rộng của vùng snip
        height,       // Lưu chiều cao của vùng snip
      });
    }
  };

  // Hàm tính toán kiểu dáng của hộp snip
  // Dựa trên vị trí bắt đầu và kết thúc của snip
  const snipBoxStyle = () => {
    if (!startPos || !endPos) return { display: "none" };
    const left = Math.min(startPos.x, endPos.x);    // Tính vị trí bên trái của hộp snip
    const top = Math.min(startPos.y, endPos.y);     // Tính vị trí trên cùng của hộp snip
    const width = Math.abs(startPos.x - endPos.x);  // Tính chiều rộng của hộp snip
    const height = Math.abs(startPos.y - endPos.y); // Tính chiều cao của hộp snip
    return {
      // Style thoai
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

  // Hàm tạo URL cho ảnh tĩnh từ Google Static Maps API
  const getStaticMapUrl = () => {
    if (!startPos || !endPos) return "";

    // Tính toán tọa độ trung tâm của vùng snip
    const width = Math.abs(startPos.x - endPos.x);
    const height = Math.abs(startPos.y - endPos.y);

    // Giới hạn kích thước ảnh tối đa là 640x640px
    const limitedWidth = Math.min(width, 640);
    const limitedHeight = Math.min(height, 640);
    const size = `${Math.round(limitedWidth)}x${Math.round(limitedHeight)}`;  // Kích thước ảnh theo định dạng "widthxheight"

    const base = "https://maps.googleapis.com/maps/api/staticmap";  // Base URL của Google Static Maps API
    const key = import.meta.env.VITE_GG_API_KEY;                    // Lấy API key từ biến môi trường

    let pathParam = "";
    // Nếu có polygonPath, tạo tham số path cho URL
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
