import type { AchievementRecord } from "$lib/types";
import { brandingState } from "$state/branding.svelte";
import { toast } from "svelte-sonner";

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fill();
}

function drawCenteredWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
) {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;

    if (context.measureText(testLine).width <= maxWidth) {
      currentLine = testLine;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    currentLine = word;

    if (lines.length === maxLines - 1) {
      break;
    }
  }

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  lines.forEach((line, index) => {
    context.fillText(line, x, y + index * lineHeight);
  });
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;

    if (context.measureText(testLine).width <= maxWidth) {
      currentLine = testLine;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    currentLine = word;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function drawCenteredTextFit(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  maxHeight: number,
  options: {
    maxSize: number;
    minSize: number;
    weight: number;
    lineHeightRatio: number;
    color: string;
  }
) {
  for (let size = options.maxSize; size >= options.minSize; size -= 2) {
    context.font = `${options.weight} ${size}px Inter, system-ui, sans-serif`;
    const lineHeight = size * options.lineHeightRatio;
    const lines = wrapText(context, text, maxWidth);

    if (lines.length * lineHeight <= maxHeight) {
      context.fillStyle = options.color;
      lines.forEach((line, index) => {
        context.fillText(line, x, y + index * lineHeight);
      });
      return;
    }
  }

  context.font = `${options.weight} ${options.minSize}px Inter, system-ui, sans-serif`;
  context.fillStyle = options.color;
  const lineHeight = options.minSize * options.lineHeightRatio;
  const maxLines = Math.max(1, Math.floor(maxHeight / lineHeight));
  const allLines = wrapText(context, text, maxWidth);
  const lines = allLines.slice(0, maxLines);
  const lastLineIndex = lines.length - 1;

  if (lastLineIndex >= 0 && allLines.length > lines.length) {
    while (
      lines[lastLineIndex].length > 0 &&
      context.measureText(`${lines[lastLineIndex]}...`).width > maxWidth
    ) {
      lines[lastLineIndex] = lines[lastLineIndex].slice(0, -1);
    }
    lines[lastLineIndex] = `${lines[lastLineIndex]}...`;
  }

  lines.forEach((line, index) => {
    context.fillText(line, x, y + index * lineHeight);
  });
}

function cssVariable(name: string, fallback: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function colorWithOpacity(color: string, opacity: number) {
  if (color.startsWith("#") && (color.length === 7 || color.length === 4)) {
    const normalized =
      color.length === 4
        ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
        : color;
    const red = Number.parseInt(normalized.slice(1, 3), 16);
    const green = Number.parseInt(normalized.slice(3, 5), 16);
    const blue = Number.parseInt(normalized.slice(5, 7), 16);
    return `rgba(${red},${green},${blue},${opacity})`;
  }

  return color;
}

async function loadImage(src: string) {
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      resolve(image);
    };
    image.onerror = reject;
    image.src = src;
  });
}

function drawImageContain(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawnWidth = image.naturalWidth * scale;
  const drawnHeight = image.naturalHeight * scale;
  context.drawImage(
    image,
    x + (width - drawnWidth) / 2,
    y + (height - drawnHeight) / 2,
    drawnWidth,
    drawnHeight
  );
}

export async function shareAchievementStory(achievement: AchievementRecord) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to create story image.");
  }

  const brandColor = cssVariable("--brand", "#7b1113");
  const brandSubtleColor = colorWithOpacity(brandColor, 0.05);
  const brandSoftColor = colorWithOpacity(brandColor, 0.12);
  const brandBorderColor = colorWithOpacity(brandColor, 0.28);
  const foregroundColor = "#18181b";
  const mutedColor = "#71717a";

  context.fillStyle = "#f8f6f6";
  context.fillRect(0, 0, 1080, 1920);
  context.fillStyle = brandSubtleColor;
  context.fillRect(0, 0, 1080, 1920);
  context.fillStyle = brandSoftColor;
  context.beginPath();
  context.arc(70, 315, 210, 0, Math.PI * 2);
  context.fill();
  context.beginPath();
  context.arc(1010, 1550, 260, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = colorWithOpacity(brandColor, 0.22);
  context.font = "900 62px Inter, system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("✦", 180, 150);
  context.fillText("✧", 395, 130);
  context.fillText("✦", 690, 145);
  context.fillText("✧", 910, 130);

  context.shadowColor = colorWithOpacity(brandColor, 0.16);
  context.shadowBlur = 52;
  context.shadowOffsetY = 22;
  context.fillStyle = "#ffffff";
  drawRoundedRect(context, 110, 210, 860, 1540, 42);
  context.shadowColor = "transparent";
  context.shadowBlur = 0;
  context.shadowOffsetY = 0;

  context.fillStyle = "#ffffff";
  context.strokeStyle = brandBorderColor;
  context.lineWidth = 5;
  drawRoundedRect(context, 293, 315, 494, 74, 12);
  context.stroke();
  context.fillStyle = brandColor;
  context.font = "900 28px Inter, system-ui, sans-serif";
  context.fillText("✦  ACHIEVEMENT UNLOCKED  ✦", 540, 352);

  context.shadowColor = colorWithOpacity(brandColor, 0.18);
  context.shadowBlur = 45;
  context.shadowOffsetY = 24;
  context.save();
  context.translate(540, 650);
  context.rotate(0.11);
  context.fillStyle = "#ffffff";
  drawRoundedRect(context, -200, -200, 400, 400, 54);
  context.shadowColor = "transparent";
  context.shadowBlur = 0;
  context.shadowOffsetY = 0;
  context.strokeStyle = brandBorderColor;
  context.lineWidth = 10;
  context.stroke();
  context.strokeStyle = colorWithOpacity(brandColor, 0.42);
  context.lineWidth = 5;
  context.setLineDash([18, 14]);
  context.roundRect(-160, -160, 320, 320, 42);
  context.stroke();
  context.setLineDash([]);
  context.restore();
  context.shadowColor = "transparent";
  context.shadowBlur = 0;
  context.shadowOffsetY = 0;

  context.fillStyle = brandColor;
  context.font = "900 30px Inter, system-ui, sans-serif";
  context.fillText(`+${achievement.points || 0} XP`, 757, 448);
  context.fillText("GG", 326, 854);

  context.font = "205px Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif";
  context.fillText(achievement.icon || "🏆", 540, 650);

  context.fillStyle = foregroundColor;
  context.font = "900 72px Inter, system-ui, sans-serif";
  context.textBaseline = "top";
  drawCenteredWrappedText(context, achievement.name, 540, 940, 760, 84, 3);

  drawCenteredTextFit(context, achievement.description, 540, 1215, 730, 260, {
    maxSize: 38,
    minSize: 32,
    weight: 600,
    lineHeightRatio: 1.32,
    color: mutedColor
  });

  try {
    const logo = await loadImage(brandingState.profile.logoUrl);
    drawImageContain(context, logo, 340, 1600, 400, 88);
  } catch {
    context.fillStyle = brandColor;
    context.font = "900 30px Inter, system-ui, sans-serif";
    context.textBaseline = "middle";
    context.fillText(brandingState.profile.shortName || "HAOne", 540, 1644);
  }

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });

  if (!blob) {
    throw new Error("Unable to create story image.");
  }

  const filename = `${achievement.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-achievement.png`;
  const file = new File([blob], filename, { type: "image/png" });
  const shareData = {
    title: achievement.name,
    text: `I unlocked ${achievement.name} on HAOne!`,
    files: [file]
  };

  if (navigator.canShare?.(shareData)) {
    await navigator.share(shareData);
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
  toast.success("Story image downloaded");
}
