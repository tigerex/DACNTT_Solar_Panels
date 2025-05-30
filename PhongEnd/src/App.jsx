import { GoogleMap, LoadScript, DrawingManager, Marker, Polygon, Autocomplete } from "@react-google-maps/api";
import { useState, useRef, useEffect } from "react";
import ResultPanel from "./components/ResultPanel";


const containerStyle = {
  width: "100vw",
  height: "100vh"
};

const center = { lat: 10.7626, lng: 106.6602 };




function App() {
  const [marker, setMarker] = useState(null);
  const [polygonPath, setPolygonPath] = useState([]);
  const polygonRef = useRef(null);
  const mapRef = useRef(null); // để dùng panTo (optional)
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);

  const [showResult, setShowResult] = useState(false);
  const [panel, setPanel] = useState(null);


  const [shape, setShape] = useState(null);
  const [area, setArea] = useState(null);
  const [image, setImage] = useState(null);


  const [data, setData] = useState(null);

  // Hàm di chuyển bản đồ đến vị trí mới và cập nhật marker
  const moveTo = (lat, lng) => {
    if (mapRef.current) {
      setMarker({ lat, lng }); // cập nhật marker
      mapRef.current.panTo({ lat, lng });
      mapRef.current.setZoom(18); // nếu muốn zoom lại
    }
  };

  // Hàm xử lý khi autocomplete chọn địa điểm
  const handlePlaceChanged = () => {
    const place = autocompleteRef.current.getPlace();
    if (!place.geometry) return;

    const lat = place.geometry.location.lat();
    const lng = place.geometry.location.lng();
    moveTo(lat, lng);
  };

  // const handleMapClick = (e) => {
  //   const lat = e.latLng.lat();
  //   const lng = e.latLng.lng();
  //   setMarker({ lat, lng });

  //   console.log(`lat: ${lat}, lng: ${lng}`);

  //   // Gửi điểm đến backend (ví dụ)
  //   fetch("http://localhost:8001/api/location", {
  //     method: "POST",
  //     headers: { "Content-Type": "application/json" },
  //     body: JSON.stringify({ lat, lng })
  //   });
  // };


  // Hàm xử lý khi vẽ polygon hoàn thành và gửi polygon đến backend
  const handlePolygonComplete = (poly) => {
    
    const path = poly.getPath().getArray().map((latLng) => ({
      lat: latLng.lat(),
      lng: latLng.lng(),
    }));
    setPolygonPath(path);
    polygonRef.current = poly;
    console.log("Polygon coordinates:", path);

    // Gửi polygon đến backend
    fetch("http://localhost:8000/roof/api/polygon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coordinates: path })
    })
      .then((res) => res.json())
      .then((result) => {
        console.log("Kết quả từ backend:", result);
        // console.log("Shape:", data[0].shape);
        // console.log("Area:", data.area_m2);
        // console.log("Image (base64):", data.roof_image.slice(0, 50)); // chỉ log 1 phần chuỗi

        // Ví dụ:
        // setShape(data[0].shape);
        setData(result);
        setImage(`data:image/png;base64,${result.roof_image}`);
        // setArea(data.area_m2);
        
        // setPanel(data.panel)
        setShowResult(true); // hiển thị panel kết quả
      })
      .catch((err) => console.error("Lỗi khi gửi polygon:", err));
  };


  // Hàm đóng panel kết quả
  const handleClose = () => {
    console.log("Đóng panel");
    setShowResult(false);
    setPolygonPath([]); // xóa polygon
  };

  return (
    <LoadScript googleMapsApiKey={import.meta.env.VITE_GG_API_KEY} libraries={["drawing", "places"]}>

      <Autocomplete
        onLoad={(auto) => (autocompleteRef.current = auto)}
        onPlaceChanged={handlePlaceChanged}
      >
        <input
          type="text"
          ref={inputRef}
          placeholder="Tìm kiếm địa điểm..."
          style={{
            position: "absolute",
            top: "10px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10,
            width: "300px",
            padding: "8px",
          }}
        />
      </Autocomplete>

      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={18}
        mapTypeId="satellite"
        // onClick={handleMapClick}
        onLoad={(map) => (mapRef.current = map)}
      >


        {marker && <Marker position={marker} />}

        <DrawingManager
          onPolygonComplete={handlePolygonComplete}
          options={{
            drawingControl: true,
            drawingControlOptions: {
              position: 3,
              drawingModes: ["polygon"]
            }
          }}
        />

        {polygonPath.length > 0 && (
          <Polygon path={polygonPath} options={{ fillColor: "#00F", fillOpacity: 0.3 }} />
        )}
      </GoogleMap>


      {/* Đoạn này là gọi ResultPanel để hiển thị ảnh mái nhà với panel nè */}
      {showResult && (
        <ResultPanel
          image={image}
          // shape={shape}
          data={data}
          onClose={handleClose}
        />
      )}
    </LoadScript>


  );
}

export default App;



