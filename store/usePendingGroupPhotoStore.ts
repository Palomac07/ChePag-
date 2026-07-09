import { create } from 'zustand';
import { ImagenElegida } from '@/lib/ticketImage';

type PendingGroupPhotoStore = {
  foto: ImagenElegida | null;
  setFoto: (foto: ImagenElegida | null) => void;
  clearFoto: () => void;
};

export const usePendingGroupPhotoStore = create<PendingGroupPhotoStore>((set) => ({
  foto: null,
  setFoto: (foto) => set({ foto }),
  clearFoto: () => set({ foto: null }),
}));
