/**
 * A static, stylised map tile (no external tiles): land, Puget Sound, Lake
 * Union, a few arterials, the place label and an "approximate area" circle.
 */
export function MapTile({
  label,
  height = 52,
  radius = 22,
}: {
  label: string;
  height?: number;
  radius?: number;
}) {
  return (
    <div className="relative w-full overflow-hidden" style={{ height }}>
      <svg
        viewBox="0 0 400 220"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        <rect width="400" height="220" className="fill-[#e8eaed] dark:fill-[#2b2d31]" />
        {/* Puget Sound and Elliott Bay */}
        <path
          d="M0 0h70c-8 30 10 52-6 82-12 22 18 40 4 64-10 18-34 30-30 74H0Z"
          className="fill-[#aadaff] dark:fill-[#1c3a57]"
        />
        {/* Lake Union / Lake Washington */}
        <path
          d="M196 60c14-8 30 2 28 18-2 14-20 18-30 12-10-6-8-24 2-30Z"
          className="fill-[#aadaff] dark:fill-[#1c3a57]"
        />
        <path
          d="M330 0h70v220h-46c6-30-14-52-4-82 8-26-14-44-6-72 4-22-10-40-14-66Z"
          className="fill-[#aadaff] dark:fill-[#1c3a57]"
        />
        {/* Parks */}
        <path d="M250 40h34v26h-34z" className="fill-[#c8e6c9] dark:fill-[#25412b]" rx="4" />
        <path d="M110 150h40v30h-40z" className="fill-[#c8e6c9] dark:fill-[#25412b]" />
        {/* Arterials */}
        <g className="stroke-white dark:stroke-[#45484d]" strokeWidth="5" fill="none">
          <path d="M160 0c4 60-6 120 6 220" />
          <path d="M60 110h300" />
          <path d="M80 40c80 10 160-4 260 8" />
          <path d="M70 180c90-8 180 6 280-4" />
        </g>
        <g className="stroke-[#fcd77f] dark:stroke-[#6b5b2d]" strokeWidth="6" fill="none">
          <path d="M232 0c-8 70 10 140-4 220" />
        </g>
        <g className="stroke-white/80 dark:stroke-[#3a3d42]" strokeWidth="2" fill="none">
          <path d="M100 0v220M130 0v220M200 0v220M270 0v220M300 0v220" />
          <path d="M60 30h280M60 70h280M60 145h280M60 200h280" />
        </g>
      </svg>
      <span
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#0866FF] bg-[#0866FF]/20"
        style={{ width: radius * 2, height: radius * 2 }}
      />
      <span className="absolute top-1 left-1/2 -translate-x-1/2 whitespace-nowrap font-bold text-[13px] text-[#1c1e21] leading-4 [text-shadow:0_0_3px_#fff,0_0_3px_#fff] dark:text-white dark:[text-shadow:0_0_3px_#000]">
        {label}
      </span>
    </div>
  );
}
