'use client';

import { useLayoutEffect, useRef } from 'react';

export function FeaturedBannerTitle({
  firstLine,
  secondLine,
}: {
  firstLine: string;
  secondLine: string;
}) {
  const firstLineRef = useRef<HTMLSpanElement>(null);
  const secondLineRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    let animationFrame = 0;
    let isDisposed = false;

    const alignLines = () => {
      const first = firstLineRef.current;
      const second = secondLineRef.current;
      if (!first || !second) return;

      const lines = [first, second];
      lines.forEach((line) => {
        line.style.fontSize = '';
      });

      const baseSizes = lines.map((line) =>
        Number.parseFloat(window.getComputedStyle(line).fontSize),
      );
      const measureWidth = (line: HTMLSpanElement) => {
        const range = document.createRange();
        range.selectNodeContents(line);
        return range.getBoundingClientRect().width;
      };
      let widths = lines.map(measureWidth);
      if (widths.some((width) => width <= 0)) return;

      const targetWidth = Math.min(...widths);
      const fontSizes = [...baseSizes];

      for (let iteration = 0; iteration < 4; iteration += 1) {
        lines.forEach((line, index) => {
          fontSizes[index] *= targetWidth / widths[index];
          line.style.fontSize = `${fontSizes[index]}px`;
        });
        widths = lines.map(measureWidth);
        if (widths.every((width) => Math.abs(width - targetWidth) < 0.1)) break;
      }
    };

    const scheduleAlignment = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(alignLines);
    };

    void document.fonts.ready.then(() => {
      if (!isDisposed) scheduleAlignment();
    });

    const resizeObserver = new ResizeObserver(scheduleAlignment);
    if (firstLineRef.current?.parentElement) {
      resizeObserver.observe(firstLineRef.current.parentElement);
    }

    return () => {
      isDisposed = true;
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
    };
  }, [firstLine, secondLine]);

  return (
    <h3 className="font-banner-display text-xl uppercase text-white sm:text-2xl">
      <span ref={firstLineRef} className="block w-fit whitespace-nowrap">
        {firstLine}
      </span>
      {secondLine && (
        <span ref={secondLineRef} className="block w-fit whitespace-nowrap text-[#FF6500]">
          {secondLine}
        </span>
      )}
    </h3>
  );
}
