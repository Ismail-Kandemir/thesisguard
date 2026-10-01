import type { Paragraph, TextSpan } from "../types";

export function createParagraphTextSpan(
  paragraph: Readonly<Paragraph>,
  startOffset: number,
  endOffset: number,
): TextSpan | null {
  if (
    !Number.isInteger(startOffset) ||
    !Number.isInteger(endOffset) ||
    startOffset < 0 ||
    endOffset < startOffset ||
    endOffset > paragraph.text.length
  ) {
    return null;
  }

  let runStart = 0;
  const runSegments = paragraph.runs.flatMap((run, runIndex) => {
    const runEnd = runStart + run.text.length;
    const segmentStart = Math.max(startOffset, runStart);
    const segmentEnd = Math.min(endOffset, runEnd);
    const currentRunStart = runStart;

    runStart = runEnd;

    if (segmentStart >= segmentEnd) {
      return [];
    }

    return [{
      runIndex,
      startOffset: segmentStart - currentRunStart,
      endOffset: segmentEnd - currentRunStart,
      text: run.text.slice(segmentStart - currentRunStart, segmentEnd - currentRunStart),
    }];
  });

  return {
    paragraphId: paragraph.id,
    startOffset,
    endOffset,
    offsetUnit: "utf16-code-unit",
    runSegments,
    text: paragraph.text.slice(startOffset, endOffset),
  };
}

