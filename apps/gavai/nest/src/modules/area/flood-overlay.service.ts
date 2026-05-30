import { Injectable } from '@nestjs/common';
import { PMTiles, Header, Compression } from 'pmtiles';
import { gunzipSync } from 'zlib';

const PMTILES_URL =
  'https://huggingface.co/datasets/bettergovph/project-noah-hazard-maps/resolve/main/PMTiles/noah_hazard_maps.pmtiles';

@Injectable()
export class FloodOverlayService {
  private pmtiles: PMTiles | null = null;
  private header: Header | null = null;

  private async getPMTiles(): Promise<PMTiles> {
    if (this.pmtiles) return this.pmtiles;
    this.pmtiles = new PMTiles(PMTILES_URL);
    this.header = await this.pmtiles.getHeader();
    return this.pmtiles;
  }

  async getTile(z: number, x: number, y: number): Promise<ArrayBuffer | null> {
    const pmtiles = await this.getPMTiles();
    const tile = await pmtiles.getZxy(z, x, y);
    if (!tile) return null;

    const data = new Uint8Array(tile.data);
    const compression = this.header?.tileCompression ?? Compression.Unknown;

    if (compression === Compression.Gzip) {
      const decompressed = gunzipSync(data);
      return decompressed.buffer.slice(
        decompressed.byteOffset,
        decompressed.byteOffset + decompressed.byteLength,
      ) as ArrayBuffer;
    }

    return tile.data;
  }
}
