import { BOARD_HEIGHT, BOARD_WIDTH } from './whiteboard.js';
import { drawBoard } from './whiteboardRender.js';

const EXPORT_SCALE = 2;

/** Render the board to a PNG blob on a white page. Rejects with a readable message if the browser cannot. */
export function renderBoardToBlob(shapes) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = BOARD_WIDTH * EXPORT_SCALE;
    canvas.height = BOARD_HEIGHT * EXPORT_SCALE;
    const context = canvas.getContext('2d');

    if (!context) {
      reject(new Error('Your browser could not create the image.'));
      return;
    }

    context.setTransform(EXPORT_SCALE, 0, 0, EXPORT_SCALE, 0, 0);
    drawBoard(context, shapes, { withBackground: true });

    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Your browser could not create the image.'))), 'image/png');
  });
}

/** Export the board as a downloaded PNG file. */
export async function downloadBoardImage(shapes, now = new Date()) {
  const blob = await renderBoardToBlob(shapes);
  const url = URL.createObjectURL(blob);

  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = `himi-whiteboard-${now.toISOString().slice(0, 10)}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    // Give the browser a moment to start the download before the URL is released.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
