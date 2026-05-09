import type { ReactNode } from "react";

interface IProps {
  text: string;
  query: string;
}

export function Highlight({ text, query }: IProps) {
  const term = query.trim();
  if (term.length === 0) return <>{text}</>;

  const lowerText = text.toLowerCase();
  const lowerTerm = term.toLowerCase();
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let matchIndex = lowerText.indexOf(lowerTerm, cursor);

  while (matchIndex !== -1) {
    if (matchIndex > cursor) {
      nodes.push(text.slice(cursor, matchIndex));
    }

    nodes.push(
      <mark
        key={`${matchIndex}-${lowerTerm}`}
        className="rounded bg-blue-100 px-0.5 text-blue-700"
      >
        {text.slice(matchIndex, matchIndex + term.length)}
      </mark>,
    );

    cursor = matchIndex + term.length;
    matchIndex = lowerText.indexOf(lowerTerm, cursor);
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));

  return <>{nodes}</>;
}
