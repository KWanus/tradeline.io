import "server-only";

/**
 * "Up next" preview of the autopilot queue for the Today page. The autopilot
 * runner queues actions client-side (localStorage) in this build, so there is
 * no server-readable queue to preview here — we return null and the Today page
 * simply hides the Up Next panel. This is the seam to wire when the queue moves
 * server-side.
 */

export type QueuePreviewItem = {
  label: string;
  detail?: string;
  score: number;
};

export type QueuePreview = {
  items: QueuePreviewItem[];
};

export async function computeQueuePreview(): Promise<QueuePreview | null> {
  return null;
}
