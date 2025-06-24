import { Polygon, OverlayView } from "@react-google-maps/api";

// Hàm chuyển đổi từ mét sang pixel dựa trên zoom
// const meterToPixelScale = (zoom) => { 
//   const baseScale = 5; // số px ứng với 1m ở zoom 18
//   const zoomFactor = Math.pow(2, zoom - 18); // scale từ zoom 18
//   return baseScale * zoomFactor;
// };
const meterToPixelScale = (zoom, lat) => {
  const EARTH_CIRCUMFERENCE = 40075016.686; // mét
  const TILE_SIZE = 256; // Google tile mặc định
  const initialResolution = EARTH_CIRCUMFERENCE / TILE_SIZE; // mét / pixel tại zoom 0

  const resolution = initialResolution * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom); // theo Google Maps API documentation
  return 1 / resolution; // pixel / mét
};



const HybridPanelOverlay = ({
  panelCoords,
  angle = 0,
  zoom, // Zoom hiện tại của bản đồ
  panelWidthInMeters,
  panelHeightInMeters,
}) => {
  // // Tính tâm panel
  const lat =
    panelCoords.reduce((sum, p) => sum + p.lat, 0) / panelCoords.length;
  const lng =
    panelCoords.reduce((sum, p) => sum + p.lng, 0) / panelCoords.length;



  // console.log("Panel w:", panelWidthInMeters);
  // console.log("Panel h:", panelHeightInMeters);

  const scale = meterToPixelScale(zoom, lat); // Tính tỷ lệ pixel cho zoom hiện tại
  const width = panelWidthInMeters * scale; // Chiều rộng panel tính theo pixel
  const height = panelHeightInMeters * scale; // Chiều cao panel tính theo pixel

  // Đoạn code dưới hiển thị panel lên mái nhà
  return (
    <>
      {/* Vẽ Polygon để giữ đúng kích thước & vị trí */}
      {/* <Polygon
        path={panelCoords}
        options={{
          fillColor: "#00AA00",
          fillOpacity: 0.4,
          strokeColor: "#AA0000",
          strokeWeight: 1,
          strokeOpacity: 0.8,
          zIndex: 2,
        }}
      /> */}

      {/* OverlayView để vẽ panel bằng HTML đẹp */}
      <OverlayView
        position={{ lat, lng }}
        mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
      >
        <div
          style={{
            width: `${width + 2}px`,
            height: `${height + 5}px`,
            backgroundColor: "#242424", // nền đen đậm
            backgroundImage: `
              repeating-linear-gradient(to right,#ffffff 0.5px, transparent 0.5px, transparent 6px),
              linear-gradient(to bottom, transparent 50%,rgb(38, 0, 255) 20%,rgb(138, 0, 0) 100%, transparent 50%) 
            `,
            border: "1px solid #333",
            borderRadius: "2px",
            transform: `translate(-50%, -50%) rotate(${-angle}deg)`,
            transformOrigin: "center center",
            boxShadow: "0 0 3px rgba(0,0,0,0.4)",
            opacity: 0.95,
            pointerEvents: "none",
          }}
          title="Solar Panel"
        />
        {/* <div
          style={{
            width: `${width}px`,
            height: `${height}px`,
            backgroundColor: "#111",
            backgroundImage: `
              repeating-linear-gradient(to right, #ffffff22 1px, transparent 1px, transparent 8px),
              linear-gradient(to bottom, transparent 49%, #ffffff33 49%, #ffffff33 51%, transparent 51%)
            `,
            border: "1px solid #555",
            borderRadius: "4px",
            transform: `translate(-50%, -50%) rotate(${-angle}deg)`,
            transformOrigin: "center center",
            boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
            opacity: 0.9,
            pointerEvents: "none",
          }}
        /> */}

      </OverlayView>
    </>
  );
};

export default HybridPanelOverlay;
