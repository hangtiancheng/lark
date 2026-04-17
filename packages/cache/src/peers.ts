export interface PeerPicker {
  pickPeer(key: string): [PeerGetter | null, boolean];
}

export interface PeerGetter {
  get(group: string, key: string): Promise<Buffer>;
}
