import type { Track } from "../types/api";
import { LOCAL_API_BASE } from "../config/config";

export async function fetchTracks(): Promise<Track[]> {
  const response = await fetch(`${LOCAL_API_BASE}/tracks`);

  if (!response.ok) {
    throw new Error(`Backend response failed with status ${response.status}`);
  }

  return (await response.json()) as Track[];
}