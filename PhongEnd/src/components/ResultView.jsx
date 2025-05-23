import { useEffect, useState } from "react";
import { fetchDetectionResult } from "../services/api";

// Hiển thị kết quả vị trí người dùng chọn (vị trí người dùng chọn được thể hiện bằng tọa độ latlng)
export default function ResultView({ latlng, onBack }) { // latlng (được gửi từ MapView)
  const [image, setImage] = useState(null); // ảnh từ backend sẽ được set giá trị sau
  const [polygon, setPolygon] = useState([]); // polygon từ backend sẽ được set giá trị sau
  
  const lat = latlng.lat // tọa độ vĩ độ
  const lng = latlng.lng; // tọa độ kinh độ
  
  //để check giá trị latlng
  console.log(latlng);
  console.log(lat);
  console.log(lng);

   //gọi service backend để lấy ảnh tĩnh từ tọa độ latlng
  useEffect(() => {
    fetchDetectionResult(lat, lng, 20) // api được gọi nè, services/api.js
      .then((data) => {
        setImage(data.image_base64); //này là ảnh tĩnh từ backend
        setPolygon(data.polygon); //này là để lấy polygon detect bởi model, chưa làm ::)
      })
      .catch((error) => console.error("Error fetching detection result:", error));

  }, []);

  // Đoạn này là hiển thị trên web 
  return (
    // Hiện tại nguyên div bự chứa 2 thành phần là nút back và ảnh tĩnh vị trí nhà đã chọn
    <div style={{ position: "relative", width: 512, height: 512 }}>
      <button>
        <span onClick={onBack}>Quay lại</span> {/* nút back (để từ ảnh tĩnh quay lại map) */} 
      </button>

      {/* Ảnh tĩnh vị trí nhà đã chọn */}
      {image && (
        <img
          src={image}
          alt="Satellite"
          style={{ width: 512, height: 512, position: "absolute" }}
        />
      )}


    </div>
  );
}



      {/* Overlay polygon bằng SVG */}
      {/* <svg
        width={512}
        height={512}
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        {polygon.length > 0 && (
          <polygon
            points={polygon.map((p) => p.join(",")).join(" ")}
            fill="rgba(0, 255, 0, 0.3)"
            stroke="lime"
            strokeWidth={2}
          />
        )}
      </svg> */}