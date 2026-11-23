import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";
import * as Y from "yjs";
import * as awarenessProtocol from "y-protocols/awareness";
import * as syncProtocol from "y-protocols/sync";
import type { Awareness } from "y-protocols/awareness";

export const MESSAGE_SYNC = 0;
export const MESSAGE_AWARENESS = 1;
export const MESSAGE_QUERY_AWARENESS = 3;

const SYNC_STEP_1 = 0;
const SYNC_STEP_2 = 1;

export function encodeSyncStep1(doc: Y.Doc): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_SYNC);
  syncProtocol.writeSyncStep1(encoder, doc);
  return encoding.toUint8Array(encoder);
}

export function encodeUpdate(update: Uint8Array): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_SYNC);
  encoding.writeVarUint(encoder, 2);
  encoding.writeVarUint8Array(encoder, update);
  return encoding.toUint8Array(encoder);
}

export function encodeAwareness(awareness: Awareness, clients?: number[]): Uint8Array {
  const ids = clients ?? Array.from(awareness.getStates().keys());
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
  encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(awareness, ids));
  return encoding.toUint8Array(encoder);
}

export function handleMessage(
  doc: Y.Doc,
  awareness: Awareness,
  data: Uint8Array,
  origin: unknown,
  readOnly: boolean,
): Uint8Array | null {
  const decoder = decoding.createDecoder(data);
  const messageType = decoding.readVarUint(decoder);

  if (messageType === MESSAGE_SYNC) {
    if (readOnly) {
      const syncType = decoding.readVarUint(decoder);
      if (syncType === SYNC_STEP_1) {
        const stateVector = decoding.readVarUint8Array(decoder);
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MESSAGE_SYNC);
        encoding.writeVarUint(encoder, SYNC_STEP_2);
        encoding.writeVarUint8Array(encoder, Y.encodeStateAsUpdate(doc, stateVector));
        return encoding.toUint8Array(encoder);
      }
      return null;
    }

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.readSyncMessage(decoder, encoder, doc, origin);
    return encoding.length(encoder) > 1 ? encoding.toUint8Array(encoder) : null;
  }

  if (messageType === MESSAGE_AWARENESS) {
    awarenessProtocol.applyAwarenessUpdate(awareness, decoding.readVarUint8Array(decoder), origin);
    return null;
  }

  if (messageType === MESSAGE_QUERY_AWARENESS) {
    return encodeAwareness(awareness);
  }

  return null;
}

export function isDocumentUpdate(data: Uint8Array): boolean {
  if (data.length < 2) return false;
  return data[0] === MESSAGE_SYNC && data[1] !== SYNC_STEP_1;
}
