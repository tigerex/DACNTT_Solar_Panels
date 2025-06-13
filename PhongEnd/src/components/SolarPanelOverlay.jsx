import { OverlayView } from "@react-google-maps/api";

const SolarPanelOverlay = ({ position, angle, width, height }) => {
  return (
    <OverlayView
      position={position}
      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
    >
      <div
        style={{
          width: `${width}px`,
          height: `${height}px`,
          background:
            "repeating-linear-gradient(#003366 0px, #003366 2px, #004b8d 2px, #004b8d 4px)",
          border: "1px solid #111",
          borderRadius: "2px",
          transform: `rotate(${angle}deg)`,
          // transformOrigin: "center center",
          boxShadow: "0 0 4px rgba(0,0,0,0.5)",
          opacity: 0.95,
          pointerEvents: "none",
        }}
        title={`Panel @ ${angle}°`}
      />
    </OverlayView>
  );
};

export default SolarPanelOverlay;
