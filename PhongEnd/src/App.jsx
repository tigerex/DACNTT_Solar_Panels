import { useState } from "react";
import MapView from "./components/MapView";
import ResultView from "./components/ResultView";

// file gốc của frontend nè các fen, ẻm sẽ gọi 2 component là MapView và ResultView
function App() {
  const [mode, setMode] = useState("map"); // "map" | "result"
  const [latlng, setLatLng] = useState(null); // lưu vị trí người dùng chọn
  const [resultData, setResultData] = useState(null); // ảnh + polygon từ backend

  // Giao diện chính của app
  return (
    <div>
      {mode === "map" && ( // nếu mode là map thì hiển thị MapView  
        <MapView
          onLocationSelected={(latlng) => { // khi người dùng chọn vị trí
            setLatLng(latlng); // Chọn rồi thì trả về tọa độ latlng
            setMode("result"); // chuyển sang chế độ hiển thị nhà user chọn
          }}
        />
      )}

      {mode === "result" && ( // nếu mode là result thì hiển thị ResultView
        <ResultView
          latlng={latlng} // truyền tọa độ latlng cho ResultView
          onBack={() => setMode("map")} // quay lại chế độ map
          // onResult={(data) => setResultData(data)} // truyền dữ liệu ảnh + polygon cho ResultView
        />
      )}
    </div>
  );
}

export default App;





// // Using Mapbox
// import * as React from 'react';
// import Map from 'react-map-gl/mapbox';
// import 'mapbox-gl/dist/mapbox-gl.css';

// function App() {
//   return (
//     <Map
//       mapboxAccessToken={import.meta.env.VITE_MAPBOX_TOKEN}
//       initialViewState={{
//         longitude: -82.983330,
//         latitude: 39.983334,
//         zoom: 18
//       }}
//       style={{width: "100vw", height: "100vh"}}
//       mapStyle="mapbox://styles/mapbox/satellite-v9"
//     />
//   );
// }

// export default App;



// import { useEffect, useRef } from "react";
// import mapboxgl from "mapbox-gl";
// import MapboxGeocoder from "@mapbox/mapbox-gl-geocoder";
// import 'mapbox-gl/dist/mapbox-gl.css';




// mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

// function App() {
//   const mapContainer = useRef(null);
//   const mapRef = useRef(null);

//   useEffect(() => {
//     mapRef.current = new mapboxgl.Map({
//       container: mapContainer.current,
//       style: "mapbox://styles/mapbox/satellite-v9", // hoặc satellite-v9
//       center: [-82.983330, 39.983334],
//       zoom: 18,
//     });

//     const geocoder = new MapboxGeocoder({
//       accessToken: mapboxgl.accessToken,
//       mapboxgl: mapboxgl,
//       placeholder: "Tìm địa chỉ ở Việt Nam...",
//       language: "vi",
//       // countries: "vn",
//       marker: true, // tự đặt marker
//     });

//     mapRef.current.addControl(geocoder);

//     // Lắng nghe sự kiện chọn địa chỉ
//     geocoder.on("result", (e) => {
//       const { center, place_name } = e.result;
//       console.log("Tọa độ:", center);      // [lng, lat]
//       console.log("Địa chỉ:", place_name); // tên địa điểm

//       // Có thể lưu vào state / gửi về backend tại đây
//     });

//     return () => mapRef.current.remove();
//   }, []);

//   return (
//     <div>
//       <div ref={mapContainer} style={{ width: "100vw", height: "100vh" }} />
//     </div>
//   );
// }

// export default App;



// // App.jsx
// import { useEffect, useState } from "react";

// function App() {
//   const [image, setImage] = useState(null);
//   const [polygon, setPolygon] = useState([]);

//   useEffect(() => {
//     fetch("http://localhost:8000/detect?lat=40.00050404206979&lng=-82.9825355066067&zoom=20")
//       .then((res) => res.json())
//       .then((data) => {
//         setImage(data.image_base64);
//         setPolygon(data.polygon);
//       });
//   }, []);

//   return (
//     <div style={{ position: "relative", width: 512, height: 512 }}>
//       {/* Ảnh nền */}
//       {image && (
//         <img
//           src={image}
//           alt="Satellite"
//           style={{ width: 512, height: 512, position: "absolute" }}
//         />
//       )}

//       {/* Overlay polygon bằng SVG */}
//       <svg
//         width={512}
//         height={512}
//         style={{ position: "absolute", top: 0, left: 0 }}
//       >
//         {polygon.length > 0 && (
//           <polygon
//             points={polygon.map((p) => p.join(",")).join(" ")}
//             fill="rgba(0, 255, 0, 0.3)"
//             stroke="lime"
//             strokeWidth={2}
//           />
//         )}
//       </svg>
//     </div>
//   );
// }

// export default App;
