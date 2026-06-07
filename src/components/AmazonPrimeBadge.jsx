export default function AmazonPrimeBadge() {
  return (
    <span className="inline-flex flex-col items-center leading-none select-none" title="Amazon Prime">
      <span
        style={{ background: '#00A8E0', fontFamily: 'Georgia, serif' }}
        className="text-white text-[9px] font-extrabold italic tracking-widest px-2 pt-[3px] pb-[1px] rounded-t-sm"
      >
        prime
      </span>
      <svg viewBox="0 0 40 8" className="w-8" style={{ display: 'block', marginTop: '-1px' }} aria-hidden="true">
        <path d="M2 2 Q10 7 20 5 Q30 3 38 6" fill="none" stroke="#FF9900" strokeWidth="2.2" strokeLinecap="round" />
        <polygon points="35,3 39,6 35.5,8" fill="#FF9900" />
      </svg>
    </span>
  );
}
