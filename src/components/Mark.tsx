/**
 * The official Post mark: four arrows around a shared centre, in Post orange.
 * Same geometry as build/favicon-source.svg, drawn inline so it inherits no fill.
 */
export function Mark({ size = 12 }: { size?: number }) {
  return (
    <svg
      className="mark"
      width={size}
      height={size}
      viewBox="0 0 108.89 108.89"
      fill="#ff6333"
      aria-hidden="true"
      focusable="false"
    >
      <polygon points="54.45 108.89 27.22 81.67 0 108.89 0 81.67 27.22 54.45 27.22 54.45 27.22 54.45 54.45 81.67 54.45 108.89" />
      <polygon points="0 0 27.22 27.22 0 54.45 27.22 54.45 54.45 27.22 54.45 27.22 54.45 27.22 27.22 0 0 0" />
      <polygon points="108.89 54.45 81.67 81.67 108.89 108.89 81.67 108.89 54.45 81.67 54.45 81.67 54.45 81.67 81.67 54.45 108.89 54.45" />
      <polygon points="108.89 0 81.67 27.22 54.45 0 54.45 27.22 81.67 54.45 81.67 54.45 81.67 54.45 108.89 27.22 108.89 0" />
    </svg>
  );
}
