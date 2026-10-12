const PATHS = {
  plus: <path d="M12 5v14M5 12h14" />,
  download: <path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  bug: (
    <>
      <path d="M9 7.5V6a3 3 0 0 1 6 0v1.5" />
      <rect x="7" y="7.5" width="10" height="12" rx="5" />
      <path d="M12 11v8.5M3 13h4M17 13h4M4 7l3 2.5M20 7l-3 2.5M4 20l3-2.5M20 20l-3-2.5" />
    </>
  ),
  bulb: <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  phone: (
    <>
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
      <path d="M11 18.5h2" />
    </>
  ),
  screen: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M3 9h18" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  mask: (
    <>
      <path d="M4 10c0-3 3.6-5 8-5s8 2 8 5c0 5-3.6 9-8 9s-8-4-8-9Z" />
      <path d="M8.5 11h2M13.5 11h2" />
    </>
  ),
  flame: <path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.4 1.2-3.8 2.4-5 .3 1.6 1 2.6 2.1 3 0-3 .5-5.6.5-8Z" />,
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
};

export default function Icon({ name }) {
  return (
    <svg className="i" viewBox="0 0 24 24" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}
