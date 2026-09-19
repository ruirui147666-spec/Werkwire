import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#3D6FE0",
          borderRadius: 96,
          fontFamily: "sans-serif",
        }}
      >
        <span style={{ color: "white", fontSize: 280, fontWeight: 700 }}>W</span>
      </div>
    ),
    { ...size }
  );
}
