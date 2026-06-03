import { create } from 'zustand';

type GastoStore = {
  categoriaSeleccionada: string;
  setCategoria: (cat: string) => void;
  resetCategoria: () => void;
};

export const useGastoStore = create<GastoStore>((set) => ({
  categoriaSeleccionada: '',
  setCategoria: (cat) => set({ categoriaSeleccionada: cat }),
  resetCategoria: () => set({ categoriaSeleccionada: '' }),
}));
