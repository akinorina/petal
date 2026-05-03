import { Image } from './image';

export const IMAGE_REPOSITORY = Symbol('IImageRepository');

export interface IImageRepository {
  findById(id: string): Promise<Image | null>;
  findAllByOwner(ownerUserId: string): Promise<Image[]>;
  save(image: Image): Promise<Image>;
  softDelete(id: string): Promise<void>;
}
