import type { ReactNode } from "react";

export function SectionHeading({
  children,
  icon,
  tone = "slate",
}: {
  children: ReactNode;
  icon: string;
  tone?: "slate" | "blue" | "brass" | "violet";
}) {
  return (
    <div className={`section-heading section-heading--${tone}`}>
      <span className="section-emblem" aria-hidden="true">
        {icon}
      </span>
      <h2>{children}</h2>
      <span className="section-rule" aria-hidden="true" />
    </div>
  );
}
