import type { ElementType } from "react";

interface ReportSectionHeadingProps {
  icon: ElementType;
  eyebrow: string;
  title: string;
  description: string;
}

/** A shared editorial opening for every report workspace section. */
export function ReportSectionHeading({ icon: Icon, eyebrow, title, description }: ReportSectionHeadingProps) {
  return (
    <header className="report-section-heading">
      <p className="section-kicker">{eyebrow}</p>
      <div className="report-section-heading-title"><span><Icon aria-hidden /></span><h2>{title}</h2></div>
      <p>{description}</p>
    </header>
  );
}
