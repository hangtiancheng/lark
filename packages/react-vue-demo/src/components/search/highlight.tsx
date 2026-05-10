import { computed, defineComponent } from "@lark/react-vue";

interface IProps {
  text: string;
  query: string;
}

interface Segment {
  key: string;
  value: string;
  isMatch: boolean;
}

function getSegments(text: string, query: string): Segment[] {
  const term = query.trim();
  if (term.length === 0) {
    return [{ key: "text", value: text, isMatch: false }];
  }

  const lowerText = text.toLowerCase();
  const lowerTerm = term.toLowerCase();
  const segments: Segment[] = [];
  let cursor = 0;
  let matchIndex = lowerText.indexOf(lowerTerm, cursor);

  while (matchIndex !== -1) {
    if (matchIndex > cursor) {
      segments.push({
        key: `text-${cursor}`,
        value: text.slice(cursor, matchIndex),
        isMatch: false,
      });
    }

    segments.push({
      key: `match-${matchIndex}-${lowerTerm}`,
      value: text.slice(matchIndex, matchIndex + term.length),
      isMatch: true,
    });

    cursor = matchIndex + term.length;
    matchIndex = lowerText.indexOf(lowerTerm, cursor);
  }

  if (cursor < text.length) {
    segments.push({
      key: `text-${cursor}`,
      value: text.slice(cursor),
      isMatch: false,
    });
  }

  return segments;
}

export const Highlight = defineComponent(
  (props: IProps) => {
    const segments = computed(() => getSegments(props.text, props.query));

    return {
      segments,
    };
  },
  ({ segments }) => (
    <>
      {segments.map((segment) =>
        segment.isMatch ? (
          <mark
            key={segment.key}
            className="rounded bg-blue-100 px-0.5 text-blue-700"
          >
            {segment.value}
          </mark>
        ) : (
          segment.value
        ),
      )}
    </>
  ),
);
