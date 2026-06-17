import { Audio } from './audio';

export const AUDIO_REPOSITORY = Symbol('IAudioRepository');

export interface IAudioRepository {
  findById(id: string): Promise<Audio | null>;
  findAllByOwner(ownerUserId: string): Promise<Audio[]>;
  save(audio: Audio): Promise<Audio>;
  softDelete(id: string): Promise<void>;
}
